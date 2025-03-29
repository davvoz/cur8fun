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

  renderComments(comments, container) {
    if (!comments || comments.length === 0 || !container) return;
    
    comments.forEach(comment => {
      // Create a post-like card for the comment
      const commentCard = this._createPostLikeCommentCard(comment);
      container.appendChild(commentCard);
    });
  }

  _createPostLikeCommentCard(comment) {
    // Create a card similar to post cards
    const card = document.createElement('div');
    card.className = 'post-card comment-card';
    card.dataset.commentId = `${comment.author}_${comment.permlink}`;
    
    // Get the first image if any, for thumbnail
    const imageUrl = this._getFirstImageFromContent(comment.body) || '/assets/images/default-comment-thumbnail.jpg';
    
    // Format the date
    const date = new Date(comment.created);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
    
    // Extract a preview of the comment text (first 150 characters)
    const textPreview = this._stripMarkdown(comment.body).substring(0, 150) + '...';
    
    // Create the card HTML structure similar to post cards
    card.innerHTML = `
      <div class="card-header">
        <div class="author-info">
          <img src="https://steemitimages.com/u/${comment.author}/avatar/small" class="avatar" alt="${comment.author}" />
          <div class="author-details">
            <a href="/#/@${comment.author}" class="author-name">@${comment.author}</a>
            <span class="date">${formattedDate}</span>
          </div>
        </div>
      </div>
      <div class="card-thumbnail" style="background-image: url('${imageUrl}')"></div>
      <div class="card-content">
        <a href="/#/@${comment.author}/${comment.permlink}" class="comment-link">
          <h3 class="comment-title">Comment on: ${comment.root_title || 'a post'}</h3>
        </a>
        <p class="comment-text">${textPreview}</p>
      </div>
      <div class="card-footer">
        <div class="engagement">
          <span class="votes">
            <i class="fa fa-thumbs-up"></i> ${comment.net_votes || 0}
          </span>
          <span class="replies">
            <i class="fa fa-comment"></i> ${comment.children || 0}
          </span>
          <span class="payout">
            <i class="fa fa-dollar-sign"></i> ${comment.pending_payout_value || '$0.00'}
          </span>
        </div>
      </div>
    `;
    
    // Add click event to the card
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on author link
      if (e.target.closest('.author-name')) return;
      
      // Add # to the URL for proper routing
      window.location.href = `/#/@${comment.author}/${comment.permlink}`;
    });
    
    return card;
  }

  _getFirstImageFromContent(markdown) {
    // Extract the first image URL from markdown content
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const match = markdown.match(imageRegex);
    return match ? match[1] : null;
  }

  _stripMarkdown(markdown) {
    // Simple markdown stripping for preview text
    return markdown
      .replace(/#+\s(.*)/g, '$1') // Remove headings
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Replace links with just text
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
      .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
      .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n/g, ' '); // Replace newlines with spaces
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
