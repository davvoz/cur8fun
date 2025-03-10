import View from './View.js';
import steemService from '../services/SteemService.js'; // Changed from SteemService to steemService
import router from '../utils/Router.js';
import markdownRenderer from '../utils/MarkdownRenderer.js';

class PostView extends View {
  constructor(params = {}) {
    super(params);
    this.steemService = steemService; // Use the imported instance directly instead of constructing a new one
    this.post = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.comments = [];
    this.element = null; // Initialize element as null
  }

  async render(element) {
    // Store the element for future reference
    this.element = element;
    
    // Make sure we have an element before proceeding
    if (!this.element) {
      console.error('No element provided to PostView.render()');
      return;
    }
    
    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    const postView = document.createElement('div');
    postView.className = 'post-view';
    
    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading post...';
    
    // Post content container
    const postContent = document.createElement('div');
    postContent.className = 'post-content';
    postContent.style.display = 'none';
    
    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.display = 'none';
    
    // Comments section
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    
    // Append all elements
    postView.appendChild(loadingIndicator);
    postView.appendChild(postContent);
    postView.appendChild(errorMessage);
    postView.appendChild(commentsSection);
    
    this.element.appendChild(postView);

    this.loadingIndicator = loadingIndicator;
    this.postContent = postContent;
    this.errorMessage = errorMessage;
    this.commentsContainer = commentsSection;
    
    await this.loadPost();
  }

  async loadPost() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.loadingIndicator.style.display = 'block';
    this.postContent.style.display = 'none';
    this.errorMessage.style.display = 'none';
    
