import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';
import ImageUtils from '../utils/ImageUtils.js';

class ProfileView extends View {
  constructor(params) {
    super();
    this.params = params || {};
    this.username = this.params.username;
    this.profile = null;
    this.posts = [];
    this.comments = [];
    this.currentTab = 'posts';
    this.container = null;
    this.loadingIndicator = new LoadingIndicator();
    this.postsLoading = false;
    this.commentsLoading = false;
    this.isFollowing = false;
    this.currentUser = authService.getCurrentUser();
  }

  async render(container) {
    this.container = container;

    // Create profile container
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    container.appendChild(profileContainer);

    // Show loading indicator
    this.loadingIndicator.show(profileContainer);

    try {
      // Load profile data
      await this.loadProfileData();
      
      // Render the profile
      this.renderProfile(profileContainer);
      
      // Load and render posts (default tab)
      this.loadPosts();
      
      // Check if logged-in user is following this profile
      this.checkFollowStatus();
    } catch (error) {
      console.error('Error rendering profile:', error);
      this.renderErrorState(profileContainer, error);
    } finally {
      this.loadingIndicator.hide();
    }
  }

  async loadProfileData() {
    if (!this.username) {
      throw new Error('No username provided');
    }
    
    this.profile = await profileService.getProfile(this.username);
    if (!this.profile) {
      throw new Error(`Profile not found for @${this.username}`);
    }
  }

