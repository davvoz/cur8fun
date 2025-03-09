import eventEmitter from './EventEmitter.js';
import { mainNavItems, specialItems } from '../config/navigation.js';

class NavigationManager {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.menuOpen = false;
    this.initElements();
    this.initEventListeners();
    this.renderNavigation();
  }
  
  initElements() {
    // Cache DOM elements
    this.app = document.getElementById('app');
    this.sideNav = document.querySelector('.side-nav');
    this.bottomNav = document.getElementById('bottom-navigation');
    this.navCenter = document.querySelector('.nav-center');
    this.breadcrumbs = document.querySelector('.breadcrumbs');
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
      
      // Split items for left and right sides evenly
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
      
      // Append containers to bottom navigation
      this.bottomNav.appendChild(leftContainer);
      this.bottomNav.appendChild(centerContainer);
      this.bottomNav.appendChild(rightContainer);
      
      // Debug check to verify the button is in the DOM
      console.log('Center button added:', !!this.bottomNav.querySelector('.center-button'));
    }
  }
  
  createNavItem(item, type) {
    const navItem = document.createElement('a');
    navItem.href = item.path;
    navItem.className = type === 'bottom' ? 'bottom-nav-item' : 'menu-item';
    navItem.dataset.id = item.id; // Add data attribute for identification
    
    if (item.isAction) {
      navItem.classList.add('create-button');
    }
    
    if (item.centerPosition) {
      navItem.classList.add('center-button');
    }
    
    navItem.innerHTML = `
      <span class="material-icons">${item.icon}</span>
      <span class="${type === 'bottom' ? 'bottom-nav-label' : 'label'}">${item.label}</span>
    `;
    
    return navItem;
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
    if (this.breadcrumbs) this.breadcrumbs.classList.add('compact-breadcrumbs');
  }
  
  enableDesktopMode() {
    if (this.sideNav) {
      this.sideNav.classList.remove('mobile');
      this.sideNav.classList.remove('hidden');
      this.sideNav.classList.remove('visible');
    }
    if (this.bottomNav) this.bottomNav.classList.add('hidden');
    if (this.app) this.app.classList.remove('mobile-layout');
    if (this.navCenter) this.navCenter.classList.remove('hidden');
    if (this.breadcrumbs) this.breadcrumbs.classList.remove('compact-breadcrumbs');
  }
  
  highlightActiveMenuItem() {
    const currentPath = window.location.pathname || '/';
    
    // Update side nav active state
    const sideMenuItems = document.querySelectorAll('.side-nav .menu-item');
    sideMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      const isActive = 
        href === currentPath || 
        (href === '/' && currentPath === '') ||
        (href !== '/' && currentPath.startsWith(href));
      
      item.classList.toggle('active', isActive);
    });
    
    // Update bottom nav active state
    const bottomMenuItems = document.querySelectorAll('.bottom-nav-item');
    bottomMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      const isAction = item.classList.contains('center-button') || item.dataset.id === 'menu'; // Don't highlight create button or menu
      
      const isActive = 
        !isAction && (
          href === currentPath || 
          (href === '/' && currentPath === '') ||
          (href !== '/' && currentPath.startsWith(href))
        );
      
      item.classList.toggle('active', isActive);
    });
  }
}

export default NavigationManager;