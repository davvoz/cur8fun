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
    
    // Mostra loader solo alla prima pagina
    if (this.page === 1) {
        postsContainer.innerHTML = `
            <div class="loading-indicator">
                <div class="spinner"></div>
                <div class="loading-text">Caricamento post...</div>
                <div class="loading-subtext">Recupero post per @${this.username}</div>
            </div>
        `;
    } else {
        // Per le pagine successive, aggiungi un loader in fondo
        const loader = document.createElement('div');
        loader.className = 'post-page-loader';
        loader.innerHTML = '<div class="loading-indicator">Caricamento altri post...</div>';
        postsContainer.appendChild(loader);
    }
    
    try {
        // Per la prima pagina, chiedi un refresh forzato
        const params = {
            forceRefresh: this.page === 1
        };
        
        // Aumentiamo il limite a 30 post per pagina per caricarne di più alla volta
        const POSTS_PER_PAGE = 30;
        
        // Recupera i post con paginazione
        const newPosts = await profileService.getUserPosts(this.username, POSTS_PER_PAGE, this.page, params);
        
        // Rimuovi il loader
        if (this.page === 1) {
            postsContainer.innerHTML = '';
        } else {
            const loader = postsContainer.querySelector('.post-page-loader');
            if (loader) loader.remove();
        }
        
        // Se non ci sono post
        if (!newPosts || newPosts.length === 0) {
            if (this.page === 1) {
                // Messaggio vuoto alla prima pagina
                postsContainer.innerHTML = `
                    <div class="empty-posts-message">
                        @${this.username} non ha ancora pubblicato nessun post.
                    </div>
                `;
            } else {
                // Non ci sono più post in pagine successive
                this.hasMorePosts = false;
                
                // Aggiungi un messaggio di fine
                const noMoreMsg = document.createElement('div');
                noMoreMsg.className = 'no-more-posts';
                noMoreMsg.textContent = `Caricati tutti i ${this.posts.length} post disponibili`;
                noMoreMsg.style.textAlign = 'center';
                noMoreMsg.style.margin = '20px 0';
                noMoreMsg.style.color = '#666';
                postsContainer.appendChild(noMoreMsg);
            }
            
            this.postsLoading = false;
            return;
        }
        
        // Aggiungi i nuovi post alla collezione
        if (this.page === 1) {
            this.posts = [];
        }
        
        // Verifica che non ci siano duplicati
        const currentPostIds = new Set(this.posts.map(p => `${p.author}_${p.permlink}`));
        const uniqueNewPosts = newPosts.filter(post => {
            const postId = `${post.author}_${post.permlink}`;
            return !currentPostIds.has(postId);
        });
        
        // Aggiungi il contatore di post all'inizio se è la prima pagina
        if (this.page === 1 && uniqueNewPosts.length > 0) {
            const postCounter = document.createElement('div');
            postCounter.className = 'post-counter';
            postCounter.innerHTML = `<span>Caricati <strong>${uniqueNewPosts.length}</strong> post di ${this.username}</span>`;
            postCounter.style.textAlign = 'center';
            postCounter.style.padding = '10px';
            postCounter.style.margin = '0 0 20px 0';
            postCounter.style.backgroundColor = '#f5f8fa';
            postCounter.style.borderRadius = '5px';
            postsContainer.appendChild(postCounter);
        }
        
        this.posts = [...this.posts, ...uniqueNewPosts];
        
        // Aggiorna il contatore di post se esiste
        const postCounter = postsContainer.querySelector('.post-counter');
        if (postCounter) {
            postCounter.innerHTML = `<span>Caricati <strong>${this.posts.length}</strong> post di ${this.username}</span>`;
        }
        
        // Renderizza i nuovi post
        uniqueNewPosts.forEach(post => {
            const postItem = this.createPostItem(post);
            postsContainer.appendChild(postItem);
        });
        
        // Controlla se ci sono altri post - considera un numero di post inferiore al limite come segno che non ci sono altri post
        this.hasMorePosts = newPosts.length >= POSTS_PER_PAGE;
        
        // Inizializza infinite scroll alla prima pagina
        if (this.page === 1) {
            this.setupInfiniteScroll(POSTS_PER_PAGE);
        }
        
        // Incrementa il numero di pagina
        this.page++;
    } catch (error) {
        console.error('Error loading posts:', error);
        
        // Mostra un errore all'utente
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <p>Si è verificato un errore durante il caricamento dei post.</p>
            <button class="retry-btn">Riprova</button>
        `;
        postsContainer.appendChild(errorDiv);
        
        // Aggiungi handler per il pulsante di riprovare
        errorDiv.querySelector('.retry-btn').addEventListener('click', () => {
            errorDiv.remove();
            this.loadPosts();
        });
    } finally {
        this.postsLoading = false;
    }
}
  
setupInfiniteScroll(postsPerPage = 30) {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      console.log('Destroying existing infinite scroll');
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    const postsContainer = this.container.querySelector('.profile-posts');
    if (!postsContainer) {
      console.error('Cannot find posts container for infinite scroll');
      return;
    }
    
    console.log('Setting up infinite scroll for posts');
    
    // Initialize new infinite scroll with correct page tracking
    this.infiniteScroll = new InfiniteScroll({
      container: postsContainer,
      loadMore: async (page) => {
        console.log(`InfiniteScroll triggered for posts page ${page}`);
        
        if (!this.hasMorePosts) {
          console.log('No more posts to load');
          return false;
        }
        
        if (this.postsLoading) {
          console.log('Already loading posts, skipping this request');
          return false;
        }
        
        this.postsLoading = true;
        try {
          console.log(`Loading posts page ${page}`);
          
          // Aggiungi un indicatore di caricamento temporaneo
          const tempLoader = document.createElement('div');
          tempLoader.className = 'temp-loader';
          tempLoader.innerHTML = `<div class="loading-indicator">Caricamento pagina ${page}...</div>`;
          postsContainer.appendChild(tempLoader);
          
          // Utilizza i parametri corretti per il caricamento
          const newPosts = await profileService.getUserPosts(this.username, postsPerPage, page);
          
          // Rimuovi il loader temporaneo
          const loader = postsContainer.querySelector('.temp-loader');
          if (loader) loader.remove();
          
          if (newPosts && newPosts.length > 0) {
            console.log(`Loaded ${newPosts.length} new posts for page ${page}`);
            
            // Verifica che non ci siano duplicati prima di aggiungerli
            const currentPostIds = new Set(this.posts.map(p => `${p.author}_${p.permlink}`));
            const uniqueNewPosts = newPosts.filter(post => {
              const postId = `${post.author}_${post.permlink}`;
              return !currentPostIds.has(postId);
            });
            
            console.log(`After filtering: ${uniqueNewPosts.length} unique new posts`);
            
            // Aggiungi i post unici alla vista
            if (uniqueNewPosts.length > 0) {
              uniqueNewPosts.forEach(post => {
                const postItem = this.createPostItem(post);
                postsContainer.appendChild(postItem);
              });
              
              // Aggiorna la collezione completa
              this.posts = [...this.posts, ...uniqueNewPosts];
              
              // Aggiorna il contatore di post
              const postCounter = postsContainer.querySelector('.post-counter');
              if (postCounter) {
                postCounter.innerHTML = `<span>Caricati <strong>${this.posts.length}</strong> post di ${this.username}</span>`;
              }
              
              // Determina se ci sono altri post da caricare
              this.hasMorePosts = newPosts.length >= postsPerPage;
              return this.hasMorePosts;
            } else {
              console.log('No unique posts found, stopping infinite scroll');
              this.hasMorePosts = false;
              
              // Aggiungi messaggio di fine
              const noMoreMsg = document.createElement('div');
              noMoreMsg.className = 'no-more-posts';
              noMoreMsg.textContent = `Caricati tutti i ${this.posts.length} post disponibili`;
              noMoreMsg.style.textAlign = 'center';
              noMoreMsg.style.margin = '20px 0';
              noMoreMsg.style.color = '#666';
              postsContainer.appendChild(noMoreMsg);
              
              return false;
            }
          } else {
            console.log('No posts returned for page ' + page);
            this.hasMorePosts = false;
            
            // Aggiungi messaggio di fine
            const noMoreMsg = document.createElement('div');
            noMoreMsg.className = 'no-more-posts';
            noMoreMsg.textContent = `Caricati tutti i ${this.posts.length} post disponibili`;
            noMoreMsg.style.textAlign = 'center';
            noMoreMsg.style.margin = '20px 0';
            noMoreMsg.style.color = '#666';
            postsContainer.appendChild(noMoreMsg);
            
            return false;
          }
        } catch (error) {
          console.error(`Error loading page ${page}:`, error);
          
          // Aggiungi opzione per riprovare
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.innerHTML = `
              <p>Si è verificato un errore durante il caricamento della pagina ${page}.</p>
              <button class="retry-btn">Riprova</button>
          `;
          postsContainer.appendChild(errorDiv);
          
          // Aggiungi handler per il pulsante di riprovare
          errorDiv.querySelector('.retry-btn').addEventListener('click', () => {
              errorDiv.remove();
              this.loadMorePosts(page);
          });
          
          return false;
        } finally {
          this.postsLoading = false;
        }
      },
      threshold: '300px', // Aumenta il threshold per iniziare a caricare prima
      initialPage: this.page
    });
    
    console.log('Posts infinite scroll setup complete');
}

// Metodo helper per caricare più post manualmente
loadMorePosts(page) {
    if (this.infiniteScroll) {
        this.infiniteScroll.loadMore(page);
    }
}

  async loadComments() {
    if (this.commentsLoading) return;
    
    const commentsContainer = this.container.querySelector('.profile-posts'); 
    if (!commentsContainer) return;
    
    // Set flag to indicate we're loading comments
    this.commentsLoading = true;
    
    // Clear the container and show loading indicator
    commentsContainer.innerHTML = `
      <div class="comments-loading">
        <div class="loading-indicator"></div>
        <h3>Loading comments...</h3>
      </div>
    `;
    
    try {
      // Fetch comments using the optimized method
      console.log(`Fetching comments for ${this.username}`);
      
      // Use cache if available, otherwise fetch
      const cacheKey = `${this.username}_comments`;
      let comments = sessionStorage.getItem(cacheKey);
      
      if (comments) {
        console.log('Using cached comments');
        comments = JSON.parse(comments);
      } else {
        // Fetch with a reasonable limit - most users don't have thousands of comments
        comments = await profileService.getUserComments(this.username, 100, 1, true);
        
        // Cache for the session to make tab switching instant
        if (comments && comments.length > 0) {
          sessionStorage.setItem(cacheKey, JSON.stringify(comments));
        }
      }
      
      // Clear the container after loading
      commentsContainer.innerHTML = '';
      
      // Handle the case where no comments were found
      if (!comments || comments.length === 0) {
        commentsContainer.innerHTML = `
          <div class="empty-comments-message">
            @${this.username} hasn't made any comments yet.
          </div>
        `;
        this.commentsLoading = false;
        return;
      }
      
      // Store all comments and render the first batch
      this.allComments = comments;
      console.log(`Retrieved ${comments.length} total comments for ${this.username}`);
      
      // Process first batch (up to 20 comments)
      const firstBatch = comments.slice(0, 20);
      this.comments = firstBatch;
      
      // Render the first batch
      firstBatch.forEach(comment => {
        const commentItem = this.createCommentItem(comment);
        commentsContainer.appendChild(commentItem);
      });
      
      // Setup infinite scroll for remaining comments
      this.hasMoreComments = comments.length > 20;
      this.page = 2; // Start from page 2 next time
      this.setupSimpleCommentsInfiniteScroll();
      
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsContainer.innerHTML = `
        <div class="error-message">
          <h3>Failed to load comments</h3>
          <p>There was an error loading comments for @${this.username}</p>
          <p class="error-details">${error.message || 'Unknown error'}</p>
          <button class="retry-btn">Retry</button>
        </div>
      `;
      
      // Add retry handler
      commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        // Clear cache on retry
        sessionStorage.removeItem(`${this.username}_comments`);
        this.loadComments();
      });
    } finally {
      this.commentsLoading = false;
    }
  }
  
  /**
   * Set up a simpler infinite scroll for comments that doesn't require additional network requests
   */
  setupSimpleCommentsInfiniteScroll() {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    const commentsContainer = this.container.querySelector('.profile-posts');
    if (!commentsContainer || !this.allComments) return;
    
    console.log('Setting up simple infinite scroll for comments');
    
    this.infiniteScroll = new InfiniteScroll({
      container: commentsContainer,
      loadMore: (page) => {
        if (!this.hasMoreComments || !this.allComments) return false;
        
        console.log(`Loading more comments from cache, page ${page}`);
        
        const BATCH_SIZE = 20;
        const startIndex = (page - 1) * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, this.allComments.length);
        
        if (startIndex >= this.allComments.length) {
          return false;
        }
        
        const batch = this.allComments.slice(startIndex, endIndex);
        batch.forEach(comment => {
          const commentItem = this.createCommentItem(comment);
          commentsContainer.appendChild(commentItem);
        });
        
        this.hasMoreComments = endIndex < this.allComments.length;
        return this.hasMoreComments;
      },
      threshold: '200px',
      initialPage: this.page
    });
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
    
    // Check multiple possible locations for cover image
    let coverImageUrl = null;
    
    // Check direct coverImage property
    if (this.profile.coverImage) {
      coverImageUrl = this.profile.coverImage;
    } 
    // Check in posting_json_metadata.cover_image as an alternative location
    else if (this.profile.posting_json_metadata) {
      try {
        const metadata = typeof this.profile.posting_json_metadata === 'string' 
          ? JSON.parse(this.profile.posting_json_metadata) 
          : this.profile.posting_json_metadata;
          console.log('metadata:', metadata); // Debug log
        if (metadata && metadata.cover_image) {
          coverImageUrl = metadata.cover_image;
        }
      } catch (e) {
        console.error('Error parsing posting_json_metadata:', e);
      }
    }
    
    if (coverImageUrl) {
      console.log('Cover image URL:', coverImageUrl); // Debug log
      
      // Check if URL needs proxy for CORS issues
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
    
    
    // Avatar with enhanced styling
    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';
    
    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    
    const avatarImg = document.createElement('img');
    
    avatarImg.src =   `https://steemitimages.com/u/${this.profile.username}/avatar`;
    avatarImg.alt = this.profile.username;
    avatarImg.loading = 'eager'; // Prioritize avatar loading
    avatarImg.onerror = () => {
      avatarImg.src = '/assets/img/default-avatar.png';
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
    
    console.log(`Switching tab from ${this.currentTab} to ${tabName}`);
    
    // Cancel any in-progress loading
    this.cancelCurrentLoading();
    
    // Update tab styling first
    const tabs = this.container.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.textContent.toLowerCase() === tabName) {
        tab.classList.add('active');
      }
    });
    
    // Get the content container and clear it
    const contentContainer = this.container.querySelector('.profile-posts');
    if (contentContainer) {
      contentContainer.innerHTML = '';
    }
    
    // Reset pagination and state for the new tab
    this.page = 1;
    this.currentTab = tabName;
    
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      console.log('Destroying existing infinite scroll');
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Load the appropriate content
    if (tabName === 'posts') {
      // Reset posts data
      this.posts = [];
      this.hasMorePosts = true;
      this.loadPosts();
    } else if (tabName === 'comments') {
      // Reset comments data
      this.comments = [];
      this.allComments = null;
      this.hasMoreComments = true;
      this.loadComments();
    }
  }
  
  /**
   * Cancel any in-progress loading operations
   */
  cancelCurrentLoading() {
    // Clear any loading intervals
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Set loading flags to false to prevent continuations
    this.postsLoading = false;
    this.commentsLoading = false;
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
    if (!post) {
      console.error('Cannot create post item: post data is missing');
      return document.createElement('div');
    }
    
    // Create post container
    const postItem = document.createElement('div');
    postItem.className = 'post-card';
    
    // Add thumbnail with error handling
    this.addPostThumbnail(postItem, post);
    
    // Create content container
    const postContent = document.createElement('div');
    postContent.className = 'post-content';
    
    // Add title
    this.addPostTitle(postContent, post);
    
    // Add metadata
    const postMeta = this.createPostMetadata(post);
    postContent.appendChild(postMeta);
    
    // Add excerpt
    this.addPostExcerpt(postContent, post);
    
    postItem.appendChild(postContent);
    
    // Add click handler
    this.addPostNavigationHandler(postItem, post);
    
    return postItem;
  }
  
  addPostThumbnail(element, post) {
    const placeholderImage = 'assets/img/placeholder.png';
    const imageUrl = this.getPreviewImage(post) || placeholderImage;
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'post-thumbnail post-grid-thumbnail';
    thumbnail.style.backgroundImage = `url(${imageUrl})`;
    
    // Add image error handling
    const testImg = new Image();
    testImg.onerror = () => {
      thumbnail.style.backgroundImage = `url(${placeholderImage})`;
    };
    testImg.src = imageUrl;
    
    element.appendChild(thumbnail);
  }
  
  addPostTitle(container, post) {
    const title = document.createElement('h3');
    title.className = 'post-title';
    title.textContent = post.title || '(Untitled)';
    container.appendChild(title);
  }
  
  addPostExcerpt(container, post) {
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = this.createExcerpt(post.body || '');
    container.appendChild(excerpt);
  }
  
  addPostNavigationHandler(element, post) {
    if (post.author && post.permlink) {
      element.addEventListener('click', () => {
        router.navigate(`/@${post.author}/${post.permlink}`);
      });
    }
  }
  
  createPostMetadata(post) {
    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';
    
    // Date info
    const createdDate = post.created ? new Date(post.created).toLocaleDateString() : 'Unknown date';
    const dateInfo = this.createMetadataItem('schedule', createdDate, 'post-date');
    
    // Votes info
    const totalVotes = this.getVoteCount(post);
    const votesInfo = this.createMetadataItem('thumb_up', totalVotes.toLocaleString(), 'post-votes');
    
    // Comments info
    const commentsCount = post.children !== undefined ? post.children : 0;
    const commentsInfo = this.createMetadataItem('chat_bubble', commentsCount.toString(), 'post-comments');
    
    postMeta.appendChild(dateInfo);
    postMeta.appendChild(votesInfo);
    postMeta.appendChild(commentsInfo);
    
    return postMeta;
  }
  
  createMetadataItem(iconName, text, className) {
    const container = document.createElement('span');
    container.className = className;
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    
    container.appendChild(icon);
    container.appendChild(textSpan);
    
    return container;
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
    
    // Add debug info to help troubleshoot
    if (comment.id) {
      commentItem.dataset.id = comment.id;
    }
    
    // Comment header with link to parent post
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    
    // Add parent post info
    const parentInfo = document.createElement('div');
    parentInfo.className = 'parent-post-info';
    
    const parentIcon = document.createElement('span');
    parentIcon.className = 'material-icons';
    parentIcon.textContent = 'reply';
    
    const parentText = document.createElement('span');
    parentText.textContent = `Comment on @${comment.parent_author}'s post`;
    
    parentInfo.appendChild(parentIcon);
    parentInfo.appendChild(parentText);
    
    const parentLink = document.createElement('a');
    parentLink.className = 'parent-post-link';
    parentLink.href = `/@${comment.parent_author}/${comment.parent_permlink}`;
    parentLink.textContent = 'View parent post';
    
    commentHeader.appendChild(parentInfo);
    commentHeader.appendChild(parentLink);
    
    // Comment metadata
    const commentMeta = document.createElement('div');
    commentMeta.className = 'comment-meta';
    
    // Comment date
    const commentDate = document.createElement('span');
    commentDate.className = 'comment-date';
    const formattedDate = new Date(comment.created).toLocaleString();
    commentDate.textContent = formattedDate;
    
    // Add votes info
    const votesInfo = document.createElement('span');
    votesInfo.className = 'comment-votes';
    const voteCount = comment.net_votes || 0;
    votesInfo.innerHTML = `<span class="material-icons">thumb_up</span> ${voteCount}`;
    
    commentMeta.appendChild(commentDate);
    commentMeta.appendChild(votesInfo);
    
    // Comment body
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.textContent = this.createExcerpt(comment.body, 300); // Longer excerpt
    
    // Assemble the comment
    commentItem.appendChild(commentHeader);
    commentItem.appendChild(commentMeta);
    commentItem.appendChild(commentBody);
    
    // Add click handler for the whole comment to navigate to the parent post
    commentItem.addEventListener('click', (e) => {
      // Prevent navigation if clicking on the specific link
      if (e.target === parentLink || parentLink.contains(e.target)) {
        return;
      }
      router.navigate(parentLink.href);
    });
    
    // Add click handler for the link
    parentLink.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the parent click handler from firing
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
    // Cancel any in-progress loading
    this.cancelCurrentLoading();
    
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

    // Clean up progress interval if it exists
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Clean up any other event listeners or resources
  }
}

export default ProfileView;
