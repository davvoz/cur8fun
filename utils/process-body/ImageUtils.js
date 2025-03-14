/**
 * Comprehensive utility class for image handling in Steem ecosystem
 */
class ImageUtils {
  // Static cache to prevent re-requesting failed images
  static failedImageUrls = new Set();
  static cachedUrls = new Map();

  /**
   * Expanded dictionary of regex patterns for all possible image formats
   */
  static regexPatterns = {
    // HTML patterns - handles variations of img tags
    htmlImgDoubleQuotes: /<img\s+[^>]*?src="([^"]+)"[^>]*?>/gi,
    htmlImgSingleQuotes: /<img\s+[^>]*?src='([^']+)'[^>]*?>/gi,
    htmlImgNoQuotes: /<img\s+[^>]*?src=([^\s>"']+)[^>]*?>/gi,

    // HTML5 picture/source elements
    htmlSourceSrcset: /<source\s+[^>]*?srcset=["']([^"']+)["'][^>]*?>/gi,

    // Markdown image patterns - handles various markdown formats
    markdownStandard: /!\[(?:.*?)\]\(([^)\s]+)(?:\s+["'].*?["'])?\)/gi,
    markdownReference: /!\[.*?\]\[(.+?)\](?:\s+["'].*?["'])?\)/gi,
    markdownDefinition: /\[(.+?)\]:\s*(https?:\/\/\S+(?:jpe?g|png|gif|webp|svg))/gi,

    // BBCode patterns for forums
    bbCodeImg: /\[img\](.*?)\[\/img\]/gi,
    bbCodeImgWithParams: /\[img=[^\]]*\](.*?)\[\/img\]/gi,

    // Raw image URLs with common extensions
    rawImageJpg: /(https?:\/\/\S+\.jpe?g)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,
    rawImagePng: /(https?:\/\/\S+\.png)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,
    rawImageGif: /(https?:\/\/\S+\.gif)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,
    rawImageWebp: /(https?:\/\/\S+\.webp)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,
    rawImageBmp: /(https?:\/\/\S+\.bmp)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,
    rawImageSvg: /(https?:\/\/\S+\.svg)(?:\?\S*)?(?=\s|$|"|'|<|\))/gi,

    // Steemit specific patterns
    steemitCdnDirect: /(https?:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/[^"'\s<>)]+)/gi,
    steemitProxyPattern: /(https?:\/\/steemitimages\.com\/[0-9]+x[0-9]+\/)(https?:\/\/[^"'\s<>)]+)/gi,
    steemitCdnP: /(https?:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/p\/[^"'\s<>)]+)/gi,
    steemitCdnDQm: /(https?:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/DQm[^"'\s<>)]+)/gi,

    // Common image hosting services
    imgurPattern: /(https?:\/\/(?:i\.)?imgur\.com\/[a-zA-Z0-9]+(?:\.[a-z]+)?)/gi,
    imgbbPattern: /(https?:\/\/(?:i\.)?ibb\.co\/[a-zA-Z0-9]+(?:\.[a-z]+)?)/gi,

    // Proxy patterns - detect proxied images through steemitimages
    proxiedUrl: /https?:\/\/(?:steemitimages\.com)\/(?:0x0|[0-9]+x[0-9]+)\/(https?:\/\/.*?)(?=\s|$|"|'|<|\))/gi,

    // IPFS patterns
    ipfsUrl: /(https?:\/\/(?:\w+\.)?ipfs\.[^"'\s<>)]+\/ipfs\/\w+)/gi,

    // Special case: URLs in HTML attributes other than src
    htmlTagWithUrlAttr: /(?:<\w+\s+[^>]*(?:data-url|data-src|data-original)=["'])(https?:\/\/[^"']+)(?:["'])/gi,
  };

  /**
   * Enhanced extraction of all image URLs from content
   * @param {string} content - Post content to search
   * @returns {string[]} - Array of unique image URLs found
   */
  static extractAllImageUrls(content) {
    if (!content || typeof content !== 'string') return [];

    const foundUrls = new Set();
    let matches;

    // Process each regex pattern to find all possible image URLs
    for (const [patternName, pattern] of Object.entries(this.regexPatterns)) {
      // Reset the regex state
      pattern.lastIndex = 0;

      while ((matches = pattern.exec(content)) !== null) {
        let url = null;

        // Handle special cases based on the pattern type
        if (patternName === 'steemitProxyPattern') {
          // For steemit proxy pattern, we need to extract the actual URL
          url = matches[2]; // The actual URL being proxied
        }
        else if (patternName === 'markdownReference') {
          // For markdown references, we need to look up the definition
          const reference = matches[1];
          const defPattern = new RegExp(`\\[${reference}\\]:\\s*(https?://\\S+)`, 'i');
          const defMatch = content.match(defPattern);
          if (defMatch) url = defMatch[1];
        }
        else {
          // For most patterns, the URL is the first capture group
          url = matches[1];
        }

        // Add the URL if it's valid and not already found
        if (url && this.isValidImageUrl(url) && !foundUrls.has(url)) {
          // Sanitize URL before adding
          url = this.sanitizeUrl(url);
          foundUrls.add(url);
        }
      }
    }

    return Array.from(foundUrls);
  }

  /**
   * Gets the best image URL for a post
   * @param {string} content - Post content
   * @param {object} metadata - Post metadata
   * @returns {string|null} - Best image URL or null
   */
  static getBestImageUrl(content, metadata) {
    // Create an array to store all potential image URLs with their priority
    const candidates = [];

    // 1. Check metadata first (highest priority)
    if (metadata) {
      // Standard image field
      if (metadata.image && metadata.image.length > 0) {
        candidates.push({ url: metadata.image[0], priority: 10 });
      }

      // Thumbnail field  
      if (metadata.thumbnail) {
        candidates.push({ url: metadata.thumbnail, priority: 9 });
      }

      // Steemit/Condenser app format in json_metadata
      if (metadata.links && Array.isArray(metadata.links)) {
        metadata.links.forEach(link => {
          if (this.isValidImageUrl(link)) {
            candidates.push({ url: link, priority: 8 });
          }
        });
      }
    }

    // 2. Extract image URLs from content
    const contentImages = this.extractAllImageUrls(content);

    // Add extracted images to candidates with lower priority than metadata
    contentImages.forEach((url, index) => {
      // First image gets higher priority
      const priority = 7 - Math.min(index, 6);
      candidates.push({ url, priority });
    });

    // Sort candidates by priority (highest first)
    candidates.sort((a, b) => b.priority - a.priority);

    // Return the highest priority URL or null if none found
    return candidates.length > 0 ? candidates[0].url : null;
  }

  /**
   * More comprehensive validation for image URLs
   */
  static isValidImageUrl(url) {
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

      // Check for steemit CDN image URLs (DQm... format)
      const isSteemitCDN = /steemitimages\.com\/.*(?:0x0|[0-9]+x[0-9]+)\/.*/.test(url) ||
        /steemitimages\.com\/DQm.*/.test(url);

      // Check for direct IPFS content identifiers
      const isIPFS = /ipfs\.[^\/]+\/ipfs\/\w+/.test(url);

      return hasImageExtension || isImageHost || isSteemitCDN || isIPFS;
    } catch (e) {
      console.error('Error validating image URL:', e);
      return false;
    }
  }

  /**
   * Get optimized image URL specifically for Steem
   */
  static optimizeImageUrl(url, options = {}) {
    // Default to higher quality images (640px width instead of 400px)
    const { width = 640, height = 0, useSteem = true } = options;

    if (!url) return this.getDataUrlPlaceholder();

    // Early return for placeholders and failed images
    if (url.startsWith('data:') ||
      url.includes('/placeholder.png') ||
      url.includes('/default-avatar') ||
      this.failedImageUrls.has(url)) {
      return this.getDataUrlPlaceholder();
    }

    try {
      // Check our URL cache first
      const cacheKey = `${url}_${width}x${height}`;
      if (this.cachedUrls.has(cacheKey)) {
        return this.cachedUrls.get(cacheKey);
      }

      // Step 1: Clean the URL
      url = this.sanitizeUrl(url);
      
      // Special handling for peakd.com URLs - return as is, they don't need proxy
      if (url.includes('files.peakd.com')) {
        this.cachedUrls.set(cacheKey, url);
        return url;
      }
      
      // Special handling for DQm format URLs from steemitimages.com - return as is
      if (url.includes('steemitimages.com/DQm') || url.includes('cdn.steemitimages.com/DQm')) {
        this.cachedUrls.set(cacheKey, url);
        return url;
      }

      // Step 2: Process steemitimages URLs
      if (url.includes('steemitimages.com') || url.includes('cdn.steemitimages.com')) {
        let result = null;

        // Handle already proxied URLs
        if (url.match(/steemitimages\.com\/\d+x\d+\//)) {
          // Extract the original URL part
          const matches = url.match(/steemitimages\.com\/\d+x\d+\/(.*)/i);
          if (matches && matches[1]) {
            // Use higher quality resizing for better image clarity
            result = `https://steemitimages.com/${width}x${height}/${matches[1]}`;
          }
        }
        // Handle direct steemitimages URLs
        else {
          // Extract path part
          const matches = url.match(/https?:\/\/[^\/]+(\/.*)/i);
          if (matches && matches[1]) {
            result = `https://steemitimages.com/${width}x${height}${matches[1]}`;
          } else {
            result = `https://steemitimages.com/${width}x${height}/${url}`;
          }
        }

        // Save in cache and return
        if (result) {
          this.cachedUrls.set(cacheKey, result);
          return result;
        }
      }

      // Step 3: For imgur URLs, use direct format with better quality
      if (url.includes('imgur.com')) {
        const imgurId = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
        if (imgurId && imgurId[1]) {
          // Use large size (l) instead of medium (m) for better quality
          const imgurUrl = `https://i.imgur.com/${imgurId[1]}l.jpg`;
          this.cachedUrls.set(cacheKey, imgurUrl);
          return imgurUrl;
        }
      }

      // Step 4: For all other URLs, use Steem proxy
      const optimizedUrl = `https://steemitimages.com/${width}x${height}/${url}`;
      this.cachedUrls.set(cacheKey, optimizedUrl);
      return optimizedUrl;

    } catch (error) {
      console.error('Error optimizing URL:', url, error);
      return url;
    }
  }

  /**
   * Better URL sanitizer
   */
  static sanitizeUrl(url) {
    if (!url) return url;

    try {
      // Make sure it's a string
      url = String(url).trim();

      // Fix protocol issues
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.startsWith('http')) {
        // If no protocol, assume https
        url = 'https://' + url;
      }

      // Fix double slashes after domain (but preserve protocol's //)
      url = url.replace(/(https?:\/\/)([^\/]+)\/+/g, '$1$2/');

      // Remove additional slashes in the rest of the URL
      const urlParts = url.split('://');
      if (urlParts.length > 1) {
        const protocol = urlParts[0];
        let path = urlParts[1];
        path = path.replace(/([^:])\/+/g, '$1/');
        url = protocol + '://' + path;
      }

      // Fix common HTML entity encodings
      url = url.replace(/&amp;/g, '&');

      // Handle URL encoded characters
      if (url.includes('%')) {
        // Don't double-decode
        if (/%[0-9A-F]{2}/.test(url)) {
          try {
            url = decodeURIComponent(url);
          } catch (e) {
            // Ignore decode errors
          }
        }
      }

      return url;
    } catch (e) {
      console.warn('Error sanitizing URL:', e);
      return url;
    }
  }

  /**
   * Method to track failed image URLs to prevent retrying them
   */
  static markImageAsFailed(url) {
    if (url && typeof url === 'string') {
      this.failedImageUrls.add(url);
    }
  }

  /**
   * Simple data URL placeholder
   */
  static getDataUrlPlaceholder(text = 'No Image') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${text}</text></svg>`;
  }


  static extractImageFromContent(post) {
    if (!post || !post.body) return null;

    try {
      // Try to find Markdown image
      const markdownMatch = post.body.match(/!\[.*?\]\((.*?)\)/);
      if (markdownMatch) return markdownMatch[1];

      // Try to find HTML image
      const htmlMatch = post.body.match(/<img[^>]+src="([^">]+)"/);
      if (htmlMatch) return htmlMatch[1];

      // Try to find href with image link ,but without <a>
      const htmlMatch2 = post.body.match(/href="([^"]+\.(?:jpg|png|jpeg|gif|webp)[^"]*)"[^>]*>/i);
      if (htmlMatch2) return htmlMatch2[1];
      // Try to find raw URL or URLs with different patterns or query parameters
      const urlMatch = post.body.match(/(https?:\/\/[^\s<>"']*\.(?:jpg|png|jpeg|gif|webp)(\?[^\s<>"']*)?)/i);
      if (urlMatch) return urlMatch[1];

      return null;
    } catch (error) {
      console.warn('Failed to extract image from content:', error);
      return null;
    }
  }
}
export default ImageUtils;
