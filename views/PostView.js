import View from './View.js';
import steemService from '../services/SteemService.js'; // Changed from SteemService to steemService
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js'; // Import LoadingIndicator
import ContentRenderer from '../components/ContentRenderer.js';
import imageService from '../services/ImageService.js'; // Sostituisci ImageUtils con imageService
import voteService from '../services/VoteService.js';
import authService from '../services/AuthService.js'; // Aggiungi questa importazione
import commentService from '../services/CommentService.js';
// Remove animation-init.js import

class PostView extends View {
  constructor(params = {}) {
    super(params);
    this.steemService = steemService; // Use the imported instance directly instead of constructing a new one
    this.post = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.comments = [];
    this.element = null; // Initialize element as null
    this.loadingIndicator = null; // Will hold the LoadingIndicator instance

    // Ensure SteemContentRenderer is loaded before initializing ContentRenderer
    this.ensureSteemRendererLoaded().then(() => {
      // Initialize ContentRenderer with post-specific options
      this.contentRenderer = new ContentRenderer({
        containerClass: 'post-content-body',
        imageClass: 'post-image',
        imagePosition: 'top',
        useProcessBody: false, // Use SteemContentRenderer instead
        useSteemContentRenderer: true,
        maxImageWidth: 800,
        enableYouTube: true
      });
    }).catch(err => {
      console.error('Failed to load SteemContentRenderer:', err);
      // Initialize with fallback options
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: false
      });
    });

    // Dictionary of regex patterns for content processing
    this.contentRegexPatterns = {
      discordImages: /https:\/\/media\.discordapp\.net\/attachments\/[\w\/\-\.]+\.(jpg|jpeg|png|gif|webp)/gi,
      // Add more regex patterns as needed for other content types
    };
  }

  /**
   * Ensure the SteemContentRenderer library is loaded
   */
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
    // Store the element for future reference
    this.element = element;

    // Make sure we have an element before proceeding
    if (!this.element) {
      console.error('No element provided to PostView.render()');
      return;
    }

    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    const postView = document.createElement('div');
    postView.className = 'post-view';

    // Create a loading container instead of a direct loading indicator
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';

    // Post content container
    const postContent = document.createElement('div');
    postContent.className = 'post-content';
    postContent.style.display = 'none';

    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';

    // Comments section
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';

    // Append all elements
    postView.appendChild(loadingContainer);
    postView.appendChild(postContent);
    postView.appendChild(errorMessage);
    postView.appendChild(commentsSection);

    this.element.appendChild(postView);

    this.loadingContainer = loadingContainer;
    this.postContent = postContent;
    this.errorMessage = errorMessage;
    this.commentsContainer = commentsSection;

    // Initialize the LoadingIndicator but don't show it yet
    this.loadingIndicator = new LoadingIndicator('spinner');

    await this.loadPost();
  }

  async loadPost() {
    if (this.isLoading) return;

    this.isLoading = true;

    // Show the loading indicator with custom message
    this.loadingIndicator.show(this.loadingContainer, 'Loading post...');

    this.postContent.style.display = 'none';
    this.errorMessage.style.display = 'none';

    try {
      const { author, permlink } = this.params;

      // Update progress to show we're starting the request
      this.loadingIndicator.updateProgress(20);

      const [post, replies] = await Promise.all([
        this.steemService.getContent(author, permlink),
        this.steemService.getContentReplies(author, permlink)
      ]);

      // Update progress to show we received the data
      this.loadingIndicator.updateProgress(80);

      if (!post || post.id === 0) {
        throw new Error('not_found');
      }

      this.post = post;
      this.comments = replies || [];

      // Final progress update
      this.loadingIndicator.updateProgress(100);

      // Render the post content (this already handles the HTML insertion)
      this.renderPost();
      
      // Controlla lo stato di voto
      await this.checkVoteStatus();
      
      // Remove initialization of animation controls
    } catch (error) {
      console.error('Failed to load post:', error);

      if (error.message === 'not_found') {
        this.renderNotFoundError();
      } else {
        this.errorMessage.textContent = `Failed to load post: ${error.message || 'Failed to load post. Please try again later.'}`;
        this.errorMessage.style.display = 'block';
      }
    } finally {
      this.isLoading = false;

      // Hide the loading indicator
      this.loadingIndicator.hide();
    }
  }

  renderNotFoundError() {
    // Clear the existing error message container
    while (this.errorMessage.firstChild) {
      this.errorMessage.removeChild(this.errorMessage.firstChild);
    }

    this.errorMessage.className = 'error-message not-found-error';

    // Create error container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'not-found-container';

    // Error code
    const errorCode = document.createElement('h1');
    errorCode.className = 'error-code';
    errorCode.textContent = '404';

    // Error heading
    const errorHeading = document.createElement('h2');
    errorHeading.textContent = 'Post Not Found';

    // Error description
    const errorDesc = document.createElement('p');
    errorDesc.className = 'error-description';
    errorDesc.textContent = `We couldn't find the post at @${this.params.author}/${this.params.permlink}`;

    // Home button
    const homeButton = document.createElement('button');
    homeButton.className = 'back-to-home-btn';
    homeButton.textContent = 'Back to Home';
    homeButton.addEventListener('click', () => {
      router.navigate('/');
    });

    // Assemble the error container
    errorContainer.appendChild(errorCode);
    errorContainer.appendChild(errorHeading);
    errorContainer.appendChild(errorDesc);
    errorContainer.appendChild(homeButton);

    this.errorMessage.appendChild(errorContainer);
    this.errorMessage.style.display = 'block';

  }


  renderPost() {
    if (!this.post) return;

    const getPendingPayout = (post) => {
      const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
      const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
      const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
      return (pending + total + curator).toFixed(2);
    };

    // Clear existing content
    while (this.postContent.firstChild) {
      this.postContent.removeChild(this.postContent.firstChild);
    }

    // Create header
    const postHeader = document.createElement('div');
    postHeader.className = 'post-headero';

    // Back button removed

    const postTitle = document.createElement('h1');
    postTitle.className = 'post-title';
    postTitle.textContent = this.post.title || 'Untitled';

    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';

    // First container for avatar and author name
    const avataro = document.createElement('div');
    avataro.className = 'avataro';

    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar';
    authorAvatar.src = `https://steemitimages.com/u/${this.post.author}/avatar`;
    authorAvatar.alt = this.post.author;

    const authorName = document.createElement('a');
    // Use click event handler instead of href for more reliable routing
    authorName.href = "javascript:void(0)";
    authorName.className = 'author-name';
    authorName.textContent = `@${this.post.author}`;
    authorName.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(`/@${this.post.author}`);
    });

    avataro.appendChild(authorAvatar);
    avataro.appendChild(authorName);

    // Second container for date
    const dataro = document.createElement('div');
    dataro.className = 'dataro';

    const postDate = document.createElement('span');
    postDate.className = 'post-date';
    postDate.textContent = new Date(this.post.created).toLocaleString();

    dataro.appendChild(postDate);

    // Add both containers to post meta
    postMeta.appendChild(avataro);
    postMeta.appendChild(dataro);

    postHeader.appendChild(postTitle);
    postHeader.appendChild(postMeta);

    // Add header first to ensure it's at the top
    this.postContent.appendChild(postHeader);

    // Use ContentRenderer for post body with SteemContentRenderer integration
    if (!this.contentRenderer) {
      // If contentRenderer is not initialized yet, create it now
      this.contentRenderer = new ContentRenderer({
        containerClass: 'post-content-body',
        imageClass: 'post-image',
        useSteemContentRenderer: true
      });
    }

    // Render the post content using Steem Content Renderer
    const renderedContent = this.contentRenderer.render({
      title: this.post.title,
      body: this.post.body
    });

    // Append rendered content
    this.postContent.appendChild(renderedContent.container);

    // Create actions
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';

    const upvoteBtn = this.createActionButton('upvote-btn', 'thumb_up', this.post.net_votes || 0);
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', 'share', 'Share');

    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${getPendingPayout(this.post)}`;

    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    postActions.appendChild(shareBtn);
    postActions.appendChild(payoutInfo);

    // Create comments section
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';

    const commentsHeader = document.createElement('h3');
    commentsHeader.textContent = `Comments (${this.comments.length})`;

    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write a comment...';

    const submitButton = document.createElement('button');
    submitButton.className = 'submit-comment';
    submitButton.textContent = 'Post Comment';

    commentForm.appendChild(textarea);
    commentForm.appendChild(submitButton);

    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';

    commentsSection.appendChild(commentsHeader);
    commentsSection.appendChild(commentForm);
    commentsSection.appendChild(commentsList);

    // Append remaining elements to post content
    this.postContent.appendChild(postActions);
    this.postContent.appendChild(commentsSection);

    this.postContent.style.display = 'block';

    upvoteBtn.addEventListener('click', () => this.handleUpvote());
    submitButton.addEventListener('click', () => this.handleComment());
    shareBtn.addEventListener('click', () => this.handleShare());

    // Render comments
    this.renderComments();
  }

  createActionButton(className, icon, countOrText) {
    const button = document.createElement('button');
    button.className = `action-btn ${className}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);

    const countSpan = document.createElement('span');
    if (typeof countOrText === 'number') {
      countSpan.className = 'count';
      countSpan.textContent = countOrText;
    } else {
      countSpan.textContent = countOrText;
    }
    button.appendChild(countSpan);

    return button;
  }

  renderComments() {
    if (!Array.isArray(this.comments)) {
      this.comments = [];
    }

    const commentsContainer = this.postContent.querySelector('.comments-list');

    // Clear existing comments
    while (commentsContainer.firstChild) {
      commentsContainer.removeChild(commentsContainer.firstChild);
    }

    if (!this.comments || this.comments.length === 0) {
      const noComments = document.createElement('div');
      noComments.className = 'no-comments';
      noComments.textContent = 'No comments yet. Be the first to comment!';
      commentsContainer.appendChild(noComments);
      return;
    }

    // Build comment tree
    const commentTree = this.buildCommentTree(this.comments);

    // Render the comment tree
    commentTree.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      commentsContainer.appendChild(commentElement);
    });
  }

  // Helper method to build comment tree
  buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: Create map of all comments
    comments.forEach(comment => {
      comment.children = [];
      commentMap.set(comment.permlink, comment);
    });

    // Second pass: Build tree structure
    comments.forEach(comment => {
      const parentPermlink = comment.parent_permlink;
      if (parentPermlink === this.params.permlink) {
        // This is a root level comment
        rootComments.push(comment);
      } else {
        // This is a reply
        const parentComment = commentMap.get(parentPermlink);
        if (parentComment) {
          parentComment.children.push(comment);
        }
      }
    });

    return rootComments;
  }

  createCommentElement(comment, depth = 0) {
    const MAX_DEPTH = 6;
    const currentDepth = Math.min(depth, MAX_DEPTH);

    const commentDiv = document.createElement('div');
    commentDiv.className = `comment depth-${currentDepth}`;

    // Add data attributes to help with debugging
    commentDiv.dataset.author = comment.author;
    commentDiv.dataset.permlink = comment.permlink;
    commentDiv.dataset.depth = currentDepth;

    // Comment header
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-headero';

    // First container for avatar and author name
    const authorContainer = document.createElement('div');
    authorContainer.className = 'author-container';

    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar small';
    authorAvatar.src = `https://steemitimages.com/u/${comment.author}/avatar`;
    authorAvatar.alt = comment.author;

    const authorName = document.createElement('a');
    // Use click event handler instead of href for more reliable routing
    authorName.href = "javascript:void(0)";
    authorName.className = 'author-name';
    authorName.textContent = `@${comment.author}`;
    authorName.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(`/@${comment.author}`);
    });

    authorContainer.appendChild(authorAvatar);
    authorContainer.appendChild(authorName);

    // Second container for date
    const dateContainer = document.createElement('div');
    dateContainer.className = 'date-container';

    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    commentDate.textContent = new Date(comment.created).toLocaleString();

    dateContainer.appendChild(commentDate);

    // Add both containers to the header
    commentHeader.appendChild(authorContainer);
    commentHeader.appendChild(dateContainer);

    // Comment body - Use ContentRenderer instead of process_body.js
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';

    const commentRenderer = new ContentRenderer({
      containerClass: 'comment-content',
      imageClass: 'comment-image',
      useProcessBody: false // Make sure this is false
    });

    const renderedComment = commentRenderer.render({
      body: comment.body
    });

    commentBody.appendChild(renderedComment.container);

    // Comment actions
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';

    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'action-btn upvote-btn small';
    const upvoteIcon = document.createElement('span');
    upvoteIcon.className = 'material-icons';
    upvoteIcon.textContent = 'thumb_up';
    const upvoteCount = document.createElement('span');
    upvoteCount.className = 'count';
    upvoteCount.textContent = comment.net_votes || 0;
    upvoteBtn.appendChild(upvoteIcon);
    upvoteBtn.appendChild(upvoteCount);

    const replyBtn = document.createElement('button');
    replyBtn.className = 'action-btn reply-btn small';
    replyBtn.textContent = 'Reply';

    commentActions.appendChild(upvoteBtn);
    commentActions.appendChild(replyBtn);

    // Reply form
    const replyForm = document.createElement('div');
    replyForm.className = 'reply-form';
    replyForm.style.display = 'none';

    const replyTextarea = document.createElement('textarea');
    replyTextarea.placeholder = 'Write a reply...';

    const submitReplyBtn = document.createElement('button');
    submitReplyBtn.className = 'submit-reply';
    submitReplyBtn.textContent = 'Post Reply';

    replyForm.appendChild(replyTextarea);
    replyForm.appendChild(submitReplyBtn);

    // Append all to comment div
    commentDiv.appendChild(commentHeader);
    commentDiv.appendChild(commentBody);
    commentDiv.appendChild(commentActions);
    commentDiv.appendChild(replyForm);

    // Add reply button handler
    replyBtn.addEventListener('click', () => {
      replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
    });

    // Add submit reply handler
    submitReplyBtn.addEventListener('click', () => {
      const replyText = replyTextarea.value;
      if (replyText.trim()) {
        this.handleReply(comment, replyText);
      }
    });

    // Render child comments with enhanced visibility
    if (comment.children && comment.children.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = `replies depth-${currentDepth}`;

      // Add comment count indicator
      const repliesCount = document.createElement('div');
      repliesCount.className = 'replies-count';
      repliesCount.textContent = `${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}`;
      repliesContainer.appendChild(repliesCount);

      // Add visual indicator for nested comments
      const threadLine = document.createElement('div');
      threadLine.className = 'thread-line';
      repliesContainer.appendChild(threadLine);

      // Make sure replies are clearly visible
      const repliesWrapper = document.createElement('div');
      repliesWrapper.className = 'replies-wrapper';

      comment.children.forEach(reply => {
        const replyElement = this.createCommentElement(reply, depth + 1);
        repliesWrapper.appendChild(replyElement);
      });

      repliesContainer.appendChild(repliesWrapper);
      commentDiv.appendChild(repliesContainer);
    }

    // Add upvote button handler
    upvoteBtn.addEventListener('click', () => this.handleCommentVote(commentDiv, upvoteBtn));

    // Controlla se l'utente ha già votato questo commento
    voteService.hasVoted(comment.author, comment.permlink)
      .then(existingVote => {
        if (existingVote) {
          // Imposta lo stato votato
          upvoteBtn.classList.add('voted');
          
          // Aggiungi l'icona piena invece di quella vuota
          const iconElement = upvoteBtn.querySelector('.material-icons');
          if (iconElement) {
            iconElement.textContent = 'thumb_up_alt';
          }
          
          // Aggiungi indicatore di percentuale se è > 0
          if (existingVote.percent > 0) {
            const percentIndicator = document.createElement('span');
            percentIndicator.className = 'vote-percent-indicator';
            percentIndicator.textContent = `${existingVote.percent / 100}%`;
            upvoteBtn.appendChild(percentIndicator);
          }
        }
      })
      .catch(err => {
        console.log('Error checking vote status for comment', err);
      });

    return commentDiv;
  }

