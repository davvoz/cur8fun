import steemService from './SteemService.js';
import Profile from '../models/Profile.js';
import eventEmitter from '../utils/EventEmitter.js';

// ─── SteemWorld feeds helper ────────────────────────────────────────────────
const SW_ENDPOINTS = [
    'https://sds.steemworld.org',
    'https://sds0.steemworld.org'
];

/**
 * Convert a SteemWorld tabular row into a condenser-compatible post object.
 * Both getAccountBlog and getPostsByAuthor share the same cols schema.
 */
function _swRowToPost(cols, row) {
    let jsonMeta = {};
    try { jsonMeta = JSON.parse(row[cols.json_metadata] || '{}'); } catch (_) {}

    let images = [];
    try { images = JSON.parse(row[cols.json_images] || '[]'); } catch (_) {}

    const createdTs = row[cols.created];
    const cashoutTs = row[cols.cashout_time];
    const created = createdTs
        ? new Date(createdTs * 1000).toISOString().replace('.000Z', '')
        : '';
    const cashout_time = cashoutTs
        ? new Date(cashoutTs * 1000).toISOString().replace('.000Z', '')
        : '1969-12-31T23:59:59';

    const payout = Number(row[cols.payout] ?? 0);
    const pending_payout_value = cashoutTs > 0 ? `${payout.toFixed(3)} SBD` : '0.000 SBD';
    const total_payout_value   = cashoutTs > 0 ? '0.000 SBD' : `${payout.toFixed(3)} SBD`;
    const curator_payout_value = '0.000 SBD';

    // resteemed_by is only present in getAccountBlog responses
    const resteemedBy = Array.isArray(row[cols.resteemed_by]) ? row[cols.resteemed_by] : [];

    return {
        id:                   row[cols.link_id] ?? 0,
        author:               row[cols.author] ?? '',
        permlink:             row[cols.permlink] ?? '',
        title:                row[cols.title] ?? '',
        body:                 row[cols.body] ?? '',
        category:             row[cols.category] ?? '',
        parent_permlink:      row[cols.category] ?? '',
        community:            row[cols.community] ?? '',
        created,
        cashout_time,
        net_rshares:          row[cols.net_rshares] ?? 0,
        children:             row[cols.children] ?? 0,
        pending_payout_value,
        total_payout_value,
        curator_payout_value,
        max_accepted_payout:  `${(row[cols.max_accepted_payout] ?? 0).toFixed(3)} SBD`,
        percent_steem_dollars: row[cols.percent_steem_dollars] ?? 10000,
        net_votes:            (row[cols.upvote_count] ?? 0) + (row[cols.downvote_count] ?? 0),
        active_votes:         [],
        json_metadata:        row[cols.json_metadata] ?? '{}',
        reblog_count:         row[cols.resteem_count] ?? 0,
        // resteemed_by mirrors condenser's reblogged_by field name
        reblogged_by:         resteemedBy,
        stats: {
            num_reblogs: row[cols.resteem_count] ?? 0,
        },
        // flatten useful metadata for card rendering
        _images: images,
        _jsonMeta: jsonMeta,
        _swSource: true,
    };
}

/**
 * Fetch posts from SteemWorld feeds API with offset pagination.
 * @param {'getAccountBlog'|'getPostsByAuthor'} endpoint
 * @param {string} account
 * @param {number} limit
 * @param {number} offset
 * @param {number} bodyLength
 * @returns {Promise<{posts: Array, total: number}>}
 */
async function _swFetchFeed(feedEndpoint, account, limit, offset, bodyLength = 250) {
    const encodedAccount = encodeURIComponent(account);
    const path = `/feeds_api/${feedEndpoint}/${encodedAccount}/null/${bodyLength}/${limit}/${offset}`;

    for (const base of SW_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(12000) });
            if (!res.ok) continue;
            const json = await res.json();
            if (json.code !== 0 || !json.result?.cols || !Array.isArray(json.result.rows)) continue;

            const { cols, rows } = json.result;
            const posts = rows.map(row => _swRowToPost(cols, row));
            return { posts, total: rows.length };
        } catch (_) {
            // try next endpoint
        }
    }
    throw new Error(`SteemWorld ${feedEndpoint} unavailable for ${account}`);
}

/**
 * Convert a SteemWorld tabular comment row into a condenser-compatible comment object.
 * Used for both getCommentsByAuthor and getCommentsByParentAuthor.
 */
