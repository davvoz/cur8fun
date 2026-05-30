import VotesPopup from './VotesPopup.js';
import PayoutInfoPopup from './PayoutInfoPopup.js';
import RebloggersPopup from './RebloggersPopup.js';
import authService from '../../services/AuthService.js';
import reblogService from '../../services/ReblogService.js';
import { applyDeclinedPayoutStyle } from '../../utils/PayoutUtils.js';

class PostActions {
  constructor(post, upvoteCallback, commentCallback, shareCallback, editCallback, reblogCallback, canEdit = false, hasReblogged = false, showReblog = true, showShareEditInFooter = true) {
    this.post = post;
    this.upvoteCallback = upvoteCallback;
    this.commentCallback = commentCallback;
    this.shareCallback = shareCallback;
    this.editCallback = editCallback; 
    this.reblogCallback = reblogCallback;
    this.canEdit = canEdit;
    this.hasReblogged = hasReblogged;
    this.showReblog = showReblog;
    this.showShareEditInFooter = showShareEditInFooter;
    this.reblogCount = Array.isArray(post.reblogged_by)
      ? post.reblogged_by.length
      : (post.first_reblogged_by ? 1 : 0);
    
    // Bind methods
    this.handlePayoutClick = this.handlePayoutClick.bind(this);
    this.handleVotesClick = this.handleVotesClick.bind(this);
    this.handleReblogCountClick = this.handleReblogCountClick.bind(this);
  }

