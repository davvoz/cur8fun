import InfiniteScroll from '../../utils/InfiniteScroll.js';
import router from '../../utils/Router.js';
import UIComponents from '../../utils/UIComponents.js';
import profileService from '../../services/ProfileService.js';
import BasePostView from '../../views/BasePostView.js';
import LoadingIndicator from '../LoadingIndicator.js';

export default class PostsList extends BasePostView {
  constructor(username, useCache = false) {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    this.postsData = null; // Flag to indicate if data is cached
    this.allPosts = []; // Store fetched data
    this.loading = false;
    this.infiniteScroll = null;
    this.container = null;
    this.uiComponents = new UIComponents();
    this.loadingIndicator = null;
    
    // Pagination settings for rendering
    this.postsPerPage = 20;
    this.currentPage = 1;
    this.hasMore = true;
  }
  
  async render(container) {
    if (container) {
      this.container = container;
      this.postsContainer = container;
    }
    
    console.log("PostsList render called, useCache:", this.useCache, "postsData:", this.postsData);
    
    // Reset state if we're not using cache or don't have data yet
    if (!this.useCache || !this.postsData) {
      this.reset();
    }
    
    // Add retry handler
    container.addEventListener('retry-posts', () => {
      this.loadPosts();
    });
    
    // Load the first page of posts
    await this.loadPosts();
  }
  
