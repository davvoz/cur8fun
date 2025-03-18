/**
 * Centralized regex patterns for content processing
 * Used by all plugins in the markdown processing system
 */

// Cache for optimized URLs and failed images
export const SHARED_CACHE = {
  optimizedUrls: new Map(),
  failedImageUrls: new Set()
};

// Utility functions for regex operations
export const REGEX_UTILS = {
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
      // Remove quotes
      url = url.trim().replace(/^["']|["']$/g, '');
      
      // Fix double slashes (except after protocol)
      url = url.replace(/:\/\/+/g, '://').replace(/([^:])\/+/g, '$1/');
      
      // Fix missing protocol
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.match(/^https?:\/\//)) {
        // Only add protocol if this looks like a valid domain
        if (url.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}($|\/)/i)) {
          url = 'https://' + url;
        }
      }
      
      return url;
    } catch (e) {
      console.error('Error sanitizing URL:', e);
      return url;
    }
  }
};

// All regex patterns grouped by purpose
export const REGEX_PATTERNS = {
  IMAGE: {
    // Markdown image syntax: ![alt text](url)
    MARKDOWN_IMAGE: /!\[([^\]]*)\]\(([^)]+)\)(?!\()/g,
    
    // Clickable markdown images: [![alt text](image-url)](link-url)
    CLICKABLE_IMAGE: /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
    
    // HTML img tags with various quote styles
    HTML_IMG_DOUBLE_QUOTES: /<img[^>]*src="([^"]+)"[^>]*>/gi,
    HTML_IMG_SINGLE_QUOTES: /<img[^>]*src='([^']+)'[^>]*>/gi,
    HTML_IMG_NO_QUOTES: /<img[^>]*src=([^ >'"]+)[^>]*>/gi,
    
    // Raw image URLs directly in the content
    RAW_IMAGE_URL: /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/gi
  },
  
  YOUTUBE: {
    // Regular YouTube URLs
    MAIN: /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?/g,
    
    // YouTube short URLs
    SHORT: /https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?/g,
    
    // YouTube embed URLs
    EMBED: /https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?.*)?/g
  },
  
  TABLES: {
    // Detect markdown tables
    MARKDOWN_TABLE: /\|[^\n]*\|\s*\n\|[\s\-:]+\|.*\n?(\|.*\|.*\n?)*/g,
    
    // Detect problematic simple tables
    MINIMAL_TABLE: /\|\s*\|\s*\n\|\s*[-]+\s*\|/g
  },
  
  LINKS: {
    // Markdown links
    MARKDOWN_LINK: /\[([^\]]+)\]\(([^)]+)\)/g,
    
    // Raw URLs in text
    PLAIN_URL: /(https?:\/\/[^\s<>"']+)/gi
  }
};

// Large image specific patterns
export const LARGE_IMAGE_PATTERNS = [
  /https?:\/\/[^\s"'<>]*?\/[^\s"'<>]*?(?:(?:imgur\.com)|(?:steemitimages\.com)|(?:files\.peakd\.com))\/[^\s"'<>]+\.(jpe?g|png|gif)/gi,
  /https?:\/\/(?:i\.imgur\.com|imgur\.com)\/[a-zA-Z0-9]{5,8}\.(jpe?g|png|gif)/gi,
  /https?:\/\/steemitimages\.com\/[0-9]+x[0-9]+\/[^\s"'<>]*/gi,
  /https?:\/\/steemitimages\.com\/DQm[^\s"'<>]*\.(jpe?g|png|gif)/gi
];