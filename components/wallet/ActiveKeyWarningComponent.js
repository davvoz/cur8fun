import Component from '../Component.js';
import authService from '../../services/AuthService.js';
import eventEmitter from '../../utils/EventEmitter.js';
import router from '../../utils/Router.js';
import activeKeyInput from '../auth/ActiveKeyInputComponent.js'; // Importo il componente centralizzato

/**
 * Component that shows a warning when the user doesn't have access with active key
 * @extends Component
 */
class ActiveKeyWarningComponent extends Component {
  /**
   * Creates a new instance of the active key warning component
   * @param {HTMLElement} container - Container element where to render the component
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    super(container, options);
    this.username = authService.getCurrentUser()?.username;
    
    // Add a flag to force display during tests
    this.forceDisplay = options.forceDisplay || false;
    
    // Set the container as a direct attribute
    this.container = container;

    // Hide the container initially to prevent content flash
    if (container) {
      container.style.display = 'none';
    }
    
    // Flag to track initialization
    this.initialized = false;
    
    // Authentication check attempts
    this.checkAttempts = 0;
    this.maxAttempts = 5;
  }

  /**
   * Initializes the component when the DOM is ready
   * and authentication is completed
   */
  init() {
    // Immediately check authentication status with a delay
    // to give the browser time to complete Keychain initialization
    setTimeout(() => this.checkAuthStatusWithRetry(), 300);

    // Listen for authentication changes
    eventEmitter.on('auth:changed', () => {
      this.checkAuthStatus();
    });
    
    this.initialized = true;
  }
  
  /**
   * Checks authentication status with multiple attempts
   * Important to give Keychain time to be fully initialized
   */
  checkAuthStatusWithRetry() {
    // Increment the attempt counter
    this.checkAttempts++;
    
    // Check if Keychain is installed and available
    const keychainAvailable = authService.isKeychainInstalled();
    
    // Get the current user and login method
    const user = authService.getCurrentUser();
    const loginMethod = user?.loginMethod;
    
    // Check authentication status
    const hasActiveAccess = authService.hasActiveKeyAccess();
    
    if (hasActiveAccess) {
      // User has access, hide the warning
      if (this.container) {
        this.container.style.display = 'none';
      }
      return;
    }
    
    // If the user uses Keychain but hasActiveAccess is false, it might be
    // that Keychain is not yet fully initialized
    if (loginMethod === 'keychain' && !hasActiveAccess && this.checkAttempts < this.maxAttempts) {
      // Retry after 300ms
      setTimeout(() => this.checkAuthStatusWithRetry(), 300);
      return;
    }
    
    // If we reach here, the user does not have access to the active key
    // or we have exhausted the attempts
    if (!hasActiveAccess || this.forceDisplay) {
      this.render();
    } else {
      if (this.container) {
        this.container.style.display = 'none';
      }
    }
  }

  /**
   * Checks authentication status and updates the display
   */
  checkAuthStatus() {
    const hasActiveAccess = authService.hasActiveKeyAccess();
    
    if (hasActiveAccess && !this.forceDisplay) {
      if (this.container) {
        this.container.style.display = 'none';
      }
    } else {
      this.render();
    }
  }

  /**
   * Renders the warning component
   */
  render() {
    if (!this.container) {
      console.error('[ActiveKeyWarningComponent] Container not found');
      return;
    }
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the warning structure
    const warningElement = this.createWarningElement();
    this.container.appendChild(warningElement);
    
    // Ensure the container is visible
    this.container.style.display = 'block';
  }
  
  /**
   * Creates the warning element with all its internal components
   * @returns {HTMLElement} The warning element
   */
  createWarningElement() {
    const warningContainer = document.createElement('div');
    warningContainer.className = 'active-key-warning';
    
    // Warning icon with Material Icons
    const warningIcon = document.createElement('span');
    warningIcon.className = 'material-icons warning-icon';
    warningIcon.textContent = 'warning';
    warningContainer.appendChild(warningIcon);
    
    // Warning content
    const warningContent = document.createElement('div');
    warningContent.className = 'warning-content';
    
    // Warning title
    const warningTitle = document.createElement('h4');
    warningTitle.textContent = 'Limited Wallet Access';
    warningContent.appendChild(warningTitle);
    
    // Warning text with list of limited operations
    const warningText = document.createElement('p');
    warningText.innerHTML = this.getWarningText();
    warningContent.appendChild(warningText);
    
    // Container for buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    // Add action buttons
    this.addActionButtons(buttonContainer);
    
    // Assemble everything
    warningContent.appendChild(buttonContainer);
    warningContainer.appendChild(warningContent);
    
    return warningContainer;
  }
  
