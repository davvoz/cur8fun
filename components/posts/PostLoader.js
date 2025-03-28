import profileService from '../../services/ProfileService.js';

export default class PostLoader {
  constructor(username) {
    this.username = username;
    this.loading = false;
    this.postsData = null;
    this.allPosts = [];
    this.estimatedTotalPosts = 0;
    this.pageSize = 20; // Number of posts per page
    this.hasMorePosts = true; // Flag to track if there are more posts to load
    this.lastFetchedPage = 0; // Last loaded page
  }

  async loadPosts(limit = 20, page = 1) {
    if (this.loading) return this.allPosts;
    this.loading = true;

    try {
      console.log(`Loading posts for @${this.username}, page ${page}, limit ${limit}`);
      
      // Load posts from service - always force a refresh
      const posts = await profileService.getUserPosts(this.username, limit, page, {
        forceRefresh: true, // Always force refresh
        timeout: 15000
      });

      if (posts && Array.isArray(posts)) {
        if (page === 1) {
          // If it's the first page, reset the collection
          this.allPosts = posts;
        } else {
          // Otherwise add to existing collection
          this.allPosts = [...this.allPosts, ...posts];
        }
        
        this.postsData = true;
        this.estimatedTotalPosts = this.allPosts.length;
        this.lastFetchedPage = page;
        
        // Determine if there are more posts to load
        this.hasMorePosts = posts.length >= limit;
        
        return posts;
      }
      return [];
    } catch (error) {
      console.error('Error loading posts:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }
  
  async loadMorePosts(page) {
    if (!this.hasMorePosts || page <= this.lastFetchedPage) {
      return [];
    }
    
    const newPosts = await this.loadPosts(this.pageSize, page);
    return newPosts;
  }
  
  hasMore() {
    return this.hasMorePosts;
  }

  reset() {
    this.loading = false;
    this.postsData = null;
    this.allPosts = [];
    this.lastFetchedPage = 0;
    this.hasMorePosts = true;
    this.estimatedTotalPosts = 0;
    return this;
  }
}
