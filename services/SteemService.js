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
            console.log(`Fetching posts for user ${username} with limit ${limit}`);
            
            // We'll use multiple fetch methods to ensure we get ALL posts
            const posts = [];
            const seenPermalinks = new Set();
            
            // METHOD 1: Use getDiscussionsByBlog which includes posts and reblogs
            try {
                console.log("METHOD 1: Fetching via getDiscussionsByBlog");
                const blogPosts = await this._fetchUserBlogPosts(username, limit);
                console.log(`Retrieved ${blogPosts.length} blog posts`);
                
                // Add to our posts collection, tracking what we've seen
                for (const post of blogPosts) {
                    const key = `${post.author}-${post.permlink}`;
                    if (!seenPermalinks.has(key)) {
                        seenPermalinks.add(key);
                        posts.push(post);
                    }
                }
            } catch (error) {
                console.error('Error in METHOD 1:', error);
                this.switchEndpoint();
            }
            
            // METHOD 2: Use account history to find all posts directly created by the user
            try {
                console.log("METHOD 2: Fetching from account history");
                const authoredPosts = await this._fetchPostsFromAccountHistory(username, limit);
                console.log(`Retrieved ${authoredPosts.length} authored posts from history`);
                
                // Combine with previous results, avoiding duplicates
                for (const post of authoredPosts) {
                    const key = `${post.author}-${post.permlink}`;
                    if (!seenPermalinks.has(key)) {
                        seenPermalinks.add(key);
                        posts.push(post);
                    }
                }
            } catch (error) {
                console.error('Error in METHOD 2:', error);
            }
            
            // Sort all posts by date (newest first)
            posts.sort((a, b) => {
                const dateA = new Date(a.created);
                const dateB = new Date(b.created);
                return dateB - dateA;
            });
            
            console.log(`Final combined post count: ${posts.length}`);
            
            // Return the requested number of posts
            return posts.slice(0, limit);
        } catch (error) {
            console.error('Error fetching user posts:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Fetch blog posts including reblogs
     * @private
     */
    async _fetchUserBlogPosts(username, limit) {
        // Use the discussions query with multiple batches to get more results
        const allPosts = [];
        const batchSize = 100; // Maximum supported by the API
        let startAuthor = '';
        let startPermlink = '';
        
        // Keep fetching until we have enough posts or no more results
        for (let i = 0; i < Math.ceil(limit / batchSize) + 1; i++) {
            console.log(`Fetching blog batch ${i+1} (have ${allPosts.length} posts so far)`);
            
            try {
                const query = {
                    tag: username,
                    limit: batchSize
                };
                
                // Add pagination parameters if we have them
                if (startAuthor && startPermlink) {
                    query.start_author = startAuthor;
                    query.start_permlink = startPermlink;
                }
                
                const batch = await new Promise((resolve, reject) => {
                    this.steem.api.getDiscussionsByBlog(query, (err, result) => {
                        if (err) reject(err);
                        else resolve(result || []);
                    });
                });
                
                if (!batch || batch.length === 0) {
                    console.log('No more blog posts to fetch');
                    break;
                }
                
                // If this isn't the first batch, remove the first post (it's a duplicate)
                const newPosts = (i > 0 && batch.length > 0) ? batch.slice(1) : batch;
                
                if (newPosts.length === 0) {
                    console.log('No new posts in this batch');
                    break;
                }
                
                allPosts.push(...newPosts);
                
                // Check if we have enough posts
                if (allPosts.length >= limit) {
                    console.log(`Reached desired post count (${allPosts.length} >= ${limit})`);
                    break;
                }
                
                // Get last post for pagination
                const lastPost = batch[batch.length - 1];
                startAuthor = lastPost.author;
                startPermlink = lastPost.permlink;
                
                // Add a delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`Error in blog batch ${i+1}:`, error);
                this.switchEndpoint();
                // Continue with next batch
            }
        }
        
        return allPosts;
    }

    /**
     * Fetch posts from account history
     * @private
     */
    async _fetchPostsFromAccountHistory(username, limit) {
        try {
            // First get account history to find post operations
            const historyBatchSize = 3000; // Large batch to get more history
            const history = await this.getAccountHistory(username, -1, historyBatchSize);
            
            if (!history || history.length === 0) {
                return [];
            }
            
            console.log(`Retrieved ${history.length} history items for ${username}`);
            
            // Filter for comment operations that don't have a parent_author (these are posts)
            const postOps = history.filter(item => {
                const [, operation] = item[1].op;
                return operation.author === username && 
                       operation.parent_author === '' && 
                       operation.json_metadata; // Posts should have metadata
            });
            
            console.log(`Found ${postOps.length} post operations in history`);
            
            // Extract unique permalinks from operations
            const permalinks = new Set();
            postOps.forEach(item => {
                const [, operation] = item[1].op;
                permalinks.add(operation.permlink);
            });
            
            console.log(`Found ${permalinks.size} unique permalinks`);
            
            // Fetch full post data for each permlink
            const posts = [];
            const batchSize = 20; // Process in smaller batches
            const permalinkArray = Array.from(permalinks);
            
            for (let i = 0; i < permalinkArray.length; i += batchSize) {
                const batch = permalinkArray.slice(i, i + batchSize);
                console.log(`Fetching content for batch ${Math.floor(i/batchSize) + 1} (${i}-${i+batch.length}/${permalinkArray.length})`);
                
                const batchPromises = batch.map(permlink => 
                    this.getContent(username, permlink)
                        .catch(err => {
                            console.error(`Error fetching post ${username}/${permlink}:`, err);
                            return null;
                        })
                );
                
                const batchResults = await Promise.all(batchPromises);
                
                // Filter out invalid results and posts with empty body
                const validPosts = batchResults.filter(post => 
                    post && post.id && post.body && post.parent_author === ""
                );
                
                posts.push(...validPosts);
                
                // Delay between batches
                if (i + batchSize < permalinkArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            return posts;
        } catch (error) {
            console.error('Error fetching posts from account history:', error);
            return [];
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

    /**
     * Get comments by author
     * @param {string} author - Author username
     * @param {number} limit - Max number of comments to fetch
     * @returns {Promise<Array>} Array of comments
     */
    async getCommentsByAuthor(author, limit = 500) {
        try {
            console.log(`Getting comments for author ${author} with limit ${limit}`);
            
            // We'll use multiple approaches to get as many comments as possible
            
            // APPROACH 1: Use account history with multiple batches
            console.log("APPROACH 1: Fetching comments from account history");
            const commentsFromHistory = await this._getCommentsFromAccountHistory(author, limit);
            console.log(`Found ${commentsFromHistory.length} comments via account history`);
            
            // APPROACH 2: Use discussions query as a backup method
            console.log("APPROACH 2: Fetching comments via discussions query");
            const commentsFromDiscussions = await this._getCommentsFromDiscussionsQuery(author, limit);
            console.log(`Found ${commentsFromDiscussions.length} comments via discussions query`);
            
            // Combine results from both approaches
            const allCommentData = this._combineAndDeduplicateComments(
                commentsFromHistory, 
                commentsFromDiscussions
            );
            
            console.log(`Combined unique comments count: ${allCommentData.length}`);
            
            // Fetch full data for all comments
            const comments = await this._fetchCommentsInBatches(author, allCommentData);
            console.log(`Final processed comments count: ${comments.length}`);
            
            return comments;
        } catch (error) {
            console.error('Error getting comments by author:', error);
            return [];
        }
    }

    /**
     * Get comments from account history
     * @private
     */
    async _getCommentsFromAccountHistory(author, limit) {
        try {
            // Multiple batches with different starting points to get more comments
            const batchSizes = [2000, 3000, 3000, 3000]; // Multiple large batches
            const maxBatches = batchSizes.length;
            let allHistory = [];
            let lastId = -1; // Start from most recent

            // Fetch account history in multiple large batches
            for (let batch = 0; batch < maxBatches; batch++) {
                const batchSize = batchSizes[batch];
                console.log(`Fetching account history batch ${batch+1}/${maxBatches} with size ${batchSize} starting from ${lastId}`);
                
                try {
                    const historyBatch = await this.getAccountHistory(author, lastId, batchSize);
                    
                    if (!historyBatch || historyBatch.length === 0) {
                        console.log(`No more history available after batch ${batch+1}`);
                        break;
                    }
                    
                    console.log(`Retrieved ${historyBatch.length} history items in batch ${batch+1}`);
                    
                    // Find the oldest operation ID for next batch
                    if (historyBatch.length > 0) {
                        const oldestOp = historyBatch[0];
                        lastId = oldestOp ? Math.max(0, oldestOp[0] - 1) : 0;
                        
                        // If we're at the beginning of the account history, stop
                        if (lastId <= 1) {
                            console.log('Reached the beginning of account history');
                            allHistory = [...historyBatch, ...allHistory];
                            break;
                        }
                    }
                    
                    // Add history items to our collection
                    allHistory = [...historyBatch, ...allHistory];
                    
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.error(`Error fetching history batch ${batch+1}:`, error);
                    // Continue with next batch despite errors
                }
            }
            
            console.log(`Total account history items: ${allHistory.length}`);
            
            // Extract and filter for comment operations
            const commentOps = this._filterCommentOps(allHistory, author);
            console.log(`Found ${commentOps.length} comment operations`);
            
            // Extract unique comments
            return this._extractUniqueComments(commentOps, author);
        } catch (error) {
            console.error('Error getting comments from account history:', error);
            return [];
        }
    }

    /**
     * Get comments from discussions query
     * @private
     */
    async _getCommentsFromDiscussionsQuery(author, limit) {
        await this.ensureLibraryLoaded();
        
        try {
            const comments = [];
            const batchSize = 100; // Maximum supported by the API
            let startPermlink = '';
            let lastBatchSize = batchSize;
            
            // Keep fetching until we have enough or run out of comments
            while (comments.length < limit && lastBatchSize === batchSize) {
                console.log(`Fetching comments batch via discussions query (have ${comments.length} so far)`);
                
                const query = {
                    start_author: author,
                    start_permlink: startPermlink,
                    limit: batchSize,
                    select_authors: [author],
                    select_tags: [],
                    truncate_body: 1 // We'll get full body later
                };
                
                try {
                    // Get comments via discussions by comments
                    const batch = await new Promise((resolve, reject) => {
                        this.steem.api.getDiscussionsByComments(query, (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        });
                    });
                    
                    if (!batch || batch.length === 0) {
                        console.log('No more comments returned from discussions query');
                        break;
                    }
                    
                    // Skip the first result if it's the same as our start_permlink (except on first request)
                    const startIdx = startPermlink && batch.length > 0 ? 1 : 0;
                    const newBatch = batch.slice(startIdx);
                    lastBatchSize = newBatch.length;
                    
                    // Filter to only include comments (not posts)
                    const newComments = newBatch.filter(c => c.parent_author !== '');
                    console.log(`Got ${newComments.length} new comments from discussions query`);
                    
                    // Add to our collection
                    comments.push(...newComments);
                    
                    // Update the start_permlink for the next batch
                    if (batch.length > 0) {
                        const lastItem = batch[batch.length - 1];
                        startPermlink = lastItem.permlink;
                    } else {
                        break;
                    }
                    
                    // Add a small delay
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.error('Error in discussions query batch:', error);
                    this.switchEndpoint();
                    // Continue trying with next batch
                }
            }
            
            // Extract minimal data needed for later processing
            return comments.map(c => ({
                permlink: c.permlink,
                parent_author: c.parent_author,
                parent_permlink: c.parent_permlink,
                timestamp: new Date(c.created).getTime()
            }));
        } catch (error) {
            console.error('Error getting comments from discussions query:', error);
            return [];
        }
    }

    /**
     * Combine and deduplicate comments from multiple sources
     * @private
     */
    _combineAndDeduplicateComments(commentsA, commentsB) {
        // Use a Map with permlink as key to deduplicate
        const uniqueComments = new Map();
        
        // Add comments from both sources
        [...commentsA, ...commentsB].forEach(comment => {
            if (comment && comment.permlink) {
                uniqueComments.set(comment.permlink, comment);
            }
        });
        
        // Convert back to array and sort by timestamp (newest first)
        return Array.from(uniqueComments.values())
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    /**
     * Fetch comment details in batches
     * @private
     */
    async _fetchCommentsInBatches(author, commentData) {
        const comments = [];
        const batchSize = 20; // Process in batches to avoid overwhelming the API
        
        for (let i = 0; i < commentData.length; i += batchSize) {
            const batch = commentData.slice(i, i + batchSize);
            console.log(`Fetching batch ${Math.floor(i/batchSize) + 1} of comments (${i}-${i+batch.length}/${commentData.length})`);
            
            const batchPromises = batch.map(item => 
                this.getContent(author, item.permlink)
                    .catch(err => {
                        console.error(`Error fetching comment ${author}/${item.permlink}:`, err);
                        return null;
                    })
            );
            
            const batchResults = await Promise.all(batchPromises);
            const validResults = batchResults.filter(comment => 
                comment && comment.id && comment.parent_author !== ""
            );
            
            comments.push(...validResults);
            
            console.log(`Batch ${Math.floor(i/batchSize) + 1}: Retrieved ${validResults.length}/${batch.length} valid comments`);
            
            // Short delay between batches to avoid rate limiting
            if (i + batchSize < commentData.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        return comments;
    }

    /**
     * Get account history with retry capability
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
            
            // Try with a different API endpoint
            this.switchEndpoint();
            
            // Retry once with the new endpoint
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api.getAccountHistory(username, from, limit, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            } catch (retryError) {
                console.error('Error fetching account history after retry:', retryError);
                throw retryError;
            }
        }
    }
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';