function _swRowToComment(cols, row) {
    let jsonMeta = {};
    try { jsonMeta = JSON.parse(row[cols.json_metadata] || '{}'); } catch (_) {}

    const createdTs = row[cols.created];
    const cashoutTs = row[cols.cashout_time];
    const created = createdTs
        ? new Date(createdTs * 1000).toISOString().replace('.000Z', '')
        : '';
    const cashout_time = cashoutTs
        ? new Date(cashoutTs * 1000).toISOString().replace('.000Z', '')
        : '1969-12-31T23:59:59';

    const payout = Number(row[cols.payout] ?? 0);
    const pending_payout_value = cashoutTs > 0 ? `${payout.toFixed(3)} SBD` : '0.000 SBD';
    const total_payout_value   = cashoutTs > 0 ? '0.000 SBD' : `${payout.toFixed(3)} SBD`;

    return {
        id:                    row[cols.link_id] ?? 0,
        author:                row[cols.author] ?? '',
        permlink:              row[cols.permlink] ?? '',
        parent_author:         row[cols.parent_author] ?? '',
        parent_permlink:       row[cols.parent_permlink] ?? '',
        root_author:           row[cols.root_author] ?? '',
        root_permlink:         row[cols.root_permlink] ?? '',
        root_title:            row[cols.root_title] ?? '',
        title:                 row[cols.title] ?? '',
        body:                  row[cols.body] ?? '',
        category:              row[cols.category] ?? '',
        community:             row[cols.community] ?? '',
        created,
        cashout_time,
        net_rshares:           row[cols.net_rshares] ?? 0,
        children:              row[cols.children] ?? 0,
        pending_payout_value,
        total_payout_value,
        curator_payout_value:  '0.000 SBD',
        max_accepted_payout:   `${(row[cols.max_accepted_payout] ?? 0).toFixed(3)} SBD`,
        percent_steem_dollars: row[cols.percent_steem_dollars] ?? 10000,
        net_votes:             (row[cols.upvote_count] ?? 0) + (row[cols.downvote_count] ?? 0),
        active_votes:          [],
        json_metadata:         row[cols.json_metadata] ?? '{}',
        _jsonMeta:             jsonMeta,
        _swSource:             true,
    };
}

/**
 * Fetch comments/replies from SteemWorld feeds API with offset pagination.
 * @param {'getCommentsByAuthor'|'getCommentsByParentAuthor'} feedEndpoint
 */
