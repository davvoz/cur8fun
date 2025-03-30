import router from '../utils/Router.js';

export class SearchService {
    constructor() {
        this.searchTypes = {
            USER: '@',
            TAG: '#',
            COMMUNITY: 'hive-'
        };
        this.API_ENDPOINT = 'https://api.steemit.com';  // Usa sempre l'API di Hive per coerenza
        this.suggestionsContainer = null;
        this.currentSearchTerm = '';
        this.debounceTimeout = null;
        this.isShowingSuggestions = false;
    }

    /**
     * Parse and process the search query
     * @param {string} query - The search query
     * @returns {Object} Search result with type and value
     */
    parseQuery(query) {
        const trimmedQuery = query.trim();
        
        // Check for user search with @ prefix - MUST start with @ to be a user search
        if (trimmedQuery.startsWith(this.searchTypes.USER)) {
            return {
                type: 'user',
                value: trimmedQuery.substring(1)
            };
        }
        
        // Check for tag search - MUST start with # to be a tag search
        if (trimmedQuery.startsWith(this.searchTypes.TAG)) {
            return {
                type: 'tag',
                value: trimmedQuery.substring(1)
            };
        }
        
        // Check for community search
        if (trimmedQuery.toLowerCase().startsWith(this.searchTypes.COMMUNITY)) {
            return {
                type: 'community',
                value: trimmedQuery
            };
        }
        
        // Default to post search
        return {
            type: 'post',
            value: trimmedQuery
        };
    }

