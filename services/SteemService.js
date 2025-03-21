import eventEmitter from '../utils/EventEmitter.js';


class SteemService {
    constructor() {
        if (window.steem) {
            this.steem = window.steem;
            this.configureApi();
        } else {
            this.loadLibrary();
        }

        this.apiEndpoints = [
            'https://api.moecki.online',
            'https://api.steemit.com',
            'https://api.steemitdev.com',
            'https://api.steemzzang.com',
            'https://api.steemit.com',
            'https://api.steemitstage.com',
            'https://api.steem.house',
            'https://api.steem.place',
            'https://api.steem.press',
            'https://api.steemstack.io',
            'https://api.steemtools.com',
            'https://api.steemul.com',
            'https://api.steemworld.org',
            'https://api.steemyy.com',
            'https://api.steemzzang.com',

        ];
        this.currentEndpoint = 0;
    }

    async loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/steem/dist/steem.min.js';
            script.async = true;

            script.onload = () => {
                if (window.steem) {
                    this.steem = window.steem;
                    this.configureApi();
                    eventEmitter.emit('steem:loaded');
                    resolve(this.steem);
                } else {
                    const error = new Error('Steem library loaded but not available globally');
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: 'Failed to initialize Steem connection'
                    });
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error('Failed to load Steem library');
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: 'Failed to load Steem library'
                });
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    configureApi() {
        if (!this.steem) {
            throw new Error('Steem library not loaded');
        }

        this.steem.api.setOptions({ url: this.apiEndpoints[this.currentEndpoint] });
        this.steem.config.set('address_prefix', 'STM');
        this.steem.config.set('chain_id', '0000000000000000000000000000000000000000000000000000000000000000');
    }

    switchEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % this.apiEndpoints.length;
        this.configureApi();
        console.log(`Switched to endpoint: ${this.apiEndpoints[this.currentEndpoint]}`);
        return this.apiEndpoints[this.currentEndpoint];
    }

    async ensureLibraryLoaded() {
        if (!this.steem) {
            try {
                await this.loadLibrary();
            } catch (error) {
                console.error('Failed to load Steem library:', error);
                throw new Error('Steem library not loaded');
            }
        }
        return this.steem;
    }

    _initializePostTracking() {
        if (!this.seenPostIds) {
            this.seenPostIds = {};
        }
    }

    _isNewPost(post, category) {
        this._initializePostTracking();
        if (!this.seenPostIds[category]) {
            this.seenPostIds[category] = new Set();
        }

        const postId = `${post.author}_${post.permlink}`;
        if (this.seenPostIds[category].has(postId)) {
            return false;
        }

        this.seenPostIds[category].add(postId);
        return true;
    }

    resetCategoryTracking(category) {
        if (this.seenPostIds && this.seenPostIds[category]) {
            this.seenPostIds[category].clear();
        }
        if (this.lastPostByCategory && this.lastPostByCategory[category]) {
            delete this.lastPostByCategory[category];
        }
    }

    async _getDiscussionsByMethod(method, options, retries = 2) {
        await this.ensureLibraryLoaded();

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    this.steem.api[method](options, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            } catch (error) {
                console.error(`Error in ${method} (attempt ${attempt + 1}):`, error);
                if (attempt === retries) throw error;
                this.switchEndpoint();
            }
        }
    }


    async getPostsByCategory(category, page = 1, limit = 20) {
        await this.ensureLibraryLoaded();

        const method = this.getCategoryMethod(category);

        try {
            if (page === 1) {
                this.resetCategoryTracking(category);
            }

            const MAX_REQUEST_LIMIT = 100;
            const query = this.buildCategoryQuery(category, page, limit, MAX_REQUEST_LIMIT);

            const posts = this.fetchAndProcessPosts(method, query, category, limit);

            return {
                posts: posts || [],
                hasMore: Boolean(posts && posts.length > 0)
            };
        } catch (error) {
            console.error(`Error fetching ${category} posts:`, error);
            return { posts: [], hasMore: false };
        }
    }

    getCategoryMethod(category) {
        const categoryToMethod = {
            'trending': 'getDiscussionsByTrending',
            'hot': 'getDiscussionsByHot',
            'created': 'getDiscussionsByCreated',
            'promoted': 'getDiscussionsByPromoted'
        };

        const method = categoryToMethod[category];
        if (!method) {
            throw new Error(`Invalid category: ${category}`);
        }

        return method;
    }

    buildCategoryQuery(category, page, limit, maxLimit) {
        const query = {
            tag: '',
            limit: Math.min(limit + 5, maxLimit) // Request slightly more to handle duplicates
        };

        const lastPostData = this.lastPostByCategory && this.lastPostByCategory[category];
        if (page > 1 && lastPostData) {
            query.start_author = lastPostData.author;
            query.start_permlink = lastPostData.permlink;
        }

        return query;
    }

    async fetchAndProcessPosts(method, query, category, limit) {
        let posts = await this._getDiscussionsByMethod(method, query);

        if (!Array.isArray(posts)) {
            return [];
        }

        // Filter out any posts we've seen before
        posts = posts.filter(post => this._isNewPost(post, category));

        this.updateLastPostReference(posts, category);

        // Trim back to requested limit
        return posts.length > limit ? posts.slice(0, limit) : posts;
    }

    updateLastPostReference(posts, category) {
        if (posts.length === 0) {
            return;
        }

        if (!this.lastPostByCategory) {
            this.lastPostByCategory = {};
        }

        // Use the last item as the pagination marker
        this.lastPostByCategory[category] = posts[posts.length - 1];
    }

    async getTrendingPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('trending', page, limit);
    }

    async getHotPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('hot', page, limit);
    }

    async getNewPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('created', page, limit);
    }

    async getPromotedPosts(page = 1, limit = 20) {
        return this.getPostsByCategory('promoted', page, limit);
    }

    async getContent(author, permlink) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getContent(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    async getContentReplies(author, permlink) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getContentReplies(author, permlink, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching content replies:', error);
            this.switchEndpoint();
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

    async getUserData(username, options = { includeProfile: false }) {
        await this.ensureLibraryLoaded();

        try {
            const accounts = await new Promise((resolve, reject) => {
                this.steem.api.getAccounts([username], (err, result) => {
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
            this.switchEndpoint();
            throw error;
        }
    }

    async getAccountHistory(username, from = -1, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getAccountHistory(username, from, limit, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } catch (error) {
            console.error('Error fetching account history:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    async getUserPosts(username, limit = 10) {
        await this.ensureLibraryLoaded();

        try {
            return await new Promise((resolve, reject) => {
                // Use getDiscussionsByBlog which is more reliable for fetching a user's blog posts
                this.steem.api.getDiscussionsByBlog(
                    { tag: username, limit },
                    (err, result) => {
                        if (err) {
                            console.error('API Error details:', err);
                            reject(err);
                        } else {
                            resolve(result || []);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error fetching user posts:', error);
            this.switchEndpoint();
            throw error;
        }
    }

    async getPostsByAuthor(options = {}) {
        const { author, limit = 10, start_permlink = '' } = options;

        try {
            // Get posts by specific author
            const query = {
                tag: author,
                limit: limit,
                truncate_body: 1
            };

            if (start_permlink) {
                query.start_permlink = start_permlink;
            }

            const response = await this.api.getDiscussionsByBlogAsync(query);
            return response || [];
        } catch (error) {
            console.error('Error fetching posts by author:', error);
            return [];
        }
    }

    async getPostsFromAll(options = {}) {
        const { limit = 20, start_author = '', start_permlink = '' } = options;

        try {
            // Get posts from entire site (trending)
            const response = await this.api.getDiscussionsByTrendingAsync({
                tag: '',
                limit: limit,
                start_author: start_author,
                start_permlink: start_permlink,
                truncate_body: 1
            });
            return response || [];
        } catch (error) {
            console.error('Error fetching posts:', error);
            return [];
        }
    }

    async getPostsByTag(options = {}) {
        const { tag, page = 1, limit = 20 } = options;

        if (!tag) {
            console.error('No tag provided to getPostsByTag');
            return { posts: [], hasMore: false };
        }

        await this.ensureLibraryLoaded();

        try {
            // Use the tag to fetch content
            const query = {
                tag: tag.toLowerCase(),
                limit: limit
            };

            if (page > 1 && this.lastTagPost) {
                query.start_author = this.lastTagPost.author;
                query.start_permlink = this.lastTagPost.permlink;
            }

            // Use trending to get popular posts with this tag
            const posts = await this._getDiscussionsByMethod('getDiscussionsByTrending', query);

            if (!posts || posts.length === 0) {
                return { posts: [], hasMore: false };
            }

            // Store the last post for pagination
            this.lastTagPost = posts[posts.length - 1];

            return {
                posts: posts,
                hasMore: posts.length > 0
            };
        } catch (error) {
            console.error(`Error fetching posts for tag ${tag}:`, error);
            return { posts: [], hasMore: false };
        }
    }


    async createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        // Input validation
        if (!author || !permlink) {
            throw new Error('Author and permlink are required');
        }

        await this.ensureLibraryLoaded();

        // Sanitize the permlink for base58 compatibility
        const sanitizedPermlink = this.sanitizePermlink(permlink);
        
        // Prepare the comment operation
        const commentOperation = this.prepareCommentOperation(
            parentAuthor, 
            parentPermlink, 
            author, 
            sanitizedPermlink, 
            title, 
            body, 
            jsonMetadata
        );

        // Broadcast with appropriate method
        return this.isKeychainAvailable() 
            ? this.broadcastWithKeychain(author, commentOperation) 
            : this.broadcastWithPostingKey(commentOperation);
    }
    
    prepareCommentOperation(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        return [
            ['comment', {
                parent_author: parentAuthor,
                parent_permlink: parentPermlink,
                author: author,
                permlink: permlink,
                title: title || '',
                body: body || '',
                json_metadata: JSON.stringify(jsonMetadata || {})
            }]
        ];
    }
    
    isKeychainAvailable() {
        return !!window.steem_keychain;
    }
    
    async broadcastWithKeychain(author, operations) {
        return new Promise((resolve, reject) => {
            window.steem_keychain.requestBroadcast(
                author, 
                operations, 
                'posting', 
                response => this.handleKeychainResponse(response, resolve, reject)
            );
        });
    }
    
    handleKeychainResponse(response, resolve, reject) {
        if (response.success) {
            resolve(response);
        } else {
            reject(new Error(response.error || 'Unknown keychain error'));
        }
    }
    
    async broadcastWithPostingKey(operations) {
        const postingKey = this.getStoredPostingKey();
        
        if (!postingKey) {
            throw new Error('No posting key found and Keychain not available. Please log in to comment.');
        }
        
        return this.broadcastWithKey(postingKey, operations);
    }
    
    getStoredPostingKey() {
        return localStorage.getItem('postingKey');
    }
    
    async broadcastWithKey(postingKey, operations) {
        const commentOp = operations[0][1];
        
        return new Promise((resolve, reject) => {
            this.steem.broadcast.comment(
                postingKey,
                commentOp.parent_author,
                commentOp.parent_permlink,
                commentOp.author,
                commentOp.permlink,
                commentOp.title,
                commentOp.body,
                commentOp.json_metadata,
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    sanitizePermlink(permlink) {
        if (!permlink || typeof permlink !== 'string') {
            // Generate a fallback permlink based on timestamp
            return `re-comment-${Date.now().toString(36)}`;
        }

        // First, convert to lowercase (Steem requires lowercase)
        let sanitized = permlink.toLowerCase();

        // Replace spaces with hyphens
        sanitized = sanitized.replace(/\s+/g, '-');

        // Keep only alphanumeric characters, hyphens, and dots
        sanitized = sanitized.replace(/[^a-z0-9\-\.]/g, '');

        // Steem doesn't like permalinks starting with numbers or dots
        if (/^[0-9\.]/.test(sanitized)) {
            sanitized = `re-${sanitized}`;
        }

        // Make sure it's not too long (max 256 characters)
        if (sanitized.length > 256) {
            sanitized = sanitized.substring(0, 256);
        }

        // Ensure the permlink is not empty
        if (!sanitized || sanitized.length === 0) {
            sanitized = `re-comment-${Date.now().toString(36)}`;
        }

        console.log('Sanitized permlink:', sanitized);
        return sanitized;
    }

    async getFollowers(username) {
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getFollowers(username, '', 'blog', 1000, (err, result) => {
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
        await this.ensureLibraryLoaded();
        try {
            return await new Promise((resolve, reject) => {
                this.steem.api.getFollowing(username, '', 'blog', 1000, (err, result) => {
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
        await this.ensureLibraryLoaded();
        
        // Get existing metadata and prepare the update
        const { metadata, memoKey } = await this.prepareProfileMetadata(username, profile);
        
        // Get authentication method and proceed with update
        const activeKey = this.getStoredActiveKey(username);
        
        if (activeKey) {
            return this.broadcastProfileUpdate(username, metadata, memoKey, activeKey);
        } else if (window.steem_keychain) {
            return this.broadcastProfileUpdateWithKeychain(username, metadata, memoKey);
        } else {
            await this.showActiveKeyRequiredModal(username);
            throw new Error('Active authority required to update profile. Please use Keychain or provide your active key.');
        }
    }
    
    async prepareProfileMetadata(username, profile) {
        // Get user data and extract metadata
        const userData = await this.fetchUserDataForProfileUpdate(username);
        
        // Extract memo key, fetch from alternative sources if needed
        const memoKey = userData.memo_key || await this.getMemoKeyFromAlternativeSources(username);
        if (!memoKey) {
            throw new Error('Cannot update profile without a memo key. Please try again later.');
        }
        
        // Parse existing metadata or create new object
        let metadata = this.parseExistingMetadata(userData.json_metadata);
        
        // Update profile in metadata
        metadata.profile = profile;
        
        return { 
            metadata: JSON.stringify(metadata), 
            memoKey 
        };
    }

    async fetchUserDataForProfileUpdate(username) {
        try {
            const userData = await this.getUserData(username);
            if (!userData) {
                throw new Error('User data not found');
            }
            return userData;
        } catch (error) {
            console.warn('Failed to get existing user data:', error);
            return {}; // Return empty object to allow process to continue with alternatives
        }
    }

    parseExistingMetadata(jsonMetadata) {
        if (!jsonMetadata) return {};
        
        try {
            return JSON.parse(jsonMetadata);
        } catch (error) {
            console.warn('Failed to parse existing metadata, starting fresh');
            return {};
        }
    }
    
    getStoredActiveKey(username) {
        return localStorage.getItem('activeKey') || 
               localStorage.getItem(`${username}_active_key`) ||
               localStorage.getItem(`${username.toLowerCase()}_active_key`);
    }
    
    broadcastProfileUpdate(username, jsonMetadata, memoKey, activeKey) {
        return new Promise((resolve, reject) => {
            const operations = [
                ['account_update', {
                    account: username,
                    memo_key: memoKey,
                    json_metadata: jsonMetadata
                }]
            ];
            
            this.steem.broadcast.send(
                { operations, extensions: [] },
                { active: activeKey },
                (err, result) => {
                    if (err) {
                        console.error('Error updating profile with direct broadcast:', err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }
    
    broadcastProfileUpdateWithKeychain(username, jsonMetadata, memoKey) {
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
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            
            // Create modal content container
            const modalContent = document.createElement('div');
            modalContent.className = 'memo-key-modal-content';
            
            // Create title
            const title = document.createElement('h3');
            title.textContent = 'Memo Key Required';
            
            // Create description
            const description = document.createElement('p');
            description.textContent = 'To update your profile, we need your public memo key. This is not your private key - it starts with STM and is safe to share.';
            
            // Create input group
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            
            // Create label
            const label = document.createElement('label');
            label.setAttribute('for', 'memo-key-input');
            label.textContent = `Public Memo Key for @${username}:`;
            
            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'memo-key-input';
            input.placeholder = 'STM...';
            
            // Create buttons container
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'modal-buttons';
            
            // Create cancel button
            const cancelButton = document.createElement('button');
            cancelButton.id = 'memo-key-cancel';
            cancelButton.textContent = 'Cancel';
            
            // Create submit button
            const submitButton = document.createElement('button');
            submitButton.id = 'memo-key-submit';
            submitButton.textContent = 'Submit';
            
            // Build the DOM structure
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            
            buttonsDiv.appendChild(cancelButton);
            buttonsDiv.appendChild(submitButton);
            
            modalContent.appendChild(title);
            modalContent.appendChild(description);
            modalContent.appendChild(inputGroup);
            modalContent.appendChild(buttonsDiv);
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('');
            });
            
            submitButton.addEventListener('click', () => {
                const memoKey = input.value.trim();
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
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'memo-key-modal';
            
            // Create modal content
            const modalContent = document.createElement('div');
            modalContent.className = 'memo-key-modal-content';
            
            // Create title
            const title = document.createElement('h3');
            title.textContent = 'Active Authority Required';
            
            // Create description
            const description = document.createElement('p');
            description.textContent = 'Updating your profile requires your active key or active authority access.';
            
            // Create options section
            const keyOptions = document.createElement('div');
            keyOptions.className = 'key-options';
            
            const optionsTitle = document.createElement('h4');
            optionsTitle.textContent = 'Options to proceed:';
            
            const optionsList = document.createElement('ol');
            
            // Option 1
            const option1 = document.createElement('li');
            const option1Title = document.createElement('strong');
            option1Title.textContent = 'Use Steem Keychain: ';
            option1.appendChild(option1Title);
            option1.appendChild(document.createTextNode('Install the Keychain browser extension for secure access to your Steem account.'));
            
            // Option 2
            const option2 = document.createElement('li');
            const option2Title = document.createElement('strong');
            option2Title.textContent = 'Add your active key: ';
            const option2Warning = document.createElement('span');
            option2Warning.className = 'warning';
            option2Warning.textContent = '(Less secure - use only on trusted devices)';
            option2.appendChild(option2Title);
            option2.appendChild(document.createTextNode('You can add your active key to local storage. '));
            option2.appendChild(option2Warning);
            
            // Build options list
            optionsList.appendChild(option1);
            optionsList.appendChild(option2);
            keyOptions.appendChild(optionsTitle);
            keyOptions.appendChild(optionsList);
            
            // Create input section (initially hidden)
            const activeKeyInput = document.createElement('div');
            activeKeyInput.className = 'active-key-input';
            activeKeyInput.style.display = 'none';
            
            // Input group
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            
            const inputLabel = document.createElement('label');
            inputLabel.setAttribute('for', 'active-key-input');
            inputLabel.textContent = 'Enter your active private key:';
            
            const input = document.createElement('input');
            input.type = 'password';
            input.id = 'active-key-input';
            input.placeholder = '5K...';
            
            const inputWarning = document.createElement('small');
            inputWarning.className = 'warning';
            inputWarning.textContent = 'Warning: Only enter your key on trusted devices and connections';
            
            // Checkbox group
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'checkbox-group';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'save-active-key';
            
            const checkboxLabel = document.createElement('label');
            checkboxLabel.setAttribute('for', 'save-active-key');
            checkboxLabel.textContent = 'Save this key for future updates';
            
            // Submit button
            const submitButton = document.createElement('button');
            submitButton.id = 'submit-active-key';
            submitButton.textContent = 'Submit Key';
            
            // Build input section
            inputGroup.appendChild(inputLabel);
            inputGroup.appendChild(input);
            inputGroup.appendChild(inputWarning);
            
            checkboxGroup.appendChild(checkbox);
            checkboxGroup.appendChild(checkboxLabel);
            
            activeKeyInput.appendChild(inputGroup);
            activeKeyInput.appendChild(checkboxGroup);
            activeKeyInput.appendChild(submitButton);
            
            // Create buttons section
            const modalButtons = document.createElement('div');
            modalButtons.className = 'modal-buttons';
            
            const showKeyInputButton = document.createElement('button');
            showKeyInputButton.id = 'show-key-input';
            showKeyInputButton.textContent = 'Use Active Key';
            
            const closeButton = document.createElement('button');
            closeButton.id = 'close-modal';
            closeButton.textContent = 'Close';
            
            modalButtons.appendChild(showKeyInputButton);
            modalButtons.appendChild(closeButton);
            
            // Build modal structure
            modalContent.appendChild(title);
            modalContent.appendChild(description);
            modalContent.appendChild(keyOptions);
            modalContent.appendChild(activeKeyInput);
            modalContent.appendChild(modalButtons);
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Add event listeners
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve();
            });
            
            showKeyInputButton.addEventListener('click', () => {
                activeKeyInput.style.display = 'block';
                modalButtons.style.display = 'none';
            });
            
            submitButton.addEventListener('click', () => {
                const activeKey = input.value.trim();
                const saveKey = checkbox.checked;
                
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

// Initialize singleton instance
const steemService = new SteemService();
export default steemService;
//usage
// import steemService from '../services/SteemService.js';