/**
 * Gestisce il voto sul post
 */
async handleUpvote() {
  const upvoteBtn = this.element.querySelector('.upvote-btn');
  const countElement = upvoteBtn.querySelector('.count');
  
  // Check if user is logged in
  const user = authService.getCurrentUser();
  if (!user) {
    this.emit('notification', { 
      type: 'error', 
      message: 'You need to log in to vote'
    });
    router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
    return;
  }
  
  // Controlla se l'utente ha già votato
  try {
    const existingVote = await voteService.hasVoted(this.post.author, this.post.permlink);
    if (existingVote) {
      // Se l'utente ha già votato, mostra un messaggio informativo
      const currentPercent = existingVote.percent / 100;
      this.emit('notification', { 
        type: 'info', 
        message: `You've already voted on this post (${currentPercent}%)`
      });
      return;
    }
  } catch (error) {
    console.log('Error checking vote status:', error);
    // Continua anche se non riusciamo a verificare il voto esistente
  }
  
  // Mostra il popup con slider per la percentuale
  this.showVotePercentagePopup(upvoteBtn, async (weight) => {
    try {
      // Disabilita il pulsante durante il voto
      upvoteBtn.disabled = true;
      upvoteBtn.classList.add('voting');
      
      // Mostra feedback visivo
      const originalContent = upvoteBtn.innerHTML;
      upvoteBtn.innerHTML = `
        <span class="material-icons loading">refresh</span>
        <span>Voting ${weight/100}%...</span>
      `;
      
      // Verifica se il peso è 0 (downvote)
      if (weight === 0) {
        throw new Error('Vote weight cannot be zero');
      }
      
      // Usa il servizio dedicato per votare con il peso scelto
      const result = await voteService.vote({
        author: this.post.author,
        permlink: this.post.permlink,
        weight: weight
      });
      
      // Aggiorna il contatore dei voti
      const currentCount = parseInt(countElement?.textContent) || 0;
      
      // Ripristina il pulsante con lo stato votato
      upvoteBtn.disabled = false;
      upvoteBtn.classList.remove('voting');
      upvoteBtn.classList.add('voted');
      
      // Mostra l'icona votata e il contatore aggiornato
      upvoteBtn.innerHTML = `
        <span class="material-icons">thumb_up_alt</span>
        <span class="count">${currentCount + 1}</span>
        <span class="vote-percent-indicator">${weight/100}%</span>
      `;
      
      // Aggiungi l'animazione di successo
      upvoteBtn.classList.add('vote-success-animation');
      setTimeout(() => {
        upvoteBtn.classList.remove('vote-success-animation');
      }, 600);
      
      // Mostra notifica di successo
      this.emit('notification', { 
        type: 'success', 
        message: `Your ${weight/100}% vote was recorded successfully!`
      });
    } catch (error) {
      // Verifica se l'errore è dovuto a un annullamento da parte dell'utente
      if (error.isCancelled) {
        console.log('Vote was cancelled by user');
        // Non mostrare alcuna notifica di errore
      } else {
        console.error('Failed to vote:', error);
        this.emit('notification', { 
          type: 'error', 
          message: error.message || 'Failed to vote. Please try again.'
        });
      }
      
      // Ripristina il pulsante originale
      upvoteBtn.disabled = false;
      upvoteBtn.classList.remove('voting');
      upvoteBtn.innerHTML = `
        <span class="material-icons">thumb_up</span>
        <span class="count">${countElement?.textContent || '0'}</span>
      `;
    }
  });
}

