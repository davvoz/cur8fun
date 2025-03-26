import steemService from '../services/SteemService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class HomeView extends BasePostView {
  constructor(params) {
    super(params);
    this.tag = this.params.tag || 'trending';
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
      
      // Reset infinite scroll if it exists
      if (this.infiniteScroll) {
          this.infiniteScroll.reset(1);
      }
    }
    
    try {
      const result = await this.fetchPostsByTag(page);
      
      // Check if result has the expected structure
      if (!result || !result.posts) {
        return false;
      }
      
      const { posts, hasMore } = result;
      
      // Filter out any duplicates before adding to the post array
      if (Array.isArray(posts)) {
        const uniquePosts = posts.filter(post => {
          // Create a unique ID using author and permlink
          const postId = `${post.author}_${post.permlink}`;
          // Only include posts we haven't seen yet
          const isNew = !this.renderedPostIds.has(postId);
          return isNew;
        });
        
        if (uniquePosts.length > 0) {
          this.posts = [...this.posts, ...uniquePosts];
          this.renderPosts(page > 1);
        } else {
          console.log('No new unique posts in this batch.');
        }
      }
      
      return hasMore;
    } catch (error) {
      console.error('Failed to load posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  async fetchPostsByTag(page = 1) {
    console.log(`Fetching ${this.tag} posts, page ${page}`);
    
    // Use getPostsByTag for any custom tag not in the special list
    if (!['trending', 'hot', 'created', 'promoted'].includes(this.tag)) {
      return steemService.getPostsByTag(this.tag, page);
    }
    
    const postFetchers = {
      'trending': () => steemService.getTrendingPosts(page),
      'hot': () => steemService.getHotPosts(page),
      'created': () => steemService.getNewPosts(page),
      'promoted': () => steemService.getPromotedPosts(page)
    };
    
    const fetchMethod = postFetchers[this.tag] || (() => steemService.getTrendingPosts(page));
    return await fetchMethod();
  }
  
  getCurrentTag() {
    return this.tag;
  }

  render(container) {
    const { postsContainer } = this.renderBaseView(
      container,
      `${this.formatTagName(this.tag)} Posts`,
      { showSearchForm: false } // Add this parameter to indicate we don't want the search form
    );
    
    // Destroy existing infinite scroll if it exists
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
    }
    
    // Load first page of posts
    this.loadPosts(1).then((hasMore) => {
      // Initialize infinite scroll after first page loads
      if (postsContainer) {
        console.log('Initializing infinite scroll');
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px',
          loadingMessage: 'Loading more posts...',
          endMessage: `No more ${this.formatTagName(this.tag)} posts to load`,
          errorMessage: 'Failed to load posts. Please check your connection.'
        });
      }
    });
  }
  
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
        this.infiniteScroll = null;
    }
  }

  /**
   * Override the base handleLoadError to not show any message
   */
  handleLoadError() {
    const postsContainer = this.container?.querySelector('.posts-container');
    if (postsContainer) {
      this.clearContainer(postsContainer);
      // No error message will be shown
    }
  }
}

export default HomeView;