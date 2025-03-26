import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import router from '../utils/Router.js';
import ProfileHeader from '../components/profile/ProfileHeader.js';
import PostsList from '../components/profile/PostsList.js';
import CommentsList from '../components/profile/CommentsList.js';
import ProfileTabs from '../components/profile/ProfileTabs.js';

// Static cache for components
const componentCache = {
  posts: {},
  comments: {}
};

class ProfileView extends View {
  constructor(params) {
    super();
    this.params = params || {};
    this.username = this.params.username;
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.container = null;
    this.profile = null;
    
    // Get components from cache or create new ones
    this.initializeComponentsFromCache();
    
    // Get cached tab if available
    this.currentTab = ProfileTabs.activeTabCache[this.username] || 'posts';
    
    // Caching state
    this.postsLoaded = !!componentCache.posts[this.username];
    this.commentsLoaded = !!componentCache.comments[this.username];
    this.postsContainer = null;
    this.commentsContainer = null;
  }

  initializeComponentsFromCache() {
    // Create profile header component (no caching needed)
    this.profileHeader = null; // Will be initialized after profile data is loaded
    
    // Create tabs manager - always create fresh to ensure proper initialization
    this.tabsManager = new ProfileTabs((tabName) => this.switchTab(tabName));
    
    // Get or create posts component
    if (!componentCache.posts[this.username]) {
      componentCache.posts[this.username] = new PostsList(this.username, true);
    } else {
      // Reset the component if it exists to ensure it's ready for reuse
      componentCache.posts[this.username].reset();
    }
    this.postsComponent = componentCache.posts[this.username];
    
    // Get or create comments component
    if (!componentCache.comments[this.username]) {
      componentCache.comments[this.username] = new CommentsList(this.username, true);
    } else {
      // Reset the component if it exists to ensure it's ready for reuse
      componentCache.comments[this.username].reset();
    }
    this.commentsComponent = componentCache.comments[this.username];
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
    // Create profile header component with the now-loaded profile data
    this.profileHeader = new ProfileHeader(
      this.profile, 
      this.currentUser, 
      () => this.handleFollowAction()
    );
    
    // Don't reinitialize other components - we're using cached ones
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
    
    // Create grid controller containers
    const postsGridContainer = document.createElement('div');
    postsGridContainer.className = 'posts-grid-controller-container';
    
    const commentsGridContainer = document.createElement('div');
    commentsGridContainer.className = 'comments-grid-controller-container';
    commentsGridContainer.style.display = 'none';
    
    contentContainer.appendChild(postsGridContainer);
    contentContainer.appendChild(commentsGridContainer);
    
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
    
    this.initializeContainersIfNeeded(postsArea);
    
    // Update container references for components
    this.postsComponent.setContainer(this.postsContainer);
    this.commentsComponent.setContainer(this.commentsContainer);
    
    const gridContainers = this.getGridContainers();
    const isPostsTab = this.currentTab === 'posts';
    const activeComponent = isPostsTab ? this.postsComponent : this.commentsComponent;
    const activeContainer = isPostsTab ? this.postsContainer : this.commentsContainer;
    const inactiveContainer = isPostsTab ? this.commentsContainer : this.postsContainer;
    const activeGridContainer = isPostsTab ? gridContainers.posts : gridContainers.comments;
    const inactiveGridContainer = isPostsTab ? gridContainers.comments : gridContainers.posts;
    
    // Update visibility
    this.updateContainerVisibility(activeContainer, inactiveContainer, activeGridContainer, inactiveGridContainer);
    
    // Render grid controller if needed
    this.renderGridControllerIfNeeded(activeGridContainer, activeComponent);
    
    // Handle component loading and rendering
    this.loadComponentContent(activeComponent, activeContainer, isPostsTab);
  }
  
  initializeContainersIfNeeded(postsArea) {
    if (this.postsContainer && this.commentsContainer) return;
    
    // Create containers
    this.postsContainer = document.createElement('div');
    this.postsContainer.className = 'posts-list-container';
    this.postsContainer.style.width = '100%';
    
    this.commentsContainer = document.createElement('div');
    this.commentsContainer.className = 'comments-list-container';
    this.commentsContainer.style.width = '100%';
    
    // Add both containers to DOM
    postsArea.appendChild(this.postsContainer);
    postsArea.appendChild(this.commentsContainer);
    
    // Initialize posts first (it's the default tab)
    this.postsComponent.render(this.postsContainer);
    this.postsLoaded = true;
    
    // Initially hide comments container
    this.commentsContainer.style.display = 'none';
  }
  
  getGridContainers() {
    return {
      posts: this.container.querySelector('.posts-grid-controller-container'),
      comments: this.container.querySelector('.comments-grid-controller-container')
    };
  }
  
  updateContainerVisibility(activeContainer, inactiveContainer, activeGridContainer, inactiveGridContainer) {
    activeContainer.style.display = 'block';
    inactiveContainer.style.display = 'none';
    
    if (activeGridContainer) activeGridContainer.style.display = 'block';
    if (inactiveGridContainer) inactiveGridContainer.style.display = 'none';
  }
  
  renderGridControllerIfNeeded(gridContainer, component) {
    if (gridContainer && !gridContainer.hasChildNodes()) {
      component.gridController.render(gridContainer);
    }
  }
  
  loadComponentContent(component, container, isPostsTab) {
    const isLoaded = isPostsTab ? this.postsLoaded : this.commentsLoaded;
    
    if (!isLoaded) {
      component.render(container);
      if (isPostsTab) {
        this.postsLoaded = true;
      } else {
        this.commentsLoaded = true;
      }
    } else {
      // Force refresh grid layout with a small delay to ensure DOM is ready
      const LAYOUT_REFRESH_DELAY = 50;
      setTimeout(() => {
        component.refreshGridLayout();
      }, LAYOUT_REFRESH_DELAY);
    }
  }
  
  switchTab(tabName) {
    if (this.currentTab === tabName) return;
    
    console.log(`Switching tab from ${this.currentTab} to ${tabName}`);
    this.currentTab = tabName;
    
    // Use a short timeout to ensure DOM updates before applying grid layouts
    setTimeout(() => {
      this.loadContentForCurrentTab();
    }, 10);
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
      this.postsLoaded = false;
      this.postsContainer = null;
    }
    
    // Clean up comments component
    if (this.commentsComponent) {
      this.commentsComponent.unmount();
      this.commentsLoaded = false;
      this.commentsContainer = null;
    }
  }
}

export default ProfileView;
