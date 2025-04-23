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
    
    // Rileva se ci sono parametri speciali nell'URL
    this.useActiveKey = params.active === true;
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
    loginContainer.className = 'login-container card';

    contentWrapper.appendChild(loginContainer);

    loginContainer.appendChild(this.createHeading());

    // SteemLogin section (temporarily hidden)
    /* 
    // Sezione login con SteemLogin e HiveSigner
    const oauthSection = document.createElement('div');
    oauthSection.className = 'auth-section oauth-section';
    
    // Pulsante SteemLogin
    const steemLoginBtn = this.createButton(
        'Login with SteemLogin', 
        'button',
        'btn-secondary steemlogin-btn full-width'
    );
    steemLoginBtn.id = 'steemlogin-btn';
    
    // Icona SteemLogin
    const steemIcon = document.createElement('img');
    steemIcon.src = 'assets/icons/steem-logo.png'; // Assicurati di avere questa immagine
    steemIcon.alt = 'Steem';
    steemIcon.className = 'oauth-icon';
    steemLoginBtn.prepend(steemIcon);
    
    oauthSection.appendChild(steemLoginBtn);
    
    // Separatore
    oauthSection.appendChild(this.createDivider());
    
    // Aggiungi la sezione di login OAuth
    loginContainer.appendChild(oauthSection);
    */
    
    // Resto del codice esistente (Keychain e login con password)
    // Password form section
    const passwordSection = document.createElement('div');
    passwordSection.className = 'auth-section password-section';

    const form = document.createElement('form');
    form.id = 'login-form';

    // Move username field inside the form
    const usernameGroup = this.createFormGroup('username', 'Username', 'text');
    usernameGroup.className = 'form-group shared-username';
    form.appendChild(usernameGroup);

    // Keychain login section (if available)
    //controlliamo se siamo su mobile o se l'utente ha richiesto esplicitamente il login con Keychain
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile || this.useKeychain) {
        const keychainButton = this.createButton(
            'Login with SteemKeychain',
            'button',
            'btn-primary keychain-login-btn full-width'
        );
        keychainButton.id = 'keychain-login-btn';
        form.appendChild(keychainButton);
        form.appendChild(this.createDivider());
        //aggiungi l'evento che controlla se l'estensione è installata
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

    // Key type selection field
    const keyTypeGroup = document.createElement('div');
    keyTypeGroup.className = 'form-group key-type-group';
    
    const keyTypeLabel = document.createElement('label');
    keyTypeLabel.textContent = 'Key Type:';
    keyTypeGroup.appendChild(keyTypeLabel);
    
    const keyTypeSelection = document.createElement('div');
    keyTypeSelection.className = 'key-type-selection';
    
    const postingRadio = this.createRadioButton('keyType', 'posting', 'Posting Key', true);
    const activeRadio = this.createRadioButton('keyType', 'active', 'Active Key', false);
    
    keyTypeSelection.appendChild(postingRadio);
    keyTypeSelection.appendChild(activeRadio);
    keyTypeGroup.appendChild(keyTypeSelection);
    
    form.appendChild(keyTypeGroup);

    const passwordGroup = this.createFormGroup('password', this.useActiveKey ? 'Private Active Key' : 'Private Posting Key', 'password');
    form.appendChild(passwordGroup);
    form.appendChild(this.createRememberMeGroup());
    form.appendChild(this.createButton('Login', 'submit', 'btn-primary full-width'));

    // Aggiungi un link alla registrazione nella LoginView
    const registerLink = document.createElement('div');
    registerLink.className = 'auth-link';
    registerLink.innerHTML = 'Don\'t have an account? <a href="/register">Create one here</a>';
    form.appendChild(registerLink);
    
    // Add warning for active key
    const activeKeyWarning = document.createElement('div');
    activeKeyWarning.className = 'active-key-warning';
    activeKeyWarning.innerHTML = '<strong>Note:</strong> Use active key only when performing wallet operations. For regular browsing, posting key is safer.';
    activeKeyWarning.style.display = this.useActiveKey ? 'block' : 'none';
    activeKeyWarning.style.color = '#ff7700';
    activeKeyWarning.style.fontSize = '0.85em';
    activeKeyWarning.style.padding = '8px 0';
    activeKeyWarning.style.marginTop = '10px';
    form.appendChild(activeKeyWarning);
    
    // Add event listener for key type radio buttons
    form.addEventListener('change', (e) => {
      if (e.target.name === 'keyType') {
        const passwordLabel = passwordGroup.querySelector('label');
        if (e.target.value === 'active') {
          passwordLabel.textContent = 'Private Active Key';
          activeKeyWarning.style.display = 'block';
        } else {
          passwordLabel.textContent = 'Private Posting Key';
          activeKeyWarning.style.display = 'none';
        }
      }
    });

    passwordSection.appendChild(form);
    loginContainer.appendChild(passwordSection);

    // Error message section
    loginContainer.appendChild(this.createMessageElement());

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

  createHeading() {
    const headingContainer = document.createElement('div');
    headingContainer.className = 'login-header';

    const heading = document.createElement('h2');
    heading.textContent = 'Login to cur8.fun';
    headingContainer.appendChild(heading);

    return headingContainer;
  }
  
  createRadioButton(name, value, labelText, checked = false) {
    const container = document.createElement('div');
    container.className = 'radio-option';
    
    // Se il valore è 'active' e useActiveKey è true, impostiamo checked=true
    // Oppure se il valore è 'posting' e useActiveKey è false, impostiamo checked=true
    if ((value === 'active' && this.useActiveKey) || (value === 'posting' && !this.useActiveKey)) {
      checked = true;
    }
    
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = `${name}-${value}`;
    input.name = name;
    input.value = value;
    input.checked = checked;
    
    const label = document.createElement('label');
    label.htmlFor = `${name}-${value}`;
    label.textContent = labelText;
    
    // Migliore descrizione per ciascun tipo di chiave
    const description = document.createElement('span');
    description.className = 'key-type-description';
    
    if (value === 'posting') {
      description.textContent = 'For general browsing, posting and voting';
      description.style.color = '#449944'; // Verde per indicare opzione sicura
    } else if (value === 'active') {
      description.textContent = 'Required for wallet operations';
      description.style.color = '#ff7700'; // Arancione per indicare maggiore cautela
    }
    
    label.appendChild(document.createElement('br'));
    label.appendChild(description);
    
    container.appendChild(input);
    container.appendChild(label);
    
    return container;
  }

  createFormGroup(id, labelText, type, required = true) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.required = required;
    input.className = 'form-control';
    
    // For username field, enforce lowercase and add a tooltip
    if (id === 'username') {
      input.autocapitalize = 'none';
      input.autocomplete = 'username';
      input.placeholder = 'lowercase username';
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

    group.appendChild(label);
    group.appendChild(input);

    return group;
  }

  createLoginForm() {
    const form = document.createElement('form');
    form.id = 'login-form';

    form.appendChild(this.createFormGroup('username', 'Username', 'text'));
    form.appendChild(this.createFormGroup('password', 'Private Posting Key', 'password'));
    form.appendChild(this.createRememberMeGroup());
    form.appendChild(this.createButton('Login'));

    return form;
  }

  createRememberMeGroup() {
    const group = document.createElement('div');
    group.className = 'form-group checkbox-group';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'remember';
    checkbox.name = 'remember';
    checkbox.checked = true;

    const label = document.createElement('label');
    label.setAttribute('for', 'remember');
    label.textContent = 'Remember me';

    group.appendChild(checkbox);
    group.appendChild(label);
    return group;
  }

  createButton(text, type = 'submit', className = 'btn-primary') {
    const button = document.createElement('button');
    button.type = type;
    button.className = `btn ${className}`;
    button.textContent = text;
    return button;
  }

  createMessageElement() {
    const messageEl = document.createElement('p');
    messageEl.className = 'login-message';
    return messageEl;
  }

  createDivider() {
    const divider = document.createElement('div');
    divider.className = 'login-divider';
    divider.innerHTML = '<span>or login with private key</span>';
    return divider;
  }

  createKeychainElements() {
    const keychainGroup = document.createElement('div');
    keychainGroup.className = 'form-group keychain-group';

    const keychainButton = this.createButton(
      'Login with SteemKeychain',
      'button',
      'btn-primary keychain-login-btn'
    );
    keychainButton.id = 'keychain-login-btn';

    const keychainMsg = document.createElement('p');
    keychainMsg.id = 'keychain-status';
    keychainMsg.className = 'keychain-status';

    const divider = this.createDivider();

    if (authService.isKeychainInstalled()) {
      keychainGroup.appendChild(keychainButton);
    } else {
      keychainMsg.textContent = 'SteemKeychain extension not detected. Install it for easier login.';
      keychainMsg.style.color = 'orange';
      keychainButton.disabled = true;
      keychainGroup.appendChild(keychainButton);
      keychainGroup.appendChild(keychainMsg);
    }

    return { keychainGroup, divider };
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

    // Get selected key type
    const keyType = loginForm.querySelector('input[name="keyType"]:checked').value;

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
        this.showError(messageEl, `The private ${keyType} key you entered appears to be invalid. Please check and try again.`);
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
    
    // Get selected key type for Keychain - will use the most appropriate level
    const keyType = loginForm.querySelector('input[name="keyType"]:checked').value;

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
      
      // Make error more visible
      element.style.padding = '10px';
      element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      element.style.borderRadius = '4px';
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