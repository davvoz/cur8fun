import ImageCore from '../core/ImageCore.js';

/**
 * Handles image optimization, caching, and special platform handling
 */
class ImageOptimizer {
  /**
   * Get optimized image URL specifically for Steem
   */
  static optimizeImageUrl(url, options = {}) {
    // Default to higher quality images
    const { width = 640, height = 0 } = options;

    if (!url) return ImageCore.getDataUrlPlaceholder();

    // Early return for placeholders and failed images
    if (url.startsWith('data:') ||
      url.includes('/placeholder.png') ||
      url.includes('/default-avatar') ||
      ImageCore.failedImageUrls.has(url)) {
      return ImageCore.getDataUrlPlaceholder();
    }

    try {
      // Check our URL cache first
      const cacheKey = `${url}_${width}x${height}`;
      if (ImageCore.cachedUrls.has(cacheKey)) {
        return ImageCore.cachedUrls.get(cacheKey);
      }

      // Clean the URL
      url = ImageCore.sanitizeUrl(url);
      
      // Special handling for specific domains
      if (this.isSpecialDomain(url)) {
        const specialUrl = this.handleSpecialDomain(url, width, height);
        ImageCore.cachedUrls.set(cacheKey, specialUrl);
        return specialUrl;
      }
      
      // For all other URLs, use Steem proxy
      const optimizedUrl = `https://steemitimages.com/${width}x${height}/${url}`;
      ImageCore.cachedUrls.set(cacheKey, optimizedUrl);
      return optimizedUrl;
    } catch (error) {
      console.error('Error optimizing URL:', url, error);
      return url;
    }
  }
  
  /**
   * Check if URL is from a domain that needs special handling
   */
  static isSpecialDomain(url) {
    return url.includes('files.peakd.com') || 
           url.includes('steemitimages.com/DQm') || 
           url.includes('cdn.steemitimages.com/DQm') ||
           url.includes('imgur.com');
  }
  
  /**
   * Apply special handling based on domain
   */
  static handleSpecialDomain(url, width, height) {
    // peakd.com URLs - return as is
    if (url.includes('files.peakd.com')) {
      return url;
    }
    
    // DQm format URLs - return as is
    if (url.includes('steemitimages.com/DQm') || url.includes('cdn.steemitimages.com/DQm')) {
      return url;
    }
    
    // Imgur URLs - use direct format
    if (url.includes('imgur.com')) {
      const imgurId = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
      if (imgurId && imgurId[1]) {
        // Use large size (l) for better quality
        return `https://i.imgur.com/${imgurId[1]}l.jpg`;
      }
    }
    
    // Default proxy
    return `https://steemitimages.com/${width}x${height}/${url}`;
  }
  
  /**
   * Apply responsive sizing to image based on viewport
   * @param {HTMLImageElement} imgElement - The image element to optimize
   */
  static applyResponsiveOptimization(imgElement) {
    if (!imgElement || !imgElement.src) return;
    
    // Use srcset for responsive images
    const src = imgElement.src;
    const baseUrl = src.includes('steemitimages.com') ? 
      src.replace(/\/\d+x\d+\//, '/') : 
      src;
    
    // Create responsive sizes
    imgElement.srcset = `
      ${ImageCore.proxyImageUrl(baseUrl, '400x0')} 400w,
      ${ImageCore.proxyImageUrl(baseUrl, '800x0')} 800w,
      ${ImageCore.proxyImageUrl(baseUrl, '1200x0')} 1200w
    `;
    
    imgElement.sizes = "(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px";
    
    // Add error handling
    imgElement.onerror = () => {
      ImageCore.markImageAsFailed(src);
      imgElement.src = ImageCore.getDataUrlPlaceholder();
      imgElement.srcset = '';
    };
  }
}

export default ImageOptimizer;