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

    async updateProfile(username, updatedFields) {
        try {
            console.log('ProfileService: Updating profile for', username);
            console.log('Updated fields:', updatedFields);
            
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
            
            console.log('Existing profile data:', existingProfile);
            
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
            
            console.log('Merged profile data to save:', mergedProfile);
            
            // Call steemService to update the profile on the blockchain
            const result = await steemService.updateUserProfile(username, mergedProfile);
            
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
            console.log(`ProfileService: Getting posts for ${username}, page=${page}, limit=${limit}`);
            
            // Force refresh handling
            if (params?.forceRefresh) {
                console.log('Force refresh requested, clearing cache');
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
                    console.log(`Using ${cachedPosts.length} cached posts for page ${page}`);
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
                    console.log(`Using pagination from page ${page-1}: ${lastPost.author}/${lastPost.permlink}`);
                } else {
                    // Se non abbiamo la pagina precedente in cache, chiedi al service
                    const lastPostRef = steemService.getLastPostForUser(username);
                    if (lastPostRef) {
                        paginationParams = {
                            start_author: lastPostRef.author,
                            start_permlink: lastPostRef.permlink
                        };
                        console.log(`Using pagination from service: ${lastPostRef.author}/${lastPostRef.permlink}`);
                    } else {
                        console.warn(`No pagination reference for page ${page}, results may be incorrect`);
                        
                        // Se siamo a pagina > 1 ma non abbiamo un punto di riferimento,
                        // potremmo dover caricare tutte le pagine precedenti
                        if (page > 2) { // Solo se siamo oltre pagina 2, per evitare loop
                            console.log(`Attempting to load previous page ${page-1} first`);
                            const prevPagePosts = await this.getUserPosts(username, limit, page-1);
                            
                            if (prevPagePosts && prevPagePosts.length > 0) {
                                const lastPost = prevPagePosts[prevPagePosts.length - 1];
                                paginationParams = {
                                    start_author: lastPost.author,
                                    start_permlink: lastPost.permlink
                                };
                                console.log(`Generated pagination from loaded previous page: ${lastPost.author}/${lastPost.permlink}`);
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
                console.log(`Caching ${postsToCache.length} posts for page ${page}`);
                this.cachePosts(cacheKey, postsToCache);
                
                // Memorizza l'ultimo post per future richieste
                if (result.lastPost) {
                    this.lastPosts = this.lastPosts || {};
                    this.lastPosts[username] = result.lastPost;
                }
                
                // Ritorna solo il numero di post richiesti
                return result.posts.slice(0, limit);
            } else {
                console.log(`No posts found for ${username}, page ${page}`);
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
        
        console.log(`Cleared post cache for ${username}`);
    }

    async followUser(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            throw new Error('You must be logged in to follow a user');
        }

        if (username === currentUser.username) {
            throw new Error('You cannot follow yourself');
        }

        try {
            // This would use Steem's broadcast operations via SteemConnect or similar
            console.log(`Following user ${username}`);

            // For now we'll just simulate success
            eventEmitter.emit('notification', {
                type: 'success',
                message: `You are now following @${username}`
            });

            return true;
        } catch (error) {
            console.error(`Error following ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to follow @${username}`
            });
            throw error;
        }
    }

    async unfollowUser(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            throw new Error('You must be logged in to unfollow a user');
        }

        try {
            // This would use Steem's broadcast operations via SteemConnect or similar
            console.log(`Unfollowing user ${username}`);

            // For now we'll just simulate success
            eventEmitter.emit('notification', {
                type: 'success',
                message: `You have unfollowed @${username}`
            });

            return true;
        } catch (error) {
            console.error(`Error unfollowing ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to unfollow @${username}`
            });
            throw error;
        }
    }

    async isFollowing(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            return false;
        }

        try {
            //TODO: Implement proper check using Steem blockchain data
            return Math.random() > 0.5;
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

    async getFollowingCount(username) {
        try {
            const following = await steemService.getFollowing(username);
            return following.length;
        } catch (error) {
            console.error(`Error fetching following count for ${username}:`, error);
            return 0;
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

    async getUserComments(username, limit = 20, page = 1, forceRefresh = false) {
        try {
            // Check cache unless forceRefresh is true
            const cacheKey = `${username}_comments`;
            const cachedComments = !forceRefresh ? this.getCachedPosts(cacheKey) : null;
            
            if (cachedComments) {
                console.log(`Using cached comments for ${username}: ${cachedComments.length} comments available`);
                // Apply pagination to cached comments
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                return cachedComments.slice(startIndex, endIndex);
            }
            
            console.log(`Fetching comments for ${username} (${forceRefresh ? 'forced refresh' : 'no cache available'})`);
            
            // Use the direct getCommentsByAuthor method that internally uses getAuthorComments
            const comments = await steemService.getCommentsByAuthor(username, 100);
            
            if (!comments || !Array.isArray(comments)) {
                console.warn('Invalid response format for user comments:', comments);
                return [];
            }
            
            console.log(`Retrieved ${comments.length} total comments for ${username} from blockchain`);
            
            // Cache all comments for future use
            this.cachePosts(cacheKey, comments);
            
            // Update cache expiry for comments to 30 minutes (longer than normal cache)
            const cacheEntry = this.postCache.get(cacheKey);
            if (cacheEntry) {
                // Extend expiry for comments since they're expensive to fetch
                this.postCache.set(cacheKey, {
                    ...cacheEntry,
                    // 30 minutes cache for comments
                    expiry: Date.now() + (30 * 60 * 1000)
                });
            }
            
            // Apply pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            return comments.slice(startIndex, endIndex);
        } catch (error) {
            console.error('Error fetching user comments:', error);
            throw new Error(`Failed to load comments: ${error.message || 'Unknown error'}`);
        }
    }
}

// Initialize singleton instance
const profileService = new ProfileService();
export default profileService;