  render() {
    const isMobile = window.innerWidth <= 768; // Check if the device is mobile
    const postActions = document.createElement('div');
    postActions.className = 'post-actions-post';

    // Creiamo il pulsante upvote con contatore cliccabile per mostrare i votanti
    const upvoteBtn = this.createUpvoteButtonWithClickableCount();
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.showShareEditInFooter
      ? this.createActionButton('share-btn', 'share', isMobile ? '' : 'Share')
      : null;
    
    // Aggiungiamo il pulsante reblog (resteem) solo se non è un commento
    let reblogBtn = null;
    let reblogCountBtn = null;
    if (this.showReblog) {
      reblogBtn = this.createActionButton(
        this.hasReblogged ? 'reblog-btn reblogged' : 'reblog-btn', 
        'repeat', 
        ''
      );
      reblogBtn.querySelector('span:not(.material-icons)')?.remove();
      reblogCountBtn = this.createActionButton('reblog-count-btn', '', this.reblogCount);
      reblogCountBtn.querySelector('.material-icons')?.remove();
      reblogCountBtn.title = 'Show rebloggers';
      reblogCountBtn.addEventListener('click', this.handleReblogCountClick);
      if (this.reblogCallback) {
        reblogBtn.addEventListener('click', async (event) => {
          if (reblogBtn.classList.contains('reblogged') || reblogBtn.dataset.loading === '1') {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          try {
            reblogBtn.dataset.loading = '1';
            const reblogSucceeded = await this.reblogCallback(event);
            if (reblogSucceeded !== true) {
              return;
            }
            reblogBtn.classList.add('reblogged');
            const countEl = reblogCountBtn?.querySelector('.count');
            if (countEl) {
              const current = parseInt(countEl.textContent || '0', 10) || 0;
              countEl.textContent = String(current + 1);
            }
          } finally {
            delete reblogBtn.dataset.loading;
          }
        });
      }

      const currentUser = authService.getCurrentUser();
      // Synchronous check first (same sources as card reblog button)
      if (currentUser?.username) {
        const normalizedUser = String(currentUser.username).toLowerCase();
        const alreadyReblogged =
          this.post.reblogged === true ||
          (Array.isArray(this.post.reblogged_by) &&
            this.post.reblogged_by.some(a => String(a || '').toLowerCase() === normalizedUser)) ||
          String(this.post.first_reblogged_by || '').toLowerCase() === normalizedUser ||
          reblogService.isRebloggedInCache(currentUser.username, this.post.author, this.post.permlink);
        if (alreadyReblogged) reblogBtn.classList.add('reblogged');
      }
      // Async fallback for cases not covered by local data (network check)
      reblogService.getReblogInfo(currentUser?.username || null, this.post.author, this.post.permlink)
        .then(({ hasReblogged, reblogCount }) => {
          const countEl = reblogCountBtn?.querySelector('.count');
          if (countEl) countEl.textContent = String(reblogCount);
          if (hasReblogged) {
            reblogBtn.classList.add('reblogged');
          }
        })
        .catch(() => {});
    }

    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${this.getPendingPayout(this.post)}`;
    payoutInfo.addEventListener('click', this.handlePayoutClick);
    applyDeclinedPayoutStyle(payoutInfo, this.post);
    
    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    if (reblogBtn) {
      const reblogContainer = document.createElement('div');
      reblogContainer.className = 'reblog-container';
      reblogContainer.appendChild(reblogBtn);
      if (reblogCountBtn) reblogContainer.appendChild(reblogCountBtn);
      postActions.appendChild(reblogContainer);
    }
    if (shareBtn) {
      postActions.appendChild(shareBtn);
    }
    postActions.appendChild(payoutInfo);
    
    // Only add edit button if user can edit the post
    if (this.canEdit && this.showShareEditInFooter) {
      const editBtn = this.createActionButton('edit-btn', 'edit', 'Edit');
      postActions.appendChild(editBtn);
      
      if (this.editCallback) {
        editBtn.addEventListener('click', this.editCallback);
      }
    }

    // Add event listeners
    if (this.upvoteCallback) {
      upvoteBtn.querySelector('.upvote-action').addEventListener('click', this.upvoteCallback);
    }
    
    if (this.commentCallback) {
      commentBtn.addEventListener('click', this.commentCallback);
    }
    
    if (shareBtn && this.shareCallback) {
      shareBtn.addEventListener('click', this.shareCallback);
    }

    return postActions;
  }

  // Nuovo metodo per creare il pulsante di upvote con contatore cliccabile
  createUpvoteButtonWithClickableCount() {
    const container = document.createElement('div');
    container.className = 'upvote-container';
    
    // Crea il pulsante di upvote (solo icona)
    const upvoteAction = document.createElement('button');
    upvoteAction.className = 'action-btn upvote-btn upvote-action';
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = 'thumb_up';
    upvoteAction.appendChild(iconSpan);
    
    // Crea il contatore cliccabile
    const countBtn = document.createElement('button');
    countBtn.className = 'vote-count-btn';
    
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    const voteCount = (this.post.active_votes?.length > 0)
      ? this.post.active_votes.length
      : (typeof this.post.net_votes === 'number' ? this.post.net_votes : 0);
    countSpan.textContent = voteCount;
    countBtn.appendChild(countSpan);
    
    // Aggiungi event listener per aprire il popup dei votanti
    countBtn.addEventListener('click', this.handleVotesClick);
    
    // Aggiungi entrambi gli elementi al container
    container.appendChild(upvoteAction);
    container.appendChild(countBtn);
    
    return container;
  }

  // Handler per il click sul conteggio voti
  handleVotesClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const votesPopup = new VotesPopup(this.post);
    votesPopup.show();
  }

  // Handler per il click sul conteggio reblog
  handleReblogCountClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const popup = new RebloggersPopup(this.post);
    popup.show();
  }

  // Nuovo handler per il click sul payout info
  handlePayoutClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const payoutPopup = new PayoutInfoPopup(this.post);
    payoutPopup.show();
  }

  createActionButton(className, icon, countOrText) {
    const button = document.createElement('button');
    button.className = `action-btn ${className}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);

    const countSpan = document.createElement('span');
    if (typeof countOrText === 'number') {
      countSpan.className = 'count';
      countSpan.textContent = countOrText ;
    } else {
      countSpan.textContent = countOrText;
    }
    button.appendChild(countSpan);

    return button;
  }

  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  unmount() {
    // Clean up any event listeners if necessary
  }
}

export default PostActions;
