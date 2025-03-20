import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS, SHARED_CACHE, REGEX_UTILS } from '../regex-config.js';

/**
 * Plugin per gestire immagini nel contenuto markdown
 * Incorpora funzionalità complete da ImageUtils
 */
export default class ImagePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'image';
    this.priority = 30;
    
    // Tutti i pattern regex per le immagini
    this.patterns = Object.values(REGEX_PATTERNS.IMAGE);
    
    this.placeholderPrefix = 'IMAGE_PLACEHOLDER_';
    this.placeholderSuffix = '_IMG_END';
    
    // Opzioni di configurazione
    this.config = {
      lazyLoad: true,
      addZoomClass: true,
      optimizeUrls: true,
      responsiveImages: true,
      maxWidth: '100%',
      addLinkIndicator: true,
      preserveDiscordParams: true // Aggiungiamo questa opzione per Discord
    };
  }
  
  /**
   * Estrattore migliorato che include tutte le funzionalità di ImageUtils.extractAllImageUrls
   */
  extract(content) {
    if (!content) return [];
    
    const images = [];
    const seenUrls = new Set(); // Previene duplicati
    
    // 0. Prima elabora l'HTML che contiene markdown
    const contentAfterHtmlExtraction = this.extractHtmlWithMarkdown(content, images, seenUrls);
    
    // 1. Estrai prima le immagini Discord (alta priorità)
    this.extractDiscordImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 2. Poi estrai le immagini cliccabili
    this.extractClickableImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 3. Poi estrai le immagini standard markdown
    this.extractMarkdownImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 4. Estrai immagini HTML
    this.extractHtmlImages(contentAfterHtmlExtraction, images, seenUrls);
    
    // 5. Estrai URL diretti di immagini
    this.extractDirectImageUrls(contentAfterHtmlExtraction, images, seenUrls);

    return images;
  }
  
  /**
   * Estrae immagini cliccabili (Markdown con link)
   * @private
   */
  extractClickableImages(content, images, seenUrls) {
    // Usa pattern centralizzato invece di ridefinirlo
    const clickableImageRegex = REGEX_PATTERNS.IMAGE.CLICKABLE_IMAGE;
    let match;
    
    while ((match = clickableImageRegex.exec(content)) !== null) {
      const altText = match[1] || '';
      const imageUrl = match[2] || '';
      const linkUrl = match[3] || '';
      const originalText = match[0];
      
      // Verifica che l'URL dell'immagine sia valido
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText,
          originalText,
          isClickable: true,
          linkUrl: REGEX_UTILS.sanitizeUrl(linkUrl),
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Estrae immagini standard markdown
   * @private
   */
  extractMarkdownImages(content, images, seenUrls) {
    // Usa pattern centralizzato
    const standardImageRegex = REGEX_PATTERNS.IMAGE.MARKDOWN_IMAGE;
    let match;
    
    while ((match = standardImageRegex.exec(content)) !== null) {
      const altText = match[1] || '';
      const imageUrl = match[2] || '';
      const originalText = match[0];
      
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText,
          originalText,
          isClickable: false,
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Estrae immagini da tag HTML
   * @private
   */
  extractHtmlImages(content, images, seenUrls) {
    // Per ogni pattern HTML di immagini
    [
      REGEX_PATTERNS.IMAGE.HTML_IMG_DOUBLE_QUOTES,
      REGEX_PATTERNS.IMAGE.HTML_IMG_SINGLE_QUOTES,
      REGEX_PATTERNS.IMAGE.HTML_IMG_NO_QUOTES
    ].forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const imageUrl = match[1] || '';
        const originalText = match[0];
        
        // Estrai attributo alt se presente
        const altMatch = originalText.match(/alt=["']([^"']*)["']/i);
        const altText = altMatch ? altMatch[1] : '';
        
        const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
        
        if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
          seenUrls.add(normalizedImgUrl);
          
          const id = this.generateImageId(normalizedImgUrl);
          images.push({
            id,
            url: normalizedImgUrl,
            altText,
            originalText,
            isClickable: false,
            isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
            placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
          });
        }
      }
    });
  }
  
  /**
   * Estrae URL diretti di immagini
   * @private
   */
  extractDirectImageUrls(content, images, seenUrls) {
    // Usa i pattern centralizzati invece di ridefinirli
    const imageRegex = REGEX_PATTERNS.IMAGE.RAW_IMAGE_URL;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      const imageUrl = match[1] || '';
      const originalText = match[0];
      
      const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
      
      if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
        seenUrls.add(normalizedImgUrl);
        
        const id = this.generateImageId(normalizedImgUrl);
        images.push({
          id,
          url: normalizedImgUrl,
          altText: 'Image',  // Default alt text
          originalText,
          isClickable: false,
          isInvalidImage: !this.isValidImageUrl(normalizedImgUrl),
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`
        });
      }
    }
  }
  
  /**
   * Estrae le URL delle immagini Discord
   * @private
   */
  extractDiscordImages(content, images, seenUrls) {
    // Cerca per righe intere che contengono solo URL Discord
    const lines = content.split('\n');
    
    // Controlla prima le righe standalone (più alta priorità)
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (this.isDiscordImage(trimmedLine)) {
        // IMPORTANTE: NON rimuovere i parametri dell'URL
        const fullUrl = trimmedLine;
        
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          
          const id = this.generateImageId(fullUrl);
          images.push({
            id,
            url: fullUrl, // Mantieni l'URL completo con tutti i parametri
            altText: 'Discord Image',
            originalText: trimmedLine,
            isDiscordImage: true,
            isStandalone: true,
            isClickable: false,
            isInvalidImage: false,
            placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`,
            // Estrai info aggiuntive se presenti nei parametri URL
            discordMeta: this.extractDiscordMetadata(fullUrl)
          });
        }
      }
    });
    
    // Cerca nel resto del contenuto (URL incorporati)
    const discordRegex = REGEX_PATTERNS.DISCORD.IMAGE_URL;
    let match;
    while ((match = discordRegex.exec(content)) !== null) {
      const fullUrl = match[0];
      
      if (!seenUrls.has(fullUrl)) {
        seenUrls.add(fullUrl);
        
        const id = this.generateImageId(fullUrl);
        images.push({
          id,
          url: fullUrl, // Mantieni l'URL completo
          altText: 'Discord Image',
          originalText: fullUrl,
          isDiscordImage: true,
          isClickable: false,
          isInvalidImage: false,
          placeholder: `${this.placeholderPrefix}${id}${this.placeholderSuffix}`,
          discordMeta: this.extractDiscordMetadata(fullUrl)
        });
      }
    }
  }
  
  /**
   * Verifica se un URL è un'immagine valida
   * @param {string} url - URL da verificare
   * @returns {boolean} - True se è un'immagine valida
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Trim the URL
    url = url.trim();
    
    // Reject invalid URLs
    if (url.length < 10) return false;
    
    try {
      // Check for common image file extensions
      const hasImageExtension = /\.(jpe?g|png|gif|webp|bmp|svg)(?:\?.*)?$/i.test(url);
      
      // Check for common image hosting domains
      const isImageHost = /(imgur\.com|steemitimages\.com|cdn\.steemitimages\.com|ibb\.co)/i.test(url);
      
      // Check for steemit CDN image URLs
      const isSteemitCDN = /steemitimages\.com\/.*(?:0x0|[0-9]+x[0-9]+)\/.*/.test(url) ||
        /steemitimages\.com\/DQm.*/.test(url);
      
      // Check for IPFS content
      const isIPFS = /ipfs\.[^\/]+\/ipfs\/\w+/.test(url);
      
      // Aggiungi controllo per Discord
      const isDiscord = /(media\.discordapp\.net|cdn\.discordapp\.com)\/attachments\//.test(url);
      
      return hasImageExtension || isImageHost || isSteemitCDN || isIPFS || isDiscord;
    } catch (e) {
      console.error('Error validating image URL:', e);
      return false;
    }
  }
  
  /**
   * Normalizza l'URL dell'immagine
   * @param {string} url - URL originale
   * @returns {string} - URL normalizzato
   */
  normalizeImageUrl(url) {
    if (!url) return '';
    
    // Rimuovi eventuali virgolette
    url = url.trim().replace(/^["']|["']$/g, '');
    
    // Per immagini Discord, preserva l'URL originale con i parametri
    if (this.isDiscordImage(url)) {
      return url; // Non modificare l'URL Discord
    }
    
    // Pulisci l'URL per altre immagini
    return REGEX_UTILS.sanitizeUrl(url);
  }
  
  /**
   * Ottimizza l'URL dell'immagine
   * @param {string} url - URL originale
   * @param {Object} options - Opzioni di ottimizzazione
   * @returns {string} - URL ottimizzato
   */
  optimizeImageUrl(url, options = {}) {
    // Imposta un limite massimo di dimensione per le immagini grandi
    const { width = 800, height = 0, maxWidth = 1200 } = options;
    
    // Se viene richiesta una larghezza superiore al maxWidth, usa maxWidth
    const targetWidth = Math.min(width, maxWidth);
    
    if (!url) return this.getDataUrlPlaceholder('No Image');
    
    // Early return for placeholders and failed images
    if (url.startsWith('data:') ||
        url.includes('/placeholder.png') ||
        url.includes('/default-avatar') ||
        SHARED_CACHE.failedImageUrls.has(url)) {
      return this.getDataUrlPlaceholder('No Image');
    }
    
    try {
      // Check cache first
      const cacheKey = `${url}_${width}x${height}`;
      if (SHARED_CACHE.optimizedUrls.has(cacheKey)) {
        return SHARED_CACHE.optimizedUrls.get(cacheKey);
      }
      
      // Discord URLs - SEMPRE conserva l'URL originale con tutti i parametri
      if (this.isDiscordImage(url)) {
        // Salva in cache e restituisci senza modifiche
        SHARED_CACHE.optimizedUrls.set(cacheKey, url);
        return url;
      }
      
      // Clean URL for non-Discord images
      url = REGEX_UTILS.sanitizeUrl(url);
      
      // Special handling for specific domains
      let optimizedUrl;
      
      // peakd.com URLs - return as is
      if (url.includes('files.peakd.com')) {
        return url;
      }
      
      // DQm format URLs - return as is
      if (url.includes('steemitimages.com/DQm') || url.includes('cdn.steemitimages.com/DQm')) {
        return url;
      }
      
      // Handle imgur URLs
      if (url.includes('imgur.com')) {
        const imgurId = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
        if (imgurId && imgurId[1]) {
          // Usa l'immagine originale invece della thumbnail
          optimizedUrl = `https://i.imgur.com/${imgurId[1]}.jpg`;
          SHARED_CACHE.optimizedUrls.set(cacheKey, optimizedUrl);
          return optimizedUrl;
        }
      }
      
      // Usa steemitimages.com per altre immagini
      optimizedUrl = `https://steemitimages.com/${targetWidth}x0/${url}`;
      SHARED_CACHE.optimizedUrls.set(cacheKey, optimizedUrl);
      return optimizedUrl;
      
    } catch (error) {
      console.error('Error optimizing URL:', url, error);
      return url;
    }
  }
  
  /**
   * Genera un placeholder con SVG per immagini mancanti
   * @param {string} text - Testo da visualizzare
   * @returns {string} - Data URL con SVG
   */
  getDataUrlPlaceholder(text = 'No Image') {
    const safeText = String(text).replace(/[^\w\s-]/g, '');
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${safeText}</text></svg>`;
  }
  
  /**
   * Genera HTML per un'immagine standard
   * @param {Object} image - Informazioni sull'immagine
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Tag HTML per l'immagine
   */
  generateImageHtml(image, options) {
    // Se l'immagine è invalida, mostra un placeholder
    if (image.isInvalidImage) {
      return `<div class="markdown-invalid-img">
        <img src="${this.getDataUrlPlaceholder(image.altText || 'Invalid Image')}" 
          alt="${this.escapeHtml(image.altText)}" 
          class="markdown-img invalid-image-placeholder">
        <span class="invalid-image-note">Invalid image URL</span>
      </div>`;
    }
    
    // Gestione speciale per immagini Discord
    if (image.isDiscordImage) {
      return this.generateDiscordImageHtml(image, options);
    }
    
    // Ottimizza l'URL dell'immagine se richiesto (per immagini non-Discord)
    const imageUrl = options.optimizeUrls ? 
      this.optimizeImageUrl(image.url) : image.url;
    
    // Costruisci le classi CSS
    let cssClasses = 'markdown-img';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Attributi width e height per prevenire layout shift
    const aspectAttr = `style="max-width:${options.maxWidth}; aspect-ratio: auto;"`;
    
    // Crea srcset per immagini responsive (non Discord)
    const srcset = (options.responsiveImages && !image.isDiscordImage) ? this.createSrcSet(imageUrl) : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Attributo sizes per responsive images
    const sizesAttr = srcset ? `sizes="(max-width: 768px) 100vw, 800px"` : '';
    
    // Genera il tag img con aspect ratio preservato
    return `<img src="${imageUrl}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${cssClasses}" 
      ${lazyAttr} 
      ${srcsetAttr}
      ${sizesAttr}
      ${aspectAttr}>`;
  }
  
  /**
   * Genera HTML per un'immagine cliccabile (con link)
   * @param {Object} image - Informazioni sull'immagine cliccabile
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - HTML per l'immagine cliccabile
   */
  generateClickableImageHtml(image, options) {
    // Per immagini non valide, genera un banner-link più visibile
    if (image.isInvalidImage) {
      return `<a href="${image.linkUrl}" class="markdown-external-link image-link" target="_blank" rel="noopener noreferrer">
        <div class="preview-banner">
          <img src="${image.linkUrl}" class="link-preview-icon">
          <h4>${this.escapeHtml(image.altText || "Link esterno")}</h4>
          <p class="preview-url">${this.escapeHtml(image.linkUrl)}</p>
          <div class="image-link-overlay">
            <span class="image-link-icon">🔗</span>
          </div>
        </div>
      </a>`;
    }
    
    // Ottimizza l'URL dell'immagine se richiesto
    const imageUrl = options.optimizeUrls ? 
      this.optimizeImageUrl(image.url) : image.url;
    
    // Crea srcset per immagini responsive
    const srcset = options.responsiveImages ? this.createSrcSet(imageUrl) : '';
    
    // Costruisci le classi CSS
    let imgClasses = 'markdown-img clickable-img';
    if (options.addZoomClass) imgClasses += ' medium-zoom-image';
    
    // Costruisci le classi per il container
    let cssClasses = 'markdown-img';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Aggiungi attributi per lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Crea attributo srcset se disponibile
    const srcsetAttr = srcset ? `srcset="${srcset}"` : '';
    
    // Attributo sizes per responsive images
    const sizesAttr = srcset ? `sizes="(max-width: 768px) 100vw, 800px"` : '';
    
    // Attributi width e height per prevenire layout shift
    const aspectAttr = `style="max-width:${options.maxWidth}; aspect-ratio: auto;"`;
    
    // Gestisci errori di caricamento
    // const onErrorFunc = `onerror="this.onerror=null; this.src='${this.getDataUrlPlaceholder('Error')}'; ${SHARED_CACHE.failedImageUrls.add(image.url)}"`;
    
    // Genera il tag img all'interno di un tag a
    const imgTag = `<img src="${imageUrl}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${imgClasses}" 
      ${lazyAttr} 
      ${srcsetAttr}
      ${sizesAttr}
      ${aspectAttr}>`;
    
    // IMPORTANTE: Avvolgi l'immagine in un tag <a> per renderla cliccabile
    const clicable = `<a href="${image.linkUrl}" class="img-link-container" target="_blank" rel="noopener noreferrer">
      ${imgTag}
      <div class="img-link-indicator">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </a>`;
    console.log(clicable);
    return clicable;
  }
  
  /**
   * Genera HTML per un'immagine Discord specifica
   * @param {Object} image - Informazioni sull'immagine Discord
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - Tag HTML per l'immagine Discord
   */
  generateDiscordImageHtml(image, options) {
    // Costruisci le classi CSS specifiche per Discord
    let cssClasses = 'markdown-img discord-media';
    if (options.addZoomClass) cssClasses += ' medium-zoom-image';
    
    // Lazy loading
    const lazyAttr = options.lazyLoad ? 'loading="lazy"' : '';
    
    // Aggiungi attributi per metadati Discord
    let discordAttrs = 'data-discord-media="true"';
    
    if (image.discordMeta) {
      const { width, height, format } = image.discordMeta;
      if (width && height) {
        discordAttrs += ` data-original-width="${width}" data-original-height="${height}"`;
      }
      if (format) {
        discordAttrs += ` data-format="${format}"`;
      }
    }
    
    // Genera il tag img specifico per Discord
    return `<img 
      src="${image.url}" 
      alt="${this.escapeHtml(image.altText)}" 
      class="${cssClasses}" 
      ${lazyAttr}
      style="max-width:${options.maxWidth}; aspect-ratio: auto;"
      ${discordAttrs}>`;
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
   * Sostituisci le immagini con placeholder
   * @param {string} content - Contenuto originale
   * @param {Array<Object>} images - Informazioni sulle immagini
   * @returns {string} - Contenuto con placeholder
   */
  createPlaceholders(content, images) {
    if (!images || images.length === 0) return content;
    
    let processedContent = content;
    
    images.forEach(image => {
      // Escape caratteri speciali per regex
      const escapedText = REGEX_UTILS.escapeRegExp(image.originalText);
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
    
    // Prima trova i contenitori HTML e le loro immagini
    const htmlContainers = images.filter(img => img.isHtmlContainer);
    const regularImages = images.filter(img => !img.isHtmlContainer && !img.parentTagId);
    
    // Elabora prima i contenitori HTML
    htmlContainers.forEach(container => {
      let innerContent = container.innerContent;
      
      // Trova tutte le immagini che appartengono a questo contenitore
      const childImages = images.filter(img => img.parentTagId === container.id);
      
      // Sostituisci ogni immagine nel contenuto interno
      childImages.forEach(image => {
        const imgHtml = this.generateClickableImageHtml(image, renderOptions);
        innerContent = innerContent.replace(image.originalText, imgHtml);
      });
      
      // Ricostruisci il tag HTML completo con il contenuto elaborato
      const restoredHtml = `<${container.htmlTag}${container.htmlAttrs}>${innerContent}</${container.htmlTag}>`;
      
      // Sostituisci il placeholder con l'HTML completo
      const placeholderRegex = new RegExp(REGEX_UTILS.escapeRegExp(container.placeholder), 'g');
      processedContent = processedContent.replace(placeholderRegex, restoredHtml);
    });
    
    // Poi elabora le immagini normali
    regularImages.forEach(image => {
      let imgHtml;
      
      if (image.isClickable) {
        imgHtml = this.generateClickableImageHtml(image, renderOptions);
      } else {
        imgHtml = this.generateImageHtml(image, renderOptions);
      }
      
      const placeholderRegex = new RegExp(REGEX_UTILS.escapeRegExp(image.placeholder), 'g');
      processedContent = processedContent.replace(placeholderRegex, imgHtml);
    });
    
    return processedContent;
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
   * Escape caratteri HTML speciali
   * @param {string} html - Testo da sanitizzare
   * @returns {string} - Testo sanitizzato
   */
  escapeHtml(html) {
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Estrae tag HTML che contengono immagini markdown
   * @private
   */
  extractHtmlWithMarkdown(content, images, seenUrls) {
    // Usa pattern centralizzato per tag HTML
    const htmlTagRegex = /<(center|div|span|p)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let processedContent = content;
    
    for (const match of content.matchAll(htmlTagRegex)) {
      const tagName = match[1];
      const tagAttrs = match[2];
      const innerContent = match[3];
      const fullMatch = match[0];
      
      // Verifica se il contenuto interno contiene un'immagine cliccabile
      if (innerContent.includes('[![') && innerContent.includes(')](')) {
        // Crea un ID unico per questo intero tag HTML
        const tagId = `HTML_TAG_${Math.random().toString(36).substring(2, 10)}`;
        const tagPlaceholder = `${this.placeholderPrefix}${tagId}${this.placeholderSuffix}`;
        
        // Salva le informazioni sul tag HTML
        images.push({
          id: tagId,
          originalText: fullMatch,
          isHtmlContainer: true,
          htmlTag: tagName,
          htmlAttrs: tagAttrs,
          innerContent,
          placeholder: tagPlaceholder,
        });
        
        // Sostituisci il tag con un placeholder
        const escapedMatch = REGEX_UTILS.escapeRegExp(fullMatch);
        const fullTagRegex = new RegExp(escapedMatch, 'g');
        processedContent = processedContent.replace(fullTagRegex, tagPlaceholder);
        
        // Ora elabora le immagini all'interno del tag, ma senza modificare il contenuto originale
        const clickableImageRegex = REGEX_PATTERNS.IMAGE.CLICKABLE_IMAGE;
        for (const imgMatch of innerContent.matchAll(clickableImageRegex)) {
          const altText = imgMatch[1] || '';
          const imageUrl = imgMatch[2] || '';
          const linkUrl = imgMatch[3] || '';
          const originalImgText = imgMatch[0];
          
          const normalizedImgUrl = this.normalizeImageUrl(imageUrl);
          
          if (normalizedImgUrl && !seenUrls.has(normalizedImgUrl)) {
            seenUrls.add(normalizedImgUrl);
            
            const imgId = this.generateImageId(normalizedImgUrl);
            // È importante non aggiungere placeholder per queste immagini
            // perché le tratteremo come parte del contenitore HTML
            images.push({
              id: imgId,
              url: normalizedImgUrl,
              altText,
              originalText: originalImgText,
              parentTagId: tagId, // Collega l'immagine al tag genitore
              isClickable: true,
              isInHtmlTag: true,
              linkUrl: REGEX_UTILS.sanitizeUrl(linkUrl),
              isInvalidImage: !this.isValidImageUrl(normalizedImgUrl)
            });
          }
        }
      }
    }
    
    return processedContent;
  }

  /**
   * Genera HTML per un'immagine cliccabile dentro un tag HTML
   * @param {Object} image - Informazioni sull'immagine
   * @param {Object} options - Opzioni di rendering
   * @returns {string} - HTML completo
   */
  generateHtmlWrappedImageHtml(image, options) {
    // Genera prima l'immagine cliccabile interna
    const innerHtml = this.generateClickableImageHtml({
      ...image,
      originalText: image.innerMarkdown,
      isClickable: true
    }, options);
    
    // Avvolgi l'immagine nel tag HTML originale
    return `<${image.htmlTag}${image.htmlAttrs}>${innerHtml}</${image.htmlTag}>`;
  }

  /**
   * Identifica se un URL è un'immagine Discord e ne mantiene i parametri
   * @param {string} url - URL da verificare
   * @returns {boolean} - True se è un'immagine Discord
   */
  isDiscordImage(url) {
    return url && 
      ((url.includes('media.discordapp.net/attachments/') || 
        url.includes('cdn.discordapp.com/attachments/')) &&
       // Verifica alcuni parametri tipici delle immagini Discord
       (url.includes('format=webp') || 
        url.includes('width=') || 
        url.includes('height=') ||
        url.includes('ex=') ||
        url.includes('is=')));
  }

  /**
   * Estrae metadati dai parametri URL di Discord
   * @param {string} url - URL Discord completo
   * @returns {Object} - Metadati estratti
   */
  extractDiscordMetadata(url) {
    const metadata = {
      width: null,
      height: null,
      format: null,
      hasParams: url.includes('?')
    };
    
    if (!url.includes('?')) return metadata;
    
    // Estrai larghezza e altezza
    const widthMatch = url.match(/width=(\d+)/);
    if (widthMatch) metadata.width = parseInt(widthMatch[1]);
    
    const heightMatch = url.match(/height=(\d+)/);
    if (heightMatch) metadata.height = parseInt(heightMatch[1]);
    
    // Estrai formato
    const formatMatch = url.match(/format=([^&]+)/);
    if (formatMatch) metadata.format = formatMatch[1];
    
    return metadata;
  }
}