import steemService from '../services/SteemService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import eventEmitter from '../utils/EventEmitter.js';
import metaTagService from '../services/MetaTagService.js';

class HomeView extends BasePostView {  constructor(params) {
    super(params);
    
    // Se forceTag è true, usa sempre il tag specificato nei parametri
    if (params.forceTag && params.tag) {
      this.tag = params.tag;
    } else {
      // Altrimenti, considera le preferenze dell'utente
      const homeViewMode = userPreferencesService.getHomeViewMode();
      const preferredTags = userPreferencesService.getPreferredTags();
      
      // If we're in custom mode but have no preferred tags, fallback to trending
      if (homeViewMode === 'custom' && (!preferredTags || preferredTags.length === 0)) {
        console.warn('Custom mode selected but no preferred tags found, falling back to trending');
        this.tag = 'trending';
        
        // Auto-correct the stored preference
        userPreferencesService.setHomeViewMode('trending');
      } else if (homeViewMode === 'custom') {
        this.tag = 'custom';
      } else {
        // Otherwise use the specified tag parameter or home view mode
        this.tag = this.params.tag || homeViewMode;
      }
    }
    
    // Listen for preferences changes
    this.setupPreferencesListener();
  }
    setupPreferencesListener() {
    // Listen for tag preference changes
    eventEmitter.on('user:preferences:updated', () => {
      // Get current home view mode from preferences
      const currentHomeViewMode = userPreferencesService.getHomeViewMode();
      
      // If we're currently in custom mode or the mode has changed
      if (this.tag === 'custom' || this.tag !== currentHomeViewMode) {
        // Update the current tag to match the new preference
        this.tag = currentHomeViewMode;
        
        // Reload posts with new preferences
        this.posts = [];
        this.renderedPostIds.clear();
        this.loadPosts(1);
      }
    });
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
    // If custom tag is selected, fetch by preferred tags
    if (this.tag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      
      if (preferredTags.length === 0) {
        // Fallback to trending if no preferred tags
        return steemService.getTrendingPosts(page);
      }
      
      // Get posts for each preferred tag
      return steemService.getPostsByPreferredTags(preferredTags, page);
    }
    
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
    // Reset to default meta tags for home page
    metaTagService.resetToDefault();
    
    // Get view title based on tag
    let viewTitle = `${this.formatTagName(this.tag)} Posts`;
    
    // Special handling for custom tag mode
    if (this.tag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      if (preferredTags.length > 0) {
        // Format tags for display with proper capitalization and commas
        const formattedTags = preferredTags
          .map(tag => this.formatTagName(tag))
          .join(', ');
        viewTitle = `Your Tags: ${formattedTags}`;
      } else {
        viewTitle = 'Trending Posts';
      }
    }
    
    const { postsContainer } = this.renderBaseView(
      container,
      viewTitle,
      { showSearchForm: false }
    );
    
    // Destroy existing infinite scroll if it exists
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
    }
    
    // Load first page of posts
    this.loadPosts(1).then((hasMore) => {
      // Initialize infinite scroll after first page loads
      if (postsContainer) {
        // Customize end message based on tag type
        let endMessage = `No more ${this.formatTagName(this.tag)} posts to load`;
        if (this.tag === 'custom') {
          const preferredTags = userPreferencesService.getPreferredTags();
          if (preferredTags.length > 0) {
            endMessage = `No more posts with tags: ${preferredTags.join(', ')}`;
          } else {
            endMessage = 'No more posts to load';
          }
        }
        
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px',
          loadingMessage: 'Loading more posts...',
          endMessage,
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
    
    // Remove event listeners
    eventEmitter.off('user:preferences:updated');
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