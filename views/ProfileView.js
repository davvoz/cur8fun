import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import GridController from '../components/GridController.js';

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
    this.page = 1;
    this.infiniteScroll = null;
    this.hasMorePosts = true;
    this.hasMoreComments = true;
    this.gridController = null;
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
      
      // Initialize grid controller
      this.initGridController();
      
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

    // Fetch follower and following counts
    const followerCount = await profileService.getFollowerCount(this.username);
    const followingCount = await profileService.getFollowingCount(this.username);

    this.profile.followerCount = followerCount;
    this.profile.followingCount = followingCount;
  }

  async loadPosts() {
    if (this.postsLoading) return;
    
    const postsContainer = this.container.querySelector('.profile-posts');
    if (!postsContainer) return;
    
    this.postsLoading = true;
    
    // Only show loading indicator on first load
    if (this.page === 1) {
      postsContainer.innerHTML = '<div class="loading-indicator">Loading posts...</div>';
    } else {
      // For subsequent pages, just add a loader at the bottom
      const loader = document.createElement('div');
      loader.className = 'post-page-loader';
      loader.innerHTML = '<div class="loading-indicator">Loading more posts...</div>';
      postsContainer.appendChild(loader);
    }
    
    try {
      // Fetch posts with pagination
      const newPosts = await profileService.getUserPosts(this.username, 10, this.page);
      
      // If this is the first page, clear the container
      if (this.page === 1) {
        postsContainer.innerHTML = '';
        this.posts = [];
      } else {
        // Remove loader if it exists
        const loader = postsContainer.querySelector('.post-page-loader');
        if (loader) loader.remove();
      }
      
      // Check if we have more posts
      this.hasMorePosts = newPosts && newPosts.length === 10;
      
      if (newPosts && newPosts.length > 0) {
        // Append new posts to our existing array
        this.posts = [...this.posts, ...newPosts];
        
        // Render the new posts
        newPosts.forEach(post => {
          const postItem = this.createPostItem(post);
          postsContainer.appendChild(postItem);
        });
        
        // Initialize infinite scroll on first load
        if (this.page === 1) {
          this.setupInfiniteScroll();
        }
        
        this.page++;
      } else if (this.page === 1) {
        // No posts at all
        postsContainer.innerHTML = `
          <div class="empty-posts-message">
            @${this.username} hasn't published any posts yet.
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      if (this.page === 1) {
        postsContainer.innerHTML = `
          <div class="error-message">
            Failed to load posts for @${this.username}
            <button class="retry-btn">Retry</button>
          </div>
        `;
        
        // Add retry handler
        postsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
          this.page = 1;
          this.loadPosts();
        });
      }
    } finally {
      this.postsLoading = false;
    }
  }
  
  setupInfiniteScroll() {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    const postsContainer = this.container.querySelector('.profile-posts');
    if (!postsContainer) return;
    
    // Initialize new infinite scroll
    this.infiniteScroll = new InfiniteScroll({
      container: postsContainer,
      loadMore: async (page) => {
        if (!this.hasMorePosts) return false;
        
        // Skip loadPosts function logic and go straight to API
        if (this.postsLoading) return false;
        
        this.postsLoading = true;
        try {
          const newPosts = await profileService.getUserPosts(this.username, 10, page);
          
          if (newPosts && newPosts.length > 0) {
            // Append new posts to container
            newPosts.forEach(post => {
              const postItem = this.createPostItem(post);
              postsContainer.appendChild(postItem);
            });
            
            // Update state
            this.posts = [...this.posts, ...newPosts];
            this.hasMorePosts = newPosts.length === 10;
            return this.hasMorePosts;
          }
          
          this.hasMorePosts = false;
          return false;
        } catch (error) {
          console.error('Error loading more posts:', error);
          return false;
        } finally {
          this.postsLoading = false;
        }
      },
      threshold: '200px',
      initialPage: this.page
    });
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
    
    // Add grid controller container
    const gridControlContainer = document.createElement('div');
    gridControlContainer.className = 'grid-controller-container';
    container.appendChild(gridControlContainer);
    
    // Create profile tabs
    const tabs = this.createProfileTabs();
    container.appendChild(tabs);
    
    // Create posts container (ensure it has the correct class for the grid controller)
    const postsArea = document.createElement('div');
    postsArea.className = 'profile-posts posts-container'; // Added 'posts-container' class
    container.appendChild(postsArea);
  }

  createProfileHeader() {
    const header = document.createElement('div');
    header.className = 'profile-header';
    
    // Add cover image with better styling and error handling
    const coverDiv = document.createElement('div');
    coverDiv.className = 'profile-cover';
    if (this.profile.coverImage) {
      console.log('Cover image URL:', this.profile.coverImage); // Debug log
      
      // Check if URL needs proxy for CORS issues
      let coverImageUrl = this.profile.coverImage;
      if (!coverImageUrl.startsWith('data:') && !coverImageUrl.includes('steemitimages.com/0x0/')) {
        // Use Steemit proxy to avoid CORS issues and ensure image loading
        coverImageUrl = `https://steemitimages.com/0x0/${coverImageUrl}`;
      }
      
      coverDiv.style.backgroundImage = `url(${coverImageUrl})`;
      
      // Add error handling for cover image
      const testImg = new Image();
      testImg.onerror = () => {
        console.error('Failed to load cover image, using fallback gradient');
        coverDiv.style.backgroundImage = 'linear-gradient(45deg, var(--primary-color) 0%, var(--secondary-color) 100%)';
      };
      testImg.src = coverImageUrl;
    }
    
    // Add profile info section with modern layout
    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';
    
    // Avatar with enhanced styling
    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    
    const avatarImg = document.createElement('img');
    avatarImg.src = this.profile.profileImage;
    avatarImg.alt = this.profile.username;
    avatarImg.loading = 'eager'; // Prioritize avatar loading
    avatarImg.onerror = () => {
      avatarImg.src = '/assets/images/default-avatar.png';
    };
    
    avatar.appendChild(avatarImg);
    
    // Profile stats with improved layout
    const stats = document.createElement('div');
    stats.className = 'profile-stats';
    
    // User metadata with enhanced styling
    const userMeta = document.createElement('div');
    userMeta.className = 'user-metadata';
    
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
    
    userMeta.appendChild(name);
    userMeta.appendChild(handle);
    
    // Bio with modern styling
    const bio = document.createElement('div');
    bio.className = 'profile-bio';
    
    // Add profile description with better formatting
    if (this.profile.about) {
      const bioText = document.createElement('p');
      bioText.textContent = this.profile.about;
      bio.appendChild(bioText);
    } else {
      const noBio = document.createElement('p');
      noBio.className = 'no-bio';
      noBio.textContent = 'No bio provided';
      bio.appendChild(noBio);
    }
    
    // Add location if available
    if (this.profile.location) {
      const location = document.createElement('div');
      location.className = 'profile-location';
      
      const locationIcon = document.createElement('span');
      locationIcon.className = 'material-icons';
      locationIcon.textContent = 'location_on';
      
      const locationText = document.createElement('span');
      locationText.textContent = this.profile.location;
      
      location.appendChild(locationIcon);
      location.appendChild(locationText);
      bio.appendChild(location);
    }
    
    // Add website if available
    if (this.profile.website) {
      const website = document.createElement('div');
      website.className = 'profile-website';
      
      const websiteIcon = document.createElement('span');
      websiteIcon.className = 'material-icons';
      websiteIcon.textContent = 'language';
      
      const websiteLink = document.createElement('a');
      websiteLink.href = this.profile.website;
      websiteLink.target = '_blank';
      websiteLink.rel = 'noopener noreferrer';
      websiteLink.textContent = this.profile.website.replace(/^https?:\/\//, '');
      
      website.appendChild(websiteIcon);
      website.appendChild(websiteLink);
      bio.appendChild(website);
    }
    
    // Stats metrics with modern card design
    const metrics = document.createElement('div');
    metrics.className = 'profile-metrics';
    
    metrics.appendChild(this.createStatElement('Posts', this.profile.postCount));
    metrics.appendChild(this.createStatElement('Followers', this.profile.followerCount));
    metrics.appendChild(this.createStatElement('Following', this.profile.followingCount));
    
    // Actions with enhanced button styling
    const actions = document.createElement('div');
    actions.className = 'profile-actions';
    
    if (this.currentUser && this.currentUser.username !== this.profile.username) {
      const followBtn = document.createElement('button');
      followBtn.className = 'follow-btn';
      followBtn.textContent = 'Follow';
      
      // Add icon to follow button
      const followIcon = document.createElement('span');
      followIcon.className = 'material-icons';
      followIcon.textContent = 'person_add';
      followBtn.prepend(followIcon);
      
      followBtn.addEventListener('click', () => this.handleFollowAction());
      actions.appendChild(followBtn);
      
      // Add message button
      const messageBtn = document.createElement('button');
      messageBtn.className = 'message-btn';
      
      const msgIcon = document.createElement('span');
      msgIcon.className = 'material-icons';
      msgIcon.textContent = 'chat';
      
      messageBtn.appendChild(msgIcon);
      messageBtn.appendChild(document.createTextNode('Message'));
      
      messageBtn.addEventListener('click', () => {
        // Handle message functionality
        console.log('Message button clicked');
      });
      
      actions.appendChild(messageBtn);
    } else if (this.currentUser && this.currentUser.username === this.profile.username) {
      // Add edit profile button for own profile
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-profile-btn';
      
      const editIcon = document.createElement('span');
      editIcon.className = 'material-icons';
      editIcon.textContent = 'edit';
      
      editBtn.appendChild(editIcon);
      editBtn.appendChild(document.createTextNode('Edit Profile'));
      
      editBtn.addEventListener('click', () => {
        router.navigate(`/edit-profile/${this.username}`);
      });
      
      actions.appendChild(editBtn);
    }
    
    // Assemble all components with improved structure
    stats.appendChild(userMeta);
    stats.appendChild(bio);
    stats.appendChild(metrics);
    stats.appendChild(actions);
    
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
    
    // Reset pagination and cleanup infinite scroll
    this.page = 1;
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Reset grid controller for the new tab content
    if (this.gridController) {
      const postsContainer = this.container.querySelector('.profile-posts');
      if (postsContainer) {
        const layout = localStorage.getItem('grid-layout') || 'grid';
        postsContainer.className = 'profile-posts posts-container'; // Reset classes
        postsContainer.classList.add(`grid-layout-${layout}`); // Apply saved layout
      }
    }
    
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
    
    const imageUrl = this.getPreviewImage(post) || 'assets/images/placeholder.png';
    
    // Add thumbnail - Always create it for all layouts
    const thumbnail = document.createElement('div');
    thumbnail.className = 'post-thumbnail post-grid-thumbnail';
    thumbnail.style.backgroundImage = `url(${imageUrl})`;
    postItem.appendChild(thumbnail);
    
    const postContent = document.createElement('div');
    postContent.className = 'post-content';
    
    // Post title with better styling
    const title = document.createElement('h3');
    title.className = 'post-title';
    title.textContent = post.title || '(Untitled)';
    
    // Post metadata
    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';
    
    // Add date info
    const dateInfo = document.createElement('span');
    dateInfo.className = 'post-date';
    
    const dateIcon = document.createElement('span');
    dateIcon.className = 'material-icons';
    dateIcon.textContent = 'schedule';
    dateInfo.appendChild(dateIcon);
    
    const dateText = document.createElement('span');
    dateText.textContent = new Date(post.created).toLocaleDateString();
    dateInfo.appendChild(dateText);
    
    // Add votes info
    const votesInfo = document.createElement('span');
    votesInfo.className = 'post-votes';
    
    const votesIcon = document.createElement('span');
    votesIcon.className = 'material-icons';
    votesIcon.textContent = 'thumb_up';
    votesInfo.appendChild(votesIcon);
    
    const votesText = document.createElement('span');

    // Calculate total votes
    const totalVotes = this.getVoteCount(post);
    votesText.textContent = totalVotes.toLocaleString();

    votesInfo.appendChild(votesText);
    
    // Add comments count
    const commentsInfo = document.createElement('span');
    commentsInfo.className = 'post-comments';
    
    const commentsIcon = document.createElement('span');
    commentsIcon.className = 'material-icons';
    commentsIcon.textContent = 'chat_bubble';
    commentsInfo.appendChild(commentsIcon);
    
    const commentsText = document.createElement('span');
    commentsText.textContent = post.children || 0;
    commentsInfo.appendChild(commentsText);
    
    postMeta.appendChild(dateInfo);
    postMeta.appendChild(votesInfo);
    postMeta.appendChild(commentsInfo);
    
    // Post excerpt with better formatting
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = this.createExcerpt(post.body);
    
    postContent.appendChild(title);
    postContent.appendChild(postMeta);
    postContent.appendChild(excerpt);
    
    // Always add content
    postItem.appendChild(postContent);
    
    // Add click handler to navigate to post
    postItem.addEventListener('click', () => {
      router.navigate(`/@${post.author}/${post.permlink}`);
    });
    
    // Add hover animation class
    postItem.classList.add('animated-card');
    
    return postItem;
  }

  getVoteCount(post) {
    // Try different properties that might contain vote count
    if (typeof post.net_votes === 'number') {
      return post.net_votes;
    }
    if (typeof post.active_votes === 'object' && Array.isArray(post.active_votes)) {
      return post.active_votes.length;
    }
    if (typeof post.vote_count === 'number') {
      return post.vote_count;
    }
    // Default to 0 if no valid vote count is found
    return 0;
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

  getPreviewImage(post) {
    const metadata = this.parseMetadata(post.json_metadata);
    //usiamo la prima immagine trovata nel post
    const imageUrl = metadata?.image?.[0];
    //se non c'è immagine nel post, cerchiamo se nel body c'è un link ad un'immagine
    const body = post.body || '';
    const regex = /!\[.*?\]\((.*?)\)/;
    const match = body.match(regex);
    const imageUrlFromBody = match ? match[1] : null;
    //ritorniamo la prima immagine trovata
    return imageUrl || imageUrlFromBody;
  }

  initGridController() {
    if (this.gridController) {
      this.gridController = null;
    }
    
    const gridControllerContainer = this.container.querySelector('.grid-controller-container');
    if (!gridControllerContainer) return;
    
    this.gridController = new GridController({
      targetSelector: '.profile-posts',
    });
    
    this.gridController.render(gridControllerContainer);
  }

  unmount() {
    // Clean up infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Clean up grid controller
    if (this.gridController) {
      this.gridController.unmount();
      this.gridController = null;
    }
    // Clean up any other event listeners or resources
  }
}

export default ProfileView;
