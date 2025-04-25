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

    // Create the faucet link element with proper styling
    const faucetLink = document.createElement('a');
    faucetLink.href = 'https://davvoz.github.io/steem-faucet-game/#/faucet';
    faucetLink.target = '_blank';
    faucetLink.rel = 'noopener noreferrer';
    faucetLink.className = 'menu-item faucet-link';

    // Create icon container for the faucet
    const faucetIconContainer = document.createElement('span');
    faucetIconContainer.className = 'icon';

    // Use FontAwesome faucet icon to match the desktop navigation
    const faIcon = document.createElement('i');
    faIcon.className = 'fas fa-faucet';
    faucetIconContainer.appendChild(faIcon);

    // Create text for the link in span to match other menu items
    const faucetText = document.createElement('span');
    faucetText.className = 'label';
    faucetText.textContent = 'Steem Faucet';

    // Assemble the faucet link
    faucetLink.appendChild(faucetIconContainer);
    faucetLink.appendChild(faucetText);

    // Add faucet link to the container
    menuContainer.appendChild(faucetLink);

    
    this.element.appendChild(menuContainer);
  }
}

export default MenuView;