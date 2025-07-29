import eventEmitter from './EventEmitter.js';
import { mainNavItems, specialItems } from '../config/navigation.js';

class NavigationManager {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.menuOpen = false;
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.initElements();
    this.initEventListeners();
    this.renderNavigation();
    
    // Setup sidebar toggle button click handler
    const toggleRetractSidebarBtn = document.getElementById('toggle-btn-retract');
    if (toggleRetractSidebarBtn) {
      toggleRetractSidebarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }
    
    // Applica lo stato della sidebar salvato al caricamento
    if (this.sidebarCollapsed) {
      this.collapseSidebar();
    } else {
      this.expandSidebar();
    }
  }
  
  initElements() {
    // Cache DOM elements
    this.app = document.getElementById('app');
    this.sideNav = document.querySelector('.side-nav');
    this.bottomNav = document.getElementById('bottom-navigation');
    this.navCenter = document.querySelector('.nav-center');
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
  }
  
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay hidden';
    overlay.addEventListener('click', () => this.toggleMobileMenu(false));
    return overlay;
  }
  
  initEventListeners() {
    // Handle window resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 768;
        
        if (wasMobile !== this.isMobile) {
          // Close mobile menu when switching to desktop
          if (!this.isMobile && this.menuOpen) {
            this.toggleMobileMenu(false);
          }
          this.switchNavigationMode();
        }
      }, 250);
    });
    
    // Handle route changes
    eventEmitter.on('route:changed', () => {
      this.highlightActiveMenuItem();
      // Close mobile menu on navigation
      if (this.isMobile && this.menuOpen) {
        this.toggleMobileMenu(false);
      }
    });
    
    // Initial setup
    this.switchNavigationMode();
  }
  
  renderNavigation() {
    // Render bottom navigation items based on config
    if (this.bottomNav) {
      this.bottomNav.innerHTML = '';

      // Create elements for left side items, center item, and right side items
      const leftContainer = document.createElement('div');
      leftContainer.className = 'bottom-nav-left';
      
      const centerContainer = document.createElement('div');
      centerContainer.className = 'bottom-nav-center';
      
      const rightContainer = document.createElement('div');
      rightContainer.className = 'bottom-nav-right';

      // Find special create button for center
      const createItem = specialItems.find(item => item.showInBottom && item.centerPosition);
      
      // Add center item (create button)
      if (createItem) {
        const createBtn = this.createNavItem(createItem, 'bottom');
        centerContainer.appendChild(createBtn);
      }

      // Get regular navigation items
      const regularItems = mainNavItems
        .filter(item => item.showInBottom && (!item.mobileOnly || this.isMobile));
      
      // For mobile with 5 buttons: 2 on left, center button, 2 on right
      if (this.isMobile && regularItems.length === 4) {
        // Extract first 2 items for left container (home, search)
        const leftItems = regularItems.slice(0, 2);
        
        // Extract last 2 items for right container (wallet, menu)
        const rightItems = regularItems.slice(2, 4);
        
        // Add left items
        leftItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          leftContainer.appendChild(navItem);
        });
        
        // Add right items
        rightItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          
          // Add click handler for menu button
          if (item.id === 'menu') {
            navItem.addEventListener('click', (e) => {
              e.preventDefault();
              this.toggleMobileMenu();
            });
          }
          
          rightContainer.appendChild(navItem);
        });
      } else {
        // Original distribution logic for non-5-button layouts
        const halfIndex = Math.ceil(regularItems.length / 2);
        const leftItems = regularItems.slice(0, halfIndex);
        const rightItems = regularItems.slice(halfIndex);
        
        // Add left items
        leftItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          leftContainer.appendChild(navItem);
        });
        
        // Add right items
        rightItems.forEach(item => {
          const navItem = this.createNavItem(item, 'bottom');
          
          // Add click handler for menu button
          if (item.id === 'menu') {
            navItem.addEventListener('click', (e) => {
              e.preventDefault();
              this.toggleMobileMenu();
            });
          }
          
          rightContainer.appendChild(navItem);
        });
      }
      
      // Append containers to bottom navigation
      this.bottomNav.appendChild(leftContainer);
      this.bottomNav.appendChild(centerContainer);
      this.bottomNav.appendChild(rightContainer);
    }
  }
  
  createNavItem(item, type) {
    const navItem = document.createElement('a');
    navItem.href =  item.path == '/' ? '/home' : item.path;
    navItem.className = type === 'bottom' ? 'bottom-nav-item' : 'menu-item';
    navItem.dataset.id = item.id; // Add data attribute for identification
    
    if (item.isAction) {
      navItem.classList.add('create-button');
    }
    
    if (item.centerPosition) {
      navItem.classList.add('center-button');
    }
    
    // Add basic icon and label
    navItem.innerHTML = `
      <span class="material-icons">${item.icon}</span>
      <span class="${type === 'bottom' ? 'bottom-nav-label' : 'label'}">${item.label}</span>
    `;
    
    // Add notification badge for notifications item
    if (item.id === 'notifications') {
      navItem.classList.add('notification-icon');
      
      // Create badge for unread count
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.id = type === 'bottom' ? 'mobile-notification-badge' : 'notification-unread-badge';
      navItem.appendChild(badge);
      
      // Import at runtime to avoid circular dependencies
      import('../services/NotificationsService.js').then(module => {
        const notificationsService = module.default;
        
        // Initial badge update
        const unreadCount = notificationsService.getUnreadCount();
        this.updateNotificationBadge(badge, unreadCount);
        
        // Listen for updates to the unread count
        eventEmitter.on('notifications:unread_count_updated', (count) => {
          this.updateNotificationBadge(badge, count);
        });
      });
    }
    
    return navItem;
  }
  
  /**
   * Updates the notification badge count and visibility
   */
  updateNotificationBadge(badge, count) {
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
  
  toggleMobileMenu(force) {
    // Toggle menu or set to specific state if force parameter provided
    this.menuOpen = force !== undefined ? force : !this.menuOpen;
    
    if (this.menuOpen) {
      this.sideNav.classList.add('visible');
      this.overlay.classList.remove('hidden');
      document.body.classList.add('menu-open');
    } else {
      this.sideNav.classList.remove('visible');
      this.overlay.classList.add('hidden');
      document.body.classList.remove('menu-open');
    }
  }
  
  switchNavigationMode() {
    // Add/remove CSS classes instead of directly manipulating style properties
    document.body.classList.toggle('mobile-view', this.isMobile);
    
    if (this.isMobile) {
      this.enableMobileMode();
    } else {
      this.enableDesktopMode();
    }
    
    this.highlightActiveMenuItem();
  }
  
  enableMobileMode() {
    if (this.sideNav) {
      this.sideNav.classList.add('mobile');
      this.sideNav.classList.add('hidden');
    }
    if (this.bottomNav) this.bottomNav.classList.remove('hidden');
    if (this.app) this.app.classList.add('mobile-layout');
    if (this.navCenter) this.navCenter.classList.add('hidden');
  }
  
  enableDesktopMode() {
    if (this.sideNav) {
      this.sideNav.classList.remove('mobile');
      this.sideNav.classList.remove('hidden');
      this.sideNav.classList.remove('visible');
      
      // Ripristina lo stato della sidebar se necessario
      if (this.sidebarCollapsed) {
        this.collapseSidebar();
      } else {
        this.expandSidebar();
      }
    }
    if (this.bottomNav) this.bottomNav.classList.add('hidden');
    if (this.app) this.app.classList.remove('mobile-layout');
    if (this.navCenter) this.navCenter.classList.remove('hidden');
  }
  
  highlightActiveMenuItem() {
    // Handle both regular and hash-based routing
    let currentPath = window.location.pathname || '/';
    // Strip trailing slash if present (eccetto root)
    if (currentPath !== '/' && currentPath.endsWith('/')) {
      currentPath = currentPath.slice(0, -1);
    }
    
    // Update side nav active state
    const sideMenuItems = document.querySelectorAll('.side-nav .menu-item');
    sideMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      let compareHref = href;
      
      // If href starts with a hash, extract the path part for comparison
      if (compareHref && compareHref.startsWith('#')) {
        compareHref = compareHref.substring(1);
      }
      
      // Make all menu items non-active first
      item.classList.remove('active');
      
      // Special case for home button (href="/")
      if (compareHref === '/') {
        // Home button should only be active when path is exactly "/" or empty
        const isActive = currentPath === '/' || currentPath === '';
        if (isActive) {
          item.classList.add('active');
        }
      } else {
        // For other items, check if the current path matches or starts with href
        const isActive = currentPath === compareHref || 
                        (compareHref !== '/' && currentPath.startsWith(compareHref));
        if (isActive) {
          item.classList.add('active');
        }
      }
    });
    
    // Update bottom nav active state - similar logic as above
    const bottomMenuItems = document.querySelectorAll('.bottom-nav-item');
    bottomMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      let compareHref = href;
      
      // If compareHref starts with a hash, extract the path part for comparison
      if (compareHref && compareHref.startsWith('#')) {
        compareHref = compareHref.substring(1);
      }
      
      const isAction = item.classList.contains('center-button') || item.dataset.id === 'menu'; // Don't highlight create button or menu
      
      // Make all items non-active first
      item.classList.remove('active');
      
      if (!isAction) {
        // Special case for home button
        if (compareHref === '/') {
          // Home button should only be active when path is exactly "/" or empty
          const isActive = currentPath === '/' || currentPath === '';
          if (isActive) {
            item.classList.add('active');
          }
        } else {
          // For other items
          const isActive = currentPath === compareHref || 
                          (compareHref !== '/' && currentPath.startsWith(compareHref));
          if (isActive) {
            item.classList.add('active');
          }
        }
      }
    });
  }
  
  /**
   * Configura il pulsante e la funzionalità per la sidebar retrattile
   */
  setupSidebarToggle() {
    if (!this.sideNav || this.isMobile) return;
    
    // Crea il pulsante toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-sidebar-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
    toggleBtn.setAttribute('title', 'Toggle sidebar');
    
  
    // --- AGGIUNGI I MENU NELLA SIDEBAR SE ESISTE ---
    if (this.sideNav) {
      const menuItems = this.sideNav.querySelector('.menu-items');
      if (menuItems && !menuItems.querySelector('[href="/cur8-stats"]')) {
        // CUR8 Statistics
        const statsItem = document.createElement('a');
        statsItem.href = '/cur8-stats';
        statsItem.className = 'menu-item';
        statsItem.innerHTML = `
          <span class="material-icons icon">analytics</span>
          <span class="label">CUR8 Statistics</span>
        `;
        menuItems.appendChild(statsItem);
      }
      if (menuItems && !menuItems.querySelector('[href="/cur8-bot-stats"]')) {
        // CUR8 Bot Statistics
        const botStatsItem = document.createElement('a');
        botStatsItem.href = '/cur8-bot-stats';
        botStatsItem.className = 'menu-item';
        botStatsItem.innerHTML = `
          <span class="material-icons icon">smart_toy</span>
          <span class="label">Bot Statistics</span>
        `;
        menuItems.appendChild(botStatsItem);
      }
    }
    // Imposta l'icona iniziale basata sullo stato della sidebar
    let iconDirection = this.sidebarCollapsed ? 'chevron_left' : 'chevron_right';
    toggleBtn.innerHTML = `<span class="material-icons">${iconDirection}</span>`;
    
    // Aggiungi il pulsante alla sidebar
    this.sideNav.appendChild(toggleBtn);
    
    // Aggiungi attributi data-tooltip ai menu items per i tooltip quando la sidebar è collassata
    const menuItems = this.sideNav.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      const label = item.querySelector('.label');
      if (label) {
        item.setAttribute('data-tooltip', label.textContent);
      }
    });
    
    // Aggiungi event listener al pulsante
    toggleBtn.addEventListener('click', () => {
      this.toggleSidebar();
    });
  }
  
  /**
   * Mostra o nasconde la sidebar
   */
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    
    if (this.sidebarCollapsed) {
      this.collapseSidebar();
    } else {
      this.expandSidebar();
    }
    
    // Aggiorna l'icona di toggle in base allo stato
    const toggleBtn = document.getElementById('toggle-btn-retract');
    if (toggleBtn) {
      const iconElement = toggleBtn.querySelector('.material-icons');
      if (iconElement) {
        iconElement.textContent = this.sidebarCollapsed ? 'chevron_right' : 'chevron_left';
      }
    }
    
    // Salva lo stato della sidebar in localStorage
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);
  }
  
  /**
   * Collassa la sidebar
   */
  collapseSidebar() {
    if (!this.sideNav) return;
    this.sideNav.classList.add('collapsed');
    if (this.app) this.app.classList.add('sidebar-collapsed');
  }
  
  /**
   * Espande la sidebar
   */
  expandSidebar() {
    if (!this.sideNav) return;
    this.sideNav.classList.remove('collapsed');
    if (this.app) this.app.classList.remove('sidebar-collapsed');
  }
}

export default NavigationManager;