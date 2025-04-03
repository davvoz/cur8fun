import commentService from '../services/CommentService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';

export default class CommentController {
  constructor(view) {
    this.view = view;
    this.initialized = false;
    
    // Attach event listeners after DOM is ready
    setTimeout(() => this.initializeEventListeners(), 100);
  }
  
  /**
   * Initialize event listeners for comment forms
   */
  initializeEventListeners() {
    if (this.initialized) return;
    
    // Find the comment form
    const commentForm = this.view.element.querySelector('.comment-form');
    const submitButton = commentForm?.querySelector('.submit-comment');
    
    if (submitButton) {
      // Remove any existing listeners to prevent duplicates
      submitButton.removeEventListener('click', this.handleNewCommentClick);
      
      // Add click event listener with bound context
      submitButton.addEventListener('click', this.handleNewCommentClick.bind(this));
      console.log('Comment submit button listener attached');
    } else {
      console.warn('Comment submit button not found');
    }
    
    this.initialized = true;
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
          app: 'steemee/1.0',
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
      
      // Error handling
      const errorMessage = this.getErrorMessage(error);
      this.view.emit('notification', {
        type: 'error',
        message: errorMessage
      });

      // Reset UI
      this.setSubmitState(submitButton, textarea, false, originalText);
    }
  }
  
  async handleReply(parentComment, replyText) {
    if (!replyText.trim()) return;

    // Check login
    if (!this.checkLoggedIn()) return;

    // Find UI elements
    const commentElement = this.view.element.querySelector(`[data-author="${parentComment.author}"][data-permlink="${parentComment.permlink}"]`);
    const replyForm = commentElement?.querySelector('.reply-form');
    const submitButton = replyForm?.querySelector('.submit-reply');
    const textarea = replyForm?.querySelector('textarea');

    if (!submitButton || !textarea) return;

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
          app: 'steemee/1.0',
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

      // Reset and update UI
      setTimeout(() => {
        textarea.value = '';
        this.setSubmitState(submitButton, textarea, false, originalText);
        submitButton.classList.remove('success');

        // Hide form and refresh comments
        replyForm.style.display = 'none';
        this.view.loadPost();
      }, 1000);
    } catch (error) {
      console.error('Error posting reply:', error);

      // Error handling
      const errorMessage = this.getErrorMessage(error);
      this.view.emit('notification', {
        type: 'error',
        message: errorMessage
      });

      // Reset UI
      this.setSubmitState(submitButton, textarea, false, originalText);
    }
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
    
    if (error.message && error.message.includes('Keychain')) {
      return this.getKeychainErrorMessage(error.message);
    } else if (error.message && error.message.includes('posting key')) {
      return 'Invalid posting key. Please login again.';
    } else if (error.message === 'i') {
      return 'Invalid comment parameters. Please try again with different text.';
    } else if (error.message && error.message.includes('permlink')) {
      return 'Invalid permlink format. Please try again.';
    } else if (error.message && error.message.includes('STEEM_MIN_ROOT_COMMENT_INTERVAL')) {
      return 'Please wait a while before posting another comment.';
    }
    
    return `Error: ${error.message || 'Failed to post comment'}`;
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
    // Remove event listeners
    const submitButton = this.view.element.querySelector('.submit-comment');
    if (submitButton) {
      submitButton.removeEventListener('click', this.handleNewCommentClick);
    }
    this.initialized = false;
  }
}
