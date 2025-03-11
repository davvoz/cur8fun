/**
 * Base component class for modular UI elements
 */
export default class Component {
  /**
   * @param {HTMLElement} parentElement - Container element where component will be rendered
   * @param {Object} options - Component options
   */
  constructor(parentElement, options = {}) {
    this.parentElement = parentElement;
    this.options = options;
    this.element = null;
    this.eventHandlers = [];
    this.emitterHandlers = []; // Add separate array for emitter handlers
  }
  
  /**
   * Render the component into its parent element
   */
  render() {
    // Abstract method to be implemented by subclasses
  }
  
  /**
   * Register DOM event handler for cleanup
   * @param {HTMLElement} element - Element with event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  registerEventHandler(element, event, callback) {
    element.addEventListener(event, callback);
    this.eventHandlers.push({ element, event, callback });
  }
  
  /**
   * Register event emitter handler for cleanup
   * @param {EventEmitter} emitter - Event emitter
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  registerEmitterHandler(emitter, event, handler) {
    emitter.on(event, handler);
    this.emitterHandlers.push({ emitter, event, handler });
  }
  
  /**
   * Clean up component resources
   */
  destroy() {
    // Remove DOM event listeners
    this.eventHandlers.forEach(({ element, event, callback }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, callback);
      }
    });
    this.eventHandlers = [];
    
    // Remove emitter event listeners
    this.emitterHandlers.forEach(({ emitter, event, handler }) => {
      if (emitter && typeof emitter.off === 'function') {
        emitter.off(event, handler);
      }
    });
    this.emitterHandlers = [];
  }
}