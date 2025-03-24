import InfiniteScroll from '../../utils/InfiniteScroll.js';
import router from '../../utils/Router.js';
import profileService from '../../services/ProfileService.js';
import UIComponents from '../../utils/UIComponents.js';

export default class CommentsList {
  constructor(username) {
    this.username = username;
    this.comments = [];
    this.allComments = [];
    this.page = 1;
    this.loading = false;
    this.hasMore = true;
    this.infiniteScroll = null;
    this.container = null;
    this.progressInterval = null;
  }
  
  async render(container) {
    this.container = container;
    
    const commentsContainer = document.createElement('div');
    commentsContainer.className = 'profile-posts';
    container.appendChild(commentsContainer);
    
    this.commentsContainer = commentsContainer;
    
    await this.loadComments();
    
    return commentsContainer;
  }
  
  async loadComments() {
    if (this.loading) return;

    if (!this.commentsContainer) return;

    // Imposta il flag per indicare che stiamo caricando i commenti
    this.loading = true;

    // Crea un contenitore per il contatore di progresso
    const createProgressIndicator = () => {
      const div = document.createElement('div');
      div.className = 'comments-progress';
      div.innerHTML = `
            <div class="loading-indicator">
                <div class="spinner"></div>
                <div class="loading-text">Caricamento commenti...</div>
                <div class="loading-batch">Recupero batch #1</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="loading-counter">0 commenti caricati</div>
            </div>
        `;
      return div;
    };

    // Pulisci il container e mostra l'indicatore di caricamento
    this.commentsContainer.innerHTML = '';
    const progressIndicator = createProgressIndicator();
    this.commentsContainer.appendChild(progressIndicator);

    // Registra l'ascoltatore per gli aggiornamenti di progresso
    const onProgress = (data) => {
      if (data.author !== this.username) return;

      const batchIndicator = progressIndicator.querySelector('.loading-batch');
      if (batchIndicator) batchIndicator.textContent = `Recupero batch #${data.batchNumber}`;

      const counter = progressIndicator.querySelector('.loading-counter');
      if (counter) counter.textContent = `${data.total} commenti caricati`;

      const progressBar = progressIndicator.querySelector('.progress-bar');
      if (progressBar) {
        // Non possiamo sapere il progresso totale, quindi mostriamo un'animazione pulsante
        progressBar.style.width = '100%';
        progressBar.style.animation = 'pulse 1.5s infinite';
      }
    };

    // Registra l'ascoltatore per il completamento
    const onLoaded = (data) => {
      if (data.username !== this.username) return;

      const counter = progressIndicator.querySelector('.loading-counter');
      if (counter) counter.textContent = `${data.total} commenti caricati`;

      const loadingText = progressIndicator.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = 'Caricamento completato!';

      const batchIndicator = progressIndicator.querySelector('.loading-batch');
      if (batchIndicator) batchIndicator.textContent = `Fonte: ${data.source === 'cache' ? 'cache' : 'blockchain'}`;

      // Rimuovi l'animazione pulsante e imposta al 100%
      const progressBar = progressIndicator.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#4caf50';
      }

      // Rimuovi gli ascoltatori
      if (window.eventEmitter) {
        window.eventEmitter.off('comments:progress', onProgress);
        window.eventEmitter.off('comments:loaded', onLoaded);
      }

      // Renderizza i commenti dopo un breve ritardo
      setTimeout(() => {
        this.renderLoadedComments(data.total);
      }, 500);
    };

    // Aggiungi gli ascoltatori di eventi
    if (window.eventEmitter) {
      window.eventEmitter.on('comments:progress', onProgress);
      window.eventEmitter.on('comments:loaded', onLoaded);
    }

