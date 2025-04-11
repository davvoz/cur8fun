import commentService from '../services/CommentService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import steemService from '../services/SteemService.js';


export default class CommentController {
  constructor(view) {
    this.view = view;
    this.initialized = false;
    
    // Use MutationObserver instead of setTimeout for more reliable initialization
    this.observer = new MutationObserver(this.checkForCommentForm.bind(this));
    
    // Start observing the view element once it's available
    if (this.view.element) {
      this.startObserving();
    } else {
      // If view.element isn't available yet, wait for render
      const originalRender = this.view.renderComponents;
      this.view.renderComponents = async function(...args) {
        const result = await originalRender.apply(this, args);
        this.commentController.startObserving();
        return result;
      };
    }
  }
  
  /**
   * Start observing DOM changes to detect when comment form is added
   */
  startObserving() {
    if (!this.view.element) return;
    
    this.observer.observe(this.view.element, {
      childList: true,
      subtree: true
    });
    
    // Also try immediate initialization in case the form is already there
    this.checkForCommentForm();
  }
  
  /**
   * Check if comment form exists in the DOM and initialize if found
   */
  checkForCommentForm() {
    if (this.initialized) return;
    
    // Try various selectors to find the comment form and button
    const selectors = [
      '.comment-form .submit-comment',
      '.comments-section .submit-comment',
      'button.submit-comment',
      '.comments-section form button[type="submit"]'
    ];
    
    let submitButton = null;
    
    // Try each selector until we find a matching element
    for (const selector of selectors) {
      submitButton = this.view.element.querySelector(selector);
      if (submitButton) {
        console.log('Found comment submit button with selector:', selector);
        break;
      }
    }
    
    if (submitButton) {
      // Remove any existing listeners to prevent duplicates
      submitButton.removeEventListener('click', this.handleNewCommentClick);
      
      // Create bound handler to ensure correct 'this' context
      this.boundHandleClick = this.handleNewCommentClick.bind(this);
      
      // Add click event listener with proper binding
      submitButton.addEventListener('click', this.boundHandleClick);
      console.log('✅ Comment submit button listener attached successfully');
      
      this.initialized = true;
      
      // Stop observing once we've attached the listener
      this.observer.disconnect();
    }
  }
  
  /**
   * Handle click on the submit comment button
   * @param {Event} event - Click event
   */
  handleNewCommentClick(event) {
    event.preventDefault();
    console.log('Comment submit button clicked');
    this.handleNewComment();
  }
  
