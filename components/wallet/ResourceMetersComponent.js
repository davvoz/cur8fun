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
    container.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    
    // Two skeleton rows that mirror the new single-row .resource-meter layout
    [1, 2].forEach(() => {
      const card = document.createElement('div');
      card.className = 'resource-meter';
      
      const iconSkel = document.createElement('div');
      iconSkel.className = 'sk-block';
      iconSkel.style.cssText = 'width:16px;height:16px;border-radius:50%;flex-shrink:0';
      
      const labelSkel = document.createElement('div');
      labelSkel.className = 'sk-block';
      labelSkel.style.cssText = 'height:13px;width:90px;border-radius:4px;flex-shrink:0';
      
      const barSkel = document.createElement('div');
      barSkel.className = 'sk-block';
      barSkel.style.cssText = 'flex:1;height:7px;border-radius:4px';
      
      const valueSkel = document.createElement('div');
      valueSkel.className = 'sk-block';
      valueSkel.style.cssText = 'width:36px;height:13px;border-radius:4px;flex-shrink:0';
      
      card.append(iconSkel, labelSkel, barSkel, valueSkel);
      container.appendChild(card);
    });
    
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

    // Icon
    if (icon) {
      const iconElement = document.createElement('i');
      iconElement.className = 'material-icons meter-icon';
      iconElement.textContent = icon;
      container.appendChild(iconElement);
    }

    // Label
    const labelElement = document.createElement('div');
    labelElement.className = 'meter-label';
    labelElement.textContent = label;
    container.appendChild(labelElement);

    // Bar
    const meterBar = document.createElement('div');
    meterBar.className = 'meter-bar';
    const fill = document.createElement('div');
    fill.className = 'meter-fill';
    fill.id = fillId;
    fill.style.width = '0%';
    meterBar.appendChild(fill);
    container.appendChild(meterBar);

    // Value
    const valueElement = document.createElement('div');
    valueElement.className = 'meter-value';
    valueElement.id = valueId;
    valueElement.textContent = '0%';
    container.appendChild(valueElement);

    return { container, fill, value: valueElement };
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
    this.updateMeterColor(this.meterElements.voting.fill, resources.voting, 'voting');
    
    // Update resource credits with animation
    this.animateMeterFill(this.meterElements.rc.fill, resources.rc);
    this.meterElements.rc.value.textContent = `${resources.rc}%`;
    this.updateMeterColor(this.meterElements.rc.fill, resources.rc, 'rc');
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
  updateMeterColor(element, value, type = 'voting') {
    if (type === 'rc') {
      // RC: gray at 0% → steel blue at 50% → vivid blue at 100%
      const lightness = 55 - (value / 100) * 15; // 55% → 40%
      const saturation = 20 + (value / 100) * 70;  // 20% → 90%
      element.style.backgroundColor = `hsl(210, ${saturation}%, ${lightness}%)`;
    } else {
      // Voting Power: red at 0% → orange/yellow at ~50% → green at 100%
      const hue = Math.floor((value / 100) * 120); // 0=red, 60=yellow, 120=green
      element.style.backgroundColor = `hsl(${hue}, 88%, 44%)`;
    }
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