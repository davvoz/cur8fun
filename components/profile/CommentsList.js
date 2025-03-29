import BasePostView from '../../views/BasePostView.js';
import CommentRenderer from '../comments/CommentRenderer.js';
import CommentLoader from '../comments/CommentLoader.js';
import CommentUIManager from '../comments/CommentUIManager.js';
import LoadingIndicator from '../LoadingIndicator.js';

export default class CommentsList extends BasePostView {
  constructor(username, useCache = false) {
    super();
    this.username = username;
    this.useCache = false; // Ignoriamo il parametro useCache, non usiamo mai la cache
    
    // Internal implementation
    this._renderer = new CommentRenderer();
    this._loader = new CommentLoader(username);
    this._uiManager = null;
    this.loadingIndicator = null;

    // Maintain original properties for compatibility
    this.commentsData = null;
    this.comments = [];
    this.allComments = [];
    this.loading = false;
    this.container = null;
    this.commentsContainer = null;
    
    // Pagination settings for rendering
    this.commentsPerPage = 20;
    this.currentPage = 1;
    this.commentCache = new Map(); // Cache temporanea solo per la sessione corrente
  }

  async render(container) {
    if (!container) return;
    
    console.log(`Rendering CommentsList for @${this.username}`);
    
    // Maintain compatibility properties
    this.container = container;
    this.commentsContainer = container;
    
    // Reset state completamente
    this.reset();
    
    // Initialize UI manager if needed
    this._uiManager = new CommentUIManager(container, this._renderer);
    
    // Add retry handler
    container.addEventListener('retry-comments', () => {
      this._loadComments();
    });
    
    // Carica sempre i commenti da zero
    await this._loadComments();
  }

  _restoreFromCache() {
    // Non ripristiniamo più dalla cache
    return false;
  }

  async _loadComments() {
    try {
      this.loading = true;
      
      // Create and show loading indicator
      if (!this.loadingIndicator) {
        this.loadingIndicator = new LoadingIndicator('spinner');
      }
      this.loadingIndicator.show(this.commentsContainer, `Loading comments from @${this.username}...`);
      
      // Carica la prima pagina di commenti
      const comments = await this._loader.loadComments(this.commentsPerPage, 1);
      
      // Hide loading indicator
      this.loadingIndicator.hide();
      
      // Aggiorna la cache locale temporanea
      this.commentCache.clear();
      comments.forEach(comment => {
        this.commentCache.set(`${comment.author}_${comment.permlink}`, comment);
      });
      
      // Set up comments data
      this.allComments = comments;
      this.commentsData = comments.length > 0;
      this.currentPage = 1;
      
      // Mostra i commenti
      this.renderLoadedComments();
      
    } catch (error) {
      // Hide loading indicator
      if (this.loadingIndicator) this.loadingIndicator.hide();
      this._uiManager.showError(error);
    } finally {
      this.loading = false;
    }
  }

  async renderLoadedComments() {
    if (!this.commentsContainer) return;
    
    try {
      // Apply current layout
      const currentLayout = this.gridController.settings.layout || 'grid';
      this._uiManager.setupLayout(currentLayout, { useCardLayout: true }); // Add card layout option
      
      // If no comments, show message
      if (!this.allComments || this.allComments.length === 0) {
        this.commentsContainer.innerHTML += `
          <div class="empty-comments-message">
            @${this.username} non ha ancora pubblicato commenti.
          </div>
        `;
        return;
      }
      
      // Create wrapper for comments
      const commentsWrapper = this._uiManager.createCommentsWrapper(currentLayout);
      commentsWrapper.classList.add('comments-grid'); // Add grid class for styling
      
      // Render initial comments with card layout option
      this._uiManager.renderComments(this.allComments, commentsWrapper);
      
      // Setup infinite scroll
      this._setupInfiniteScroll(commentsWrapper);
      
      // Apply grid layout
      this.gridController.target = this.commentsContainer;
      this.gridController.applySettings();
      
      // Dispatch event that comments are ready
      window.dispatchEvent(new CustomEvent('comments-rendered', {
        detail: { container: this.commentsContainer }
      }));
      
    } catch (error) {
      console.error('Error rendering comments:', error);
      this._uiManager.showError(error);
    }
  }

  _setupInfiniteScroll(commentsWrapper) {
    if (!this._uiManager || !commentsWrapper) return;
    
    console.log(`Setting up infinite scroll with current page ${this.currentPage}`);
    
    // Create progress bar loading indicator for infinite scroll
    const infiniteScrollLoader = new LoadingIndicator('progressBar');
    
    // Setup the infinite scroll
    this._uiManager.setupInfiniteScroll(async (page) => {
      try {
        console.log(`Loading more comments for page ${page}`);
        
        // Show loading progress
        infiniteScrollLoader.show(this.commentsContainer);
        
        // Carica più commenti tramite il loader
        const newComments = await this._loader.loadMoreComments(page);
        
        // Hide loading progress
        infiniteScrollLoader.hide();
        
        if (newComments && newComments.length > 0) {
          console.log(`Loaded ${newComments.length} new comments for page ${page}`);
          
          // Cache the new comments
          newComments.forEach(comment => {
            this.commentCache.set(`${comment.author}_${comment.permlink}`, comment);
          });
          
          // Aggiorna la pagina corrente
          this.currentPage = page;
          
          // Render the new comments
          this._uiManager.renderComments(newComments, commentsWrapper);
          
          // Apply grid layout again to include new items
          setTimeout(() => {
            this.gridController.applySettings();
          }, 100);
          
          // Ritorna se ci sono altri commenti da caricare
          const hasMore = this._loader.hasMore();
          console.log(`Has more comments: ${hasMore}`);
          return hasMore;
        } else {
          console.log('No new comments loaded');
          return false;
        }
      } catch (error) {
        console.error('Error loading more comments:', error);
        infiniteScrollLoader.hide();
        return false;
      }
    }, commentsWrapper, this.currentPage);
  }

  setContainer(container) {
    if (container) {
      this.container = container;
      this.commentsContainer = container;
    }
    return this;
  }

  reset() {
    this.loading = false;
    this.currentPage = 1;
    this.commentsData = null;
    this.allComments = [];
    if (this._loader) this._loader.reset();
    this.commentCache.clear();
    return this;
  }

  refreshLayout() {
    if (this.gridLayout) {
      this.gridLayout.layout();
    }
  }

  refreshGridLayout() {
    console.log("Refreshing comments grid layout");
    
    if (!this.commentsContainer) {
      console.warn("No comments container available for refresh");
      return;
    }
    
    // Always reload if we're coming back to this view
    this._loadComments();
  }

  unmount() {
    if (this._uiManager) this._uiManager.cleanup();
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
      this.loadingIndicator = null;
    }
    if (this.gridController) this.gridController.unmount();
  }

  getGridType() {
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }
}