    /**
     * Handle the search and navigation
     * @param {string} query - The search query
     * @returns {Promise<void>}
     */
    async handleSearch(query) {
        const searchResult = this.parseQuery(query);
        
        try {
            // You can add validation here before navigation
            switch (searchResult.type) {
                case 'user':
                    // For users, we need to use the @username format expected by the router
                    router.navigate(`/@${searchResult.value}`);
                    break;
                case 'tag':
                    // Navigate to tag page
                    router.navigate(`/tag/${searchResult.value}`);
                    break;
                case 'community':
                    // Navigate to community page
                    router.navigate(`/community/${searchResult.value}`);
                    break;
                case 'post':
                    // Navigate to search page with query parameter
                    router.navigate(`/search?q=${encodeURIComponent(searchResult.value)}`);
                    break;
            }
            
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }
    
    /**
     * Trova account simili al termine di ricerca
     * @param {string} query - La stringa di ricerca
     * @param {number} limit - Numero massimo di risultati
     * @param {number} offset - Offset per paginazione
     * @returns {Promise<Array>} - Array di oggetti account
     */
    async findSimilarAccounts(query, limit = 20, offset = 0) {
        try {
            // Rimuovi @ se presente, altrimenti usa la query originale
            const cleanQuery = query.startsWith('@') ? query.substring(1) : query;
            
            if (!cleanQuery.trim()) {
                return [];
            }
            
            // Usa l'API Hive per cercare account simili
            const params = {
                jsonrpc: '2.0',
                id: 1,
                method: 'condenser_api.lookup_accounts',
                params: [cleanQuery, limit + offset]
            };
            
            console.log('Looking up accounts with query:', cleanQuery);
            
            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(params),
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error.message);
            }
            
            // Prendi solo gli account a partire dall'offset
            const accountNames = result.result || [];
            
            if (accountNames.length === 0) {
                return [];
            }
            
            console.log('Found account names:', accountNames);
            
            // Ottieni i dettagli completi per ciascun account
            const accounts = await this.getAccountsDetails(accountNames.slice(offset, offset + limit));
            return accounts;
        } catch (error) {
            console.error('Failed to find similar accounts:', error);
            throw error;
        }
    }

    /**
     * Ottieni dettagli completi per una lista di account
     * @param {Array<string>} accountNames - Lista di nomi degli account
     * @returns {Promise<Array>} - Array di oggetti account con dettagli
     */
    async getAccountsDetails(accountNames) {
        try {
            if (!accountNames || accountNames.length === 0) {
                return [];
            }
            
            const params = {
                jsonrpc: '2.0',
                id: 1,
                method: 'condenser_api.get_accounts',
                params: [accountNames]
            };
            
            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(params),
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error.message);
            }
            
            // Arricchisci il risultato con i dati del profilo già estratti
            return (result.result || []).map(account => {
                try {
                    // Estrai i dati del profilo dai metadati JSON
                    const metadata = typeof account.json_metadata === 'string' 
                        ? JSON.parse(account.json_metadata) 
                        : account.json_metadata || {};
                    
                    return {
                        ...account,
                        name: account.name,
                        profile: metadata.profile || {}
                    };
                } catch (e) {
                    // Se il parsing fallisce, ritorna l'account senza profilo
                    console.warn('Failed to parse account metadata for', account.name, e);
                    return { 
                        ...account, 
                        name: account.name,
                        profile: {} 
                    };
                }
            });
        } catch (error) {
            console.error('Failed to get account details:', error);
            throw error;
        }
    }
    
    /**
     * Esegui una ricerca completa in base alla query e all'opzione selezionata
     * @param {Object} options - Opzioni di ricerca
     * @returns {Promise<Object>} - Risultati della ricerca
     */
    async search(options = {}) {
        const { 
            query, 
            method = 'by-tag', 
            page = 1, 
            limit = 20,
            previousResults = []
        } = options;
        
        // Gestisci una query vuota
        if (!query || query.trim() === '') {
            return { results: [], hasMore: false };
        }
        
        try {
            let searchResponse = {
                results: [],
                hasMore: false,
                nextPage: page + 1
            };
            
            // Per la ricerca di account, lascia funzionare sia con @ che senza
            if (method === 'similar-accounts') {
                console.log('Searching for similar accounts:', query);
                const accounts = await this.findSimilarAccounts(query, limit, (page - 1) * limit);
                searchResponse.results = accounts || [];
                searchResponse.hasMore = accounts && accounts.length === limit;
            } else {
                // Altri metodi gestiti da SteemService per ora
                return { results: [], hasMore: false };
            }
            
            return searchResponse;
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }

    /**
     * Initialize the search functionality with a search input and container for suggestions
     * @param {HTMLElement} searchInput - The search input element
     * @param {HTMLElement} container - Container where to append suggestions
     */
    initSearchInput(searchInput, container) {
        if (!searchInput || !container) {
            console.error('Search input or container not provided');
            return;
        }
        
        this.suggestionsContainer = container;
        
        // Clear previous event listeners if any
        searchInput.removeEventListener('input', this._handleInputEvent);
        searchInput.removeEventListener('keydown', this._handleKeydownEvent);
        searchInput.removeEventListener('blur', this._handleBlurEvent);
        
        // Store bound methods to be able to remove them later
        this._handleInputEvent = this.handleInputEvent.bind(this, searchInput);
        this._handleKeydownEvent = this.handleKeydownEvent.bind(this, searchInput);
        this._handleBlurEvent = this.handleBlurEvent.bind(this);
        
        // Add event listeners
        searchInput.addEventListener('input', this._handleInputEvent);
        searchInput.addEventListener('keydown', this._handleKeydownEvent);
        searchInput.addEventListener('blur', this._handleBlurEvent);
        
        console.log('Search input initialized');
    }
    
    /**
     * Handle input events for search with debounce
     * @param {HTMLElement} inputElement - The search input element
     * @param {Event} event - Input event
     */
    handleInputEvent(inputElement, event) {
        const query = inputElement.value.trim();
        this.currentSearchTerm = query;
        
        // Clear previous timeout
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        // Set a new timeout for debouncing
        this.debounceTimeout = setTimeout(async () => {
            if (query.length >= 2) {
                await this.showSuggestions(query);
            } else {
                this.hideSuggestions();
            }
        }, 300); // 300ms debounce time
    }
    
    /**
     * Handle keydown events for search navigation
     * @param {HTMLElement} inputElement - The search input element
     * @param {KeyboardEvent} event - Keydown event
     */
    handleKeydownEvent(inputElement, event) {
        // Handle Enter key to submit search
        if (event.key === 'Enter') {
            event.preventDefault();
            const query = inputElement.value.trim();
            
            if (query) {
                // First hide suggestions
                this.hideSuggestions();
                
                // Then navigate to search page
                this.handleSearch(query);
                
                // Optionally clear input
                // inputElement.value = '';
            }
        }
        
        // Add keyboard navigation for suggestions (up/down arrows)
        if (this.isShowingSuggestions) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                this.navigateSuggestions(event.key === 'ArrowDown' ? 1 : -1);
            } 
            
            // Handle Escape to close suggestions
            if (event.key === 'Escape') {
                this.hideSuggestions();
            }
        }
    }
    
    /**
     * Handle blur events (clicking away from search input)
     */
    handleBlurEvent(event) {
        // Add a small delay to allow for clicks on suggestions
        setTimeout(() => {
            this.hideSuggestions();
        }, 150);
    }
    
    /**
     * Show search suggestions based on the query
     * @param {string} query - The search query
     */
    async showSuggestions(query) {
        if (!this.suggestionsContainer) return;
        
        try {
            const searchResult = this.parseQuery(query);
            let suggestions = [];
            
            // Cerca sempre account simili se:
            // 1) La query inizia con @ (caso esplicito di ricerca utente)
            // 2) La query sembra essere un nome utente (no spazi, caratteri validi per nomi Steem)
            const isPossiblyUsername = this.isPossibleUsername(query);
            
            if (searchResult.type === 'user' || isPossiblyUsername) {
                // Cerca account simili
                console.log('Looking for accounts similar to:', query);
                const accounts = await this.findSimilarAccounts(query, 5);
                
                // Se troviamo account, mostra i suggerimenti
                if (accounts && accounts.length > 0) {
                    suggestions = accounts.map(account => ({
                        type: 'user',
                        text: `@${account.name}`,
                        name: account.name,
                        profile: account.profile
                    }));
                }
            } 
            
            // Se non abbiamo trovato account simili o la query è specifica per altri tipi
            if (suggestions.length === 0) {
                if (searchResult.type === 'tag' || query.startsWith('#')) {
                    // Suggerimenti per tag
                    suggestions = [{ type: 'instruction', text: `Search for tag: ${query.replace('#', '')}` }];
                } else if (searchResult.type === 'community') {
                    // Suggerimenti per community
                    suggestions = [{ type: 'instruction', text: `Search for community: ${query}` }];
                } else {
                    // Ricerca post normale
                    suggestions = [{ type: 'instruction', text: `Search for: ${query}` }];
                }
            }
            
            // Renderizza i suggerimenti
            this.renderSuggestions(suggestions, query);
            
        } catch (error) {
            console.error('Error showing suggestions:', error);
        }
    }

    /**
     * Check if a query might be a username (without @ prefix)
     * @param {string} query - Query to check
     * @returns {boolean} - True if the query might be a username
     */
    isPossibleUsername(query) {
        // Se già inizia con @, lascia che sia gestito dal tipo 'user'
        if (query.startsWith('@')) return false;
        
        const trimmedQuery = query.trim();
        
        // Regole per potenziali username Steem/Hive:
        // 1. Nessuno spazio
        // 2. Lunghezza tra 3 e 16 caratteri
        // 3. Solo lettere, numeri, punti, trattini bassi
        // 4. Non inizia con un punto
        const usernameRegex = /^[a-z0-9][a-z0-9\-\.]{2,15}$/i;
        
        return !trimmedQuery.includes(' ') && usernameRegex.test(trimmedQuery);
    }
    
    /**
     * Render search suggestions in the dropdown
     * @param {Array} suggestions - List of suggestion objects
     * @param {string} query - The original search query
     */
    renderSuggestions(suggestions, query) {
        if (!this.suggestionsContainer) return;
        
        // Clear previous suggestions
        this.suggestionsContainer.innerHTML = '';
        
        // Add wrapper for styling
        const wrapper = document.createElement('div');
        wrapper.className = 'search-suggestions-wrapper';
        
        if (suggestions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-suggestion-item no-results';
            noResults.textContent = 'No suggestions found';
            wrapper.appendChild(noResults);
        } else {
            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = `search-suggestion-item ${suggestion.type}`;
                item.setAttribute('data-index', index);
                
                if (suggestion.type === 'user') {
                    // User suggestion with avatar - improved version
                    const avatarContainer = document.createElement('div');
                    avatarContainer.className = 'suggestion-avatar-container';
                    
                    const avatar = document.createElement('img');
                    avatar.className = 'suggestion-avatar';
                    
                    // Use preferred URL format as in ProfileService
                    avatar.src = `https://images.hive.blog/u/${suggestion.name}/avatar/small`;
                    
                    // Better error handling for avatar loading
                    avatar.onerror = () => {
                        // Try steemitimages as backup
                        avatar.src = `https://steemitimages.com/u/${suggestion.name}/avatar/small`;
                        
                        // If that fails too, use default avatar
                        avatar.onerror = () => {
                            avatar.src = 'assets/img/default_avatar.png';
                        };
                    };
                    
                    avatarContainer.appendChild(avatar);
                    
                    const textContainer = document.createElement('div');
                    textContainer.className = 'suggestion-text';
                    
                    const displayName = document.createElement('span');
                    displayName.className = 'display-name';
                    
                    // Use profile name if available, otherwise use username
                    const cleanName = suggestion.profile?.name || suggestion.name;
                    displayName.textContent = cleanName;
                    
                    const username = document.createElement('span');
                    username.className = 'username';
                    username.textContent = `@${suggestion.name}`;
                    
                    textContainer.appendChild(displayName);
                    textContainer.appendChild(username);
                    
                    item.appendChild(avatarContainer);
                    item.appendChild(textContainer);
                    
                } else {
                    // Other types of suggestions
                    item.textContent = suggestion.text;
                }
                
                // Handle click on suggestion
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (suggestion.type === 'user') {
                        // Navigate to user profile
                        router.navigate(`/@${suggestion.name}`);
                    } else if (suggestion.type === 'tag') {
                        // Navigate to tag page
                        router.navigate(`/tag/${suggestion.text.replace('#', '')}`);
                    } else if (suggestion.type === 'community') {
                        // Navigate to community
                        router.navigate(`/community/${suggestion.text}`);
                    } else {
                        // Use the search query to navigate to search page
                        this.handleSearch(query);
                    }
                    
                    this.hideSuggestions();
                });
                
                wrapper.appendChild(item);
            });
        }
        
        // Add "view all results" link at bottom
        const viewAllLink = document.createElement('div');
        viewAllLink.className = 'search-suggestion-item view-all';
        viewAllLink.textContent = `View all results for "${query}"`;
        viewAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSearch(query);
            this.hideSuggestions();
        });
        wrapper.appendChild(viewAllLink);
        
        // Append to container and show
        this.suggestionsContainer.appendChild(wrapper);
        this.suggestionsContainer.classList.add('active');
        this.isShowingSuggestions = true;
    }
    
    /**
     * Hide the suggestions dropdown
     */
    hideSuggestions() {
        if (!this.suggestionsContainer) return;
        
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.classList.remove('active');
        this.isShowingSuggestions = false;
    }
    
    /**
     * Navigate through suggestions with keyboard
     * @param {number} direction - 1 for down, -1 for up
     */
    navigateSuggestions(direction) {
        const items = this.suggestionsContainer.querySelectorAll('.search-suggestion-item');
        if (!items.length) return;
        
        // Find currently selected item
        let currentIndex = -1;
        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('selected')) {
                currentIndex = i;
                break;
            }
        }
        
        // Calculate new index
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
        
        // Remove current selection
        items.forEach(item => item.classList.remove('selected'));
        
        // Add new selection
        items[newIndex].classList.add('selected');
        items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Esporta un'istanza singleton
const searchService = new SearchService();
export default searchService;
