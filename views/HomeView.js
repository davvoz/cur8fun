import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class HomeView {
  constructor(params) {
    this.params = params || {};
    this.tag = this.params.tag || 'trending';
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderPosts();
    }
    
    try {
      const result = await this.fetchPostsByTag(page);
      
      // Check if result has the expected structure
      if (!result || !result.posts) {
        console.error('Invalid response format from fetchPostsByTag:', result);
        return false;
      }
      
      const { posts, hasMore } = result;
      
      // Append new posts to the existing list
      if (Array.isArray(posts)) {
        this.posts = [...this.posts, ...posts];
        this.renderPosts(page > 1);
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
    
    // Render each post
    postsToRender.forEach(post => this.renderPostCard(post, postsContainer));
  }

  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  renderPostCard(post, container) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    
    const imageUrl = this.extractFirstImageUrl(post.body);
    //const metadata = this.parseMetadata(post.json_metadata);
    
    postCard.appendChild(this.createPostHeader(post));
    
    if (imageUrl) {
      postCard.appendChild(this.createPostImage(imageUrl));
    }
    
    postCard.appendChild(this.createPostTitle(post.title));
    postCard.appendChild(this.createPostExcerpt(post.body));
    postCard.appendChild(this.createPostActions(post));
    
    postCard.addEventListener('click', () => {
      window.location.href = `/@${post.author}/${post.permlink}`;
    });
    
    container.appendChild(postCard);
  }

  extractFirstImageUrl(body) {
    const imgMatch = body.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : '';
  }

  parseMetadata(jsonMetadata) {
    try {
      return JSON.parse(jsonMetadata);
    } catch (e) {
      return {};
    }
  }

  createPostHeader(post) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatar = document.createElement('img');
    avatar.src = `https://steemitimages.com/u/${post.author}/avatar`;
    avatar.alt = post.author;
    avatar.className = 'avatar';
    
    const info = document.createElement('div');
    info.className = 'post-info';
    
    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${post.author}`;
    
    const date = document.createElement('div');
    date.className = 'post-date';
    date.textContent = new Date(post.created).toLocaleDateString();
    
    info.append(author, date);
    header.append(avatar, info);
    
    return header;
  }

  createPostImage(imageUrl) {
    const content = document.createElement('div');
    content.className = 'post-content';
    
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = 'Post image';
    
    content.appendChild(image);
    return content;
  }

  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title;
    return element;
  }

  createPostExcerpt(body) {
    const EXCERPT_LENGTH = 140;
    const element = document.createElement('div');
    element.className = 'post-excerpt';
    element.textContent = `${body.substring(0, EXCERPT_LENGTH).replace(/<[^>]*>/g, '')}...`;
    return element;
  }

  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    actions.appendChild(this.createActionItem('thumb_up', post.net_votes));
    actions.appendChild(this.createActionItem('chat', post.children));
    actions.appendChild(this.createActionItem('attach_money', parseFloat(post.pending_payout_value).toFixed(2)));
    
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

export default HomeView;
