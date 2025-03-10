import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import ImageUtils from '../utils/ImageUtils.js';

class HomeView {
  constructor(params) {
    this.params = params || {};
    this.tag = this.params.tag || 'trending';
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    // Track post IDs to prevent duplicates
    this.renderedPostIds = new Set();
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
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
        } else {
          console.log('No new unique posts in this batch.');
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
    console.log(`Fetching ${this.tag} posts, page ${page}`);
    const postFetchers = {
      'trending': () => steemService.getTrendingPosts(page),
      'hot': () => steemService.getHotPosts(page),
      'created': () => steemService.getNewPosts(page),
      'promoted': () => steemService.getPromotedPosts(page)
    };
    
    const fetchMethod = postFetchers[this.tag] || (() => steemService.getTrendingPosts(page));
    return await fetchMethod();
  }
  
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
    
    console.log(`Rendering ${postsToRender.length} posts (append: ${append})`);
    
    // Filter out any duplicates that might have slipped through
    const uniquePostsToRender = postsToRender.filter(post => {
      const postId = `${post.author}_${post.permlink}`;
      if (this.renderedPostIds.has(postId)) {
        return false;
      }
      this.renderedPostIds.add(postId);
      return true;
    });

    console.log(`Rendering ${uniquePostsToRender.length} unique posts`);
    
    // Render each post
    uniquePostsToRender.forEach(post => this.renderPostCard(post, postsContainer));
  }

  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  renderPostCard(post, container) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    
    // Parse metadata to extract better images and tags
    const metadata = this.parseMetadata(post.json_metadata);
    
    // Get the best available image
    const imageUrl = this.getBestImage(post, metadata);
    
    // Add header (author info)
    postCard.appendChild(this.createPostHeader(post));
    
    // Add image preview
    postCard.appendChild(this.createPostImage(imageUrl, post.title));
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Add title
    contentWrapper.appendChild(this.createPostTitle(post.title));
    
    // Removed post body/excerpt to improve performance
    
    // Add only essential tags if available (limit to 2)
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentWrapper.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }
    
    // Add post stats (votes, comments, payout)
    contentWrapper.appendChild(this.createPostActions(post));
    
    postCard.appendChild(contentWrapper);
    
    postCard.addEventListener('click', () => {
      window.location.href = `/@${post.author}/${post.permlink}`;
    });
    
    container.appendChild(postCard);
  }

  getBestImage(post, metadata) {
    // Get the best image using our enhanced utility class
    const imageUrl = ImageUtils.getBestImageUrl(post.body, metadata);
    
    if (imageUrl) {
      // No need to optimize here - we'll do it in createPostImage
      return imageUrl;
    }
    
    // If no image is found, return a placeholder
    return ImageUtils.getDataUrlPlaceholder();
  }

  optimizeImageUrl(url) {
    // Use higher quality image sizes for cards
    return ImageUtils.optimizeImageUrl(url, {
      width: 640,   // Larger size for better quality
      height: 0,    // Auto height
      quality: 95   // Higher quality for sharper images
    });
  }

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
    const MAX_RETRIES = 1;
    
    const loadAvatar = () => {
      // Try multiple sources in sequence
      const avatarSources = [
        // Default Steem avatar with small size for performance
        `https://steemitimages.com/50x50/u/${post.author}/avatar`,
        // Direct format without size restriction as fallback
        `https://steemitimages.com/u/${post.author}/avatar`,
        // Final fallback to local default avatar
        '/assets/images/default-avatar.png',
        //every type of avatar
        `https://steemitimages.com/u/${post.author}/avatar`,
        `https://images.hive.blog/u/${post.author}/avatar`,
        `https://images.ecency.com/u/${post.author}/avatar`,
      ];
      
      let currentSourceIndex = 0;
      
      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          // We've tried all sources, use default
          avatar.src = '/assets/images/default-avatar.png';
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
    
    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${post.author}`;
    
    const date = document.createElement('div');
    date.className = 'post-date';
    const postDate = new Date(post.created);
    date.textContent = postDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    info.append(author, date);
    header.append(avatarContainer, info);
    
    return header;
  }

  createPostImage(imageUrl, title) {
    const content = document.createElement('div');
    content.className = 'post-image-container';
    content.classList.add('loading');
    
    const image = document.createElement('img');
    image.alt = title || 'Post image';
    image.loading = 'lazy';
    image.decoding = 'async';
    
    // Enforce a clean URL before we start
    imageUrl = ImageUtils.sanitizeUrl(imageUrl);
    
    // Use higher quality images first, then fall back to smaller sizes
    const sizesToTry = [
      {size: 640, cdn: 'steemitimages.com'}, // Higher quality first
      {size: 400, cdn: 'steemitimages.com'}, // Medium quality
      {size: 200, cdn: 'steemitimages.com'}, // Lower quality as fallback
      {direct: true} // Direct URL as last resort
    ];
    
    let currentSizeIndex = 0;
    let isLoadingPlaceholder = false;
    let lastError = null;
    
    const loadNextSize = () => {
      if (currentSizeIndex >= sizesToTry.length) {
        loadPlaceholder();
        return;
      }
      
      const sizeOption = sizesToTry[currentSizeIndex++];
      let url;
      
      if (sizeOption.direct) {
        // Try direct URL with no proxy
        url = imageUrl;
      } else {
        // Use the specified CDN and size
        url = `https://${sizeOption.cdn}/${sizeOption.size}x0/${imageUrl}`;
      }
      
      loadImage(url);
    };
    
    const loadImage = (url) => {
      // Don't load the image if we're already loading the placeholder
      if (isLoadingPlaceholder || url.startsWith('data:')) {
        image.src = url;
        content.classList.remove('loading');
        return;
      }
      
      const timeoutId = setTimeout(() => {
        // Cancel load after timeout
        if (!image.complete) {
          console.log(`Image load timeout: ${url.substring(0, 50)}...`);
          tryNextOption("Timeout");
        }
      }, 5000);
      
      image.onload = () => {
        clearTimeout(timeoutId);
        content.classList.remove('loading', 'error');
        content.classList.add('loaded');
      };
      
      image.onerror = (event) => {
        clearTimeout(timeoutId);
        console.log(`Image load error: ${url.substring(0, 50)}...`);
        
        // Try next size option
        tryNextOption("Failed to load");
      };
      
      // Start loading
      image.src = url;
    };
    
    const tryNextOption = (errorReason) => {
      lastError = errorReason;
      loadNextSize();
    };
    
    const loadPlaceholder = () => {
      isLoadingPlaceholder = true;
      content.classList.remove('loading');
      content.classList.add('error');
      
      // Create error message
      const errorDisplay = document.createElement('div');
      errorDisplay.className = 'error-message';
      errorDisplay.textContent = 'Image not available';
      
      // Mark this URL as permanently failed to avoid future attempts
      ImageUtils.markImageAsFailed(imageUrl);
      
      // Use data URL placeholder
      image.src = ImageUtils.getDataUrlPlaceholder();
      
      // Add error info to container
      content.appendChild(errorDisplay);
    };
    
    // Start loading with first size option
    loadNextSize();
    
    content.appendChild(image);
    return content;
  }

  /**
   * Sanitizes image URLs to prevent common formatting issues
   * @param {string} url - The URL to sanitize
   * @returns {string} - Sanitized URL
   */
  sanitizeImageUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    
    try {
      // Fix double slashes (except after protocol)
      url = url.replace(/:\/\/+/g, '://').replace(/([^:])\/+/g, '$1/');
      
      // Fix missing protocol
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      
      return url;
    } catch (e) {
      console.error('Error sanitizing URL:', e);
      return url;
    }
  }

  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title;
    return element;
  }
  
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

  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const voteAction = this.createActionItem('thumb_up', post.net_votes);
    voteAction.classList.add('vote-action');
    
    const commentAction = this.createActionItem('chat', post.children);
    commentAction.classList.add('comment-action');
    
    const payoutAction = this.createActionItem('attach_money', parseFloat(post.pending_payout_value).toFixed(2));
    payoutAction.classList.add('payout-action');
    
    actions.append(voteAction, commentAction, payoutAction);
    
    return actions;
  }

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

  render(container) {
    this.container = container;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Create heading
    const heading = document.createElement('h1');
    heading.textContent = this.tag.charAt(0).toUpperCase() + this.tag.slice(1) + ' Posts';

    // Create posts container
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';

    // Build the structure
    contentWrapper.appendChild(heading);
    contentWrapper.appendChild(postsContainer);

    // Add to container
    container.appendChild(contentWrapper);
    
    // Show loading indicator while posts are loading
    this.loadingIndicator.show(postsContainer);
    
    // Load first page of posts
    this.loadPosts(1).then(() => {
      // Initialize infinite scroll after first page loads
      if (postsContainer) {
        console.log('Initializing infinite scroll');
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px'
        });
      }
    });
  }

  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }
}

