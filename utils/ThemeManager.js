/**
 * ThemeManager - Handles theme switching between light and dark modes
 */
class ThemeManager {
  constructor() {
    this.THEME_KEY = 'steem-theme-preference';
    this.DARK_THEME = 'dark';
    this.LIGHT_THEME = 'light';
    this.systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Initialize the theme manager
   */
  init() {
    // Set initial theme based on saved preference or system preference
    this.applyTheme(this.getCurrentTheme());
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', e => {
        this.systemPrefersDark = e.matches;
        // Only apply if using system preference (no saved preference)
        if (!localStorage.getItem(this.THEME_KEY)) {
          this.applyTheme(this.systemPrefersDark ? this.DARK_THEME : this.LIGHT_THEME);
        }
      });
  }

  /**
   * Get the current theme based on saved preference or system preference
   */
  getCurrentTheme() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    return savedTheme || (this.systemPrefersDark ? this.DARK_THEME : this.LIGHT_THEME);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Set a specific theme
   */
  setTheme(theme) {
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  /**
   * Apply the theme to the document
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers.
    // Two tags exist with prefers-color-scheme media queries; when the user
    // picks a theme explicitly we override both so the chosen theme wins
    // regardless of OS preference.
    const color = theme === this.DARK_THEME ? '#1a1a1a' : '#f5f7fa';
    document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
      tag.setAttribute('content', color);
    });
    const navButton = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (navButton) navButton.setAttribute('content', color);
  }
}

// Export singleton instance
export default new ThemeManager();