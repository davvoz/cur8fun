import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';
import telegramService from './TelegramService.js';
import { ApiClient ,ApiScheduledClient } from './api-ridd.js';

/**
 * Service for creating and editing posts
 */
class CreatePostService {
  constructor() {
    this.isProcessing = false;
    this.apiClient = new ApiClient();
    this.apiScheduledClient = new ApiScheduledClient();
    // Configurazione del beneficiario predefinito
    this.defaultBeneficiary = {
      name: 'micro.cur8',
      weight: 500 // 5% della ricompensa (10000 = 100%)
    };
    
    // Limite massimo di beneficiari
    this.maxBeneficiaries = 8; // Massimo 8 beneficiari per post
    
    // Chiavi per localStorage - sistema migliorato
    this.DRAFT_STORAGE_KEY = 'steemee_post_draft'; // Draft corrente (legacy)
    this.DRAFTS_STORAGE_KEY = 'steemee_post_drafts'; // Tutti i drafts (nuovo sistema)
    this.DRAFT_INDEX_KEY = 'steemee_draft_index'; // Indice dei drafts
    
    // Configurazione drafts
    this.MAX_DRAFTS_PER_USER = 10; // Massimo 10 draft per utente
    this.DRAFT_EXPIRY_DAYS = 30; // I draft scadono dopo 30 giorni
    this.AUTO_SAVE_INTERVAL = 15000; // Auto-save ogni 15 secondi

    this.apiClient = new ApiClient();
  }