  async loadPosts() {
    if (this.postsLoading) return;
    
    const postsContainer = this.container.querySelector('.profile-posts');
    if (!postsContainer) return;
    
    this.postsLoading = true;
    
    try {
      // Show loading in posts area
      postsContainer.innerHTML = '<div class="loading-indicator">Loading posts...</div>';
      
      // Fetch posts
      this.posts = await profileService.getUserPosts(this.username, 20);
      
      // Render posts
      this.renderPosts(postsContainer);
    } catch (error) {
      console.error('Error loading posts:', error);
      postsContainer.innerHTML = `
        <div class="error-message">
          Failed to load posts for @${this.username}
          <button class="retry-btn">Retry</button>
        </div>
      `;
      
      // Add retry handler
      postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.loadPosts();
      });
    } finally {
      this.postsLoading = false;
    }
  }

  async loadComments() {
    if (this.commentsLoading) return;
    
    const commentsContainer = this.container.querySelector('.profile-posts');
    if (!commentsContainer) return;
    
    this.commentsLoading = true;
    
    try {
      // Show loading in comments area
      commentsContainer.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
      
      // Placeholder for comments fetching - this would be implemented in the ProfileService
      // For now, we'll simulate empty comments
      this.comments = [];
      
      // Render comments (or empty state)
      this.renderComments(commentsContainer);
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsContainer.innerHTML = `
        <div class="error-message">
          Failed to load comments for @${this.username}
          <button class="retry-btn">Retry</button>
        </div>
      `;
      
      // Add retry handler
      commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.loadComments();
      });
    } finally {
      this.commentsLoading = false;
    }
  }

  async checkFollowStatus() {
    if (!this.currentUser) return;
    
    try {
      this.isFollowing = await profileService.isFollowing(this.username, this.currentUser);
      this.updateFollowButton();
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }

  renderProfile(container) {
    // Clear previous content
    container.innerHTML = '';
    
    // Create profile header
    const header = this.createProfileHeader();
    container.appendChild(header);
    
    // Create profile tabs
    const tabs = this.createProfileTabs();
    container.appendChild(tabs);
    
    // Create posts container
    const postsArea = document.createElement('div');
    postsArea.className = 'profile-posts';
    container.appendChild(postsArea);
  }

  createProfileHeader() {
    const header = document.createElement('div');
    header.className = 'profile-header';
    
    // Add cover image
    const coverDiv = document.createElement('div');
    coverDiv.className = 'profile-cover';
    if (this.profile.coverImage) {
      coverDiv.style.backgroundImage = `url(${this.profile.coverImage})`;
    }
    
    // Add profile info section
    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    
    const avatarImg = document.createElement('img');
    avatarImg.src = this.profile.profileImage;
    avatarImg.alt = this.profile.username;
    avatarImg.onerror = () => {
      avatarImg.src = '/assets/images/default-avatar.png';
    };
    
    avatar.appendChild(avatarImg);
    
    // Profile stats (name, handle, bio, followers)
    const stats = document.createElement('div');
    stats.className = 'profile-stats';
    
    const name = document.createElement('h1');
    name.className = 'profile-name';
    name.textContent = this.profile.username;
    
    const handle = document.createElement('div');
    handle.className = 'profile-handle';
    handle.textContent = `@${this.profile.username}`;
    
    const reputation = document.createElement('span');
    reputation.className = 'profile-reputation';
    reputation.textContent = ` (${this.profile.reputation.toFixed(1)})`;
    handle.appendChild(reputation);
    
    // Bio
    const bio = document.createElement('div');
    bio.className = 'profile-bio';
    bio.textContent = this.profile.about;
    
    // Stats metrics (followers, following, posts)
    const metrics = document.createElement('div');
    metrics.className = 'profile-metrics';
    
    metrics.appendChild(this.createStatElement('Posts', this.profile.postCount));
    metrics.appendChild(this.createStatElement('Followers', this.profile.followerCount));
    metrics.appendChild(this.createStatElement('Following', this.profile.followingCount));
    
    // Actions (follow button, etc)
    const actions = document.createElement('div');
    actions.className = 'profile-actions';
    
    if (this.currentUser && this.currentUser.username !== this.profile.username) {
      const followBtn = document.createElement('button');
      followBtn.className = 'follow-btn';
      followBtn.textContent = 'Follow';
      followBtn.addEventListener('click', () => this.handleFollowAction());
      actions.appendChild(followBtn);
    }
    
    // Assemble everything
    stats.append(name, handle, bio, metrics, actions);
    infoSection.append(avatar, stats);
    header.append(coverDiv, infoSection);
    
    return header;
  }

  createStatElement(label, value) {
    const stat = document.createElement('div');
    stat.className = 'stat-container';
    
    const statValue = document.createElement('div');
    statValue.className = 'stat-value';
    statValue.textContent = value.toLocaleString();
    
    const statLabel = document.createElement('div');
    statLabel.className = 'stat-label';
    statLabel.textContent = label;
    
    stat.append(statValue, statLabel);
    return stat;
  }

  createProfileTabs() {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'profile-tabs';
    
    // Posts tab
    const postsTab = document.createElement('button');
    postsTab.className = 'tab-btn active';
    postsTab.textContent = 'Posts';
    postsTab.addEventListener('click', () => this.switchTab('posts'));
    
    // Comments tab
    const commentsTab = document.createElement('button');
    commentsTab.className = 'tab-btn';
    commentsTab.textContent = 'Comments';
    commentsTab.addEventListener('click', () => this.switchTab('comments'));
    
    tabsContainer.append(postsTab, commentsTab);
    return tabsContainer;
  }

  switchTab(tabName) {
    if (this.currentTab === tabName) return;
    
    this.currentTab = tabName;
    
    // Update tab styling
    const tabs = this.container.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.textContent.toLowerCase() === tabName) {
        tab.classList.add('active');
      }
    });
    
    // Load content based on tab
    if (tabName === 'posts') {
      this.loadPosts();
    } else if (tabName === 'comments') {
      this.loadComments();
    }
  }

  renderPosts(container) {
    // Clear container
    container.innerHTML = '';
    
    if (!this.posts || this.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-posts-message">
          @${this.username} hasn't published any posts yet.
        </div>
      `;
      return;
    }
    
    // Create a post item for each post
    this.posts.forEach(post => {
      const postItem = this.createPostItem(post);
      container.appendChild(postItem);
    });
  }

  renderComments(container) {
    // Clear container
    container.innerHTML = '';
    
    if (!this.comments || this.comments.length === 0) {
      container.innerHTML = `
        <div class="empty-comments-message">
          @${this.username} hasn't made any comments yet.
        </div>
      `;
      return;
    }
    
    // Create a comment item for each comment
    this.comments.forEach(comment => {
      const commentItem = this.createCommentItem(comment);
      container.appendChild(commentItem);
    });
  }

  createPostItem(post) {
    const postItem = document.createElement('div');
    postItem.className = 'post-item';
    
    // Parse metadata to extract image
    const metadata = this.parseMetadata(post.json_metadata);
    const imageUrl = this.getBestImage(post, metadata);
    
    // Post title
    const title = document.createElement('h3');
    title.textContent = post.title;
    
    // Post excerpt
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = this.createExcerpt(post.body);
    
    postItem.append(title, excerpt);
    
    // Add click handler to navigate to post
    postItem.addEventListener('click', () => {
      router.navigate(`/@${post.author}/${post.permlink}`);
    });
    
    return postItem;
  }

  createCommentItem(comment) {
    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';
    
    // Comment header with link to parent post
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    
    const parentLink = document.createElement('a');
    parentLink.className = 'parent-post-link';
    parentLink.href = `/@${comment.parent_author}/${comment.parent_permlink}`;
    parentLink.textContent = 'View parent post';
    commentHeader.appendChild(parentLink);
    
    // Comment date
    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    commentDate.textContent = new Date(comment.created).toLocaleDateString();
    commentHeader.appendChild(commentDate);
    
    // Comment body
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.textContent = this.createExcerpt(comment.body);
    
    commentItem.append(commentHeader, commentBody);
    
    // Add click handler
    parentLink.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(parentLink.href);
    });
    
    return commentItem;
  }

  renderErrorState(container, error) {
    container.innerHTML = `
      <div class="profile-render-error">
        <h2>Error loading profile</h2>
        <p>${error.message || 'An unknown error occurred'}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;
    
    container.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.render(this.container);
    });
  }

  async handleFollowAction() {
    if (!this.currentUser) {
      // Redirect to login if not logged in
      router.navigate('/login', { returnUrl: `/@${this.username}` });
      return;
    }
    
    try {
      const followBtn = this.container.querySelector('.follow-btn');
      if (followBtn) followBtn.disabled = true;
      
      if (this.isFollowing) {
        await profileService.unfollowUser(this.username, this.currentUser);
        this.isFollowing = false;
      } else {
        await profileService.followUser(this.username, this.currentUser);
        this.isFollowing = true;
      }
      
      this.updateFollowButton();
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to ${this.isFollowing ? 'unfollow' : 'follow'} @${this.username}`
      });
    } finally {
      const followBtn = this.container.querySelector('.follow-btn');
      if (followBtn) followBtn.disabled = false;
    }
  }

  updateFollowButton() {
    const followBtn = this.container.querySelector('.follow-btn');
    if (!followBtn) return;
    
    if (this.isFollowing) {
      followBtn.textContent = 'Unfollow';
      followBtn.classList.add('following');
    } else {
      followBtn.textContent = 'Follow';
      followBtn.classList.remove('following');
    }
  }

  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Remove markdown and html
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // remove markdown links but keep text
        .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
        .replace(/#{1,6}\s/g, '') // remove headings
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // convert bold to normal text
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // convert italic to normal text
        .replace(/~~(.*?)~~/g, '$1') // convert strikethrough to normal text
        .replace(/```[\s\S]*?```/g, '') // remove code blocks
        .replace(/\n\n/g, ' ') // replace double newlines with space
        .replace(/\n/g, ' ') // replace single newlines with space
        .trim();
    
    // Truncate and add ellipsis if necessary
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }

  parseMetadata(jsonMetadata) {
    try {
      if (typeof jsonMetadata === 'string') {
        return JSON.parse(jsonMetadata);
      }
      return jsonMetadata || {};
    } catch (e) {
      return {};
    }
  }

  getBestImage(post, metadata) {
    return ImageUtils.getBestImageUrl(post.body, metadata);
  }

  unmount() {
    // Clean up any event listeners or resources
  }
}

export default ProfileView;
