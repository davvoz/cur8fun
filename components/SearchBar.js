import searchService from '../services/SearchService.js';

/**
 * Reusable search bar component that can be included in any page
 */
class SearchBar {
    /**
     * Create a search bar component
     * @param {Object} options - Component options
     * @param {string} [options.placeholder="Search..."] - Placeholder text for the input
     * @param {boolean} [options.autoFocus=false] - Whether to auto-focus the input
     * @param {string} [options.className=""] - Additional CSS classes for the container
     */
    constructor(options = {}) {
        this.placeholder = options.placeholder || 'Search...';
        this.autoFocus = options.autoFocus || false;
        this.className = options.className || '';
        this.element = null;
        this.inputElement = null;
        this.suggestionsElement = null;
    }
    
    /**
     * Render the search bar component
     * @param {HTMLElement} parentElement - Element where to render the search bar
     * @returns {HTMLElement} The container element
     */
    render(parentElement) {
        if (!parentElement) {
            console.error('Parent element is required');
            return null;
        }
        
        // Create container
        this.element = document.createElement('div');
        this.element.className = `header-search-container ${this.className}`;
        
        // Create search input
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.className = 'search-input';
        this.inputElement.placeholder = this.placeholder;
        
        // Add custom data attribute to flag as a search input
        this.inputElement.setAttribute('data-search-input', 'true');
        
        // Special handling for @ character to improve search experience
        this.inputElement.addEventListener('keypress', (e) => {
            // If @ is typed when input is empty, prevent the default action 
            // and manually set the value to ensure consistent behavior
            if (e.key === '@' && e.target.value === '') {
                e.preventDefault();
                e.target.value = '@';
                // Trigger the input event to start search
                e.target.dispatchEvent(new Event('input'));
            }
        });
        
        if (this.autoFocus) {
            this.inputElement.setAttribute('autofocus', 'true');
            // Safe autofocus with delay to avoid issues on some browsers
            setTimeout(() => this.inputElement.focus(), 100);
        }
        
        // Add search icon
        const iconElement = document.createElement('span');
        iconElement.className = 'search-icon material-icons';
        iconElement.textContent = 'search';
        
        // Create suggestions container
        this.suggestionsElement = document.createElement('div');
        this.suggestionsElement.className = 'search-suggestions';
        
        // Append elements
        this.element.appendChild(this.inputElement);
        this.element.appendChild(iconElement);
        this.element.appendChild(this.suggestionsElement);
        
        // Append to parent
        parentElement.appendChild(this.element);
        
        // Initialize search functionality
        searchService.initSearchInput(this.inputElement, this.suggestionsElement);
        
        return this.element;
    }
    
    /**
     * Update the search input value
     * @param {string} value - New value for the search input
     */
    setValue(value) {
        if (this.inputElement) {
            this.inputElement.value = value;
        }
    }
    
    /**
     * Get the current search input value
     * @returns {string} Current search input value
     */
    getValue() {
        return this.inputElement ? this.inputElement.value : '';
    }
    
    /**
     * Focus the search input
     */
    focus() {
        if (this.inputElement) {
            this.inputElement.focus();
        }
    }
    
    /**
     * Clean up event listeners when removing the component
     */
    unmount() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('input', searchService._handleInputEvent);
            this.inputElement.removeEventListener('keydown', searchService._handleKeydownEvent);
            this.inputElement.removeEventListener('blur', searchService._handleBlurEvent);
        }
    }
}

export default SearchBar;
