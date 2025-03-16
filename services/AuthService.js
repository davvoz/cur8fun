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
     * Check if SteemKeychain extension is installed
     */
    isKeychainInstalled() {
        return window.steem_keychain !== undefined;
    }

    /**
     * Authenticate a user using SteemKeychain
     */
    async loginWithKeychain(username, remember = true) {
        try {
            if (!this.isKeychainInstalled()) {
                throw new Error('Steem Keychain extension is not installed');
            }

            // Request a simple signing operation to verify the user has the key in Keychain
            return new Promise((resolve, reject) => {
                const message = `Login to the app: ${new Date().toISOString()}`;
                
                window.steem_keychain.requestSignBuffer(
                    username,
                    message,
                    'Posting',
                    async (response) => {
                        if (response.success) {
                            try {
                                // Get user profile information
                                const userProfile = await steemService.getProfile(username);
                                
                                const user = {
                                    username,
                                    avatar: `https://steemitimages.com/u/${username}/avatar`,
                                    isAuthenticated: true,
                                    profile: userProfile?.profile || {},
                                    timestamp: Date.now(),
                                    loginMethod: 'keychain'
                                };

                                // Save to memory
                                this.currentUser = user;
                                
                                // Save to storage if remember is true
                                if (remember) {
                                    localStorage.setItem('currentUser', JSON.stringify(user));
                                }
                                
                                // Emit auth changed event
                                eventEmitter.emit('auth:changed', { user });
                                
                                resolve(user);
                            } catch (error) {
                                reject(error);
                            }
                        } else {
                            reject(new Error(response.error || 'Authentication failed'));
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Keychain login failed:', error);
            throw new Error(error.message || 'Authentication failed');
        }
    }

    /**
     * Authenticate a user with their username and private key
     */
    async login(username, privateKey, remember = true) {
        try {
            // Verifica della validità della chiave posting
            await this.verifyPostingKey(username, privateKey);
            
            // Get user profile information
            const userProfile = await steemService.getProfile(username);
            
            const user = {
                username,
                avatar: `https://steemitimages.com/u/${username}/avatar`,
                isAuthenticated: true,
                profile: userProfile?.profile || {},
                timestamp: Date.now(),
                loginMethod: 'privateKey'
            };

            // Save to memory
            this.currentUser = user;
            
            // Save to storage if remember is true
            if (remember) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Salva la chiave posting in localStorage (con encryption se possibile)
                this.securelyStorePostingKey(username, privateKey, remember);
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
     * Verifica che una chiave posting sia valida
     * @param {string} username - Username Steem
     * @param {string} postingKey - Chiave posting da verificare
     */
    async verifyPostingKey(username, postingKey) {
        await steemService.ensureLibraryLoaded();
        
        try {
            // Verifica che la chiave sia del formato corretto
            const isPubkey = window.steem.auth.isPubkey(postingKey);
            const isWif = window.steem.auth.isWif(postingKey);
            
            if (!isWif) {
                throw new Error('Invalid posting key format');
            }
            
            // Ottieni l'account per verificare che la chiave corrisponda
            const accounts = await new Promise((resolve, reject) => {
                window.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('Account not found');
            }
            
            const account = accounts[0];
            const publicWif = window.steem.auth.wifToPublic(postingKey);
            
            // Verifica che la chiave pubblica derivata dalla posting key sia una delle chiavi autorizzate
            const postingAuth = account.posting.key_auths;
            const isValid = postingAuth.some(auth => auth[0] === publicWif);
            
            if (!isValid) {
                throw new Error('Invalid posting key for this account');
            }
            
            return true;
        } catch (error) {
            console.error('Error verifying posting key:', error);
            throw new Error('Invalid posting key');
        }
    }

    /**
     * Store posting key securely (as securely as possible in a web context)
     */
    securelyStorePostingKey(username, postingKey, remember = true) {
        // In una versione più sicura, potresti usare Web Crypto API per la crittografia
        // Ma per semplicità in questo esempio usiamo localStorage con un'avvertenza
        
        if (remember) {
            try {
                // Utilizza una chiave semplice per questo esempio educativo
                // In produzione, dovresti implementare una soluzione più robusta
                localStorage.setItem(`${username}_posting_key`, postingKey);
                
                // Aggiungi un timestamp di scadenza (24 ore)
                const expiry = Date.now() + (24 * 60 * 60 * 1000);
                localStorage.setItem(`${username}_posting_key_expiry`, expiry.toString());
                
                console.info('Posting key stored for mobile operations');
            } catch (error) {
                console.error('Failed to store posting key:', error);
            }
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

    /**
     * Get the posting key for the current user
     * Note: For security, this should be improved in production
     * Ideally, keys should not be stored in localStorage
     */
    getPostingKey() {
        const user = this.getCurrentUser();
        if (!user) return null;
        
        // Per utenti Keychain
        if (user.loginMethod === 'keychain') {
            return null; // Keychain gestirà l'operazione 
        }
        
        // Per login con chiave diretta
        try {
            const keyExpiry = localStorage.getItem(`${user.username}_posting_key_expiry`);
            
            // Verifica scadenza
            if (keyExpiry && parseInt(keyExpiry) < Date.now()) {
                // Chiave scaduta, rimuovila
                localStorage.removeItem(`${user.username}_posting_key`);
                localStorage.removeItem(`${user.username}_posting_key_expiry`);
                return null;
            }
            
            return localStorage.getItem(`${user.username}_posting_key`);
        } catch (error) {
            console.error('Error retrieving posting key:', error);
            return null;
        }
    }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