async function _swFetchComments(feedEndpoint, account, limit, offset, bodyLength = 250) {
    const encodedAccount = encodeURIComponent(account);
    const path = `/feeds_api/${feedEndpoint}/${encodedAccount}/null/${bodyLength}/${limit}/${offset}`;

    for (const base of SW_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(12000) });
            if (!res.ok) continue;
            const json = await res.json();
            if (json.code !== 0 || !json.result?.cols || !Array.isArray(json.result.rows)) continue;

            const { cols, rows } = json.result;
            const comments = rows.map(row => _swRowToComment(cols, row));
            return { comments, total: rows.length };
        } catch (_) {
            // try next endpoint
        }
    }
    throw new Error(`SteemWorld ${feedEndpoint} unavailable for ${account}`);
}
// ────────────────────────────────────────────────────────────────────────────

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
            } else if (userData.posting_json_metadata || userData.json_metadata) {
                try {
                    const rawMeta = userData.posting_json_metadata || userData.json_metadata;
                    const metadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
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
     * Get blog posts (own + reblogs, no community-only posts) with offset-based pagination.
     * Primary: SteemWorld getAccountBlog. Fallback: condenser getDiscussionsByBlog.
     * @param {string} username
     * @param {number} limit - posts per page
     * @param {number} page  - 1-based page number
     * @param {Object} params - { forceRefresh }
     * @returns {Promise<Array>}
     */
    async getUserPosts(username, limit = 30, page = 1, params = {}) {
        if (params?.forceRefresh) {
            this.clearUserPostsCache(username);
        }

        const cacheKey = `${username}_posts_page_${page}`;

        if (!params?.forceRefresh) {
            const cached = this.getCachedPosts(cacheKey);
            if (cached) return cached;
        }

        // ── Primary: SteemWorld offset-based ──────────────────────────────
        try {
            const offset = (page - 1) * limit;
            const { posts } = await _swFetchFeed('getAccountBlog', username, limit, offset);
            this.cachePosts(cacheKey, posts);
            return posts;
        } catch (swErr) {
            console.warn(`[ProfileService] SteemWorld getAccountBlog failed (page ${page}), falling back:`, swErr.message);
        }

        // ── Fallback: condenser cursor-based ──────────────────────────────
        try {
            let paginationParams = {};
            if (page > 1) {
                const prevKey = `${username}_posts_page_${page - 1}`;
                const prevPosts = this.getCachedPosts(prevKey);
                if (prevPosts?.length > 0) {
                    const last = prevPosts[prevPosts.length - 1];
                    paginationParams = { start_author: last.author, start_permlink: last.permlink };
                }
            }
            const fetchLimit = Math.min(limit + 5, 100);
            const result = await steemService.getUserPosts(username, fetchLimit, paginationParams);
            const posts = result.posts ? result.posts.slice(0, limit) : [];
            if (posts.length > 0) this.cachePosts(cacheKey, posts);
            return posts;
        } catch (error) {
            console.error(`[ProfileService] getUserPosts fallback failed for ${username}:`, error);
            return [];
        }
    }

    /**
     * Get all posts authored by a user (blog + communities, no reblogs).
     * Primary: SteemWorld getPostsByAuthor. Fallback: condenser getDiscussionsByAuthorBeforeDate.
     * @param {string} username
     * @param {number} limit
     * @param {number} page
     * @param {Object} params - { forceRefresh }
     * @returns {Promise<Array>}
     */
    async getUserAuthorPosts(username, limit = 30, page = 1, params = {}) {
        if (params?.forceRefresh) {
            const keysToDelete = [];
            this.postCache.forEach((_, key) => {
                if (key.startsWith(`${username}_author_posts_`)) keysToDelete.push(key);
            });
            keysToDelete.forEach(k => this.postCache.delete(k));
        }

        const cacheKey = `${username}_author_posts_page_${page}`;

        if (!params?.forceRefresh) {
            const cached = this.getCachedPosts(cacheKey);
            if (cached) return cached;
        }

        // ── Primary: SteemWorld offset-based ──────────────────────────────
        try {
            const offset = (page - 1) * limit;
            const { posts } = await _swFetchFeed('getPostsByAuthor', username, limit, offset);
            this.cachePosts(cacheKey, posts);
            return posts;
        } catch (swErr) {
            console.warn(`[ProfileService] SteemWorld getPostsByAuthor failed (page ${page}), falling back:`, swErr.message);
        }

        // ── Fallback: condenser cursor-based ──────────────────────────────
        try {
            let paginationParams = {};
            if (page > 1) {
                const prevKey = `${username}_author_posts_page_${page - 1}`;
                const prevPosts = this.getCachedPosts(prevKey);
                if (prevPosts?.length > 0) {
                    const last = prevPosts[prevPosts.length - 1];
                    paginationParams = { startPermlink: last.permlink, beforeDate: last.created };
                }
            }
            const result = await steemService.getUserAuthorPosts(username, limit, paginationParams);
            const posts = result.posts ?? [];
            if (posts.length > 0) this.cachePosts(cacheKey, posts);
            return posts;
        } catch (error) {
            console.error(`[ProfileService] getUserAuthorPosts fallback failed for ${username}:`, error);
            return [];
        }
    }

    /**
     * Pulisce la cache dei post per uno specifico utente
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


    /**
     * Fetch replies to an account's posts/comments using the native Steem API.
     * Uses cursor-based pagination: pass the last item's {author, permlink} to get the next page.
     * @param {string} username
     * @param {number} limit
     * @param {string|null} startPermlink - permlink of the last item from the previous page (null for first page)
     * @returns {Promise<Array>}
     */
    /**
     * Fetch replies to an account using getRepliesByLastUpdate.
     * Switches endpoint on each retry to avoid flaky nodes.
     * @param {string} username
     * @param {number} limit
     * @param {string|null} startPermlink - cursor from previous page (null = first page)
     * @returns {Promise<{items: Array, hasMore: boolean}>}
     */
    async getUserReplies(username, limit = 20, page = 1, options = {}) {
        const forceRefresh = typeof options === 'boolean' ? options : !!options.forceRefresh;
        const safeLimit = Math.max(1, Number(limit) || 20);
        const safePage = Math.max(1, Number(page) || 1);
        const cacheKey = `${username}_replies_page_${safePage}`;

        if (!forceRefresh) {
            const cached = this.getCachedPosts(cacheKey);
            if (cached) return cached;
        }

        try {
            const offset = (safePage - 1) * safeLimit;
            const { comments } = await _swFetchComments('getCommentsByParentAuthor', username, safeLimit, offset);
            if (comments.length > 0) this.cachePosts(cacheKey, comments);
            return comments;
        } catch (err) {
            console.error(`[ProfileService] getUserReplies failed for ${username}:`, err);
            return this.getCachedPosts(cacheKey) ?? [];
        }
    }

    async getUserComments(username, limit = 20, page = 1, options = {}) {
        const forceRefresh = typeof options === 'boolean' ? options : !!options.forceRefresh;
        const safeLimit = Math.max(1, Number(limit) || 20);
        const safePage = Math.max(1, Number(page) || 1);
        const cacheKey = `${username}_comments_page_${safePage}`;

        if (!forceRefresh) {
            const cached = this.getCachedPosts(cacheKey);
            if (cached) return cached;
        }

        try {
            const offset = (safePage - 1) * safeLimit;
            const { comments } = await _swFetchComments('getCommentsByAuthor', username, safeLimit, offset);
            if (comments.length > 0) this.cachePosts(cacheKey, comments);
            return comments;
        } catch (err) {
            console.error(`[ProfileService] getUserComments failed for ${username}:`, err);
            return this.getCachedPosts(cacheKey) ?? [];
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

        const requiredCount = page * limit;
        // Cache may contain only the first chunk from a previous request.
        // For page > 1, use cache only if it has enough items to cover that page.
        if (page > 1 && cachedComments.length < requiredCount) {
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
