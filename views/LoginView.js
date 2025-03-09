import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';

class LoginView {
  constructor(params = {}) {
    this.params = params;
    this.element = null; // Sarà impostato nel metodo render
  }
  
  render(container) {
    this.element = container;
    
    // Create elements using DOM methods
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    
    const loginContainer = document.createElement('div');
    loginContainer.className = 'login-container';
    
    const heading = document.createElement('h2');
    heading.textContent = 'Login to Steemgram';
    
    const form = document.createElement('form');
    form.id = 'login-form';
    
    // Username field
    const usernameGroup = document.createElement('div');
    usernameGroup.className = 'form-group';
    
    const usernameLabel = document.createElement('label');
    usernameLabel.setAttribute('for', 'username');
    usernameLabel.textContent = 'Username';
    
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.id = 'username';
    usernameInput.name = 'username';
    usernameInput.required = true;
    
    // Private key field
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    
    const passwordLabel = document.createElement('label');
    passwordLabel.setAttribute('for', 'password');
    passwordLabel.textContent = 'Private Posting Key';
    
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'password';
    passwordInput.name = 'password';
    passwordInput.required = true;
    
    // Add "remember me" checkbox
    const rememberGroup = document.createElement('div');
    rememberGroup.className = 'form-group checkbox-group';
    
    const rememberCheckbox = document.createElement('input');
    rememberCheckbox.type = 'checkbox';
    rememberCheckbox.id = 'remember';
    rememberCheckbox.name = 'remember';
    rememberCheckbox.checked = true;
    
    const rememberLabel = document.createElement('label');
    rememberLabel.setAttribute('for', 'remember');
    rememberLabel.textContent = 'Remember me';
    
    rememberGroup.appendChild(rememberCheckbox);
    rememberGroup.appendChild(rememberLabel);
    
    // Submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'btn-primary';
    submitButton.textContent = 'Login';
    
    // Message paragraph
    const messageEl = document.createElement('p');
    messageEl.className = 'login-message';
    
    // Build the DOM structure
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordInput);
    
    form.appendChild(usernameGroup);
    form.appendChild(passwordGroup);
    form.appendChild(rememberGroup);
    form.appendChild(submitButton);
    
    loginContainer.appendChild(heading);
    loginContainer.appendChild(form);
    loginContainer.appendChild(messageEl);
    
    contentWrapper.appendChild(loginContainer);
    
    // Clear and append to container
    this.element.innerHTML = '';
    this.element.appendChild(contentWrapper);
    
    // Add event listeners
    this.bindEvents();
  }
  
  bindEvents() {
    const loginForm = this.element.querySelector('#login-form');
    const messageEl = this.element.querySelector('.login-message');
    
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = loginForm.username.value.trim();
      const privateKey = loginForm.password.value.trim();
      const remember = loginForm.remember?.checked ?? true;
      
      if (!username || !privateKey) {
        messageEl.textContent = 'Please enter both username and private key';
        messageEl.classList.add('error');
        return;
      }
      
      try {
        // Use the AuthService for login
        await authService.login(username, privateKey, remember);
        
        // Notifica successo
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Welcome back, ${username}!`
        });
        
        // Reindirizza (se c'è un returnUrl nei params, usa quello, altrimenti vai alla home)
        if (this.params.returnUrl) {
          router.navigate(this.params.returnUrl);
        } else {
          router.navigate('/');
        }
      } catch (error) {
        messageEl.textContent = `Login failed: ${error.message || 'Invalid credentials'}`;
        messageEl.classList.add('error');
      }
    });
  }
  
  unmount() {
    // Pulizia degli event listeners se necessario
    const loginForm = this.element?.querySelector('#login-form');
    if (loginForm) {
      loginForm.removeEventListener('submit', this.handleSubmit);
    }
  }
}

export default LoginView;
