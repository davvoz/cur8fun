import { youtubePatterns, escapeRegExp } from '../RegexPatterns.js';

/**
 * Utility class for handling YouTube videos in content
 */
class YouTubeUtils {
  /**
   * Regular expressions for identifying YouTube links in various formats
   */
  static youtubeRegexes = Object.values(youtubePatterns);
  
  /**
   * Placeholder format used for YouTube video replacement
   * Must be unique enough not to occur naturally in content
   */
  static PLACEHOLDER_PREFIX = "YOUTUBE_VIDEO_";
  static PLACEHOLDER_SUFFIX = "";

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
      // Reset regex
      regex.lastIndex = 0;
      
      let match;
      while ((match = regex.exec(content)) !== null) {
        const videoId = match[1];
        const originalUrl = match[0];
        
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          
          // Create a unique placeholder for this video using our format
          const placeholder = `${this.PLACEHOLDER_PREFIX}${videoId}${this.PLACEHOLDER_SUFFIX}`;
          
          videos.push({
            id: videoId,
            originalUrl,
            placeholder
          });
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
        new RegExp(escapeRegExp(video.originalUrl), 'g'),
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
      const placeholderPattern = new RegExp(escapeRegExp(video.placeholder), 'g');
      
      // Log what we're replacing for debugging purposes
      console.log(`Replacing YouTube placeholder: ${video.placeholder} with embed for ID: ${video.id}`);
      
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
}

export default YouTubeUtils;