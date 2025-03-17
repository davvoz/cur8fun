import { imagePatterns, largeImagePatterns } from '../RegexPatterns.js';

/**
 * Utility class for handling image processing in content
 */
class ImageHandlers {
  /**
   * Process markdown image syntax and convert to proper HTML
   * @param {string} content - Content with markdown image syntax
   * @returns {string} - Content with processed images
   */
  static processMarkdownImages(content) {
    if (!content) return content;
    
    let processedContent = content;
    
    // Process direct image URLs
    processedContent = processedContent.replace(
      /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))(?:\s|$)/gi,
      (match, url) => {
        return `<img src="https://steemitimages.com/0x0/${url}" class="markdown-img-link medium-zoom-image">\n`;
      }
    );

    // Process centered markdown images
    processedContent = processedContent.replace(
      /<center>\s*!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*<\/center>/g,
      (match, alt, url) => {
        return `<center><img src="https://steemitimages.com/0x0/${url}" alt="${alt}" class="markdown-img-link medium-zoom-image"></center>`;
      }
    );

    // Process centered markdown images with links
    processedContent = processedContent.replace(
      /<center>\s*\[\!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)\s*<\/center>/g,
      (match, alt, imgUrl, linkUrl) => {
        return `<center><a href="${linkUrl}" class="markdown-external-link" target="_blank" rel="noopener"><img src="https://steemitimages.com/0x0/${imgUrl}" alt="${alt}"></a></center>`;
      }
    );

    // Process regular markdown images
    processedContent = processedContent.replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
      (match, alt, url) => {
        return `<img src="https://steemitimages.com/0x0/${url}" alt="${alt}" class="markdown-img-link medium-zoom-image">`;
      }
    );

    // Process markdown images with links
    processedContent = processedContent.replace(
      /\[\!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/g,
      (match, alt, imgUrl, linkUrl) => {
        return `<a href="${linkUrl}" class="markdown-external-link" target="_blank" rel="noopener"><img src="https://steemitimages.com/0x0/${imgUrl}" alt="${alt}"></a>`;
      }
    );
    
    return processedContent;
  }

  /**
   * Convert image URLs to use proxy for optimization
   * @param {string} url - Original image URL
   * @param {string} size - Size specification (e.g. '0x0' for full size)
   * @returns {string} - Proxied URL
   */
  static proxyImageUrl(url, size = '0x0') {
    if (!url) return '';
    
    // If already using proxy, don't re-proxy
    if (url.includes('steemitimages.com')) {
      return url;
    }
    
    return `https://steemitimages.com/${size}/${url}`;
  }
  
  /**
   * Detect if URL is an image
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL appears to be an image
   */
  static isImageUrl(url) {
    if (!url) return false;
    
    // Reset lastIndex for all regex patterns to prevent issues
    Object.values(imagePatterns).forEach(regex => {
      if (regex instanceof RegExp) regex.lastIndex = 0;
    });
    
    return Object.values(imagePatterns).some(pattern => pattern.test(url));
  }
  
  /**
   * Detect if image is likely to be a large image
   * @param {string} url - Image URL to check
   * @returns {boolean} - True if image is potentially large
   */
  static isLargeImage(url) {
    if (!url) return false;
    
    return largeImagePatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Generate appropriate HTML tag for an image
   * @param {string} url - Image URL
   * @param {Object} options - Optional parameters (alt, class, etc)
   * @returns {string} - HTML image tag
   */
  static generateImageTag(url, options = {}) {
    const {
      alt = '',
      className = 'markdown-img-link medium-zoom-image',
      lazyLoad = true
    } = options;
    
    const proxiedUrl = this.proxyImageUrl(url);
    
    // Apply lazy loading for performance
    const lazyLoadAttr = lazyLoad ? 'loading="lazy"' : '';
    
    return `<img src="${proxiedUrl}" alt="${alt}" class="${className}" ${lazyLoadAttr}>`;
  }
  
  /**
   * Extract all image URLs from content
   * @param {string} content - Content to search for images
   * @returns {Array} - Array of image URLs found
   */
  static extractImageUrls(content) {
    if (!content) return [];
    
    const images = [];
    const foundUrls = new Set();
    
    // Search through all image patterns
    Object.values(imagePatterns).forEach(pattern => {
      // Clone the regex to reset lastIndex
      const clonedPattern = new RegExp(pattern.source, pattern.flags);
      
      let match;
      while ((match = clonedPattern.exec(content)) !== null) {
        const url = match[0];
        
        // Prevent duplicates
        if (!foundUrls.has(url)) {
          foundUrls.add(url);
          images.push(url);
        }
      }
    });
    
    return images;
  }
  
  /**
   * Pre-process image tags for better display
   * @param {string} html - HTML content to process
   * @returns {string} - Processed HTML
   */
  static enhanceImageTags(html) {
    if (!html) return html;
    
    // Add lightbox/zoom capabilities to images
    const processedHtml = html.replace(
      /<img([^>]*)src="([^"]+)"([^>]*)>/gi,
      (match, beforeSrc, src, afterSrc) => {
        // Skip already enhanced images
        if (match.includes('data-zoomable') || match.includes('medium-zoom-image')) {
          return match;
        }
        
        // Add medium-zoom class if not present
        const hasZoomClass = beforeSrc.includes('medium-zoom-image') || 
                            afterSrc.includes('medium-zoom-image');
        
        const zoomClass = hasZoomClass ? '' : 'medium-zoom-image';
        const classAttr = zoomClass ? 
          (beforeSrc.includes('class="') || afterSrc.includes('class="') ? 
            match.replace(/class="([^"]*)"/, `class="$1 ${zoomClass}"`) : 
            match.replace('<img', `<img class="${zoomClass}"`)) : 
          match;
        
        return classAttr.replace('<img', '<img data-zoomable="true"');
      }
    );
    
    return processedHtml;
  }
}

export default ImageHandlers;