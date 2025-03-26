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
     * @returns {Promise<Object>} - The result of the update operation
     * @throws {Error} If the update fails or required authentication is missing
     */
    async updateUserProfile(username, profile) {
        await this.core.ensureLibraryLoaded();

        // Get existing user data and prepare metadata
        const { metadata, memoKey } = await this.prepareProfileUpdate(username);
        
        // Set or update the profile property and stringify
        metadata.profile = profile;
        const jsonMetadata = JSON.stringify(metadata);
        
        // Try updating with stored keys or Keychain
        const activeKey = this.getStoredActiveKey(username);
        
        if (activeKey) {
            return this.broadcastProfileUpdate(username, memoKey, jsonMetadata, activeKey);
        } else if (window.steem_keychain) {
            return this.broadcastProfileUpdateWithKeychain(username, memoKey, jsonMetadata);
        } else {
            // No active key or Keychain, show explanation to user
            await this.showActiveKeyRequiredModal(username);
            throw new Error('Active authority required to update profile. Please use Keychain or provide your active key.');
        }
    }

    /**
     * Prepares metadata and retrieves memo key for profile update
     * @private
     * @param {string} username - The username whose profile to update
     * @returns {Promise<Object>} - Object containing metadata and memoKey
     */
    async prepareProfileUpdate(username) {
        let metadata = {};
        let memoKey = '';

        try {
            // Get existing metadata and memo_key if any
            const userData = await this.getUserData(username);
            if (!userData) {
                throw new Error('User data not found');
            }

            memoKey = userData.memo_key;
            
            if (userData.json_metadata) {
                try {
                    metadata = JSON.parse(userData.json_metadata);
                } catch (e) {
                    // Start fresh if existing metadata can't be parsed
                    metadata = {};
                }
            }
        } catch (e) {
            // If we couldn't get user data, try to get just the memo key
        }

        // If we couldn't get memo_key from user data, try alternative sources
        if (!memoKey) {
            memoKey = await this.getMemoKeyFromAlternativeSources(username);
            if (!memoKey) {
                throw new Error('Cannot update profile without a memo key. Please try again later.');
            }
        }

        return { metadata, memoKey };
    }

    /**
     * Retrieves stored active key for a user
     * @private
     * @param {string} username - The username to get the key for
     * @returns {string|null} - The active key if found, null otherwise
     */
    getStoredActiveKey(username) {
        return localStorage.getItem('activeKey') ||
               localStorage.getItem(`${username}_active_key`) ||
               localStorage.getItem(`${username.toLowerCase()}_active_key`) ||
               null;
    }

    /**
     * Broadcasts a profile update using direct key authentication
     * @private
     * @param {string} username - Username to update
     * @param {string} memoKey - Memo key for the account
     * @param {string} jsonMetadata - Stringified metadata JSON
     * @param {string} activeKey - Active private key for authentication
     * @returns {Promise<Object>} - Result of the broadcast operation
     */
    broadcastProfileUpdate(username, memoKey, jsonMetadata, activeKey) {
        return new Promise((resolve, reject) => {
            try {
                const operations = [
                    ['account_update', {
                        account: username,
                        memo_key: memoKey,
                        json_metadata: jsonMetadata
                    }]
                ];

                this.core.steem.broadcast.send(
                    { operations, extensions: [] },
                    { active: activeKey },
                    (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Broadcasts a profile update using Keychain
     * @private
     * @param {string} username - Username to update
     * @param {string} memoKey - Memo key for the account
     * @param {string} jsonMetadata - Stringified metadata JSON
     * @returns {Promise<Object>} - Result of the broadcast operation
     */
    broadcastProfileUpdateWithKeychain(username, memoKey, jsonMetadata) {
        return new Promise((resolve, reject) => {
            const operations = [
                ['account_update', {
                    account: username,
                    memo_key: memoKey,
                    json_metadata: jsonMetadata
                }]
            ];

            window.steem_keychain.requestBroadcast(
                username,
                operations,
                'active',
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
}