import SteemCore from './steem-service-classes/SteemCore.js';
import PostService from './steem-service-classes/PostService.js';
import CommentService from './steem-service-classes/CommentService.js';
import UserServiceCore from './steem-service-classes/UserServiceCore.js';

/**
 * Main service facade that delegates to specialized services
 */
class SteemService {
    constructor() {
        this.core = new SteemCore();
        this.postService = new PostService(this.core);
        this.commentService = new CommentService(this.core);
        this.userService = new UserServiceCore(this.core);
    }

    // Core functionality methods
    async loadLibrary() {
        return this.core.loadLibrary();
    }

    configureApi() {
        return this.core.configureApi();
    }

    switchEndpoint() {
        return this.core.switchEndpoint();
    }

    async ensureLibraryLoaded() {
        return this.core.ensureLibraryLoaded();
    }

    // Post service methods
    async getPostsByCategory(category, page = 1, limit = 20) {
        return this.postService.getPostsByCategory(category, page, limit);
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
        return this.postService.getContent(author, permlink);
    }

    async getContentReplies(author, permlink) {
        return this.postService.getContentReplies(author, permlink);
    }

    async getPostsByTag(tag, page = 1, limit = 20) {
        return this.postService.getPostsByTag(tag, page, limit);
    }

    async getUserPosts(username, limit = 50, pagination = {}) {
        return this.postService.getUserPosts(username, limit, pagination);
    }

    async getDiscussionsByBlog(query) {
        return this.postService.getDiscussionsByBlog(query);
    }

    async _fetchUserBlogPosts(username, limit) {
        return this.postService._fetchUserBlogPosts(username, limit);
    }

    _setLastPostForUser(username, post) {
        return this.postService._setLastPostForUser(username, post);
    }

    getLastPostForUser(username) {
        return this.postService.getLastPostForUser(username);
    }

    getSortMethodName(sort) {
        return this.postService.getSortMethodName(sort);
    }

    formatSimpleCommunityTitle(communityName) {
        return this.postService.formatSimpleCommunityTitle(communityName);
    }

    // Comment service methods
    async createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        return this.commentService.createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata);
    }

    sanitizePermlink(permlink) {
        return this.commentService.sanitizePermlink(permlink);
    }

    async getCommentsByAuthor(author, limit = -1) {
        return this.commentService.getCommentsByAuthor(author, limit);
    }

    async getAuthorComments(username, startPermlink, limit) {
        return this.commentService.getAuthorComments(username, startPermlink, limit);
    }

    // User service methods
    async getUserData(username, options = { includeProfile: false }) {
        return this.userService.getUserData(username, options);
    }

    async getProfile(username) {
        return this.userService.getProfile(username);
    }

    async getUserInfo(username) {
        return this.userService.getUserInfo(username);
    }

    async getUser(username) {
        return this.userService.getUser(username);
    }

    async getAccountHistory(username, from = -1, limit = 10) {
        return this.userService.getAccountHistory(username, from, limit);
    }

    async getFollowers(username) {
        return this.userService.getFollowers(username);
    }

    async getFollowing(username) {
        return this.userService.getFollowing(username);
    }

    async updateUserProfile(username, profile) {
        return this.userService.updateUserProfile(username, profile);
    }

    /**
     * Fetch posts from a specific community with pagination and sorting
     * @param {Object} params - Parameters for fetching community posts
     * @param {string} params.community - Community name or ID (without 'hive-' prefix)
     * @param {string} params.sort - Sort method ('trending', 'hot', 'created', etc.)
     * @param {number} params.limit - Maximum number of posts to fetch
     * @param {string} [params.start_author] - Author of the post to start from (for pagination)
     * @param {string} [params.start_permlink] - Permlink of the post to start from (for pagination)
     * @returns {Promise<Array>} Array of community posts
     */
    async fetchCommunityPosts(params) {
        // Ensure the library is loaded
        await this.ensureLibraryLoaded();
        
        // Format the query object for the API
        const query = {
            tag: `hive-${params.community.replace(/^hive-/, '')}`,  // Ensure 'hive-' prefix is added
            sort: params.sort || 'trending',
            limit: params.limit || 20
        };
        
        // Add pagination parameters if provided
        if (params.start_author && params.start_permlink) {
            query.start_author = params.start_author;
            query.start_permlink = params.start_permlink;
        }
        
        console.log(`Fetching community posts for ${query.tag} with sort=${query.sort}, limit=${query.limit}`);
        
        try {
            // Use the appropriate API method based on sort type
            return await new Promise((resolve, reject) => {
                // Choose the right API method based on sort order
                let apiMethod;
                switch(query.sort) {
                    case 'created':
                        apiMethod = 'getDiscussionsByCreated';
                        break;
                    case 'hot':
                        apiMethod = 'getDiscussionsByHot';
                        break;
                    case 'promoted':
                        apiMethod = 'getDiscussionsByPromoted';
                        break;
                    case 'trending':
                    default:
                        apiMethod = 'getDiscussionsByTrending';
                }
                
                // Fix: Use this.core.steem instead of this.steem
                this.core.steem.api[apiMethod](query, (err, result) => {
                    if (err) {
                        console.error(`API error in ${apiMethod}:`, err);
                        reject(err);
                    } else {
                        console.log(`Received ${result ? result.length : 0} community posts`);
                        
                        // Filter posts to ensure they actually belong to this community
                        // Sometimes the API returns posts that don't match the community tag
                        const filteredPosts = (result || []).filter(post => {
                            const metadata = this.parseMetadata(post.json_metadata);
                            return metadata && metadata.community === params.community.replace(/^hive-/, '');
                        });
                        
                        resolve(filteredPosts);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching community posts:', error);
            
            // Retry once with different API method if first attempt fails
            try {
                // Fallback to bridge API which might be more reliable for communities
                return await new Promise((resolve, reject) => {
                    // Fix: Use this.core.steem instead of this.steem
                    this.core.steem.api.call(
                        'bridge.get_ranked_posts',
                        {
                            tag: query.tag,
                            sort: query.sort,
                            limit: query.limit,
                            start_author: query.start_author || '',
                            start_permlink: query.start_permlink || ''
                        },
                        (err, result) => {
                            if (err) {
                                console.error('Bridge API error:', err);
                                reject(err);
                            } else {
                                console.log(`Bridge API returned ${result ? result.length : 0} posts`);
                                resolve(result || []);
                            }
                        }
                    );
                });
            } catch (retryError) {
                console.error('Retry also failed:', retryError);
                return [];
            }
        }
    }

    /**
     * Parse post metadata
     * @param {string|Object} jsonMetadata - JSON metadata string or object
     * @returns {Object} Parsed metadata object
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

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
