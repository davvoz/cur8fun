import View from './View.js';
import { trackOverlay } from '../utils/overlays.js';
import router from '../utils/Router.js';
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
import DialogUtility from '../components/DialogUtility.js';
import pingsService from '../services/PingsService.js';
import { fadeIn, smoothImageLoading, growFrom, resizeSmoothly } from '../utils/animateResize.js';

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
    this._contentRendererReady = this.initializeContentRenderer();
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

    this.errorMessage.style.display = 'none';
    this.showSkeleton();

    try {
      const { author, permlink } = this.params;

      // The comment and its replies at once
      const [comment, replies] = await Promise.all([
        this.steemService.getContent(author, permlink),
        this.steemService.getContentReplies(author, permlink)
      ]);

      if (!comment || comment.id === 0) {
        throw new Error('not_found');
      }

      // Pings have their own thread view (links from notifications, profiles…)
      const pingsPath = pingsService.getRedirectPath(comment);
      if (pingsPath) {
        this.hideSkeleton();
        router.navigate(pingsPath, {}, true);
        return;
      }

      this.comment = comment;
      this.replies = replies || [];

      // The parent post only gives the title of the "back" bar: the comment
      // is shown without waiting for it, the bar is filled when it arrives
      const parentLoad = comment.parent_author
        ? this.steemService.getContent(comment.parent_author, comment.parent_permlink).catch((err) => {
          console.error('Failed to load parent post:', err);
          return null;
        })
        : null;

      await this._contentRendererReady;
      // Placeholders already on screen: the card then resizes smoothly from
      // their height to the comment's (its text is the only unknown size)
      const placeholdersShown = this.placeholderParts
        && parseFloat(getComputedStyle(this.commentContent).opacity) > 0.5;
      const placeholderHeight = placeholdersShown ? this.commentContent.offsetHeight : undefined;

      // Each container's placeholder is replaced by its real content
      this.initComponents();
      await this.renderComponents();
      this.endPlaceholders();

      // What changed fades in (the bar's arrow and the card frames stay put);
      // the comment's images grow in as they load
      growFrom(this.commentContent, placeholderHeight);
      const cardContents = [
        ...this.commentContent.children,
        ...(this.repliesContainer.querySelector('.comments-section')?.children || [])
      ];
      cardContents.forEach(el => fadeIn(el));
      if (this.parentTitleEl) fadeIn(this.parentTitleEl);
      smoothImageLoading(this.element.querySelector('.comment-view'));

      parentLoad?.then((parent) => {
        if (!parent || !this.parentPostReference?.isConnected) return;
        this.parentPost = parent;
        this.updateParentPostTitle();
      });

      // Controlla lo stato di voto
      await this.voteController.checkVoteStatus(this.comment);
    } catch (error) {
      console.error('Failed to load comment:', error);
      this.hideSkeleton();

      if (error.message === 'not_found') {
        this.renderNotFoundError();
      } else {
        this.errorMessage.textContent = `Failed to load the comment: ${error.message || 'please try again later.'}`;
        this.errorMessage.style.display = 'block';
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Placeholders in the page's own containers, built with the classes of
   * the content that replaces them (back bar, comment card, replies with
   * the reply editor), so everything but the comment's text has its final
   * size and place. Static labels are shown as they are; data is drawn as
   * grey bars. They appear only if loading takes more than 300ms
   * (.page-placeholder in CSS).
   */
  showSkeleton() {
    const text = (content) => `<span class="sk-text">${content}</span>`;

    this.parentPostReference.innerHTML = `
      <div class="parent-post-link">
        <span class="material-icons">arrow_back</span>
        <span>${text('Back to the post')}</span>
      </div>`;

    // Same markup as PostHeader, PostContent, PostActions and CommentsSection
    this.commentContent.innerHTML = `
      <div class="post-headero">
        <h1 class="post-title-header">Comment</h1>
        <div class="post-meta">
          <div class="avataro">
            <img class="author-avatar sk-fill" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="><a class="author-name">${text('@author-name')}</a>
            <div class="community-placeholder"></div>
          </div>
          <div class="dataro">
            <span class="post-date">${text('15 hours ago')}</span>
            <div class="post-header-menu">
              <button type="button" class="post-header-menu-trigger" tabindex="-1">
                <span class="material-icons">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="comment-content-body">
        <p>${text('The text of the comment takes a few lines here, as a placeholder for the words that will appear once it has loaded, more or less as long as a usual comment on Steem.')}</p>
      </div>
      <div class="post-actions-post">
        <div class="upvote-container">
          <button type="button" class="action-btn upvote-btn" tabindex="-1"><span class="material-icons">thumb_up</span></button>
          <button type="button" class="vote-count-btn" tabindex="-1"><span class="count">${text('0')}</span></button>
        </div>
        <button type="button" class="action-btn comment-btn" tabindex="-1">
          <span class="material-icons">chat</span><span class="count">${text('0')}</span>
        </button>
        <div class="payout-info">${text('$0.00')}</div>
      </div>`;

    this.repliesContainer.innerHTML = `
      <div class="comments-section">
        <h3>Comments</h3>
        <form class="comment-form">
          <div class="comment-editor-mount">
            <div class="markdown-editor markdown-editor--compact sk-fill" style="min-height:178px"></div>
          </div>
          <button type="button" class="submit-comment sk-fill" tabindex="-1">${text('Post Comment')}</button>
        </form>
        <div class="comments-list">
          <div class="no-comments">${text('The replies to this comment appear here')}</div>
        </div>
      </div>`;

    this.placeholderParts = [this.parentPostReference, this.commentContent, this.repliesContainer];
    this.placeholderParts.forEach(part => {
      part.classList.add('page-placeholder');
      part.setAttribute('aria-hidden', 'true');
      part.style.display = '';
    });
  }

  // The real content is in place: the containers are no placeholders anymore
  endPlaceholders() {
    (this.placeholderParts || []).forEach(part => {
      part.classList.remove('page-placeholder');
      part.removeAttribute('aria-hidden');
    });
    this.placeholderParts = null;
    // A root post has no back bar (see initComponents)
    if (!this.comment?.parent_author) {
      this.parentPostReference.innerHTML = '';
      this.parentPostReference.style.display = 'none';
    }
  }

  // No content follows (error, or a ping opened in its own view): clear them
  hideSkeleton() {
    if (!this.placeholderParts) return;
    this.placeholderParts.forEach(part => { part.innerHTML = ''; });
    this.parentPostReference.style.display = 'none';
    this.commentContent.style.display = 'none';
    this.endPlaceholders();
  }

  initComponents() {
    if (!this.comment) return;

    // Inizializza il componente per l'header del commento (autore, data, ecc.)
    this.commentHeaderComponent = new PostHeader(
      this.comment,
      null, // Non ci sono community per i commenti
      {
        showActionsMenu: true,
        onShare: () => this.handleShare(),
        onEdit: () => this.handleEdit(),
        canEdit: this.canEditComment()
      }
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
      null,   // no reblog for comments
      this.canEditComment(),
      false,  // hasReblogged
      false,  // showReblog — comments cannot be reblogged
      false   // showShareEditInFooter — moved to header 3-dots menu
    );
    
    // Inizializza il componente per le risposte (sempre, anche se vuote, per mostrare il form)
    this.repliesSectionComponent = new CommentsSection(
      this.replies || [],
      this.comment,
      (reply, text) => this.commentController.handleReply(reply, text),
      (replyEl, voteBtn) => this.voteController.handleCommentVote(replyEl, voteBtn),
      this.contentRenderer
    );
    
    // The back bar to the parent, shown right away at its final size
    if (this.comment.parent_author) {
      this.renderParentPostReference();
    }
  }

  /**
   * Renderizza il riferimento al post padre
   */
  renderParentPostReference() {
    this.parentPostReference.innerHTML = '';
    const { parent_author: parentAuthor, parent_permlink: parentPermlink } = this.comment;
    // depth 1: a reply to a post; deeper: a reply to another comment
    const parentIsComment = this.comment.depth > 1;

    const parentPostLink = document.createElement('div');
    parentPostLink.className = 'parent-post-link';

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'arrow_back';

    // A comment's parent is named by its author; a post's title arrives with
    // the post (updateParentPostTitle), a placeholder bar keeps its place
    this.parentTitleEl = document.createElement('span');
    if (parentIsComment) {
      this.parentTitleEl.textContent = `Reply to @${parentAuthor}`;
    } else if (this.parentPost) {
      this.parentTitleEl.textContent = this.parentPost.title || 'Parent';
    } else {
      this.parentTitleEl.innerHTML = '<span class="sk-text">Loading the post title</span>';
    }

    parentPostLink.appendChild(icon);
    parentPostLink.appendChild(this.parentTitleEl);

    // Aggiungi l'evento click per navigare al post o commento padre
    parentPostLink.addEventListener('click', () => {
      router.navigate(parentIsComment
        ? `/comment/@${parentAuthor}/${parentPermlink}`
        : `/@${parentAuthor}/${parentPermlink}`);
    });

    this.parentPostReference.appendChild(parentPostLink);
    this.parentPostReference.style.display = 'block';
  }

  // The parent post's title, once loaded, in place of its placeholder
  updateParentPostTitle() {
    if (!this.parentTitleEl || this.comment.depth > 1) return;
    // A long title wraps onto more lines: the bar grows smoothly, and the
    // page below slides down instead of jumping
    resizeSmoothly(this.parentPostReference, () => {
      this.parentTitleEl.textContent = this.parentPost.title || 'Parent';
    }, { fade: this.parentTitleEl });
  }

  async renderComponents() {
    if (!this.comment) return;

    try {
      // Built off screen and swapped in together with the replies: shown
      // while the replies render, the comment would then vanish and fade in
      // again (loadComment fades everything in once this returns)
      const parts = [
        this.commentHeaderComponent.render(),
        this.commentContentComponent.render(),
        this.commentActionsComponent.render()
      ];

      // Se ci sono risposte, renderizza il componente risposte (sempre presente ora)
      const repliesElement = this.repliesSectionComponent
        ? await this.repliesSectionComponent.render()
        : null;

      this.commentContent.replaceChildren(...parts);
      if (repliesElement && repliesElement.nodeType === Node.ELEMENT_NODE) {
        this.repliesContainer.replaceChildren(repliesElement);
      }

      // Mostra il contenuto
      this.commentContent.style.display = 'block';
    } catch (error) {
      console.error('Error rendering comment components:', error);
      // Gestisci l'errore di rendering
      const errorMessage = document.createElement('div');
      errorMessage.className = 'component-render-error';
      errorMessage.textContent = 'There was an error rendering the comment components. Please try again later.';
      this.commentContent.replaceChildren(errorMessage);
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
    trackOverlay(dialog, closeDialog); // closed when leaving the page

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

      // Chiedi conferma
      const confirmed = await DialogUtility.showConfirmationDialog({
        title: 'Reblog Post',
        message: `Reblog this post by @${this.comment.author} to your blog?`,
        confirmText: 'Reblog',
        cancelText: 'Cancel',
        icon: 'repeat',
        type: 'info'
      });
      if (!confirmed) return;
      
      console.log(`Reblogging comment by ${this.comment.author}/${this.comment.permlink}`);
      
      // Usa il servizio per effettuare il reblog
      await steemService.reblogPost(currentUser.username, this.comment.author, this.comment.permlink);
      
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