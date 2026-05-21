import steemService from '../services/SteemService.js';
import socialFeedService from '../services/SocialFeedService.js';
import authService from '../services/AuthService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import eventEmitter from '../utils/EventEmitter.js';
import metaTagService from '../services/MetaTagService.js';
import router from '../utils/Router.js';

class HomeView extends BasePostView {  constructor(params) {
    super(params);
    
    // Temporary feed override (session only, doesn't change preferences)
    this._tempTag = null;

    // Check if TagView navigated here with a temp feed selection
    const pendingFeed = sessionStorage.getItem('homeTempFeed');
    if (pendingFeed) {
      sessionStorage.removeItem('homeTempFeed');
      this._tempTag = pendingFeed;
    }

    // Se forceTag è true, usa sempre il tag specificato nei parametri
    if (params.forceTag && params.tag) {
      this.tag = params.tag;
    } else {
      // Altrimenti, considera le preferenze dell'utente
      const homeViewMode = userPreferencesService.getHomeViewMode();
      const preferredTags = userPreferencesService.getPreferredTags();
      
      // If we're in custom mode but have no preferred tags, fallback to trending
      if (homeViewMode === 'custom' && (!preferredTags || preferredTags.length === 0)) {
        console.warn('Custom mode selected but no preferred tags found, falling back to trending');
        this.tag = 'trending';
        
        // Auto-correct the stored preference
        userPreferencesService.setHomeViewMode('trending');
      } else if (homeViewMode === 'custom') {
        this.tag = 'custom';
      } else if (homeViewMode === 'social') {
        this.tag = 'social';
      } else {
        // Otherwise use the specified tag parameter or home view mode
        this.tag = this.params.tag || homeViewMode;
      }
    }
    