// Sostituisci il metodo handleComment esistente con questa versione migliorata

async handleComment() {
  const textarea = this.postContent.querySelector('.comment-form textarea');
  const commentText = textarea.value.trim();
  
  if (!commentText) {
    // Feedback visivo se il campo è vuoto
    textarea.classList.add('error-input');
    setTimeout(() => textarea.classList.remove('error-input'), 1500);
    return;
  }
  
  // Valida la lunghezza del commento
  if (commentText.length < 3) {
    this.emit('notification', {
      type: 'error',
      message: 'Comment too short. Please write at least 3 characters.'
    });
    return;
  }
  
  // Check if user is logged in
  const user = authService.getCurrentUser();
  if (!user) {
    this.emit('notification', {
      type: 'error',
      message: 'You need to log in to comment'
    });
    router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
    return;
  }
  
  // Aggiorna UI per mostrare che stiamo processando
  const submitButton = this.postContent.querySelector('.submit-comment');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="material-icons loading">refresh</span> Posting...';
  
  // Aggiunge classe animata al pulsante
  submitButton.classList.add('processing');
  
  // Disabilita textarea durante l'invio
  textarea.disabled = true;
  
  try {
    // Crea il commento utilizzando il servizio commentService
    const result = await commentService.createComment({
      parentAuthor: this.post.author,
      parentPermlink: this.post.permlink,
      body: commentText,
      metadata: {
        app: 'steemee/1.0',
        format: 'markdown',
        tags: this.extractTags(commentText) // Estrae tag e menzioni
      }
    });
    
    // Mostra un feedback di successo
    this.emit('notification', {
      type: 'success',
      message: 'Your comment was posted successfully'
    });
    
    // Animazione di successo prima di pulire il form
    submitButton.classList.remove('processing');
    submitButton.classList.add('success');
    submitButton.innerHTML = '<span class="material-icons">check_circle</span> Posted!';
    
    // Pulisci il form dopo un breve ritardo
    setTimeout(() => {
      textarea.value = '';
      textarea.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = originalText;
      submitButton.classList.remove('success');
      
      // Aggiungi nuovi commenti direttamente senza ricaricare tutto il post
      this.updateWithNewComment(result);
    }, 1000);
  } catch (error) {
    console.error('Error posting comment:', error);
    
    // Elabora messaggio di errore specifico
    let errorMessage = 'Failed to post comment';
    
    if (error.message.includes('Keychain')) {
      errorMessage = this.getKeychainErrorMessage(error.message);
    } else if (error.message.includes('posting key')) {
      errorMessage = 'Invalid posting key. Please login again.';
    } else {
      errorMessage = `Error: ${error.message}`;
    }
    
    this.emit('notification', {
      type: 'error',
      message: errorMessage
    });
    
    // Ripristina lo stato di input
    textarea.disabled = false;
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    submitButton.classList.remove('processing');
  }
}

