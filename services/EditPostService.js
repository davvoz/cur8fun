import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';
import createPostService from './CreatePostService.js';

/**
 * Service for editing posts
 */
class EditPostService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * Fetches a post by author and permlink
   * @param {string} author - Post author
   * @param {string} permlink - Post permlink
   * @returns {Promise<Object>} - Post data
   */
  async getPost(author, permlink) {
    try {
      await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        window.steem.api.getContent(author, permlink, (err, post) => {
          if (err) {
            reject(err);
          } else if (!post || !post.author) {
            reject(new Error('Post not found'));
          } else {
            // Prepare post data
            const postData = this.preparePostDataFromResponse(post);
            resolve(postData);
          }
        });
      });
    } catch (error) {
      console.error('Failed to fetch post:', error);
      throw new Error(`Failed to fetch post: ${error.message}`);
    }
  }

  /**
   * Prepare post data from API response
   * @param {Object} post - Post data from API
   * @returns {Object} - Prepared post data
   */
  preparePostDataFromResponse(post) {
    // Parse JSON metadata
    let metadata = {};
    try {
      metadata = JSON.parse(post.json_metadata || '{}');
    } catch (e) {
      console.warn('Failed to parse post metadata:', e);
    }

    // Extract community from metadata or parent permlink
    let community = null;
    if (metadata.community) {
      community = metadata.community;
    } else if (post.parent_permlink && post.parent_permlink.startsWith('hive-')) {
      community = post.parent_permlink.replace('hive-', '');
    }

    // Extract tags
    const tags = metadata.tags || [];

    return {
      author: post.author,
      permlink: post.permlink,
      title: post.title,
      body: post.body,
      tags: tags,
      community: community,
      parentPermlink: post.parent_permlink,
      originalMetadata: metadata
    };
  }

  /**
   * Updates an existing post
   * @param {Object} postData - Post data to update
   * @returns {Promise<Object>} - Result of the update
   */
  async updatePost(postData) {
    if (this.isProcessing) {
      throw new Error('Another post is already being processed');
    }

    if (!authService.isAuthenticated()) {
      throw new Error('You must be logged in to edit a post');
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser.username !== postData.author) {
      throw new Error('You can only edit your own posts');
    }

    try {
      this.isProcessing = true;
      eventEmitter.emit('post:update-started', { title: postData.title });
      
      // Validate input data
      this.validatePostData(postData);
      await steemService.ensureLibraryLoaded();
      
      // Prepare post update data
      const updateDetails = await this.preparePostUpdateDetails(postData);
      
      // Broadcast the update using available method
      const result = await this.broadcastUsingAvailableMethod(updateDetails);
      
      this.emitSuccessEvent(updateDetails);
      return result;
    } catch (error) {
      this.handlePostUpdateError(error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  preparePostUpdateDetails(postData) {
    const { title, body, tags, community, permlink, author, originalMetadata } = postData;
    const currentUser = authService.getCurrentUser();
    
    if (currentUser.username !== author) {
      throw new Error('You can only edit your own posts');
    }
    
    // Process tags - maintaining compatibility with createPostService
    const processedTags = createPostService.processTags(tags);
    
    // Determine parent permlink - for edits, we should use the original parent permlink
    // If community is provided, ensure it's in the correct format
    const parentPermlink = postData.parentPermlink || 
                          (community ? `hive-${community.replace(/^hive-/, '')}` : 
                          (processedTags[0] || 'steemee'));
    
    // Prepare metadata - preserve original metadata and update tags
    const metadata = {
      ...originalMetadata,
      tags: processedTags,
      app: 'steemee/1.0',
      format: 'markdown'
    };
    
    // Update community if provided
    if (community) {
      metadata.community = community;
    }
    
    return {
      username: author,
      title,
      body,
      permlink,
      parentPermlink,
      metadata
    };
  }

  async broadcastUsingAvailableMethod(postDetails) {
    const postingKey = authService.getPostingKey();
    const hasKeychain = typeof window.steem_keychain !== 'undefined';
    const isMobile = createPostService.isMobileDevice();
    
    let result;
    
    if (postingKey) {
      result = await this.broadcastPostUpdate({
        ...postDetails,
        postingKey
      });
    } 
    else if (hasKeychain) {
      if (isMobile && !window.steem_keychain) {
        throw new Error('Steem Keychain is not available on this mobile browser. Please use a desktop browser or log in with your posting key.');
      }
      
      result = await this.broadcastPostUpdateWithKeychain(postDetails);
    }
    else {
      throw new Error('No valid posting credentials available. Please login with your posting key or install Steem Keychain.');
    }
    
    return result;
  }

  broadcastPostUpdateWithKeychain({ username, parentPermlink, title, body, permlink, metadata }) {
    return new Promise((resolve, reject) => {
      const jsonMetadata = JSON.stringify(metadata);
      
      // Create operations array for update
      const operations = [
        ['comment', {
          parent_author: '',
          parent_permlink: parentPermlink,
          author: username,
          permlink: permlink,
          title: title,
          body: body,
          json_metadata: jsonMetadata
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
            if (response.error && (
                response.error.includes('cancel') || 
                response.error.includes('Cancel') ||
                response.error === 'user_cancel')) {
              const cancelError = new Error('Operation cancelled by user');
              cancelError.isCancelled = true;
              reject(cancelError);
            } else {
              reject(new Error(response.message || response.error || 'Keychain broadcast failed'));
            }
          }
        }
      );
    });
  }
  
  async broadcastPostUpdate({ username, postingKey, parentPermlink, title, body, permlink, metadata }) {
    const jsonMetadata = JSON.stringify(metadata);
    
    return new Promise((resolve, reject) => {
      window.steem.broadcast.comment(
        postingKey,          // Posting key
        '',                  // Parent author (empty for post updates)
        parentPermlink,      // Parent permlink (original parent)
        username,            // Author
        permlink,            // Permlink (original)
        title,               // Title
        body,                // Body
        jsonMetadata,        // JSON metadata
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  validatePostData(postData) {
    // Reuse validation from CreatePostService
    createPostService.validatePostData(postData);
    
    // Additional validation specific to editing
    if (!postData.permlink) {
      throw new Error('Post permlink is required for editing');
    }
    
    if (!postData.author) {
      throw new Error('Post author is required for editing');
    }
  }

  emitSuccessEvent(postDetails) {
    eventEmitter.emit('post:update-completed', {
      success: true,
      author: postDetails.username,
      permlink: postDetails.permlink,
      title: postDetails.title,
      community: postDetails.metadata.community
    });
  }

  handlePostUpdateError(error) {
    console.error('Error updating post:', error);
    
    let errorMessage = error.message || 'Unknown error occurred while updating post';
    
    if (error.message && (
        error.message.includes('cancel') || 
        error.message.includes('Cancel') ||
        error.message.includes('Request was canceled'))) {
      errorMessage = 'Operation was cancelled.';
    }
    
    eventEmitter.emit('post:update-error', { error: errorMessage });
  }
}

// Create and export singleton instance
const editPostService = new EditPostService();
export default editPostService;
