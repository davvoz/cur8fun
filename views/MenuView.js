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

    // Create menu container with header
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-container';
    
    
    
    // Add Account Tools category
    const accountCategory = this.createCategory('Tools');
    menuContainer.appendChild(accountCategory);
    
    menuContainer.appendChild(this.createMenuItem(
      'faucet-link',
      'https://davvoz.github.io/steem-faucet-game/#/faucet',
      'fa-faucet',
      'Steem Faucet',
      'Get free STEEM to start your journey'
    ));
    
   
    
    // Add Community category with social links
    const socialCategory = this.createCategory('Connect With Us');
    menuContainer.appendChild(socialCategory);
    
    // Add social links in a grid layout
    const socialGrid = document.createElement('div');
    socialGrid.className = 'social-links-grid';
    
    socialGrid.appendChild(this.createSocialMenuItem(
      'discord-link',
      'https://discord.com/invite/hE7dB6wXb5',
      'fa-brands fa-discord',
      'Discord',
      'Join the Steem Discord server'
    ));
    
    socialGrid.appendChild(this.createSocialMenuItem(
      'twitter-link',
      'https://x.com/cur8_earn',
      'fa-brands fa-x-twitter',
      'X',
      'Follow us on X (formerly Twitter)'
    ));
    
    socialGrid.appendChild(this.createSocialMenuItem(
      'instagram-link',
      'https://www.instagram.com/stories/cur8_earn/',
      'fa-brands fa-instagram',
      'Instagram',
      'Check out our Instagram stories'
    ));
    
    socialGrid.appendChild(this.createSocialMenuItem(
      'telegram-link',
      'https://t.me/steemchat',
      'fa-brands fa-telegram',
      'Telegram'
    ));
    
    menuContainer.appendChild(socialGrid);
    // stats category - zona più accattivante
    const statsCategory = this.createCategory('Stats');
    statsCategory.classList.add('stats-category');

    // Wrapper per i bottoni stats in griglia
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-menu-grid';

    statsGrid.appendChild(this.createMenuItem(
      'cur8-stats-link',
      '/cur8-stats',
      'fa-chart-bar',
      'CUR8 Statistics',
      'View detailed statistics about CUR8'
    ));

    statsGrid.appendChild(this.createMenuItem(
      'cur8-bot-stats-link',
      '/cur8-bot-stats',
      'fa-robot',
      'Bot Statistics',
      'See how the CUR8 bot is performing'
    ));

    statsCategory.appendChild(statsGrid);
    menuContainer.appendChild(statsCategory);


    // Add Help & Support category
    const helpCategory = this.createCategory('Help & Support');
    menuContainer.appendChild(helpCategory);
    
    menuContainer.appendChild(this.createMenuItem(
      'faq-link',
      '/faq',
      'fa-question-circle',
      'FAQ',
      'Frequently asked questions'
    ));
    
    menuContainer.appendChild(this.createMenuItem(
      'contact-link',
      'mailto:support@cur8.fun',
      'fa-envelope',
      'Contact Support',
      'Get help with your account or issues'
    ));
    
    
    // Append the menu container to the main element
    this.element.appendChild(menuContainer);
  }
  
  /**
   * Creates a menu header with logo
   * @returns {HTMLElement} - The header element
   */
  createMenuHeader() {
    const header = document.createElement('div');
    header.className = 'menu-header';
    
    const logo = document.createElement('img');
    logo.src = '/assets/img/logo_tra.png';
    logo.alt = 'Cur8 Logo';
    logo.className = 'menu-logo';
    
    const title = document.createElement('h1');
    title.textContent = 'cur8.fun';
    title.className = 'menu-title';
    
    header.appendChild(logo);
    header.appendChild(title);
    
    return header;
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
    
    const divider = document.createElement('div');
    divider.className = 'category-divider';
    
    category.appendChild(heading);
    category.appendChild(divider);
    
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
    if (href.startsWith('http') || href.startsWith('mailto:')) {
      menuItem.target = '_blank';
      menuItem.rel = 'noopener noreferrer';
    }
    
    // Create icon container
    const iconContainer = document.createElement('span');
    iconContainer.className = 'icon';
    
    // Create and add the icon
    const icon = document.createElement('i');
    icon.className = `${iconClass.startsWith('fa-brands') ? '' : 'fas '}${iconClass}`;
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

  /**
   * Creates a social media menu item with a simpler layout
   * @param {string} className - Additional class for the menu item
   * @param {string} href - The URL the menu item links to
   * @param {string} iconClass - FontAwesome icon class
   * @param {string} text - The text of the menu item
   * @returns {HTMLElement} - The menu item element
   */
  createSocialMenuItem(className, href, iconClass, text) {
    const menuItem = document.createElement('a');
    menuItem.href = href;
    menuItem.className = `social-item ${className || ''}`;
    menuItem.target = '_blank';
    menuItem.rel = 'noopener noreferrer';
    
    const icon = document.createElement('i');
    icon.className = iconClass;
    icon.setAttribute('aria-hidden', 'true');
    
    const label = document.createElement('span');
    label.className = 'social-label';
    label.textContent = text;
    
    menuItem.appendChild(icon);
    menuItem.appendChild(label);
    
    return menuItem;
  }
}

export default MenuView;