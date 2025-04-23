// Core utilities
import router from './utils/Router.js';
import eventEmitter from './utils/EventEmitter.js';
import NavigationManager from './utils/NavigationManager.js';
import themeManager from './utils/ThemeManager.js';

// Services
import authService from './services/AuthService.js';
import notificationsService from './services/NotificationsService.js';
import communityService from './services/CommunityService.js';

// Content views
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import TagView from './views/TagView.js';
import SearchView from './views/SearchView.js';
import CreatePostView from './views/CreatePostView.js';
import MenuView from './views/MenuView.js';

// Community views
import CommunityView from './views/CommunityView.js';
import CommunitiesListView from './views/CommunitiesListView.js';

// User account views
import LoginView from './views/LoginView.js';
import ProfileView from './views/ProfileView.js';
import RegisterView from './views/RegisterView.js';
import EditProfileView from './views/EditProfileView.js';
import WalletView from './views/WalletView.js';

// Utility views
import NotFoundView from './views/NotFoundView.js';
import NotificationsView from './views/NotificationsView.js';

// Setup routes with proper handlers
router
  .addRoute('/', HomeView, { tag: 'trending' })
  .addRoute('/login', LoginView)
  .addRoute('/register', RegisterView)
  .addRoute('/create', CreatePostView, { requiresAuth: true })
  .addRoute('/trending', HomeView, { tag: 'trending' })
  .addRoute('/hot', HomeView, { tag: 'hot' })
  .addRoute('/new', HomeView, { tag: 'created' })
  .addRoute('/promoted', HomeView, { tag: 'promoted' })
  .addRoute('/wallet', WalletView, { requiresAuth: true })
  .addRoute('/search', SearchView)
  .addRoute('/tag/:tag', TagView)
  .addRoute('/@:username', ProfileView)
  .addRoute('/@:author/:permlink', PostView)
  .addRoute('/edit-profile/:username', EditProfileView, { requiresAuth: true })
  .addRoute('/community/:id', CommunityView)
  .addRoute('/communities', CommunitiesListView) 
  .addRoute('/notifications', NotificationsView, { requiresAuth: true })
  .addRoute('/menu', MenuView)
  .setNotFound(NotFoundView);

// Auth guard middleware
router.beforeEach((to, next) => {
  if (to.options?.requiresAuth && !authService.getCurrentUser()) {
    router.navigate('/login', { returnUrl: to.path });
    return;
  }
  next();
});

// Initialize app structure
function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // Crea istanza del NavigationManager
  const navManager = new NavigationManager();
  
  // Attiva la navigazione standard
  initNavigation();
  
  // Inizializzazione del router
  router.init();
}

function initNavigation() {
  // Initial update
  updateNavigation();
  
  // Subscribe to events that require nav updates
  eventEmitter.on('auth:changed', updateNavigation);
  eventEmitter.on('route:changed', updateNavigation);
}

function updateNavigation() {
  updateNavigationMenu();
  // Aggiorniamo i pulsanti del tema ogni volta che aggiorniamo la navigazione
  setupThemeButtons();
  // Remove the call to highlightActiveMenuItem as it's now handled by NavigationManager
  // highlightActiveMenuItem();
}

function updateNavigationMenu() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;
  
  // Clear existing content
  navRight.innerHTML = '';
  
  const currentUser = authService.getCurrentUser();
  
  if (currentUser) {
    renderAuthenticatedNav(navRight, currentUser);
  } else {
    renderUnauthenticatedNav(navRight);
  }
}

function renderAuthenticatedNav(container, user) {
  const navActions = document.createElement('div');
  navActions.className = 'nav-actions';
  
  // Mobile Theme Toggle button - aggiunto all'inizio
  const mobileThemeToggle = document.createElement('button');
  mobileThemeToggle.className = 'theme-toggle-btn mobile-theme-toggle';
  mobileThemeToggle.setAttribute('aria-label', 'Toggle theme');
  mobileThemeToggle.title = 'Toggle light/dark theme';
  
  const themeIcon = document.createElement('span');
  themeIcon.className = 'material-icons';
  themeIcon.textContent = 'dark_mode'; // Verrà aggiornato dalla funzione updateThemeIcon
  mobileThemeToggle.appendChild(themeIcon);
  
  navActions.appendChild(mobileThemeToggle);
  
  // Mobile faucet button - add next to search button
  const mobileFaucetButton = document.createElement('a');
  mobileFaucetButton.href = 'https://davvoz.github.io/steem-faucet-game/#/faucet';
  mobileFaucetButton.className = 'mobile-faucet-button';
  mobileFaucetButton.target = '_blank';
  mobileFaucetButton.rel = 'noopener noreferrer';
  const faucetIcon = document.createElement('span');
  faucetIcon.className = 'icon';
  // Use FontAwesome icon to match desktop navigation
  const faIcon = document.createElement('i');
  faIcon.className = 'fas fa-faucet';
  faucetIcon.appendChild(faIcon);
  mobileFaucetButton.appendChild(faucetIcon);
  navActions.appendChild(mobileFaucetButton);
  
  // Mobile search button - add before other elements
  const mobileSearchButton = document.createElement('a');
  mobileSearchButton.href = '/search';
  mobileSearchButton.className = 'mobile-search-button';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'material-icons';
  searchIcon.textContent = 'search';
  mobileSearchButton.appendChild(searchIcon);
  navActions.appendChild(mobileSearchButton);
  
  // Notifications button
  navActions.appendChild(createNotificationsButton());
  
  // User menu
  navActions.appendChild(createUserMenu(user));
  
  container.appendChild(navActions);
}

