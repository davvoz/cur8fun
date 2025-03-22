import View from './View.js';
import steemService from '../services/SteemService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import eventEmitter from '../utils/EventEmitter.js';
import GridController from '../components/GridController.js';

class TagView extends View {
  constructor(params = {}) {
    super(params);
    this.tag = params.tag || '';
    this.page = 1;
    this.posts = [];
    this.isLoading = false;
    this.hasMorePosts = true;
    this.element = null;
    this.loadingIndicator = null;
    this.gridController = null;
  }

  async render(element) {
    if (!element) {
      console.error('No element provided to TagView.render()');
      return;
    }

    this.element = element;

    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Set page title
    document.title = `#${this.tag} - Posts`;
    
    // Create main container
    const tagContainer = document.createElement('div');
    tagContainer.className = 'tag-container';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'tag-header';
    
    const title = document.createElement('h1');
    title.className = 'tag-title';
    title.innerHTML = `<span class="tag-symbol">#</span>${this.tag}`;
    
    header.appendChild(title);
    tagContainer.appendChild(header);
    
    // Add grid controller container
    const gridControlContainer = document.createElement('div');
    gridControlContainer.className = 'grid-controller-container';
    tagContainer.appendChild(gridControlContainer);
    
    // Create posts container with class for grid controller
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-grid posts-container';
    tagContainer.appendChild(postsContainer);
    
    // Create loading container
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    tagContainer.appendChild(loadingContainer);
    
    // Add everything to the DOM
    this.element.appendChild(tagContainer);
    
    this.postsContainer = postsContainer;
    this.loadingContainer = loadingContainer;
    
    // Initialize grid controller
    this.initGridController(gridControlContainer);
    
    // Initialize loading indicator
    this.loadingIndicator = new LoadingIndicator('spinner');
    
    // Load initial posts
    await this.loadPosts();
    
    // Set up infinite scroll
    this.setupInfiniteScroll();
    
    // Emit view loaded event
    eventEmitter.emit('view:loaded', { name: 'tag', params: { tag: this.tag } });
  }

  initGridController(container) {
    if (this.gridController) {
      this.gridController.unmount();
      this.gridController = null;
    }
    
    this.gridController = new GridController({
      targetSelector: '.posts-container',
    });
    
    this.gridController.render(container);
  }

  async loadPosts() {
    if (this.isLoading || !this.hasMorePosts) return;
    
    this.isLoading = true;
    this.loadingIndicator.show(this.loadingContainer, 'Loading posts...');
    
    try {
      const result = await steemService.getPostsByTag({
        tag: this.tag,
        page: this.page,
        limit: 20
      });
      
      if (result.posts && result.posts.length > 0) {
        this.renderPosts(result.posts);
        this.hasMorePosts = result.hasMore;
        this.page++;
      } else {
        this.hasMorePosts = false;
        if (this.page === 1) {
          this.renderEmptyState();
        }
      }
    } catch (error) {
      console.error('Error loading posts for tag:', error);
      this.renderError(error);
    } finally {
      this.isLoading = false;
      this.loadingIndicator.hide();
    }
  }

  renderPosts(posts) {
    if (!posts || posts.length === 0) return;
    
    posts.forEach(post => {
      const postCard = this.createPostCard(post);
      this.postsContainer.appendChild(postCard);
    });
  }

