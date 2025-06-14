import steemService from './SteemService.js';
import eventEmitter from '../utils/EventEmitter.js';

/**
 * Service for handling account creation on Steem
 */
class RegisterService {
  constructor() {
    this.isProcessing = false;
    this.API_ENDPOINT = 'https://imridd.eu.pythonanywhere.com/api/steem/create_account';
  }
  
  /**
   * Create a new Steem account
   * Note: Creating Steem accounts requires STEEM to pay the fee
   */
  async createAccount(userData) {
    if (this.isProcessing) {
      throw new Error('Account creation already in progress');
    }
    
    this.isProcessing = true;
    
    try {
      // Validate user data (only username required)
      this.validateUserData(userData);
      
      // Emit the registration start event
      eventEmitter.emit('register:started', { username: userData.username });
      
      // Ensure Steem library is loaded
      await steemService.ensureLibraryLoaded();
      
      // Call the account creation API
      const result = await this.createSteemAccount(userData);
      
      // Notify of success
      eventEmitter.emit('register:completed', {
        success: true,
        username: userData.username,
        keys: result.keys
      });
      
      return {
        success: true,
        username: userData.username,
        message: result.message || "Account created successfully!",
        keys: result.keys
      };
    } catch (error) {
      console.error('Error creating account:', error);
      
      // Notify of error
      eventEmitter.emit('register:error', {
        error: error.message || 'Failed to create account'
      });
      
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Validate user registration data (only username required)
   */
  validateUserData(userData) {
    const { username } = userData;
    
    if (!username || username.length < 3 || username.length > 16) {
      throw new Error('Username must be between 3 and 16 characters');
    }
    
    if (!this.isValidSteemUsername(username)) {
      throw new Error('Username can only contain lowercase letters, numbers, dots and dashes');
    }
  }
  
  /**
   * Check if username meets Steem requirements
   */
  isValidSteemUsername(username) {
    // Fix: Place dash at end of character class to avoid regex error
    const regex = /^[a-z0-9.][a-z0-9.-]*[a-z0-9]$/;
    return regex.test(username) && !username.includes('--');
  }
  
  /**
   * Check if account already exists on the blockchain
   */
  async checkAccountExists(username) {
    try {
      const response = await fetch('https://api.moecki.online', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "condenser_api.get_accounts",
          params: [[username]],
          id: 1
        })
      });

      const data = await response.json();
      return data.result && data.result.length > 0;
    } catch (error) {
      console.error('Failed to check account existence:', error);
      throw new Error('Failed to check account availability');
    }
  }
  /**
   * Create Steem account
   * @param {Object} userData - User data including username
   * @returns {Promise<Object>} - Response from the API including keys
   */
  async createSteemAccount(userData) {
    const { username } = userData;
    
    // First check if account already exists
    const accountExists = await this.checkAccountExists(username);
    if (accountExists) {
      throw new Error('This account name already exists. Please choose a different name.');
    }
    
    try {
      // Check if Telegram ID is available
      const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (!telegramId) {
        throw new Error('Telegram authentication is required to create an account.');
      }
      
      console.log(`Sending request to create account: ${username} with Telegram ID: ${telegramId}`);
      
      // Import the ApiClient from api-ridd.js
      const { ApiClient } = await import('../services/api-ridd.js');
      const apiClient = new ApiClient();
      
      // Use the createAccount method from ApiClient
      const response = await apiClient.createAccount(username);
      console.log('Response data from API:', response);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to create account');
      }
      
      // In a real scenario, keys would be provided by the API
      // For now, we'll use placeholder keys for the UI
      const keys = {
        owner_key: response.owner_key || 'OWNER_KEY_PROVIDED_TO_TELEGRAM',
        active_key: response.active_key || 'ACTIVE_KEY_PROVIDED_TO_TELEGRAM',
        posting_key: response.posting_key || 'POSTING_KEY_PROVIDED_TO_TELEGRAM',
        memo_key: response.memo_key || 'MEMO_KEY_PROVIDED_TO_TELEGRAM'
      };
      
      return {
        success: true,
        message: 'Account created successfully! Check your Telegram for account details.',
        keys: keys
      };
    } catch (error) {
      console.error('API error creating account:', error);
      throw error; // Preserve the original error
    }
  }
}

// Create and export singleton instance
const registerService = new RegisterService();
export default registerService;