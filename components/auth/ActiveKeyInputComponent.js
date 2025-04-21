import Component from '../Component.js';
import eventEmitter from '../../utils/EventEmitter.js';

class ActiveKeyInputComponent extends Component {
    constructor() {
        super();
        this.modalId = 'activeKeyModalOverlay-' + Math.random().toString(36).substring(2, 9);
        this.formId = 'activeKeyForm-' + Math.random().toString(36).substring(2, 9);
    }

    async promptForActiveKey(title = 'Enter Active Key') {
        console.log("ActiveKeyInputComponent: promptForActiveKey called");
        
        return new Promise((resolve) => {
            // Create modal HTML directly
            const modalHTML = `
                <div class="auth-modal-overlay" id="${this.modalId}">
                    <div class="auth-modal-content">
                        <h3 class="auth-modal-header">${title}</h3>
                        <form class="auth-form" id="${this.formId}">
                            <div class="auth-input-group">
                                <input type="password" 
                                       id="activeKeyInput-${this.modalId}" 
                                       class="auth-input" 
                                       placeholder="Your Active Key" 
                                       required>
                                <div class="auth-error" id="keyError-${this.modalId}"></div>
                            </div>
                            
                            <div class="auth-security-note">
                                <strong>Security Note:</strong> Your key is never stored and is only used for this transaction.
                            </div>
                            
                            <div class="auth-modal-footer">
                                <button type="button" class="auth-btn auth-btn-secondary" id="cancelKeyBtn-${this.modalId}">Cancel</button>
                                <button type="submit" class="auth-btn auth-btn-primary" id="submitKeyBtn-${this.modalId}">Submit</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Insert modal into DOM
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer.firstElementChild);
            
            console.log("Active key modal inserted into DOM");
            
            // Get references to modal elements
            const modal = document.getElementById(this.modalId);
            const form = document.getElementById(this.formId);
            const keyInput = document.getElementById(`activeKeyInput-${this.modalId}`);
            const keyError = document.getElementById(`keyError-${this.modalId}`);
            const cancelBtn = document.getElementById(`cancelKeyBtn-${this.modalId}`);
            
            // Setup cleanup function
            let cleanup = () => {
                if (modal && document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                console.log("Active key modal cleaned up");
            };
            
            // Validate and clean the active key
            const validateActiveKey = (key) => {
                // Remove spaces at the beginning and end
                let cleanedKey = key.trim();
                
                // Check that it starts with "5" (typical of Active Steem keys)
                if (!cleanedKey.startsWith('5')) {
                    return { valid: false, key: cleanedKey, error: 'Invalid Active key format. Active keys typically begin with "5".' };
                }
                
                // Check the length (private Steem keys are typically 51-52 characters)
                if (cleanedKey.length < 50 || cleanedKey.length > 53) {
                    return { valid: false, key: cleanedKey, error: 'Invalid key length. Active keys are typically 51-52 characters long.' };
                }
                
                // Check for invalid characters in the Base58 format
                const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
                if (!base58Regex.test(cleanedKey)) {
                    return { valid: false, key: cleanedKey, error: 'Key contains invalid characters. Only base58 characters are allowed.' };
                }
                
                return { valid: true, key: cleanedKey, error: null };
            };
            
            // Add event listeners
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    console.log("Active key form submitted");
                    
                    // Validate the key before proceeding
                    const rawKey = keyInput.value;
                    const validation = validateActiveKey(rawKey);
                    
                    if (!validation.valid) {
                        // Show the error
                        keyError.textContent = validation.error;
                        keyError.style.display = 'block';
                        console.log("Key validation failed:", validation.error);
                        return;
                    }
                    
                    // Proceed with the validated key
                    cleanup();
                    resolve(validation.key);
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    console.log("Active key cancel button clicked");
                    cleanup();
                    resolve(null);
                });
            }
            
            // Focus on the input field with a slight delay
            if (keyInput) {
                setTimeout(() => {
                    keyInput.focus();
                    console.log("Active key input focused");
                }, 100);
            }
            
            console.log("Active key modal should now be visible");
            
            // Prevent accidental closing of the modal
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }
            
            // Prevent closing with the ESC key
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
            
            // Add cleanup for the event listener
            const originalCleanup = cleanup;
            cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                originalCleanup();
            };
        });
    }
}

export default new ActiveKeyInputComponent();