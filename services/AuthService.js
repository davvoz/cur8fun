import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import activeKeyInput from '../components/auth/ActiveKeyInputComponent.js';

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
        // Prima verifica l'esistenza dell'oggetto steem_keychain
        const keychainExistsInWindow = window.steem_keychain !== undefined;
        
        return keychainExistsInWindow;
    }

    /**
     * Authenticate a user using SteemKeychain
     * @param {string} username - Username
     * @param {boolean} remember - Whether to remember the user for future sessions
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
                                    
                                    // Salva un indicatore nel localStorage che questo utente ha usato Keychain
                                    localStorage.setItem(`${username}_keychain_auth`, 'true');
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
     * @param {string} username - Steem username
     * @param {string} privateKey - Private key (posting or active)
     * @param {boolean} remember - Whether to remember user credentials
     * @param {string} keyType - Type of key ('posting' or 'active')
     */
    async login(username, privateKey, remember = true, keyType = 'posting') {
        try {
            // Verify the key is valid for the specified type
            await this.verifyKey(username, privateKey, keyType);
            
            // Get user profile information
            const userProfile = await steemService.getProfile(username);
            
            const user = {
                username,
                avatar: `https://steemitimages.com/u/${username}/avatar`,
                isAuthenticated: true,
                profile: userProfile?.profile || {},
                timestamp: Date.now(),
                loginMethod: 'privateKey',
                keyType: keyType // Store key type for permission checks
            };

            // Save to memory
            this.currentUser = user;
            
            // Save to storage if remember is true
            if (remember) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Store the key securely
                this.securelyStoreKey(username, privateKey, keyType, remember);
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
     * Login specifico con active key
     * @param {string} username - Steem username
     * @param {string} activeKey - La chiave active dell'utente
     * @param {boolean} remember - Se memorizzare la chiave per uso futuro
     * @returns {Promise<Object>} - Oggetto utente autenticato
     */
    async loginWithActiveKey(username, activeKey, remember = true) {
        try {
            // Verifica che la chiave sia valida come active key
            await this.verifyKey(username, activeKey, 'active');
            
            // Effettua il login standard specificando 'active' come tipo di chiave
            return this.login(username, activeKey, remember, 'active');
        } catch (error) {
            console.error('Active key login failed:', error);
            throw new Error(error.message || 'Authentication failed with active key');
        }
    }

    /**
     * Login specifico con posting key (alias per maggiore chiarezza)
     * @param {string} username - Steem username
     * @param {string} postingKey - La chiave posting dell'utente
     * @param {boolean} remember - Se memorizzare la chiave per uso futuro
     * @returns {Promise<Object>} - Oggetto utente autenticato
     */
    async loginWithPostingKey(username, postingKey, remember = true) {
        try {
            // Se la posting key è null, verifica se è già memorizzata
            if (postingKey === null) {
                const storedKey = this.getPostingKey();
                if (storedKey) {
                    postingKey = storedKey;
                } else {
                    throw new Error('No posting key provided or stored');
                }
            }
            
            // Usa il metodo login standard con tipo 'posting'
            return this.login(username, postingKey, remember, 'posting');
        } catch (error) {
            console.error('Posting key login failed:', error);
            throw new Error(error.message || 'Authentication failed with posting key');
        }
    }

    /**
     * Verifies that a key is valid for the specified key type
     * @param {string} username - Username Steem
     * @param {string} privateKey - Key to verify
     * @param {string} keyType - Type of key ('posting' or 'active')
     */
    async verifyKey(username, privateKey, keyType = 'posting') {
        await steemService.ensureLibraryLoaded();
        
        try {
            // Verify key format
            const isWif = window.steem.auth.isWif(privateKey);
            
            if (!isWif) {
                throw new Error('Invalid key format');
            }
            
            // Get account to verify the key matches
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
            const publicWif = window.steem.auth.wifToPublic(privateKey);
            
            // Determine which authority to check based on keyType
            let keyAuth;
            if (keyType === 'active') {
                keyAuth = account.active.key_auths;
            } else {
                keyAuth = account.posting.key_auths;
            }
            
            // Check if the provided key matches any of the authorized keys
            const isValid = keyAuth.some(auth => auth[0] === publicWif);
            
            if (!isValid) {
                throw new Error(`Invalid ${keyType} key for this account`);
            }
            
            return true;
        } catch (error) {
            console.error(`Error verifying ${keyType} key:`, error);
            throw new Error(error.message || `Invalid ${keyType} key`);
        }
    }

    /**
     * Store key securely (as securely as possible in a web context)
     * @param {string} username - Username
     * @param {string} key - Private key
     * @param {string} keyType - Type of key ('posting' or 'active')
     * @param {boolean} remember - Whether to store long-term
     */
    securelyStoreKey(username, key, keyType = 'posting', remember = true) {
        if (remember) {
            try {
                // Store the key with key type indicator
                localStorage.setItem(`${username}_${keyType}_key`, key);
                
                // Add expiry timestamp (expiring in 2099)
                const expiry = new Date('2099-12-31').getTime();
                localStorage.setItem(`${username}_${keyType}_key_expiry`, expiry.toString());
            } catch (error) {
                console.error(`Failed to store ${keyType} key:`, error);
            }
        }
    }

    /**
     * Get the specified key for the current user
     * @param {string} keyType - Type of key to retrieve ('posting' or 'active')
     * @returns {string|null} The private key or null if not available
     */
    getKey(keyType = 'posting') {
        const user = this.getCurrentUser();
        
        if (!user) {
            return null;
        }
        
        // For Keychain users
        if (user.loginMethod === 'keychain') {
            return null; // Keychain will handle the operation
        }
        
        // For direct key login
        try {
            const keyExpiry = localStorage.getItem(`${user.username}_${keyType}_key_expiry`);
            
            // Check expiry
            if (keyExpiry && parseInt(keyExpiry) < Date.now()) {
                // Key expired, remove it
                localStorage.removeItem(`${user.username}_${keyType}_key`);
                localStorage.removeItem(`${user.username}_${keyType}_key_expiry`);
                return null;
            }
            
            const key = localStorage.getItem(`${user.username}_${keyType}_key`);
            return key;
        } catch (error) {
            console.error(`getKey: Error retrieving ${keyType} key:`, error);
            return null;
        }
    }
    
    /**
     * Get the posting key for the current user (legacy method for compatibility)
     */
    getPostingKey() {
        return this.getKey('posting');
    }
    
    /**
     * Get the active key for the current user
     */
    getActiveKey() {
        return this.getKey('active');
    }
    
    /**
     * Check if the current user has a valid active key available
     * @returns {boolean} True if active key is available
     */
    hasActiveKeyAccess() {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // User explicitly logged in with active key
        if (user.keyType === 'active') {
            return true;
        }
        
        // Check if we have a stored active key
        const activeKey = this.getActiveKey();
        if (activeKey) {
            return true;
        }
        
        // Per gli utenti Keychain, assumiamo che abbiano accesso a active key
        // Keychain richiederà la conferma al momento dell'operazione
        if (user.loginMethod === 'keychain') {
            const keychainInstalled = this.isKeychainInstalled();
            if (keychainInstalled) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Log out the current user
     */
    logout() {
        try {
            const user = this.getCurrentUser();
            if (user) {
                // If SteemLogin, clear token
                if (user.loginMethod === 'steemlogin') {
                    sessionStorage.removeItem('steemLoginToken');
                    localStorage.removeItem(`${user.username}_steemlogin_token`);
                } else if (user.loginMethod === 'privateKey') {
                    // Clear stored private keys
                    localStorage.removeItem(`${user.username}_posting_key`);
                    localStorage.removeItem(`${user.username}_posting_key_expiry`);
                    localStorage.removeItem(`${user.username}_active_key`);
                    localStorage.removeItem(`${user.username}_active_key_expiry`);
                } else if (user.loginMethod === 'keychain') {
                    // Per keychain, rimuoviamo solo il flag di autenticazione
                    localStorage.removeItem(`${user.username}_keychain_auth`);
                }
            }
            
            // Clear general auth state
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            
            // Emit event to update UI
            eventEmitter.emit('auth:changed', { user: null });
            
            // Notify user
            eventEmitter.emit('notification', {
                type: 'info',
                message: 'You have been logged out'
            });
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
        
        if (!user) {
            return null;
        }
        
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
            
            const key = localStorage.getItem(`${user.username}_posting_key`);
            return key;
        } catch (error) {
            console.error('getPostingKey: Error retrieving posting key:', error);
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
                try {
                    // Pulisci i parametri URL prima di tutto
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    // Completa il login con gestione più robusta degli errori
                    await this.completeSteemLogin(accessToken)
                        .catch(error => {
                            console.error('SteemLogin completion failed:', error);
                            throw error;
                        });
                    
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
            
            // Crea oggetto utente
            let user;
            
            try {
                // Tenta di ottenere il profilo completo
                const userProfile = await steemService.getProfile(username);
                
                user = this.createUserObjectFromSteemLogin(username, accessToken, userProfile);
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
                expires: Date.now() + (30 * 24 * 60 * 60 * 1000)
            };
            
            // Memorizza sia in session che in localStorage se richiesto
            sessionStorage.setItem('steemLoginToken', token);
            
            if (persistent) {
                localStorage.setItem(`${username}_steemlogin_token`, JSON.stringify(tokenData));
            }
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

    /**
     * Switches to a different account
     * @param {Object} account - The account to switch to
     */
    switchToAccount(account) {
        try {
            // Based on available authentication methods, try to log in
            if (account.hasSteemLogin) {
                const tokenData = localStorage.getItem(`${account.username}_steemlogin_token`);
                if (tokenData) {
                    const parsedData = JSON.parse(tokenData);
                    this.completeSteemLogin(parsedData.token)
                        .then(() => {
                            // Reload page to refresh with new account
                            window.location.href = '/app/trending';
                        })
                        .catch(error => {
                            console.error('Failed to switch account with SteemLogin:', error);
                            this.showLoginFailedNotification();
                        });
                } else {
                    this.showLoginFailedNotification();
                }
            } else if (account.hasKeychain) {
                // Verifica innanzitutto che Keychain sia installato
                if (!this.isKeychainInstalled()) {
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: 'Steem Keychain extension is not installed. Please install it to login with this account.'
                    });
                    return;
                }
                
                // Prova ad autenticare tramite Keychain
                this.loginWithKeychain(account.username, true)
                    .then(() => {
                        // Reload page to refresh with new account
                            window.location.href = '/app/trending';
                    })
                    .catch(error => {
                        console.error('Failed to switch account with Keychain:', error);
                        this.showLoginFailedNotification();
                    });
            } else if (account.hasPostingKey) {
                const postingKey = localStorage.getItem(`${account.username}_posting_key`);
                if (postingKey) {
                    this.loginWithPostingKey(account.username, postingKey)
                        .then(() => {
                            // Reload page to refresh with new account
                            window.location.reload();
                        })
                        .catch(error => {
                            console.error('Failed to switch account with posting key:', error);
                            this.showLoginFailedNotification();
                        });
                } else {
                    this.showLoginFailedNotification();
                }
            } else if (account.hasActiveKey) {
                const activeKey = localStorage.getItem(`${account.username}_active_key`);
                if (activeKey) {
                    this.loginWithActiveKey(account.username, activeKey)
                        .then(() => {
                            // Reload page to refresh with new account
                            window.location.reload();
                        })
                        .catch(error => {
                            console.error('Failed to switch account with active key:', error);
                            this.showLoginFailedNotification();
                        });
                } else {
                    this.showLoginFailedNotification();
                }
            } else {
                // No valid authentication method found
                this.showLoginFailedNotification();
            }
        } catch (error) {
            console.error('Error switching account:', error);
            this.showLoginFailedNotification();
        }
    }

    /**
     * Shows a notification when login fails
     */
    showLoginFailedNotification() {
        eventEmitter.emit('notification', {
            type: 'error',
            message: 'Failed to switch account. Please log in again.',
            duration: 5000
        });
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = '/app/login';
        }, 1500);
    }

    /**
     * Gets all stored accounts from localStorage
     * @returns {Array} - Array of account objects
     */
    getStoredAccounts() {
        try {
            // Get current user first
            const currentUser = this.getCurrentUser();
            const accounts = [];
            
            if (currentUser) {
                accounts.push(currentUser);
            }
            
            // Check localStorage for other accounts
            const userKeys = [];
            
            // Find all keys that might contain user data
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.includes('_posting_key') || key.includes('_active_key') || 
                    key.includes('_steemlogin_token') || key.includes('_keychain_auth')) {
                    const username = key.split('_')[0];
                    if (!userKeys.includes(username)) {
                        userKeys.push(username);
                    }
                }
            }
            
            // For each username, check if we have a stored user
            userKeys.forEach(username => {
                // Skip current user
                if (currentUser && username === currentUser.username) {
                    return;
                }
                
                // Try to build a user object
                try {
                    const hasPostingKey = localStorage.getItem(`${username}_posting_key`) !== null;
                    const hasActiveKey = localStorage.getItem(`${username}_active_key`) !== null;
                    const hasSteemLogin = localStorage.getItem(`${username}_steemlogin_token`) !== null;
                    const hasKeychain = localStorage.getItem(`${username}_keychain_auth`) !== null;
                    
                    if (hasPostingKey || hasActiveKey || hasSteemLogin || hasKeychain) {
                        accounts.push({
                            username,
                            avatar: `https://steemitimages.com/u/${username}/avatar`,
                            hasPostingKey,
                            hasActiveKey,
                            hasSteemLogin,
                            hasKeychain
                        });
                    }
                } catch (error) {
                    console.error('Error processing stored account:', error);
                }
            });
            
            return accounts;
        } catch (error) {
            console.error('Error getting stored accounts:', error);
            return [];
        }
    }

    /**
     * Shows a modal dialog that allows users to switch between accounts
     */
    showAccountSwitcher() {
        // Importa dinamicamente il componente AccountSwitcherModal
        import('../components/auth/AccountSwitcherModal.js').then(module => {
            const AccountSwitcherModal = module.default;
            // Crea e apre il modale
            const modal = new AccountSwitcherModal();
            modal.open();
        }).catch(error => {
            console.error('Error loading AccountSwitcherModal:', error);
            // Fallback notification in caso di errore nel caricamento del componente
            eventEmitter.emit('notification', {
                type: 'error',
                message: 'Unable to open account switcher. Please try again.'
            });
        });
    }

    /**
     * Controlla se l'utente ha autorizzato l'account cur8 per i post schedulati
     * @returns {boolean} - true se autorizzato, false altrimenti
     */    
    async checkCur8Authorization() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('User not logged in');
        }

        try {
            // Verifica sulla blockchain controllando le autorizzazioni posting
            const userAccount = await steemService.getUserData(currentUser.username);
            
            if (userAccount && userAccount.posting && userAccount.posting.account_auths) {
                const hasAuth = userAccount.posting.account_auths.some(auth => 
                    auth[0] === 'cur8' && auth[1] >= 1
                );
                
                return hasAuth;
            }

            return false;
        } catch (error) {
            console.error('Error checking cur8 authorization:', error);
            return false;
        }
    }   
    
    /**
     * Autorizza l'account cur8 per pubblicare post schedulati
     * @returns {Promise} - Promise che si risolve quando l'autorizzazione è completata
     */
    async authorizeCur8ForScheduledPosts() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('User not logged in');
        }

        // Gestisci diversi metodi di login
        if (currentUser.loginMethod === 'keychain') {
            return this.authorizeCur8WithKeychain(currentUser);
        } else if (currentUser.loginMethod === 'privateKey' || currentUser.loginMethod === 'steemlogin') {
            return this.authorizeCur8WithActiveKey(currentUser);
        } else {
            throw new Error('Unsupported login method for authorization');
        }
    }

    /**
     * Autorizza cur8 usando Keychain (operazione reale su blockchain)
     */
    async authorizeCur8WithKeychain(currentUser) {
        if (!this.isKeychainInstalled()) {
            throw new Error('Steem Keychain is required for authorization');
        }

        return new Promise(async (resolve, reject) => {
            const username = currentUser.username;
            try {
                // Ottieni le informazioni dell'account corrente
                const userAccount = await steemService.getUserData(username);
                if (!userAccount) {
                    throw new Error('Could not fetch account information');
                }

                // Prepara la nuova lista di autorizzazioni posting
                const currentPostingAuths = userAccount.posting?.account_auths || [];
                // Verifica se cur8 è già autorizzato
                const existingCur8Auth = currentPostingAuths.find(auth => auth[0] === 'cur8');
                let newPostingAuths;
                if (existingCur8Auth) {
                    // cur8 è già autorizzato, aggiorna il peso se necessario
                    newPostingAuths = currentPostingAuths.map(auth =>
                        auth[0] === 'cur8' ? ['cur8', 1] : auth
                    );
                } else {
                    // Aggiungi cur8 alle autorizzazioni
                    newPostingAuths = [...currentPostingAuths, ['cur8', 1]];
                }

                // Prepara l'operazione account_update
                const operation = [
                    'account_update',
                    {
                        account: username,
                        posting: {
                            account_auths: newPostingAuths,
                            key_auths: userAccount.posting?.key_auths || [],
                            weight_threshold: userAccount.posting?.weight_threshold || 1
                        },
                        memo_key: userAccount.memo_key,
                        json_metadata: userAccount.json_metadata || ''
                    }
                ];

                window.steem_keychain.requestBroadcast(
                    username,
                    [operation],
                    'Active',
                    (response) => {
                        if (response.success) {
                            eventEmitter.emit('notification', {
                                type: 'success',
                                message: 'Authorization granted successfully! You can now schedule posts.'
                            });
                            resolve(response);
                        } else {
                            const errorMessage = response.message || 'Failed to authorize cur8 account';
                            eventEmitter.emit('notification', {
                                type: 'error',
                                message: errorMessage
                            });
                            reject(new Error(errorMessage));
                        }
                    }
                );
            } catch (error) {
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: error.message || 'Failed to authorize cur8 account'
                });
                reject(error);
            }
        });
    }

    /**
     * Autorizza cur8 usando Active Key
     */
    async authorizeCur8WithActiveKey(currentUser) {
        try {
            // Richiedi la Active Key all'utente
            const activeKey = await activeKeyInput.promptForActiveKey(
                'Enter Active Key to authorize cur8 for scheduled posts'
            );
            
            if (!activeKey) {
                throw new Error('Active key is required for authorization');
            }

            // Ottieni le informazioni dell'account corrente
            const userAccount = await steemService.getUserData(currentUser.username);
            if (!userAccount) {
                throw new Error('Could not fetch account information');
            }

            // Prepara la nuova lista di autorizzazioni posting
            const currentPostingAuths = userAccount.posting?.account_auths || [];
            
            // Verifica se cur8 è già autorizzato
            const existingCur8Auth = currentPostingAuths.find(auth => auth[0] === 'cur8');
            let newPostingAuths;
            
            if (existingCur8Auth) {
                // cur8 è già autorizzato, aggiorna il peso se necessario
                newPostingAuths = currentPostingAuths.map(auth => 
                    auth[0] === 'cur8' ? ['cur8', 1] : auth
                );
            } else {
                // Aggiungi cur8 alle autorizzazioni
                newPostingAuths = [...currentPostingAuths, ['cur8', 1]];
            }

            // Prepara l'operazione account_update
            const operation = [
                'account_update',
                {
                    account: currentUser.username,
                    posting: {
                        account_auths: newPostingAuths,
                        key_auths: userAccount.posting?.key_auths || [],
                        weight_threshold: userAccount.posting?.weight_threshold || 1
                    },
                    memo_key: userAccount.memo_key,
                    json_metadata: userAccount.json_metadata || ''
                }
            ];            // Broadcast dell'operazione usando SteemService
            // Nota: usiamo broadcastWithPostingKey ma passiamo l'active key
            // Questo funziona perché l'operazione account_update richiede l'active key
            const result = await steemService.broadcastWithActiveKey([operation], activeKey);
            
            if (result) {
                // Emetti evento di successo
                eventEmitter.emit('notification', {
                    type: 'success',
                    message: 'Authorization granted successfully! You can now schedule posts.'
                });
                
                return result;
            } else {
                throw new Error('Failed to broadcast authorization transaction');
            }
            
        } catch (error) {
            console.error('Error authorizing cur8 with active key:', error);
            
            // Emetti notifica di errore
            eventEmitter.emit('notification', {
                type: 'error',
                message: error.message || 'Failed to authorize cur8 account'
            });
            
            throw error;
        }
    }    /**
     * Revoca l'autorizzazione dell'account cur8
     * @returns {Promise} - Promise che si risolve quando la revoca è completata
     */
    async revokeCur8Authorization() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('User not logged in');
        }

        // Gestisci diversi metodi di login
        if (currentUser.loginMethod === 'keychain') {
            return this.revokeCur8WithKeychain(currentUser);
        } else if (currentUser.loginMethod === 'privateKey' || currentUser.loginMethod === 'steemlogin') {
            return this.revokeCur8WithActiveKey(currentUser);
        } else {
            throw new Error('Unsupported login method for revoking authorization');
        }
    }

    /**
     * Revoca cur8 usando Keychain
     */
    async revokeCur8WithKeychain(currentUser) {
        if (!this.isKeychainInstalled()) {
            throw new Error('Steem Keychain is required for revoking authorization');
        }        return new Promise(async (resolve, reject) => {
            const username = currentUser.username;
            
            try {
                // Ottieni le informazioni dell'account corrente
                const userAccount = await steemService.getUserData(username);
                if (!userAccount) {
                    throw new Error('Could not fetch account information');
                }

                // Prepara la nuova lista di autorizzazioni posting senza cur8
                const currentPostingAuths = userAccount.posting?.account_auths || [];
                const newPostingAuths = currentPostingAuths.filter(auth => auth[0] !== 'cur8');

                // Operazione per rimuovere cur8 dalle autorizzazioni posting
                const operation = [
                    'account_update',
                    {
                        account: username,
                        posting: {
                            account_auths: newPostingAuths,
                            key_auths: userAccount.posting?.key_auths || [],
                            weight_threshold: userAccount.posting?.weight_threshold || 1
                        },
                        memo_key: userAccount.memo_key,
                        json_metadata: userAccount.json_metadata || ''
                    }
                ];

                window.steem_keychain.requestBroadcast(
                    username,
                    [operation],
                    'Active',
                    (response) => {
                        if (response.success) {
                            eventEmitter.emit('notification', {
                                type: 'success',
                                message: 'Authorization revoked successfully!'
                            });
                            
                            resolve(response);
                        } else {
                            const errorMessage = response.message || 'Failed to revoke cur8 authorization';
                            
                            eventEmitter.emit('notification', {
                                type: 'error',
                                message: errorMessage
                            });
                            
                            reject(new Error(errorMessage));
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Revoca cur8 usando Active Key
     */
    async revokeCur8WithActiveKey(currentUser) {
        try {
            // Richiedi la Active Key all'utente
            const activeKey = await activeKeyInput.promptForActiveKey(
                'Enter Active Key to revoke cur8 authorization'
            );
            
            if (!activeKey) {
                throw new Error('Active key is required to revoke authorization');
            }

            // Ottieni le informazioni dell'account corrente
            const userAccount = await steemService.getUserData(currentUser.username);
            if (!userAccount) {
                throw new Error('Could not fetch account information');
            }

            // Prepara la nuova lista di autorizzazioni posting senza cur8
            const currentPostingAuths = userAccount.posting?.account_auths || [];
            const newPostingAuths = currentPostingAuths.filter(auth => auth[0] !== 'cur8');

            // Prepara l'operazione account_update
            const operation = [
                'account_update',
                {
                    account: currentUser.username,
                    posting: {
                        account_auths: newPostingAuths,
                        key_auths: userAccount.posting?.key_auths || [],
                        weight_threshold: userAccount.posting?.weight_threshold || 1
                    },
                    memo_key: userAccount.memo_key,
                    json_metadata: userAccount.json_metadata || ''
                }
            ];

            // Broadcast dell'operazione usando SteemService
            const result = await steemService.broadcastWithActiveKey([operation], activeKey);
            
            if (result) {
                // Emetti evento di successo
                eventEmitter.emit('notification', {
                    type: 'success',
                    message: 'Authorization revoked successfully!'
                });
                
                return result;
            } else {
                throw new Error('Failed to broadcast revocation transaction');
            }
            
        } catch (error) {
            console.error('Error revoking cur8 authorization with active key:', error);
            
            // Emetti notifica di errore
            eventEmitter.emit('notification', {
                type: 'error',
                message: error.message || 'Failed to revoke cur8 authorization'
            });
            
            throw error;
        }
    }
}

// Export singleton instance
const authService = new AuthService();
export default authService;