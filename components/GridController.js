import eventEmitter from '../utils/EventEmitter.js';

class GridController {
  constructor(options = {}) {
    this.container = null;
    this.targetSelector = options.targetSelector || '.posts-container';
    this.target = null;
    this.settings = {
      layout: localStorage.getItem('grid-layout') || 'grid', // grid, list, compact
    };
    this.isExpanded = false;
    this.isMobile = this.checkIfMobile();
    
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
    }
  }
  
  // Update controller visibility based on mobile state
  updateControllerVisibility() {
    if (!this.container) return;
    
    if (this.isMobile) {
      this.container.classList.add('mobile-hidden');
      
      // Apply mobile-specific settings
      if (this.target) {
        // Force grid to compact layout on mobile
        this.target.classList.remove('grid-layout-grid', 'grid-layout-list');
        this.target.classList.add('grid-layout-compact');
      }
    } else {
      this.container.classList.remove('mobile-hidden');
      this.applySettings(); // Re-apply user settings on desktop
    }
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
    this.applySettings();
    
    // Emit event for other components to react
    eventEmitter.emit('grid-settings-changed', { 
      key, 
      value, 
      settings: this.settings 
    });
  }
  
  applySettings() {
    if (!this.target) return;
    
    // If on mobile, force compact layout
    if (this.isMobile) {
      // Clear existing classes
      const classesToRemove = Array.from(this.target.classList)
        .filter(cls => cls.startsWith('grid-layout-'));
      
      classesToRemove.forEach(cls => this.target.classList.remove(cls));
      
      // Apply mobile-optimized layout
      this.target.classList.add('grid-layout-compact');
      return;
    }
    
    // Clear existing layout classes
    const classesToRemove = Array.from(this.target.classList)
      .filter(cls => cls.startsWith('grid-layout-'));
    
    classesToRemove.forEach(cls => this.target.classList.remove(cls));
    
    // Apply new layout class
    this.target.classList.add(`grid-layout-${this.settings.layout}`);
  }
  
  setupMutationObserver() {
    // Create a MutationObserver to watch for changes to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && this.target) {
          // Re-apply settings when new content is loaded (like infinite scroll)
          this.applySettings();
        }
      }
    });
    
    // Start observing the target node for configured mutations
    setTimeout(() => {
      if (this.target) {
        observer.observe(this.target, { childList: true });
      }
    }, 500);
  }
  
  unmount() {
    // Clean up any event listeners or observers here
    if (this.target && this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    // Remove resize event listener
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}

export default GridController;
