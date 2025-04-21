import Component from '../Component.js';
import authService from '../../services/AuthService.js';
import eventEmitter from '../../utils/EventEmitter.js';
import router from '../../utils/Router.js';

/**
 * Componente che mostra un avviso quando l'utente non ha accesso con active key
 * @extends Component
 */
class ActiveKeyWarningComponent extends Component {
  /**
   * Crea una nuova istanza del componente di avviso per active key
   * @param {HTMLElement} container - Elemento container dove renderizzare il componente
   * @param {Object} options - Opzioni di configurazione
   */
  constructor(container, options = {}) {
    super(container, options);
    this.username = authService.getCurrentUser()?.username;
    console.log('[ActiveKeyWarningComponent] Created with username:', this.username);
    
    // Aggiungiamo un flag per forzare la visualizzazione durante i test
    this.forceDisplay = options.forceDisplay || false;
    
    // Imposta il container come attributo diretto
    this.container = container;

    // Nasconde il container inizialmente per prevenire flash di contenuto
    if (container) {
      container.style.display = 'none';
    }
    
    // Flag per tenere traccia dell'inizializzazione
    this.initialized = false;
    
    // Tentativi di controllo dell'autenticazione
    this.checkAttempts = 0;
    this.maxAttempts = 5;
  }

  /**
   * Inizializza il componente quando il DOM è pronto
   * e l'autenticazione è completata
   */
  init() {
    // Verifica immediatamente lo stato dell'autenticazione con un ritardo
    // per dare tempo al browser di completare l'inizializzazione di Keychain
    setTimeout(() => this.checkAuthStatusWithRetry(), 300);

    // Ascolta eventuali cambiamenti nell'autenticazione
    eventEmitter.on('auth:changed', () => {
      console.log('[ActiveKeyWarningComponent] Auth state changed, rechecking status');
      this.checkAuthStatus();
    });
    
    this.initialized = true;
  }
  
  /**
   * Verifica lo stato di autenticazione con tentativi multipli
   * Importante per dare il tempo a Keychain di essere completamente inizializzato
   */
  checkAuthStatusWithRetry() {
    // Incrementa il contatore dei tentativi
    this.checkAttempts++;
    
    console.log(`[ActiveKeyWarningComponent] Auth check attempt ${this.checkAttempts}`);
    
    // Verifica se Keychain è installato e disponibile
    const keychainAvailable = authService.isKeychainInstalled();
    console.log(`[ActiveKeyWarningComponent] Is Keychain available: ${keychainAvailable}`);
    
    // Ottieni l'utente corrente e il metodo di login
    const user = authService.getCurrentUser();
    const loginMethod = user?.loginMethod;
    console.log(`[ActiveKeyWarningComponent] Current login method: ${loginMethod}`);
    
    // Verifica lo stato dell'autenticazione
    const hasActiveAccess = authService.hasActiveKeyAccess();
    console.log(`[ActiveKeyWarningComponent] Has active access: ${hasActiveAccess}`);
    
    if (hasActiveAccess) {
      // Utente ha accesso, nascondi il warning
      console.log('[ActiveKeyWarningComponent] User has active access, hiding warning');
      if (this.container) {
        this.container.style.display = 'none';
      }
      return;
    }
    
    // Se l'utente usa Keychain ma hasActiveAccess è falso, potrebbe essere
    // che Keychain non è ancora completamente inizializzato
    if (loginMethod === 'keychain' && !hasActiveAccess && this.checkAttempts < this.maxAttempts) {
      console.log('[ActiveKeyWarningComponent] Keychain detected but access not confirmed, retrying...');
      // Riprova tra 300ms
      setTimeout(() => this.checkAuthStatusWithRetry(), 300);
      return;
    }
    
    // Se arriviamo qui, l'utente non ha accesso all'active key
    // o abbiamo esaurito i tentativi
    if (!hasActiveAccess || this.forceDisplay) {
      console.log('[ActiveKeyWarningComponent] No active access confirmed, showing warning');
      this.render();
    } else {
      console.log('[ActiveKeyWarningComponent] Access confirmed, hiding warning');
      if (this.container) {
        this.container.style.display = 'none';
      }
    }
  }

  /**
   * Verifica lo stato di autenticazione e aggiorna il display
   */
  checkAuthStatus() {
    const hasActiveAccess = authService.hasActiveKeyAccess();
    console.log('[ActiveKeyWarningComponent] Direct auth check. hasActiveKeyAccess:', hasActiveAccess);
    
    if (hasActiveAccess && !this.forceDisplay) {
      console.log('[ActiveKeyWarningComponent] User has active key access, hiding warning');
      if (this.container) {
        this.container.style.display = 'none';
      }
    } else {
      console.log('[ActiveKeyWarningComponent] User does not have active key access, showing warning');
      this.render();
    }
  }

  /**
   * Renderizza il componente di avviso
   */
  render() {
    if (!this.container) {
      console.error('[ActiveKeyWarningComponent] Container not found');
      return;
    }
    
    // Pulisce il container
    this.container.innerHTML = '';
    
    // Crea la struttura dell'avviso
    const warningElement = this.createWarningElement();
    this.container.appendChild(warningElement);
    
    // Assicurati che il container sia visibile
    this.container.style.display = 'block';
    
    console.log('[ActiveKeyWarningComponent] Warning rendered successfully');
  }
  
