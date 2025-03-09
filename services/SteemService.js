import eventEmitter from '../utils/EventEmitter.js';

/**
 * Service for interacting with the Steem blockchain
 */
class SteemService {
    constructor() {
        // Check if steem is already available globally
        if (window.steem) {
            this.steem = window.steem;
            this.configureApi();
        } else {
            // If not available, we need to load it
            this.loadLibrary();
        }

        // Keep your original API nodes
        this.apiEndpoints = [
            'https://api.moecki.online',
            'https://api.steemit.com',
            'https://api.steemitdev.com',
            'https://api.steemzzang.com',
            'https://api.steemit.com',
            'https://api.hive.blog',
            'https://api.hivekings.com',
            'https://anyx.io',
            'https://api.openhive.network'
        ];
        this.currentEndpoint = 0;
    }

    /**
     * Load the Steem JavaScript library dynamically
     */
    async loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/steem/dist/steem.min.js';
            script.async = true;

            script.onload = () => {
                if (window.steem) {
                    this.steem = window.steem;
                    this.configureApi();
                    eventEmitter.emit('steem:loaded');
                    resolve(this.steem);
                } else {
                    const error = new Error('Steem library loaded but not available globally');
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: 'Failed to initialize Steem connection'
                    });
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error('Failed to load Steem library');
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: 'Failed to load Steem library'
                });
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Configure API connection
     */
    configureApi() {
        if (!this.steem) {
            throw new Error('Steem library not loaded');
        }

        this.steem.api.setOptions({ url: this.apiEndpoints[this.currentEndpoint] });
        this.steem.config.set('address_prefix', 'STM');
        this.steem.config.set('chain_id', '0000000000000000000000000000000000000000000000000000000000000000');
    }

    /**
     * Switch to next API endpoint on error
     */
    switchEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % this.apiEndpoints.length;
        this.configureApi();
        console.log(`Switched to endpoint: ${this.apiEndpoints[this.currentEndpoint]}`);
        return this.apiEndpoints[this.currentEndpoint];
    }

    /**
     * Ensure Steem library is loaded before making API calls
     */
    async ensureLibraryLoaded() {
        if (!this.steem) {
            try {
                await this.loadLibrary();
            } catch (error) {
                console.error('Failed to load Steem library:', error);
                throw new Error('Steem library not loaded');
            }
        }
        return this.steem;
    }

    /**
     * Get discussion by method with retry capability
     * @private
     */
    async _getDiscussionsByMethod(method, options, retries = 2) {
        await this.ensureLibraryLoaded();

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api[method](options, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            } catch (error) {
                console.error(`Error in ${method} (attempt ${attempt + 1}):`, error);
                if (attempt === retries) throw error;
                this.switchEndpoint();
            }
        }
    }

    /**
     * Get trending posts
     */
    async getTrendingPosts(tag = '', limit = 20) {
        return this._getDiscussionsByMethod('getDiscussionsByTrending', { tag, limit });
    }

    /**
     * Get hot posts
     */
    async getHotPosts(tag = '', limit = 20) {
        return this._getDiscussionsByMethod('getDiscussionsByHot', { tag, limit });
    }

    /**
     * Get new/recent posts
     */
    async getNewPosts(tag = '', limit = 20) {
        return this._getDiscussionsByMethod('getDiscussionsByCreated', { tag, limit });
    }

    /**
     * Get promoted posts
     */
    async getPromotedPosts(tag = '', limit = 20) {
        return this._getDiscussionsByMethod('getDiscussionsByPromoted', { tag, limit });
    }

    /**
     * Get post and comments by author and permlink
     */
    async getContent(author, permlink) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getContent(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get profile information for a user
     */
    async getProfile(username) {
        await this.ensureLibraryLoaded();

        try {
            const accounts = await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (accounts && accounts.length > 0) {
                try {
                    const metadata = JSON.parse(accounts[0].json_metadata || '{}');
                    return {
                        ...accounts[0],
                        profile: metadata.profile || {}
                    };
                } catch (e) {
                    return accounts[0];
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get account history
     */
    async getAccountHistory(username, from = -1, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccountHistory(username, from, limit, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching account history:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get user info
     */
    async getUserInfo(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result[0]);
                });
            });
        } catch (error) {
            console.error('Error fetching user info:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get user 
     */
    async getUser(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result[0]);
                });
            });
        } catch (error) {
            console.error('Error fetching user:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    /**
     * Get posts by a specific user
     */
    async getUserPosts(username, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getDiscussionsByAuthorBeforeDate(
                    username, 
                    '', // Start permlink (empty for latest)
                    new Date().toISOString().split('.')[0], // Current date
                    limit, 
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        } catch (error) {
            console.error('Error fetching user posts:', error);
            this.switchEndpoint();
            throw error;
        }
    }
}

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';