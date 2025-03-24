export default class ProfileTabs {
  constructor(onTabChange) {
    this.currentTab = 'posts';
    this.onTabChange = onTabChange;
    this.container = null;
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
    postsTab.className = 'tab-btn active';
    postsTab.textContent = 'Posts';
    postsTab.addEventListener('click', () => this.switchTab('posts'));

    // Comments tab
    const commentsTab = document.createElement('button');
    commentsTab.className = 'tab-btn';
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
    
    // Notify parent component
    if (this.onTabChange) {
      this.onTabChange(tabName);
    }
  }
  
  getCurrentTab() {
    return this.currentTab;
  }
}
