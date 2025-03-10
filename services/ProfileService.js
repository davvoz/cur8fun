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
     * Get posts by a user
     * @param {string} username - Steem username
     * @param {number} limit - Maximum number of posts to fetch
     * @param {boolean} forceRefresh - Force a refresh from the blockchain
     * @returns {Promise<Array>} User posts
     */
    async getUserPosts(username, limit = 10, forceRefresh = false) {
        if (!username) {
            throw new Error('Username is required');
        }
        
        // Check cache first unless forceRefresh is true
        const cacheKey = `${username}_posts`;
        if (!forceRefresh) {
            const cachedPosts = this.getCachedPosts(cacheKey);
            if (cachedPosts) {
                return cachedPosts;
            }
        }
        
        try {
            // Fetch user posts from Steem blockchain
            const posts = await steemService.getUserPosts(username, limit);
            
            // Cache the posts
            this.cachePosts(cacheKey, posts);
            
            return posts;
        } catch (error) {
            console.error(`Error fetching posts for ${username}:`, error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to load posts for ${username}`
            });
            throw error;
        }
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
