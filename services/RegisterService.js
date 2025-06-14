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
   */  async createSteemAccount(userData) {
    const { username } = userData;
    
    // First check if account already exists
    const accountExists = await this.checkAccountExists(username);
    if (accountExists) {
      throw new Error('This account name already exists. Please choose a different name.');
    }
    
    try {      // Detect Telegram in multiple ways with stricter validation
      const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
      const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
      const telegramId = telegramData?.user?.id;
      const telegramUsername = telegramData?.user?.username;
      
      // Check for real Telegram app integration - MUST have actual user data
      const hasTelegramAuth = !!telegramId && !!telegramUsername;
      
      // Other indicators (less reliable)
      const secondaryTelegramIndicators = 
          window.location.href.includes('tgWebApp=') || 
          navigator.userAgent.toLowerCase().includes('telegram') ||
          document.referrer.toLowerCase().includes('telegram');
          
      // Only consider truly IN Telegram if we have user data or WebApp integration
      const isInTelegram = hasTelegramAuth || isTelegramWebView;
        // Log comprehensive Telegram status for debugging
      console.log('Telegram Status for Account Creation:', {
        isTelegramWebView,
        isInTelegram,
        hasTelegramAuth,
        telegramId,
        telegramUsername,
        telegramData,
        secondaryTelegramIndicators,
        agent: navigator.userAgent,
        url: window.location.href
      });
        // Only strict validation for production environment 
      const isLocalDev = window.location.hostname.includes('localhost') || 
                       window.location.hostname.includes('127.0.0.1') ||
                       window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;
      
      if (!isLocalDev) {
        // In production, require actual Telegram user data
        if (!hasTelegramAuth) {
          throw new Error('Complete Telegram authentication is required. Please open this app directly from Telegram and ensure you are logged in with a Telegram account that has a username.');
        }
      }
      
      // Import the ApiClient from api-ridd.js
      const { ApiClient } = await import('../services/api-ridd.js');
      const apiClient = new ApiClient();
      
      // Log request details
      console.log(`Sending account creation request: 
        - Username: ${username}
        - Telegram ID: ${telegramId || 'Not available'}
        - Telegram Username: ${telegramUsername || 'Not available'}
        - Is in Telegram: ${isInTelegram}
      `);
      
      // Set a timeout to detect long-running requests
      const TIMEOUT_MS = 30000; // 30 seconds
      let timeoutId;
      
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Account creation request timed out after ${TIMEOUT_MS/1000} seconds. The server might be busy or experiencing issues.`));
        }, TIMEOUT_MS);
      });
      
      // Use the createAccount method from ApiClient with better error handling
      let response;
      try {
        console.log(`Sending createAccount request for username: ${username}`);
        
        // Race between actual request and timeout
        const requestPromise = apiClient.createAccount(username);
        response = await Promise.race([requestPromise, timeoutPromise]);
        
        // Clear timeout if request completes
        clearTimeout(timeoutId);
        
        console.log('Raw response data from API:', response);
      } catch (apiError) {
        // Clear timeout if request fails
        clearTimeout(timeoutId);
        
        // More detailed error logging
        console.error('API request error:', apiError);
        console.error('Error details:', {
          message: apiError.message,
          name: apiError.name,
          stack: apiError.stack,
          url: apiClient.baseUrl + '/create_account'
        });
        
        // Provide more helpful error messages based on error type
        if (apiError.message.includes('NetworkError') || 
            apiError.message.includes('Failed to fetch') ||
            apiError.message.includes('Network request failed')) {
          throw new Error('Network connection error: Please check your internet connection and try again.');
        } else if (apiError.message.includes('timed out')) {
          throw new Error('Server response timeout: The account creation service is taking too long to respond. Please try again later.');
        } else {
          throw new Error(`API error: ${apiError.message || 'Connection failed'}`);
        }
      }      // Use our helper method to check if the response indicates success
      const parsedResponse = this.parseResponseForSuccess(response);
      
      // Log detailed parsing results
      console.log('Account creation API response analysis:', {
        originalResponse: response,
        parsedResult: parsedResponse,
        rawMessage: response?.message || 'No message',
        hasKeys: !!response?.keys
      });
      
      // If response doesn't exist or isn't valid
      if (!response) {
        console.error('Empty API response');
        throw new Error('No response from account creation API');
      }
      
      // Convert string responses to objects if needed
      if (typeof response !== 'object') {
        console.log('Converting non-object response to object:', response);
        response = {
          success: parsedResponse.success,
          message: String(response)
        };
      }
      
      // Override success flag if needed based on message content
      if (parsedResponse.success && !response.success) {
        console.log('Message indicates success but response.success is false. Overriding.');
        response.success = true;
      }
      
      // If we extracted a username from the message, add it to the response
      if (parsedResponse.username && !response.username) {
        response.username = parsedResponse.username;
      }
      
      // Handle actual error cases (only if our parser also confirms it's an error)
      if (!response.success && !parsedResponse.success) {
        const errorMessage = response.message || 'Failed to create account';
        const errorCode = response.statusCode || 'unknown';
        console.error(`Account creation failed: ${errorMessage} (code: ${errorCode})`);
        
        // More user-friendly error messages
        if (response.statusCode === 429) {
          throw new Error('Too many requests. Please wait a few minutes and try again.');
        } else if (response.message && response.message.includes('already exists')) {
          throw new Error('This username is already taken. Please choose a different username.');
        } else {
          throw new Error(errorMessage);
        }
      }
        // Extract keys from response or use placeholders for development
      let keys = {};
      
      // Check if keys are in the response directly
      if (response.owner_key || response.active_key || response.posting_key || response.memo_key) {
        keys = {
          owner_key: response.owner_key || 'OWNER_KEY_PROVIDED_TO_TELEGRAM',
          active_key: response.active_key || 'ACTIVE_KEY_PROVIDED_TO_TELEGRAM',
          posting_key: response.posting_key || 'POSTING_KEY_PROVIDED_TO_TELEGRAM',
          memo_key: response.memo_key || 'MEMO_KEY_PROVIDED_TO_TELEGRAM'
        };
      } 
      // Check if keys are in a nested 'keys' object
      else if (response.keys && typeof response.keys === 'object') {
        console.log('Found keys in nested object:', response.keys);
        keys = {
          owner_key: response.keys.owner_key || 'OWNER_KEY_PROVIDED_TO_TELEGRAM',
          active_key: response.keys.active_key || 'ACTIVE_KEY_PROVIDED_TO_TELEGRAM',
          posting_key: response.keys.posting_key || 'POSTING_KEY_PROVIDED_TO_TELEGRAM',
          memo_key: response.keys.memo_key || 'MEMO_KEY_PROVIDED_TO_TELEGRAM',
          master_key: response.keys.master_key || null
        };
      } 
      // Default placeholders if no keys found
      else {
        keys = {
          owner_key: 'OWNER_KEY_PROVIDED_TO_TELEGRAM',
          active_key: 'ACTIVE_KEY_PROVIDED_TO_TELEGRAM',
          posting_key: 'POSTING_KEY_PROVIDED_TO_TELEGRAM',
          memo_key: 'MEMO_KEY_PROVIDED_TO_TELEGRAM'
        };
      }
      
      // In development mode, show more explicit key values
      if (isLocalDev) {
        console.log('Development mode: Using mock keys for local testing');
        keys.owner_key = `MOCK_OWNER_KEY_FOR_${username}`;
        keys.active_key = `MOCK_ACTIVE_KEY_FOR_${username}`;
        keys.posting_key = `MOCK_POSTING_KEY_FOR_${username}`;
        keys.memo_key = `MOCK_MEMO_KEY_FOR_${username}`;
      }
      
      return {
        success: true,
        message: response.message || 'Account created successfully! Check your Telegram for account details.',
        keys: keys,
        telegramId: telegramId,
        isInTelegram: isInTelegram
      };
    } catch (error) {
      console.error('API error creating account:', error);
      throw error; // Preserve the original error
    }
  }
  
  /**
   * Parse a response or error message to check if it indicates success
   * @param {Object|string} response - The API response or error message
   * @returns {Object} - Parsed result with success flag and extracted data
   */
  parseResponseForSuccess(response) {
    // If it's a string, convert to object with message property
    if (typeof response === 'string') {
      response = { message: response };
    }
    
    // If it's an error object with a message property
    if (response instanceof Error) {
      response = { message: response.message };
    }
    
    // Default values
    const result = {
      success: false,
      message: '',
      username: null
    };
    
    // If no response or not an object, return default failure
    if (!response || typeof response !== 'object') {
      return result;
    }
    
    // Get the message (might be in different properties)
    const message = response.message || response.error || response.status || '';
    result.message = message;
    
    // Check if the message contains a success indicator
    const successIndicators = [
      'created successfully',
      'account created',
      'success'
    ];
    
    const hasSuccessIndicator = successIndicators.some(indicator => 
      message.toLowerCase().includes(indicator));
    
    // Extract username if available
    if (hasSuccessIndicator) {
      const patterns = [
        /Account (\w+) created successfully/i,
        /(\w+) account created/i,
        /account (\w+) has been created/i,
        /created account (\w+)/i
      ];
      
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          result.username = match[1];
          break;
        }
      }
      
      // Set success flag if success message found
      result.success = true;
    }
    
    return result;
  }
  
  /**
   * Test di connessione all'API
   * Verifica se il servizio API è raggiungibile e funzionante
   */
  async testApiConnection() {
    try {
      console.log('Testing API connection...');
      
      // Import the ApiClient from api-ridd.js
      const { ApiClient } = await import('../services/api-ridd.js');
      const apiClient = new ApiClient();
      
      // Check if baseUrl is correctly set
      if (!apiClient.baseUrl) {
        return {
          success: false,
          message: 'API client not properly initialized - missing baseUrl'
        };
      }
      
      // Try a simple GET request to test connectivity
      // This uses just a HEAD request to the base URL to check if the service is up
      const url = apiClient.baseUrl;
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'API connection successful',
          status: response.status,
          endpoint: url
        };
      } else {
        return {
          success: false,
          message: 'API returned error status',
          status: response.status,
          endpoint: url
        };
      }
    } catch (error) {
      console.error('API connection test failed:', error);
      return {
        success: false,
        message: `API connection error: ${error.message}`,
        error: error
      };
    }
  }
  
  /**
   * Verifica la disponibilità del servizio di creazione account
   * Controlla se il servizio può creare nuovi account
   */
  async checkAccountCreationService() {
    try {
      // Test basic connectivity first
      const connectionTest = await this.testApiConnection();
      
      if (!connectionTest.success) {
        return connectionTest;
      }
      
      // Import the ApiClient
      const { ApiClient } = await import('../services/api-ridd.js');
      const apiClient = new ApiClient();
      
      // We don't want to actually create an account, so we'll make a custom request
      // to check if the endpoint is available
      const url = `${apiClient.baseUrl}/create_account`;
      
      try {
        // Just check if the endpoint exists and responds
        // Use OPTIONS to avoid actually creating an account
        const response = await fetch(url, { method: 'OPTIONS' });
        
        return {
          success: true,
          message: 'Account creation service is available',
          status: response.status,
          endpoint: url
        };
      } catch (error) {
        return {
          success: false,
          message: `Account creation service error: ${error.message}`,
          endpoint: url,
          error: error
        };
      }
    } catch (error) {
      console.error('Account creation service check failed:', error);
      return {
        success: false,
        message: `Service check error: ${error.message}`,
        error: error
      };
    }
  }
}

// Create and export singleton instance
const registerService = new RegisterService();
export default registerService;