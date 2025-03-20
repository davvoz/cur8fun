/**
 * Content Renderer component for displaying Steem posts and previews
 * Provides consistent rendering across post view and create post preview
 */
import PluginSystem from '../utils/markdown/PluginSystem.js';
import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';
import YouTubePlugin from '../utils/markdown/plugins/YouTubePlugin.js';

class ContentRenderer {
  constructor(options = {}) {
    this.options = {
      extractImages: true,
      renderImages: true,
      imageClass: 'content-image',
      containerClass: 'markdown-content',
      useProcessBody: false,
      maxImageWidth: 800,
      enableYouTube: true,
      videoDimensions: { width: '100%', height: '480px' },
      useSteemContentRenderer: true,
      renderTitle: true, // Add this option
      parseFirstHeadingAsTitle: false, // Add this option
      enableLogging: true, // Add logging option
      ...options
    };
    
    // Initialize the plugin system
    this.initializePlugins();
    
    // Initialize markdown parser
    this.initializeMarkdownParser();
  }
  
  /**
   * Initialize the plugin system and register plugins
   */
  initializePlugins() {
    this.pluginSystem = new PluginSystem();
    
    // Register image plugin
    this.imagePlugin = new ImagePlugin();
    this.pluginSystem.registerPlugin(this.imagePlugin);
    
    // Register YouTube plugin if enabled
    if (this.options.enableYouTube) {
      this.youtubePlugin = new YouTubePlugin();
      this.pluginSystem.registerPlugin(this.youtubePlugin);
    }
    
    // Can register more plugins here as needed
  }
  
  /**
   * Initialize markdown parser for converting markdown to HTML
   */
  initializeMarkdownParser() {
    // Simple markdown parser implementation
    // In a production app, you'd use a library like marked or showdown
    this.parser = {
      parse: (markdown) => {
        if (!markdown) return '';
        
        // Convert markdown to HTML (simplified version)
        let html = markdown
          // Headers
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          // Bold
          .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
          // Italic
          .replace(/\*(.*)\*/gm, '<em>$1</em>')
          // Links that aren't already processed
          .replace(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/gm, '<a href="$2" target="_blank">$1</a>')
          // Lists
          .replace(/^\s*\*\s(.*$)/gm, '<li>$1</li>')
          // Code blocks
          .replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
          // Inline code
          .replace(/`([^`]+)`/gm, '<code>$1</code>')
          // Line breaks
          .replace(/\n/gm, '<br>');
          
        return html;
      }
    };
  }
  
  /**
   * Log raw data in a copy-friendly format
   * @param {string} label - Label for the log
   * @param {any} data - Data to log
   */
  logRawData(label, data) {
    if (!this.options.enableLogging) return;
    
    console.group(`📋 ${label} - Click to expand/collapse`);
    console.log('%c Copy the data below:', 'font-weight: bold; color: #3498db;');
    console.log('%c -----------------------------------------------', 'color: #7f8c8d');
    
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    
    console.log('%c -----------------------------------------------', 'color: #7f8c8d');
    console.log('%c Right-click and "Copy object" or select text and copy', 'font-style: italic; color: #7f8c8d');
    console.groupEnd();
  }
  
  /**
   * Process content through the plugin system and markdown parser
   * @param {string} content - Raw markdown content
   * @returns {string} Processed HTML
   */
  processContent(content) {
    if (!content) return '';
    
    try {
      // Log raw content before processing
      this.logRawData('Raw Content Before Processing', content);
      
      // First pass: Pre-process with plugins to extract and create placeholders
      const preprocessed = this.pluginSystem.preProcess(content, this.options);
      
      // Second pass: Convert markdown to HTML
      let html = this.parser.parse(preprocessed);
      
      // Third pass: Post-process with plugins to restore rich content
      const postprocessed = this.pluginSystem.postProcess(html, this.options);
      
      return postprocessed;
    } catch (error) {
      console.error('Error processing content:', error);
      return `<div class="error">Error rendering content: ${error.message}</div>`;
    }
  }
  
  /**
   * Main render method - processes content and returns rendered HTML elements
   * @param {Object} data - Content data to render
   * @param {string} data.title - Post title
   * @param {string} data.body - Post body content (markdown)
   * @param {Object} options - Override default options
   * @returns {Object} Rendered elements (container, title, content)
   */
  render(data, options = {}) {
    // Log raw render data
    this.logRawData('Raw Data for Rendering', data);
    
    // Merge options
    const renderOptions = { ...this.options, ...options };
    
    // Get data
    const { title, body } = data;
    if (!body) {
      const emptyContainer = document.createElement('div');
      emptyContainer.className = renderOptions.containerClass;
      emptyContainer.innerHTML = '<p class="empty-content">No content to display</p>';
      return { container: emptyContainer, contentElement: emptyContainer };
    }
    
    // Create main container
    const container = document.createElement('div');
    container.className = renderOptions.containerClass;
    
    // Process the content
    const processedContent = this.processContent(body);
    
    // Create content element with processed HTML
    const contentElement = document.createElement('div');
    contentElement.className = 'content-body';
    contentElement.innerHTML = processedContent;
    
    // Create title element if provided
    let titleElement = null;
    if (title) {
      titleElement = document.createElement('h1');
      titleElement.className = 'content-title';
      titleElement.textContent = title;
    }
    
    // Add title if available
    if (titleElement) {
      container.appendChild(titleElement);
    }
    
    // Add content
    container.appendChild(contentElement);
    
    // Return the rendered elements
    return {
      container,
      titleElement,
      contentElement
    };
  }
}

export default ContentRenderer;