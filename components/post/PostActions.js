import VotesPopup from './VotesPopup.js';
import PayoutInfoPopup from './PayoutInfoPopup.js';

class PostActions {
  constructor(post, upvoteCallback, commentCallback, shareCallback, editCallback, reblogCallback, canEdit = false, hasReblogged = false) {
    this.post = post;
    this.upvoteCallback = upvoteCallback;
    this.commentCallback = commentCallback;
    this.shareCallback = shareCallback;
    this.editCallback = editCallback; 
    this.reblogCallback = reblogCallback;
    this.canEdit = canEdit; // Store whether current user can edit this post
    this.hasReblogged = hasReblogged; // Store whether current user has reblogged this post
    
    // Bind methods
    this.handlePayoutClick = this.handlePayoutClick.bind(this);
    this.handleVotesClick = this.handleVotesClick.bind(this);
  }

  render() {
    const isMobile = window.innerWidth <= 768; // Check if the device is mobile
    const postActions = document.createElement('div');
    postActions.className = 'post-actions-post';

    // Creiamo il pulsante upvote con contatore cliccabile per mostrare i votanti
    const upvoteBtn = this.createUpvoteButtonWithClickableCount();
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', 'share', isMobile ? '' : 'Share');
    
    // Aggiungiamo il pulsante reblog (resteem)
    const reblogBtn = this.createActionButton(
      this.hasReblogged ? 'reblog-btn reblogged' : 'reblog-btn', 
      'repeat', 
      this.hasReblogged ? 'Reblogged' : isMobile ? '' : 'Reblog'
    );
    
    // Rimuoviamo il pulsante votes-details-btn poiché ora il conteggio voti sarà cliccabile

    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${this.getPendingPayout(this.post)}`;
    payoutInfo.addEventListener('click', this.handlePayoutClick); // Aggiungo l'event listener per il payout
    
    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    postActions.appendChild(reblogBtn);
    postActions.appendChild(shareBtn);
    postActions.appendChild(payoutInfo);
    
    // Only add edit button if user can edit the post
    if (this.canEdit) {
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
    
    if (this.shareCallback) {
      shareBtn.addEventListener('click', this.shareCallback);
    }
    
    if (this.reblogCallback) {
      reblogBtn.addEventListener('click', this.reblogCallback);
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
    countSpan.textContent = this.post.active_votes.length || 0;
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
