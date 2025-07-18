import eventEmitter from './EventEmitter.js';
import EditPostView from '../views/EditPostView.js';
import CommentView from '../views/CommentView.js';
import Cur8StatsView from '../views/Cur8StatsView.js';
import Cur8BotStatsView from '../views/Cur8BotStatsView.js';

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
    this.useHashRouting = false; // Use HTML5 History API routing
    this.basePath = '';
    // Detect if we're on GitHub Pages and set the base path
    this.detectBasePath();
    // Handle browser navigation events
    if (this.useHashRouting) {
      window.addEventListener('hashchange', () => {
        const path = this.getPathFromHash();
        this.handleRouteChange(path, {});
      });
    } else {
      window.addEventListener('popstate', (event) => {
        // Su popstate, sincronizza navigationHistory con la posizione reale del browser
        const browserPath = window.location.pathname;
        const params = event.state || {};
        let shortPath = browserPath;
        if (this.basePath && shortPath.startsWith(this.basePath)) {
          shortPath = shortPath.substring(this.basePath.length) || '/';
        }
        // Se la history è vuota o desincronizzata, ricostruiscila
        const last = this.navigationHistory[this.navigationHistory.length - 1];
        if (!last || last.path !== shortPath) {
          // Cerca se il path esiste già in history
          const idx = this.navigationHistory.findIndex(h => h.path === shortPath);
          if (idx !== -1) {
            // Taglia la history dopo questa posizione (forward navigation)
            this.navigationHistory = this.navigationHistory.slice(0, idx + 1);
          } else {
            // Se non trovato, aggiungi la posizione attuale
            this.navigationHistory.push({ path: shortPath, params });
            if (this.navigationHistory.length > this.maxHistoryLength) {
              this.navigationHistory.shift();
            }
          }
        }
        this.handleRouteChange(shortPath, params);
      });
    }
  }
  /**
   * Detect the base path - for local Flask development, no base path needed
   */
  detectBasePath() {
    // Se la SPA è montata su /app o sottopercorsi, imposta basePath
    const path = window.location.pathname;
    if (path.startsWith('/app/')) {
      this.basePath = '/app';
    } else if (path === '/app') {
      this.basePath = '/app';
    } else {
      this.basePath = '';
    }
  }
  // Get the current path from pathname (no hash support)
  getCurrentPath() {
    let path = window.location.pathname;
    if (this.basePath && path.startsWith(this.basePath)) {
      path = path.substring(this.basePath.length);
    }
    return path || '/';
  }
  getPathFromHash() {
    const hash = window.location.hash;
    if (!hash) return '/';
    return hash.substring(1);
  }
  beforeEach(fn) {
    this.beforeHooks.push(fn);
    return this;
  }
  addRoute(path, viewClass, options = {}) {
    let pattern;
    let paramNames = [];
    if (path instanceof RegExp) {
      pattern = path;
    } else if (typeof path === 'string') {
      paramNames = (path.match(/:\w+/g) || []).map(param => param.substring(1));
      pattern = new RegExp(
        '^' + path
          .replace(/:\w+/g, '([^/]+)')
          .replace(/\*/g, '.*') + 
        '$'
      );
    } else {
      throw new Error('Path must be a string or RegExp');
    }
    this.routes.push({
      path,
      pattern,
      viewClass,
      paramNames,
      options
    });
    return this;
  }
  setNotFound(viewClass) {
    this.notFoundHandler = viewClass;
    return this;
  }
  navigate(path, params = {}, replaceState = false) {
    if (path === this.currentPath && !replaceState) {
      return;
    }
    if (path.startsWith('/search') && params.q) {
      const searchParams = new URLSearchParams();
      searchParams.append('q', params.q);
      path = `/search?${searchParams.toString()}`;
    }
    const fullPath = this.basePath ? `${this.basePath}${path}` : path;
    if (replaceState) {
      window.history.replaceState(params, '', fullPath);
      // Sostituisci l'ultimo elemento della navigationHistory
      if (this.navigationHistory.length > 0) {
        this.navigationHistory[this.navigationHistory.length - 1] = { path, params };
      } else {
        this.navigationHistory.push({ path, params });
      }
    } else {
      window.history.pushState(params, '', fullPath);
      this.navigationHistory.push({ path, params });
      if (this.navigationHistory.length > this.maxHistoryLength) {
        this.navigationHistory.shift();
      }
    }
    this.handleRouteChange(path, params);
  }
  async handleRouteChange(pathOrEvent, additionalParams = {}) {
    const path = typeof pathOrEvent === 'string' ? pathOrEvent : this.getCurrentPath();
    if (path === this.currentPath && this.currentView) {
      return;
    }
    this.currentPath = path;
    let matchedRoute = null;
    let params = {};
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        matchedRoute = route;
        if (route.paramNames && route.paramNames.length > 0) {
          route.paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });
        } else if (route.path instanceof RegExp && match.length > 1) {
          if ((path.startsWith('/edit/@') || path.startsWith('/comment/@')) && match.length >= 3) {
            params.author = match[1];
            params.permlink = match[2];
          } else {
            for (let i = 1; i < match.length; i++) {
              params[i - 1] = match[i];
            }
          }
        }
        break;
      }
    }
    for (const hook of this.beforeHooks) {
      await new Promise(resolve => {
        hook({
          path,
          params: additionalParams,
          options: matchedRoute?.options || {}
        }, resolve);
      });
    }
    let appContainer = document.getElementById('app');
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app';
      document.body.appendChild(appContainer);
    }
    this.ensureViewContainer(appContainer);
    this.cleanupCurrentView();
    if (!matchedRoute && this.notFoundHandler) {
      this.currentView = new this.notFoundHandler(this.viewContainer);
      this.currentView.render(this.viewContainer);
      eventEmitter.emit('route:changed', { path, view: 'notFound' });
      return;
    }
    if (!matchedRoute) {
      console.error('No route found for path:', path);
      return;
    }
    const mergedParams = {
      ...params,
      ...matchedRoute.options,
      ...additionalParams
    };
    this.currentView = new matchedRoute.viewClass(mergedParams);
    this.currentView.render(this.viewContainer);
    eventEmitter.emit('route:changed', {
      path,
      view: matchedRoute.path,
      params: mergedParams
    });
  }
  ensureViewContainer(appContainer) {
    if (this.viewContainer && document.body.contains(this.viewContainer)) {
      while (this.viewContainer.firstChild) {
        this.viewContainer.removeChild(this.viewContainer.firstChild);
      }
    } else {
      let mainContent = document.getElementById('main-content');
      if (mainContent) {
        while (mainContent.firstChild) {
          mainContent.removeChild(mainContent.firstChild);
        }
      } else {
        mainContent = document.createElement('div');
        mainContent.id = 'main-content';
        appContainer.appendChild(mainContent);
      }
      this.viewContainer = mainContent;
    }
  }
  cleanupCurrentView() {
    if (this.currentView) {
      if (typeof this.currentView.unmount === 'function') {
        this.currentView.unmount();
      }
      this.currentView = null;
    }
  }
  init() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link &&
          !link.getAttribute('target') &&
          !link.getAttribute('data-bypass-router')) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          e.preventDefault();
          let path = href;
          if (this.basePath && path.startsWith(this.basePath)) {
            path = path.substring(this.basePath.length) || '/';
          }
          this.navigate(path);
        }
      }
    });
    this.addRoute(/^\/edit\/@([^\/]+)\/(.+)$/, EditPostView);
    this.addRoute(/^\/comment\/@([^\/]+)\/(.+)$/, CommentView);
    this.addRoute('/cur8-stats', Cur8StatsView);
    this.addRoute('/cur8-bot-stats', Cur8BotStatsView);
    if (this.useHashRouting) {
      const initialPath = this.getPathFromHash() || '/';
      this.handleRouteChange(initialPath);
    } else {
      const initialPath = window.location.pathname.replace(this.basePath, '') || '/';
      this.handleRouteChange(initialPath);
    }
    return this;
  }
  goBack() {
    // Usa la history del browser per una gestione più naturale
    window.history.back();
  }
}
const router = new Router();
export default router;
