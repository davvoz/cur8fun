/**
 * Profile model representing a Steem user profile
 */
class Profile {
    /**
     * Create a new Profile instance
     * @param {Object} userData - Raw user data from Steem API
     */
    constructor(userData) {
        if (!userData) {
            throw new Error('User data is required to create a Profile');
        }
        
        // Core user info
        this.username = userData.name;
        this.id = userData.id;
        this.created = new Date(userData.created);
        this.reputation = this.calculateReputation(userData.reputation);
        
        // Account stats
        this.postCount = parseInt(userData.post_count || 0);
        this.followerCount = parseInt(userData.follower_count || 0);
        this.followingCount = parseInt(userData.following_count || 0);
        this.memoKey = userData.memo_key;
        
        // Financial data
        this.balance = userData.balance || '0 STEEM';
        this.sbdBalance = userData.sbd_balance || '0 SBD';
        this.vestingShares = userData.vesting_shares || '0 VESTS';
        this.delegatedVestingShares = userData.delegated_vesting_shares || '0 VESTS';
        this.receivedVestingShares = userData.received_vesting_shares || '0 VESTS';
        
        // Profile metadata
        // posting_json_metadata is the canonical source since Steem HF21 (2019)
        this.metadata = this.parseMetadata(userData.json_metadata, userData.posting_json_metadata);
        this.profileImage = this.getProfileImage();
        this.coverImage = this.getCoverImage();
        this.about = this.getAbout();
        this.location = this.getLocation();
        this.website = this.getWebsite();
        
        // Raw data (for advanced use cases)
        this.rawData = userData;
    }
    
    /**
     * Parse user metadata from JSON string
     * @param {string} jsonMetadata - JSON metadata string
     * @returns {Object} Parsed metadata object
     */
    parseMetadata(jsonMetadata, postingJsonMetadata) {
        const tryParse = (str) => {
            if (!str) return null;
            try {
                const parsed = typeof str === 'string' ? JSON.parse(str) : str;
                // Only use if it contains a non-empty profile object
                if (parsed && parsed.profile && Object.keys(parsed.profile).length > 0) return parsed;
                return null;
            } catch (e) {
                return null;
            }
        };

        // Prefer posting_json_metadata (canonical since Steem HF21)
        const fromPosting = tryParse(postingJsonMetadata);
        if (fromPosting) return fromPosting;

        const fromJson = tryParse(jsonMetadata);
        if (fromJson) return fromJson;

        return { profile: {} };
    }
    
    /**
     * Calculate human-readable reputation score
     * @param {number} reputation - Raw reputation value
     * @returns {number} Formatted reputation score
     */
    calculateReputation(reputation) {
        if (!reputation) return 25;
        
        try {
            const neg = reputation < 0;
            const repLevel = Math.log10(Math.abs(reputation));
            let reputationPoint = Math.max(repLevel - 9, 0);
            if (reputationPoint < 0) reputationPoint = 0;
            if (neg) reputationPoint *= -1;
            return (reputationPoint * 9) + 25;
        } catch (error) {
            return 25;
        }
    }
    
    /**
     * Get profile image URL
     * @returns {string} Profile image URL
     */
    getProfileImage() {
        const profile = this.metadata.profile;
        if (profile.profile_image) return profile.profile_image;
        return `https://steemitimages.com/u/${this.username}/avatar`;
    }
    
    /**
     * Get cover image URL
     * @returns {string|null} Cover image URL
     */
    getCoverImage() {
        const profile = this.metadata.profile;
        return profile.cover_image || null;
    }
    
    /**
     * Get user's about/bio text
     * @returns {string} About/bio text
     */
    getAbout() {
        const profile = this.metadata.profile;
        return profile.about || '';
    }
    
    /**
     * Get user's location
     * @returns {string} Location
     */
    getLocation() {
        const profile = this.metadata.profile;
        return profile.location || '';
    }
    
    /**
     * Get user's website
     * @returns {string} Website URL
     */
    getWebsite() {
        const profile = this.metadata.profile;
        return profile.website || '';
    }
    
    /**
     * Calculate estimated account value
     * @returns {string} Estimated account value in STEEM
     */
    getEstimatedAccountValue() {
        // This would require current price data, simplified for now
        return 'N/A';
    }
    
    /**
     * Get formatted creation date
     * @returns {string} Formatted date
     */
    getFormattedJoinDate() {
        try {
            return this.created.toLocaleDateString();
        } catch (error) {
            return 'Unknown';
        }
    }
}

export default Profile;
