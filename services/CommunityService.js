/**
 * Service for managing Steem communities
 */
import steemService from './SteemService.js';
import authService from './AuthService.js';
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
      console.log(`Reusing pending request for ${path}`);
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
   */
  async listCommunities() {
    if (this.isLoadingAllCommunities) {
      // Wait for the ongoing request to complete
      while (this.isLoadingAllCommunities) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // If we now have cached data, use it
      if (this.cachedCommunities) {
        return this.cachedCommunities;
      }
    }
    
    this.isLoadingAllCommunities = true;
    
    try {
      const communities = await this.sendRequest('/communities', 'GET');
      
      // Cache the results
      this.cachedCommunities = communities;
      
      return communities;
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
        console.log('Specific search endpoint not available, falling back to client-side filtering');
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
   * Pubblica un post in una community
   * @param {string} username - Username dell'utente
   * @param {string} community - Nome della community
   * @param {Object} postData - Dati del post
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  async postToCommunity(username, community, postData) {
    await steemService.ensureLibraryLoaded();
    
    if (!username) {
      throw new Error('Nome utente richiesto per pubblicare nella community');
    }
    
    if (!community) {
      throw new Error('Nome della community richiesto');
    }
    
    // Prepara i dati del post
    const { title, body, tags = [] } = postData;
    
    if (!title || !body) {
      throw new Error('Titolo e contenuto sono richiesti per il post');
    }
    
    // Verifica disponibilità chiave posting
    const postingKey = authService.getPostingKey();
    const hasKeychain = this.isKeychainAvailable();
    
    try {
      // Genera permlink dal titolo
      const permlink = this.generatePermlink(title);
      
      // Aggiungi il nome della community al metadata
      const jsonMetadata = {
        tags: tags,
        app: 'steemee/1.0',
        format: 'markdown',
        community: community
      };
      
      // Prepara l'operazione per la blockchain
      const operations = [
        ['comment', {
          parent_author: '',
          parent_permlink: `hive-${community.replace(/^hive-/, '')}`,
          author: username,
          permlink: permlink,
          title: title,
          body: body,
          json_metadata: JSON.stringify(jsonMetadata)
        }]
      ];
      
      // Usa prima la posting key se disponibile, poi keychain
      if (postingKey) {
        console.log('Using posting key to publish to community');
        return new Promise((resolve, reject) => {
          window.steem.broadcast.send(
            { operations: operations, extensions: [] },
            { posting: postingKey },
            (err, result) => {
              if (err) {
                console.error('Error publishing to community with posting key:', err);
                reject(err);
              } else {
                eventEmitter.emit('post:creation-completed', {
                  success: true,
                  author: username,
                  permlink: permlink,
                  title: title,
                  community: community
                });
                resolve(result);
              }
            }
          );
        });
      } else if (hasKeychain) {
        console.log('Using Keychain to publish to community');
        return new Promise((resolve, reject) => {
          window.steem_keychain.requestBroadcast(
            username,
            operations,
            'posting',
            (response) => {
              if (response.success) {
                console.log('Post pubblicato con successo nella community:', response);
                eventEmitter.emit('post:creation-completed', {
                  success: true,
                  author: username,
                  permlink: permlink,
                  title: title,
                  community: community
                });
                resolve(response);
              } else {
                console.error('Errore nella pubblicazione del post:', response.error);
                eventEmitter.emit('post:creation-error', {
                  error: response.error
                });
                reject(new Error(response.error));
              }
            }
          );
        });
      } else {
        throw new Error('No valid posting credentials available. Please login with your posting key or install Steem Keychain.');
      }
    } catch (error) {
      console.error('Errore nella preparazione del post:', error);
      throw error;
    }
  }
  
  /**
   * Genera un permlink basato sul titolo
   * @param {string} title - Titolo del post
   * @returns {string} - Permlink generato
   */
  generatePermlink(title) {
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Rimuovi caratteri speciali
      .replace(/\s+/g, '-')     // Sostituisci spazi con trattini
      .replace(/-+/g, '-')      // Evita trattini multipli
      .trim();
      
    // Aggiungi timestamp per evitare conflitti
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `${slug}-${timestamp}`;
  }
  
  /**
   * Iscriviti a una community usando Keychain
   * @param {string} username - Username dell'utente
   * @param {string} community - Nome della community
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  async subscribeToCommunity(username, community) {
    await steemService.ensureLibraryLoaded();
    
    if (!this.isKeychainAvailable()) {
      throw new Error("Steem Keychain non è disponibile. Per favore installa l'estensione Keychain.");
    }
    
    try {
      // Prepara operazione di subscribe
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
      
      // Usa Keychain per firmare l'operazione
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestBroadcast(
          username,
          operations,
          'posting',
          (response) => {
            if (response.success) {
              console.log(`Iscrizione completata alla community ${community}:`, response);
              
              // Invalida la cache delle subscriptions
              this.cachedUserSubscriptions.delete(username);
              
              // Emetti evento di iscrizione completata
              eventEmitter.emit('community:subscribe-completed', {
                success: true,
                username,
                community
              });
              
              resolve(response);
            } else {
              console.error(`Errore nell'iscrizione alla community ${community}:`, response.error);
              
              // Emetti evento di errore
              eventEmitter.emit('community:subscribe-error', {
                error: response.error,
                community
              });
              
              reject(new Error(response.error));
            }
          }
        );
      });
    } catch (error) {
      console.error(`Errore nella preparazione dell'iscrizione alla community ${community}:`, error);
      throw error;
    }
  }
  
  /**
   * Annulla iscrizione da una community usando Keychain
   * @param {string} username - Username dell'utente
   * @param {string} community - Nome della community
   * @returns {Promise<Object>} - Risultato dell'operazione
   */
  async unsubscribeFromCommunity(username, community) {
    await steemService.ensureLibraryLoaded();
    
    if (!this.isKeychainAvailable()) {
      throw new Error("Steem Keychain non è disponibile. Per favore installa l'estensione Keychain.");
    }
    
    try {
      // Prepara operazione di unsubscribe
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
      
      // Usa Keychain per firmare l'operazione
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestBroadcast(
          username,
          operations,
          'posting',
          (response) => {
            if (response.success) {
              console.log(`Disiscrizione completata dalla community ${community}:`, response);
              
              // Invalida la cache delle subscriptions
              this.cachedUserSubscriptions.delete(username);
              
              // Emetti evento di disiscrizione completata
              eventEmitter.emit('community:unsubscribe-completed', {
                success: true,
                username,
                community
              });
              
              resolve(response);
            } else {
              console.error(`Errore nella disiscrizione dalla community ${community}:`, response.error);
              
              // Emetti evento di errore
              eventEmitter.emit('community:unsubscribe-error', {
                error: response.error,
                community
              });
              
              reject(new Error(response.error));
            }
          }
        );
      });
    } catch (error) {
      console.error(`Errore nella preparazione della disiscrizione dalla community ${community}:`, error);
      throw error;
    }
  }

  /**
   * Get subscribed communities for a user using Steemit API
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
        console.log(`Using cached subscriptions for ${username}`);
        return subscriptions;
      }
    }
    
    try {
      console.log(`Fetching subscriptions for ${username} from Steemit API`);
      
      // Utilizza l'API Steemit invece di imridd
      const steemitApi = 'https://api.steemit.com';
      
      const params = new URLSearchParams({
        account: username
      });
      
      const response = await fetch(`${steemitApi}/bridge.list_all_subscriptions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch subscribed communities: ${response.statusText}`);
      }
      
      const data = await response.json();
      const communities = data.result || [];
      
      // Cache the results per user
      this.cachedUserSubscriptions.set(username, {
        timestamp: Date.now(),
        subscriptions: communities
      });
      
      return communities;
    } catch (error) {
      console.error(`Error fetching subscribed communities for ${username}:`, error);
      
      // In caso di errore, restituisci un array vuoto
      return [];
    }
  }

  /**
   * Get details of a specific community
   */
  async getCommunityDetails(name) {
    if (!name) {
      throw new Error('Community name is required');
    }
    
    try {
      return await this.sendRequest(`/community/${name}`, 'GET');
    } catch (error) {
      console.error(`Error fetching details for community ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get cached search results
   */
  getCachedSearch(query) {
    if (this.cachedSearchResults.has(query)) {
      const { timestamp, results } = this.cachedSearchResults.get(query);
      if (Date.now() - timestamp < this.cacheExpiry) {
        return results;
      }
      this.cachedSearchResults.delete(query);
    }
    return null;
  }

  /**
   * Cache search results
   */
  cacheSearchResults(query, results) {
    this.cachedSearchResults.set(query, {
      timestamp: Date.now(),
      results: [...results]
    });
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.cachedCommunities = null;
    this.cachedUserSubscriptions.clear();
    this.cachedSearchResults.clear();
  }

  /**
   * Trova i dettagli di una community dalla cache o dalla lista completa
   * @param {string} communityName - Nome della community
   * @returns {Promise<Object|null>} - Dettagli della community o null se non trovata
   */
  async findCommunityByName(communityName) {
    if (!communityName) return null;
    
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
          console.log(`Found community ${communityName} in cache`);
          return foundCommunity;
        }
      }
      
      // Se non è in cache, carica la lista completa
      // Questo evita la richiesta searchCommunities che causa CORS
      if (!this.cachedCommunities) {
        console.log(`Loading all communities to find ${communityName}`);
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
            console.log(`Found community ${communityName} after loading all communities`);
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
}

// Create and export singleton instance
const communityService = new CommunityService();
export default communityService;