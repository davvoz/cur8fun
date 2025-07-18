// Services
import authService from '../services/AuthService.js';
import communityService from '../services/CommunityService.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class CommunitiesListView {
  constructor() {
    this.container = null;
    this.viewContainer = null; // Add a reference to the view-specific container
    this.communities = [];
    this.filteredCommunities = [];
    this.isLoading = true;
    this.searchQuery = '';
    this.currentUser = authService.getCurrentUser();
    this.subscribedCommunities = new Set();
    this.pendingSubscriptions = new Set();
    this.activeCategory = 'all';
    this.infiniteScroll = null;
    this.itemsPerPage = 12; // Number of communities to load per page
    this.currentPage = 1;
    
    // Define common categories
    this.categories = [
      { id: 'all', name: 'All Communities' },
      { id: 'art', name: 'Art & Design' },
      { id: 'technology', name: 'Technology' },
      { id: 'crypto', name: 'Crypto' },
      { id: 'gaming', name: 'Gaming' },
      { id: 'lifestyle', name: 'Lifestyle' },
      { id: 'writing', name: 'Writing' }
    ];
  }

  async render(container) {
    this.container = container;
    this.container.innerHTML = '';
    
    // Create a view-specific container instead of modifying the main container's class
    this.viewContainer = document.createElement('div');
    this.viewContainer.className = 'communities-list-view';
    this.container.appendChild(this.viewContainer);
    
    // Create header
    this.renderHeader();
    
    // Create categories filter
    this.renderCategories();
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'communities-content';
    this.viewContainer.appendChild(contentContainer);
    
    // Display loading state
    this.showLoading(contentContainer);
    
    try {
      // Load communities
      await this.loadCommunities();
      
      // If user is logged in, load their subscribed communities
      if (this.currentUser) {
        await this.loadUserSubscriptions();
      }
      
      // Render communities list
      this.renderCommunities(contentContainer);
      
      // Initialize infinite scroll
      this.initializeInfiniteScroll(contentContainer);
    } catch (error) {
      console.error('Error loading communities:', error);
      this.showError(contentContainer, 'Failed to load communities. Please try again later.');
    } finally {
      this.isLoading = false;
    }
    
    // Listen for auth changes
    eventEmitter.on('auth:changed', this.handleAuthChanged.bind(this));
  }

  renderHeader() {
    const header = document.createElement('div');
    header.className = 'communities-header';
    header.innerHTML = `
      <h1>Discover Communities</h1>
      <p>Join communities based on your interests and connect with others who share your passions</p>
      <div class="communities-search">
        <span class="material-icons search-icon">search</span>
        <input type="text" id="community-search" placeholder="Search communities..." autocomplete="off">
      </div>
    `;
    this.viewContainer.appendChild(header);
    
    // Add event listener for search input
    const searchInput = header.querySelector('#community-search');
    searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
  }

  renderCategories() {
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'community-categories';
    
    this.categories.forEach(category => {
      const btn = document.createElement('button');
      btn.className = `category-btn ${category.id === this.activeCategory ? 'active' : ''}`;
      btn.dataset.category = category.id;
      btn.textContent = category.name;
      
      btn.addEventListener('click', () => {
        // Update active category
        this.activeCategory = category.id;
        
        // Update UI
        categoriesContainer.querySelectorAll('.category-btn').forEach(el => {
          el.classList.toggle('active', el.dataset.category === this.activeCategory);
        });
        
        // Filter communities
        this.filterCommunities();
      });
      
      categoriesContainer.appendChild(btn);
    });
    
    this.viewContainer.appendChild(categoriesContainer);
  }

  async loadCommunities() {
    try {
      // Load communities with a single API call
      this.communities = await communityService.listCommunities();
      
      // Store all communities in the filteredCommunities array initially
      this.filteredCommunities = [...this.communities];
      
      // Sort by subscriber count once immediately after loading
      //this.sortCommunities();
      
      // Extract relevant category tags during initial load for better performance
      this.communities.forEach(community => {
        // Pre-compute and cache tags to avoid recalculating during filtering
        if (!community._cachedTags) {
          community._cachedTags = this.getCommunityTags(community);
        }
      });
      
      return this.communities;
    } catch (error) {
      console.error('Error loading communities:', error);
      throw error;
    }
  }
  
  async loadUserSubscriptions() {
    if (!this.currentUser) return;
    
    try {
      const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username, false);
      
      // Create a set of community names (with and without hive- prefix)
      this.subscribedCommunities = new Set();
      subscriptions.forEach(sub => {
        // Handle both string and object formats
        if (typeof sub === 'string') {
          const name = sub.replace(/^hive-/, '');
          this.subscribedCommunities.add(name);
          this.subscribedCommunities.add(`hive-${name}`);
        } else {
          const name = (sub.name || '').replace(/^hive-/, '');
          this.subscribedCommunities.add(name);
          this.subscribedCommunities.add(`hive-${name}`);
        }
      });
    } catch (error) {
      console.error('Error loading user subscriptions:', error);
    }
  }

  sortCommunities() {
    // Sort communities by subscriber count (most popular first)
    this.filteredCommunities.sort((a, b) => {
      return (b.subscribers || 0) - (a.subscribers || 0);
    });
  }

  handleSearch(query) {
    this.searchQuery = query.trim().toLowerCase();
    this.filterCommunities();
  }
  
  filterCommunities() {
    // Start with all communities
    let filtered = [...this.communities];
    
    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter(community => {
        // Use the precomputed search index if available
        if (community._searchIndex) {
          return community._searchIndex.includes(this.searchQuery);
        }
        
        // Fallback to traditional filtering if _searchIndex doesn't exist
        const title = (community.title || '').toLowerCase();
        const name = (community.name || '').toLowerCase();
        const about = (community.about || '').toLowerCase();
        
        return title.includes(this.searchQuery) || 
               name.includes(this.searchQuery) || 
               about.includes(this.searchQuery);
      });
    }
    
    // Filter by category
    if (this.activeCategory !== 'all') {
      filtered = filtered.filter(community => {
        // Use precomputed tags if available
        if (community._cachedTags) {
          return community._cachedTags.includes(this.activeCategory);
        }
        
        // Get tags on demand if not precomputed
        const tags = this.getCommunityTags(community);
        return tags.includes(this.activeCategory);
      });
    }
    
    this.filteredCommunities = filtered;
    
    // Sort and re-render communities
    this.sortCommunities();
    
    // Optimize rendering by only updating the content container
    const contentEl = this.viewContainer.querySelector('.communities-content');
    if (contentEl) {
      this.renderCommunities(contentEl);
    }
  }
  
  getCommunityTags(community) {
    // Extract tags from community data or use name-based heuristics
    try {
      // Try to get tags from metadata if present
      if (community.json_metadata) {
        const metadata = typeof community.json_metadata === 'string' 
          ? JSON.parse(community.json_metadata) 
          : community.json_metadata;
          
        if (metadata && metadata.tags && Array.isArray(metadata.tags)) {
          return metadata.tags;
        }
      }
      
      // Simple heuristics based on name and title
      const name = (community.name || '').toLowerCase();
      const title = (community.title || '').toLowerCase();
      
      const tags = [];
      
      // Check for category keywords
      if (name.includes('art') || title.includes('art') || 
          name.includes('design') || title.includes('design') ||
          name.includes('photo') || title.includes('photo')) {
        tags.push('art');
      }
      
      if (name.includes('tech') || title.includes('tech') ||
          name.includes('code') || title.includes('code') ||
          name.includes('dev') || title.includes('dev')) {
        tags.push('technology');
      }
      
      if (name.includes('crypto') || title.includes('crypto') ||
          name.includes('blockchain') || title.includes('blockchain') ||
          name.includes('bitcoin') || title.includes('bitcoin')) {
        tags.push('crypto');
      }
      
      if (name.includes('game') || title.includes('game') ||
          name.includes('gaming') || title.includes('gaming')) {
        tags.push('gaming');
      }
      
      if (name.includes('life') || title.includes('life') ||
          name.includes('food') || title.includes('food') ||
          name.includes('travel') || title.includes('travel')) {
        tags.push('lifestyle');
      }
      
      if (name.includes('write') || title.includes('write') ||
          name.includes('blog') || title.includes('blog') ||
          name.includes('author') || title.includes('author')) {
        tags.push('writing');
      }
      
      return tags;
    } catch (error) {
      return [];
    }
  }

  renderCommunities(container) {
    container.innerHTML = '';
    
    if (this.filteredCommunities.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">search_off</span>
          <p>No communities found ${this.searchQuery ? `matching "${this.searchQuery}"` : 'in this category'}</p>
          <button class="primary-btn reset-filters">
            <span class="material-icons">refresh</span> Reset Filters
          </button>
        </div>
      `;
      
      // Add animation to the empty state
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) {
        emptyState.style.opacity = '0';
        emptyState.style.transform = 'translateY(20px)';
        
        // Trigger animation after a small delay
        setTimeout(() => {
          emptyState.style.transition = 'all 0.5s ease';
          emptyState.style.opacity = '1';
          emptyState.style.transform = 'translateY(0)';
        }, 100);
      }
      
      // Add event listener for reset button
      const resetBtn = container.querySelector('.reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          // Reset search and category
          this.searchQuery = '';
          this.activeCategory = 'all';
          
          // Update UI
          const searchInput = this.viewContainer.querySelector('#community-search');
          if (searchInput) searchInput.value = '';
          
          const categoryBtns = this.viewContainer.querySelectorAll('.category-btn');
          categoryBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === 'all');
          });
          
          // Refilter
          this.filterCommunities();
        });
        
        // Add ripple effect to button
        resetBtn.addEventListener('mousedown', function(e) {
          const x = e.clientX - e.target.getBoundingClientRect().left;
          const y = e.clientY - e.target.getBoundingClientRect().top;
          
          const ripple = document.createElement('span');
          ripple.className = 'ripple-effect';
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          
          this.appendChild(ripple);
          
          setTimeout(() => ripple.remove(), 600);
        });
      }
      
      return;
    }
    
    const communitiesGrid = document.createElement('div');
    communitiesGrid.className = 'communities-grid';
    container.appendChild(communitiesGrid);
    
    // Reset the current page for infinite scroll
    this.currentPage = 1;

    // We'll only append the initial batch of communities
    // The rest will be loaded by the infinite scroll
    const initialBatch = this.filteredCommunities.slice(0, this.itemsPerPage);
    
    initialBatch.forEach(community => {
      const communityCard = this.createCommunityCard(community);
      communitiesGrid.appendChild(communityCard);
    });
  }

  /**
   * Create a community card - with enhanced animations and effects
   */
  createCommunityCard(community, isFeatured = false) {
    const card = document.createElement('div');
    card.className = isFeatured 
      ? 'community-card featured-card' 
      : 'community-card';
    
    // Get community ID (with or without hive- prefix)
    const communityId = community.name.includes('hive-') 
      ? community.name 
      : `hive-${community.name}`;
    
    // Check if the user is subscribed to this community
    const isSubscribed = this.subscribedCommunities.has(community.name) || 
                        this.subscribedCommunities.has(communityId);
    
    // Check if subscription is pending
    const isPending = this.pendingSubscriptions.has(communityId);
    
    // Avatar URL (fallback to default if not provided)
    const avatarUrl = community.avatar_url || `https://images.hive.blog/u/${communityId}/avatar`;
    
    // Format description - for featured cards, make it shorter
    const description = community.about || 'No description available.';
    const descriptionLimit = isFeatured ? 80 : 120;
    const shortDescription = description.length > descriptionLimit 
      ? description.substring(0, descriptionLimit) + '...' 
      : description;
    
    // Simplified layout for featured cards
    if (isFeatured) {
      card.innerHTML = `
        <div class="community-card-header compact">
          <div class="avatar-container">
            <img src="${avatarUrl}" alt="${community.title}" class="community-avatar" >
            <div class="avatar-glow"></div>
          </div>
          <div>
            <h3 class="community-title">${community.title || community.name}</h3>
            <span class="featured-badge"><span class="material-icons">star</span> Featured</span>
          </div>
        </div>
        <div class="community-card-footer">
          <div class="community-stats">
            <span class="community-stat">
              <span class="material-icons">group</span> ${community.subscribers || 0}
            </span>
          </div>
          <div class="community-actions">
            <a href="/community/${communityId}" class="view-btn">View</a>
          </div>
        </div>
      `;
    } else {
      // Regular card layout with enhanced styling
      card.innerHTML = `
        <div class="community-card-header">
          <div class="avatar-container">
            <img src="${avatarUrl}" alt="${community.title}" class="community-avatar" 
                onerror="this.src='./assets/img/default-avatar.png'">
            <div class="avatar-glow"></div>
          </div>
          <h3 class="community-title">${community.title || community.name}</h3>
        </div>
        <div class="community-card-body">
          <p class="community-description">${shortDescription}</p>
        </div>
        <div class="community-card-footer">
          <div class="community-stats">
            <span class="community-stat">
              <span class="material-icons">group</span> ${community.subscribers || 0}
            </span>
          </div>
          <div class="community-actions">
            <a href="/community/${communityId}" class="view-btn">View</a>
            ${this.currentUser ? `
              <button class="subscribe-btn ${isSubscribed ? 'subscribed' : ''} ${isPending ? 'pending' : ''}" 
                data-community="${communityId}" ${isPending ? 'disabled' : ''}>
                ${isPending ? '<span class="loading-spinner-sm"></span>' : isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Add event listeners
    const subscribeBtn = card.querySelector('.subscribe-btn');
    if (subscribeBtn) {
      // Add ripple effect to button
      subscribeBtn.addEventListener('mousedown', function(e) {
        const x = e.clientX - this.getBoundingClientRect().left;
        const y = e.clientY - this.getBoundingClientRect().top;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      });
      
      subscribeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        this.handleSubscribeToggle(subscribeBtn, communityId, isSubscribed);
      });
    }
    
    // Add click handler to navigate to community page
    card.addEventListener('click', () => {
      window.location.href = `/app/community/${communityId}`;
    });
    
    return card;
  }

  async handleSubscribeToggle(button, communityId, isCurrentlySubscribed) {
    if (!this.currentUser) {
      window.location.href = '/app/login';
      return;
    }
    
    // Prevent multiple clicks
    if (this.pendingSubscriptions.has(communityId)) {
      return;
    }
    
    try {
      // Mark as pending
      this.pendingSubscriptions.add(communityId);
      
      // Update button appearance
      button.disabled = true;
      button.classList.add('pending');
      button.innerHTML = '<span class="loading-spinner-sm"></span>';
      
      if (isCurrentlySubscribed) {
        // Unsubscribe
        await communityService.unsubscribeFromCommunity(this.currentUser.username, communityId);
        
        // Remove from subscribed set
        this.subscribedCommunities.delete(communityId);
        this.subscribedCommunities.delete(communityId.replace(/^hive-/, ''));
        
        // Update button
        button.classList.remove('subscribed');
        button.textContent = 'Subscribe';
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully unsubscribed from community'
        });
      } else {
        // Subscribe
        await communityService.subscribeToCommunity(this.currentUser.username, communityId);
        
        // Add to subscribed set
        this.subscribedCommunities.add(communityId);
        this.subscribedCommunities.add(communityId.replace(/^hive-/, ''));
        
        // Update button
        button.classList.add('subscribed');
        button.textContent = 'Unsubscribe';
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully subscribed to community'
        });
      }
    } catch (error) {
      console.error(`Error toggling subscription for ${communityId}:`, error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to ${isCurrentlySubscribed ? 'unsubscribe from' : 'subscribe to'} community: ${error.message}`
      });
    } finally {
      // Clear pending state
      this.pendingSubscriptions.delete(communityId);
      button.disabled = false;
      button.classList.remove('pending');
    }
  }

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Discovering communities...</p>
      </div>
    `;
  }

  showError(container, message) {
    container.innerHTML = `
      <div class="error-container">
        <span class="material-icons">error</span>
        <p>${message}</p>
        <button id="retry-btn" class="primary-btn">Try Again</button>
      </div>
    `;
    
    // Add event listener to retry button
    const retryBtn = container.querySelector('#retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.render(this.container));
    }
  }

  handleAuthChanged(event) {
    this.currentUser = authService.getCurrentUser();
    
    // Reload subscriptions and re-render if the container exists
    if (this.viewContainer) {
      if (this.currentUser) {
        this.loadUserSubscriptions().then(() => {
          const contentEl = this.viewContainer.querySelector('.communities-content');
          if (contentEl) this.renderCommunities(contentEl);
        });
      } else {
        this.subscribedCommunities.clear();
        const contentEl = this.viewContainer.querySelector('.communities-content');
        if (contentEl) this.renderCommunities(contentEl);
      }
    }
  }

  initializeInfiniteScroll(contentContainer) {
    // Clean up any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }

    // Create a dedicated container for the communities grid
    const communitiesGrid = contentContainer.querySelector('.communities-grid');
    if (!communitiesGrid) return;

    this.infiniteScroll = new InfiniteScroll({
      container: communitiesGrid,
      loadMore: async (page) => {
        // Calculate pagination indices
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = page * this.itemsPerPage;
        
        // Check if we have more items to show
        if (startIndex >= this.filteredCommunities.length) {
          return false; // No more communities to load
        }
        
        // Get the next batch of communities
        const nextBatch = this.filteredCommunities.slice(startIndex, endIndex);
        
        // Render the next batch of communities
        nextBatch.forEach(community => {
          const communityCard = this.createCommunityCard(community);
          communitiesGrid.appendChild(communityCard);
        });
        
        // Return true if there are more communities to load
        return endIndex < this.filteredCommunities.length;
      },
      threshold: '200px',
      initialPage: this.currentPage,
      loadingMessage: 'Loading more communities...',
      endMessage: 'No more communities to discover',
      errorMessage: 'Error loading communities. Please try again.'
    });
  }

  onBeforeUnmount() {
    // Clean up event listeners
    eventEmitter.off('auth:changed', this.handleAuthChanged.bind(this));
    
    // Clear any pending operations
    this.pendingSubscriptions.clear();
    
    // Destroy infinite scroll instance
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }
}

export default CommunitiesListView;
