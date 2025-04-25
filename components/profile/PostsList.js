import BasePostView from '../../views/BasePostView.js';
import PostRenderer from '../posts/PostRenderer.js';
import PostLoader from '../posts/PostLoader.js';
import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../LoadingIndicator.js';
import GridController from '../GridController.js'; // Add explicit import for GridController

export default class PostsList extends BasePostView {
  constructor(username, useCache = false) {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    
    // Internal implementation components
    this._renderer = new PostRenderer();
    this._loader = new PostLoader(username);
    
    // State management using BasePostView's approach
    this.posts = [];
    this.loading = false;
    
    // Pagination settings
    this.currentPage = 1;

    // Add a specific loading indicator for infinite scroll
    this.infiniteScrollLoader = null;
    
    // Explicitly initialize the grid controller if not already done by BasePostView
    if (!this.gridController) {
      this.gridController = new GridController({
        targetSelector: '.posts-container'
      });
    }
  }

  async render(container) {
    if (!container) return;
    
    console.log(`Rendering PostsList for @${this.username}, useCache: ${this.useCache}`);
    
    // Store container reference
    this.container = container;
    
    // Create grid controller container
    const gridControllerContainer = document.createElement('div');
    gridControllerContainer.className = 'grid-controller-container';
    
    // Create posts container
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';
    
    // Add elements directly to the main container
    container.appendChild(gridControllerContainer);
    container.appendChild(postsContainer);
    
    // Explicitly render the grid controller
    this.renderGridController(gridControllerContainer);
    
    // If we already have posts (from cache) and useCache is enabled, render them
    if (this.useCache && this.posts.length > 0) {
      this.renderPosts();
    } else {
      // Otherwise load posts fresh
      this.loadPosts(1);
    }
  }
  
  // Add method to render grid controller
  renderGridController(container) {
    if (!container || !this.gridController) return;
    
    console.log('Rendering grid controller for posts list');
    this.gridController.render(container);
    
    // Set target explicitly to ensure it works correctly
    setTimeout(() => {
      const postsContainer = this.container?.querySelector('.posts-container');
      if (postsContainer) {
        this.gridController.target = postsContainer;
        this.gridController.applySettings();
      }
    }, 100);
  }
  
