import BasePlugin from '../BasePlugin.js';
import { REGEX_PATTERNS } from '../regex-config.js';

/**
 * YouTube plugin for embedding videos in markdown content
 */
export default class YouTubePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'youtube';
    this.priority = 20; // Higher priority than most plugins
    
    // YouTube URL patterns
    this.patterns = [
      REGEX_PATTERNS.YOUTUBE.MAIN,
      REGEX_PATTERNS.YOUTUBE.EMBED
    ];
    
    this.placeholderPrefix = 'YOUTUBE_EMBED_';
    this.placeholderSuffix = '_YT_END';
  }
  
  /**
   * Extract YouTube videos from content
   * @param {string} content - Content to search for videos
   * @returns {Array<Object>} Extracted video information
   */
  extract(content) {
    if (!content) return [];
    
    const videos = [];
    const seenIds = new Set(); // Prevent duplicates
    
    this.patterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const videoId = match[1];
        const originalUrl = match[0];
        
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          
          // Extract query parameters if present
          const urlParams = originalUrl.includes('?') ? 
            originalUrl.substring(originalUrl.indexOf('?')) : '';
          
          videos.push({
            id: videoId,
            originalUrl: this.normalizeUrl(originalUrl),
            placeholder: `${this.placeholderPrefix}${videoId}${this.placeholderSuffix}`,
            params: urlParams  // Store URL parameters
          });
        }
      }
    });
    
    return videos;
  }
  
  /**
   * Replace YouTube URLs with placeholders
   * @param {string} content - Original content
   * @param {Array<Object>} videos - Extracted video information
   * @returns {string} Content with placeholders
   */
  createPlaceholders(content, videos) {
    if (!videos || videos.length === 0) return content;
    
    let processedContent = content;
    
    videos.forEach(video => {
      // Escape special characters for regex
      const escapedUrl = this.escapeRegExp(video.originalUrl);
      const urlRegex = new RegExp(escapedUrl, 'g');
      
      // Replace URL with placeholder
      processedContent = processedContent.replace(urlRegex, video.placeholder);
    });
    
    return processedContent;
  }
  
  /**
   * Restore YouTube placeholders with iframe embeds
   * @param {string} content - Content with placeholders
   * @param {Array<Object>} videos - Extracted video information
   * @param {Object} options - Rendering options
   * @returns {string} Content with YouTube embeds
   */
  restoreContent(content, videos, options = {}) {
    if (!videos || videos.length === 0) return content;
    
    const dimensions = options.videoDimensions || {
      width: '100%',
      height: '480px'
    };
    
    let processedContent = content;
    
    videos.forEach(video => {
      const embedHtml = this.generateEmbed(video.id, dimensions);
      const placeholderRegex = new RegExp(this.escapeRegExp(video.placeholder), 'g');
      
      processedContent = processedContent.replace(placeholderRegex, embedHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Generate YouTube embed HTML
   * @param {string} videoId - YouTube video ID
   * @param {Object} dimensions - Video dimensions
   * @returns {string} HTML for embedding the video
   */
  generateEmbed(videoId, dimensions) {
    return `<div class="youtube-embed-container">
      <iframe 
        width="${dimensions.width}" 
        height="${dimensions.height}"
        src="https://www.youtube.com/embed/${videoId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>`;
  }
  
  /**
   * Normalize YouTube URL to ensure it has proper protocol
   * @param {string} url - YouTube URL
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return url;
    
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    
    if (url.startsWith('youtube.com/') || url.startsWith('youtu.be/')) {
      return `https://${url}`;
    }
    
    if (!url.match(/^https?:\/\//)) {
      return `https://${url}`;
    }
    
    return url;
  }
  
  /**
   * Helper to escape special characters in regex patterns
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}