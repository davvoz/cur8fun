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
            
            // Converti in lowercase per garantire risultati più accurati
            const normalizedQuery = cleanQuery.toLowerCase();
            
            // Usa l'API Hive per cercare account simili
            const params = {
                jsonrpc: '2.0',
                id: 1,
                method: 'condenser_api.lookup_accounts',
                params: [normalizedQuery, limit + offset]
            };
            
            console.log('Looking up accounts with query:', normalizedQuery);
            
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
     * Search tags by prefix
     * @param {string} query - The search query
     * @returns {Promise<Array>} Array of tag objects
     */
    async searchTags(query) {
        try {
            // Clean the query from # if present
            const cleanQuery = query.startsWith('#') ? query.substring(1) : query;
            
            if (!cleanQuery.trim()) {
                return [];
            }

            // Converti in lowercase per garantire risultati più coerenti
            const normalizedQuery = cleanQuery.trim().toLowerCase();

            const params = {
                jsonrpc: '2.0',
                id: 1,
                method: 'condenser_api.get_trending_tags',
                params: [normalizedQuery, 10]  // Limit to 10 suggestions
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

            // Filter and map the results
            return (result.result || [])
                .filter(tag => tag.name.toLowerCase().startsWith(normalizedQuery))
                .map(tag => ({
                    type: 'tag',
                    name: tag.name,
                    count: tag.total_posts
                }));
        } catch (error) {
            console.error('Failed to search tags:', error);
            return [];
        }
    }

    /**
     * Initialize the search functionality with a search input and container for suggestions
     * @param {HTMLElement} searchInput - The search input element
     * @param {HTMLElement} container - Container where to append suggestions
     */
    initSearchInput(searchInput, container) {
        // Questa funzione non dovrebbe più aggiungere gestori di eventi
        // ma solo impostare il riferimento al container dei suggerimenti
        if (container) {
            this.suggestionsContainer = container;
            console.log('Search suggestions container initialized');
        }
    }
    
    /**
     * Handle input events for search with debounce
     * @param {HTMLElement} inputElement - The search input element
     * @param {Event} event - Input event
     */
    handleInputEvent(inputElement, event) {
        // Questa funzione non viene più utilizzata direttamente
    }
    
    /**
     * Show search suggestions based on the query
     * @param {string} query - The search query
     * @param {string} searchMethod - The search method ('users' or 'tags')
     */
    async showSuggestions(query, searchMethod = 'users') {
        if (!this.suggestionsContainer) return;
        
        try {
            let suggestions = [];
            
            if (searchMethod === 'users') {
                const accounts = await this.findSimilarAccounts(query, 5);
                if (accounts && accounts.length > 0) {
                    suggestions = accounts.map(account => ({
                        type: 'user',
                        text: `@${account.name}`,
                        name: account.name,
                        profile: account.profile
                    }));
                }
            } else if (searchMethod === 'tags') {
                const tags = await this.searchTags(query);
                if (tags.length > 0) {
                    suggestions = tags;
                } else {
                    // If no tags found, suggest creating a new tag search
                    suggestions = [{
                        type: 'tag',
                        name: query.startsWith('#') ? query.substring(1) : query,
                        isNew: true
                    }];
                }
            }
            
            this.renderSuggestions(suggestions, query, searchMethod);
        } catch (error) {
            console.error('Error showing suggestions:', error);
        }
    }

    /**
     * Render search suggestions in the dropdown
     * @param {Array} suggestions - List of suggestion objects
     * @param {string} query - The original search query
     * @param {string} searchMethod - The search method ('users' or 'tags')
     */
    renderSuggestions(suggestions, query, searchMethod = 'users') {
        if (!this.suggestionsContainer) return;
        
        // Clear previous suggestions
        this.suggestionsContainer.innerHTML = '';
        
        // Add wrapper for styling
        const wrapper = document.createElement('div');
        wrapper.className = 'search-suggestions-wrapper';
        
        if (suggestions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-suggestion-item no-results';
            
            // Messaggio personalizzato in base al tipo di ricerca
            if (searchMethod === 'users') {
                noResults.innerHTML = `
                    <div class="no-results-message">
                        <i class="fas fa-info-circle"></i>
                        <span>No matching users found. Try a different name.</span>
                    </div>
                `;
            } else if (searchMethod === 'tags') {
                noResults.innerHTML = `
                    <div class="no-results-message">
                        <i class="fas fa-info-circle"></i>
                        <span>No matching tags found. Press Enter to search anyway.</span>
                    </div>
                `;
            } else {
                noResults.textContent = 'No suggestions found';
            }
            
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
                            avatar.src = 'assets/img/default-avatar.png';
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
                    
                } else if (suggestion.type === 'tag') {
                    const tagContainer = document.createElement('div');
                    tagContainer.className = 'tag-suggestion-container';

                    const hashIcon = document.createElement('i');
                    hashIcon.className = 'fas fa-hashtag';
                    tagContainer.appendChild(hashIcon);

                    const textContainer = document.createElement('div');
                    textContainer.className = 'suggestion-text';

                    const tagName = document.createElement('span');
                    tagName.className = 'tag-name';
                    tagName.textContent = suggestion.name;
                    textContainer.appendChild(tagName);

                    if (suggestion.isNew) {
                        const newTag = document.createElement('span');
                        newTag.className = 'new-tag';
                        newTag.textContent = 'Search this tag';
                        textContainer.appendChild(newTag);
                    } else if (suggestion.count !== undefined) {
                        const count = document.createElement('span');
                        count.className = 'post-count';
                        count.textContent = `${suggestion.count} posts`;
                        textContainer.appendChild(count);
                    }

                    tagContainer.appendChild(textContainer);
                    item.appendChild(tagContainer);
                } else {
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
                        router.navigate(`/tag/${suggestion.name}`);
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
