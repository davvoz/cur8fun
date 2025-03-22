import View from './View.js';
import communityService from '../services/CommunityService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';

class CommunityView extends View {
  constructor(params = {}) {
    super(params);
    this.communityName = params.name;
    this.currentUser = authService.getCurrentUser();
    this.community = null;
    this.posts = [];
    this.lastPost = null;
    this.isSubscribed = false;
    this.loading = false;
    this.loadingIndicator = new LoadingIndicator();
    this.infiniteScroll = null;
    this.sortMode = 'trending';
  }
  
  async render(element) {
    this.element = element;
    
    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create a loading container
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    this.element.appendChild(loadingContainer);
    
    // Show loading indicator
    this.loadingIndicator.show(loadingContainer);
    
    try {
      // Load community details
      this.community = await communityService.getCommunityDetails(this.communityName);
      
      if (!this.community) {
        this.renderNotFound();
        return;
      }
      
      // Check if user is subscribed
      if (this.currentUser) {
        this.isSubscribed = await communityService.isSubscribed(
          this.currentUser.username,
          this.communityName
        );
      }
      
      // Update document title
      document.title = `${this.community.title || this.community.name} | SteemGram`;
      
      // Render community content
      this.renderCommunity();
      
      // Load posts
      this.loadPosts();
      
    } catch (error) {
      console.error('Error loading community:', error);
      this.renderError('Failed to load community data');
    } finally {
      // Hide loading indicator
      this.loadingIndicator.hide();
    }
  }
  
