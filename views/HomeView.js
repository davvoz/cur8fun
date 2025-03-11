import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import GridController from '../components/GridController.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import ImageUtils from '../utils/process-body/ImageUtils.js';
import router from '../utils/Router.js';

class HomeView {
  constructor(params) {
    this.params = params || {};
    this.tag = this.params.tag || 'trending';
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    this.gridController = new GridController({
      targetSelector: '.posts-container'
    });
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
    
    // 1. Add header (author info) - Sempre in cima
    postCard.appendChild(this.createPostHeader(post));
    
    // 2. Contenuto principale - può essere verticale o orizzontale a seconda del layout
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';
    
    // 2a. Add image preview
    mainContent.appendChild(this.createPostImage(imageUrl, post.title));
    
    // 2b. Wrapper per contenuti testuali
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Sezione centrale con titolo, excerpt, tag
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Titolo
    contentMiddle.appendChild(this.createPostTitle(post.title));
    
    // Excerpt per layout lista
    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body);
      excerpt.textContent = textExcerpt;
      contentMiddle.appendChild(excerpt);
    }
    
    // Tags
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }
    
    contentWrapper.appendChild(contentMiddle);
    
    // Azioni (votes, comments, payout)
    contentWrapper.appendChild(this.createPostActions(post));
    
    // Aggiunge contenuti testuali al main content
    mainContent.appendChild(contentWrapper);
    
    // Aggiunge il main content alla card
    postCard.appendChild(mainContent);
    
    // Evento click - Fix: Use router.navigate instead of direct window.location
    postCard.addEventListener('click', (e) => {
      e.preventDefault();
      const postUrl = `/@${post.author}/${post.permlink}`;
      router.navigate(postUrl);
    });
    
    container.appendChild(postCard);
  }

  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Rimuovi i markdown e html in modo più efficace
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '') // rimuovi immagini markdown
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // rimuovi link markdown tenendo il testo
        .replace(/<\/?[^>]+(>|$)/g, '') // rimuovi tag html
        .replace(/#{1,6}\s/g, '') // rimuovi headings (1-6 hashes)
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // converte bold in testo normale
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // converte italic in testo normale
        .replace(/~~(.*?)~~/g, '$1') // converte strikethrough in testo normale
        .replace(/```[\s\S]*?```/g, '') // rimuovi blocchi di codice
        .replace(/\n\n/g, ' ') // sostituisci doppi newline con spazio
        .replace(/\n/g, ' ') // sostituisci singoli newline con spazio
        .trim();
    
    // Tronca e aggiungi ellipsis se necessario
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }

  getBestImage(post, metadata) {
    // First try the simpler extractImageFromContent method which gets the first image
    const directImageUrl = ImageUtils.extractImageFromContent(post);
    
    if (directImageUrl) {
      return directImageUrl;
    }
    
    // Fall back to the more comprehensive getBestImageUrl if direct extraction failed
    const fallbackImageUrl = ImageUtils.getBestImageUrl(post.body, metadata);
    
    if (fallbackImageUrl) {
      return fallbackImageUrl;
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
    
    // Determine current card size AND layout from container classes
    const { size: cardSize, layout } = this.getCardConfig();
    
    // Use different image sizes based on card size setting AND layout
    const sizesToTry = this.getImageSizesToTry(cardSize, layout);
    console.log(`Loading image with card size: ${cardSize}, layout: ${layout}`);
    
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

  // Get current card size AND layout setting from container classes
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

  // Get appropriate image sizes based only on layout
  getImageSizesToTry(cardSize, layout) {
    // Simplify image sizes based only on layout type
    switch(layout) {
      case 'list':
        return [
          {size: 800, cdn: 'steemitimages.com'}, // Higher quality for list layout
          {size: 640, cdn: 'steemitimages.com'}, // Medium-high quality
          {size: 400, cdn: 'steemitimages.com'}, // Medium quality fallback
          {direct: true} // Direct URL as last resort
        ];
      case 'compact':
        return [
          {size: 320, cdn: 'steemitimages.com'}, // Smaller size for compact layout
          {size: 200, cdn: 'steemitimages.com'}, // Even smaller fallback
          {direct: true} // Direct URL as last resort
        ];
      case 'grid':
      default:
        return [
          {size: 640, cdn: 'steemitimages.com'}, // Standard quality for grid
          {size: 400, cdn: 'steemitimages.com'}, // Medium quality
          {size: 200, cdn: 'steemitimages.com'}, // Lower quality as fallback
          {direct: true} // Direct URL as last resort
        ];
    }
  }

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

  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const voteCount = this.getVoteCount(post);
    const voteAction = this.createActionItem('thumb_up', voteCount);
    voteAction.classList.add('vote-action');
    
    const commentAction = this.createActionItem('chat', post.children || 0);
    commentAction.classList.add('comment-action');
    
    const payoutAction = this.createActionItem('attach_money', parseFloat(post.pending_payout_value || 0).toFixed(2));
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

    // Create header area with title and grid controls
    const headerArea = document.createElement('div');
    headerArea.className = 'header-area';
    
    // Create heading
    const heading = document.createElement('h1');
    heading.textContent = this.tag.charAt(0).toUpperCase() + this.tag.slice(1) + ' Posts';
    headerArea.appendChild(heading);
    
    // Create grid controller container
    const gridControllerContainer = document.createElement('div');
    gridControllerContainer.className = 'grid-controller-container';
    headerArea.appendChild(gridControllerContainer);
    
    contentWrapper.appendChild(headerArea);

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
    
    if (this.gridController) {
      this.gridController.unmount();
    }
  }
}

export default HomeView;