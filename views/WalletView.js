import View from './View.js';
import authService from '../services/AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';
import WalletBalancesComponent from '../components/wallet/WalletBalancesComponent.js';
import WalletResourcesComponent from '../components/wallet/WalletResourcesComponent.js';
import WalletTabsComponent from '../components/wallet/WalletTabsComponent.js';
import WalletRewardsComponent from '../components/wallet/actions/WalletRewardsComponent.js';
import ActiveKeyWarningComponent from '../components/wallet/ActiveKeyWarningComponent.js';

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
  }
  
  async render(element) {
    // Store the element reference
    this.element = element;
    
    // Check authentication
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return this.element;
    }
    
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
    
    // Create active key warning container
    const activeKeyWarningContainer = document.createElement('div');
    activeKeyWarningContainer.id = 'wallet-active-key-warning';
    walletContainer.appendChild(activeKeyWarningContainer);
    
    // Create rewards component container
    const rewardsContainer = document.createElement('div');
    rewardsContainer.id = 'wallet-rewards-container';
    walletContainer.appendChild(rewardsContainer);
    
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
    loginButton.href = '/login';
    loginButton.className = 'btn btn-primary';
    loginButton.textContent = 'Login Now';
    loginRequired.appendChild(loginButton);
    
    this.element.appendChild(loginRequired);
  }
  
  /**
   * Initialize and render all wallet components
   */
  initializeComponents() {
    // Initialize active key warning component
    const activeKeyWarningContainer = this.element.querySelector('#wallet-active-key-warning');
    if (activeKeyWarningContainer) {
      const activeKeyWarningComponent = new ActiveKeyWarningComponent(activeKeyWarningContainer);
      activeKeyWarningComponent.init(); // Chiamiamo init() invece di render()
      this.components.push(activeKeyWarningComponent);
    }
    
    // Initialize rewards component
    const rewardsContainer = this.element.querySelector('#wallet-rewards-container');
    if (rewardsContainer) {
      const rewardsComponent = new WalletRewardsComponent(rewardsContainer);
      rewardsComponent.render();
      this.components.push(rewardsComponent);
    }
    
    // Initialize balance component
    const balancesContainer = this.element.querySelector('#wallet-balances-container');
    if (balancesContainer) {
      const balancesComponent = new WalletBalancesComponent(balancesContainer, {
        username: this.currentUser
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
        hasActiveKey: authService.hasActiveKeyAccess()
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