  /**
   * Returns the warning text
   * @returns {string} HTML for the warning text
   */
  getWarningText() {
    return 'To perform operations that require the <strong>active key</strong>:' +
      '<ul>' +
      '<li>Fund transfers</li>' +
      '<li>Power Up/Down</li>' +
      '<li>Account permission changes</li>' +
      '<li>Operations on delegated STEEM Power</li>' +
      '</ul>' +
      'You need to log in with your active key or use Keychain.';
  }
  
  /**
   * Adds action buttons to the warning
   * @param {HTMLElement} container - Button container
   */
  addActionButtons(container) {
    // Button to log in with active key
    const loginButton = document.createElement('button');
    loginButton.className = 'btn-primary';
    loginButton.textContent = 'Log in with Active Key';
    loginButton.addEventListener('click', () => {
      this.handleActiveKeyLogin();
    });
    container.appendChild(loginButton);
    
    // If the user has Keychain installed, also show this option
    if (authService.isKeychainInstalled()) {
      const keychainButton = document.createElement('button');
      keychainButton.className = 'btn-secondary';
      keychainButton.textContent = 'Use Keychain';
      keychainButton.addEventListener('click', () => {
        this.handleKeychainLogin();
      });
      container.appendChild(keychainButton);
    }
  }
  
  /**
   * Handles the click on the button to log in with active key
   */
  async handleActiveKeyLogin() {
    // Utilizzo il componente centralizzato ActiveKeyInputComponent
    try {
      const activeKey = await activeKeyInput.promptForActiveKey('Enter Active Key for Wallet Access');
      
      if (!activeKey) {
        // L'utente ha annullato l'inserimento
        return;
      }
      
      // Store username before logout
      const username = this.username;
      
      if (!username) {
        eventEmitter.emit('notification', {
          type: 'error',
          message: 'No user is currently logged in. Please login first.'
        });
        return;
      }
      
      // Tenta di autenticarsi con la active key
      try {
        // Esegui il logout per sicurezza
        authService.logout();
        
        // Esegui il login con l'active key
        await authService.loginWithActiveKey(username, activeKey);
        
        // Se arriviamo qui, l'autenticazione è riuscita
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully authenticated with Active Key'
        });
        
        // Ricarica la pagina per aggiornare lo stato
        window.location.reload();
      } catch (error) {
        console.error('[ActiveKeyWarningComponent] Active key login failed:', error);
        
        eventEmitter.emit('notification', {
          type: 'error',
          message: `Authentication failed: ${error.message || 'Invalid active key'}`
        });
        
        // Se l'autenticazione fallisce, ripristina l'accesso base
        try {
          await authService.loginWithPostingKey(username, null); // null perché utilizziamo il localStorage o sessionStorage
        } catch {
          // Ignora errori nel tentativo di ripristino
        }
      }
    } catch (error) {
      console.error('[ActiveKeyWarningComponent] Error during active key input:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Error processing active key: ${error.message || 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handles the click on the button to use Keychain
   */
  async handleKeychainLogin() {
    try {
      // Store username before attempting keychain login
      const username = this.username;
      
      if (!username) {
        eventEmitter.emit('notification', {
          type: 'error',
          message: 'No user is currently logged in. Please login first.'
        });
        return;
      }
      
      // Show feedback to the user
      this.showKeychainNotification();
      
      try {
        // Login with Keychain without logging out first
        await authService.loginWithKeychain(username);
        
        // Se l'autenticazione Keychain ha successo, possiamo ricaricare la pagina
        this.removeKeychainNotification();
        window.location.reload();
      } catch (error) {
        console.error('Keychain login failed:', error);
        
        // Remove the notification
        this.removeKeychainNotification();
        
        // Show an error
        eventEmitter.emit('notification', {
          type: 'error',
          message: `Keychain login failed: ${error.message || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Error in Keychain login process:', error);
      
      // Remove the notification if present
      this.removeKeychainNotification();
      
      // Show an error
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Keychain authentication error: ${error.message || 'Unknown error'}`
      });
    }
  }
  
  /**
   * Shows a notification during Keychain authentication
   */
  showKeychainNotification() {
    // Remove existing notifications for safety
    this.removeKeychainNotification();
    
    // Create new notification
    const notification = document.createElement('div');
    notification.id = 'keychain-notification';
    notification.className = 'keychain-notification';
    notification.textContent = 'Reauthenticating with Keychain...';
    
    document.body.appendChild(notification);
  }
  
  /**
   * Removes the Keychain notification
   */
  removeKeychainNotification() {
    const notification = document.getElementById('keychain-notification');
    if (notification) {
      notification.parentNode.removeChild(notification);
    }
  }
  
  /**
   * Cleans up resources when the component is destroyed
   */
  destroy() {
    // Remove event listeners
    eventEmitter.off('auth:changed');
    
    this.removeKeychainNotification();
    this.initialized = false;
    super.destroy();
  }
}

export default ActiveKeyWarningComponent;