  async loadPosts(page = 1) {
    if (this.loading) return false;
    
    try {
      this.loading = true;
      
      if (page === 1) {
        // Reset for first page load
        this.posts = [];
        this.renderedPostIds.clear();
        this.currentPage = 1;
        
        // Show loading indicator
        this.loadingIndicator.show(this.container?.querySelector('.posts-container'));
        
        // Reset infinite scroll if it exists
        if (this.infiniteScroll) {
          this.infiniteScroll.reset(1);
        }
      }
      
      console.log(`Loading posts for user: ${this.username}, page: ${page}`);
      const posts = await this._loader.loadPosts(20, page);
      
      if (Array.isArray(posts) && posts.length > 0) {
        // Filter out duplicates like TagView does
        const uniquePosts = posts.filter(post => {
          const postId = `${post.author}_${post.permlink}`;
          return !this.renderedPostIds.has(postId);
        });
        
        if (uniquePosts.length > 0) {
          // Add to the posts array
          this.posts = [...this.posts, ...uniquePosts];
          
          // Render the posts
          this.renderPosts(page > 1);
          
          // Set up infinite scroll after first page load
          if (page === 1) {
            this._setupInfiniteScroll();
          }
        } else {
          console.log('No new unique posts in this batch.');
        }
      } else if (page === 1) {
        // Show empty state on first page if no posts
        const postsContainer = this.container?.querySelector('.posts-container');
        if (postsContainer) {
          this.renderNoPostsMessage(postsContainer);
        }
      }
      
      // Make sure to return whether there are more posts to load
      const hasMore = this._loader.hasMore();
      console.log(`Has more posts: ${hasMore}, current page: ${page}`);
      return hasMore;
      
    } catch (error) {
      console.error('Error loading posts:', error);
      if (page === 1) {
        this.handleLoadError();
      }
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }
  
  _setupInfiniteScroll() {
    if (!this.container) return;
    
    // Get the posts container
    const postsContainer = this.container.querySelector('.posts-container');
    if (!postsContainer) {
      console.warn('No posts container found for infinite scroll setup');
      return;
    }
    
    console.log(`Setting up infinite scroll with current page ${this.currentPage}`);
    
    // Create a dedicated loading indicator for infinite scroll
    if (!this.infiniteScrollLoader) {
      this.infiniteScrollLoader = new LoadingIndicator('progressBar');
    }
    
    // Destroy any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }
    
    // Set up the infinite scroll handler similar to CommentsList
    this.infiniteScroll = new InfiniteScroll({
      container: postsContainer,
      loadMore: async (page) => {
        try {
          console.log(`Loading more posts for page ${page}`);
          
          // Show loading progress
          this.infiniteScrollLoader.show(postsContainer);
          
          // Load the next page of posts
          const hasMore = await this.loadPosts(page);
          
          // Hide loading progress
          this.infiniteScrollLoader.hide();
          
          // Update current page if we have more posts
          if (hasMore) {
            this.currentPage = page;
            
            // If grid controller exists, reapply layout
            setTimeout(() => {
              if (this.gridController) {
                this.gridController.applySettings();
              }
            }, 100);
          }
          
          return hasMore;
        } catch (error) {
          console.error('Error loading more posts:', error);
          this.infiniteScrollLoader.hide();
          return false;
        }
      },
      threshold: '200px',
      loadingMessage: `Loading more posts from @${this.username}...`,
      endMessage: `No more posts from @${this.username}`,
      errorMessage: 'Failed to load posts. Please check your connection.',
      startPage: this.currentPage
    });
  }
  
  renderNoPostsMessage(container) {
    // Rimuovi eventuali messaggi esistenti
    const existingMessage = container.querySelector('.no-posts-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Crea e aggiungi il nuovo messaggio
    const noPostsMessage = document.createElement('div');
    noPostsMessage.className = 'no-posts-message';
    noPostsMessage.innerHTML = `
      <h3>No posts found</h3>
      <p>@${this.username} hasn't published any posts yet.</p>
    `;
    container.appendChild(noPostsMessage);
  }
  
  // Get current tag (username) for tag selection bar
  getCurrentTag() {
    return this.username || '';
  }

  /**
   * Set the container for rendering - needed for compatibility with ProfileView
   * @param {HTMLElement} container - The container element
   * @returns {PostsList} - Returns this instance for chaining
   */
  setContainer(container) {
    if (container) {
      // Store the container for future reference
      this.container = container;
      
      // If we haven't rendered yet and the container is provided,
      // call render to initialize the view
      if (container.childElementCount === 0) {
        this.render(container);
      }
    }
    return this;
  }
  
  /**
   * Reset the component state - needed for compatibility with ProfileView
   * @returns {PostsList} - Returns this instance for chaining
   */
  reset() {
    this.posts = [];
    this.loading = false;
    this.currentPage = 1;
    this.renderedPostIds.clear();
    
    if (this._loader) this._loader.reset();
    if (this.infiniteScroll) this.infiniteScroll.reset(1);
    if (this.infiniteScrollLoader) {
      this.infiniteScrollLoader.hide();
    }
    
    return this;
  }
  
  /**
   * Refresh the grid layout - needed for compatibility with ProfileView
   */
  refreshGridLayout() {
    console.log("Refreshing posts grid layout");
    if (!this.container) {
      console.warn("No posts container available for refresh");
      return;
    }
    
    // Reset current page before reloading
    this.currentPage = 1;
    // Reload posts when called
    this.loadPosts(1);
    
    // Make sure grid controller settings are applied
    if (this.gridController) {
      this.gridController.applySettings();
    }
  }
  
  /**
   * Clean up resources when component is unmounted
   */
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }
    if (this.infiniteScrollLoader) {
      this.infiniteScrollLoader.hide();
    }
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    if (this.gridController) {
      this.gridController.unmount();
    }
  }
}
