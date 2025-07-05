import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../../components/LoadingIndicator.js';
import ContentRenderer from '../ContentRenderer.js';
import router from '../../utils/Router.js';

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (match) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
     '>': '&gt;',
     '"': '&quot;',
     "'": '&#39;'
    };
    return escapeMap[match];
  });
}

export default class CommentUIManager {
  constructor(container, renderer) {
    this.container = container;
    this.renderer = renderer;
    this.infiniteScroll = null;
    this.loadingIndicator = null;

    // Inizializza ContentRenderer per il rendering markdown
    this.contentRenderer = new ContentRenderer({
      containerClass: 'comment-content-body',
      imageClass: 'comment-image',
      maxImageWidth: 600,
      useSteemContentRenderer: true,
      enableYouTube: true
    });
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

    // Always use list layout
    this.container.innerHTML = '';
    this.container.className = 'comments-container comments-list-view';

    // No need for card layout class anymore
  }

  createCommentsWrapper(layout) {
    const wrapper = document.createElement('div');
    wrapper.className = 'comments-list-wrapper';
    this.container.appendChild(wrapper);

    return wrapper;
  }

  renderComments(comments, container) {
    if (!comments || comments.length === 0 || !container) {
      console.warn(`[CommentUIManager] No comments to render or no container`);
      return;
    }

    // Clear any existing class
    container.className = 'comments-list-wrapper';

    comments.forEach((comment, index) => {
      // Create a list-style comment item
      const commentItem = this._createListStyleComment(comment);
      container.appendChild(commentItem);
    });
  }

  _createListStyleComment(comment) {
    // Create elegant list-style comment
    const item = document.createElement('div');
    item.className = 'comment-list-item';
    item.dataset.commentId = `${comment.author}_${comment.permlink}`;

    // Format the date
    const postDate = new Date(comment.created);
    const date = document.createElement('div');
    date.className = 'comment-date';
    let formattedDate ;
    // Calculate time elapsed since post creation in minutes
        // Calculate time elapsed since post creation in minutes
        const timeElapsed = Math.floor((Date.now() - postDate.getTime()) / 1000 / 60);
        if (timeElapsed < 60) {
          date.textContent = `${timeElapsed} min ago`;
        } else if (timeElapsed < 24 * 60) {
          // Convert minutes to hours
          date.textContent = `${Math.floor(timeElapsed / 60)} hours ago`;
        } else if (timeElapsed < 30 * 24 * 60) {
          // Convert minutes to days
          date.textContent = `${Math.floor(timeElapsed / (24 * 60))} days ago`;
        } else if (timeElapsed < 365 * 24 * 60) {
          // Convert minutes to months
          date.textContent = `${Math.floor(timeElapsed / (30 * 24 * 60))} months ago`;
        } else {
          date.textContent = postDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
    formattedDate = date.textContent;
    // Add the date to the comment item
    item.appendChild(date);
    
    // Create the parent post info text
    const parentInfo = comment.root_title ?
      `<div class="comment-parent">
        <span class="parent-icon"><i class="fa fa-reply-all"></i></span>
        <span class="parent-title">Re: ${comment.root_title}</span>
      </div>` : '';

    // Create avatar and header structure
    item.innerHTML = `
      <div class="comment-avatar">
        <img src="https://steemitimages.com/u/${comment.author}/avatar/small" alt="${comment.author}" />
      </div>
      <div class="comment-content">
        <div class="comment-header">
          <div class="comment-author">@${comment.author}</div>
          <div class="comment-date">${escapeHTML(formattedDate)}</div>
        </div>
        ${parentInfo}
        <div class="comment-body markdown-content">
          <!-- Il contenuto markdown sarà inserito qui -->
        </div>
        <div class="comment-footer">
          <div class="comment-actions">
            <span class="comment-votes">
              <i class="fa fa-arrow-up"></i> ${comment.active_votes.length || 0}
            </span>
            <span class="comment-replies">
              <i class="fa fa-comment"></i> ${comment.children || 0}
            </span>
            <span class="comment-value">
              <i class="fa fa-dollar-sign"></i> ${comment.pending_payout_value || '$0.00'}
            </span>
          </div>
        </div>
      </div>
    `;

    // Renderizza il markdown utilizzando ContentRenderer
    try {
      const commentBody = item.querySelector('.comment-body');
      if (commentBody) {
        const renderedContent = this.contentRenderer.render({
          body: comment.body || ''
        });

        if (renderedContent && renderedContent.container) {
          // Svuota il div del commento prima di aggiungere il contenuto renderizzato
          while (commentBody.firstChild) {
            commentBody.removeChild(commentBody.firstChild);
          }

          // Aggiungi il contenuto renderizzato
          commentBody.appendChild(renderedContent.container);
        } else {
          // Fallback in caso di errore di rendering
          commentBody.textContent = this._stripMarkdown(comment.body);
        }
      }
    } catch (error) {
      console.error('Error rendering markdown content:', error);
      // Fallback a testo normale in caso di errore
      const commentBody = item.querySelector('.comment-body');
      if (commentBody) {
        commentBody.textContent = this._stripMarkdown(comment.body);
      }
    }

    // Add click event to the item
    item.addEventListener('click', (e) => {
      // Don't navigate if clicking on author link
      if (e.target.closest('.comment-author')) return;

      // Usa il router per navigare correttamente alla vista commenti
      const commentPath = `/comment/@${comment.author}/${comment.permlink}`;
      router.navigate(commentPath);
    });

    return item;
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
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 280) + (markdown.length > 280 ? '...' : ''); // Limit length and add ellipsis if needed
  }

  setupInfiniteScroll(loadMoreFn, wrapper, initialPage = 1) {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }

    // Create a wrapper function that calls loadMoreFn and returns the result
    const loadMoreCallback = async (page) => {
      return await loadMoreFn(page);
    };

    this.infiniteScroll = new InfiniteScroll({
      container: this.container,
      loadMore: loadMoreCallback,
      threshold: '200px',
      initialPage: initialPage,
      loadingMessage: 'Loading more comments...',
      endMessage: 'No more comments to load',
      errorMessage: 'Error loading comments. Please try again.'
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
