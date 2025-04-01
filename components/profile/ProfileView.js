import ProfileTabs from './ProfileTabs.js';
import CommentsList from './CommentsList.js';
import ProfileWalletHistory from './ProfileWalletHistory.js';

export default class ProfileView {
  constructor(username) {
    this.username = username;
    this.container = null;
    this.profileTabs = new ProfileTabs((tabName) => this.handleTabChange(tabName));
    
    // Component instances
    this.comments = null;
    this.wallet = null;
    
    // Track mounted components
    this.mountedComponents = {
      posts: false,
      comments: false,
      wallet: false
    };
  }
  
  render(container) {
    this.container = container;
    
    // Create main container for profile posts area
    const profilePostsArea = document.createElement('div');
    profilePostsArea.className = 'profile-posts-area';
    profilePostsArea.style.width = '100%';
    profilePostsArea.style.maxWidth = '100%';
    profilePostsArea.style.overflow = 'hidden';
    
    // Render tabs system
    this.profileTabs.render(profilePostsArea);
    
    // Append to main container
    container.appendChild(profilePostsArea);
    
    // Initialize the active tab
    this.initializeActiveTab();
    
    return profilePostsArea;
  }
  
  initializeActiveTab() {
    const activeTab = this.profileTabs.getCurrentTab();
    this.renderTabContent(activeTab);
  }
  
  handleTabChange(tabName) {
    console.log(`ProfileView: Tab changed to ${tabName}`);
    this.renderTabContent(tabName);
  }
  
  renderTabContent(tabName) {
    // Get the appropriate container for this tab
    const tabContainer = this.profileTabs.getContentContainer(tabName);
    if (!tabContainer) return;
    
    // Handle content based on tab type
    switch(tabName) {
      case 'posts':
        this.renderPostsTab(tabContainer);
        break;
      case 'comments':
        this.renderCommentsTab(tabContainer);
        break;
      case 'wallet':
        this.renderWalletTab(tabContainer);
        break;
    }
    
    // Update visibility states for all components
    this.updateComponentVisibility();
  }
  
  renderPostsTab(container) {
    if (this.mountedComponents.posts) return;
    
    // Here you would initialize the posts rendering
    // For example: this.posts = new PostsList(this.username);
    // this.posts.render(container);
    
    this.mountedComponents.posts = true;
  }
  
  renderCommentsTab(container) {
    // Only initialize if not already mounted
    if (!this.comments) {
      this.comments = new CommentsList(this.username);
      container.innerHTML = ''; // Clear container
      this.comments.render(container);
      this.mountedComponents.comments = true;
    }
  }
  
  renderWalletTab(container) {
    // Only initialize if not already mounted
    if (!this.wallet) {
      this.wallet = new ProfileWalletHistory(this.username);
      container.innerHTML = ''; // Clear container
      this.wallet.render(container);
      this.mountedComponents.wallet = true;
    }
  }
  
  updateComponentVisibility() {
    const currentTab = this.profileTabs.getCurrentTab();
    
    // Set visibility based on current tab
    if (this.comments) {
      this.comments.setVisibility(currentTab === 'comments');
    }
    
    if (this.wallet) {
      this.wallet.setVisibility(currentTab === 'wallet');
    }
    
    // Posts component would be handled similarly
  }
  
  // Update username for all components
  updateUsername(newUsername) {
    this.username = newUsername;
    
    // Update components that support username changes
    if (this.comments) {
      this.comments.username = newUsername;
      // Reload if visible
      if (this.profileTabs.isTabActive('comments')) {
        this.comments.reset();
        this.comments.render(this.profileTabs.getContentContainer('comments'));
      }
    }
    
    if (this.wallet) {
      this.wallet.updateUsername(newUsername);
    }
  }
  
  // Clean up when component is removed
  unmount() {
    if (this.comments) {
      this.comments.unmount();
      this.comments = null;
    }
    
    if (this.wallet) {
      this.wallet.unmount();
      this.wallet = null;
    }
    
    this.mountedComponents = {
      posts: false,
      comments: false,
      wallet: false
    };
  }
}