function renderUnauthenticatedNav(container) {
  // Contenitore per i pulsanti
  const navActions = document.createElement('div');
  navActions.className = 'nav-actions';
  
  // Mobile Theme Toggle button - aggiunto all'inizio
  const mobileThemeToggle = document.createElement('button');
  mobileThemeToggle.className = 'theme-toggle-btn mobile-theme-toggle';
  mobileThemeToggle.setAttribute('aria-label', 'Toggle theme');
  mobileThemeToggle.title = 'Toggle light/dark theme';
  
  const themeIcon = document.createElement('span');
  themeIcon.className = 'material-icons';
  themeIcon.textContent = 'dark_mode'; // Verrà aggiornato dalla funzione updateThemeIcon
  mobileThemeToggle.appendChild(themeIcon);
  
  navActions.appendChild(mobileThemeToggle);
  
  // Mobile search button - add before other elements
  const mobileSearchButton = document.createElement('a');
  mobileSearchButton.href = '/search';
  mobileSearchButton.className = 'mobile-search-button';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'material-icons';
  searchIcon.textContent = 'search';
  mobileSearchButton.appendChild(searchIcon);
  navActions.appendChild(mobileSearchButton);
  
  // Mobile faucet button - add next to search button
  const mobileFaucetButton = document.createElement('a');
  mobileFaucetButton.href = 'https://davvoz.github.io/steem-faucet-game/#/faucet';
  mobileFaucetButton.className = 'mobile-faucet-button';
  mobileFaucetButton.target = '_blank';
  mobileFaucetButton.rel = 'noopener noreferrer';
  const faucetIcon = document.createElement('span');
  faucetIcon.className = 'icon';
  // Use FontAwesome icon to match desktop navigation
  const faIcon = document.createElement('i');
  faIcon.className = 'fas fa-faucet';
  faucetIcon.appendChild(faIcon);
  mobileFaucetButton.appendChild(faucetIcon);
  navActions.appendChild(mobileFaucetButton);
  
  // Login button
  const loginBtn = document.createElement('a');
  loginBtn.href = '/login';
  loginBtn.className = 'login-btn';
  loginBtn.textContent = 'Login';
  
  // Register button
  const registerBtn = document.createElement('a');
  registerBtn.href = '/register';
  registerBtn.className = 'register-btn';
  registerBtn.textContent = 'Create Account';
  
  navActions.appendChild(loginBtn);
  navActions.appendChild(registerBtn);
  container.appendChild(navActions);
}

function createCreatePostButton() {
  const btn = document.createElement('a');
  btn.href = '/create';
  btn.className = 'create-post-btn';
  
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'add';
  btn.appendChild(icon);
  btn.appendChild(document.createTextNode('Create'));
  
  return btn;
}

function createNotificationsButton() {
  const link = document.createElement('a');
  link.href = '/notifications';
  link.className = 'nav-icon notification-icon';
  
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'notifications';
  link.appendChild(icon);
  
  // Add badge for unread count
  const badge = document.createElement('span');
  badge.className = 'notification-badge';
  badge.id = 'notification-unread-badge';
  link.appendChild(badge);
  
  // Check current unread count and update badge
  const unreadCount = notificationsService.getUnreadCount();
  updateNotificationBadge(badge, unreadCount);
  
  // Listen for updates to the unread count
  eventEmitter.on('notifications:unread_count_updated', (count) => {
    updateNotificationBadge(badge, count);
  });
  
  return link;
}

/**
 * Updates the notification badge count and visibility
 */
