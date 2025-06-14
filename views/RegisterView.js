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
      // Enhanced Telegram detection
    const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
    const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
    const telegramId = telegramData?.user?.id;
    const telegramUsername = telegramData?.user?.username;
    
    // Use multiple methods to detect Telegram
    const isInTelegram = isTelegramWebView || 
                        window.location.href.includes('tgWebApp=') || 
                        navigator.userAgent.toLowerCase().includes('telegram') ||
                        document.referrer.toLowerCase().includes('telegram');
                        
    // Log Telegram detection status for debugging
    console.log("Telegram detection in RegisterView:", {
      isTelegramWebView,
      isInTelegram,
      telegramId,
      telegramUsername,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
    
    const isLocalDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    
    if (telegramId) {
      // Show Telegram info with user data
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-info';
      telegramInfo.style.backgroundColor = '#e9f5ff';
      telegramInfo.style.padding = '10px 15px';
      telegramInfo.style.borderRadius = '5px';
      telegramInfo.style.marginBottom = '15px';
      telegramInfo.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Telegram User:</strong> @${telegramUsername || 'User'}</p>
        <p style="margin: 0;"><strong>Telegram ID:</strong> ${telegramId}</p>
      `;
      form.appendChild(telegramInfo);
    } else if (isInTelegram) {
      // In Telegram but no user data yet
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-info';
      telegramInfo.style.backgroundColor = '#fff9e6';
      telegramInfo.style.padding = '10px 15px';
      telegramInfo.style.borderRadius = '5px';
      telegramInfo.style.marginBottom = '15px';
      telegramInfo.innerHTML = `
        <p style="margin: 0;"><strong>Telegram detected!</strong> You can proceed with registration.</p>
      `;
      form.appendChild(telegramInfo);
    } else if (isLocalDev) {
      // Local development mode
      const devNote = document.createElement('div');
      devNote.className = 'dev-info';
      devNote.style.backgroundColor = '#e6fff9';
      devNote.style.padding = '10px 15px';
      devNote.style.borderRadius = '5px';
      devNote.style.marginBottom = '15px';
      devNote.innerHTML = `
        <p style="margin: 0;"><strong>Development Mode</strong> - Telegram authentication bypassed</p>
      `;
      form.appendChild(devNote);
    } else {
      // Not in Telegram at all
      const telegramWarning = document.createElement('div');
      telegramWarning.className = 'auth-warning';
      telegramWarning.style.backgroundColor = '#ffeeee';
      telegramWarning.style.padding = '10px 15px';
      telegramWarning.style.border = '1px solid #ff6b6b';
      telegramWarning.style.borderRadius = '5px';
      telegramWarning.style.marginBottom = '15px';
      telegramWarning.innerHTML = `
        <p style="margin: 0 0 10px;"><strong>Note:</strong> Account creation requires Telegram authentication.</p>
        <p style="margin: 0 0 10px;">Please open this app from Telegram to create a new Steem account.</p>
        <p style="margin: 0;"><a href="https://t.me/steemeebot" target="_blank" style="color: #0088cc; font-weight: bold;">Open in Telegram</a></p>
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
    form.appendChild(note);    // Create button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'auth-button';
    submitButton.textContent = 'Create Account';
    
    // Apply appropriate button state based on Telegram detection
    if (!isInTelegram && !isLocalDev) {
      // Not in Telegram and not in development mode - disable
      submitButton.disabled = true;
      submitButton.textContent = 'Telegram Required';
      submitButton.style.opacity = '0.6';
    } else if (isInTelegram && !telegramId) {
      // In Telegram but ID not available - can happen during initialization
      submitButton.dataset.telegramPending = 'true';
      submitButton.style.backgroundColor = '#ffb74d';
    } else if (isLocalDev) {
      // In development mode - allow with visual indication
      submitButton.style.backgroundColor = '#4caf50';
      submitButton.textContent = 'Create Account (Dev Mode)';
    }
    
    form.appendChild(submitButton);
      // Add login link
    const loginLink = document.createElement('div');
    loginLink.className = 'auth-link';
    loginLink.innerHTML = 'Already have an account? <a href="/login">Login here</a>';
    form.appendChild(loginLink);
    
    // Add check service button for development mode
    if (isLocalDev) {
      const serviceCheckDiv = document.createElement('div');
      serviceCheckDiv.style.marginTop = '20px';
      serviceCheckDiv.style.borderTop = '1px solid #ddd';
      serviceCheckDiv.style.paddingTop = '15px';
      
      const serviceCheckButton = document.createElement('button');
      serviceCheckButton.type = 'button';
      serviceCheckButton.textContent = 'Check API Service';
      serviceCheckButton.className = 'secondary-button';
      serviceCheckButton.style.backgroundColor = '#e0e0e0';
      serviceCheckButton.style.color = '#333';
      serviceCheckButton.style.border = 'none';
      serviceCheckButton.style.padding = '8px 16px';
      serviceCheckButton.style.borderRadius = '4px';
      serviceCheckButton.style.cursor = 'pointer';
      
      // Add result container
      const serviceCheckResult = document.createElement('div');
      serviceCheckResult.className = 'service-check-result';
      serviceCheckResult.style.marginTop = '10px';
      serviceCheckResult.style.fontSize = '14px';
      serviceCheckResult.style.padding = '10px';
      
      // Add event listener
      serviceCheckButton.addEventListener('click', async () => {
        try {
          serviceCheckButton.disabled = true;
          serviceCheckButton.textContent = 'Checking...';
          serviceCheckResult.innerHTML = 'Testing API connection...';
          serviceCheckResult.style.backgroundColor = '#f0f0f0';
          
          // Call the service check method
          const connectionTest = await registerService.testApiConnection();
          const serviceTest = await registerService.checkAccountCreationService();
          
          // Display results
          serviceCheckResult.innerHTML = `
            <h4 style="margin: 0 0 8px;">API Connection Test</h4>
            <p style="margin: 0 0 5px;">Status: <strong>${connectionTest.success ? 'Success' : 'Failed'}</strong></p>
            <p style="margin: 0 0 5px;">Message: ${connectionTest.message}</p>
            <p style="margin: 0 0 15px;">Endpoint: ${connectionTest.endpoint || 'N/A'}</p>
            
            <h4 style="margin: 10px 0 8px;">Account Creation Service</h4>
            <p style="margin: 0 0 5px;">Status: <strong>${serviceTest.success ? 'Available' : 'Unavailable'}</strong></p>
            <p style="margin: 0 0 5px;">Message: ${serviceTest.message}</p>
            <p style="margin: 0;">Endpoint: ${serviceTest.endpoint || 'N/A'}</p>
          `;
          
          // Set appropriate background color
          if (connectionTest.success && serviceTest.success) {
            serviceCheckResult.style.backgroundColor = '#e8f5e9';
            serviceCheckResult.style.border = '1px solid #a5d6a7';
          } else {
            serviceCheckResult.style.backgroundColor = '#ffebee';
            serviceCheckResult.style.border = '1px solid #ef9a9a';
          }
          
        } catch (error) {
          serviceCheckResult.innerHTML = `
            <p style="color: #d32f2f;"><strong>Error checking API service:</strong> ${error.message}</p>
          `;
          serviceCheckResult.style.backgroundColor = '#ffebee';
          serviceCheckResult.style.border = '1px solid #ef9a9a';
        } finally {
          serviceCheckButton.disabled = false;
          serviceCheckButton.textContent = 'Check API Service';
        }
      });
      
      serviceCheckDiv.appendChild(serviceCheckButton);
      serviceCheckDiv.appendChild(serviceCheckResult);
      form.appendChild(serviceCheckDiv);
    }
    
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
      // Enhanced Telegram detection
      const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
      const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
      const telegramId = telegramData?.user?.id;
      
      // Use multiple methods to detect Telegram
      const isInTelegram = isTelegramWebView || 
                          window.location.href.includes('tgWebApp=') || 
                          navigator.userAgent.toLowerCase().includes('telegram') ||
                          document.referrer.toLowerCase().includes('telegram');
      
      const isLocalDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
      
      // Only strict validation for production environment
      if (!isInTelegram && !isLocalDev) {
        throw new Error('Telegram authentication is required to create an account.');
      }
      
      // Log attempt details
      console.log(`Account creation attempt:
        - Username: ${username}
        - Telegram detection: ${isInTelegram ? 'Yes' : 'No'}
        - Telegram ID available: ${telegramId ? 'Yes' : 'No'}
        - Development mode: ${isLocalDev ? 'Yes' : 'No'}
      `);
      
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Account...';
      
      // Call register service with username only
      const result = await registerService.createAccount({
        username
      });
      
      // Success! Show notification with appropriate message
      let successMessage = 'Account created successfully!';
      
      if (result.telegramId) {
        successMessage += ' Check your Telegram for account details.';
      } else if (isInTelegram) {
        successMessage += ' Account details will be sent via Telegram.';
      } else if (isLocalDev) {
        successMessage += ' (Development Mode)';
      }
      
      eventEmitter.emit('notification', {
        type: 'success',
        message: successMessage
      });
      
      // Show success message in the form
      this.showSuccessMessage(form, username, isInTelegram);
      } catch (error) {
      console.error('Registration failed:', error);
      this.showError(form, error.message || 'Failed to create account');
      
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = 'Create Account';
    }
  }
  showSuccessMessage(form, username, isInTelegram = false) {
    // Hide the form
    form.style.display = 'none';
    
    // Create success container
    const successContainer = document.createElement('div');
    successContainer.className = 'auth-success';
    successContainer.style.backgroundColor = '#f0f7f0';
    successContainer.style.padding = '20px';
    successContainer.style.borderRadius = '8px';
    successContainer.style.border = '1px solid #d0e0d0';
    
    // Check if we're in development mode
    const isLocalDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    
    // Add success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    
    if (isInTelegram) {
      // In Telegram
      successMessage.innerHTML = `
        <h3 style="color: #2e7d32; margin-top: 0;">Account Created Successfully!</h3>
        <p>Your Steem account <strong>${username}</strong> has been created.</p>
        <p>Your account details and private keys have been sent to you via Telegram.</p>
        <p><strong>Important:</strong> Your private keys are the only way to access your account. They cannot be recovered if lost!</p>
      `;
    } else if (isLocalDev) {
      // Local development mode
      successMessage.innerHTML = `
        <h3 style="color: #2e7d32; margin-top: 0;">Account Created Successfully! (Development Mode)</h3>
        <p>Your Steem account <strong>${username}</strong> has been created.</p>
        <p>In production, account details and private keys would be sent via Telegram.</p>
        <p><strong>Important:</strong> For development purposes only. This account may not be accessible on the blockchain.</p>
      `;
    } else {
      // Generic message as fallback
      successMessage.innerHTML = `
        <h3 style="color: #2e7d32; margin-top: 0;">Account Created Successfully!</h3>
        <p>Your Steem account <strong>${username}</strong> has been created.</p>
        <p>Please check your Telegram for account details and private keys.</p>
        <p><strong>Important:</strong> Your private keys are the only way to access your account. They cannot be recovered if lost!</p>
      `;
    }
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