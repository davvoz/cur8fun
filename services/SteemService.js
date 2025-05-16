import SteemCore from './steem-service-classes/SteemCore.js';
import PostService from './steem-service-classes/PostService.js';
import CommentService from './steem-service-classes/CommentService.js';
import UserServiceCore from './steem-service-classes/UserServiceCore.js';
import authService from './AuthService.js';

/**
 * Main service facade that delegates to specialized services
 */
class SteemService {
    constructor() {
        this.core = new SteemCore();
        this.postService = new PostService(this.core);
        this.commentService = new CommentService(this.core);
        this.userService = new UserServiceCore(this.core);
    }

    // Core functionality methods
    async loadLibrary() {
        return this.core.loadLibrary();
    }

    configureApi() {
        return this.core.configureApi();
    }

    switchEndpoint() {
        return this.core.switchEndpoint();
    }

    async ensureLibraryLoaded() {
        return this.core.ensureLibraryLoaded();
    }

    /**
     * Clears any cached data to ensure fresh results on next request
     */
    clearCache() {
        // If implementing a cache, this would clear it
        // For now just return a resolved promise
        return Promise.resolve();
    }

    // Post service methods
    async getPostsByCategory(category, page = 1, limit = 20) {
        return this.postService.getPostsByCategory(category, page, limit);
    }

