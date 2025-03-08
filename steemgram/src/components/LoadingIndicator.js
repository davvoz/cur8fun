class LoadingIndicator {
  constructor(type = 'spinner') {
    this.type = type;
    this.element = this.createElement();
  }
  
  createElement() {
    const wrapper = document.createElement('div');
    
    if (this.type === 'spinner') {
      wrapper.className = 'loading-spinner';
      wrapper.innerHTML = `
        <div class="spinner"></div>
        <p class="loading-text">Loading...</p>
      `;
    } else if (this.type === 'skeleton') {
      wrapper.className = 'loading-skeleton';
      // Skeleton UI can be customized per component
    } else if (this.type === 'progressBar') {
      wrapper.className = 'loading-progress-bar';
      wrapper.innerHTML = `
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
      `;
    }
    
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
