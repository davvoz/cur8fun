import steemService from '../services/SteemService.js';
import communityService from '../services/CommunityService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import authService from '../services/AuthService.js';

class CommunityView extends BasePostView {
  constructor(params) {
    super(params);
    this.communityId = this.params.id;
    this.community = null;
    this.isSubscribed = false;
    this.currentUser = authService.getCurrentUser();
    this.sortOrder = 'trending'; // Default sort order (trending, hot, created)
  }

  async fetchCommunityDetails() {
    try {
      console.log(`Fetching details for community ${this.communityId}`);
      
      // Controlla se l'ID comunità è in formato corretto
      const communityName = this.communityId.startsWith('hive-') 
        ? this.communityId 
        : `hive-${this.communityId}`;
      
      // Usa il metodo findCommunityByName per ottenere i dettagli
      this.community = await communityService.findCommunityByName(communityName);
      
      if (!this.community) {
        console.error(`Community ${communityName} not found`);
        this.showError('Community not found');
        return false;
      }
      
      console.log('Community details:', this.community);
      
      // Se l'utente è loggato, controlla se è iscritto
      if (this.currentUser) {
        const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username);
        this.isSubscribed = subscriptions.some(sub => 
          sub.name === this.community.name || 
          sub.name === this.community.name.replace(/^hive-/, '')
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error fetching community details:', error);
      this.showError('Failed to load community details');
      return false;
    }
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
      
      // Reset infinite scroll if it exists
      if (this.infiniteScroll) {
          this.infiniteScroll.reset(1);
      }
    }
    
    try {
      // Assicurati che i dettagli della community siano stati caricati
      if (!this.community && !(await this.fetchCommunityDetails())) {
        return false;
      }
      
      const result = await this.fetchCommunityPosts(page);
      
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
      console.error('Failed to load community posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  async fetchCommunityPosts(page = 1) {
    console.log(`Fetching ${this.sortOrder} posts for community ${this.community.name}, page ${page}`);
    
    // Verifica community name
    const communityTag = this.community.name.startsWith('hive-') 
      ? this.community.name 
      : `hive-${this.community.name}`;
    
    // Prepara i parametri per la query
    const params = {
      community: communityTag,
      sort: this.sortOrder,
      limit: 20
    };
    
    // Aggiungi parametri per paginazione se necessario
    if (page > 1 && this.posts.length > 0) {
      const lastPost = this.posts[this.posts.length - 1];
      params.start_author = lastPost.author;
      params.start_permlink = lastPost.permlink;
    }
    
    try {
      // Usa questo nuovo metodo che dobbiamo implementare
      const posts = await steemService.getDiscussionsByBlog(params);
      
      return {
        posts: posts || [],
        hasMore: posts && posts.length > 0
      };
    } catch (error) {
      console.error(`Error fetching community posts:`, error);
      return { posts: [], hasMore: false };
    }
  }

  async handleSubscription() {
    if (!this.currentUser) {
      // Redirect to login
      window.location.hash = '#/login';
      return;
    }
    
    try {
      this.toggleSubscribeButton(true);
      
      if (this.isSubscribed) {
        // Annulla iscrizione
        await communityService.unsubscribeFromCommunity(
          this.currentUser.username,
          this.community.name
        );
        this.isSubscribed = false;
      } else {
        // Iscriviti
        await communityService.subscribeToCommunity(
          this.currentUser.username,
          this.community.name
        );
        this.isSubscribed = true;
      }
      
      // Aggiorna il pulsante
      this.updateSubscribeButton();
    } catch (error) {
      console.error('Error handling subscription:', error);
      this.showNotification('Failed to update subscription', 'error');
    } finally {
      this.toggleSubscribeButton(false);
    }
  }

  toggleSubscribeButton(loading) {
    const button = this.element.querySelector('#subscribe-button');
    if (button) {
      if (loading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
      } else {
        button.disabled = false;
        this.updateSubscribeButton();
      }
    }
  }

  updateSubscribeButton() {
    const button = this.element.querySelector('#subscribe-button');
    if (button) {
      if (this.isSubscribed) {
        button.textContent = 'Unsubscribe';
        button.classList.remove('primary-btn');
        button.classList.add('outline-btn');
      } else {
        button.textContent = 'Subscribe';
        button.classList.add('primary-btn');
        button.classList.remove('outline-btn');
      }
    }
  }

  changeSortOrder(order) {
    if (this.sortOrder === order) return;
    
    this.sortOrder = order;
    
    // Aggiorna UI per il tab attivo
    const sortButtons = this.element.querySelectorAll('.sort-button');
    sortButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === order);
    });
    
