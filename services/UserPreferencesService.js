/**
 * Service for managing user preferences
 */
class UserPreferencesService {
    constructor() {
        this.PREFERENCES_KEY = 'steemee_user_preferences';
        this.preferences = this.loadPreferences();
    }

    /**
     * Loads user preferences from localStorage
     * @returns {Object} User preferences object
     */
    loadPreferences() {
        try {
            const storedPreferences = localStorage.getItem(this.PREFERENCES_KEY);
            return storedPreferences ? JSON.parse(storedPreferences) : {
                // Default preferences
                preferredTags: [],
                homeViewMode: 'trending', // Default view mode (trending, hot, new, custom)
                theme: 'light', // Default theme
                widgetSidebarState: 'expanded' // Default widget sidebar state
            };
        } catch (error) {
            console.error('Failed to load user preferences:', error);
            return {
                preferredTags: [],
                homeViewMode: 'trending',
                theme: 'light',
                widgetSidebarState: 'expanded'
            };
        }
    }

    /**
     * Saves user preferences to localStorage
     * @returns {boolean} Success status
     */
    savePreferences() {
        try {
            localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.preferences));
            return true;
        } catch (error) {
            console.error('Failed to save user preferences:', error);
            return false;
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
    }

    /**
     * Set home view mode
     * @param {string} mode - View mode ('trending', 'hot', 'new', 'custom')
     * @returns {boolean} Success status
     */
    setHomeViewMode(mode) {
        // Only allow setting to 'custom' if there are preferred tags
        if (mode === 'custom' && (!this.preferences.preferredTags || this.preferences.preferredTags.length === 0)) {
            console.error('Cannot set home view mode to custom without preferred tags');
            return false;
        }
        
        if (!['trending', 'hot', 'new', 'custom'].includes(mode)) {
            console.error('Invalid home view mode:', mode);
            return false;
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
     * Get widget sidebar state
     * @returns {string} Current widget sidebar state ('expanded' or 'collapsed')
     */
    getWidgetSidebarState() {
        return this.preferences.widgetSidebarState || 'expanded';
    }
    
    /**
     * Save widget sidebar state
     * @param {string} state - Widget sidebar state ('expanded' or 'collapsed')
     * @returns {boolean} Success status
     */
    saveWidgetSidebarState(state) {
        if (!['expanded', 'collapsed'].includes(state)) {
            console.error('Invalid widget sidebar state:', state);
            return false;
        }
        
        this.preferences.widgetSidebarState = state;
        return this.savePreferences();
    }
}

// Create and export a singleton instance
const userPreferencesService = new UserPreferencesService();
export default userPreferencesService;