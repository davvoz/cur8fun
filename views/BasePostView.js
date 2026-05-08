// Router
import router from '../utils/Router.js';
import { proxifyImage, getImageUrl } from '../utils/ImageUtils.js';

// Components
import ContentRenderer from '../components/ContentRenderer.js';
import GridController from '../components/GridController.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

// Services
import communityService from '../services/CommunityService.js';
import voteService from '../services/VoteService.js';
import authService from '../services/AuthService.js';

// Controllers
import VoteController from '../controllers/VoteController.js';
import VotesPopup from '../components/post/VotesPopup.js';
import PayoutInfoPopup from '../components/post/PayoutInfoPopup.js';
import reblogService from '../services/ReblogService.js';
import DialogUtility from '../components/DialogUtility.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';

/**
 * Base class for views that display lists of posts
 * Shared by HomeView, TagView, and potentially other views
 */
class BasePostView {
  constructor(params = {}) {
    this.params = params;
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    this.gridController = new GridController({
      targetSelector: '.posts-container'
    });
    
    // Track post IDs to prevent duplicates
    this.renderedPostIds = new Set();
    
    // Popular tags that will be shown in the tag selection bar
    this.popularTags = [
      'cur8', 'photography', 'art', 'travel', 
      'food', 'music', 'gaming', 'life', 'blockchain', 'crypto'
    ];

    // Create vote controller for post actions
    this.voteController = new VoteController(this);
    
    // Initialize mobile detection and handling
    this.setupMobileResponsiveness();
    
    // Initialize SteemContentRenderer for image extraction
    this.initSteemRenderer();
  }
  
  /**
   * Setup mobile responsiveness
   */
  setupMobileResponsiveness() {
    // Apply mobile styling initially
    this.handleMobileLayout();
    
    // Update on window resize
    window.addEventListener('resize', () => {
      this.handleMobileLayout();
    });
  }
  
  /**
   * Check if the current device is mobile (based on screen width)
   */
  isMobileDevice() {
    return window.innerWidth < 768; // Common breakpoint for mobile devices
  }
  
  /**
   * Handle mobile layout adjustments
   */
  handleMobileLayout() {
    // Find all posts-container elements (there might be multiple in the app)
    const containers = document.querySelectorAll('.posts-container');
    
    if (this.isMobileDevice()) {
      // Add mobile class to enforce single column
      containers.forEach(container => {
        container.classList.add('mobile-view');
        
        // Force single column through inline style for immediate effect
        container.style.gridTemplateColumns = '1fr';
      });
    } else {
      // Remove mobile class on larger screens
      containers.forEach(container => {
        container.classList.remove('mobile-view');
        container.style.gridTemplateColumns = ''; // Remove inline style to let CSS take over
      });
    }
  }

