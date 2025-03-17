import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';

/**
 * Service for handling user authentication
 */
class AuthService {
    constructor() {
        this.currentUser = this.loadUserFromStorage();
        
        // Aggiungi configurazione per SteemLogin
        this.steemLoginConfig = {
            app: 'steeme.cur8',
            callbackURL: window.location.origin + window.location.pathname,
            scope: ['login', 'vote', 'comment', 'custom_json']
        };
        
        // Controlla automaticamente il callback all'avvio
        this.checkSteemLoginCallback();
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
        try {
            const user = this.getCurrentUser();
            if (user) {
                // Se è un login con steemlogin, pulisci anche il token
                if (user.loginMethod === 'steemlogin') {
                    console.log('Clearing SteemLogin token');
                    sessionStorage.removeItem('steemLoginToken');
                    localStorage.removeItem(`${user.username}_steemlogin_token`);
                } else if (user.loginMethod === 'privateKey') {
                    // Pulisci chiave privata salvata
                    localStorage.removeItem(`${user.username}_posting_key`);
                    localStorage.removeItem(`${user.username}_posting_key_expiry`);
                }
            }
            
            // Pulisci stato auth generale
            console.log('Logging out user');
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            
            // Emetti evento per aggiornare l'UI
            eventEmitter.emit('auth:changed', { user: null });
            
            // Notifica all'utente
            eventEmitter.emit('notification', {
                type: 'info',
                message: 'You have been logged out'
            });
            
            console.log('Logout completed successfully');
        } catch (error) {
            console.error('Error during logout:', error);
        }
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

    /**
     * Verifica se siamo arrivati da un redirect SteemLogin e gestisce il processo di autenticazione
     * @returns {Promise<boolean>} True se il callback è stato gestito
     */
    async checkSteemLoginCallback() {
        // Estrai parametri dall'URL
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        const state = params.get('state');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        // Se c'è un errore esplicito nell'URL
        if (error) {
            console.error('SteemLogin error:', error, errorDescription);
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Login failed: ${errorDescription || error}`
            });
            
            // Pulisci lo stato salvato
            sessionStorage.removeItem('steemLoginState');
            
            // Pulisci parametri URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            return false;
        }
        
        // Verifica presenza token e stato
        if (accessToken && state) {
            const savedState = sessionStorage.getItem('steemLoginState');
            
            // Pulisci subito lo stato per evitare riutilizzo
            sessionStorage.removeItem('steemLoginState');
            
            // Verifica che lo stato ricevuto corrisponda a quello salvato
            if (state === savedState) {
                console.log('SteemLogin callback detected: Valid state');
                
                try {
                    // Pulisci i parametri URL prima di tutto
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    // Completa il login con gestione più robusta degli errori
                    await this.completeSteemLogin(accessToken)
                        .catch(error => {
                            console.error('SteemLogin completion failed:', error);
                            throw error;
                        });
                    
                    console.log('SteemLogin authentication completed successfully');
                    return true;
                } catch (error) {
                    console.error('Error in SteemLogin callback:', error);
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: `Authentication error: ${error.message || 'Unknown error'}`
                    });
                    return false;
                }
            } else {
                console.error('SteemLogin state mismatch', { 
                    received: state, 
                    saved: savedState 
                });
                
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: 'Authentication error: Security verification failed'
                });
                
                // Pulisci parametri URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                return false;
            }
        }
        
        // Nessun parametro di callback trovato
        return false;
    }
    
    /**
     * Inizia il processo di login con SteemLogin
     */
    loginWithSteemLogin() {
        // Verifica che uno degli oggetti globali sia disponibile
        if (!window.steemlogin && !window.steemconnect) {
            console.error('SteemLogin library not available globally');
            throw new Error('SteemConnect/SteemLogin library not loaded');
        }
        
        try {
            // Usa la libreria disponibile (steemlogin o steemconnect)
            const SteemClient = window.steemlogin?.Client || window.steemconnect?.Client;
            
            if (!SteemClient) {
                throw new Error('No valid SteemLogin client found');
            }
            
            // Inizializza client con configurazione unificata
            const steemClient = new SteemClient({
                app: 'steeme.cur8',
                callbackURL: this.steemLoginConfig.callbackURL,
                scope: this.steemLoginConfig.scope
            });
            
            // Genera uno stato casuale per sicurezza
            const state = Math.random().toString(36).substring(7);
            sessionStorage.setItem('steemLoginState', state);
            
            console.log('Redirecting to SteemLogin...', steemClient);
            
            // Ottieni URL di login e reindirizza
            const loginUrl = steemClient.getLoginURL(state);
            window.location.href = loginUrl;
            
            return true;
        } catch (error) {
            console.error('Error initiating SteemLogin:', error);
            throw new Error('Failed to initiate SteemLogin: ' + error.message);
        }
    }
    
    /**
     * Completa il processo di login dopo il callback di SteemLogin
     * @param {string} accessToken - Token di accesso ricevuto
     * @returns {Promise<Object>} - Oggetto utente autenticato
     */
    async completeSteemLogin(accessToken) {
        if (!accessToken) {
            throw new Error('No access token provided');
        }
        
        try {
            // Prima memorizza il token temporaneamente
            this.storeToken(accessToken, null, false);
            
            // Ottieni dati utente da SteemLogin
            let userData;
            try {
                userData = await this.getSteemLoginUserData(accessToken);
                console.log('SteemLogin user data received:', userData);
            } catch (error) {
                console.error('Failed to fetch user data from SteemLogin:', error);
                throw new Error(`Authentication error: ${error.message || 'Failed to retrieve user data'}`);
            }
            
            // Estrai e verifica username
            const username = userData?.name || userData?.username || userData?.user;
            if (!username) {
                console.error('Invalid SteemLogin response - missing username:', userData);
                throw new Error('Authentication error: Invalid user data (missing username)');
            }
            
            console.log('SteemLogin authenticated username:', username);
            
            // Crea oggetto utente
            let user;
            
            try {
                // Tenta di ottenere il profilo completo
                const userProfile = await steemService.getProfile(username);
                
                user = this.createUserObjectFromSteemLogin(username, accessToken, userProfile);
                console.log('User authenticated with full profile');
            } catch (error) {
                // Fallback con profilo minimo in caso di errore
                console.warn('Could not fetch user profile, creating minimal user object:', error);
                
                user = {
                    username: username,
                    avatar: `https://steemitimages.com/u/${username}/avatar`,
                    isAuthenticated: true,
                    profile: {},
                    timestamp: Date.now(),
                    loginMethod: 'steemlogin',
                    steemLoginToken: accessToken
                };
            }
            
            // Salva il token in modo persistente ora che abbiamo l'username
            this.storeToken(accessToken, username, true);
            
            // Salva l'utente
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            // Notifica il cambiamento di autenticazione
            eventEmitter.emit('auth:changed', { user });
            
            // Mostra notifica di successo
            eventEmitter.emit('notification', {
                type: 'success',
                message: `Welcome back, ${username}!`
            });
            
            return user;
        } catch (error) {
            console.error('SteemLogin completion error:', error);
            
            // Pulisci token temporaneo se presente
            sessionStorage.removeItem('steemLoginToken');
            
            eventEmitter.emit('notification', {
                type: 'error',
                message: 'Login failed: ' + (error.message || 'Unknown error')
            });
            
            throw error;
        }
    }
    
    /**
     * Crea un oggetto utente standardizzato dai dati SteemLogin e profilo
     * @private
     */
    createUserObjectFromSteemLogin(username, token, userProfile) {
        return {
            username: username,
            avatar: `https://steemitimages.com/u/${username}/avatar`,
            isAuthenticated: true,
            profile: userProfile?.profile || {},
            timestamp: Date.now(),
            loginMethod: 'steemlogin',
            steemLoginToken: token,
            scope: userProfile?.scope || ['login', 'vote', 'comment']
        };
    }
    
    /**
     * Ottiene i dati utente da SteemLogin API
     * @param {string} accessToken - Token di accesso
     * @returns {Promise<Object>} - Dati utente
     */
    async getSteemLoginUserData(accessToken) {
        try {
            console.log('Fetching SteemLogin user data with token:', accessToken);
            const response = await fetch('https://api.steemlogin.com/api/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) {
                console.error('SteemLogin API error:', response.status, response.statusText);
                throw new Error(`Failed to fetch user data from SteemLogin: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('SteemLogin API response:', data);
            return data;
        } catch (error) {
            console.error('Error fetching SteemLogin user data:', error);
            throw error;
        }
    }
    
    /**
     * Ottiene il token SteemLogin per l'utente corrente
     * @returns {string|null} - Token di accesso o null se non disponibile
     */
    getSteemLoginToken() {
        const user = this.getCurrentUser();
        if (!user || user.loginMethod !== 'steemlogin') {
            return null;
        }
        
        // Prima controlla proprietà diretta (più recente)
        if (user.steemLoginToken) {
            return user.steemLoginToken;
        }
        
        // Poi controlla sessionStorage (per la sessione corrente)
        const sessionToken = sessionStorage.getItem('steemLoginToken');
        if (sessionToken) {
            return sessionToken;
        }
        
        // Infine controlla localStorage (memorizzazione persistente)
        try {
            const storedData = localStorage.getItem(`${user.username}_steemlogin_token`);
            if (storedData) {
                const tokenData = JSON.parse(storedData);
                
                // Verifica scadenza
                if (tokenData.expires && tokenData.expires > Date.now()) {
                    return tokenData.token;
                } else {
                    // Token scaduto, rimuovilo
                    localStorage.removeItem(`${user.username}_steemlogin_token`);
                }
            }
        } catch (error) {
            console.error('Error retrieving token from storage:', error);
        }
        
        return null;
    }

    // Aggiungi questi nuovi metodi di gestione token

    /**
     * Memorizza il token in modo sicuro con data di scadenza
     * @param {string} token - Token da memorizzare
     * @param {string} username - Username dell'utente
     * @param {boolean} persistent - Se memorizzare in localStorage (persistente) o sessionStorage
     */
    storeToken(token, username, persistent = false) {
        if (!token || !username) return;
        
        try {
            // Memorizza insieme a un timestamp di scadenza (24 ore)
            const tokenData = {
                token: token,
                expires: Date.now() + (24 * 60 * 60 * 1000)
            };
            
            // Memorizza sia in session che in localStorage se richiesto
            sessionStorage.setItem('steemLoginToken', token);
            
            if (persistent) {
                localStorage.setItem(`${username}_steemlogin_token`, JSON.stringify(tokenData));
            }
            
            console.log('Token stored successfully');
        } catch (error) {
            console.error('Error storing token:', error);
        }
    }

    // Aggiungi questo metodo per verificare la validità del token SteemLogin

    /**
     * Verifica che il token SteemLogin corrente sia valido
     * @returns {Promise<boolean>} True se il token è valido
     */
    async validateSteemLoginToken() {
        const token = this.getSteemLoginToken();
        if (!token) return false;
        
        try {
            console.log('Validating SteemLogin token...');
            
            // Timeout per evitare attese infinite
            const fetchWithTimeout = async (url, options, timeout = 8000) => {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);
                
                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal
                    });
                    clearTimeout(id);
                    return response;
                } catch (error) {
                    clearTimeout(id);
                    throw error;
                }
            };
            
            // Verifica il token con l'API
            const response = await fetchWithTimeout('https://api.steemlogin.com/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const isValid = response.ok;
            console.log('SteemLogin token validity check:', isValid);
            
            if (!isValid) {
                // Se il token non è valido, puliamolo
                const user = this.getCurrentUser();
                if (user?.loginMethod === 'steemlogin') {
                    sessionStorage.removeItem('steemLoginToken');
                    localStorage.removeItem(`${user.username}_steemlogin_token`);
                }
            }
            
            return isValid;
        } catch (error) {
            console.error('Error validating SteemLogin token:', error);
            return false;
        }
    }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
