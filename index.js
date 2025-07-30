// Core utilities
import router from './utils/Router.js';
import eventEmitter from './utils/EventEmitter.js';
import NavigationManager from './utils/NavigationManager.js';
import themeManager from './utils/ThemeManager.js';

// Services
import authService from './services/AuthService.js';
import notificationsService from './services/NotificationsService.js';
import communityService from './services/CommunityService.js';
import updateService from './services/UpdateService.js';
import cookieConsentManager from './services/CookieConsentManager.js';

// Components
import UpdateNotificationComponent from './components/pwa/UpdateNotificationComponent.js';
import './components/MarkdownFormatterUI.js';

// Content views
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import TagView from './views/TagView.js';
import SearchView from './views/SearchView.js';
import CreatePostView from './views/CreatePostView.js';
import DraftsView from './views/DraftsView.js';
import SettingsView from './views/SettingsView.js';
import MenuView from './views/MenuView.js';
import FAQView from './views/FAQView.js';
import NewReleasesView from './views/NewReleasesView.js'; // Importo la nuova vista

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

// Versione corrente dell'applicazione
const APP_VERSION = '1.0.0';

// Setup routes with proper handlers
router
  .addRoute('/home', HomeView, { tag: 'trending' })
  .addRoute('/login', LoginView)
  .addRoute('/register', RegisterView)
  .addRoute('/create', CreatePostView, { requiresAuth: true })
  .addRoute('/drafts', DraftsView, { requiresAuth: true })
  .addRoute('/trending', HomeView, { tag: 'trending' })
  .addRoute('/hot', HomeView, { tag: 'hot' })
  .addRoute('/new', NewReleasesView) // Usando la nuova vista dedicata invece di HomeView
  .addRoute('/promoted', HomeView, { tag: 'promoted' })
  .addRoute('/settings', SettingsView)
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
  .addRoute('/faq', FAQView)
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
  const navManager = new NavigationManager();//è assurdo , se non lo mettiamo non si vede il menù mobile

  // Attiva la navigazione standard
  initNavigation();

  // Inizializzazione del router
  router.init();

  // Inizializza l'ascoltatore per eventi di logout richiesto (token scaduto)
  initSessionExpiryHandler();

  // Inizializza il service worker e il sistema di aggiornamenti
  initPwaFeatures();
}

// Funzione per inizializzare le funzionalità PWA
function initPwaFeatures() {
  // Inizializza UpdateService che gestirà la registrazione del service worker
  updateService.init()
    .then(() => {
      // Inizializza il componente di notifica aggiornamenti
      initUpdateNotification();
    })
    .catch(error => {
      console.error('Errore durante l\'inizializzazione delle funzionalità PWA:', error);
    });
}

/**
 * Inizializza il gestore per eventi di sessione scaduta
 * Risponde all'evento auth:logout-required reindirizzando al login
 * e mostrando una notifica appropriata all'utente
 */
function initSessionExpiryHandler() {
  eventEmitter.on('auth:logout-required', (data) => {
    console.log('Session expiry detected, redirecting to login');

    // Esegui il logout per pulire lo stato
    authService.logout();

    // Memorizza l'URL corrente per tornare dopo il login
    const currentPath = window.location.pathname;

    // Mostra notifica all'utente
    eventEmitter.emit('notification', {
      type: 'warning',
      message: data.message || 'La tua sessione è scaduta. Effettua nuovamente il login.',
      duration: 6000 // Mostra la notifica per 6 secondi
    });

    // Reindirizza al login con returnUrl
    setTimeout(() => {
      router.navigate('/login', { returnUrl: currentPath });
    }, 300);
  });
}

