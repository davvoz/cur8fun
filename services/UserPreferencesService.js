/**
 * Service for managing user preferences
 */
class UserPreferencesService {
    constructor() {
        this.PREFERENCES_KEY = 'steemee_user_preferences';
        this.preferences = this.loadPreferences();
    }    /**
     * Loads user preferences from localStorage
     * @returns {Object} User preferences object
     */
    loadPreferences() {
        try {
            const storedPreferences = localStorage.getItem(this.PREFERENCES_KEY);
            const defaultPreferences = {
                // Default preferences
                preferredTags: [],
                homeViewMode: 'trending', // Default view mode (trending, hot, new, custom)
                theme: 'light', // Default theme
                cookieConsent: null, // null = not asked, true = accepted, false = declined
                analyticsEnabled: false // Google Analytics tracking
            };
            
            const preferences = storedPreferences ? JSON.parse(storedPreferences) : defaultPreferences;
            
            // Safety check for null or undefined values
            if (!preferences || typeof preferences !== 'object') {
                console.warn('Invalid preferences format, using defaults');
                return defaultPreferences;
            }
            
            // Ensure all required keys exist with proper defaults
            if (!Array.isArray(preferences.preferredTags)) {
                preferences.preferredTags = [];
            }
            
            if (!['trending', 'hot', 'new', 'custom'].includes(preferences.homeViewMode)) {
                preferences.homeViewMode = 'trending';
            }
            
            if (preferences.homeViewMode === 'custom' && preferences.preferredTags.length === 0) {
                // Cannot have custom mode without tags
                preferences.homeViewMode = 'trending';
            }
            
            if (!preferences.theme) {
                preferences.theme = 'light';
            }
            
            // Add cookie consent defaults if missing
            if (preferences.cookieConsent === undefined) {
                preferences.cookieConsent = null;
            }
            
            if (preferences.analyticsEnabled === undefined) {
                preferences.analyticsEnabled = false;
            }
            
            return preferences;
        } catch (error) {
            console.error('Failed to load user preferences:', error);
            return {
                preferredTags: [],
                homeViewMode: 'trending',
                theme: 'light',
                cookieConsent: null,
                analyticsEnabled: false
            };
        }
    }/**
     * Saves user preferences to localStorage
     * @returns {boolean} Success status
     */
    savePreferences() {
        try {
            // Validate preferences before saving
            this.validatePreferences();
            
            // Try to save to localStorage
            localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.preferences));
            
            // Verify the save was successful by reading it back
            const saved = localStorage.getItem(this.PREFERENCES_KEY);
            const parsed = JSON.parse(saved);
            