    // Listen for preferences changes
    this.setupPreferencesListener();
  }
    setupPreferencesListener() {
    // Explicit routes like /hot or /trending should not be overridden by settings changes.
    if (this.params?.forceTag) {
      return;
    }

    // Listen for tag preference changes
    eventEmitter.on('user:preferences:updated', () => {
      // Get current home view mode from preferences
      const currentHomeViewMode = userPreferencesService.getHomeViewMode();
      
      // If we're currently in custom mode or the mode has changed
      if (this.tag === 'custom' || this.tag !== currentHomeViewMode) {
        // Update the current tag to match the new preference
        this.tag = currentHomeViewMode;
        
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
      this.showPostSkeletons(8);
      
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

      // Empty state for following feed
      if (page === 1 && this.posts.length === 0) {
        const activeTag = this._tempTag || this.tag;
        if (activeTag === 'social') {
          const postsContainer = this.container?.querySelector('.posts-container');
          if (postsContainer) {
            postsContainer.innerHTML = `
              <div class="empty-state">
                <span class="material-icons">people</span>
                <h3>Your following feed is empty</h3>
                <p>Follow some users or join communities to see their posts here.</p>
              </div>
            `;
          }
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
    const activeTag = this._tempTag || this.tag;

    // Social / following feed
    if (activeTag === 'social') {
      const currentUser = authService.getCurrentUser?.();
      if (!currentUser?.username) {
        // Not logged in — fallback to trending
        return steemService.getTrendingPosts(page);
      }
      return socialFeedService.getMixedSocialFeed(currentUser.username, 20, page);
    }

    // If custom tag is selected, fetch by preferred tags
    if (activeTag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      
      if (preferredTags.length === 0) {
        // Fallback to trending if no preferred tags
        return steemService.getTrendingPosts(page);
      }
      
      // Get posts for each preferred tag
      return steemService.getPostsByPreferredTags(preferredTags, page);
    }
    
    // Use getPostsByTag for any custom tag not in the special list
    if (!['trending', 'hot', 'new', 'created', 'promoted'].includes(activeTag)) {
      return steemService.getPostsByTag(activeTag, page);
    }
    
    const postFetchers = {
      'trending': () => steemService.getTrendingPosts(page),
      'hot': () => steemService.getHotPosts(page),
      'new': () => steemService.getNewPosts(page),
      'created': () => steemService.getNewPosts(page),
      'promoted': () => steemService.getPromotedPosts(page)
    };
    
    const fetchMethod = postFetchers[activeTag] || (() => steemService.getTrendingPosts(page));
    return await fetchMethod();
  }
  
  getCurrentTag() {
    return this.tag;
  }

  render(container) {
    // Reset to default meta tags for home page
    metaTagService.resetToDefault();
    
    // Get view title based on tag
    const activeTag = this._tempTag || this.tag;
    let viewTitle = `${this.formatTagName(activeTag)} Posts`;
    
    // Special handling for social feed
    if (activeTag === 'social') {
      viewTitle = 'Following';
    }

    // Special handling for custom tag mode
    if (activeTag === 'custom') {
      const preferredTags = userPreferencesService.getPreferredTags();
      if (preferredTags.length > 0) {
        const formattedTags = preferredTags
          .map(tag => this.formatTagName(tag))
          .join(', ');
        viewTitle = `Your Tags: ${formattedTags}`;
      } else {
        viewTitle = 'Trending Posts';
      }
    }
    
    const feedSubtitles = {
      trending: 'Discover what the community is reading right now.',
      hot:      'The most engaging posts of the moment.',
      new:      'Fresh content, just published.',
      custom:   'Posts curated from your preferred tags.',
      social:   'Posts and comments from people you follow.'
    };
    const headerSubtitle = feedSubtitles[activeTag] || feedSubtitles.trending;

    const { postsContainer } = this.renderBaseView(
      container,
      viewTitle,
      {
        showSearchForm: false,
        headerVariant: 'home',
        headerSubtitle
      }
    );

    // Inject feed switcher into the home header banner
    this._renderFeedSwitcher(container, postsContainer);
    
    // Destroy existing infinite scroll if it exists
    if (this.infiniteScroll) {
        this.infiniteScroll.destroy();
    }

    // --- Back navigation: restore from cache instead of API call ---
    if (router.isBackNavigation) {
      router.isBackNavigation = false;
      const cached = this.restoreState();
      if (cached) {
        this.posts = cached.posts;
        this.renderedPostIds = new Set(cached.renderedPostIds);
        this.loading = false;
        this.loadingIndicator.hide();
        this.renderPosts(false); // renders all cached posts, also handles scroll restore

        let endMessage = `No more ${this.formatTagName(this.tag)} posts to load`;
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px',
          initialPage: cached.currentPage,
          loadingMessage: 'Loading more posts...',
          endMessage,
          errorMessage: 'Failed to load posts. Please check your connection.'
        });
        return;
      }
    }
    // --- end back navigation restore ---
    
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

    // Close feed switcher panel if open
    this._closeFeedSwitcher();
  }

  // Override: reload posts in-place instead of navigating
  _switchFeedTemp(newTag, postsContainer, container) {
    this._closeFeedSwitcher();
    if ((this._tempTag || this.tag) === newTag) return;

    this._tempTag = newTag;

    // Update active state on buttons
    if (this._feedSwitcherPanel) {
      this._feedSwitcherPanel.querySelectorAll('.feed-switcher-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.feed === newTag);
      });
    }

    // Update banner title and subtitle
    const headerArea = container.querySelector('.header-area-home');
    if (headerArea) {
      const titleEl = headerArea.querySelector('.header-title');
      const subtitleEl = headerArea.querySelector('.header-subtitle');
      if (titleEl) {
        if (newTag === 'social') {
          titleEl.textContent = 'Following';
        } else if (newTag === 'custom') {
          const tags = userPreferencesService.getPreferredTags();
          titleEl.textContent = tags.length > 0
            ? `Your Tags: ${tags.map(t => this.formatTagName(t)).join(', ')}`
            : 'Trending Posts';
        } else {
          titleEl.textContent = `${this.formatTagName(newTag)} Posts`;
        }
      }
      if (subtitleEl) {
        const subtitles = {
          trending: 'Discover what the community is reading right now.',
          hot:      'The most engaging posts of the moment.',
          new:      'Fresh content, just published.',
          custom:   'Posts curated from your preferred tags.',
          social:   'Posts and comments from people you follow.'
        };
        subtitleEl.textContent = subtitles[newTag] || subtitles.trending;
      }
    }

    // Reload posts
    this.posts = [];
    this.renderedPostIds.clear();
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    this.loadPosts(1).then(() => {
      if (postsContainer) {
        const endMessage = newTag === 'custom'
          ? `No more posts with your tags`
          : `No more ${this.formatTagName(newTag)} posts to load`;
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