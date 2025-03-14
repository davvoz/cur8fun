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

    /**
     * Get a user profile
     * @param {string} username - Steem username
     * @param {boolean} forceRefresh - Force a refresh from the blockchain
     * @returns {Promise<Profile>} Profile object
     */
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
    
    /**
     * Get posts by a user with pagination
     * @param {string} username - The username to fetch posts for
     * @param {number} limit - Number of posts per page
     * @param {number} page - Page number to fetch (starts at 1)
     * @returns {Promise<Array>} - Array of posts
     */
    async getUserPosts(username, limit = 10, page = 1) {
        try {
            // If we have posts cached for this page and user, return them
            if (this.cachedPosts && this.cachedPosts[username] && this.cachedPosts[username][page]) {
                return this.cachedPosts[username][page];
            }
            
            let posts = [];
            
            // For pagination, we need to get all posts up to the page we want
            // and then slice the right chunk.
            // For efficiency, we cache results
            if (page > 1 && this.cachedPosts && this.cachedPosts[username]) {
                // Find the highest page we have cached
                const cachedPages = Object.keys(this.cachedPosts[username])
                    .map(Number)
                    .sort((a, b) => b - a);
                
                if (cachedPages.length > 0) {
                    const highestPage = cachedPages[0];
                    
                    if (highestPage >= page) {
                        // We already have this page cached
                        return this.cachedPosts[username][page];
                    }
                    
                    // We have some cached pages, but not the one we want
                    const startAuthor = '';
                    const startPermlink = '';
                    
                    // Get posts from Steem
                    posts = await steemService.getUserPosts(username, page * limit);
                    
                    // Process and cache
                    this._processPosts(posts, username, page, limit);
                    
                    return this.cachedPosts[username][page];
                }
            }
            
            // No cached data, get everything from scratch
            posts = await steemService.getUserPosts(username, page * limit);
            
            // Process and cache
            return this._processPosts(posts, username, page, limit);
        } catch (error) {
            console.error(`Error fetching posts for user ${username}:`, error);
            return [];
        }
    }
    
    /**
     * Process posts for pagination and caching
     * @private
     */
    _processPosts(posts, username, page, limit) {
        if (!posts || posts.length === 0) {
            return [];
        }
        
        // Initialize cache if needed
        if (!this.cachedPosts) {
            this.cachedPosts = {};
        }
        
        if (!this.cachedPosts[username]) {
            this.cachedPosts[username] = {};
        }
        
        // Split posts into pages and cache them
        const totalPosts = posts.length;
        const totalPages = Math.ceil(totalPosts / limit);
        
        for (let p = 1; p <= totalPages; p++) {
            const start = (p - 1) * limit;
            const end = Math.min(start + limit, totalPosts);
            this.cachedPosts[username][p] = posts.slice(start, end);
        }
        
        // Return requested page
        return this.cachedPosts[username][page] || [];
    }
    
    /**
     * Follow a user
     * @param {string} username - Username to follow
     * @param {Object} currentUser - Currently logged in user
     * @returns {Promise<boolean>} Success of follow operation
     */
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
    
    /**
     * Unfollow a user
     * @param {string} username - Username to unfollow
     * @param {Object} currentUser - Currently logged in user
     * @returns {Promise<boolean>} Success of unfollow operation
     */
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
    
    /**
     * Check if current user is following another user
     * @param {string} username - Username to check
     * @param {Object} currentUser - Currently logged in user
     * @returns {Promise<boolean>} Whether current user follows the specified user
     */
    async isFollowing(username, currentUser) {
        if (!currentUser || !currentUser.username) {
            return false;
        }
        
        try {
            // This would check follow relationships via Steem API
            // For now we'll just simulate a random response
            return Math.random() > 0.5;
        } catch (error) {
            console.error(`Error checking follow status for ${username}:`, error);
            return false;
        }
    }
    
    /**
     * Get profile from cache
     * @param {string} username - Username to look up
     * @returns {Profile|null} Cached profile or null
     * @private
     */
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
    
    /**
     * Store profile in cache
     * @param {string} username - Username
     * @param {Profile} profile - Profile to cache
     * @private
     */
    cacheProfile(username, profile) {
        this.profileCache.set(username, {
            profile,
            timestamp: Date.now()
        });
    }
    
    /**
     * Get posts from cache
     * @param {string} cacheKey - Cache key
     * @returns {Array|null} Cached posts or null
     * @private
     */
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
    
    /**
     * Store posts in cache
     * @param {string} cacheKey - Cache key
     * @param {Array} posts - Posts to cache
     * @private
     */
    cachePosts(cacheKey, posts) {
        this.postCache.set(cacheKey, {
            posts,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clear cache for a specific user
     * @param {string} username - Username to clear cache for
     */
    clearUserCache(username) {
        this.profileCache.delete(username);
        this.postCache.delete(`${username}_posts`);
    }
    
    /**
     * Clear all cached data
     */
    clearAllCache() {
        this.profileCache.clear();
        this.postCache.clear();
    }
}

// Initialize singleton instance
const profileService = new ProfileService();
export default profileService;
