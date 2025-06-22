/**
 * Standard Dialog Utility
 * Provides reusable dialog components following the project's standard pattern
 */

class DialogUtility {
  /**
   * Show a standard confirmation dialog
   * @param {Object} options - Dialog configuration
   * @returns {Promise<boolean>} - true if confirmed, false if cancelled
   */
  static async showConfirmationDialog(options = {}) {
    const {
      title = 'Confirm Action',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      icon = 'help',
      type = 'warning', // 'warning', 'danger', 'info'
      details = null,
      showPreview = false,
      previewData = null
    } = options;

    return new Promise((resolve) => {
      // Check if dialog already exists and remove it
      const existingDialog = document.querySelector('.standard-dialog-overlay');
      if (existingDialog) {
        existingDialog.remove();
      }

      const dialog = document.createElement('div');
      dialog.className = 'standard-dialog-overlay modal-overlay';
      
      const iconClass = type === 'danger' ? 'error' : icon;
      const confirmButtonClass = type === 'danger' ? 'danger-btn' : 'primary-btn';

      dialog.innerHTML = `
        <div class="modal-dialog standard-dialog">
          <div class="modal-header">
            <h3>
              <span class="material-icons">${iconClass}</span>
              ${this.escapeHtml(title)}
            </h3>
            <button class="close-button" type="button" aria-label="Close">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="dialog-message">
              <p>${this.escapeHtml(message)}</p>
            </div>
            ${details ? `
              <div class="dialog-details">
                ${details}
              </div>
            ` : ''}
            ${showPreview && previewData ? `
              <div class="dialog-preview">
                ${previewData}
              </div>
            ` : ''}
            ${type === 'danger' ? `
              <div class="warning-box">
                <span class="material-icons">warning</span>
                <div class="warning-content">
                  <strong>This action cannot be undone!</strong>
                  <p>Please make sure you want to proceed with this action.</p>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary-btn cancel-action" id="cancel-action">
              <span class="material-icons">close</span>
              ${this.escapeHtml(cancelText)}
            </button>
            <button type="button" class="btn ${confirmButtonClass} confirm-action" id="confirm-action">
              <span class="material-icons">${type === 'danger' ? 'warning' : 'check'}</span>
              ${this.escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Standard event handling
      this.setupDialogEventHandlers(dialog, resolve);
    });
  }

  /**
   * Show a standard info dialog
   * @param {Object} options - Dialog configuration
   * @returns {Promise<void>} - resolves when dialog is closed
   */
  static async showInfoDialog(options = {}) {
    const {
      title = 'Information',
      message = '',
      buttonText = 'OK',
      icon = 'info',
      details = null
    } = options;

    return new Promise((resolve) => {
      const existingDialog = document.querySelector('.standard-dialog-overlay');
      if (existingDialog) {
        existingDialog.remove();
      }

      const dialog = document.createElement('div');
      dialog.className = 'standard-dialog-overlay modal-overlay';

      dialog.innerHTML = `
        <div class="modal-dialog standard-dialog">
          <div class="modal-header">
            <h3>
              <span class="material-icons">${icon}</span>
              ${this.escapeHtml(title)}
            </h3>
            <button class="close-button" type="button" aria-label="Close">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="dialog-message">
              <p>${this.escapeHtml(message)}</p>
            </div>
            ${details ? `
              <div class="dialog-details">
                ${details}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn primary-btn ok-action" id="ok-action">
              <span class="material-icons">check</span>
              ${this.escapeHtml(buttonText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Simplified event handling for info dialog
      const closeBtn = dialog.querySelector('.close-button');
      const okBtn = dialog.querySelector('#ok-action');

      const cleanup = () => {
        try {
          if (dialog.parentNode) {
            document.body.removeChild(dialog);
          }
        } catch (error) {
          console.warn('Dialog cleanup error:', error);
        }
      };

      const handleClose = () => {
        cleanup();
        resolve();
      };

      closeBtn.addEventListener('click', handleClose);
      okBtn.addEventListener('click', handleClose);

      // ESC key and overlay click
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          handleClose();
        }
      });

      document.addEventListener('keydown', escapeHandler);

      // Focus on OK button
      setTimeout(() => okBtn.focus(), 100);
    });
  }

  /**
   * Setup standard event handlers for dialogs
   * @private
   */
  static setupDialogEventHandlers(dialog, resolve) {
    const closeBtn = dialog.querySelector('.close-button');
    const cancelBtn = dialog.querySelector('#cancel-action');
    const confirmBtn = dialog.querySelector('#confirm-action');

    // Focus on cancel button for safety
    setTimeout(() => {
      if (cancelBtn) cancelBtn.focus();
    }, 100);

    // Cleanup function
    const cleanup = () => {
      try {
        if (dialog.parentNode) {
          document.body.removeChild(dialog);
        }
      } catch (error) {
        console.warn('Dialog cleanup error:', error);
      }
      document.removeEventListener('keydown', escapeHandler);
    };

    // Event handlers
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    // Bind events
    closeBtn.addEventListener('click', handleCancel);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);

    // Keyboard handling
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && document.activeElement === confirmBtn) {
        handleConfirm();
      }
    };

    // Overlay click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        handleCancel();
      }
    });

    // Tab trapping
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = dialog.querySelectorAll('button:not([disabled])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });

    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
export default DialogUtility;

// Example usage:
/*
// Basic confirmation
const confirmed = await DialogUtility.showConfirmationDialog({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this item?',
  type: 'danger'
});

// Info dialog
await DialogUtility.showInfoDialog({
  title: 'Success',
  message: 'Item was deleted successfully!',
  icon: 'check_circle'
});

// Custom confirmation with details
const confirmed = await DialogUtility.showConfirmationDialog({
  title: 'Delete Draft',
  message: 'Are you sure you want to delete this draft?',
  type: 'danger',
  details: `
    <div class="item-preview">
      <h4>Draft Title</h4>
      <p>Draft content preview...</p>
    </div>
  `,
  confirmText: 'Delete',
  cancelText: 'Keep'
});
*/
