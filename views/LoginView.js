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
      handleKeychainLogin: null
    };
  }

  /**
   * Renders the login view
   * @param {HTMLElement} container - Container element
   */
  // Update the render method
  render(container) {
    this.element = container;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    const loginContainer = document.createElement('div');
    loginContainer.className = 'login-container card';

    contentWrapper.appendChild(loginContainer);

    loginContainer.appendChild(this.createHeading());

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
    if (authService.isKeychainInstalled()) {
      const keychainButton = this.createButton(
        'Login with SteemKeychain',
        'button',
        'btn-primary keychain-login-btn full-width'
      );
      keychainButton.id = 'keychain-login-btn';
      form.appendChild(keychainButton);
      form.appendChild(this.createDivider());
    }

    const passwordGroup = this.createFormGroup('password', 'Private Posting Key', 'password');
    form.appendChild(passwordGroup);
    form.appendChild(this.createRememberMeGroup());
    form.appendChild(this.createButton('Login', 'submit', 'btn-primary full-width'));

    passwordSection.appendChild(form);
    loginContainer.appendChild(passwordSection);

    // Error message section
    loginContainer.appendChild(this.createMessageElement());

    // Clear and append to container
    this.element.innerHTML = '';
    this.element.appendChild(contentWrapper);

    this.bindEvents();
  }

  createHeading() {
    const headingContainer = document.createElement('div');
    headingContainer.className = 'login-header';

    const heading = document.createElement('h2');
    heading.textContent = 'Login to Steemgram';
    headingContainer.appendChild(heading);

    return headingContainer;
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

    this.boundHandlers.handleSubmit = this.handleSubmit.bind(this);
    this.boundHandlers.handleKeychainLogin = this.handleKeychainLogin.bind(this);

    if (loginForm) {
      loginForm.addEventListener('submit', this.boundHandlers.handleSubmit);
    }

    if (keychainButton) {
      keychainButton.addEventListener('click', this.boundHandlers.handleKeychainLogin);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const loginForm = e.target;
    const messageEl = this.element.querySelector('.login-message');

    const username = loginForm.username.value.trim();
    const privateKey = loginForm.password.value.trim();
    const remember = loginForm.remember?.checked ?? true;

    if (!username || !privateKey) {
      this.showError(messageEl, 'Please enter both username and private key');
      return;
    }

    try {
      await authService.login(username, privateKey, remember);
      this.handleLoginSuccess(username);
    } catch (error) {
      this.showError(messageEl, `Login failed: ${error.message || 'Invalid credentials'}`);
    }
  }

  async handleKeychainLogin() {
    const usernameInput = this.element.querySelector('#username');
    const loginForm = this.element.querySelector('#login-form');
    const messageEl = this.element.querySelector('.login-message');

    const username = usernameInput.value.trim();
    const remember = loginForm.remember?.checked ?? true;

    if (!username) {
      this.showError(messageEl, 'Please enter your username');
      return;
    }

    try {
      await authService.loginWithKeychain(username, remember);
      this.handleLoginSuccess(username);
    } catch (error) {
      this.showError(messageEl, `Login failed: ${error.message || 'Authentication failed'}`);
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
    }
  }

  unmount() {
    if (!this.element) return;

    const loginForm = this.element.querySelector('#login-form');
    const keychainButton = this.element.querySelector('#keychain-login-btn');

    if (loginForm && this.boundHandlers.handleSubmit) {
      loginForm.removeEventListener('submit', this.boundHandlers.handleSubmit);
    }

    if (keychainButton && this.boundHandlers.handleKeychainLogin) {
      keychainButton.removeEventListener('click', this.boundHandlers.handleKeychainLogin);
    }

    this.boundHandlers = { handleSubmit: null, handleKeychainLogin: null };
  }
}

export default LoginView;
