import View from './View.js';
import steemService from '../services/SteemService.js';

class ProfileView extends View {
  constructor(element, params = {}) {
    // Handle case when only params are passed (no element)
    if (element && !params && typeof element === 'object' && !element.tagName) {
      params = element;
      element = null;
    }
    
    super(element, params);
    
    // Log params for debugging
    console.log('ProfileView constructor params:', params);
    
    // Get username from either direct params.username or from URL params
    // Also add a fallback for development/debugging
    if (params && typeof params === 'object') {
      this.username = params.username || 'steemitblog';
    } else {
      this.username = 'steemitblog'; // Default fallback username
      console.warn('No params object provided to ProfileView');
    }
    
    this.userInfo = null;
    this.userPosts = [];
    this.isLoading = false;
  }

  async render(containerElement) {
    // Use containerElement if provided and this.element is not a valid DOM element
    if (containerElement && (!this.element || typeof this.element.appendChild !== 'function')) {
      this.element = containerElement;
    }
    
    // Check if this.element is a string selector and convert it to DOM element
    if (typeof this.element === 'string') {
      this.element = document.querySelector(this.element);
    }
    
    // Ensure this.element is a valid DOM element
    if (!this.element || typeof this.element.appendChild !== 'function') {
      console.error('Invalid this.element in ProfileView:', this.element);
      return;
    }
    
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    const profileView = document.createElement('div');
    profileView.className = 'profile-view';
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading profile...';
    
    const profileContent = document.createElement('div');
    profileContent.className = 'profile-content';
    profileContent.style.display = 'none';
    
    const profileHeader = document.createElement('div');
    profileHeader.className = 'profile-header';
    
    const profileTabs = document.createElement('div');
    profileTabs.className = 'profile-tabs';
    
    const tabs = [
      { name: 'posts', label: 'Posts', active: true },
      { name: 'blog', label: 'Blog', active: false },
      { name: 'comments', label: 'Comments', active: false }
    ];
    
    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.className = `tab-btn ${tab.active ? 'active' : ''}`;
      button.dataset.tab = tab.name;
      button.textContent = tab.label;
      profileTabs.appendChild(button);
    });
    
    const profilePosts = document.createElement('div');
    profilePosts.className = 'profile-posts';
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';
    
    profileContent.appendChild(profileHeader);
    profileContent.appendChild(profileTabs);
    profileContent.appendChild(profilePosts);
    
    profileView.appendChild(loadingIndicator);
    profileView.appendChild(profileContent);
    profileView.appendChild(errorMessage);
    
    this.element.appendChild(profileView);
    
    this.loadingIndicator = loadingIndicator;
    this.profileContent = profileContent;
    this.errorMessage = errorMessage;
    
    await this.loadProfile();
    this.bindEvents();
  }

  async loadProfile() {
    try {
      if (!this.username) {
        throw new Error('Username is required');
      }
      
      console.log('Loading profile for username:', this.username);
      this.userInfo = await steemService.getUserInfo(this.username);
      if (!this.userInfo) {
        throw new Error(`User ${this.username} not found`);
      }
      this.renderProfileHeader();
      await this.loadUserPosts();
    } catch (error) {
      console.error('Profile loading error:', error);
      this.errorMessage.textContent = `Failed to load profile: ${error.message}`;
      this.errorMessage.style.display = 'block';
      this.loadingIndicator.style.display = 'none';
    } finally {
      this.loadingIndicator.style.display = 'none';
      this.profileContent.style.display = 'block';
    }
  }

  renderProfileHeader() {
    if (!this.profileContent || !this.userInfo) {
      console.error('Cannot render profile header: Missing required data');
      return;
    }
      
    const header = this.profileContent.querySelector('.profile-header');
    if (!header) {
      console.error('Profile header element not found');
      return;
    }
      
    // Clear existing content
    while (header.firstChild) {
      header.removeChild(header.firstChild);
    }
      
    const profileInfo = document.createElement('div');
    profileInfo.className = 'profile-info';
      
    const avatarElement = document.createElement('div');
    avatarElement.className = 'avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = `https://steemitimages.com/u/${this.username}/avatar`;
    avatarImg.alt = this.username;
    avatarElement.appendChild(avatarImg);
      
    const profileStats = document.createElement('div');
    profileStats.className = 'profile-stats';
      
    const usernameHeader = document.createElement('h1');
    usernameHeader.textContent = `@${this.username}`;
      
    const stats = document.createElement('div');
    stats.className = 'stats';
      
    const statsData = [
      { count: this.userInfo.post_count || 0, label: 'posts' },
      { count: this.userInfo.follower_count || 0, label: 'followers' },
      { count: this.userInfo.following_count || 0, label: 'following' }
    ];
      
    statsData.forEach(stat => {
      const span = document.createElement('span');
      span.textContent = `${stat.count} ${stat.label}`;
      stats.appendChild(span);
    });
      
    const profileActions = document.createElement('div');
    profileActions.className = 'profile-actions';
      
    profileStats.appendChild(usernameHeader);
    profileStats.appendChild(stats);
    profileStats.appendChild(profileActions);
      
    profileInfo.appendChild(avatarElement);
    profileInfo.appendChild(profileStats);
      
    header.appendChild(profileInfo);
      
    const currentUser = this.getCurrentUser();
    if (currentUser && this.username !== currentUser.username) {
      const followBtn = document.createElement('button');
      followBtn.className = 'btn btn-primary';
      followBtn.textContent = 'Follow';
      followBtn.addEventListener('click', () => this.handleFollow());
      profileActions.appendChild(followBtn);
    }
  }

  getCurrentUser() {
    // This should check for the logged-in user, not fetch the profile user again
    const loggedInUser = JSON.parse(localStorage.getItem('currentUser'));
    return loggedInUser;
  }

  handleFollow() {
    console.log(`Follow user ${this.username}`);
  }

  async loadUserPosts() {
    try {
      this.isLoading = true;
      const posts = await steemService.getUserPosts(this.username);
      this.userPosts = posts;
      this.renderPosts();
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      this.isLoading = false;
    }
  }

  renderPosts() {
    const postsContainer = this.profileContent.querySelector('.profile-posts');
    
    while (postsContainer.firstChild) {
      postsContainer.removeChild(postsContainer.firstChild);
    }
    
    if (this.userPosts.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'empty-posts-message';
      emptyMessage.textContent = 'No posts found';
      postsContainer.appendChild(emptyMessage);
      return;
    }
    
    this.userPosts.forEach(post => {
      const postElement = document.createElement('div');
      postElement.className = 'post-item';
      
      const title = document.createElement('h3');
      title.textContent = post.title;
      
      const body = document.createElement('p');
      body.textContent = post.body.substring(0, 100) + '...';
      
      postElement.appendChild(title);
      postElement.appendChild(body);
      postsContainer.appendChild(postElement);
    });
  }

  bindEvents() {
    const tabButtons = this.element.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const tab = button.dataset.tab;
        console.log(`Switching to tab: ${tab}`);
      });
    });
  }
}

export default ProfileView;
