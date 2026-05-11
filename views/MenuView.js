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
    while (this.element.firstChild) this.element.removeChild(this.element.firstChild);

    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-container';

    // ── Tools — 2-col cards ───────────────────────────────────────────────
    menuContainer.appendChild(this.createCategory('Tools'));
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'menu-tools-grid';
    toolsGrid.appendChild(this.createToolCard('/cur8-bot-stats', 'favorite',  'Cur8 Statistics', 'Curation bot performance & metrics'));
    toolsGrid.appendChild(this.createToolCard('/cur8-stats',     'bar_chart', 'Analytics',       'Stats for #cur8 tagged posts'));
    toolsGrid.appendChild(this.createToolCard('https://games.cur8.fun/', 'sports_esports', 'Games', 'Play games and earn rewards', true));
    menuContainer.appendChild(toolsGrid);

    // ── Connect ───────────────────────────────────────────────────────────
    menuContainer.appendChild(this.createCategory('Connect With Us'));
    const socialGrid = document.createElement('div');
    socialGrid.className = 'social-links-grid';
    socialGrid.appendChild(this.createSocialMenuItem('discord-link',   'https://discord.com/invite/hE7dB6wXb5',        'fa-brands fa-discord',   'Discord'));
    socialGrid.appendChild(this.createSocialMenuItem('twitter-link',   'https://x.com/cur8_earn',                      'fa-brands fa-x-twitter', 'X'));
    socialGrid.appendChild(this.createSocialMenuItem('instagram-link', 'https://www.instagram.com/stories/cur8_earn/', 'fa-brands fa-instagram', 'Instagram'));
    socialGrid.appendChild(this.createSocialMenuItem('telegram-link',  'https://t.me/steemchat',                       'fa-brands fa-telegram',  'Telegram'));
    menuContainer.appendChild(socialGrid);

    // ── Help ──────────────────────────────────────────────────────────────
    menuContainer.appendChild(this.createCategory('Help & Support'));
    const helpGrid = document.createElement('div');
    helpGrid.className = 'menu-tools-grid';
    helpGrid.appendChild(this.createToolCard('/faq',                   'help_outline', 'FAQ',             'Frequently asked questions'));
    helpGrid.appendChild(this.createToolCard('mailto:support@cur8.fun','email',        'Contact Support', 'Get help with your account'));
    menuContainer.appendChild(helpGrid);

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
   * Creates a compact navigation tile for the 3-col grid
   */
  createNavTile(href, materialIcon, label) {
    const tile = document.createElement('a');
    tile.href = href;
    tile.className = 'menu-nav-tile';
    tile.innerHTML = `<span class="material-icons">${materialIcon}</span><span class="nav-tile-label">${label}</span>`;
    return tile;
  }

  /**
   * Creates a horizontal tool card (icon + title + description)
   */
  createToolCard(href, materialIcon, title, description, external = false) {
    const card = document.createElement('a');
    card.href = href;
    card.className = 'menu-tool-card';
    if (external) { card.target = '_blank'; card.rel = 'noopener noreferrer'; }
    card.innerHTML = `
      <span class="material-icons tool-card-icon">${materialIcon}</span>
      <span class="tool-card-body">
        <span class="tool-card-title">${title}</span>
        <span class="tool-card-desc">${description}</span>
      </span>
    `;
    return card;
  }

  /**
   * Creates a menu item (legacy — kept for compatibility)
   */
  createMenuItem(className, href, iconClass, text, description, samePage = false) {
    // Create the menu item link
    const menuItem = document.createElement('a');
    menuItem.href = href;
    menuItem.className = `menu-item ${className || ''}`;
    
    // Set target="_blank" for external links unless samePage is true
    if ((href.startsWith('http') || href.startsWith('mailto:')) && !samePage) {
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
    // 