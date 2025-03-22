import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import GridController from '../components/GridController.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import ContentRenderer from '../components/ContentRenderer.js'; // Replace imageService with ContentRenderer
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
    
    // Initialize SteemContentRenderer for image extraction
    this.initSteemRenderer();
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
    // If we have SteemContentRenderer available, use it for rendering a snippet and extracting image
    if (this.contentRenderer) {
      try {
        // Render a small portion of the content to extract images
        const renderedContent = this.contentRenderer.render({
          body: post.body.substring(0, 1500) // Only render the first part for performance
        });
        
        // Check if any images were extracted
        if (renderedContent.images && renderedContent.images.length > 0) {
          // Return the first image URL
          return renderedContent.images[0].src;
        }
      } catch (error) {
        console.error('Error using SteemContentRenderer for image extraction:', error);
        // Fall back to old methods if SteemContentRenderer fails
      }
    }
    
    // Fallback method 1: Check if metadata contains an image
    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }
    
    // Fallback method 2: Simple regex extraction of first image
    const imgRegex = /https?:\/\/[^\s'"<>]+?\.(jpg|jpeg|png|gif|webp)(\?[^\s'"<>]+)?/i;
    const match = post.body.match(imgRegex);
    if (match) {
      return match[0];
    }
    
    // Return placeholder if no image is found
    return './assets/images/placeholder.png';
  }

  optimizeImageUrl(url) {
    // Use SteemContentRenderer's proxy if available
    if (this.contentRenderer && this.contentRenderer.steemRenderer) {
      try {
        // Format URL for proper sizing with Steem's proxy
        return `https://steemitimages.com/640x0/${url}`;
      } catch (error) {
        console.error('Error using SteemContentRenderer for image optimization:', error);
      }
    }
    
    // Fallback to direct URL with proper formatting
    if (url && url.startsWith('http')) {
      // Simple proxy URL construction
      return `https://steemitimages.com/640x0/${url}`;
    }
    
    return url;
  }

  sanitizeImageUrl(url) {
    if (!url) return '';
    
    // Remove query parameters and fragments
    let cleanUrl = url.split('?')[0].split('#')[0];
    
    // Ensure URL is properly encoded
    try {
      cleanUrl = new URL(cleanUrl).href;
    } catch (e) {
      // If URL is invalid, return original
      return url;
    }
    
    return cleanUrl;
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
        `https://steemitimages.com/50x50/u/${post.author}/avatar`,
        `https://steemitimages.com/u/${post.author}/avatar`,
        '/assets/images/default-avatar.png',
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
    
    // Check if we have a valid image URL before attempting to load
    if (!imageUrl || imageUrl === './assets/images/placeholder.png') {
      // Skip the loading process entirely and use placeholder immediately
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/images/placeholder.png';
      content.appendChild(image);
      return content;
    }
    
    // Enforce a clean URL before we start
    imageUrl = this.sanitizeImageUrl(imageUrl);
    
    // Determine current card size AND layout from container classes
    const { size: cardSize, layout } = this.getCardConfig();
    
    // Use different image sizes based on card size setting AND layout
    const sizesToTry = this.getImageSizesToTry(cardSize, layout);
    
    let currentSizeIndex = 0;
    let isLoadingPlaceholder = false;
    
    const loadNextSize = () => {
      if (currentSizeIndex >= sizesToTry.length || isLoadingPlaceholder) {
        loadPlaceholder();
        return;
      }
      
      const sizeOption = sizesToTry[currentSizeIndex++];
      let url;
      
      if (sizeOption.direct) {
        url = imageUrl;
      } else {
        url = `https://${sizeOption.cdn}/${sizeOption.size}x0/${imageUrl}`;
      }
      
      loadImage(url);
    };
    
    const loadImage = (url) => {
      if (isLoadingPlaceholder) return;
      
      const timeoutId = setTimeout(() => {
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
      
      image.onerror = () => {
        clearTimeout(timeoutId);
        console.log(`Image load error: ${url.substring(0, 50)}...`);
        tryNextOption("Failed to load");
      };
      
      image.src = url;
    };
    
    const tryNextOption = (errorReason) => {
      if (isLoadingPlaceholder) return;
      loadNextSize();
    };
    
    const loadPlaceholder = () => {
      if (isLoadingPlaceholder) return;
      
      isLoadingPlaceholder = true;
      content.classList.remove('loading');
      content.classList.add('error');
      
      // Use placeholder image
      image.src = './assets/images/placeholder.png';
      
      // No need to add error message, the placeholder is sufficient
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