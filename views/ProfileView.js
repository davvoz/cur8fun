import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import router from '../utils/Router.js';
import metaTagService from '../services/MetaTagService.js';
import ProfileHeader from '../components/profile/ProfileHeader.js';
import PostsList from '../components/profile/PostsList.js';
import CommentsList from '../components/profile/CommentsList.js';
import ProfileTabs from '../components/profile/ProfileTabs.js';
import ProfileWalletHistory from '../components/profile/ProfileWalletHistory.js';

// Static cache for components
const componentCache = {
  blog: {},  // blog posts + reblogs (getDiscussionsByBlog)
  posts: {}, // all author posts, no reblogs (getDiscussionsByAuthorBeforeDate)
  comments: {}
};

class ProfileView extends View {
  constructor(params) {
    super();
    this.params = params || {};
    this.username = this.params.username;
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.container = null;
    this.profile = null;
    
    // Aggiungi questa proprietà
    this.walletContainer = null;
    
    // Get components from cache or create new ones
    this.initializeComponentsFromCache();
    
    // Check if we're coming from a non-profile page
    const isDirectNavigation = this.isDirectNavigation();
    
    // Get cached tab if available, but default to 'blog' when coming from non-profile pages
    this.currentTab = (isDirectNavigation || !ProfileTabs.activeTabCache[this.username]) ? 
                      'blog' : ProfileTabs.activeTabCache[this.username];
    
    this.blogContainer = null;
    this.postsContainer = null;
    this.commentsContainer = null;
    this.walletContainer = null;
    this.walletHistoryComponent = null;
    this.postsArea = null;
    this.isSwitchingTab = false;
    this.pendingTabSwitch = null;
  }

  // Helper to determine if we're navigating directly to profile
  isDirectNavigation() {
    // Check if we came from another page (like the home)
    const referrer = document.referrer;
    
    // If no referrer or different origin, consider it direct navigation
    if (!referrer || new URL(referrer).origin !== window.location.origin) {
      return true;
    }
    
    // Check if the previous page was not a profile page
    const referrerPath = new URL(referrer).pathname;
    const isFromProfilePage = referrerPath.includes('/@');
    
    // Return true if we're NOT coming from another profile page
    return !isFromProfilePage;
  }

  initializeComponentsFromCache() {
    // Create profile header component (no caching needed)
    this.profileHeader = null; // Will be initialized after profile data is loaded
    
    // Create tabs manager - always create fresh to ensure proper initialization
    this.tabsManager = new ProfileTabs((tabName) => this.switchTab(tabName), {
      manageContentContainers: false
    });
    
    // Get or create blog component (blog posts + reblogs)
    if (!componentCache.blog[this.username]) {
      componentCache.blog[this.username] = new PostsList(this.username, true, 'blog');
    } else {
      componentCache.blog[this.username].reset();
    }
    this.blogComponent = componentCache.blog[this.username];

    // Get or create posts component (all author posts, no reblogs)
    if (!componentCache.posts[this.username]) {
      componentCache.posts[this.username] = new PostsList(this.username, true, 'posts');
    } else {
      componentCache.posts[this.username].reset();
    }
    this.postsComponent = componentCache.posts[this.username];
    
    // Usa la cache anche per i commenti
    if (!componentCache.comments[this.username]) {
      componentCache.comments[this.username] = new CommentsList(this.username, true);
    } else {
      componentCache.comments[this.username].prepareForReuse();
    }
    this.commentsComponent = componentCache.comments[this.username];
  }

