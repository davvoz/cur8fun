import ImageCore from '../core/ImageCore.js';
import { imagePatterns, resetRegexLastIndex } from '../RegexPatterns.js';

/**
 * Utility class for extracting media from content
 */
class MediaExtractor {
  /**
   * Extract all image URLs from post content
   * @param {string} content - Post content to search
   * @returns {string[]} - Array of image URLs found
   */
  static extractAllImageUrls(content) {
    if (!content || typeof content !== 'string') return [];
    
    const foundUrls = new Set();
    
    // Reset all patterns before using them
    resetRegexLastIndex(imagePatterns);
    
    // Process each pattern type
    for (const [name, pattern] of Object.entries(imagePatterns)) {
      try {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          // Extract URL based on pattern type
          let url = this.extractUrlFromMatch(match, name);
          
          if (url && !foundUrls.has(url)) {
            url = ImageCore.sanitizeUrl(url);
            foundUrls.add(url);
          }
        }
      } catch (error) {
        console.warn(`Error processing pattern ${name}:`, error);
      }
    }
    
    return Array.from(foundUrls);
  }
  
  /**
   * Extract URL from a regex match based on pattern type
   * @private
   */
  static extractUrlFromMatch(match, patternName) {
    // Different patterns may have URLs in different capture groups
    switch (patternName) {
      case 'markdownImages':
        return match[2]; // URL is in second capture group for markdown images
        
      case 'htmlImages':
        return match[1]; // URL is in first capture group for HTML images
        
      case 'markdownReference':
        return null; // Need to look up the reference separately
        
      default:
        // For most patterns, the entire match is the URL
        return match[0];
    }
  }
  
  /**
   * Extract the first image URL from a post
   * @param {Object} post - Post object
   * @returns {string|null} - First image URL or null
   */
  static extractImageFromContent(post) {
    if (!post || !post.body) return null;

    try {
      // Try to find Markdown image
      const markdownMatch = post.body.match(/!\[.*?\]\((.*?)\)/);
      if (markdownMatch) return markdownMatch[1];

      // Try to find HTML image
      const htmlMatch = post.body.match(/<img[^>]+src="([^">]+)"/);
      if (htmlMatch) return htmlMatch[1];

      // Try to find href with image link
      const htmlMatch2 = post.body.match(/href="([^"]+\.(?:jpg|png|jpeg|gif|webp)[^"]*)"[^>]*>/i);
      if (htmlMatch2) return htmlMatch2[1];
      
      // Try to find raw URL
      const urlMatch = post.body.match(/(https?:\/\/[^\s<>"']*\.(?:jpg|png|jpeg|gif|webp)(\?[^\s<>"']*)?)/i);
      if (urlMatch) return urlMatch[1];

      // If no images found, try metadata
      if (post.json_metadata) {
        try {
          const metadata = typeof post.json_metadata === 'string' ? 
            JSON.parse(post.json_metadata) : post.json_metadata;
            
          if (metadata.image && metadata.image.length > 0) {
            return metadata.image[0];
          }
        } catch (e) {
          console.warn('Error parsing post metadata:', e);
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract image from content:', error);
      return null;
    }
  }
  
  /**
   * Get the best image URL for a post (for cards, previews, etc.)
   * @param {Object} post - Post object
   * @returns {string|null} - Best image URL or null
   */
  static getBestPostImage(post) {
    if (!post) return null;
    
    try {
      // Check if we have metadata with images
      let metadata = {};
      
      if (post.json_metadata) {
        try {
          metadata = typeof post.json_metadata === 'string' ? 
            JSON.parse(post.json_metadata) : post.json_metadata;
        } catch (e) {
          console.warn('Error parsing post metadata:', e);
        }
      }
      
      // Try to get image from metadata first (highest priority)
      if (metadata.image && metadata.image.length > 0) {
        return ImageCore.proxyImageUrl(metadata.image[0], '640x0');
      }
      
      // Then try extracting from content
      const contentImage = this.extractImageFromContent(post);
      if (contentImage) {
        return ImageCore.proxyImageUrl(contentImage, '640x0');
      }
      
      // Fallback to placeholder
      return ImageCore.getDataUrlPlaceholder('No Image');
    } catch (error) {
      console.error('Error getting best post image:', error);
      return ImageCore.getDataUrlPlaceholder('Error');
    }
  }
}

export default MediaExtractor;