  /**
   * Determine se siamo su un dispositivo mobile
   * @returns {boolean} true se il dispositivo è mobile
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  async createPost(postData, options = {}) {
    console.log('[DEBUG] CreatePostService.createPost called with:', postData, options);
    
    if (this.isProcessing) {
      throw new Error('Another post is already being processed');
    }

    if (!authService.isAuthenticated()) {
      throw new Error('You must be logged in to create a post');
    }

    try {
      this.isProcessing = true;
      const { title } = postData;
      eventEmitter.emit('post:creation-started', { title });
      
      // Validate input data
      this.validatePostData(postData);
      await steemService.ensureLibraryLoaded();
      
      // Check if this is a scheduled post and handle authorization
      if (options.isScheduled && postData.scheduledDateTime) {
        console.log('[DEBUG] Processing as scheduled post');
        await this.handleScheduledPostAuthorization();
        // For scheduled posts, save to storage instead of broadcasting immediately
        return await this.saveScheduledPost(postData, options);
      }
      
      // Prepare post data for immediate publishing
      const postDetails = this.preparePostDetails(postData, options);
      
      // Broadcast the post using available method
      const result = await this.broadcastUsingAvailableMethod(postDetails);
      
      // Rimuovi la bozza salvata dopo il successo
      this.clearDraft();
      
      this.emitSuccessEvent(postDetails);
      return result;
    } catch (error) {
      this.handlePostCreationError(error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  preparePostDetails(postData, options = {}) {
    const { title, body, tags, community, permlink: customPermlink } = postData;
    const currentUser = this.validateUserAuthentication();
    const username = currentUser.username;
    
    // Process beneficiary options
    const includeBeneficiary = options.includeBeneficiary !== false;
    
    // Prepara i beneficiari
    const beneficiaries = [];
    if (includeBeneficiary) {
      // Se ci sono beneficiari personalizzati forniti, usali
      if (options.beneficiaries && Array.isArray(options.beneficiaries) && options.beneficiaries.length > 0) {
        // Assicuriamoci di non superare il limite massimo di beneficiari
        const validBeneficiaries = options.beneficiaries
          .filter(b => b && b.account && b.weight > 0 && b.weight <= 10000)
          .slice(0, this.maxBeneficiaries);
          
        beneficiaries.push(...validBeneficiaries);
      }
      // Altrimenti usa il beneficiario predefinito con peso personalizzato se fornito
      else {
        beneficiaries.push({
          account: this.defaultBeneficiary.name,
          weight: options.beneficiaryWeight || this.defaultBeneficiary.weight
        });
      }
    }
    
    // Generate permlink or use the provided one
    const permlink = customPermlink || this.generatePermlink(title);
    
    // Process tags
    const processedTags = this.processTags(tags);
    
    // Determine parent permlink - use community if provided, otherwise first tag
    const parentPermlink = community 
      ? `hive-${community.replace(/^hive-/, '')}`
      : (processedTags[0] || 'steemee');
    
    // Prepare metadata
    const metadata = this.createPostMetadata(processedTags, community);
    
    return {
      username,
      title,
      body,
      permlink,
      parentPermlink,
      metadata,
      beneficiaries,
      community
    };
  }

  validateUserAuthentication() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated. Please login again.');
    }
    return currentUser;
  }

  createPostMetadata(tags, community) {
    const metadata = {
      tags,
      app: 'steemee/1.0',
      format: 'markdown'
    };
    
    if (community) {
      metadata.community = community;
    }
    
    return metadata;
  }

  async broadcastUsingAvailableMethod(postDetails) {
    
    // Verifica il metodo di login dell'utente
    const user = authService.getCurrentUser();
    const loginMethod = user?.loginMethod;
    
    const postingKey = authService.getPostingKey();
    const hasKeychain = typeof window.steem_keychain !== 'undefined';
    const isMobile = this.isMobileDevice();
    
    // Verifica il metodo di login e usa solo quello (nessun fallback)
    if (loginMethod === 'keychain') {
        // Se l'utente è loggato con Keychain, deve usare solo Keychain
        if (!hasKeychain) {
            throw new Error('You are logged in with Keychain, but the extension is not available. Please install or enable Steem Keychain extension.');
        }
        
        if (isMobile && !window.steem_keychain) {
            throw new Error('Steem Keychain is not available on this mobile browser. Please use a desktop browser.');
        }
        
        return await this.broadcastPostWithKeychain(postDetails);
    } 
    else if (loginMethod === 'privateKey' || loginMethod === 'steemlogin') {
        // Se l'utente è loggato con chiave privata o steemlogin, deve avere una posting key
        if (!postingKey) {
            throw new Error('Posting key not available. Please log in again to refresh your credentials.');
        }
        
        return await this.broadcastPost({
            ...postDetails,
            postingKey
        });
    } 
    else {
        // Metodo di login sconosciuto o non specificato
        throw new Error(`Unsupported login method: ${loginMethod || 'unknown'}. Please log in with a supported method.`);
    }
  }
  emitSuccessEvent(postDetails, isScheduled = false) {
    if (!isScheduled) {
      // Send Telegram notification after successful post creation using the centralized service
      telegramService.sendPostNotification(postDetails)
        .catch(error => console.error('Error sending Telegram notification:', error));
    }
    
    eventEmitter.emit('post:creation-completed', {
      success: true,
      author: postDetails.username,
      permlink: postDetails.permlink,
      title: postDetails.title,
      community: postDetails.community,
      isScheduled: isScheduled
    });
  }

  handlePostCreationError(error) {
    console.error('Error creating post:', error);
    
    let errorMessage = error.message || 'Unknown error occurred while creating post';
    
    if (error.message && (
        error.message.includes('cancel') || 
        error.message.includes('Cancel') ||
        error.message.includes('Request was canceled'))) {
      errorMessage = 'Operation was cancelled.';
    }
    
    eventEmitter.emit('post:creation-error', { error: errorMessage });
  }
  
  broadcastPostWithKeychain({ username, parentPermlink, title, body, permlink, metadata, beneficiaries = [] }) {
    return new Promise((resolve, reject) => {
      const jsonMetadata = JSON.stringify(metadata);
      
      // Create operations array
      const operations = [
        ['comment', {
          parent_author: '',
          parent_permlink: parentPermlink,
          author: username,
          permlink: permlink,
          title: title,
          body: body,
          json_metadata: jsonMetadata
        }]
      ];
      
      // Add comment_options operation with beneficiary if needed
      if (beneficiaries.length > 0) {
        // Per le opzioni standard del post
        const commentOptionsOperation = [
          'comment_options', 
          {
            author: username,
            permlink: permlink,
            max_accepted_payout: '1000000.000 SBD',
            percent_steem_dollars: 10000,
            allow_votes: true,
            allow_curation_rewards: true,
            extensions: [
              [0, {
                beneficiaries: beneficiaries
              }]
            ]
          }
        ];
        operations.push(commentOptionsOperation);
      }
      
      window.steem_keychain.requestBroadcast(
        username, 
        operations, 
        'posting', 
        response => {
          if (response.success) {
            resolve(response.result);
          } else {
            // Gestione migliorata dell'errore di keychain
            if (response.error && (
                response.error.includes('cancel') || 
                response.error.includes('Cancel') ||
                response.error === 'user_cancel')) {
              const cancelError = new Error('Operation cancelled by user');
              cancelError.isCancelled = true;
              reject(cancelError);
            } else {
              reject(new Error(response.message || response.error || 'Keychain broadcast failed'));
            }
          }
        }
      );
    });
  }
    validatePostData(postData) {
    const { title, body, tags, scheduledDateTime } = postData;
    
    if (!title || title.trim().length === 0) {
      throw new Error('Post title is required');
    }
    
    if (title.length > 255) {
      throw new Error('Post title must be less than 255 characters');
    }
    
    if (!body || body.trim().length === 0) {
      throw new Error('Post content is required');
    }
    
    if (!tags || tags.length === 0) {
      throw new Error('At least one tag is required');
    }
    
    if (tags.length > 5) {
      throw new Error('Maximum 5 tags allowed. Please remove some tags to continue.');
    }
    
    // Validate individual tags
    tags.forEach(tag => {
      if (tag.length > 24) {
        throw new Error(`Tag '${tag}' is too long. Maximum length is 24 characters.`);
      }
      if (!/^[a-z0-9-]+$/.test(tag)) {
        throw new Error(`Tag '${tag}' contains invalid characters. Only lowercase letters, numbers, and hyphens are allowed.`);
      }
    });

    // Validate scheduled datetime if provided
    if (scheduledDateTime) {
      const scheduledDate = new Date(scheduledDateTime);
      const now = new Date();
      
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Invalid scheduled date and time');
      }
      
      if (scheduledDate <= now) {
        throw new Error('Scheduled date and time must be in the future');
      }
      
      // Check if scheduled time is not too far in the future (e.g., 1 year)
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      if (scheduledDate > oneYearFromNow) {
        throw new Error('Scheduled date cannot be more than 1 year in the future');
      }
    }
  }
  

  generatePermlink(title) {
    // Create permlink from title - lowercase, replace spaces with hyphens
    let permlink = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Collapse multiple hyphens
      .trim();
      
    // Add random suffix to prevent duplicates
    const randomBytes = crypto.getRandomValues(new Uint8Array(3)); // Generate 3 random bytes
    const randomChars = Array.from(randomBytes, byte => ('0' + byte.toString(16)).slice(-2)).join(''); // Convert to a hex string
    permlink = `${permlink}-${randomChars}`;
    
    return permlink.substring(0, 255); // Ensure permlink isn't too long
  }
  
  processTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    
    // Filter out empty tags, convert to lowercase, limit to 24 chars
    return tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .map(tag => tag.replace(/[^a-z0-9-]/g, ''))
      .map(tag => tag.substring(0, 24))
      .filter((tag, index, self) => self.indexOf(tag) === index) // Remove duplicates
      .slice(0, 5); // Limit to 5 tags
  }
  
  async broadcastPost({ username, postingKey, parentPermlink, title, body, permlink, metadata, beneficiaries = [] }) {
    // Format JSON metadata
    const jsonMetadata = JSON.stringify(metadata);
    
    return new Promise((resolve, reject) => {
      // Prima, crea il post
      window.steem.broadcast.comment(
        postingKey,          // Posting key
        '',                  // Parent author (empty for new post)
        parentPermlink,      // Primary tag as parent permlink
        username,            // Author
        permlink,            // Permlink
        title,               // Title
        body,                // Body
        jsonMetadata,        // JSON metadata
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Se ci sono beneficiari, aggiungi le opzioni al post
          if (beneficiaries.length > 0) {
            window.steem.broadcast.commentOptions(
              postingKey,
              username,
              permlink,
              '1000000.000 SBD',  // max_accepted_payout
              10000,              // percent_steem_dollars (100%)
              true,               // allow_votes
              true,               // allow_curation_rewards
              [
                [0, { beneficiaries: beneficiaries }]
              ],
              (optErr, optResult) => {
                if (optErr) {
                  console.error('Failed to set beneficiaries:', optErr);
                  // Risolviamo comunque perché il post è stato creato
                  resolve(result);
                } else {
                  resolve(optResult);
                }
              }
            );
          } else {
            resolve(result);
          }
        }
      );
    });
  }
  
  async editPost(postData) {
    // Implement post editing functionality
    // Similar to createPost but uses existing permlink
    // Not fully implemented as the original code doesn't have this feature
    throw new Error('Edit post functionality not yet implemented');
  }
  /**
   * SISTEMA DRAFT MIGLIORATO
   */

