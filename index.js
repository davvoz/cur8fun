// Core utilities
import router from './utils/Router.js';
import eventEmitter from './utils/EventEmitter.js';
import NavigationManager from './utils/NavigationManager.js';

// Services
import authService from './services/AuthService.js';
import searchService from './services/SearchService.js'; // Import singleton instead

// Import the SearchBar component
import SearchBar from './components/SearchBar.js';

// Content views
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import TagView from './views/TagView.js';
import SearchView from './views/SearchView.js';
import CreatePostView from './views/CreatePostView.js';

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
  .addRoute('/communities', CommunitiesListView) // Add the new route
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
  link.className = 'nav-icon';
  
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.textContent = 'notifications';
  link.appendChild(icon);
  
  return link;
}

function createUserMenu(user) {
  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  
  // Avatar
  const avatar = document.createElement('img');
  avatar.src = `https://steemitimages.com/u/${user.username}/avatar`;
  avatar.alt = user.username;
  avatar.className = 'avatar';
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
  initApp();
});

//Per aggiungere una nuova route ,
//aggiungere una nuova riga al metodo addRoute di router.js
//router.addRoute('/example', ExampleView);
//poi creare il file ExampleView.js in views
