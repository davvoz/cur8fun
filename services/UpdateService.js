/**
 * Update Service
 * Gestisce il controllo e l'applicazione degli aggiornamenti dell'applicazione
 */
import eventEmitter from '../utils/EventEmitter.js';
import { APP_CONFIG, isNewVersion } from '../config/app-version.js';

class UpdateService {
  constructor() {
    this.isCheckingForUpdates = false;
    this.updateAvailable = false;
    this.currentVersion = APP_CONFIG.version;
    this.latestVersion = null;
    this.registration = null;
    this.updateCheckIntervalId = null;
  }

  /**
   * Inizializza il servizio di aggiornamento
   */
  async init() {
    // Verifica se il Service Worker è supportato
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker non supportato in questo browser');
      return;
    }

    try {
      // Registra il service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrato con successo:', this.registration);

      // Configura i listener per gli eventi di aggiornamento
      this._setupUpdateListeners();

      // Avvia il controllo periodico degli aggiornamenti
      this._startPeriodicUpdateCheck();

      // Esegue un controllo immediato
      if (!APP_CONFIG.skipUpdateCheck) {
        this.checkForUpdates();
      }
    } catch (error) {
      console.error('Errore durante la registrazione del Service Worker:', error);
    }
  }

  /**
   * Configura i listener per gli eventi di aggiornamento
   */
  _setupUpdateListeners() {
    // Se c'è già un service worker attivo
    if (navigator.serviceWorker.controller) {
      // Ascolta i messaggi dal service worker
      navigator.serviceWorker.addEventListener('message', this._handleServiceWorkerMessage.bind(this));

      // Controlla se ci sono nuovi service worker in attesa
      if (this.registration && this.registration.waiting) {
        this._notifyUpdateAvailable(this.registration.waiting);
      }
    }

    // Ascolta per nuovi service worker
    if (this.registration) {
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => this._handleStateChange(newWorker));
        }
      });
    }

    // Ricarica la pagina quando il service worker viene aggiornato
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.updateAvailable) {
        console.log('Service Worker aggiornato, ricarico la pagina per applicare i cambiamenti');
        window.location.reload();
      }
    });
  }

  /**
   * Gestisce i messaggi ricevuti dal service worker
   * @param {MessageEvent} event - L'evento di messaggio
   */
  _handleServiceWorkerMessage(event) {
    const message = event.data;
    
    if (!message || typeof message !== 'object') return;
    
    if (message.type === 'UPDATE_AVAILABLE') {
      this.latestVersion = message.version;
      
      if (isNewVersion(this.currentVersion, this.latestVersion)) {
        this.updateAvailable = true;
        eventEmitter.emit('app:update-available', { 
          version: this.latestVersion,
          timestamp: message.timestamp || new Date().toISOString()
        });
      }
    } else if (message.type === 'VERSION_INFO') {
      this.latestVersion = message.version;
      
      if (isNewVersion(this.currentVersion, this.latestVersion)) {
        this.updateAvailable = true;
        eventEmitter.emit('app:update-available', { 
          version: this.latestVersion,
          timestamp: message.timestamp || new Date().toISOString()
        });
      }
    }
  }

  /**
   * Gestisce i cambiamenti di stato di un service worker
   * @param {ServiceWorker} worker - Il service worker
   */
  _handleStateChange(worker) {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      this._notifyUpdateAvailable(worker);
    }
  }

  /**
   * Notifica che un aggiornamento è disponibile
   * @param {ServiceWorker} worker - Il service worker con l'aggiornamento
   */
  _notifyUpdateAvailable(worker) {
    // Invia un messaggio al worker per ottenere informazioni sulla versione
    if (worker && worker.postMessage) {
      worker.postMessage({ type: 'GET_VERSION_INFO' });
    }
    
    this.updateAvailable = true;
    
    // Emetti un evento per notificare l'UI
    eventEmitter.emit('app:update-available', { 
      version: this.latestVersion || 'nuova versione',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Avvia il controllo periodico degli aggiornamenti
   */
  _startPeriodicUpdateCheck() {
    // Pulisce eventuali intervalli esistenti
    if (this.updateCheckIntervalId) {
      clearInterval(this.updateCheckIntervalId);
    }

    // Imposta un nuovo intervallo per il controllo degli aggiornamenti
    this.updateCheckIntervalId = setInterval(() => {
      this.checkForUpdates();
    }, APP_CONFIG.updateCheckInterval);
  }

  /**
   * Controlla se sono disponibili aggiornamenti
   */
  async checkForUpdates() {
    if (this.isCheckingForUpdates || !navigator.onLine || APP_CONFIG.skipUpdateCheck) {
      return;
    }

    this.isCheckingForUpdates = true;

    try {
      // Se c'è un service worker registrato, forza l'aggiornamento
      if (this.registration) {
        console.log('Controllo aggiornamenti...');
        await this.registration.update();
        console.log('Controllo aggiornamenti completato');
      }

      // Invia un messaggio al service worker per controllare la versione
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CHECK_VERSION'
        });
      }
    } catch (error) {
      console.error('Errore durante il controllo degli aggiornamenti:', error);
    } finally {
      this.isCheckingForUpdates = false;
    }
  }

  /**
   * Aggiorna l'applicazione
   */
  update() {
    if (this.registration && this.registration.waiting) {
      // Invia un messaggio al service worker in attesa per attivarlo
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Reset the update flag
      this.updateAvailable = false;
    } else {
      // Se non c'è un service worker in attesa, ricarica comunque per ottenere l'ultima versione
      // Reset the update flag before reloading
      this.updateAvailable = false;
      window.location.reload(true);
    }
  }
}

// Esporta una singola istanza del servizio
const updateService = new UpdateService();
export default updateService;