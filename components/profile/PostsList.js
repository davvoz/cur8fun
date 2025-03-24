import InfiniteScroll from '../../utils/InfiniteScroll.js';
import router from '../../utils/Router.js';
import UIComponents from '../../utils/UIComponents.js';
import profileService from '../../services/ProfileService.js';
import BasePostView from '../../views/BasePostView.js';

export default class PostsList extends BasePostView {
  constructor(username) {
    super(); // This initializes gridController from BasePostView
    this.username = username;
    this.posts = [];
    this.allPosts = []; // Aggiunto per memorizzare tutti i post
    this.page = 1;
    this.loading = false;
    this.hasMore = true;
    this.infiniteScroll = null;
    this.container = null;
    this.uiComponents = new UIComponents();
    this.progressInterval = null;
  }
  
  async render(container) {
    this.container = container;
    
    // Create outer container
    const outerContainer = document.createElement('div');
    outerContainer.className = 'posts-outer-container';
    container.appendChild(outerContainer);
    
    // Create grid controls container
    const gridControlsContainer = document.createElement('div');
    gridControlsContainer.className = 'grid-controller-container';
    outerContainer.appendChild(gridControlsContainer);
    
    // Render grid controller
    this.gridController.render(gridControlsContainer);
    
    // Create the posts container
    const postsContainer = document.createElement('div');
    postsContainer.id = `posts-container-${Date.now()}`;
    postsContainer.className = 'posts-container';
    outerContainer.appendChild(postsContainer);
    
    // Store reference to posts container
    this.postsContainer = postsContainer;
    
    await this.loadAllPosts();
    
    return this.postsContainer;
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

    // Clear the container but maintain any layout classes from GridController
    const currentLayout = this.gridController.settings.layout || 'grid';
    this.postsContainer.innerHTML = '';
    this.postsContainer.className = `posts-container grid-layout-${currentLayout}`;

    try {
      // Mostra il contatore di post
      const countDiv = document.createElement('div');
      countDiv.className = 'posts-count';
      countDiv.innerHTML = `
        <div class="count-badge">${totalCount}</div>
        <div class="count-text">Post totali di @${this.username}</div>
      `;

      countDiv.style.margin = '20px 0';
      countDiv.style.textAlign = 'center';
      countDiv.style.fontWeight = 'bold';
      countDiv.style.background = 'var(--primary-color)';
      countDiv.style.color = 'var(--primary-text-color)';
      countDiv.style.padding = '10px 15px';
      countDiv.style.borderRadius = '8px';
      countDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      this.postsContainer.appendChild(countDiv);

      // Gestisci il caso in cui non ci siano post
      if (!this.allPosts || this.allPosts.length === 0) {
        this.postsContainer.innerHTML = `
          <div class="empty-posts-message">
            @${this.username} non ha ancora pubblicato post.
          </div>
        `;
        return;
      }

      // Renderizza il primo batch di post
      const BATCH_SIZE = 20;
      const firstBatch = this.allPosts.slice(0, BATCH_SIZE);
      
      firstBatch.forEach(post => {
        const postItem = this.createPostItem(post);
        this.postsContainer.appendChild(postItem);
      });

      // Log for debugging
      console.log(`Rendered ${firstBatch.length} posts. Grid controller should find them at:`, this.postsContainer.className);

      // Imposta infinite scroll per i post rimanenti
      this.hasMore = totalCount > BATCH_SIZE;
      this.page = 2; // Inizia dalla pagina 2 la prossima volta
      this.setupBatchedInfiniteScroll(BATCH_SIZE, totalCount);
      
      // Emit a custom event that posts are ready
      window.dispatchEvent(new CustomEvent('posts-rendered', {
        detail: { container: this.postsContainer }
      }));
      
      // Reapply grid settings after posts are rendered
      this.gridController.target = this.postsContainer;
      this.gridController.applySettings();
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
  
  setupBatchedInfiniteScroll(batchSize = 20, totalCount = 0) {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    if (!this.postsContainer || !this.allPosts) {
      console.warn('Container o post non disponibili per infinite scroll');
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
          const postItem = this.createPostItem(post);
          this.postsContainer.appendChild(postItem);
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

    // Create post container
    const postItem = document.createElement('div');
    postItem.className = 'post-card';
    postItem.dataset.postId = `${post.author}_${post.permlink}`;

    // Add thumbnail with error handling
    this.addPostThumbnail(postItem, post);

    // Create content container
    const postContent = document.createElement('div');
    postContent.className = 'post-content';

    // Add title
    this.addPostTitle(postContent, post);

    // Add metadata
    const postMeta = this.createPostMetadata(post);
    postContent.appendChild(postMeta);

    // Add excerpt
    this.addPostExcerpt(postContent, post);

    postItem.appendChild(postContent);

    // Add click handler
    this.addPostNavigationHandler(postItem, post);

    return postItem;
  }
  
  addPostThumbnail(element, post) {
    const placeholderImage = 'assets/img/placeholder.png';
    const imageUrl = this.getPreviewImage(post) || placeholderImage;

    const thumbnail = document.createElement('div');
    thumbnail.className = 'post-thumbnail'; // Remove fixed grid class to allow dynamic switching
    thumbnail.style.backgroundImage = `url(${imageUrl})`;

    // Add image error handling
    const testImg = new Image();
    testImg.onerror = () => {
      thumbnail.style.backgroundImage = `url(${placeholderImage})`;
    };
    testImg.src = imageUrl;

    element.appendChild(thumbnail);
  }

  addPostTitle(container, post) {
    const title = document.createElement('h3');
    title.className = 'post-title';
    title.textContent = post.title || '(Untitled)';
    container.appendChild(title);
  }

  addPostExcerpt(container, post) {
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = UIComponents.createExcerpt(post.body || '');
    container.appendChild(excerpt);
  }

  addPostNavigationHandler(element, post) {
    if (post.author && post.permlink) {
      element.addEventListener('click', () => {
        router.navigate(`/@${post.author}/${post.permlink}`);
      });
    }
  }

  createPostMetadata(post) {
    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';

    // Date info
    const createdDate = post.created ? new Date(post.created).toLocaleDateString() : 'Unknown date';
    const dateInfo = UIComponents.createMetadataItem('schedule', createdDate, 'post-date');

    // Votes info
    const totalVotes = this.getVoteCount(post);
    const votesInfo = UIComponents.createMetadataItem('thumb_up', totalVotes.toLocaleString(), 'post-votes');

    // Comments info
    const commentsCount = post.children !== undefined ? post.children : 0;
    const commentsInfo = UIComponents.createMetadataItem('chat_bubble', commentsCount.toString(), 'post-comments');

    postMeta.appendChild(dateInfo);
    postMeta.appendChild(votesInfo);
    postMeta.appendChild(commentsInfo);

    return postMeta;
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
    
    // Make sure to unmount the grid controller too
    if (this.gridController) {
      this.gridController.unmount();
    }
  }
  
  getGridType() {
    // Use the gridController's current layout setting
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }
}
