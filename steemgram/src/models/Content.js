/**
 * Base class for all content types on the Steem blockchain
 */
class Content {
    /**
     * Create a new Content instance
     * @param {string} author - Username of the content creator
     * @param {string} permlink - Unique identifier for the content
     * @param {string} body - Main content body
     * @param {string[]} tags - Array of tags for content discovery
     * @param {Beneficiary[]} beneficiaries - Array of beneficiaries to receive a portion of rewards
     */
    constructor(author, permlink, body, tags = [], beneficiaries = []) {
        this.author = author;
        this.permlink = permlink || this.generatePermlink();
        this.body = body;
        this.created = new Date();
        this.lastUpdate = new Date();
        this.votes = [];
        this.tags = tags;
        this.beneficiaries = beneficiaries;
        this.totalVotes = 0;
        this.payout = 0.0;
    }

    /**
     * Generate a unique permlink based on content and timestamp
     * @returns {string} A unique permlink
     */
    generatePermlink() {
        const timestamp = Date.now().toString(36);
        const randomString = Math.random().toString(36).substring(2, 7);
        // Create slug from first 50 chars of body if available
        const slug = this.body ? 
            this.body.substring(0, 50)
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, '-') : 
            'post';
            
        return `${slug}-${timestamp}-${randomString}`;
    }

    /**
     * Edit the content
     * @param {string} newBody - New content body
     * @param {string[]} newTags - New array of tags
     * @returns {boolean} Success of the edit operation
     */
    async edit(newBody, newTags) {
        this.body = newBody;
        this.tags = newTags;
        this.lastUpdate = new Date();
        // Here we would actually interact with the blockchain
        return true;
    }

    /**
     * Calculate the net votes (upvotes - downvotes)
     * @returns {number} Net vote count
     */
    getNetVotes() {
        return this.votes.reduce((total, vote) => {
            return total + (vote.weight > 0 ? 1 : -1);
        }, 0);
    }

    /**
     * Calculate pending payout amount
     * @returns {number} Pending payout amount
     */
    getPendingPayout() {
        // In a real implementation, this would calculate based on votes, time, etc.
        return this.payout;
    }
}

export default Content;
