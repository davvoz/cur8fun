export default class ProfileTabs {
  // Static cache to remember last tab across navigation
  static activeTabCache = {};
  
  constructor(onTabChange) {
    // Check cache for this user if available in constructor params
    const username = this.extractUsername();
    this.currentTab = username && ProfileTabs.activeTabCache[username] 
                     ? ProfileTabs.activeTabCache[username] 
                     : 'posts';
    this.onTabChange = onTabChange;
    this.container = null;
    this.username = username;
  }
  
  // Helper to extract username from URL
  extractUsername() {
    const match = window.location.pathname.match(/\/@([^/]+)/);
    return match ? match[1] : null;
  }
  
  render(container) {
    this.container = container;
    const tabsContainer = this.createProfileTabs();
    container.appendChild(tabsContainer);
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

    tabsContainer.append(postsTab, commentsTab);
    return tabsContainer;
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
}
