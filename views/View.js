import eventEmitter from '../utils/EventEmitter.js';

/**
 * Base class for all views
 */
export default class View {
  /**
   * Create a new view instance
   * @param {Object} params - Parameters from the router
   */
  constructor(params = {}) {
    this.params = params;
    this.element = null; // Will be set during render
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
    
    // Remove all event listeners from elements
    this.removeEventListeners();
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
   * Remove all event listeners that were added to elements
   * Subclasses should override this if they manually add event listeners
   */
  removeEventListeners() {
    // Override in subclass if needed
  }

  /**
   * Render the view into the container
   * @param {HTMLElement} container - Container element to render into
   */
  render(container) {
    if (!container) {
      console.error('No container provided for rendering');
      return;
    }
    
    // Save reference to the container
    this.element = container;
    
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
