import eventEmitter from '../utils/EventEmitter.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.tokenExpiryTime = null;
  }
  
  init() {
    if (this.isInitialized) return;
    
    // Load stored user data
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        this.currentUser = JSON.parse(userData);
        
        // Set up token refresh if needed
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        if (tokenExpiry) {
          this.tokenExpiryTime = parseInt(tokenExpiry, 10);
          this.setupTokenRefresh();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      this.logout(); // Clean up potentially corrupted state
    }
    
    this.isInitialized = true;
    return this;
  }
  
  setupTokenRefresh() {
    const now = Date.now();
    if (this.tokenExpiryTime > now) {
      const timeUntilRefresh = Math.max(0, this.tokenExpiryTime - now - 60000); // Refresh 1 minute before expiry
      setTimeout(() => this.refreshToken(), timeUntilRefresh);
    } else {
      this.refreshToken();
    }
  }
  
  async refreshToken() {
    // Implement token refresh logic with Steem blockchain
    console.log('Refreshing authentication token');
    
    // For now, we'll just extend the expiry time
    this.tokenExpiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    localStorage.setItem('tokenExpiry', this.tokenExpiryTime.toString());
    this.setupTokenRefresh();
  }
  
  async login(username, privateKey) {
    try {
      // Validate credentials with Steem blockchain
      
      // For demo, just store the user
      this.currentUser = { 
        username, 
        avatar: `https://steemitimages.com/u/${username}/avatar` 
      };
      
      // Set token expiry (24 hours)
      this.tokenExpiryTime = Date.now() + 24 * 60 * 60 * 1000;
      
      // Store authentication state
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      localStorage.setItem('tokenExpiry', this.tokenExpiryTime.toString());
      
      // Set up refresh timer
      this.setupTokenRefresh();
      
      // Emit auth change event
      eventEmitter.emit('auth:changed', { user: this.currentUser });
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }
  
  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('tokenExpiry');
    
    // Emit auth change event
    eventEmitter.emit('auth:changed', { user: null });
  }
  
  isAuthenticated() {
    return !!this.currentUser;
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
}

// Create singleton instance
const authService = new AuthService().init();
export default authService;