  createPostCard(post) {
    // Extract post metadata
    const { author, permlink, title, created, body, json_metadata } = post;
    
    // Get thumbnail if available
    let thumbnailUrl = 'assets/img/placeholder.png';
    try {
      const metadata = typeof json_metadata === 'string' ? JSON.parse(json_metadata) : json_metadata;
      if (metadata?.image && metadata.image.length > 0) {
        thumbnailUrl = metadata.image[0];
      } else {
        // Try to extract from body
        const imgMatch = body && body.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif))/i);
        if (imgMatch && imgMatch[0]) {
          thumbnailUrl = imgMatch[0];
        }
      }
    } catch (e) {
      console.warn('Failed to parse post metadata', e);
    }
    
    // Create post card element
    const card = document.createElement('div');
    card.className = 'post-card';
    card.addEventListener('click', () => {
      router.navigate(`/@${author}/${permlink}`);
    });
    
    // Card header with author info
    const cardHeader = document.createElement('div');
    cardHeader.className = 'post-card-header';
    
    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar';
    authorAvatar.src = `https://steemitimages.com/u/${author}/avatar`;
    authorAvatar.alt = author;
    
    const authorInfo = document.createElement('div');
    authorInfo.className = 'author-info';
    
    const authorName = document.createElement('a');
    authorName.className = 'author-name';
    authorName.textContent = `@${author}`;
    authorName.href = `javascript:void(0)`;
    authorName.onclick = (e) => {
      e.stopPropagation();
      router.navigate(`/@${author}`);
    };
    
    const postDate = document.createElement('span');
    postDate.className = 'post-date';
    postDate.textContent = new Date(created).toLocaleDateString();
    
    authorInfo.appendChild(authorName);
    authorInfo.appendChild(postDate);
    
    cardHeader.appendChild(authorAvatar);
    cardHeader.appendChild(authorInfo);
    
    // Card content
    const cardContent = document.createElement('div');
    cardContent.className = 'post-card-content';
    
    // Always create and add the thumbnail first
    const thumbnail = document.createElement('div');
    thumbnail.className = 'post-thumbnail';
    thumbnail.style.backgroundImage = `url(${thumbnailUrl})`;
    cardContent.appendChild(thumbnail);
    
    const postTitle = document.createElement('h3');
    postTitle.className = 'post-title';
    postTitle.textContent = title || '(Untitled)';
    cardContent.appendChild(postTitle);
    
    // Excerpt
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    
    let plainText = body?.replace(/<[^>]*>?/gm, '') || '';
    plainText = plainText.replace(/\n/g, ' ').trim();
    excerpt.textContent = plainText.length > 140 
      ? plainText.substring(0, 140) + '...' 
      : plainText;
    
    cardContent.appendChild(excerpt);
    
    // Card footer with tags and stats
    const cardFooter = document.createElement('div');
    cardFooter.className = 'post-card-footer';
    
    // Tags
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';
    
    try {
      const metadata = typeof json_metadata === 'string' ? JSON.parse(json_metadata) : json_metadata;
      if (metadata?.tags && Array.isArray(metadata.tags)) {
        metadata.tags.slice(0, 3).forEach(tag => {
          const tagElem = document.createElement('span');
          tagElem.className = 'post-tag';
          tagElem.textContent = `#${tag}`;
          tagElem.onclick = (e) => {
            e.stopPropagation();
            router.navigate(`/tag/${tag}`);
          };
          tagsContainer.appendChild(tagElem);
        });
      }
    } catch (e) {
      console.warn('Failed to parse post tags', e);
    }
    
    cardFooter.appendChild(tagsContainer);
    
    // Assemble the card
    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    card.appendChild(cardFooter);
    
    return card;
  }

  renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'tag';
    
    const message = document.createElement('h3');
    message.textContent = `No posts found with the tag #${this.tag}`;
    
    const description = document.createElement('p');
    description.textContent = 'Try searching for a different tag or check back later.';
    
    emptyState.appendChild(icon);
    emptyState.appendChild(message);
    emptyState.appendChild(description);
    
    this.postsContainer.appendChild(emptyState);
  }

  renderError(error) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = `Error loading posts: ${error.message || 'Unknown error'}`;
    this.postsContainer.appendChild(errorElement);
  }

  setupInfiniteScroll() {
    // Simple intersection observer for infinite scroll
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.isLoading && this.hasMorePosts) {
        this.loadPosts();
      }
    });
    
    // Create and observe sentinel element
    const sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    this.element.appendChild(sentinel);
    
    observer.observe(sentinel);
  }

  unmount() {
    // Clean up any observers or event listeners
    if (this.gridController) {
      this.gridController.unmount();
      this.gridController = null;
    }
  }
}

export default TagView;