    async getTrendingPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('trending', page, limit);
    }

    async getHotPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('hot', page, limit);
    }

    async getNewPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('created', page, limit);
    }

    async getPromotedPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('promoted', page, limit);
    }

    async getContent(author, permlink) {
        return this.postService.getContent(author, permlink);
    }

    async getContentReplies(author, permlink) {
        return this.postService.getContentReplies(author, permlink);
    }

    async getPostsByTag(tag, page = 1, limit = 20) {
        return this.postService.getPostsByTag(tag, page, limit);
    }

    async getUserPosts(username, limit = 50, pagination = {}) {
        return this.postService.getUserPosts(username, limit, pagination);
    }

    async getDiscussionsByBlog(query) {
        return this.postService.getDiscussionsByBlog(query);
    }

    async _fetchUserBlogPosts(username, limit) {
        return this.postService._fetchUserBlogPosts(username, limit);
    }

    _setLastPostForUser(username, post) {
        return this.postService._setLastPostForUser(username, post);
    }

    getLastPostForUser(username) {
        return this.postService.getLastPostForUser(username);
    }

    getSortMethodName(sort) {
        return this.postService.getSortMethodName(sort);
    }

    formatSimpleCommunityTitle(communityName) {
        return this.postService.formatSimpleCommunityTitle(communityName);
    }

    async fetchCommunityPosts(params) {
        // Delegate to the specialized PostService implementation
        return this.postService.fetchCommunityPosts(params);
    }

    // Comment service methods
    async createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        return this.commentService.createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata);
    }

    sanitizePermlink(permlink) {
        return this.commentService.sanitizePermlink(permlink);
    }

    async getCommentsByAuthor(author, limit = -1) {
        return this.commentService.getCommentsByAuthor(author, limit);
    }

    async getAuthorComments(username, startPermlink, limit) {
        return this.commentService.getAuthorComments(username, startPermlink, limit);
    }

    // User service methods
    async getUserData(username, options = { includeProfile: false }) {
        return this.userService.getUserData(username, options);
    }

    async getProfile(username) {
        return this.userService.getProfile(username);
    }

    async getUserInfo(username) {
        return this.userService.getUserInfo(username);
    }

    async getUser(username) {
        return this.userService.getUser(username);
    }

    async getAccountHistory(username, from = -1, limit = 10) {
        return this.userService.getAccountHistory(username, from, limit);
    }
    
    /**
     * Reblog (resteem) a post
     * @param {string} username - The username doing the reblog
     * @param {string} author - The author of the post to reblog
     * @param {string} permlink - The permlink of the post to reblog
     * @returns {Promise<Object>} - Result of the operation
     */
    async reblogPost(username, author, permlink) {
        await this.ensureLibraryLoaded();
        console.log(`SteemService: Reblogging post ${author}/${permlink} as ${username}`);
        
        // Create the reblog operation using custom_json
        const operations = [
            ['custom_json', {
                required_auths: [],
                required_posting_auths: [username],
                id: 'follow',
                json: JSON.stringify([
                    'reblog',
                    {
                        account: username,
                        author: author,
                        permlink: permlink
                    }
                ])
            }]
        ];
        
        console.log('Operations for reblog:', JSON.stringify(operations));
        
        // Determine authentication method
        const hasKeychain = typeof window.steem_keychain !== 'undefined';
        const postingKey = authService.getPostingKey();
        const loginMethod = authService.getCurrentUser()?.loginMethod || 'privateKey';
        
        console.log('Authentication details:', {
            hasKeychain,
            hasPostingKey: !!postingKey,
            loginMethod
        });
        
        // Broadcast using appropriate method
        if (loginMethod === 'keychain' && hasKeychain) {
            console.log('Broadcasting with Keychain');
            return await this.broadcastWithKeychain(username, operations);
        } else if (postingKey) {
            console.log('Broadcasting with posting key');
            return await this.broadcastWithPostingKey(operations, postingKey);
        } else {
            const error = new Error("No authentication method available");
            console.error(error);
            throw error;
        }
    }
    
    /**
     * Check if a post has been reblogged by a user
     * @param {string} username - Username to check
     * @param {string} author - Author of the post
     * @param {string} permlink - Permlink of the post
     * @returns {Promise<boolean>} - Whether the post has been reblogged
     */
    async hasReblogged(username, author, permlink) {
        try {
            await this.ensureLibraryLoaded();
            console.log(`SteemService: Checking if ${username} has reblogged ${author}/${permlink}`);
            
            // Get account history with reblog operations
            const accountHistory = await this.getAccountHistory(username, -1, 100);
            
            // Look for reblog operations in the history
            for (const historyItem of accountHistory) {
                const [, operation] = historyItem;
                
                if (operation.op[0] === 'custom_json' && operation.op[1].id === 'follow') {
                    try {
                        const customData = JSON.parse(operation.op[1].json);
                        if (Array.isArray(customData) && 
                            customData[0] === 'reblog' && 
                            customData[1] && 
                            customData[1].author === author && 
                            customData[1].permlink === permlink) {
                            console.log(`SteemService: Found reblog match in history!`);
                            return true;
                        }
                    } catch (e) {
                        console.error('Error parsing reblog JSON:', e);
                    }
                }
            }
            
            console.log(`SteemService: No reblog found for ${username} on ${author}/${permlink}`);
            return false;
        } catch (error) {
            console.error('Error checking if post was reblogged:', error);
            return false;
        }
    }
    
    /**
     * Helper method to broadcast operations using Steem Keychain
     * @param {string} username - The username performing the broadcast
     * @param {Array} operations - The operations to broadcast
     * @returns {Promise<Object>} - The result of the broadcast
     */
    async broadcastWithKeychain(username, operations) {
        console.log(`SteemService: Broadcasting with keychain for ${username}`);
        return new Promise((resolve, reject) => {
            if (!window.steem_keychain) {
                const error = new Error('Steem Keychain extension not installed or not available');
                console.error(error);
                reject(error);
                return;
            }
            
            window.steem_keychain.requestBroadcast(
                username,
                operations,
                'posting',
                (response) => {
                    console.log('Keychain response:', response);
                    if (response.success) {
                        resolve(response);
                    } else {
                        const error = new Error(response.message || 'Broadcast failed');
                        console.error('Broadcast failed:', error);
                        reject(error);
                    }
                }
            );
        });
    }
    
    /**
     * Helper method to broadcast operations using posting key
     * @param {Array} operations - The operations to broadcast
     * @param {string} postingKey - The posting key to use
     * @returns {Promise<Object>} - The result of the broadcast
     */
    async broadcastWithPostingKey(operations, postingKey) {
        await this.ensureLibraryLoaded();
        console.log('SteemService: Broadcasting with posting key');
        
        return new Promise((resolve, reject) => {
            this.core.steem.broadcast.send(
                { operations, extensions: [] },
                { posting: postingKey },
                (err, result) => {
                    if (err) {
                        console.error('Broadcast error:', err);
                        reject(err);
                    } else {
                        console.log('Broadcast result:', result);
                        resolve(result);
                    }
                }
            );
        });
    }

    async getFollowers(username) {
        return this.userService.getFollowers(username);
    }

    async getFollowing(username) {
        return this.userService.getFollowing(username);
    }
    
    /**
     * Follow a user on the Steem blockchain
     * @param {string} follower - Username of the follower
     * @param {string} following - Username of the person to follow
     * @returns {Promise<Object>} - Result of the operation
     */
    async followUser(follower, following) {
        return this.userService.followUser(follower, following);
    }
    
    /**
     * Unfollow a user on the Steem blockchain
     * @param {string} follower - Username of the follower
     * @param {string} following - Username of the person to unfollow
     * @returns {Promise<Object>} - Result of the operation
     */
    async unfollowUser(follower, following) {
        return this.userService.unfollowUser(follower, following);
    }
    
    /**
     * Check if a user follows another user
     * @param {string} follower - Username of the potential follower
     * @param {string} following - Username of the potential followed user
     * @returns {Promise<boolean>} - True if follower follows following
     */
    async checkIfFollowing(follower, following) {
        return this.userService.checkIfFollowing(follower, following);
    }

    async updateUserProfile(username, profile, activeKey = null) {
        return this.userService.updateUserProfile(username, profile, activeKey);
    }

    parseMetadata(jsonMetadata) {
        try {
            if (typeof jsonMetadata === 'string') {
                return JSON.parse(jsonMetadata);
            }
            return jsonMetadata || {};
        } catch (e) {
            return {};
        }
    }

    /**
   * Get posts from multiple preferred tags, merging and sorting them
   * @param {Array} tags Array of tag strings to fetch posts for
   * @param {number} page Page number (1-based)
   * @param {number} limit Posts per page
   * @returns {Promise<Object>} Object with posts array and hasMore flag
   */
  async getPostsByPreferredTags(tags, page = 1, limit = 20) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return this.getTrendingPosts(page, limit);
    }

    try {
      // Create a promise for each tag using the established postService methods
      const tagPromises = tags.map(tag => 
        this.postService.getPostsByTag(tag, 1, limit * 2)
      );

      // Wait for all requests to complete
      const results = await Promise.all(tagPromises);
      
      // Flatten and merge the arrays
      let allPosts = [];
      results.forEach(result => {
        if (result && Array.isArray(result.posts)) {
          allPosts = [...allPosts, ...result.posts];
        }
      });

      // Remove duplicates (posts can appear in multiple tags)
      const uniquePosts = allPosts.filter((post, index, self) => 
        index === self.findIndex(p => p.author === post.author && p.permlink === post.permlink)
      );

      // Sort by date (newest first)
      uniquePosts.sort((a, b) => new Date(b.created) - new Date(a.created));

      // Paginate the results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPosts = uniquePosts.slice(startIndex, endIndex);
      
      // Check if there are more posts
      const hasMore = uniquePosts.length > endIndex;

      return {
        posts: paginatedPosts,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching posts by preferred tags:', error);
      return { posts: [], hasMore: false };
    }
  }
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
