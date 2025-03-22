/**
 * Service for managing Steem communities
 */
class CommunityService {
  constructor() {
    this.apiEndpoint = 'https://api.steemit.com';
    this.alternativeApiEndpoint = 'https://imridd.eu.pythonanywhere.com/api/steem';
    this.useAlternativeApi = true; // Flag per decidere quale API utilizzare
    this.cachedCommunities = null;
    this.cachedSubscriptions = null;
    this.cachedSearchResults = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minuti
    this.pendingRequests = new Map(); // Per tracciare richieste in corso
    this.isLoadingAllCommunities = false; // Flag per evitare richieste multiple di tutte le communities
  }

  /**
   * Generic method to send requests to the alternative API
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} data - Request data for POST requests
   * @returns {Promise<any>} Response data
   */
  async sendRequest(path, method = 'GET', data = null) {
    // Crea una chiave unica per questa richiesta
    const requestKey = `${method}:${path}:${data ? JSON.stringify(data) : ''}`;
    
    // Controlla se una richiesta identica è già in corso
    if (this.pendingRequests.has(requestKey)) {
      console.log(`Reusing pending request for ${path}`);
      return this.pendingRequests.get(requestKey);
    }
    
    try {
      // Crea la promessa per la richiesta
      const requestPromise = (async () => {
        const url = `${this.alternativeApiEndpoint}${path}`;
        
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      })();
      
      // Memorizza la promessa per le richieste parallele
      this.pendingRequests.set(requestKey, requestPromise);
      
      // Ottieni il risultato
      const result = await requestPromise;
      
      // Rimuovi la richiesta dalla mappa delle pendenti
      this.pendingRequests.delete(requestKey);
      
      return result;
    } catch (error) {
      // Assicurati di rimuovere la richiesta dalla mappa anche in caso di errore
      this.pendingRequests.delete(requestKey);
      console.error(`Error in API request to ${path}:`, error);
      throw error;
    }
  }

  /**
   * Fetch list of communities using alternative API
   * @returns {Promise<Array>} List of communities
   */
  async listaCommunities() {
    // Evita più chiamate simultanee a listaCommunities
    if (this.isLoadingAllCommunities) {
      // Attendi il completamento della richiesta in corso
      while (this.isLoadingAllCommunities) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Se ora abbiamo dati in cache, usali
      if (this.cachedCommunities) {
        return this.cachedCommunities;
      }
    }
    
    this.isLoadingAllCommunities = true;
    
    try {
      const communities = await this.sendRequest('/communities', 'GET');
      
      // Salva in cache
      this.cachedCommunities = communities;
      
      return communities;
    } catch (error) {
      console.error('Error fetching communities list:', error);
      throw error;
    } finally {
      this.isLoadingAllCommunities = false;
    }
  }