  async loadPosts() {
    if (this.loading) return;
    if (!this.postsContainer) return;

    this.loading = true;

    // Create and show loading indicator
    if (!this.loadingIndicator) {
      this.loadingIndicator = new LoadingIndicator('spinner');
    }
    this.loadingIndicator.show(this.postsContainer, `Loading posts from @${this.username}...`);

    try {
      // Load the first page of posts
      const posts = await profileService.getUserPosts(this.username, this.postsPerPage, 1);
      
      // Store the loaded posts
      this.allPosts = posts || [];
      this.postsData = this.allPosts.length > 0;
      this.currentPage = 1;
      
      // Hide the loading indicator
      this.loadingIndicator.hide();
      
      // Render the loaded posts
      this.renderLoadedPosts();
      
    } catch (error) {
      console.error('Error loading posts:', error);
      
      // Hide the loading indicator
      this.loadingIndicator.hide();
      
      this.postsContainer.innerHTML = `
        <div class="error-message">
          <h3>Error loading posts</h3>
          <p>${error.message || 'Unknown error'}</p>
          <button class="retry-btn">Retry</button>
        </div>
      `;
      
      this.postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.loadPosts();
      });
    } finally {
      this.loading = false;
    }
  }
  
  async renderLoadedPosts() {
    if (!this.postsContainer) {
      console.warn('Cannot render posts: container not available');
      return;
    }

    // Clear container content
    this.postsContainer.innerHTML = '';
    
    // Apply current grid layout
    const currentLayout = this.gridController?.settings?.layout || 'grid';
    this.postsContainer.className = `posts-container grid-layout-${currentLayout}`;

    // Handle empty posts case
    if (!this.allPosts?.length) {
      this.renderEmptyState();
      return;
    }

    try {
      // Create posts wrapper with layout class
      const postsWrapper = this.createPostsWrapper(currentLayout);
      this.postsContainer.appendChild(postsWrapper);

      // Render the posts
      this.allPosts.forEach(post => {
        const postItem = this.createPostItem(post);
        postsWrapper.appendChild(postItem);
      });
      
      // Setup infinite scroll for loading more posts
      this._setupInfiniteScroll(postsWrapper);
      
      // Notify that posts are rendered
      this.notifyPostsRendered();
      
      // Apply grid layout settings
      this.applyGridSettings();
    } catch (error) {
      this.handleRenderError(error);
    }
  }

  _setupInfiniteScroll(postsWrapper) {
    if (!postsWrapper) return;
    
    console.log(`Setting up infinite scroll with current page ${this.currentPage}`);
    
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    // Create progress bar loading indicator for infinite scroll
    const infiniteScrollLoader = new LoadingIndicator('progressBar');

    // Setup the infinite scroll
    this.infiniteScroll = new InfiniteScroll({
      container: this.postsContainer,
      loadMore: async (page) => {
        try {
          console.log(`Loading more posts for page ${page}`);
          
          // Show loading progress
          infiniteScrollLoader.show(this.postsContainer);
          
          // Load more posts
          const newPosts = await profileService.getUserPosts(this.username, this.postsPerPage, page);
          
          // Hide loading progress
          infiniteScrollLoader.hide();
          
          if (newPosts && newPosts.length > 0) {
            console.log(`Loaded ${newPosts.length} new posts for page ${page}`);
            
            // Update state
            this.allPosts = [...this.allPosts, ...newPosts];
            this.currentPage = page;
            
            // Render the new posts
            newPosts.forEach(post => {
              const postItem = this.createPostItem(post);
              postsWrapper.appendChild(postItem);
            });
            
            // Apply grid layout again to include new items
            setTimeout(() => {
              this.gridController.applySettings();
            }, 100);
            
            // Return true if we got a full page (indicating there might be more)
            return newPosts.length >= this.postsPerPage;
          } else {
            console.log('No new posts loaded');
            
            // Add "end of posts" message
            const endMessage = document.createElement('div');
            endMessage.className = 'posts-end-message';
            endMessage.innerHTML = `
              <div class="end-message">
                <span class="material-icons">check_circle</span>
                Hai visualizzato tutti i post
              </div>
            `;
            this.postsContainer.appendChild(endMessage);
            
            return false;
          }
        } catch (error) {
          console.error('Error loading more posts:', error);
          infiniteScrollLoader.hide();
          return false;
        }
      },
      threshold: '200px', // Start loading when we're 200px from the bottom
      initialPage: this.currentPage + 1 // Start from the next page
    });

    console.log('Infinite scroll for posts configured successfully');
  }
  
  renderEmptyState() {
    this.postsContainer.innerHTML = `
      <div class="empty-posts-message">
        @${this.username} non ha ancora pubblicato post.
      </div>
    `;
  }

  createPostsWrapper(layoutType) {
    const postsWrapper = document.createElement('div');
    postsWrapper.className = `posts-cards-wrapper layout-${layoutType}`;
    return postsWrapper;
  }

  createPostItem(post) {
    if (!post) {
      console.error('Cannot create post item: post data is missing');
      return document.createElement('div');
    }

    const postItem = document.createElement('div');
    postItem.className = 'post-card';
    postItem.dataset.postId = `${post.author}_${post.permlink}`;

    const metadata = this.parseMetadata(post.json_metadata);
    const imageUrl = this.getBestImage(post, metadata);

    postItem.appendChild(this.createPostHeader(post));

    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';

    mainContent.appendChild(this.createPostImage(imageUrl, post.title));

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';

    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';

    contentMiddle.appendChild(this.createPostTitle(post.title));

    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body);
      excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
    }

    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }

    contentWrapper.appendChild(contentMiddle);
    contentWrapper.appendChild(this.createPostActions(post));
    mainContent.appendChild(contentWrapper);
    postItem.appendChild(mainContent);

    this.addPostNavigationHandler(postItem, post);

    return postItem;
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

    let retryCount = 0;

    const loadAvatar = () => {
      const avatarSources = [
        `https://steemitimages.com/u/${post.author}/avatar`,
        `https://images.hive.blog/u/${post.author}/avatar`
      ];

      let currentSourceIndex = 0;

      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          avatar.src = './assets/img/default-avatar.png';
          return;
        }

        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;

        avatar.onerror = () => {
          setTimeout(tryNextSource, 300);
        };

        if (retryCount > 0 && !currentSource.includes('default-avatar')) {
          avatar.src = `${currentSource}?retry=${Date.now()}`;
        } else {
          avatar.src = currentSource;
        }
      };

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

    if (!imageUrl || imageUrl === './assets/img/placeholder.png') {
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
      content.appendChild(image);
      return content;
    }

    imageUrl = this.sanitizeImageUrl(imageUrl);

    const { size: cardSize, layout } = this.getCardConfig();
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
        tryNextOption("Failed to load");
      };

      image.src = url;
    };

    const tryNextOption = () => {
      if (isLoadingPlaceholder) return;
      loadNextSize();
    };

    const loadPlaceholder = () => {
      if (isLoadingPlaceholder) return;

      isLoadingPlaceholder = true;
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
    };

    loadNextSize();

    content.appendChild(image);
    return content;
  }

  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title || '(Untitled)';
    return element;
  }

  createPostTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';

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

  getBestImage(post, metadata) {
    if (this.contentRenderer) {
      try {
        const renderedContent = this.contentRenderer.render({
          body: post.body.substring(0, 1500)
        });

        if (renderedContent.images && renderedContent.images.length > 0) {
          return renderedContent.images[0].src;
        }
      } catch (error) {
        console.error('Error using SteemContentRenderer for image extraction:', error);
      }
    }

    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }

    const previewImageUrl = this.getPreviewImage(post);
    if (previewImageUrl) {
      return previewImageUrl;
    }

    const imgRegex = /https?:\/\/[^\s'"<>]+?\.(jpg|jpeg|png|gif|webp)(\?[^\s'"<>]+)?/i;
    const match = post.body.match(imgRegex);
    if (match) {
      return match[0];
    }

    return './assets/img/placeholder.png';
  }

  sanitizeImageUrl(url) {
    if (!url) return '';

    let cleanUrl = url.split('?')[0].split('#')[0];

    try {
      cleanUrl = new URL(cleanUrl).href;
    } catch (e) {
      return url;
    }

    return cleanUrl;
  }

  getCardConfig() {
    if (!this.container) return { size: 'medium', layout: 'grid' };

    const postsContainer = this.postsContainer || this.container.querySelector('.posts-container');
    if (!postsContainer) return { size: 'medium', layout: 'grid' };

    let size = 'medium';
    let layout = 'grid';
    if (postsContainer.classList.contains('grid-layout-list')) layout = 'list';
    if (postsContainer.classList.contains('grid-layout-compact')) layout = 'compact';

    return { size, layout };
  }

  getImageSizesToTry(cardSize, layout) {
    switch(layout) {
      case 'list':
        return [
          {size: 800, cdn: 'steemitimages.com'},
          {size: 640, cdn: 'steemitimages.com'},
          {size: 400, cdn: 'steemitimages.com'},
          {direct: true}
        ];
      case 'compact':
        return [
          {size: 320, cdn: 'steemitimages.com'},
          {size: 200, cdn: 'steemitimages.com'},
          {direct: true}
        ];
      case 'grid':
      default:
        return [
          {size: 640, cdn: 'steemitimages.com'},
          {size: 400, cdn: 'steemitimages.com'},
          {size: 200, cdn: 'steemitimages.com'},
          {direct: true}
        ];
    }
  }

  addPostThumbnail(element, post) {
    const imageUrl = this.getBestImage(post, this.parseMetadata(post.json_metadata));
    element.appendChild(this.createPostImage(imageUrl, post.title));
  }

  addPostTitle(container, post) {
    container.appendChild(this.createPostTitle(post.title));
  }

  addPostExcerpt(container, post) {
    const excerpt = document.createElement('div');
    excerpt.className = 'post-excerpt';
    const textExcerpt = this.createExcerpt(post.body);
    excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    container.appendChild(excerpt);
  }

  addPostNavigationHandler(element, post) {
    if (post.author && post.permlink) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(`/@${post.author}/${post.permlink}`);
      });
    }
  }
  
  getVoteCount(post) {
    if (typeof post.net_votes === 'number') {
      return post.net_votes;
    }
    if (typeof post.active_votes === 'object' && Array.isArray(post.active_votes)) {
      return post.active_votes.length;
    }
    if (typeof post.vote_count === 'number') {
      return post.vote_count;
    }
    return 0;
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

  getPreviewImage(post) {
    const metadata = this.parseMetadata(post.json_metadata);
    const imageUrl = metadata?.image?.[0];
    const body = post.body || '';
    const regex = /!\[.*?\]\((.*?)\)/;
    const match = body.match(regex);
    const imageUrlFromBody = match ? match[1] : null;
    return imageUrl || imageUrlFromBody;
  }
  
  notifyPostsRendered() {
    window.dispatchEvent(new CustomEvent('posts-rendered', {
      detail: { container: this.postsContainer }
    }));
  }
  
  applyGridSettings() {
    if (!this.gridController || !this.postsContainer) return;
    
    this.gridController.target = this.postsContainer;
    
    setTimeout(() => {
      this.gridController.applySettings();
    }, 100);
  }
  
  handleRenderError(error) {
    console.error('Error rendering posts:', error);
    
    this.postsContainer.innerHTML = `
      <div class="error-message">
        <h3>Error displaying posts</h3>
        <p>An error occurred while displaying posts.</p>
        <p class="error-details">${error.message || 'Unknown error'}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;

    this.postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.renderLoadedPosts();
    });
  }
  
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
      this.loadingIndicator = null;
    }
    
    if (this.gridController) {
      this.gridController.target = null;
      this.gridController.unmount();
    }
  }
  
  getGridType() {
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }
  
  refreshLayout() {
    if (this.gridLayout) {
      this.gridLayout.layout();
    }
  }

  setContainer(container) {
    if (container) {
      this.container = container;
      this.postsContainer = container;
    }
    return this;
  }

  reset() {
    this.loading = false;
    this.currentPage = 1;
    this.postsData = null;
    this.allPosts = [];
    this.hasMore = true;
    return this;
  }

  refreshGridLayout() {
    console.log("Refreshing posts grid layout");
    
    if (!this.postsContainer) {
      console.warn("No posts container available for refresh");
      return;
    }
    
    this.loadPosts();
  }
}