// Inizializza il componente di notifica degli aggiornamenti
function initUpdateNotification() {
  // Creiamo un elemento container per il componente
  const updateNotificationContainer = document.createElement('div');
  updateNotificationContainer.id = 'update-notification-container';
  document.body.appendChild(updateNotificationContainer);

  // Inizializza il componente
  new UpdateNotificationComponent(updateNotificationContainer);
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
  mobileFaucetButton.href = 'https://davvoz.github.io/steem-faucet-game/#/faucet'; // rimane hash perché è un link esterno
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
  mobileFaucetButton.href = 'https://davvoz.github.io/steem-faucet-game/#/faucet'; // rimane hash perché è un link esterno
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
  avatar.onerror = function () {
    this.src = './assets/img/default-avatar.png';
  };
  userMenu.appendChild(avatar);

  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';

  // Profile link
  const profileLink = document.createElement('a');
  profileLink.href = `/@${user.username}`;

  // Profile icon
  const profileIcon = document.createElement('span');
  profileIcon.className = 'material-icons dropdown-icon';
  profileIcon.textContent = 'person';
  profileLink.appendChild(profileIcon);

  profileLink.appendChild(document.createTextNode('Profile'));
  dropdown.appendChild(profileLink);

  // Settings link
  const settingsLink = document.createElement('a');
  settingsLink.href = '/settings';

  // Settings icon
  const settingsIcon = document.createElement('span');
  settingsIcon.className = 'material-icons dropdown-icon';
  settingsIcon.textContent = 'settings';
  settingsLink.appendChild(settingsIcon);

  settingsLink.appendChild(document.createTextNode('Settings'));
  dropdown.appendChild(settingsLink);

  // Add Account button
  const addAccountBtn = document.createElement('a');
  addAccountBtn.href = '/login';

  // Add Account icon
  const addAccountIcon = document.createElement('span');
  addAccountIcon.className = 'material-icons dropdown-icon';
  addAccountIcon.textContent = 'person_add';
  addAccountBtn.appendChild(addAccountIcon);

  addAccountBtn.appendChild(document.createTextNode('Add Account'));
  dropdown.appendChild(addAccountBtn);

  // Switch Account button
  const switchAccountBtn = document.createElement('a');
  switchAccountBtn.href = '#';
  switchAccountBtn.className = 'switch-account-btn';

  // Switch Account icon
  const switchAccountIcon = document.createElement('span');
  switchAccountIcon.className = 'material-icons dropdown-icon';
  switchAccountIcon.textContent = 'people';
  switchAccountBtn.appendChild(switchAccountIcon);

  switchAccountBtn.appendChild(document.createTextNode('Switch Account'));
  switchAccountBtn.addEventListener('click', function (e) {
    e.preventDefault();
    authService.showAccountSwitcher();
  });
  dropdown.appendChild(switchAccountBtn);

  // Logout button
  const logoutBtn = document.createElement('a');
  logoutBtn.href = '#';
  logoutBtn.className = 'logout-btn';

  // Logout icon
  const logoutIcon = document.createElement('span');
  logoutIcon.className = 'material-icons dropdown-icon';
  logoutIcon.textContent = 'logout';
  logoutBtn.appendChild(logoutIcon);

  logoutBtn.appendChild(document.createTextNode('Logout'));
  dropdown.appendChild(logoutBtn);

  // Add logout handler
  logoutBtn.addEventListener('click', handleLogout);

  userMenu.appendChild(dropdown);

  // Handler per gestire l'apertura e la chiusura del dropdown
  let clickHandler = function (event) {
    // Previeni il comportamento predefinito solo se cliccato sull'avatar
    if (event.target === avatar) {
      event.preventDefault();
    }

    // Toggle della classe show-dropdown
    dropdown.classList.toggle('show-dropdown');

    // Se il dropdown è ora visibile, aggiungi un listener al document
    if (dropdown.classList.contains('show-dropdown')) {
      // Usiamo setTimeout per assicurarci che questo listener venga aggiunto dopo l'evento corrente
      setTimeout(() => {
        // Handler per chiudere il menu quando si clicca altrove
        document.addEventListener('click', function closeMenu(e) {
          if (!userMenu.contains(e.target)) {
            dropdown.classList.remove('show-dropdown');
            document.removeEventListener('click', closeMenu);
          }
        });
      }, 10);
    }
  };

  // Aggiungi l'event listener all'intero contenitore userMenu invece che solo all'avatar
  userMenu.addEventListener('click', clickHandler);

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
  
  // Initialize cookie consent banner
  initializeCookieConsent();

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

/**
 * Initialize cookie consent system
 * This is now handled automatically by CookieConsentManager
 */
function initializeCookieConsent() {
  // Cookie consent is now handled automatically by the imported CookieConsentManager
  // The manager initializes itself when imported and handles all consent logic
  console.log('🍪 Cookie consent system ready via CookieConsentManager');
}

//Per aggiungere una nuova route ,
//aggiungere una nuova riga al metodo addRoute di router.js
//router.addRoute('/example', ExampleView);
//poi creare il file ExampleView.js in views
