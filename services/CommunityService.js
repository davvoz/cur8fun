/**
 * Service for managing Steem communities
 */
// Services
import authService from './AuthService.js';
import steemService from './SteemService.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';

class CommunityService {
  constructor() {
    this.apiEndpoint = 'https://imridd.eu.pythonanywhere.com/api/steem';
    this.useSteemitApi = false; // Set to false to use imridd API by default
    this.cachedCommunities = null;
    this.cachedUserSubscriptions = new Map();
    this.cachedSearchResults = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.pendingRequests = new Map();
    this.isLoadingAllCommunities = false;
    
    // Chiavi per localStorage
    this.localStorageKeys = {
      communities: 'steemee_cached_communities',
      version: 'steemee_communities_version'
    };
    this.localStorageCacheExpiry = 24 * 60 * 60 * 1000; // 24 ore
    this.cacheVersion = 1; // Incrementa questo quando cambi la struttura dei dati
    
    // Carica immediatamente da localStorage se disponibile
    this.loadCachedCommunitiesFromStorage();
  }

  /**
   * Verifica se Keychain è disponibile
   * @returns {boolean}
   */
  isKeychainAvailable() {
    return typeof window.steem_keychain !== 'undefined';
  }

  /**
   * Send request to the API (solo per operazioni di lettura)
   */
  async sendRequest(path, method = 'GET', data = null) {
    // Create a unique key for this request
    const requestKey = `${method}:${path}:${data ? JSON.stringify(data) : ''}`;
    
    // Check if an identical request is already in progress
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }
    // Create the promise for the request
    const requestPromise = (async () => {
      const url = `${this.apiEndpoint}${path}`;
      
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
    
    // Store the promise for parallel requests
    this.pendingRequests.set(requestKey, requestPromise);
    
    try {
      // Get the result
      const result = await requestPromise;
      return result;
    } finally {
      // Make sure to remove the request from the map when done
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Get list of all communities (usa API imridd)
   * Ottimizzato per caricare i dati una sola volta
   */
  async listCommunities() {
 
    
    // Blocca altre richieste parallele
    this.isLoadingAllCommunities = true;
    
    try {
      const communities = await this.sendRequest('/communities', 'GET');
      
      if (!communities || !Array.isArray(communities)) {
        console.error('Invalid communities data received:', communities);
        throw new Error('Invalid communities data received');
      }
      
      // Pre-process communities to normalize data and improve search performance
      const processedCommunities = communities.map(community => {
        // Ensure consistent property names and types
        return {
          ...community,
          name: community.name || '',
          title: community.title || this.formatCommunityTitle(community.name || ''),
          about: community.about || '',
          subscribers: community.subscribers || 0,
          is_nsfw: !!community.is_nsfw,
          // Index per ricerche più veloci
          _searchIndex: [
            (community.name || '').toLowerCase(),
            (community.title || '').toLowerCase(),
            (community.about || '').toLowerCase()
          ].join(' ')
        };
      });
      
      // Cache the processed results
      this.cachedCommunities = processedCommunities;
      
      // Salva in localStorage per uso futuro
      this.saveCachedCommunitiesToStorage(processedCommunities);
      
      return processedCommunities;
    } catch (error) {
      console.error('Error fetching all communities:', error);
      throw error;
    } finally {
      this.isLoadingAllCommunities = false;
    }
  }

  /**
   * Search for communities by name or description (usa API imridd)
   */
  async searchCommunities(query, limit = 20, useCache = true) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check for cached results
    if (useCache) {
      const cachedResult = this.getCachedSearch(normalizedQuery);
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    try {
      // Try the search endpoint first
      try {
        const searchResults = await this.sendRequest(`/search/communities?q=${encodeURIComponent(normalizedQuery)}`, 'GET');
        if (searchResults && searchResults.length > 0) {
          const limitedResults = searchResults.slice(0, limit);
          this.cacheSearchResults(normalizedQuery, limitedResults);
          return limitedResults;
        }
      } catch (error) {
        // Falling back to client-side filtering
      }
      
      // If specific search fails, get all communities and filter
      const allCommunities = this.cachedCommunities || await this.listCommunities();
      
      // Filter communities based on query
      const filteredCommunities = allCommunities.filter(community => {
        const name = (community.name || '').toLowerCase();
        const title = (community.title || '').toLowerCase();
        const about = (community.about || '').toLowerCase();
        
        return name.includes(normalizedQuery) || 
               title.includes(normalizedQuery) || 
               about.includes(normalizedQuery);
      });
      
      // Sort by relevance (exact matches first, then by subscribers)
      const sortedResults = filteredCommunities.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        
        // Exact matches have highest priority
        if (aName === normalizedQuery && bName !== normalizedQuery) return -1;
        if (aName !== normalizedQuery && bName === normalizedQuery) return 1;
        if (aTitle === normalizedQuery && bTitle !== normalizedQuery) return -1;
        if (aTitle !== normalizedQuery && bTitle === normalizedQuery) return 1;
        
        // Then sort by subscriber count
        return (b.subscribers || 0) - (a.subscribers || 0);
      });
      
      const limitedResults = sortedResults.slice(0, limit);
      this.cacheSearchResults(normalizedQuery, limitedResults);
      return limitedResults;
    } catch (error) {
      console.error('Error searching communities:', error);
      throw error;
    }
  }

  /**
   * Cache search results
   * @param {string} cacheKey - Cache key
   * @param {Array} data - Search results
   */
  cacheSearchResults(cacheKey, data) {
    if (!cacheKey || !data) return;
    
    this.cachedSearchResults.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached search results
   * @param {string} cacheKey - Cache key
   * @returns {Array|null} - Cached search results or null
   */
  getCachedSearch(cacheKey) {
    if (!cacheKey) return null;
    
    const cachedData = this.cachedSearchResults.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheExpiry) {
      return cachedData.data;
    }
    
    return null;
  }

  /**
   * Iscriviti a una community usando Keychain o chiave posting diretta
   * @param {string} username - Username dell'utente
   * @param {string} community - Nome della community
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  async subscribeToCommunity(username, community) {
    await steemService.ensureLibraryLoaded();
    
    // Ottieni l'utente corrente e determina il metodo di login
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error("Devi essere loggato per iscriverti a una community");
    }
    
    // Prepara l'operazione di subscribe (uguale per entrambi i metodi)
    const operations = [
      ['custom_json', {
        required_auths: [],
        required_posting_auths: [username],
        id: 'community',
        json: JSON.stringify([
          'subscribe',
          {
            community: community
          }
        ])
      }]
    ];
    
    try {
      let result;
      
      // Controlla il metodo di login dell'utente
      if (currentUser.loginMethod === 'keychain' && this.isKeychainAvailable()) {
        // Usa Keychain per firmare l'operazione
        result = await this.broadcastWithKeychain(username, operations);
      } else {
        // Usa la chiave posting diretta
        const postingKey = authService.getPostingKey();
        
        if (!postingKey) {
          throw new Error("Chiave posting non disponibile. Rieffettua il login.");
        }
        
        result = await this.broadcastWithPostingKey(operations, postingKey);
      }
      
      // Dopo una sottoscrizione riuscita, invalida la cache
      this.cachedUserSubscriptions.delete(username);
      
      // Emetti evento di iscrizione completata
      eventEmitter.emit('community:subscribe-completed', {
        success: true,
        username,
        community
      });
      
      return result;
    } catch (error) {
      console.error(`Errore nell'iscrizione alla community ${community}:`, error);
      
      // Emetti evento di errore
      eventEmitter.emit('community:subscribe-error', {
        error: error.message,
        community
      });
      
      throw error;
    }
  }

  /**
   * Annulla iscrizione da una community usando Keychain o chiave posting diretta
   * @param {string} username - Username dell'utente
   * @param {string} community - Nome della community
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  async unsubscribeFromCommunity(username, community) {
    await steemService.ensureLibraryLoaded();
    
    // Ottieni l'utente corrente e determina il metodo di login
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error("Devi essere loggato per annullare l'iscrizione a una community");
    }
    
    // Prepara operazione di unsubscribe (uguale per entrambi i metodi)
    const operations = [
      ['custom_json', {
        required_auths: [],
        required_posting_auths: [username],
        id: 'community',
        json: JSON.stringify([
          'unsubscribe',
          {
            community: community
          }
        ])
      }]
    ];
    
    try {
      let result;
      
      // Controlla il metodo di login dell'utente
      if (currentUser.loginMethod === 'keychain' && this.isKeychainAvailable()) {
        // Usa Keychain per firmare l'operazione
        result = await this.broadcastWithKeychain(username, operations);
      } else {
        // Usa la chiave posting diretta
        const postingKey = authService.getPostingKey();
        
        if (!postingKey) {
          throw new Error("Chiave posting non disponibile. Rieffettua il login.");
        }
        
        result = await this.broadcastWithPostingKey(operations, postingKey);
      }
      
      // Dopo un'operazione riuscita, invalida la cache
      this.cachedUserSubscriptions.delete(username);
      
      // Emetti evento di disiscrizione completata
      eventEmitter.emit('community:unsubscribe-completed', {
        success: true,
        username,
        community
      });
      
      return result;
    } catch (error) {
      console.error(`Errore nella disiscrizione dalla community ${community}:`, error);
      
      // Emetti evento di errore
      eventEmitter.emit('community:unsubscribe-error', {
        error: error.message,
        community
      });
      
      throw error;
    }
  }

  /**
   * Trasmette un'operazione usando Keychain
   * @private
   * @param {string} username - Username dell'utente
   * @param {Array} operations - Operazioni da trasmettere
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  broadcastWithKeychain(username, operations) {
    return new Promise((resolve, reject) => {
      window.steem_keychain.requestBroadcast(
        username,
        operations,
        'posting',
        (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || "Operazione Keychain fallita"));
          }
        }
      );
    });
  }

  /**
   * Trasmette un'operazione usando la chiave posting diretta
   * @private
   * @param {Array} operations - Operazioni da trasmettere
   * @param {string} postingKey - Chiave posting privata
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  broadcastWithPostingKey(operations, postingKey) {
    return new Promise((resolve, reject) => {
      try {
        window.steem.broadcast.send(
          { operations, extensions: [] },
          { posting: postingKey },
          (err, result) => {
            if (err) {
              console.error("Errore nella trasmissione dell'operazione:", err);
              reject(new Error(err.message || "Operazione di trasmissione fallita"));
            } else {
              resolve(result);
            }
          }
        );
      } catch (error) {
        console.error("Errore nella preparazione dell'operazione:", error);
        reject(error);
      }
    });
  }

  /**
   * Get subscribed communities for a user using direct JSON-RPC call
   * @param {string} username - Username dell'account
   * @param {boolean} useCache - Se utilizzare la cache
   * @returns {Promise<Array>} Array di community sottoscritte
   */
  async getSubscribedCommunities(username, useCache = true) {
    if (!username) {
      return [];
    }
    
    // Check for cached results
    if (useCache && this.cachedUserSubscriptions.has(username)) {
      const { timestamp, subscriptions } = this.cachedUserSubscriptions.get(username);
      if (Date.now() - timestamp < this.cacheExpiry) {
        return subscriptions;
      }
    }
    
    try {
      // Prepara la richiesta JSON-RPC
      const requestBody = {
        jsonrpc: "2.0", 
        method: "bridge.list_all_subscriptions", 
        params: { account: username }, 
        id: 1
      };
      
      // Esegui chiamata diretta all'API di Steemit
      const response = await fetch('https://api.moecki.online', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Verifica se la risposta contiene errori
      if (data.error) {
        throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // Estrai le community sottoscritte dalla risposta
      const rawCommunities = data.result || [];
      
      // Trasforma gli array in oggetti con proprietà significative
      const communities = rawCommunities.map(communityData => {
        // Ogni community è un array in questo formato:
        // [id, title, role, description]
        if (Array.isArray(communityData) && communityData.length >= 3) {
          const [id, title, role, description = ''] = communityData;
          const communityId = id.replace(/^hive-/, '');
          
          return {
            id: id,                         // ID completo (hive-XXXXX)
            name: communityId,              // ID senza prefisso
            title: title || this.formatCommunityTitle(communityId),
            role: role,                     // Ruolo dell'utente
            about: description || '',       // Descrizione (se presente)
            subscribers: 0                  // Default
          };
        }
        
        // Fallback per formati non previsti
        if (typeof communityData === 'string') {
          const cleanName = communityData.replace(/^hive-/, '');
          return {
            id: communityData,
            name: cleanName,
            title: this.formatCommunityTitle(cleanName),
            role: 'guest',
            about: ''
          };
        }
        
        return communityData; // Caso in cui sia già un oggetto
      });
      
      // Cache the results
      this.cachedUserSubscriptions.set(username, {
        timestamp: Date.now(),
        subscriptions: communities
      });
      
      return communities;
    } catch (error) {
      console.error('Error fetching subscribed communities for %s:', username, error);
      
      // Fallback in caso di errore
      return [];
    }
  }

  /**
   * Formatta il titolo di una community
   * @param {string} communityId - ID numerico della community
   * @returns {string} Titolo formattato
   */
  formatCommunityTitle(communityId) {
    if (!communityId) return 'Unknown Community';
    
    return communityId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Metodo alternativo per ottenere le community sottoscritte
   * @param {string} username - Username dell'utente
   * @returns {Promise<Array>} - Array di community sottoscritte
   */
  async fetchSubscribedCommunitiesAlternative(username) {
    try {
      // Assicuriamoci che la libreria steem.js sia caricata
      await steemService.ensureLibraryLoaded();
      
      // Utilizza l'API follow per vedere tutte le "comunità" (in realtà account) che l'utente segue
      // e filtra quelli che sono effettivamente community
      const following = await new Promise((resolve, reject) => {
        steemService.steem.api.getFollowing(username, '', 'blog', 1000, (err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      // Filtra i risultati per trovare community (iniziano con 'hive-')
      const communitiesFromFollowing = following
        .filter(follow => follow.following.startsWith('hive-'))
        .map(follow => {
          // Estrai l'ID numerico dalla community
          const communityId = follow.following.replace('hive-', '');
          return {
            name: communityId,
            title: this.formatCommunityTitle(communityId)
          };
        });
      
      return communitiesFromFollowing;
    } catch (error) {
      console.error('Error in alternative subscription method:', error);
      return [];
    }
  }

  /**
   * Formatta il titolo di una community a partire dall'ID
   * @param {string} communityId - ID della community
   * @returns {string} - Titolo formattato
   */
  formatCommunityTitle(communityId) {
    return communityId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Verifica se un tag è un tag community valido
   * @param {string} tag - Tag da verificare
   * @returns {boolean} - true se è una community valida
   */
  isValidCommunityTag(tag) {
    if (!tag || typeof tag !== 'string') return false;
    
    // La maggior parte delle community Hive hanno un formato hive-NUMERO
    if (tag.startsWith('hive-')) {
      // Estrai la parte dopo "hive-"
      const communityId = tag.substring(5);
      
      // Le community valide hanno ID numerico
      return /^\d+$/.test(communityId);
    }
    
    return false;
  }

  /**
   * Trova i dettagli di una community dalla cache o dalla lista completa
   * @param {string} communityName - Nome della community
   * @returns {Promise<Object|null>} - Dettagli della community o null se non trovata
   */
  async findCommunityByName(communityName) {
    if (!communityName) return null;
    
    // Verifica preventiva che sia un tag community valido
    if (!this.isValidCommunityTag(communityName)) {
      return null;
    }
    
    // Pulisci il nome della community (rimuovi prefisso hive- se presente)
    const cleanName = communityName.replace(/^hive-/, '');
    const searchName = `hive-${cleanName}`;
    
    try {
      // Prima controlla se abbiamo già tutte le community in cache
      if (this.cachedCommunities) {
        const foundCommunity = this.cachedCommunities.find(
          community => 
            community.name === cleanName || 
            community.name === searchName
        );
        
        if (foundCommunity) {
          return foundCommunity;
        }
      }
      
      // Se non è in cache, carica la lista completa
      // Questo evita la richiesta searchCommunities che causa CORS
      if (!this.cachedCommunities) {
        try {
          await this.listCommunities();
        } catch (listError) {
          console.error(`Error loading community list:`, listError);
          // Se non è possibile caricare la lista, creiamo un oggetto community base
          return this.createBasicCommunityObject(cleanName, searchName);
        }
        
        // Ora che abbiamo la lista completa, proviamo a trovare la community
        if (this.cachedCommunities) {
          const foundCommunity = this.cachedCommunities.find(
            community => 
              community.name === cleanName || 
              community.name === searchName
          );
          
          if (foundCommunity) {
            return foundCommunity;
          }
        }
      }
      
      // Se siamo qui, non siamo riusciti a trovare la community
      // Creiamo un oggetto community di base invece di fare un'altra richiesta API
      return this.createBasicCommunityObject(cleanName, searchName);
      
    } catch (error) {
      console.error(`Error finding community ${communityName}:`, error);
      // In caso di errore, restituisci comunque un oggetto base
      return this.createBasicCommunityObject(cleanName, searchName);
    }
  }

  /**
   * Crea un oggetto community base quando non abbiamo dati completi
   * @param {string} cleanName - Nome pulito della community (senza hive-)
   * @param {string} fullName - Nome completo della community (con hive-)
   * @returns {Object} Oggetto community di base
   */
  createBasicCommunityObject(cleanName, fullName) {
    // Formatta il nome in modo leggibile per il titolo
    const formattedTitle = cleanName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      name: fullName,
      title: formattedTitle || fullName,
      about: '',
      subscribers: 0,
      created: '',
      is_nsfw: false,
      isBasic: true  // Flag per indicare che sono dati di base
    };
  }

  /**
   * Arricchisce i dati base delle community con dettagli aggiuntivi
   * @param {Array} communities - Array di community base
   * @returns {Promise<Array>} Community arricchite
   */
  async enrichCommunityData(communities) {
    if (!communities || communities.length === 0) return [];
    
    try {
      // Se abbiamo la cache di tutte le community, usala per arricchire i dati
      if (this.cachedCommunities) {
        return communities.map(community => {
          // Verifica se la community è già un oggetto completo
          if (community.title && community.about) {
            return community;
          }
          
          // Estrai il nome pulito (senza prefisso hive-)
          const cleanName = (community.name || '').replace(/^hive-/, '');
          
          // Cerca corrispondenza nella cache
          const cachedData = this.cachedCommunities.find(
            c => c.name === cleanName || c.name === `hive-${cleanName}`
          );
          
          if (cachedData) {
            // Merge dei dati mantenendo eventuali proprietà esistenti
            return {
              ...community,
              title: cachedData.title || this.formatCommunityTitle(cleanName),
              about: cachedData.about || '',
              subscribers: cachedData.subscribers || 0,
              is_nsfw: cachedData.is_nsfw || false
            };
          }
          
          // Se non trovata in cache, formatta almeno il titolo
          return {
            ...community,
            title: community.title || this.formatCommunityTitle(cleanName)
          };
        });
      }
      
      // Se non abbiamo la cache, formatta almeno i titoli
      return communities.map(community => {
        if (!community.title) {
          const cleanName = (community.name || '').replace(/^hive-/, '');
          community.title = this.formatCommunityTitle(cleanName);
        }
        return community;
      });
    } catch (error) {
      console.error('Error enriching community data:', error);
      return communities; // Restituisci i dati originali in caso di errore
    }
  }

  /**
   * Unified method for community-related API calls with UI handling
   * @param {string} operation - The operation type ('details', 'posts', 'subscriptions', etc.)
   * @param {Object} params - Parameters for the operation
   * @param {boolean} useCache - Whether to use cached results if available (passes to service)
   * @returns {Promise<Object>} - The result of the operation
   */
  async communityFetch(operation, params = {}, useCache = true) {
    // Show operation-specific loading state
    this.showOperationLoading(operation);

    try {
      let result;
      
      // Route to the appropriate service method based on operation
      switch (operation) {
        case 'details':
          const communityName = params.communityId?.startsWith('hive-') 
            ? params.communityId 
            : `hive-${params.communityId}`;
          result = await this.findCommunityByName(communityName);
          break;
          
        case 'posts':
          const fetchParams = {
            community: params.communityId.replace(/^hive-/, ''),
            sort: params.sort || 'trending',
            limit: params.limit || 20
          };

          if (params.lastAuthor && params.lastPermlink) {
            fetchParams.start_author = params.lastAuthor;
            fetchParams.start_permlink = params.lastPermlink;
          }
          
          const rawPosts = await steemService.fetchCommunityPosts(fetchParams);
          
          // Process and enrich the posts with community info
          if (Array.isArray(rawPosts)) {
            const community = params.communityDetails || this.community;
            const enrichedPosts = rawPosts.map(post => ({
              ...post,
              community: params.communityId.replace(/^hive-/, ''),
              community_title: community?.title || this.formatCommunityTitle(params.communityId)
            }));
            
            result = {
              posts: enrichedPosts,
              hasMore: enrichedPosts.length >= fetchParams.limit
            };
          } else {
            result = { posts: [], hasMore: false };
          }
          break;
          
        case 'subscriptions':
          result = await this.getSubscribedCommunities(params.username, useCache);
          break;
          
        case 'subscribe':
          result = await this.subscribeToCommunity(params.username, params.communityName);
          break;
          
        case 'unsubscribe':
          result = await this.unsubscribeFromCommunity(params.username, params.communityName);
          break;
          
        case 'search':
          result = await this.searchCommunities(params.query, params.limit, useCache);
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in communityFetch (${operation}):`, error);
      // Emit error event for UI notification
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to fetch community ${operation}: ${error.message}`
      });
      return null;
    } finally {
      // Hide operation-specific loading state
      this.hideOperationLoading(operation);
    }
  }

  /**
   * Show loading state for specific operation
   */
  showOperationLoading(operation) {
    if (!this.container) return;

    switch (operation) {
      case 'posts':
        const postsContainer = this.container.querySelector('.posts-container');
        if (postsContainer) {
          postsContainer.innerHTML = '<div class="loading-spinner">Loading posts...</div>';
        }
        break;
    }
  }

  /**
   * Hide loading state for specific operation
   */
  hideOperationLoading(operation) {
    if (!this.container) return;

    switch (operation) {
      case 'posts':
        const postsContainer = this.container.querySelector('.posts-container');
        if (postsContainer) {
          const spinner = postsContainer.querySelector('.loading-spinner');
          if (spinner) spinner.remove();
        }
        break;
    }
  }

  /**
   * Carica le community memorizzate in localStorage
   */
  loadCachedCommunitiesFromStorage() {
    try {
      const cachedData = localStorage.getItem(this.localStorageKeys.communities);
      const cachedVersion = localStorage.getItem(this.localStorageKeys.version);
      
      if (cachedData && cachedVersion && parseInt(cachedVersion, 10) === this.cacheVersion) {
        const parsedData = JSON.parse(cachedData);
        
        if (parsedData.timestamp && (Date.now() - parsedData.timestamp) < this.localStorageCacheExpiry) {
          this.cachedCommunities = parsedData.communities;
        } else {
          localStorage.removeItem(this.localStorageKeys.communities);
          localStorage.removeItem(this.localStorageKeys.version);
        }
      }
    } catch (error) {
      console.error('Error loading cached communities from localStorage:', error);
    }
  }

  /**
   * Salva le community in localStorage
   * @param {Array} communities - Array di community da salvare
   */
  saveCachedCommunitiesToStorage(communities) {
    try {
      const dataToCache = {
        communities,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.localStorageKeys.communities, JSON.stringify(dataToCache));
      localStorage.setItem(this.localStorageKeys.version, this.cacheVersion.toString());
    } catch (error) {
      console.error('Error saving communities to localStorage:', error);
    }
  }
}

// Create and export singleton instance
const communityService = new CommunityService();
export default communityService;