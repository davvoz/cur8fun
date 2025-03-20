import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';

/**
 * Servizio centralizzato per la gestione delle immagini
 * Fornisce un'interfaccia unificata per tutte le operazioni sulle immagini
 */
class ImageService {
  constructor() {
    // Inizializza un'istanza di ImagePlugin da utilizzare per tutte le operazioni
    this.imagePlugin = new ImagePlugin();
    
    // Cache per immagini fallite
    this.failedImages = new Set();
  }
  
  /**
   * Estrae tutte le URL delle immagini dal contenuto
   * @param {string} content - Contenuto da cui estrarre le immagini
   * @returns {Array<string>} Array di URL di immagini
   */
  extractAllImageUrls(content) {
    const images = this.imagePlugin.extract(content);
    return images.map(img => img.url);
  }
  
  /**
   * Estrae la prima immagine dal contenuto
   * @param {string|Object} post - Post o contenuto da cui estrarre l'immagine
   * @returns {string|null} URL della prima immagine o null
   */
  extractImageFromContent(post) {
    // Handle undefined/null input
    if (!post) return null;
    
    // Get content based on whether we got a post object or a string
    const content = typeof post === 'string' ? post : post?.body;
    
    // Check if content exists
    if (!content || typeof content !== 'string' || content.length === 0) {
      return null;
    }
    
    // Now extract images from the content string
    const images = this.imagePlugin.extract(content);
    
    // Return the first valid image URL or null if none found
    return images && images.length > 0 ? images[0].url : null;
  }
  
  /**
   * Ottiene l'immagine migliore da un post in base a metadati e contenuto
   * @param {string} body - Corpo del post
   * @param {Object} metadata - Metadati del post
   * @returns {string|null} URL della migliore immagine o null
   */
  getBestImageUrl(body, metadata = {}) {
    // Prima controlla i metadati
    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }
    
    // Altrimenti estrai dal contenuto
    return this.extractImageFromContent(body);
  }
  
  /**
   * Ottimizza l'URL di un'immagine per le diverse dimensioni e CDN
   * @param {string} url - URL dell'immagine da ottimizzare
   * @param {Object} options - Opzioni di ottimizzazione
   * @returns {string} URL ottimizzato
   */
  optimizeImageUrl(url, options = {}) {
    return this.imagePlugin.optimizeImageUrl(url, options);
  }
  
  /**
   * Segna un'immagine come fallita per evitare futuri tentativi di caricamento
   * @param {string} url - URL dell'immagine fallita
   */
  markImageAsFailed(url) {
    this.failedImages.add(url);
  }
  
  /**
   * Verifica se un'immagine è stata segnata come fallita
   * @param {string} url - URL dell'immagine da verificare
   * @returns {boolean} true se l'immagine è fallita
   */
  isImageFailed(url) {
    return this.failedImages.has(url);
  }
  
  /**
   * Genera un placeholder per immagini non disponibili
   * @param {string} text - Testo da mostrare nel placeholder
   * @returns {string} Data URL con SVG placeholder
   */
  getDataUrlPlaceholder(text = 'No Image') {
    return this.imagePlugin.getDataUrlPlaceholder(text);
  }
  
  /**
   * Sanitizza un URL di immagine
   * @param {string} url - URL da sanitizzare
   * @returns {string} URL sanitizzato
   */
  sanitizeUrl(url) {
    // Usa il REGEX_UTILS dal plugin se disponibile
    if (this.imagePlugin.normalizeImageUrl) {
      return this.imagePlugin.normalizeImageUrl(url);
    }
    
    // Implementazione di fallback
    if (!url || url.startsWith('data:')) return url;
    
    try {
      // Fix double slashes (except after protocol)
      url = url.replace(/:\/\/+/g, '://').replace(/([^:])\/+/g, '$1/');
      
      // Fix missing protocol
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      
      return url;
    } catch (e) {
      console.error('Error sanitizing URL:', e);
      return url;
    }
  }
}

// Esporta un'istanza singleton per utilizzarla in tutta l'applicazione
const imageService = new ImageService();
export default imageService;
