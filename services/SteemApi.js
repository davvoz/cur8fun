import steemService from './SteemService.js';

class SteemApi {
  constructor() {
    // Node list and retry logic is managed centrally by SteemCore via steemService.rpcCall
  }

  /**
   * Makes a direct API call to the blockchain, delegating to SteemCore for node failover.
   * @param {string} method - The API method to call
   * @param {*} params - The parameters for the API call
   * @returns {Promise<any>} - The API response
   */
  async callApi(method, params) {
    return steemService.rpcCall(method, params);
  }

  /**
   * Get content replies directly from the blockchain
   * @param {string} author - The author of the content
   * @param {string} permlink - The permlink of the content
   * @returns {Promise<Array>} - An array of replies
   */
  async getContentReplies(author, permlink) {
    try {
      console.log(`Fetching replies for @${author}/${permlink}`);
      
      const result = await this.callApi('bridge.get_discussion', { author, permlink });
      
      // The bridge API returns a discussion object where keys are author/permlink strings
      // We need to convert this to an array of comments, excluding the original post
      const replies = [];
      
      if (result) {
        // Iterate through each key in the result
        Object.keys(result).forEach(key => {
          // Skip the original post
          if (key !== `${author}/${permlink}`) {
            replies.push(result[key]);
          }
        });
        
        console.log(`Found ${replies.length} replies for @${author}/${permlink}`);
      } else {
        console.log(`No replies found for @${author}/${permlink}`);
      }
      
      return replies;
    } catch (error) {
      console.error(`Error fetching content replies for @${author}/${permlink}:`, error);
      return [];
    }
  }

  /**
   * Get content directly from the blockchain
   * @param {string} author - The author of the content
   * @param {string} permlink - The permlink of the content
   * @returns {Promise<Object>} - The content object
   */
  async getContent(author, permlink) {
    try {
      return await this.callApi('condenser_api.get_content', [author, permlink]);
    } catch (error) {
      console.error(`Error fetching content for @${author}/${permlink}:`, error);
      return null;
    }
  }

  /**
   * Get nested replies recursively to build a comment tree
   * @param {string} author - The author of the content
   * @param {string} permlink - The permlink of the content
   * @returns {Promise<Array>} - An array of comments with nested children
   */
  async getNestedReplies(author, permlink) {
    try {
      console.log(`Fetching nested replies for @${author}/${permlink}`);
      
      // Get all replies for this content
      const replies = await this.getContentReplies(author, permlink);
      
      if (!replies || replies.length === 0) {
        return [];
      }
      
      // For each reply, recursively get its replies
      for (const reply of replies) {
        reply.children = await this.getNestedReplies(reply.author, reply.permlink);
      }
      
      return replies;
    } catch (error) {
      console.error(`Error fetching nested replies for @${author}/${permlink}:`, error);
      return [];
    }
  }
}

// Create singleton instance
const steemApi = new SteemApi();
export default steemApi;