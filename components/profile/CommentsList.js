import BasePostView from '../../views/BasePostView.js';
import CommentRenderer from '../comments/CommentRenderer.js';
import CommentLoader from '../comments/CommentLoader.js';
import CommentUIManager from '../comments/CommentUIManager.js';
import LoadingIndicator from '../LoadingIndicator.js';
import GridController from '../GridController.js';

export default class CommentsList extends BasePostView {
  constructor(username, useCache = false) {
    super();
    this.username = username;
    this.useCache = false; // Ignoriamo il parametro useCache
    
    // Internal implementation
    this._renderer = new CommentRenderer();
    this._loader = new CommentLoader(username);
    this._uiManager = null;
    this.loadingIndicator = null;
    this.infiniteScrollLoader = null;

    // Maintain original properties for compatibility
    this.commentsData = null;
    this.comments = [];
    this.allComments = [];
    this.loading = false;
    this.container = null;
    
    // Pagination settings
    this.commentsPerPage = 20;
    this.currentPage = 1;
    this.commentCache = new Map();
    
    // IMPORTANTE: Usa un ID univoco per il container dei commenti
    this.uniqueContainerId = `comments-container-${Math.random().toString(36).substring(2, 10)}`;
    
    // Crea un grid controller con un target selector specifico per questa istanza
    this.gridController = new GridController({
      targetSelector: `#${this.uniqueContainerId} .comments-grid-content`
    });
  }

  async render(container) {
    if (!container) return;
    
    console.log(`[CommentsList] Rendering per @${this.username}`);
    
    // IMPORTANTE: Pulisci sempre il container per evitare duplicazioni
    container.innerHTML = '';
    
    // Salva il riferimento al container principale
    this.container = container;
    
    // IMPORTANTE: Struttura DOM con classi e ID univoci
    const html = `
      <div class="comments-unique-wrapper">
        <!-- Controller della griglia indipendente -->
        <div class="comments-own-grid-controller"></div>
        
        <!-- Container principale con ID univoco -->
        <div id="${this.uniqueContainerId}" class="comments-main-container">
          <!-- I commenti verranno inseriti qui -->
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Ottieni i riferimenti ai container creati
    const gridControllerContainer = container.querySelector('.comments-own-grid-controller');
    
    // Rendi il controller della griglia nel suo container dedicato
    if (gridControllerContainer && this.gridController) {
      console.log('[CommentsList] Rendering GridController in container dedicato');
      this.gridController.render(gridControllerContainer);
    }
    
    // Reset state completamente
    this.reset();
    
    // Initialize UI manager
    const commentsContainer = container.querySelector(`#${this.uniqueContainerId}`);
    this._uiManager = new CommentUIManager(commentsContainer, this._renderer);
    
    // Add retry handler
    commentsContainer.addEventListener('retry-comments', () => {
      this._loadComments();
    });
    
    // Carica commenti
    await this._loadComments();
  }

  async _loadComments() {
    try {
      this.loading = true;
      
      // Ottieni il container principale
      const commentsContainer = this.container?.querySelector(`#${this.uniqueContainerId}`);
      if (!commentsContainer) return;
      
      // Crea e mostra loading indicator
      if (!this.loadingIndicator) {
        this.loadingIndicator = new LoadingIndicator('spinner');
      }
      this.loadingIndicator.show(commentsContainer, `Loading comments from @${this.username}...`);
      
      // Carica i commenti
      const comments = await this._loader.loadComments(this.commentsPerPage, 1);
      this.loadingIndicator.hide();
      
      // Aggiorna lo stato
      this.allComments = comments;
      this.commentCache.clear();
      comments.forEach(comment => {
        this.commentCache.set(`${comment.author}_${comment.permlink}`, comment);
      });
      this.commentsData = comments.length > 0;
      this.currentPage = 1;
      
      // Renderizza i commenti
      await this.renderLoadedComments();
      
    } catch (error) {
      console.error('[CommentsList] Errore caricamento commenti:', error);
      this.loadingIndicator?.hide();
      
      const commentsContainer = this.container?.querySelector(`#${this.uniqueContainerId}`);
      if (commentsContainer && this._uiManager) {
        this._uiManager.showError(error);
      }
    } finally {
      this.loading = false;
    }
  }

