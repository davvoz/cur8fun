import eventEmitter from './EventEmitter.js';

class NavigationManager {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.bottomNavCreated = false;
    this.initResponsiveNavigation();
    
    // Reagisci ai cambiamenti di route
    eventEmitter.on('route:changed', () => {
      if (this.isMobile && this.bottomNavCreated) {
        this.highlightActiveBottomMenuItem();
      }
    });
  }
  
  initResponsiveNavigation() {
    // Ascolta i cambiamenti di dimensione della finestra
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth < 768;
      
      // Cambia tipo di navigazione quando passa da desktop a mobile o viceversa
      if (wasMobile !== this.isMobile) {
        this.switchNavigationMode();
      }
    });
    
    // Configurazione iniziale
    this.switchNavigationMode();
  }
  
  switchNavigationMode() {
    if (this.isMobile) {
      this.createBottomNavigation();
      this.hideDesktopNavigation();
      this.collapseBreadcrumbs();
    } else {
      this.showDesktopNavigation();
      this.removeBottomNavigation();
      this.expandBreadcrumbs();
    }
  }
  
  createBottomNavigation() {
    // Evitare creazioni multiple della barra
    if (this.bottomNavCreated) return;
    
    const bottomNav = document.createElement('nav');
    bottomNav.className = 'bottom-navigation';
    bottomNav.id = 'bottom-navigation';
    
    // Aggiungere solo voci di menu principali con icone (max 5)
    bottomNav.innerHTML = `
      <a href="/" class="bottom-nav-item">
        <span class="material-icons">home</span>
        <span class="bottom-nav-label">Home</span>
      </a>
      <a href="/trending" class="bottom-nav-item">
        <span class="material-icons">trending_up</span>
        <span class="bottom-nav-label">Trending</span>
      </a>
      <a href="/create" class="bottom-nav-item create-button">
        <span class="material-icons">add_circle</span>
        <span class="bottom-nav-label">Post</span>
      </a>
      <a href="/notifications" class="bottom-nav-item">
        <span class="material-icons">notifications</span>
        <span class="bottom-nav-label">Notifiche</span>
      </a>
      <a href="/menu" class="bottom-nav-item">
        <span class="material-icons">menu</span>
        <span class="bottom-nav-label">Menu</span>
      </a>
    `;
    
    document.body.appendChild(bottomNav);
    this.bottomNavCreated = true;
    this.highlightActiveBottomMenuItem();
  }
  
  // IMPLEMENTAZIONE DEI METODI MANCANTI
  
  removeBottomNavigation() {
    const bottomNav = document.getElementById('bottom-navigation');
    if (bottomNav) {
      bottomNav.style.display = 'none';
    }
  }
  
  hideDesktopNavigation() {
    // Nascondi la barra laterale
    const sideNav = document.querySelector('.side-nav');
    if (sideNav) {
      sideNav.style.display = 'none';
    }
    
    // Adatta l'app layout
    const app = document.getElementById('app');
    if (app) {
      app.classList.add('mobile-layout');
    }
    
    // Ottimizza la barra superiore
    const navCenter = document.querySelector('.nav-center');
    if (navCenter) {
      navCenter.style.display = 'none';
    }
  }
  
  showDesktopNavigation() {
    // Mostra la barra laterale
    const sideNav = document.querySelector('.side-nav');
    if (sideNav) {
      sideNav.style.display = '';
    }
    
    // Ripristina l'app layout
    const app = document.getElementById('app');
    if (app) {
      app.classList.remove('mobile-layout');
    }
    
    // Ripristina la barra di ricerca
    const navCenter = document.querySelector('.nav-center');
    if (navCenter) {
      navCenter.style.display = '';
    }
  }
  
  collapseBreadcrumbs() {
    // Mostra solo l'ultimo elemento o trasforma in dropdown
    const breadcrumbs = document.querySelector('.breadcrumbs');
    if (breadcrumbs) {
      breadcrumbs.classList.add('compact-breadcrumbs');
    }
  }
  
  expandBreadcrumbs() {
    // Ripristina tutti gli elementi breadcrumb
    const breadcrumbs = document.querySelector('.breadcrumbs');
    if (breadcrumbs) {
      breadcrumbs.classList.remove('compact-breadcrumbs');
    }
  }
  
  highlightActiveBottomMenuItem() {
    // Evidenzia l'elemento di navigazione attivo nel bottom menu
    const currentPath = window.location.pathname;
    const bottomMenuItems = document.querySelectorAll('.bottom-nav-item');
    
    bottomMenuItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === currentPath || 
         (href === '/' && currentPath === '') ||
         (href !== '/' && currentPath.startsWith(href))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

// Esporta la classe invece dell'istanza
export default NavigationManager;