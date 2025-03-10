import View from './View.js';
import steemService from '../services/SteemService.js'; // Changed from SteemService to steemService
import router from '../utils/Router.js';
import { generatePostContent } from '../utils/process_body.js';  // Import the content processor
import LoadingIndicator from '../components/LoadingIndicator.js'; // Import LoadingIndicator

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
    this.loadingIndicator = null; // Will hold the LoadingIndicator instance
    
    // Dictionary of regex patterns for content processing
    this.contentRegexPatterns = {
      discordImages: /https:\/\/media\.discordapp\.net\/attachments\/[\w\/\-\.]+\.(jpg|jpeg|png|gif|webp)/gi,
      // Add more regex patterns as needed for other content types
    };
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
    
    // Create a loading container instead of a direct loading indicator
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    
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
    postView.appendChild(loadingContainer);
    postView.appendChild(postContent);
    postView.appendChild(errorMessage);
    postView.appendChild(commentsSection);
    
    this.element.appendChild(postView);

    this.loadingContainer = loadingContainer;
    this.postContent = postContent;
    this.errorMessage = errorMessage;
    this.commentsContainer = commentsSection;
    
    // Initialize the LoadingIndicator but don't show it yet
    this.loadingIndicator = new LoadingIndicator('spinner');
    
    await this.loadPost();
  }

  async loadPost() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    // Show the loading indicator with custom message
    this.loadingIndicator.show(this.loadingContainer, 'Loading post...');
    
    this.postContent.style.display = 'none';
    this.errorMessage.style.display = 'none';
    
    try {
      const { author, permlink } = this.params;
      
      // Update progress to show we're starting the request
      this.loadingIndicator.updateProgress(20);
      
      const [post, replies] = await Promise.all([
        this.steemService.getContent(author, permlink),
        this.steemService.getContentReplies(author, permlink)
      ]);

      // Update progress to show we received the data
      this.loadingIndicator.updateProgress(80);

      if (!post || post.id === 0) {
        throw new Error('not_found');
      }

      this.post = post;
      this.comments = replies || [];
      
      // Final progress update
      this.loadingIndicator.updateProgress(100);
      
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
      
      // Hide the loading indicator
      this.loadingIndicator.hide();
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
    postHeader.className = 'post-headero';
    
    // Back button removed
    
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
    authorName.href = `/@${this.post.author}`; // Removed the # symbol
    authorName.className = 'author-name';
    authorName.textContent = `@${this.post.author}`;
    
    const postDate = document.createElement('span');
    postDate.className = 'post-date';
    postDate.textContent = new Date(this.post.created).toLocaleString();
    
    postMeta.appendChild(authorAvatar);
    postMeta.appendChild(authorName);
    postMeta.appendChild(postDate);
    
    postHeader.appendChild(postTitle);
    postHeader.appendChild(postMeta);
    
    // Add header first to ensure it's at the top
    this.postContent.appendChild(postHeader);
    
    // Process the post content using process_body
    const processedContent = generatePostContent(this.post.body);
    
    // Create a temporary container for the processed content
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = processedContent;
    
    // Append the processed content
    this.postContent.appendChild(tempContainer);
    
    // Extract any Discord images that might not have been handled by the processor
    this.appendDiscordImagesIfNeeded(this.post.body);
    
    // Create actions
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';
    
    const upvoteBtn = this.createActionButton('upvote-btn', 'thumb_up', this.post.net_votes || 0);
    const commentBtn = this.createActionButton('comment-btn', 'chat', this.post.children || 0);
    const shareBtn = this.createActionButton('share-btn', 'share', 'Share');
    
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
    
    // Append remaining elements to post content
    this.postContent.appendChild(postActions);
    this.postContent.appendChild(commentsSection);
    
    this.postContent.style.display = 'block';
    
    upvoteBtn.addEventListener('click', () => this.handleUpvote());
    submitButton.addEventListener('click', () => this.handleComment());
    shareBtn.addEventListener('click', () => this.handleShare());
    
    // Render comments
    this.renderComments();
  }

  // Helper method to append Discord images if they weren't handled by the processor
  appendDiscordImagesIfNeeded(content) {
    const imageUrls = this.extractDiscordImageUrls(content);
    
    if (imageUrls.length > 0) {
      const featuredImageContainer = document.createElement('div');
      featuredImageContainer.className = 'featured-image-container';
      
      imageUrls.forEach(imageUrl => {
        const featuredImage = this.createImageWithFallback(imageUrl, 'featured-image', 'Featured image');
        featuredImageContainer.appendChild(featuredImage);
      });
      
      // Find where to insert the images - after the header but before the content
      const postHeader = this.postContent.querySelector('.post-header');
      if (postHeader && postHeader.nextSibling) {
        this.postContent.insertBefore(featuredImageContainer, postHeader.nextSibling);
      } else {
        // Fall back to appending at the beginning of the post content
        this.postContent.insertBefore(featuredImageContainer, this.postContent.firstChild);
      }
    }
  }

  // Create an image element with error handling
  createImageWithFallback(imageUrl, className, altText) {
    const image = document.createElement('img');
    image.className = className;
    image.alt = altText || 'Image';
    image.loading = 'lazy';
    
    // Add error handling
    image.onerror = () => {
      console.warn(`Failed to load image: ${imageUrl}`);
      image.style.display = 'none';
    };
    
    // Add click event
    image.addEventListener('click', () => {
      window.open(imageUrl, '_blank');
    });
    
    // Set source
    image.src = imageUrl;
    
    return image;
  }

  // Extract all Discord image URLs from content
  extractDiscordImageUrls(content) {
    if (!content) return [];
    
    const imageUrls = [];
    let match;
    const regex = this.contentRegexPatterns?.discordImages || 
                 /https:\/\/media\.discordapp\.net\/attachments\/[\w\/\-\.]+\.(jpg|jpeg|png|gif|webp)/gi;
    
    // Reset regex lastIndex
    regex.lastIndex = 0;
    
    // Find all matches
    while ((match = regex.exec(content)) !== null) {
      imageUrls.push(match[0]);
    }
    
    return imageUrls;
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

    // Build comment tree
    const commentTree = this.buildCommentTree(this.comments);
    
    // Render the comment tree
    commentTree.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      commentsContainer.appendChild(commentElement);
    });
  }

  // Helper method to build comment tree
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
      if (parentPermlink === this.params.permlink) {
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
    if (!comment) return document.createDocumentFragment();
    
    const MAX_DEPTH = 6; // Prevent excessive nesting
    const currentDepth = Math.min(depth, MAX_DEPTH);

    const commentDiv = document.createElement('div');
    commentDiv.className = `comment depth-${currentDepth}`;
    commentDiv.style.marginLeft = `${currentDepth * 20}px`;
    
    // Comment header
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    
    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar small';
    authorAvatar.src = `https://steemitimages.com/u/${comment.author}/avatar`;
    authorAvatar.alt = comment.author;
    
    const authorName = document.createElement('a');
    authorName.href = `/@${comment.author}`; // Removed the # symbol
    authorName.className = 'author-name';
    authorName.textContent = `@${comment.author}`;
    
    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    commentDate.textContent = new Date(comment.created).toLocaleString();
    
    commentHeader.appendChild(authorAvatar);
    commentHeader.appendChild(authorName);
    commentHeader.appendChild(commentDate);
    
    // Comment body - Use process_body instead of markdown renderer
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body markdown-content';
    
    // Use process_body for comment content
    const processedComment = generatePostContent(comment.body);
    commentBody.innerHTML = processedComment;
    
    // Append Discord images if needed
    const imageUrls = this.extractDiscordImageUrls(comment.body);
    if (imageUrls.length > 0) {
      const commentImagesContainer = document.createElement('div');
      commentImagesContainer.className = 'comment-images-container';
      
      imageUrls.forEach(imageUrl => {
        const commentImage = this.createImageWithFallback(imageUrl, 'comment-image', 'Comment image');
        commentImagesContainer.appendChild(commentImage);
      });
      
      commentBody.appendChild(commentImagesContainer);
    }
    
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
    
    // Add submit reply handler
    submitReplyBtn.addEventListener('click', () => {
      const replyText = replyTextarea.value;
      if (replyText.trim()) {
        this.handleReply(comment, replyText);
      }
    });
    
    // Render child comments
    if (comment.children && comment.children.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';
      
      comment.children.forEach(reply => {
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
