import InfiniteScroll from '../../utils/InfiniteScroll.js';

export default class CommentUIManager {
  constructor(container, renderer) {
    this.container = container;
    this.renderer = renderer;
    this.infiniteScroll = null;
  }

  showLoadingState() {
    if (!this.container) return;
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'comments-loading';
    loadingElement.innerHTML = '<div class="loading-spinner"></div><p>Loading comments...</p>';
    this.container.innerHTML = '';
    this.container.appendChild(loadingElement);
  }

  createProgressIndicator() {
    const div = document.createElement('div');
    div.className = 'comments-progress';
    div.innerHTML = `
      <div class="loading-indicator">
        <div class="spinner"></div>
        <div class="loading-text">Caricamento commenti...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="loading-counter">Recupero commenti...</div>
      </div>
    `;
    return div;
  }

  updateLoadingProgress() {
    const progressBar = this.container.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.style.animation = 'pulse 1.5s infinite';
    }
  }

  showLoadingComplete(commentCount) {
    const loadingText = this.container.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = 'Caricamento completato!';
    
    const counter = this.container.querySelector('.loading-counter');
    if (counter) counter.textContent = `${commentCount} commenti caricati`;
    
    const progressBar = this.container.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.style.animation = 'none';
      progressBar.style.width = '100%';
      progressBar.style.backgroundColor = '#4caf50';
    }
  }

  setupLayout(layout) {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.container.className = `comments-container grid-layout-${layout}`;
  }

  createCommentsWrapper(layout) {
    const wrapper = document.createElement('div');
    wrapper.className = 'comments-cards-wrapper';
    wrapper.classList.add(`layout-${layout}`);
    this.container.appendChild(wrapper);
    return wrapper;
  }

  renderComments(comments, wrapper) {
    comments.forEach(comment => {
      const commentItem = this.renderer.renderComment(comment);
      wrapper.appendChild(commentItem);
    });
  }

  setupInfiniteScroll(loadMoreFn, wrapper, initialPage = 1) {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }

    console.log(`Initializing InfiniteScroll with page ${initialPage}`);
    
    // Creiamo una funzione wrapper che chiama loadMoreFn e ritorna il risultato
    const loadMoreCallback = async (page) => {
      console.log(`InfiniteScroll calling loadMore for page ${page}`);
      return await loadMoreFn(page);
    };
    
    this.infiniteScroll = new InfiniteScroll({
      container: this.container,
      loadMore: loadMoreCallback,
      threshold: '200px',
      initialPage: initialPage,
      loadingMessage: 'Caricamento altri commenti...',
      endMessage: 'Nessun altro commento da caricare',
      errorMessage: 'Errore nel caricamento dei commenti. Riprova.'
    });
  }

  showError(error) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message">
        <h3>Error loading comments</h3>
        <p>${error.message || 'Unknown error'}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;
    
    this.container.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.container.innerHTML = '';
      this.container.dispatchEvent(new CustomEvent('retry-comments'));
    });
  }

  cleanup() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    const loadingElement = this.container?.querySelector('.comments-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }
}