    try {
      const { author, permlink } = this.params;
      const [post, replies] = await Promise.all([
        this.steemService.getContent(author, permlink),
        this.steemService.getContentReplies(author, permlink)
      ]);

      if (!post || post.id === 0) {
        throw new Error('not_found');
      }

      this.post = post;
      this.comments = replies || [];
      this.renderPost();
    } catch (error) {
      console.error('Failed to load post:', error);
      
      if (error.message === 'not_found') {
        this.renderNotFoundError();
      } else {
        this.errorMessage.textContent = `Failed to load post: ${error.message || 'Failed to load post. Please try again later.'}`;
        this.errorMessage.style.display = 'block';
      }
    } finally {
      this.isLoading = false;
      this.loadingIndicator.style.display = 'none';
    }
  }
  
  renderNotFoundError() {
    // Clear the existing error message container
    while (this.errorMessage.firstChild) {
      this.errorMessage.removeChild(this.errorMessage.firstChild);
    }
    
    this.errorMessage.className = 'error-message not-found-error';
    
    // Create error container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'not-found-container';
    
    // Error code
    const errorCode = document.createElement('h1');
    errorCode.className = 'error-code';
    errorCode.textContent = '404';
    
    // Error heading
    const errorHeading = document.createElement('h2');
    errorHeading.className = 'error-heading';
    errorHeading.textContent = 'Post Not Found';
    
    // Error description
    const errorDesc = document.createElement('p');
    errorDesc.className = 'error-description';
    errorDesc.textContent = `We couldn't find the post at @${this.params.author}/${this.params.permlink}`;
    
    // Home button
    const homeButton = document.createElement('button');
    homeButton.className = 'back-to-home-btn';
    homeButton.textContent = 'Back to Home';
    homeButton.addEventListener('click', () => {
      router.navigate('/');
    });
    
    // Assemble the error container
    errorContainer.appendChild(errorCode);
    errorContainer.appendChild(errorHeading);
    errorContainer.appendChild(errorDesc);
    errorContainer.appendChild(homeButton);
    
    this.errorMessage.appendChild(errorContainer);
    this.errorMessage.style.display = 'block';
    
  }
  

  renderPost() {
    if (!this.post) return;

    const getPendingPayout = (post) => {
      const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
      const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
      const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
      return (pending + total + curator).toFixed(2);
    };
    
    // Clear existing content
    while (this.postContent.firstChild) {
      this.postContent.removeChild(this.postContent.firstChild);
    }
    
    // Create header
    const postHeader = document.createElement('div');
    postHeader.className = 'post-header';
    
    const backButton = document.createElement('a');
    backButton.href = '/';
    backButton.className = 'back-button';
    backButton.textContent = '← Back to Feed';
    
    const postTitle = document.createElement('h1');
    postTitle.className = 'post-title';
    postTitle.textContent = this.post.title || 'Untitled';
    
    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';
    
    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar';
    authorAvatar.src = `https://steemitimages.com/u/${this.post.author}/avatar`;
    authorAvatar.alt = this.post.author;
    
    const authorName = document.createElement('a');
    authorName.href = `/profile/${this.post.author}`;
    authorName.className = 'author-name';
    authorName.textContent = `@${this.post.author}`;
    
    const postDate = document.createElement('span');
    postDate.className = 'post-date';
    postDate.textContent = new Date(this.post.created).toLocaleString();
    
    postMeta.appendChild(authorAvatar);
    postMeta.appendChild(authorName);
    postMeta.appendChild(postDate);
    
    postHeader.appendChild(backButton);
    postHeader.appendChild(postTitle);
    postHeader.appendChild(postMeta);
    
    // Create body
    const postBody = document.createElement('div');
    postBody.className = 'post-body markdown-content';
    
    // Use markdown renderer instead of textContent
    markdownRenderer.renderToElement(postBody, this.post.body);
    
    // Create actions
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';
    
    const upvoteBtn = this.createActionButton('upvote-btn', '👍', this.post.net_votes || 0);
    const commentBtn = this.createActionButton('comment-btn', '💬', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', '🔁', 'Share');
    
    const payoutInfo = document.createElement('div');
    payoutInfo.className = 'payout-info';
    payoutInfo.textContent = `$${getPendingPayout(this.post)}`;
    
    postActions.appendChild(upvoteBtn);
    postActions.appendChild(commentBtn);
    postActions.appendChild(shareBtn);
    postActions.appendChild(payoutInfo);
    
    // Create comments section
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
    
    // Append all elements to post content
    this.postContent.appendChild(postHeader);
    this.postContent.appendChild(postBody);
    this.postContent.appendChild(postActions);
    this.postContent.appendChild(commentsSection);
    
    this.postContent.style.display = 'block';
    
    // Add event listeners
    backButton.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/');
    });
    
    upvoteBtn.addEventListener('click', () => this.handleUpvote());
    submitButton.addEventListener('click', () => this.handleComment());
    shareBtn.addEventListener('click', () => this.handleShare());
    
    // Render comments
    this.renderComments();
  }

  createActionButton(className, icon, countOrText) {
    const button = document.createElement('button');
    button.className = `action-btn ${className}`;
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);
    
    const countSpan = document.createElement('span');
    if (typeof countOrText === 'number') {
      countSpan.className = 'count';
      countSpan.textContent = countOrText;
    } else {
      countSpan.textContent = countOrText;
    }
    button.appendChild(countSpan);
    
    return button;
  }

  renderComments() {
    if (!Array.isArray(this.comments)) {
      this.comments = [];
    }

    const commentsContainer = this.postContent.querySelector('.comments-list');
    
    // Clear existing comments
    while (commentsContainer.firstChild) {
      commentsContainer.removeChild(commentsContainer.firstChild);
    }
    
    if (!this.comments || this.comments.length === 0) {
      const noComments = document.createElement('div');
      noComments.className = 'no-comments';
      noComments.textContent = 'No comments yet. Be the first to comment!';
      commentsContainer.appendChild(noComments);
      return;
    }
    
    // In real implementation, you'd recursively render comments and their replies
    this.comments.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      commentsContainer.appendChild(commentElement);
    });
  }

  createCommentElement(comment, depth = 0) {
    if (!comment) return document.createDocumentFragment();

    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.style.marginLeft = `${depth * 20}px`;
    
    // Comment header
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    
    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar small';
    authorAvatar.src = `https://steemitimages.com/u/${comment.author}/avatar`;
    authorAvatar.alt = comment.author;
    
    const authorName = document.createElement('a');
    authorName.href = `/profile/${comment.author}`;
    authorName.className = 'author-name';
    authorName.textContent = `@${comment.author}`;
    
    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    commentDate.textContent = new Date(comment.created).toLocaleString();
    
    commentHeader.appendChild(authorAvatar);
    commentHeader.appendChild(authorName);
    commentHeader.appendChild(commentDate);
    
    // Comment body
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.textContent = comment.body;
    
    // Comment actions
    const commentActions = document.createElement('div');
    commentActions.className = 'comment-actions';
    
    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'action-btn upvote-btn small';
    const upvoteIcon = document.createElement('span');
    upvoteIcon.className = 'icon';
    upvoteIcon.textContent = '👍';
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
    
    // Add submit reply handler
    submitReplyBtn.addEventListener('click', () => {
      const replyText = replyTextarea.value;
      if (replyText.trim()) {
        this.handleReply(comment, replyText);
      }
    });
    
    // Recursively render replies
    if (comment.replies && comment.replies.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';
      
      comment.replies.forEach(reply => {
        const replyElement = this.createCommentElement(reply, depth + 1);
        repliesContainer.appendChild(replyElement);
      });
      
      commentDiv.appendChild(repliesContainer);
    }
    
    return commentDiv;
  }

  handleUpvote() {
    // Check if user is logged in
    const user = this.getCurrentUser();
    if (!user) {
      this.emit('notification', { 
        type: 'error', 
        message: 'You need to log in to vote'
      });
      router.navigate('/login', { returnUrl: window.location.pathname });
      return;
    }
    
    // In a real implementation, you would call the SteemService to vote
    console.log('Voting for post', this.post.author, this.post.permlink);
    this.emit('notification', { 
      type: 'success', 
      message: 'Your vote was recorded'
    });
  }

  handleComment() {
    const commentText = this.postContent.querySelector('.comment-form textarea').value;
    if (!commentText.trim()) return;
    
    // Check if user is logged in
    const user = this.getCurrentUser();
    if (!user) {
      this.emit('notification', { 
        type: 'error', 
        message: 'You need to log in to comment'
      });
      router.navigate('/login', { returnUrl: window.location.pathname });
      return;
    }
    
    // In a real implementation, you would call the SteemService to post comment
    console.log('Adding comment:', commentText);
    this.emit('notification', { 
      type: 'success', 
      message: 'Your comment was posted'
    });
    
    // Clear the form
    this.postContent.querySelector('.comment-form textarea').value = '';
  }

  handleReply(parentComment, replyText) {
    // Check if user is logged in
    const user = this.getCurrentUser();
    if (!user) {
      this.emit('notification', { 
        type: 'error', 
        message: 'You need to log in to reply'
      });
      router.navigate('/login', { returnUrl: window.location.pathname });
      return;
    }
    
    // In a real implementation, you would call the SteemService to post reply
    console.log('Adding reply to comment:', parentComment.permlink, replyText);
    this.emit('notification', { 
      type: 'success', 
      message: 'Your reply was posted'
    });
  }

  handleShare() {
    const url = window.location.href;
    
    // Use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: this.post.title,
        text: `Check out this post: ${this.post.title}`,
        url: url
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(url).then(() => {
        this.emit('notification', {
          type: 'success',
          message: 'Link copied to clipboard'
        });
      }).catch(err => console.error('Could not copy link:', err));
    }
  }

  getCurrentUser() {
    // In a real implementation, this would get the logged in user from state or localStorage
    return localStorage.getItem('currentUser') ? 
      JSON.parse(localStorage.getItem('currentUser')) : null;
  }
}

export default PostView;