/**
 * Analizza un messaggio di errore Keychain e restituisce un messaggio più user-friendly
 */
getKeychainErrorMessage(errorMessage) {
  if (errorMessage.includes('user canceled')) {
    return 'You cancelled the operation';
  } else if (errorMessage.includes('not installed')) {
    return 'Steem Keychain extension not detected';
  } else if (errorMessage.includes('transaction')) {
    return 'Transaction rejected by the blockchain';
  }
  return 'Keychain error: ' + errorMessage;
}

/**
 * Estrae tag e menzioni dal testo del commento
 */
extractTags(text) {
  const tags = [];
  
  // Estrai tag
  const hashtagMatches = text.match(/#[\w-]+/g);
  if (hashtagMatches) {
    hashtagMatches.forEach(tag => {
      const cleanTag = tag.substring(1).toLowerCase(); // Rimuovi # e converti in lowercase
      if (!tags.includes(cleanTag) && cleanTag.length >= 3) {
        tags.push(cleanTag);
      }
    });
  }
  
  // Estrai menzioni
  const mentionMatches = text.match(/@[\w.-]+/g);
  if (mentionMatches) {
    mentionMatches.forEach(mention => {
      const username = mention.substring(1); // Rimuovi @
      if (username && username.length >= 3) {
        // Aggiungi alla lista delle menzioni
      }
    });
  }
  
  return tags.slice(0, 5); // Limita a 5 tag
}

/**
 * Aggiorna la vista con un nuovo commento senza ricaricare tutto il post
 */
updateWithNewComment(commentResult) {
  if (!commentResult || !commentResult.success) return;
  
  // Crea un oggetto commento rappresentativo
  const newComment = {
    author: commentResult.author,
    permlink: commentResult.permlink,
    parent_author: this.post.author,
    parent_permlink: this.post.permlink,
    body: commentResult.body || 'New comment',
    created: new Date().toISOString(),
    net_votes: 0,
    children: []
  };
  
  // Aggiungi il commento all'array locale
  if (!this.comments) this.comments = [];
  this.comments.push(newComment);
  
  // Aggiorna solo la lista dei commenti
  this.renderComments();
  
  // Aggiorna anche il contatore dei commenti
  const commentBtn = this.postContent.querySelector('.comment-btn');
  if (commentBtn) {
    const countElement = commentBtn.querySelector('.count');
    if (countElement) {
      const currentCount = parseInt(countElement.textContent) || 0;
      countElement.textContent = currentCount + 1;
    }
  }
}

// Sostituisci il metodo handleReply esistente

async handleReply(parentComment, replyText) {
  if (!replyText.trim()) return;
  
  // Check if user is logged in
  const user = authService.getCurrentUser();
  if (!user) {
    this.emit('notification', {
      type: 'error',
      message: 'You need to log in to reply'
    });
    router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
    return;
  }
  
  // Ottieni l'elemento di riferimento per aggiornare l'UI
  const commentElement = this.element.querySelector(`[data-author="${parentComment.author}"][data-permlink="${parentComment.permlink}"]`);
  const replyForm = commentElement?.querySelector('.reply-form');
  const submitButton = replyForm?.querySelector('.submit-reply');
  const textarea = replyForm?.querySelector('textarea');
  
  if (!submitButton || !textarea) return;
  
  // Cambia lo stato dell'interfaccia
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="material-icons loading">refresh</span> Replying...';
  textarea.disabled = true;
  
  try {
    // Utilizza il servizio dedicato per i commenti
    const result = await commentService.createComment({
      parentAuthor: parentComment.author,
      parentPermlink: parentComment.permlink,
      body: replyText,
      metadata: {
        app: 'steemee/1.0',
        format: 'markdown',
        tags: this.extractTags(replyText)
      }
    });
    
    // Mostra notifica di successo
    this.emit('notification', {
      type: 'success',
      message: 'Your reply was posted successfully'
    });
    
    // Animazione di successo
    submitButton.innerHTML = '<span class="material-icons">check_circle</span> Posted!';
    submitButton.classList.add('success');
    
    // Dopo un breve ritardo, ripristina e nascondi il form
    setTimeout(() => {
      // Ripristina lo stato
      textarea.value = '';
      textarea.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = originalText;
      submitButton.classList.remove('success');
      
      // Nascondi il form di risposta
      replyForm.style.display = 'none';
      
      // Ricarica il post per mostrare il nuovo commento
      this.loadPost();
    }, 1000);
  } catch (error) {
    console.error('Error posting reply:', error);
    
    // Elabora messaggio di errore specifico
    let errorMessage = 'Failed to post reply';
    
    if (error.message.includes('Keychain')) {
      errorMessage = this.getKeychainErrorMessage(error.message);
    } else {
      errorMessage = `Error: ${error.message}`;
    }
    
    this.emit('notification', {
      type: 'error',
      message: errorMessage
    });
    
    // Ripristina lo stato dell'interfaccia
    textarea.disabled = false;
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

  handleShare() {
    const url = window.location.href;

    // Use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: this.post.title,
        text: `Check out this post: ${this.post.title}`,
        url: url
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(url).then(() => {
        this.emit('notification', {
          type: 'success',
          message: 'Link copied to clipboard'
        });
      }).catch(err => console.error('Could not copy link:', err));
    }
  }
  
  // Add methods to extract the best image from a post (similar to ProfileView)
  getBestImage(post) {
    const metadata = this.parseMetadata(post.json_metadata);
    return imageService.getBestImageUrl(post.body, metadata) || '';
  }

  parseMetadata(jsonMetadata) {
    try {
      if (typeof jsonMetadata === 'string') {
        return JSON.parse(jsonMetadata);
      }
      return jsonMetadata || {};
    } catch (e) {
      return {};
    }
  }

  // Aggiungi questo metodo alla classe PostView
  async handleCommentVote(commentElement, upvoteBtn) {
    // Ottieni i dati del commento dagli attributi data-*
    const author = commentElement.dataset.author;
    const permlink = commentElement.dataset.permlink;
    const countElement = upvoteBtn.querySelector('.count');
    
    // Check if user is logged in
    const user = authService.getCurrentUser();
    if (!user) {
      this.emit('notification', { 
        type: 'error', 
        message: 'You need to log in to vote'
      });
      router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
      return;
    }
    
    // Controlla se l'utente ha già votato
    try {
      const existingVote = await voteService.hasVoted(author, permlink);
      if (existingVote) {
        // Se l'utente ha già votato, mostra un messaggio informativo
        const currentPercent = existingVote.percent / 100;
        this.emit('notification', { 
          type: 'info', 
          message: `You've already voted on this comment (${currentPercent}%)`
        });
        return;
      }
    } catch (error) {
      console.log('Error checkings comment vote status:', error);
      // Continua anche se non riusciamo a verificare il voto esistente
    }
    
    // Mostra il popup con slider per la percentuale
    this.showVotePercentagePopup(upvoteBtn, async (weight) => {
      const countElement = upvoteBtn.querySelector('.count');
      
      try {
        // Disabilita il pulsante durante il voto
        upvoteBtn.disabled = true;
        upvoteBtn.classList.add('voting');
        
        // Feedback visivo
        const originalContent = upvoteBtn.innerHTML;
        upvoteBtn.innerHTML = `
          <span class="material-icons loading">refresh</span>
        `;
        
        // Verifica se il peso è 0 (downvote)
        if (weight === 0) {
          throw new Error('Vote weight cannot be zero');
        }
        
        // Effettua il voto con il peso scelto
        await voteService.vote({
          author,
          permlink,
          weight
        });
        
        // Aggiorna il contatore dei voti
        const currentCount = parseInt(countElement.textContent) || 0;
        countElement.textContent = currentCount + 1;
        
        // Aggiorna la classe del pulsante
        upvoteBtn.classList.add('voted');
        
        // Aggiorna anche l'icona e aggiungi l'indicatore della percentuale
        upvoteBtn.innerHTML = `
          <span class="material-icons">thumb_up_alt</span>
          <span class="count">${currentCount + 1}</span>
          <span class="vote-percent-indicator">${weight/100}%</span>
        `;
        
        // Aggiungi l'animazione di successo
        upvoteBtn.classList.add('vote-success-animation');
        setTimeout(() => {
          upvoteBtn.classList.remove('vote-success-animation');
        }, 600);
        
        // Mostra notifica di successo
        this.emit('notification', { 
          type: 'success', 
          message: `Your ${weight/100}% vote on this comment was recorded successfully!`
        });
      } catch (error) {
        // Verifica se l'errore è dovuto a un annullamento da parte dell'utente
        if (error.isCancelled) {
          console.log('Comment vote was cancelled by user');
          // Non mostrare alcuna notifica di errore
        } else {
          console.error('Failed to vote on comment:', error);
          this.emit('notification', { 
            type: 'error', 
            message: error.message || 'Failed to vote on comment. Please try again.'
          });
        }
      } finally {
        // Ripristina il pulsante
        upvoteBtn.disabled = false;
        upvoteBtn.classList.remove('voting');
        
        // Ripristina contenuto originale con icona appropriata
        const isVoted = upvoteBtn.classList.contains('voted');
        upvoteBtn.innerHTML = `
          <span class="material-icons">${isVoted ? 'thumb_up_alt' : 'thumb_up'}</span>
          <span class="count">${countElement.textContent}</span>
        `;
      }
    });
  }

/**
 * Mostra un popup con slider per selezionare la percentuale di voto
 * @param {HTMLElement} targetElement - L'elemento di riferimento per il posizionamento del popup
 * @param {Function} callback - Funzione da chiamare con il peso del voto scelto
 * @param {number} [defaultValue=100] - Valore percentuale predefinito dello slider
 */
showVotePercentagePopup(targetElement, callback, defaultValue = 100) {
  // Rimuovi eventuali popup esistenti
  const existingPopup = document.querySelector('.vote-percentage-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Crea il popup
  const popup = document.createElement('div');
  popup.className = 'vote-percentage-popup';
  
  // Intestazione del popup
  const header = document.createElement('div');
  header.className = 'popup-header';
  header.textContent = 'Select Vote Percentage';
  
  // Contenuto del popup
  const content = document.createElement('div');
  content.className = 'popup-content';
  
  // Slider per la percentuale
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'slider-container';
  
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = defaultValue.toString();
  slider.className = 'percentage-slider';
  
  const percentageDisplay = document.createElement('div');
  percentageDisplay.className = 'percentage-display';
  percentageDisplay.textContent = `${defaultValue}%`;
  
  // Etichette min/max
  const sliderLabels = document.createElement('div');
  sliderLabels.className = 'slider-labels';
  
  const minLabel = document.createElement('span');
  minLabel.textContent = '0%';
  
  const maxLabel = document.createElement('span');
  maxLabel.textContent = '100%';
  
  sliderLabels.appendChild(minLabel);
  sliderLabels.appendChild(maxLabel);
  
  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(percentageDisplay);
  sliderContainer.appendChild(sliderLabels);
  
  // Pulsanti di azione
  const actions = document.createElement('div');
  actions.className = 'popup-actions';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn';
  confirmBtn.textContent = 'Vote';
  
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  
  // Assembla il popup
  content.appendChild(sliderContainer);
  content.appendChild(actions);
  
  popup.appendChild(header);
  popup.appendChild(content);
  
  // Aggiungi il popup al DOM
  document.body.appendChild(popup);
  
  // Posiziona il popup
  this.positionPopup(popup, targetElement);
  
  // Event listener per lo slider
  slider.addEventListener('input', () => {
    const value = slider.value;
    percentageDisplay.textContent = `${value}%`;
    
    // Cambia colore in base al valore
    if (value > 75) {
      percentageDisplay.style.color = 'var(--success-color, #28a745)';
    } else if (value > 25) {
      percentageDisplay.style.color = 'var(--primary-color, #ff7518)';
    } else if (value > 0) {
      percentageDisplay.style.color = 'var(--warning-color, #fd7e14)';
    } else {
      percentageDisplay.style.color = 'var(--error-color, #dc3545)';
    }
  });
  
  // Event listeners per i pulsanti
  cancelBtn.addEventListener('click', () => {
    popup.remove();
  });
  
  confirmBtn.addEventListener('click', () => {
    const weight = parseInt(slider.value) * 100; // Converti percentuale in peso (0-10000)
    popup.remove();
    callback(weight);
  });
  
  // Chiudi il popup se si clicca fuori
  const closeOnOutsideClick = (event) => {
    if (!popup.contains(event.target) && event.target !== targetElement) {
      popup.remove();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  
  // Previeni che i clic all'interno del popup propaghino all'event listener del documento
  popup.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  
  // Aggiungi l'event listener dopo un breve ritardo per evitare che catturi il clic corrente
  setTimeout(() => {
    document.addEventListener('click', closeOnOutsideClick);
  }, 100);
}

/**
 * Posiziona il popup in base all'elemento target
 * @param {HTMLElement} popup - Elemento popup
 * @param {HTMLElement} targetElement - Elemento di riferimento
 */
positionPopup(popup, targetElement) {
  const targetRect = targetElement.getBoundingClientRect();
  popup.style.position = 'fixed';
  
  // Verifica se siamo su mobile
  const isMobile = window.innerWidth <= 480;
  
  if (isMobile) {
    // Su mobile, posiziona sempre dal basso
    popup.style.bottom = '0';
    popup.style.left = '0';
    popup.style.width = '100%';
    popup.style.borderBottomLeftRadius = '0';
    popup.style.borderBottomRightRadius = '0';
    popup.style.transform = 'translateY(0)';
  } else {
    // Su desktop, posiziona in base allo spazio disponibile
    const popupHeight = 180; // Altezza stimata del popup
    
    // Se c'è spazio sopra, mettiamo il popup sopra il pulsante
    if (targetRect.top > popupHeight + 10) {
      popup.style.bottom = `${window.innerHeight - targetRect.top + 5}px`;
      popup.style.left = `${targetRect.left}px`;
    } else {
      // Altrimenti mettiamo il popup sotto il pulsante
      popup.style.top = `${targetRect.bottom + 5}px`;
      popup.style.left = `${targetRect.left}px`;
    }
    
    // Dopo che il popup è stato renderizzato, controlla che non esca dallo schermo
    setTimeout(() => {
      const popupRect = popup.getBoundingClientRect();
      
      // Correggi posizionamento orizzontale se necessario
      if (popupRect.right > window.innerWidth) {
        popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
      }
      
      // Correggi posizionamento verticale se necessario
      if (popupRect.bottom > window.innerHeight) {
        popup.style.top = 'auto';
        popup.style.bottom = '10px';
      }
    }, 0);
  }
}

/**
 * Controlla lo stato di voto per il post corrente
 */
async checkVoteStatus() {
  if (!this.post || !authService.isAuthenticated()) return;
  
  try {
    const upvoteBtn = this.element.querySelector('.upvote-btn');
    if (!upvoteBtn) return;
    
    const vote = await voteService.hasVoted(this.post.author, this.post.permlink);
    
    if (vote) {
      // Imposta lo stato votato
      upvoteBtn.classList.add('voted');
      
      // Aggiorna l'icona al formato "pieno"
      const iconElement = upvoteBtn.querySelector('.material-icons');
      if (iconElement) {
        iconElement.textContent = 'thumb_up_alt';
      }
      
      // Aggiungi l'indicatore di percentuale
      if (vote.percent > 0) {
        const percentIndicator = document.createElement('span');
        percentIndicator.className = 'vote-percent-indicator';
        percentIndicator.textContent = `${vote.percent / 100}%`;
        upvoteBtn.appendChild(percentIndicator);
      }
    }
  } catch (error) {
    console.log('Error checking vote status:', error);
  }
}
}

export default PostView;
