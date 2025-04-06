import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';
import router from '../utils/Router.js'; // Add router import

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
      } else if (loginMethod === 'steemlogin') {
        result = await this._voteWithSteemLogin(voter, author, permlink, weight);
      } else {
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          // Create an auth error with flag directly at the source
          const authError = new Error('Posting key not available. Please login again.');
          authError.isAuthError = true;
          
          // Show an authentication error popup before emitting the event
          this._showAuthErrorPopup('Session Expired', 'Your login session has expired. Please log in again to continue voting.');
          
          // Emit auth error event immediately
          eventEmitter.emit('social:auth-error', {
            error: authError.message,
            action: 'vote',
            suggestion: 'Please log in again to continue',
            showPopup: true  // Flag to indicate a popup has been shown
          });
          
          throw authError;
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
      
      // Verifica se si tratta di un errore di autenticazione
      if (this._isAuthError(error)) {
        // Emetti un evento specifico per gli errori di autenticazione
        eventEmitter.emit('social:auth-error', {
          error: error.message,
          action: 'vote',
          suggestion: 'Please log out and log in again to refresh your credentials'
        });
        
        // Formatta un errore più user-friendly
        const authError = new Error(`Authentication failed: ${error.message}. Please log out and log in again.`);
        authError.isAuthError = true;
        throw authError;
      }
      
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
   * Vote with SteemLogin
   * @private
   */
  async _voteWithSteemLogin(voter, author, permlink, weight) {
    const token = authService.getSteemLoginToken();
    if (!token) {
        throw new Error('SteemLogin token not available');
    }
    
    try {
        // Chiamata all'API SteemLogin per votare
        const response = await fetch('https://api.steemlogin.com/api/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                operations: [
                    ['vote', {
                        voter,
                        author,
                        permlink,
                        weight
                    }]
                ]
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to vote through SteemLogin');
        }
        
        return await response.json();
    } catch (error) {
        console.error('SteemLogin vote error:', error);
        throw error;
    }
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
      const [account, props, rewardFund] = await Promise.all([
        steemService.getUser(user),
        this._getDynamicGlobalProperties(),
        this._getRewardFund()
      ]);
      
      if (!account || !props || !rewardFund) {
        throw new Error('Could not retrieve necessary information');
      }
      
      // Calculate effective vesting shares
      const vestingShares = parseFloat(account.vesting_shares.replace(' VESTS', ''));
      const receivedShares = parseFloat(account.received_vesting_shares.replace(' VESTS', ''));
      const delegatedShares = parseFloat(account.delegated_vesting_shares.replace(' VESTS', ''));
      const effectiveVests = vestingShares + receivedShares - delegatedShares;
      
      // Calculate current voting power (ranges from 0 to 10000, meaning 0% to 100%)
      const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
      const secondsSinceLastVote = (new Date().getTime() - lastVoteTime) / 1000;
      let votingPower = account.voting_power + (10000 * secondsSinceLastVote / 432000);
      votingPower = Math.min(votingPower, 10000);
      
      // Calculate vote rshares
      const usedPower = votingPower * 100 / 10000; // Full power vote (100%)
      const rshares = ((effectiveVests * 1000000) * usedPower) / 10000;
      
      // Calculate the value from rshares
      const recentClaims = parseFloat(rewardFund.recent_claims);
      const rewardBalance = parseFloat(rewardFund.reward_balance.replace(' STEEM', ''));
      const steemPrice = 1; // This should ideally be fetched from market data
      
      const voteValue = rshares / recentClaims * rewardBalance * steemPrice;
      
      return voteValue;
    } catch (error) {
      console.error('Error estimating vote value:', error);
      
      // Explicit check for the specific "Posting key not available" error
      if (error.message && error.message.includes('Posting key not available')) {
        console.log('Detected auth error: Posting key not available');
        eventEmitter.emit('social:auth-error', {
          error: error.message,
          action: 'vote',
          suggestion: 'Please log out and log in again to refresh your credentials'
        });
        
        // Return a special error code
        return -1;
      }
      
      // Check if this is an authentication error and handle accordingly
      if (this._isAuthError(error)) {
        console.log('Detected general auth error:', error.message);
        eventEmitter.emit('social:auth-error', {
          error: error.message,
          action: 'estimate-vote',
          suggestion: 'Please log out and log in again to refresh your credentials'
        });
        
        // Return a special error code instead of 0
        return -1;
      }
      
      return 0;
    }
  }
  
  /**
   * Checks if an error is authentication related
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} - True if the error is auth-related
   */
  _isAuthError(error) {
    if (!error) return false;
    
    // Handle both string errors and Error objects
    const errorMsg = error.message ? error.message.toLowerCase() : 
                    (typeof error === 'string' ? error.toLowerCase() : '');
    
    // More comprehensive check for auth-related errors
    return (
      errorMsg.includes('login') || 
      errorMsg.includes('posting key') ||
      errorMsg.includes('post key') ||
      errorMsg.includes('key not available') ||
      errorMsg.includes('keychain') ||
      errorMsg.includes('authority') ||
      errorMsg.includes('unauthorized') ||
      errorMsg.includes('auth') ||
      errorMsg.includes('permission') ||
      errorMsg.includes('credentials') ||
      errorMsg.includes('session') ||
      errorMsg.includes('token')
    );
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
   * Get reward fund info
   * @private
   */
  _getRewardFund() {
    return new Promise((resolve, reject) => {
      window.steem.api.getRewardFund('post', (err, result) => {
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
  
  /**
   * Show a custom auth error popup to the user
   * @private
   * @param {string} title - Error title
   * @param {string} message - Error message
   */
  _showAuthErrorPopup(title, message) {
    // Create popup elements
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'auth-error-overlay';

    const popupDiv = document.createElement('div');
    popupDiv.className = 'auth-error-popup';

    // Add content
    const titleElement = document.createElement('h3');
    titleElement.className = 'auth-error-title';
    titleElement.textContent = title || 'Authentication Error';

    const messageElement = document.createElement('p');
    messageElement.className = 'auth-error-message';
    messageElement.textContent = message || 'Please log out and log in again.';

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'auth-error-buttons';

    const okButton = document.createElement('button');
    okButton.className = 'auth-error-button auth-error-button-primary';
    okButton.textContent = 'Continue Browsing';
    
    const loginButton = document.createElement('button');
    loginButton.className = 'auth-error-button auth-error-button-secondary';
    loginButton.textContent = 'Go to Login';
    
    // Close the popup when OK is clicked without redirecting
    okButton.addEventListener('click', () => {
      document.body.removeChild(overlayDiv);
    });
    
    // Navigate to login page using Router
    loginButton.addEventListener('click', () => {
      document.body.removeChild(overlayDiv);
      const returnUrl = window.location.pathname + window.location.search;
      
      // Use the imported router directly
      router.navigate('/login', { 
        returnUrl: returnUrl,
        authError: true,
        errorReason: 'Your login session has expired'
      });
    });

    // Assemble popup
    buttonDiv.appendChild(okButton);
    buttonDiv.appendChild(loginButton);
    popupDiv.appendChild(titleElement);
    popupDiv.appendChild(messageElement);
    popupDiv.appendChild(buttonDiv);
    overlayDiv.appendChild(popupDiv);

    // Add to DOM
    document.body.appendChild(overlayDiv);
  }
}

// Create and export singleton instance
const voteService = new VoteService();
export default voteService;