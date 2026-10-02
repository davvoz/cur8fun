import profileService from '../services/ProfileService.js';
import router from '../utils/Router.js';

class FollowingModal {
    constructor() {
        this.modalElement = null;
        this.username = null;
        this.following = [];
        this.total = null;
        this.loadToken = 0;
        this.isLoading = false;
        this.error = null;
        
        this.init();
    }
    
    init() {
        // Create modal structure in DOM
        this.createModalElement();
        
        // Add to document body
        document.body.appendChild(this.modalElement);
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    createModalElement() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'following-modal';
        
        this.modalElement.innerHTML = `
            <div class="following-modal-content">
                <div class="following-modal-header">
                    <h2>Accounts <span class="username"></span> is following</h2>
                    <span class="following-modal-close">&times;</span>
                </div>
                <div class="following-modal-body">
                    <div class="following-loading">Loading accounts...</div>
                    <div class="following-error"></div>
                    <div class="following-list"></div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Close button click
        const closeButton = this.modalElement.querySelector('.following-modal-close');
        closeButton.addEventListener('click', () => this.close());
        
        // Close on click outside modal content
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }
    
    /**
     * Open the modal and load following accounts for the given username
     * @param {string} username - The username to load following accounts for
     */
    async open(username) {
        if (!username) {
            console.error('Username is required to open following modal');
            return;
        }
        
        this.username = username;
        
        // Update the modal title
        const usernameSpan = this.modalElement.querySelector('.username');
        usernameSpan.textContent = '@' + username;
        
        // Prevent body scrolling
        document.body.classList.add('modal-open');
        
        // Show the modal
        this.modalElement.style.display = 'flex';
        
        // Add visible class after a short delay to trigger animation
        setTimeout(() => {
            this.modalElement.classList.add('visible');
        }, 10);
        
        // Reset state; the token drops pages of a previous, slower request
        const token = ++this.loadToken;
        this.following = [];
        this.total = null;
        this.isLoading = true;
        this.error = null;
        this.modalElement.querySelector('.following-list').innerHTML = '';
        this.updateUI();

        profileService.getFollowCounts(username).then(counts => {
            if (token !== this.loadToken) return;
            this.total = counts.following;
            this.updateUI();
        });

        // Pages are rendered as they arrive: large accounts span many pages
        try {
            await profileService.getFollowingList(username, (page) => {
                if (token !== this.loadToken) return false; // closed or reopened: stop paging
                this.appendItems(page);
                this.updateUI();
            });
            if (token !== this.loadToken) return;
            this.isLoading = false;
            this.updateUI();
        } catch (error) {
            if (token !== this.loadToken) return;
            console.error('Error fetching following accounts:', error);
            this.isLoading = false;
            this.error = 'Failed to load. Please try again later.';
            this.updateUI();
        }
    }
    
    close() {
        // Stop rendering (and fetching) pages of a list still loading
        this.loadToken++;

        // Start animation
        this.modalElement.classList.remove('visible');
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            this.modalElement.style.display = 'none';
            
            // Re-enable body scrolling
            document.body.classList.remove('modal-open');
        }, 300); // Match the CSS transition duration
    }
    
    isOpen() {
        return this.modalElement.style.display === 'flex' || this.modalElement.style.display === 'block';
    }
    
    updateUI() {
        const loadingElement = this.modalElement.querySelector('.following-loading');
        const errorElement = this.modalElement.querySelector('.following-error');
        const listElement = this.modalElement.querySelector('.following-list');
        
        // Show/hide loading state, with progress once pages start arriving
        loadingElement.style.display = this.isLoading ? 'block' : 'none';
        if (this.isLoading) {
            const loaded = this.following.length;
            loadingElement.textContent = loaded === 0
                ? 'Loading accounts...'
                : `Loading accounts... ${loaded.toLocaleString('en-US')}${this.total ? ` of ${this.total.toLocaleString('en-US')}` : ''}`;
        }
        
        // Show/hide error
        errorElement.style.display = this.error ? 'block' : 'none';
        if (this.error) {
            errorElement.textContent = this.error;
        }
        
        if (!this.isLoading && !this.error && this.following.length === 0) {
            listElement.innerHTML = `<div class="no-following">@${this.username} is not following anyone</div>`;
        }
    }

    appendItems(entries) {
        const listElement = this.modalElement.querySelector('.following-list');
        const fragment = document.createDocumentFragment();

        entries.forEach(entry => {
            const username = entry.following;
            this.following.push(entry);

            const item = document.createElement('div');
            item.className = 'following-item';
            item.dataset.username = username;

            const avatar = document.createElement('img');
            avatar.className = 'following-avatar';
            avatar.src = `https://steemitimages.com/u/${username}/avatar`;
            avatar.alt = username;
            avatar.loading = 'lazy';

            const name = document.createElement('div');
            name.className = 'following-username';
            name.textContent = '@' + username;

            item.append(avatar, name);
            item.addEventListener('click', () => this.navigateToProfile(username));
            fragment.appendChild(item);
        });

        listElement.appendChild(fragment);
    }
    
    /**
     * Navigate to a user's profile page
     * @param {string} username - Username to navigate to
     */
    navigateToProfile(username) {
        if (!username) return;
        
        // Close the modal first
        this.close();
        
        // Use setTimeout to ensure modal closing animation completes
        setTimeout(() => {
            // Navigate to the profile page
            router.navigate(`/@${username}`);
        }, 300);
    }
}

// Create singleton instance
const followingModal = new FollowingModal();
export default followingModal;
