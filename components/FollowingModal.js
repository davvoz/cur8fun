import profileService from '../services/ProfileService.js';
import router from '../utils/Router.js';

class FollowingModal {
    constructor() {
        this.modalElement = null;
        this.username = null;
        this.following = [];
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
        
        // Reset state
        this.following = [];
        this.isLoading = true;
        this.error = null;
        this.updateUI();
        
        // Fetch following accounts
        try {
            this.following = await profileService.getFollowingList(username);
            this.isLoading = false;
            this.updateUI();
        } catch (error) {
            console.error('Error fetching following accounts:', error);
            this.isLoading = false;
            this.error = 'Failed to load following accounts. Please try again later.';
            this.updateUI();
        }
    }
    
    close() {
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
        
        // Show/hide loading state
        loadingElement.style.display = this.isLoading ? 'block' : 'none';
        
        // Show/hide error
        errorElement.style.display = this.error ? 'block' : 'none';
        if (this.error) {
            errorElement.textContent = this.error;
        }
        
        // Update following list
        if (!this.isLoading && !this.error && this.following.length > 0) {
            listElement.innerHTML = this.following.map(following => `
                <div class="following-item" data-username="${following.following}">
                    <img class="following-avatar" src="https://steemitimages.com/u/${following.following}/avatar" alt="${following.following}">
                    <div class="following-username">@${following.following}</div>
                </div>
            `).join('');
            
            // Add click handlers to all following items
            const followingItems = listElement.querySelectorAll('.following-item');
            followingItems.forEach(item => {
                item.addEventListener('click', () => {
                    const username = item.getAttribute('data-username');
                    const sanitizedUsername = encodeURIComponent(username);
                    this.navigateToProfile(sanitizedUsername);
                });
            });
        } else if (!this.isLoading && !this.error) {
            // No following found
            listElement.innerHTML = `<div class="no-following">@${this.username} is not following anyone</div>`;
        }
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
