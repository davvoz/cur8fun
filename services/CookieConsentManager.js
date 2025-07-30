/**
 * Centralized Cookie Consent Manager
 * Handles Google Analytics initialization and cookie consent across the entire application
 */
import userPreferencesService from './UserPreferencesService.js';
import CookieConsentBanner from '../components/CookieConsentBanner.js';

class CookieConsentManager {
    constructor() {
        this.isInitialized = false;
        this.cookieBanner = null;
        this.analyticsInitialized = false;
    }

    /**
     * Initialize the cookie consent system
     * This should be called as early as possible in the application lifecycle
     */
    init() {
        if (this.isInitialized) {
            console.log('🍪 Cookie Consent Manager already initialized');
            return;
        }

        console.log('🍪 Initializing Cookie Consent Manager...');
        
        // Setup Google Analytics functions if not already defined
        this.setupGoogleAnalyticsFunctions();
        
        // Check current consent status and act accordingly
        this.checkExistingConsent();
        
        // Show banner if consent is needed
        this.showBannerIfNeeded();
        
        this.isInitialized = true;
        console.log('🍪 Cookie Consent Manager initialized');
    }

    /**
     * Setup global Google Analytics functions
     */
    setupGoogleAnalyticsFunctions() {
        // Only setup if not already defined
        if (!window.initializeGoogleAnalytics) {
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            
            window.initializeGoogleAnalytics = () => {
                if (this.analyticsInitialized) {
                    console.log('🍪 Google Analytics already initialized');
                    return;
                }

                console.log('🍪 Initializing Google Analytics...');
                
                // Check if gtag function is already available (script may be loaded by other means)
                if (window.gtag && typeof window.gtag === 'function') {
                    console.log('🍪 gtag function already available, initializing configuration');
                    this.initializeGtagConfig();
                } else {
                    // Load gtag script dynamically
                    console.log('🍪 Loading Google Analytics script dynamically');
                    this.loadGoogleAnalyticsScript();
                }
            };

            window.disableGoogleAnalytics = () => {
                window['ga-disable-G-KH4ZJS7469'] = true;
                this.analyticsInitialized = false;
                console.log('🍪 Google Analytics disabled');
            };
        }
    }

    /**
     * Initialize gtag configuration
     */
    initializeGtagConfig() {
        try {
            if (!window.gtag || typeof window.gtag !== 'function') {
                throw new Error('gtag function not available');
            }

            window.gtag('js', new Date());
            window.gtag('config', 'G-KH4ZJS7469', {
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false
            });
            
            this.analyticsInitialized = true;
            console.log('🍪 Google Analytics configuration initialized successfully');
            
            // Test tracking call to verify everything works
            window.gtag('event', 'cookie_consent_system', {
                'event_category': 'system',
                'event_label': 'analytics_initialized',
                'custom_parameter': 'centralized_manager'
            });
            
        } catch (error) {
            console.error('🍪 Error initializing gtag configuration:', error);
            this.analyticsInitialized = false;
        }
    }

    /**
     * Load Google Analytics script dynamically if not present in DOM
     */
    /**
     * Load Google Analytics script dynamically
     */
    loadGoogleAnalyticsScript() {
        // Check if script is already being loaded or exists
        const existingScript = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
        if (existingScript) {
            console.log('🍪 Google Analytics script already exists in DOM');
            
            // If script is loaded but gtag is not available, wait a bit and retry
            if (existingScript.readyState === 'complete' || existingScript.readyState === 'loaded') {
                if (window.gtag) {
                    this.initializeGtagConfig();
                } else {
                    // Script loaded but gtag not ready, wait and retry
                    setTimeout(() => {
                        if (window.gtag) {
                            this.initializeGtagConfig();
                        } else {
                            console.warn('🍪 gtag script loaded but function not available, creating new script');
                            this.createNewGtagScript();
                        }
                    }, 100);
                }
            } else {
                // Script is still loading, add event listeners
                existingScript.addEventListener('load', () => {
                    console.log('🍪 Existing gtag script loaded');
                    this.initializeGtagConfig();
                });
                
                existingScript.addEventListener('error', () => {
                    console.warn('🍪 Existing gtag script failed to load, creating new one');
                    this.createNewGtagScript();
                });
            }
            return;
        }

        // No existing script found, create new one
        this.createNewGtagScript();
    }

    /**
     * Create a new gtag script element
     */
    createNewGtagScript() {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-KH4ZJS7469';
        script.id = 'gtag-script-dynamic';
        
        script.onload = () => {
            console.log('🍪 New gtag script loaded successfully');
            this.initializeGtagConfig();
        };

        script.onerror = (error) => {
            console.error('🍪 Error loading new gtag script:', error);
        };

        document.head.appendChild(script);
        console.log('🍪 New Google Analytics script added to DOM');
    }

    /**
     * Check existing consent and initialize analytics if needed
     */
    checkExistingConsent() {
        const consentStatus = userPreferencesService.getCookieConsent();
        
        console.log('🍪 Current consent status:', consentStatus);
        
        if (consentStatus === true) {
            // User has already consented, initialize analytics
            if (window.initializeGoogleAnalytics) {
                window.initializeGoogleAnalytics();
            }
        } else if (consentStatus === false) {
            // User has declined, make sure analytics is disabled
            if (window.disableGoogleAnalytics) {
                window.disableGoogleAnalytics();
            }
        }
        // If consentStatus is null, we'll show the banner
    }

    /**
     * Show cookie banner if consent is needed
     */
    showBannerIfNeeded() {
        if (userPreferencesService.shouldShowCookieBanner()) {
            this.showCookieBanner();
        }
    }

    /**
     * Show the cookie consent banner
     */
    showCookieBanner() {
        if (this.cookieBanner && this.cookieBanner.isVisible) {
            console.log('🍪 Cookie banner already visible');
            return;
        }

        console.log('🍪 Showing cookie consent banner');
        this.cookieBanner = new CookieConsentBanner(document.body);
        this.cookieBanner.checkAndShow();
    }

    /**
     * Hide the cookie banner if it's visible
     */
    hideCookieBanner() {
        if (this.cookieBanner) {
            this.cookieBanner.hide();
            this.cookieBanner = null;
        }
    }

    /**
     * Handle consent acceptance
     */
    acceptConsent() {
        console.log('🍪 Consent accepted via manager');
        userPreferencesService.setCookieConsent(true);
        this.hideCookieBanner();
        
        // Track the consent event
        if (window.gtag && this.analyticsInitialized) {
            window.gtag('event', 'cookie_consent', {
                'consent_action': 'accept',
                'event_category': 'privacy'
            });
        }
    }

    /**
     * Handle consent decline
     */
    declineConsent() {
        console.log('🍪 Consent declined via manager');
        userPreferencesService.setCookieConsent(false);
        this.hideCookieBanner();
    }

    /**
     * Get current consent status
     */
    getConsentStatus() {
        return userPreferencesService.getCookieConsent();
    }

    /**
     * Check if analytics is currently enabled
     */
    isAnalyticsEnabled() {
        return userPreferencesService.isAnalyticsEnabled() && this.analyticsInitialized;
    }

    /**
     * Reset consent (useful for testing or user preference changes)
     */
    resetConsent() {
        console.log('🍪 Resetting consent status');
        userPreferencesService.setCookieConsent(null);
        this.analyticsInitialized = false;
        this.showBannerIfNeeded();
    }
}

// Create and export singleton instance
const cookieConsentManager = new CookieConsentManager();

// Auto-initialize when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cookieConsentManager.init();
    });
} else {
    // DOM is already ready
    cookieConsentManager.init();
}

export default cookieConsentManager;
