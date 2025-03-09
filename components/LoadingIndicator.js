class LoadingIndicator {
  constructor(type = 'spinner') {
    this.type = type;
    this.element = this.createElement();
  }
  
  createElement() {
    const wrapper = document.createElement('div');
    
    const creators = {
      spinner: () => {
        wrapper.className = 'loading-spinner';
        
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'spinner';
        
        const loadingText = document.createElement('p');
        loadingText.className = 'loading-text';
        loadingText.textContent = 'Loading...';
        
        wrapper.appendChild(spinnerDiv);
        wrapper.appendChild(loadingText);
      },
      
      skeleton: () => {
        wrapper.className = 'loading-skeleton';
        // Skeleton UI can be customized per component
      },
      
      progressBar: () => {
        wrapper.className = 'loading-progress-bar';
        
        const progressTrack = document.createElement('div');
        progressTrack.className = 'progress-track';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        
        progressTrack.appendChild(progressFill);
        wrapper.appendChild(progressTrack);
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
    
    container.appendChild(this.element);
    return this;
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
    return this;
  }
}

export default LoadingIndicator;
