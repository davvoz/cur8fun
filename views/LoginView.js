import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';
/**
 * View for handling user login functionality
 */
class LoginView {
  /**
   * Creates a new LoginView instance
   * @param {Object} params - Parameters for the view
   */
  constructor(params = {}) {
    this.params = params;
    this.element = null;
    this.boundHandlers = {
      handleSubmit: null,
      handleKeychainLogin: null,
      handleSteemLogin: null
    };
    
    // Rimuove il parametro useActiveKey poiché non ci serve più
    this.useKeychain = params.keychain === true;
  }

  /**
   * Renders the login view
   * @param {HTMLElement} container - Container element
   */
  render(container) {
    this.element = container;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    const loginContainer = document.createElement('div');
    loginContainer.className = 'login-container';
    // Aggiungiamo stile per rendere più attraente il container
    loginContainer.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
    loginContainer.style.borderRadius = '12px';
    loginContainer.style.overflow = 'hidden';
    
    // Aggiungiamo un bordo colorato in alto
    const topBorder = document.createElement('div');
    topBorder.style.height = '4px';
    topBorder.style.background = 'linear-gradient(to right, var(--primary-color), var(--secondary-color))';
    loginContainer.appendChild(topBorder);

    contentWrapper.appendChild(loginContainer);

    // Heading con stile migliorato
    const heading = this.createHeading();
    heading.style.padding = '24px 20px 10px';
    heading.style.textAlign = 'center';
    heading.style.borderBottom = 'none';
    loginContainer.appendChild(heading);
    
    // Check for saved accounts
    const savedAccounts = authService.getStoredAccounts();
    const savedKeychainAccounts = savedAccounts.filter(account => account.hasKeychain);
    
    if (savedKeychainAccounts.length > 0) {
      const savedAccountsSection = this.createSavedAccountsSection(savedKeychainAccounts);
      savedAccountsSection.style.padding = '0 24px 20px';
      loginContainer.appendChild(savedAccountsSection);
      
      const divider = this.createDivider('or login with a new account');
      divider.style.margin = '10px 24px 20px';
      loginContainer.appendChild(divider);
    }

    // Password form section con stile migliorato
    const passwordSection = document.createElement('div');
    passwordSection.className = 'auth-section password-section';
    passwordSection.style.padding = '0 24px 24px';

    const form = document.createElement('form');
    form.id = 'login-form';
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '16px';

    // Username field con stile migliorato
    const usernameGroup = this.createFormGroup('username', 'Username', 'text');
    usernameGroup.className = 'form-group shared-username';
    form.appendChild(usernameGroup);

    // Password field (posting key only) con stile migliorato
    const passwordGroup = this.createFormGroup('password', 'Private Posting Key', 'password');
    form.appendChild(passwordGroup);
    
    // Remember me checkbox con stile migliorato
    const rememberGroup = this.createRememberMeGroup();
    rememberGroup.style.marginTop = '8px';
    form.appendChild(rememberGroup);
    
    // Login button con stile migliorato
    const loginButton = this.createButton('Login', 'submit', 'btn-primary full-width');
    loginButton.style.marginTop = '16px';
    loginButton.style.padding = '12px';
    loginButton.style.fontWeight = 'bold';
    loginButton.style.fontSize = '1rem';
    form.appendChild(loginButton);

    // Il pulsante Keychain viene ora aggiunto DOPO il pulsante login
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile || this.useKeychain) {
        // Divider prima del bottone Keychain
        const keychainDivider = this.createDivider('or');
        keychainDivider.style.margin = '20px 0';
        form.appendChild(keychainDivider);
        
        // Keychain button con stile migliorato
        const keychainButton = this.createButton(
            'Login with SteemKeychain',
            'button',
            'btn-secondary keychain-login-btn full-width'
        );
        keychainButton.id = 'keychain-login-btn';
        keychainButton.style.display = 'flex';
        keychainButton.style.alignItems = 'center';
        keychainButton.style.justifyContent = 'center';
        keychainButton.style.gap = '8px';
        keychainButton.style.padding = '12px';
        
        // Aggiungi icona al bottone Keychain
        const keychainIcon = document.createElement('img');
        keychainIcon.src = 'https://play-lh.googleusercontent.com/Yep_Oowoys6_hGqzWZZzY5nYNAB4pHdfQYK5Bp9bzQPbSg-dWAB2gPNQnyjnIXwNR7o=w240-h480-rw'; // URL del logo Keychain
        keychainIcon.alt = 'Keychain';
        keychainIcon.style.width = '20px';
        keychainIcon.style.height = '20px';
        keychainIcon.style.borderRadius = '50%';
        keychainButton.prepend(keychainIcon);
        
        form.appendChild(keychainButton);
        
        // Listener per verificare se Keychain è installato
        keychainButton.addEventListener('click', async () => {
            if (authService.isKeychainInstalled()) {
                keychainButton.disabled = false;
                keychainButton.classList.remove('disabled');
            } else {
                keychainButton.disabled = true;
                keychainButton.classList.add('disabled');
            }
        });
    }

