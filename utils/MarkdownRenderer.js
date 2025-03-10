/**
 * Utility class for rendering Markdown content safely
 */
class MarkdownRenderer {
  constructor() {
    // Set marked.js options for better security and rendering
    if (window.marked) {
      marked.setOptions({
        breaks: true,          // Convert line breaks to <br>
        gfm: true,             // Enable GitHub Flavored Markdown
        headerIds: true,       // Create ids for headings
        mangle: false,         // Don't mangle header IDs
        smartLists: true,      // Use smarter list behavior
        smartypants: false,    // Don't use "smart" typographic punctuation
        xhtml: true            // Use XHTML style closing self-tags
      });
    }
  }

  /**
   * Safely render markdown content to HTML
   * @param {string} markdown - The markdown content to render
   * @returns {string} - Sanitized HTML string
   */
  render(markdown) {
    if (!markdown) return '';
    
    try {
      // Parse markdown to HTML
      const rawHtml = marked.parse(markdown);
      
      // Sanitize HTML to prevent XSS attacks
      if (window.DOMPurify) {
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
          ADD_TAGS: ['center', 'iframe'],
          ADD_ATTR: ['target', 'frameborder', 'allowfullscreen']
        });
        return cleanHtml;
      }
      
      // Fallback if DOMPurify is not available
      return rawHtml;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return `<p>Error rendering content: ${error.message}</p>`;
    }
  }

  /**
   * Safely set HTML content to an element
   * @param {HTMLElement} element - The element to update
   * @param {string} markdown - The markdown content
   */
  renderToElement(element, markdown) {
    if (!element) return;
    const html = this.render(markdown);
    element.innerHTML = html;
  }
}

// Export singleton instance
export default new MarkdownRenderer();
