import View from './View.js';

/**
 * Menu view displaying all available features and resources
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
    
    // Add Resources category
    const resourcesCategory = this.createCategory('Resources');
    menuContainer.appendChild(resourcesCategory);
    
    // Add resources menu items
    menuContainer.appendChild(this.createMenuItem(
      'faucet-link',
      'https://davvoz.github.io/steem-faucet-game/#/faucet',
      'fa-faucet',
      'Steem Faucet',
      'Get free STEEM to start your journey'
    ));
    
    menuContainer.appendChild(this.createMenuItem(
      'docs-link',
      'https://developers.steem.io/tutorials-javascript/getting_started',
      'fa-book',
      'Documentation',
      'Learn about Steem blockchain'
    ));
    
    // Add Tools category
    const toolsCategory = this.createCategory('Tools');
    menuContainer.appendChild(toolsCategory);
    
    // Add tools menu items
    menuContainer.appendChild(this.createMenuItem(
      'wallet-link',
      '/wallet',
      'fa-wallet',
      'Wallet',
      'Manage your funds and rewards'
    ));
    
    menuContainer.appendChild(this.createMenuItem(
      'explorer-link',
      'https://steemscan.com/',
      'fa-search',
      'Block Explorer',
      'Explore the Steem blockchain'
    ));
    
    menuContainer.appendChild(this.createMenuItem(
      'calculator-link',
      'https://steemnow.com/calculator.html',
      'fa-calculator',
      'Rewards Calculator',
      'Estimate your potential earnings'
    ));
    
    // Add Community category
    const communityCategory = this.createCategory('Community');
    menuContainer.appendChild(communityCategory);
    
    // Add community menu items
    menuContainer.appendChild(this.createMenuItem(
      'communities-link',
      '/communities',
      'fa-users',
      'Communities',
      'Explore Steem communities'
    ));
    
    menuContainer.appendChild(this.createMenuItem(
      'discord-link',
      'https://discord.gg/steem',
      'fa-discord',
      'Discord',
      'Join the Steem Discord server'
    ));
    
    // Append the menu container to the main element
    this.element.appendChild(menuContainer);
  }
  
  /**
   * Creates a category header for the menu
   * @param {string} title - The title of the category
   * @returns {HTMLElement} - The category element
   */
  createCategory(title) {
    const category = document.createElement('div');
    category.className = 'menu-category';
    
    const heading = document.createElement('h2');
    heading.textContent = title;
    
    category.appendChild(heading);
    return category;
  }
  
  /**
   * Creates a menu item
   * @param {string} className - Additional class for the menu item
   * @param {string} href - The URL the menu item links to
   * @param {string} iconClass - FontAwesome icon class
   * @param {string} text - The text of the menu item
   * @param {string} description - Optional description of the menu item
   * @returns {HTMLElement} - The menu item element
   */
  createMenuItem(className, href, iconClass, text, description) {
    // Create the menu item link
    const menuItem = document.createElement('a');
    menuItem.href = href;
    menuItem.className = `menu-item ${className || ''}`;
    
    // Set target="_blank" for external links
    if (href.startsWith('http')) {
      menuItem.target = '_blank';
      menuItem.rel = 'noopener noreferrer';
    }
    
    // Create icon container
    const iconContainer = document.createElement('span');
    iconContainer.className = 'icon';
    
    // Create and add the icon
    const icon = document.createElement('i');
    icon.className = `fas ${iconClass}`;
    iconContainer.appendChild(icon);
    
    // Create text content container
    const textContainer = document.createElement('div');
    textContainer.className = 'menu-item-content';
    
    // Create and add the label
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = text;
    textContainer.appendChild(label);
    
    // Add description if provided
    if (description) {
      const desc = document.createElement('span');
      desc.className = 'description';
      desc.textContent = description;
      textContainer.appendChild(desc);
    }
    
    // Assemble the menu item
    menuItem.appendChild(iconContainer);
    menuItem.appendChild(textContainer);
    
    return menuItem;
  }
}

export default MenuView;