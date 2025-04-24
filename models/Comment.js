import Content from './Content.js';

/**
 * Comment class representing replies to posts or other comments
 * @extends Content
 */
class Comment extends Content {
    /**
     * Create a new Comment instance
     * @param {string} author - Username of the comment creator
     * @param {string} permlink - Unique identifier for the comment
     * @param {string} body - Comment content
     * @param {string} parentAuthor - Author of the parent content
     * @param {string} parentPermlink - Permlink of the parent content
     * @param {string[]} tags - Array of tags for the comment
     * @param {Beneficiary[]} beneficiaries - Array of beneficiaries to receive a portion of rewards
     */
    constructor(author, permlink, body, parentAuthor, parentPermlink, tags = [], beneficiaries = []) {
        super(author, permlink, body, tags, beneficiaries);
        this.parentAuthor = parentAuthor;
        this.parentPermlink = parentPermlink;
        this.depth = 0; // Will be calculated based on parent
        this.replies = [];
    }

    /**
     * Get the root post for this comment
     * @returns {Promise<Post>} The root post
     */
    async getRootPost() {
        try {
            // Instead of console.log, just perform the operation silently
            const rootPost = await this.postService.getPost(this.rootAuthor, this.rootPermlink);
            this.rootPost = rootPost;
            return rootPost;
        } catch (error) {
            console.error('Error retrieving root post:', error);
            return null;
        }
    }

    /**
     * Add a reply to this comment
     * @param {Comment} comment - The reply to add
     * @returns {boolean} Success of adding the reply
     */
    addReply(comment) {
        // Set depth of reply to be one more than this comment's depth
        comment.depth = this.depth + 1;
        this.replies.push(comment);
        return true;
    }

    /**
     * Get all replies to this comment
     * @returns {Comment[]} Array of replies
     */
    getReplies() {
        return this.replies;
    }
}

export default Comment;
