/**
 * Simple EventEmitter for managing application events
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Callback function to execute
   * @returns {Function} Unsubscribe function
   */
  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
    
    // Return function to unsubscribe
    return () => {
      this.off(eventName, listener);
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event to unsubscribe from
   * @param {Function} listenerToRemove - Callback function to remove
   */
  off(eventName, listenerToRemove) {
    if (!this.events[eventName]) {
      return;
    }
    
    this.events[eventName] = this.events[eventName].filter(
      listener => listener !== listenerToRemove
    );
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event to emit
   * @param {any} data - Data to pass to the listeners
   */
  emit(eventName, data) {
    if (!this.events[eventName]) {
      return;
    }
    
    this.events[eventName].forEach(listener => {
      listener(data);
    });
  }

  /**
   * Subscribe to an event once
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Callback function to execute
   */
  once(eventName, listener) {
    const onceListener = (data) => {
      listener(data);
      this.off(eventName, onceListener);
    };
    
    this.on(eventName, onceListener);
  }
}

// Create a singleton instance for the application
const eventEmitter = new EventEmitter();

// Rendi l'eventEmitter disponibile globalmente per gli aggiornamenti di progresso
if (typeof window !== 'undefined') {
    window.eventEmitter = eventEmitter;
}

export default eventEmitter;
