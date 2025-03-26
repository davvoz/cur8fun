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

    configureApi() {
        if (!this.steem) {
            throw new Error('Steem library not loaded');
        }

        this.steem.api.setOptions({ url: this.apiEndpoints[this.currentEndpoint] });
        this.steem.config.set('address_prefix', 'STM');
        this.steem.config.set('chain_id', '0000000000000000000000000000000000000000000000000000000000000000');
    }

    switchEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % this.apiEndpoints.length;
        this.configureApi();
        console.log(`Switched to endpoint: ${this.apiEndpoints[this.currentEndpoint]}`);
        return this.apiEndpoints[this.currentEndpoint];
    }

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

    _initializePostTracking() {
        if (!this.seenPostIds) {
            this.seenPostIds = {};
        }
    }

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

    resetCategoryTracking(category) {
        if (this.seenPostIds && this.seenPostIds[category]) {
            this.seenPostIds[category].clear();
        }
        if (this.lastPostByCategory && this.lastPostByCategory[category]) {
            delete this.lastPostByCategory[category];
        }
    }

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

    async getProfile(username) {
        return this.getUserData(username, { includeProfile: true });
    }

    async getUserInfo(username) {
        return this.getUserData(username);
    }

    async getUser(username) {
        return this.getUserData(username);
    }

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

    async _fetchUserBlogPosts(username, limit) {
        // Use the discussions query with multiple batches to get more results
        const allPosts = [];
        const batchSize = 100; // Maximum supported by the API
        let startAuthor = '';
        let startPermlink = '';

        // Aumentiamo il numero di tentativi per ottenere più post
        const maxBatches = Math.ceil(limit / batchSize) + 2; // +2 per assicurarci di avere abbastanza tentativi

        // Keep fetching until we have enough posts or no more results
        for (let i = 0; i < maxBatches; i++) {
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

                // Check if we have enough posts - ma continuiamo a caricare finché non abbiamo tutti i post disponibili
                if (allPosts.length >= limit && batch.length < batchSize) {
                    console.log(`Reached desired post count (${allPosts.length} >= ${limit}) and batch is smaller than max size`);
                    break;
                }

                // Get last post for pagination
                const lastPost = batch[batch.length - 1];
                startAuthor = lastPost.author;
                startPermlink = lastPost.permlink;

                // Add a delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error in blog batch ${i+1}:`, error);
                this.switchEndpoint();
                // Add a longer delay after an error
                await new Promise(resolve => setTimeout(resolve, 500));
                // Continue with next batch
            }
        }

        console.log(`Fetched a total of ${allPosts.length} blog posts for ${username}`);
        return allPosts;
    }

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
                console.log(`Fetching content for batch ${Math.floor(i / batchSize) + 1} (${i}-${i + batch.length}/${permalinkArray.length})`);

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

    async getCommentsByAuthor(author, limit = 500) {
        try {
            console.log(`Getting comments for author ${author} with limit ${limit}`);
            await this.ensureLibraryLoaded();

            // Use a single, efficient approach with the getDiscussionsByComments API
            const comments = [];
            const batchSize = 100; // Maximum allowed by API
            let startPermlink = '';
            let attempts = 0;
            const maxAttempts = Math.ceil(limit / batchSize) + 1; // Add one for possible pagination issues

            // Loop until we have enough comments or hit the max attempts
            while (comments.length < limit && attempts < maxAttempts) {
                console.log(`Fetching comments batch ${attempts + 1} (have ${comments.length} so far)`);

                try {
                    const query = {
                        start_author: author,
                        start_permlink: startPermlink,
                        limit: batchSize,
                        select_authors: [author],
                        // No truncate_body - we want the full content in one go
                    };

                    const batch = await new Promise((resolve, reject) => {
                        this.steem.api.getDiscussionsByCommentsAsync(query, (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        });
                    });

                    if (!batch || batch.length === 0) {
                        console.log('No more comments returned from API');
                        break;
                    }

                    // Skip the first result if it's a duplicate of our last result
                    const startIdx = (startPermlink && batch.length > 0 &&
                        batch[0].permlink === startPermlink) ? 1 : 0;

                    // Filter to ensure we only have comments (with parent_author) and not root posts
                    const newComments = batch.slice(startIdx).filter(c => c.parent_author !== '');
                    console.log(`Got ${newComments.length} new comments`);

                    if (newComments.length === 0) {
                        console.log('No new valid comments in this batch');
                        break;
                    }

                    // Update our collection
                    comments.push(...newComments);

                    // Set up for next batch
                    const lastItem = batch[batch.length - 1];
                    startPermlink = lastItem.permlink;

                    // Short delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Error in batch ${attempts + 1}:`, error);
                    this.switchEndpoint();
                }

                attempts++;
            }

            console.log(`Total comments fetched: ${comments.length}`);

            // Sort by date, newest first
            return comments.sort((a, b) => new Date(b.created) - new Date(a.created));
        } catch (error) {
            console.error('Error getting comments by author:', error);
            return [];
        }
    }

   

    async getAuthorComments(username, startPermlink, limit) {
        // Assicurati che la libreria sia caricata
        await this.ensureLibraryLoaded();
        
        console.log(`Fetching comments for ${username} starting from ${startPermlink || 'beginning'}, limit: ${limit || 20}`);
        
        const query = {
            start_author: username,
            start_permlink: startPermlink || '',
            limit: limit || 20
        };
        
        try {
            // Utilizziamo la versione sincrona con Promise
            return await new Promise((resolve, reject) => {
                this.steem.api.getDiscussionsByComments(query, (err, result) => {
                    if (err) {
                        console.error('Error in getDiscussionsByComments:', err);
                        reject(err);
                    } else {
                        console.log(`Retrieved ${result ? result.length : 0} comments`);
                        resolve(result || []);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching author comments:', error);
            // Prova con un altro endpoint in caso di errore
            this.switchEndpoint();
            
            // Ritenta una volta con il nuovo endpoint
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api.getDiscussionsByComments(query, (err, result) => {
                        if (err) reject(err);
                        else resolve(result || []);
                    });
                });
            } catch (retryError) {
                console.error('Retry for comments also failed:', retryError);
                return [];
            }
        }
    }


    async getCommentsByAuthor(author, limit = -1) {
        try {
            console.log(`Getting comments for author ${author} (limit: ${limit === -1 ? 'ALL' : limit})`);
            await this.ensureLibraryLoaded();
            
            // Raccogliamo tutti i commenti con approccio a finestra scorrevole
            const allComments = [];
            let startPermlink = '';
            let hasMoreComments = true;
            let attempts = 0;
            
            // Batch size ottimale per l'API
            const BATCH_SIZE = 100;
            
            // -1 significa "carica tutti quelli disponibili"
            const loadAll = limit === -1;
            const targetLimit = loadAll ? Number.MAX_SAFE_INTEGER : limit;
            
            // Finestra scorrevole: continua a caricare finché ci sono più commenti
            // o finché non raggiungiamo il limite richiesto
            while (hasMoreComments && allComments.length < targetLimit && attempts < 50) {
                console.log(`[Batch ${attempts+1}] Caricate ${allComments.length} commenti finora`);
                
                try {
                    // Carica il prossimo batch di commenti
                    const comments = await this.getAuthorComments(author, startPermlink, BATCH_SIZE);
                    
                    // Se non ci sono risultati, interrompi
                    if (!comments || comments.length === 0) {
                        console.log('Nessun altro commento da caricare');
                        hasMoreComments = false;
                        break;
                    }
                    
                    // Determina quali commenti sono nuovi
                    // Se questo non è il primo batch, salta il primo risultato (duplicato)
                    const newComments = (startPermlink && comments.length > 0) 
                        ? comments.slice(1).filter(c => c.parent_author !== '') 
                        : comments.filter(c => c.parent_author !== '');
                    
                    // Se non ci sono nuovi commenti validi in questo batch
                    if (newComments.length === 0) {
                        // Tenta di avanzare oltre il punto di stallo
                        if (comments.length >= 2) {
                            console.log('Nessun nuovo commento in questo batch, provo a saltare al commento successivo');
                            startPermlink = comments[1].permlink;
                            attempts++;
                            continue;
                        } else {
                            console.log('Non è possibile avanzare oltre, fine del caricamento');
                            hasMoreComments = false;
                            break;
                        }
                    }
                    
                    // Aggiungi i nuovi commenti alla collezione
                    allComments.push(...newComments);
                    console.log(`Aggiunti ${newComments.length} nuovi commenti (totale: ${allComments.length})`);
                    
                    // Aggiorna il permlink di partenza per il prossimo batch
                    const lastComment = comments[comments.length - 1];
                    startPermlink = lastComment.permlink;
                    
                    // Emetti progresso per l'UI
                    if (typeof window !== 'undefined' && window.eventEmitter) {
                        window.eventEmitter.emit('comments:progress', {
                            author,
                            total: allComments.length,
                            batch: newComments.length,
                            batchNumber: attempts + 1
                        });
                    }
                    
                    // Pausa breve per evitare limiti di richieste
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Errore nel batch ${attempts+1}:`, error);
                    // Prova un altro endpoint in caso di errore
                    this.switchEndpoint();
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                attempts++;
            }
            
            // Riporta il numero finale di commenti caricati
            console.log(`Caricamento commenti completato: ${allComments.length} commenti totali per ${author}`);
            
            // Rimuovi eventuali duplicati (possono verificarsi in caso di errori)
            const seen = new Set();
            const uniqueComments = allComments.filter(comment => {
                const id = `${comment.author}_${comment.permlink}`;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
            
            if (uniqueComments.length < allComments.length) {
                console.log(`Rimossi ${allComments.length - uniqueComments.length} commenti duplicati`);
            }
            
            // Ordina per data, dal più recente al più vecchio
            return uniqueComments.sort((a, b) => new Date(b.created) - new Date(a.created));
        } catch (error) {
            console.error('Errore in getCommentsByAuthor:', error);
            return [];
        }
    }


    async getDiscussionsByBlog(query) {
        await this.ensureLibraryLoaded();

        console.log('Calling getDiscussionsByBlog with params:', query);

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getDiscussionsByBlog(query, (err, result) => {
                    if (err) {
                        console.error('API error in getDiscussionsByBlog:', err);
                        reject(err);
                    } else {
                        console.log(`Received ${result ? result.length : 0} blog posts`);
                        resolve(result || []);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getDiscussionsByBlog:', error);
            this.switchEndpoint();

            // Retry with new endpoint
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api.getDiscussionsByBlog(query, (err, result) => {
                        if (err) reject(err);
                        else resolve(result || []);
                    });
                });
            } catch (retryError) {
                console.error('Retry also failed:', retryError);
                return [];
            }
        }
    }

    async getUserPosts(username, limit = 50, pagination = {}) {
        if (!username) {
            console.error('No username provided to getUserPosts');
            return { posts: [], hasMore: false, lastPost: null };
        }

        await this.ensureLibraryLoaded();
        console.log(`Fetching posts for ${username} with limit=${limit}, pagination:`, pagination);

        try {
            // Preparazione query
            const query = {
                tag: username,
                limit: Math.min(limit * 1.2, 100) // Aumentiamo leggermente per compensare duplicati, max 100
            };

            // Aggiungi parametri di paginazione se disponibili
            if (pagination.start_author && pagination.start_permlink) {
                query.start_author = pagination.start_author;
                query.start_permlink = pagination.start_permlink;
                console.log(`Using pagination params: ${pagination.start_author}/${pagination.start_permlink}`);
            }

            // Chiamata API diretta
            const posts = await this.getDiscussionsByBlog(query);

            // Se non ci sono post, ritorna vuoto
            if (!posts || !posts.length) {
                console.log('No posts returned from API');
                return { posts: [], hasMore: false, lastPost: null };
            }

            // Rimuovi il primo post se è un duplicato (e se stiamo paginando)
            let resultPosts = posts;
            if (pagination.start_author && pagination.start_permlink && posts.length > 0 &&
                posts[0].author === pagination.start_author && posts[0].permlink === pagination.start_permlink) {
                console.log('Removing first post as it is a duplicate from pagination');
                resultPosts = posts.slice(1);
            }

            console.log(`Received ${resultPosts.length} posts after removing duplicates`);

            // Memorizza l'ultimo post per la prossima paginazione
            const lastPost = resultPosts.length > 0 ? resultPosts[resultPosts.length - 1] : null;

            // Salva internamente l'ultimo post per tracking
            if (lastPost) {
                this._setLastPostForUser(username, lastPost);
            }

            // Ritorna con informazioni di paginazione
            return {
                posts: resultPosts,
                hasMore: resultPosts.length >= Math.min(limit, 100) && posts.length >= query.limit,
                lastPost: lastPost
            };
        } catch (error) {
            console.error(`Error in getUserPosts for ${username}:`, error);

            // In caso di errore, proviamo un approccio alternativo più lento ma più affidabile
            try {
                console.log("Fallback: Trying alternative approach to fetch posts");
                const blogPosts = await this._fetchUserBlogPosts(username, limit * 2);

                if (blogPosts.length > 0) {
                    // Applica la paginazione manualmente
                    const startIndex = 0;
                    const endIndex = Math.min(blogPosts.length, limit);
                    const resultPosts = blogPosts.slice(startIndex, endIndex);

                    // Memorizza l'ultimo post per la prossima paginazione
                    const lastPost = resultPosts.length > 0 ? resultPosts[resultPosts.length - 1] : null;
                    if (lastPost) {
                        this._setLastPostForUser(username, lastPost);
                    }

                    return {
                        posts: resultPosts,
                        hasMore: blogPosts.length > limit,
                        lastPost: lastPost
                    };
                }
            } catch (fallbackError) {
                console.error(`Fallback approach also failed:`, fallbackError);
            }

            return { posts: [], hasMore: false, lastPost: null };
        }
    }

    _setLastPostForUser(username, post) {
        if (!this._lastPostByUser) {
            this._lastPostByUser = {};
        }

        if (post) {
            this._lastPostByUser[username] = post;
            console.log(`Saved last post for ${username}: ${post.permlink}`);
        }
    }

    getLastPostForUser(username) {
        return this._lastPostByUser && this._lastPostByUser[username]
            ? this._lastPostByUser[username]
            : null;
    }

getSortMethodName(sort) {
  const sortToMethod = {
    'trending': 'getDiscussionsByTrending',
    'hot': 'getDiscussionsByHot',
    'created': 'getDiscussionsByCreated',
    'promoted': 'getDiscussionsByPromoted',
    'payout': 'getDiscussionsByPayout'
  };
  
  return sortToMethod[sort] || 'getDiscussionsByTrending';
}


formatSimpleCommunityTitle(communityName) {
  if (!communityName) return 'Community';
  
  return communityName
    .replace(/^hive-/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';
