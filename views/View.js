import eventEmitter from '../utils/EventEmitter.js';

/**
 * Base class for all views
 */
export default class View {
  /**
   * Create a new view instance
   * @param {HTMLElement} element - Container element
   * @param {Object} params - Parameters from the router
   */
  constructor(element, params = {}) {
    if (!element) {
      element = document.createElement('div');
      element.id = 'main-content';
      document.body.appendChild(element);
    }
    this.element = element;
    this.params = params;
    this.eventSubscriptions = [];
    this.childComponents = [];
  }

  /**
   * Subscribe to an event and store the subscription
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} callback - Callback function
   */
  subscribe(eventName, callback) {
    const unsubscribe = eventEmitter.on(eventName, callback);
    this.eventSubscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Emit an event
   * @param {string} eventName - Event name to emit
   * @param {any} data - Event data
   */
  emit(eventName, data) {
    eventEmitter.emit(eventName, data);
  }

  /**
   * Clean up view resources (event subscriptions, etc.)
   */
  unmount() {
    // Unsubscribe from all events
    this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
    this.eventSubscriptions = [];
    
    // Unmount any child components
    this.childComponents.forEach(component => {
      if (typeof component.unmount === 'function') {
        component.unmount();
      }
    });
    this.childComponents = [];
  }

  /**
   * Add a child component to this view
   * @param {Object} component - Component instance with unmount method
   */
  addChildComponent(component) {
    this.childComponents.push(component);
    return component;
  }

  /**
   * Render the view into the main content area
   */
  render() {
    if (!this.element) {
      console.error('Element not found');
      return;
    }
    // Should be implemented by child classes
    throw new Error('render method must be implemented by subclass');
  }

  /**
   * Create HTML element from HTML string
   * @param {string} html - HTML string
   * @returns {HTMLElement} Created element
   */
  createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }
}
