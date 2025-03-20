import BasePlugin from '../BasePlugin.js';
import { REGEX_UTILS } from '../regex-config.js';

/**
 * Plugin specializzato per media Discord
 */
export default class DiscordMediaPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'discord-media';
    this.priority = 50; // Alta priorità per intercettare prima di altri plugin
    
    this.placeholderPrefix = 'DISCORD_MEDIA_';
    this.placeholderSuffix = '_DISCORD_END';
    
    // Opzioni di configurazione Discord-specifiche
    this.config = {
      preserveParams: true,
      maxWidth: '100%',
      addZoomClass: true,
      lazyLoad: true
    };
  }
  
  /**
   * Estrae URL Discord dal contenuto
   */
  extract(content) {
    if (!content) return [];
    
    const images = [];
    const seenUrls = new Set();
    
    // Dividi il contenuto in righe per trovare URL standalone
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Rileva URL Discord
      if (this.isDiscordUrl(trimmedLine)) {
        if (!seenUrls.has(trimmedLine)) {
          seenUrls.add(trimmedLine);
          
          const id = this.generateId(trimmedLine);
          images.push({
            id,
            url: trimmedLine,
            altText: 'Discord Image',
            originalText: trimmedLine,
            isDiscordMedia: true,
            placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
          });
        }
      }
    });
    
    return images;
  }
  
  /**
   * Verifica se un URL è di Discord
   */
  isDiscordUrl(url) {
    return typeof url === 'string' && 
           url.trim().length > 10 &&
           (url.includes('media.discordapp.net/attachments/') || 
            url.includes('cdn.discordapp.com/attachments/'));
  }
  
  /**
   * Genera HTML per un'immagine Discord
   */
  generateHtml(image, options) {
    const renderOptions = { ...this.config, ...options };
    
    // Mantieni l'URL originale con tutti i parametri
    const imageUrl = image.url;
    
    // Costruisci classi specifiche per Discord
    let cssClasses = 'markdown-img discord-media';
    if (renderOptions.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Lazy loading
    const lazyAttr = renderOptions.lazyLoad ? 'loading="lazy"' : '';
    
    // Aggiungi attributi specifici per Discord
    const extraAttrs = this.extractDiscordAttrs(imageUrl);
    
    // Genera il tag HTML
    return `<img 
      src="${imageUrl}" 
      alt="${REGEX_UTILS.escapeHtml(image.altText)}" 
      class="${cssClasses}" 
      ${lazyAttr}
      style="max-width:${renderOptions.maxWidth}; aspect-ratio: auto;"
      data-discord-media="true"
      ${extraAttrs}>`;
  }
  
  /**
   * Estrae attributi specifici da URL Discord
   */
  extractDiscordAttrs(url) {
    let attrs = '';
    
    // Estrai larghezza e altezza se presenti
    const widthMatch = url.match(/width=(\d+)/);
    const heightMatch = url.match(/height=(\d+)/);
    
    if (widthMatch && heightMatch) {
      attrs += `data-original-width="${widthMatch[1]}" data-original-height="${heightMatch[1]}"`;
    }
    
    // Estrai formato
    const formatMatch = url.match(/format=([^&]+)/);
    if (formatMatch) {
      attrs += ` data-format="${formatMatch[1]}"`;
    }
    
    return attrs;
  }
  
  /**
   * Genera un ID univoco per l'elemento Discord
   */
  generateId(url) {
    return 'discord_' + Math.random().toString(36).substring(2, 10);
  }
  
  /**
   * Pre-processing: sostituisci gli URL Discord con placeholder
   */
  preProcess(content) {
    const images = this.extract(content);
    
    let processedContent = content;
    images.forEach(image => {
      // Escape caratteri speciali nell'URL originale
      const escapedText = REGEX_UTILS.escapeRegExp(image.originalText);
      const textRegex = new RegExp(`(^|\\s)${escapedText}(\\s|$)`, 'g');
      
      // Sostituisci l'URL con un placeholder
      processedContent = processedContent.replace(
        textRegex, 
        `$1${image.placeholder}$2`
      );
    });
    
    return { processedContent, images };
  }
  
  /**
   * Post-processing: ripristina i placeholder con tag HTML
   */
  postProcess(content, images, options = {}) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      const htmlContent = this.generateHtml(image, options);
      
      const placeholderRegex = new RegExp(
        REGEX_UTILS.escapeRegExp(image.placeholder), 
        'g'
      );
      
      processedContent = processedContent.replace(placeholderRegex, htmlContent);
    });
    
    return processedContent;
  }
}