// Initialize static properties
HomeView.imageRegexPatterns = {
  // HTML patterns
  htmlImage: /<img[^>]+src="([^">]+)"/i,
  htmlImageSingleQuote: /<img[^>]+src='([^']+)'/i,
  
  // Markdown patterns
  markdownImage: /!\[(.*?)\]\((.*?)\)/i,
  
  // Naked URLs with image extensions
  nakedImageUrl: /(https?:\/\/\S+\.(jpe?g|png|gif|webp|bmp|svg))/i,
  
  // Platform-specific patterns
  steemitImage: /(https?:\/\/(?:steemitimages\.com|steemd\.com)\/[^"'\s)]+)/i,
  hiveImage: /(https?:\/\/images\.hive\.blog\/[^"'\s)]+)/i,
  ipfsImage: /(https?:\/\/(?:\w+\.)?ipfs\.[^"'\s)]+\/ipfs\/\w+)/i,
  imgurImage: /(https?:\/\/(?:i\.)?imgur\.com\/[^"'\s)]+)/i,
  
  // BBCode pattern
  bbCodeImage: /\[img\](.*?)\[\/img\]/i,
  
  // Complex nested patterns
  markdownWithHtml: /!\[.*?\]\(<img[^>]+src="([^">]+)"[^>]*>\)/i,
  
  // Steemit/Hive specific patterns
  steemitMarkdown: /<center>!\[.*?\]\((.*?)\)<\/center>/i
};

export default HomeView;
