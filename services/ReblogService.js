import steemService from './SteemService.js';
import authService from './AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';

/**
 * Service for handling reblog (resteem) operations
 */
class ReblogService {
  constructor() {
    this.reblogCache = new Map(); // Cache to store reblog status (username_author_permlink => boolean)
  }

  /**
   * Reblog a post
   * @param {string} author - Author of the post
   * @param {string} permlink - Permlink of the post
   * @returns {Promise<Object>} - Result of the operation
   */  async reblogPost(author, permlink) {
    try {
      console.log(`Attempting to reblog post by ${author}/${permlink}`);
      
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser) {
        console.error('No user logged in for reblog');
        throw new Error('You must be logged in to reblog a post');
      }
      
      const username = currentUser.username;
      console.log(`User ${username} is attempting to reblog ${author}/${permlink}`);
      
      // Check if already reblogged
      const hasReblogged = await this.hasReblogged(username, author, permlink);
      console.log(`Has already reblogged: ${hasReblogged}`);
      
      if (hasReblogged) {
        throw new Error('You have already reblogged this post');
      }
      
      console.log('Calling steemService.reblogPost...');
      const result = await steemService.reblogPost(username, author, permlink);
      console.log('Reblog result:', result);
      
      // Update the cache
      const cacheKey = `${username}_${author}_${permlink}`;
      this.reblogCache.set(cacheKey, true);
      console.log(`Updated reblog cache for ${cacheKey}`);
      
      // Emit event for UI updates
      eventEmitter.emit('post:reblogged', { username, author, permlink });
      console.log('Emitted post:reblogged event');
      
      // Show notification
      eventEmitter.emit('notification', {
        type: 'success',
        message: 'Post successfully reblogged',
        duration: 3000
      });
      
      return result;
    } catch (error) {
      console.error('Error reblogging post:', error);
      
      // Show notification for error
      eventEmitter.emit('notification', {
        type: 'error',
        message: error.message || 'Failed to reblog post',
        duration: 3000
      });
      
      throw error;
    }
  }
  
  /**
   * Check if a user has reblogged a post
   * @param {string} username - Username to check
   * @param {string} author - Author of the post
   * @param {string} permlink - Permlink of the post
   * @returns {Promise<boolean>} - Whether the user has reblogged the post
   */  async hasReblogged(username, author, permlink) {
    try {
      // Check cache first
      const cacheKey = `${username}_${author}_${permlink}`;
      if (this.reblogCache.has(cacheKey)) {
        console.log(`Using cached reblog status for ${cacheKey}: ${this.reblogCache.get(cacheKey)}`);
        return this.reblogCache.get(cacheKey);
      }
      
      console.log(`Checking if ${username} has reblogged ${author}/${permlink}...`);
      
      // If not in cache, check from blockchain
      const result = await steemService.hasReblogged(username, author, permlink);
      console.log(`Reblog status for ${username} on ${author}/${permlink}: ${result}`);
      
      // Update cache
      this.reblogCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error checking reblog status:', error);
      return false;
    }
  }
  
  /**
   * Clear the reblog cache for a specific post, or all posts if no parameters are provided
   * @param {string} [username] - Username
   * @param {string} [author] - Author of the post
   * @param {string} [permlink] - Permlink of the post
   */
  clearCache(username, author, permlink) {
    if (username && author && permlink) {
      const cacheKey = `${username}_${author}_${permlink}`;
      this.reblogCache.delete(cacheKey);
    } else {
      this.reblogCache.clear();
    }
  }
}

// Create singleton instance
const reblogService = new ReblogService();
export default reblogService;
