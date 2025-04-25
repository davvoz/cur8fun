import profileService from '../services/ProfileService.js';
import router from '../utils/Router.js'; // Import router for navigation

class FollowersModal {
    constructor() {
        this.modalElement = null;
        this.username = null;
        this.followers = [];
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
        this.modalElement.className = 'followers-modal';
        
        this.modalElement.innerHTML = `
            <div class="followers-modal-content">
                <div class="followers-modal-header">
                    <h2>Followers of <span class="username"></span></h2>
                    <span class="followers-modal-close">&times;</span>
                </div>
                <div class="followers-modal-body">
                    <div class="followers-loading">Loading followers...</div>
                    <div class="followers-error"></div>
                    <div class="followers-list"></div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Close button click
        const closeButton = this.modalElement.querySelector('.followers-modal-close');
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
     * Open the modal and load followers for the given username
     * @param {string} username - The username to load followers for
     */
    async open(username) {
        if (!username) {
            console.error('Username is required to open followers modal');
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
        this.followers = [];
        this.isLoading = true;
        this.error = null;
        this.updateUI();
        
        // Fetch followers
        try {
            this.followers = await profileService.getFollowersList(username);
            this.isLoading = false;
            this.updateUI();
        } catch (error) {
            console.error('Error fetching followers:', error);
            this.isLoading = false;
            this.error = 'Failed to load followers. Please try again later.';
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
        const loadingElement = this.modalElement.querySelector('.followers-loading');
        const errorElement = this.modalElement.querySelector('.followers-error');
        const listElement = this.modalElement.querySelector('.followers-list');
        
        // Show/hide loading state
        loadingElement.style.display = this.isLoading ? 'block' : 'none';
        
        // Show/hide error
        errorElement.style.display = this.error ? 'block' : 'none';
        if (this.error) {
            errorElement.textContent = this.error;
        }
        
        // Update follower list
        if (!this.isLoading && !this.error && this.followers.length > 0) {
            listElement.innerHTML = this.followers.map(follower => `
                <div class="follower-item" data-username="${follower.follower}">
                    <img class="follower-avatar" src="https://steemitimages.com/u/${follower.follower}/avatar" alt="${follower.follower}">
                    <div class="follower-username">@${follower.follower}</div>
                </div>
            `).join('');
            
            // Add click handlers to all follower items
            const followerItems = listElement.querySelectorAll('.follower-item');
            followerItems.forEach(item => {
                item.addEventListener('click', () => {
                    const username = item.getAttribute('data-username');
                    this.navigateToProfile(username);
                });
            });
        } else if (!this.isLoading && !this.error) {
            // No followers found
            listElement.innerHTML = `<div class="no-followers">No followers found for @${this.username}</div>`;
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
            // Sanitize the username before navigating
            const sanitizedUsername = encodeURIComponent(username);
            // Navigate to the profile page
            router.navigate(`/@${sanitizedUsername}`);
        }, 300);
    }
}

// Create singleton instance
const followersModal = new FollowersModal();
export default followersModal;
