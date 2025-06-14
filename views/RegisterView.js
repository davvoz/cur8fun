import View from './View.js';
import router from '../utils/Router.js';
import registerService from '../services/RegisterService.js';
import eventEmitter from '../utils/EventEmitter.js';

class RegisterView extends View {
  constructor(params) {
    super(params);
    this.returnUrl = params.returnUrl || '/';
  }
  
  async render(element) {
    this.element = element;
    
    // Clear the element
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    
    // Create container
    const container = document.createElement('div');
    container.className = 'auth-container';
    
    // Create form
    const form = document.createElement('form');
    form.id = 'register-form';
    form.className = 'auth-form';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'auth-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Create a Steem Account';
    header.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.className = 'auth-subtitle';
    subtitle.textContent = 'Join the blockchain-based social network';
    header.appendChild(subtitle);
    
    form.appendChild(header);
      // Check if Telegram is available
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const telegramUsername = window.Telegram?.WebApp?.initDataUnsafe?.user?.username;
    
    if (telegramId) {
      // Show Telegram info
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-info';
      telegramInfo.innerHTML = `
        <p>Creating account with Telegram: <strong>@${telegramUsername || 'User'}</strong></p>
        <p>Telegram ID: ${telegramId}</p>
      `;
      form.appendChild(telegramInfo);
    } else {
      // Show warning that Telegram is required
      const telegramWarning = document.createElement('div');
      telegramWarning.className = 'auth-warning';
      telegramWarning.innerHTML = `
        <p><strong>Note:</strong> Account creation requires Telegram authentication.</p>
        <p>Please open this app from Telegram to create a new Steem account.</p>
        <p><a href="https://t.me/steemeebot" target="_blank">Open in Telegram</a></p>
      `;
      form.appendChild(telegramWarning);
    }
    
    // Create form fields - only username is required
    const usernameField = this.createFormField(
      'username', 
      'Username', 
      'person', 
      'text',
      'Choose a unique Steem username'
    );
    form.appendChild(usernameField);    // Add note about account creation
    const note = document.createElement('div');
    note.className = 'auth-note';
    note.innerHTML = `
      <p>Important: Creating a Steem account typically requires a small fee paid in STEEM cryptocurrency.</p>
      <p>Your account details and private keys will be provided via Telegram.</p>
      <p><strong>Please keep your keys in a safe place! They cannot be recovered if lost.</strong></p>
      
      <div class="account-creation-process">
        <h4>Account Creation Process:</h4>
        <ol>
          <li>Enter a unique username (3-16 characters)</li>
          <li>Authenticate with Telegram</li>
          <li>Our system will create your Steem blockchain account</li>
          <li>You'll receive your account keys via Telegram</li>
          <li>Use these keys to log in to your new account</li>
        </ol>
      </div>
    `;
    
    // Add some styles to the process list
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .account-creation-process {
        background-color: #f5f9ff;
        border-left: 4px solid #4285f4;
        padding: 10px 15px;
        margin-top: 15px;
        border-radius: 0 4px 4px 0;
      }
      .account-creation-process h4 {
        margin-top: 0;
        color: #4285f4;
      }
      .account-creation-process ol {
        margin-left: -10px;
      }
    `;
    document.head.appendChild(styleEl);
    form.appendChild(note);
      // Create button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'auth-button';
    submitButton.textContent = 'Create Account';
    
    // Disable button if no Telegram ID
    if (!telegramId) {
      submitButton.disabled = true;
      submitButton.textContent = 'Telegram Required';
    }
    
    form.appendChild(submitButton);
    
    // Add login link
    const loginLink = document.createElement('div');
    loginLink.className = 'auth-link';
    loginLink.innerHTML = 'Already have an account? <a href="/login">Login here</a>';
    form.appendChild(loginLink);
    
    // Add form to container
    container.appendChild(form);
    
    // Add container to element
    element.appendChild(container);
    
    // Add event listener for form submission
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
    return element;
  }
  
  createFormField(id, label, icon, type, placeholder) {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-field';
    
    const fieldLabel = document.createElement('label');
    fieldLabel.htmlFor = id;
    fieldLabel.textContent = label;
    fieldContainer.appendChild(fieldLabel);
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-with-icon';
    
    const iconElement = document.createElement('span');
    iconElement.className = 'material-icons';
    iconElement.textContent = icon;
    inputWrapper.appendChild(iconElement);
    
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.placeholder = placeholder;
    input.required = true;
      // Add lowercase restriction to username field
    if (id === 'username') {
      input.pattern = '[a-z0-9.-]+';
      input.title = 'Only lowercase letters, numbers, dots and dashes allowed';
      
      // Status indicator for username availability
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'username-status';
      statusIndicator.style.marginLeft = '8px';
      statusIndicator.style.fontSize = '14px';
      inputWrapper.appendChild(statusIndicator);
      
      // Debounce function to limit API calls
      let debounceTimer;
      
      input.addEventListener('input', async (e) => {
        e.target.value = e.target.value.toLowerCase();
        
        const username = e.target.value.trim();
        statusIndicator.textContent = '';
        
        // Clear any existing validation messages
        const existingValidation = fieldContainer.querySelector('.username-validation');
        if (existingValidation) {
          existingValidation.remove();
        }
        
        if (username.length < 3 || username.length > 16) {
          return;
        }
        
        clearTimeout(debounceTimer);
        
        // Set loading state
        statusIndicator.textContent = '⟳';
        statusIndicator.style.color = '#666';
        
        debounceTimer = setTimeout(async () => {
          try {
            // Import and use the RegisterService to check availability
            const registerService = (await import('../services/RegisterService.js')).default;
            const exists = await registerService.checkAccountExists(username);
            
            // Update status indicator
            if (exists) {
              statusIndicator.textContent = '✗'; 
              statusIndicator.style.color = '#ff0000';
              
              // Add validation message
              const validationMsg = document.createElement('div');
              validationMsg.className = 'username-validation';
              validationMsg.textContent = 'This username is already taken';
              validationMsg.style.color = '#ff0000';
              validationMsg.style.fontSize = '12px';
              validationMsg.style.marginTop = '4px';
              fieldContainer.appendChild(validationMsg);
            } else {
              statusIndicator.textContent = '✓';
              statusIndicator.style.color = '#00aa00';
            }
          } catch (error) {
            console.error('Error checking username:', error);
            statusIndicator.textContent = '?';
            statusIndicator.style.color = '#ff6b00';
          }
        }, 500);
      });
    }    // Add validation hints
    if (id === 'username') {
      const hintElement = document.createElement('div');
      hintElement.className = 'field-hint';
      hintElement.textContent = 'Username must be 3-16 characters, using only lowercase letters, numbers, dots and dashes.';
      hintElement.style.color = '#666';
      hintElement.style.fontSize = '12px';
      hintElement.style.marginTop = '4px';
      fieldContainer.appendChild(hintElement);
    }
    
    inputWrapper.appendChild(input);
    
    fieldContainer.appendChild(inputWrapper);
    
    return fieldContainer;
  }
    async handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const username = form.username.value;
    
    // Reset previous error messages
    const errorElement = form.querySelector('.auth-error');
    if (errorElement) {
      errorElement.remove();
    }
    
    try {
      // Ensure Telegram is available
      const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (!telegramId) {
        throw new Error('Telegram authentication is required to create an account.');
      }
      
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Account...';
      
      // Call register service with username only
      const result = await registerService.createAccount({
        username
      });
      
      // Success! Show notification
      eventEmitter.emit('notification', {
        type: 'success',
        message: 'Account created successfully!'
      });
      
      // Show success message in the form
      this.showSuccessMessage(form, username);
      } catch (error) {
      console.error('Registration failed:', error);
      this.showError(form, error.message || 'Failed to create account');
      
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = 'Create Account';
    }
  }
    showSuccessMessage(form, username) {
    // Hide the form
    form.style.display = 'none';
    
    // Create success container
    const successContainer = document.createElement('div');
    successContainer.className = 'auth-success';
    
    // Add success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.innerHTML = `
      <h3>Account Created Successfully!</h3>
      <p>Your Steem account <strong>${username}</strong> has been created.</p>
      <p>Your account details and private keys have been sent to you via Telegram.</p>
      <p><strong>Important:</strong> Your private keys are the only way to access your account. They cannot be recovered if lost!</p>
    `;
    successContainer.appendChild(successMessage);
    
    // Add buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'success-buttons';
    
    // Login button
    const loginButton = document.createElement('button');
    loginButton.className = 'auth-button';
    loginButton.textContent = 'Go to Login';
    loginButton.addEventListener('click', () => {
      router.navigate('/login');
    });
    buttonsContainer.appendChild(loginButton);
    
    // Create another account button
    const createAnotherButton = document.createElement('button');
    createAnotherButton.className = 'secondary-button';
    createAnotherButton.textContent = 'Create Another Account';
    createAnotherButton.addEventListener('click', () => {
      // Clear the container and re-render the form
      this.render(this.element);
    });
    buttonsContainer.appendChild(createAnotherButton);
    
    successContainer.appendChild(buttonsContainer);
    
    // Add to parent element
    this.element.querySelector('.auth-container').appendChild(successContainer);
  }
  
  showError(form, message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'auth-error';
    errorElement.textContent = message;
    
    // Insert after header
    const header = form.querySelector('.auth-header');
    form.insertBefore(errorElement, header.nextSibling);
  }
}

export default RegisterView;