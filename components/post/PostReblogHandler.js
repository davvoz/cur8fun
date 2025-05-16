import authService from '../../services/AuthService.js';
import reblogService from '../../services/ReblogService.js';
import eventEmitter from '../../utils/EventEmitter.js';
import router from '../../utils/Router.js';

/**
 * Handler class for reblog actions on posts
 */
class PostReblogHandler {
  constructor() {
    this.onPostReblogged = this.onPostReblogged.bind(this);
    
    // Listen to reblog events for UI updates
    eventEmitter.on('post:reblogged', this.onPostReblogged);
  }
  
  /**
   * Create a reblog callback for a specific post
   * @param {Object} post - The post to reblog
   * @param {Function} uiUpdateCallback - Optional callback to update UI after reblog
   * @returns {Function} - The reblog handler function
   */  createReblogCallback(post, uiUpdateCallback) {
    return async (event, postActionUpdateCallback) => {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('Reblog button clicked for post:', post.author, post.permlink);
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser) {
        console.log('No user logged in, redirecting to login page');
        // Redirect to login if not logged in
        eventEmitter.emit('notification', {
          type: 'info',
          message: 'You must be logged in to reblog a post',
          duration: 3000
        });
        
        router.navigate('/login');
        return;
      }
      
      console.log('Current user:', currentUser.username);
      const button = event.currentTarget;
      console.log('Button element:', button);
      
      try {
        // Disable button during API call
        button.disabled = true;
        
        // Add visual indicator
        const textSpan = button.querySelector('span:last-child');
        const originalText = textSpan ? textSpan.textContent : 'Reblog';
        console.log('Original button text:', originalText);
        
        if (textSpan) {
          textSpan.textContent = 'Reblogging...';
        }
        
        // Call reblog service
        console.log('Calling reblogService.reblogPost...');
        await reblogService.reblogPost(post.author, post.permlink);
        console.log('Reblog service call completed');
        
        // Update button appearance directly
        button.classList.add('reblogged');
        if (textSpan) {
          textSpan.textContent = 'Reblogged';
        }
        
        // First, use PostActions' update method if available
        if (postActionUpdateCallback && typeof postActionUpdateCallback === 'function') {
          console.log('Calling PostActions updateReblogState');
          postActionUpdateCallback(true);
        }
        
        // Then, call the component-level update callback if provided
        if (uiUpdateCallback && typeof uiUpdateCallback === 'function') {
          console.log('Executing component UI update callback');
          uiUpdateCallback(true);
        }
        
        // Emit event for other components
        eventEmitter.emit('post:reblogged', { 
          username: currentUser.username,
          author: post.author, 
          permlink: post.permlink 
        });
      } catch (error) {
        console.error('Reblog error:', error);
        
        // Reset button text
        const span = button.querySelector('span:last-child');
        if (span) {
          span.textContent = originalText || 'Reblog';
        }
        
        // Show error notification
        eventEmitter.emit('notification', {
          type: 'error',
          message: error.message || 'Failed to reblog post',
          duration: 3000
        });
      } finally {
        // Re-enable button
        button.disabled = false;
      }
    };
  }
  
  /**
   * Check if a post has been reblogged by the current user
   * @param {Object} post - The post to check
   * @returns {Promise<boolean>} - Whether the post has been reblogged
   */  async checkIfReblogged(post) {
    try {
      const currentUser = authService.getCurrentUser();
      console.log('Checking reblog status. Current user:', currentUser?.username);
      
      if (!currentUser) {
        console.log('No current user, returning false for reblog check');
        return false;
      }
      
      if (!post || !post.author || !post.permlink) {
        console.error('Invalid post data for reblog check:', post);
        return false;
      }
      
      console.log(`Checking if ${currentUser.username} has reblogged ${post.author}/${post.permlink}`);
      const hasReblogged = await reblogService.hasReblogged(
        currentUser.username, 
        post.author, 
        post.permlink
      );
      
      console.log(`Reblog status check result: ${hasReblogged}`);
      return hasReblogged;
    } catch (error) {
      console.error('Error in checkIfReblogged:', error);
      return false;
    }
  }
  
  /**
   * Event handler for post reblogged events
   * @param {Object} data - Event data with username, author, permlink
   */
  onPostReblogged(data) {
    // This method can be used to update other parts of the UI when a reblog happens
    // For example, you might want to update post counts or refresh post lists
    console.log('Post reblogged:', data);
  }
  
  /**
   * Clean up event listeners
   */
  destroy() {
    eventEmitter.off('post:reblogged', this.onPostReblogged);
  }
}

export default PostReblogHandler;
