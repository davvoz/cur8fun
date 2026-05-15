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

  /**
   * Gate active-key operations: if no active key is in memory, transform all
   * submit buttons inside this.element into "Unlock wallet" buttons.
   * After the user enters their active key the buttons revert to normal.
   */
  async _applyActiveKeyGate() {
    if (!this.element) return;

    // Dynamic import avoids a circular dependency (ActiveKeyInputComponent extends Component)
    const { default: authService } = await import('../services/AuthService.js');

    const user = authService.getCurrentUser();
    // Keychain and SteemLogin never need a manual key entry
    if (!user || user.loginMethod === 'keychain' || user.loginMethod === 'steemlogin') return;
    if (authService.getActiveKey()) return; // already unlocked in this session
    if (authService.hasActiveKeyPinProtected()) return; // PIN-protected in localStorage — _broadcastOperation will unlock on demand

    const submitBtns = this.element.querySelectorAll('button[type="submit"]');
    if (!submitBtns.length) return;

    submitBtns.forEach(btn => {
      // Save original state
      btn.dataset.walletLocked = '1';
      btn.dataset.originalHtml = btn.innerHTML;
      btn.dataset.originalClass = btn.className;
      btn.dataset.originalDisabled = btn.disabled ? '1' : '';

      // Unlock appearance
      btn.innerHTML = '<span class="material-icons" style="font-size:16px;vertical-align:text-bottom;margin-right:6px">lock_open</span>Unlock wallet';
      btn.className = 'btn btn-secondary';
      btn.disabled = false;
      btn.type = 'button'; // prevent form submit

      const handler = async () => {
        const { default: authService } = await import('../services/AuthService.js');
        const user = authService.getCurrentUser();
        if (!user) return;

        const { default: activeKeyInput } = await import('./auth/ActiveKeyInputComponent.js');
        const key = await activeKeyInput.promptForActiveKey('Enter Active Key', {
          validate: (k) => authService.verifyKey(user.username, k, 'active'),
        });
        if (!key) return;

        // Ask the user to set a PIN to protect the active key
        const { default: pinInput } = await import('./auth/PinInputComponent.js');
        const pin = await pinInput.promptSetPin('Set a PIN for your Active Key');
        if (!pin) return; // user cancelled PIN setup

        await authService.storeActiveKeyWithPin(user.username, key, pin);

        // Restore ALL locked wallet buttons across every tab in the page
        document.querySelectorAll('button[data-wallet-locked]').forEach(b => {
          b.innerHTML = b.dataset.originalHtml;
          b.className = b.dataset.originalClass;
          b.type = 'submit';
          b.disabled = b.dataset.originalDisabled === '1';
          if (b._walletUnlockHandler) {
            b.removeEventListener('click', b._walletUnlockHandler);
            delete b._walletUnlockHandler;
          }
          delete b.dataset.walletLocked;
          delete b.dataset.originalHtml;
          delete b.dataset.originalClass;
          delete b.dataset.originalDisabled;
        });

        // Re-run submit-state validator for this component
        this._updateSubmitState?.();
      };

      btn._walletUnlockHandler = handler;
      btn.addEventListener('click', handler);
    });
  }
}