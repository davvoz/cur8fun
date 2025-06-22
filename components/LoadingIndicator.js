class LoadingIndicator {
  constructor(type = 'spinner', fullscreen = false) {
    this.type = type;
    this.fullscreen = fullscreen;
    this.element = this.createElement();
  }
    createElement() {
    const wrapper = document.createElement('div');
    
    // Add fullscreen class if specified
    if (this.fullscreen) {
      wrapper.className = 'loading-overlay-fullscreen';
    }
    
    const creators = {
      spinner: () => {
        const spinnerContainer = document.createElement('div');
        spinnerContainer.className = this.fullscreen ? 'loading-spinner fullscreen' : 'loading-spinner';
        
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'spinner';
        
        const loadingText = document.createElement('p');
        loadingText.className = 'loading-text';
        loadingText.textContent = 'Loading...';
        
        spinnerContainer.appendChild(spinnerDiv);
        spinnerContainer.appendChild(loadingText);
        
        if (this.fullscreen) {
          wrapper.appendChild(spinnerContainer);
        } else {
          // For non-fullscreen, wrapper is the spinner container
          wrapper.className = 'loading-spinner';
          wrapper.appendChild(spinnerDiv);
          wrapper.appendChild(loadingText);
        }
      },
        skeleton: () => {
        const skeletonContainer = document.createElement('div');
        skeletonContainer.className = this.fullscreen ? 'loading-skeleton fullscreen' : 'loading-skeleton';
        
        if (this.fullscreen) {
          wrapper.appendChild(skeletonContainer);
        } else {
          wrapper.className = 'loading-skeleton';
        }
        // Skeleton UI can be customized per component
      },
      
      progressBar: () => {
        const progressContainer = document.createElement('div');
        progressContainer.className = this.fullscreen ? 'loading-progress-bar fullscreen' : 'loading-progress-bar';
        
        const progressTrack = document.createElement('div');
        progressTrack.className = 'progress-track';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        
        progressTrack.appendChild(progressFill);
        progressContainer.appendChild(progressTrack);
        
        if (this.fullscreen) {
          wrapper.appendChild(progressContainer);
        } else {
          wrapper.className = 'loading-progress-bar';
          wrapper.appendChild(progressTrack);
        }
      }
    };
    
    // Execute the creator function or default to spinner
    (creators[this.type] || creators.spinner)();
    
    return wrapper;
  }
    show(container, message = null) {
    if (message && this.element.querySelector('.loading-text')) {
      this.element.querySelector('.loading-text').textContent = message;
    }
    
    if (this.fullscreen) {
      // For fullscreen, append to body
      document.body.appendChild(this.element);
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // For regular loading, append to container
      container.appendChild(this.element);
    }
    
    return this;
  }

  /**
   * Static method to show fullscreen loading
   */
  static showFullscreen(message = 'Loading...') {
    if (LoadingIndicator.fullscreenInstance) {
      LoadingIndicator.fullscreenInstance.hide();
    }
    
    LoadingIndicator.fullscreenInstance = new LoadingIndicator('spinner', true);
    LoadingIndicator.fullscreenInstance.show(null, message);
    
    return LoadingIndicator.fullscreenInstance;
  }

  /**
   * Static method to hide fullscreen loading
   */
  static hideFullscreen() {
    if (LoadingIndicator.fullscreenInstance) {
      LoadingIndicator.fullscreenInstance.hide();
      LoadingIndicator.fullscreenInstance = null;
    }
  }

  /**
   * Show page loading (for main content areas)
   */
  showPageLoading(container, message = 'Loading...') {
    // Clear container first
    container.innerHTML = '';
    
    // Add a page-level loading wrapper
    const pageLoader = document.createElement('div');
    pageLoader.className = 'page-loading-wrapper';
    pageLoader.style.cssText = `
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    `;
    
    container.appendChild(pageLoader);
    this.show(pageLoader, message);
    
    return this;
  }

  /**
   * Static method for navigation loading (shows fullscreen during page transitions)
   */
  static showNavigation(message = 'Loading page...') {
    return LoadingIndicator.showFullscreen(message);
  }

  /**
   * Static method to hide navigation loading
   */
  static hideNavigation() {
    LoadingIndicator.hideFullscreen();
  }

  updateProgress(percent) {
    if (this.type === 'progressBar') {
      const fill = this.element.querySelector('.progress-fill');
      if (fill) {
        fill.style.width = `${percent}%`;
      }
    }
    return this;
  }
    hide() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Restore body scrolling if this was fullscreen
    if (this.fullscreen) {
      document.body.style.overflow = '';
    }
    
    return this;
  }
}

export default LoadingIndicator;