    try {
      // Pulisci la cache della sessione se richiesto (quando si passa da un profilo all'altro)
      const cacheKey = `${this.username}_comments`;
      if (this.lastUsername && this.lastUsername !== this.username) {
        sessionStorage.removeItem(cacheKey);
      }
      this.lastUsername = this.username;

      // Carica la prima pagina di commenti
      // Il servizio caricherà tutti i commenti automaticamente se necessario
      const COMMENTS_PER_PAGE = 30;
      await profileService.getUserComments(this.username, COMMENTS_PER_PAGE, 1, true);

      // Il rendering verrà gestito dall'evento onLoaded
    } catch (error) {
      console.error('Errore caricamento commenti:', error);

      // Rimuovi gli ascoltatori in caso di errore
      if (window.eventEmitter) {
        window.eventEmitter.off('comments:progress', onProgress);
        window.eventEmitter.off('comments:loaded', onLoaded);
      }

      // Mostra messaggio di errore
      this.commentsContainer.innerHTML = `
            <div class="error-message">
                <h3>Errore caricamento commenti</h3>
                <p>Si è verificato un errore durante il caricamento dei commenti per @${this.username}</p>
                <p class="error-details">${error.message || 'Errore sconosciuto'}</p>
                <button class="retry-btn">Riprova</button>
            </div>
        `;

      // Aggiungi gestore per ritentare
      this.commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        sessionStorage.removeItem(cacheKey);
        this.loadComments();
      });
    } finally {
      this.loading = false;
    }
  }
  
  async renderLoadedComments(totalCount) {
    if (!this.commentsContainer) return;

    // Pulisci il container
    this.commentsContainer.innerHTML = '';

    try {
      // Mostra il contatore di commenti
      const countDiv = document.createElement('div');
      countDiv.className = 'comments-count';
      countDiv.innerHTML = `
            <div class="count-badge">${totalCount}</div>
            <div class="count-text">Commenti totali di @${this.username}</div>
        `;

      countDiv.style.margin = '20px 0';
      countDiv.style.textAlign = 'center';
      countDiv.style.fontWeight = 'bold';
      countDiv.style.background = 'var(--primary-color)';
      countDiv.style.color = 'var(--primary-text-color)';
      countDiv.style.padding = '10px 15px';
      countDiv.style.borderRadius = '8px';
      countDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      this.commentsContainer.appendChild(countDiv);

      // Carica sempre dalla prima pagina dopo il caricamento completo
      const BATCH_SIZE = 20; // Dimensione dei batch per la visualizzazione
      const comments = await profileService.getUserComments(this.username, BATCH_SIZE, 1);

      // Gestisci il caso in cui non ci siano commenti
      if (!comments || comments.length === 0) {
        this.commentsContainer.innerHTML = `
                <div class="empty-comments-message">
                    @${this.username} non ha ancora pubblicato commenti.
                </div>
            `;
        this.loading = false;
        return;
      }

      // Ottieni il riferimento a TUTTI i commenti (non solo la prima pagina)
      // Importante per l'infinite scroll
      const allCacheKey = `${this.username}_comments`;
      let allComments = [];

      // Prova a ottenere tutti i commenti dalla cache di sessione
      try {
        if (window.sessionStorage) {
          const savedComments = sessionStorage.getItem(allCacheKey);
          if (savedComments) {
            allComments = JSON.parse(savedComments);
            console.log(`Recuperati ${allComments.length} commenti totali da sessionStorage`);
          }
        }
      } catch (e) {
        console.warn('Errore nel recupero dei commenti da sessionStorage:', e);
      }

      // Se non abbiamo tutti i commenti in session storage, ottienili dal servizio
      if (!allComments || allComments.length === 0) {
        // Nella maggior parte dei casi dovremmo già averli nella cache del servizio
        // perché li abbiamo appena caricati
        const cachedComments = await profileService.getUserComments(this.username, totalCount, 1, false);
        allComments = cachedComments;
        console.log(`Recuperati ${allComments.length} commenti totali dal servizio`);
      }

      // Memorizza tutti i commenti
      this.allComments = allComments;

      // Renderizza il primo batch
      comments.forEach(comment => {
        const commentItem = this.createCommentItem(comment);
        this.commentsContainer.appendChild(commentItem);
      });

      // Imposta infinite scroll per i commenti rimanenti
      this.hasMore = totalCount > BATCH_SIZE;
      this.page = 2; // Inizia dalla pagina 2 la prossima volta
      this.setupSimpleCommentsInfiniteScroll(BATCH_SIZE, totalCount);
    } catch (error) {
      console.error('Errore nel rendering dei commenti:', error);
      this.commentsContainer.innerHTML = `
            <div class="error-message">
                <h3>Errore visualizzazione commenti</h3>
                <p>Si è verificato un errore durante la visualizzazione dei commenti.</p>
                <button class="retry-btn">Riprova</button>
            </div>
        `;

      this.commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.renderLoadedComments(totalCount);
      });
    }
  }
  
  setupSimpleCommentsInfiniteScroll(batchSize = 20, totalCount = 0) {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    if (!this.commentsContainer || !this.allComments) {
      console.warn('Container o commenti non disponibili per infinite scroll');
      return;
    }

    console.log(`Impostazione infinite scroll per ${this.allComments.length} commenti totali`);

    // Verifica che ci siano effettivamente più commenti da caricare
    if (this.allComments.length <= batchSize) {
      console.log('Nessun altro commento da caricare, infinite scroll non necessario');
      return;
    }

    // Crea un infiniteScroll che carica i commenti direttamente dalla memoria
    this.infiniteScroll = new InfiniteScroll({
      container: this.commentsContainer,
      loadMore: (page) => {
        // L'indice di pagina è 1-based, ma gli array sono 0-based
        const startIndex = (page - 1) * batchSize;

        // Verifica se abbiamo raggiunto la fine
        if (startIndex >= this.allComments.length) {
          console.log('Infinite scroll: fine dei commenti raggiunta');
          return false;
        }

        console.log(`Caricamento commenti per pagina ${page} (indice ${startIndex})`);

        // Calcola l'indice finale (non incluso)
        const endIndex = Math.min(startIndex + batchSize, this.allComments.length);

        // Estrai il batch di commenti
        const batch = this.allComments.slice(startIndex, endIndex);

        // Se non ci sono commenti in questo batch, fine
        if (batch.length === 0) return false;

        console.log(`Mostrando ${batch.length} commenti (${startIndex + 1}-${endIndex} di ${this.allComments.length})`);

        // Renderizza i commenti
        batch.forEach(comment => {
          const commentItem = this.createCommentItem(comment);
          this.commentsContainer.appendChild(commentItem);
        });

        // Se abbiamo raggiunto l'ultimo batch
        if (endIndex >= this.allComments.length) {
          // Aggiungi un messaggio "fine dei commenti"
          const endMessage = document.createElement('div');
          endMessage.className = 'comments-end-message';
          endMessage.innerHTML = `
                    <div class="end-message">
                        <span class="material-icons">check_circle</span>
                        Hai visualizzato tutti i ${this.allComments.length} commenti
                    </div>
                `;

          this.commentsContainer.appendChild(endMessage);

          return false; // Fine del caricamento
        }

        return true; // Continuiamo a caricare
      },
      threshold: '200px', // Inizia a caricare quando siamo a 200px dalla fine
      initialPage: this.page // Inizia dalla pagina corrente
    });

    console.log('Infinite scroll per commenti configurato con successo');
  }
  
  createCommentItem(comment) {
    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';

    // Add debug info to help troubleshoot
    if (comment.id) {
      commentItem.dataset.id = comment.id;
    }

    // Comment header with link to parent post
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';

    // Add parent post info
    const parentInfo = document.createElement('div');
    parentInfo.className = 'parent-post-info';

    const parentIcon = document.createElement('span');
    parentIcon.className = 'material-icons';
    parentIcon.textContent = 'reply';

    const parentText = document.createElement('span');
    parentText.textContent = `Comment on @${comment.parent_author}'s post`;

    parentInfo.appendChild(parentIcon);
    parentInfo.appendChild(parentText);

    // Modified to use hash-based routing format
    const parentLink = document.createElement('a');
    parentLink.className = 'parent-post-link';
    const parentRoute = `/@${comment.parent_author}/${comment.parent_permlink}`;
    // Use hash prefix for the route
    parentLink.href = `#${parentRoute}`;
    parentLink.textContent = 'View parent post';
    parentLink.dataset.route = parentRoute; // Store clean route for router navigation

    commentHeader.appendChild(parentInfo);
    commentHeader.appendChild(parentLink);

    // Comment metadata
    const commentMeta = document.createElement('div');
    commentMeta.className = 'comment-meta';

    // Comment date
    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    const formattedDate = new Date(comment.created).toLocaleString();
    commentDate.textContent = formattedDate;

    // Add votes info
    const votesInfo = document.createElement('span');
    votesInfo.className = 'comment-votes';
    const voteCount = comment.net_votes || 0;
    votesInfo.innerHTML = `<span class="material-icons">thumb_up</span> ${voteCount}`;

    commentMeta.appendChild(commentDate);
    commentMeta.appendChild(votesInfo);

    // Comment body
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.textContent = UIComponents.createExcerpt(comment.body, 300); // Longer excerpt

    // Assemble the comment
    commentItem.appendChild(commentHeader);
    commentItem.appendChild(commentMeta);
    commentItem.appendChild(commentBody);

    // Add click handler for the whole comment to navigate to the parent post
    commentItem.addEventListener('click', (e) => {
      // Prevent navigation if clicking on the specific link
      if (e.target === parentLink || parentLink.contains(e.target)) {
        return;
      }
      // Use the clean route from dataset for programmatic navigation
      router.navigate(parentLink.dataset.route);
    });

    // Add click handler for the link
    parentLink.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the parent click handler from firing
      e.preventDefault(); // Prevent default link behavior

      // Use the clean route from dataset for programmatic navigation
      router.navigate(parentLink.dataset.route);
    });

    return commentItem;
  }
  
  unmount() {
    // Clean up infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    // Clean up progress interval if it exists
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Rimuovi gli ascoltatori di eventi
    if (window.eventEmitter) {
      window.eventEmitter.off('comments:progress', this.onProgress);
      window.eventEmitter.off('comments:loaded', this.onLoaded);
    }
  }
}