  renderCommunity() {
    // Community header
    const header = document.createElement('div');
    header.className = 'community-header';
    
    // Banner image
    if (this.community.banner_url) {
      const banner = document.createElement('div');
      banner.className = 'community-banner';
      banner.style.backgroundImage = `url(${this.community.banner_url})`;
      header.appendChild(banner);
    }
    
    // Community info
    const info = document.createElement('div');
    info.className = 'community-info';
    
    // Avatar - Utilizzo text-avatar invece di PNG
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'community-avatar';
    const community = this.community; // Salva referenza a this.community

    if (this.community.avatar_url) {
      // Se l'URL dell'avatar esiste, usa un'immagine
      const avatarImg = document.createElement('img');
      avatarImg.src = this.community.avatar_url;
      avatarImg.alt = this.community.title || this.community.name;
      avatarImg.onerror = () => {
        // In caso di errore, sostituisci con un avatar testuale
        avatarImg.style.display = 'none';
        createTextAvatar();
      };
      avatarContainer.appendChild(avatarImg);
    } else {
      // Crea subito un avatar testuale
      createTextAvatar();
    }

    // Funzione per creare un avatar basato su testo
    function createTextAvatar() {
      const textAvatar = document.createElement('div');
      textAvatar.className = 'text-avatar';
      
      // Usa la prima lettera del nome della community
      const initial = (community.name || 'C').charAt(0).toUpperCase();
      textAvatar.textContent = initial;
      
      // Genera un colore di sfondo deterministico basato sul nome
      const hue = Math.abs(community.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
      textAvatar.style.backgroundColor = `hsl(${hue}, 65%, 65%)`;
      
      avatarContainer.appendChild(textAvatar);
    }

    info.appendChild(avatarContainer);
    
    // Title and description
    const content = document.createElement('div');
    content.className = 'community-info-content';
    
    const title = document.createElement('h1');
    title.className = 'community-title';
    title.textContent = this.community.title || this.community.name;
    content.appendChild(title);
    
    const name = document.createElement('div');
    name.className = 'community-name';
    name.textContent = `@${this.community.name}`;
    content.appendChild(name);
    
    if (this.community.about) {
      const about = document.createElement('p');
      about.className = 'community-about';
      about.textContent = this.community.about;
      content.appendChild(about);
    }
    
    info.appendChild(content);
    
    // Community stats
    const stats = document.createElement('div');
    stats.className = 'community-stats';
    
    const subscriberCount = document.createElement('div');
    subscriberCount.className = 'stat-item';
    subscriberCount.innerHTML = `
      <span class="stat-label">Subscribers</span>
      <span class="stat-value">${this.community.subscribers || 0}</span>
    `;
    stats.appendChild(subscriberCount);
    
    const postsCount = document.createElement('div');
    postsCount.className = 'stat-item';
    postsCount.innerHTML = `
      <span class="stat-label">Posts</span>
      <span class="stat-value">${this.community.num_pending || 0}</span>
    `;
    stats.appendChild(postsCount);
    
    info.appendChild(stats);
    
    // Subscription button
    if (this.currentUser) {
      const subBtn = document.createElement('button');
      subBtn.id = 'subscription-btn';
      
      if (this.isSubscribed) {
        subBtn.className = 'btn unsubscribe-btn';
        subBtn.textContent = 'Unsubscribe';
      } else {
        subBtn.className = 'btn subscribe-btn';
        subBtn.textContent = 'Subscribe';
      }
      
      subBtn.addEventListener('click', () => this.handleSubscriptionToggle());
      info.appendChild(subBtn);
    }
    
    header.appendChild(info);
    this.element.appendChild(header);
    
    // Content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'community-content';
    
    // Sort options container
    const sortOptionsContainer = document.createElement('div');
    sortOptionsContainer.className = 'sort-options';
    
    // Array of sort modes
    const sortModes = ['trending', 'hot', 'created', 'promoted'];
    sortModes.forEach(option => {
      const button = document.createElement('button');
      button.className = `sort-btn ${option === this.sortMode ? 'active' : ''}`;
      button.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      button.addEventListener('click', () => this.handleSortChange(option));
      sortOptionsContainer.appendChild(button);
    });
    
    contentContainer.appendChild(sortOptionsContainer);
    
    // Create post button
    if (this.currentUser) {
      const createPostBtn = document.createElement('a');
      createPostBtn.href = `/create?community=${this.communityName}`;
      createPostBtn.className = 'btn create-post-btn';
      createPostBtn.innerHTML = `
        <span class="material-icons">add</span>
        Create Post
      `;
      sortOptionsContainer.appendChild(createPostBtn);
    }
    
    // Posts container
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';
    contentContainer.appendChild(postsContainer);
    
    this.element.appendChild(contentContainer);
  }
  
  async loadPosts() {
    const postsContainer = this.element.querySelector('.posts-container');
    if (!postsContainer) return;
    
    this.loading = true;
    this.loadingIndicator.show(postsContainer);
    
    try {
      const observer = this.currentUser ? this.currentUser.username : '';
      
      const result = await communityService.getCommunityPosts(this.communityName, {
        sort: this.sortMode,
        limit: 20,
        observer,
        last: this.lastPost
      });
      
      if (result && result.posts && result.posts.length > 0) {
        this.posts = [...this.posts, ...result.posts];
        this.lastPost = {
          author: result.posts[result.posts.length - 1].author,
          permlink: result.posts[result.posts.length - 1].permlink
        };
        
        this.renderPosts(postsContainer, result.posts, this.posts.length > result.posts.length);
        
        // Initialize infinite scroll if needed
        if (!this.infiniteScroll) {
          this.initInfiniteScroll(postsContainer);
        }
      } else if (this.posts.length === 0) {
        postsContainer.innerHTML = `
          <div class="empty-state">
            <h3>No posts yet</h3>
            <p>Be the first to post in this community!</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading community posts:', error);
      if (this.posts.length === 0) {
        postsContainer.innerHTML = `
          <div class="error-state">
            <h3>Error</h3>
            <p>Failed to load posts. Please try again later.</p>
            <button class="retry-btn">Retry</button>
          </div>
        `;
        
        const retryBtn = postsContainer.querySelector('.retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => this.refreshPosts());
        }
      }
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }
  
  renderPosts(container, posts, append = false) {
    // If we're not appending, clear the container first
    if (!append) {
      container.innerHTML = '';
    }
    
    // Loop through posts and create post cards
    posts.forEach(post => {
      // Create post card (reuse from HomeView or create a simplified version here)
      const postCard = this.createPostCard(post);
      container.appendChild(postCard);
    });
  }
  
  createPostCard(post) {
    // Simplified version - you can reuse your existing post card implementation
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // Post header with author info
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const authorContainer = document.createElement('div');
    authorContainer.className = 'author-avatar';

    // Crea avatar basato su testo invece di usare Steemitimages
    const textAvatar = document.createElement('div');
    textAvatar.className = 'author-text-avatar';
    textAvatar.textContent = post.author.charAt(0).toUpperCase();

    // Colore di sfondo basato sul nome utente
    const hue = Math.abs(post.author.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
    textAvatar.style.backgroundColor = `hsl(${hue}, 60%, 60%)`;

    authorContainer.appendChild(textAvatar);
    header.appendChild(authorContainer);
    
    // Post title
    const title = document.createElement('h3');
    title.className = 'post-title';
    title.textContent = post.title;
    card.appendChild(title);
    
    // Post excerpt
    const body = document.createElement('div');
    body.className = 'post-excerpt';
    body.textContent = this.createExcerpt(post.body);
    card.appendChild(body);
    
    // Action bar (votes, comments, payout)
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const votes = document.createElement('span');
    votes.className = 'action-item';
    votes.innerHTML = `<span class="material-icons">thumb_up</span> ${post.net_votes || 0}`;
    
    const comments = document.createElement('span');
    comments.className = 'action-item';
    comments.innerHTML = `<span class="material-icons">chat</span> ${post.children || 0}`;
    
    const payout = document.createElement('span');
    payout.className = 'action-item';
    payout.innerHTML = `<span class="material-icons">attach_money</span> ${parseFloat(post.pending_payout_value || 0).toFixed(2)}`;
    
    actions.appendChild(votes);
    actions.appendChild(comments);
    actions.appendChild(payout);
    card.appendChild(actions);
    
    // Make card clickable to navigate to post
    card.addEventListener('click', () => {
      router.navigate(`/@${post.author}/${post.permlink}`);
    });
    
    return card;
  }
  
  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Clean markdown and HTML
    const plainText = body
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*|__|\*|_|~~|```/g, '')
      .replace(/\n\n/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
    
    if (plainText.length <= maxLength) {
      return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }
  
  async handleSubscriptionToggle() {
    if (!this.currentUser) {
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'You need to be logged in to subscribe to communities'
      });
      router.navigate('/login');
      return;
    }
    
    const subBtn = document.getElementById('subscription-btn');
    if (!subBtn) return;
    
    // Disable button and show loading state
    const originalText = subBtn.textContent;
    subBtn.disabled = true;
    subBtn.textContent = this.isSubscribed ? 'Unsubscribing...' : 'Subscribing...';
    
    try {
      if (this.isSubscribed) {
        await communityService.unsubscribeFromCommunity(
          this.currentUser.username,
          this.communityName
        );
        subBtn.className = 'btn subscribe-btn';
        subBtn.textContent = 'Subscribe';
        this.isSubscribed = false;
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Unsubscribed from ${this.communityName}`
        });
      } else {
        await communityService.subscribeToCommunity(
          this.currentUser.username,
          this.communityName
        );
        subBtn.className = 'btn unsubscribe-btn';
        subBtn.textContent = 'Unsubscribe';
        this.isSubscribed = true;
        
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Subscribed to ${this.communityName}`
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      subBtn.textContent = originalText;
      
      eventEmitter.emit('notification', {
        type: 'error',
        message: error.message || 'Failed to update subscription'
      });
    } finally {
      subBtn.disabled = false;
    }
  }
  
  handleSortChange(sortMode) {
    if (this.sortMode === sortMode) return;
    
    // Update active button
    const buttons = this.element.querySelectorAll('.sort-btn');
    buttons.forEach(btn => {
      if (btn.textContent.toLowerCase() === sortMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Update sort mode and refresh posts
    this.sortMode = sortMode;
    this.refreshPosts();
  }
  
  refreshPosts() {
    this.posts = [];
    this.lastPost = null;
    
    const postsContainer = this.element.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '';
      this.loadPosts();
    }
  }
  
  renderNotFound() {
    this.element.innerHTML = `
      <div class="not-found-state">
        <h2>Community Not Found</h2>
        <p>The community "@${this.communityName}" doesn't exist or isn't available.</p>
        <a href="/communities" class="btn">Browse Communities</a>
      </div>
    `;
  }
  
  renderError(message) {
    this.element.innerHTML = `
      <div class="error-state">
        <h2>Error</h2>
        <p>${message}</p>
        <button class="btn retry-btn">Retry</button>
      </div>
    `;
    
    const retryBtn = this.element.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.render(this.element);
      });
    }
  }
  
  initInfiniteScroll(container) {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }
    
    this.infiniteScroll = new InfiniteScroll({
      container,
      loadMore: () => {
        if (!this.loading) {
          this.loadPosts();
        }
        return Promise.resolve(true);
      },
      threshold: '200px'
    });
  }
  
  unmount() {
    super.unmount();
    
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }
}

export default CommunityView;