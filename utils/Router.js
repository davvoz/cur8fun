import eventEmitter from './EventEmitter.js';

/**
 * A route view whose code is downloaded on first use instead of at startup:
 * router.addRoute('/create', lazyView(() => import('../views/CreatePostView.js')))
 */
export function lazyView(load) {
  return { lazyLoad: load };
}

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
    this.pendingScrollRestore = undefined; // undefined=no restore, null=top, string=postId
    this.isBackNavigation = false;    // flag: current navigation is a popstate (back/forward)
    this.viewStateCache = new Map(); // Cache view states (posts/page) for back navigation
    this.scrollPositions = new Map(); // Per-path scroll state: path → { postId }
    // Views of `keepAlive` routes, detached but alive, so going back to them
    // is instant: path → { view, root, scrollTop, title, expires }
    this.keptAlive = new Map();
    this.maxKeptAlive = 8;
    this.currentRoute = null;
    this.currentRoot = null;    // element the current view renders into
    this.currentViewPath = null;
    this.navigationId = 0;      // bumped on every route change, see lazy views
    // Kept-alive views belong to the user who opened them
    eventEmitter.on('auth:changed', () => this.clearKeptAlive());
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
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
        // Compute shortPath first
        const browserPath = window.location.pathname;
        const params = event.state || {};
        let shortPath = browserPath;
        if (this.basePath && shortPath.startsWith(this.basePath)) {
          shortPath = shortPath.substring(this.basePath.length) || '/';
        }
        // Read scroll state from our Map (never from history.state)
        const scrollState = this.scrollPositions.get(shortPath);
        this.pendingScrollRestore = scrollState ? scrollState.scrollTop : 0;
        this.isBackNavigation = true;
        // Su popstate, sincronizza navigationHistory con la posizione reale del browser
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
    this.basePath = '';
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
    const navigation = ++this.navigationId;
    const leavingScrollTop = document.getElementById('main-content')?.scrollTop || 0;
    this.saveLeavingState(leavingScrollTop);
    const previousPath = this.currentPath;
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
    // The current page stays on screen while a lazy view downloads
    if (matchedRoute?.viewClass?.lazyLoad) {
      try {
        await this.loadLazyView(matchedRoute);
      } catch (error) {
        console.error('Failed to load the view for', path, error);
        if (navigation === this.navigationId) {
          this.currentPath = previousPath; // so the link can be tried again
          eventEmitter.emit('notification', {
            type: 'error',
            message: 'Could not load the page. Please check your connection.'
          });
        }
        return;
      }
      if (navigation !== this.navigationId) return; // navigated elsewhere meanwhile
    }
    let appContainer = document.getElementById('app');
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app';
      document.body.appendChild(appContainer);
    }
    this.ensureViewContainer(appContainer);
    this.cleanupCurrentView(leavingScrollTop);

    const kept = this.takeKeptAlive(path);
    if (kept && matchedRoute) {
      this.resumeKeptAlive(kept, matchedRoute, path);
      return;
    }

    // Scroll #main-content to top on every navigation except back (back restore is handled separately)
    if (!this.isBackNavigation) {
      this.viewContainer.scrollTop = 0;
      // Clear any leftover scroll-restore value from a previous back navigation
      this.pendingScrollRestore = undefined;
    }
    const root = this.mountViewRoot();
    this.currentRoute = matchedRoute;
    this.currentViewPath = path;
    if (!matchedRoute && this.notFoundHandler) {
      this.currentView = new this.notFoundHandler(root);
      this.currentView.render(root);
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
    this.currentView.render(root);
    this.isBackNavigation = false; // reset after view has rendered
    eventEmitter.emit('route:changed', {
      path,
      view: matchedRoute.path,
      params: mergedParams
    });
  }
  /**
   * Saves scroll position and list state of the page being left, so back
   * navigation can restore it. Only pages with a post/ping list are tracked.
   */
  saveLeavingState(scrollTop) {
    if (!this.currentPath || !this.currentView) return;
    const cards = document.querySelectorAll('.posts-container .post-card, .pings-list .ping-card');
    if (cards.length === 0) return;
    // Store keyed by path — completely isolated from history.state
    this.scrollPositions.set(this.currentPath, { scrollTop });
    if (typeof this.currentView.saveState === 'function') {
      this.currentView.saveState();
    }
  }
  ensureViewContainer(appContainer) {
    if (this.viewContainer && document.body.contains(this.viewContainer)) return;
    let mainContent = document.getElementById('main-content');
    if (!mainContent) {
      mainContent = document.createElement('div');
      mainContent.id = 'main-content';
      appContainer.appendChild(mainContent);
    }
    this.viewContainer = mainContent;
  }
  /**
   * Each view renders into its own root inside #main-content, so a
   * kept-alive view can be detached and reattached as a whole.
   */
  mountViewRoot(root = null) {
    this.viewContainer.replaceChildren();
    if (!root) {
      root = document.createElement('div');
      // An attribute, not a class: some views overwrite their container's className
      root.dataset.routeView = '';
    }
    this.viewContainer.appendChild(root);
    this.currentRoot = root;
    return root;
  }
  cleanupCurrentView(scrollTop = 0) {
    const view = this.currentView;
    if (!view) return;
    this.currentView = null;

    const keepAlive = this.currentRoute?.options?.keepAlive;
    if (keepAlive && this.currentRoot) {
      this.currentRoot.remove();
      if (typeof view.onDeactivate === 'function') view.onDeactivate();
      const ttl = keepAlive.ttl || 10 * 60 * 1000;
      this.keptAlive.delete(this.currentViewPath);
      this.keptAlive.set(this.currentViewPath, {
        view,
        root: this.currentRoot,
        scrollTop,
        title: document.title,
        expires: Date.now() + ttl
      });
      // Map keeps insertion order: the first entry is the least recently left
      if (this.keptAlive.size > this.maxKeptAlive) {
        const [oldestPath, oldest] = this.keptAlive.entries().next().value;
        this.keptAlive.delete(oldestPath);
        this.destroyView(oldest.view);
      }
      return;
    }
    this.destroyView(view);
  }
  destroyView(view) {
    if (typeof view.unmount === 'function') {
      view.unmount();
    } else if (typeof view.onBeforeUnmount === 'function') {
      // Some views only implement onBeforeUnmount
      view.onBeforeUnmount();
    }
  }
  /**
   * Removes and returns the kept-alive view for `path`, if still fresh.
   * A view can ask to be rebuilt instead by returning false from canResume().
   */
  takeKeptAlive(path) {
    const kept = this.keptAlive.get(path);
    if (!kept) return null;
    this.keptAlive.delete(path);
    if (kept.expires < Date.now() || kept.view.canResume?.() === false) {
      this.destroyView(kept.view);
      return null;
    }
    return kept;
  }
  resumeKeptAlive(kept, route, path) {
    this.mountViewRoot(kept.root);
    this.currentView = kept.view;
    this.currentRoute = route;
    this.currentViewPath = path;
    document.title = kept.title;
    this.viewContainer.scrollTop = kept.scrollTop;
    this.pendingScrollRestore = undefined;
    this.isBackNavigation = false;
    if (typeof kept.view.onActivate === 'function') kept.view.onActivate();
    eventEmitter.emit('route:changed', {
      path,
      view: route.path,
      params: kept.view.params || {}
    });
  }
  async loadLazyView(route) {
    const module = await route.viewClass.lazyLoad();
    // From now on the route renders synchronously, like an eager one
    if (route.viewClass.lazyLoad) route.viewClass = module.default;
  }
  /**
   * Downloads the lazy views one at a time once the browser is idle, so the
   * first visit to them is instant without slowing down the app's startup.
   */
  preloadLazyViews() {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1000));
    const next = () => {
      const route = this.routes.find(r => r.viewClass?.lazyLoad && !r.preloadFailed);
      if (!route) return;
      this.loadLazyView(route)
        .catch(() => { route.preloadFailed = true; }) // loaded again on navigation
        .finally(() => idle(next));
    };
    idle(next);
  }
  clearKeptAlive() {
    this.keptAlive.forEach(kept => this.destroyView(kept.view));
    this.keptAlive.clear();
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
          // Tapping the link of the current page scrolls it back to the top
          if (path === this.currentPath) {
            this.viewContainer?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          this.navigate(path);
        }
      }
    });
    this.addRoute(/^\/edit\/@([^\/]+)\/(.+)$/, lazyView(() => import('../views/EditPostView.js')));
    this.addRoute(/^\/comment\/@([^\/]+)\/(.+)$/, lazyView(() => import('../views/CommentView.js')));
    this.addRoute('/cur8-stats', lazyView(() => import('../views/Cur8StatsView.js')));
    this.addRoute('/cur8-bot-stats', lazyView(() => import('../views/Cur8BotStatsView.js')));
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