  /**
   * Handle the submission of a new comment on a post
   * @returns {Promise<void>}
   */
  async handleNewComment() {
    console.log('Handling new comment submission');
    
    const commentForm = this.findCommentForm();
    if (!commentForm) return;
    
    const textarea = commentForm.querySelector('textarea');
    if (!textarea) {
      console.error('Comment textarea not found');
      return;
    }
    
    const commentText = textarea.value.trim();
    console.log('Comment text:', commentText ? 'Found' : 'Empty');

    // Validate comment and check login
    if (!this.validateComment(commentText, textarea) || !this.checkLoggedIn()) {
      return;
    }

    const submitButton = this.findSubmitButton(commentForm);
    if (!submitButton) return;
    
    const postInfo = this.getPostInformation(commentForm);
    if (!postInfo.isValid) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Error: Cannot identify the post to comment on'
      });
      return;
    }
    
    console.log('Commenting on post by:', postInfo.author, 'with permlink:', postInfo.permlink);
    
    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      await this.submitNewComment(postInfo, commentText, submitButton, textarea, originalText);
    } catch (error) {
      this.handleCommentError(error, submitButton, textarea, originalText);
    }
  }
  
  /**
   * Find the comment form in the DOM
   * @returns {HTMLElement|null} The comment form element or null if not found
   */
  findCommentForm() {
    const commentForm = this.view.element.querySelector('.comment-form') || 
                       this.view.element.querySelector('form[class*="comment"]');
    
    if (!commentForm) {
      console.error('Comment form not found');
    }
    return commentForm;
  }
  
  /**
   * Find the submit button for the comment form
   * @param {HTMLElement} commentForm - The comment form element
   * @returns {HTMLElement|null} The submit button or null if not found
   */
  findSubmitButton(commentForm) {
    const submitButton = commentForm.querySelector('.submit-comment') || 
                        commentForm.querySelector('button[type="submit"]');
                        
    if (!submitButton) {
      console.error('Submit button not found');
    }
    return submitButton;
  }
  
  /**
   * Get post author and permlink information
   * @param {HTMLElement} commentForm - The comment form element
   * @returns {Object} Object containing author, permlink and isValid flag
   */
  getPostInformation(commentForm) {
    let postAuthor;
    let postPermlink;
    
    // Method 1: From view.post object
    if (this.view.post?.author && this.view.post?.permlink) {
      console.log('Found post info from view.post');
      postAuthor = this.view.post.author;
      postPermlink = this.view.post.permlink;
    } 
    // Method 2: From data attributes on page elements
    else if (!postAuthor || !postPermlink) {
      const postContainer = this.view.element.querySelector('[data-author][data-permlink]') || 
                           document.querySelector('[data-author][data-permlink]');
      
      if (postContainer) {
        console.log('Found post info from DOM data attributes');
        postAuthor = postContainer.dataset.author;
        postPermlink = postContainer.dataset.permlink;
      }
    }
    
    // Method 3: From URL path if following /@author/permlink pattern
    if (!postAuthor || !postPermlink) {
      const urlPath = window.location.pathname;
      const match = urlPath.match(/\/@([a-zA-Z0-9\-.]+)\/([a-zA-Z0-9\-]+)/);
      
      if (match && match.length >= 3) {
        console.log('Found post info from URL');
        postAuthor = match[1];
        postPermlink = match[2];
      }
    }
    
    // Method 4: Look for hidden inputs that might contain the data
    if (!postAuthor || !postPermlink) {
      const authorInput = commentForm.querySelector('input[name="parent_author"]');
      const permlinkInput = commentForm.querySelector('input[name="parent_permlink"]');
      
      if (authorInput && permlinkInput) {
        console.log('Found post info from hidden inputs');
        postAuthor = authorInput.value;
        postPermlink = permlinkInput.value;
      }
    }
    
    return {
      author: postAuthor,
      permlink: postPermlink,
      isValid: Boolean(postAuthor && postPermlink)
    };
  }
  
  /**
   * Submit a new comment to the blockchain
   * @param {Object} postInfo - Contains author and permlink of the parent post
   * @param {string} commentText - The comment text
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   * @returns {Promise<void>}
   */
  async submitNewComment(postInfo, commentText, submitButton, textarea, originalText) {
    const result = await commentService.createComment({
      parentAuthor: postInfo.author,
      parentPermlink: postInfo.permlink,
      body: commentText,
      metadata: {
        app: 'cur8.fun/1.0',
        format: 'markdown',
        tags: this.extractTags(commentText)
      }
    });

    // Success notification
    this.view.emit('notification', {
      type: 'success',
      message: 'Your comment was posted successfully'
    });

    // Success UI state
    this.setSuccessState(submitButton);

    // Reset and update UI
    setTimeout(() => {
      textarea.value = '';
      this.setSubmitState(submitButton, textarea, false, originalText);
      submitButton.classList.remove('success');

      // Add the new comment to the UI without refreshing the entire page
      this.addNewCommentToUI(result);
    }, 1000);
  }

  /**
   * Adds a newly created comment to the UI without refreshing the page
   * @param {Object} commentResult - The result from createComment API call
   */
  addNewCommentToUI(commentResult) {
    if (!commentResult || !commentResult.success) {
      console.error('Invalid comment result:', commentResult);
      return;
    }

    try {
      console.log('Adding new comment to UI:', commentResult);
      
      // Aggiorna il modello dati nel view
      if (this.view.comments) {
        // Create a new comment object
        const newComment = {
          author: commentResult.author,
          permlink: commentResult.permlink,
          parent_author: this.view.post?.author || '',
          parent_permlink: this.view.post?.permlink || '',
          body: commentResult.body || 'New comment',
          created: new Date().toISOString(),
          net_votes: 0,
          active_votes: [],
          children: [],
          isNew: true
        };
        
        // Add to view's comments array
        this.view.comments.push(newComment);
      }
      
      // Usa solo il metodo diretto del componente CommentsSection (quando disponibile)
      if (this.view.commentsSectionComponent && typeof this.view.commentsSectionComponent.addNewComment === 'function') {
        this.view.commentsSectionComponent.addNewComment(commentResult);
      } else {
        // Fallback al metodo updateWithNewComment della view
        this.view.updateWithNewComment(commentResult);
      }
      
      // Aggiorna il contatore dei commenti nella UI (se disponibile)
      if (typeof this.view.updateCommentCount === 'function') {
        this.view.updateCommentCount();
      }
    } catch (error) {
      console.error('Error adding new comment to UI:', error);
    }
  }
  
  /**
   * Handle errors during comment submission
   * @param {Error} error - The error object
   * @param {HTMLElement} submitButton - The submit button element
   * @param {HTMLElement} textarea - The textarea element
   * @param {string} originalText - Original button text
   */
  handleCommentError(error, submitButton, textarea, originalText) {
    console.error('Error posting comment:', error);
    
    // Get appropriate error message
    const errorMessage = this.getErrorMessage(error);
    
    if (error.message?.includes('RC')) {
      // Show a more prominent error dialog for RC errors
      this.showRCErrorDialog(errorMessage);
    } else {
      // Regular notification for other errors
      this.view.emit('notification', {
        type: 'error',
        message: errorMessage
      });
    }

    // Reset UI
    this.setSubmitState(submitButton, textarea, false, originalText);
  }
  
  async handleReply(parentComment, replyText) {
    console.log('Handling reply submission', parentComment);
    
    const trimmedReply = replyText.trim();
    
    // Check if reply is empty
    if (!trimmedReply) return;
    
    // Check if reply is too short (at least 3 characters)
    if (trimmedReply.length < 3) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Reply too short. Please write at least 3 characters.'
      });
      return;
    }

    // Check login
    if (!this.checkLoggedIn()) return;

    // Find UI elements with more robust selectors
    let commentElement = null;
    
    // Try multiple selectors to find the comment element
    const selectors = [
      `[data-author="${parentComment.author}"][data-permlink="${parentComment.permlink}"]`,
      `.comment:has(.author-name:contains("@${parentComment.author}"))`,
      `.comment .author-name[text="@${parentComment.author}"]`
    ];
    
    for (const selector of selectors) {
      try {
        commentElement = this.view.element.querySelector(selector);
        if (commentElement) {
          console.log('Found comment element with selector:', selector);
          break;
        }
      } catch (e) {
        // Some selectors might be unsupported in some browsers
        console.warn('Selector failed:', selector, e);
      }
    }
    
    // If selectors failed, try a manual search
    if (!commentElement) {
      console.log('Trying manual search for comment element');
      const allComments = this.view.element.querySelectorAll('.comment');
      for (const element of allComments) {
        const authorNames = element.querySelectorAll('.author-name');
        for (const name of authorNames) {
          if (name.textContent === `@${parentComment.author}`) {
            commentElement = element;
            console.log('Found comment through author name');
            break;
          }
        }
        if (commentElement) break;
      }
    }
    
    if (!commentElement) {
      console.error('Could not find comment element for', parentComment.author);
      this.view.emit('notification', {
        type: 'error',
        message: 'Could not find the comment to reply to. Please try again.'
      });
      return;
    }
    
    // Now find the reply form within this comment
    const replyForm = commentElement.querySelector('.reply-form');
    const submitButton = replyForm?.querySelector('.submit-reply');
    const textarea = replyForm?.querySelector('textarea');

    if (!submitButton || !textarea) {
      console.error('Reply form elements missing', {
        formFound: !!replyForm,
        buttonFound: !!submitButton,
        textareaFound: !!textarea
      });
      return;
    }

    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      // Submit reply
      const result = await commentService.createComment({
        parentAuthor: parentComment.author,
        parentPermlink: parentComment.permlink,
        body: replyText,
        metadata: {
          app: 'cur8.fun/1.0',
          format: 'markdown',
          tags: this.extractTags(replyText)
        }
      });

      // Show success notification
      this.view.emit('notification', {
        type: 'success',
        message: 'Your reply was posted successfully'
      });

      // Update UI state to success
      this.setSuccessState(submitButton);

      // Reset textarea immediately
      textarea.value = '';
      
      // Hide form
      replyForm.style.display = 'none';
      
      // Update the UI without refreshing the page
      this.addNewReplyToUI(result, commentElement, parentComment);
      
      // Reset the button state after a delay
      setTimeout(() => {
        this.setSubmitState(submitButton, textarea, false, originalText);
        submitButton.classList.remove('success');
      }, 1000);
    } catch (error) {
      console.error('Error posting reply:', error);

      // Get appropriate error message
      const errorMessage = this.getErrorMessage(error);
      
      if (error.message && error.message.includes('RC')) {
        // Show a more prominent error dialog for RC errors
        this.showRCErrorDialog(errorMessage);
      } else {
        // Regular notification for other errors
        this.view.emit('notification', {
          type: 'error',
          message: errorMessage
        });
      }

      // Reset UI
      this.setSubmitState(submitButton, textarea, false, originalText);
    }
  }

  /**
   * Adds a new reply to the UI without refreshing the page
   * @param {Object} result - The result from createComment API call
   * @param {HTMLElement} commentElement - The parent comment element
   * @param {Object} parentComment - The parent comment data
   */
  addNewReplyToUI(result, commentElement, parentComment) {
    try {
      console.log('Adding new reply to UI:', result);
      
      // Check if there's already a replies container
      let repliesContainer = commentElement.querySelector('.replies');
      let repliesWrapper;
      
      if (repliesContainer) {
        // Use existing replies wrapper
        repliesWrapper = repliesContainer.querySelector('.replies-wrapper');
        
        // If replies-wrapper doesn't exist, create it
        if (!repliesWrapper) {
          repliesWrapper = document.createElement('div');
          repliesWrapper.className = 'replies-wrapper';
          
          const threadLine = document.createElement('div');
          threadLine.className = 'thread-line';
          threadLine.setAttribute('aria-hidden', 'true');
          
          repliesContainer.appendChild(threadLine);
          repliesContainer.appendChild(repliesWrapper);
        }
      } else {
        // Create new replies container
        repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies';
        
        const threadLine = document.createElement('div');
        threadLine.className = 'thread-line';
        threadLine.setAttribute('aria-hidden', 'true');
        
        repliesWrapper = document.createElement('div');
        repliesWrapper.className = 'replies-wrapper';
        
        repliesContainer.appendChild(threadLine);
        repliesContainer.appendChild(repliesWrapper);
        commentElement.appendChild(repliesContainer);
      }
      
      // Construct a new comment object
      const newReply = {
        author: result.author,
        permlink: result.permlink,
        parent_author: parentComment.author,
        parent_permlink: parentComment.permlink,
        body: result.body,
        created: new Date().toISOString(),
        net_votes: 0,
        active_votes: [],
        children: [],
        depth: (parentComment.depth || 0) + 1,
        isNew: true // Mark as new for highlighting
      };
      
      // Use CommentSection to create a new comment element
      if (this.view.commentsSectionComponent) {
        const replyElement = this.view.commentsSectionComponent.createCommentElement(newReply);
        repliesWrapper.appendChild(replyElement);
        
        // Update the replies count badge if it exists
        const replyCountBadge = commentElement.querySelector('.replies-count');
        if (replyCountBadge) {
          const currentCount = parseInt(replyCountBadge.textContent) || 0;
          const newCount = currentCount + 1;
          replyCountBadge.textContent = `${newCount} ${newCount === 1 ? 'reply' : 'replies'}`;
        } else {
          // Create a new reply count badge if it doesn't exist
          const authorContainer = commentElement.querySelector('.author-container');
          if (authorContainer && !authorContainer.querySelector('.replies-count')) {
            const replyCountBadge = document.createElement('span');
            replyCountBadge.className = 'replies-count';
            replyCountBadge.textContent = '1 reply';
            authorContainer.appendChild(replyCountBadge);
          }
        }
        
        // Also update the parent comment object's children array
        if (parentComment.children) {
          parentComment.children.push(newReply);
        } else {
          parentComment.children = [newReply];
        }
      }
      
      // Also update the view's comments array if it exists
      if (this.view.comments) {
        this.view.comments.push(newReply);
      }
      
      // Also update comment count in PostView if applicable
      if (typeof this.view.updateCommentCount === 'function') {
        this.view.updateCommentCount();
      }
    } catch (error) {
      console.error('Error adding new reply to UI:', error);
      
      // Fallback method: simply reload the comments after a short delay
      setTimeout(() => {
        if (this.view.commentsSectionComponent && typeof this.view.commentsSectionComponent.quickRefreshReplies === 'function') {
          this.view.commentsSectionComponent.quickRefreshReplies()
            .then(() => {
              this.view.commentsSectionComponent.renderComments();
            })
            .catch(err => console.error('Failed to refresh comments:', err));
        }
      }, 1500);
    }
  }
  
  /**
   * Creates a loading overlay element for transitionsa loading overlay element for transitions
   * @returns {HTMLElement} The loading overlay element
   */
  createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
    `;
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Loading comments...';
    loadingText.style.cssText = `
      margin-left: 10px;
      font-size: 14px;
      color: #333;
    `;
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.appendChild(spinner);
    container.appendChild(loadingText);
    
    overlay.appendChild(container);
    return overlay;
  }
  
  validateComment(commentText, textarea) {
    if (!commentText) {
      textarea.classList.add('error-input');
      setTimeout(() => textarea.classList.remove('error-input'), 1500);
      return false;
    }

    if (commentText.length < 3) {
      this.view.emit('notification', {
        type: 'error',
        message: 'Comment too short. Please write at least 3 characters.'
      });
      return false;
    }
    
    return true;
  }
  
  checkLoggedIn() {
    const user = authService.getCurrentUser();
    if (!user) {
      this.view.emit('notification', {
        type: 'error',
        message: 'You need to log in to comment'
      });
      router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
      return false;
    }
    return true;
  }
  
  setSubmitState(button, textarea, isSubmitting, text = null) {
    if (isSubmitting) {
      button.disabled = true;
      button.innerHTML = '<span class="material-icons loading">refresh</span> Posting...';
      button.classList.add('processing');
      textarea.disabled = true;
    } else {
      button.disabled = false;
      if (text) button.textContent = text;
      button.classList.remove('processing');
      textarea.disabled = false;
    }
  }
  
  setSuccessState(button) {
    button.classList.remove('processing');
    button.classList.add('success');
    button.innerHTML = '<span class="material-icons">check_circle</span> Posted!';
  }
  
  getErrorMessage(error) {
    console.log('Processing error:', error);
    
    if (!error) return 'Unknown error occurred';
    
    const errorMessage = error.message || '';
    
    // Check for Resource Credits (RC) error
    if (errorMessage.includes('RC') && errorMessage.includes('needs') && errorMessage.includes('has')) {
      // This is a Resource Credits error
      return this.getResourceCreditsErrorMessage(errorMessage);
    } else if (errorMessage.includes('Keychain')) {
      return this.getKeychainErrorMessage(errorMessage);
    } else if (errorMessage.includes('posting key')) {
      return 'Invalid posting key. Please login again.';
    } else if (errorMessage === 'i') {
      return 'Invalid comment parameters. Please try again with different text.';
    } else if (errorMessage.includes('permlink')) {
      return 'Invalid permlink format. Please try again.';
    } else if (errorMessage.includes('STEEM_MIN_ROOT_COMMENT_INTERVAL')) {
      return 'Please wait a while before posting another comment.';
    }
    
    return `Error: ${errorMessage || 'Failed to post comment'}`;
  }
  
  /**
   * Formats a user-friendly message for Resource Credits errors
   * @param {string} errorMessage - The original error message
   * @returns {string} A user-friendly error message
   */
  getResourceCreditsErrorMessage(errorMessage) {
    try {
      // Try to extract the values from the error message using regex
      const rcMatch = errorMessage.match(/has\s+(\d+)\s+RC,\s+needs\s+(\d+)\s+RC/);
      
      if (rcMatch && rcMatch.length === 3) {
        const availableRC = parseInt(rcMatch[1]);
        const requiredRC = parseInt(rcMatch[2]);
        const percentAvailable = Math.round((availableRC / requiredRC) * 100);
        
        return `You don't have enough Resource Credits to perform this action (${percentAvailable}% available). 
                Please wait a few hours for your RC to regenerate or power up more STEEM.`;
      }
      
      // Fallback if we can't parse the exact values
      return 'You don\'t have enough Resource Credits (RC) to perform this action. Please wait a few hours for your RC to regenerate or power up more STEEM.';
    } catch (e) {
      // If there's any error parsing, return a generic message
      return 'Insufficient Resource Credits. Please try again later or power up more STEEM.';
    }
  }
  
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
  
  extractTags(text) {
    const tags = [];

    // Extract hashtags
    const hashtagMatches = text.match(/#[\w-]+/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(tag => {
        const cleanTag = tag.substring(1).toLowerCase();
        if (!tags.includes(cleanTag) && cleanTag.length >= 3) {
          tags.push(cleanTag);
        }
      });
    }

    return tags.slice(0, 5); // Limit to 5 tags
  }
  
  cleanup() {
    // Stop observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Remove event listeners with proper reference
    if (this.boundHandleClick) {
      const submitButton = this.view.element.querySelector('.submit-comment');
      if (submitButton) {
        submitButton.removeEventListener('click', this.boundHandleClick);
      }
    }
    
    this.initialized = false;
  }
  
  /**
   * Show a more prominent error dialog for Resource Credits errors
   * @param {string} message - The error message to display
   */
  showRCErrorDialog(message) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'rc-error-overlay';
    
    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'rc-error-dialog';
    dialog.style.left = '50%';
    dialog.style.top = '50%';
    
    // Create dialog content
    const title = document.createElement('h3');
    title.className = 'rc-error-dialog-title';
    title.textContent = 'Not Enough Resource Credits';
    
    // Add icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'rc-error-icon';
    iconContainer.innerHTML = '<span class="material-icons">error_outline</span>';
    
    // Add message
    const messageEl = document.createElement('p');
    messageEl.className = 'rc-error-message';
    messageEl.textContent = message;
    
    // Add learn more link
    const link = document.createElement('a');
    link.className = 'rc-error-link';
    link.href = 'https://cur8.fun/#/@jesta/steem-resource-credits-guide';
    link.textContent = 'Learn more about Resource Credits';
    link.target = '_blank';
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rc-error-close-btn';
    closeBtn.textContent = 'Close';
    
    // Close dialog function
    const closeDialog = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
    };
    
    // Add event listeners
    closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', closeDialog);
    
    // Add elements to dialog
    dialog.appendChild(title);
    dialog.appendChild(iconContainer);
    dialog.appendChild(messageEl);
    dialog.appendChild(link);
    dialog.appendChild(closeBtn);
    
    // Add to body
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    // Also emit a regular notification
    this.view.emit('notification', {
      type: 'error',
      message: 'Not enough Resource Credits to complete this action'
    });
  }
}
