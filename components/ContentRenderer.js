/**
 * Content Renderer component for displaying Steem posts and previews
 * Provides consistent rendering across post view and create post preview
 */
import PluginSystem from '../utils/markdown/PluginSystem.js';
import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';
import YouTubePlugin from '../utils/markdown/plugins/YouTubePlugin.js';
import { logRawData } from '../utils/logging/LoggingUtils.js';

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
   * Process content through the plugin system and markdown parser
   * @param {string} content - Raw markdown content
   * @returns {string} Processed HTML
   */
  processContent(content) {
    if (!content) return '';
    
    try {
      // Log raw content before processing
      logRawData('Raw Content Before Processing', content, this.options.enableLogging);
      
      // Verifica se il contenuto è già HTML completo
      const isCompleteHtml = content.trim().startsWith('<') && content.includes('<div') && content.includes('</div>');
      
      // Per l'HTML complesso, potremmo semplicemente restituire il contenuto come è
      if (isCompleteHtml && this.options.preserveComplexHtml) {
        logRawData('Preserving complex HTML', 'Content appears to be complex HTML. Preserving as-is.', this.options.enableLogging);
        return content;
      }
      
      // First pass: Pre-process with plugins to extract and create placeholders
      const preprocessed = this.pluginSystem.preProcess(content, this.options);
      // logRawData('Content after pre-processing', preprocessed, this.options.enableLogging);
      
      // Second pass: Convert markdown to HTML
      let html = this.parser.parse(preprocessed);
      // logRawData('Content after markdown parsing', html, this.options.enableLogging);
      
      // Third pass: Post-process with plugins to restore rich content
      const postprocessed = this.pluginSystem.postProcess(html, this.options);
      // logRawData('Content after post-processing', postprocessed, this.options.enableLogging);
      
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
    // logRawData('Raw Data for Rendering', data, this.options.enableLogging);
    
    // Merge options
    const renderOptions = { 
      ...this.options, 
      preserveComplexHtml: true, // Abilita la preservazione dell'HTML complesso per default
      ...options 
    };
    
    // Get data
    const { title, body } = data;
    if (!body) {
      const emptyContainer = document.createElement('div');
      emptyContainer.className = renderOptions.containerClass;
      emptyContainer.innerHTML = '<p class="empty-content">No content to display</p>';
      return { container: emptyContainer, contentElement: emptyContainer };
    }
    
    // Verifica la dimensione del contenuto
    // logRawData('Content Length', body.length, renderOptions.enableLogging);
    
    // Create main container
    const container = document.createElement('div');
    container.className = renderOptions.containerClass;
    
    // Process the content
    const processedContent = this.processContent(body);
    
    // Verifica la dimensione del contenuto processato
    // logRawData('Processed Content Length', processedContent.length, renderOptions.enableLogging);
    
    // Create content element with processed HTML
    const contentElement = document.createElement('div');
    contentElement.className = 'content-body';
    
    try {
      // Gestisci diversamente contenuti molto grandi per evitare problemi di performance
      if (processedContent.length > 100000) {
        logRawData('Large Content Warning', 'Content is very large, setting innerHTML in chunks', renderOptions.enableLogging);
        // Imposta il contenuto in blocchi per evitare blocchi del browser
        const chunkSize = 50000;
        for (let i = 0; i < processedContent.length; i += chunkSize) {
          const chunk = processedContent.substring(i, i + chunkSize);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = chunk;
          contentElement.appendChild(tempDiv);
        }
      } else {
        contentElement.innerHTML = processedContent;
      }
    } catch (error) {
      console.error('Error setting innerHTML:', error);
      contentElement.textContent = 'Error rendering content: ' + error.message;
    }
    
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