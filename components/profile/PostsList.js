import BasePostView from '../../views/BasePostView.js';
import PostRenderer from '../posts/PostRenderer.js';
import PostLoader from '../posts/PostLoader.js';
import PostUIManager from '../posts/PostUIManager.js';

export default class PostsList extends BasePostView {
  constructor(username, useCache = false) {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    
    // Internal implementation components
    this._renderer = new PostRenderer();
    this._loader = new PostLoader(username);
    this._uiManager = null;
    
    // Maintain original properties for compatibility
    this.postsData = null;
    this.allPosts = [];
    this.loading = false;
    this.container = null;
    this.postsContainer = null;
    
    // Pagination settings for rendering
    this.postsPerPage = 20;
    this.currentPage = 1;
    this.hasMore = true;
  }
  
  async render(container) {
    if (!container) return;
    
    console.log(`Rendering PostsList for @${this.username}, useCache: ${this.useCache}`);
    
    // Maintain compatibility properties
    this.container = container;
    this.postsContainer = container;
    
    // Reset state if we're not using cache or don't have data yet
    if (!this.useCache || !this.postsData) {
      this.reset();
    }
    
    // Initialize UI manager
    this._uiManager = new PostUIManager(container, this._renderer);
    
    // Add retry handler
    container.addEventListener('retry-posts', () => {
      this._loadPosts();
    });
    
    // Load the first page of posts
    await this._loadPosts();
  }
  
  async _loadPosts() {
    if (this.loading) return;
    if (!this.postsContainer) return;

    this.loading = true;
    
    // Show loading state using the UI manager
    this._uiManager.showLoadingState(`Loading posts from @${this.username}...`);

    try {
      // Load the first page of posts using the loader
      const posts = await this._loader.loadPosts(this.postsPerPage, 1);
      
      // Store the loaded posts for compatibility
      this.allPosts = posts || [];
      this.postsData = this.allPosts.length > 0;
      this.currentPage = 1;
      
      // Hide the loading state
      this._uiManager.hideLoadingState();
      
      // Render the loaded posts
      this._renderLoadedPosts();
      
    } catch (error) {
      console.error('Error loading posts:', error);
      
      // Hide the loading state
      this._uiManager.hideLoadingState();
      
      // Show error using the UI manager
      this._uiManager.showError(error);
    } finally {
      this.loading = false;
    }
  }
  
  async _renderLoadedPosts() {
    if (!this.postsContainer) {
      console.warn('Cannot render posts: container not available');
      return;
    }

    try {
      // Get current grid layout from controller
      const currentLayout = this.gridController?.settings?.layout || 'grid';
      
      // Set up the layout using the UI manager
      this._uiManager.setupLayout(currentLayout);

      // Handle empty posts case
      if (!this.allPosts?.length) {
        this._uiManager.showEmptyState(this.username);
        return;
      }

      // Create posts wrapper with layout class
      const postsWrapper = this._uiManager.createPostsWrapper(currentLayout);
      
      // Render the posts using the UI manager
      this._uiManager.renderPosts(this.allPosts, postsWrapper);
      
      // Setup infinite scroll for loading more posts
      this._setupInfiniteScroll(postsWrapper);
      
      // Notify that posts are rendered
      this._uiManager.notifyPostsRendered();
      
      // Apply grid layout settings
      this._applyGridSettings();
      
    } catch (error) {
      console.error('Error rendering posts:', error);
      this._uiManager.showError(error);
    }
  }

  _setupInfiniteScroll(postsWrapper) {
    if (!postsWrapper || !this._uiManager) return;
    
    console.log(`Setting up infinite scroll with current page ${this.currentPage}`);
    
    // Setup the infinite scroll using the UI manager
    this._uiManager.setupInfiniteScroll(async (page) => {
      try {
        // Load more posts using the loader
        const newPosts = await this._loader.loadMorePosts(page);
        
        if (newPosts && newPosts.length > 0) {
          console.log(`Loaded ${newPosts.length} new posts for page ${page}`);
          
          // Update state for compatibility
          this.allPosts = [...this.allPosts, ...newPosts];
          this.currentPage = page;
          
          // Render the new posts
          this._uiManager.renderPosts(newPosts, postsWrapper);
          
          // Apply grid layout again to include new items
          setTimeout(() => {
            this.gridController.applySettings();
          }, 100);
          
          // Return if we have more posts to load
          return this._loader.hasMore();
        } else {
          console.log('No new posts loaded');
          return false;
        }
      } catch (error) {
        console.error('Error loading more posts:', error);
        return false;
      }
    }, postsWrapper, this.currentPage + 1);
  }
  
  _applyGridSettings() {
    if (!this.gridController || !this.postsContainer) return;
    
    this.gridController.target = this.postsContainer;
    
    setTimeout(() => {
      this.gridController.applySettings();
    }, 100);
  }

  setContainer(container) {
    if (container) {
      this.container = container;
      this.postsContainer = container;
    }
    return this;
  }

  reset() {
    this.loading = false;
    this.currentPage = 1;
    this.postsData = null;
    this.allPosts = [];
    this.hasMore = true;
    if (this._loader) this._loader.reset();
    return this;
  }

  refreshLayout() {
    if (this.gridLayout) {
      this.gridLayout.layout();
    }
  }

  refreshGridLayout() {
    console.log("Refreshing posts grid layout");
    
    if (!this.postsContainer) {
      console.warn("No posts container available for refresh");
      return;
    }
    
    // Always reload if we're coming back to this view
    this._loadPosts();
  }

  unmount() {
    if (this._uiManager) this._uiManager.cleanup();
    if (this.gridController) this.gridController.unmount();
  }

  getGridType() {
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }
}