  /**
   * Genera un ID univoco per un draft
   * @returns {string} - ID univoco
   */
  generateDraftId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Ottieni il prefisso chiave per un utente
   * @param {string} username - Nome utente
   * @returns {string} - Prefisso per le chiavi localStorage
   */
  getUserDraftPrefix(username) {
    return `steemee_draft_${username}_`;
  }

  /**
   * Ottieni tutti i draft per l'utente corrente
   * @returns {Array} - Array di draft
   */
  getAllUserDrafts() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return [];

    const username = currentUser.username;
    const drafts = [];
    const prefix = this.getUserDraftPrefix(username);

    // 1. Aggiungi il draft corrente se esiste
    const currentDraft = this.getDraft();
    if (currentDraft) {
      drafts.push({
        id: 'current',
        isCurrent: true,
        storageKey: this.DRAFT_STORAGE_KEY,
        ...currentDraft,
        lastModified: new Date(currentDraft.timestamp).getTime()
      });
    }

    // 2. Cerca tutti i draft salvati per questo utente
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && key !== this.DRAFT_STORAGE_KEY) {
        try {
          const draftData = JSON.parse(localStorage.getItem(key));
          if (draftData && (draftData.title || draftData.body)) {
            const draftId = key.replace(prefix, '');
            drafts.push({
              id: draftId,
              storageKey: key,
              isCurrent: false,
              ...draftData,
              lastModified: draftData.lastModified || (draftData.timestamp ? new Date(draftData.timestamp).getTime() : Date.now())
            });
          }
        } catch (error) {
          console.warn('Failed to parse draft:', key, error);
          // Rimuovi draft corrotti
          localStorage.removeItem(key);
        }
      }
    }

    // 3. Ordina per data di modifica (più recenti primi)
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Salva un draft con ID specifico
   * @param {Object} draftData - I dati della bozza
   * @param {string} draftId - ID del draft (opzionale, se non fornito ne genera uno nuovo)
   * @returns {Object} - Oggetto con success e draftId
   */
  saveDraftWithId(draftData, draftId = null) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const username = currentUser.username;
      
      // Se non è fornito un ID, genera uno nuovo
      if (!draftId) {
        draftId = this.generateDraftId();
      }

      // Pulisci i draft vecchi prima di salvare uno nuovo
      this.cleanupExpiredDrafts(username);

      // Controlla il limite di draft per utente
      const existingDrafts = this.getAllUserDrafts().filter(d => !d.isCurrent);
      if (existingDrafts.length >= this.MAX_DRAFTS_PER_USER && !existingDrafts.find(d => d.id === draftId)) {
        // Rimuovi il draft più vecchio
        const oldestDraft = existingDrafts[existingDrafts.length - 1];
        if (oldestDraft.storageKey) {
          localStorage.removeItem(oldestDraft.storageKey);
        }
      }

      // Prepara i dati del draft
      const draft = {
        ...draftData,
        timestamp: new Date().toISOString(),
        lastModified: Date.now(),
        username: username,
        version: '2.0' // Versione del formato draft
      };

      // Salva il draft
      const storageKey = this.getUserDraftPrefix(username) + draftId;
      localStorage.setItem(storageKey, JSON.stringify(draft));

      return { success: true, draftId, storageKey };
    } catch (error) {
      console.error('Failed to save draft with ID:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Carica un draft specifico per ID
   * @param {string} draftId - ID del draft da caricare
   * @returns {Object|null} - Draft caricato o null
   */
  getDraftById(draftId) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return null;

      // Se è il draft corrente
      if (draftId === 'current') {
        return this.getDraft();
      }

      // Cerca il draft specifico
      const username = currentUser.username;
      const storageKey = this.getUserDraftPrefix(username) + draftId;
      const draftJson = localStorage.getItem(storageKey);
      
      if (!draftJson) return null;

      const draft = JSON.parse(draftJson);
      
      // Verifica che appartenga all'utente corrente
      if (draft.username !== username) {
        return null;
      }

      return draft;
    } catch (error) {
      console.error('Failed to load draft by ID:', error);
      return null;
    }
  }

  /**
   * Elimina un draft specifico
   * @param {string} draftId - ID del draft da eliminare
   * @returns {boolean} - true se eliminato con successo
   */
  deleteDraftById(draftId) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return false;

      // Se è il draft corrente
      if (draftId === 'current') {
        this.clearDraft();
        return true;
      }

      // Elimina il draft specifico
      const username = currentUser.username;
      const storageKey = this.getUserDraftPrefix(username) + draftId;
      localStorage.removeItem(storageKey);
      
      return true;
    } catch (error) {
      console.error('Failed to delete draft by ID:', error);
      return false;
    }
  }

  /**
   * Pulisce i draft scaduti per un utente
   * @param {string} username - Nome utente
   */
  cleanupExpiredDrafts(username) {
    try {
      const prefix = this.getUserDraftPrefix(username);
      const now = Date.now();
      const expiryMs = this.DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const draftData = JSON.parse(localStorage.getItem(key));
            const draftDate = new Date(draftData.timestamp).getTime();
            
            if (now - draftDate > expiryMs) {
              localStorage.removeItem(key);
              console.log('Removed expired draft:', key);
            }
          } catch (error) {
            // Rimuovi draft corrotti
            localStorage.removeItem(key);
            console.warn('Removed corrupted draft:', key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired drafts:', error);
    }
  }

  /**
   * Duplica un draft esistente
   * @param {string} draftId - ID del draft da duplicare
   * @returns {Object} - Risultato della duplicazione
   */
  duplicateDraft(draftId) {
    try {
      const draft = this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      // Crea una copia con un nuovo ID
      const newDraftData = {
        title: `${draft.title} (Copy)`,
        body: draft.body,
        tags: draft.tags,
        community: draft.community
      };

      return this.saveDraftWithId(newDraftData);
    } catch (error) {
      console.error('Failed to duplicate draft:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sposta il draft corrente in un draft salvato con ID
   * @returns {Object} - Risultato dell'operazione
   */
  moveCurrentDraftToSaved() {
    const currentDraft = this.getDraft();
    if (!currentDraft) {
      return { success: false, error: 'No current draft found' };
    }

    // Salva come draft con ID
    const result = this.saveDraftWithId({
      title: currentDraft.title,
      body: currentDraft.body,
      tags: currentDraft.tags,
      community: currentDraft.community
    });

    if (result.success) {
      // Rimuovi il draft corrente
      this.clearDraft();
    }

    return result;
  }

  /**
   * Carica un draft salvato come draft corrente
   * @param {string} draftId - ID del draft da caricare
   * @returns {boolean} - true se caricato con successo
   */
  loadDraftAsCurrent(draftId) {
    try {
      const draft = this.getDraftById(draftId);
      if (!draft) return false;

      // Salva come draft corrente
      const success = this.saveDraft({
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        community: draft.community
      });

      return success;
    } catch (error) {
      console.error('Failed to load draft as current:', error);
      return false;
    }  }
  /**
   * Salva una bozza del post nel localStorage (legacy - manteniamo per compatibilità)
   * @param {Object} draftData - I dati della bozza (title, body, tags, community, isScheduled, publishDate, publishTime)
   * @returns {boolean} - true se il salvataggio è riuscito
   */
  saveDraft(draftData) {
    try {
      // Aggiungi timestamp al salvataggio
      const draft = {
        ...draftData,
        timestamp: new Date().toISOString(),
        username: authService.getCurrentUser()?.username || 'anonymous'
      };
      
      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(draft));
      return true;
    } catch (error) {
      console.error('Failed to save draft:', error);
      return false;
    }
  }

  /**
   * Recupera la bozza salvata (legacy - draft corrente)
   * @returns {Object|null} - La bozza salvata o null se non esiste
   */
  getDraft() {
    try {
      const draftJson = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (!draftJson) return null;
      
      const draft = JSON.parse(draftJson);
      
      // Verifica che la bozza appartenga all'utente corrente
      const currentUser = authService.getCurrentUser()?.username;
      if (currentUser && draft.username !== currentUser) {
        return null;
      }
      
      // Verifica che la bozza non sia troppo vecchia (più di 7 giorni)
      const draftDate = new Date(draft.timestamp);
      const now = new Date();
      const daysOld = (now - draftDate) / (1000 * 60 * 60 * 24);
      
      if (daysOld > 7) {
        this.clearDraft();
        return null;
      }
      
      return draft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }
  
  /**
   * Verifica se esiste una bozza salvata
   * @returns {boolean} - true se esiste una bozza
   */
  hasDraft() {
    return this.getDraft() !== null;
  }
  
  /**
   * Cancella la bozza salvata
   */
  clearDraft() {
    try {
      localStorage.removeItem(this.DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }
  
  /**
   * Calcola l'età della bozza in un formato leggibile
   * @returns {string|null} - Età della bozza o null se non esiste
   */
  getDraftAge() {
    try {
      const draft = this.getDraft();
      if (!draft || !draft.timestamp) return null;
      
      const draftDate = new Date(draft.timestamp);
      const now = new Date();
      const diffMs = now - draftDate;
      
      // Meno di un'ora
      if (diffMs < 60 * 60 * 1000) {
        const mins = Math.floor(diffMs / (60 * 1000));
        return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
      }
      
      // Meno di un giorno
      if (diffMs < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      }
      
      // Più di un giorno
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
      
    } catch (error) {
      console.error('Failed to calculate draft age:', error);
      return null;
    }
  }

  /**
   * Verifica che la percentuale totale dei beneficiari non superi il limite massimo
   * @param {Array} beneficiaries - Lista dei beneficiari
   * @returns {boolean} - True se la percentuale totale è valida
   */
  validateBeneficiaryPercentage(beneficiaries) {
    if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
      return true;
    }
    
    const totalWeight = beneficiaries.reduce((sum, beneficiary) => sum + (beneficiary.weight || 0), 0);
    
    // Il peso totale non dovrebbe superare il 90% (9000) per lasciare qualcosa all'autore
    return totalWeight <= 9000;
  }

  /**
   * Handles authorization check and request for scheduled posts
   * @returns {Promise<boolean>} - true if authorized, throws error if authorization fails
   */
  async handleScheduledPostAuthorization() {
    try {
      // Check if cur8 is already authorized
      const isAuthorized = await authService.checkCur8Authorization();
      
      if (isAuthorized) {
        return true;
      }
      
      // Show authorization dialog to user
      const userConsent = await this.showAuthorizationDialog();
      
      if (!userConsent) {
        throw new Error('Authorization required for scheduled posts. Please grant permission to cur8 account.');
      }
      
      // Request authorization from user
      await authService.authorizeCur8ForScheduledPosts();
      
      // Verify authorization was successful
      const verifyAuth = await authService.checkCur8Authorization();
      if (!verifyAuth) {
        throw new Error('Failed to authorize cur8 account. Please try again.');
      }
      
      return true;
    } catch (error) {
      console.error('Scheduled post authorization error:', error);
      throw error;
    }
  }
  /**
   * Shows an authorization dialog to the user
   * @returns {Promise<boolean>} - true if user consents, false otherwise
   */
  async showAuthorizationDialog() {
    return new Promise((resolve) => {
      // Check if dialog already exists
      const existingDialog = document.querySelector('.authorization-dialog-overlay');
      if (existingDialog) {
        existingDialog.remove();
      }
      
      // Create modal dialog
      const dialog = document.createElement('div');
      dialog.className = 'authorization-dialog-overlay';
      dialog.innerHTML = `
        <div class="authorization-dialog">
          <div class="dialog-header">
            <h3>Authorization Required</h3>
            <span class="material-icons close-icon">close</span>
          </div>
          <div class="dialog-body">
            <div class="auth-icon">
              <span class="material-icons">schedule</span>
            </div>
            <p><strong>To schedule posts, we need your permission.</strong></p>
            <p>This will authorize the <code>cur8</code> account to publish posts on your behalf at the scheduled time.</p>
            <div class="auth-features">
              <div class="feature-item">
                <span class="material-icons">check_circle</span>
                <span>Secure blockchain authorization</span>
              </div>
              <div class="feature-item">
                <span class="material-icons">check_circle</span>
                <span>You can revoke this permission anytime</span>
              </div>
              <div class="feature-item">
                <span class="material-icons">check_circle</span>
                <span>Only posting permissions, not your funds</span>
              </div>
            </div>
          </div>
          <div class="dialog-actions">
            <button class="btn secondary-btn cancel-auth">Cancel</button>
            <button class="btn primary-btn authorize-btn">Authorize cur8</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Add event listeners
      const closeBtn = dialog.querySelector('.close-icon');
      const cancelBtn = dialog.querySelector('.cancel-auth');
      const authorizeBtn = dialog.querySelector('.authorize-btn');
      
      const cleanup = () => {
        try {
          if (dialog.parentNode) {
            document.body.removeChild(dialog);
          }
        } catch (error) {
          console.warn('Dialog cleanup error:', error);
        }
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      const handleAuthorize = () => {
        cleanup();
        resolve(true);
      };
      
      closeBtn.addEventListener('click', handleCancel);
      cancelBtn.addEventListener('click', handleCancel);
      authorizeBtn.addEventListener('click', handleAuthorize);
      
      // Close on outside click
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          handleCancel();
        }
      });
      
      // Close on escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleEscape);
          handleCancel();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
    });
  }

  /**
   * Saves a scheduled post to backend API for later publishing
   * @param {Object} postData - Post data
   * @param {Object} options - Post options
   * @returns {Promise<Object>} - Result object
   */  
  
  async saveScheduledPost(postData, options) {
    console.log('[DEBUG] saveScheduledPost called with:', postData, options);
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Adapt data for api-ridd
      const username = currentUser.username;
      const title = postData.title;
      const body = postData.body;
      const tags = postData.tags || [];
      const community = postData.community || '';
      const scheduledTime = postData.scheduledDateTime;
      
      // Calculate local timezone if not provided
      let timezone = options.timezone;
      if (!timezone) {
        try {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch (e) {
          timezone = 'UTC';
        }
      }
      
      // Use api-ridd to save the scheduled post
      const savedPost = await this.apiScheduledClient.SchedulePost(
        username,
        title,
        tags,
        body,
        scheduledTime,
        timezone,
        community
      );
      
      // Clear draft since it's now scheduled
      this.clearDraft();
      
      // Emit success event for scheduled post
      eventEmitter.emit('post:scheduled', {
        success: true,
        scheduledPost: savedPost,
        scheduledTime: scheduledTime
      });
      
      return {
        success: true,
        scheduled: true,
        postId: savedPost.id || null,
        scheduledTime: scheduledTime
      };
    } catch (error) {
      console.error('Failed to save scheduled post:', error);
      throw error;
    }
  }

  /**
   * Updates an existing scheduled post
   * @param {number} postId - ID of the post to update
   * @param {Object} updatedData - Data to update
   * @returns {Promise<Object>} - Updated post data
   */
  async updateScheduledPost(postId, updatedData) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No user authenticated');
      }
      
      const updatedPost = await this.apiScheduledClient.UpdateScheduledPost(
        postId, 
        currentUser.username, 
        updatedData
      );
      
      // Emit success event for scheduled post update
      eventEmitter.emit('post:schedule-updated', {
        success: true,
        scheduledPost: updatedPost
      });
      
      return updatedPost;
    } catch (error) {
      console.error('Failed to update scheduled post:', error);
      throw error;
    }
  }

  /**
   * Gets a specific scheduled post by ID
   * @param {number} postId - ID of the post to retrieve
   * @returns {Promise<Object>} - Post data
   */
  async getScheduledPostById(postId) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No user authenticated');
      }
      
      // Get all scheduled posts and find the specific one
      const scheduledPosts = await this.getScheduledPosts(currentUser.username);
      const post = scheduledPosts.find(p => p.id === postId);
      
      if (!post) {
        throw new Error('Scheduled post not found');
      }
      
      return post;
    } catch (error) {
      console.error('Failed to get scheduled post:', error);
      throw error;
    }
  }

  /**
   * Gets all scheduled posts for a user using ApiScheduledClient
   * @param {string} username - Username to get scheduled posts for
   * @returns {Promise<Array>} - Array of scheduled posts
   */
  async getScheduledPosts(username) {
    try {
      if (!username) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
          throw new Error('No user authenticated');
        }
        username = currentUser.username;
      }
      
      // Use ApiScheduledClient for scheduled posts
      const scheduledPosts = await this.apiScheduledClient.Get_ScheduledPosts(username);
      
      return scheduledPosts || [];
    } catch (error) {
      console.error('Failed to get scheduled posts:', error);
      // Return empty array instead of throwing to prevent blocking local drafts
      return [];
    }
  }

  /**
   * Delete a scheduled post by ID
   * @param {number} postId - ID of the scheduled post to delete
   * @param {string} username - Username of the post owner
   * @returns {Promise<boolean>} - true if deleted successfully
   */
  async deleteScheduledPost(postId, username) {
    try {
      if (!username) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
          throw new Error('No user authenticated');
        }
        username = currentUser.username;
      }
      
      await this.apiScheduledClient.DeleteScheduledPost(postId, username);
      return true;
    } catch (error) {
      console.error('Failed to delete scheduled post:', error);
      throw error;
    }
  }

  /**
   * Update a scheduled post
   * @param {number} postId - ID of the scheduled post to update
   * @param {string} username - Username of the post owner
   * @param {Object} updatedData - Updated post data
   * @returns {Promise<Object>} - Updated post data
   */
  async updateScheduledPost(postId, username, updatedData) {
    try {
      if (!username) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
          throw new Error('No user authenticated');
        }
        username = currentUser.username;
      }
      
      const updatedPost = await this.apiScheduledClient.UpdateScheduledPost(postId, username, updatedData);
      
      // Emit success event for scheduled post update
      eventEmitter.emit('post:schedule-updated', {
        success: true,
        scheduledPost: updatedPost
      });
      
      return updatedPost;
    } catch (error) {
      console.error('Failed to update scheduled post:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const createPostService = new CreatePostService();
export default createPostService;