import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

/**
 * Service for handling social interactions like votes and comments
 */
class VoteService {
  constructor() {
    this.votingInProgress = new Set(); // Track ongoing votes to prevent duplicates
    
    // Listen for auth changes
    eventEmitter.on('auth:changed', ({ user }) => {
      // Clear cache when user changes
      this.voteCache = new Map();
    });
    
    this.voteCache = new Map(); // Cache user votes for performance
  }
  
  /**
   * Determine se siamo su un dispositivo mobile
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * Vote on a post or comment with automatic platform detection
   * @param {Object} options - Voting options
   * @param {string} options.author - Post author
   * @param {string} options.permlink - Post permlink
   * @param {number} options.weight - Vote weight (10000 = 100%, -10000 = -100%)
   * @returns {Promise<Object>} - Operation result
   */
  async vote(options) {
    // Ensure user is logged in
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to vote');
    }
    
    const { author, permlink, weight = 10000 } = options;
    const voter = currentUser.username;
    
    // Generate unique vote identifier to prevent duplicates
    const voteId = `${voter}_${author}_${permlink}`;
    
    // Prevent duplicate votes
    if (this.votingInProgress.has(voteId)) {
      throw new Error('Vote operation already in progress');
    }
    
    try {
      this.votingInProgress.add(voteId);
      eventEmitter.emit('social:vote-started', { author, permlink, weight });
      
      await steemService.ensureLibraryLoaded();
      
      // Determine login method and platform
      const loginMethod = currentUser.loginMethod || 'privateKey';
      const isMobile = this.isMobileDevice();
      
      let result;
      
      // Su mobile, se l'utente ha usato keychain ma non è disponibile, possiamo notificarlo
      if (loginMethod === 'keychain' && isMobile && !window.steem_keychain) {
        throw new Error('Steem Keychain not available on this mobile browser. Please use a desktop browser or log in with your posting key.');
      }
      
      if (loginMethod === 'keychain' && window.steem_keychain) {
        result = await this._voteWithKeychain(voter, author, permlink, weight);
      } else {
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Posting key not available. Please login again.');
        }
        result = await this._voteWithKey(voter, postingKey, author, permlink, weight);
      }
      
      // Cache the successful vote result
      this._cacheVote(author, permlink, voter, weight);
      
      // Emit vote completed event
      eventEmitter.emit('social:vote-completed', {
        success: true,
        author,
        permlink,
        voter,
        weight
      });
      
