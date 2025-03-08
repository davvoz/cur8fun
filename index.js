import router from './utils/Router.js';
import HomeView from './views/HomeView.js';
import PostView from './views/PostView.js';
import LoginView from './views/LoginView.js';
import ProfileView from './steemgram/views/ProfileView.js';
import CreatePostView from './views/CreatePostView.js';
import NotFoundView from './views/NotFoundView.js';
import eventEmitter from './utils/EventEmitter.js';
import authService from './services/AuthService.js';
import Breadcrumbs from './components/Breadcrumbs.js';

// Notification system
function showNotification(notification) {
  const element = document.createElement('div');
  element.className = `notification ${notification.type}`;
  element.textContent = notification.message;
  document.body.appendChild(element);

  setTimeout(() => {
    element.classList.add('hiding');
    setTimeout(() => document.body.removeChild(element), 500);
  }, 3000);
}

eventEmitter.on('notification', showNotification);

// Initialize breadcrumbs
const breadcrumbs = new Breadcrumbs();

// Update breadcrumbs on route changes
eventEmitter.on('route:changed', ({ path, view, params }) => {
  let title = '';
  
  // Set custom title based on route
  if (params.author && params.permlink) {
    title = `Post by @${params.author}`;
  } else if (params.username) {
    title = `@${params.username}`;
  }
  
  breadcrumbs.updatePath(path, title);
  
  // Insert breadcrumbs at the top of the main content
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'breadcrumb-container';
    breadcrumbs.render(breadcrumbContainer);
    
    // Insert at the beginning of main content
    if (mainContent.firstChild) {
      mainContent.insertBefore(breadcrumbContainer, mainContent.firstChild);
    } else {
      mainContent.appendChild(breadcrumbContainer);
    }
  }
});

// Setup routes with proper handlers
router
  .addRoute('/', HomeView, { tag: 'trending' })
  .addRoute('/login', LoginView)
  .addRoute('/create', CreatePostView, { requiresAuth: true })
  .addRoute('/trending', HomeView, { tag: 'trending' })
  .addRoute('/hot', HomeView, { tag: 'hot' })
  .addRoute('/new', HomeView, { tag: 'created' })
  .addRoute('/promoted', HomeView, { tag: 'promoted' }) 
  .addRoute('/@:username', ProfileView)
  .addRoute('/@:author/:permlink', PostView)
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

  // Update navigation menu
  const updateNav = () => {
    const currentUser = authService.getCurrentUser();
    const navRight = document.querySelector('.nav-right');
    
    if (!navRight) return;
    
    // Clear existing content
    while (navRight.firstChild) {
      navRight.removeChild(navRight.firstChild);
    }
    
    if (currentUser) {
      // Create nav actions container
      const navActions = document.createElement('div');
      navActions.className = 'nav-actions';
      
      // Create Post button
      const createPostBtn = document.createElement('a');
      createPostBtn.href = '/create';
      createPostBtn.className = 'create-post-btn';
      
      const addIcon = document.createElement('span');
      addIcon.className = 'material-icons';
      addIcon.textContent = 'add';
      createPostBtn.appendChild(addIcon);
      
      createPostBtn.appendChild(document.createTextNode('Create'));
      navActions.appendChild(createPostBtn);
      
      // Notifications button
      const notifLink = document.createElement('a');
      notifLink.href = '/notifications';
      notifLink.className = 'nav-icon';
      
      const notifIcon = document.createElement('span');
      notifIcon.className = 'material-icons';
      notifIcon.textContent = 'notifications';
      notifLink.appendChild(notifIcon);
      navActions.appendChild(notifLink);
      
      // User menu
      const userMenu = document.createElement('div');
      userMenu.className = 'user-menu';
      
      const avatar = document.createElement('img');
      avatar.src = `https://steemitimages.com/u/${currentUser.username}/avatar`;
      avatar.alt = currentUser.username;
      avatar.className = 'avatar';
      userMenu.appendChild(avatar);
      
      // Dropdown menu
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown';
      
      const profileLink = document.createElement('a');
      profileLink.href = `/@${currentUser.username}`;
      profileLink.textContent = 'Profile';
      dropdown.appendChild(profileLink);
      
      const logoutBtn = document.createElement('a');
      logoutBtn.href = '#';
      logoutBtn.className = 'logout-btn';
      logoutBtn.textContent = 'Logout';
      dropdown.appendChild(logoutBtn);
      
      userMenu.appendChild(dropdown);
      navActions.appendChild(userMenu);
      
      navRight.appendChild(navActions);
      
      // Add logout handler
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authService.logout();
        eventEmitter.emit('auth:changed', { user: null });
        eventEmitter.emit('notification', {
          type: 'info',
          message: 'You have been logged out'
        });
        router.navigate('/');
      });
    } else {
      const loginBtn = document.createElement('a');
      loginBtn.href = '/login';
      loginBtn.className = 'login-btn';
      loginBtn.textContent = 'Login';
      navRight.appendChild(loginBtn);
    }
    
    // Highlight active menu item
    const currentPath = window.location.pathname;
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === currentPath) {
        item.classList.add('active');
      }
    });
  };

  // Handle auth changes
  eventEmitter.on('auth:changed', updateNav);
  eventEmitter.on('route:changed', updateNav);
  
  // Initial update
  updateNav();

  // Initialize router
  router.init();
}

document.addEventListener('DOMContentLoaded', initApp);

//Per aggiungere una nuova route ,
//aggiungere una nuova riga al metodo addRoute di router.js
//router.addRoute('/example', ExampleView);
//poi creare il file ExampleView.js in views
