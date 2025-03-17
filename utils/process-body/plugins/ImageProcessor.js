import ImageCore from '../core/ImageCore.js';
import { imagePatterns, resetRegexLastIndex } from '../RegexPatterns.js';

/**
 * Processes markdown image syntax into HTML
 * Focused specifically on the transformation process
 */
class ImageProcessor {
  /**
   * Process markdown image syntax and convert to proper HTML
   * @param {string} content - Content with markdown image syntax
   * @returns {string} - Content with processed images
   */
  static processMarkdownImages(content) {
    if (!content) return content;
    
    let processedContent = content;
    
    // Reset regex patterns before use
    resetRegexLastIndex(imagePatterns);
    
    // Process direct image URLs
    processedContent = processedContent.replace(
      imagePatterns.generalImages,
      (match, url) => {
        if (this.shouldSkipImageProcessing(match)) return match;
        return `<img src="${ImageCore.proxyImageUrl(match)}" class="markdown-img-link medium-zoom-image">\n`;
      }
    );

    // Process centered markdown images
    processedContent = processedContent.replace(
      /<center>\s*!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*<\/center>/g,
      (match, alt, url) => {
        return `<center><img src="${ImageCore.proxyImageUrl(url)}" alt="${alt}" class="markdown-img-link medium-zoom-image"></center>`;
      }
    );

    // Process markdown images
    processedContent = processedContent.replace(
      imagePatterns.markdownImages,
      (match, alt, url) => {
        return `<img src="${ImageCore.proxyImageUrl(url)}" alt="${alt}" class="markdown-img-link medium-zoom-image">`;
      }
    );

    // Process markdown images with links
    processedContent = processedContent.replace(
      /\[\!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/g,
      (match, alt, imgUrl, linkUrl) => {
        return `<a href="${linkUrl}" class="markdown-external-link" target="_blank" rel="noopener"><img src="${ImageCore.proxyImageUrl(imgUrl)}" alt="${alt}"></a>`;
      }
    );
    
    return processedContent;
  }
  
  /**
   * Check if we should skip processing this image
   * @private
   */
  static shouldSkipImageProcessing(url) {
    return url.includes('data:image') || // Skip data URLs
           url.includes('<img') || // Skip already processed images
           url.includes('</a>'); // Skip images in links
  }
  
  /**
   * Pre-process image tags for better display
   * @param {string} html - HTML content to process
   * @returns {string} - Processed HTML
   */
  static enhanceImageTags(html) {
    if (!html) return html;
    
    // Add lightbox/zoom capabilities to images
    return html.replace(
      /<img([^>]*)src="([^"]+)"([^>]*)>/gi,
      (match, beforeSrc, src, afterSrc) => {
        // Skip already enhanced images
        if (match.includes('data-zoomable') || match.includes('medium-zoom-image')) {
          return match;
        }
        
        // Check if image is eligible for enhancement
        if (src.startsWith('data:') || src.includes('avatar') || src.includes('icon')) {
          return match; // Skip enhancement for avatars and icons
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
  }
  
  /**
   * Generate optimized responsive image tag
   * @param {string} url - Image URL
   * @param {Object} options - Options for the image
   * @returns {string} - HTML for responsive image
   */
  static generateResponsiveImageTag(url, options = {}) {
    const {
      alt = '',
      className = 'responsive-img medium-zoom-image',
      lazyLoad = true,
      sizes = '(max-width: 768px) 100vw, 768px'
    } = options;
    
    // Use cached URL if available
    let proxiedUrl = ImageCore.getCachedUrl(url, '0x0') || ImageCore.proxyImageUrl(url);
    
    // Create srcset for responsive images
    const srcset = [
      `${ImageCore.proxyImageUrl(url, '400x0')} 400w`,
      `${ImageCore.proxyImageUrl(url, '800x0')} 800w`,
      `${ImageCore.proxyImageUrl(url, '1200x0')} 1200w`
    ].join(', ');
    
    // Apply lazy loading for performance
    const lazyLoadAttr = lazyLoad ? 'loading="lazy"' : '';
    
    // Create the responsive image tag
    return `<img src="${proxiedUrl}" alt="${alt}" class="${className}" srcset="${srcset}" sizes="${sizes}" ${lazyLoadAttr}>`;
  }
}

export default ImageProcessor;