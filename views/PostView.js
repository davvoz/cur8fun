import View from './View.js';
import SteemService from '../services/SteemService.js';
import router from '../utils/Router.js';

class PostView extends View {
  constructor(element, params = {}) {
    super(element, params);
    this.steemService = new SteemService();
    this.post = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.comments = [];
  }

  async render() {
    this.element.innerHTML = `
      <div class="post-view">
        <div class="loading-indicator">Loading post...</div>
        <div class="post-content" style="display:none"></div>
        <div class="error-message" style="display:none"></div>
        <div class="comments-section"></div>
      </div>
    `;

    this.loadingIndicator = this.element.querySelector('.loading-indicator');
    this.postContent = this.element.querySelector('.post-content');
    this.errorMessage = this.element.querySelector('.error-message');
    this.commentsContainer = this.element.querySelector('.comments-section');
    
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
        throw new Error('Post not found');
      }

      this.post = post;
      this.comments = replies || [];
      this.renderPost();
    } catch (error) {
      console.error('Failed to load post:', error);
      this.errorMessage.textContent = `Failed to load post: ${error.message || 'Failed to load post. Please try again later.'}`;
      this.errorMessage.style.display = 'block';
    } finally {
      this.isLoading = false;
      this.loadingIndicator.style.display = 'none';
    }
  }

  renderPost() {
    if (!this.post) return;

    const getPendingPayout = (post) => {
      const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
      const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
      const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
      return (pending + total + curator).toFixed(2);
    };

    // Convert post body from Markdown to HTML (in a real implementation you'd use a markdown parser)
    const bodyHtml = this.post.body;
    
    this.postContent.innerHTML = `
      <div class="post-header">
        <a href="/" class="back-button">&larr; Back to Feed</a>
        <h1 class="post-title">${this.post.title || 'Untitled'}</h1>
        <div class="post-meta">
          <img class="author-avatar" src="https://steemitimages.com/u/${this.post.author}/avatar" alt="${this.post.author}">
          <a href="/profile/${this.post.author}" class="author-name">@${this.post.author}</a>
          <span class="post-date">${new Date(this.post.created).toLocaleString()}</span>
        </div>
      </div>
      
      <div class="post-body">
        ${bodyHtml}
      </div>
      
      <div class="post-actions">
        <button class="action-btn upvote-btn">
          <span class="icon">&#128077;</span>
          <span class="count">${this.post.net_votes || 0}</span>
        </button>
        <button class="action-btn comment-btn">
          <span class="icon">&#128172;</span>
          <span class="count">${this.post.children || 0}</span>
        </button>
        <button class="action-btn share-btn">
          <span class="icon">&#128257;</span>
          Share
        </button>
        <div class="payout-info">
          $${getPendingPayout(this.post)}
        </div>
      </div>
      
      <div class="comments-section">
        <h3>Comments (${this.comments.length})</h3>
        <div class="comment-form">
          <textarea placeholder="Write a comment..."></textarea>
          <button class="submit-comment">Post Comment</button>
        </div>
        <div class="comments-list"></div>
      </div>
    `;
    
    this.postContent.style.display = 'block';
    
    // Add event listeners
    const backButton = this.postContent.querySelector('.back-button');
    const upvoteButton = this.postContent.querySelector('.upvote-btn');
    const commentForm = this.postContent.querySelector('.comment-form');
    const shareButton = this.postContent.querySelector('.share-btn');
    
    backButton.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/');
    });
    
    upvoteButton.addEventListener('click', () => this.handleUpvote());
    commentForm.querySelector('button').addEventListener('click', () => this.handleComment());
    shareButton.addEventListener('click', () => this.handleShare());
    
    // Render comments
    this.renderComments();
  }

  renderComments() {
    if (!Array.isArray(this.comments)) {
      this.comments = [];
    }

    const commentsContainer = this.postContent.querySelector('.comments-list');
    commentsContainer.innerHTML = '';
    
    if (!this.comments || this.comments.length === 0) {
      commentsContainer.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
      return;
    }
    
    // In real implementation, you'd recursively render comments and their replies
    this.comments.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      commentsContainer.appendChild(commentElement);
    });
  }

  createCommentElement(comment, depth = 0) {
    if (!comment) return '';

    const element = this.createElementFromHTML(`
      <div class="comment" style="margin-left: ${depth * 20}px;">
        <div class="comment-header">
          <img class="author-avatar small" src="https://steemitimages.com/u/${comment.author}/avatar" alt="${comment.author}">
          <a href="/profile/${comment.author}" class="author-name">@${comment.author}</a>
          <span class="comment-date">${new Date(comment.created).toLocaleString()}</span>
        </div>
        <div class="comment-body">${comment.body}</div>
        <div class="comment-actions">
          <button class="action-btn upvote-btn small">
            <span class="icon">&#128077;</span>
            <span class="count">${comment.net_votes || 0}</span>
          </button>
          <button class="action-btn reply-btn small">Reply</button>
        </div>
        <div class="reply-form" style="display:none;">
          <textarea placeholder="Write a reply..."></textarea>
          <button class="submit-reply">Post Reply</button>
        </div>
      </div>
    `);
    
    // Add reply button handler
    const replyBtn = element.querySelector('.reply-btn');
    const replyForm = element.querySelector('.reply-form');
    
    replyBtn.addEventListener('click', () => {
      replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
    });
    
    // Add submit reply handler
    const submitReply = element.querySelector('.submit-reply');
    submitReply.addEventListener('click', () => {
      const replyText = replyForm.querySelector('textarea').value;
      if (replyText.trim()) {
        this.handleReply(comment, replyText);
      }
    });
    
    // Recursively render replies
    if (comment.replies && comment.replies.length > 0) {
      const repliesContainer = this.createElementFromHTML('<div class="replies"></div>');
      
      comment.replies.forEach(reply => {
        const replyElement = this.createCommentElement(reply, depth + 1);
        repliesContainer.appendChild(replyElement);
      });
      
      element.appendChild(repliesContainer);
    }
    
    return element;
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
