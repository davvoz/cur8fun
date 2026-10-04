// Core utilities
import router, { lazyView } from './utils/Router.js';
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
import backToTopButton from './components/BackToTopButton.js';
import confirmLogout from './components/auth/confirmLogout.js';
import './components/MarkdownFormatterUI.js';
// Constructed at startup on purpose: its ApiClient reads ?platform= from the
// URL the app was opened with, before any navigation
import './services/CreatePostService.js';

// Views most often opened first (home, shared links) load with the app; the
// others are lazyView()s, downloaded on first use or once the app is idle
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import TagView from './views/TagView.js';
import PingsView from './views/PingsView.js';
import PingThreadView from './views/PingThreadView.js';
import ProfileView from './views/ProfileView.js';
import NotFoundView from './views/NotFoundView.js';

const CreatePostView = lazyView(() => import('./views/CreatePostView.js'));
const DraftsView = lazyView(() => import('./views/DraftsView.js'));
const SettingsView = lazyView(() => import('./views/SettingsView.js'));
const MenuView = lazyView(() => import('./views/MenuView.js'));
const FAQView = lazyView(() => import('./views/FAQView.js'));
const NewReleasesView = lazyView(() => import('./views/NewReleasesView.js'));
const CommunityView = lazyView(() => import('./views/CommunityView.js'));
const CommunitiesListView = lazyView(() => import('./views/CommunitiesListView.js'));
const LoginView = lazyView(() => import('./views/LoginView.js'));
const RegisterView = lazyView(() => import('./views/RegisterView.js'));
const EditProfileView = lazyView(() => import('./views/EditProfileView.js'));
const WalletView = lazyView(() => import('./views/WalletView.js'));
const WitnessesView = lazyView(() => import('./views/WitnessesView.js'));
const NotificationsView = lazyView(() => import('./views/NotificationsView.js'));
const SearchView = lazyView(() => import('./views/SearchView.js'));

// Versione corrente dell'applicazione
const APP_VERSION = '1.0.0';

// Main sections stay alive in memory when left, so switching between them
// is instant instead of reloading everything (see Router.cleanupCurrentView)
const KEEP_ALIVE = { keepAlive: true };
// Balances get stale quickly, so the wallet is rebuilt sooner
const KEEP_ALIVE_SHORT = { keepAlive: { ttl: 2 * 60 * 1000 } };
// Same lifetime as ProfileService's cache (see ProfileView.canResume)
const KEEP_ALIVE_PROFILE = { keepAlive: { ttl: 5 * 60 * 1000 } };
// A post being written stays until it is sent or the app is reloaded
const KEEP_ALIVE_UNTIL_RELOAD = { keepAlive: { ttl: Infinity, pinned: true } };

