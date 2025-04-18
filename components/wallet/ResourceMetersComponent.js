import Component from '../Component.js';

export default class ResourceMetersComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.resources = options.initialResources || {
      voting: 0,
      rc: 0
    };
    // Store element references for quick access
    this.meterElements = {
      voting: {},
      rc: {}
    };
    this.isLoading = false;
    this.error = null;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'resource-meters';
    
    // Create meters container
    this.metersContainer = document.createElement('div');
    this.metersContainer.className = 'meters-container';
    this.element.appendChild(this.metersContainer);
    
    // Create loading state element
    this.loadingElement = this.createLoadingElement();
    
    // Create error state element
    this.errorElement = this.createErrorElement();
    
    // Initial render based on current state
    this.updateUI();
    
    this.parentElement.appendChild(this.element);
    return this.element;
  }
  
  /**
   * Create loading state element
   */
  createLoadingElement() {
    const container = document.createElement('div');
    container.className = 'loading-state';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    container.appendChild(spinner);
    
    const text = document.createElement('p');
    text.textContent = 'Loading resource data...';
    container.appendChild(text);
    
    return container;
  }
  
  /**
   * Create error state element
   */
  createErrorElement() {
    const container = document.createElement('div');
    container.className = 'error-state';
    
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = 'error_outline';
    container.appendChild(icon);
    
    this.errorMessage = document.createElement('p');
    this.errorMessage.textContent = 'Failed to load resource data';
    container.appendChild(this.errorMessage);
    
    const retryButton = document.createElement('button');
    retryButton.className = 'btn btn-small';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => {
      if (this.onRetry) this.onRetry();
    });
    container.appendChild(retryButton);
    
    return container;
  }
  
  /**
   * Helper method to create a resource meter element
   */
  createResourceMeter(label, fillId, valueId, icon) {
    const container = document.createElement('div');
    container.className = 'resource-meter';
    
    // Create header with icon and label
    const header = document.createElement('div');
    header.className = 'meter-header';
    
    // Add icon if provided
    if (icon) {
      const iconElement = document.createElement('i');
      iconElement.className = 'material-icons meter-icon';
      iconElement.textContent = icon;
      header.appendChild(iconElement);
    }
    
    const labelElement = document.createElement('div');
    labelElement.className = 'meter-label';
    labelElement.textContent = label;
    header.appendChild(labelElement);
    
    // Create value element next to label
    const valueElement = document.createElement('div');
    valueElement.className = 'meter-value';
    valueElement.id = valueId;
    valueElement.textContent = '0%';
    header.appendChild(valueElement);
    
    container.appendChild(header);
    
    // Create meter bar with gradient background
    const meterBar = document.createElement('div');
    meterBar.className = 'meter-bar';
    container.appendChild(meterBar);
    
    // Create fill element with animated transition
    const fill = document.createElement('div');
    fill.className = 'meter-fill';
    fill.id = fillId;
    fill.style.width = '0%';
    meterBar.appendChild(fill);
    
    return {
      container,
      fill,
      value: valueElement
    };
  }
  
  /**
   * Create all resource meters
   */
  createAllMeters() {
    // Clear existing content
    this.metersContainer.innerHTML = '';
    
    // Create Voting Power meter
    const votingMeter = this.createResourceMeter(
      'Voting Power', 
      'voting-power-fill', 
      'voting-power-value',
      'how_to_vote'
    );
    this.meterElements.voting.fill = votingMeter.fill;
    this.meterElements.voting.value = votingMeter.value;
    this.metersContainer.appendChild(votingMeter.container);
    
    // Create Resource Credits meter
    const rcMeter = this.createResourceMeter(
      'Resource Credits', 
      'rc-fill', 
      'rc-value',
      'battery_charging_full'
    );
    this.meterElements.rc.fill = rcMeter.fill;
    this.meterElements.rc.value = rcMeter.value;
    this.metersContainer.appendChild(rcMeter.container);
    
    // Set initial values
    this.updateResourceMeters(this.resources);
  }
  
  /**
   * Update UI based on current state
   */
  updateUI() {
    // Clear container first
    this.metersContainer.innerHTML = '';
    
    if (this.isLoading) {
      this.metersContainer.appendChild(this.loadingElement);
    } else if (this.error) {
      this.errorMessage.textContent = this.error;
      this.metersContainer.appendChild(this.errorElement);
    } else {
      this.createAllMeters();
    }
  }
  
  /**
   * Update resources with new data
   */
  updateResources(resourceData) {
    const { voting, rc, isLoading, error } = resourceData;
    
    this.isLoading = !!isLoading;
    this.error = error || null;
    
    // Update resource values if provided
    if (typeof voting !== 'undefined') this.resources.voting = voting;
    if (typeof rc !== 'undefined') this.resources.rc = rc;
    
    // Update UI based on state
    this.updateUI();
  }
  
  /**
   * Update meter values and colors
   */
  updateResourceMeters(resources) {
    if (!this.meterElements.voting.fill) return;
    
    // Update voting power with animation
    this.animateMeterFill(this.meterElements.voting.fill, resources.voting);
    this.meterElements.voting.value.textContent = `${resources.voting}%`;
    this.updateMeterColor(this.meterElements.voting.fill, resources.voting);
    
    // Update resource credits with animation
    this.animateMeterFill(this.meterElements.rc.fill, resources.rc);
    this.meterElements.rc.value.textContent = `${resources.rc}%`;
    this.updateMeterColor(this.meterElements.rc.fill, resources.rc);
  }
  
  /**
   * Animate meter fill with smooth transition
   */
  animateMeterFill(element, value) {
    // Add transition class for smooth animation
    element.classList.add('animating');
    element.style.width = `${value}%`;
    
    // Remove transition class after animation completes
    setTimeout(() => {
      element.classList.remove('animating');
    }, 600);
  }
  
  /**
   * Helper method to update meter color based on value
   */
  updateMeterColor(element, value) {
    // Remove existing classes
    element.classList.remove('low', 'medium', 'high');
    
    // Calculate a smooth gradient from red to green based on percentage
    // Red at 0%, yellow at 50%, green at 100%
    const hue = Math.floor((value / 100) * 120); // 0 is red, 120 is green in HSL
    const saturation = 90;
    const lightness = 45;
    
    // Set dynamic background color based on percentage
    element.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  
  /**
   * Set retry callback
   */
  setRetryHandler(callback) {
    this.onRetry = callback;
  }
  
  /**
   * Clean up all event listeners
   */
  destroy() {
    this.onRetry = null;
    super.destroy();
  }
}