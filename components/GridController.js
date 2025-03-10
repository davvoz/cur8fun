import eventEmitter from '../utils/EventEmitter.js';

class GridController {
  constructor(options = {}) {
    this.container = null;
    this.targetSelector = options.targetSelector || '.posts-container';
    this.target = null;
    this.settings = {
      layout: localStorage.getItem('grid-layout') || 'grid', // grid, list, compact
      columns: parseInt(localStorage.getItem('grid-columns')) || 0, // 0 = auto
      cardSize: localStorage.getItem('grid-card-size') || 'medium', // small, medium, large
      spacing: localStorage.getItem('grid-spacing') || 'normal', // tight, normal, spacious
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
    
    // Add toggle button for mobile
    const toggleButton = document.createElement('button');
    toggleButton.className = 'grid-controller-toggle';
    toggleButton.innerHTML = '<span class="material-icons">tune</span>';
    toggleButton.setAttribute('aria-label', 'Toggle grid settings');
    toggleButton.addEventListener('click', () => this.toggleExpanded());
    
    // Create controls container
    const controls = document.createElement('div');
    controls.className = 'grid-controls';
    
    // Add layout options
    controls.appendChild(this.createLayoutSelector());
    
    // Add card size slider
    controls.appendChild(this.createSizeSelector());
    
    // Add spacing selector for desktop
    controls.appendChild(this.createSpacingSelector());
    
    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.className = 'grid-control-reset';
    resetButton.innerHTML = '<span class="material-icons">restart_alt</span> Reset';
    resetButton.addEventListener('click', () => this.resetSettings());
    
    controls.appendChild(resetButton);
    
    // Assemble the controller
    controllerEl.appendChild(toggleButton);
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
  
  createSizeSelector() {
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'grid-control-group';
    
    const label = document.createElement('label');
    label.textContent = 'Card Size';
    sizeGroup.appendChild(label);
    
    const sizeControl = document.createElement('div');
    sizeControl.className = 'grid-size-control';
    
    const sizes = [
      { id: 'small', label: 'S' },
      { id: 'medium', label: 'M' },
      { id: 'large', label: 'L' }
    ];
    
    sizes.forEach(size => {
      const option = document.createElement('button');
      option.className = `grid-size-option ${this.settings.cardSize === size.id ? 'active' : ''}`;
      option.setAttribute('data-size', size.id);
      option.textContent = size.label;
      
      option.addEventListener('click', () => {
        this.updateSetting('cardSize', size.id);
        sizeControl.querySelectorAll('.grid-size-option').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-size') === size.id);
        });
      });
      
      sizeControl.appendChild(option);
    });
    
    sizeGroup.appendChild(sizeControl);
    return sizeGroup;
  }
  
  createSpacingSelector() {
    const spacingGroup = document.createElement('div');
    spacingGroup.className = 'grid-control-group';
    
    const label = document.createElement('label');
    label.textContent = 'Spacing';
    spacingGroup.appendChild(label);
    
    const spacingControl = document.createElement('div');
    spacingControl.className = 'grid-spacing-control';
    
    const spacings = [
      { id: 'tight', icon: 'format_align_justify', label: 'Tight' },
      { id: 'normal', icon: 'format_align_center', label: 'Normal' },
      { id: 'spacious', icon: 'format_line_spacing', label: 'Spacious' }
    ];
    
    spacings.forEach(spacing => {
      const option = document.createElement('button');
      option.className = `grid-spacing-option ${this.settings.spacing === spacing.id ? 'active' : ''}`;
      option.setAttribute('data-spacing', spacing.id);
      option.setAttribute('aria-label', spacing.label);
      option.innerHTML = `<span class="material-icons">${spacing.icon}</span>`;
      
      option.addEventListener('click', () => {
        this.updateSetting('spacing', spacing.id);
        spacingControl.querySelectorAll('.grid-spacing-option').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-spacing') === spacing.id);
        });
      });
      
      spacingControl.appendChild(option);
    });
    
    spacingGroup.appendChild(spacingControl);
    return spacingGroup;
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
      
      // Still apply card size and spacing from user preferences
      this.target.classList.add(`grid-size-${this.settings.cardSize}`);
      this.target.classList.add(`grid-spacing-${this.settings.spacing}`);
      
      return;
    }
    
    // Clear existing classes
    const classesToRemove = Array.from(this.target.classList)
      .filter(cls => cls.startsWith('grid-layout-') || cls.startsWith('grid-size-') || cls.startsWith('grid-spacing-'));
    
    classesToRemove.forEach(cls => this.target.classList.remove(cls));
    
    // Apply new classes
    this.target.classList.add(`grid-layout-${this.settings.layout}`);
    this.target.classList.add(`grid-size-${this.settings.cardSize}`);
    this.target.classList.add(`grid-spacing-${this.settings.spacing}`);
    
    // Apply custom columns if set
    if (this.settings.columns > 0 && this.settings.layout === 'grid') {
      this.target.style.gridTemplateColumns = `repeat(${this.settings.columns}, 1fr)`;
    } else {
      this.target.style.gridTemplateColumns = '';
    }
  }
  
  resetSettings() {
    const defaultSettings = {
      layout: 'grid',
      columns: 0,
      cardSize: 'medium',
      spacing: 'normal'
    };
    
    // Update all settings at once
    Object.keys(defaultSettings).forEach(key => {
      this.settings[key] = defaultSettings[key];
      localStorage.setItem(`grid-${key}`, defaultSettings[key]);
      
      // Update UI
      const activeEl = this.container.querySelector(`[data-${key}="${defaultSettings[key]}"]`);
      if (activeEl) {
        const siblings = Array.from(activeEl.parentNode.children);
        siblings.forEach(el => el.classList.remove('active'));
        activeEl.classList.add('active');
      }
    });
    
    this.applySettings();
    
    // Notify about reset
    eventEmitter.emit('grid-settings-reset', { settings: this.settings });
  }
  
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    if (this.container) {
      this.container.classList.toggle('expanded', this.isExpanded);
    }
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
