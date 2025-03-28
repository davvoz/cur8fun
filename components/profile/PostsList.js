import InfiniteScroll from '../../utils/InfiniteScroll.js';
import router from '../../utils/Router.js';
import UIComponents from '../../utils/UIComponents.js';
import profileService from '../../services/ProfileService.js';
import BasePostView from '../../views/BasePostView.js';

export default class PostsList extends BasePostView {
  constructor(username, useCache = false) {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    this.postsData = null; // Flag to indicate if data is cached
    this.allPosts = []; // Store fetched data
    this.page = 1;
    this.loading = false;
    this.hasMore = true;
    this.infiniteScroll = null;
    this.container = null;
    this.uiComponents = new UIComponents();
    this.progressInterval = null;
  }
  
  async render(container) {
    if (container) {
      this.container = container;
      this.postsContainer = container;
    }
    
    console.log("PostsList render called, useCache:", this.useCache, "postsData:", this.postsData);
    
    // Only fetch data if not already cached
    if (!this.postsData) {
      console.log("Fetching posts (not cached)");
      // Show loading state
      const loadingElement = document.createElement('div');
      loadingElement.className = 'posts-loading';
      loadingElement.innerHTML = '<div class="loading-spinner"></div><p>Loading posts...</p>';
      container.appendChild(loadingElement);
      
      try {
        // Fetch posts data
        await this.loadAllPosts();
        // Mark as cached
        this.postsData = true;
      } catch (error) {
        console.error('Error fetching posts:', error);
        container.innerHTML = `
          <div class="error-message">
            <h3>Error loading posts</h3>
            <p>${error.message || 'Unknown error'}</p>
            <button class="retry-btn">Retry</button>
          </div>
        `;
        
        container.querySelector('.retry-btn')?.addEventListener('click', () => {
          this.render(container);
        });
      } finally {
        // Remove loading indicator
        const existingLoader = container.querySelector('.posts-loading');
        if (existingLoader) {
          existingLoader.remove();
        }
      }
    } else {
      console.log("Using cached posts data");
      // If we already have cached data, just render it
      if (this.allPosts && this.allPosts.length > 0) {
        this.renderLoadedPosts(this.allPosts.length);
      }
    }
  }
  