            if (!parsed) {
                console.error('Preferences save verification failed: empty or invalid data');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Failed to save user preferences:', error);
            return false;
        }
    }
    
    /**
     * Validates and repairs preferences object if needed
     * @private
     */
    validatePreferences() {
        // Ensure preferences object exists
        if (!this.preferences) {
            this.preferences = {};
        }
        
        // Ensure preferredTags is an array
        if (!Array.isArray(this.preferences.preferredTags)) {
            this.preferences.preferredTags = [];
        }
        
        // Validate homeViewMode is valid
        if (!['trending', 'hot', 'new', 'custom'].includes(this.preferences.homeViewMode)) {
            this.preferences.homeViewMode = 'trending';
        }
        
        // If homeViewMode is custom but no tags, reset to trending
        if (this.preferences.homeViewMode === 'custom' && this.preferences.preferredTags.length === 0) {
            this.preferences.homeViewMode = 'trending';
        }
    }

    /**
     * Gets the user preferred tags
     * @returns {Array} Array of preferred tags
     */
    getPreferredTags() {
        return this.preferences.preferredTags || [];
    }

    /**
     * Sets user preferred tags
     * @param {Array} tags Array of tag strings
     * @returns {boolean} Success status
     */
    setPreferredTags(tags) {
        if (!Array.isArray(tags)) {
            console.error('Tags must be an array');
            return false;
        }
        
        // Filter and format tags
        const formattedTags = tags
            .map(tag => tag.toLowerCase().trim())
            .filter(tag => tag.length > 0)
            .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
        
        this.preferences.preferredTags = formattedTags;
        
        // If user has preferred tags, automatically set home view mode to custom
        if (formattedTags.length > 0) {
            this.preferences.homeViewMode = 'custom';
        } else {
            // If no preferred tags, default to trending
            this.preferences.homeViewMode = 'trending';
        }
        
        return this.savePreferences();
    }

    /**
     * Adds a single tag to preferred tags
     * @param {string} tag Tag to add
     * @returns {boolean} Success status
     */
    addPreferredTag(tag) {
        if (!tag || typeof tag !== 'string') {
            return false;
        }
        
        const formattedTag = tag.toLowerCase().trim();
        
        if (formattedTag.length === 0) {
            return false;
        }
        
        if (!this.preferences.preferredTags) {
            this.preferences.preferredTags = [];
        }
        
        if (!this.preferences.preferredTags.includes(formattedTag)) {
            this.preferences.preferredTags.push(formattedTag);
            
            // If this is the first tag, update home view mode to custom
            if (this.preferences.preferredTags.length === 1) {
                this.preferences.homeViewMode = 'custom';
            }
            
            return this.savePreferences();
        }
        
        return true; // Tag already exists, no need to save
    }

    /**
     * Removes a tag from preferred tags
     * @param {string} tag Tag to remove
     * @returns {boolean} Success status
     */
    removePreferredTag(tag) {
        if (!tag || !this.preferences.preferredTags) {
            return false;
        }
        
        const formattedTag = tag.toLowerCase().trim();
        const initialLength = this.preferences.preferredTags.length;
        
        this.preferences.preferredTags = this.preferences.preferredTags.filter(t => t !== formattedTag);
        
        // If all tags are removed, set home view mode back to trending
        if (this.preferences.preferredTags.length === 0) {
            this.preferences.homeViewMode = 'trending';
        }
        
        if (this.preferences.preferredTags.length !== initialLength) {
            return this.savePreferences();
        }
        
        return true; // Tag wasn't in the list, no need to save
    }

    /**
     * Get home view mode
     * @returns {string} Current home view mode
     */
    getHomeViewMode() {
        return this.preferences.homeViewMode || 'trending';
    }    /**
     * Set home view mode
     * @param {string} mode - View mode ('trending', 'hot', 'new', 'custom')
     * @returns {boolean} Success status
     */
    setHomeViewMode(mode) {
        // Only allow setting to 'custom' if there are preferred tags
        if (mode === 'custom' && (!this.preferences.preferredTags || this.preferences.preferredTags.length === 0)) {
            console.error('Cannot set home view mode to custom without preferred tags');
            // Fallback to trending if custom is invalid
            mode = 'trending';
        }
        
        if (!['trending', 'hot', 'new', 'custom'].includes(mode)) {
            console.error('Invalid home view mode:', mode);
            // Use a default value if invalid
            mode = 'trending';
        }
        
        this.preferences.homeViewMode = mode;
        return this.savePreferences();
    }
    
    /**
     * Check if custom home is configured
     * @returns {boolean} True if custom home is configured with tags
     */
    isCustomHomeConfigured() {
        return this.preferences.homeViewMode === 'custom' && 
               this.preferences.preferredTags && 
               this.preferences.preferredTags.length > 0;
    }
    
    /**
     * Get cookie consent status
     * @returns {boolean|null} True if accepted, false if declined, null if not asked
     */
    getCookieConsent() {
        return this.preferences.cookieConsent;
    }
    
    /**
     * Set cookie consent status
     * @param {boolean} consent - True to accept, false to decline
     * @returns {boolean} Success status
     */
    setCookieConsent(consent) {
        this.preferences.cookieConsent = consent;
        this.preferences.analyticsEnabled = consent;
        
        // Initialize or disable Google Analytics based on consent
        if (consent && window.initializeGoogleAnalytics) {
            window.initializeGoogleAnalytics();
        } else if (!consent && window.disableGoogleAnalytics) {
            window.disableGoogleAnalytics();
        }
        
        return this.savePreferences();
    }
    
    /**
     * Check if analytics is enabled
     * @returns {boolean} True if analytics tracking is enabled
     */
    isAnalyticsEnabled() {
        return this.preferences.analyticsEnabled === true;
    }
    
    /**
     * Check if cookie consent banner should be shown
     * @returns {boolean} True if consent hasn't been given yet
     */
    shouldShowCookieBanner() {
        return this.preferences.cookieConsent === null;
    }
}

// Create and export a singleton instance
const userPreferencesService = new UserPreferencesService();
export default userPreferencesService;