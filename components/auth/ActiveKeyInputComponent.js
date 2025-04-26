import Component from '../Component.js';
import eventEmitter from '../../utils/EventEmitter.js';

class ActiveKeyInputComponent extends Component {
    constructor() {
        super();
        this.modalId = 'activeKeyModalOverlay-' + Math.random().toString(36).substring(2, 9);
        this.formId = 'activeKeyForm-' + Math.random().toString(36).substring(2, 9);
    }

    async promptForActiveKey(title = 'Enter Active Key') {
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
            };
            
            // Validate and clean the active key
            const validateActiveKey = (key) => {
                let cleanedKey = key.trim();
                
                if (!cleanedKey.startsWith('5')) {
                    return { valid: false, key: cleanedKey, error: 'Invalid Active key format. Active keys typically begin with "5".' };
                }
                
                if (cleanedKey.length < 50 || cleanedKey.length > 53) {
                    return { valid: false, key: cleanedKey, error: 'Invalid key length. Active keys are typically 51-52 characters long.' };
                }
                
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
                    
                    const rawKey = keyInput.value;
                    const validation = validateActiveKey(rawKey);
                    
                    if (!validation.valid) {
                        keyError.textContent = validation.error;
                        keyError.style.display = 'block';
                        return;
                    }
                    
                    cleanup();
                    resolve(validation.key);
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(null);
                });
            }
            
            if (keyInput) {
                setTimeout(() => {
                    keyInput.focus();
                }, 100);
            }
            
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }
            
            // Intercetta il tasto Escape ma impedisci la sua funzione predefinita
            // senza eseguire alcuna azione (non chiudere il modal)
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Non fare nulla quando viene premuto Escape
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
            
            const originalCleanup = cleanup;
            cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                originalCleanup();
            };
        });
    }
}

export default new ActiveKeyInputComponent();