  async loadAllPosts() {
    if (this.loading) return;
    if (!this.postsContainer) return;

    this.loading = true;

    // Mostra indicatore di caricamento
    const progressIndicator = this.createProgressIndicator();
    this.postsContainer.innerHTML = '';
    this.postsContainer.appendChild(progressIndicator);

    try {
      // Imposta un timer per aggiornare il contatore di progresso
      let postsCount = 0;
      let batchNumber = 1;
      
      // Funzione per aggiornare l'UI del progresso
      const updateProgress = (count, batch) => {
        const counter = progressIndicator.querySelector('.loading-counter');
        if (counter) counter.textContent = `${count} post caricati`;
        
        const batchIndicator = progressIndicator.querySelector('.loading-batch');
        if (batchIndicator) batchIndicator.textContent = `Recupero batch #${batch}`;
        
        const progressBar = progressIndicator.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.animation = 'pulse 1.5s infinite';
        }
      };
      
      // Inizia con un limite alto per recuperare più post possibile in un batch
      const POSTS_PER_PAGE = 100;
      let currentPage = 1;
      let hasMorePosts = true;
      let allPostsArray = [];
      
      // Crea un Set per tracciare i post unici
      const uniquePostIds = new Set();
      
      // Loop per caricare tutti i post disponibili
      while (hasMorePosts) {
        updateProgress(postsCount, batchNumber);
        
        // Carica un batch di post
        try {
          const params = { 
            forceRefresh: currentPage === 1,
            timeout: 30000 // Aumenta il timeout per i batch grandi
          };
          
          const newPosts = await profileService.getUserPosts(this.username, POSTS_PER_PAGE, currentPage, params);
          
          // Verifica se abbiamo ricevuto post validi
          if (!newPosts || newPosts.length === 0) {
            hasMorePosts = false;
          } else {
            // Filtra i post per assicurarsi che siano unici
            const uniqueNewPosts = newPosts.filter(post => {
              const postId = `${post.author}_${post.permlink}`;
              if (uniquePostIds.has(postId)) {
                return false;
              }
              uniquePostIds.add(postId);
              return true;
            });
            
            // Aggiungi i post unici all'array totale
            allPostsArray = [...allPostsArray, ...uniqueNewPosts];
            postsCount = allPostsArray.length;
            
            // Controlla se ci sono altri post da caricare
            hasMorePosts = newPosts.length >= POSTS_PER_PAGE;
            currentPage++;
            batchNumber++;
          }
        } catch (error) {
          console.error(`Errore caricamento batch ${batchNumber}:`, error);
          // Continua con il batch successivo nonostante l'errore
        }
        
        // Aggiorna l'UI
        updateProgress(postsCount, batchNumber);
        
        // Pausa breve per evitare di sovraccaricare l'API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Memorizza tutti i post recuperati
      this.allPosts = allPostsArray;
      
      // Aggiorna l'UI con il completamento
      const loadingText = progressIndicator.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = 'Caricamento completato!';
      
      const batchIndicator = progressIndicator.querySelector('.loading-batch');
      if (batchIndicator) batchIndicator.textContent = `Totale batch: ${batchNumber - 1}`;
      
      const progressBar = progressIndicator.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#4caf50';
      }
      
      // Mostra i post dopo una breve pausa
      setTimeout(() => {
        this.renderLoadedPosts(postsCount);
      }, 500);
      
    } catch (error) {
      console.error('Errore nel caricamento di tutti i post:', error);
      this.postsContainer.innerHTML = `
        <div class="error-message">
          <h3>Errore caricamento post</h3>
          <p>Si è verificato un errore durante il caricamento dei post per @${this.username}</p>
          <p class="error-details">${error.message || 'Errore sconosciuto'}</p>
          <button class="retry-btn">Riprova</button>
        </div>
      `;
      
      // Gestore per riprova
      this.postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.loadAllPosts();
      });
    } finally {
      this.loading = false;
    }
  }
  
  createProgressIndicator() {
    const div = document.createElement('div');
    div.className = 'posts-progress';
    div.innerHTML = `
      <div class="loading-indicator">
        <div class="spinner"></div>
        <div class="loading-text">Caricamento post...</div>
        <div class="loading-batch">Recupero batch #1</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="loading-counter">0 post caricati</div>
      </div>
    `;
    return div;
  }
  
  async renderLoadedPosts(totalCount) {
    if (!this.postsContainer) return;

    // Clear container content but preserve the element
    this.postsContainer.innerHTML = '';
    
    // Make sure we apply the current grid layout
    const currentLayout = this.gridController.settings.layout || 'grid';
    this.postsContainer.className = `posts-container grid-layout-${currentLayout}`;

    try {
      // Mostra il contatore di post
     
      if (!this.allPosts || this.allPosts.length === 0) {
        this.postsContainer.innerHTML = `
          <div class="empty-posts-message">
            @${this.username} non ha ancora pubblicato post.
          </div>
        `;
        return;
      }

      // Create a wrapper for cards that will manage the grid layout
      const postsWrapper = document.createElement('div');
      postsWrapper.className = 'posts-cards-wrapper';
      
      // Apply matching layout class to wrapper
      postsWrapper.classList.add(`layout-${currentLayout}`);
      
      // Append wrapper to container
      this.postsContainer.appendChild(postsWrapper);

      // Renderizza il primo batch di post
      const BATCH_SIZE = 20;
      const firstBatch = this.allPosts.slice(0, BATCH_SIZE);
      
      firstBatch.forEach(post => {
        const postItem = this.createPostItem(post);
        postsWrapper.appendChild(postItem);
      });

      // Log for debugging
      console.log(`Rendered ${firstBatch.length} posts with layout: ${currentLayout}`);

      // Imposta infinite scroll per i post rimanenti
      this.hasMore = totalCount > BATCH_SIZE;
      this.page = 2; // Inizia dalla pagina 2 la prossima volta
      this.setupBatchedInfiniteScroll(BATCH_SIZE, totalCount, postsWrapper);
      
      // Emit a custom event that posts are ready
      window.dispatchEvent(new CustomEvent('posts-rendered', {
        detail: { container: this.postsContainer }
      }));
      
      // Reapply grid settings after posts are rendered
      this.gridController.target = this.postsContainer;
      this.gridController.applySettings();
      
      // Force re-apply settings to ensure layout is applied
      setTimeout(() => {
        this.gridController.applySettings();
      }, 100);
    } catch (error) {
      console.error('Errore nel rendering dei post:', error);
      this.postsContainer.innerHTML = `
        <div class="error-message">
          <h3>Errore visualizzazione post</h3>
          <p>Si è verificato un errore durante la visualizzazione dei post.</p>
          <button class="retry-btn">Riprova</button>
        </div>
      `;

      this.postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.renderLoadedPosts(totalCount);
      });
    }
  }
  
  setupBatchedInfiniteScroll(batchSize = 20, totalCount = 0, postsWrapper) {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    if (!this.postsContainer || !this.allPosts || !postsWrapper) {
      console.warn('Container, wrapper o post non disponibili per infinite scroll');
      return;
    }

    console.log(`Impostazione infinite scroll per ${this.allPosts.length} post totali`);

    // Verifica che ci siano effettivamente più post da caricare
    if (this.allPosts.length <= batchSize) {
      console.log('Nessun altro post da caricare, infinite scroll non necessario');
      return;
    }

    // Crea un infiniteScroll che carica i post direttamente dalla memoria
    this.infiniteScroll = new InfiniteScroll({
      container: this.postsContainer,
      loadMore: (page) => {
        // L'indice di pagina è 1-based, ma gli array sono 0-based
        const startIndex = (page - 1) * batchSize;

        // Verifica se abbiamo raggiunto la fine
        if (startIndex >= this.allPosts.length) {
          console.log('Infinite scroll: fine dei post raggiunta');
          return false;
        }

        console.log(`Caricamento post per pagina ${page} (indice ${startIndex})`);

        // Calcola l'indice finale (non incluso)
        const endIndex = Math.min(startIndex + batchSize, this.allPosts.length);

        // Estrai il batch di post
        const batch = this.allPosts.slice(startIndex, endIndex);

        // Se non ci sono post in questo batch, fine
        if (batch.length === 0) return false;

        console.log(`Mostrando ${batch.length} post (${startIndex + 1}-${endIndex} di ${this.allPosts.length})`);

        // Renderizza i post
        batch.forEach(post => {
          const postItem = this.createPostItem(post); // Corretto l'errore qui (era this.re...)
          postsWrapper.appendChild(postItem);
        });

        // Se abbiamo raggiunto l'ultimo batch
        if (endIndex >= this.allPosts.length) {
          // Aggiungi un messaggio "fine dei post"
          const endMessage = document.createElement('div');
          endMessage.className = 'posts-end-message';
          endMessage.innerHTML = `
            <div class="end-message">
              <span class="material-icons">check_circle</span>
              Hai visualizzato tutti i ${this.allPosts.length} post
            </div>
          `;

          this.postsContainer.appendChild(endMessage);

          return false; // Fine del caricamento
        }

        return true; // Continuiamo a caricare
      },
      threshold: '200px', // Inizia a caricare quando siamo a 200px dalla fine
      initialPage: this.page // Inizia dalla pagina corrente
    });

    console.log('Infinite scroll per post configurato con successo');
  }
  
  createPostItem(post) {
    if (!post) {
      console.error('Cannot create post item: post data is missing');
      return document.createElement('div');
    }

    // Create post container - use the same class as in BasePostView
    const postItem = document.createElement('div');
    postItem.className = 'post-card';
    postItem.dataset.postId = `${post.author}_${post.permlink}`;

    // Parse metadata to extract better images and tags
    const metadata = this.parseMetadata(post.json_metadata);
    
    // Get the best available image
    const imageUrl = this.getBestImage(post, metadata);
    
    // 1. Add header (author info) - Always at the top
    postItem.appendChild(this.createPostHeader(post));
    
    // 2. Main content - can be vertical or horizontal depending on layout
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';
    
    // 2a. Add image preview
    mainContent.appendChild(this.createPostImage(imageUrl, post.title));
    
    // 2b. Wrapper for text content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Middle section with title, excerpt, tags
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Title
    contentMiddle.appendChild(this.createPostTitle(post.title));
    
    // Excerpt for list layout
    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body);
      // Make sure all links are completely removed from the excerpt
      excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
    }
    
    // Tags
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }
    
    contentWrapper.appendChild(contentMiddle);
    
    // Actions (votes, comments, payout)
    contentWrapper.appendChild(this.createPostActions(post));
    
    // Add text content to main content
    mainContent.appendChild(contentWrapper);
    
    // Add main content to card
    postItem.appendChild(mainContent);
    
    // Click event - Navigate to post
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
    
    // Add retry mechanism for avatars
    let retryCount = 0;
    
    const loadAvatar = () => {
      // Try multiple sources in sequence
      const avatarSources = [
        `https://steemitimages.com/u/${post.author}/avatar`,
        `https://images.hive.blog/u/${post.author}/avatar`
      ];
      
      let currentSourceIndex = 0;
      
      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          // We've tried all sources, use default
          avatar.src = './assets/img/default-avatar.png';
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
    if (!imageUrl || imageUrl === './assets/img/placeholder.png') {
      // Skip the loading process entirely and use placeholder immediately
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
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
      image.src = './assets/img/placeholder.png';
    };
    
    // Start loading with first size option
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
    
    // Fallback method 2: Try the get preview image method
    const previewImageUrl = this.getPreviewImage(post);
    if (previewImageUrl) {
      return previewImageUrl;
    }
    
    // Fallback method 3: Simple regex extraction of first image
    const imgRegex = /https?:\/\/[^\s'"<>]+?\.(jpg|jpeg|png|gif|webp)(\?[^\s'"<>]+)?/i;
    const match = post.body.match(imgRegex);
    if (match) {
      return match[0];
    }
    
    // Return placeholder if no image is found
    return './assets/img/placeholder.png';
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

  getCardConfig() {
    if (!this.container) return { size: 'medium', layout: 'grid' };
    
    const postsContainer = this.postsContainer || this.container.querySelector('.posts-container');
    if (!postsContainer) return { size: 'medium', layout: 'grid' };
    
    // We only care about layout now, but keep size for backward compatibility
    let size = 'medium';
    
    // Determine layout type
    let layout = 'grid';
    if (postsContainer.classList.contains('grid-layout-list')) layout = 'list';
    if (postsContainer.classList.contains('grid-layout-compact')) layout = 'compact';
    
    return { size, layout };
  }

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

  // We can keep this method for backward compatibility with existing code
  addPostThumbnail(element, post) {
    const imageUrl = this.getBestImage(post, this.parseMetadata(post.json_metadata));
    element.appendChild(this.createPostImage(imageUrl, post.title));
  }

  // Keep the method signature but update the implementation
  addPostTitle(container, post) {
    container.appendChild(this.createPostTitle(post.title));
  }

  // Keep the method signature but update the implementation
  addPostExcerpt(container, post) {
    const excerpt = document.createElement('div');
    excerpt.className = 'post-excerpt';
    const textExcerpt = this.createExcerpt(post.body);
    // Make sure all links are completely removed from the excerpt
    excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    container.appendChild(excerpt);
  }

  // Keep the method signature but update the implementation
  addPostNavigationHandler(element, post) {
    if (post.author && post.permlink) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(`/@${post.author}/${post.permlink}`);
      });
    }
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
    //usiamo la prima immagine trovata nel post
    const imageUrl = metadata?.image?.[0];
    //se non c'è immagine nel post, cerchiamo se nel body c'è un link ad un'immagine
    const body = post.body || '';
    const regex = /!\[.*?\]\((.*?)\)/;
    const match = body.match(regex);
    const imageUrlFromBody = match ? match[1] : null;
    //ritorniamo la prima immagine trovata
    return imageUrl || imageUrlFromBody;
  }
  
  loadMorePosts(page) {
    if (this.infiniteScroll) {
      this.infiniteScroll.loadMore(page);
    }
  }
  
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Properly disconnect the grid controller
    if (this.gridController) {
      this.gridController.target = null;
      this.gridController.unmount();
    }
  }
  
  getGridType() {
    // Use the gridController's current layout setting
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }
  
  // Add this method to refresh the grid layout
  refreshLayout() {
    if (this.gridLayout) {
      // If using Masonry, isotope or similar library
      this.gridLayout.layout();
    }
  }

  // Add this method to set container after initialization
  setContainer(container) {
    if (container) {
      this.container = container;
      this.postsContainer = container;
    }
    return this;
  }

  // Add reset method to ensure component can be reused
  reset() {
    // Keep cached data but reset UI-related properties
    this.loading = false;
    this.infiniteScroll = null;
    return this;
  }

  // Enhance refreshGridLayout for better reliability
  refreshGridLayout() {
    console.log("Refreshing posts grid layout");
    
    if (!this.postsContainer) {
      console.warn("No posts container available for refresh");
      return;
    }
    
    // If we have posts data but it's not displayed yet, render it
    if (this.allPosts && this.allPosts.length > 0 && 
        (!this.postsContainer.children.length || 
         !this.postsContainer.querySelector('.post-card'))) {
      console.log("Posts data exists but not rendered, rendering now");
      this.renderLoadedPosts(this.allPosts.length);
      return;
    }
    
    // Otherwise just refresh the layout
    if (this.gridController) {
      this.gridController.target = this.postsContainer;
      setTimeout(() => {
        this.gridController.applySettings();
      }, 50);
    }
  }
}