    // Ricarica i post con il nuovo ordine
    this.infiniteScroll.reset(1);
    this.loadPosts(1);
  }

  render(container) {
    this.element = container;
    this.element.innerHTML = '';
    
    // Header della community con dettagli in fase di caricamento
    const header = document.createElement('div');
    header.className = 'community-header';
    header.innerHTML = `
      <div class="community-header-loading">
        <div class="spinner"></div>
        <p>Loading community...</p>
      </div>
    `;
    this.element.appendChild(header);
    
    // Container per i post
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';
    this.element.appendChild(postsContainer);
    
    // Memorizza il riferimento al container dei post
    this.postsContainer = postsContainer;
    
    // Carica i dettagli della community e poi i post
    this.fetchCommunityDetails().then(success => {
      if (success) {
        this.renderCommunityHeader(header);
        
        // Inizializza infinite scroll
        this.loadPosts(1).then((hasMore) => {
          if (postsContainer) {
            console.log('Initializing infinite scroll for community');
            this.infiniteScroll = new InfiniteScroll({
              container: postsContainer,
              loadMore: (page) => this.loadPosts(page),
              threshold: '200px',
              loadingMessage: 'Loading more posts...',
              endMessage: `No more posts in this community`,
              errorMessage: 'Failed to load posts. Please check your connection.'
            });
          }
        });
      }
    });
  }

  renderCommunityHeader(headerContainer) {
    if (!this.community) return;
    
    const communityName = this.community.name.startsWith('hive-') 
      ? this.community.name 
      : `hive-${this.community.name}`;
    
    // Ottieni ID numerico dalla community
    const communityId = communityName.replace('hive-', '');
    
    // Prepara l'URL dell'avatar (o usa placeholder)
    const avatarUrl = this.community.avatar_url || `https://images.hive.blog/u/hive-${communityId}/avatar`;
    
    // Prepara l'URL del banner (o usa default)
    const bannerUrl = this.community.banner_url || 'assets/images/default-community-banner.jpg';
    
    // Rendering dell'header community
    headerContainer.innerHTML = `
      <div class="community-banner" style="background-image: url('${bannerUrl}');">
        <div class="community-overlay"></div>
        <div class="community-info">
          <img src="${avatarUrl}" alt="${this.community.title}" class="community-avatar" />
          <div class="community-title-area">
            <h1 class="community-title">${this.community.title || communityName}</h1>
            <div class="community-stats">
              <span class="community-stat">
                <span class="material-icons">group</span>
                ${this.community.subscribers || 0} subscribers
              </span>
              <span class="community-stat">
                <span class="material-icons">article</span>
                ${this.community.num_pending || 0} pending posts
              </span>
            </div>
          </div>
          ${this.currentUser ? `
            <button id="subscribe-button" class="${this.isSubscribed ? 'outline-btn' : 'primary-btn'}">
              ${this.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="community-about">
        ${this.community.about ? `<p>${this.community.about}</p>` : ''}
      </div>
      
      <div class="community-sort-options">
        <div class="sort-buttons">
          <button class="sort-button active" data-sort="trending">
            <span class="material-icons">trending_up</span> Trending
          </button>
          <button class="sort-button" data-sort="hot">
            <span class="material-icons">local_fire_department</span> Hot
          </button>
          <button class="sort-button" data-sort="created">
            <span class="material-icons">schedule</span> New
          </button>
        </div>
      </div>
    `;
    
    // Aggiungi event listeners
    const subscribeButton = headerContainer.querySelector('#subscribe-button');
    if (subscribeButton) {
      subscribeButton.addEventListener('click', () => this.handleSubscription());
    }
    
    // Aggiungi event listeners per i pulsanti di ordinamento
    const sortButtons = headerContainer.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.changeSortOrder(button.dataset.sort);
      });
    });
  }
  
  showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.innerHTML = `
      <span class="material-icons">error_outline</span>
      <p>${message}</p>
    `;
    
    this.element.innerHTML = '';
    this.element.appendChild(errorEl);
  }
  
  showNotification(message, type = 'info') {
    // Implementa notifica toast
    console.log(`[${type}] ${message}`);
  }
  
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }
}

export default CommunityView;