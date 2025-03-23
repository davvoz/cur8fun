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
     * Update a user profile
     * @param {string} username - Steem username
     * @param {Object} updatedFields - Updated profile data
     * @returns {Promise<boolean>} Success of the update operation
     */
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
     * Get posts by a user with pagination
     * @param {string} username - The username to fetch posts for
     * @param {number} limit - Number of posts per page
     * @param {number} page - Page number to fetch (starts at 1)
     * @returns {Promise<Array>} - Array of posts
     */
    async getUserPosts(username, limit = 10, page = 1) {
        try {
            // Check if we have a local cache of ALL posts for this user
            const cacheKey = `${username}_posts_all`;
            let allUserPosts = this.getCachedPosts(cacheKey);
            
            // If page 1 is requested with forceRefresh, clear the cache
            if (page === 1 && this.params?.forceRefresh) {
                console.log('Forced refresh requested, clearing cache');
                allUserPosts = null;
                this.postCache.delete(cacheKey);
            }
            
            // If we don't have cached posts, fetch all posts from the service
            if (!allUserPosts) {
                console.log(`No cached posts for ${username}, fetching from blockchain`);
                
                // Use a higher limit to fetch more posts at once
                const fetchLimit = Math.max(100, page * limit * 2);
                allUserPosts = await steemService.getUserPosts(username, fetchLimit);
                
                // Cache all posts for this user
                if (allUserPosts && allUserPosts.length > 0) {
                    console.log(`Caching ${allUserPosts.length} posts for ${username}`);
                    this.cachePosts(cacheKey, allUserPosts);
                    
                    // Use a longer cache expiry for posts (15 minutes)
                    const cacheEntry = this.postCache.get(cacheKey);
                    if (cacheEntry) {
                        this.postCache.set(cacheKey, {
                            ...cacheEntry,
                            expiry: Date.now() + (15 * 60 * 1000) // 15 minutes
                        });
                    }
                }
            } else {
                console.log(`Using ${allUserPosts.length} cached posts for ${username}`);
            }
            
            // Apply pagination to the cached posts
            const startIdx = (page - 1) * limit;
            const endIdx = startIdx + limit;
            
            // Check if we may need to fetch more posts
            if (allUserPosts.length <= endIdx && allUserPosts.length < 100) {
                console.log(`We might need more posts (have ${allUserPosts.length}, need index ${endIdx})`);
                
                // Try to fetch more posts with a higher limit
                const morePosts = await steemService.getUserPosts(username, 100);
                
                if (morePosts && morePosts.length > allUserPosts.length) {
                    console.log(`Found ${morePosts.length - allUserPosts.length} additional posts`);
                    
                    // Combine and deduplicate posts
                    const seenIds = new Set(allUserPosts.map(p => p.id));
                    const newPosts = morePosts.filter(p => !seenIds.has(p.id));
                    
                    if (newPosts.length > 0) {
                        console.log(`Adding ${newPosts.length} new posts to cache`);
                        allUserPosts = [...allUserPosts, ...newPosts];
                        this.cachePosts(cacheKey, allUserPosts);
                    }
                }
            }
            
            // Return the paginated subset
            const paginatedPosts = allUserPosts.slice(startIdx, endIdx);
            console.log(`Returning ${paginatedPosts.length} posts for page ${page} (indexes ${startIdx}-${endIdx})`);
            
            return paginatedPosts;
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
     * Get the follower count for a user
     * @param {string} username - The username to fetch follower count for
     * @returns {Promise<number>} - The follower count
     */
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
     * Get the following count for a user
     * @param {string} username - The username to fetch following count for
     * @returns {Promise<number>} - The following count
     */
    async getFollowingCount(username) {
        try {
            const following = await steemService.getFollowing(username);
            return following.length;
        } catch (error) {
            console.error(`Error fetching following count for ${username}:`, error);
            return 0;
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

    /**
     * Get user comments with pagination
     * @param {string} username - The username to fetch comments for
     * @param {number} limit - The number of comments to fetch
     * @param {number} page - The page number for pagination
     * @param {boolean} forceRefresh - Whether to bypass the cache
     * @returns {Promise<Array>} Array of comments
     */
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
            
            console.log(`Fetching all comments for ${username} (${forceRefresh ? 'forced refresh' : 'no cache available'})`);
            
            // Set a very high limit to try to get all comments
            // The SteemService will handle multiple methods to get as many as possible
            const comments = await steemService.getCommentsByAuthor(username, 2000);
            
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