  async renderLoadedComments() {
    // Ottieni il container
    const commentsContainer = this.container?.querySelector(`#${this.uniqueContainerId}`);
    if (!commentsContainer) return;
    
    try {
      // Pulisci il container
      commentsContainer.innerHTML = '';
      
      // Ottieni il layout corrente
      const currentLayout = this.gridController?.settings?.layout || 'grid';
      this._uiManager.setupLayout(currentLayout, { useCardLayout: true });
      
      // Se non ci sono commenti, mostra messaggio
      if (!this.allComments?.length) {
        this.renderNoCommentsMessage(commentsContainer);
        return;
      }
      
      // IMPORTANTE: Crea wrapper con classe che corrisponde al targetSelector
      const commentsWrapper = document.createElement('div');
      commentsWrapper.className = 'comments-grid-content'; // Deve corrispondere al targetSelector
      commentsWrapper.classList.add(`grid-layout-${currentLayout}`);
      commentsContainer.appendChild(commentsWrapper);
      
      // Renderizza i commenti
      this._uiManager.renderComments(this.allComments, commentsWrapper);
      
      // Setup infinite scroll
      this._setupInfiniteScroll(commentsWrapper);
      
      // IMPORTANTE: Non cambiare il target, usa sempre il targetSelector specificato nel costruttore
      setTimeout(() => {
        // Applica le impostazioni senza cambiare il target
        this.gridController.applySettings();
      }, 300);
      
    } catch (error) {
      console.error('[CommentsList] Error rendering comments:', error);
      this._uiManager?.showError(error);
    }
  }

  _setupInfiniteScroll(commentsWrapper) {
    if (!this._uiManager || !commentsWrapper) return;
    
    // Crea loading indicator per infinite scroll
    if (!this.infiniteScrollLoader) {
      this.infiniteScrollLoader = new LoadingIndicator('progressBar');
    }
    
    const commentsContainer = this.container?.querySelector(`#${this.uniqueContainerId}`);
    if (!commentsContainer) return;
    
    // Setup infinite scroll
    this._uiManager.setupInfiniteScroll(async (page) => {
      try {
        // Mostra loading
        this.infiniteScrollLoader.show(commentsContainer);
        
        // Carica più commenti
        const newComments = await this._loader.loadMoreComments(page);
        this.infiniteScrollLoader.hide();
        
        if (newComments?.length) {
          // Aggiorna cache e pagina corrente
          newComments.forEach(comment => {
            this.commentCache.set(`${comment.author}_${comment.permlink}`, comment);
          });
          this.currentPage = page;
          
          // Renderizza nuovi commenti
          this._uiManager.renderComments(newComments, commentsWrapper);
          
          // IMPORTANTE: Non cambiare mai il target
          setTimeout(() => {
            // Riapplica solo le impostazioni
            this.gridController.applySettings();
          }, 300);
          
          return this._loader.hasMore();
        }
        return false;
      } catch (error) {
        console.error('[CommentsList] Error loading more comments:', error);
        this.infiniteScrollLoader.hide();
        return false;
      }
    }, commentsWrapper, this.currentPage);
  }

  renderNoCommentsMessage(container) {
    const noCommentsMessage = document.createElement('div');
    noCommentsMessage.className = 'empty-comments-message';
    noCommentsMessage.innerHTML = `
      <h3>No comments found</h3>
      <p>@${this.username} hasn't published any comments yet.</p>
    `;
    container.appendChild(noCommentsMessage);
  }

  reset() {
    this.loading = false;
    this.currentPage = 1;
    this.commentsData = null;
    this.allComments = [];
    this._loader?.reset();
    this.commentCache.clear();
    return this;
  }

  refreshGridLayout() {
    console.log("[CommentsList] Refreshing grid layout");
    
    if (!this.container) return;
    
    // Reset pagination
    this.currentPage = 1;
    
    // Reload comments
    this._loadComments();
  }

  unmount() {
    this._uiManager?.cleanup();
    this.loadingIndicator?.hide();
    this.infiniteScrollLoader?.hide();
    this.gridController?.unmount();
    
    // Pulizia completa
    this.loadingIndicator = null;
    this.infiniteScrollLoader = null;
    this._uiManager = null;
  }

  forceLayoutRefresh() {
    if (!this.gridController || !this.container) return;
    
    console.log('[CommentsList] Forcing layout refresh');
    
    // Riapplica le impostazioni senza cambiare target
    setTimeout(() => {
      this.gridController.applySettings();
    }, 300);
  }
}
