class SteemApi {
  constructor() {
    // Default API nodes for Hive blockchain
    this.apiNodes = [
        'https://api.moecki.online',
        'https://api.steemit.com',
        'https://api.steemitdev.com',
        'https://api.steemzzang.com',
        'https://api.steemit.com',
        'https://api.steemitstage.com',
        'https://api.steem.house',
        'https://api.steem.place',
        'https://api.steem.press',
        'https://api.steemstack.io',
        'https://api.steemtools.com',
        'https://api.steemul.com',
        'https://api.steemworld.org',
        'https://api.steemyy.com',
        'https://api.steemzzang.com',
    ];
    
    this.currentNode = 0; // Index of the current node to use
    this.maxRetries = 3; // Maximum number of node switching retries
  }

  /**
   * Makes a direct API call to the blockchain without using a client library
   * @param {string} method - The API method to call
   * @param {Array} params - The parameters for the API call
   * @returns {Promise<any>} - The API response
   */
  async callApi(method, params) {
    let retriesLeft = this.maxRetries;
    let error;
    
    while (retriesLeft > 0) {
      try {
        const node = this.apiNodes[this.currentNode];
        console.log(`Calling ${method} on ${node}`);
        
        const response = await fetch(node, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: 1
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        return data.result;
      } catch (err) {
        console.error(`Error on node ${this.apiNodes[this.currentNode]}:`, err);
        error = err;
        // Switch to next node
        this.currentNode = (this.currentNode + 1) % this.apiNodes.length;
        retriesLeft--;
      }
    }
    
    throw error || new Error('Failed to call API after multiple retries');
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