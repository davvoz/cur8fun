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
  
  async handleNewComment() {
    console.log('Handling new comment submission');
    
    // Find the comment form with more robust selectors
    const commentForm = this.view.element.querySelector('.comment-form') || 
                        this.view.element.querySelector('form[class*="comment"]');
    
    if (!commentForm) {
      console.error('Comment form not found');
      return;
    }
    
    const textarea = commentForm.querySelector('textarea');
    if (!textarea) {
      console.error('Comment textarea not found');
      return;
    }
    
    const commentText = textarea.value.trim();
    console.log('Comment text:', commentText ? 'Found' : 'Empty');

    // Validate comment
    if (!this.validateComment(commentText, textarea)) return;

    // Check login
    if (!this.checkLoggedIn()) return;

    // Find submit button (more robust selector)
    const submitButton = commentForm.querySelector('.submit-comment') || 
                        commentForm.querySelector('button[type="submit"]');
                        
    if (!submitButton) {
      console.error('Submit button not found');
      return;
    }
    
    // Try multiple approaches to find post information
    let postAuthor, postPermlink;
    
    // Method 1: From view.post object
    if (this.view.post && this.view.post.author && this.view.post.permlink) {
      console.log('Found post info from view.post');
      postAuthor = this.view.post.author;
      postPermlink = this.view.post.permlink;
    } 
    // Method 2: From data attributes on page elements
    else {
      // Try to find post info from meta tags or data attributes
      const postContainer = this.view.element.querySelector('[data-author][data-permlink]') || 
                           document.querySelector('[data-author][data-permlink]');
      
      if (postContainer) {
        console.log('Found post info from DOM data attributes');
        postAuthor = postContainer.dataset.author;
        postPermlink = postContainer.dataset.permlink;
      }
      // Method 3: From URL path if following /@author/permlink pattern
      else {
        const urlPath = window.location.pathname;
        const match = urlPath.match(/\/@([a-zA-Z0-9\-.]+)\/([a-zA-Z0-9\-]+)/);
        
        if (match && match.length >= 3) {
          console.log('Found post info from URL');
          postAuthor = match[1];
          postPermlink = match[2];
        }
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
    
    // Final check if we found the post information
    if (!postAuthor || !postPermlink) {
      console.error('Missing post information. Author:', postAuthor, 'Permlink:', postPermlink);
      this.view.emit('notification', {
        type: 'error',
        message: 'Error: Cannot identify the post to comment on'
      });
      return;
    }
    
    console.log('Commenting on post by:', postAuthor, 'with permlink:', postPermlink);
    
    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      // Submit comment
      const result = await commentService.createComment({
        parentAuthor: postAuthor,
        parentPermlink: postPermlink,
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

        // Add the new comment to the UI
        this.view.updateWithNewComment(result);
      }, 1000);
    } catch (error) {
      console.error('Error posting comment:', error);
      
      // Fix the error handling for RC errors
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
      
      // Create a loading indicator and show it properly
      const commentsSection = this.view.element.querySelector('.comments-section');
      const loadingIndicator = new LoadingIndicator('progressBar');
      
      if (commentsSection) {
        // Simply append the loading indicator to the comments section
        // This avoids the insertBefore error
        commentsSection.appendChild(loadingIndicator.element);
        loadingIndicator.updateProgress(20);
        loadingIndicator.show(commentsSection, 'Processing your reply...');
      }

      // Store the new reply's author/permlink for highlighting later
      const newReplyData = {
        author: result.author,
        permlink: result.permlink
      };
      
      // Wait longer for the blockchain to process the reply
      console.log('Waiting for blockchain to process reply...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        loadingIndicator.updateProgress(50);
        
        // Force cache refresh by adding timestamp to API calls
        await steemService.clearCache();
        
        loadingIndicator.updateProgress(70);
        console.log('Reloading post with fresh data...');
        
        // Reload post with fresh data
        await this.view.loadPost();
        
        loadingIndicator.updateProgress(100);
        
        // After reload, find and highlight the new comment
        setTimeout(() => {
          try {
            console.log('Locating new reply in DOM:', newReplyData);
            const newReplyElement = this.view.element.querySelector(
              `[data-author="${newReplyData.author}"][data-permlink="${newReplyData.permlink}"]`
            );
            
            if (newReplyElement) {
              console.log('Found new reply, highlighting and scrolling');
              // Add highlight class
              newReplyElement.classList.add('highlight-new-reply');
              
              // Scroll the element into view
              newReplyElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            } else {
              console.warn('New reply element not found in DOM after reload');
            }
          } catch (highlightError) {
            console.error('Error highlighting new reply:', highlightError);
          } finally {
            // Hide the loading indicator
            loadingIndicator.hide();
          }
        }, 500);
        
      } catch (reloadError) {
        console.error('Error reloading post after reply:', reloadError);
        loadingIndicator.hide();
        
        this.view.emit('notification', {
          type: 'warning',
          message: 'Reply was posted but there was an error updating the display'
        });
      }
    } catch (error) {
      console.error('Error posting reply:', error);

      // Fix the error handling for RC errors
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
