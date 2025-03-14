import { REGEX_PATTERNS } from '../regex-config.js';

/**
 * Utility class for handling YouTube videos in content
 */
class YouTubeUtils {
  /**
   * Regular expressions for identifying YouTube links in various formats
   */
  static youtubeRegexes = [
    REGEX_PATTERNS.YOUTUBE.MAIN,
    REGEX_PATTERNS.YOUTUBE.EMBED
  ];
  
  /**
   * Placeholder format used for YouTube video replacement
   * Must be unique enough not to occur naturally in content
   */
  static PLACEHOLDER_PREFIX = "YOUTUBE_VIDEO_PLACEHOLDER_";
  static PLACEHOLDER_SUFFIX = "_ENDPLACEHOLDER";

  /**
   * Extracts all YouTube video IDs from content
   * 
   * @param {string} content - The content to search for YouTube links
   * @returns {Array} - Array of video data objects { id, originalUrl, placeholder }
   */
  static extractYouTubeVideos(content) {
    if (!content) return [];
    
    const videos = [];
    const seenIds = new Set(); // To prevent duplicates
    
    this.youtubeRegexes.forEach(regex => {
      // We need to clone the regex to reset lastIndex if it's a global regex
      const clonedRegex = new RegExp(regex.source, regex.flags);
      
      let match;
      while ((match = clonedRegex.exec(content)) !== null) {
        const videoId = match[1];
        const originalUrl = match[0];
        
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          
          // Create a unique placeholder for this video using our format
          const placeholder = `${this.PLACEHOLDER_PREFIX}${videoId}${this.PLACEHOLDER_SUFFIX}`;
          
          // Ensure original URL has https:// prefix
          const normalizedUrl = this.normalizeYouTubeUrl(originalUrl);
          
          videos.push({
            id: videoId,
            originalUrl: normalizedUrl, // Use normalized URL with https:// prefix
            placeholder
          });
          
          // If not using the 'g' flag, we need to break
          if (!regex.flags.includes('g')) break;
        }
      }
    });
    
    return videos;
  }

  /**
   * Replaces YouTube links in content with placeholders
   * 
   * @param {string} content - Content with YouTube links
   * @param {Array} videos - Array of video data objects from extractYouTubeVideos
   * @returns {string} - Content with YouTube links replaced by placeholders
   */
  static replaceYouTubeLinksWithPlaceholders(content, videos) {
    if (!content || !videos || videos.length === 0) return content;
    
    let updatedContent = content;
    
    videos.forEach(video => {
      // Replace the URL with its placeholder
      updatedContent = updatedContent.replace(
        new RegExp(this.escapeRegExp(video.originalUrl), 'g'),
        video.placeholder
      );
    });
    
    return updatedContent;
  }

  /**
   * Restores YouTube embeds from placeholders
   * 
   * @param {string} content - Content with YouTube placeholders
   * @param {Array} videos - Array of video data objects
   * @param {Object} dimensions - Video dimensions {width, height}
   * @returns {string} - Content with YouTube embeds
   */
  static restoreYouTubeEmbeds(content, videos, dimensions = { width: '100%', height: '480px' }) {
    if (!content || !videos || videos.length === 0) return content;
    
    let updatedContent = content;
    
    videos.forEach(video => {
      const embedHtml = this.generateYouTubeEmbed(video.id, dimensions);
      
      // Create a safe regex pattern for the placeholder
      const placeholderPattern = new RegExp(this.escapeRegExp(video.placeholder), 'g');
      
      updatedContent = updatedContent.replace(placeholderPattern, embedHtml);
    });
    
    return updatedContent;
  }

  /**
   * Generates YouTube embed HTML for a video ID
   * 
   * @param {string} videoId - YouTube video ID
   * @param {Object} dimensions - Video dimensions {width, height}
   * @returns {string} - HTML for embedding the YouTube video
   */
  static generateYouTubeEmbed(videoId, dimensions = { width: '100%', height: '480px' }) {
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
   * Creates a thumbnail URL for a YouTube video
   * 
   * @param {string} videoId - YouTube video ID
   * @param {string} quality - Thumbnail quality (default, mqdefault, hqdefault, sddefault, maxresdefault)
   * @returns {string} - YouTube thumbnail URL
   */
  static getYouTubeThumbnailUrl(videoId, quality = 'hqdefault') {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }

  /**
   * Helper method to escape special characters in regex
   * @param {string} string - String to escape
   * @returns {string} Escaped string for use in regex
   */
  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Ensures a YouTube URL has the proper https:// prefix
   * @param {string} url - YouTube URL that might be missing protocol
   * @returns {string} Normalized URL with https:// prefix
   */
  static normalizeYouTubeUrl(url) {
    if (!url) return url;
    
    // If URL starts with www., add https://
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    
    // If URL starts with youtube.com or youtu.be without protocol, add it
    if (url.startsWith('youtube.com/') || url.startsWith('youtu.be/')) {
      return `https://${url}`;
    }
    
    // If URL doesn't have a protocol at all, add https://
    if (!url.match(/^https?:\/\//)) {
      return `https://${url}`;
    }
    
    return url;
  }
}

export default YouTubeUtils;