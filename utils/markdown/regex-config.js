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
  },
  
  // Table patterns
  TABLE: {
    MINIMAL: /\|\s*\|\s*\n\|\s*[-]+\s*\|/g,
    MINIMAL_MULTISPACE: /^\|\s{3,}\|$/,
    UNPROCESSED: /\|[^\n]*\|\s*\n\|[\s\-:]+\|.*\n?(\|.*\|.*\n?)*/g,
    EMPTY_CELL: /^[\s|\-:]+$/,
  },
  
  // Image patterns
  IMAGE_IN_TABLE: {
    MARKDOWN: /!\[(?:.*?)\]\(([^)]+)\)/gi,
    URL: /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/gi,
    DQM: /(https?:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/DQm[^\s<>"']+)/gi,
    PEAKD: /(https?:\/\/files\.peakd\.com\/file\/[^\s<>"']+)/gi
  },
  
  // HTML patterns
  HTML: {
    IMG_TAG: /<img\s+([^>]*?)src=(['"])(.*?)\2([^>]*?)>/gi,
    TABLE_CELL: /<td[^>]*>(.*?)<\/td>/gi
  },
  
  // URL and Media Patterns migrated from plugins
  URL: /(https?:\/\/[^\s]+)/g,
  IPFS: /^https?:\/\/[^/]+\/(ip[fn]s)\/([^/?#]+)/gim,
  
  // Post and Community Patterns
  POST: /^https?:\/\/(.*)\/(.*)\/(@[\w.\d-]+)\/(.*)/i,
  CCC: /^https?:\/\/(.*)\/ccc\/([\w.\d-]+)\/(.*)/i,
  MENTION: /^https?:\/\/(.*)\/(@[\w.\d-]+)$/i,
  TOPIC: /^https?:\/\/(.*)\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i,
  
  // Internal Patterns
  INTERNAL_MENTION: /^\/@[\w.\d-]+$/i,
  INTERNAL_TOPIC: /^\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i,
  INTERNAL_POST_TAG: /(.*)\/(@[\w.\d-]+)\/(.*)/i,
  INTERNAL_POST: /^\/(@[\w.\d-]+)\/(.*)$/i,
  
  // Additional Video Platform Patterns
  VIMEO: {
    MAIN: /(https?:\/\/)?(www\.)?(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i,
    EMBED: /https:\/\/player\.vimeo\.com\/video\/([0-9]+)/
  },
  
  BITCHUTE: /^(?:https?:\/\/)?(?:www\.)?bitchute.com\/(?:video|embed)\/([a-z0-9]+)/i,
  DTUBE: {
    MAIN: /(https?:\/\/d.tube.#!\/v\/)(\w+)\/(\w+)/g,
    SECONDARY: /(https?:\/\/d.tube\/v\/)(\w+)\/(\w+)/g,
    EMBED: /^https:\/\/emb.d.tube\/.*/i
  },
  
  // Streaming Platforms
  TWITCH: {
    MAIN: /https?:\/\/(?:www.)?twitch.tv\/(?:(videos)\/)?([a-zA-Z0-9][\w]{3,24})/i,
    EMBED: /^(https?:)?\/\/player.twitch.tv\/.*/i
  },
  
  // Music Platforms
  SPOTIFY: {
    MAIN: /^https:\/\/open\.spotify\.com\/playlist\/(.*)?$/gi,
    EMBED: /^https:\/\/open\.spotify\.com\/(embed|embed-podcast)\/(playlist|show|episode|track|album)\/(.*)/i
  },
  
  SOUNDCLOUD: /^https:\/\/w.soundcloud.com\/player\/.*/i,
  
  // Other Media Platforms
  DAPPLR: /^(https?:)?\/\/[a-z]*\.dapplr.in\/file\/dapplr-videos\/.*/i,
  TRUVVL: /^https?:\/\/embed.truvvl.com\/(@[\w.\d-]+)\/(.*)/i,
  LBRY: /^(https?:)?\/\/lbry.tv\/\$\/embed\/.*/i,
  ODYSEE: /^(https?:)?\/\/odysee.com\/\$\/embed\/.*/i,
  
  // Misc Patterns
  ENTITY: /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/ig,
  SECTION: /\B(\#[\da-zA-Z-_]+\b)(?!;)/i
};

// Large image specific patterns
export const LARGE_IMAGE_PATTERNS = [
  /https?:\/\/[^\s"'<>]*?\/[^\s"'<>]*?(?:(?:imgur\.com)|(?:steemitimages\.com)|(?:files\.peakd\.com))\/[^\s"'<>]+\.(jpe?g|png|gif)/gi,
  /https?:\/\/(?:i\.imgur\.com|imgur\.com)\/[a-zA-Z0-9]{5,8}\.(jpe?g|png|gif)/gi,
  /https?:\/\/steemitimages\.com\/[0-9]+x[0-9]+\/[^\s"'<>]*/gi,
  /https?:\/\/steemitimages\.com\/DQm[^\s"'<>]*\.(jpe?g|png|gif)/gi,
  /!\[.*?\]\(.*?\)/gi,
  /<img[^>]+>/gi,
  /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|gif|png|webp)(?:\?\S*)?)/gi
];