import router from '../utils/Router.js';
import communityService from './CommunityService.js';
import steemService from './SteemService.js';
import eventEmitter from '../utils/EventEmitter.js';

export class SearchService {
  constructor() {
    this.lastQuery = '';
    this.searchCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Handle search input and redirect to appropriate page
   * @param {string} query - User search query
   */
  async handleSearch(query) {
    if (!query || query.trim() === '') return;
    
    query = query.trim();
    this.lastQuery = query;
    
    try {
      // Check for special search patterns and redirect accordingly
      
      // Community search - either @community or community/
      if (query.startsWith('@') && !query.includes('/')) {
        // Direct community search - remove @ and navigate to communities search
        const communityName = query.substring(1);
        router.navigate(`/communities/search/${encodeURIComponent(communityName)}`);
        return;
      }
      
      // User profile search - @username
      if (query.startsWith('@') && !query.includes(' ')) {
        // Direct profile navigation
        router.navigate(query);
        return;
      }
      
      // Tag search - #tag
      if (query.startsWith('#')) {
        const tag = query.substring(1);
        router.navigate(`/tag/${encodeURIComponent(tag)}`);
        return;
      }
      
      // For everything else, go to search results page
      router.navigate(`/search?q=${encodeURIComponent(query)}`);
    } catch (error) {
      console.error('Search handling failed:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'Search failed. Please try again.'
      });
    }
  }
  
  /**
   * Perform a comprehensive search across multiple content types
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    if (!query || query.trim() === '') {
      return {
        posts: [],
        users: [],
        communities: [],
        tags: []
      };
    }
    
    query = query.trim();
    
    // Check cache for recent results
    const cacheKey = `${query}-${JSON.stringify(options)}`;
    if (this.searchCache.has(cacheKey)) {
      const cachedResult = this.searchCache.get(cacheKey);
      if (Date.now() - cachedResult.timestamp < this.cacheExpiry) {
        console.log('Using cached search results for:', query);
        return cachedResult.results;
      }
    }
    
    try {
      // Default search options
      const defaultOptions = {
        limit: 10,
        includeUsers: true,
        includeCommunities: true,
        includePosts: true,
        includeTags: true
      };
      
      const searchOptions = { ...defaultOptions, ...options };
      
      // Initialize containers for search results
      const results = {
        posts: [],
        users: [],
        communities: [],
        tags: []
      };
      
      // Perform searches in parallel
      const searchPromises = [];
      
      // Search posts
      if (searchOptions.includePosts) {
        searchPromises.push(
          steemService.searchPosts(query, searchOptions.limit)
            .then(posts => {
              results.posts = posts;
            })
            .catch(error => {
              console.error('Post search failed:', error);
              results.posts = [];
            })
        );
      }
      
      // Search communities
      if (searchOptions.includeCommunities) {
        searchPromises.push(
          communityService.searchCommunities(query, searchOptions.limit)
            .then(communities => {
              results.communities = communities;
            })
            .catch(error => {
              console.error('Community search failed:', error);
              results.communities = [];
            })
        );
      }
      
      // Search users (accounts)
      if (searchOptions.includeUsers) {
        searchPromises.push(
          steemService.searchAccounts(query, searchOptions.limit)
            .then(users => {
              results.users = users;
            })
            .catch(error => {
              console.error('User search failed:', error);
              results.users = [];
            })
        );
      }
      
      // Search tags (optional for now)
      if (searchOptions.includeTags) {
        searchPromises.push(
          steemService.searchTags(query, searchOptions.limit)
            .then(tags => {
              results.tags = tags;
            })
            .catch(error => {
              console.error('Tag search failed:', error);
              results.tags = [];
            })
        );
      }
      
      // Wait for all searches to complete
      await Promise.all(searchPromises);
      
      // Cache the results
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: { ...results }
      });
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }
  
  /**
   * Specifically search for communities with improved handling
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Community search results
   */
  async searchCommunities(query, limit = 20) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    try {
      // Use communityService for actual search
      return await communityService.searchCommunities(query, limit);
    } catch (error) {
      console.error('Community search failed:', error);
      throw error;
    }
  }
  
  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
  }
}

// Create and export a singleton instance
const searchService = new SearchService();
export default searchService;
