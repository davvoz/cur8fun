import View from './View.js';
import authService from '../services/AuthService.js';
import walletService from '../services/WalletService.js';
import WalletBalancesComponent from '../components/wallet/WalletBalancesComponent.js';
import WalletResourcesComponent from '../components/wallet/WalletResourcesComponent.js';
import WalletTabsComponent from '../components/wallet/WalletTabsComponent.js';

/**
 * Wallet view with component-based architecture
 */
class WalletView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Wallet | cur8.fun';
    this.currentUser = authService.getCurrentUser()?.username;
    
    // Track components for lifecycle management
    this.components = [];
    
    // Track if active key is available
    this.hasActiveKey = false;
  }
  
  async render(element) {
    // Store the element reference
    this.element = element;
    
    // Check authentication
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return this.element;
    }
    
    // Check for active key
    this.hasActiveKey = authService.hasActiveKeyAccess();
    
    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create wallet container
    const walletContainer = document.createElement('div');
    walletContainer.className = 'wallet-container';
    
    // Create header section
    const pageHeader = document.createElement('div');
    pageHeader.className = 'page-header';
    
    const heading = document.createElement('h1');
    heading.textContent = 'Wallet';
    pageHeader.appendChild(heading);
    
    const subheading = document.createElement('p');
    subheading.textContent = 'Manage your STEEM, SBD and STEEM POWER';
    pageHeader.appendChild(subheading);
    
    walletContainer.appendChild(pageHeader);
    
    // Display active key status notification
    if (!this.hasActiveKey) {
      const activeKeyNotice = document.createElement('div');
      activeKeyNotice.className = 'active-key-notice alert alert-warning';
      activeKeyNotice.innerHTML = `
        <strong>Limited functionality:</strong> You're currently logged in with a posting key. 
        Some wallet operations require an active key. 
        <a href="/login?returnUrl=/wallet" class="active-key-login">Login with active key</a> 
        to access all features.
      `;
      walletContainer.appendChild(activeKeyNotice);
    } else {
      const activeKeyConfirm = document.createElement('div');
      activeKeyConfirm.className = 'active-key-confirm alert alert-success';
      activeKeyConfirm.innerHTML = `
        <strong>Full access:</strong> Active key is available. You can perform all wallet operations.
      `;
      walletContainer.appendChild(activeKeyConfirm);
    }
    
    // Create component containers
    const balancesContainer = document.createElement('div');
    balancesContainer.id = 'wallet-balances-container';
    walletContainer.appendChild(balancesContainer);
    
    const resourcesContainer = document.createElement('div');
    resourcesContainer.id = 'wallet-resources-container';
    walletContainer.appendChild(resourcesContainer);
    
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'wallet-tabs-container';
    walletContainer.appendChild(tabsContainer);
    
    // Add to DOM
    this.element.appendChild(walletContainer);
    
    // Initialize components
    this.initializeComponents();
    
    return this.element;
  }
  
  /**
   * Render login prompt for unauthenticated users
   */
  renderLoginPrompt() {
    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    const loginRequired = document.createElement('div');
    loginRequired.className = 'login-required';
    
    const heading = document.createElement('h2');
    heading.textContent = 'Login Required';
    loginRequired.appendChild(heading);
    
    const message = document.createElement('p');
    message.textContent = 'Please login to view your wallet.';
    loginRequired.appendChild(message);
    
    const loginButton = document.createElement('a');
    loginButton.href = '/login?returnUrl=/wallet';
    loginButton.className = 'btn btn-primary';
    loginButton.textContent = 'Login Now';
    loginRequired.appendChild(loginButton);
    
    // Add a note about active key requirement
    const activeKeyNote = document.createElement('p');
    activeKeyNote.className = 'active-key-note';
    activeKeyNote.innerHTML = '<strong>Note:</strong> To perform wallet transactions, login with your active key.';
    activeKeyNote.style.marginTop = '15px';
    activeKeyNote.style.fontSize = '0.9em';
    loginRequired.appendChild(activeKeyNote);
    
    this.element.appendChild(loginRequired);
  }
  
  /**
   * Initialize and render all wallet components
   */
  initializeComponents() {
    // Initialize balance component
    const balancesContainer = this.element.querySelector('#wallet-balances-container');
    if (balancesContainer) {
      const balancesComponent = new WalletBalancesComponent(balancesContainer, {
        username: this.currentUser,
        hasActiveKey: this.hasActiveKey
      });
      balancesComponent.render();
      this.components.push(balancesComponent);
    }
    
    // Initialize resource meters component
    const resourcesContainer = this.element.querySelector('#wallet-resources-container');
    if (resourcesContainer) {
      const resourcesComponent = new WalletResourcesComponent(resourcesContainer, {
        username: this.currentUser
      });
      resourcesComponent.render();
      this.components.push(resourcesComponent);
    }
    
    // Initialize tabs component
    const tabsContainer = this.element.querySelector('#wallet-tabs-container');
    if (tabsContainer) {
      const tabsComponent = new WalletTabsComponent(tabsContainer, {
        username: this.currentUser,
        hasActiveKey: this.hasActiveKey
      });
      tabsComponent.render();
      this.components.push(tabsComponent);
    }
  }
  
  /**
   * Clean up all components on view unmount
   */
  unmount() {
    // Destroy all components to clean up event listeners and subscriptions
    this.components.forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    // Clear components array
    this.components = [];
    
    // Call parent unmount to clean up view subscriptions
    super.unmount();
  }
}

export default WalletView;