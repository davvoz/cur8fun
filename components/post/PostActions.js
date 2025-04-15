import VotesPopup from './VotesPopup.js';
import PayoutInfoPopup from './PayoutInfoPopup.js';

class PostActions {
  constructor(post, upvoteCallback, commentCallback, shareCallback, editCallback, canEdit = false) {
    this.post = post;
    this.upvoteCallback = upvoteCallback;
    this.commentCallback = commentCallback;
    this.shareCallback = shareCallback;
    this.editCallback = editCallback; 
    this.canEdit = canEdit; // Store whether current user can edit this post
    
    // Bind methods
    this.handlePayoutClick = this.handlePayoutClick.bind(this);
  }

  render() {
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';

    const upvoteBtn = this.createActionButton('upvote-btn', 'thumb_up', this.post.active_votes.length || 0);
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', 'share', 'Share');
    const votesDetailsBtn = this.createActionButton('votes-details-btn', 'how_to_vote', 'Votes');

    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${this.getPendingPayout(this.post)}`;
    payoutInfo.addEventListener('click', this.handlePayoutClick); // Aggiungo l'event listener per il payout
    
    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    postActions.appendChild(shareBtn);
    postActions.appendChild(votesDetailsBtn);
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
      upvoteBtn.addEventListener('click', this.upvoteCallback);
    }
    
    if (this.commentCallback) {
      commentBtn.addEventListener('click', this.commentCallback);
    }
    
    if (this.shareCallback) {
      shareBtn.addEventListener('click', this.shareCallback);
    }
    
    // Add event listener for votes details button
    votesDetailsBtn.addEventListener('click', () => {
      const votesPopup = new VotesPopup(this.post);
      votesPopup.show();
    });

    return postActions;
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
