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
    
    // Add spinner style for button loading state
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .button-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }
      .account-creation-status {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .progress-pulse {
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(spinnerStyle);
    // Enhanced Telegram detection with stricter validation
    const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
    const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
    const telegramId = telegramData?.user?.id;
    const telegramUsername = telegramData?.user?.username;
    
    // Check for real Telegram app integration - MUST have actual user data
    const hasTelegramAuth = !!telegramId && !!telegramUsername;
    
    // Other indicators (less reliable)
    const secondaryTelegramIndicators = 
        window.location.href.includes('tgWebApp=') || 
        navigator.userAgent.toLowerCase().includes('telegram') ||
        document.referrer.toLowerCase().includes('telegram');
    
    // Combined detection with proper hierarchy:
    // 1. Authenticated Telegram session (highest confidence) - REQUIRES user data
    // 2. WebApp API presence but no auth (medium confidence)
    // 3. Secondary indicators (lowest confidence)
    const telegramConfidence = hasTelegramAuth ? 'high' : 
                              isTelegramWebView ? 'medium' : 
                              secondaryTelegramIndicators ? 'low' : 'none';
                              
    // Only consider truly IN Telegram if we have user data or WebApp integration
    const isInTelegram = hasTelegramAuth || isTelegramWebView;
    const hasFullTelegramAuth = hasTelegramAuth;
    
    // Determine appropriate messaging based on confidence level
    let telegramStatus = 'not-detected';
    if (hasFullTelegramAuth) {
        telegramStatus = 'authenticated';
    } else if (telegramConfidence === 'medium') {
        telegramStatus = 'detected-no-auth';
    } else if (telegramConfidence === 'low') {
        telegramStatus = 'possible';
    }
                          // Log enhanced Telegram detection status for debugging
    console.log("Enhanced Telegram detection in RegisterView:", {
      isTelegramWebView,
      telegramConfidence,
      telegramStatus,
      isInTelegram,
      hasFullTelegramAuth,
      telegramId: telegramId || 'undefined',
      telegramUsername: telegramUsername || 'undefined',
      hasTelegramAuth,
      secondaryTelegramIndicators,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
    
    const isLocalDev = window.location.hostname.includes('localhost') || 
                      window.location.hostname.includes('127.0.0.1') ||
                      window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;
      if (telegramId && telegramUsername) {
      // Show Telegram info with verified user data
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-auth-high';
      telegramInfo.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Telegram User:</strong> @${telegramUsername}</p>
        <p style="margin: 0;"><strong>Telegram ID:</strong> ${telegramId}</p>
      `;
      form.appendChild(telegramInfo);
    } else if (telegramConfidence === 'medium') {
      // Telegram API detected but no user data
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-auth-medium';
      telegramInfo.innerHTML = `
        <p style="margin: 0;"><strong>Telegram API detected but not authenticated</strong></p>
        <p style="margin: 5px 0 0;">Please ensure you open this app directly from the Telegram app.</p>
        <p style="margin: 5px 0 0;">If you're already in Telegram, try refreshing the page or reinstalling the bot.</p>
      `;
      form.appendChild(telegramInfo);
    } else if (telegramConfidence === 'low') {
      // Possibly Telegram but uncertain
      const possibleTelegramInfo = document.createElement('div');
      possibleTelegramInfo.className = 'telegram-auth-low';
      possibleTelegramInfo.innerHTML = `
        <p style="margin: 0;"><strong>Possible Telegram detected but not verified</strong></p>
        <p style="margin: 5px 0 0;">Please make sure you're opening this from the official Telegram app.</p>
        <p style="margin: 5px 0 0;">For proper account creation, use the official <a href="https://t.me/steemeebot" style="color: var(--primary-color);">Steemee Telegram Bot</a>.</p>
      `;
      form.appendChild(possibleTelegramInfo);
    } else if (isLocalDev) {
      // Local development mode
      const devNote = document.createElement('div');
      devNote.className = 'dev-info';
      devNote.innerHTML = `
        <p style="margin: 0;"><strong>Development Mode</strong> - Telegram authentication bypassed</p>
        <p style="margin: 5px 0 0;">Testing on: ${window.location.hostname}</p>
      `;
      form.appendChild(devNote);
    } else {
      // Not in Telegram at all
      const telegramWarning = document.createElement('div');
      telegramWarning.className = 'telegram-auth-none';
      telegramWarning.innerHTML = `
        <p style="margin: 0 0 10px;"><strong>Note:</strong> Account creation requires Telegram authentication.</p>
        <p style="margin: 0 0 10px;">Please open this app from Telegram to create a new Steem account.</p>
        <p style="margin: 0;"><a href="https://t.me/steemeebot" target="_blank" style="color: var(--primary-color); font-weight: bold;">Open in Telegram</a></p>
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
    submitButton.innerHTML = 'Create Account';
    
    // Add spinner container (hidden by default)
    const spinnerContainer = document.createElement('span');
    spinnerContainer.className = 'button-spinner';
    spinnerContainer.style.display = 'none';
    submitButton.prepend(spinnerContainer);
    
    // Add button click feedback
    submitButton.addEventListener('click', () => {
      if (!submitButton.disabled) {
        // Show immediate feedback that the button was clicked
        spinnerContainer.style.display = 'inline-block';
        submitButton.classList.add('button-clicked');
        
        // Reset after a short delay if the form is invalid
        setTimeout(() => {
          if (!document.querySelector('.account-creation-status')) {
            spinnerContainer.style.display = 'none';
          }
        }, 2000);
      }
    });
      // Apply appropriate button state based on Telegram detection
    if (!isInTelegram && !isLocalDev) {
      // Not in Telegram at all
      submitButton.disabled = true;
      submitButton.textContent = 'Telegram Required';
      submitButton.classList.add('auth-button-none');
    } else if (telegramConfidence === 'medium') {
      // In Telegram but not authenticated
      submitButton.dataset.telegramPending = 'true';
      submitButton.textContent = 'Authentication Needed';
      submitButton.classList.add('auth-button-medium');
      
      // Add click handler to show authentication dialog
      submitButton.addEventListener('click', (e) => {
        if (submitButton.dataset.telegramPending === 'true') {
          e.preventDefault();
          alert('Please ensure Telegram authentication is complete. Try reopening the app from Telegram.');
          
          // Try to recheck Telegram auth
          if (window.Telegram && window.Telegram.WebApp) {
            try {
              window.Telegram.WebApp.expand();
              window.Telegram.WebApp.requestContact();
              // Force reload after a delay
              setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
              console.error('Failed to request Telegram auth:', err);
            }
          }
        }
      });
    } else if (telegramConfidence === 'low') {
      // Possibly Telegram but uncertain
      submitButton.textContent = 'Create Account (Verification Needed)';
      submitButton.classList.add('auth-button-low');
    } else if (isLocalDev) {
      // In development mode - allow with visual indication
      submitButton.classList.add('auth-button-dev');
      submitButton.textContent = 'Create Account (Dev Mode)';
    } else if (hasFullTelegramAuth) {
      // Fully authenticated Telegram
      submitButton.classList.add('auth-button-high');
      submitButton.textContent = 'Create Account';
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
    
    // Remove any existing status indicator
    const existingStatus = form.querySelector('.account-creation-status');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // Network connectivity monitoring
    let isOffline = !navigator.onLine;
    const updateNetworkStatus = () => {
      if (!navigator.onLine && !isOffline) {
        isOffline = true;
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
          statusMessage.textContent = 'Network connection lost! Waiting for reconnection...';
        }
        statusIndicator.style.backgroundColor = '#fff3e0';
        statusIndicator.style.borderColor = '#ffcc80';
      } else if (navigator.onLine && isOffline) {
        isOffline = false;
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
          statusMessage.textContent = 'Network connection restored! Continuing...';
        }
        setTimeout(() => {
          if (statusIndicator.style.backgroundColor === 'rgb(255, 243, 224)') { // #fff3e0
            statusIndicator.style.backgroundColor = '#e8f4fd';
            statusIndicator.style.borderColor = '#90caf9';
          }
        }, 1000);
      }
    };
    
    // Add network listeners
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Create and show a status indicator with improved visibility
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'account-creation-status';
    statusIndicator.style.padding = '15px';
    statusIndicator.style.marginTop = '15px';
    statusIndicator.style.marginBottom = '15px';
    statusIndicator.style.backgroundColor = '#e8f4fd';
    statusIndicator.style.borderRadius = '5px';
    statusIndicator.style.fontSize = '14px';
    statusIndicator.style.border = '1px solid #90caf9';
    statusIndicator.style.position = 'sticky'; // Make it sticky for better visibility
    statusIndicator.style.bottom = '20px';
    statusIndicator.style.zIndex = '100';
    statusIndicator.innerHTML = `
      <p style="margin: 0 0 5px;"><strong>Preparing account creation...</strong></p>
      <p style="margin: 0;" id="status-message">Initializing...</p>
      <div id="creation-progress" style="margin-top: 10px; height: 6px; background-color: #e0e0e0; border-radius: 2px; overflow: hidden;">
        <div style="width: 10%; height: 100%; background-color: #2196f3; transition: width 0.5s ease;"></div>
      </div>
      <p style="margin: 5px 0 0; font-size: 12px; color: #666;" id="status-time">Starting...</p>
    `;
    form.appendChild(statusIndicator);
    
    // Variables for tracking request timing
    let startTime = Date.now();
    let timeoutTimers = [];
    
    // Functions to update status and progress
    const updateStatus = (message, progressPercent) => {
      const statusMessage = document.getElementById('status-message');
      const timeElement = document.getElementById('status-time');
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      
      if (statusMessage) {
        statusMessage.textContent = message;
        console.log('Status update:', message);
      }
      
      if (timeElement) {
        timeElement.textContent = `Time elapsed: ${elapsedSec} seconds`;
      }
      
      const progressBar = document.querySelector('#creation-progress > div');
      if (progressBar && progressPercent !== undefined) {
        progressBar.style.width = `${progressPercent}%`;
      }
    };
    
    // Function to handle potential timeouts
    const startTimeoutDetection = (stage, timeoutMs = 15000) => {
      const timerId = setTimeout(() => {
        updateStatus(`${stage} is taking longer than expected, still trying...`, null);
        statusIndicator.style.backgroundColor = '#fff3e0';
        statusIndicator.style.borderColor = '#ffcc80';
      }, timeoutMs);
      
      timeoutTimers.push(timerId);
      return timerId;
    };
    
    // Clear all timeout timers
    const clearAllTimeouts = () => {
      timeoutTimers.forEach(id => clearTimeout(id));
      timeoutTimers = [];
    };
    
    try {
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Account...';
      submitButton.style.position = 'relative';
      submitButton.style.color = 'rgba(255, 255, 255, 0.7)';
      submitButton.innerHTML = `
        <span style="position: absolute; display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s linear infinite; left: calc(50% - 40px);"></span>
        Creating Account...
      `;
      
      // Add the spinner animation style
      if (!document.getElementById('spinner-style')) {
        const spinnerStyle = document.createElement('style');
        spinnerStyle.id = 'spinner-style';
        spinnerStyle.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(spinnerStyle);
      }
      
      // Step 1: Enhanced Telegram detection (10%)
      updateStatus('Checking Telegram authentication...', 10);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UI feedback
        // Enhanced Telegram detection with stricter validation
      const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
      const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
      const telegramId = telegramData?.user?.id;
      const telegramUsername = telegramData?.user?.username;
      
      // Check for real Telegram app integration - MUST have actual user data
      const hasTelegramAuth = !!telegramId && !!telegramUsername;
      
      // Other indicators (less reliable)
      const secondaryTelegramIndicators = 
          window.location.href.includes('tgWebApp=') || 
          navigator.userAgent.toLowerCase().includes('telegram') ||
          document.referrer.toLowerCase().includes('telegram');
      
      // Combined detection with proper hierarchy - STRICTER validation
      const telegramConfidence = hasTelegramAuth ? 'high' : 
                                isTelegramWebView ? 'medium' : 
                                secondaryTelegramIndicators ? 'low' : 'none';
                                
      // Only consider truly IN Telegram if we have user data or WebApp integration
      const isInTelegram = hasTelegramAuth || isTelegramWebView;
      const hasFullTelegramAuth = hasTelegramAuth;
      
      const isLocalDev = window.location.hostname.includes('localhost') || 
                        window.location.hostname.includes('127.0.0.1') ||
                        window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;
      // Log detection results
      console.log('Enhanced Telegram detection results in handleSubmit:', {
        isTelegramWebView,
        telegramConfidence,
        isInTelegram,
        hasFullTelegramAuth,
        telegramId: telegramId || 'undefined',
        telegramUsername: telegramUsername || 'undefined',
        hasTelegramAuth,
        userAgent: navigator.userAgent,
        hostname: window.location.hostname,
        isLocalDev,
        secondaryTelegramIndicators
      });
        // Only strict validation for production environment
      if (!isLocalDev) {
        // In production, we require HIGH confidence (authenticated Telegram with user data)
        if (!hasFullTelegramAuth) {
          throw new Error('Complete Telegram authentication is required. Please open this app directly from Telegram and ensure you are logged in with a Telegram account that has a username.');
        }
      } else if (!isInTelegram && !isLocalDev) {
        // Fallback check (shouldn't be needed with new logic)
        throw new Error('Telegram authentication is required to create an account.');
      }
      
      // Step 2: Checking API connectivity (30%)
      updateStatus('Connecting to API service...', 30);
      let timeoutId = startTimeoutDetection('API connection check');
      
      try {
        const apiCheck = await registerService.testApiConnection();
        clearTimeout(timeoutId);
        console.log('API connectivity check:', apiCheck);
        
        if (!apiCheck.success) {
          throw new Error(`API connection failed: ${apiCheck.message}`);
        }
        updateStatus('API connection successful', 35);
      } catch (apiError) {
        clearTimeout(timeoutId);
        console.error('API connectivity error:', apiError);
        throw new Error(`Cannot connect to API: ${apiError.message || 'Unknown error'}`);
      }
      
      // Step 3: Verifying account creation service (50%)
      updateStatus('Verifying account creation service...', 50);
      timeoutId = startTimeoutDetection('Service verification');
      
      try {
        const serviceCheck = await registerService.checkAccountCreationService();
        clearTimeout(timeoutId);
        console.log('Service check:', serviceCheck);
        
        if (!serviceCheck.success) {
          throw new Error(`Account creation service unavailable: ${serviceCheck.message}`);
        }
        updateStatus('Account creation service is available', 60);
      } catch (serviceError) {
        clearTimeout(timeoutId);
        console.error('Service check error:', serviceError);
        throw new Error(`Account creation service unavailable: ${serviceError.message || 'Unknown error'}`);
      }
      
      // Step 4: Sending account creation request (70%)
      updateStatus('Sending account creation request...', 70);
      timeoutId = startTimeoutDetection('Account creation', 30000); // Longer timeout for account creation
      
      let result;
      try {
        // Call register service with username only
        result = await registerService.createAccount({
          username
        });
        clearTimeout(timeoutId);
        console.log('Account creation result:', result);
      } catch (creationError) {
        clearTimeout(timeoutId);
        console.error('Account creation error:', creationError);
        throw new Error(`Failed to create account: ${creationError.message || 'Unknown error'}`);
      }
      
      // Step 5: Finalizing (100%)
      updateStatus('Account created successfully!', 100);
      
      // Update status indicator with success message
      statusIndicator.style.backgroundColor = '#e8f5e9';
      statusIndicator.style.borderColor = '#a5d6a7';
      statusIndicator.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Account Created Successfully!</strong></p>
        <p style="margin: 0;">Username: <strong>${username}</strong></p>
        <p style="margin: 5px 0 0;">Your account has been created on the blockchain.</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: #4caf50;">Total time: ${Math.floor((Date.now() - startTime) / 1000)} seconds</p>
      `;
    
      // Success! Show notification with appropriate message
      let successMessage = 'Account created successfully!';
      
      if (result && result.telegramId) {
        successMessage += ' Check your Telegram for account details.';
      } else if (isInTelegram) {
        successMessage += ' Account details will be sent via Telegram.';
      } else if (isLocalDev) {
        successMessage += ' (Development Mode)';
      }
      
      // Emit notification event
      eventEmitter.emit('notification', {
        type: 'success',
        message: successMessage
      });
      
      // Remove network listeners
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      // Show success message in the form after a short delay
      setTimeout(() => {
        this.showSuccessMessage(form, username, isInTelegram);
      }, 1500);
      
    } catch (error) {
      console.error('Registration failed:', error);
      clearAllTimeouts();
      
      // Remove network listeners
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      // Update status indicator with error
      statusIndicator.style.backgroundColor = '#ffebee';
      statusIndicator.style.borderColor = '#ef9a9a';
        // Check if this is actually a success message despite being thrown as an error
      if (error.message.includes('created successfully')) {
        console.log('Detected successful account creation in error message:', error.message);
        
        // Extract the username from the error message
        const match = error.message.match(/Account (\w+) created successfully/);
        const createdUsername = match ? match[1] : username;
        
        // This is actually a success case - handle it as such
        clearAllTimeouts();
        
        // Update status indicator with success message
        statusIndicator.style.backgroundColor = '#e8f5e9';
        statusIndicator.style.borderColor = '#a5d6a7';
        statusIndicator.innerHTML = `
          <p style="margin: 0 0 5px;"><strong>Account Created Successfully!</strong></p>
          <p style="margin: 0;">Username: <strong>${createdUsername}</strong></p>
          <p style="margin: 5px 0 0;">Your account has been created on the blockchain.</p>
          <p style="margin: 5px 0 0; font-size: 12px; color: #4caf50;">Total time: ${Math.floor((Date.now() - startTime) / 1000)} seconds</p>
        `;
        
        // Emit success notification instead of error
        const successMessage = `Account ${createdUsername} created successfully!`;
        eventEmitter.emit('notification', {
          type: 'success',
          message: successMessage
        });
        
        // Show success message in the form
        setTimeout(() => {
          this.showSuccessMessage(form, createdUsername, isInTelegram);
        }, 1500);
        
        return; // Exit error handling since this is actually a success case
      }
      
      // Normal error handling for actual errors
      // Check for specific error types to provide better guidance
      let specificHelp = '';
      if (error.message.includes('Network') || error.message.includes('connect')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Connection Issue Detected</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Check your internet connection</li>
            <li>Make sure you have a stable connection</li>
            <li>Try closing and reopening the Telegram app</li>
          </ul>
        `;
      } else if (error.message.includes('timed out') || error.message.includes('timeout')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Request Timeout</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>The server is taking too long to respond</li>
            <li>It may be experiencing high traffic</li>
            <li>Try again in a few minutes</li>
          </ul>
        `;
      } else if (error.message.includes('already exists') || error.message.includes('taken')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Username Not Available</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Try a different username</li>
            <li>Add numbers or characters to make it unique</li>
          </ul>
        `;
      } else if (error.message.includes('Telegram')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Telegram Authentication Issue</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Make sure you're opening this from the Telegram app</li>
            <li>Try closing and reopening the app</li>
            <li>Update your Telegram app if needed</li>
          </ul>
        `;
      } else {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>General Error</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Try again in a few moments</li>
            <li>Check your internet connection</li>
            <li>If the problem persists, contact support</li>
          </ul>
        `;
      }
      
      statusIndicator.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Registration Error</strong></p>
        <p style="margin: 0; color: #c62828;">${error.message || 'Failed to create account'}</p>
        <p style="margin: 5px 0 0; font-size: 12px;">Total time: ${Math.floor((Date.now() - startTime) / 1000)} seconds</p>
        ${specificHelp}
        <button id="retry-button" style="margin-top: 10px; padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
      `;
      
      // Add event listener to retry button
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          // Reset the form and try again
          statusIndicator.remove();
          submitButton.disabled = false;
          submitButton.innerHTML = 'Create Account';
          document.querySelector('.button-spinner').style.display = 'none';
        });
      }
      
      this.showError(form, error.message || 'Failed to create account');
      
      // Reset button state
      submitButton.disabled = false;
      submitButton.innerHTML = 'Try Again';
      submitButton.style.color = '';
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