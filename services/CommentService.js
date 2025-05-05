import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

/**
 * Service for handling comments on posts
 */
class CommentService {
  constructor() {
    this.isProcessing = false;
    this.commentInProgress = new Set(); // Track ongoing comments to prevent duplicates

    // Listen for auth changes
    eventEmitter.on('auth:changed', ({ user }) => {
      // Reset processing state when user changes
      this.isProcessing = false;
      this.commentInProgress.clear();
    });
  }

  /**
   * Verify if Keychain is available in the browser
   * @returns {boolean} True if Keychain is available
   */
  isKeychainAvailable() {
    return typeof window !== 'undefined' &&
      typeof window.steem_keychain !== 'undefined' &&
      !!window.steem_keychain;
  }

  /**
   * Determine if we're on a mobile device
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Validate comment data
   * @param {Object} commentData - Comment data to validate
   * @throws {Error} If data is invalid
   */
  validateCommentData(commentData) {
    const { parentAuthor, parentPermlink, body } = commentData;

    if (!parentAuthor) {
      throw new Error('Parent author is required');
    }

    if (!parentPermlink) {
      throw new Error('Parent permlink is required');
    }

    if (!body || typeof body !== 'string') {
      throw new Error('Comment body is required and must be a string');
    }

    if (body.trim().length < 3) {
      throw new Error('Comment must be at least 3 characters');
    }

    if (body.length > 65535) {
      throw new Error('Comment is too long (maximum 65535 characters)');
    }

    return true;
  }

  /**
   * Create a new comment on a post or reply to another comment
   * @param {Object} commentData - Comment data
   * @param {string} commentData.parentAuthor - Author of the parent post/comment
   * @param {string} commentData.parentPermlink - Permlink of the parent post/comment
   * @param {string} commentData.body - Content of the comment
   * @param {string} [commentData.title=''] - Title of the comment (usually empty)
   * @param {Object} [commentData.metadata={}] - Metadata for the comment
   * @returns {Promise<Object>} - Result of the operation
   */
  async createComment(commentData) {
    // Get current user
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to comment');
    }

    const username = currentUser.username;

    // Generate comment identifier to prevent duplicates
    const commentId = `${username}_${commentData.parentAuthor}_${commentData.parentPermlink}_${Date.now()}`;

    // Prevent duplicate comment submissions
    if (this.commentInProgress.has(commentId)) {
      throw new Error('Comment operation already in progress');
    }

    try {
      this.commentInProgress.add(commentId);
      this.isProcessing = true;

      // Validate data
      this.validateCommentData(commentData);

      // Generate a unique permlink for the comment
      const permlink = this.generateCommentPermlink(commentData.parentPermlink);

      // Prepare metadata
      const metadata = {
        app: 'cur8.fun/0.0.1',
        format: 'markdown',
        ...(commentData.metadata || {})
      };

      await steemService.ensureLibraryLoaded();

      // Determine login method and platform
      const loginMethod = currentUser.loginMethod || 'privateKey';
      const isMobile = this.isMobileDevice();

      let result;

      // On mobile, notify if keychain isn't available
      if (loginMethod === 'keychain' && isMobile && !this.isKeychainAvailable()) {
        //controlliamo nel localhost se c'è la posting key
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Keychain not available and no posting key found. Please login again.');
        }
        //using the posting key to comment
        result = await this._commentWithKey({
          postingKey,
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink,
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });

      }

      eventEmitter.emit('comment:started', {
        parentAuthor: commentData.parentAuthor,
        parentPermlink: commentData.parentPermlink
      });

