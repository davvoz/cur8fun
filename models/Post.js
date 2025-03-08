import Content from './Content.js';

/**
 * Post class representing main content entries on the Steem blockchain
 * @extends Content
 */
class Post extends Content {
    /**
     * Create a new Post instance
     * @param {string} author - Username of the post creator
     * @param {string} permlink - Unique identifier for the post
     * @param {string} title - Title of the post
     * @param {string} body - Main content body
     * @param {string} category - Main category for the post
     * @param {string[]} tags - Array of tags for content discovery
     * @param {Beneficiary[]} beneficiaries - Array of beneficiaries to receive a portion of rewards
     * @param {boolean} isNSFW - Flag to mark content as Not Safe For Work
     */
    constructor(author, permlink, title, body, category, tags = [], beneficiaries = [], isNSFW = false) {
        super(author, permlink, body, tags, beneficiaries);
        this.title = title;
        this.category = category;
        this.isNSFW = isNSFW;
        this.comments = [];
    }

    /**
     * Promote the post with SBD (Steem Backed Dollars)
     * @param {number} amount - Amount of SBD to use for promotion
     * @returns {boolean} Success of the promotion
     */
    async promote(amount) {
        // Implementation would interact with Steem blockchain
        console.log(`Promoting post with ${amount} SBD`);
        return true;
    }

    /**
     * Boost the post visibility
     * @param {number} amount - Amount to boost with
     * @returns {boolean} Success of the boost operation
     */
    async boost(amount) {
        // Implementation would interact with Steem blockchain
        console.log(`Boosting post with ${amount} SP`);
        return true;
    }

    /**
     * Get all comments/replies to this post
     * @returns {Comment[]} Array of comments
     */
    getReplies() {
        return this.comments;
    }

    /**
     * Add a comment to this post
     * @param {Comment} comment - Comment to add
     */
    addComment(comment) {
        this.comments.push(comment);
    }
}

export default Post;
