import eventEmitter from './EventEmitter.js';

/**
 * Client-side router for handling navigation using hash-based routing
 */
class Router {
  constructor() {
    this.routes = [];
    this.notFoundHandler = null;
    this.currentView = null;
    this.currentPath = null;
    this.beforeHooks = [];
    this.navigationHistory = [];
    this.maxHistoryLength = 10;
    this.baseUrl = '';  // Base URL for the application
    
    // Use hashchange event instead of popstate for hash-based routing
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
  }

  beforeEach(fn) {
    this.beforeHooks.push(fn);
    return this;
  }

  /**
   * Add a route to the router
   * @param {string} path - URL path to match
   * @param {Function} viewClass - View class to instantiate
   * @param {Object} [options={}] - Additional route options
   */
  addRoute(path, viewClass, options = {}) {
    // Convert path pattern to regular expression
    const pattern = path
      .replace(/:\w+/g, '([^/]+)')
      .replace(/\*/, '.*');
    
    const paramNames = (path.match(/:\w+/g) || [])
      .map(param => param.substring(1));
    
    this.routes.push({
      path,
      pattern: new RegExp(`^${pattern}$`),
      viewClass,
      paramNames,
      options
    });
    
    return this;
  }

  /**
   * Set handler for 404 Not Found
   * @param {Function} viewClass - View class to instantiate
   */
  setNotFound(viewClass) {
    this.notFoundHandler = viewClass;
    return this;
  }

  /**
   * Set the base URL for the application (useful for GitHub Pages)
   * @param {string} baseUrl - The base URL
   */
  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    return this;
  }

  /**
   * Get the current path from the hash
   */
  getCurrentPath() {
    // Get the path from hash (remove the leading #)
    let path = window.location.hash.substring(1);
    
    // If no path in hash, default to '/'
    if (!path) {
      path = '/';
    }
    
    // Ensure path starts with '/'
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    return path;
  }

  /**
   * Navigate to a specific URL
   * @param {string} path - URL path to navigate to
   * @param {Object} [params={}] - State object to pass to history
   * @param {boolean} [replaceState=false] - Whether to replace current history entry
   */
  navigate(path, params = {}, replaceState = false) {
    // Ensure path starts with '/'
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Avoid reloading the same route
    if (path === this.currentPath && !replaceState) {
      return;
    }
    
    // Update URL hash
    if (replaceState) {
      window.location.replace(`${this.baseUrl}#${path}`);
    } else {
      window.location.hash = path;
    }
    
    // Track navigation for back button functionality
    if (!replaceState) {
      this.navigationHistory.push({ path, params });
      if (this.navigationHistory.length > this.maxHistoryLength) {
        this.navigationHistory.shift();
      }
    }
    
    // Handle route change
    this.handleRouteChange(path, params);
  }

  /**
   * Handle route change events
   * @param {string|Event} pathOrEvent - URL path or event object
   * @param {Object} additionalParams - Additional parameters to pass to the view
   */
  async handleRouteChange(pathOrEvent, additionalParams = {}) {
    // Get path from hash
    const path = typeof pathOrEvent === 'string' ? pathOrEvent : this.getCurrentPath();
    
    // Don't reload the current page if it's the same path
    if (path === this.currentPath && this.currentView) {
      return;
    }
    
    this.currentPath = path;
    let matchedRoute = null;
    let params = {};
    
    // Find matching route
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        matchedRoute = route;
        // Extract parameters from URL
        if (route.paramNames.length > 0) {
          route.paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });
        }
        break;
      }
    }
    
    // Run middleware
    for (const hook of this.beforeHooks) {
      await new Promise(resolve => {
        hook({ 
          path, 
          params: additionalParams,
          options: matchedRoute?.options || {}
        }, resolve);
      });
    }

    // Clean up previous view if exists
    if (this.currentView && typeof this.currentView.unmount === 'function') {
      this.currentView.unmount();
    }
    
    // Ensure app container exists
    let appContainer = document.getElementById('app');
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app';
      document.body.appendChild(appContainer);
    }
    
    // Ensure main-content element exists
    let mainContent = document.getElementById('main-content');
    if (!mainContent) {
      mainContent = document.createElement('div');
      mainContent.id = 'main-content';
      appContainer.appendChild(mainContent);
    }
    
    // Handle 404 if no route matches
    if (!matchedRoute && this.notFoundHandler) {
      this.currentView = new this.notFoundHandler(mainContent);
      this.currentView.render();
      eventEmitter.emit('route:changed', { path, view: 'notFound' });
      return;
    }
    
    if (!matchedRoute) {
      console.error('No route found for path:', path);
      return;
    }
    
    // Merge all parameters: URL params, route options, and additional params
    const mergedParams = {
      ...params,
      ...matchedRoute.options, 
      ...additionalParams
    };
    
    // Instantiate and render the view with the main-content element
    this.currentView = new matchedRoute.viewClass(mergedParams);
    this.currentView.render(mainContent);
    
    // Emit route changed event
    eventEmitter.emit('route:changed', { 
      path, 
      view: matchedRoute.path,
      params: mergedParams
    });
  }

  /**
   * Initialize the router and trigger initial route
   */
  init() {
    // Add click handler for all links to use the router
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && 
          link.getAttribute('href').startsWith('/') && 
          !link.getAttribute('target') && 
          !link.getAttribute('data-bypass-router')) {
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });
    
    // Handle initial route
    this.handleRouteChange();
    return this;
  }
  
  // Go back in navigation history
  goBack() {
    if (this.navigationHistory.length > 1) {
      this.navigationHistory.pop(); // Remove current page
      const previous = this.navigationHistory.pop(); // Get previous page
      this.navigate(previous.path, previous.params, true);
    } else {
      this.navigate('/'); // Fallback to home
    }
  }
}

// Create a singleton instance for the application
const router = new Router();
export default router;