  /**
   * Fetch list of communities
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of communities to fetch
   * @param {string} options.last - Last community name for pagination
   * @param {string} options.query - Search query
   * @returns {Promise<Array>} List of communities
   */
  async getCommunities(options = {}) {
    try {
      const { limit = 20, last = '', query = '' } = options;
      
      // If we have a search query, we need to use the search endpoint
      if (query && query.trim() !== '') {
        return await this.searchCommunities(query, limit);
      }
      
      // Use cached results if available and not paginating
      if (this.cachedCommunities && !last) {
        return this.cachedCommunities;
      }

      // Use alternative API if enabled
      if (this.useAlternativeApi) {
        try {
          const communities = await this.listaCommunities();
          
          // Process and format results to match expected structure
          const formattedCommunities = communities.map(community => {
            return {
              name: community.name,
              title: community.title || community.name,
              about: community.about || '',
              subscribers: community.subscribers || 0,
              num_pending: community.num_pending || 0,
              avatar_url: community.avatar_url || null,
            };
          });
          
          // Cache the results
          this.cachedCommunities = formattedCommunities;
          
          // Apply pagination if needed
          if (last) {
            const lastIndex = formattedCommunities.findIndex(c => c.name === last);
            if (lastIndex >= 0 && lastIndex + 1 < formattedCommunities.length) {
              return formattedCommunities.slice(lastIndex + 1, lastIndex + 1 + limit);
            }
          }
          
          // Apply limit
          return formattedCommunities.slice(0, limit);
        } catch (error) {
          console.error('Alternative API failed, falling back to default API:', error);
          // Fall through to default API
        }
      }
      
      // Default Steem API logic
      const params = new URLSearchParams({
        limit,
        sort: 'rank',
        observer: ''
      });
      
      if (last) {
        params.append('start_community', last);
      }
      
      const response = await fetch(`${this.apiEndpoint}/communities?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch communities: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache results if this is the first page
      if (!last) {
        this.cachedCommunities = data.result;
      }
      
      return data.result;
    } catch (error) {
      console.error('Error fetching communities:', error);
      throw error;
    }
  }
  
  /**
   * Search for communities by name or description - Versione ottimizzata
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return
   * @param {boolean} useCache - Whether to use cached results if available
   * @returns {Promise<Array>} List of matching communities
   */
  async searchCommunities(query, limit = 20, useCache = true) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const normalizedQuery = query.trim().toLowerCase();
    
    // Verifica se abbiamo risultati in cache per questa query
    if (useCache) {
      const cachedResult = this.getCachedSearch(normalizedQuery);
      if (cachedResult) {
        console.log('Usando risultati di ricerca in cache per:', normalizedQuery);
        return cachedResult;
      }
    }
    
    try {
      // Usa API alternativa se abilitata
      if (this.useAlternativeApi) {
        // Crea una chiave per la richiesta di ricerca
        const searchKey = `search:${normalizedQuery}:${limit}`;
        
        // Controlla se una ricerca identica è già in corso
        if (this.pendingRequests.has(searchKey)) {
          return this.pendingRequests.get(searchKey);
        }
        
        // Crea la promessa per la richiesta di ricerca
        const searchPromise = (async () => {
          try {
            // Prima tenta di usare l'endpoint di ricerca dedicato
            try {
              const searchResults = await this.sendRequest(`/search/communities?q=${encodeURIComponent(normalizedQuery)}`, 'GET');
              if (searchResults && searchResults.length > 0) {
                const limitedResults = searchResults.slice(0, limit);
                this.cacheSearchResults(normalizedQuery, limitedResults);
                return limitedResults;
              }
            } catch (error) {
              console.log('Dedicated search endpoint not available, falling back to client-side filtering');
            }
            
            // Se l'endpoint dedicato non funziona, usa il filtraggio lato client
            // Prima controlla se abbiamo già le community in cache per evitare una richiesta aggiuntiva
            const allCommunities = this.cachedCommunities || await this.listaCommunities();
            
            // Controlla per un match esatto nel nome
            let exactMatch = null;
            const exactName = normalizedQuery.startsWith('@') ? normalizedQuery.substring(1) : normalizedQuery;
            
            // Filtra le community in base alla query
            const filteredCommunities = allCommunities.filter(community => {
              const name = (community.name || '').toLowerCase();
              const title = (community.title || '').toLowerCase();
              const about = (community.about || '').toLowerCase();
              
              // Rileva match esatto nel nome
              if (name === exactName) {
                exactMatch = community;
              }
              
              return name.includes(normalizedQuery) || 
                     title.includes(normalizedQuery) || 
                     about.includes(normalizedQuery);
            });
            
            // Ordina i risultati: match esatto in cima, poi per numero di subscribers
            let sortedResults = [...filteredCommunities].sort((a, b) => {
              return (b.subscribers || 0) - (a.subscribers || 0);
            });
            
            // Se abbiamo un match esatto, assicuriamoci che sia in cima
            if (exactMatch) {
              sortedResults = [
                exactMatch,
                ...sortedResults.filter(c => c.name !== exactMatch.name)
              ];
            }
            
            // Limita i risultati
            const limitedResults = sortedResults.slice(0, limit);
            
            // Memorizza in cache
            this.cacheSearchResults(normalizedQuery, limitedResults);
            
            return limitedResults;
          } catch (error) {
            console.error('Client-side search failed:', error);
            throw error;
          }
        })();
        
        // Memorizza la promessa per le richieste parallele
        this.pendingRequests.set(searchKey, searchPromise);
        
        // Ottieni il risultato
        const result = await searchPromise;
        
        // Rimuovi la richiesta dalla mappa
        this.pendingRequests.delete(searchKey);
        
        return result;
      }
      
      // API predefinita - Versione semplificata per evitare loop
      try {
        // Usa solo una fonte di ricerca per evitare chiamate ricorsive
        const params = new URLSearchParams({
          q: normalizedQuery,
          limit,
          type: 'communities'
        });
        
        const response = await fetch(`${this.apiEndpoint}/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to search communities: ${response.statusText}`);
        }
        
        const data = await response.json();
        const results = data.result || [];
        
        // Salva i risultati in cache
        this.cacheSearchResults(normalizedQuery, results);
        
        return results;
      } catch (error) {
        console.error('Default API search failed:', error);
        
        // Prova con ricerca locale se la ricerca API fallisce e abbiamo dati in cache
        if (this.cachedCommunities) {
          console.log('API search failed, falling back to local search');
          return this.searchLocalCommunities(normalizedQuery, limit);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error searching communities:', error);
      throw error;
    }
  }
  
  /**
   * Cerca community tra quelle in cache locale
   * @param {string} query - Query di ricerca
   * @param {number} limit - Limite risultati
   * @returns {Array} Community che corrispondono alla ricerca
   */
  searchLocalCommunities(query, limit) {
    if (!this.cachedCommunities || this.cachedCommunities.length === 0) {
      return [];
    }
    
    // Normalizza la query
    const normalizedQuery = query.toLowerCase();
    
    // Filtra le community in cache
    return this.cachedCommunities
      .filter(community => {
        // Cerca nel nome, titolo e descrizione
        const name = (community.name || '').toLowerCase();
        const title = (community.title || '').toLowerCase();
        const about = (community.about || '').toLowerCase();
        
        return name.includes(normalizedQuery) || 
               title.includes(normalizedQuery) || 
               about.includes(normalizedQuery);
      })
      .slice(0, limit);
  }
  
  /**
   * Ottiene risultati di ricerca dalla cache
   * @param {string} query - Query di ricerca
   * @returns {Array|null} Risultati in cache o null
   */
  getCachedSearch(query) {
    if (this.cachedSearchResults.has(query)) {
      const { timestamp, results } = this.cachedSearchResults.get(query);
      
      // Controlla se la cache è ancora valida
      if (Date.now() - timestamp < this.cacheExpiry) {
        return results;
      } else {
        // Rimuovi risultati scaduti
        this.cachedSearchResults.delete(query);
      }
    }
    return null;
  }
  
  /**
   * Memorizza risultati di ricerca in cache
   * @param {string} query - Query di ricerca
   * @param {Array} results - Risultati da memorizzare
   */
  cacheSearchResults(query, results) {
    this.cachedSearchResults.set(query, {
      timestamp: Date.now(),
      results: [...results]
    });
    
    // Limita dimensione cache (massimo 20 ricerche)
    if (this.cachedSearchResults.size > 20) {
      // Elimina l'elemento più vecchio
      let oldestQuery = null;
      let oldestTimestamp = Date.now();
      
      for (const [key, value] of this.cachedSearchResults.entries()) {
        if (value.timestamp < oldestTimestamp) {
          oldestTimestamp = value.timestamp;
          oldestQuery = key;
        }
      }
      
      if (oldestQuery) {
        this.cachedSearchResults.delete(oldestQuery);
      }
    }
  }
  
  /**
   * Get details of a specific community
   * @param {string} name - Community name
   * @returns {Promise<Object>} Community details
   */
  async getCommunityDetails(name) {
    // Crea una chiave per questa richiesta
    const detailsKey = `community-details:${name}`;
    
    // Controlla se una richiesta identica è già in corso
    if (this.pendingRequests.has(detailsKey)) {
      return this.pendingRequests.get(detailsKey);
    }
    
    // Verifica se possiamo trovare i dettagli nella cache delle community
    if (this.cachedCommunities) {
      const cachedCommunity = this.cachedCommunities.find(c => c.name === name);
      if (cachedCommunity) {
        return cachedCommunity;
      }
    }
    
    // Crea la promessa per la richiesta
    const detailsPromise = (async () => {
      try {
        // Prova prima l'API alternativa se abilitata
        if (this.useAlternativeApi) {
          try {
            return await this.sendRequest(`/community/${name}`, 'GET');
          } catch (error) {
            console.log(`Failed to get community details from alternative API: ${error.message}`);
            // Continua con l'API predefinita
          }
        }
        
        // API predefinita
        const params = new URLSearchParams({
          name,
          observer: ''
        });
        
        const response = await fetch(`${this.apiEndpoint}/community?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch community details: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.result;
      } catch (error) {
        console.error(`Error fetching details for community ${name}:`, error);
        throw error;
      }
    })();
    
