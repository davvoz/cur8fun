import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import eventEmitter from '../utils/EventEmitter.js';

class HomeView {
  constructor(params) {
    this.params = params || {};
    this.tag = this.params.tag || 'trending';
    this.posts = [];
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
  }

  async loadPosts() {
    this.loading = true;
    
    try {
      switch(this.tag) {
        case 'trending':
          this.posts = await steemService.getTrendingPosts();
          break;
        case 'hot':
          this.posts = await steemService.getHotPosts();
          break;
        case 'created':
          this.posts = await steemService.getNewPosts();
          break;
        case 'promoted':
          this.posts = await steemService.getPromotedPosts();
          break;
        default:
          this.posts = await steemService.getTrendingPosts();
      }
      
      this.renderPosts();
    } catch (error) {
      console.error('Failed to load posts:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'Failed to load posts. Please try again later.'
      });
      
      // Show error state
      this.container.querySelector('.posts-container').innerHTML = `
        <div class="error-state">
          <h3>Failed to load posts</h3>
          <p>There was an error connecting to the Steem blockchain.</p>
          <button class="btn-primary retry-btn">Retry</button>
        </div>
      `;
      
      const retryBtn = this.container.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.loadPosts());
      }
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  renderPosts() {
    const postsContainer = this.container.querySelector('.posts-container');
    
    if (!postsContainer || !this.posts.length) {
      return;
    }
    
    postsContainer.innerHTML = '';
    
    this.posts.forEach(post => {
      // Get first image from post body if available
      let imageUrl = '';
      const imgMatch = post.body.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
      
      // Parse JSON metadata
      let metadata = {};
      try {
        metadata = JSON.parse(post.json_metadata);
      } catch (e) {}
      
      const postCard = document.createElement('div');
      postCard.className = 'post-card';
      postCard.innerHTML = `
        <div class="post-header">
          <img src="https://steemitimages.com/u/${post.author}/avatar" alt="${post.author}" class="avatar">
          <div class="post-info">
            <div class="post-author">@${post.author}</div>
            <div class="post-date">${new Date(post.created).toLocaleDateString()}</div>
          </div>
        </div>
        ${imageUrl ? `<div class="post-content"><img src="${imageUrl}" alt="Post image"></div>` : ''}
        <div class="post-title">${post.title}</div>
        <div class="post-excerpt">${post.body.substring(0, 140).replace(/<[^>]*>/g, '')}...</div>
        <div class="post-actions">
          <div class="action-item">
            <span class="material-icons">thumb_up</span> ${post.net_votes}
          </div>
          <div class="action-item">
            <span class="material-icons">chat</span> ${post.children}
          </div>
          <div class="action-item">
            <span class="material-icons">attach_money</span> ${parseFloat(post.pending_payout_value).toFixed(2)}
          </div>
        </div>
      `;
      
      postCard.addEventListener('click', () => {
        window.location.href = `/@${post.author}/${post.permlink}`;
      });
      
      postsContainer.appendChild(postCard);
    });
  }

  render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="content-wrapper">
        <h1>${this.tag.charAt(0).toUpperCase() + this.tag.slice(1)} Posts</h1>
        <div class="posts-container"></div>
      </div>
    `;
    
    // Show loading indicator while posts are loading
    this.loadingIndicator.show(container.querySelector('.posts-container'));
    
    // Load posts
    this.loadPosts();
  }

  unmount() {
    // Clean up any event listeners or resources
  }
}

export default HomeView;
