import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../LoadingIndicator.js';

export default class PostUIManager {
  constructor(container, renderer) {
    this.container = container;
    this.renderer = renderer;
    this.infiniteScroll = null;
    this.loadingIndicator = null;
  }

  showLoadingState(message = 'Loading posts...') {
    if (!this.container) return;
    
    if (!this.loadingIndicator) {
      this.loadingIndicator = new LoadingIndicator('spinner');
    }
    this.loadingIndicator.show(this.container, message);
  }

  hideLoadingState() {
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
  }

  setupLayout(layout) {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.container.className = `posts-container grid-layout-${layout}`;
  }

  createPostsWrapper(layout) {
    const wrapper = document.createElement('div');
    wrapper.className = 'posts-cards-wrapper';
    wrapper.classList.add(`layout-${layout}`);
    this.container.appendChild(wrapper);
    return wrapper;
  }

  renderPosts(posts, wrapper) {
    posts.forEach(post => {
      const postItem = this.renderer.renderPost(post);
      wrapper.appendChild(postItem);
    });
  }

  showEmptyState(username) {
    if (!this.container) return;
    
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-posts-message';
    emptyMessage.innerHTML = `@${username} non ha ancora pubblicato post.`;
    this.container.appendChild(emptyMessage);
  }

  setupInfiniteScroll(loadMoreFn, wrapper, initialPage = 1) {
    if (!this.container) return;
    
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    console.log(`Initializing PostsList InfiniteScroll with page ${initialPage}`);
    
    // Create progress bar loading indicator for infinite scroll
    const infiniteScrollLoader = new LoadingIndicator('progressBar');
    
    // Setup the infinite scroll
    this.infiniteScroll = new InfiniteScroll({
      container: this.container,
      loadMore: async (page) => {
        try {
          console.log(`Loading more posts for page ${page}`);
          
          // Show loading progress
          infiniteScrollLoader.show(this.container);
          
          // Load more posts through the provided callback
          const result = await loadMoreFn(page);
          
          // Hide loading progress
          infiniteScrollLoader.hide();
          
          // Return the result from the callback
          return result;
        } catch (error) {
          console.error('Error in infinite scroll load more:', error);
          infiniteScrollLoader.hide();
          return false;
        }
      },
      threshold: '200px',
      initialPage: initialPage,
      loadingMessage: 'Caricamento altri post...',
      endMessage: `
        <div class="end-message">
          <span class="material-icons">check_circle</span>
          Hai visualizzato tutti i post
        </div>
      `,
      errorMessage: 'Errore nel caricamento dei post. Riprova.'
    });
    
    return this.infiniteScroll;
  }

  showError(error) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message">
        <h3>Error loading posts</h3>
        <p>${error.message || 'Unknown error'}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;
    
    this.container.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.container.innerHTML = '';
      this.container.dispatchEvent(new CustomEvent('retry-posts'));
    });
  }

  notifyPostsRendered() {
    window.dispatchEvent(new CustomEvent('posts-rendered', {
      detail: { container: this.container }
    }));
  }

  cleanup() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
      this.loadingIndicator = null;
    }
  }
}
