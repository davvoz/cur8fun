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
    
    // Create basic container structure
    this.element.innerHTML = `
      <div class="wallet-container">
        <div class="page-header">
          <h1>Wallet</h1>
          <p>Manage your STEEM, SBD and STEEM POWER</p>
        </div>
        
        <div id="wallet-balances-container"></div>
        <div id="wallet-resources-container"></div>
        <div id="wallet-tabs-container"></div>
      </div>
    `;
    
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
    this.element.innerHTML = `
      <div class="login-required">
        <h2>Login Required</h2>
        <p>Please login to view your wallet.</p>
        <a href="/login" class="btn btn-primary">Login Now</a>
      </div>
    `;
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