// Setup routes with proper handlers
router
  .addRoute('/home', HomeView, KEEP_ALIVE)
  .addRoute('/login', LoginView)
  .addRoute('/register', RegisterView)
  .addRoute('/create', CreatePostView, { requiresAuth: true, ...KEEP_ALIVE_UNTIL_RELOAD })
  .addRoute('/drafts', DraftsView, { requiresAuth: true })
  .addRoute('/trending', HomeView, { tag: 'trending', forceTag: true, ...KEEP_ALIVE })
  .addRoute('/hot', HomeView, { tag: 'hot', forceTag: true, ...KEEP_ALIVE })
  .addRoute('/new', NewReleasesView, KEEP_ALIVE) // Usando la nuova vista dedicata invece di HomeView
  .addRoute('/promoted', HomeView, { tag: 'promoted', forceTag: true, ...KEEP_ALIVE })
  .addRoute('/settings', SettingsView)
  .addRoute('/wallet', WalletView, { requiresAuth: true, ...KEEP_ALIVE_SHORT })
  .addRoute('/search', SearchView)
  .addRoute('/tag/:tag', TagView)
  .addRoute('/@:username', ProfileView, KEEP_ALIVE_PROFILE)
  .addRoute('/@:author/:permlink', PostView)
  .addRoute('/edit-profile/:username', EditProfileView, { requiresAuth: true })
  .addRoute('/community/:id', CommunityView)
  .addRoute('/communities', CommunitiesListView, KEEP_ALIVE)
  .addRoute('/pings', PingsView, KEEP_ALIVE)
  .addRoute('/pings/tag/:tag', PingsView, KEEP_ALIVE)
  .addRoute('/pings/@:author/:permlink', PingThreadView)
  .addRoute('/witnesses', WitnessesView, KEEP_ALIVE)
  .addRoute('/notifications', NotificationsView, { requiresAuth: true, ...KEEP_ALIVE })
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

  // Decrypt and cache any stored private keys (non-blocking)
  authService.initKeysAsync().catch(err => console.warn('Key init failed:', err));
  // Sync avatar URL from blockchain so post cards always show the current profile image
  authService.syncAvatarFromBlockchain().catch(() => {});

  // Crea istanza del NavigationManager
  const navManager = new NavigationManager();//è assurdo , se non lo mettiamo non si vede il menù mobile

  // Attiva la navigazione standard
  initNavigation();

  // Inizializzazione del router
  router.init();

  // Inizializza l'ascoltatore per eventi di logout richiesto (token scaduto)
  initSessionExpiryHandler();

  // Inizializza il sistema di toast per l'evento 'notification'
  initNotificationToasts();

  // Inizializza il service worker e il sistema di aggiornamenti
  initPwaFeatures();

  // Floating "back to top" button (listens to #main-content scroll)
  backToTopButton.init();

  // Once the first page has loaded, fetch the other pages' code in the background
  if (document.readyState === 'complete') {
    router.preloadLazyViews();
  } else {
    window.addEventListener('load', () => router.preloadLazyViews(), { once: true });
  }

  // Carica subito il conteggio notifiche non lette (senza aspettare l'apertura della campanella)
  if (authService.getCurrentUser()) {
    notificationsService.updateUnreadCount().catch(() => {});
  }

  // Polling: controlla notifiche nuove ogni 2 minuti (solo se l'utente è loggato e la tab è visibile)
  setInterval(() => {
    if (authService.getCurrentUser() && document.visibilityState === 'visible') {
      notificationsService.clearCache();
      notificationsService.updateUnreadCount().catch(() => {});
    }
  }, 2 * 60 * 1000);
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
 * Global toast handler for eventEmitter.emit('notification', { type, message, duration? })
 * Used throughout the app but previously had no listener.
 */
