import eventEmitter from '../utils/EventEmitter.js';

class GridController {
  constructor(options = {}) {
    this.container = null;
    this.targetSelector = options.targetSelector || '.posts-container';
    this.target = options.target || null;
    this.settings = {
      layout: localStorage.getItem('grid-layout') || 'grid', // grid, list, compact
    };
    this.isExpanded = false;
    this.isMobile = this.checkIfMobile();
    this.mutationObserver = null;
    
    // Monitor resize events for mobile detection
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  // Check if the device is mobile
  checkIfMobile() {
    return window.innerWidth <= 768;
  }
  
  // Handle resize events
  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = this.checkIfMobile();
    
    // If mobile state changed, update UI
    if (wasMobile !== this.isMobile) {
      this.updateControllerVisibility();
      this.applySettings(); // Make sure settings are properly applied when switching between mobile/desktop
    }
  }
  
  // Update controller visibility based on mobile state
  updateControllerVisibility() {
    if (!this.container) return;
    
    // Remove mobile-hidden class to show the controller on mobile
    this.container.classList.remove('mobile-hidden');
    
    // Apply appropriate layout settings
    this.applySettings();
  }

  render(container) {
    this.container = container;
    
    // Create the controller UI
    const controllerEl = document.createElement('div');
    controllerEl.className = 'grid-controller';
    
    // Create controls container
    const controls = document.createElement('div');
    controls.className = 'grid-controls';
    
    // Add layout options
    controls.appendChild(this.createLayoutSelector());
    
    // Assemble the controller (without reset button)
    controllerEl.appendChild(controls);
    
    // Add to container
    container.appendChild(controllerEl);
    
    // Find the target container to apply settings
    setTimeout(() => {
      this.target = document.querySelector(this.targetSelector);
      if (this.target) {
        this.applySettings();
      }
      
      // Apply mobile visibility settings
      this.updateControllerVisibility();
    }, 0);
    
    // Listen for changes in DOM (for infinite scroll)
    this.setupMutationObserver();
  }
  
  createLayoutSelector() {
    const layoutGroup = document.createElement('div');
    layoutGroup.className = 'grid-control-group';
    
    const label = document.createElement('label');
    label.textContent = 'Layout';
    layoutGroup.appendChild(label);
    
    const options = document.createElement('div');
    options.className = 'grid-layout-options';
    
    const layouts = [
      { id: 'grid', icon: 'grid_view', label: 'Grid' },
      { id: 'list', icon: 'view_list', label: 'List' },
      { id: 'compact', icon: 'view_comfy', label: 'Compact' }
    ];
    
    layouts.forEach(layout => {
      const button = document.createElement('button');
      button.className = `grid-layout-option ${this.settings.layout === layout.id ? 'active' : ''}`;
      button.setAttribute('data-layout', layout.id);
      button.setAttribute('aria-label', layout.label);
      button.innerHTML = `<span class="material-icons">${layout.icon}</span>`;
      
      button.addEventListener('click', () => {
        this.updateSetting('layout', layout.id);
        options.querySelectorAll('.grid-layout-option').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-layout') === layout.id);
        });
      });
      
      options.appendChild(button);
    });
    
    layoutGroup.appendChild(options);
    return layoutGroup;
  }
  
  updateSetting(key, value) {
    this.settings[key] = value;
    localStorage.setItem(`grid-${key}`, value);
    
    // Find target if it's not explicitly set
    if (!this.target && this.targetSelector) {
      this.target = document.querySelector(this.targetSelector);
    }
    
    this.applySettings();
    
    // Emit event for other components to react
    eventEmitter.emit('grid-settings-changed', { 
      key, 
      value, 
      settings: this.settings 
    });
  }
  
  applySettings() {
    // Find target if it's not explicitly set
    if (!this.target && this.targetSelector) {
      this.target = document.querySelector(this.targetSelector);
    }
    
    if (!this.target) {
      console.warn('GridController: No target element found for', this.targetSelector);
      return;
    }
    
    // Clear existing layout classes
    const classesToRemove = Array.from(this.target.classList)
      .filter(cls => cls.startsWith('grid-layout-'));
    
    classesToRemove.forEach(cls => this.target.classList.remove(cls));
    
    // Apply new layout class - even on mobile, respect user selection
    this.target.classList.add(`grid-layout-${this.settings.layout}`);
  }
  
  setupMutationObserver() {
    // Clean up any existing observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Find target if it's not explicitly set
    if (!this.target && this.targetSelector) {
      this.target = document.querySelector(this.targetSelector);
    }
    
    if (!this.target) {
      console.warn('GridController: Cannot setup MutationObserver - no target element found');
      return;
    }
    
    // Create a MutationObserver to watch for changes to the DOM
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Re-apply settings when new content is loaded (like infinite scroll)
          this.applySettings();
        }
      }
    });
    
    // Start observing the target node for configured mutations
    this.mutationObserver.observe(this.target, { childList: true });
  }
  
  unmount() {
    // Clean up mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Remove resize event listener properly with the same function reference
    const resizeHandler = this.handleResize.bind(this);
    window.removeEventListener('resize', resizeHandler);
    
    // If target exists, remove applied layout classes
    if (this.target) {
      const classesToRemove = Array.from(this.target.classList)
        .filter(cls => cls.startsWith('grid-layout-'));
      
      classesToRemove.forEach(cls => this.target.classList.remove(cls));
    }
    
    // Remove the controller from DOM if container exists
    if (this.container && this.container.parentNode) {
      this.container.innerHTML = '';
    }
    
    // Clear references
    this.target = null;
    this.container = null;
  }
}

export default GridController;
