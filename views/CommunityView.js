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
    this.sortOrder = 'trending'; // Default sort order
    
    // Inizializza renderedPostIds come Set per tracciare post già visualizzati
    this.renderedPostIds = new Set();
    
    // Debug log per verificare l'inizializzazione
    console.log(`CommunityView initialized with ID: ${this.communityId}`);
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
      
      // Pulisci il container dei post quando si carica la prima pagina
      if (this.postsContainer) {
        // Mantieni solo l'elemento observer target
        const observerTarget = this.postsContainer.querySelector('.observer-target');
        const elements = Array.from(this.postsContainer.children).filter(el => 
          !el.classList.contains('observer-target') && 
          !el.classList.contains('loading-indicator') &&
          !el.classList.contains('end-message') &&
          !el.classList.contains('infinite-scroll-error')
        );
        
        elements.forEach(el => el.remove());
        
        // Mostra un indicatore di caricamento
        this.showLoadingIndicator();
      }
      
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
      
      console.log(`Fetching ${this.sortOrder} posts for community ${this.community.name}, page ${page}`);
      
      const result = await this.fetchCommunityPosts(page);
      
      // Check if result has the expected structure
      if (!result || !Array.isArray(result.posts)) {
        console.error('Invalid result from fetchCommunityPosts:', result);
        return false;
      }
      
      const { posts, hasMore } = result;
      
      console.log(`Received ${posts.length} posts for page ${page}, hasMore: ${hasMore}`);
      
      // Filter out any duplicates before adding to the post array
      if (Array.isArray(posts)) {
        const uniquePosts = posts.filter(post => {
          // Create a unique ID using author and permlink
          const postId = `${post.author}_${post.permlink}`;
          // Only include posts we haven't seen yet
          const isNew = !this.renderedPostIds.has(postId);
          if (isNew) {
            this.renderedPostIds.add(postId);
          }
          return isNew;
        });
        
        console.log(`Found ${uniquePosts.length} new unique posts to render`);
        
        if (uniquePosts.length > 0) {
          // Aggiungi i nuovi post all'array esistente
          this.posts = [...this.posts, ...uniquePosts];
          
          // Renderizza solo i nuovi post per evitare di ricostruire tutto il DOM
          this.renderPostsAdditive(uniquePosts);
        } else {
          console.log('No new unique posts in this batch.');
        }
      }
      
      return hasMore;
    } catch (error) {
      console.error('Failed to load community posts:', error);
      this.showError('Failed to load posts for this community');
      return false;
    } finally {
      this.loading = false;
      this.hideLoadingIndicator();
    }
  }

  async fetchCommunityPosts(page = 1) {
    try {
      // Assicurati di avere i dettagli della community
      if (!this.community) {
        console.error('Community details not available');
        return { posts: [], hasMore: false };
      }
      
      // Prepara il nome corretto della community (senza prefisso hive-)
      const communityId = this.community.name.replace(/^hive-/, '');
      
      console.log(`Fetching ${this.sortOrder} posts for community ${communityId}, page ${page}`);
      
      // Prepara i parametri per la query
      const params = {
        community: communityId,
        sort: this.sortOrder,
        limit: 20
      };
      
      // Aggiungi parametri per paginazione se necessario
      if (page > 1 && this.posts.length > 0) {
        const lastPost = this.posts[this.posts.length - 1];
        params.start_author = lastPost.author;
        params.start_permlink = lastPost.permlink;
      }
      
      // Chiama il servizio Steem
      const posts = await steemService.getDiscussionsByBlog(params);
      
      // Log utile per il debug
      console.log(`Retrieved ${posts ? posts.length : 0} posts for community ${communityId}`);
      
      // Importante: i post devono essere un array anche se vuoto
      return {
        posts: Array.isArray(posts) ? posts : [],
        hasMore: posts && posts.length > 0
      };
    } catch (error) {
      console.error(`Error fetching community posts:`, error);
      return { posts: [], hasMore: false };
    }
  }

  // Aggiorna il metodo renderPostsAdditive
  renderPostsAdditive(newPosts) {
    if (!this.postsContainer || !newPosts || !newPosts.length) {
      return;
    }
    
    console.log(`Rendering ${newPosts.length} new posts to DOM`);
    
    // Per ogni nuovo post, crea il DOM e aggiungilo al container
    newPosts.forEach(post => {
      const postElement = this.createPostElement(post);
      
      if (!postElement) {
        console.warn(`Failed to create element for post ${post.author}/${post.permlink}`);
        return;
      }
      
      // Assicurati che il post sia visibile applicando classi corrette
      postElement.className = 'post-item'; // Assicura className standard
      
      // Inserisci l'elemento prima dell'observer target
      const observerTarget = this.postsContainer.querySelector('.observer-target');
      if (observerTarget) {
        this.postsContainer.insertBefore(postElement, observerTarget);
      } else {
        this.postsContainer.appendChild(postElement);
      }
      
      // Aggiungi animazione di fade-in
      setTimeout(() => {
        postElement.classList.add('fade-in');
      }, 10);
    });
  }

  // Crea l'elemento DOM per un post
  createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post-item';
    postElement.setAttribute('data-id', `${post.author}_${post.permlink}`);
    
    // Crea l'HTML del post
    let postHTML = `
      <div class="post-header">
        <div class="post-author">
          <img src="https://images.hive.blog/u/${post.author}/avatar" alt="${post.author}" class="author-avatar">
          <div class="author-info">
            <a href="#/profile/${post.author}" class="author-name">@${post.author}</a>
            <span class="post-time">${this.formatDate(post.created)}</span>
          </div>
        </div>
        <div class="post-community">
          <a href="#/community/${this.community.name}" class="community-link">
            <span class="material-icons">group</span>
            ${this.community.title || this.community.name}
          </a>
        </div>
      </div>
      <a href="#/post/${post.author}/${post.permlink}" class="post-content-link">
        <div class="post-content">
          <h2 class="post-title">${post.title}</h2>
          <div class="post-summary">${this.createSummary(post.body)}</div>
    `;
    
    // Aggiungi immagine di copertina se disponibile
    try {
      const metadata = JSON.parse(post.json_metadata || '{}');
      const image = metadata.image && metadata.image[0];
      
      if (image) {
        postHTML += `
          <div class="post-image">
            <img src="${image}" alt="${post.title}" onerror="this.style.display='none'">
          </div>
        `;
      }
    } catch (e) {
      console.warn('Error parsing post metadata:', e);
    }
    
    // Chiudi i contenitori aperti
    postHTML += `
        </div>
      </a>
      <div class="post-footer">
        <div class="post-stats">
          <span class="post-stat">
            <span class="material-icons">arrow_upward</span>
            ${this.formatNumber(post.net_votes)}
          </span>
          <span class="post-stat">
            <span class="material-icons">comment</span>
            ${this.formatNumber(post.children)}
          </span>
          <span class="post-stat">
            <span class="material-icons">attach_money</span>
            $${this.formatNumber(post.pending_payout_value.replace(' SBD', ''))}
          </span>
        </div>
      </div>
    `;
    
    postElement.innerHTML = postHTML;
    
    // Aggiungi event listener per la navigazione
    postElement.querySelector('.post-content-link').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = `/post/${post.author}/${post.permlink}`;
    });
    
    return postElement;
  }

  // Metodi di supporto
  formatDate(dateString) {
    const date = new Date(dateString + 'Z');
    const now = new Date();
    const diff = now - date;
    
    // Differenza in minuti
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 60) {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Differenza in ore
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Differenza in giorni
    const days = Math.floor(hours / 24);
    if (days < 30) {
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    // Formato data completo per post più vecchi
    return date.toLocaleDateString();
  }

  formatNumber(num) {
    if (typeof num === 'string') {
      num = parseFloat(num);
    }
    
    if (isNaN(num)) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toString();
  }

  createSummary(body, maxLength = 150) {
    if (!body) return '';
    
    // Rimuovi markup Markdown
    let plainText = body
      .replace(/!\[.*?\]\(.*?\)/g, '') // Rimuovi immagini
      .replace(/\[.*?\]\(.*?\)/g, '$1') // Sostituisci link con testo
      .replace(/#+\s?(.*?)(?:\n|$)/g, '$1') // Rimuovi header
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // Rimuovi bold
      .replace(/(\*|_)(.*?)\1/g, '$2') // Rimuovi italic
      .replace(/~~(.*?)~~/g, '$1') // Rimuovi strikethrough
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Rimuovi code
      .replace(/\n/g, ' ') // Sostituisci newline con spazi
      .trim();
    
    // Tronca e aggiungi ellipsis se necessario
    if (plainText.length > maxLength) {
      return plainText.substring(0, maxLength) + '...';
    }
    
    return plainText;
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
    this.loadPosts(1);
  }

  render(container) {
    this.element = container;
    this.element.innerHTML = '';
    this.element.className = 'community-view';
    
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
    postsContainer.style.minHeight = '200px'; // Assicura che il container sia visibile
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
          <button class="sort-button ${this.sortOrder === 'trending' ? 'active' : ''}" data-sort="trending">
            <span class="material-icons">trending_up</span> Trending
          </button>
          <button class="sort-button ${this.sortOrder === 'hot' ? 'active' : ''}" data-sort="hot">
            <span class="material-icons">local_fire_department</span> Hot
          </button>
          <button class="sort-button ${this.sortOrder === 'created' ? 'active' : ''}" data-sort="created">
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
  
  showLoadingIndicator() {
    // Rimuovi eventuali indicatori esistenti
    this.hideLoadingIndicator();
    
    // Crea un nuovo indicatore
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'posts-loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Loading posts...</p>
    `;
    
    // Aggiungi al container
    if (this.postsContainer) {
      this.postsContainer.appendChild(loadingIndicator);
    }
  }
  
  hideLoadingIndicator() {
    if (this.postsContainer) {
      const loadingIndicator = this.postsContainer.querySelector('.posts-loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }
    }
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
    // Rimuovi eventuali notifiche esistenti
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(n => n.remove());
    
    // Crea la nuova notifica
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    
    // Aggiungi al body
    document.body.appendChild(notification);
    
    // Rimuovi dopo alcuni secondi
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
  
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }

  /**
   * Funzione di debug completa per il caricamento dei post della community
   */
  async debugCommunityPosts() {
    console.group('🔍 DEBUG: Community Posts Loading');
    
    try {
      console.log('Dettagli community:', this.community);
      
      // FASE 1: Verifica la chiamata API ai post della community
      console.log('FASE 1: Chiamata API per i post della community');
      const communityTag = this.community.name.startsWith('hive-') 
        ? this.community.name 
        : `hive-${this.community.name}`;
      
      const params = {
        community: communityTag.replace(/^hive-/, ''),
        sort: this.sortOrder,
        limit: 10
      };
      
      console.log('Parametri richiesta:', params);
      
      // Chiamata diretta al servizio
      const postsResult = await steemService.getDiscussionsByBlog(params);
      console.log('Risposta API raw:', postsResult);
      
      if (!postsResult || !Array.isArray(postsResult)) {
        console.error('⚠️ Errore: API non ha restituito un array di post');
        return;
      }
      
      console.log(`API ha restituito ${postsResult.length} post`);
      
      if (postsResult.length > 0) {
        console.log('Primo post restituito:', {
          author: postsResult[0].author,
          permlink: postsResult[0].permlink,
          title: postsResult[0].title,
          created: postsResult[0].created,
          has_body: !!postsResult[0].body,
          json_metadata: postsResult[0].json_metadata
        });
      }
      
      // FASE 2: Verifica il processo di rendering
      console.log('FASE 2: Processo di rendering dei post');
      
      // Verifica il container dei post
      console.log('Container dei post:', this.postsContainer);
      if (!this.postsContainer) {
        console.error('⚠️ Errore: Container dei post non trovato');
        return;
      }
      
      console.log('Contenuto HTML container:', this.postsContainer.innerHTML);
      
      // Verifica se i post vengono aggiunti al DOM
      console.log('Prova a renderizzare un post di test');
      
      // Crea un post di test
      const testPost = postsResult.length > 0 ? postsResult[0] : {
        author: 'test-author',
        permlink: 'test-permlink',
        title: 'Test Post',
        body: 'Test body content',
        json_metadata: '{}',
        created: new Date().toISOString(),
        net_votes: 0,
        children: 0,
        pending_payout_value: '0.000 SBD'
      };
      
      // Prova a renderizzare direttamente il post
      const testElement = this.createTestPostElement(testPost);
      this.postsContainer.appendChild(testElement);
      
      console.log('Post di test aggiunto con successo?', 
        !!this.postsContainer.querySelector('.debug-test-post'));
      
      // FASE 3: Verifica CSS e visibilità
      console.log('FASE 3: Verifica CSS e visibilità');
      
      // Verifica stili CSS applicati
      if (this.postsContainer.children.length > 0) {
        const firstChild = this.postsContainer.children[0];
        const computedStyle = window.getComputedStyle(firstChild);
        
        console.log('Stili primo elemento:', {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          height: computedStyle.height,
          position: computedStyle.position,
          overflow: computedStyle.overflow
        });
      }
      
      // FASE 4: Verifica eventuali errori di JavaScript che impediscono il rendering
      console.log('FASE 4: Verifica errori JavaScript');
      
      try {
        // Tenta di renderizzare i post usando la funzione esistente
        this.renderPostsDebug(postsResult.slice(0, 3));
      } catch (error) {
        console.error('⚠️ Errore durante il rendering:', error);
      }
      
    } catch (error) {
      console.error('Errore durante il debug:', error);
    } finally {
      console.groupEnd();
    }
  }
  
  /**
   * Crea un elemento post di test
   */
  createTestPostElement(post) {
    const element = document.createElement('div');
    element.className = 'post-item debug-test-post';
    element.style.backgroundColor = '#f0f8ff';
    element.style.padding = '10px';
    element.style.margin = '10px 0';
    element.style.border = '2px dashed red';
    
    element.innerHTML = `
      <h3>DEBUG TEST POST</h3>
      <p><strong>Author:</strong> ${post.author}</p>
      <p><strong>Title:</strong> ${post.title}</p>
      <p><strong>Created:</strong> ${post.created}</p>
    `;
    
    return element;
  }
  
  /**
   * Versione di debug della funzione renderPosts
   */
  renderPostsDebug(posts) {
    console.group('Debug renderPosts');
    console.log(`Rendering ${posts.length} posts in debug mode`);
    
    if (!this.postsContainer) {
      console.error('Container dei post non trovato!');
      console.groupEnd();
      return;
    }
    
    // Aggiungi un marker per differenziare questi post di debug
    const debugContainer = document.createElement('div');
    debugContainer.className = 'debug-posts-container';
    debugContainer.style.border = '3px solid green';
    debugContainer.style.padding = '10px';
    debugContainer.style.margin = '10px 0';
    
    const debugHeader = document.createElement('h4');
    debugHeader.textContent = 'Debug Posts (Should be visible)';
    debugHeader.style.color = 'green';
    debugContainer.appendChild(debugHeader);
    
    // Aggiungi i primi 3 post come test
    posts.slice(0, 3).forEach((post, index) => {
      const postDiv = document.createElement('div');
      postDiv.className = 'debug-post';
      postDiv.style.backgroundColor = '#f5f5f5';
      postDiv.style.padding = '10px';
      postDiv.style.marginBottom = '10px';
      postDiv.style.border = '1px solid #ccc';
      
      postDiv.innerHTML = `
        <h3 style="margin-top:0">Post #${index+1}: ${post.title}</h3>
        <p><strong>Author:</strong> ${post.author}</p>
        <p><strong>Created:</strong> ${post.created}</p>
        <p><strong>Votes:</strong> ${post.net_votes}</p>
        <p><strong>Comments:</strong> ${post.children}</p>
      `;
      
      debugContainer.appendChild(postDiv);
    });
    
    // Aggiungi all'inizio del container
    if (this.postsContainer.firstChild) {
      this.postsContainer.insertBefore(debugContainer, this.postsContainer.firstChild);
    } else {
      this.postsContainer.appendChild(debugContainer);
    }
    
    console.log('Debug posts renderizzati con successo');
    console.groupEnd();
  }
}

export default CommunityView;