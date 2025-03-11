import View from './View.js';
import authService from '../services/AuthService.js';
import walletService from '../services/WalletService.js';
import BalancesComponent from '../components/wallet/BalancesComponent.js';
import ResourceMetersComponent from '../components/wallet/ResourceMetersComponent.js';
import WalletTabsComponent from '../components/wallet/WalletTabsComponent.js';

/**
 * Wallet view with component-based architecture
 */
class WalletView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Wallet | SteemGram';
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
    
    // Request wallet data from service
    walletService.updateBalances();
    
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
    // Initialize balance component
    const balancesContainer = this.element.querySelector('#wallet-balances-container');
    if (balancesContainer) {
      const balancesComponent = new BalancesComponent(balancesContainer);
      balancesComponent.render();
      this.components.push(balancesComponent);
    }
    
    // Initialize resource meters component with default values
    const resourcesContainer = this.element.querySelector('#wallet-resources-container');
    if (resourcesContainer) {
      const resourcesComponent = new ResourceMetersComponent(resourcesContainer, {
        initialResources: {
          voting: 0,    // Will be updated by service
          rc: 0,        // Will be updated by service
          bandwidth: 0  // Will be updated by service
        }
      });
      resourcesComponent.render();
      this.components.push(resourcesComponent);
      
      // Request resource data (simulated for now)
      this.loadResourceData(resourcesComponent);
    }
    
    // Initialize tabs component
    const tabsContainer = this.element.querySelector('#wallet-tabs-container');
    if (tabsContainer) {
      const tabsComponent = new WalletTabsComponent(tabsContainer);
      tabsComponent.render();
      this.components.push(tabsComponent);
    }
  }
  
  /**
   * Load resource usage data for meters
   */
  async loadResourceData(resourcesComponent) {
    try {
      // In a real implementation, this would be from a service call
      // Simulating network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resourceData = {
        voting: 85,
        rc: 70,
        bandwidth: 45
      };
      
      resourcesComponent.updateResources(resourceData);
      
    } catch (error) {
      console.error('Failed to load resource data:', error);
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