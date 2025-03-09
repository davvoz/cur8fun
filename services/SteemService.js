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
     * Get trending posts
     */
    async getTrendingPosts(page = 1, limit = 20) {
        await this.ensureLibraryLoaded();
        
        try {
            // Reset tracking when starting a new session
            if (page === 1) {
                this.resetCategoryTracking('trending');
            }

            const query = {
                tag: '',
                limit: Math.min(limit + 5, 100) // Request slightly more to handle duplicates
            };
            
            // Add pagination parameters if not on first page
            if (page > 1 && this.lastPostByCategory?.trending) {
                query.start_author = this.lastPostByCategory.trending.author;
                query.start_permlink = this.lastPostByCategory.trending.permlink;
            }
            
            let posts = await this._getDiscussionsByMethod('getDiscussionsByTrending', query);
            
            // Filter out duplicates
            if (Array.isArray(posts)) {
                // Filter out any posts we've seen before
                posts = posts.filter(post => this._isNewPost(post, 'trending'));
                
                if (posts.length > 0) {
                    if (!this.lastPostByCategory) {
                        this.lastPostByCategory = {};
                    }
                    // Use the last item as the pagination marker
                    this.lastPostByCategory.trending = posts[posts.length - 1];
                }
                
                // Trim back to requested limit
                if (posts.length > limit) {
                    posts = posts.slice(0, limit);
                }
            }
            
            return {
                posts: posts || [],
                hasMore: posts && posts.length > 0
            };
        } catch (error) {
            console.error('Error fetching trending posts:', error);
            return { posts: [], hasMore: false };
        }
    }

    /**
     * Get hot posts
     */
    async getHotPosts(page = 1, limit = 20) {
        await this.ensureLibraryLoaded();
        
        try {
            // Reset tracking when starting a new session
            if (page === 1) {
                this.resetCategoryTracking('hot');
            }

            const query = {
                tag: '',
                limit: Math.min(limit + 5, 100) // Request slightly more to handle duplicates
            };
            
            // Add pagination parameters if not on first page
            if (page > 1 && this.lastPostByCategory?.hot) {
                query.start_author = this.lastPostByCategory.hot.author;
                query.start_permlink = this.lastPostByCategory.hot.permlink;
            }
            
            let posts = await this._getDiscussionsByMethod('getDiscussionsByHot', query);
            
            // Filter out duplicates
            if (Array.isArray(posts)) {
                // Filter out any posts we've seen before
                posts = posts.filter(post => this._isNewPost(post, 'hot'));
                
                if (posts.length > 0) {
                    if (!this.lastPostByCategory) {
                        this.lastPostByCategory = {};
                    }
                    // Use the last item as the pagination marker
                    this.lastPostByCategory.hot = posts[posts.length - 1];
                }
                
                // Trim back to requested limit
                if (posts.length > limit) {
                    posts = posts.slice(0, limit);
                }
            }
            
            return {
                posts: posts || [],
                hasMore: posts && posts.length > 0
            };
        } catch (error) {
            console.error('Error fetching hot posts:', error);
            return { posts: [], hasMore: false };
        }
    }

    /**
     * Get new/recent posts
     */
    async getNewPosts(page = 1, limit = 20) {
        await this.ensureLibraryLoaded();
        
        try {
            // Reset tracking when starting a new session
            if (page === 1) {
                this.resetCategoryTracking('created');
            }

            const query = {
                tag: '',
                limit: Math.min(limit + 5, 100) // Request slightly more to handle duplicates
            };
            
            // Add pagination parameters if not on first page
            if (page > 1 && this.lastPostByCategory?.created) {
                query.start_author = this.lastPostByCategory.created.author;
                query.start_permlink = this.lastPostByCategory.created.permlink;
            }
            
            let posts = await this._getDiscussionsByMethod('getDiscussionsByCreated', query);
            
            // Filter out duplicates
            if (Array.isArray(posts)) {
                // Filter out any posts we've seen before
                posts = posts.filter(post => this._isNewPost(post, 'created'));
                
                if (posts.length > 0) {
                    if (!this.lastPostByCategory) {
                        this.lastPostByCategory = {};
                    }
                    // Use the last item as the pagination marker
                    this.lastPostByCategory.created = posts[posts.length - 1];
                }
                
                // Trim back to requested limit
                if (posts.length > limit) {
                    posts = posts.slice(0, limit);
                }
            }
            
            return {
                posts: posts || [],
                hasMore: posts && posts.length > 0
            };
        } catch (error) {
            console.error('Error fetching new posts:', error);
            return { posts: [], hasMore: false };
        }
    }

    /**
     * Get promoted posts
     */
    async getPromotedPosts(page = 1, limit = 20) {
        await this.ensureLibraryLoaded();
        
        try {
            // Reset tracking when starting a new session
            if (page === 1) {
                this.resetCategoryTracking('promoted');
            }

            const query = {
                tag: '',
                limit: Math.min(limit + 5, 100) // Request slightly more to handle duplicates
            };
            
            // Add pagination parameters if not on first page
            if (page > 1 && this.lastPostByCategory?.promoted) {
                query.start_author = this.lastPostByCategory.promoted.author;
                query.start_permlink = this.lastPostByCategory.promoted.permlink;
            }
            
            let posts = await this._getDiscussionsByMethod('getDiscussionsByPromoted', query);
            
            // Filter out duplicates
            if (Array.isArray(posts)) {
                // Filter out any posts we've seen before
                posts = posts.filter(post => this._isNewPost(post, 'promoted'));
                
                if (posts.length > 0) {
                    if (!this.lastPostByCategory) {
                        this.lastPostByCategory = {};
                    }
                    // Use the last item as the pagination marker
                    this.lastPostByCategory.promoted = posts[posts.length - 1];
                }
                
                // Trim back to requested limit
                if (posts.length > limit) {
                    posts = posts.slice(0, limit);
                }
            }
            
            return {
                posts: posts || [],
                hasMore: posts && posts.length > 0
            };
        } catch (error) {
            console.error('Error fetching promoted posts:', error);
            return { posts: [], hasMore: false };
        }
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
     * Get profile information for a user
     */
    async getProfile(username) {
        await this.ensureLibraryLoaded();

        try {
            const accounts = await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (accounts && accounts.length > 0) {
                try {
                    const metadata = JSON.parse(accounts[0].json_metadata || '{}');
                    return {
                        ...accounts[0],
                        profile: metadata.profile || {}
                    };
                } catch (e) {
                    return accounts[0];
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile:', error);
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
     * Get user info
     */
    async getUserInfo(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result[0]);
                });
            });
        } catch (error) {
            console.error('Error fetching user info:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get user 
     */
    async getUser(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result[0]);
                });
            });
        } catch (error) {
            console.error('Error fetching user:', error);
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
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';