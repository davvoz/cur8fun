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
    
    // Use all YouTube patterns
    this.patterns = [
      REGEX_PATTERNS.YOUTUBE.MAIN,
      REGEX_PATTERNS.YOUTUBE.SHORT,
      REGEX_PATTERNS.YOUTUBE.SHORTS,
      REGEX_PATTERNS.YOUTUBE.EMBED
    ];
    
    // Universal pattern for fallback extraction
    this.extractIdPattern = REGEX_PATTERNS.YOUTUBE.EXTRACT_ID;
    
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
    
    // First try specific patterns
    this.patterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        // Extract video ID (always in capture group 1 in our patterns)
        const videoId = match[1];
        const originalUrl = match[0];
        
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          
          // Extract query parameters if present (for start time, etc.)
          const urlParams = this.extractUrlParams(originalUrl);
          
          videos.push({
            id: videoId,
            originalUrl: this.normalizeUrl(originalUrl),
            placeholder: `${this.placeholderPrefix}${videoId}${this.placeholderSuffix}`,
            params: urlParams  // Store URL parameters
          });
        }
      }
    });
    
    // As a fallback, try to find any remaining YouTube URLs with the universal pattern
    this.extractRemainingVideos(content, videos, seenIds);
    
    return videos;
  }
  
  extractRemainingVideos(content, videos, seenIds) {
    // Find all URLs that might be YouTube links
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    let match;
    
    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[0];
      
      // Skip if it's not YouTube related
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) continue;
      
      // Try universal extractor
      const idMatch = url.match(this.extractIdPattern);
      if (idMatch && idMatch[1] && !seenIds.has(idMatch[1])) {
        const videoId = idMatch[1];
        seenIds.add(videoId);
        
        videos.push({
          id: videoId,
          originalUrl: this.normalizeUrl(url),
          placeholder: `${this.placeholderPrefix}${videoId}${this.placeholderSuffix}`,
          params: this.extractUrlParams(url)
        });
      }
    }
  }
  
  extractUrlParams(url) {
    // Extract parameters like start time, playback speed, etc.
    if (!url.includes('?')) return '';
    
    try {
      const urlObj = new URL(url);
      return urlObj.search || '';
    } catch (e) {
      // If URL parsing fails, use regex
      const paramsMatch = url.match(/\?(.*)/);
      return paramsMatch ? `?${paramsMatch[1]}` : '';
    }
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
      const embedHtml = this.generateEmbed(video.id, dimensions, video.params);
      const placeholderRegex = new RegExp(this.escapeRegExp(video.placeholder), 'g');
      
      processedContent = processedContent.replace(placeholderRegex, embedHtml);
    });
    
    return processedContent;
  }
  
  /**
   * Generate YouTube embed HTML
   * @param {string} videoId - YouTube video ID
   * @param {Object} dimensions - Video dimensions
   * @param {string} params - URL parameters
   * @returns {string} HTML for embedding the video
   */
  generateEmbed(videoId, dimensions, params = '') {
    // Support URL parameters (especially start time)
    let embedUrl = `https://www.youtube.com/embed/${videoId}`;
    
    // Convert 't' parameter to 'start' parameter for embeds
    if (params) {
      const urlObj = new URL(`https://youtube.com/${params}`);
      const timeParam = urlObj.searchParams.get('t');
      
      if (timeParam) {
        // Add as start parameter
        embedUrl += `?start=${this.parseTimeParam(timeParam)}`;
      } else {
        // Add other parameters directly
        embedUrl += params;
      }
    }
    
    return `<div class="youtube-embed-container">
      <iframe 
        width="${dimensions.width}" 
        height="${dimensions.height}"
        src="${embedUrl}"
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
  
  /**
   * Parse time parameter to seconds
   * @param {string} timeParam - Time parameter
   * @returns {string} Time in seconds
   */
  parseTimeParam(timeParam) {
    // Convert time parameter (2m30s format or seconds) to seconds
    if (!timeParam) return 0;
    
    // If already in seconds
    if (/^\d+$/.test(timeParam)) return timeParam;
    
    // Parse format like 2m30s
    let seconds = 0;
    const hours = timeParam.match(/(\d+)h/);
    const minutes = timeParam.match(/(\d+)m/);
    const secs = timeParam.match(/(\d+)s/);
    
    if (hours) seconds += parseInt(hours[1]) * 3600;
    if (minutes) seconds += parseInt(minutes[1]) * 60;
    if (secs) seconds += parseInt(secs[1]);
    
    return seconds.toString();
  }
}