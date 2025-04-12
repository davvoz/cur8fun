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

    /**
     * Clears any cached data to ensure fresh results on next request
     */
    clearCache() {
        // If implementing a cache, this would clear it
        // For now just return a resolved promise
        console.log('Clearing service cache for fresh data');
        return Promise.resolve();
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

    async fetchCommunityPosts(params) {
        // Delegate to the specialized PostService implementation
        return this.postService.fetchCommunityPosts(params);
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
    
    /**
     * Follow a user on the Steem blockchain
     * @param {string} follower - Username of the follower
     * @param {string} following - Username of the person to follow
     * @returns {Promise<Object>} - Result of the operation
     */
    async followUser(follower, following) {
        return this.userService.followUser(follower, following);
    }
    
    /**
     * Unfollow a user on the Steem blockchain
     * @param {string} follower - Username of the follower
     * @param {string} following - Username of the person to unfollow
     * @returns {Promise<Object>} - Result of the operation
     */
    async unfollowUser(follower, following) {
        return this.userService.unfollowUser(follower, following);
    }
    
    /**
     * Check if a user follows another user
     * @param {string} follower - Username of the potential follower
     * @param {string} following - Username of the potential followed user
     * @returns {Promise<boolean>} - True if follower follows following
     */
    async checkIfFollowing(follower, following) {
        return this.userService.checkIfFollowing(follower, following);
    }

    async updateUserProfile(username, profile, activeKey = null) {
        return this.userService.updateUserProfile(username, profile, activeKey);
    }

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
