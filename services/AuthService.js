import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';

/**
 * Service for handling user authentication
 */
class AuthService {
    constructor() {
        this.currentUser = this.loadUserFromStorage();
    }

    /**
     * Loads user data from localStorage if available
     */
    loadUserFromStorage() {
        try {
            const storedUser = localStorage.getItem('currentUser');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
            console.error('Error loading user from storage:', error);
            return null;
        }
    }

    /**
     * Get the currently logged in user
     */
    getCurrentUser() {
        // Reload from storage in case it was updated in another tab
        if (!this.currentUser) {
            this.currentUser = this.loadUserFromStorage();
        }
        return this.currentUser;
    }

    /**
     * Authenticate a user with their username and private key
     */
    async login(username, privateKey, remember = true) {
        try {
            // Here you'd typically verify credentials with Steem API
            // For now, we're just simulating a successful login

            // Get user profile information
            const userProfile = await steemService.getProfile(username);
            
            const user = {
                username,
                avatar: `https://steemitimages.com/u/${username}/avatar`,
                isAuthenticated: true,
                profile: userProfile?.profile || {},
                timestamp: Date.now()
            };

            // Save to memory
            this.currentUser = user;
            
            // Save to storage if remember is true
            if (remember) {
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
            
            // Emit auth changed event
            eventEmitter.emit('auth:changed', { user });
            
            return user;
        } catch (error) {
            console.error('Login failed:', error);
            throw new Error(error.message || 'Authentication failed');
        }
    }

    /**
     * Log out the current user
     */
    logout() {
        // Clear from memory
        this.currentUser = null;
        
        // Clear from storage
        localStorage.removeItem('currentUser');
        
        // Emit auth changed event with null user
        eventEmitter.emit('auth:changed', { user: null });
    }

    /**
     * Check if the user is authenticated
     */
    isAuthenticated() {
        return !!this.getCurrentUser();
    }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
