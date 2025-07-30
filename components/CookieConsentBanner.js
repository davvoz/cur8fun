import Component from './Component.js';
import userPreferencesService from '../services/UserPreferencesService.js';

/**
 * Cookie Consent Banner Component
 * Shows a banner to request user consent for cookies and analytics
 */
class CookieConsentBanner extends Component {
    constructor(parentElement, options = {}) {
        super(parentElement, options);
        this.isVisible = false;
    }

    /**
     * Check if banner should be shown and render it
     */
    checkAndShow() {
        if (userPreferencesService.shouldShowCookieBanner()) {
            this.show();
        }
    }

    /**
     * Show the cookie consent banner
     */
    show() {
        if (this.isVisible || this.element) {
            return;
        }

        this.render();
        this.isVisible = true;
    }

    /**
     * Hide the cookie consent banner
     */
    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
            this.isVisible = false;
        }
    }

    /**
     * Render the cookie consent banner
     */
    render() {
        // Create banner container
        const banner = document.createElement('div');
        banner.className = 'cookie-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'cookie-banner-title');
        banner.setAttribute('aria-describedby', 'cookie-banner-desc');

        // Banner content
        banner.innerHTML = `
            <div class="cookie-banner-content">
                <div class="cookie-banner-icon">
                    <span class="material-icons">cookie</span>
                </div>
                <div class="cookie-banner-text">
                    <h3 id="cookie-banner-title">🍪 Cookie e Privacy</h3>
                    <p id="cookie-banner-desc">
                        Utilizziamo Google Analytics per migliorare l'esperienza utente. 
                        I dati sono anonimi e non vengono condivisi con terze parti per scopi pubblicitari.
                        <a href="#" class="cookie-info-link" id="learn-more-link">Maggiori informazioni</a>
                    </p>
                </div>
                <div class="cookie-banner-actions">
                    <button class="cookie-btn cookie-btn-decline" id="decline-cookies">
                        Rifiuta
                    </button>
                    <button class="cookie-btn cookie-btn-accept" id="accept-cookies">
                        Accetta
                    </button>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(banner);
        this.element = banner;

        // Register event handlers
        this.registerEventHandler(
            banner.querySelector('#accept-cookies'), 
            'click', 
            this.handleAccept.bind(this)
        );

        this.registerEventHandler(
            banner.querySelector('#decline-cookies'), 
            'click', 
            this.handleDecline.bind(this)
        );

        this.registerEventHandler(
            banner.querySelector('#learn-more-link'), 
            'click', 
            this.handleLearnMore.bind(this)
        );

        // Add entrance animation
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);

        return banner;
    }

    /**
     * Handle accept cookies
     */
    handleAccept() {
        userPreferencesService.setCookieConsent(true);
        this.hideWithAnimation();
        
        // Track the consent event (ironically, now that we have consent)
        if (window.gtag) {
            gtag('event', 'cookie_consent', {
                'consent_action': 'accept',
                'event_category': 'privacy'
            });
        }
    }

    /**
     * Handle decline cookies
     */
    handleDecline() {
        userPreferencesService.setCookieConsent(false);
        this.hideWithAnimation();
    }

    /**
     * Handle learn more click
     */
    handleLearnMore(event) {
        event.preventDefault();
        this.showPrivacyModal();
    }

    /**
     * Hide banner with animation
     */
    hideWithAnimation() {
        if (this.element) {
            this.element.classList.add('hide');
            setTimeout(() => {
                this.hide();
            }, 300);
        }
    }

    /**
     * Show privacy information modal
     */
    showPrivacyModal() {
        const modal = document.createElement('div');
        modal.className = 'privacy-modal-overlay';
        modal.innerHTML = `
            <div class="privacy-modal">
                <div class="privacy-modal-header">
                    <h2>🔒 Informazioni sulla Privacy</h2>
                    <button class="privacy-modal-close" aria-label="Chiudi">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="privacy-modal-content">
                    <h3>🍪 Cosa sono i cookie?</h3>
                    <p>I cookie sono piccoli file di testo salvati sul tuo dispositivo quando visiti un sito web.</p>
                    
                    <h3>📊 Google Analytics</h3>
                    <p>Utilizziamo Google Analytics per:</p>
                    <ul>
                        <li>Contare i visitatori e capire come utilizzano il sito</li>
                        <li>Migliorare l'esperienza utente</li>
                        <li>Identificare problemi tecnici</li>
                    </ul>
                    
                    <h3>🛡️ La tua privacy</h3>
                    <p>I tuoi dati sono:</p>
                    <ul>
                        <li><strong>Anonimi:</strong> L'IP viene anonimizzato</li>
                        <li><strong>Non commerciali:</strong> Non usiamo i dati per pubblicità</li>
                        <li><strong>Sicuri:</strong> Non condividiamo informazioni personali</li>
                    </ul>
                    
                    <h3>⚙️ Controllo</h3>
                    <p>Puoi sempre modificare le tue preferenze nelle impostazioni dell'app.</p>
                    
                    <div class="privacy-modal-actions">
                        <button class="cookie-btn cookie-btn-decline" id="modal-decline">
                            Rifiuta Cookies
                        </button>
                        <button class="cookie-btn cookie-btn-accept" id="modal-accept">
                            Accetta Cookies
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers for modal
        const closeBtn = modal.querySelector('.privacy-modal-close');
        const acceptBtn = modal.querySelector('#modal-accept');
        const declineBtn = modal.querySelector('#modal-decline');

        const closeModal = () => {
            modal.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        acceptBtn.addEventListener('click', () => {
            this.handleAccept();
            closeModal();
        });

        declineBtn.addEventListener('click', () => {
            this.handleDecline();
            closeModal();
        });

        // ESC key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}

export default CookieConsentBanner;
