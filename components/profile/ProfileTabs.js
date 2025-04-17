export default class ProfileTabs {
  // Static cache to remember last tab across navigation
  static activeTabCache = {};
  
  constructor(onTabChange) {
    // Extract username from URL
    const username = this.extractUsername();
    
    // Use URL parameters to check if we're navigating directly
    // This helps determine if we should use cache or reset to 'posts'
    const isDirectNavigation = this.isDirectNavigation();
    
    // Reset to 'posts' when coming from home or other non-profile page
    this.currentTab = (username && ProfileTabs.activeTabCache[username] && !isDirectNavigation) 
                     ? ProfileTabs.activeTabCache[username] 
                     : 'posts';
                     
    this.onTabChange = onTabChange;
    this.container = null;
    this.username = username;
    this.contentContainers = {
      posts: null,
      comments: null,
      wallet: null
    };
  }
  
  // Helper to extract username from URL
  extractUsername() {
    const match = window.location.pathname.match(/\/@([^/]+)/);
    return match ? match[1] : null;
  }
  
  // Helper to determine if we're navigating directly to profile
  isDirectNavigation() {
    // Check if we came from another page (like the home)
    // This is a heuristic - if we have a referrer that's not a profile page
    const referrer = document.referrer;
    
    // If no referrer or different origin, consider it direct navigation
    if (!referrer || new URL(referrer).origin !== window.location.origin) {
      return true;
    }
    
    // Check if the previous page was not a profile page
    const referrerPath = new URL(referrer).pathname;
    const isFromProfilePage = referrerPath.includes('/@');
    
    // Return true if we're NOT coming from another profile page
    return !isFromProfilePage;
  }
  
  render(container) {
    this.container = container;
    const tabsContainer = this.createProfileTabs();
    container.appendChild(tabsContainer);
    
    // Create content containers for each tab
    this.createContentContainers(container);
    
    // Initialize visibility based on current tab
    this.updateContentVisibility();
    
    return tabsContainer;
  }
  
  createProfileTabs() {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'profile-tabs';

    // Posts tab
    const postsTab = document.createElement('button');
    postsTab.className = `tab-btn ${this.currentTab === 'posts' ? 'active' : ''}`;
    postsTab.textContent = 'Posts';
    postsTab.addEventListener('click', () => this.switchTab('posts'));

    // Comments tab
    const commentsTab = document.createElement('button');
    commentsTab.className = `tab-btn ${this.currentTab === 'comments' ? 'active' : ''}`;
    commentsTab.textContent = 'Comments';
    commentsTab.addEventListener('click', () => this.switchTab('comments'));

    // Wallet tab (nuovo)
    const walletTab = document.createElement('button');
    walletTab.className = `tab-btn ${this.currentTab === 'wallet' ? 'active' : ''}`;
    walletTab.textContent = 'Wallet';
    walletTab.addEventListener('click', () => this.switchTab('wallet'));

    tabsContainer.append(postsTab, commentsTab, walletTab);
    return tabsContainer;
  }
  
  createContentContainers(parentContainer) {
    // Find or create content containers for each tab
    Object.keys(this.contentContainers).forEach(tabName => {
      // Check if container already exists
      let contentContainer = parentContainer.querySelector(`.profile-tab-content.${tabName}-tab-content`);
      
      // Create if it doesn't exist
      if (!contentContainer) {
        contentContainer = document.createElement('div');
        contentContainer.className = `profile-tab-content ${tabName}-tab-content`;
        parentContainer.appendChild(contentContainer);
      }
      
      this.contentContainers[tabName] = contentContainer;
    });
  }
  
  updateContentVisibility() {
    // Hide all content containers first
    Object.entries(this.contentContainers).forEach(([tabName, container]) => {
      if (container) {
        if (tabName === this.currentTab) {
          container.style.display = 'block';
        } else {
          container.style.display = 'none';
        }
      }
    });
  }
  
  switchTab(tabName) {
    if (this.currentTab === tabName) return;

    console.log(`Switching tab from ${this.currentTab} to ${tabName}`);

    // Update tab styling first
    const tabs = this.container.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.textContent.toLowerCase() === tabName) {
        tab.classList.add('active');
      }
    });

    // Update current tab
    this.currentTab = tabName;
    
    // Update content visibility
    this.updateContentVisibility();
    
    // Cache the tab selection for this username
    if (this.username) {
      ProfileTabs.activeTabCache[this.username] = tabName;
    }
    
    // Notify parent component
    if (this.onTabChange) {
      this.onTabChange(tabName);
    }
  }
  
  getCurrentTab() {
    return this.currentTab;
  }
  
  // New method to get content container for a specific tab
  getContentContainer(tabName) {
    return this.contentContainers[tabName] || null;
  }
  
  // New method to set active tab programmatically
  setActiveTab(tabName) {
    if (Object.keys(this.contentContainers).includes(tabName)) {
      this.switchTab(tabName);
    }
  }
  
  // Check if a specific tab is active
  isTabActive(tabName) {
    return this.currentTab === tabName;
  }
}
