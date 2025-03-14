/**
 * Handles various media processing operations
 */
export class MediaHandlers {
  /**
   * Generate an appropriate HTML tag for media content
   * @param {string} url - The URL of the media
   * @param {string} alt - Optional alt text for images
   * @returns {string} HTML tag for the media
   */
  static generateMediaTag(url, alt = '') {
    // Check if URL is an image
    if (this.isImageUrl(url)) {
      return this.generateImageTag(url, alt);
    }
    
    // Check if URL is a video
    if (this.isVideoUrl(url)) {
      return this.generateVideoTag(url);
    }
    
    // Default to a link if media type is unknown
    return `<a href="${url}" target="_blank">${alt || url}</a>`;
  }
  
  /**
   * Determine if a URL is an image
   * @param {string} url - The URL to check
   * @returns {boolean} True if URL points to an image
   */
  static isImageUrl(url) {
    return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  }
  
  /**
   * Determine if a URL is a video
   * @param {string} url - The URL to check
   * @returns {boolean} True if URL points to a video
   */
  static isVideoUrl(url) {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  }
  
  /**
   * Generate an HTML image tag
   * @param {string} url - The image URL
   * @param {string} alt - Alt text for the image
   * @returns {string} HTML image tag
   */
  static generateImageTag(url, alt = '') {
    return `<img src="${url}" alt="${alt}" class="markdown-img-link medium-zoom-image">`;
  }
  
  /**
   * Generate an HTML video tag
   * @param {string} url - The video URL
   * @returns {string} HTML video tag
   */
  static generateVideoTag(url) {
    return `
      <video controls class="markdown-video">
        <source src="${url}" type="video/${this.getVideoType(url)}">
        Your browser does not support the video tag.
      </video>
    `;
  }
  
  /**
   * Get the video type from URL
   * @param {string} url - The video URL
   * @returns {string} Video type/format
   */
  static getVideoType(url) {
    const match = url.match(/\.([^.?]+)(\?.*)?$/);
    return match ? match[1] : 'mp4';
  }
}