  async render(container) {
    this.container = container;
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    container.appendChild(profileContainer);

    // Show profile skeleton (mirrors: cover banner, avatar, name/handle, bio, metrics, tabs)
    const skeletonEl = document.createElement('div');
    skeletonEl.className = 'skeleton-profile-wrapper';
    skeletonEl.innerHTML = `
      <div class="skeleton-profile">
        <div class="sk-block sk-prof-banner"></div>
        <div class="sk-prof-info">
          <div class="sk-block sk-prof-avatar"></div>
          <div class="sk-prof-stats">
            <div class="sk-block sk-prof-name"></div>
            <div class="sk-block sk-prof-handle"></div>
            <div class="sk-block sk-prof-bio1"></div>
            <div class="sk-block sk-prof-bio2"></div>
            <div class="sk-prof-metrics">
              <div class="sk-block sk-prof-stat"></div>
              <div class="sk-block sk-prof-stat"></div>
              <div class="sk-block sk-prof-stat"></div>
            </div>
            <div class="sk-block sk-prof-action"></div>
          </div>
        </div>
      </div>
      <div class="sk-prof-tabs">
        <div class="sk-block sk-prof-tab"></div>
        <div class="sk-block sk-prof-tab"></div>
        <div class="sk-block sk-prof-tab"></div>
      </div>
    `;
    profileContainer.appendChild(skeletonEl);

    try {
      // Load profile data
      await this.loadProfileData();

      // Remove skeleton before rendering real content
      skeletonEl.remove();

      // Render profile structure
      this.renderProfile(profileContainer);
      
      // Initialize components
      this.initComponents();
      
      // Render components
      this.renderComponents(profileContainer);
      
      // Load initial content based on current tab
      this.loadContentForCurrentTab();
      
      // Check if logged-in user is following this profile
      await this.checkFollowStatus();
    } catch (error) {
      skeletonEl.remove();
      this.renderErrorState(profileContainer, error);
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

    // Update meta tags for better social sharing
    metaTagService.updateProfileMetaTags(this.profile);

    // Fetch follower and following counts
    const followerCount = await profileService.getFollowerCount(this.username);
    const followingCount = await profileService.getFollowingCount(this.username);

    this.profile.followerCount = followerCount;
    this.profile.followingCount = followingCount;
  }
  
  renderProfile(container) {
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'profile-content-container';
    container.appendChild(contentContainer);
  }
  
  initComponents() {
    // Create profile header component with the now-loaded profile data
    this.profileHeader = new ProfileHeader(
      this.profile, 
      this.currentUser, 
      () => this.handleFollowAction()
    );
    
    // Don't reinitialize other components - we're using cached ones
  }
  
  renderComponents(container) {
    // Clear content container first
    const contentContainer = container.querySelector('.profile-content-container');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = '';
    
    // Render header
    this.profileHeader.render(contentContainer);
    
    // Render tabs
    this.tabsManager.render(contentContainer);

    // ProfileTabs creates legacy placeholder containers that are not used by this view.
    // Removing them avoids duplicate DOM and visual flicker during tab switches.
    contentContainer.querySelectorAll('.profile-tab-content').forEach((el) => el.remove());
    
    // Create a container for the posts/comments/wallet
    const postsArea = document.createElement('div');
    postsArea.className = 'profile-posts-area';
    postsArea.style.width = '100%';
    postsArea.style.maxWidth = '100%';
    postsArea.style.overflow = 'hidden';
    contentContainer.appendChild(postsArea);
    this.postsArea = postsArea;
  }
  
  loadContentForCurrentTab() {
    const postsArea = this.getPostsArea();
    if (!postsArea) return;
    
    this.initializeContainersIfNeeded(postsArea);
    
    if (this.currentTab === 'blog') {
      this.updateContainerVisibility(
        this.blogContainer,
        [this.postsContainer, this.commentsContainer, this.walletContainer],
        null, []
      );
      this.loadComponentContent(this.blogComponent, this.blogContainer, 'blog');
    } else if (this.currentTab === 'posts') {
      this.updateContainerVisibility(
        this.postsContainer,
        [this.blogContainer, this.commentsContainer, this.walletContainer],
        null, []
      );
      this.loadComponentContent(this.postsComponent, this.postsContainer, 'posts');
    } else if (this.currentTab === 'comments') {
      this.updateContainerVisibility(
        this.commentsContainer,
        [this.blogContainer, this.postsContainer, this.walletContainer],
        null, []
      );
      this.loadComponentContent(this.commentsComponent, this.commentsContainer, 'comments');
    } else if (this.currentTab === 'wallet') {
      this.updateContainerVisibility(
        this.walletContainer,
        [this.blogContainer, this.postsContainer, this.commentsContainer],
        null, []
      );
      if (!this.walletHistoryComponent) {
        this.walletHistoryComponent = new ProfileWalletHistory(this.username);
        this.walletHistoryComponent.render(this.walletContainer);
      } else {
        this.walletHistoryComponent.setVisibility(true);
        this.walletHistoryComponent.updateUsername(this.username);
      }
    }
  }
  
  initializeContainersIfNeeded(postsArea) {
    const hasConnectedContainers = this.blogContainer
      && this.postsContainer
      && this.commentsContainer
      && this.walletContainer
      && this.blogContainer.parentElement === postsArea
      && this.postsContainer.parentElement === postsArea
      && this.commentsContainer.parentElement === postsArea
      && this.walletContainer.parentElement === postsArea
      && this.blogContainer.isConnected
      && this.postsContainer.isConnected
      && this.commentsContainer.isConnected
      && this.walletContainer.isConnected;

    if (hasConnectedContainers) return;

    this.blogContainer = null;
    this.postsContainer = null;
    this.commentsContainer = null;
    this.walletContainer = null;
    if (!postsArea) return;
    
    // Blog container (blog posts + reblogs)
    this.blogContainer = document.createElement('div');
    this.blogContainer.className = 'posts-list-container profile-blog-container profile-tab-panel';
    this.blogContainer.style.width = '100%';
    
    // Posts container (all author posts, no reblogs)
    this.postsContainer = document.createElement('div');
    this.postsContainer.className = 'posts-list-container profile-posts-container profile-tab-panel';
    this.postsContainer.style.width = '100%';
    
    this.commentsContainer = document.createElement('div');
    this.commentsContainer.className = 'comments-list-container profile-comments-container profile-tab-panel';
    this.commentsContainer.style.width = '100%';
    
    this.walletContainer = document.createElement('div');
    this.walletContainer.className = 'wallet-list-container profile-wallet-container profile-tab-panel';
    this.walletContainer.style.width = '100%';

    const containers = [this.blogContainer, this.postsContainer, this.commentsContainer, this.walletContainer];
    containers.forEach((container) => {
      container.classList.add('is-hidden');
      container.classList.remove('is-visible');
    });
    
    postsArea.appendChild(this.blogContainer);
    postsArea.appendChild(this.postsContainer);
    postsArea.appendChild(this.commentsContainer);
    postsArea.appendChild(this.walletContainer);
  }
  

  
  updateContainerVisibility(activeContainer, inactiveContainers, activeGridContainer, inactiveGridContainers) {
    if (activeContainer) {
      this.showContainer(activeContainer);
    }

    inactiveContainers.forEach(container => {
      if (container) {
        this.hideContainer(container);
      }
    });

    if (activeGridContainer) {
      activeGridContainer.style.display = '';
    }

    inactiveGridContainers.forEach(container => {
      if (container) {
        container.style.display = 'none';
      }
    });
  }

  showContainer(container) {
    container.classList.remove('is-hidden');
    container.style.display = '';
    requestAnimationFrame(() => {
      container.classList.add('is-visible');
    });
  }

  hideContainer(container) {
    container.classList.add('is-hidden');
    container.classList.remove('is-visible');
    container.style.display = 'none';
  }

  getPostsArea() {
    if (this.postsArea && this.postsArea.isConnected) {
      return this.postsArea;
    }

    const postsArea = this.container?.querySelector('.profile-posts-area') || null;
    this.postsArea = postsArea;
    return postsArea;
  }
  
  loadComponentContent(component, container, tabName) {
    if (tabName === 'blog' || tabName === 'posts') {
      const hasPosts = Array.isArray(component.posts) && component.posts.length > 0;
      const hasDom = !!container.querySelector('.posts-container');
      if (hasPosts && hasDom) {
        setTimeout(() => { component.refreshGridLayout(); }, 50);
      } else {
        component.render(container);
      }
    } else {
      // Comments: always delegate to render(); the component handles cache internally
      component.render(container);
    }
  }
  
  async switchTab(tabName) {
    if (this.currentTab === tabName) return;

    if (this.isSwitchingTab) {
      this.pendingTabSwitch = tabName;
      return;
    }

    this.isSwitchingTab = true;

    try {

      if (!this.blogContainer || !this.postsContainer || !this.commentsContainer || !this.walletContainer) {
        this.initializeContainersIfNeeded(this.getPostsArea());
      }
    
      const blog = this.blogContainer;
      const posts = this.postsContainer;
      const comments = this.commentsContainer;
      const wallet = this.walletContainer;
    
      switch(tabName) {
        case 'blog':
          if (this.blogComponent) {
            const hasBlogPosts = Array.isArray(this.blogComponent.posts) && this.blogComponent.posts.length > 0;
            const hasBlogDom = !!blog.querySelector('.posts-container');
            if (hasBlogPosts && hasBlogDom) {
              setTimeout(() => { this.blogComponent.refreshGridLayout(); }, 50);
            } else {
              await this.blogComponent.render(blog);
            }
          }
          this.updateContainerVisibility(blog, [posts, comments, wallet], null, []);
          break;

        case 'posts':
          if (this.postsComponent) {
            const hasPostsPosts = Array.isArray(this.postsComponent.posts) && this.postsComponent.posts.length > 0;
            const hasPostsDom = !!posts.querySelector('.posts-container');
            if (hasPostsPosts && hasPostsDom) {
              setTimeout(() => { this.postsComponent.refreshGridLayout(); }, 50);
            } else {
              await this.postsComponent.render(posts);
            }
          }
          this.updateContainerVisibility(posts, [blog, comments, wallet], null, []);
          break;
        
        case 'comments':
          this.updateContainerVisibility(comments, [blog, posts, wallet], null, []);
          if (this.commentsComponent && comments) {
            const hasCommentsData = Array.isArray(this.commentsComponent.allComments) && this.commentsComponent.allComments.length > 0;
            const hasCommentsDom = !!comments.querySelector('.comments-list-wrapper');
            if (hasCommentsData && hasCommentsDom) {
              setTimeout(() => { this.commentsComponent.forceLayoutRefresh(); }, 50);
            } else {
              this.commentsComponent.render(comments);
            }
          }
          break;
        
        case 'wallet':
          this.updateContainerVisibility(wallet, [blog, posts, comments], null, []);
          if (!this.walletHistoryComponent) {
            try {
              this.walletHistoryComponent = new ProfileWalletHistory(this.username);
              this.walletHistoryComponent.render(wallet);
            } catch(error) {
              wallet.innerHTML = `<div class="error-message">Failed to load wallet history</div>`;
            }
          } else {
            this.walletHistoryComponent.setVisibility(true);
            this.walletHistoryComponent.updateUsername(this.username);
          }
          break;
      }
    
      this.currentTab = tabName;
      ProfileTabs.activeTabCache[this.username] = tabName;
    } finally {
      this.isSwitchingTab = false;

      if (this.pendingTabSwitch && this.pendingTabSwitch !== this.currentTab) {
        const nextTab = this.pendingTabSwitch;
        this.pendingTabSwitch = null;
        this.switchTab(nextTab);
      } else {
        this.pendingTabSwitch = null;
      }
    }
  }
  
  async checkFollowStatus() {
    if (!this.currentUser || !this.profileHeader) return;

    try {
      const isFollowing = await profileService.isFollowing(this.username, this.currentUser);
      this.profileHeader.updateFollowStatus(isFollowing);
    } catch (error) {
    }
  }
  
  async handleFollowAction() {
    if (!this.currentUser) {
      // Redirect to login if not logged in
      router.navigate('/login', { returnUrl: `/@${this.username}` });
      return;
    }

    try {
      // Mostro l'indicatore di caricamento
      this.profileHeader.setFollowButtonLoading(true);
      
      // Ottieni lo stato del follow prima dell'azione
      const isCurrentlyFollowing = await profileService.isFollowing(this.username, this.currentUser);
      
      // Memorizza lo stato iniziale per riferimento
      const previousFollowState = isCurrentlyFollowing;
      
      // Memorizza il nuovo stato previsto (opposto di quello precedente)
      const newExpectedState = !previousFollowState;
      
      if (isCurrentlyFollowing) {
        // Se già seguendo, smetti di seguire
        await profileService.unfollowUser(this.username, this.currentUser);
        
        // Aggiorna lo stato direttamente per evitare ritardi nella UI
        this.profileHeader.updateFollowStatus(false);
      } else {
        // Altrimenti inizia a seguire
        await profileService.followUser(this.username, this.currentUser);
        
        // Aggiorna lo stato direttamente per evitare ritardi nella UI
        this.profileHeader.updateFollowStatus(true);
      }

      // Mantieni lo stato dell'UI allineato con l'azione intrapresa dall'utente
      // anziché fare un'ulteriore verifica che potrebbe restituire dati non aggiornati
      
      // Importante: Impostiamo una cache locale dello stato di follow
      // per evitare che API successive sovrascrivano lo stato dell'UI
      if (window.eventEmitter) {
        window.eventEmitter.emit('follow:status-cache', {
          follower: this.currentUser.username,
          following: this.username,
          isFollowing: newExpectedState,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      if (window.eventEmitter) {
        window.eventEmitter.emit('notification', {
          type: 'error',
          message: `Failed to update follow status for @${this.username}: ${error.message}`
        });
      }
    } finally {
      // Rimuovi l'indicatore di caricamento indipendentemente dal risultato
      this.profileHeader.setFollowButtonLoading(false);
    }
  }
  
  renderErrorState(container, error) {
    const escapeHTML = (str) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const safeMessage = escapeHTML(error.message || 'An unknown error occurred');

    container.innerHTML = `
      <div class="profile-render-error">
        <h2>Error loading profile</h2>
        <p>${safeMessage}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;

    container.querySelector('.retry-btn')?.addEventListener('click', () => {
      this.render(this.container);
    });
  }
  
  unmount() {
    this.postsArea = null;
    this.isSwitchingTab = false;
    this.pendingTabSwitch = null;

    // Clean up blog component
    if (this.blogComponent) {
      this.blogComponent.unmount();
      this.blogLoaded = false;
      this.blogContainer = null;
    }
    
    // Clean up posts component
    if (this.postsComponent) {
      this.postsComponent.unmount();
      this.postsLoaded = false;
      this.postsContainer = null;
    }
    
    // Clean up comments component
    if (this.commentsComponent) {
      this.commentsComponent.unmount();
      this.commentsLoaded = false;
      this.commentsContainer = null;
    }
    
    // Clean up wallet component
    if (this.walletHistoryComponent) {
      this.walletHistoryComponent.destroy();
      this.walletHistoryComponent = null;
    }
  }
}

export default ProfileView;
