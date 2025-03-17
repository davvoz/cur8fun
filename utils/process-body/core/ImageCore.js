import { imagePatterns, largeImagePatterns, resetRegexLastIndex } from '../RegexPatterns.js';

/**
 * Core utility class for image handling
 */
class ImageCore {
  // Cache che si può condividere tra tutti i moduli
  static failedImageUrls = new Set();
  static cachedUrlsMap = new Map();
  
  /**
   * Check if a URL matches any image pattern
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL matches an image pattern
   */
  static isImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Reset lastIndex per tutti i pattern prima di utilizzarli
    resetRegexLastIndex(imagePatterns);
    
    return Object.values(imagePatterns).some(pattern => {
      return pattern.test(url);
    });
  }
  
  /**
   * Check if URL is likely a large image
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL matches a large image pattern
   */
  static isLargeImage(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Reset lastIndex per tutti i pattern
    resetRegexLastIndex(largeImagePatterns);
    
    return largeImagePatterns.some(pattern => {
      return pattern.test(url);
    });
  }
  
  /**
   * Optimize image URL with Steem proxy
   * @param {string} url - Original URL
   * @param {string} size - Size specification, e.g., '0x0'
   * @returns {string} - Optimized URL
   */
  static proxyImageUrl(url, size = '0x0') {
    if (!url || typeof url !== 'string') return '';
    
    // Url already using proxy
    if (url.includes('steemitimages.com')) {
      // Check if already has size parameter
      if (url.match(/steemitimages\.com\/\d+x\d+\//)) {
        // Extract the original URL part
        const matches = url.match(/steemitimages\.com\/\d+x\d+\/(.*)/i);
        if (matches && matches[1]) {
          // Only replace if a different size is requested
          if (!url.includes(`/${size}/`)) {
            return `https://steemitimages.com/${size}/${matches[1]}`;
          }
        }
        return url;
      }
      
      // Handle DQm URLs (IPFS) separately
      if (url.includes('/DQm')) {
        return url; // Don't modify IPFS URLs
      }
      
      return url;
    }
    
    // Clean the URL
    const sanitizedUrl = this.sanitizeUrl(url);
    
    // Return proxied URL
    return `https://steemitimages.com/${size}/${sanitizedUrl}`;
  }
  
  /**
   * Sanitize and normalize a URL
   * @param {string} url - URL to sanitize
   * @returns {string} - Cleaned URL
   */
  static sanitizeUrl(url) {
    if (!url) return url;
    
    try {
      url = String(url).trim();
      
      // Fix protocol
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.match(/^https?:\/\//)) {
        url = 'https://' + url;
      }
      
      // Fix double slashes (but keep protocol's //)
      url = url.replace(/(https?:\/\/)([^\/]+)\/+/g, '$1$2/');
      
      // Fix encoded entities
      url = url.replace(/&amp;/g, '&');
      
      // Decode URL encoded characters if necessary
      if (url.includes('%')) {
        try {
          if (/%[0-9A-F]{2}/.test(url)) {
            url = decodeURIComponent(url);
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
      
      return url;
    } catch (e) {
      console.warn('Error sanitizing URL:', e);
      return url;
    }
  }
  
  /**
   * Generate a placeholder for failed image loads
   * @param {string} text - Text to display in placeholder
   * @returns {string} - Data URL for placeholder image
   */
  static getDataUrlPlaceholder(text = 'No Image') {
    const safeText = String(text).replace(/[^\w\s-]/g, '');
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${safeText}</text></svg>`;
  }
  
  /**
   * Track failed image URLs to prevent retrying them
   * @param {string} url - URL to mark as failed
   */
  static markImageAsFailed(url) {
    if (!url || typeof url !== 'string') return;
    this.failedImageUrls.add(url);
  }
  
  /**
   * Check if an image URL has failed previously
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL has failed before
   */
  static hasImageFailed(url) {
    return this.failedImageUrls.has(url);
  }
  
  /**
   * Cache optimized URL for future use
   * @param {string} originalUrl - Original image URL
   * @param {string} optimizedUrl - Optimized version
   * @param {string} size - Size used for optimization
   */
  static cacheOptimizedUrl(originalUrl, optimizedUrl, size = '0x0') {
    if (!originalUrl || !optimizedUrl) return;
    const key = `${originalUrl}_${size}`;
    this.cachedUrlsMap.set(key, optimizedUrl);
  }
  
  /**
   * Get cached optimized URL if available
   * @param {string} originalUrl - Original image URL
   * @param {string} size - Size specification
   * @returns {string|null} - Cached URL or null
   */
  static getCachedUrl(originalUrl, size = '0x0') {
    if (!originalUrl) return null;
    const key = `${originalUrl}_${size}`;
    return this.cachedUrlsMap.get(key) || null;
  }
}

export default ImageCore;