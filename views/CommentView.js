import View from './View.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js'; 
import ContentRenderer from '../components/ContentRenderer.js';
import steemService from '../services/SteemService.js';
import authService from '../services/AuthService.js';

// Import components
import PostHeader from '../components/post/PostHeader.js';
import PostContent from '../components/post/PostContent.js';
import PostActions from '../components/post/PostActions.js';
import CommentsSection from '../components/post/CommentsSection.js';

// Import controllers
import VoteController from '../controllers/VoteController.js';
import CommentController from '../controllers/CommentController.js';

/**
 * Vista dedicata alla visualizzazione di un singolo commento
 * Simile a PostView ma ottimizzata per i commenti
 */
export default class CommentView extends View {
  constructor(params = {}) {
    super(params);
    this.steemService = steemService;
    this.comment = null;
    this.parentPost = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.replies = [];
    this.element = null;
    this.loadingIndicator = new LoadingIndicator('spinner');
    
    // Container elements
    this.commentContent = null;
    this.errorMessage = null;
    this.repliesContainer = null;
    
    // Component instances
    this.commentHeaderComponent = null;
    this.commentContentComponent = null;
    this.commentActionsComponent = null;
    this.repliesSectionComponent = null;
    
    // Controllers
    this.voteController = new VoteController(this);
    this.commentController = new CommentController(this);

    // Content renderer for comment body
    this.initializeContentRenderer();
  }