      // Use the appropriate method based on login type
      if (loginMethod === 'keychain' && this.isKeychainAvailable()) {
        result = await this._commentWithKeychain({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink,
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else if (loginMethod === 'steemlogin') {
        result = await this._commentWithSteemLogin({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink,
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else {
        // Use direct posting key
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Posting key not available. Please login again.');
        }

        result = await this._commentWithKey({
          postingKey,
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink,
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      }

      // Emit success event
      eventEmitter.emit('comment:created', {
        author: username,
        permlink: permlink,
        parentAuthor: commentData.parentAuthor,
        parentPermlink: commentData.parentPermlink,
        body: commentData.body
      });

      return {
        success: true,
        author: username,
        permlink: permlink,
        body: commentData.body,
        result: result
      };
    } catch (error) {
      console.error('Error creating comment:', error);

      // Elaborate error message based on context
      let errorMessage = error.message || 'Failed to create comment';

      // Handle specific Keychain errors
      if (errorMessage.includes('user canceled')) {
        errorMessage = 'Operation cancelled by user';
        error.isCancelled = true;
      }

      // Emit error event
      eventEmitter.emit('comment:error', {
        error: errorMessage,
        parentAuthor: commentData.parentAuthor,
        parentPermlink: commentData.parentPermlink
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.commentInProgress.delete(commentId);
    }
  }

  /**
   * Update an existing comment
   * @param {Object} commentData - Comment data to update
   * @param {string} commentData.author - Author of the comment
   * @param {string} commentData.permlink - Permlink of the comment to update
   * @param {string} commentData.parentAuthor - Author of the parent post/comment
   * @param {string} commentData.parentPermlink - Permlink of the parent post/comment
   * @param {string} commentData.body - New content of the comment
   * @param {Object} [commentData.metadata={}] - Metadata for the comment
   * @returns {Promise<Object>} - Result of the operation
   */
  async updateComment(commentData) {
    // Get current user
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to edit a comment');
    }

    // Verify user is the comment author
    if (currentUser.username !== commentData.author) {
      throw new Error('You can only edit your own comments');
    }

    const username = currentUser.username;

    // Generate comment identifier to prevent duplicates
    const commentId = `edit_${username}_${commentData.permlink}_${Date.now()}`;

    // Prevent duplicate edit operations
    if (this.commentInProgress.has(commentId)) {
      throw new Error('Edit operation already in progress');
    }

    try {
      this.commentInProgress.add(commentId);
      this.isProcessing = true;

      // Validate data - reusing same validation as creating comments
      this.validateCommentData(commentData);

      // Prepare metadata
      const metadata = {
        app: 'cur8.fun/0.0.1',
        format: 'markdown',
        ...(commentData.metadata || {})
      };

      // Emit an event to update UI
      eventEmitter.emit('comment:edit-started', {
        author: commentData.author,
        permlink: commentData.permlink
      });

      // Use the appropriate method based on login type
      const loginMethod = currentUser.loginMethod || 'privateKey';
      const isMobile = this.isMobileDevice();
      
      let result;

      // Check for mobile + keychain case first
      if (loginMethod === 'keychain' && isMobile && !this.isKeychainAvailable()) {
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Keychain not available and no posting key found. Please login again.');
        }
        
        result = await this._commentWithKey({
          postingKey,
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for edit
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else if (loginMethod === 'keychain' && this.isKeychainAvailable()) {
        result = await this._commentWithKeychain({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for edit
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else if (loginMethod === 'steemlogin') {
        result = await this._commentWithSteemLogin({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for edit
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else {
        // Use direct posting key
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Posting key not available. Please login again.');
        }

        result = await this._commentWithKey({
          postingKey,
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for edit
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      }

      // Emit success event
      eventEmitter.emit('comment:edited', {
        author: username,
        permlink: commentData.permlink,
        parentAuthor: commentData.parentAuthor,
        parentPermlink: commentData.parentPermlink,
        body: commentData.body
      });

      return {
        success: true,
        author: username,
        permlink: commentData.permlink,
        body: commentData.body,
        result: result
      };
    } catch (error) {
      console.error('Error updating comment:', error);
      
      // Elaborate error message based on context
      let errorMessage = error.message || 'Failed to update comment';

      // Handle specific Keychain errors
      if (errorMessage.includes('user canceled')) {
        errorMessage = 'Operation cancelled by user';
        error.isCancelled = true;
      }

      // Emit error event
      eventEmitter.emit('comment:edit-error', {
        error: errorMessage,
        permlink: commentData.permlink
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.commentInProgress.delete(commentId);
    }
  }

  /**
   * Update an existing comment
   * @param {Object} commentData - Comment data
   * @param {string} commentData.author - Author of the comment (must be current user)
   * @param {string} commentData.permlink - Permlink of the comment to update
   * @param {string} commentData.parentAuthor - Author of the parent post/comment
   * @param {string} commentData.parentPermlink - Permlink of the parent post/comment
   * @param {string} commentData.body - Updated content of the comment
   * @param {Object} [commentData.metadata={}] - Metadata for the comment
   * @returns {Promise<Object>} - Result of the operation
   */
  async updateComment(commentData) {
    // Get current user
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to edit a comment');
    }

    const username = currentUser.username;

    // Verify the user is updating their own comment
    if (username !== commentData.author) {
      throw new Error('You can only edit your own comments');
    }

    // Generate comment identifier to prevent duplicates
    const commentId = `edit_${username}_${commentData.permlink}_${Date.now()}`;

    // Prevent duplicate comment submissions
    if (this.commentInProgress.has(commentId)) {
      throw new Error('Comment update operation already in progress');
    }

    try {
      this.commentInProgress.add(commentId);
      this.isProcessing = true;

      // Basic validation
      if (!commentData.body || typeof commentData.body !== 'string') {
        throw new Error('Comment body is required and must be a string');
      }

      if (commentData.body.trim().length < 3) {
        throw new Error('Comment must be at least 3 characters');
      }

      if (commentData.body.length > 65535) {
        throw new Error('Comment is too long (maximum 65535 characters)');
      }

      // Prepare metadata - maintain existing tags
      const metadata = {
        app: 'cur8.fun/0.0.1',
        format: 'markdown',
        ...(commentData.metadata || {})
      };

      await steemService.ensureLibraryLoaded();

      // Determine login method and platform
      const loginMethod = currentUser.loginMethod || 'privateKey';
      const isMobile = this.isMobileDevice();

      let result;
      eventEmitter.emit('comment:update-started', {
        author: commentData.author,
        permlink: commentData.permlink
      });

      // Use the appropriate method based on login type - same as for createComment
      if (loginMethod === 'keychain' && this.isKeychainAvailable()) {
        result = await this._commentWithKeychain({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for updates
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else if (loginMethod === 'steemlogin') {
        result = await this._commentWithSteemLogin({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for updates
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      } else {
        // Use direct posting key
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Posting key not available. Please login again.');
        }

        result = await this._commentWithKey({
          postingKey,
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink: commentData.permlink, // Use existing permlink for updates
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
      }

      // Emit success event
      eventEmitter.emit('comment:updated', {
        author: username,
        permlink: commentData.permlink,
        body: commentData.body
      });

      return {
        success: true,
        author: username,
        permlink: commentData.permlink,
        body: commentData.body,
        result: result
      };
    } catch (error) {
      console.error('Error updating comment:', error);

      // Elaborate error message based on context
      let errorMessage = error.message || 'Failed to update comment';

      // Handle specific Keychain errors
      if (errorMessage.includes('user canceled')) {
        errorMessage = 'Operation cancelled by user';
        error.isCancelled = true;
      }

      // Emit error event
      eventEmitter.emit('comment:update-error', {
        error: errorMessage,
        author: commentData.author,
        permlink: commentData.permlink
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.commentInProgress.delete(commentId);
    }
  }

  /**
   * Generate a unique permlink for a comment
   * @param {string} parentPermlink - Permlink of the parent post/comment
   * @returns {string} - Generated permlink
   * @private
   */
  generateCommentPermlink(parentPermlink) {
    // Sanitize the parent permlink for base - remove all non-alphanumeric characters except dashes
    const sanitized = parentPermlink.replace(/[^a-z0-9\-]/g, '').substring(0, 20);

    // Add timestamp for uniqueness
    const timestamp = new Date().getTime().toString(36);

    // Generate unique permlink - ensure it complies with Steem's permlink requirements
    const permlink = `re-${sanitized}-${timestamp}`;

    // Permlink must be all lowercase and contain only letters, numbers, and hyphens
    const finalPermlink = permlink.toLowerCase().replace(/[^a-z0-9\-]/g, '');

    console.log('Generated permlink:', finalPermlink);
    return finalPermlink;
  }

  /**
   * Create comment using Steem Keychain
   * @param {Object} options - Comment options
   * @returns {Promise<Object>} - Keychain result
   * @private
   */
  _commentWithKeychain(options) {
    return new Promise((resolve, reject) => {
      const { username, parentAuthor, parentPermlink, permlink, title, body, metadata } = options;

      const operations = [
        ['comment', {
          parent_author: parentAuthor,
          parent_permlink: parentPermlink,
          author: username,
          permlink: permlink,
          title: title,
          body: body,
          json_metadata: JSON.stringify(metadata)
        }]
      ];

      window.steem_keychain.requestBroadcast(
        username,
        operations,
        'posting',
        response => {
          if (response.success) {
            resolve(response.result);
          } else {
            // Check if operation was cancelled
            if (response.error && (
              response.error.includes('cancel') ||
              response.error.includes('Cancel') ||
              response.error === 'user_cancel')
            ) {
              const cancelError = new Error('USER_CANCELLED');
              cancelError.isCancelled = true;
              reject(cancelError);
            } else {
              reject(new Error(response.message || response.error || 'Failed to create comment using Keychain'));
            }
          }
        }
      );
    });
  }

  /**
   * Create comment using SteemLogin
   * @param {Object} options - Comment options
   * @returns {Promise<Object>} - Operation result
   * @private
   */
  async _commentWithSteemLogin(options) {
    const { username, parentAuthor, parentPermlink, permlink, title, body, metadata } = options;

    const token = authService.getSteemLoginToken();
    if (!token) {
      throw new Error('SteemLogin token not available');
    }

    try {
      // Call SteemLogin API to comment
      const response = await fetch('https://api.steemlogin.com/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operations: [
            ['comment', {
              parent_author: parentAuthor,
              parent_permlink: parentPermlink,
              author: username,
              permlink: permlink,
              title: title,
              body: body,
              json_metadata: JSON.stringify(metadata)
            }]
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to comment through SteemLogin');
      }

      return await response.json();
    } catch (error) {
      console.error('SteemLogin comment error:', error);
      throw error;
    }
  }

  /**
   * Create comment using direct posting key
   * @param {Object} options - Comment options
   * @returns {Promise<Object>} - Operation result
   * @private
   */
  _commentWithKey(options) {
    return new Promise((resolve, reject) => {
      const {
        postingKey,
        username,
        parentAuthor,
        parentPermlink,
        permlink,
        title,
        body,
        metadata
      } = options;

      console.log(`Attempting to comment with posting key: @${username} on @${parentAuthor}/${parentPermlink}`);

      // Validate essential parameters
      if (!postingKey) {
        return reject(new Error('Missing posting key'));
      }

      if (!username) {
        return reject(new Error('Missing username'));
      }

      if (!parentPermlink) {
        return reject(new Error('Missing parent permlink'));
      }

      if (!permlink) {
        return reject(new Error('Missing comment permlink'));
      }

      // Ensure parentPermlink doesn't contain invalid characters
      const sanitizedParentPermlink = parentPermlink.replace(/[^a-zA-Z0-9\-]/g, '');

      // Convert metadata to string if it's not already
      const metadataString = typeof metadata === 'string'
        ? metadata
        : JSON.stringify(metadata || {});

      // Debug log the comment parameters
      console.log('Comment parameters:', {
        parentAuthor,
        parentPermlink: sanitizedParentPermlink,
        author: username,
        permlink,
        title: title || '',
        bodyLength: body ? body.length : 0,
        hasMetadata: !!metadataString
      });

      try {
        window.steem.broadcast.comment(
          postingKey,
          parentAuthor,
          sanitizedParentPermlink,  // Use sanitized parent permlink
          username,
          permlink,
          title || '',
          body || '',
          metadataString,
          (err, result) => {
            if (err) {
              console.error('Steem broadcast comment error:', err);

              // Detailed error logging
              if (typeof err === 'object') {
                console.error('Error details:', JSON.stringify(err, null, 2));
              }

              // Properly format error message
              let errorMessage;
              if (typeof err === 'object') {
                if (err.message) {
                  errorMessage = err.message;
                } else if (err.error && err.error.message) {
                  errorMessage = err.error.message;
                } else if (err.error_description) {
                  errorMessage = err.error_description;
                } else if (err.data && err.data.stack && err.data.stack[0] && err.data.stack[0].format) {
                  errorMessage = err.data.stack[0].format;
                } else {
                  errorMessage = JSON.stringify(err);
                }
              } else if (typeof err === 'string') {
                errorMessage = err;
              } else {
                errorMessage = 'Unknown error occurred while commenting';
              }

              reject(new Error(errorMessage));
            } else {
              console.log('Comment successful with posting key:', result);
              resolve(result);
            }
          }
        );
      } catch (e) {
        console.error('Exception in _commentWithKey:', e);
        reject(new Error(`Failed to submit comment: ${e.message || 'Unknown error'}`));
      }
    });
  }

  /**
   * Test method for commenting using Keychain
   * @param {string} parentAuthor - Author of the parent post/comment
   * @param {string} parentPermlink - Permlink of the parent post/comment
   * @param {string} body - Content of the comment
   * @returns {Promise<Object>} - Operation result
   */
  async testCommentWithKeychain(parentAuthor, parentPermlink, body) {
    if (!this.isKeychainAvailable()) {
      console.error('Steem Keychain is not installed or not available');
      return { success: false, error: 'Keychain not available' };
    }

    const user = authService.getCurrentUser();
    if (!user) {
      console.error('User not logged in');
      return { success: false, error: 'Not logged in' };
    }

    console.log(`Attempting to comment on @${parentAuthor}/${parentPermlink} with Keychain`);

    try {
      const result = await this.createComment({
        parentAuthor,
        parentPermlink,
        body,
        metadata: {
          app: 'steemee/1.0',
          format: 'markdown',
          test: 'keychain_comment_test'
        }
      });

      console.log('Comment success:', result);
      return { success: true, result };
    } catch (error) {
      console.error('Comment failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const commentService = new CommentService();
export default commentService;