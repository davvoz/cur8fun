// filepath: c:\Temp\steemee\views\MenuView.js
import View from './View.js';

/**
 * Menu view displaying Work in Progress message
 */
class MenuView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Menu | cur8.fun';
  }

  async render(element) {
    this.element = element;
    
    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create menu container
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-container';
    
    // Create the "Work in Progress" section
    const wipContainer = document.createElement('div');
    wipContainer.className = 'wip-container';
    
    // Add icon
    const icon = document.createElement('div');
    icon.className = 'wip-icon';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = 'construction';
    iconSpan.style.fontSize = '64px';
    iconSpan.style.color = '#f39c12';
    icon.appendChild(iconSpan);
    
    // Add title
    const title = document.createElement('h1');
    title.className = 'wip-title';
    title.textContent = 'Work in Progress';
    
    // Add message
    const message = document.createElement('p');
    message.className = 'wip-message';
    message.textContent = 'This feature is currently under development. Please check back later.';
    
    // Assemble the UI
    wipContainer.appendChild(icon);
    wipContainer.appendChild(title);
    wipContainer.appendChild(message);
    menuContainer.appendChild(wipContainer);
    
    // Add some CSS directly
    const style = document.createElement('style');
    style.textContent = `
      .menu-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 70vh;
        padding: 20px;
      }
      
      .wip-container {
        text-align: center;
        background: #f8f9fa;
        border-radius: 10px;
        padding: 40px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        max-width: 600px;
      }
      
      .wip-title {
        margin: 20px 0;
        font-size: 2.5rem;
        color: #333;
      }
      
      .wip-message {
        font-size: 1.2rem;
        color: #666;
        line-height: 1.6;
      }
    `;
    
    this.element.appendChild(style);
    this.element.appendChild(menuContainer);
  }
}

export default MenuView;