import BasePostView from '../../views/BasePostView.js';
import PostRenderer from '../posts/PostRenderer.js';
import PostLoader from '../posts/PostLoader.js';
import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../LoadingIndicator.js';
import GridController from '../GridController.js'; // Add explicit import for GridController

export default class PostsList extends BasePostView {
  constructor(username, useCache = false, mode = 'blog') {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    this.mode = mode; // 'blog' or 'posts'
    
    // Internal implementation components
    this._renderer = new PostRenderer();
    this._loader = new PostLoader(username, mode);
    
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
    
    this.container = container;

    // If we already have cached posts and the DOM structure exists, avoid a full rebuild.
    const existingPostsContainer = container.querySelector('.posts-container');
    if (this.useCache && this.posts.length > 0 && existingPostsContainer) {
      this.renderPosts();
      return;
    }

    this.container.innerHTML = '';
    
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
      await this.loadPosts(1);
    }
  }
  
  // Add method to render grid controller
  renderGridController(container) {
    if (!container || !this.gridController) return;
    
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
        
        // Show skeletons instead of spinner
        this.showPostSkeletons(6);
        
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

      return {
        hasMore,
        currentPage: this._loader.lastFetchedPage || page
      };
      
    } catch (error) {
      console.error('Error loading posts:', error);
      if (page === 1) {
        this.handleLoadError();
      }
      return {
        hasMore: false,
        currentPage: this._loader?.lastFetchedPage || page
      };
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
    
    // Start InfiniteScroll from the last raw page already consumed by PostLoader
    // so it doesn't re-request pages that were already fetched internally during the skip loop.
    const startPage = this._loader.lastFetchedPage || this.currentPage;

    console.log(`Setting up infinite scroll starting at page ${startPage}`);
    
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
          const loadResult = await this.loadPosts(page);
          
          // Hide loading progress
          this.infiniteScrollLoader.hide();
          
          const hasMore = typeof loadResult === 'object' ? !!loadResult.hasMore : !!loadResult;
          
          // Reapply grid layout when new posts arrive
          if (hasMore) {
            setTimeout(() => {
              if (this.gridController) {
                this.gridController.applySettings();
              }
            }, 100);
          }
          
          // Return the full object so InfiniteScroll can sync its page cursor
          // to lastFetchedPage (which may have jumped ahead to skip empty pages).
          return loadResult;
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
      initialPage: startPage
    });
  }
  
  renderNoPostsMessage(container) {
    // Clear skeletons and any existing content
    this.clearContainer(container);

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
   * Prepare the component for reuse on back navigation without wiping
   * the cached posts. Mirrors CommentsList.prepareForReuse.
   * @returns {PostsList}
   */
  prepareForReuse() {
    this.loading = false;
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

    const postsContainer = this.container.querySelector('.posts-container');
    if (postsContainer && this.gridController) {
      this.gridController.target = postsContainer;
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
