import steemService from '../services/SteemService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import eventEmitter from '../utils/EventEmitter.js';
// Import dei widget
import SteemChartWidget from '../components/widgets/SteemChartWidget.js';
import CryptoConverterWidget from '../components/widgets/CryptoConverterWidget.js';

class HomeView extends BasePostView {
  constructor(params) {
    super(params);
    
    // Se forceTag è true, usa sempre il tag specificato nei parametri
    if (params.forceTag && params.tag) {
      this.tag = params.tag;
    } else {
      // Altrimenti, considera le preferenze dell'utente
      const homeViewMode = userPreferencesService.getHomeViewMode();
      // If we're in custom mode but have no preferred tags, fallback to trending
      if (homeViewMode === 'custom' && userPreferencesService.getPreferredTags().length === 0) {
        this.tag = 'trending';
      } else if (homeViewMode === 'custom') {
        this.tag = 'custom';
      } else {
        // Otherwise use the specified tag parameter or home view mode
        this.tag = this.params.tag || homeViewMode;
      }
    }
    
    // Inizializzazione dei widget
    this.steemChartWidget = new SteemChartWidget();
    this.cryptoConverterWidget = new CryptoConverterWidget();
    
    // Widget sidebar state
    this.isWidgetSidebarCollapsed = userPreferencesService.getWidgetSidebarState() === 'collapsed';
    
    // Listen for preferences changes
    this.setupPreferencesListener();
  }
  
  setupPreferencesListener() {
    // Listen for tag preference changes
    eventEmitter.on('user:preferences:updated', () => {
      if (this.tag === 'custom') {
        // Reload posts with new preferences
        this.posts = [];
        this.renderedPostIds.clear();
        this.loadPosts(1);
      }
    });
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
      
      // Reset infinite scroll if it exists
      if (this.infiniteScroll) {
          this.infiniteScroll.reset(1);
      }
    }
    
