/**
 * Component to notify users about available app updates
 */
import Component from '../Component.js';
import eventEmitter from '../../utils/EventEmitter.js';
import updateService from '../../services/UpdateService.js';
import { APP_CONFIG } from '../../config/app-version.js';

export default class UpdateNotificationComponent extends Component {
  /**
   * @param {HTMLElement} parentElement - Container element where component will be rendered
   * @param {Object} options - Component options
   */
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    
    // Ottieni la versione attuale dall'app config
    this.currentVersion = APP_CONFIG.version;
    
    // Flag per memorizzare se c'è un aggiornamento disponibile
    this.updateAvailable = false;
    
    // Reference to the created notification element
    this.notificationElement = null;
    
    // Bind methods
    this.handleUpdateAvailable = this.handleUpdateAvailable.bind(this);
    this.dismissNotification = this.dismissNotification.bind(this);
    this.refreshApp = this.refreshApp.bind(this);
    
    // Impostazione ascoltatori di eventi
    this.setupEventListeners();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Ascolta eventi personalizzati di aggiornamento
    this.registerEmitterHandler(eventEmitter, 'app:update-available', this.handleUpdateAvailable);
  }
  
  /**
   * Handle update available event
   * @param {Object} data - Update data
   */
  handleUpdateAvailable(data) {
    this.updateAvailable = true;
    
    // Mostra la notifica se non è già visualizzata
    if (!this.notificationElement) {
      this.render(data.version);
    }
  }
  
  /**
   * Render update notification
   * @param {string} newVersion - New app version
   */
  render(newVersion) {
    if (!this.parentElement) return;
    
    // Create notification element
    this.notificationElement = document.createElement('div');
    this.notificationElement.className = 'update-notification';
    this.notificationElement.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--primary-color, #3498db);
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      animation: slideUp 0.3s ease-out forwards;
    `;
    
    // Animation style
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      
      .update-notification-message {
        flex: 1;
        font-weight: 500;
      }
      
      .update-notification-actions {
        display: flex;
        gap: 10px;
      }
      
      .update-notification-actions button {
        background: rgba(255,255,255,0.2);
        border: none;
        border-radius: 4px;
        color: white;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      }
      
      .update-notification-actions button:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .update-notification-actions .primary {
        background: white;
        color: var(--primary-color, #3498db);
      }
      
      .update-notification-actions .primary:hover {
        background: rgba(255,255,255,0.9);
      }
    `;
    document.head.appendChild(styleElement);
    
    // Notification content
    const message = document.createElement('div');
    message.className = 'update-notification-message';
    message.textContent = `È disponibile una nuova versione dell'app (v${newVersion})!`;
    
    // Notification actions
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'update-notification-actions';
    
    // Refresh button
    const refreshButton = document.createElement('button');
    refreshButton.className = 'primary';
    refreshButton.textContent = 'Aggiorna ora';
    refreshButton.addEventListener('click', this.refreshApp);
    
    // Dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.textContent = 'Più tardi';
    dismissButton.addEventListener('click', this.dismissNotification);
    
    // Assemble notification
    actionsContainer.appendChild(refreshButton);
    actionsContainer.appendChild(dismissButton);
    this.notificationElement.appendChild(message);
    this.notificationElement.appendChild(actionsContainer);
    
    // Add notification to DOM
    document.body.appendChild(this.notificationElement);
  }
  
  /**
   * Refresh the application to get the latest version
   */
  refreshApp() {
    // Utilizza il servizio di aggiornamento per aggiornare l'app
    updateService.update();
  }
  
  /**
   * Dismiss the update notification
   */
  dismissNotification() {
    if (this.notificationElement) {
      this.notificationElement.style.animation = 'slideDown 0.3s ease-out forwards';
      
      // Aggiungi animazione di uscita
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @keyframes slideDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
      `;
      document.head.appendChild(styleElement);
      
      // Rimuovi la notifica dopo l'animazione
      setTimeout(() => {
        if (this.notificationElement && this.notificationElement.parentNode) {
          this.notificationElement.parentNode.removeChild(this.notificationElement);
          this.notificationElement = null;
        }
      }, 300);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Rimuovi la notifica se presente
    if (this.notificationElement && this.notificationElement.parentNode) {
      this.notificationElement.parentNode.removeChild(this.notificationElement);
    }
    
    // Chiama il metodo destroy del genitore per rimuovere gli event listener
    super.destroy();
  }
}