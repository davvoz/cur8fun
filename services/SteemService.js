import eventEmitter from '../utils/EventEmitter.js';

/**
 * Service for interacting with the Steem blockchain
 */
class SteemService {
    constructor() {
        // Check if steem is already available globally
        if (window.steem) {
            this.steem = window.steem;
            this.configureApi();
        } else {
            // If not available, we need to load it
            this.loadLibrary();
        }

        // Keep your original API nodes
        this.apiEndpoints = [
            'https://api.moecki.online',
            'https://api.steemit.com',
            'https://api.steemitdev.com',
            'https://api.steemzzang.com',
            'https://api.steemit.com',
            'https://api.steemitstage.com',
            'https://api.steem.house',
            'https://api.steem.place',
            'https://api.steem.press',
            'https://api.steemstack.io',
            'https://api.steemtools.com',
            'https://api.steemul.com',
            'https://api.steemworld.org',
            'https://api.steemyy.com',
            'https://api.steemzzang.com',

        ];
        this.currentEndpoint = 0;
    }

    /**
     * Load the Steem JavaScript library dynamically
     */
    async loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/steem/dist/steem.min.js';
            script.async = true;

            script.onload = () => {
                if (window.steem) {
                    this.steem = window.steem;
                    this.configureApi();
                    eventEmitter.emit('steem:loaded');
                    resolve(this.steem);
                } else {
                    const error = new Error('Steem library loaded but not available globally');
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: 'Failed to initialize Steem connection'
                    });
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error('Failed to load Steem library');
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: 'Failed to load Steem library'
                });
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Configure API connection
     */
    configureApi() {
        if (!this.steem) {
            throw new Error('Steem library not loaded');
        }

        this.steem.api.setOptions({ url: this.apiEndpoints[this.currentEndpoint] });
        this.steem.config.set('address_prefix', 'STM');
        this.steem.config.set('chain_id', '0000000000000000000000000000000000000000000000000000000000000000');
    }

    /**
     * Switch to next API endpoint on error
     */
    switchEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % this.apiEndpoints.length;
        this.configureApi();
        console.log(`Switched to endpoint: ${this.apiEndpoints[this.currentEndpoint]}`);
        return this.apiEndpoints[this.currentEndpoint];
    }

    /**
     * Ensure Steem library is loaded before making API calls
     */
    async ensureLibraryLoaded() {
        if (!this.steem) {
            try {
                await this.loadLibrary();
            } catch (error) {
                console.error('Failed to load Steem library:', error);
                throw new Error('Steem library not loaded');
            }
        }
        return this.steem;
    }

    /**
     * Keeps track of post IDs to prevent duplicates
     * @private
     */
    _initializePostTracking() {
        if (!this.seenPostIds) {
            this.seenPostIds = {};
        }
    }

    /**
     * Check if we've already seen this post
     * @private
     */
    _isNewPost(post, category) {
        this._initializePostTracking();
        if (!this.seenPostIds[category]) {
            this.seenPostIds[category] = new Set();
        }

        const postId = `${post.author}_${post.permlink}`;
        if (this.seenPostIds[category].has(postId)) {
            return false;
        }

        this.seenPostIds[category].add(postId);
        return true;
    }

    /**
     * Reset tracking for a specific category (used when changing routes)
     */
    resetCategoryTracking(category) {
        if (this.seenPostIds && this.seenPostIds[category]) {
            this.seenPostIds[category].clear();
        }
        if (this.lastPostByCategory && this.lastPostByCategory[category]) {
            delete this.lastPostByCategory[category];
        }
    }

    /**
     * Get discussion by method with retry capability
     * @private
     */
    async _getDiscussionsByMethod(method, options, retries = 2) {
        await this.ensureLibraryLoaded();

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api[method](options, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            } catch (error) {
                console.error(`Error in ${method} (attempt ${attempt + 1}):`, error);
                if (attempt === retries) throw error;
                this.switchEndpoint();
            }
        }
    }

    /**
     * Generic method to get posts by category
     * @param {string} category - The category of posts (trending, hot, created, promoted)
     * @param {number} page - Page number
     * @param {number} limit - Number of posts per page
     * @returns {Promise<{posts: Array, hasMore: boolean}>}
     */
    async getPostsByCategory(category, page = 1, limit = 20) {
        await this.ensureLibraryLoaded();

        const method = this.getCategoryMethod(category);

        try {
            // Reset tracking when starting a new session
            if (page === 1) {
                this.resetCategoryTracking(category);
            }

            const MAX_REQUEST_LIMIT = 100;
            const query = this.buildCategoryQuery(category, page, limit, MAX_REQUEST_LIMIT);

            const posts = await this.fetchAndProcessPosts(method, query, category, limit);

            return {
                posts: posts || [],
                hasMore: Boolean(posts && posts.length > 0)
            };
        } catch (error) {
            console.error(`Error fetching ${category} posts:`, error);
            return { posts: [], hasMore: false };
        }
    }

    /**
     * Maps category to appropriate API method
     * @param {string} category - The category of posts
     * @returns {string} The API method name
     * @throws {Error} If an invalid category is provided
     */
    getCategoryMethod(category) {
        const categoryToMethod = {
            'trending': 'getDiscussionsByTrending',
            'hot': 'getDiscussionsByHot',
            'created': 'getDiscussionsByCreated',
            'promoted': 'getDiscussionsByPromoted'
        };

        const method = categoryToMethod[category];
        if (!method) {
            throw new Error(`Invalid category: ${category}`);
        }

        return method;
    }

    /**
     * Builds the query object for category requests
     * @param {string} category - The post category
     * @param {number} page - Page number
     * @param {number} limit - Number of posts per page
     * @param {number} maxLimit - Maximum request limit
     * @returns {Object} The query object
     */
    buildCategoryQuery(category, page, limit, maxLimit) {
        const query = {
            tag: '',
            limit: Math.min(limit + 5, maxLimit) // Request slightly more to handle duplicates
        };

        const lastPostData = this.lastPostByCategory && this.lastPostByCategory[category];
        if (page > 1 && lastPostData) {
            query.start_author = lastPostData.author;
            query.start_permlink = lastPostData.permlink;
        }

        return query;
    }

    /**
     * Fetches posts and processes them for display
     * @param {string} method - The API method to call
     * @param {Object} query - The query parameters
     * @param {string} category - The category being fetched
     * @param {number} limit - Number of posts to return
     * @returns {Array} Processed post array
     */
    async fetchAndProcessPosts(method, query, category, limit) {
        let posts = await this._getDiscussionsByMethod(method, query);

        if (!Array.isArray(posts)) {
            return [];
        }

        // Filter out any posts we've seen before
        posts = posts.filter(post => this._isNewPost(post, category));

        this.updateLastPostReference(posts, category);

        // Trim back to requested limit
        return posts.length > limit ? posts.slice(0, limit) : posts;
    }

    /**
     * Updates the reference to the last post for pagination
     * @param {Array} posts - The posts array
     * @param {string} category - The category
     */
    updateLastPostReference(posts, category) {
        if (posts.length === 0) {
            return;
        }

        if (!this.lastPostByCategory) {
            this.lastPostByCategory = {};
        }

        // Use the last item as the pagination marker
        this.lastPostByCategory[category] = posts[posts.length - 1];
    }

    /**
     * Get trending posts
     */
    async getTrendingPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('trending', page, limit);
    }

    /**
     * Get hot posts
     */
    async getHotPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('hot', page, limit);
    }

    /**
     * Get new/recent posts
     */
    async getNewPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('created', page, limit);
    }

    /**
     * Get promoted posts
     */
    async getPromotedPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('promoted', page, limit);
    }

    /**
     * Get post and comments by author and permlink
     */
    async getContent(author, permlink) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getContent(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get comments/replies for a post
     */
    async getContentReplies(author, permlink) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getContentReplies(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content replies:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get profile information for a user
     */
    async getProfile(username) {
        return this.getUserData(username, { includeProfile: true });
    }

    /**
     * Get user info
     */
    async getUserInfo(username) {
        return this.getUserData(username);
    }

    /**
     * Get user 
     */
    async getUser(username) {
        return this.getUserData(username);
    }

    /**
     * Get user information with specific handling options
     * @param {string} username - Username to fetch
     * @param {Object} options - Options for handling the response
     * @param {boolean} options.includeProfile - Include parsed profile data
     * @returns {Promise<Object>} User data
     */
    async getUserData(username, options = { includeProfile: false }) {
        await this.ensureLibraryLoaded();

        try {
            const accounts = await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (!accounts || accounts.length === 0) {
                return null;
            }

            const userData = accounts[0];

            if (options.includeProfile && userData) {
                try {
                    const metadata = JSON.parse(userData.json_metadata || '{}');
                    return {
                        ...userData,
                        profile: metadata.profile || {}
                    };
                } catch (e) {
                    console.error('Error parsing user metadata:', e);
                }
            }

            return userData;
        } catch (error) {
            console.error('Error fetching user data:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get account history
     */
    async getAccountHistory(username, from = -1, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccountHistory(username, from, limit, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching account history:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get posts by a specific user
     */
    async getUserPosts(username, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                // Use getDiscussionsByBlog which is more reliable for fetching a user's blog posts
                this.steem.api.getDiscussionsByBlog(
                    { tag: username, limit },
                    (err, result) => {
                        if (err) {
                            console.error('API Error details:', err);
                            reject(err);
                        } else {
                            resolve(result || []);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error fetching user posts:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    async getPostsByAuthor(options = {}) {
        const { author, limit = 10, start_permlink = '' } = options;

        try {
            // Get posts by specific author
            const query = {
                tag: author,
                limit: limit,
                truncate_body: 1
            };

            if (start_permlink) {
                query.start_permlink = start_permlink;
            }

            const response = await this.api.getDiscussionsByBlogAsync(query);
            return response || [];
        } catch (error) {
            console.error('Error fetching posts by author:', error);
            return [];
        }
    }

    async getPostsFromAll(options = {}) {
        const { limit = 20, start_author = '', start_permlink = '' } = options;

        try {
            // Get posts from entire site (trending)
            const response = await this.api.getDiscussionsByTrendingAsync({
                tag: '',
                limit: limit,
                start_author: start_author,
                start_permlink: start_permlink,
                truncate_body: 1
            });
            return response || [];
        } catch (error) {
            console.error('Error fetching posts:', error);
            return [];
        }
    }

    /**
     * Get posts by tag
     * @param {Object} options - Options for the request
     * @param {string} options.tag - Tag to fetch posts for
     * @param {number} options.page - Page number (default: 1)
     * @param {number} options.limit - Number of posts per page (default: 20)
     * @returns {Promise<{posts: Array, hasMore: boolean}>}
     */
    async getPostsByTag(options = {}) {
        const { tag, page = 1, limit = 20 } = options;

        if (!tag) {
            console.error('No tag provided to getPostsByTag');
            return { posts: [], hasMore: false };
        }

        await this.ensureLibraryLoaded();

        try {
            // Use the tag to fetch content
            const query = {
                tag: tag.toLowerCase(),
                limit: limit
            };

            if (page > 1 && this.lastTagPost) {
                query.start_author = this.lastTagPost.author;
                query.start_permlink = this.lastTagPost.permlink;
            }

            // Use trending to get popular posts with this tag
            const posts = await this._getDiscussionsByMethod('getDiscussionsByTrending', query);

            if (!posts || posts.length === 0) {
                return { posts: [], hasMore: false };
            }

            // Store the last post for pagination
            this.lastTagPost = posts[posts.length - 1];

            return {
                posts: posts,
                hasMore: posts.length > 0
            };
        } catch (error) {
            console.error(`Error fetching posts for tag ${tag}:`, error);
            return { posts: [], hasMore: false };
        }
    }

    /**
     * Creates a comment on a post or another comment
     */
    async createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        console.log('createComment method called with:', { parentAuthor, parentPermlink, author, permlink, title });
        
        await this.ensureLibraryLoaded();
        
        // Sanitize the permlink for base58 compatibility
        const sanitizedPermlink = this.sanitizePermlink(permlink);
        
        console.log('About to broadcast comment to Steem blockchain');
        
        // Check if Steem Keychain is available
        if (window.steem_keychain) {
            console.log('Using Steem Keychain for signing');
            
            return new Promise((resolve, reject) => {
                const operations = [
                    ['comment', {
                        parent_author: parentAuthor,
                        parent_permlink: parentPermlink,
                        author: author,
                        permlink: sanitizedPermlink,
                        title: title,
                        body: body,
                        json_metadata: JSON.stringify(jsonMetadata)
                    }]
                ];
                
                window.steem_keychain.requestBroadcast(author, operations, 'posting', (response) => {
                    if (response.success) {
                        console.log('Comment posted successfully with Keychain:', response);
                        resolve(response);
                    } else {
                        console.error('Keychain broadcast error:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } else {
            // Fallback to posting key method
            const postingKey = localStorage.getItem('postingKey');
            
            if (!postingKey) {
                throw new Error('No posting key found and Keychain not available. Please log in to comment.');
            }
            
            // Use the standard broadcast.comment method with a Promise wrapper
            return new Promise((resolve, reject) => {
                this.steem.broadcast.comment(
                    postingKey,
                    parentAuthor,
                    parentPermlink,
                    author,
                    sanitizedPermlink,
                    title,
                    body,
                    jsonMetadata,
                    (err, result) => {
                        if (err) {
                            console.error('Comment broadcast error:', err);
                            reject(err);
                        } else {
                            console.log('Comment posted successfully:', result);
                            resolve(result);
                        }
                    }
                );
            });
        }
    }

    /**
     * Sanitizes a permlink to ensure it's valid for the Steem blockchain
     * @param {string} permlink - The original permlink
     * @returns {string} A sanitized permlink that's valid for Steem
     */
    sanitizePermlink(permlink) {
        if (!permlink || typeof permlink !== 'string') {
            // Generate a fallback permlink based on timestamp
            return `re-comment-${Date.now().toString(36)}`;
        }

        // First, convert to lowercase (Steem requires lowercase)
        let sanitized = permlink.toLowerCase();

        // Replace spaces with hyphens
        sanitized = sanitized.replace(/\s+/g, '-');

        // Keep only alphanumeric characters, hyphens, and dots
        sanitized = sanitized.replace(/[^a-z0-9\-\.]/g, '');

        // Steem doesn't like permalinks starting with numbers or dots
        if (/^[0-9\.]/.test(sanitized)) {
            sanitized = `re-${sanitized}`;
        }

        // Make sure it's not too long (max 256 characters)
        if (sanitized.length > 256) {
            sanitized = sanitized.substring(0, 256);
        }

        // Ensure the permlink is not empty
        if (!sanitized || sanitized.length === 0) {
            sanitized = `re-comment-${Date.now().toString(36)}`;
        }

        console.log('Sanitized permlink:', sanitized);
        return sanitized;
    }

    /**
     * Get the followers of a user
     * @param {string} username - The username to fetch followers for
     * @returns {Promise<Array>} - Array of followers
     */
    async getFollowers(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getFollowers(username, '', 'blog', 1000, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error(`Error fetching followers for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Get the users followed by a user
     * @param {string} username - The username to fetch following for
     * @returns {Promise<Array>} - Array of following
     */
    async getFollowing(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getFollowing(username, '', 'blog', 1000, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error(`Error fetching following for ${username}:`, error);
            throw error;
        }
    }
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';