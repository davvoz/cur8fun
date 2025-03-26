import voteService from '../../services/VoteService.js';
import router from '../../utils/Router.js';

class CommentsSection {
  constructor(comments, parentPost, handleReplyCallback, handleVoteCallback, contentRenderer) {
    this.comments = comments || [];
    this.parentPost = parentPost;
    this.handleReplyCallback = handleReplyCallback;
    this.handleVoteCallback = handleVoteCallback;
    this.contentRenderer = contentRenderer;
    this.element = null;
    this.commentsListContainer = null;
  }

  render() {
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';

    const commentsHeader = document.createElement('h3');
    commentsHeader.textContent = `Comments (${this.comments.length})`;

    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write a comment...';

    const submitButton = document.createElement('button');
    submitButton.className = 'submit-comment';
    submitButton.textContent = 'Post Comment';

    commentForm.appendChild(textarea);
    commentForm.appendChild(submitButton);

    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';

    commentsSection.appendChild(commentsHeader);
    commentsSection.appendChild(commentForm);
    commentsSection.appendChild(commentsList);

    // Store reference to the container
    this.element = commentsSection;
    this.commentsListContainer = commentsList;

    // Render comments
    this.renderComments();

    return commentsSection;
  }

  renderComments() {
    if (!this.commentsListContainer) return;
    
    // Clear existing comments
    while (this.commentsListContainer.firstChild) {
      this.commentsListContainer.removeChild(this.commentsListContainer.firstChild);
    }

    if (!this.comments || this.comments.length === 0) {
      const noComments = document.createElement('div');
      noComments.className = 'no-comments';
      noComments.textContent = 'No comments yet. Be the first to comment!';
      this.commentsListContainer.appendChild(noComments);
      return;
    }

    // Build comment tree
    const commentTree = this.buildCommentTree(this.comments);

    // Render the comment tree
    commentTree.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      this.commentsListContainer.appendChild(commentElement);
    });
  }

  buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: Create map of all comments
    comments.forEach(comment => {
      comment.children = [];
      commentMap.set(comment.permlink, comment);
    });

    // Second pass: Build tree structure
    comments.forEach(comment => {
      const parentPermlink = comment.parent_permlink;
      if (parentPermlink === this.parentPost.permlink) {
        // This is a root level comment
        rootComments.push(comment);
      } else {
        // This is a reply
        const parentComment = commentMap.get(parentPermlink);
        if (parentComment) {
          parentComment.children.push(comment);
        }
      }
    });

    return rootComments;
  }

  createCommentElement(comment, depth = 0) {
    const MAX_DEPTH = 6;
    const currentDepth = Math.min(depth, MAX_DEPTH);

    const commentDiv = document.createElement('div');
    commentDiv.className = `comment depth-${currentDepth}`;

    // Add data attributes to help with debugging
    commentDiv.dataset.author = comment.author;
    commentDiv.dataset.permlink = comment.permlink;
    commentDiv.dataset.depth = currentDepth;

    // Comment header
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-headero';

    // First container for avatar and author name
    const authorContainer = document.createElement('div');
    authorContainer.className = 'author-container';

    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar small';
    authorAvatar.src = `https://steemitimages.com/u/${comment.author}/avatar`;
    authorAvatar.alt = comment.author;

    const authorName = document.createElement('a');
    authorName.href = "javascript:void(0)";
    authorName.className = 'author-name';
    authorName.textContent = `@${comment.author}`;
    authorName.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(`/@${comment.author}`);
    });

    authorContainer.appendChild(authorAvatar);
    authorContainer.appendChild(authorName);

    // Second container for date
    const dateContainer = document.createElement('div');
    dateContainer.className = 'date-container';

    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    commentDate.textContent = new Date(comment.created).toLocaleString();

    dateContainer.appendChild(commentDate);

    // Add both containers to the header
    commentHeader.appendChild(authorContainer);
    commentHeader.appendChild(dateContainer);

    // Comment body - Use ContentRenderer
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';

    const commentRenderer = this.contentRenderer || new ContentRenderer({
      containerClass: 'comment-content',
      imageClass: 'comment-image',
      useProcessBody: false
    });

    const renderedComment = commentRenderer.render({
      body: comment.body
    });

    commentBody.appendChild(renderedComment.container);

    // Comment actions
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';

    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'action-btn upvote-btn small';
    const upvoteIcon = document.createElement('span');
    upvoteIcon.className = 'material-icons';
    upvoteIcon.textContent = 'thumb_up';
    const upvoteCount = document.createElement('span');
    upvoteCount.className = 'count';
    upvoteCount.textContent = comment.net_votes || 0;
    upvoteBtn.appendChild(upvoteIcon);
    upvoteBtn.appendChild(upvoteCount);

    const replyBtn = document.createElement('button');
    replyBtn.className = 'action-btn reply-btn small';
    replyBtn.textContent = 'Reply';

    commentActions.appendChild(upvoteBtn);
    commentActions.appendChild(replyBtn);

    // Reply form
    const replyForm = document.createElement('div');
    replyForm.className = 'reply-form';
    replyForm.style.display = 'none';

    const replyTextarea = document.createElement('textarea');
    replyTextarea.placeholder = 'Write a reply...';

    const submitReplyBtn = document.createElement('button');
    submitReplyBtn.className = 'submit-reply';
    submitReplyBtn.textContent = 'Post Reply';

    replyForm.appendChild(replyTextarea);
    replyForm.appendChild(submitReplyBtn);

    // Append all to comment div
    commentDiv.appendChild(commentHeader);
    commentDiv.appendChild(commentBody);
    commentDiv.appendChild(commentActions);
    commentDiv.appendChild(replyForm);

    // Add reply button handler
    replyBtn.addEventListener('click', () => {
      replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
    });

    // Add submit reply handler using the provided callback
    if (this.handleReplyCallback) {
      submitReplyBtn.addEventListener('click', () => {
        const replyText = replyTextarea.value;
        if (replyText.trim()) {
          this.handleReplyCallback(comment, replyText);
        }
      });
    }

    // Add upvote button handler using the provided callback
    if (this.handleVoteCallback) {
      upvoteBtn.addEventListener('click', () => {
        this.handleVoteCallback(commentDiv, upvoteBtn);
      });
    }

    // Check if user has already voted on this comment
    this.checkCommentVoteStatus(comment, upvoteBtn);

    // Render child comments with enhanced visibility
    if (comment.children && comment.children.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = `replies depth-${currentDepth}`;

      // Add comment count indicator
      const repliesCount = document.createElement('div');
      repliesCount.className = 'replies-count';
      repliesCount.textContent = `${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}`;
      repliesContainer.appendChild(repliesCount);

      // Add visual indicator for nested comments
      const threadLine = document.createElement('div');
      threadLine.className = 'thread-line';
      repliesContainer.appendChild(threadLine);

      // Make sure replies are clearly visible
      const repliesWrapper = document.createElement('div');
      repliesWrapper.className = 'replies-wrapper';

      comment.children.forEach(reply => {
        const replyElement = this.createCommentElement(reply, depth + 1);
        repliesWrapper.appendChild(replyElement);
      });

      repliesContainer.appendChild(repliesWrapper);
      commentDiv.appendChild(repliesContainer);
    }

    return commentDiv;
  }

  async checkCommentVoteStatus(comment, upvoteBtn) {
    try {
      const vote = await voteService.hasVoted(comment.author, comment.permlink);
      if (vote) {
        // Imposta lo stato votato
        upvoteBtn.classList.add('voted');

        // Aggiungi l'icona piena invece di quella vuota
        const iconElement = upvoteBtn.querySelector('.material-icons');
        if (iconElement) {
          iconElement.textContent = 'thumb_up_alt';
        }

        // Aggiungi indicatore di percentuale se è > 0
        if (vote.percent > 0) {
          const percentIndicator = document.createElement('span');
          percentIndicator.className = 'vote-percent-indicator';
          percentIndicator.textContent = `${vote.percent / 100}%`;
          upvoteBtn.appendChild(percentIndicator);
        }
      }
    } catch (err) {
      console.log('Error checking vote status for comment', err);
    }
  }

  updateComments(newComments) {
    this.comments = newComments || [];
    this.renderComments();

    // Update the comments count in header
    const commentsHeader = this.element?.querySelector('h3');
    if (commentsHeader) {
      commentsHeader.textContent = `Comments (${this.comments.length})`;
    }
  }

  unmount() {
    // Clean up event listeners if necessary
    this.element = null;
    this.commentsListContainer = null;
  }
}

export default CommentsSection;
