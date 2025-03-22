import View from './View.js';
import communityService from '../services/CommunityService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';

class CommunitiesView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Communities | SteemGram';
    this.communities = [];
    this.loading = false;
    this.lastCommunity = '';
    this.searchQuery = params.query || '';
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    this.subscribedCommunities = new Set();
    this.viewMode = 'all'; // 'all', 'subscribed', 'search'
    this.sortBy = 'subscribers'; // 'subscribers', 'posts', 'name'
    this.sortDirection = 'desc'; // 'asc', 'desc'
    this.searchTimeout = null;
    this.searchResults = [];
    
    // If we have a search parameter, set mode to search
    if (params.query) {
      this.viewMode = 'search';
    }
  }
  
  async render(element) {
    this.element = element;
    
    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create main container with responsive grid
    const container = document.createElement('div');
    container.className = 'communities-page';
    this.element.appendChild(container);
    
    // Create header
    const header = this.createHeader();
    container.appendChild(header);
    
    // Create content area with sidebar and main content
    const contentArea = document.createElement('div');
    contentArea.className = 'communities-content';
    
    // Create sidebar for filters and options
    const sidebar = this.createSidebar();
    contentArea.appendChild(sidebar);
    
    // Create main content area
    const mainContent = document.createElement('div');
    mainContent.className = 'communities-main';
    
    // Create search and filter bar
    const searchBar = this.createSearchBar();
    mainContent.appendChild(searchBar);
    
    // Communities grid container
    const communitiesGrid = document.createElement('div');
    communitiesGrid.className = 'communities-grid';
    mainContent.appendChild(communitiesGrid);
    
    // Add loading state container
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    mainContent.appendChild(loadingContainer);
    
    contentArea.appendChild(mainContent);
    container.appendChild(contentArea);
    
    // Show loading state
    this.loadingIndicator.show(loadingContainer);
    
    // Load data based on view mode
    if (this.viewMode === 'search' && this.searchQuery) {
      await this.handleSearch(this.searchQuery, false);
    } else if (this.viewMode === 'subscribed') {
      await this.loadSubscribedCommunities();
    } else {
      await this.loadCommunities();
    }
    
    // Initialize infinite scroll for non-search modes
    if (this.viewMode !== 'search') {
      this.initInfiniteScroll(communitiesGrid);
    }
    
    // Update subscription statuses if user is logged in
    if (this.currentUser) {
      this.updateSubscribedCommunities();
    }
    
    // Hide loading indicator
    this.loadingIndicator.hide();
  }
  
  createHeader() {
    const header = document.createElement('div');
    header.className = 'communities-header';
    
    const heading = document.createElement('h1');
    heading.textContent = 'Communities';
    header.appendChild(heading);
    
    const description = document.createElement('p');
    description.className = 'communities-description';
    description.textContent = 'Discover and join communities on the Steem blockchain. Connect with users who share your interests.';
    header.appendChild(description);
    
    return header;
  }
  
  createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'communities-sidebar';
    
    // View mode selector
    const viewModeSection = document.createElement('div');
    viewModeSection.className = 'sidebar-section';
    
    const viewModeHeading = document.createElement('h3');
    viewModeHeading.textContent = 'View Mode';
    viewModeSection.appendChild(viewModeHeading);
    
    const viewModes = [
      { id: 'all', label: 'All Communities', icon: 'group_work' },
      { id: 'subscribed', label: 'My Subscriptions', icon: 'bookmark' },
      { id: 'search', label: 'Search Results', icon: 'search' }
    ];
    
    const viewModeButtons = document.createElement('div');
    viewModeButtons.className = 'view-mode-buttons';
    
    viewModes.forEach(mode => {
      const button = document.createElement('button');
      button.className = `view-mode-btn ${this.viewMode === mode.id ? 'active' : ''}`;
      button.dataset.mode = mode.id;
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = mode.icon;
      button.appendChild(icon);
      
      const label = document.createElement('span');
      label.textContent = mode.label;
      button.appendChild(label);
      
      button.addEventListener('click', () => {
        this.handleViewModeChange(mode.id);
      });
      
      viewModeButtons.appendChild(button);
    });
    
    viewModeSection.appendChild(viewModeButtons);
    sidebar.appendChild(viewModeSection);
    
    // Sort options
    const sortSection = document.createElement('div');
    sortSection.className = 'sidebar-section';
    
    const sortHeading = document.createElement('h3');
    sortHeading.textContent = 'Sort By';
    sortSection.appendChild(sortHeading);
    
    const sortOptions = [
      { id: 'subscribers', label: 'Most Subscribers' },
      { id: 'posts', label: 'Most Posts' },
      { id: 'name', label: 'Name (A-Z)' }
    ];
    
    const sortButtons = document.createElement('div');
    sortButtons.className = 'sort-buttons';
    
    sortOptions.forEach(option => {
      const button = document.createElement('button');
      button.className = `sort-btn ${this.sortBy === option.id ? 'active' : ''}`;
      button.dataset.sort = option.id;
      button.textContent = option.label;
      
      button.addEventListener('click', () => {
        this.handleSortChange(option.id);
      });
      
      sortButtons.appendChild(button);
    });
    
    sortSection.appendChild(sortButtons);
    sidebar.appendChild(sortSection);
    
    // Direction toggle
    const directionToggle = document.createElement('div');
    directionToggle.className = 'direction-toggle';
    
    const directionButton = document.createElement('button');
    directionButton.className = 'direction-btn';
    
    const directionIcon = document.createElement('span');
    directionIcon.className = 'material-icons';
    directionIcon.textContent = this.sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
    
    directionButton.appendChild(directionIcon);
    directionButton.appendChild(document.createTextNode(
      this.sortDirection === 'desc' ? 'Descending' : 'Ascending'
    ));
    
    directionButton.addEventListener('click', () => {
      this.toggleSortDirection();
    });
    
    directionToggle.appendChild(directionButton);
    sortSection.appendChild(directionToggle);
    
    // If user is logged in, show link to create community
    if (this.currentUser) {
      const createSection = document.createElement('div');
      createSection.className = 'sidebar-section';
      
      const createButton = document.createElement('a');
      createButton.href = 'https://steemit.com/communities'; // External link to Steemit communities page
      createButton.className = 'create-community-btn';
      createButton.target = '_blank';
      createButton.innerHTML = '<span class="material-icons">add</span> Create Community';
      
      createSection.appendChild(createButton);
      sidebar.appendChild(createSection);
    }
    
    return sidebar;
  }
  
  createSearchBar() {
    const searchBar = document.createElement('div');
    searchBar.className = 'communities-search-bar';
    
    // Left section - search input
    const searchInputContainer = document.createElement('div');
    searchInputContainer.className = 'search-input-container';
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'material-icons search-icon';
    searchIcon.textContent = 'search';
    searchInputContainer.appendChild(searchIcon);
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'community-search-input';
    searchInput.placeholder = 'Search communities...';
    searchInput.value = this.searchQuery;
    
    // Handle live search with debounce
    searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.handleSearch(searchInput.value);
      }, 500); // 500ms debounce
    });
    
    // Handle enter key
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchTimeout);
        this.handleSearch(searchInput.value);
      }
    });
    
    searchInputContainer.appendChild(searchInput);
    
    // Clear button
    if (this.searchQuery) {
      const clearButton = document.createElement('button');
      clearButton.className = 'clear-search-btn';
      clearButton.innerHTML = '<span class="material-icons">close</span>';
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        this.viewMode = 'all';
        this.refreshView();
      });
      searchInputContainer.appendChild(clearButton);
    }
    
    searchBar.appendChild(searchInputContainer);
    
    // Right section - result count or filter info
    const resultInfo = document.createElement('div');
    resultInfo.className = 'result-info';
    
    if (this.viewMode === 'search' && this.searchQuery) {
      resultInfo.textContent = `Results for "${this.searchQuery}"`;
    } else if (this.viewMode === 'subscribed') {
      resultInfo.textContent = 'Your subscribed communities';
    } else {
      resultInfo.textContent = 'All communities';
    }
    
    searchBar.appendChild(resultInfo);
    
    return searchBar;
  }
  
  async handleSearch(query, updateUrl = true) {
    query = query.trim();
    this.searchQuery = query;
    
    if (!query) {
      // If search is cleared, revert to all communities view
      this.viewMode = 'all';
      this.refreshView();
      return;
    }
    
    this.viewMode = 'search';
    
    // Update URL if needed
    if (updateUrl) {
      router.navigate(`/communities/search/${encodeURIComponent(query)}`, { replace: true });
    }
    
    // Update active view mode button
    this.updateActiveSidebarButton();
    
    // Update result info
    const resultInfo = this.element.querySelector('.result-info');
    if (resultInfo) {
      resultInfo.textContent = `Searching for "${query}"...`;
    }
    
    const communitiesGrid = this.element.querySelector('.communities-grid');
    if (!communitiesGrid) return;
    
    // Clear and show loading
    communitiesGrid.innerHTML = '';
    this.loadingIndicator.show(communitiesGrid);
    
    try {
      // Search for communities
      const communities = await communityService.searchCommunities(query);
      this.searchResults = communities;
      
      // Update result info
      if (resultInfo) {
        resultInfo.textContent = `${communities.length} results for "${query}"`;
      }
      
      // Sort the results (they come pre-sorted by relevance, but user might change)
      const sortedCommunities = this.sortCommunities(communities);
      
      // Render the communities
      this.renderCommunities(communitiesGrid, sortedCommunities);
      
    } catch (error) {
      console.error('Failed to search communities:', error);
      communitiesGrid.innerHTML = `
        <div class="error-state">
          <h3>Search failed</h3>
          <p>Unable to search for communities. Please try again later.</p>
          <button class="btn retry-btn">Retry</button>
        </div>
      `;
      
      const retryBtn = communitiesGrid.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.handleSearch(query);
        });
      }
    } finally {
      this.loadingIndicator.hide();
    }
  }
  
  async loadCommunities() {
    const communitiesGrid = this.element.querySelector('.communities-grid');
    if (!communitiesGrid) return;
    
    this.loading = true;
    
    if (this.communities.length === 0) {
      // Only show loading indicator for initial load
      this.loadingIndicator.show(communitiesGrid);
    }
    
    try {
      const communities = await communityService.getCommunities({
        limit: 20,
        last: this.lastCommunity
      });
      
      if (communities.length > 0) {
        this.communities = [...this.communities, ...communities];
        this.lastCommunity = communities[communities.length - 1].name;
        
        // Sort the communities
        const sortedCommunities = this.sortCommunities(communities);
        
        // Render the communities
        this.renderCommunities(communitiesGrid, sortedCommunities, this.communities.length > communities.length);
      } else if (this.communities.length === 0) {
        communitiesGrid.innerHTML = `
          <div class="empty-state">
            <h3>No communities found</h3>
            <p>There are no communities available at the moment.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to load communities:', error);
      
      if (this.communities.length === 0) {
        communitiesGrid.innerHTML = `
          <div class="error-state">
            <h3>Failed to load communities</h3>
            <p>Unable to load communities. Please try again later.</p>
            <button class="btn retry-btn">Retry</button>
          </div>
        `;
        
        const retryBtn = communitiesGrid.querySelector('.retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            this.refreshView();
          });
        }
      }
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }
  
  async loadSubscribedCommunities() {
    const communitiesGrid = this.element.querySelector('.communities-grid');
    if (!communitiesGrid) return;
    
    // Clear current communities
    communitiesGrid.innerHTML = '';
    this.communities = [];
    
    this.loading = true;
    this.loadingIndicator.show(communitiesGrid);
    
    try {
      if (!this.currentUser) {
        communitiesGrid.innerHTML = `
          <div class="login-prompt">
            <h3>Login Required</h3>
            <p>You need to be logged in to view your subscribed communities.</p>
            <a href="/login" class="btn login-btn">Login</a>
          </div>
        `;
        return;
      }
      
      const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username);
      
      if (subscriptions.length === 0) {
        communitiesGrid.innerHTML = `
          <div class="empty-state">
            <h3>No subscriptions yet</h3>
            <p>You haven't subscribed to any communities yet.</p>
            <button class="btn browse-btn">Browse Communities</button>
          </div>
        `;
        
        const browseBtn = communitiesGrid.querySelector('.browse-btn');
        if (browseBtn) {
          browseBtn.addEventListener('click', () => {
            this.handleViewModeChange('all');
          });
        }
        return;
      }
      
      // Fetch details for each subscribed community
      this.loadingIndicator.updateMessage('Loading your communities...');
      
      const communitiesDetails = [];
      for (const communityName of subscriptions) {
        try {
          const details = await communityService.getCommunityDetails(communityName);
          if (details) {
            communitiesDetails.push(details);
          }
        } catch (error) {
          console.error(`Failed to load details for community ${communityName}:`, error);
        }
      }
      
      this.communities = communitiesDetails;
      
      // Sort the communities
      const sortedCommunities = this.sortCommunities(communitiesDetails);
      
      // Render the communities
      this.renderCommunities(communitiesGrid, sortedCommunities, false);
      
    } catch (error) {
      console.error('Failed to load subscribed communities:', error);
      communitiesGrid.innerHTML = `
        <div class="error-state">
          <h3>Failed to load subscriptions</h3>
          <p>Unable to load your subscribed communities. Please try again later.</p>
          <button class="btn retry-btn">Retry</button>
        </div>
      `;
      
      const retryBtn = communitiesGrid.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.handleViewModeChange('subscribed');
        });
      }
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }
  
  renderCommunities(container, communities, append = false) {
    // If we're not appending, clear the container first
    if (!append) {
      container.innerHTML = '';
    }
    
    if (communities.length === 0 && !append) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No communities found</h3>
          <p>No communities match your criteria.</p>
        </div>
      `;
      return;
    }
    
    // Create card for each community
    communities.forEach(community => {
      const card = this.createCommunityCard(community);
      container.appendChild(card);
    });
  }
  
  createCommunityCard(community) {
    const card = document.createElement('div');
    card.className = 'community-card';
    card.setAttribute('data-community', community.name);
    
    // Community header with image and title
    const header = document.createElement('div');
    header.className = 'community-header';
    
    // Funzione per creare un avatar testuale
    function createTextAvatar() {
      const textAvatar = document.createElement('div');
      textAvatar.className = 'text-avatar';
      
      // Usa la prima lettera del nome della community
      const initial = (community.name || 'C').charAt(0).toUpperCase();
      textAvatar.textContent = initial;
      
      // Genera un colore di sfondo deterministico basato sul nome
      const hue = Math.abs(community.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
      textAvatar.style.backgroundColor = `hsl(${hue}, 65%, 65%)`;
      
      imageContainer.appendChild(textAvatar);
    }
    
    // Image container with avatar
    const imageContainer = document.createElement('div');
    imageContainer.className = 'community-image';
    
    if (community.avatar_url) {
      // Se c'è un URL avatar, prova a caricarlo
      const image = document.createElement('img');
      image.src = community.avatar_url;
      image.alt = community.title || community.name;
      
      // In caso di errore, crea un avatar testuale
      image.onerror = () => {
        image.style.display = 'none';
        createTextAvatar();
      };
      
      imageContainer.appendChild(image);
    } else {
      // Se non c'è URL avatar, crea subito un avatar testuale
      createTextAvatar();
    }
    
    header.appendChild(imageContainer);
    
    // Community title and name
    const titleContainer = document.createElement('div');
    titleContainer.className = 'community-title-container';
    
    const title = document.createElement('h3');
    title.className = 'community-title';
    title.textContent = community.title || community.name;
    titleContainer.appendChild(title);
    
    const name = document.createElement('div');
    name.className = 'community-name';
    name.textContent = `@${community.name}`;
    titleContainer.appendChild(name);
    
    header.appendChild(titleContainer);
    card.appendChild(header);
    
    // Community description
    if (community.about) {
      const description = document.createElement('p');
      description.className = 'community-description';
      description.textContent = this.truncateText(community.about, 120);
      card.appendChild(description);
    }
    
    // Community stats
    const stats = document.createElement('div');
    stats.className = 'community-stats';
    
    const subscribers = document.createElement('div');
    subscribers.className = 'stat-item';
    subscribers.innerHTML = `
      <span class="material-icons">people</span>
      <span class="stat-value">${community.subscribers || 0}</span>
      <span class="stat-label">Members</span>
    `;
    stats.appendChild(subscribers);
    
    const posts = document.createElement('div');
    posts.className = 'stat-item';
    posts.innerHTML = `
      <span class="material-icons">article</span>
      <span class="stat-value">${community.num_pending || 0}</span>
      <span class="stat-label">Posts</span>
    `;
    stats.appendChild(posts);
    
    card.appendChild(stats);
    
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'community-actions';
    
    // Visit button
    const visitBtn = document.createElement('a');
    visitBtn.href = `/community/${community.name}`;
    visitBtn.className = 'btn visit-btn';
    visitBtn.textContent = 'Visit';
    actions.appendChild(visitBtn);
    
    // Subscribe/unsubscribe button (only show if logged in)
    if (this.currentUser) {
      const subBtn = document.createElement('button');
      subBtn.className = 'btn';
      
      // Check if already subscribed
      const isSubscribed = this.subscribedCommunities.has(community.name);
      
      if (isSubscribed) {
        subBtn.classList.add('unsubscribe-btn');
        subBtn.textContent = 'Unsubscribe';
      } else {
        subBtn.classList.add('subscribe-btn');
        subBtn.textContent = 'Subscribe';
      }
      
      subBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleSubscriptionToggle(subBtn, community.name);
      });
      
      actions.appendChild(subBtn);
    }
    
    card.appendChild(actions);
    
    // Make the card clickable to navigate to community
    card.addEventListener('click', () => {
      router.navigate(`/community/${community.name}`);
    });
    
    return card;
  }
  
  async handleSubscriptionToggle(button, communityName) {
    if (!this.currentUser) {
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'You need to be logged in to subscribe to communities'
      });
      router.navigate('/login');
      return;
    }
    
    const username = this.currentUser.username;
    const isCurrentlySubscribed = button.classList.contains('unsubscribe-btn');
    
    // Disable button and show loading state
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = isCurrentlySubscribed ? 'Unsubscribing...' : 'Subscribing...';
    
    try {
      if (isCurrentlySubscribed) {
        await communityService.unsubscribeFromCommunity(username, communityName);
        button.classList.remove('unsubscribe-btn');
        button.classList.add('subscribe-btn');
        button.textContent = 'Subscribe';
        this.subscribedCommunities.delete(communityName);
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Unsubscribed from ${communityName}`
        });
      } else {
        await communityService.subscribeToCommunity(username, communityName);
        button.classList.remove('subscribe-btn');
        button.classList.add('unsubscribe-btn');
        button.textContent = 'Unsubscribe';
        this.subscribedCommunities.add(communityName);
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Subscribed to ${communityName}`
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      button.textContent = originalText;
      
      eventEmitter.emit('notification', {
        type: 'error',
        message: error.message || 'Failed to update subscription'
      });
    } finally {
      button.disabled = false;
    }
  }
  
  async updateSubscribedCommunities() {
    if (!this.currentUser) return;
    
    try {
      const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username);
      this.subscribedCommunities = new Set(subscriptions);
      
      // Update UI for existing community cards
      const cards = this.element.querySelectorAll('.community-card');
      cards.forEach(card => {
        const communityName = card.getAttribute('data-community');
        const subBtn = card.querySelector('.subscribe-btn, .unsubscribe-btn');
        
        if (subBtn) {
          if (this.subscribedCommunities.has(communityName)) {
            subBtn.classList.remove('subscribe-btn');
            subBtn.classList.add('unsubscribe-btn');
            subBtn.textContent = 'Unsubscribe';
          } else {
            subBtn.classList.remove('unsubscribe-btn');
            subBtn.classList.add('subscribe-btn');
            subBtn.textContent = 'Subscribe';
          }
        }
      });
    } catch (error) {
      console.error('Failed to update subscribed communities:', error);
    }
  }
  
  sortCommunities(communities) {
    // Create a copy to avoid modifying original array
    const sorted = [...communities];
    
    // Sort based on current sort options
    sorted.sort((a, b) => {
      let valueA, valueB;
      
      switch (this.sortBy) {
        case 'subscribers':
          valueA = a.subscribers || 0;
          valueB = b.subscribers || 0;
          break;
        case 'posts':
          valueA = a.num_pending || 0;
          valueB = b.num_pending || 0;
          break;
        case 'name':
          valueA = a.title?.toLowerCase() || a.name?.toLowerCase() || '';
          valueB = b.title?.toLowerCase() || b.name?.toLowerCase() || '';
          break;
        default:
          valueA = a.subscribers || 0;
          valueB = b.subscribers || 0;
      }
      
      // Apply sort direction
      if (this.sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
    
    return sorted;
  }
  
  handleViewModeChange(mode) {
    if (this.viewMode === mode) return;
    
    this.viewMode = mode;
    
    // Update active button
    this.updateActiveSidebarButton();
    
    // Reset search and pagination if switching away from search
    if (mode !== 'search') {
      this.searchQuery = '';
      
      // Update URL without search query
      if (mode === 'all') {
        router.navigate('/communities', { replace: true });
      } else if (mode === 'subscribed') {
        router.navigate('/communities/subscribed', { replace: true });
      }
    }
    
    // Refresh the view
    this.refreshView();
  }
  
  updateActiveSidebarButton() {
    // Update view mode buttons
    const viewButtons = this.element.querySelectorAll('.view-mode-btn');
    viewButtons.forEach(button => {
      if (button.dataset.mode === this.viewMode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  handleSortChange(sortBy) {
    if (this.sortBy === sortBy) return;
    
    this.sortBy = sortBy;
    
    // Update active button
    const sortButtons = this.element.querySelectorAll('.sort-btn');
    sortButtons.forEach(button => {
      if (button.dataset.sort === this.sortBy) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Re-sort and re-render the current communities
    this.resortAndRender();
  }
  
  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    
    // Update direction button
    const directionIcon = this.element.querySelector('.direction-btn .material-icons');
    if (directionIcon) {
      directionIcon.textContent = this.sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
    }
    
    const directionText = this.element.querySelector('.direction-btn');
    if (directionText) {
      // Update text content while preserving the icon
      const icon = directionText.querySelector('.material-icons').outerHTML;
      directionText.innerHTML = icon + (this.sortDirection === 'desc' ? 'Descending' : 'Ascending');
    }
    
    // Re-sort and re-render
    this.resortAndRender();
  }
  
  resortAndRender() {
    // Determine which data to sort
    let communityData;
    if (this.viewMode === 'search') {
      communityData = this.searchResults;
    } else {
      communityData = this.communities;
    }
    
    if (!communityData || communityData.length === 0) return;
    
    // Sort the data
    const sortedCommunities = this.sortCommunities(communityData);
    
    // Re-render
    const communitiesGrid = this.element.querySelector('.communities-grid');
    if (communitiesGrid) {
      communitiesGrid.innerHTML = '';
      this.renderCommunities(communitiesGrid, sortedCommunities);
    }
  }
  
  refreshView() {
    // Reset communities and pagination
    this.communities = [];
    this.lastCommunity = '';
    
    // Re-render the entire view
    this.render(this.element);
  }
  
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  initInfiniteScroll(container) {
    // Destroy previous infinite scroll if it exists
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }
    
    // Only use infinite scroll for the main list view (not search/subscribed)
    if (this.viewMode === 'all') {
      this.infiniteScroll = new InfiniteScroll({
        container,
        loadMore: () => {
          if (!this.loading) {
            this.loadCommunities();
          }
          return Promise.resolve(this.communities.length >= 20);
        },
        threshold: 300,
        rootMargin: '300px' // Aggiungi questa proprietà con unità
      });
    }
  }
  
  unmount() {
    super.unmount();
    
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}

export default CommunitiesView;