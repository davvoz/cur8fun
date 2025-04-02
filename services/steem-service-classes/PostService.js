/**
 * Service for post-related operations
 */
export default class PostService {
    constructor(core) {
        this.core = core;
        this.seenPostIds = {};
        this.lastPostByCategory = {};
        this.lastPost = null;
        this._lastPostByUser = {};
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
        let posts = await this.core.executeApiMethod(method, query);

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

    async getPostsByCategory(category, page = 1, limit = 20) {
        await this.core.ensureLibraryLoaded();

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

    async getContent(author, permlink) {
        await this.core.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getContent(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content:', error);
            this.core.switchEndpoint();
            throw error;
        }
    }

    async getContentReplies(author, permlink) {
        await this.core.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getContentReplies(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content replies:', error);
            this.core.switchEndpoint();
            throw error;
        }
    }

    async getDiscussionsByBlog(query) {
        await this.core.ensureLibraryLoaded();

        console.log('Calling getDiscussionsByBlog with params:', query);

        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getDiscussionsByBlog(query, (err, result) => {
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
            this.core.switchEndpoint();

            // Retry with new endpoint
            try {
                return await new Promise((resolve, reject) => {
                    this.core.steem.api.getDiscussionsByBlog(query, (err, result) => {
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

        await this.core.ensureLibraryLoaded();
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
                    this.core.steem.api.getDiscussionsByBlog(query, (err, result) => {
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
                this.core.switchEndpoint();
                // Add a longer delay after an error
                await new Promise(resolve => setTimeout(resolve, 500));
                // Continue with next batch
            }
        }

        console.log(`Fetched a total of ${allPosts.length} blog posts for ${username}`);
        return allPosts;
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

    async getPostsByTag(tag, page = 1, limit = 20) {
        await this.core.ensureLibraryLoaded();

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
            const posts = await this.core.executeApiMethod('getDiscussionsByCreated', query);

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

    /**
     * Fetches posts from a specific community using bridge.get_ranked_posts
     * @param {Object} params - Parameters for the query
     * @param {string} params.community - Community ID (with or without 'hive-' prefix)
     * @param {string} [params.sort='trending'] - Sort order ('trending', 'hot', 'created', etc.)
     * @param {number} [params.limit=20] - Number of posts to fetch
     * @param {string} [params.start_author] - Author of the post to start after (for pagination)
     * @param {string} [params.start_permlink] - Permlink of the post to start after (for pagination)
     * @returns {Promise<Array>} - Array of community posts
     */
    async fetchCommunityPosts(params) {
        // Ensure the library is loaded
        await this.core.ensureLibraryLoaded();
        
        // Format community tag - ensure it has 'hive-' prefix
        const communityTag = `hive-${params.community.replace(/^hive-/, '')}`;
        
        // Imposta un limite ragionevole per il numero di post da caricare
        const limit = params.limit || 20;
        
        console.log(`Fetching community posts for ${communityTag} using bridge API with sort: ${params.sort}, limit: ${limit}`);
        
        try {
            // Use bridge.get_ranked_posts directly with proper pagination
            return await new Promise((resolve, reject) => {
                this.core.steem.api.call(
                    'bridge.get_ranked_posts',
                    {
                        tag: communityTag,
                        sort: params.sort || 'trending',
                        limit: limit,
                    },
                    (err, result) => {
                        if (err) {
                            console.error('Bridge API error:', err);
                            reject(err);
                        } else {
                            console.log(`Bridge API returned ${result ? result.length : 0} posts`);
                            
                            // Se il sort è 'created', assicurati che l'ordinamento sia corretto
                            if (params.sort === 'created' && Array.isArray(result)) {
                                // Ordina esplicitamente per data di creazione (più recente prima)
                                result.sort((a, b) => {
                                    return new Date(b.created) - new Date(a.created);
                                });
                            }
                            
                            // Limita i risultati al numero massimo richiesto
                            const limitedResult = Array.isArray(result) && result.length > limit ? 
                                result.slice(0, limit) : result;
                            
                            resolve(limitedResult || []);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error fetching community posts:', error);
            return [];
        }
    }

    /**
     * Parse JSON metadata string or object
     * @param {string|Object} jsonMetadata - JSON metadata string or object
     * @returns {Object} - Parsed metadata object
     */
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
}