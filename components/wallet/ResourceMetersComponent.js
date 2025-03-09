import Component from '../Component.js';

export default class ResourceMetersComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.resources = options.initialResources || {
      voting: 0,
      rc: 0,
      bandwidth: 0
    };
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'resource-meters';
    this.element.innerHTML = `
      <div class="resource-meter">
        <div class="meter-label">Voting Power</div>
        <div class="meter-bar">
          <div class="meter-fill" id="voting-power-fill" style="width: 0%"></div>
        </div>
        <div class="meter-value" id="voting-power-value">0%</div>
      </div>
      
      <div class="resource-meter">
        <div class="meter-label">Resource Credits</div>
        <div class="meter-bar">
          <div class="meter-fill" id="rc-fill" style="width: 0%"></div>
        </div>
        <div class="meter-value" id="rc-value">0%</div>
      </div>
      
      <div class="resource-meter">
        <div class="meter-label">Bandwidth</div>
        <div class="meter-bar">
          <div class="meter-fill" id="bandwidth-fill" style="width: 0%"></div>
        </div>
        <div class="meter-value" id="bandwidth-value">0%</div>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Set initial values
    this.updateResources(this.resources);
    
    return this.element;
  }
  
  updateResources(resources) {
    if (!this.element) return;
    
    const votingFill = this.element.querySelector('#voting-power-fill');
    const rcFill = this.element.querySelector('#rc-fill');
    const bandwidthFill = this.element.querySelector('#bandwidth-fill');
    
    votingFill.style.width = `${resources.voting}%`;
    rcFill.style.width = `${resources.rc}%`;
    bandwidthFill.style.width = `${resources.bandwidth}%`;
    
    this.element.querySelector('#voting-power-value').textContent = `${resources.voting}%`;
    this.element.querySelector('#rc-value').textContent = `${resources.rc}%`;
    this.element.querySelector('#bandwidth-value').textContent = `${resources.bandwidth}%`;
    
    // Add color classes based on levels
    [
      { element: votingFill, value: resources.voting },
      { element: rcFill, value: resources.rc },
      { element: bandwidthFill, value: resources.bandwidth }
    ].forEach(({ element, value }) => {
      element.classList.remove('low', 'medium', 'high');
      
      if (value < 30) element.classList.add('high');
      else if (value < 70) element.classList.add('medium');
      else element.classList.add('low');
    });
  }
}