import router from '../utils/Router.js';

export class SearchService {
    constructor() {
        this.searchTypes = {
            USER: '@',
            TAG: '#',
            COMMUNITY: 'hive-'
        };
    }

    /**
     * Parse and process the search query
     * @param {string} query - The search query
     * @returns {Object} Search result with type and value
     */
    parseQuery(query) {
        const trimmedQuery = query.trim();
        
        // Check for user search with @ prefix - MUST start with @ to be a user search
        if (trimmedQuery.startsWith(this.searchTypes.USER)) {
            return {
                type: 'user',
                value: trimmedQuery.substring(1)
            };
        }
        
        // Check for tag search - MUST start with # to be a tag search
        if (trimmedQuery.startsWith(this.searchTypes.TAG)) {
            return {
                type: 'tag',
                value: trimmedQuery.substring(1)
            };
        }
        
        // Check for community search
        if (trimmedQuery.toLowerCase().startsWith(this.searchTypes.COMMUNITY)) {
            return {
                type: 'community',
                value: trimmedQuery
            };
        }
        
        // Default to post search
        return {
            type: 'post',
            value: trimmedQuery
        };
    }

    /**
     * Handle the search and navigation
     * @param {string} query - The search query
     * @returns {Promise<void>}
     */
    async handleSearch(query) {
        const searchResult = this.parseQuery(query);
        
        try {
            // You can add validation here before navigation
            switch (searchResult.type) {
                case 'user':
                    // For users, we need to use the @username format expected by the router
                    router.navigate(`/@${searchResult.value}`);
                    break;
                case 'tag':
                    // Navigate to tag page
                    router.navigate(`/tag/${searchResult.value}`);
                    break;
                case 'community':
                    // Navigate to community page
                    router.navigate(`/community/${searchResult.value}`);
                    break;
                case 'post':
                    // Navigate to search page with query parameter
                    router.navigate(`/search?q=${encodeURIComponent(searchResult.value)}`);
                    break;
            }
            
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }
}
