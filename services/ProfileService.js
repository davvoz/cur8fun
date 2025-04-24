import steemService from './SteemService.js';
import Profile from '../models/Profile.js';
import eventEmitter from '../utils/EventEmitter.js';

/**
 * Service for managing Steem user profiles
 */
class ProfileService {
    constructor() {
        this.profileCache = new Map();
        this.postCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    }

    async getProfile(username, forceRefresh = false) {
        if (!username) {
            throw new Error('Username is required');
        }

        // Check cache first unless forceRefresh is true
        if (!forceRefresh) {
            const cachedProfile = this.getCachedProfile(username);
            if (cachedProfile) {
                return cachedProfile;
            }
        }

        try {
            // Fetch user data from Steem blockchain
            const userData = await steemService.getUserData(username, { includeProfile: true });

            if (!userData) {
                throw new Error(`User ${username} not found`);
            }

            // Create a Profile model from raw data
            const profile = new Profile(userData);

            // Cache the profile
            this.cacheProfile(username, profile);

            return profile;
        } catch (error) {
            console.error(`Error fetching profile for ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to load profile for ${username}`
            });
            throw error;
        }
    }

    async updateProfile(username, updatedFields, activeKey = null) {
        try {
            // First get the current profile from blockchain
            const userData = await steemService.getUserData(username, { includeProfile: true });
            
            if (!userData) {
                throw new Error('User data not found');
            }
            
            // Get existing profile or create empty object
            let existingProfile = {};
            if (userData.profile) {
                existingProfile = userData.profile;
            } else if (userData.json_metadata) {
                try {
                    const metadata = JSON.parse(userData.json_metadata);
                    if (metadata && metadata.profile) {
                        existingProfile = metadata.profile;
                    }
                } catch (e) {
                    console.warn('Failed to parse existing metadata, starting fresh');
                }
            }
            
            // Create merged profile - start with existing, add updates
            const mergedProfile = {
                ...existingProfile,
                ...updatedFields
            };
            
            // Remove undefined fields
            Object.keys(mergedProfile).forEach(key => {
                if (mergedProfile[key] === undefined || mergedProfile[key] === '') {
                    delete mergedProfile[key];
                }
            });
            
            // Call steemService to update the profile on the blockchain, passing the active key if provided
            const result = await steemService.updateUserProfile(username, mergedProfile, activeKey);
            
            // Clear the cache for this user to ensure fresh data on next load
            this.clearUserCache(username);
            
            return result;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    /**
     * Get posts by a user with pagination - versione migliorata per caricare più post
     * @param {string} username - The username to fetch posts for
     * @param {number} limit - Number of posts per page
     * @param {number} page - Page number to fetch (starts at 1)
     * @param {Object} params - Additional parameters
     * @returns {Promise<Array>} - Array of posts
     */
    async getUserPosts(username, limit = 30, page = 1, params = {}) {
        try {
            // Force refresh handling
            if (params?.forceRefresh) {
                this.clearUserPostsCache(username);
                // Reset anche i dati di paginazione nel SteemService
                if (steemService._lastPostByUser) {
                    delete steemService._lastPostByUser[username];
                }
            }
            
            // Cache key per questa pagina
            const cacheKey = `${username}_posts_page_${page}`;
            
            // Check cache first (unless forcing refresh)
            if (!params?.forceRefresh) {
                const cachedPosts = this.getCachedPosts(cacheKey);
                if (cachedPosts) {
                    return cachedPosts;
                }
            }
            
            // Recupero parametri di paginazione
            let paginationParams = {};
            
            // Per la prima pagina non serve paginazione
            if (page > 1) {
                // Ottieni l'ultimo post della pagina precedente
                const prevPageKey = `${username}_posts_page_${page-1}`;
                const prevPagePosts = this.getCachedPosts(prevPageKey);
                
                if (prevPagePosts && prevPagePosts.length > 0) {
                    // Usa l'ultimo post della pagina precedente come riferimento
                    const lastPost = prevPagePosts[prevPagePosts.length - 1];
                    paginationParams = {
                        start_author: lastPost.author,
                        start_permlink: lastPost.permlink
                    };
                } else {
                    // Se non abbiamo la pagina precedente in cache, chiedi al service
                    const lastPostRef = steemService.getLastPostForUser(username);
                    if (lastPostRef) {
                        paginationParams = {
                            start_author: lastPostRef.author,
                            start_permlink: lastPostRef.permlink
                        };
                    } else {
                        console.warn(`No pagination reference for page ${page}, results may be incorrect`);
                        
                        // Se siamo a pagina > 1 ma non abbiamo un punto di riferimento,
                        // potremmo dover caricare tutte le pagine precedenti
                        if (page > 2) { // Solo se siamo oltre pagina 2, per evitare loop
                            const prevPagePosts = await this.getUserPosts(username, limit, page-1);
                            
                            if (prevPagePosts && prevPagePosts.length > 0) {
                                const lastPost = prevPagePosts[prevPagePosts.length - 1];
                                paginationParams = {
                                    start_author: lastPost.author,
                                    start_permlink: lastPost.permlink
                                };
                            }
                        }
                    }
                }
            }
            
            // Aumenta la probabilità di ottenere risultati completi richiedendo più post di quelli necessari
            const fetchLimit = Math.min(limit + 5, 100); // Massimo 100 per non stressare l'API
            
            // Richiesta al service - versione aggiornata che ritorna info di paginazione
            const result = await steemService.getUserPosts(username, fetchLimit, paginationParams);
            
            // Salva i post in cache se ne abbiamo
            if (result.posts && result.posts.length > 0) {
                // Limita il numero di post alla quantità richiesta per la cache
                const postsToCache = result.posts.slice(0, limit);
                this.cachePosts(cacheKey, postsToCache);
                
                // Memorizza l'ultimo post per future richieste
                if (result.lastPost) {
                    this.lastPosts = this.lastPosts || {};
                    this.lastPosts[username] = result.lastPost;
                }
                
                // Ritorna solo il numero di post richiesti
                return result.posts.slice(0, limit);
            } else {
                return [];
            }
        } catch (error) {
            console.error(`Error fetching posts for ${username}:`, error);
            return [];
        }
    }
    
    /**
     * Pulisce la cache dei post per uno specifico utente
     * @param {string} username - Username
     */
    clearUserPostsCache(username) {
        // Cancella tutte le chiavi della cache che contengono questo username
        const keysToDelete = [];
        
        this.postCache.forEach((value, key) => {
            if (key.includes(username)) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            this.postCache.delete(key);
        });
        
        // Cancella anche i dati di paginazione
        if (this.lastPosts) {
            delete this.lastPosts[username];
        }
    }

    async followUser(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            throw new Error('You must be logged in to follow a user');
        }

        if (username === currentUser.username) {
            throw new Error('You cannot follow yourself');
        }

        try {
            // Usa il metodo followUser implementato in SteemService
            const result = await steemService.followUser(currentUser.username, username);
            
            eventEmitter.emit('notification', {
                type: 'success',
                message: `You are now following @${username}`
            });

            return true;
        } catch (error) {
            console.error(`Error following ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to follow @${username}: ${error.message}`
            });
            throw error;
        }
    }

    async unfollowUser(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            throw new Error('You must be logged in to unfollow a user');
        }

        try {
            // Usa il metodo unfollowUser implementato in SteemService
            const result = await steemService.unfollowUser(currentUser.username, username);
            
            eventEmitter.emit('notification', {
                type: 'success',
                message: `You have unfollowed @${username}`
            });

            return true;
        } catch (error) {
            console.error(`Error unfollowing ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to unfollow @${username}: ${error.message}`
            });
            throw error;
        }
    }

    async isFollowing(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            return false;
        }

        try {
            // Utilizziamo il metodo checkIfFollowing implementato nel SteemService
            return await steemService.checkIfFollowing(currentUser.username, username);
        } catch (error) {
            console.error(`Error checking follow status for ${username}:`, error);
            return false;
        }
    }

    async getFollowerCount(username) {
        try {
            const followers = await steemService.getFollowers(username);
            return followers.length;
        } catch (error) {
            console.error(`Error fetching follower count for ${username}:`, error);
            return 0;
        }
    }

    /**
     * Gets the complete list of followers for a user
     * @param {string} username - Username to get followers for
     * @returns {Promise<Array>} - Array of follower objects
     */
    async getFollowersList(username) {
        try {
            const followers = await steemService.getFollowers(username);
            return followers;
        } catch (error) {
            console.error(`Error fetching followers list for ${username}:`, error);
            return [];
        }
    }

    async getFollowingCount(username) {
        try {
            const following = await steemService.getFollowing(username);
            return following.length;
        } catch (error) {
            console.error(`Error fetching following count for ${username}:`, error);
            return 0;
        }
    }

    async getFollowingList(username) {
        try {
            const following = await steemService.getFollowing(username);
            return following;
        } catch (error) {
            console.error(`Error fetching following list for ${username}:`, error);
            return [];
        }
    }

    getCachedProfile(username) {
        const cacheEntry = this.profileCache.get(username);

        if (!cacheEntry) {
            return null;
        }

        // Check if cache is expired
        const now = Date.now();
        if (now - cacheEntry.timestamp > this.cacheExpiry) {
            this.profileCache.delete(username);
            return null;
        }

        return cacheEntry.profile;
    }

    cacheProfile(username, profile) {
        this.profileCache.set(username, {
            profile,
            timestamp: Date.now()
        });
    }

    getCachedPosts(cacheKey) {
        const cacheEntry = this.postCache.get(cacheKey);

        if (!cacheEntry) {
            return null;
        }

        // Check if cache is expired
        const now = Date.now();
        if (now - cacheEntry.timestamp > this.cacheExpiry) {
            this.postCache.delete(cacheKey);
            return null;
        }

        return cacheEntry.posts;
    }

    cachePosts(cacheKey, posts) {
        this.postCache.set(cacheKey, {
            posts,
            timestamp: Date.now()
        });
    }

    clearUserCache(username) {
        this.profileCache.delete(username);
        this.postCache.delete(`${username}_posts`);
    }

    clearAllCache() {
        this.profileCache.clear();
        this.postCache.clear();
    }


    async getUserComments(username, limit = 30, page = 1, forceRefresh = false) {
        const COMMENTS_CACHE_KEY = `${username}_comments`;
        const COMMENTS_CACHE_DURATION_MS = 120 * 60 * 1000; // 2 hours in milliseconds
        
        try {
            // Check cache if not forcing refresh
            if (!forceRefresh) {
                const paginatedCachedComments = this.getPaginatedCachedComments(
                    COMMENTS_CACHE_KEY, page, limit, username
                );
                if (paginatedCachedComments) {
                    return paginatedCachedComments;
                }
            }
            
            // Load comments from blockchain
            const comments = await steemService.getCommentsByAuthor(username, -1);
            
            if (!this.isValidCommentsResponse(comments)) {
                return [];
            }
            
            // Cache the comments
            if (comments.length > 0) {
                this.cacheUserComments(COMMENTS_CACHE_KEY, comments, COMMENTS_CACHE_DURATION_MS);
                this.storeCommentsInSessionStorage(COMMENTS_CACHE_KEY, comments);
                this.emitCommentsLoadedEvent(username, comments.length, 'network', page);
            }
            
            // Return paginated results
            return this.paginateResults(comments, page, limit);
        } catch (error) {
            console.error(`Error fetching comments for ${username}:`, error);
            return this.getFallbackComments(COMMENTS_CACHE_KEY, page, limit);
        }
    }
    
    /**
     * Checks if comments response is valid
     * @private
     */
    isValidCommentsResponse(comments) {
        if (!comments || !Array.isArray(comments)) {
            console.warn('Invalid comments response:', comments);
            return false;
        }
        return true;
    }
    
    /**
     * Gets paginated comments from cache if available
     * @private
     */
    getPaginatedCachedComments(cacheKey, page, limit, username) {
        const cachedComments = this.getCachedPosts(cacheKey);
        if (!cachedComments) {
            return null;
        }
        
        const paginatedComments = this.paginateResults(cachedComments, page, limit);
        
        if (page === 1) {
            this.emitCommentsLoadedEvent(username, cachedComments.length, 'cache', page);
        }
        
        return paginatedComments;
    }
    
    /**
     * Paginates an array of results
     * @private
     */
    paginateResults(items, page, limit) {
        const startIndex = (page - 1) * limit;
        const endIndex = Math.min(startIndex + limit, items.length);
        return items.slice(startIndex, endIndex);
    }
    
    /**
     * Stores comments in cache with extended expiration
     * @private
     */
    cacheUserComments(cacheKey, comments, cacheDuration) {
        this.cachePosts(cacheKey, comments);
        
        const cacheEntry = this.postCache.get(cacheKey);
        if (cacheEntry) {
            this.postCache.set(cacheKey, {
                ...cacheEntry,
                timestamp: Date.now(),
                expiry: Date.now() + cacheDuration
            });
        }
    }
    
    /**
     * Attempts to store comments in sessionStorage
     * @private
     */
    storeCommentsInSessionStorage(cacheKey, comments) {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return;
        }
        
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(comments));
        } catch (storageError) {
            console.warn('Unable to save all comments in sessionStorage:', storageError);
        }
    }
    
    /**
     * Emits comments loaded event
     * @private
     */
    emitCommentsLoadedEvent(username, total, source, page) {
        if (page !== 1 || typeof window === 'undefined' || !window.eventEmitter) {
            return;
        }
        
        window.eventEmitter.emit('comments:loaded', {
            username, 
            total,
            source
        });
    }
    
    /**
     * Gets fallback comments from cache or sessionStorage after an error
     * @private
     */
    getFallbackComments(cacheKey, page, limit) {
        // Try using cached data
        const cachedComments = this.getCachedPosts(cacheKey);
        if (cachedComments && cachedComments.length > 0) {
            return this.paginateResults(cachedComments, page, limit);
        }
        
        // Try sessionStorage as last resort
        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                const savedComments = sessionStorage.getItem(cacheKey);
                if (savedComments) {
                    const parsedComments = JSON.parse(savedComments);
                    return this.paginateResults(parsedComments, page, limit);
                }
            } catch (e) {
                console.warn('Unable to recover from sessionStorage:', e);
            }
        }
        
        return [];
    }
}

// Initialize singleton instance
const profileService = new ProfileService();
export default profileService;
