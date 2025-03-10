import eventEmitter from './EventEmitter.js';

/**
 * Client-side router for handling navigation
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
    this.viewContainer = null;
    this.useHashRouting = true; // Enable hash-based routing by default
    this.basePath = ''; // Base path for GitHub Pages (e.g., '/repository-name')
    
    // Detect if we're on GitHub Pages and set the base path
    this.detectBasePath();
    
    console.log('Router initialized with:', {
      useHashRouting: this.useHashRouting,
      basePath: this.basePath
    });
    
    // Handle browser navigation events
    if (this.useHashRouting) {
      // For hash-based routing, listen to the hashchange event
      window.addEventListener('hashchange', () => {
        const path = this.getPathFromHash();
        console.log('Hash changed, new path:', path);
        this.handleRouteChange(path, {});
      });
    } else {
      // For history API routing
      window.addEventListener('popstate', (event) => {
        // Get current path and pass any state from the popstate event
        this.handleRouteChange(window.location.pathname, event.state || {});
      });
    }
  }

  /**
   * Detect the base path for GitHub Pages repositories
   */
  detectBasePath() {
    // Check if we're on GitHub Pages
    const hostname = window.location.hostname;
    if (hostname.endsWith('github.io')) {
      // Extract the repository name from the pathname, not from the hash
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length >= 2 && pathParts[1]) {
        this.basePath = '/' + pathParts[1];
        console.log('Detected GitHub Pages repository:', this.basePath);
      }
    }
  }

  // Get the current path from hash or pathname
  getCurrentPath() {
    if (this.useHashRouting) {
      return this.getPathFromHash() || '/';
    }
    
    // Remove base path if present
    let path = window.location.pathname;
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.substring(this.basePath.length) || '/';
    }
    return path;
  }

  // Extract path from hash (e.g., "#/trending" -> "/trending")
  getPathFromHash() {
    const hash = window.location.hash;
    if (!hash) return '/';
    
    // Simple hash path extraction - just remove the # character
    return hash.substring(1);
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
   * Navigate to a specific URL
   * @param {string} path - URL path to navigate to
   * @param {Object} [params={}] - State object to pass to history
   * @param {boolean} [replace=false] - Whether to replace current history entry
   */
  navigate(path, params = {}, replaceState = false) {
    // Avoid reloading the same route
    if (path === this.currentPath && !replaceState) {
      return;
    }
    
    console.log('Navigating to:', path);
    
    if (this.useHashRouting) {
      // For hash routing, update the URL hash (no need to include basePath in hash)
      const targetHash = `#${path}`;
      if (replaceState) {
        window.location.replace(targetHash);
      } else {
        window.location.hash = targetHash;
      }
      
      // Track navigation for back button functionality
      if (!replaceState) {
        this.navigationHistory.push({ path, params });
        if (this.navigationHistory.length > this.maxHistoryLength) {
          this.navigationHistory.shift();
        }
      }
      
      // Handle route change manually since hashchange might not fire if only params changed
      this.handleRouteChange(path, params);
    } else {
      // For history API routing with base path support
      const fullPath = this.basePath ? `${this.basePath}${path}` : path;
      
      if (replaceState) {
        window.history.replaceState(params, "", fullPath);
      } else {
        window.history.pushState(params, "", fullPath);
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
  }

  /**
   * Handle route change events
   * @param {string|Event} pathOrEvent - URL path or event object
   * @param {Object} additionalParams - Additional parameters to pass to the view
   */
  async handleRouteChange(pathOrEvent, additionalParams = {}) {
    // Get the path from the appropriate source
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

    // Debug log for route matching
    console.log('Route match:', {
      path,
      matchedRoute: matchedRoute?.path,
      extractedParams: params
    });
    
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

    // Ensure app container exists
    let appContainer = document.getElementById('app');
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app';
      document.body.appendChild(appContainer);
    }
    
    // Ensure and reset main-content element exists
    this.ensureViewContainer(appContainer);
    
    // Clean up previous view if exists
    this.cleanupCurrentView();
    
    // Handle 404 if no route matches
    if (!matchedRoute && this.notFoundHandler) {
      this.currentView = new this.notFoundHandler(this.viewContainer);
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
    
    console.log('View params:', mergedParams);
    
    // Instantiate and render the view with the main-content element
    this.currentView = new matchedRoute.viewClass(mergedParams);
    this.currentView.render(this.viewContainer);
    
    // Emit route changed event
    eventEmitter.emit('route:changed', { 
      path, 
      view: matchedRoute.path,
      params: mergedParams
    });
  }
  
  /**
   * Ensure the view container exists and is properly set up
   * @param {HTMLElement} appContainer - The app container element
   */
  ensureViewContainer(appContainer) {
    // If viewContainer already exists and is in the DOM, just clear its contents
    if (this.viewContainer && document.body.contains(this.viewContainer)) {
      // Clear the container for the new view
      while (this.viewContainer.firstChild) {
        this.viewContainer.removeChild(this.viewContainer.firstChild);
      }
    } else {
      // Create a new main-content element
      let mainContent = document.getElementById('main-content');
      if (mainContent) {
        // If it exists but isn't our reference, clear it
        while (mainContent.firstChild) {
          mainContent.removeChild(mainContent.firstChild);
        }
      } else {
        // Create new main-content if it doesn't exist
        mainContent = document.createElement('div');
        mainContent.id = 'main-content';
        appContainer.appendChild(mainContent);
      }
      this.viewContainer = mainContent;
    }
  }
  
  /**
   * Clean up the current view before showing a new one
   */
  cleanupCurrentView() {
    if (this.currentView) {
      // Call unmount to clean up resources
      if (typeof this.currentView.unmount === 'function') {
        this.currentView.unmount();
      }
      
      this.currentView = null;
    }
  }

  /**
   * Initialize the router and trigger initial route
   */
  init() {
    // Add click handler for all links to use the router
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && 
          !link.getAttribute('target') && 
          !link.getAttribute('data-bypass-router')) {
        
        const href = link.getAttribute('href');
        
        // Only handle internal links
        if (href && (href.startsWith('/') || href.startsWith('#/'))) {
          e.preventDefault();
          
          let path = href;
          // Extract the path from hash links
          if (href.startsWith('#/')) {
            path = href.substring(1);
          }
          
          // Clean up path to remove basePath if it's duplicated
          if (this.basePath && path.startsWith(this.basePath)) {
            path = path.substring(this.basePath.length) || '/';
          }
          
          console.log('Link clicked, navigating to:', path);
          this.navigate(path);
        }
      }
    });
    
    // Handle initial route
    if (this.useHashRouting) {
      const initialPath = this.getPathFromHash() || '/';
      console.log('Initial route:', initialPath);
      this.handleRouteChange(initialPath);
    } else {
      this.handleRouteChange();
    }
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