function initNotificationToasts() {
  // Container fijo in fondo a destra
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:16px', 'z-index:99999',
      'display:flex', 'flex-direction:column', 'gap:8px',
      'max-width:calc(100vw - 32px)', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(container);
  }

  const COLORS = {
    success: { bg: '#2e7d32', icon: 'check_circle' },
    error:   { bg: '#c62828', icon: 'error' },
    warning: { bg: '#e65100', icon: 'warning' },
    info:    { bg: '#1565c0', icon: 'info' },
  };

  eventEmitter.on('notification', ({ type = 'info', message = '', duration = 4000 }) => {
    const { bg, icon } = COLORS[type] || COLORS.info;

    const toast = document.createElement('div');
    toast.style.cssText = [
      `background:${bg}`, 'color:#fff',
      'padding:10px 14px', 'border-radius:8px',
      'display:flex', 'align-items:center', 'gap:8px',
      'font-size:0.9rem', 'line-height:1.3',
      'box-shadow:0 4px 12px rgba(0,0,0,0.35)',
      'pointer-events:auto', 'opacity:0',
      'transition:opacity 0.2s ease, transform 0.2s ease',
      'transform:translateY(8px)',
      'max-width:360px', 'word-break:break-word',
    ].join(';');

    toast.innerHTML = `<span class="material-icons" style="font-size:18px;flex-shrink:0">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Auto-remove
    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(4px)';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
    };
    setTimeout(remove, duration);
    toast.addEventListener('click', remove);
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

  // The top bar only depends on the logged-in user, so it is rebuilt on auth
  // changes only (NavigationManager highlights the active item on route changes)
  eventEmitter.on('auth:changed', updateNavigation);
}

function updateNavigation() {
  updateNavigationMenu();
  // The rebuilt top bar has new theme buttons: show the current theme's icon
  updateThemeIcons();
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
  themeIcon.textContent = 'dark_mode'; // Verrà aggiornato dalla funzione updateThemeIcons
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

  // Desktop quick actions
  navActions.appendChild(createTopSearchButton());
  navActions.appendChild(createTopCreatePostButton());
  navActions.appendChild(createTopThemeToggleButton());

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

  // Desktop quick actions
  navActions.appendChild(createTopSearchButton());
  navActions.appendChild(createTopCreatePostButton());
  navActions.appendChild(createTopThemeToggleButton());

  // Login button
  const loginBtn = document.createElement('a');
  loginBtn.href = '/login';
  loginBtn.className = 'login-btn';
  loginBtn.textContent = 'Login';

  // Register button
  const registerBtn = document.createElement('a');
  registerBtn.href = 'https://join.cur8.fun';
  registerBtn.className = 'register-btn';
  registerBtn.textContent = 'Create Account';

  navActions.appendChild(loginBtn);
  navActions.appendChild(registerBtn);
  container.appendChild(navActions);
}

function createTopSearchButton() {
  const searchBtn = document.createElement('a');
  searchBtn.href = '/search';
  searchBtn.className = 'top-search-btn desktop-nav-action';

  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'search';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = 'Search';

  searchBtn.appendChild(icon);
  searchBtn.appendChild(label);
  return searchBtn;
}

function createTopCreatePostButton() {
  const createBtn = document.createElement('a');
  createBtn.href = '/create';
  createBtn.className = 'create-post-btn desktop-nav-action';
  createBtn.textContent = 'Create Post';
  return createBtn;
}

function createTopThemeToggleButton() {
  const themeToggle = document.createElement('button');
  themeToggle.className = 'theme-toggle-btn top-theme-toggle desktop-nav-action';
  themeToggle.setAttribute('aria-label', 'Toggle theme');
  themeToggle.title = 'Toggle light/dark theme';

  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'dark_mode';
  themeToggle.appendChild(icon);

  return themeToggle;
}

let unsubscribeNotificationBadge = null;

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

  // Listen for updates to the unread count; the previous top bar's badge is gone
  unsubscribeNotificationBadge?.();
  unsubscribeNotificationBadge = eventEmitter.on('notifications:unread_count_updated', (count) => {
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
  // Use stored avatar URL if available (updated after profile edits), else CDN proxy
  avatar.src = user.avatar && !user.avatar.includes('steemitimages.com/u/')
    ? user.avatar
    : `https://steemitimages.com/u/${user.username}/avatar`;
  avatar.alt = user.username;
  avatar.className = 'avatar';
  // Aggiungere un gestore di errore per caricare l'avatar predefinito se l'immagine non è disponibile
  avatar.onerror = function () {
    this.onerror = null;
    this.src = `https://steemitimages.com/u/${user.username}/avatar`;
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

async function handleLogout(e) {
  e.preventDefault();
  if (!(await confirmLogout())) return;

  // logout() emits auth:changed and its own toast, and switches to another
  // saved account when there is one
  authService.logout();
  if (!authService.getCurrentUser()) router.navigate('/home');
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme manager
  themeManager.init();

  initApp();
  
  // Initialize cookie consent banner
  initializeCookieConsent();

  initThemeToggle();
});

/**
 * One listener for every theme toggle button (side nav, top bar, mobile),
 * delegated so the buttons the top bar recreates on login/logout need no
 * handler of their own and none can be registered twice
 */
function initThemeToggle() {
  updateThemeIcons();

  document.addEventListener('click', (e) => {
    const button = e.target.closest('.theme-toggle-btn');
    if (button) switchTheme(button);
  });
}

/**
 * Switches light/dark with the new theme spreading as a circle from the
 * toggle button over the page (View Transitions API). Where that API is
 * missing the theme changes at once. Either way every color changes
 * together: the CSS transitions of single elements are paused meanwhile
 * (.theme-switching), or each would fade at its own pace.
 */
function switchTheme(button) {
  const root = document.documentElement;
  let newTheme;
  const apply = () => {
    root.classList.add('theme-switching');
    newTheme = themeManager.toggleTheme();
    updateThemeIcons();
    // New colors computed without transitions, then transitions come back
    void root.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  };
  const announce = () => eventEmitter.emit('notification', {
    type: 'info',
    message: `${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`,
    duration: 2000
  });

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reducedMotion) {
    apply();
    announce();
    return;
  }

  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  // Far enough to cover the farthest corner of the screen
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = document.startViewTransition(apply);
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
  transition.finished.then(announce, announce);
}

/**
 * Shows on every theme toggle button the icon of the theme it switches to
 */
function updateThemeIcons() {
  const icon = themeManager.getCurrentTheme() === 'dark' ? 'light_mode' : 'dark_mode';
  document.querySelectorAll('.theme-toggle-btn .material-icons').forEach(i => {
    i.textContent = icon;
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
