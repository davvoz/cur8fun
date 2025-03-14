import { MediaHandlers } from '../media-handlers.js';

/**
 * Media processor that handles different types of media content
 */
export class MediaProcessor {
  constructor() {
    this.processedUrls = new Set();
  }
  
  /**
   * Process raw media URLs in text
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  processRawUrls(content) {
    // Skip if already contains processed media
    if (content.includes('<img src="https://media.discordapp.net') ||
        content.includes('<img src="https://cdn.steemitimages.com')) {
      return content;
    }
    
    let processed = content;
    
    // Process Discord media URLs
    processed = this.processUrlsWithPattern(
      processed,
      /(https?:\/\/media\.discordapp\.net\/attachments\/[^\s<>"']+)(?:\s|$)/gi
    );
    
    // Process Steemit CDN image URLs
    processed = this.processUrlsWithPattern(
      processed,
      /(https?:\/\/cdn\.steemitimages\.com\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp))(?:\s|$)/gi
    );
    
    // Process other common image hosts
    processed = this.processUrlsWithPattern(
      processed,
      /(https?:\/\/(?:[a-z0-9-]+\.)*(?:postimg\.cc|imgur\.com|ibb\.co)[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp))(?:\s|$)/gi
    );
    
    return processed;
  }
  
  /**
   * Process URLs matching a specific pattern
   * @param {string} content - Content to process
   * @param {RegExp} pattern - Regex pattern to match
   * @returns {string} Processed content
   */
  processUrlsWithPattern(content, pattern) {
    return content.replace(pattern, (match, url) => {
      if (this.processedUrls.has(url)) return match;
      this.processedUrls.add(url);
      return MediaHandlers.generateMediaTag(url);
    });
  }
  
  /**
   * Process markdown image syntax
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  processMarkdownImages(content) {
    // Process centered markdown images
    let processed = content.replace(
      /<center>!\[([^\]]*)\]\((https?:\/\/[^)]+)\)<\/center>/g,
      (match, alt, url) => {
        if (this.processedUrls.has(url)) return match;
        this.processedUrls.add(url);
        return `<center>${MediaHandlers.generateMediaTag(url, alt)}</center>`;
      }
    );
    
    // Process regular markdown images
    processed = processed.replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
      (match, alt, url) => {
        if (this.processedUrls.has(url)) return match;
        this.processedUrls.add(url);
        return MediaHandlers.generateMediaTag(url, alt);
      }
    );
    
    return processed;
  }
  
  /**
   * Process links that might contain media
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  processMediaLinks(content) {
    // Process links with media content inside
    let processed = content.replace(
      /<a[^>]*?href=["'](https?:\/\/(?:media\.discordapp\.net\/attachments|cdn\.steemitimages\.com)[^\s"']+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))["'][^>]*?>.*?<\/a>/gi,
      (match, url) => {
        if (this.processedUrls.has(url)) return match;
        this.processedUrls.add(url);
        return MediaHandlers.generateMediaTag(url);
      }
    );
    
    return processed;
  }
  
  /**
   * Get the set of processed URLs
   * @returns {Set} Set of processed URLs
   */
  getProcessedUrls() {
    return this.processedUrls;
  }
}
