import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS } from './regex-config.js';

/**
 * Plugin per gestire immagini nel contenuto markdown
 * Supporta immagini standard e immagini cliccabili (link)
 */
export default class ImagePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'image';
    this.priority = 30; // Priorità più alta di YouTube per processare prima
    
    // Pattern regex per diversi tipi di immagini
    this.patterns = [
      // Immagini cliccabili: [![alt](img_url)](link_url)
      /!\[(.*?)\]\((.*?)\)(?=\(([^)]+)\))/g,
      
      // Pattern markdown per immagini: ![alt text](url)
      /!\[(.*?)\]\((.*?)\)(?!\()/g,
      
      // Pattern per URL diretti di immagini
      REGEX_PATTERNS.IMAGE,
      
      // Pattern specifici per cdn di Steem
      /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/DQm[a-zA-Z0-9]{46}\/[^)\s"]*/g
    ];
    
    this.placeholderPrefix = 'IMAGE_PLACEHOLDER_';
    this.placeholderSuffix = '_IMG_END';
    
    // Opzioni di configurazione
    this.config = {
      lazyLoad: true,
      addZoomClass: true,
      optimizeUrls: true,
      responsiveImages: true,
      maxWidth: '100%',
      addLinkIndicator: true  // Aggiunge un indicatore visivo per immagini cliccabili
    };
  }
  
  /**
   * Estrae le immagini dal contenuto, incluse le immagini cliccabili
   * @param {string} content - Contenuto da analizzare
   * @returns {Array<Object>} - Informazioni sulle immagini estratte
   */
  extract(content) {
    if (!content) return [];
    
    const images = [];
    const seenUrls = new Set(); // Previene duplicati
    
    // Prima cerca le immagini cliccabili (priorità)
    const clickableImageRegex = /!\[(.*?)\]\((.*?)\)\(([^)]+)\)/g;
    let clickableMatch;
    while ((clickableMatch = clickableImageRegex.exec(content)) !== null) {
      const altText = clickableMatch[1] || '';
      const imageUrl = clickableMatch[2] || '';
      const linkUrl = clickableMatch[3] || '';
      const originalText = clickableMatch[0];
      
      if (imageUrl && !seenUrls.has(imageUrl)) {
        seenUrls.add(imageUrl);
        
        const id = this.generateImageId(imageUrl);
        images.push({
          id,
          url: this.normalizeImageUrl(imageUrl),
          altText: altText || 'Image',
          originalText,
          isClickable: true,
          linkUrl,
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
    
    // Poi cerca le immagini standard
    const standardImageRegex = /!\[(.*?)\]\((.*?)\)(?!\()/g;
    let standardMatch;
    while ((standardMatch = standardImageRegex.exec(content)) !== null) {
      const altText = standardMatch[1] || '';
      const imageUrl = standardMatch[2] || '';
      const originalText = standardMatch[0];
      
      if (imageUrl && !seenUrls.has(imageUrl)) {
        seenUrls.add(imageUrl);
        
        const id = this.generateImageId(imageUrl);
        images.push({
          id,
          url: this.normalizeImageUrl(imageUrl),
          altText: altText || 'Image',
          originalText,
          isClickable: false,
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
    
    // Infine, cerca immagini da URL diretti
    if (REGEX_PATTERNS.IMAGE) {
      const urlRegex = new RegExp(REGEX_PATTERNS.IMAGE.source, REGEX_PATTERNS.IMAGE.flags);
      let urlMatch;
      
      while ((urlMatch = urlRegex.exec(content)) !== null) {
        const imageUrl = urlMatch[1];
        const originalText = urlMatch[0];
        
        if (imageUrl && !seenUrls.has(imageUrl)) {
          seenUrls.add(imageUrl);
          
          const id = this.generateImageId(imageUrl);
          images.push({
            id,
            url: this.normalizeImageUrl(imageUrl),
            altText: 'Image',
            originalText,
            isClickable: false,
            placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
          });
        }
      }
    }
    
    return images;
  }
  
  /**
   * Sostituisce le immagini con placeholder
   * @param {string} content - Contenuto originale
   * @param {Array<Object>} images - Informazioni sulle immagini
   * @returns {string} - Contenuto con placeholder
   */
  createPlaceholders(content, images) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      // Escape caratteri speciali per regex
      const escapedText = this.escapeRegExp(image.originalText);
      const textRegex = new RegExp(escapedText, 'g');
      
      // Sostituisci il testo originale con il placeholder
      processedContent = processedContent.replace(textRegex, image.placeholder);
    });
    
    return processedContent;
  }
  
  /**
   * Ripristina i placeholder con tag HTML immagine
   * @param {string} content - Contenuto con placeholder
   * @param {Array<Object>} images - Informazioni sulle immagini
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Contenuto con tag HTML immagine
   */
  restoreContent(content, images, options = {}) {
    if (!images || images.length === 0) return content;
    
    // Combina le opzioni predefinite con quelle passate
    const renderOptions = { ...this.config, ...options };
    
    let processedContent = content;
    
    images.forEach(image => {
      let imgHtml;
      if (image.isClickable) {
        imgHtml = this.generateClickableImageHtml(image, renderOptions);
      } else {
        imgHtml = this.generateImageHtml(image, renderOptions);
      }
      
      const placeholderRegex = new RegExp(this.escapeRegExp(image.placeholder), 'g');
      processedContent = processedContent.replace(placeholderRegex, imgHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Genera HTML per un'immagine standard
   * @param {Object} image - Informazioni sull'immagine
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Tag HTML per l'immagine
   */
  generateImageHtml(image, options) {
    // Ottimizza l'URL dell'immagine se richiesto
    const imageUrl = options.optimizeUrls ? this.optimizeImageUrl(image.url) : image.url;
    
    // Crea srcset per immagini responsive
    const srcset = options.responsiveImages ? this.createSrcSet(imageUrl) : '';
    
    // Costruisci le classi CSS
    let cssClasses = 'markdown-img';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Genera il tag img
    return `<img src="${imageUrl}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${cssClasses}" 
      ${lazyAttr} 
      ${srcsetAttr}
      style="max-width:${options.maxWidth}">`;
  }
  
  /**
   * Genera HTML per un'immagine cliccabile (con link)
   * @param {Object} image - Informazioni sull'immagine cliccabile
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - HTML per l'immagine cliccabile
   */
  generateClickableImageHtml(image, options) {
    // Ottimizza l'URL dell'immagine se richiesto
    const imageUrl = options.optimizeUrls ? this.optimizeImageUrl(image.url) : image.url;
    
    // Crea srcset per immagini responsive
    const srcset = options.responsiveImages ? this.createSrcSet(imageUrl) : '';
    
    // Costruisci le classi CSS
    let imgClasses = 'markdown-img clickable-img';
    if (options.addZoomClass) imgClasses += ' medium-zoom-image';
    
    // Costruisci le classi per il container
    let linkClasses = 'img-link-container';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Indicatore di link (icona di reindirizzamento)
    const linkIndicator = options.addLinkIndicator ? 
      `<div class="img-link-indicator">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </div>` : '';
    
    // Genera il tag img all'interno di un tag a
    return `
      <div class="${linkClasses}">
        <a href="${image.linkUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${imageUrl}" 
            alt="${this.escapeHtml(image.altText)}" 
            class="${imgClasses}" 
            ${lazyAttr} 
            ${srcsetAttr}
            style="max-width:${options.maxWidth}">
          ${linkIndicator}
        </a>
      </div>`;
  }
  
  /**
   * Crea valori srcset per immagini responsive
   * @param {string} url - URL dell'immagine
   * @returns {string} - Valori srcset
   */
  createSrcSet(url) {
    // Non creare srcset per URL che non sono di steemitimages o peakd
    if (!url.includes('steemitimages.com') && 
        !url.includes('cdn.steemitimages.com') &&
        !url.includes('files.peakd.com')) {
      return '';
    }
    
    let baseUrl = url;
    
    // Per le immagini steemitimages.com, ottimizza per diverse dimensioni
    if (url.includes('steemitimages.com') || url.includes('cdn.steemitimages.com')) {
      // Rimuovi dimensioni esistenti
      if (baseUrl.includes('steemitimages.com/0x0/')) {
        baseUrl = baseUrl.replace('0x0/', '');
      }
      
      // Crea versioni di diverse dimensioni
      const smallUrl = `https://steemitimages.com/400x0/${baseUrl}`;
      const mediumUrl = `https://steemitimages.com/800x0/${baseUrl}`;
      const largeUrl = `https://steemitimages.com/1200x0/${baseUrl}`;
      
      return `${smallUrl} 400w, ${mediumUrl} 800w, ${largeUrl} 1200w`;
    }
    
    return '';
  }
  
  /**
   * Normalizza l'URL dell'immagine
   * @param {string} url - URL originale
   * @returns {string} - URL normalizzato
   */
  normalizeImageUrl(url) {
    if (!url) return '';
    
    // Rimuovi caratteri di spaziatura
    url = url.trim();
    
    // Assicurati che l'URL abbia uno schema http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url.replace(/^\/\//, '');
    }
    
    return url;
  }
  
  /**
   * Ottimizza l'URL dell'immagine per prestazioni migliori
   * @param {string} url - URL originale
   * @returns {string} - URL ottimizzato
   */
  optimizeImageUrl(url) {
    if (!url) return '';
    
    // Se è un'immagine steemitimages.com, usa il proxy per ottimizzazione
    if (url.includes('steemitimages.com') || url.includes('cdn.steemitimages.com')) {
      // Evita doppia ottimizzazione
      if (!url.includes('/0x0/') && !url.includes('/640x0/')) {
        return `https://steemitimages.com/0x0/${url}`;
      }
    }
    
    return url;
  }
  
  /**
   * Genera un ID univoco per l'immagine basato sull'URL
   * @param {string} url - URL dell'immagine
   * @returns {string} - ID univoco
   */
  generateImageId(url) {
    // Crea un hash semplice dall'URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Converti in integer a 32 bit
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
  
  /**
   * Escape caratteri speciali per regex
   * @param {string} string - Stringa da elaborare
   * @returns {string} - Stringa elaborata
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Escape caratteri HTML speciali
   * @param {string} html - Testo da sanitizzare
   * @returns {string} - Testo sanitizzato
   */
  escapeHtml(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}