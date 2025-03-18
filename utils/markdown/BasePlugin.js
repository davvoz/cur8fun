/**
 * Base class for all markdown content plugins
 */
export default class BasePlugin {
  constructor() {
    this.name = 'base';
    this.priority = 10;
    this.patterns = [];
  }
  
  /**
   * Check if this plugin can handle the given content
   * @param {string} content - Content to check
   * @returns {boolean} True if plugin can process this content
   */
  canProcess(content) {
    if (!content) return false;
    return this.patterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Extract content items that this plugin can handle
   * @param {string} content - Content to process
   * @returns {Array<Object>} Extracted items with metadata
   */
  extract(content) {
    return [];
  }
  
  /**
   * Replace original content with placeholders
   * @param {string} content - Original content
   * @param {Array<Object>} items - Extracted items
   * @returns {string} Content with placeholders
   */
  createPlaceholders(content, items) {
    return content;
  }
  
  /**
   * Restore placeholders with rich content
   * @param {string} content - Content with placeholders
   * @param {Array<Object>} items - Extracted items
   * @param {Object} options - Rendering options
   * @returns {string} Content with rich elements
   */
  restoreContent(content, items, options = {}) {
    return content;
  }
}