import Component from '../Component.js';
import authService from '../../services/AuthService.js';
import eventEmitter from '../../utils/EventEmitter.js';

/**
 * Modal component for switching between accounts
 */
export default class AccountSwitcherModal extends Component {
  constructor(parentElement = document.body, options = {}) {
    super(parentElement, options);
    this.modalOverlay = null;
    this.modalContent = null;
    this.currentUser = authService.getCurrentUser();
    this.accounts = authService.getStoredAccounts();
  }
  
  /**
   * Open the account switcher modal
   */
  open() {
    // Create and render the modal
    this.render();
    
    // Animate modal entrance
    setTimeout(() => {
      this.modalOverlay.style.opacity = '1';
      this.modalContent.style.transform = 'scale(1)';
    }, 10);
  }
  
  /**
   * Close the account switcher modal with animation
   */
  close() {
    if (!this.modalOverlay) return;
    
    this.modalOverlay.style.opacity = '0';
    this.modalContent.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      this.destroy();
    }, 300);
  }
  
  /**
   * Render the account switcher modal
   */
  render() {
    // Update current user and accounts to ensure we have latest data
    this.currentUser = authService.getCurrentUser();
    this.accounts = authService.getStoredAccounts();
    
    // Create modal container with improved styling
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'auth-modal-overlay';
    this.modalOverlay.style.position = 'fixed';
    this.modalOverlay.style.top = '0';
    this.modalOverlay.style.left = '0';
    this.modalOverlay.style.width = '100%';
    this.modalOverlay.style.height = '100%';
    this.modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    this.modalOverlay.style.display = 'flex';
    this.modalOverlay.style.alignItems = 'center';
    this.modalOverlay.style.justifyContent = 'center';
    this.modalOverlay.style.zIndex = '1000';
    this.modalOverlay.style.backdropFilter = 'blur(3px)';
    this.modalOverlay.style.transition = 'opacity 0.3s ease';
    this.modalOverlay.style.opacity = '0';
    
    // Create modal content with improved styling
    this.modalContent = document.createElement('div');
    this.modalContent.className = 'auth-modal-content account-switcher-modal';
    this.modalContent.style.backgroundColor = 'var(--background-lighter, #ffffff)';
    this.modalContent.style.borderRadius = '12px';
    this.modalContent.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
    this.modalContent.style.padding = '0';
    this.modalContent.style.width = '90%';
    this.modalContent.style.maxWidth = '400px';
    this.modalContent.style.maxHeight = '90vh';
    this.modalContent.style.overflow = 'hidden';
    this.modalContent.style.display = 'flex';
    this.modalContent.style.flexDirection = 'column';
    this.modalContent.style.transform = 'scale(0.95)';
    this.modalContent.style.transition = 'transform 0.3s ease';
    
    // Colored top border for visual appeal
    const topBorder = document.createElement('div');
    topBorder.style.height = '4px';
    topBorder.style.background = 'linear-gradient(to right, var(--primary-color, #ff7518), var(--secondary-color, #ff9259))';
    this.modalContent.appendChild(topBorder);
    
    // Create header with improved styling
    const headerContainer = document.createElement('div');
    headerContainer.style.padding = '16px 20px';
    headerContainer.style.borderBottom = '1px solid var(--border-color, #eee)';
    headerContainer.style.display = 'flex';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.justifyContent = 'space-between';
    
    const header = document.createElement('h3');
    header.className = 'auth-modal-header';
    header.textContent = 'Switch Account';
    header.style.margin = '0';
    header.style.fontSize = '1.2rem';
    header.style.fontWeight = '600';
    header.style.color = 'var(--text-color, #333)';
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close-btn';
    closeButton.innerHTML = '&times;';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '1.5rem';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'var(--text-secondary, #666)';
    closeButton.style.padding = '0 8px';
    closeButton.style.transition = 'color 0.2s ease';
    
    this.registerEventHandler(closeButton, 'mouseover', () => {
      closeButton.style.color = 'var(--primary-color, #ff7518)';
    });
    
    this.registerEventHandler(closeButton, 'mouseout', () => {
      closeButton.style.color = 'var(--text-secondary, #666)';
    });
    
    this.registerEventHandler(closeButton, 'click', () => {
      this.close();
    });
    
    headerContainer.appendChild(header);
    headerContainer.appendChild(closeButton);
    this.modalContent.appendChild(headerContainer);
    
    // Create accounts container with improved styling
    const accountsContainer = document.createElement('div');
    accountsContainer.className = 'account-list';
    accountsContainer.style.padding = '16px 20px';
    accountsContainer.style.maxHeight = 'calc(70vh - 120px)';
    accountsContainer.style.overflowY = 'auto';
    accountsContainer.style.scrollbarWidth = 'thin';
    accountsContainer.style.scrollbarColor = 'var(--primary-color, #ff7518) transparent';
    
    // Current account section (always visible)
    if (this.currentUser) {
      const currentAccountSection = document.createElement('div');
      currentAccountSection.style.marginBottom = '20px';
      
      const currentAccountLabel = document.createElement('div');
      currentAccountLabel.textContent = 'Current Account';
      currentAccountLabel.style.fontSize = '0.85rem';
      currentAccountLabel.style.color = 'var(--text-secondary, #666)';
      currentAccountLabel.style.marginBottom = '8px';
      
      const currentAccountItem = this.createAccountItem(this.currentUser, true);
      
      currentAccountSection.appendChild(currentAccountLabel);
      currentAccountSection.appendChild(currentAccountItem);
      accountsContainer.appendChild(currentAccountSection);
      
      // Add divider
      const divider = document.createElement('div');
      divider.style.height = '1px';
      divider.style.backgroundColor = 'var(--border-color, #eee)';
      divider.style.margin = '0 -20px 20px';
      accountsContainer.appendChild(divider);
    }
    
    // Filter other accounts (not current)
    const otherAccounts = this.accounts.filter(account => 
      !this.currentUser || account.username !== this.currentUser.username
    );
    
    // Other accounts section
    if (otherAccounts.length > 0) {
      const otherAccountsLabel = document.createElement('div');
      otherAccountsLabel.textContent = 'Available Accounts';
      otherAccountsLabel.style.fontSize = '0.85rem';
      otherAccountsLabel.style.color = 'var(--text-secondary, #666)';
      otherAccountsLabel.style.marginBottom = '8px';
      accountsContainer.appendChild(otherAccountsLabel);
      
      // For each stored account, create an account item
      otherAccounts.forEach(account => {
        const accountItem = this.createAccountItem(account);
        accountsContainer.appendChild(accountItem);
      });
    } else {
      const noAccountsMsg = document.createElement('div');
      noAccountsMsg.className = 'no-accounts-message';
      noAccountsMsg.textContent = 'No additional accounts available to switch to.';
      noAccountsMsg.style.padding = '20px 0';
      noAccountsMsg.style.textAlign = 'center';
      noAccountsMsg.style.color = 'var(--text-tertiary, #999)';
      noAccountsMsg.style.fontSize = '0.95rem';
      accountsContainer.appendChild(noAccountsMsg);
    }
    
    this.modalContent.appendChild(accountsContainer);
    
    // Add footer with actions
    const footer = document.createElement('div');
    footer.className = 'auth-modal-footer';
    footer.style.padding = '16px 20px';
    footer.style.borderTop = '1px solid var(--border-color, #eee)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.gap = '10px';
    
    // Add logout button if user is logged in
    if (this.currentUser) {
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'auth-btn auth-btn-outline';
      logoutBtn.textContent = 'Logout';
      logoutBtn.style.padding = '8px 16px';
      logoutBtn.style.borderRadius = '6px';
      logoutBtn.style.border = '1px solid var(--border-color, #ddd)';
      logoutBtn.style.backgroundColor = 'transparent';
      logoutBtn.style.color = 'var(--text-color, #333)';
      logoutBtn.style.cursor = 'pointer';
      logoutBtn.style.fontSize = '0.95rem';
      logoutBtn.style.transition = 'all 0.2s ease';
      
      this.registerEventHandler(logoutBtn, 'mouseover', () => {
        logoutBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        logoutBtn.style.borderColor = 'var(--border-color-dark, #ccc)';
      });
      
      this.registerEventHandler(logoutBtn, 'mouseout', () => {
        logoutBtn.style.backgroundColor = 'transparent';
        logoutBtn.style.borderColor = 'var(--border-color, #ddd)';
      });
      
      this.registerEventHandler(logoutBtn, 'click', () => {
        this.close();
        authService.logout();
        // Redirect to login
        window.location.href = '/app/login';
      });
      
      footer.appendChild(logoutBtn);
    }
    
    const rightButtons = document.createElement('div');
    rightButtons.style.display = 'flex';
    rightButtons.style.gap = '10px';
    rightButtons.style.marginLeft = 'auto';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'auth-btn auth-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.border = '1px solid var(--border-color, #ddd)';
    cancelBtn.style.backgroundColor = 'var(--background-light, #f5f5f5)';
    cancelBtn.style.color = 'var(--text-color, #333)';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '0.95rem';
    cancelBtn.style.transition = 'all 0.2s ease';
    
    this.registerEventHandler(cancelBtn, 'mouseover', () => {
      cancelBtn.style.backgroundColor = 'var(--background-lighter, #e8e8e8)';
    });
    
    this.registerEventHandler(cancelBtn, 'mouseout', () => {
      cancelBtn.style.backgroundColor = 'var(--background-light, #f5f5f5)';
    });
    
    this.registerEventHandler(cancelBtn, 'click', () => {
      this.close();
    });
    
    const addAccountBtn = document.createElement('button');
    addAccountBtn.className = 'auth-btn auth-btn-primary';
    addAccountBtn.textContent = 'Add Account';
    addAccountBtn.style.padding = '8px 16px';
    addAccountBtn.style.borderRadius = '6px';
    addAccountBtn.style.border = 'none';
    addAccountBtn.style.backgroundColor = 'var(--primary-color, #ff7518)';
    addAccountBtn.style.color = '#fff';
    addAccountBtn.style.cursor = 'pointer';
    addAccountBtn.style.fontSize = '0.95rem';
    addAccountBtn.style.transition = 'all 0.2s ease';
    
    this.registerEventHandler(addAccountBtn, 'mouseover', () => {
      addAccountBtn.style.backgroundColor = 'var(--primary-dark, #e66000)';
      addAccountBtn.style.boxShadow = '0 2px 8px rgba(255, 117, 24, 0.3)';
    });
    
    this.registerEventHandler(addAccountBtn, 'mouseout', () => {
      addAccountBtn.style.backgroundColor = 'var(--primary-color, #ff7518)';
      addAccountBtn.style.boxShadow = 'none';
    });
    
    this.registerEventHandler(addAccountBtn, 'click', () => {
      this.close();
      window.location.href = '/app/login';
    });
    
    rightButtons.appendChild(cancelBtn);
    rightButtons.appendChild(addAccountBtn);
    footer.appendChild(rightButtons);
    
    this.modalContent.appendChild(footer);
    
    // Add modal to the page
    this.modalOverlay.appendChild(this.modalContent);
    this.parentElement.appendChild(this.modalOverlay);
    
    // Add click event to close when clicking outside
    this.registerEventHandler(this.modalOverlay, 'click', (e) => {
      if (e.target === this.modalOverlay) {
        this.close();
      }
    });
    
    // Add keyboard listener for escape key
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    
    document.addEventListener('keydown', escListener);
    this.registerEventHandler(document, 'keydown', escListener);
  }
  
  /**
   * Creates an account item for the account switcher
   * @param {Object} account - Account data with username
   * @param {boolean} isCurrent - Whether this is the currently active account
   * @returns {HTMLElement} - The account item element
   */
  createAccountItem(account, isCurrent = false) {
    const accountItem = document.createElement('div');
    accountItem.className = 'account-item';
    accountItem.style.display = 'flex';
    accountItem.style.alignItems = 'center';
    accountItem.style.padding = '12px 15px';
    accountItem.style.backgroundColor = isCurrent ? 'var(--primary-color-lighter, rgba(255, 117, 24, 0.05))' : 'var(--background-light, #f5f5f5)';
    accountItem.style.border = `1px solid ${isCurrent ? 'var(--primary-color-light, rgba(255, 117, 24, 0.2))' : 'var(--border-color, #ddd)'}`;
    accountItem.style.borderRadius = '8px';
    accountItem.style.cursor = isCurrent ? 'default' : 'pointer';
    accountItem.style.marginBottom = '8px';
    accountItem.style.transition = 'all 0.3s ease';
    accountItem.style.position = 'relative';
    
    // Create avatar with improved styling
    const avatar = document.createElement('img');
    avatar.src = `https://steemitimages.com/u/${account.username}/avatar`;
    avatar.alt = account.username;
    avatar.className = 'account-avatar';
    avatar.style.width = '40px';
    avatar.style.height = '40px';
    avatar.style.borderRadius = '50%';
    avatar.style.marginRight = '12px';
    avatar.style.objectFit = 'cover';
    avatar.style.border = isCurrent ? '2px solid var(--primary-color, #ff7518)' : '2px solid transparent';
    avatar.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
    avatar.style.transition = 'transform 0.3s ease, border-color 0.3s ease';
    
    avatar.onerror = function() {
      this.src = './assets/img/default-avatar.png';
    };
    
    // User info container
    const userInfo = document.createElement('div');
    userInfo.className = 'account-info';
    userInfo.style.flex = '1';
    userInfo.style.overflow = 'hidden';
    userInfo.style.display = 'flex';
    userInfo.style.flexDirection = 'column';
    
    // Create username with improved styling
    const username = document.createElement('div');
    username.className = 'account-username';
    username.textContent = account.username;
    username.style.fontWeight = '600';
    username.style.fontSize = '1rem';
    username.style.color = isCurrent ? 'var(--primary-color, #ff7518)' : 'var(--text-color, #333)';
    username.style.marginBottom = '4px';
    username.style.whiteSpace = 'nowrap';
    username.style.overflow = 'hidden';
    username.style.textOverflow = 'ellipsis';
    username.style.transition = 'color 0.3s ease';
    
    // Login methods badges container
    const loginMethods = document.createElement('div');
    loginMethods.className = 'account-login-methods';
    loginMethods.style.display = 'flex';
    loginMethods.style.gap = '6px';
    loginMethods.style.flexWrap = 'wrap';
    
    // Create badges for different login methods
    if (account.hasKeychain) {
      const keychainBadge = this.createAuthMethodBadge('Keychain', '#ff7518', 'vpn_key');
      loginMethods.appendChild(keychainBadge);
    }
    
    if (account.hasPostingKey) {
      const postingBadge = this.createAuthMethodBadge('Key', '#1976d2', 'key');
      loginMethods.appendChild(postingBadge);
    }
    
    if (account.hasActiveKey) {
      const activeBadge = this.createAuthMethodBadge('Active', '#2e7d32', 'shield');
      loginMethods.appendChild(activeBadge);
    }
    
    if (account.hasSteemLogin) {
      const steemLoginBadge = this.createAuthMethodBadge('SteemLogin', '#9c27b0', 'login');
      loginMethods.appendChild(steemLoginBadge);
    }
    
    userInfo.appendChild(username);
    userInfo.appendChild(loginMethods);
    
    // Last login info if available
    if (account.timestamp) {
      const lastLogin = document.createElement('div');
      lastLogin.className = 'account-last-login';
      lastLogin.textContent = `Last login: ${this.formatTimeAgo(new Date(account.timestamp))}`;
      lastLogin.style.fontSize = '0.75rem';
      lastLogin.style.color = 'var(--text-tertiary, #999)';
      lastLogin.style.marginTop = '2px';
      
      userInfo.appendChild(lastLogin);
    }
    
    // Right side icon or indicator
    let rightElement;
    
    if (isCurrent) {
      // Current account indicator
      rightElement = document.createElement('div');
      rightElement.className = 'current-account-indicator';
      rightElement.style.padding = '4px 8px';
      rightElement.style.backgroundColor = 'var(--primary-color, #ff7518)';
      rightElement.style.color = 'white';
      rightElement.style.borderRadius = '4px';
      rightElement.style.fontSize = '0.7rem';
      rightElement.style.fontWeight = '600';
      rightElement.style.textTransform = 'uppercase';
      rightElement.style.marginLeft = '8px';
      rightElement.textContent = 'Current';
    } else {
      // Switch icon for other accounts
      rightElement = document.createElement('div');
      rightElement.className = 'switch-icon-container';
      rightElement.style.width = '28px';
      rightElement.style.height = '28px';
      rightElement.style.display = 'flex';
      rightElement.style.alignItems = 'center';
      rightElement.style.justifyContent = 'center';
      rightElement.style.borderRadius = '50%';
      rightElement.style.backgroundColor = 'var(--background-lighter, #ffffff)';
      rightElement.style.marginLeft = '8px';
      rightElement.style.transition = 'all 0.3s ease';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = 'swap_horiz';
      icon.style.fontSize = '16px';
      icon.style.color = 'var(--text-secondary, #666)';
      icon.style.transition = 'color 0.3s ease';
      
      rightElement.appendChild(icon);
    }
    
    // Assemble the item
    accountItem.appendChild(avatar);
    accountItem.appendChild(userInfo);
    accountItem.appendChild(rightElement);
    
    // Add hover effects only for non-current accounts
    if (!isCurrent) {
      this.registerEventHandler(accountItem, 'mouseover', () => {
        accountItem.style.backgroundColor = 'var(--background-lighter, #ffffff)';
        accountItem.style.transform = 'translateY(-2px)';
        accountItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        username.style.color = 'var(--primary-color, #ff7518)';
        avatar.style.transform = 'scale(1.05)';
        if (rightElement.className === 'switch-icon-container') {
          rightElement.style.backgroundColor = 'var(--primary-color, #ff7518)';
          rightElement.querySelector('.material-icons').style.color = 'white';
        }
      });
      
      this.registerEventHandler(accountItem, 'mouseout', () => {
        accountItem.style.backgroundColor = 'var(--background-light, #f5f5f5)';
        accountItem.style.transform = 'translateY(0)';
        accountItem.style.boxShadow = 'none';
        username.style.color = 'var(--text-color, #333)';
        avatar.style.transform = 'scale(1)';
        if (rightElement.className === 'switch-icon-container') {
          rightElement.style.backgroundColor = 'var(--background-lighter, #ffffff)';
          rightElement.querySelector('.material-icons').style.color = 'var(--text-secondary, #666)';
        }
      });
      
      // Add press effect
      this.registerEventHandler(accountItem, 'mousedown', () => {
        accountItem.style.transform = 'translateY(0)';
        accountItem.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
      });
      
      this.registerEventHandler(accountItem, 'mouseup', () => {
        accountItem.style.transform = 'translateY(-2px)';
      });
      
      // Add click event to switch to this account
      this.registerEventHandler(accountItem, 'click', () => {
        this.close();
        authService.switchToAccount(account);
      });
    }
    
    return accountItem;
  }
  
  /**
   * Creates a badge for authentication method
   * @param {string} text - Text to display in badge 
   * @param {string} color - Base color for badge
   * @param {string} iconName - Material icon name
   * @returns {HTMLElement} - Badge element
   */
  createAuthMethodBadge(text, color, iconName) {
    const badge = document.createElement('div');
    badge.className = 'auth-method-badge';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.backgroundColor = `${color}15`; // 15% opacity
    badge.style.color = color;
    badge.style.padding = '3px 6px';
    badge.style.borderRadius = '4px';
    badge.style.fontSize = '0.7rem';
    badge.style.fontWeight = '500';
    
    if (iconName) {
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = iconName;
      icon.style.fontSize = '10px';
      icon.style.marginRight = '3px';
      
      badge.appendChild(icon);
    }
    
    badge.appendChild(document.createTextNode(text));
    return badge;
  }
  
  /**
   * Format a date to show time ago
   * @param {Date} date - Date to format
   * @returns {string} - Formatted time ago string
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // diff in seconds
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    
    // Per date più vecchie, mostra la data formattata
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }
  
  /**
   * Clean up component resources
   * Overrides Component.destroy() to also remove the modal from DOM
   */
  destroy() {
    super.destroy();
    
    // Remove modal from DOM if it exists and hasn't been removed yet
    if (this.modalOverlay && this.modalOverlay.parentElement) {
      this.modalOverlay.parentElement.removeChild(this.modalOverlay);
    }
    
    this.modalOverlay = null;
    this.modalContent = null;
  }
}