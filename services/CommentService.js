import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

/**
 * Service for handling comments on posts
 */
class CommentService {
  constructor() {
    this.isProcessing = false;
  }
  
  /**
   * Verifica se Keychain è disponibile nel browser
   * @returns {boolean} True se Keychain è disponibile
   */
  isKeychainAvailable() {
    return typeof window !== 'undefined' && 
           typeof window.steem_keychain !== 'undefined' &&
           !!window.steem_keychain;
  }

  /**
   * Valida i dati di un commento
   * @param {Object} commentData - Dati del commento da validare
   * @throws {Error} Se i dati non sono validi
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
    if (this.isProcessing) {
      throw new Error('Another comment is being processed');
    }
    
    try {
      this.isProcessing = true;
      
      // Valida i dati
      this.validateCommentData(commentData);
      
      // Get current user
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('You must be logged in to comment');
      }
      
      const username = currentUser.username;
      const loginMethod = currentUser.loginMethod || 'privateKey';
      
      // Generate a unique permlink for the comment
      const permlink = this.generateCommentPermlink(commentData.parentPermlink);
      
      // Prepare metadata
      const metadata = {
        app: 'steemee/1.0',
        format: 'markdown',
        ...(commentData.metadata || {})
      };
      
      let result;
      
      // Use the appropriate method based on login type
      if (loginMethod === 'steemlogin') {
        throw new Error('SteemLogin implementation is pending');
      } else if (loginMethod === 'keychain') {
        // Verifica esplicita che Keychain sia disponibile
        if (!this.isKeychainAvailable()) {
          throw new Error('Steem Keychain is not installed or not available');
        }
        
        console.log('Creating comment with Keychain:', {
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink
        });
        
        // Use Keychain
        result = await this.createCommentWithKeychain({
          username,
          parentAuthor: commentData.parentAuthor,
          parentPermlink: commentData.parentPermlink,
          permlink,
          title: commentData.title || '',
          body: commentData.body,
          metadata
        });
        
        console.log('Keychain comment result:', result);
      } else {
        // Use direct posting key
        await steemService.ensureLibraryLoaded();
        const postingKey = authService.getPostingKey();
        if (!postingKey) {
          throw new Error('Posting key not available. Please login again.');
        }
        
        result = await steemService.createComment(
          commentData.parentAuthor,
          commentData.parentPermlink,
          username,
          permlink,
          commentData.title || '',
          commentData.body,
          metadata
        );
      }
      
      // Emetti evento di successo
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
      
      // Emetti evento di errore
      eventEmitter.emit('comment:error', {
        error: errorMessage
      });
      
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Metodo di test per commentare usando Keychain
   * @param {string} parentAuthor - Autore del post/commento principale
   * @param {string} parentPermlink - Permlink del post/commento principale
   * @param {string} body - Contenuto del commento
   * @returns {Promise<Object>} - Risultato dell'operazione
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
  
  /**
   * Generate a unique permlink for a comment
   * @param {string} parentPermlink - Permlink of the parent post/comment
   * @returns {string} - Generated permlink
   * @private
   */
  generateCommentPermlink(parentPermlink) {
    // Sanitize the parent permlink for base
    const sanitized = parentPermlink.replace(/[^a-z0-9\-]/g, '').substring(0, 20);
    
    // Add timestamp for uniqueness
    const timestamp = new Date().getTime().toString(36);
    
    // Generate unique permlink
    return `re-${sanitized}-${timestamp}`;
  }
  
  /**
   * Create comment using Steem Keychain
   * @param {Object} options - Comment options
   * @returns {Promise<Object>} - Keychain result
   * @private
   */
  createCommentWithKeychain(options) {
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
            reject(new Error(response.message || 'Failed to create comment using Keychain'));
          }
        }
      );
    });
  }
}

// Create and export singleton instance
const commentService = new CommentService();
export default commentService;