export default class Breadcrumbs {
  constructor() {
    this.paths = [];
  }
  
  updatePath(currentPath, title) {
    // Parse the current path and update breadcrumb state
    const segments = currentPath.split('/').filter(Boolean);
    this.paths = segments.map((segment, index) => {
      const path = '/' + segments.slice(0, index + 1).join('/');
      return { 
        segment: segment.startsWith('@') ? segment : this.prettify(segment),
        path,
        isLast: index === segments.length - 1
      };
    });
    
    // Add home at the beginning
    this.paths.unshift({ segment: 'Home', path: '/', isLast: this.paths.length === 0 });
    
    if (title) {
      this.paths[this.paths.length - 1].segment = title;
    }
    
    return this;
  }
  
  prettify(text) {
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/-/g, ' ');
  }
  
  render(container) {
    const breadcrumbEl = document.createElement('div');
    breadcrumbEl.className = 'breadcrumbs';
    
    this.paths.forEach((item, index) => {
      const itemEl = document.createElement('span');
      
      if (!item.isLast) {
        const link = document.createElement('a');
        link.href = item.path;
        link.textContent = item.segment;
        itemEl.appendChild(link);
        
        // Add separator
        if (index < this.paths.length - 1) {
          const separator = document.createElement('span');
          separator.className = 'breadcrumb-separator';
          separator.innerHTML = ' &gt; ';
          itemEl.appendChild(separator);
        }
      } else {
        itemEl.textContent = item.segment;
        itemEl.className = 'current-breadcrumb';
      }
      
      breadcrumbEl.appendChild(itemEl);
    });
    
    container.innerHTML = '';
    container.appendChild(breadcrumbEl);
  }
}
