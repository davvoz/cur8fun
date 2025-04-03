import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import ResourceMetersComponent from './ResourceMetersComponent.js';

export default class WalletResourcesComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.username = options.username || null;
    this.resourceMeters = null;
    this.onResourceLoadingComplete = options.onResourceLoadingComplete || null;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-resources-section';
    
    // Resources title
    const resourcesTitle = document.createElement('h5');
    resourcesTitle.textContent = 'Account Resources';
    this.element.appendChild(resourcesTitle);
    
    // Create container for resource meters
    const resourceMetersContainer = document.createElement('div');
    resourceMetersContainer.className = 'resource-meters-container';
    this.element.appendChild(resourceMetersContainer);
    
    // Initialize ResourceMetersComponent
    this.resourceMeters = new ResourceMetersComponent(resourceMetersContainer);
    this.resourceMeters.render();
    
    // Set retry handler
    this.resourceMeters.setRetryHandler(() => this.loadResourceData());
    
    // Load resource data
    this.loadResourceData();
    
    this.parentElement.appendChild(this.element);
    return this.element;
  }
  
  async loadResourceData() {
    try {
      // Show loading state
      this.resourceMeters.updateResources({
        isLoading: true
      });
      
      // Get account resources from wallet service
      const resources = await walletService.getAccountResources(this.username);
      
      // Update meters with real data
      this.resourceMeters.updateResources({
        ...resources,
        isLoading: false
      });
      
      // Notify parent if callback is provided
      if (this.onResourceLoadingComplete) {
        this.onResourceLoadingComplete(resources);
      }
      
    } catch (error) {
      console.error('Error loading resource data:', error);
      this.resourceMeters.updateResources({
        isLoading: false,
        error: error.message || 'Failed to load resource data'
      });
    }
  }
  
  /**
   * Update username and reload data
   */
  updateUsername(username) {
    if (this.username === username) return;
    this.username = username;
    if (this.element) {
      this.loadResourceData();
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.resourceMeters) {
      this.resourceMeters.destroy();
    }
    super.destroy();
  }
}