      return result;
    } catch (error) {
      // Gestione speciale per l'annullamento da parte dell'utente
      if (error.isCancelled) {
        // Emetti un evento speciale per l'annullamento
        eventEmitter.emit('social:vote-cancelled', {
          author,
          permlink,
          voter
        });
        
        // Ri-lancia l'errore con un flag per identificarlo come annullamento
        throw error;
      }
      
      console.error('Vote failed:', error);
      
      eventEmitter.emit('social:vote-error', {
        error: error.message || 'Failed to vote',
        author,
        permlink
      });
      
      throw error;
    } finally {
      this.votingInProgress.delete(voteId);
    }
  }
  
  /**
   * Vote with Steem Keychain
   * @private
   */
  _voteWithKeychain(voter, author, permlink, weight) {
    return new Promise((resolve, reject) => {
      if (!window.steem_keychain) {
        return reject(new Error('Steem Keychain not installed'));
      }
      
      window.steem_keychain.requestVote(
        voter,      // Username
        permlink,   // Permlink
        author,     // Author
        weight,     // Weight
        (response) => {
          if (response.success) {
            resolve(response);
          } else {
            // Verifica se l'operazione è stata annullata dall'utente
            if (response.error && (
                response.error.includes('cancel') || 
                response.error.includes('Cancel') ||
                response.error.includes('Request was canceled') ||
                response.error === 'user_cancel')
            ) {
              // Crea un errore speciale per l'annullamento
              const cancelError = new Error('USER_CANCELLED');
              cancelError.isCancelled = true;
              reject(cancelError);
            } else {
              reject(new Error(response.message || response.error || 'Vote failed'));
            }
          }
        }
      );
    });
  }
  
  /**
   * Vote with posting key
   * @private
   */
  _voteWithKey(voter, postingKey, author, permlink, weight) {
    return new Promise((resolve, reject) => {
      window.steem.broadcast.vote(
        postingKey,   // Posting key
        voter,        // Voter username
        author,       // Author
        permlink,     // Permlink
        weight,       // Weight
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }
  
  /**
   * Check if the current user has voted on a post
   * @param {string} author - Post author
   * @param {string} permlink - Post permlink
   * @returns {Promise<Object|null>} - Vote data if found, null if not voted
   */
  async hasVoted(author, permlink) {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return null;
    
    const voter = currentUser.username;
    
    // Check cache first
    const cacheKey = `${author}_${permlink}`;
    const cachedVotes = this.voteCache.get(cacheKey);
    
    if (cachedVotes) {
      const userVote = cachedVotes.find(v => v.voter === voter);
      if (userVote) return userVote;
    }
    
    try {
      // Check actual blockchain data
      await steemService.ensureLibraryLoaded();
      
      const votes = await this._getActiveVotes(author, permlink);
      
      // Cache all votes for this post
      this.voteCache.set(cacheKey, votes);
      
      // Find the user's vote
      const userVote = votes.find(v => v.voter === voter);
      return userVote || null;
    } catch (error) {
      console.error('Error checking vote status:', error);
      return null;
    }
  }
  
  /**
   * Get active votes on a post
   * @private
   */
  _getActiveVotes(author, permlink) {
    return new Promise((resolve, reject) => {
      window.steem.api.getActiveVotes(author, permlink, (err, votes) => {
        if (err) {
          reject(err);
        } else {
          resolve(votes || []);
        }
      });
    });
  }
  
  /**
   * Get estimated value of a full vote from a user
   * @param {string} username - Steem username
   * @returns {Promise<number>} - Estimated vote value in SP
   */
  async getEstimatedVoteValue(username = null) {
    try {
      const user = username || authService.getCurrentUser()?.username;
      if (!user) throw new Error('Username required');
      
      await steemService.ensureLibraryLoaded();
      
      // Get account info and global properties
      const [account, props] = await Promise.all([
        steemService.getUser(user),
        this._getDynamicGlobalProperties()
      ]);
      
      if (!account || !props) {
        throw new Error('Could not retrieve necessary information');
      }
      
      // Calculate estimated vote value (this is simplified and should be improved)
      const vestingShares = parseFloat(account.vesting_shares);
      const receivedShares = parseFloat(account.received_vesting_shares);
      const delegatedShares = parseFloat(account.delegated_vesting_shares);
      
      const effectiveVests = vestingShares + receivedShares - delegatedShares;
      const totalVests = parseFloat(props.total_vesting_shares);
      const totalSteem = parseFloat(props.total_vesting_fund_steem);
      
      // Basic estimate (doesn't account for voting power or curation rewards)
      const voteValue = (effectiveVests / totalVests) * totalSteem * 0.02;
      
      return voteValue;
    } catch (error) {
      console.error('Error estimating vote value:', error);
      return 0;
    }
  }
  
  /**
   * Get dynamic global properties
   * @private
   */
  _getDynamicGlobalProperties() {
    return new Promise((resolve, reject) => {
      window.steem.api.getDynamicGlobalProperties((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }
  
  /**
   * Cache a vote
   * @private
   */
  _cacheVote(author, permlink, voter, weight) {
    const cacheKey = `${author}_${permlink}`;
    let votes = this.voteCache.get(cacheKey) || [];
    
    // Remove existing vote by this voter if any
    votes = votes.filter(v => v.voter !== voter);
    
    // Add the new vote
    votes.push({
      voter,
      weight,
      percent: weight / 100,
      time: new Date().toISOString(),
      rshares: 0 // We don't know actual rshares yet
    });
    
    // Update cache
    this.voteCache.set(cacheKey, votes);
  }
  
  /**
   * Clear all cached votes
   */
  clearCache() {
    this.voteCache.clear();
  }
}

// Create and export singleton instance
const voteService = new VoteService();
export default voteService;