  /**
   * Crea l'elemento di avviso con tutti i suoi componenti interni
   * @returns {HTMLElement} L'elemento di avviso
   */
  createWarningElement() {
    const warningContainer = document.createElement('div');
    warningContainer.className = 'active-key-warning';
    
    // Icona di avviso con Material Icons
    const warningIcon = document.createElement('span');
    warningIcon.className = 'material-icons warning-icon';
    warningIcon.textContent = 'warning';
    warningContainer.appendChild(warningIcon);
    
    // Contenuto dell'avviso
    const warningContent = document.createElement('div');
    warningContent.className = 'warning-content';
    
    // Titolo dell'avviso
    const warningTitle = document.createElement('h4');
    warningTitle.textContent = 'Accesso limitato al portafoglio';
    warningContent.appendChild(warningTitle);
    
    // Testo dell'avviso con lista di operazioni limitate
    const warningText = document.createElement('p');
    warningText.innerHTML = this.getWarningText();
    warningContent.appendChild(warningText);
    
    // Container per i pulsanti
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    // Aggiungi pulsanti di azione
    this.addActionButtons(buttonContainer);
    
    // Assembla tutto
    warningContent.appendChild(buttonContainer);
    warningContainer.appendChild(warningContent);
    
    return warningContainer;
  }
  
  /**
   * Restituisce il testo dell'avviso
   * @returns {string} HTML per il testo di avviso
   */
  getWarningText() {
    return 'Per eseguire operazioni che richiedono l\'<strong>active key</strong>:' +
      '<ul>' +
      '<li>Trasferimenti di fondi</li>' +
      '<li>Power Up/Down</li>' +
      '<li>Modifiche delle autorizzazioni dell\'account</li>' +
      '<li>Operazioni sugli STEEM Power delegati</li>' +
      '</ul>' +
      'È necessario accedere con l\'active key o utilizzare Keychain.';
  }
  
  /**
   * Aggiunge i pulsanti di azione all'avviso
   * @param {HTMLElement} container - Container dei pulsanti
   */
  addActionButtons(container) {
    // Pulsante per accedere con active key
    const loginButton = document.createElement('button');
    loginButton.className = 'btn-primary';
    loginButton.textContent = 'Accedi con Active Key';
    loginButton.addEventListener('click', () => {
      this.handleActiveKeyLogin();
    });
    container.appendChild(loginButton);
    
    // Se l'utente ha Keychain installato, mostra anche questa opzione
    if (authService.isKeychainInstalled()) {
      const keychainButton = document.createElement('button');
      keychainButton.className = 'btn-secondary';
      keychainButton.textContent = 'Usa Keychain';
      keychainButton.addEventListener('click', () => {
        this.handleKeychainLogin();
      });
      container.appendChild(keychainButton);
    }
  }
  
  /**
   * Gestisce il click sul pulsante per accedere con active key
   */
  handleActiveKeyLogin() {
    // Esegui logout
    authService.logout();
    
    // Usa il router dell'applicazione per il reindirizzamento invece di window.location.href
    // Questo assicura che il parametro venga gestito correttamente dal sistema di routing
    router.navigate('/login', { 
      active: true,
      returnUrl: window.location.pathname // Salva la pagina corrente per tornare dopo il login
    });
  }
  
  /**
   * Gestisce il click sul pulsante per usare Keychain
   */
  async handleKeychainLogin() {
    try {
      // Memorizza username prima del logout
      const username = this.username;
      
      // Logout
      authService.logout();
      
      if (username) {
        // Mostra un feedback all'utente
        this.showKeychainNotification();
        
        // Login con Keychain
        await authService.loginWithKeychain(username);
        
        // Rimuovi notifica e ricarica pagina
        this.removeKeychainNotification();
        window.location.reload();
      } else {
        // Usa il router invece di window.location.href per coerenza
        router.navigate('/login', { 
          keychain: true,
          returnUrl: window.location.pathname
        });
      }
    } catch (error) {
      console.error('Keychain login failed:', error);
      
      // Rimuovi la notifica se presente
      this.removeKeychainNotification();
      
      // Mostra un errore
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Keychain login failed: ${error.message || 'Unknown error'}`
      });
    }
  }
  
  /**
   * Mostra una notifica durante l'autenticazione con Keychain
   */
  showKeychainNotification() {
    // Rimuovi notifiche esistenti per sicurezza
    this.removeKeychainNotification();
    
    // Crea nuova notifica
    const notification = document.createElement('div');
    notification.id = 'keychain-notification';
    notification.className = 'keychain-notification';
    notification.textContent = 'Riautenticazione con Keychain in corso...';
    
    document.body.appendChild(notification);
  }
  
  /**
   * Rimuove la notifica di Keychain
   */
  removeKeychainNotification() {
    const notification = document.getElementById('keychain-notification');
    if (notification) {
      notification.parentNode.removeChild(notification);
    }
  }
  
  /**
   * Pulisce eventuali risorse quando il componente viene distrutto
   */
  destroy() {
    // Rimuovi i listener di eventi
    eventEmitter.off('auth:changed');
    
    this.removeKeychainNotification();
    this.initialized = false;
    super.destroy();
  }
}

export default ActiveKeyWarningComponent;