    // Memorizza la promessa per richieste parallele
    this.pendingRequests.set(detailsKey, detailsPromise);
    
    try {
      // Ottieni il risultato
      const result = await detailsPromise;
      return result;
    } finally {
      // Rimuovi la richiesta dalla mappa
      this.pendingRequests.delete(detailsKey);
    }
  }
  
  /**
   * Get posts from a specific community
   * @param {string} community - Community name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Posts and pagination info
   */
  async getCommunityPosts(community, options = {}) {
    try {
      const { limit = 20, sort = 'trending', observer = '', last = '' } = options;
      
      const params = new URLSearchParams({
        community,
        limit,
        sort,
        observer
      });
      
      if (last) {
        params.append('start_author', last.author);
        params.append('start_permlink', last.permlink);
      }
      
      const response = await fetch(`${this.apiEndpoint}/bridge.get_ranked_posts?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch community posts: ${response.statusText}`);
      }
      
      const posts = await response.json();
      
      // Format response to match our app's expected structure
      return {
        posts: posts.result,
        hasMore: posts.result.length === limit
      };
    } catch (error) {
      console.error('Error fetching community posts:', error);
      throw error;
    }
  }
  
  /**
   * Get user's subscribed communities
   * @param {string} username - Steem username
   * @returns {Promise<Array>} List of subscribed communities
   */
  async getSubscribedCommunities(username) {
    if (!username) return [];
    
    try {
      // Try to use cached subscriptions
      if (this.cachedSubscriptions) {
        return this.cachedSubscriptions;
      }
      
      const params = new URLSearchParams({
        account: username
      });
      
      const response = await fetch(`${this.apiEndpoint}/bridge.list_all_subscriptions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch subscribed communities: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.cachedSubscriptions = data.result;
      return data.result;
    } catch (error) {
      console.error('Error fetching subscribed communities:', error);
      return [];
    }
  }
  
  /**
   * Subscribe to a community using Hive Keychain
   * @param {string} username - User's username
   * @param {string} community - Community name
   * @returns {Promise<boolean>} Success status
   */
  async subscribeToCommunity(username, community) {
    if (!username || !community) {
      throw new Error('Username and community are required');
    }
    
    try {
      // Check if Hive Keychain is available
      if (typeof hive_keychain === 'undefined') {
        throw new Error('Hive Keychain extension is required for this action');
      }
      
      return new Promise((resolve, reject) => {
        hive_keychain.requestCustomJson(
          username,
          'community',
          'Posting',
          JSON.stringify(['subscribe', { community }]),
          'Subscribe to community',
          (response) => {
            if (response.success) {
              // Clear cache to force refresh
              this.cachedSubscriptions = null;
              resolve(true);
            } else {
              reject(new Error(response.message || 'Failed to subscribe'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error subscribing to community:', error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a community using Hive Keychain
   * @param {string} username - User's username
   * @param {string} community - Community name
   * @returns {Promise<boolean>} Success status
   */
  async unsubscribeFromCommunity(username, community) {
    if (!username || !community) {
      throw new Error('Username and community are required');
    }
    
    try {
      // Check if Hive Keychain is available
      if (typeof hive_keychain === 'undefined') {
        throw new Error('Hive Keychain extension is required for this action');
      }
      
      return new Promise((resolve, reject) => {
        hive_keychain.requestCustomJson(
          username,
          'community',
          'Posting',
          JSON.stringify(['unsubscribe', { community }]),
          'Unsubscribe from community',
          (response) => {
            if (response.success) {
              // Clear cache to force refresh
              this.cachedSubscriptions = null;
              resolve(true);
            } else {
              reject(new Error(response.message || 'Failed to unsubscribe'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error unsubscribing from community:', error);
      throw error;
    }
  }
  
  /**
   * Check if user is subscribed to a community
   * @param {string} username - User's username
   * @param {string} community - Community name
   * @returns {Promise<boolean>} Subscription status
   */
  async isSubscribed(username, community) {
    if (!username || !community) return false;
    
    try {
      const subscriptions = await this.getSubscribedCommunities(username);
      return subscriptions.includes(community);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }
  
  /**
   * Clear cached data
   */
  clearCache() {
    this.cachedCommunities = null;
    this.cachedSubscriptions = null;
  }
  
  /**
   * Search for trending communities
   * @param {number} limit - Number of communities to fetch
   * @returns {Promise<Array>} Trending communities
   */
  async getTrendingCommunities(limit = 20) {
    try {
      // Riutilizza il metodo getCommunities esistente ma con parametri specifici
      return await this.getCommunities({ 
        limit, 
        sort: 'rank' 
      });
    } catch (error) {
      console.error('Error fetching trending communities:', error);
      throw error;
    }
  }
  
  /**
   * Search for communities by category or topic
   * @param {string} category - Category to search for
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} Matching communities
   */
  async getCommunityByCategory(category, limit = 20) {
    if (!category) return [];
    
    try {
      // Usa il metodo searchCommunities ma con un termine di ricerca specifico per categoria
      return await this.searchCommunities(category, limit);
    } catch (error) {
      console.error(`Error fetching communities for category ${category}:`, error);
      return [];
    }
  }
  
  /**
   * Get random featured communities
   * @param {number} count - Number of communities to return
   * @returns {Promise<Array>} Random featured communities
   */
  async getFeaturedCommunities(count = 5) {
    try {
      // Ottieni community trendy e selezionane alcune casualmente
      const communities = await this.getTrendingCommunities(30);
      
      if (communities.length <= count) {
        return communities;
      }
      
      // Seleziona casualmente un sottoinsieme di community
      const featuredCommunities = [];
      const indices = new Set();
      
      while (indices.size < count && indices.size < communities.length) {
        const randomIndex = Math.floor(Math.random() * communities.length);
        if (!indices.has(randomIndex)) {
          indices.add(randomIndex);
          featuredCommunities.push(communities[randomIndex]);
        }
      }
      
      return featuredCommunities;
    } catch (error) {
      console.error('Error fetching featured communities:', error);
      return [];
    }
  }
  
  /**
   * Get suggested communities for a user based on subscriptions
   * @param {string} username - User's username
   * @param {number} limit - Number of suggestions to return
   * @returns {Promise<Array>} Suggested communities
   */
  async getSuggestedCommunities(username, limit = 10) {
    if (!username) return [];
    
    try {
      // Ottieni attuali sottoscrizioni
      const subscriptions = await this.getSubscribedCommunities(username);
      
      // Ottieni community popolari
      const popularCommunities = await this.getTrendingCommunities(30);
      
      // Filtra quelle già sottoscritte
      const subscriptionSet = new Set(subscriptions);
      const suggestions = popularCommunities.filter(
        community => !subscriptionSet.has(community.name)
      );
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Error fetching suggested communities:', error);
      return [];
    }
  }
  
  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.cachedCommunities = null;
    this.cachedSubscriptions = null;
    this.cachedSearchResults.clear();
    console.log('All community caches cleared');
  }
  
  /**
   * Svuota tutte le cache e resetta lo stato
   */
  reset() {
    this.cachedCommunities = null;
    this.cachedSubscriptions = null;
    this.cachedSearchResults.clear();
    this.pendingRequests.clear();
    this.isLoadingAllCommunities = false;
    console.log('CommunityService reset completed');
  }
}

// Create and export a singleton instance
const communityService = new CommunityService();
export default communityService;