import commentService from '../services/CommentService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';

export default class CommentController {
  constructor(view) {
    this.view = view;
  }
  
  async handleNewComment() {
    const textarea = this.view.element.querySelector('.comment-form textarea');
    if (!textarea) return;
    
    const commentText = textarea.value.trim();

    // Validate comment
    if (!this.validateComment(commentText, textarea)) return;

    // Check login
    if (!this.checkLoggedIn()) return;

    // Find UI elements
    const submitButton = this.view.element.querySelector('.submit-comment');
    if (!submitButton) return;
    
    // Set loading state
    const originalText = submitButton.textContent;
    this.setSubmitState(submitButton, textarea, true);

    try {
      // Submit comment
      const result = await commentService.createComment({
        parentAuthor: this.view.post.author,
        parentPermlink: this.view.post.permlink,
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
    if (error.message.includes('Keychain')) {
      return this.getKeychainErrorMessage(error.message);
    } else if (error.message.includes('posting key')) {
      return 'Invalid posting key. Please login again.';
    }
    return `Error: ${error.message}`;
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
    // No specific cleanup needed yet
  }
}
