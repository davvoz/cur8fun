import View from './View.js';

class NotFoundView extends View {
  async render() {
    // Clear existing content
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create container
    const container = document.createElement('div');
    container.classList.add('not-found-view');
    
    // Create heading
    const heading = document.createElement('h1');
    heading.textContent = '404 - Not Found';
    
    // Create paragraph
    const paragraph = document.createElement('p');
    paragraph.textContent = "The page you're looking for doesn't exist.";
    
    // Create link
    const link = document.createElement('a');
    link.textContent = 'Back to Home';
    link.href = '/';
    link.classList.add('back-home');
    
    // Append elements
    container.appendChild(heading);
    container.appendChild(paragraph);
    container.appendChild(link);
    
    this.element.appendChild(container);
  }
}

export default NotFoundView;