  /**
   * Initialize SteemContentRenderer for image extraction
   */
  async initSteemRenderer() {
    try {
      await ContentRenderer.loadSteemContentRenderer();
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: true,
        extractImages: true,
        renderImages: true
      });
    } catch (error) {
      console.error('Failed to initialize SteemContentRenderer:', error);
      this.contentRenderer = null;
    }
  }

  /**
   * Load posts method to be implemented by child classes
   */
  async loadPosts(page = 1) {
    throw new Error('loadPosts method must be implemented by subclass');
  }

  /**
   * Handle load errors
   */
  handleLoadError() {
    eventEmitter.emit('notification', {
      type: 'error',
      message: 'Failed to load posts. Please try again later.'
    });
    
    const postsContainer = this.container?.querySelector('.posts-container');
    if (!postsContainer) return;
    
    this.clearContainer(postsContainer);
    const errorElement = this.createErrorElement();
    postsContainer.appendChild(errorElement);
  }
  
  /**
   * Create error element
   */
  createErrorElement() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    
    const errorHeading = document.createElement('h3');
    errorHeading.textContent = 'Failed to load posts';
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'There was an error connecting to the Steem blockchain.';
    
    const retryButton = document.createElement('button');
    retryButton.className = 'btn-primary retry-btn';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => this.loadPosts());
    
    errorDiv.append(errorHeading, errorMessage, retryButton);
    return errorDiv;
  }

  /**
   * Render posts
   */
  renderPosts(append = false) {
    const postsContainer = this.container?.querySelector('.posts-container');
    
    if (!postsContainer) return;
    
    if (!append) {
      this.clearContainer(postsContainer);
      this.renderedPostIds.clear();
    }

    // Calculate which posts to render
    let postsToRender = [];
    if (append) {
      // When appending, get only the new posts
      const currentPostCount = postsContainer.querySelectorAll('.post-card').length;
      postsToRender = this.posts.slice(currentPostCount);
    } else {
      // When not appending (fresh render), get all posts
      postsToRender = this.posts;
    }
    
    // Filter out any duplicates that might have slipped through
    const uniquePostsToRender = postsToRender.filter(post => {
      const postId = `${post.author}_${post.permlink}`;
      if (this.renderedPostIds.has(postId)) {
        return false;
      }
      this.renderedPostIds.add(postId);
      return true;
    });

    // Show no posts message only if we're not currently loading AND there are no posts
    if (uniquePostsToRender.length === 0 && this.posts.length === 0 && !this.loading) {
      this.renderNoPostsMessage(postsContainer);
      return;
    }
    
    // Render each post
    uniquePostsToRender.forEach(post => this.renderPostCard(post, postsContainer));

    // Restore scroll after back navigation (fresh render only, not append)
    if (!append && router.pendingScrollRestore !== undefined) {
      const targetScrollTop = router.pendingScrollRestore;
      router.pendingScrollRestore = undefined;
      requestAnimationFrame(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTop = targetScrollTop;
      });
    }
  }

  /**
   * Scroll #main-content to the card matching a postId. Retries via rAF until card appears (max 2s).
   */
  _scrollToPost(container, postId, deadline = Date.now() + 2000) {
    const card = container.querySelector(`[data-post-id="${postId}"]`);
    const mainContent = document.getElementById('main-content');
    if (card && mainContent) {
      const cardRect = card.getBoundingClientRect();
      const containerRect = mainContent.getBoundingClientRect();
      const targetScrollTop = mainContent.scrollTop + (cardRect.top - containerRect.top);
      console.log('[_scrollToPost] postId:', postId, '| cardRect.top:', cardRect.top, '| containerRect.top:', containerRect.top, '| current scrollTop:', mainContent.scrollTop, '| targetScrollTop:', targetScrollTop);
      mainContent.scrollTop = targetScrollTop;
    } else if (Date.now() < deadline) {
      console.log('[_scrollToPost] card not found yet, retrying... postId:', postId);
      requestAnimationFrame(() => this._scrollToPost(container, postId, deadline));
    } else {
      console.warn('[_scrollToPost] GAVE UP finding card:', postId);
    }
  }

  /**
   * Show a message when no posts are found
   */
  renderNoPostsMessage(container) {
    // Do nothing - we don't want to show any message
    // The container will simply remain empty
  }

  /**
   * Clear a container element
   */
  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  /**
   * Renders a post card
   */
  renderPostCard(post, container) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    
    // Parse metadata to extract better images and tags
    const metadata = this.parseMetadata(post.json_metadata);
    
    // Get the best available image
    const imageUrl = this.getBestImage(post, metadata);

    // Pinned badge (community pinned posts)
    if (post.stats?.is_pinned) {
      postCard.classList.add('is-pinned');
      const pinnedBadge = document.createElement('div');
      pinnedBadge.className = 'post-pinned-badge';
      pinnedBadge.innerHTML = '<span class="material-icons">push_pin</span><span class="pinned-label"> Pinned</span>';
      postCard.appendChild(pinnedBadge);
    }
    
    // 1. Add header (author info) - Always at the top
    postCard.appendChild(this.createPostHeader(post));
    
    // 2. Main content - can be vertical or horizontal depending on layout
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';
    
    // 2a. Add image preview (null when post has no image — skip to avoid empty space)
    const postImageEl = this.createPostImage(imageUrl, post.title);
    if (postImageEl) {
      mainContent.appendChild(postImageEl);
    } else {
      postCard.classList.add('no-image');
    }
    
    // 2b. Wrapper for text content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Middle section with title, excerpt, tags
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Title
    contentMiddle.appendChild(this.createPostTitle(post.title));
    
    // Excerpt
    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body, 200);
      // Make sure all links are completely removed from the excerpt
      excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
    }
    
    contentWrapper.appendChild(contentMiddle);
    
    // Actions (votes, comments, payout)
    contentWrapper.appendChild(this.createPostActions(post));
    
    // Add text content to main content
    mainContent.appendChild(contentWrapper);
    
    // Add main content to card
    postCard.appendChild(mainContent);
    
    // Click event - Navigate to post (ignore clicks on action buttons)
    postCard.addEventListener('click', (e) => {
      if (e.target.closest('.post-actions')) return;
      e.preventDefault();
      const postUrl = `/@${post.author}/${post.permlink}`;
      router.navigate(postUrl);
    });
    
    container.appendChild(postCard);
  }

  /**
   * Extract the best image from a post.
   * Priority:
   *   1. metadata.image[0] — set by author, always a clean raw URL
   *   2. SteemContentRenderer rendered HTML string — handles bare URLs, any host
   *   3. Regex scan of raw body — last resort
   */
  getBestImage(post, metadata) {
    // 1. metadata.image[] — most reliable
    if (metadata && metadata.image && metadata.image.length > 0) {
      const img = metadata.image[0];
      if (img && typeof img === 'string' && img.startsWith('http')) return img;
    }

    // 2. SteemContentRenderer rendered HTML string.
    //    imageProxyFn has already correctly resolved the URL.
    //    Read src from the *string* (not DOM) to avoid browser URL normalisation.
    if (this.contentRenderer && this.contentRenderer.steemRenderer) {
      try {
        const html = this.contentRenderer.steemRenderer.render(
          (post.body || '').substring(0, 3000)
        );
        const srcMatch = html.match(/src=["'](https?:\/\/[^"'\s]+)["']/i);
        if (srcMatch) return srcMatch[1];
      } catch (e) { /* ignore */ }
    }

    // 3. Regex scan of raw body (fallback when renderer isn't ready yet).
    if (post.body) {
      const mdMatch = post.body.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/);
      if (mdMatch) return mdMatch[1];

      const htmlMatch = post.body.match(/<img[^>]+src=["'](https?:\/\/[^"'\s]+)["']/i);
      if (htmlMatch) return htmlMatch[1];

      const extMatch = post.body.match(
        /https?:\/\/[^\s'"<>)]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s'"<>)]+)?/i
      );
      if (extMatch) return extMatch[0];
    }

    return null;
  }

  /**
   * Optimize an image URL for display
   */
  optimizeImageUrl(url, width = 640) {
    if (!url) return url;
    return proxifyImage(url, width);
  }

  /**
   * Sanitize an image URL
   */
  sanitizeImageUrl(url) {
    if (!url) return '';

    // Unwrap legacy proxy URLs: /{w}x{h}/https://inner-url (applied recursively so that
    // double-wrapped URLs like steemitimages.com/0x0/https://imgp.blurt.blog/768x0/https://...
    // are fully resolved to the real inner URL in one call).
    let unwrapped = url;
    let prev;
    do {
      prev = unwrapped;
      const m = unwrapped.match(/^https?:\/\/[^/]+\/\d+x\d+\/(https?:\/\/.+)$/i);
      if (m) unwrapped = m[1];
    } while (unwrapped !== prev);
    url = unwrapped;

    // Query params are preserved — they may be required (CDN signing, hmac, etc.).
    return url;
  }

  /**
   * Parse post metadata
   */
  parseMetadata(jsonMetadata) {
    try {
      if (typeof jsonMetadata === 'string') {
        return JSON.parse(jsonMetadata);
      }
      return jsonMetadata || {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Check if a tag represents a valid community
   * @param {string} tag - Tag to check
   * @returns {boolean} - true if it's a valid community
   */
  isValidCommunityTag(tag) {
    if (!tag || typeof tag !== 'string') return false;
    
    // Most Hive communities have format hive-NUMBER
    if (tag.startsWith('hive-')) {
      // Extract the part after "hive-"
      const communityId = tag.substring(5);
      
      // Valid communities generally have numeric ID
      return /^\d+$/.test(communityId);
    }
    
    return false;
  }

  /**
   * Extract community tag from post metadata
   * @param {Object} post - Post object
   * @returns {string|null} - Community tag or null if not found
   */
  getCommunityTag(post) {
    if (!post) return null;
    
    try {
      const metadata = this.parseMetadata(post.json_metadata);
      
      // 1. Check from the community property in metadata (most reliable)
      if (metadata && metadata.community) {
        // Verifica che community sia una stringa prima di usare startsWith
        const communityIsString = typeof metadata.community === 'string';
        
        const communityTag = communityIsString && metadata.community.startsWith('hive-') 
          ? metadata.community 
          : communityIsString ? `hive-${metadata.community}` : null;
          
        if (communityTag && this.isValidCommunityTag(communityTag)) {
          return communityTag;
        }
      }
      
      // 2. Check for community_title in metadata (indicates a community post)
      if (metadata && metadata.community_title) {
        // If we have community_title but no clear ID, try to extract from another source
        if (post.category && post.category.startsWith('hive-')) {
          return post.category;
        }
      }
      
      // 3. Check if category is a community (some posts use this)
      if (post.category && post.category.startsWith('hive-')) {
        if (this.isValidCommunityTag(post.category)) {
          return post.category;
        }
      }
      
      // 4. Check in parent_permlink as it sometimes contains the community
      if (post.parent_permlink && post.parent_permlink.startsWith('hive-')) {
        if (this.isValidCommunityTag(post.parent_permlink)) {
          return post.parent_permlink;
        }
      }
      
      // 5. As a fallback, look in the tags
      if (metadata && Array.isArray(metadata.tags)) {
        const communityTag = metadata.tags.find(tag => 
          tag && typeof tag === 'string' && this.isValidCommunityTag(tag)
        );
        
        if (communityTag) {
          return communityTag;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting community tag:', error);
      return null;
    }
  }

  /**
   * Create post header with author info
   */
  createPostHeader(post) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';
    
    const avatar = document.createElement('img');
    avatar.alt = post.author;
    avatar.className = 'avatar';
    avatar.loading = 'lazy';
    
    // Add retry mechanism for avatars too
    let retryCount = 0;
    
    const loadAvatar = () => {
      // Try multiple sources in sequence
      const avatarSources = [
        `https://steemitimages.com/u/${post.author}/avatar`,
      ];
      
      let currentSourceIndex = 0;
      
      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          // We've tried all sources, use default
          avatar.src = './assets/img/default-avatar.png';
          return;
        }
        
        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;
        
        avatar.onerror = () => {
          // Try next source after a short delay
          setTimeout(tryNextSource, 300);
        };
        
        // Add cache busting only for retries on same source
        if (retryCount > 0 && !currentSource.includes('default-avatar')) {
          avatar.src = `${currentSource}?retry=${Date.now()}`;
        } else {
          avatar.src = currentSource;
        }
      };
      
      // Start the loading process
      tryNextSource();
    };
    
    loadAvatar();
    
    avatarContainer.appendChild(avatar);
    
    const info = document.createElement('div');
    info.className = 'post-info';
    
    // Create top row with author and community
    const infoTopRow = document.createElement('div');
    infoTopRow.className = 'post-info-top-row';
    
    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${post.author}`;
    
    infoTopRow.appendChild(author);
    
    // Add community if available
    const communityTag = this.getCommunityTag(post);
    if (communityTag) {
      // Try to get community title from custom_json if available
      let communityTitle = '';
      let communityId = communityTag.replace('hive-', '');
      
      try {
        const metadata = this.parseMetadata(post.json_metadata);
        if (metadata && metadata.community_title) {
          communityTitle = metadata.community_title;
        }
      } catch (e) {
        console.log('Could not parse community title from metadata');
      }
      
      // Add separator
      const separator = document.createElement('span');
      separator.className = 'post-info-separator';
      separator.textContent = '•';
      infoTopRow.appendChild(separator);
      
      // Add community link
      const community = document.createElement('div');
      community.className = 'post-community';
      
      // Add icon
      const communityIcon = document.createElement('span');
      communityIcon.className = 'material-icons community-icon';
      communityIcon.textContent = 'group';
      communityIcon.style.fontSize = '14px';
      
      community.appendChild(communityIcon);
      
      // If we have a title, display it, otherwise just show the ID
      if (communityTitle) {
        community.appendChild(document.createTextNode(` ${communityTitle}`));
      } else {
        community.appendChild(document.createTextNode(` ${communityId}`));
        
        // Try to fetch the community name asynchronously
        this.fetchCommunityName(community, communityId);
      }
      
      // Add click handler to navigate to community
      community.addEventListener('click', (e) => {
        e.stopPropagation();
        router.navigate(`/community/${communityId}`);
      });
      
      infoTopRow.appendChild(community);
    }
    
    const date = document.createElement('div');
    date.className = 'post-date';
    const postDate = new Date(post.created);
    date.textContent = postDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
      // Calculate time elapsed since post creation in minutes
      // Calculate time elapsed since post creation in minutes, adjusting for timezone differences
      const timeElapsed = Math.floor((Date.now() - new Date(post.created + "Z").getTime()) / (1000 * 60));

      if (timeElapsed < 60) {
        date.textContent = timeElapsed <= 1 ? 'Just now' : `${timeElapsed} min ago`;
      } else if (timeElapsed < 24 * 60) {
        // Convert minutes to hours
        const hours = Math.floor(timeElapsed / 60);
        date.textContent = hours === 1 ? '1 hour ago' : `${hours} hours ago`;
      } else if (timeElapsed < 30 * 24 * 60) {
        // Convert minutes to days
        const days = Math.floor(timeElapsed / (24 * 60));
        date.textContent = days === 1 ? '1 day ago' : `${days} days ago`;
      } else if (timeElapsed < 365 * 24 * 60) {
        // Convert minutes to months
        const months = Math.floor(timeElapsed / (30 * 24 * 60));
        date.textContent = months === 1 ? '1 month ago' : `${months} months ago`;
      } else {
        // Use locale date for anything older than a year
        date.textContent = postDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }

    info.appendChild(infoTopRow);
    info.appendChild(date);
    header.append(avatarContainer, info);
    
    return header;
  }

  /**
   * Fetch and update community name asynchronously
   * @param {HTMLElement} communityElement - The element to update with the community name
   * @param {string} communityId - The community ID
   */
  fetchCommunityName(communityElement, communityId) {
    // Use a cached value if we have it
    if (!this._communityCache) {
      this._communityCache = {};
    }
    
    if (this._communityCache[communityId]) {
      communityElement.childNodes[1].textContent = ` ${this._communityCache[communityId]}`;
      return;
    }
    
    // Otherwise fetch from the API
    communityService.findCommunityByName(`hive-${communityId}`)
      .then(communityData => {
        if (communityData && communityData.title) {
          // Cache the result
          this._communityCache[communityId] = communityData.title;
          
          // Update the element with the title
          if (communityElement && communityElement.childNodes && communityElement.childNodes[1]) {
            communityElement.childNodes[1].textContent = ` ${communityData.title}`;
          }
        }
      })
      .catch(err => {
        console.error(`Could not fetch community info for ${communityId}`, err);
      });
  }

  /**
   * Create post image container
   */
  createPostImage(imageUrl, title) {
    // Return null when there is no image — callers must check to avoid empty space
    if (!imageUrl) return null;

    const content = document.createElement('div');
    content.className = 'post-image-container';
    content.classList.add('loading');

    const image = document.createElement('img');
    image.alt = title || 'Post image';
    image.loading = 'lazy';
    image.decoding = 'async';

    // Enforce a clean URL before we start
    imageUrl = this.sanitizeImageUrl(imageUrl);

    // If the URL is already a steemitimages /p/ proxy, use it as-is — there is no
    // meaningful fallback (proxying a proxy just creates a broken double-wrap).
    // For all other URLs: try direct first, then steemitimages proxy as fallback.
    const attempts = imageUrl.includes('steemitimages.com/p/')
      ? [() => imageUrl]
      : [
          () => getImageUrl(imageUrl, 640),
          () => proxifyImage(imageUrl, 640),
        ];
    let attemptIndex = 0;
    let failed = false;

    const tryNext = () => {
      if (failed) return;
      if (attemptIndex >= attempts.length) {
        showError();
        return;
      }
      const url = attempts[attemptIndex++]();
      loadImage(url);
    };

    const loadImage = (url) => {
      if (failed) return;
      image.onload = () => {
        content.classList.remove('loading', 'error');
        content.classList.add('loaded');
      };
      image.onerror = () => tryNext();
      image.src = url;
    };

    const showError = () => {
      if (failed) return;
      failed = true;
      // Image URL existed but failed to load — show placeholder inside the container
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
    };

    tryNext();

    content.appendChild(image);
    return content;
  }

  /**
   * Get current card size AND layout setting from container classes
   */
  getCardConfig() {
    if (!this.container) return { size: 'medium', layout: 'grid' };
    
    const postsContainer = this.container.querySelector('.posts-container');
    if (!postsContainer) return { size: 'medium', layout: 'grid' };
    
    // We only care about layout now, but keep size for backward compatibility
    let size = 'medium';
    
    // Determine layout type
    let layout = 'grid';
    if (postsContainer.classList.contains('grid-layout-list')) layout = 'list';
    if (postsContainer.classList.contains('grid-layout-compact')) layout = 'compact';
    
    return { size, layout };
  }

  /**
   * Get appropriate image sizes based only on layout
   */
  getImageSizesToTry(layout) {
    // Order: direct/smart-url first, then proxy fallbacks at decreasing sizes.
    // proxifyImage is used as fallback for hotlink-protected or mixed-content URLs.
    switch(layout) {
      case 'list':
        return [
          {direct: true},
          {size: 800},
          {size: 640},
        ];
      case 'compact':
        return [
          {direct: true},
          {size: 320},
        ];
      case 'grid':
      default:
        return [
          {direct: true},
          {size: 640},
          {size: 400},
        ];
    }
  }

  /**
   * Create post title element
   */
  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title;
    return element;
  }
  
  /**
   * Create post tags container
   */
  createPostTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';
    
    // Show max 2 tags to avoid crowding the UI
    const displayTags = tags.slice(0, 2);
    
    displayTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'post-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
    
    return tagsContainer;
  }

  /**
   * Get vote count from post
   */
  getVoteCount(post) {
    // Try different properties that might contain vote count
    if (typeof post.net_votes === 'number') {
      return post.net_votes;
    }
    if (typeof post.active_votes === 'object' && Array.isArray(post.active_votes)) {
      return post.active_votes.length;
    }
    if (typeof post.vote_count === 'number') {
      return post.vote_count;
    }
    // Default to 0 if no valid vote count is found
    return 0;
  }
  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }
  /**
   * Create post actions bar
   */
  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    // Vote: icon votes, count opens VotesPopup
    const voteWrapper = this.createCardVoteAction(post);

    // Comments action (non interactive, just shows count)
    const commentAction = this.createActionItem('chat', post.children || 0);
    commentAction.classList.add('comment-action');

    // Reblog button
    const reblogBtn = this.createCardReblogButton(post);

    // Payout: right-aligned, green, clickable popup
    const payoutAction = document.createElement('div');
    payoutAction.className = 'action-item card-payout-info';
    payoutAction.textContent = `$${parseFloat(this.getPendingPayout(post)).toFixed(2)}`;
    payoutAction.addEventListener('click', () => new PayoutInfoPopup(post).show());

    actions.append(voteWrapper, commentAction, reblogBtn, payoutAction);

    return actions;
  }

  /**
   * Reblog button for post cards, with confirmation dialog
   */
  createCardReblogButton(post) {
    const btn = document.createElement('div');
    btn.className = 'action-item card-reblog-btn';

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'repeat';
    btn.appendChild(icon);

    // Check if already reblogged on load
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      reblogService.hasReblogged(currentUser.username, post.author, post.permlink)
        .then(has => {
          if (has) {
            btn.classList.add('reblogged');
            btn.style.pointerEvents = 'none';
          }
        })
        .catch(() => {});
    }

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (!currentUser) {
        eventEmitter.emit('notification', { type: 'info', message: 'You must be logged in to reblog' });
        router.navigate('/login');
        return;
      }

      const confirmed = await DialogUtility.showConfirmationDialog({
        message: `Reblog this post to your blog?`,
        confirmText: 'Reblog',
        cancelText: 'Cancel',
        icon: 'repeat',
        type: 'info'
      });

      if (!confirmed) return;

      try {
        btn.style.pointerEvents = 'none';
        icon.textContent = 'settings';
        icon.classList.add('reblog-spinning');

        await reblogService.reblogPost(post.author, post.permlink);

        icon.classList.remove('reblog-spinning');
        icon.textContent = 'repeat';
        btn.classList.add('reblogged');
      } catch (err) {
        icon.classList.remove('reblog-spinning');
        icon.textContent = 'repeat';
        btn.style.pointerEvents = '';
        eventEmitter.emit('notification', { type: 'error', message: err.message || 'Failed to reblog' });
      }
    });

    return btn;
  }

  /**
   * Vote action for post cards: thumb icon votes, count number opens VotesPopup
   */
  createCardVoteAction(post) {
    // Outer container — holds icon-wrapper + count as siblings (no shared click handler)
    const container = document.createElement('div');
    container.className = 'card-vote-container';

    // Icon wrapper — this is what handleVoteAction uses for state (voted class, innerHTML, etc.)
    const wrapper = document.createElement('div');
    wrapper.className = 'action-item card-vote-wrapper vote-action';
    wrapper.dataset.author = post.author;
    wrapper.dataset.permlink = post.permlink;

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'thumb_up';
    wrapper.appendChild(icon);

    // Count button — sibling of wrapper, completely independent click target
    const countBtn = document.createElement('span');
    countBtn.className = 'card-vote-count';
    countBtn.textContent = this.getVoteCount(post);
    countBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new VotesPopup(post).show();
    });

    container.appendChild(wrapper);
    container.appendChild(countBtn);

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      wrapper.classList.add('interactive');
      this.checkVoteStatus(post, wrapper);
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleVoteAction(post, wrapper);
      });
    } else {
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        eventEmitter.emit('notification', { type: 'info', message: 'You must be logged in to vote' });
      });
    }

    return container;
  }

  /**
   * Create interactive vote action
   */
  createVoteActionItem(post) {
    const voteCount = this.getVoteCount(post);
    const actionItem = document.createElement('div');
    actionItem.className = 'action-item vote-action';
    actionItem.dataset.author = post.author;
    actionItem.dataset.permlink = post.permlink;
    
    // Add vote icon
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'thumb_up';
    
    // Add vote count as text node
    const countSpan = document.createElement('span');
    countSpan.className = 'vote-count';
    countSpan.textContent = ` ${voteCount}`;
    
    actionItem.appendChild(icon);
    actionItem.appendChild(countSpan);
    
    // Check if user is logged in to enable voting
    const currentUser = authService.getCurrentUser();
    
    if (currentUser) {
      // Make it look clickable
      actionItem.classList.add('interactive');
      
      // Check vote status of this post asynchronously
      this.checkVoteStatus(post, actionItem);
      
      // Add click handler that stops propagation to prevent 
      // navigating to the post when clicking the vote button
      actionItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleVoteAction(post, actionItem);
      });
    }
    
    return actionItem;
  }
  
  /**
   * Check if current user has voted on this post
   */
  async checkVoteStatus(post, voteActionElement) {
    try {
      // Check if post is already flagged as having been checked
      if (voteActionElement.dataset.voteChecked === 'true') {
        return;
      }
      
      const userVote = await voteService.hasVoted(post.author, post.permlink);
      
      if (userVote) {
        // User has voted, update UI
        voteActionElement.classList.add('voted');
        voteActionElement.dataset.percent = userVote.percent;
      }
      
      // Mark as checked to avoid repeated API calls
      voteActionElement.dataset.voteChecked = 'true';
    } catch (error) {
      console.error('Error checking vote status:', error);
    }
  }
  
  /**
   * Handle vote button click
   */
  async handleVoteAction(post, voteActionElement) {
    // Early return if no user logged in or element is disabled
    if (!authService.getCurrentUser() || voteActionElement.classList.contains('disabled')) {
      return;
    }
    
    // Get current vote state
    const isVoted = voteActionElement.classList.contains('voted');
    
    // If already voted, show notification
    if (isVoted) {
      const percent = parseInt(voteActionElement.dataset.percent || 0);
      this.voteController.showAlreadyVotedNotification(percent);
      return;
    }
    
    // Check if vote service is available
    if (!voteService) {
      console.error('Vote service not available');
      return;
    }
    
    // Get the current count from the sibling count element (card-vote-count is outside wrapper)
    const countSpan = voteActionElement.parentElement?.querySelector('.card-vote-count')
      || voteActionElement.querySelector('.vote-count');
    const currentCount = countSpan ? parseInt(countSpan.textContent) || 0 : 0;
    
    // Use vote controller to show percentage selector popup
    this.voteController.showVotePercentagePopup(voteActionElement, async (weight) => {
      try {
        // Disable button and show voting state
        voteActionElement.classList.add('disabled', 'voting');
        
        // Original HTML to restore if needed
        const originalHTML = voteActionElement.innerHTML;
        voteActionElement.innerHTML = `<span class="material-icons loading">refresh</span>`;
        
        // Validate weight
        if (weight === 0) {
          throw new Error('Vote weight cannot be zero');
        }
        
        // Submit vote
        await voteService.vote({
          author: post.author,
          permlink: post.permlink,
          weight: weight
        });
        
        // Update UI with vote success state
        voteActionElement.classList.remove('voting', 'disabled');
        voteActionElement.classList.add('voted');
        voteActionElement.innerHTML = '';

        // Restore icon
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = 'thumb_up_alt';
        voteActionElement.appendChild(iconElement);

        // Update the sibling count element (card-vote-count) or inner vote-count
        const countEl = voteActionElement.parentElement?.querySelector('.card-vote-count')
          || voteActionElement.querySelector('.vote-count');
        if (countEl) {
          countEl.textContent = currentCount + 1;
        }
        
        // Store the vote percentage in the dataset
        voteActionElement.dataset.percent = weight;
        
        // Add success animation
        this.voteController.addSuccessAnimation(voteActionElement);
        
        // Show success notification
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Your ${weight / 100}% vote was recorded successfully!`
        });
        
      } catch (error) {
        // Reset UI
        voteActionElement.classList.remove('voting', 'disabled');
        
        // Handle errors
        if (error.isCancelled) {
          console.error('Vote was cancelled by user');
        } else if (error.isAuthError) {
          console.error('Authentication error:', error.message);
          
          // Extract error reason
          let reason = 'Your login session has expired';
          
          if (error.message.includes('Posting key not available')) {
            reason = 'Your posting key is not available';
          } else if (error.message.includes('keychain')) {
            reason = 'There was an issue with Steem Keychain';
          } else if (error.message.includes('authority')) {
            reason = 'You don\'t have the required permissions';
          }
          
          // Show auth error notification
          eventEmitter.emit('notification', {
            type: 'error',
            message: `Authentication failed: ${reason}. Please log in again to vote.`,
            duration: 5000,
            action: {
              text: 'Login',
              callback: () => {
                router.navigate('/login', { 
                  returnUrl: window.location.pathname + window.location.search,
                  authError: true,
                  errorReason: reason
                });
              }
            }
          });
        } else {
          console.error('Failed to vote:', error);
          eventEmitter.emit('notification', {
            type: 'error',
            message: error.message || 'Failed to vote. Please try again.'
          });
        }
      }
    });
  }

  /**
   * Create an action item for the post actions bar
   */
  createActionItem(iconName, text) {
    const actionItem = document.createElement('div');
    actionItem.className = 'action-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;
    
    actionItem.appendChild(icon);
    actionItem.append(document.createTextNode(` ${text}`));
    
    return actionItem;
  }

  /**
   * Create excerpt from post body
   */
  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Remove markdown and html more effectively
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // remove markdown links keeping the text
        .replace(/<a.*?href=["'](.+?)["'].*?>(.+?)<\/a>/gi, '$2') // remove HTML links keeping text
        .replace(/https?:\/\/\S+/g, '') // remove all URLs
        .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
        .replace(/#{1,6}\s/g, '') // remove headings (1-6 hashes)
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // convert bold to normal text
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // convert italic to normal text
        .replace(/~~(.*?)~~/g, '$1') // convert strikethrough to normal text
        .replace(/>\s*(.*?)(\n|$)/g, '') // remove blockquotes
        .replace(/```[\s\S]*?```/g, '') // remove code blocks with triple backticks
        .replace(/`[^`]*`/g, '') // remove inline code with single backticks
        .replace(/~~~[\s\S]*?~~~/g, '') // remove code blocks with triple tildes
        .replace(/\n\n/g, ' ') // replace double newlines with space
        .replace(/\n/g, ' ') // replace single newlines with space
        .replace(/\s+/g, ' ') // replace multiple spaces with a single space
        .trim();
    
    // Truncate and add ellipsis if necessary
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }

  /**
   * Create the tag selection bar
   */
  createTagSelectionBar() {
    const tagBarContainer = document.createElement('div');
    tagBarContainer.className = 'tag-selection-bar';
    
    // Create scrollable tag list container
    const tagListContainer = document.createElement('div');
    tagListContainer.className = 'tag-list-container';
    
    // Create the actual scrollable list
    const tagList = document.createElement('div');
    tagList.className = 'tag-list';
    
    // Add popular tags to the scrollable list
    this.popularTags.forEach(tag => {
      const tagItem = this.createTagItem(tag);
      tagList.appendChild(tagItem);
    });
    
    // Add the list to the container
    tagListContainer.appendChild(tagList);
    
    // Add tag list to the main container
    tagBarContainer.appendChild(tagListContainer);
    
    // Scroll active tag into view (horizontal only — scrollIntoView would also
    // vertically scroll #main-content, undoing back-nav scroll restore)
    setTimeout(() => {
      const activeTag = tagList.querySelector('.tag-item.active');
      if (activeTag) {
        const itemOffset = activeTag.offsetLeft;
        const itemWidth = activeTag.offsetWidth;
        const containerWidth = tagList.offsetWidth;
        tagList.scrollLeft = itemOffset - (containerWidth / 2) + (itemWidth / 2);
      }
    }, 100);
    
    return tagBarContainer;
  }
  
  /**
   * Creates a tag item for the scrollable list
   */
  createTagItem(tag) {
    const item = document.createElement('div');
    item.className = 'tag-item';
    
    // Highlight the active tag
    if (tag === this.getCurrentTag()) {
      item.classList.add('active');
    }
    
    item.textContent = this.formatTagName(tag);
    
    // Add click handler to navigate to tag
    item.addEventListener('click', () => {
      this.navigateToTag(tag);
    });
    
    return item;
  }

  /**
   * Get the current tag (to be implemented by subclasses)
   */
  getCurrentTag() {
    throw new Error('getCurrentTag method must be implemented by subclass');
  }
  
  /**
   * Navigate to a specific tag
   */
  navigateToTag(tag) {
    if (!tag) return;
    
    // Ensure the tag is properly formatted - lowercase and trimmed
    const formattedTag = tag.trim().toLowerCase();
    
    if (formattedTag === 'trending' || formattedTag === 'hot' || 
        formattedTag === 'new' || formattedTag === 'promoted') {
      router.navigate(`/${formattedTag}`);
    } else {
      router.navigate(`/tag/${formattedTag}`);
    }
  }
  
  /**
   * Format tag name for display (capitalize first letter)
   */
  formatTagName(tag) {
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  /**
   * Render method to be implemented by child classes
   */
  render(container) {
    throw new Error('render method must be implemented by subclass');
  }

  /**
   * Base render implementation that can be called by subclasses
   */
  renderBaseView(container, title) {
    this.container = container;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Create header area with title and grid controls
    const headerArea = document.createElement('div');
    headerArea.className = 'header-area';
    
    // Create heading
    const heading = document.createElement('h1');
    heading.textContent = title;
    headerArea.appendChild(heading);
    
    // Create grid controller container
    const gridControllerContainer = document.createElement('div');
    gridControllerContainer.className = 'grid-controller-container';
    headerArea.appendChild(gridControllerContainer);
    
    contentWrapper.appendChild(headerArea);
    
    // Create tag selection bar
    const tagSelectionBar = this.createTagSelectionBar();
    contentWrapper.appendChild(tagSelectionBar);

    // Create posts container
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';

    // Add to content wrapper
    contentWrapper.appendChild(postsContainer);

    // Add to container
    container.appendChild(contentWrapper);
    
    // Initialize grid controller
    this.gridController.render(gridControllerContainer);
    
    // Show loading indicator while posts are loading
    this.loadingIndicator.show(postsContainer);
    
    return { postsContainer };
  }

  /**
   * Returns the cache key for this view's state (path + tag)
   */
  _viewCacheKey() {
    return (router.currentPath || '/') + '__' + (this.tag || '');
  }

  /**
   * Save current posts + page to router cache (called before navigation)
   */
  saveState() {
    if (!this.posts || this.posts.length === 0) return;
    router.viewStateCache.set(this._viewCacheKey(), {
      posts: this.posts,
      renderedPostIds: Array.from(this.renderedPostIds),
      currentPage: this.infiniteScroll ? this.infiniteScroll.currentPage : 1
    });
  }

  /**
   * Retrieve cached state for this view (used on back navigation)
   */
  restoreState() {
    return router.viewStateCache.get(this._viewCacheKey()) || null;
  }

  /**
   * Unmount view and clean up resources
   */
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.gridController) {
      this.gridController.unmount();
    }
  }
}

export default BasePostView;