function updateNotificationBadge(badge, count) {
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.add('visible');
    
    // Add animation class to draw attention
    badge.classList.add('pulse');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      badge.classList.remove('pulse');
    }, 1000);
  } else {
    badge.textContent = '';
    badge.classList.remove('visible');
  }
}

function createUserMenu(user) {
  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  
  // Avatar
  const avatar = document.createElement('img');
  avatar.src = `https://steemitimages.com/u/${user.username}/avatar`;
  avatar.alt = user.username;
  avatar.className = 'avatar';
  // Aggiungere un gestore di errore per caricare l'avatar predefinito se l'immagine non è disponibile
  avatar.onerror = function() {
    this.src = './assets/img/default-avatar.png';
  };
  userMenu.appendChild(avatar);
  
  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';
  
  // Profile link
  const profileLink = document.createElement('a');
  profileLink.href = `/@${user.username}`;
  profileLink.textContent = 'Profile';
  dropdown.appendChild(profileLink);
  
  // Logout button
  const logoutBtn = document.createElement('a');
  logoutBtn.href = '#';
  logoutBtn.className = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  dropdown.appendChild(logoutBtn);
  
  // Add logout handler
  logoutBtn.addEventListener('click', handleLogout);
  
  userMenu.appendChild(dropdown);
  return userMenu;
}

function handleLogout(e) {
  e.preventDefault();
  authService.logout();
  eventEmitter.emit('auth:changed', { user: null });
  eventEmitter.emit('notification', {
    type: 'info',
    message: 'You have been logged out'
  });
  router.navigate('/');
}

document.addEventListener('DOMContentLoaded', () => {
  // Precarichiamo le community in background per velocizzare l'esperienza utente
  communityService.listCommunities().then(communities => {
    // Communities loaded successfully
  }).catch(error => {
    console.warn('Failed to preload communities:', error);
  });
  
  // Initialize theme manager
  themeManager.init();
  
  initApp();
  
  // Add theme toggle button to navigation after app is initialized
  addThemeToggleButton();
});

/**
 * Creates and adds a theme toggle button to the navigation
 */
function addThemeToggleButton() {
  // Gestisce entrambi i pulsanti del tema (mobile e desktop)
  const themeToggleButtons = document.querySelectorAll('.theme-toggle-btn');
  if (!themeToggleButtons.length) return;
  
  // Aggiorna le icone in tutti i pulsanti
  themeToggleButtons.forEach(themeToggle => {
    const icon = themeToggle.querySelector('.material-icons');
    if (!icon) return;
    
    // Update the icon based on the current theme
    updateThemeIcon(icon);
    
    // Add click handler to each button
    themeToggle.addEventListener('click', () => {
      const newTheme = themeManager.toggleTheme();
      
      // Aggiorna le icone in tutti i pulsanti
      document.querySelectorAll('.theme-toggle-btn .material-icons').forEach(i => {
        updateThemeIcon(i);
      });
      
      // Provide feedback with notification
      eventEmitter.emit('notification', {
        type: 'info',
        message: `${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`,
        duration: 2000
      });
    });
  });
}

/**
 * Updates the theme toggle icon based on current theme
 */
function updateThemeIcon(iconElement) {
  const currentTheme = themeManager.getCurrentTheme();
  iconElement.textContent = currentTheme === 'dark' ? 'light_mode' : 'dark_mode';
}

/**
 * Configures all theme toggle buttons in the document
 * to make sure they reflect the current theme and have event listeners
 */
function setupThemeButtons() {
  const themeToggleButtons = document.querySelectorAll('.theme-toggle-btn');
  if (!themeToggleButtons.length) return;
  
  themeToggleButtons.forEach(themeToggle => {
    // Prima rimuovi eventuali click handler esistenti per evitare duplicazioni
    const clone = themeToggle.cloneNode(true);
    themeToggle.parentNode.replaceChild(clone, themeToggle);
    
    const icon = clone.querySelector('.material-icons');
    if (!icon) return;
    
    // Update the icon based on the current theme
    updateThemeIcon(icon);
    
    // Add click handler
    clone.addEventListener('click', () => {
      const newTheme = themeManager.toggleTheme();
      
      // Aggiorna le icone in tutti i pulsanti
      document.querySelectorAll('.theme-toggle-btn .material-icons').forEach(i => {
        updateThemeIcon(i);
      });
      
      // Provide feedback with notification
      eventEmitter.emit('notification', {
        type: 'info',
        message: `${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`,
        duration: 2000
      });
    });
  });
}

//Per aggiungere una nuova route ,
//aggiungere una nuova riga al metodo addRoute di router.js
//router.addRoute('/example', ExampleView);
//poi creare il file ExampleView.js in views
