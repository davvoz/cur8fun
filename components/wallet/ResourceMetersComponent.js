import Component from '../Component.js';

export default class ResourceMetersComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.resources = options.initialResources || {
      voting: 0,
      rc: 0,
      bandwidth: 0
    };
    // Store element references for quick access
    this.meterElements = {
      voting: {},
      rc: {},
      bandwidth: {}
    };
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'resource-meters';
    
    // Create Voting Power meter
    const votingMeter = this.createResourceMeter(
      'Voting Power', 
      'voting-power-fill', 
      'voting-power-value'
    );
    this.meterElements.voting.fill = votingMeter.fill;
    this.meterElements.voting.value = votingMeter.value;
    this.element.appendChild(votingMeter.container);
    
    // Create Resource Credits meter
    const rcMeter = this.createResourceMeter(
      'Resource Credits', 
      'rc-fill', 
      'rc-value'
    );
    this.meterElements.rc.fill = rcMeter.fill;
    this.meterElements.rc.value = rcMeter.value;
    this.element.appendChild(rcMeter.container);
    
    // Create Bandwidth meter
    const bandwidthMeter = this.createResourceMeter(
      'Bandwidth', 
      'bandwidth-fill', 
      'bandwidth-value'
    );
    this.meterElements.bandwidth.fill = bandwidthMeter.fill;
    this.meterElements.bandwidth.value = bandwidthMeter.value;
    this.element.appendChild(bandwidthMeter.container);
    
    this.parentElement.appendChild(this.element);
    
    // Set initial values
    this.updateResources(this.resources);
    
    return this.element;
  }
  
  /**
   * Helper method to create a resource meter element
   */
  createResourceMeter(label, fillId, valueId) {
    const container = document.createElement('div');
    container.className = 'resource-meter';
    
    // Create label
    const labelElement = document.createElement('div');
    labelElement.className = 'meter-label';
    labelElement.textContent = label;
    container.appendChild(labelElement);
    
    // Create meter bar
    const meterBar = document.createElement('div');
    meterBar.className = 'meter-bar';
    container.appendChild(meterBar);
    
    // Create fill element
    const fill = document.createElement('div');
    fill.className = 'meter-fill';
    fill.id = fillId;
    fill.style.width = '0%';
    meterBar.appendChild(fill);
    
    // Create value element
    const valueElement = document.createElement('div');
    valueElement.className = 'meter-value';
    valueElement.id = valueId;
    valueElement.textContent = '0%';
    container.appendChild(valueElement);
    
    return {
      container,
      fill,
      value: valueElement
    };
  }
  
  updateResources(resources) {
    if (!this.element) return;
    
    // Update voting power
    this.meterElements.voting.fill.style.width = `${resources.voting}%`;
    this.meterElements.voting.value.textContent = `${resources.voting}%`;
    this.updateMeterColor(this.meterElements.voting.fill, resources.voting);
    
    // Update resource credits
    this.meterElements.rc.fill.style.width = `${resources.rc}%`;
    this.meterElements.rc.value.textContent = `${resources.rc}%`;
    this.updateMeterColor(this.meterElements.rc.fill, resources.rc);
    
    // Update bandwidth
    this.meterElements.bandwidth.fill.style.width = `${resources.bandwidth}%`;
    this.meterElements.bandwidth.value.textContent = `${resources.bandwidth}%`;
    this.updateMeterColor(this.meterElements.bandwidth.fill, resources.bandwidth);
  }
  
  /**
   * Helper method to update meter color based on value
   */
  updateMeterColor(element, value) {
    element.classList.remove('low', 'medium', 'high');
    
    if (value < 30) element.classList.add('high');
    else if (value < 70) element.classList.add('medium');
    else element.classList.add('low');
  }
}