    // Registrazione link con stile migliorato
    const registerLink = document.createElement('div');
    registerLink.className = 'auth-link';
    registerLink.innerHTML = 'Don\'t have an account? <a href="/register">Create one here</a>';
    registerLink.style.marginTop = '24px';
    registerLink.style.textAlign = 'center';
    registerLink.style.fontSize = '0.9rem';
    form.appendChild(registerLink);

    passwordSection.appendChild(form);
    loginContainer.appendChild(passwordSection);

    // Error message section
    const messageEl = this.createMessageElement();
    messageEl.style.margin = '20px 24px 0';
    loginContainer.appendChild(messageEl);

    // Clear and append to container
    this.element.innerHTML = '';
    this.element.appendChild(contentWrapper);

    this.bindEvents();
    
    // Focus sul campo username per una migliore esperienza utente
    setTimeout(() => {
      const usernameInput = this.element.querySelector('#username');
      if (usernameInput) usernameInput.focus();
    }, 100);
  }
  
  /**
   * Creates a section for saved accounts
   * @param {Array} accounts - Array of saved account objects
   * @returns {HTMLElement} - The saved accounts section
   */
  createSavedAccountsSection(accounts) {
    const section = document.createElement('div');
    section.className = 'auth-section saved-accounts-section';
    
    const heading = document.createElement('h3');
    heading.className = 'saved-accounts-heading';
    heading.textContent = 'Saved Accounts';
    heading.style.fontSize = '1.1rem';
    heading.style.marginBottom = '15px';
    heading.style.textAlign = 'center';
    heading.style.color = 'var(--text-heading, #333)';
    
    section.appendChild(heading);
    
    const accountsList = document.createElement('div');
    accountsList.className = 'saved-accounts-list';
    
    // Stile CSS inline per la lista degli account
    accountsList.style.display = 'flex';
    accountsList.style.flexDirection = 'column';
    accountsList.style.gap = '10px';
    accountsList.style.marginBottom = '10px';
    
    accounts.forEach(account => {
      const accountItem = this.createSavedAccountItem(account);
      accountsList.appendChild(accountItem);
    });
    
    section.appendChild(accountsList);
    return section;
  }
  
  /**
   * Creates an item for a saved account
   * @param {Object} account - The account object
   * @returns {HTMLElement} - The account item element
   */
  createSavedAccountItem(account) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'saved-account-item';
    item.dataset.username = account.username;
    
    // Stili CSS inline per l'elemento account
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.padding = '12px 15px';
    item.style.backgroundColor = 'var(--background-light, #f5f5f5)';
    item.style.border = '1px solid var(--border-color, #ddd)';
    item.style.borderRadius = '8px';
    item.style.cursor = 'pointer';
    item.style.width = '100%';
    item.style.transition = 'all 0.3s ease';
    
    // Avatar
    const avatar = document.createElement('img');
    avatar.src = account.avatar || './assets/img/default-avatar.png';
    avatar.alt = account.username;
    avatar.className = 'saved-account-avatar';
    avatar.style.width = '40px';
    avatar.style.height = '40px';
    avatar.style.borderRadius = '50%';
    avatar.style.marginRight = '12px';
    avatar.style.objectFit = 'cover';
    avatar.style.border = '2px solid var(--primary-color, #ff7518)';
    avatar.onerror = function() {
      this.src = './assets/img/default-avatar.png';
    };
    
    // Username and info
    const accountInfo = document.createElement('div');
    accountInfo.className = 'saved-account-info';
    accountInfo.style.flex = '1';
    
    const username = document.createElement('div');
    username.className = 'saved-account-username';
    username.textContent = account.username;
    username.style.fontWeight = 'bold';
    username.style.color = 'var(--text-color, #333)';
    
    // Login method display
    const loginMethod = document.createElement('div');
    loginMethod.className = 'saved-account-method';
    loginMethod.textContent = this.getLoginMethodText(account);
    loginMethod.style.fontSize = '0.8rem';
    loginMethod.style.color = 'var(--text-secondary, #666)';
    
    // Badge for Keychain
    if (account.hasKeychain) {
      const keychainBadge = document.createElement('span');
      keychainBadge.className = 'keychain-badge';
      keychainBadge.textContent = 'Keychain';
      keychainBadge.style.backgroundColor = 'var(--primary-color, #ff7518)';
      keychainBadge.style.color = '#fff';
      keychainBadge.style.padding = '2px 6px';
      keychainBadge.style.borderRadius = '4px';
      keychainBadge.style.fontSize = '0.7rem';
      keychainBadge.style.marginLeft = '5px';
      loginMethod.appendChild(keychainBadge);
    }
    
    accountInfo.appendChild(username);
    accountInfo.appendChild(loginMethod);
    
    // Icon for login
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'login';
    icon.style.marginLeft = 'auto';
    icon.style.color = 'var(--primary-color, #ff7518)';
    icon.style.opacity = '0.8';
    icon.style.fontSize = '20px';
    
    // Assemble the item
    item.appendChild(avatar);
    item.appendChild(accountInfo);
    item.appendChild(icon);
    
    // Add hover effects
    item.addEventListener('mouseover', () => {
      item.style.backgroundColor = 'var(--background-lighter, #eaeaea)';
      item.style.transform = 'translateY(-2px)';
      item.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
      icon.style.opacity = '1';
    });
    
    item.addEventListener('mouseout', () => {
      item.style.backgroundColor = 'var(--background-light, #f5f5f5)';
      item.style.transform = 'translateY(0)';
      item.style.boxShadow = 'none';
      icon.style.opacity = '0.8';
    });
    
    // Add click event to login
    item.addEventListener('click', () => this.handleSavedAccountLogin(account));
    
    return item;
  }
  
  /**
   * Get descriptive text for an account's login method
   * @param {Object} account - The account object
   * @returns {string} - Description of login method
   */
  getLoginMethodText(account) {
    const methods = [];
    
    if (account.hasKeychain) methods.push('Keychain');
    if (account.hasPostingKey) methods.push('Posting Key');
    if (account.hasSteemLogin) methods.push('SteemLogin');
    
    return methods.join(' • ');
  }
  
  /**
   * Handle click on a saved account item
   * @param {Object} account - The account object
   */
  async handleSavedAccountLogin(account) {
    try {
      if (account.hasKeychain) {
        if (!authService.isKeychainInstalled()) {
          eventEmitter.emit('notification', {
            type: 'error',
            message: 'Steem Keychain extension is not installed. Please install it to login with this account.'
          });
          return;
        }
        
        // Fill username field
        const usernameInput = this.element.querySelector('#username');
        if (usernameInput) {
          usernameInput.value = account.username;
        }
        
        await authService.loginWithKeychain(account.username, true);
        this.handleLoginSuccess(account.username);
      } else {
        // Non è un account Keychain, usa switchToAccount standard
        authService.switchToAccount(account);
      }
    } catch (error) {
      console.error('Failed to login with saved account:', error);
      const messageEl = this.element.querySelector('.login-message');
      this.showError(messageEl, `Login failed: ${error.message || 'Authentication failed'}`);
    }
  }

  createHeading() {
    const headingContainer = document.createElement('div');
    headingContainer.className = 'login-header';

    const heading = document.createElement('h2');
    heading.textContent = 'Login to cur8.fun';
    heading.style.fontSize = '1.8rem';
    heading.style.fontWeight = '600';
    heading.style.color = 'var(--text-heading, #222)';
    heading.style.margin = '0';
    
    const subheading = document.createElement('p');
    subheading.textContent = 'Welcome back to the community';
    subheading.style.fontSize = '1rem';
    subheading.style.margin = '8px 0 0';
    subheading.style.color = 'var(--text-secondary, #666)';
    
    headingContainer.appendChild(heading);
    headingContainer.appendChild(subheading);

    return headingContainer;
  }

  createFormGroup(id, labelText, type, required = true) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.style.marginBottom = '8px';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    label.style.display = 'block';
    label.style.marginBottom = '6px';
    label.style.fontWeight = '500';
    label.style.fontSize = '0.95rem';

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.required = required;
    input.className = 'form-control';
    input.style.width = '100%';
    input.style.padding = '12px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid var(--border-color, #ddd)';
    input.style.fontSize = '1rem';
    input.style.backgroundColor = 'var(--background-light, #f9f9f9)';
    input.style.transition = 'border-color 0.3s, box-shadow 0.3s';
    
    // Add focus style for better UX
    input.addEventListener('focus', () => {
      input.style.outline = 'none';
      input.style.borderColor = 'var(--primary-color, #ff7518)';
      input.style.boxShadow = '0 0 0 2px rgba(255, 117, 24, 0.2)';
    });
    
    input.addEventListener('blur', () => {
      input.style.boxShadow = 'none';
      if (!input.value) {
        input.style.borderColor = 'var(--border-color, #ddd)';
      }
    });
    
    // For username field, enforce lowercase and add a tooltip
    if (id === 'username') {
      input.autocapitalize = 'none';
      input.autocomplete = 'username';
      input.placeholder = 'Your Steem username';
      input.title = 'Steem usernames are lowercase only';
      
      // Add an input event listener to convert any uppercase to lowercase
      input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toLowerCase();
        // Restore cursor position
        e.target.setSelectionRange(start, end);
      });
    }
    
    // For password field, add a password-specific placeholder
    if (type === 'password') {
      input.placeholder = 'Enter your private posting key';
    }

    group.appendChild(label);
    group.appendChild(input);

    return group;
  }

  createRememberMeGroup() {
    const group = document.createElement('div');
    group.className = 'form-group checkbox-group';
    group.style.display = 'flex';
    group.style.alignItems = 'center';
    group.style.gap = '8px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'remember';
    checkbox.name = 'remember';
    checkbox.checked = true;
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
    checkbox.style.accentColor = 'var(--primary-color, #ff7518)';

    const label = document.createElement('label');
    label.setAttribute('for', 'remember');
    label.textContent = 'Remember me';
    label.style.fontSize = '0.95rem';
    label.style.cursor = 'pointer';

    group.appendChild(checkbox);
    group.appendChild(label);
    return group;
  }

  createButton(text, type = 'submit', className = 'btn-primary') {
    const button = document.createElement('button');
    button.type = type;
    button.className = `btn ${className}`;
    button.textContent = text;
    button.style.padding = '10px 16px';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';
    button.style.border = 'none';
    button.style.transition = 'all 0.3s ease';
    
    if (className.includes('btn-primary')) {
      button.style.backgroundColor = 'var(--primary-color, #ff7518)';
      button.style.color = '#fff';
    } else if (className.includes('btn-secondary')) {
      button.style.backgroundColor = '#f0f0f0';
      button.style.color = '#333';
      button.style.border = '1px solid #ddd';
    }
    
    button.addEventListener('mouseover', () => {
      if (className.includes('btn-primary')) {
        button.style.backgroundColor = 'var(--primary-dark, #e66000)';
        button.style.boxShadow = '0 4px 8px rgba(255, 117, 24, 0.3)';
      } else if (className.includes('btn-secondary')) {
        button.style.backgroundColor = '#e8e8e8';
        button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      }
    });
    
    button.addEventListener('mouseout', () => {
      if (className.includes('btn-primary')) {
        button.style.backgroundColor = 'var(--primary-color, #ff7518)';
      } else if (className.includes('btn-secondary')) {
        button.style.backgroundColor = '#f0f0f0';
      }
      button.style.boxShadow = 'none';
    });
    
    return button;
  }

  createMessageElement() {
    const messageEl = document.createElement('p');
    messageEl.className = 'login-message';
    messageEl.style.display = 'none';
    messageEl.style.margin = '16px 0 0';
    messageEl.style.fontSize = '0.9rem';
    return messageEl;
  }

  createDivider(text = 'or login with private key') {
    const divider = document.createElement('div');
    divider.className = 'login-divider';
    divider.style.display = 'flex';
    divider.style.alignItems = 'center';
    divider.style.textAlign = 'center';
    divider.style.color = 'var(--text-secondary, #666)';
    divider.style.fontSize = '0.9rem';
    divider.style.margin = '20px 0';
    
    // Divider line before text
    const lineLeft = document.createElement('div');
    lineLeft.style.flex = '1';
    lineLeft.style.height = '1px';
    lineLeft.style.backgroundColor = 'var(--border-color, #ddd)';
    lineLeft.style.marginRight = '15px';
    
    // Text in the middle
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    
    // Divider line after text
    const lineRight = document.createElement('div');
    lineRight.style.flex = '1';
    lineRight.style.height = '1px';
    lineRight.style.backgroundColor = 'var(--border-color, #ddd)';
    lineRight.style.marginLeft = '15px';
    
    divider.appendChild(lineLeft);
    divider.appendChild(textSpan);
    divider.appendChild(lineRight);
    
    return divider;
  }

  bindEvents() {
    const loginForm = this.element.querySelector('#login-form');
    const keychainButton = this.element.querySelector('#keychain-login-btn');
    const steemLoginButton = this.element.querySelector('#steemlogin-btn');

    this.boundHandlers.handleSubmit = this.handleSubmit.bind(this);
    this.boundHandlers.handleKeychainLogin = this.handleKeychainLogin.bind(this);
    this.boundHandlers.handleSteemLogin = this.handleSteemLogin.bind(this);

    if (loginForm) {
      loginForm.addEventListener('submit', this.boundHandlers.handleSubmit);
    }

    if (keychainButton) {
      keychainButton.addEventListener('click', this.boundHandlers.handleKeychainLogin);
    }
    
    if (steemLoginButton) {
      steemLoginButton.addEventListener('click', this.boundHandlers.handleSteemLogin);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const loginForm = e.target;
    const messageEl = this.element.querySelector('.login-message');
    const passwordInput = loginForm.password;

    const username = loginForm.username.value.trim();
    const privateKey = passwordInput.value.trim();
    const remember = loginForm.remember?.checked ?? true;

    // Utilizziamo sempre posting key per il login tramite form
    const keyType = 'posting';

    if (!username || !privateKey) {
      this.showError(messageEl, 'Please enter both username and private key');
      return;
    }

    try {
      // First clear any previous error styling
      this.clearErrorStyles();
      
      await authService.login(username, privateKey, remember, keyType);
      this.handleLoginSuccess(username);
    } catch (error) {
      console.error('Login error:', error);
      
      // Add error styling to the password field for key-related errors
      if (error.message.includes('Invalid key')) {
        passwordInput.classList.add('input-error');
        this.showError(messageEl, `The private posting key you entered appears to be invalid. Please check and try again.`);
      } else if (error.message.includes('Account not found')) {
        loginForm.username.classList.add('input-error');
        this.showError(messageEl, `Account "${username}" was not found. Please check your username.`);
      } else {
        this.showError(messageEl, `Login failed: ${error.message || 'Invalid credentials'}`);
      }

      // Show a hint for common key errors
      if (error.message.includes('Invalid key format')) {
        const hintEl = document.createElement('div');
        hintEl.className = 'login-hint';
        hintEl.innerHTML = 'Hint: Steem keys are typically 51 characters long and start with "5" or "P".';
        
        // Insert after the message element
        if (messageEl.nextSibling) {
          messageEl.parentNode.insertBefore(hintEl, messageEl.nextSibling);
        } else {
          messageEl.parentNode.appendChild(hintEl);
        }
      }
    }
  }

  async handleKeychainLogin() {
    const usernameInput = this.element.querySelector('#username');
    const loginForm = this.element.querySelector('#login-form');
    const messageEl = this.element.querySelector('.login-message');

    const username = usernameInput.value.trim();
    const remember = loginForm.remember?.checked ?? true;
    
    // Utilizziamo sempre posting key per il login con Keychain
    const keyType = 'posting';

    if (!username) {
      usernameInput.classList.add('input-error');
      this.showError(messageEl, 'Please enter your username');
      return;
    }

    this.clearErrorStyles();
    
    try {
      await authService.loginWithKeychain(username, remember, keyType);
      this.handleLoginSuccess(username);
    } catch (error) {
      if (error.message.includes('Account not found')) {
        usernameInput.classList.add('input-error');
        this.showError(messageEl, `Account "${username}" was not found. Please check your username.`);
      } else {
        this.showError(messageEl, `Login failed: ${error.message || 'Authentication failed'}`);
      }
    }
  }

  async handleSteemLogin() {
    try {
      await authService.loginWithSteemLogin();
      // Non c'è bisogno di gestire il redirect qui, poiché loginWithSteemLogin reindirizza l'utente
    } catch (error) {
      const messageEl = this.element.querySelector('.login-message');
      this.showError(messageEl, `SteemLogin failed: ${error.message}`);
    }
  }

  handleLoginSuccess(username) {
    eventEmitter.emit('notification', {
      type: 'success',
      message: `Welcome back, ${username}!`
    });

    router.navigate(this.params.returnUrl || '/');
  }

  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.classList.add('error');
      element.style.display = 'block';
      
      // Make error more visible
      element.style.padding = '12px';
      element.style.backgroundColor = 'rgba(255, 0, 0, 0.08)';
      element.style.color = '#d32f2f';
      element.style.borderRadius = '8px';
      element.style.borderLeft = '4px solid #d32f2f';
    }
  }

  clearErrorStyles() {
    const inputs = this.element.querySelectorAll('input');
    inputs.forEach(input => input.classList.remove('input-error'));
    
    // Remove any previous hints
    const hints = this.element.querySelectorAll('.login-hint');
    hints.forEach(hint => hint.remove());
  }

  unmount() {
    if (!this.element) return;

    const loginForm = this.element.querySelector('#login-form');
    const keychainButton = this.element.querySelector('#keychain-login-btn');
    const steemLoginButton = this.element.querySelector('#steemlogin-btn');

    if (loginForm && this.boundHandlers.handleSubmit) {
      loginForm.removeEventListener('submit', this.boundHandlers.handleSubmit);
    }

    if (keychainButton && this.boundHandlers.handleKeychainLogin) {
      keychainButton.removeEventListener('click', this.boundHandlers.handleKeychainLogin);
    }
    
    if (steemLoginButton && this.boundHandlers.handleSteemLogin) {
      steemLoginButton.removeEventListener('click', this.boundHandlers.handleSteemLogin);
    }

    this.boundHandlers = { handleSubmit: null, handleKeychainLogin: null, handleSteemLogin: null };
  }
}

export default LoginView;