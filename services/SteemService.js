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

    //update user profile
    async updateUserProfile(username, profile) {
        await this.ensureLibraryLoaded();
        
        console.log('SteemService: Updating profile for user:', username);
        console.log('Profile data to update:', profile);
        
        // Prepare metadata in the correct format
        let metadata = {};
        let memo_key = '';
        
        try {
            // Get existing metadata and memo_key if any
            const userData = await this.getUserData(username);
            if (!userData) {
                throw new Error('User data not found');
            }
            
            // Important: Get the existing memo_key which is required for account_update
            memo_key = userData.memo_key;
            console.log('Using existing memo_key:', memo_key);
            
            if (userData.json_metadata) {
                try {
                    const existingMetadata = JSON.parse(userData.json_metadata);
                    metadata = { ...existingMetadata };
                } catch (e) {
                    console.warn('Failed to parse existing metadata, starting fresh');
                }
            }
        } catch (e) {
            console.warn('Failed to get existing user data:', e);
            // Don't throw an error yet - we'll try to get the memo key another way
        }
        
        // If we couldn't get memo_key from user data, try alternative sources
        if (!memo_key) {
            memo_key = await this.getMemoKeyFromAlternativeSources(username);
            if (!memo_key) {
                throw new Error('Cannot update profile without a memo key. Please try again later.');
            }
        }
        
        // Set or update the profile property
        metadata.profile = profile;
        
        const jsonMetadata = JSON.stringify(metadata);
        console.log('Final json_metadata to broadcast:', jsonMetadata);
        
        // Check for active key first (needed for account_update)
        const activeKey = localStorage.getItem('activeKey') || 
                          localStorage.getItem(`${username}_active_key`) ||
                          localStorage.getItem(`${username.toLowerCase()}_active_key`);
        
        // Posting key won't work for account_update, but check anyway as fallback
        const postingKey = localStorage.getItem('postingKey') || 
                          localStorage.getItem(`${username}_posting_key`) ||
                          localStorage.getItem(`${username.toLowerCase()}_posting_key`);
        
        // Log authentication method being used
        if (activeKey) {
            console.log('Using stored active key for update');
        } else if (window.steem_keychain) {
            console.log('Using Steem Keychain for update');
        } else {
            console.log('No active key or Keychain available');
        }

        // If we have active key, use it
        if (activeKey) {
            return new Promise((resolve, reject) => {
                try {
                    // Use standard operation with all required fields
                    const operations = [
                        ['account_update', {
                            account: username,
                            memo_key: memo_key, // Required field
                            json_metadata: jsonMetadata
                        }]
                    ];
                    
                    this.steem.broadcast.send(
                        { operations: operations, extensions: [] },
                        { active: activeKey }, // Use active key for account_update
                        (err, result) => {
                            if (err) {
                                console.error('Error updating profile with direct broadcast:', err);
                                reject(err);
                            } else {
                                console.log('Profile updated successfully:', result);
                                resolve(result);
                            }
                        }
                    );
                } catch (error) {
                    console.error('Exception during profile update:', error);
                    reject(error);
                }
            });
        } 
        // If Keychain is available, use it with explicit active authority
        else if (window.steem_keychain) {
            console.log('Using Keychain for profile update');

            return new Promise((resolve, reject) => {
                // Include memo_key in operation
                const operations = [
                    ['account_update', {
                        account: username,
                        memo_key: memo_key, // Required field
                        json_metadata: jsonMetadata
                    }]
                ];

                window.steem_keychain.requestBroadcast(
                    username, 
                    operations, 
                    'active', // Must use active authority for account_update
                    (response) => {
                        if (response.success) {
                            console.log('Profile updated successfully with Keychain:', response);
                            resolve(response);
                        } else {
                            console.error('Keychain broadcast error:', response.error);
                            reject(new Error(response.error));
                        }
                    }
                );
            });
        } 
        // No active key or Keychain, show explanation to user
        else {
            // Create a modal dialog explaining the need for active key
            await this.showActiveKeyRequiredModal(username);
            throw new Error('Active authority required to update profile. Please use Keychain or provide your active key.');
        }
    }

    /**
     * Get the memo key from alternative sources when not available from user data
     * @param {string} username - The username to get the memo key for
     * @returns {Promise<string>} The memo key or empty string if not found
     */
    async getMemoKeyFromAlternativeSources(username) {
        // First try to get from Keychain if available
        if (window.steem_keychain) {
            try {
                return await this.getMemoKeyFromKeychain(username);
            } catch (error) {
                console.warn('Failed to get memo key from Keychain:', error);
            }
        }
        
        // If Keychain didn't work, ask the user
        return this.askUserForMemoKey(username);
    }

    /**
     * Try to get the memo key from Steem Keychain
     * @param {string} username - The username to get the memo key for
     * @returns {Promise<string>} The memo key or empty string if not available
     */
    async getMemoKeyFromKeychain(username) {
        return new Promise((resolve, reject) => {
            // First check if we can get the public memo key
            window.steem_keychain.requestPublicKey(username, 'Memo', (response) => {
                if (response.success) {
                    console.log('Got public memo key from Keychain:', response.publicKey);
                    resolve(response.publicKey);
                } else {
                    console.warn('Keychain could not provide public memo key:', response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }

    /**
     * Ask the user to provide their memo key
     * @param {string} username - The username to get the memo key for
     * @returns {Promise<string>} The memo key or empty string if user cancels
     */
    async askUserForMemoKey(username) {
        // Create a modal dialog to ask for the memo key
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            modal.innerHTML = `
                <div class="memo-key-modal-content">
                    <h3>Memo Key Required</h3>
                    <p>To update your profile, we need your public memo key. This is not your private key - it starts with STM and is safe to share.</p>
                    
                    <div class="input-group">
                        <label for="memo-key-input">Public Memo Key for @${username}:</label>
                        <input type="text" id="memo-key-input" placeholder="STM..." />
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="memo-key-cancel">Cancel</button>
                        <button id="memo-key-submit">Submit</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('memo-key-cancel').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('');
            });
            
            document.getElementById('memo-key-submit').addEventListener('click', () => {
                const memoKey = document.getElementById('memo-key-input').value.trim();
                document.body.removeChild(modal);
                
                if (memoKey && memoKey.startsWith('STM')) {
                    resolve(memoKey);
                } else {
                    alert('Invalid memo key format. Please provide a valid public memo key starting with STM.');
                    resolve('');
                }
            });
        });
    }

    /**
     * Display a modal explaining the need for active authority
     * @param {string} username - The username
     * @returns {Promise<void>}
     */
    async showActiveKeyRequiredModal(username) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            modal.innerHTML = `
                <div class="memo-key-modal-content">
                    <h3>Active Authority Required</h3>
                    <p>Updating your profile requires your active key or active authority access.</p>
                    
                    <div class="key-options">
                        <h4>Options to proceed:</h4>
                        <ol>
                            <li>
                                <strong>Use Steem Keychain:</strong> Install the Keychain browser extension 
                                for secure access to your Steem account.
                            </li>
                            <li>
                                <strong>Add your active key:</strong> You can add your active key to local storage. 
                                <span class="warning">(Less secure - use only on trusted devices)</span>
                            </li>
                        </ol>
                    </div>
                    
                    <div class="active-key-input" style="display: none;">
                        <div class="input-group">
                            <label for="active-key-input">Enter your active private key:</label>
                            <input type="password" id="active-key-input" placeholder="5K..." />
                            <small class="warning">Warning: Only enter your key on trusted devices and connections</small>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="save-active-key" />
                            <label for="save-active-key">Save this key for future updates</label>
                        </div>
                        <button id="submit-active-key">Submit Key</button>
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="show-key-input">Use Active Key</button>
                        <button id="close-modal">Close</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-modal').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve();
            });
            
            document.getElementById('show-key-input').addEventListener('click', () => {
                document.querySelector('.active-key-input').style.display = 'block';
                document.querySelector('.modal-buttons').style.display = 'none';
            });
            
            document.getElementById('submit-active-key').addEventListener('click', () => {
                const activeKey = document.getElementById('active-key-input').value.trim();
                const saveKey = document.getElementById('save-active-key').checked;
                
                if (activeKey) {
                    if (saveKey) {
                        localStorage.setItem(`${username}_active_key`, activeKey);
                    }
                    
                    document.body.removeChild(modal);
                    resolve(activeKey);
                } else {
                    alert('Please enter your active key');
                }
            });
        });
    }

    /**
     * Get posts by a specific tag
     * @param {string} tag - The tag to filter posts by
     * @param {number} page - The page number to fetch
     * @param {number} limit - Number of posts per page
     * @returns {Promise<Object>} Posts and pagination info
     */
    async getPostsByTag(tag, page = 1, limit = 20) {
        await this.ensureLibraryLoaded();
        
        if (!tag || typeof tag !== 'string') {
            console.error('Invalid tag:', tag);
            return { posts: [], hasMore: false, currentPage: page };
        }
        
        console.log(`Fetching posts for tag: "${tag}" (page ${page})`);
        
        try {
            // Call the Steem API to get posts with the specified tag
            const query = {
                tag: tag.toLowerCase().trim(),
                limit: limit + 1 // Get one extra to check if there are more posts
            };
            
            // Add pagination if we're not on the first page
            if (page > 1 && this.lastPost) {
                query.start_author = this.lastPost.author;
                query.start_permlink = this.lastPost.permlink;
            }
            
            // Use the API with proper promise handling
            const posts = await this._getDiscussionsByMethod('getDiscussionsByCreated', query);
            
            if (!posts || !Array.isArray(posts)) {
                console.warn('Invalid response from API:', posts);
                return { posts: [], hasMore: false, currentPage: page };
            }
            
            // Store the last post for pagination
            if (posts.length > 0) {
                this.lastPost = posts[posts.length - 1];
            }
            
            // Check if there are more posts
            const hasMore = posts.length > limit;
            
            // Remove the extra post if we fetched one
            const filteredPosts = hasMore ? posts.slice(0, limit) : posts;
            
            return {
                posts: filteredPosts,
                hasMore,
                currentPage: page
            };
        } catch (error) {
            console.error('Error fetching posts by tag:', error);
            throw new Error('Failed to fetch posts by tag');
        }
    }
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';