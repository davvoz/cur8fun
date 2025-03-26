import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import router from '../utils/Router.js';
import ProfileHeader from '../components/profile/ProfileHeader.js';
import PostsList from '../components/profile/PostsList.js';
import CommentsList from '../components/profile/CommentsList.js';
import ProfileTabs from '../components/profile/ProfileTabs.js';

class ProfileView extends View {
  constructor(params) {
    super();
    this.params = params || {};
    this.username = this.params.username;
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.container = null;
    this.profile = null;
    
    // Components
    this.profileHeader = null;
    this.tabsManager = null;
    this.postsComponent = null;
    this.commentsComponent = null;
    
    // State
    this.currentTab = 'posts';
  }

  async render(container) {
    this.container = container;
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    container.appendChild(profileContainer);

    // Show loading indicator
    this.loadingIndicator.show(profileContainer);

    try {
      // Load profile data
      await this.loadProfileData();

      // Render profile structure
      this.renderProfile(profileContainer);
      
      // Initialize components
      this.initComponents();
      
      // Render components
      this.renderComponents(profileContainer);
      
      // Load initial content based on current tab
      this.loadContentForCurrentTab();
      
      // Check if logged-in user is following this profile
      await this.checkFollowStatus();
    } catch (error) {
      console.error('Error rendering profile:', error);
      this.renderErrorState(profileContainer, error);
    } finally {
      this.loadingIndicator.hide();
    }
  }

  async loadProfileData() {
    if (!this.username) {
      throw new Error('No username provided');
    }

    this.profile = await profileService.getProfile(this.username);
    if (!this.profile) {
      throw new Error(`Profile not found for @${this.username}`);
    }

    // Fetch follower and following counts
    const followerCount = await profileService.getFollowerCount(this.username);
    const followingCount = await profileService.getFollowingCount(this.username);

    this.profile.followerCount = followerCount;
    this.profile.followingCount = followingCount;
  }
  
  renderProfile(container) {
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'profile-content-container';
    container.appendChild(contentContainer);
  }
  
  initComponents() {
    // Create profile header component
    this.profileHeader = new ProfileHeader(
      this.profile, 
      this.currentUser, 
      () => this.handleFollowAction()
    );
    
    // Create tabs manager
    this.tabsManager = new ProfileTabs((tabName) => this.switchTab(tabName));
    
    // Create posts component
    this.postsComponent = new PostsList(this.username);
    
    // Create comments component
    this.commentsComponent = new CommentsList(this.username);
  }
  
  renderComponents(container) {
    // Clear content container first
    const contentContainer = container.querySelector('.profile-content-container');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = '';
    
    // Render header
    this.profileHeader.render(contentContainer);
    
    // Render tabs
    this.tabsManager.render(contentContainer);
    
    // Create a container for the posts/comments
    const postsArea = document.createElement('div');
    postsArea.className = 'profile-posts-area';
    contentContainer.appendChild(postsArea);
    
    // Configure the container for grid layouts
    postsArea.style.width = '100%';
    postsArea.style.maxWidth = '100%';
    postsArea.style.overflow = 'hidden';
  }
  
  loadContentForCurrentTab() {
    const postsArea = this.container.querySelector('.profile-posts-area');
    if (!postsArea) return;
    
    // Clear the previous content to prevent gridController conflicts
    postsArea.innerHTML = '';
    
    // Ensure any previous component is properly unmounted
    if (this.currentTab === 'posts' && this.commentsComponent) {
      this.commentsComponent.unmount();
    } else if (this.currentTab === 'comments' && this.postsComponent) {
      this.postsComponent.unmount();
    }
    
    if (this.currentTab === 'posts') {
      this.postsComponent.render(postsArea);
    } else if (this.currentTab === 'comments') {
      this.commentsComponent.render(postsArea);
    }
  }
  
  switchTab(tabName) {
    if (this.currentTab === tabName) return;
    
    this.currentTab = tabName;
    this.loadContentForCurrentTab();
  }
  
  async checkFollowStatus() {
    if (!this.currentUser || !this.profileHeader) return;

    try {
      const isFollowing = await profileService.isFollowing(this.username, this.currentUser);
      this.profileHeader.updateFollowStatus(isFollowing);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }
  
  async handleFollowAction() {
    if (!this.currentUser) {
      // Redirect to login if not logged in
      router.navigate('/login', { returnUrl: `/@${this.username}` });
      return;
    }

    try {
      const isFollowing = await profileService.isFollowing(this.username, this.currentUser);
      
      if (isFollowing) {
        await profileService.unfollowUser(this.username, this.currentUser);
      } else {
        await profileService.followUser(this.username, this.currentUser);
      }

      // Update header with new follow status
      await this.checkFollowStatus();
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      if (window.eventEmitter) {
        window.eventEmitter.emit('notification', {
          type: 'error',
          message: `Failed to ${isFollowing ? 'unfollow' : 'follow'} @${this.username}`
        });
      }
    }
  }
  
  renderErrorState(container, error) {
    container.innerHTML = `
      <div class="profile-render-error">
        <h2>Error loading profile</h2>
        <p>${error.message || 'An unknown error occurred'}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;

    container.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.render(this.container);
    });
  }
  
  unmount() {
    // Clean up posts component
    if (this.postsComponent) {
      this.postsComponent.unmount();
    }
    
    // Clean up comments component
    if (this.commentsComponent) {
      this.commentsComponent.unmount();
    }
  }
}

export default ProfileView;
