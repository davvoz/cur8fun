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
  }
  
  /**
   * Render the component into its parent element
   */
  render() {
    // Abstract method to be implemented by subclasses
  }
  
  /**
   * Register event handler for cleanup
   * @param {HTMLElement} element - Element with event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  registerEventHandler(element, event, callback) {
    element.addEventListener(event, callback);
    this.eventHandlers.push({ element, event, callback });
  }
  
  /**
   * Clean up component resources
   */
  destroy() {
    // Remove event listeners
    this.eventHandlers.forEach(({ element, event, callback }) => {
      element.removeEventListener(event, callback);
    });
    this.eventHandlers = [];
  }
}