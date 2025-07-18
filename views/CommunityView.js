// Base class
import BasePostView from './BasePostView.js';

// Services
import authService from '../services/AuthService.js';
import steemService from '../services/SteemService.js';
import communityService from '../services/CommunityService.js';
import metaTagService from '../services/MetaTagService.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class CommunityView extends BasePostView {
  constructor(params) {
    super(params);
    this.communityId = this.params.id;
    this.community = null;
    this.isSubscribed = false;
    this.currentUser = authService.getCurrentUser();
    this.sortOrder = 'trending'; // Default sort order
    this._communityCache = {}; // Initialize cache
  }

  /**
   * Implementazione richiesta da BasePostView per identificare il tag corrente
   */
  getCurrentTag() {
    return this.communityId;
  }
  
  /**
   * Carica post della community utilizzando il pattern di BasePostView
   */
  async loadPosts(page = 1) {
    if (this.loading) {
      return false;
    }

    this.loading = true;

    if (page === 1) {
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
    }

    try {
      // Assicurati che i dettagli della community siano caricati
      if (!this.community && !(await this.fetchCommunityDetails())) {
        console.error('Failed to load community details');
        this.handleLoadError();
        return false;
      }

      // Fetch posts
      const result = await this.communityFetch('posts', {
        communityId: this.communityId,
        sort: this.sortOrder,
        limit: 30, // Numero di post per pagina
        lastAuthor: page > 1 && this.posts.length > 0 ? this.posts[this.posts.length - 1].author : undefined,
        lastPermlink: page > 1 && this.posts.length > 0 ? this.posts[this.posts.length - 1].permlink : undefined,
        communityDetails: this.community
      });

      if (!result || !result.posts) {
        console.error('Invalid result from communityFetch:', result);
        return false;
      }

      const { posts, hasMore } = result;

      // Filtra i duplicati
      const uniquePosts = posts.filter(post => {
        const postId = `${post.author}_${post.permlink}`;
        if (!this.renderedPostIds.has(postId)) {
          this.renderedPostIds.add(postId);
          return true;
        }
        return false;
      });

      if (uniquePosts.length > 0) {
        this.posts = [...this.posts, ...uniquePosts];
        this.renderPosts(page > 1);
      }

      return hasMore;
    } catch (error) {
      console.error('Failed to load community posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  /**
   * Fetch community details
   */
  async fetchCommunityDetails() {
    try {
      // Use the optimized communityFetch method that takes advantage of cached data
      const result = await this.communityFetch('details', { communityId: this.communityId });
      
      if (!result) {
        console.error(`Community ${this.communityId} not found`);
        this.showError('Community not found');
        return false;
      }
      
      this.community = result;
      
      // Update meta tags for better social sharing
      metaTagService.updateCommunityMetaTags(this.community);
      
      // Check if user is subscribed - only if logged in
      if (this.currentUser) {
        try {
          // Get subscribed communities from the optimized cache
          const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username, true);
          
          // Normalize community names for comparison
          const normalizedCommunityName = this.community.name.replace(/^hive-/, '');
          const communityFullName = this.community.name.startsWith('hive-') 
            ? this.community.name 
            : `hive-${this.community.name}`;
          
          // Check subscriptions more efficiently
          this.isSubscribed = subscriptions.some(sub => {
            if (typeof sub === 'string') {
              return sub === normalizedCommunityName || sub === communityFullName;
            }
            
            const subName = sub.name || '';
            const subId = sub.id || '';
            
            return [subName, subId, subName.replace(/^hive-/, ''), subId.replace(/^hive-/, '')]
              .includes(normalizedCommunityName) || 
              [subName, subId].includes(communityFullName);
          });
        } catch (error) {
          console.error('Could not check subscription status:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error fetching community details:', error);
      return false;
    }
  }

  /**
   * Render method delegating to BasePostView pattern
   */
  render(container) {
    this.container = container;
    this.container.className = 'community-view';
    this.container.innerHTML = '';
    
    // Create community header
    const headerContainer = document.createElement('div');
    headerContainer.className = 'community-header';
    headerContainer.innerHTML = `
      <div class="community-header-loading">
        <div class="spinner"></div>
        <p>Loading community...</p>
      </div>
    `;
    this.container.appendChild(headerContainer);
    
    // Create posts container
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    
    // Create sort controls
    const sortControlsContainer = document.createElement('div');
    sortControlsContainer.className = 'community-sort-options';
    contentWrapper.appendChild(sortControlsContainer);
    
    // Create posts container that BasePostView will use
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';
    contentWrapper.appendChild(postsContainer);
    
    this.container.appendChild(contentWrapper);
    
    // Load community details first
    this.fetchCommunityDetails().then(success => {
      if (success) {
        this.renderCommunityHeader(headerContainer);
        this.renderSortOptions(sortControlsContainer);
        
        // Initialize the GridController
        this.initGridController(postsContainer);
        
        // Load initial posts
        this.loadPosts(1).then((hasMore) => {
          // Initialize infinite scroll
          if (postsContainer) {
            this.infiniteScroll = new InfiniteScroll({
              container: postsContainer,
              loadMore: (page) => this.loadPosts(page),
              threshold: '200px',
              loadingMessage: 'Loading more posts...',
              endMessage: `No more posts in this community`,
              errorMessage: 'Failed to load posts. Please check your connection.'
            });
          }
        });
      }
    });
  }

  /**
   * Render community header with details
   */
  renderCommunityHeader(headerContainer) {
    if (!this.community) return;
    
    const communityName = this.community.name.startsWith('hive-') 
      ? this.community.name 
      : `hive-${this.community.name}`;
    
    // Get numeric ID from community
    const communityId = communityName.replace('hive-', '');
    
    // Prepare avatar URL (or use placeholder)
    const avatarUrl = this.community.avatar_url || `https://images.hive.blog/u/hive-${communityId}/avatar`;
    
    // Prepare banner URL (or use default)
    const bannerUrl = this.community.banner_url || 'assets/images/default-community-banner.jpg';
    
    // Render community header
    headerContainer.innerHTML = `
      <div class="community-banner" style="background-image: url('${bannerUrl}');">
        <div class="community-overlay"></div>
        <div class="community-info">
          <img src="${avatarUrl}" alt="${this.community.title}" class="community-avatar" />
          <div class="community-title-area">
            <h1 class="community-title">${this.community.title || communityName}</h1>
            <div class="community-stats">
              <span class="community-stat">
                <span class="material-icons">group</span>
                ${this.community.subscribers || 0} subscribers
              </span>
              <span class="community-stat">
                <span class="material-icons">article</span>
                ${this.community.num_pending || 0} pending posts
              </span>
            </div>
          </div>
          ${this.currentUser ? `
            <button id="subscribe-button" class="${this.isSubscribed ? 'outline-btn' : 'primary-btn'}">
              ${this.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="community-about">
        ${this.community.about ? `<p>${this.community.about}</p>` : ''}
      </div>
    `;
    
    // Add event listeners
    const subscribeButton = headerContainer.querySelector('#subscribe-button');
    if (subscribeButton) {
      subscribeButton.addEventListener('click', () => this.handleSubscription());
    }
  }

  /**
   * Render sort options
   */
  renderSortOptions(container) {
    container.innerHTML = `
      <div class="sort-buttons">
        <button class="sort-button ${this.sortOrder === 'trending' ? 'active' : ''}" data-sort="trending">
          <span class="material-icons">trending_up</span> Trending
        </button>
        <button class="sort-button ${this.sortOrder === 'hot' ? 'active' : ''}" data-sort="hot">
          <span class="material-icons">local_fire_department</span> Hot
        </button>
        <button class="sort-button ${this.sortOrder === 'created' ? 'active' : ''}" data-sort="created">
          <span class="material-icons">schedule</span> New
        </button>
      </div>
    `;
    
    // Add event listeners for sort buttons
    const sortButtons = container.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.changeSortOrder(button.dataset.sort);
      });
    });
  }

  /**
   * Change post sort order
   */
  changeSortOrder(order) {
    if (this.sortOrder === order) {
      // Forza il ricaricamento anche se l'ordine è lo stesso
      this.loadPosts(1);
      return;
    }

    this.sortOrder = order;

    // Aggiorna l'interfaccia utente per evidenziare la scheda attiva
    const sortButtons = this.container.querySelectorAll('.sort-button');
    sortButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === order);
    });

    // Svuota i post della scheda precedente
    this.posts = [];
    this.renderedPostIds.clear();
    this.renderPosts();

    // Ricarica i post con il nuovo ordine
    this.loadPosts(1);
  }

  /**
   * Handle subscribe/unsubscribe
   */
  async handleSubscription() {
    if (!this.currentUser) {
      window.location.href = '/app/login';
      return;
    }
    
    const button = this.container.querySelector('#subscribe-button');
    if (button) {
      button.disabled = true;
      button.classList.add('button-loading');
      button.innerHTML = '<span class="loading-spinner-sm"></span> Processing...';
    }
    
    try {
      if (this.isSubscribed) {
        // Unsubscribe - invoca direttamente il metodo del service invece di usare communityFetch
        await communityService.unsubscribeFromCommunity(
          this.currentUser.username,
          this.community.name
        );
        this.isSubscribed = false;
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully unsubscribed from community'
        });
      } else {
        // Subscribe - invoca direttamente il metodo del service invece di usare communityFetch
        await communityService.subscribeToCommunity(
          this.currentUser.username, 
          this.community.name
        );
        this.isSubscribed = true;
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully subscribed to community'
        });
      }
    } catch (error) {
      console.error('Error handling subscription:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to ${this.isSubscribed ? 'unsubscribe from' : 'subscribe to'} community: ${error.message}`
      });
    } finally {
      // Re-enable button and update state
      if (button) {
        button.disabled = false;
        button.classList.remove('button-loading');
        button.textContent = this.isSubscribed ? 'Unsubscribe' : 'Subscribe';
        button.className = this.isSubscribed ? 'outline-btn' : 'primary-btn';
      }
    }
  }

  /**
   * Handle load errors without showing any message
   */
  handleLoadError() {
    const postsContainer = this.container.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '';
      // No error message will be shown
    }
  }

  /**
   * Show custom error without any UI
   */
  showError(message) {
    if (!this.container) return;
    
    const contentWrapper = this.container.querySelector('.content-wrapper');
    if (!contentWrapper) return;
    
    const postsContainer = contentWrapper.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '';
      // No error message will be shown
    }
  }

  /**
   * Clean up resources when leaving the view
   */
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Clean up GridController instance
    if (this.gridController) {
      this.gridController.unmount();
      this.gridController = null;
    }
    
    // Clear any remaining post data to prevent leakage to other views
    this.posts = [];
    this.renderedPostIds.clear();
    
    // Clear community data
    this.community = null;
    
    // Remove any event listeners
    const subscribeButton = this.container?.querySelector('#subscribe-button');
    if (subscribeButton) {
      subscribeButton.replaceWith(subscribeButton.cloneNode(true));
    }
    
    // Clear container references
    this.container = null;
  }

  /**
   * Initialize the GridController
   */
  initGridController(postsContainer) {
    if (!postsContainer) return;
    
    // Correggi il percorso di importazione - è in components, non in utils
    import('../components/GridController.js').then(module => {
      const GridController = module.default;
      
      // Crea il controller
      this.gridController = new GridController({
        // Il controller si aspetta targetSelector, non container
        targetSelector: '.posts-container',
        // Altre opzioni se necessarie
      });
      
      // Il GridController.js attuale aspetta un container per il render
      // non un contenitore separato per i controlli
      const gridControlContainer = document.createElement('div');
      gridControlContainer.className = 'grid-controller-container';
      
      // Aggiungi il container dei controlli subito prima del posts-container
      const sortOptions = this.container.querySelector('.community-sort-options');
      sortOptions.appendChild(gridControlContainer);
      
      // Chiama il metodo render (non renderControls)
      this.gridController.render(gridControlContainer);
    }).catch(err => {
      console.error('Could not initialize grid controller:', err);
    });
  }

  /**
   * Unified method for community-related API calls with caching support
   * @param {string} operation - The operation type ('details', 'posts', 'subscriptions', etc.)
   * @param {Object} params - Parameters for the operation
   * @param {boolean} useCache - Whether to use cached results if available
   * @returns {Promise<Object>} - The result of the operation
   */
  async communityFetch(operation, params = {}, useCache = true) {
    // Create cache key based on operation and parameters
    const cacheKey = `${operation}:${JSON.stringify(params)}`;
    
    // Check if we have this in cache
    if (useCache && this._communityCache && this._communityCache[cacheKey]) {
      const cachedData = this._communityCache[cacheKey];
      // Only use cache if it hasn't expired
      if (Date.now() - cachedData.timestamp < 300000) { // 5 minutes expiry
        return cachedData.data;
      }
    }

    // Initialize cache if needed
    if (!this._communityCache) {
      this._communityCache = {};
    }

    // Show operation-specific loading state
    this.showOperationLoading(operation);

    try {
      let result;
      
      // Route to the appropriate API call based on operation
      switch (operation) {
        case 'details':
          const communityName = params.communityId?.startsWith('hive-') 
            ? params.communityId 
            : `hive-${params.communityId}`;
          result = await communityService.findCommunityByName(communityName);
          break;
          
        case 'posts':
          const postsPerPage = params.limit || 30; // Aumenta il limite predefinito a 30
          const fetchParams = {
            community: params.communityId.replace(/^hive-/, ''),
            sort: params.sort || 'trending',
            limit: postsPerPage
          };

          if (params.lastAuthor && params.lastPermlink) {
            fetchParams.start_author = params.lastAuthor;
            fetchParams.start_permlink = params.lastPermlink;
          }

          const rawPosts = await steemService.fetchCommunityPosts(fetchParams);

          if (Array.isArray(rawPosts) && rawPosts.length > 0) {
            const community = params.communityDetails || this.community;
            const enrichedPosts = rawPosts.map(post => ({
              ...post,
              community: params.communityId.replace(/^hive-/, ''),
              community_title: community?.title || communityService.formatCommunityTitle(params.communityId)
            }));

            result = {
              posts: enrichedPosts,
              hasMore: enrichedPosts.length >= postsPerPage,
              lastPost: enrichedPosts[enrichedPosts.length - 1]
            };
          } else {
            result = { posts: [], hasMore: false };
          }
          break;
          
        case 'subscriptions':
          result = await communityService.getSubscribedCommunities(params.username, false);
          break;
          
        case 'subscribe':
          result = await communityService.subscribeToCommunity(params.username, params.communityName);
          break;
          
        case 'unsubscribe':
          result = await communityService.unsubscribeFromCommunity(params.username, params.communityName);
          break;
          
        case 'members':
          result = await communityService.getCommunityMembers(params.communityId, params.page || 1);
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      // Cache the successful result
      this._communityCache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
    } catch (error) {
      console.error(`Error in communityFetch (${operation}):`, error);
      // Emit error event for UI notification
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to fetch community ${operation}: ${error.message}`
      });
      return null;
    } finally {
      // Hide operation-specific loading state
      this.hideOperationLoading(operation);
    }
  }

  /**
   * Show loading state for specific operation
   */
  showOperationLoading(operation) {
    if (!this.container) return;
    
    switch (operation) {
      case 'details':
        const headerLoading = this.container.querySelector('.community-header-loading');
        if (headerLoading) headerLoading.style.display = 'flex';
        break;
        
      case 'posts':
        const postsContainer = this.container.querySelector('.posts-container');
        if (postsContainer) this.loadingIndicator.show(postsContainer);
        break;
        
      case 'subscribe':
      case 'unsubscribe':
        const button = this.container.querySelector('#subscribe-button');
        if (button) {
          button.disabled = true;
          button.classList.add('button-loading');
          button.innerHTML = '<span class="loading-spinner-sm"></span> Processing...';
        }
        break;
    }
  }

  /**
   * Hide loading state for specific operation
   */
  hideOperationLoading(operation) {
    if (!this.container) return;
    
    switch (operation) {
      case 'details':
        const headerLoading = this.container.querySelector('.community-header-loading');
        if (headerLoading) headerLoading.style.display = 'none';
        break;
        
      case 'posts':
        this.loadingIndicator.hide();
        break;
        
      case 'subscribe':
      case 'unsubscribe':
        const button = this.container.querySelector('#subscribe-button');
        if (button) {
          button.disabled = false;
          button.classList.remove('button-loading');
        }
        break;
    }
  }
}

export default CommunityView;