  async initializeContentRenderer() {
    try {
      await this.ensureSteemRendererLoaded();
      this.contentRenderer = new ContentRenderer({
        containerClass: 'comment-content-body',
        imageClass: 'comment-image',
        maxImageWidth: 800,
        useSteemContentRenderer: true,
        enableYouTube: true
      });
    } catch (err) {
      console.error('Failed to load SteemContentRenderer:', err);
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: false
      });
    }
  }

  async ensureSteemRendererLoaded() {
    if (typeof SteemContentRenderer === 'undefined') {
      try {
        await ContentRenderer.loadSteemContentRenderer();
      } catch (error) {
        console.error('Error loading SteemContentRenderer:', error);
        throw error;
      }
    }
    return SteemContentRenderer;
  }

  async render(element) {
    this.element = element;

    if (!this.element) {
      console.error('No element provided to CommentView.render()');
      return;
    }

    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    this.createCommentViewStructure();
    await this.loadComment();
  }

  createCommentViewStructure() {
    const commentView = document.createElement('div');
    commentView.className = 'comment-view';

    // Comment content container
    this.commentContent = document.createElement('div');
    this.commentContent.className = 'comment-full-content';
    this.commentContent.style.display = 'none';

    // Error message
    this.errorMessage = document.createElement('div');
    this.errorMessage.className = 'error-message';
    this.errorMessage.style.display = 'none';

    // Parent post reference
    this.parentPostReference = document.createElement('div');
    this.parentPostReference.className = 'parent-post-reference';
    this.parentPostReference.style.display = 'none';

    // Replies section
    this.repliesContainer = document.createElement('div');
    this.repliesContainer.className = 'replies-section';

    // Append all elements
    commentView.appendChild(this.parentPostReference);
    commentView.appendChild(this.commentContent);
    commentView.appendChild(this.errorMessage);
    commentView.appendChild(this.repliesContainer);

    this.element.appendChild(commentView);
  }

  async loadComment() {
    if (this.isLoading) return;
    this.isLoading = true;

    this.commentContent.style.display = 'none';
    this.errorMessage.style.display = 'none';
    this.parentPostReference.style.display = 'none';

    // Mostra l'indicatore di caricamento
    this.loadingIndicator.show(this.element, 'Caricamento commento...');

    try {
      const { author, permlink } = this.params;

      this.loadingIndicator.updateProgress(20);

      // Carica il commento e le risposte in parallelo
      const comment = await this.steemService.getContent(author, permlink);

      this.loadingIndicator.updateProgress(50);

      if (!comment || comment.id === 0) {
        throw new Error('not_found');
      }

      this.comment = comment;
      
      // Se ha un parent_author, carica anche il post padre
      if (comment.parent_author) {
        this.loadingIndicator.updateProgress(70);
        
        try {
          this.parentPost = await this.steemService.getContent(
            comment.parent_author, 
            comment.parent_permlink
          );
        } catch (err) {
          console.error('Failed to load parent post:', err);
          // Non è critico, possiamo continuare
        }
      }
      
      // Carica le risposte al commento
      this.loadingIndicator.updateProgress(80);
      this.replies = await this.steemService.getContentReplies(author, permlink);

      this.loadingIndicator.updateProgress(100);
      this.loadingIndicator.hide();

      // Inizializza e renderizza i componenti
      this.initComponents();
      await this.renderComponents();
      
      // Controlla lo stato di voto
      await this.voteController.checkVoteStatus(this.comment);
    } catch (error) {
      console.error('Failed to load comment:', error);
      this.loadingIndicator.hide();

      if (error.message === 'not_found') {
        this.renderNotFoundError();
      } else {
        this.errorMessage.textContent = `Errore nel caricamento del commento: ${error.message || 'Si è verificato un errore. Riprova più tardi.'}`;
        this.errorMessage.style.display = 'block';
      }
    } finally {
      this.isLoading = false;
    }
  }

  initComponents() {
    if (!this.comment) return;

    // Inizializza il componente per l'header del commento (autore, data, ecc.)
    this.commentHeaderComponent = new PostHeader(
      this.comment,
      null, // Non ci sono community per i commenti
      true // Indica che è un commento
    );
    
    // Inizializza il componente per il contenuto del commento
    this.commentContentComponent = new PostContent(
      this.comment, 
      this.contentRenderer,
      true // Indica che è un commento
    );
      // Inizializza il componente per le azioni del commento (voto, risposta, ecc.)
    this.commentActionsComponent = new PostActions(
      this.comment,
      () => this.voteController.handlePostVote(this.comment),
      () => this.commentController.handleNewComment(this.comment),
      () => this.handleShare(),
      () => this.handleEdit(),
      () => this.handleReblog(), // Aggiungiamo il callback per il reblog
      this.canEditComment(), // Verifica se l'utente può modificare questo commento
      false // Per ora impostiamo hasReblogged a false, aggiornare con verifica effettiva
    );
    
    // Inizializza il componente per le risposte
    if (this.replies && this.replies.length > 0) {
      this.repliesSectionComponent = new CommentsSection(
        this.replies,
        this.comment,
        (reply, text) => this.commentController.handleReply(reply, text),
        (replyEl, voteBtn) => this.voteController.handleCommentVote(replyEl, voteBtn),
        this.contentRenderer
      );
    }
    
    // Se abbiamo il post padre, crea il riferimento
    if (this.parentPost) {
      this.renderParentPostReference();
    }
  }

  /**
   * Renderizza il riferimento al post padre
   */
  renderParentPostReference() {
    this.parentPostReference.innerHTML = '';
    
    const parentPostLink = document.createElement('div');
    parentPostLink.className = 'parent-post-link';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'arrow_back';
    
    const linkText = document.createElement('span');
    linkText.textContent = this.parentPost.title || 'Parent';
    
    parentPostLink.appendChild(icon);
    parentPostLink.appendChild(linkText);
    
    // Aggiungi l'evento click per navigare al post o commento padre
    parentPostLink.addEventListener('click', () => {
      // Verifica se il parent è un commento (ha parent_author) o un post
      if (this.parentPost.parent_author && this.parentPost.parent_author !== '') {
        // È un commento, naviga alla CommentView
        router.navigate(`/comment/@${this.parentPost.author}/${this.parentPost.permlink}`);
      } else {
        // È un post, naviga alla PostView
        router.navigate(`/@${this.parentPost.author}/${this.parentPost.permlink}`);
      }
    });
    
    this.parentPostReference.appendChild(parentPostLink);
    this.parentPostReference.style.display = 'block';
  }

  async renderComponents() {
    if (!this.comment) return;
    
    // Pulisci il contenitore prima di aggiungere nuovi componenti
    while (this.commentContent.firstChild) {
      this.commentContent.removeChild(this.commentContent.firstChild);
    }

    try {
      // Aggiungi i componenti sincronizzati
      this.commentContent.appendChild(this.commentHeaderComponent.render());
      this.commentContent.appendChild(this.commentContentComponent.render());
      this.commentContent.appendChild(this.commentActionsComponent.render());
      
      // Se ci sono risposte, renderizza il componente risposte
      if (this.repliesSectionComponent) {
        const repliesElement = await this.repliesSectionComponent.render();
        
        if (repliesElement && repliesElement.nodeType === Node.ELEMENT_NODE) {
          this.repliesContainer.appendChild(repliesElement);
        }
      } else {
        // Se non ci sono risposte, mostra un messaggio
        this.repliesContainer.innerHTML = '<div class="no-replies">No replies yet.</div>';
      }

      // Mostra il contenuto
      this.commentContent.style.display = 'block';
    } catch (error) {
      console.error('Error rendering comment components:', error);
      // Gestisci l'errore di rendering
      const errorMessage = document.createElement('div');
      errorMessage.className = 'component-render-error';
      errorMessage.textContent = 'There was an error rendering the comment components. Please try again later.';
      this.commentContent.appendChild(errorMessage);
      this.commentContent.style.display = 'block';
    }
  }

  /**
   * Verifica se l'utente può modificare il commento
   */
  canEditComment() {
    const currentUser = authService.getCurrentUser();
    return currentUser && currentUser.username === this.comment.author;
  }

  /**
   * Gestisce il pulsante di modifica
   */
  handleEdit() {
    // Verifica che l'utente possa modificare il commento
    if (!this.canEditComment()) {
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'Only the author can edit this comment.'
      });
      return;
    }
    
    // Prima di procedere, controlla se l'utente ha una posting key valida
    const user = authService.getCurrentUser();
    
    // Per utenti Keychain, non è necessario verificare la scadenza
    if (user?.loginMethod !== 'keychain') {
      // Verifica scadenza della posting key
      const keyExpiry = localStorage.getItem(`${user.username}_posting_key_expiry`);
      if (keyExpiry && parseInt(keyExpiry) < Date.now()) {
        // La chiave è scaduta, rimuovila dallo storage
        localStorage.removeItem(`${user.username}_posting_key`);
        localStorage.removeItem(`${user.username}_posting_key_expiry`);
        
        // Mostra il dialog di errore per la posting key scaduta
        this.showPostingErrorDialog();
        return;
      }
    }
    
    // Avvia la modifica del commento
    if (this.commentController) {
      this.commentController.handleEditComment(this.comment);
    } else {
      console.error('CommentController not available or handleEditComment method not found');
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'There was an error starting the edit process.'
      });
    }
  }
  
  /**
   * Mostra un dialog per posting key scaduta
   */
  showPostingErrorDialog() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'posting-error-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'posting-error-dialog';
    dialog.style.left = '50%';
    dialog.style.top = '50%';

    // Create dialog content
    const title = document.createElement('h3');
    title.className = 'posting-error-dialog-title';
    title.textContent = 'Session Expired';

    // Add icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'posting-error-icon';
    iconContainer.innerHTML = '<span class="material-icons">info</span>';

    // Add message
    const messageEl = document.createElement('p');
    messageEl.className = 'posting-error-message';
    messageEl.innerHTML = 'Your login session has expired for security reasons.<br>This helps keep your account safe by requiring periodic re-authentication.';

    // Add additional explanation
    const explainEl = document.createElement('p');
    explainEl.className = 'posting-error-explanation';
    explainEl.textContent = 'Please log in again to continue posting your comment.';

    // Add login button
    const loginBtn = document.createElement('button');
    loginBtn.className = 'posting-error-login-btn';
    loginBtn.textContent = 'Login Again';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'posting-error-close-btn';
    closeBtn.textContent = 'Close';

    // Store current URL to return after login
    const returnUrl = window.location.pathname + window.location.search;

    // Login function
    const goToLogin = () => {
      closeDialog();
      setTimeout(() => {
        router.navigate('/login', { returnUrl });
      }, 100);
    };

    // Close dialog function
    const closeDialog = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
    };

    // Add event listeners
    loginBtn.addEventListener('click', goToLogin);
    closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', closeDialog);

    // Add elements to dialog
    dialog.appendChild(title);
    dialog.appendChild(iconContainer);
    dialog.appendChild(messageEl);
    dialog.appendChild(explainEl);
    dialog.appendChild(loginBtn);
    dialog.appendChild(closeBtn);

    // Add to body
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    // Also emit a regular notification
    eventEmitter.emit('notification', {
      type: 'info',
      message: 'Your session has expired. Please login again to continue.'
    });
  }

  /**
   * Gestisce la condivisione del commento
   */
  handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: 'Post by ' + this.comment.author,
        text: `Read this post by @${this.comment.author}`,
        url: url
      }).catch(err => console.error('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.emit('notification', {
          type: 'success',
          message: 'Link copied to clipboard'
        });
      }).catch(err => console.error('Could not copy link:', err));
    }
  }

  /**
   * Gestisci il reblog del commento
   */
  async handleReblog() {
    try {
      // Verifica che l'utente sia loggato
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        this.emit('notification', {
          type: 'info',
          message: 'Devi essere loggato per rebloggare un commento'
        });
        router.navigate('/login');
        return;
      }
      
      console.log(`Reblogging comment by ${this.comment.author}/${this.comment.permlink}`);
      
      // Usa il servizio per effettuare il reblog
      await steemService.reblogPost(currentUser.username, this.comment.author, this.comment.permlink);
      
      // Notifica l'utente del successo
      this.emit('notification', {
        type: 'success',
        message: 'Commento rebloggato con successo!'
      });
    } catch (error) {
      console.error('Error reblogging comment:', error);
      this.emit('notification', {
        type: 'error',
        message: error.message || 'Errore durante il reblog del commento'
      });
    }
  }

  /**
   * Renderizza un errore 404 quando il commento non viene trovato
   */
  renderNotFoundError() {
    while (this.errorMessage.firstChild) {
      this.errorMessage.removeChild(this.errorMessage.firstChild);
    }

    this.errorMessage.className = 'error-message not-found-error';

    const errorContainer = document.createElement('div');
    errorContainer.className = 'not-found-container';

    const errorCode = document.createElement('h1');
    errorCode.className = 'error-code';
    errorCode.textContent = '404';

    const errorHeading = document.createElement('h2');
    errorHeading.textContent = 'Commento non trovato';

    const errorDesc = document.createElement('p');
    errorDesc.className = 'error-description';
    errorDesc.textContent = `Non è stato possibile trovare il commento di @${this.params.author}/${this.params.permlink}`;

    const homeButton = document.createElement('button');
    homeButton.className = 'back-to-home-btn';
    homeButton.textContent = 'Torna alla Home';
    homeButton.addEventListener('click', () => {
      router.navigate('/');
    });

    errorContainer.appendChild(errorCode);
    errorContainer.appendChild(errorHeading);
    errorContainer.appendChild(errorDesc);
    errorContainer.appendChild(homeButton);

    this.errorMessage.appendChild(errorContainer);
    this.errorMessage.style.display = 'block';
  }

  /**
   * Pulisce le risorse quando la vista viene smontata
   */
  unmount() {
    super.unmount();
    
    // Smonta tutti i componenti
    const components = [
      this.commentHeaderComponent,
      this.commentContentComponent,
      this.commentActionsComponent,
      this.repliesSectionComponent
    ];
    
    components.forEach(component => {
      if (component && typeof component.unmount === 'function') {
        component.unmount();
      }
    });
    
    // Pulisci i controller
    this.voteController.cleanup();
    this.commentController.cleanup();
    
    // Pulisci i riferimenti
    this.commentHeaderComponent = null;
    this.commentContentComponent = null;
    this.commentActionsComponent = null;
    this.repliesSectionComponent = null;
    this.voteController = null;
    this.commentController = null;
  }
}