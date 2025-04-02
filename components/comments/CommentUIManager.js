import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../../components/LoadingIndicator.js';

export default class CommentUIManager {
  constructor(container, renderer) {
    this.container = container;
    this.renderer = renderer;
    this.infiniteScroll = null;
    this.loadingIndicator = null;
  }

  showLoadingState() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.loadingIndicator = new LoadingIndicator('spinner');
    this.loadingIndicator.show(this.container, 'Loading comments...');
  }

  createProgressIndicator() {
    this.container.innerHTML = '';
    this.loadingIndicator = new LoadingIndicator('progressBar');
    this.loadingIndicator.show(this.container, 'Caricamento commenti...');
    
    // Add counter element
    const counter = document.createElement('div');
    counter.className = 'loading-counter';
    counter.textContent = 'Recupero commenti...';
    this.loadingIndicator.element.appendChild(counter);
    
    return this.loadingIndicator.element;
  }

  updateLoadingProgress() {
    if (this.loadingIndicator && this.loadingIndicator.type === 'progressBar') {
      this.loadingIndicator.updateProgress(100);
    }
  }

  showLoadingComplete(commentCount) {
    if (!this.loadingIndicator) return;
    
    if (this.loadingIndicator.element.querySelector('.loading-text')) {
      this.loadingIndicator.element.querySelector('.loading-text').textContent = 'Caricamento completato!';
    }
    
    const counter = this.loadingIndicator.element.querySelector('.loading-counter');
    if (counter) counter.textContent = `${commentCount} commenti caricati`;
    
    if (this.loadingIndicator.type === 'progressBar') {
      this.loadingIndicator.updateProgress(100);
      const fill = this.loadingIndicator.element.querySelector('.progress-fill');
      if (fill) {
        fill.style.animation = 'none';
        fill.style.backgroundColor = '#4caf50';
      }
    }
  }

  setupLayout(layout, options = {}) {
    if (!this.container) return;
    
    console.log(`[CommentUIManager] Setting up layout: ${layout}, useCardLayout: ${options.useCardLayout}`);
    
    this.container.innerHTML = '';
    this.container.className = `comments-container grid-layout-${layout}`;
    
    // Add additional classes for card layout if specified
    if (options.useCardLayout) {
      this.container.classList.add('card-layout');
      console.log(`[CommentUIManager] Added card-layout class`);
    }
  }

  createCommentsWrapper(layout) {
    const wrapper = document.createElement('div');
    wrapper.className = 'comments-cards-wrapper';
    wrapper.classList.add(`layout-${layout}`);
    this.container.appendChild(wrapper);
    
    console.log(`[CommentUIManager] Created comments wrapper with layout: ${layout}`);
    
    return wrapper;
  }

  renderComments(comments, container) {
    if (!comments || comments.length === 0 || !container) {
      console.warn(`[CommentUIManager] No comments to render or no container`);
      return;
    }
    
    console.log(`[CommentUIManager] Rendering ${comments.length} comments`);
    
    comments.forEach((comment, index) => {
      // Log dettagli del commento
      console.log(`[CommentUIManager] Rendering comment ${index + 1}/${comments.length}:`, {
        id: `${comment.author}_${comment.permlink}`,
        author: comment.author,
        created: comment.created,
        votes: comment.net_votes || 0
      });
      
      // Create a post-like card for the comment
      const commentCard = this._createPostLikeCommentCard(comment);
      container.appendChild(commentCard);
    });
    
    console.log(`[CommentUIManager] Completed rendering ${comments.length} comments`);
  }

  _createPostLikeCommentCard(comment) {
    // Create a card similar to post cards
    const card = document.createElement('div');
    card.className = 'post-card comment-card';
    card.dataset.commentId = `${comment.author}_${comment.permlink}`;
    
    // Get the first image if any, for thumbnail
    const imageUrl = this._getFirstImageFromContent(comment.body);
    
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
    let cardHTML = `
      <div class="card-header">
        <div class="author-info">
          <img src="https://steemitimages.com/u/${comment.author}/avatar/small" class="avatar" alt="${comment.author}" />
          <div class="author-details">
            <div class="author-name">@${comment.author}</div>
            <span class="date">${formattedDate}</span>
          </div>
        </div>
      </div>`;
      
    // Only add thumbnail section if an image was found
    if (imageUrl) {
      cardHTML += `<div class="card-thumbnail" style="background-image: url('${imageUrl}')"></div>`;
    }
    
    cardHTML += `
      <div class="card-content">
        <h3 class="comment-title">Comment on: ${comment.root_title || 'a post'}</h3>
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
    
    card.innerHTML = cardHTML;
    
    // Add click event to the card
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on author link
      if (e.target.closest('.author-name')) return;
      
      // Get the base URL (everything before the hash) to preserve deployment path
      const baseUrl = window.location.href.split('#')[0];
      // Add # to the URL for proper routing
      window.location.href = `${baseUrl}#/@${comment.author}/${comment.permlink}`;
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
    
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
      this.loadingIndicator = null;
    }
  }
}