    try {
      const result = await this.fetchPostsByTag(page);
      
      // Check if result has the expected structure
      if (!result || !result.posts) {
        return false;
      }
      
      const { posts, hasMore } = result;
      
      // Filter out any duplicates before adding to the post array
      if (Array.isArray(posts)) {
        const uniquePosts = posts.filter(post => {
          // Create a unique ID using author and permlink
          const postId = `${post.author}_${post.permlink}`;
          // Only include posts we haven't seen yet
          const isNew = !this.renderedPostIds.has(postId);
          return isNew;
        });
        
        if (uniquePosts.length > 0) {
          this.posts = [...this.posts, ...uniquePosts];
          this.renderPosts(page > 1);
        }
      }
      
      return hasMore;
    } catch (error) {
      console.error('Failed to load posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  async fetchPostsByTag(page = 1) {
    // If custom tag is selected, fetch by preferred tags
    if (this.tag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      
      if (preferredTags.length === 0) {
        // Fallback to trending if no preferred tags
        return steemService.getTrendingPosts(page);
      }
      
      // Get posts for each preferred tag
      return steemService.getPostsByPreferredTags(preferredTags, page);
    }
    
    // Use getPostsByTag for any custom tag not in the special list
    if (!['trending', 'hot', 'created', 'promoted'].includes(this.tag)) {
      return steemService.getPostsByTag(this.tag, page);
    }
    
    const postFetchers = {
      'trending': () => steemService.getTrendingPosts(page),
      'hot': () => steemService.getHotPosts(page),
      'created': () => steemService.getNewPosts(page),
      'promoted': () => steemService.getPromotedPosts(page)
    };
    
    const fetchMethod = postFetchers[this.tag] || (() => steemService.getTrendingPosts(page));
    return await fetchMethod();
  }
  
  getCurrentTag() {
    return this.tag;
  }
  
  /**
   * Create widgets for the sidebar
   */
  createWidgets() {
    const widgetsContainer = document.createElement('div');
    widgetsContainer.className = 'home-widgets-container';
    
    // Widget 1: Steem Price Chart
    const steemChartWidget = this.steemChartWidget.render();
    widgetsContainer.appendChild(steemChartWidget);
    
    // Widget 2: Crypto Converter
    const cryptoConverterWidget = this.cryptoConverterWidget.render();
    widgetsContainer.appendChild(cryptoConverterWidget);
    
    return widgetsContainer;
  }
  
  /**
   * Create toggle button for widget sidebar
   */
  createWidgetToggleButton() {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'widget-sidebar-toggle';
    toggleButton.setAttribute('aria-label', this.isWidgetSidebarCollapsed ? 'Expand widgets sidebar' : 'Collapse widgets sidebar');
    toggleButton.innerHTML = this.isWidgetSidebarCollapsed ? 
      '<span class="material-icons">chevron_left</span>' : 
      '<span class="material-icons">chevron_right</span>';
    
    toggleButton.addEventListener('click', () => this.toggleWidgetSidebar());
    
    return toggleButton;
  }
  
  /**
   * Toggle widget sidebar visibility
   */
  toggleWidgetSidebar() {
    // Get elements
    const layoutWrapper = document.querySelector('.home-layout-wrapper');
    const widgetColumn = document.querySelector('.home-widget-column');
    const toggleButton = document.querySelector('.widget-sidebar-toggle');
    
    if (!layoutWrapper || !widgetColumn || !toggleButton) return;
    
    // Toggle state
    this.isWidgetSidebarCollapsed = !this.isWidgetSidebarCollapsed;
    
    // Update UI
    if (this.isWidgetSidebarCollapsed) {
      layoutWrapper.classList.add('widgets-collapsed');
      toggleButton.innerHTML = '<span class="material-icons">chevron_left</span>';
      toggleButton.setAttribute('aria-label', 'Expand widgets sidebar');
    } else {
      layoutWrapper.classList.remove('widgets-collapsed');
      toggleButton.innerHTML = '<span class="material-icons">chevron_right</span>';
      toggleButton.setAttribute('aria-label', 'Collapse widgets sidebar');
    }
    
    // Save preference
    userPreferencesService.saveWidgetSidebarState(this.isWidgetSidebarCollapsed ? 'collapsed' : 'expanded');
  }

  render(container) {
    // Get view title based on tag
    let viewTitle = `${this.formatTagName(this.tag)} Posts`;
    
    // Special handling for custom tag mode
    if (this.tag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      if (preferredTags.length > 0) {
        // Format tags for display with proper capitalization and commas
        const formattedTags = preferredTags
          .map(tag => this.formatTagName(tag))
          .join(', ');
        viewTitle = `Your Tags: ${formattedTags}`;
      } else {
        viewTitle = 'Trending Posts';
      }
    }
    
    // Clear container first
    container.innerHTML = '';
    
    // Create two-column layout wrapper
    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'home-layout-wrapper';
    if (this.isWidgetSidebarCollapsed) {
      layoutWrapper.classList.add('widgets-collapsed');
    }
    container.appendChild(layoutWrapper);
    
    // Create content column container
    const contentColumn = document.createElement('div');
    contentColumn.className = 'home-content-column';
    layoutWrapper.appendChild(contentColumn);
    
    // Create widget column container
    const widgetColumn = document.createElement('div');
    widgetColumn.className = 'home-widget-column';
    layoutWrapper.appendChild(widgetColumn);
    
    // Render base view into the content column instead of main container
    const { postsContainer } = this.renderBaseView(
      contentColumn,
      viewTitle,
      { showSearchForm: false }
    );
    
    // Add toggle button for widget sidebar
    const toggleButton = this.createWidgetToggleButton();
    widgetColumn.appendChild(toggleButton);
    
    // Add widgets to widget column
    widgetColumn.appendChild(this.createWidgets());
    
    // Destroy existing infinite scroll if it exists
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
    }
    
    // Load first page of posts
    this.loadPosts(1).then((hasMore) => {
      // Initialize infinite scroll after first page loads
      if (postsContainer) {
        // Customize end message based on tag type
        let endMessage = `No more ${this.formatTagName(this.tag)} posts to load`;
        if (this.tag === 'custom') {
          const preferredTags = userPreferencesService.getPreferredTags();
          if (preferredTags.length > 0) {
            endMessage = `No more posts with tags: ${preferredTags.join(', ')}`;
          } else {
            endMessage = 'No more posts to load';
          }
        }
        
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px',
          loadingMessage: 'Loading more posts...',
          endMessage,
          errorMessage: 'Failed to load posts. Please check your connection.'
        });
      }
    });
  }
  
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
        this.infiniteScroll = null;
    }
    
    // Remove event listeners
    eventEmitter.off('user:preferences:updated');
  }

  /**
   * Override the base handleLoadError to not show any message
   */
  handleLoadError() {
    const postsContainer = this.container?.querySelector('.posts-container');
    if (postsContainer) {
      this.clearContainer(postsContainer);
      // No error message will be shown
    }
  }
}

export default HomeView;