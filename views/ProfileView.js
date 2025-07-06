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
  posts: {},  // Manteniamo la cache per i post
  comments: {} // Ora usiamo la cache anche per i commenti
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
    
    // Get cached tab if available, but default to 'posts' when coming from non-profile pages
    this.currentTab = (isDirectNavigation || !ProfileTabs.activeTabCache[this.username]) ? 
                      'posts' : ProfileTabs.activeTabCache[this.username];
    
    // Caching state
    this.postsLoaded = !!componentCache.posts[this.username];
    this.commentsLoaded = !!componentCache.comments[this.username];
    this.postsContainer = null;
    this.commentsContainer = null;
    this.walletHistoryComponent = null;
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
    this.tabsManager = new ProfileTabs((tabName) => this.switchTab(tabName));
    
    // Get or create posts component
    if (!componentCache.posts[this.username]) {
      componentCache.posts[this.username] = new PostsList(this.username, true);
    } else {
      // Reset the component if it exists to ensure it's ready for reuse
      componentCache.posts[this.username].reset();
    }
    this.postsComponent = componentCache.posts[this.username];
    
    // Usa la cache anche per i commenti
    if (!componentCache.comments[this.username]) {
      componentCache.comments[this.username] = new CommentsList(this.username, true);
    } else {
      // Resetta minimamente lo stato, ma mantieni i dati se possibile
      componentCache.comments[this.username].prepareForReuse();
    }
    this.commentsComponent = componentCache.comments[this.username];
  }

  async render(container) {
    this.container = container;
    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    container.appendChild(profileContainer);

    // Show loading indicator
    this.loadingIndicator.show(profileContainer);

    try {
      // Load profile data
      await this.loadProfileData();

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
    
    // Create grid controller containers
    const postsGridContainer = document.createElement('div');
    postsGridContainer.className = 'posts-grid-controller-container';
    
    const commentsGridContainer = document.createElement('div');
    commentsGridContainer.className = 'comments-grid-controller-container';
    commentsGridContainer.style.display = 'none';
    
    const walletGridContainer = document.createElement('div');
    walletGridContainer.className = 'wallet-grid-controller-container';
    walletGridContainer.style.display = 'none';
    
    contentContainer.appendChild(postsGridContainer);
    contentContainer.appendChild(commentsGridContainer);
    contentContainer.appendChild(walletGridContainer);
    
    // Create a container for the posts/comments/wallet
    const postsArea = document.createElement('div');
    postsArea.className = 'profile-posts-area';
    contentContainer.appendChild(postsArea);
    
    // Configure the container for grid layouts
    postsArea.style.width = '100%';
    postsArea.style.maxWidth = '100%';
    postsArea.style.overflow = 'hidden';
  }
  
  loadContentForCurrentTab() {
    const postsArea = this.container.querySelector('.profile-posts-area');
    if (!postsArea) return;
    
    this.initializeContainersIfNeeded(postsArea);
    
    // CORREZIONE: Rimuovi le chiamate a setContainer
    // Verifica se il metodo esiste prima di chiamarlo
    if (this.postsComponent && typeof this.postsComponent.setContainer === 'function') {
      this.postsComponent.setContainer(this.postsContainer);
    }
    
    // Non chiamare più setContainer per commentsComponent che non lo supporta
    
    const gridContainers = this.getGridContainers();
    const isPostsTab = this.currentTab === 'posts';
    const activeComponent = isPostsTab ? this.postsComponent : this.commentsComponent;
    const activeContainer = isPostsTab ? this.postsContainer : this.commentsContainer;
    const inactiveContainer = isPostsTab ? this.commentsContainer : this.postsContainer;
    const activeGridContainer = isPostsTab ? gridContainers.posts : gridContainers.comments;
    const inactiveGridContainer = isPostsTab ? gridContainers.comments : gridContainers.posts;
    
    // Update visibility
    this.updateContainerVisibility(activeContainer, [inactiveContainer, gridContainers.wallet], activeGridContainer, [inactiveGridContainer, gridContainers.wallet]);
    
    // Render grid controller if needed
    this.renderGridControllerIfNeeded(activeGridContainer, activeComponent);
    
    // Handle component loading and rendering
    this.loadComponentContent(activeComponent, activeContainer, isPostsTab);
  }
  
  initializeContainersIfNeeded(postsArea) {
    if (this.postsContainer && this.commentsContainer && this.walletContainer) return;
    
    // Create containers
    this.postsContainer = document.createElement('div');
    this.postsContainer.className = 'posts-list-container profile-posts-container'; // <-- Doppia classe per compatibilità
    this.postsContainer.style.width = '100%';
    
    this.commentsContainer = document.createElement('div');
    this.commentsContainer.className = 'comments-list-container profile-comments-container'; // <-- Doppia classe
    this.commentsContainer.style.width = '100%';
    
    // Salva come proprietà dell'oggetto e usa classi coerenti
    this.walletContainer = document.createElement('div');
    this.walletContainer.className = 'wallet-list-container profile-wallet-container'; // <-- Doppia classe
    this.walletContainer.style.width = '100%';
    this.walletContainer.style.display = 'none';
    
    // Add all containers to DOM
    postsArea.appendChild(this.postsContainer);
    postsArea.appendChild(this.commentsContainer);
    postsArea.appendChild(this.walletContainer);
    
    // Initialize posts first (it's the default tab)
    this.postsComponent.render(this.postsContainer);
    this.postsLoaded = true;
    
    // Initially hide comments and wallet containers
    this.commentsContainer.style.display = 'none';
    this.walletContainer.style.display = 'none';
  }
  
  getGridContainers() {
    let postsContainer = this.container.querySelector('.profile-posts-container');
    let commentsContainer = this.container.querySelector('.profile-comments-container');
    let walletContainer = this.container.querySelector('.profile-wallet-container');
    
    const contentContainer = this.container.querySelector('.profile-content-container');
    
    if (!postsContainer && contentContainer) {
      postsContainer = document.createElement('div');
      postsContainer.className = 'profile-posts-container';
      contentContainer.appendChild(postsContainer);
    }
    
    if (!commentsContainer && contentContainer) {
      commentsContainer = document.createElement('div');
      commentsContainer.className = 'profile-comments-container';
      commentsContainer.style.display = 'none';
      contentContainer.appendChild(commentsContainer);
    }
    
    if (!walletContainer && contentContainer) {
      walletContainer = document.createElement('div');
      walletContainer.className = 'profile-wallet-container';
      walletContainer.style.display = 'none';
      contentContainer.appendChild(walletContainer);
    }
    
    return { postsContainer, commentsContainer, walletContainer };
  }
  
  updateContainerVisibility(activeContainer, inactiveContainers, activeGridContainer, inactiveGridContainers) {
    // Mostra il container attivo
    if (activeContainer) {
      activeContainer.style.display = '';
    }
    
    // Nascondi tutti i container inattivi
    inactiveContainers.forEach(container => {
      if (container) {
        container.style.display = 'none';
      }
    });
    
    // Applica lo stesso ai grid container se presenti
    if (activeGridContainer) {
      activeGridContainer.style.display = '';
    }
    
    inactiveGridContainers.forEach(container => {
      if (container) {
        container.style.display = 'none';
      }
    });
  }
  
  renderGridControllerIfNeeded(gridContainer, component) {
    if (gridContainer && !gridContainer.hasChildNodes()) {
      component.gridController.render(gridContainer);
    }
  }
  
  loadComponentContent(component, container, isPostsTab) {
    const isLoaded = isPostsTab ? this.postsLoaded : this.commentsLoaded;
    
    if (!isLoaded) {
      component.render(container);
      if (isPostsTab) {
        this.postsLoaded = true;
      } else {
        this.commentsLoaded = true;
      }
    } else if (isPostsTab) {
      // Solo per i post usiamo il refresh del layout
      setTimeout(() => {
        component.refreshGridLayout();
      }, 50);
    } else {
      // Per i commenti, ricarica sempre
      component.render(container);
    }
  }
  
  async switchTab(tabName) {
    // Se la tab corrente è già attiva, non fare nulla
    if (this.currentTab === tabName) return;
    
    // Ottieni i riferimenti ai container
    const { postsContainer, commentsContainer, walletContainer } = this.getGridContainers();
    
    // Trova i contenitori dei controlli griglia
    const postsGridContainer = this.container.querySelector('.posts-grid-controller-container');
    const commentsGridContainer = this.container.querySelector('.comments-grid-controller-container');
    const walletGridContainer = this.container.querySelector('.wallet-grid-controller-container');
    
    // IMPORTANTE: Prima di cambiare tab, resetta i controller per evitare conflitti
    if (this.currentTab === 'comments' && tabName !== 'comments') {
      // Quando si esce dalla tab commenti, rimuovi il contenuto del container
      // per evitare duplicazioni quando si rientra
      if (commentsContainer) {
        commentsContainer.innerHTML = '';
      }
    }
    
    // Aggiorna visibilità containers in base alla tab selezionata
    switch(tabName) {
      case 'posts':
        this.updateContainerVisibility(
          postsContainer, 
          [commentsContainer, walletContainer],
          postsGridContainer, 
          [commentsGridContainer, walletGridContainer]
        );
        
        // Se necessario, forza aggiornamento dei post
        if (this.postsComponent) {
          setTimeout(() => {
            this.postsComponent.refreshGridLayout();
          }, 50);
        }
        break;
        
      case 'comments':
        this.updateContainerVisibility(
          commentsContainer, 
          [postsContainer, walletContainer],
          null,
          [postsGridContainer, walletGridContainer]
        );
        
        // Nascondi esplicitamente il controller condiviso
        if (commentsGridContainer) commentsGridContainer.style.display = 'none';
        
        // Verifica se i commenti sono già stati caricati prima
        if (!this.commentsLoaded || commentsContainer.innerHTML === '') {
          if (this.commentsComponent && commentsContainer) {
            this.commentsComponent.render(commentsContainer);
            this.commentsLoaded = true;
          }
        } else {
          // Solo aggiorna il layout per adattarlo alla larghezza corrente
          if (this.commentsComponent) {
            setTimeout(() => {
              this.commentsComponent.forceLayoutRefresh();
            }, 50);
          }
        }
        break;
        
      case 'wallet':
        // Implementazione wallet invariata
        this.updateContainerVisibility(
          walletContainer, 
          [postsContainer, commentsContainer],
          null, // walletGridContainer potrebbe non esistere
          [postsGridContainer, commentsGridContainer]
        );
        
        // Inizializza il componente wallet se non esiste
        if (!this.walletHistoryComponent) {
          // Crea il componente direttamente
          try {
            this.walletHistoryComponent = new ProfileWalletHistory(this.username);
            
            // Renderizza nel container
            this.walletHistoryComponent.render(walletContainer);
          } catch(error) {
            walletContainer.innerHTML = `<div class="error-message">Failed to load wallet history</div>`;
          }
        } else {
          // Aggiorna visibilità e username
          this.walletHistoryComponent.setVisibility(true);
          this.walletHistoryComponent.updateUsername(this.username);
        }
        break;
    }
    
    this.currentTab = tabName;
    
    // Salva la tab attiva nella cache per questo profilo
    ProfileTabs.activeTabCache[this.username] = tabName;
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
    
    // Clean up wallet component - usa destroy() invece di unmount()
    if (this.walletHistoryComponent) {
      this.walletHistoryComponent.destroy(); // Metodo corretto dalla classe base
      this.walletHistoryComponent = null;
    }
  }
}

export default ProfileView;
