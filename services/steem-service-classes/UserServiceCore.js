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

    async updateUserProfile(username, profile) {
        await this.core.ensureLibraryLoaded();

        console.log('SteemService: Updating profile for user:', username);
        console.log('Profile data to update:', profile);

        // Prepare metadata in the correct format
        let metadata = {};
        let memo_key = '';

        try {
            // Get existing metadata and memo_key if any
            const userData = await this.getUserData(username);
            if (!userData) {
                throw new Error('User data not found');
            }

            // Important: Get the existing memo_key which is required for account_update
            memo_key = userData.memo_key;
            console.log('Using existing memo_key:', memo_key);

            if (userData.json_metadata) {
                try {
                    const existingMetadata = JSON.parse(userData.json_metadata);
                    metadata = { ...existingMetadata };
                } catch (e) {
                    console.warn('Failed to parse existing metadata, starting fresh');
                }
            }
        } catch (e) {
            console.warn('Failed to get existing user data:', e);
            // Don't throw an error yet - we'll try to get the memo key another way
        }

        // If we couldn't get memo_key from user data, try alternative sources
        if (!memo_key) {
            memo_key = await this.getMemoKeyFromAlternativeSources(username);
            if (!memo_key) {
                throw new Error('Cannot update profile without a memo key. Please try again later.');
            }
        }

        // Set or update the profile property
        metadata.profile = profile;

        const jsonMetadata = JSON.stringify(metadata);
        console.log('Final json_metadata to broadcast:', jsonMetadata);

        // Check for active key first (needed for account_update)
        const activeKey = localStorage.getItem('activeKey') ||
            localStorage.getItem(`${username}_active_key`) ||
            localStorage.getItem(`${username.toLowerCase()}_active_key`);

        // Posting key won't work for account_update, but check anyway as fallback
        const postingKey = localStorage.getItem('postingKey') ||
            localStorage.getItem(`${username}_posting_key`) ||
            localStorage.getItem(`${username.toLowerCase()}_posting_key`);

        // Log authentication method being used
        if (activeKey) {
            console.log('Using stored active key for update');
        } else if (window.steem_keychain) {
            console.log('Using Steem Keychain for update');
        } else {
            console.log('No active key or Keychain available');
        }

        // If we have active key, use it
        if (activeKey) {
            return new Promise((resolve, reject) => {
                try {
                    // Use standard operation with all required fields
                    const operations = [
                        ['account_update', {
                            account: username,
                            memo_key: memo_key, // Required field
                            json_metadata: jsonMetadata
                        }]
                    ];

                    this.core.steem.broadcast.send(
                        { operations: operations, extensions: [] },
                        { active: activeKey }, // Use active key for account_update
                        (err, result) => {
                            if (err) {
                                console.error('Error updating profile with direct broadcast:', err);
                                reject(err);
                            } else {
                                console.log('Profile updated successfully:', result);
                                resolve(result);
                            }
                        }
                    );
                } catch (error) {
                    console.error('Exception during profile update:', error);
                    reject(error);
                }
            });
        }
        // If Keychain is available, use it with explicit active authority
        else if (window.steem_keychain) {
            console.log('Using Keychain for profile update');

            return new Promise((resolve, reject) => {
                // Include memo_key in operation
                const operations = [
                    ['account_update', {
                        account: username,
                        memo_key: memo_key, // Required field
                        json_metadata: jsonMetadata
                    }]
                ];

                window.steem_keychain.requestBroadcast(
                    username,
                    operations,
                    'active', // Must use active authority for account_update
                    (response) => {
                        if (response.success) {
                            console.log('Profile updated successfully with Keychain:', response);
                            resolve(response);
                        } else {
                            console.error('Keychain broadcast error:', response.error);
                            reject(new Error(response.error));
                        }
                    }
                );
            });
        }
        // No active key or Keychain, show explanation to user
        else {
            // Create a modal dialog explaining the need for active key
            await this.showActiveKeyRequiredModal(username);
            throw new Error('Active authority required to update profile. Please use Keychain or provide your active key.');
        }
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