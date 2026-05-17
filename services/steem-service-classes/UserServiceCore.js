/**
 * Service for user-related operations
 */
export default class UserServiceCore {
    constructor(core) {
        this.core = core;
    }

    async getUserData(username, options = { includeProfile: false }) {
        await this.core.ensureLibraryLoaded();

        try {
            const accounts = await new Promise((resolve, reject) => {
                this.core.steem.api.getAccounts([username], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (!accounts || accounts.length === 0) {
                return null;
            }

            const userData = accounts[0];

            if (options.includeProfile && userData) {
                try {
                    const metadata = JSON.parse(userData.json_metadata || '{}');
                    return {
                        ...userData,
                        profile: metadata.profile || {}
                    };
                } catch (e) {
                    console.error('Error parsing user metadata:', e);
                }
            }

            return userData;
        } catch (error) {
            console.error('Error fetching user data:', error);
            this.core.switchEndpoint();
            throw error;
        }
    }

    async getProfile(username) {
        return this.getUserData(username, { includeProfile: true });
    }

    async getUserInfo(username) {
        return this.getUserData(username);
    }

    async getUser(username) {
        return this.getUserData(username);
    }

    async getAccountHistory(username, from = -1, limit = 10) {
        await this.core.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getAccountHistory(username, from, limit, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching account history:', error);
            this.core.switchEndpoint();
            throw error;
        }
    }

    async getFollowers(username) {
        await this.core.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getFollowers(username, '', 'blog', 1000, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error(`Error fetching followers for ${username}:`, error);
            throw error;
        }
    }

    async getFollowing(username) {
        await this.core.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getFollowing(username, '', 'blog', 1000, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error(`Error fetching following for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Updates a user's profile by modifying their account metadata
     * @param {string} username - The username whose profile to update
     * @param {Object} profile - The profile data to update
     * @param {string|null} activeKey - Optional active key provided by the user
     * @returns {Promise<Object>} - The result of the update operation
     * @throws {Error} If the update fails or required authentication is missing
     */
    async updateUserProfile(username, profile, activeKey = null) {
        await this.core.ensureLibraryLoaded();

        // Read existing metadata (posting_json_metadata takes priority, same as the model)
        const metadata = await this.prepareProfileMetadata(username);

        // Merge new fields into the existing profile object
        metadata.profile = { ...(metadata.profile || {}), ...profile };

        const postingJsonMetadata = JSON.stringify(metadata);

        const authService = await this.getAuthService();
        const user = authService?.getCurrentUser?.();

        // If a specific WIF key was passed in, use it directly.
        if (this.isValidWifKey(activeKey)) {
            return this.broadcastProfileUpdate(username, postingJsonMetadata, activeKey);
        }

        // Respect the actual login method:
        // - Keychain login => Keychain signing
        // - privateKey login => posting key from AuthService
        if (user?.loginMethod === 'keychain') {
            return this.broadcastProfileUpdateWithKeychain(username, postingJsonMetadata);
        }

        if (user?.loginMethod === 'privateKey') {
            const postingKey = authService?.getPostingKey?.();
            if (this.isValidWifKey(postingKey)) {
                return this.broadcastProfileUpdate(username, postingJsonMetadata, postingKey);
            }
        }

        // Keep a small fallback for older auth states that still have a posting key cached.
        const postingKey = authService?.getPostingKey?.();
        if (this.isValidWifKey(postingKey)) {
            return this.broadcastProfileUpdate(username, postingJsonMetadata, postingKey);
        }

        if (user?.loginMethod === 'keychain' && window.steem_keychain) {
            return this.broadcastProfileUpdateWithKeychain(username, postingJsonMetadata);
        }

        throw new Error('Posting key not available. Please log in again.');
    }

    /**
     * Fetches and parses the existing profile metadata for a user.
     * Prefers posting_json_metadata (canonical since HF21) over json_metadata,
     * matching the same priority used by Profile.parseMetadata().
     * @private
     * @param {string} username
     * @returns {Promise<Object>} Parsed metadata object (always has at least {})
     */
    async prepareProfileMetadata(username) {
        try {
            const userData = await this.getUserData(username);
            if (!userData) throw new Error('User data not found');

            // Prefer posting_json_metadata — that is what Profile.js reads first
            const raw = userData.posting_json_metadata || userData.json_metadata || '{}';
            try {
                const parsed = JSON.parse(raw);
                return (parsed && typeof parsed === 'object') ? parsed : {};
            } catch (_) {
                return {};
            }
        } catch (e) {
            console.warn('prepareProfileMetadata: could not fetch user data, starting fresh:', e.message);
            return {};
        }
    }

    /**
     * Resolve an active key using the same flow used by wallet operations:
     * - in-memory key (already unlocked)
     * - PIN unlock of stored active key
     * - active-key input + PIN setup (storeActiveKeyWithPin)
     *
     * Returns null when key-based auth is not applicable (e.g. keychain/steemlogin).
     * Throws when user cancels during an interactive unlock/add flow.
     * @private
     */
    async resolveActiveKeyForProfileUpdate(username) {
        const authService = await this.getAuthService();
        const user = authService?.getCurrentUser?.();
        if (!user) return null;

        // Keychain/SteemLogin flows should use their own auth method.
        if (user.loginMethod === 'keychain' || user.loginMethod === 'steemlogin') {
            return null;
        }

        // 1) Already unlocked in memory
        const activeInMemory = authService.getActiveKey?.();
        if (this.isValidWifKey(activeInMemory)) return activeInMemory;

        // 2) PIN unlock if a PIN-protected active key exists
        if (authService.hasActiveKeyPinProtected?.()) {
            const { default: pinInput } = await import('../../components/auth/PinInputComponent.js');
            const pin = await pinInput.promptPin(
                'Enter Active Key PIN',
                'This action requires your active key. Enter your PIN to continue.',
                async (p) => { await authService.unlockActiveKeyWithPin(p); }
            );

            if (!pin) {
                throw new Error('Operation cancelled');
            }

            const unlockedKey = authService.getActiveKey?.();
            if (this.isValidWifKey(unlockedKey)) return unlockedKey;
        }

        // 3) Ask for active key, verify it, then protect it with a PIN
        const { default: activeKeyInput } = await import('../../components/auth/ActiveKeyInputComponent.js');
        const key = await activeKeyInput.promptForActiveKey('Enter Active Key', {
            validate: (k) => authService.verifyKey(username, k, 'active')
        });

        if (!key) {
            throw new Error('Operation cancelled');
        }

        const { default: pinInput } = await import('../../components/auth/PinInputComponent.js');
        const pin = await pinInput.promptSetPin('Set a PIN for your Active Key');
        if (!pin) {
            throw new Error('Operation cancelled');
        }

        await authService.storeActiveKeyWithPin(username, key, pin);

        const storedKey = authService.getActiveKey?.();
        return this.isValidWifKey(storedKey) ? storedKey : key;
    }

    /**
     * Dynamic import to avoid static circular dependencies with AuthService.
     * @private
     */
    async getAuthService() {
        const { default: authService } = await import('../AuthService.js');
        return authService;
    }

    /**
     * Retrieves stored active key for a user
     * @private
     * @param {string} username - The username to get the key for
     * @returns {string|null} - The active key if found, null otherwise
     */
    getStoredActiveKey(username) {
        const candidates = [
            localStorage.getItem('activeKey'),
            localStorage.getItem(`${username}_active_key`),
            localStorage.getItem(`${username.toLowerCase()}_active_key`)
        ];

        for (const candidate of candidates) {
            if (this.isValidWifKey(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Broadcasts a profile metadata update using account_update2 (HF21+).
     * account_update2 writes to posting_json_metadata which is the canonical
     * field read by Profile.parseMetadata(). Signing with the posting key is
     * sufficient when no authority fields are being changed.
     * @private
     * @param {string} username
     * @param {string} postingJsonMetadata - Stringified metadata JSON
     * @param {string} postingKey - Posting private key
     * @returns {Promise<Object>}
     */
    broadcastProfileUpdate(username, postingJsonMetadata, postingKey) {
        return new Promise((resolve, reject) => {
            const operations = [
                ['account_update2', {
                    account: username,
                    json_metadata: '',
                    posting_json_metadata: postingJsonMetadata,
                    extensions: []
                }]
            ];

            this.core.steem.broadcast.send(
                { operations, extensions: [] },
                { posting: postingKey },
                (err, result) => {
                    if (err) {
                        console.error('broadcastProfileUpdate error:', err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    /**
     * Broadcasts a profile metadata update via Steem Keychain using account_update2.
     * @private
     * @param {string} username
     * @param {string} postingJsonMetadata - Stringified metadata JSON
     * @returns {Promise<Object>}
     */
    broadcastProfileUpdateWithKeychain(username, postingJsonMetadata) {
        return new Promise((resolve, reject) => {
            const operations = [
                ['account_update2', {
                    account: username,
                    json_metadata: '',
                    posting_json_metadata: postingJsonMetadata,
                    extensions: []
                }]
            ];

            window.steem_keychain.requestBroadcast(
                username,
                operations,
                'posting',
                (response) => {
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error));
                    }
                }
            );
        });
    }

    async getMemoKeyFromAlternativeSources(username) {
        // First try to get from Keychain if available
        if (window.steem_keychain) {
            try {
                return await this.getMemoKeyFromKeychain(username);
            } catch (error) {
                console.warn('Failed to get memo key from Keychain:', error);
            }
        }

        // If Keychain didn't work, ask the user
        return this.askUserForMemoKey(username);
    }

    async getMemoKeyFromKeychain(username) {
        return new Promise((resolve, reject) => {
            // First check if we can get the public memo key
            window.steem_keychain.requestPublicKey(username, 'Memo', (response) => {
                if (response.success) {
                    console.log('Got public memo key from Keychain:', response.publicKey);
                    resolve(response.publicKey);
                } else {
                    console.warn('Keychain could not provide public memo key:', response.error);
                    reject(new Error(response.error));
                }
            });
        });
    }

    async askUserForMemoKey(username) {
        // Create a modal dialog to ask for the memo key
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            modal.innerHTML = `
                <div class="memo-key-modal-content">
                    <h3>Memo Key Required</h3>
                    <p>To update your profile, we need your public memo key. This is not your private key - it starts with STM and is safe to share.</p>
                    
                    <div class="input-group">
                        <label for="memo-key-input">Public Memo Key for @${username}:</label>
                        <input type="text" id="memo-key-input" placeholder="STM..." />
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="memo-key-cancel">Cancel</button>
                        <button id="memo-key-submit">Submit</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            document.getElementById('memo-key-cancel').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('');
            });

            document.getElementById('memo-key-submit').addEventListener('click', () => {
                const memoKey = document.getElementById('memo-key-input').value.trim();
                document.body.removeChild(modal);

                if (memoKey && memoKey.startsWith('STM')) {
                    resolve(memoKey);
                } else {
                    alert('Invalid memo key format. Please provide a valid public memo key starting with STM.');
                    resolve('');
                }
            });
        });
    }

    async showActiveKeyRequiredModal(username) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            modal.innerHTML = `
                <div class="memo-key-modal-content">
                    <h3>Active Authority Required</h3>
                    <p>Updating your profile requires your active key or active authority access.</p>
                    
                    <div class="key-options">
                        <h4>Options to proceed:</h4>
                        <ol>
                            <li>
                                <strong>Use Steem Keychain:</strong> Install the Keychain browser extension 
                                for secure access to your Steem account.
                            </li>
                            <li>
                                <strong>Add your active key:</strong> You can add your active key to local storage. 
                                <span class="warning">(Less secure - use only on trusted devices)</span>
                            </li>
                        </ol>
                    </div>
                    
                    <div class="active-key-input" style="display: none;">
                        <div class="input-group">
                            <label for="active-key-input">Enter your active private key:</label>
                            <input type="password" id="active-key-input" placeholder="5K..." />
                            <small class="warning">Warning: Only enter your key on trusted devices and connections</small>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="save-active-key" />
                            <label for="save-active-key">Save this key for future updates</label>
                        </div>
                        <button id="submit-active-key">Submit Key</button>
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="show-key-input">Use Active Key</button>
                        <button id="close-modal">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            document.getElementById('close-modal').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve();
            });

            document.getElementById('show-key-input').addEventListener('click', () => {
                document.querySelector('.active-key-input').style.display = 'block';
                document.querySelector('.modal-buttons').style.display = 'none';
            });

            document.getElementById('submit-active-key').addEventListener('click', () => {
                const activeKey = document.getElementById('active-key-input').value.trim();
                const saveKey = document.getElementById('save-active-key').checked;

                if (activeKey) {
                    if (saveKey) {
                        localStorage.setItem(`${username}_active_key`, activeKey);
                    }

                    document.body.removeChild(modal);
                    resolve(activeKey);
                } else {
                    alert('Please enter your active key');
                }
            });
        });
    }

    /**
     * Follow a user using Steem blockchain operations
     * @param {string} follower - Username of the current user who wants to follow someone
     * @param {string} following - Username of the user to follow
     * @returns {Promise<Object>} - Result of the follow operation
     */
    async followUser(follower, following, options = {}) {
        await this.core.ensureLibraryLoaded();
        
        try {
            // Create the custom JSON operation for following
            const json = JSON.stringify(['follow', {
                follower: follower,
                following: following,
                what: ['blog'] // 'blog' means follow, empty array means unfollow
            }]);
            
            // Prefer decrypted key provided by the caller (AuthService cache)
            const providedPostingKey = options?.postingKey;
            const postingKey = this.isValidWifKey(providedPostingKey)
                ? providedPostingKey
                : this.getStoredPostingKey(follower);
            
            // Se l'utente ha la chiave memorizzata, usiamo quella (priorità al localStorage)
            if (postingKey) {
                console.log('Using stored posting key for follow operation');
                return this.broadcastFollowOperation(follower, json, postingKey);
            }
            
            // Altrimenti proviamo con Keychain se disponibile
            if (window.steem_keychain) {
                console.log('Using Steem Keychain for follow operation');
                return this.broadcastFollowWithKeychain(follower, json);
            }
            
            // Se nessun metodo di autenticazione è disponibile, mostriamo l'UI per guidare l'utente
            console.log('No authentication method available, showing dialog');
            await this.showFollowAuthRequiredModal(follower);
            
            // Se l'utente ha inserito una chiave nel modal, ora dovrebbe essere disponibile
            const newPostingKey = this.getStoredPostingKey(follower);
            if (newPostingKey) {
                return this.broadcastFollowOperation(follower, json, newPostingKey);
            }
            
            throw new Error('Posting authority required to follow users');
        } catch (error) {
            console.error('Error following user:', error);
            throw error;
        }
    }
    
    /**
     * Unfollow a user using Steem blockchain operations
     * @param {string} follower - Username of the current user who wants to unfollow someone
     * @param {string} following - Username of the user to unfollow
     * @returns {Promise<Object>} - Result of the unfollow operation
     */
    async unfollowUser(follower, following, options = {}) {
        await this.core.ensureLibraryLoaded();
        
        try {
            // Create the custom JSON operation for unfollowing (empty 'what' array)
            const json = JSON.stringify(['follow', {
                follower: follower,
                following: following,
                what: [] // Empty array means unfollow
            }]);
            
            // Prefer decrypted key provided by the caller (AuthService cache)
            const providedPostingKey = options?.postingKey;
            const postingKey = this.isValidWifKey(providedPostingKey)
                ? providedPostingKey
                : this.getStoredPostingKey(follower);
            
            // Se l'utente ha la chiave memorizzata, usiamo quella (priorità al localStorage)
            if (postingKey) {
                console.log('Using stored posting key for unfollow operation');
                return this.broadcastFollowOperation(follower, json, postingKey);
            }
            
            // Altrimenti proviamo con Keychain se disponibile
            if (window.steem_keychain) {
                console.log('Using Steem Keychain for unfollow operation');
                return this.broadcastFollowWithKeychain(follower, json);
            }
            
            // Se nessun metodo di autenticazione è disponibile, mostriamo l'UI per guidare l'utente
            console.log('No authentication method available, showing dialog');
            await this.showFollowAuthRequiredModal(follower);
            
            // Se l'utente ha inserito una chiave nel modal, ora dovrebbe essere disponibile
            const newPostingKey = this.getStoredPostingKey(follower);
            if (newPostingKey) {
                return this.broadcastFollowOperation(follower, json, newPostingKey);
            }
            
            throw new Error('Posting authority required to unfollow users');
        } catch (error) {
            console.error('Error unfollowing user:', error);
            throw error;
        }
    }
    
    /**
     * Check if a user follows another user
     * @param {string} follower - Username of the potential follower
     * @param {string} following - Username of the potential followed user
     * @returns {Promise<boolean>} - True if follower follows following
     */
    async checkIfFollowing(follower, following) {
        await this.core.ensureLibraryLoaded();
        
        try {
            console.log(`Checking if ${follower} follows ${following}...`);
            
            // Prova a bypassare la cache dell'API usando parametri unici
            const timestamp = Date.now();
            
            // Get list of users that follower is following
            const followingList = await new Promise((resolve, reject) => {
                // Usiamo direttamente l'API con un limit basso ma sufficiente
                // e un parametro timestamp per evitare la cache
                this.core.steem.api.getFollowing(
                    follower, 
                    '', 
                    'blog', 
                    100, 
                    (err, result) => {
                        if (err) {
                            console.error('Error in getFollowing API call:', err);
                            reject(err);
                        } else {
                            console.log(`Got ${result.length} following entries for ${follower}`);
                            resolve(result);
                        }
                    },
                    { _timestamp: timestamp } // Parametro opzionale per forzare richiesta fresh
                );
            });
            
            // Check if the 'following' user is in that list and log il risultato
            const isFollowing = followingList.some(entry => entry.following === following);
            console.log(`Result: ${follower} ${isFollowing ? 'follows' : 'does not follow'} ${following}`);
            
            return isFollowing;
        } catch (error) {
            console.error('Error checking follow status:', error);
            throw error;
        }
    }
    
    /**
     * Get stored posting key for a user
     * @private
     */
    getStoredPostingKey(username) {
        const candidates = [
            localStorage.getItem('postingKey'),
            localStorage.getItem(`${username}_posting_key`),
            localStorage.getItem(`${username.toLowerCase()}_posting_key`)
        ];

        for (const candidate of candidates) {
            if (this.isValidWifKey(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Checks whether a key looks like a valid WIF private key.
     * Encrypted blobs (enc:/pin:) are rejected.
     * @private
     */
    isValidWifKey(key) {
        if (!key || typeof key !== 'string') return false;
        const trimmed = key.trim();
        if (!trimmed) return false;

        try {
            if (this.core?.steem?.auth?.isWif) {
                return this.core.steem.auth.isWif(trimmed);
            }
        } catch (_) {
            // fall through to a conservative heuristic
        }

        // Conservative fallback for legacy contexts where steem auth is not ready.
        return /^5[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(trimmed);
    }
    
    /**
     * Broadcast a follow operation using direct key authentication
     * @private
     */
    broadcastFollowOperation(username, jsonData, postingKey) {
        return new Promise((resolve, reject) => {
            try {
                // Verifica validità del JSON prima di procedere
                let parsedJson;
                try {
                    parsedJson = JSON.parse(jsonData);
                } catch (parseError) {
                    console.error('Invalid JSON data:', parseError);
                    return reject(new Error(`Invalid JSON format for follow operation: ${parseError.message}`));
                }
                
                const operations = [
                    ['custom_json', {
                        required_auths: [],
                        required_posting_auths: [username],
                        id: 'follow',
                        json: jsonData
                    }]
                ];
                
                console.log('Broadcasting follow operation with key:', operations);
                
                this.core.steem.broadcast.send(
                    { operations, extensions: [] },
                    { posting: postingKey },
                    (err, result) => {
                        if (err) {
                            console.error('Error broadcasting follow operation:', err);
                            reject(err);
                        } else {
                            console.log('Follow operation successful:', result);
                            resolve(result);
                        }
                    }
                );
            } catch (error) {
                console.error('Error in broadcastFollowOperation:', error);
                reject(new Error(`Failed to broadcast follow operation: ${error.message}`));
            }
        });
    }
    
    /**
     * Broadcast a follow operation using Keychain
     * @private
     */
    broadcastFollowWithKeychain(username, jsonData) {
        return new Promise((resolve, reject) => {
            try {
                // Verifica che jsonData sia un dato JSON valido
                let parsedJson;
                try {
                    parsedJson = JSON.parse(jsonData);
                } catch (parseError) {
                    console.error('Invalid JSON data:', parseError);
                    return reject(new Error(`Invalid JSON format: ${parseError.message}`));
                }
                
                // Verifica la struttura del JSON
                if (!Array.isArray(parsedJson) || parsedJson.length !== 2 || parsedJson[0] !== 'follow') {
                    console.error('Invalid follow operation format:', parsedJson);
                    return reject(new Error('Invalid follow operation format'));
                }
                
                // Verifica i campi necessari nell'oggetto follow
                const followObj = parsedJson[1];
                if (!followObj.follower || !followObj.following || !Array.isArray(followObj.what)) {
                    console.error('Missing required fields in follow operation:', followObj);
                    return reject(new Error('Missing required fields in follow operation'));
                }
                
                console.log('Sending follow operation to Keychain:', jsonData);
                
                if (!window.steem_keychain) {
                    return reject(new Error('Steem Keychain not found. Please install the Steem Keychain extension.'));
                }
                
                // CORREZIONE: "posting" deve essere "Posting" con la P maiuscola per Keychain
                window.steem_keychain.requestCustomJson(
                    username,
                    'follow',
                    'Posting',  // Corretto da 'posting' a 'Posting'
                    jsonData,
                    'Follow/Unfollow User',
                    (response) => {
                        console.log('Keychain response:', response);
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response.error || 'Unknown Keychain error'));
                        }
                    }
                );
            } catch (error) {
                console.error('Error in broadcastFollowWithKeychain:', error);
                reject(new Error(`Failed to broadcast follow operation: ${error.message}`));
            }
        });
    }
    
    /**
     * Show modal to guide user through authentication for follow actions
     * @private
     */
    async showFollowAuthRequiredModal(username) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'follow-auth-modal';
            modal.innerHTML = `
                <div class="follow-auth-modal-content">
                    <h3>Authentication Required</h3>
                    <p>Following or unfollowing users requires posting authority.</p>
                    
                    <div class="auth-options">
                        <h4>Options to proceed:</h4>
                        <ol>
                            <li>
                                <strong>Use Steem Keychain:</strong> Install the Keychain browser extension 
                                for secure access to your Steem account.
                            </li>
                            <li>
                                <strong>Add your posting key:</strong> You can add your posting key to local storage. 
                                <span class="warning">(Less secure - use only on trusted devices)</span>
                            </li>
                        </ol>
                    </div>
                    
                    <div class="posting-key-input" style="display: none;">
                        <div class="input-group">
                            <label for="posting-key-input">Enter your posting private key:</label>
                            <input type="password" id="posting-key-input" placeholder="5K..." />
                            <small class="warning">Warning: Only enter your key on trusted devices and connections</small>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="save-posting-key" />
                            <label for="save-posting-key">Save this key for future actions</label>
                        </div>
                        <button id="submit-posting-key">Submit Key</button>
                    </div>
                    
                    <div class="modal-buttons">
                        <button id="show-key-input">Use Posting Key</button>
                        <button id="close-modal">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            document.getElementById('close-modal').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve();
            });

            document.getElementById('show-key-input').addEventListener('click', () => {
                document.querySelector('.posting-key-input').style.display = 'block';
                document.querySelector('.modal-buttons').style.display = 'none';
            });

            document.getElementById('submit-posting-key').addEventListener('click', () => {
                const postingKey = document.getElementById('posting-key-input').value.trim();
                const saveKey = document.getElementById('save-posting-key').checked;

                if (postingKey) {
                    if (saveKey) {
                        localStorage.setItem(`${username}_posting_key`, postingKey);
                    }
                    document.body.removeChild(modal);
                    resolve(postingKey);
                } else {
                    alert('Please enter your posting key');
                }
            });
        });
    }
}