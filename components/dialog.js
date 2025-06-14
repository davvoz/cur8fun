/**
 * Displays a result dialog for API operations
 * @param {Object} result - The result object from API
 * @param {string} type - Dialog type (success, error, warning, info)
 * @param {boolean} modal - Whether dialog should be modal
 * @returns {HTMLElement} - The created dialog element
 */
export function displayResult(result, type = 'info', modal = false) {
    // Remove any existing dialogs
    const existingDialogs = document.querySelectorAll('.result-dialog');
    existingDialogs.forEach(dialog => dialog.remove());
    
    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = `result-dialog ${type}-dialog`;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    // Set icon based on type
    const icon = document.createElement('span');
    icon.className = 'dialog-icon material-icons';
    switch (type) {
        case 'success':
            icon.textContent = 'check_circle';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('Success'));
            break;
        case 'error':
            icon.textContent = 'error';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('Error'));
            break;
        case 'warning':
            icon.textContent = 'warning';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('Warning'));
            break;
        default:
            icon.textContent = 'info';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('Information'));
    }
    
    dialog.appendChild(header);
    
    // Create content
    const content = document.createElement('div');
    content.className = 'dialog-content';
    
    if (typeof result === 'string') {
        content.textContent = result;
    } else if (result.error) {
        content.textContent = result.error;
    } else if (result.message) {
        content.textContent = result.message;
    } else {
        content.textContent = JSON.stringify(result);
    }
    
    dialog.appendChild(content);
    
    // Create footer with close button
    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'dialog-button';
    closeButton.onclick = () => {
        dialog.remove();
        // Remove modal overlay if it exists
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            overlay.remove();
        }
    };
    
    footer.appendChild(closeButton);
    dialog.appendChild(footer);
    
    // Create modal overlay if modal
    if (modal) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
        
        // Prevent closing on click outside for modal dialogs
        overlay.onclick = (e) => {
            if (e.target === overlay && !modal) {
                dialog.remove();
                overlay.remove();
            }
        };
    }
    
    // Add dialog to body
    document.body.appendChild(dialog);
    
    // Auto-close non-error, non-modal dialogs after 5 seconds
    if (type !== 'error' && !modal) {
        setTimeout(() => {
            if (document.body.contains(dialog)) {
                dialog.remove();
                const overlay = document.querySelector('.modal-overlay');
                if (overlay) {
                    overlay.remove();
                }
            }
        }, 5000);
    }
    
    return dialog;
}

/**
 * Shows a confirmation dialog
 * @param {string} message - The confirmation message
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
export function showConfirmation(message, onConfirm, onCancel) {
    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'result-dialog confirmation-dialog';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    const icon = document.createElement('span');
    icon.className = 'dialog-icon material-icons';
    icon.textContent = 'help';
    header.appendChild(icon);
    header.appendChild(document.createTextNode('Confirmation'));
    
    dialog.appendChild(header);
    
    // Create content
    const content = document.createElement('div');
    content.className = 'dialog-content';
    content.textContent = message;
    
    dialog.appendChild(content);
    
    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'dialog-button secondary-button';
    cancelButton.onclick = () => {
        if (onCancel) onCancel();
        dialog.remove();
        overlay.remove();
    };
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    confirmButton.className = 'dialog-button primary-button';
    confirmButton.onclick = () => {
        if (onConfirm) onConfirm();
        dialog.remove();
        overlay.remove();
    };
    
    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);
    dialog.appendChild(footer);
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    return dialog;
}