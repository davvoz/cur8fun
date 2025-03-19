/**
 * Content Renderer component for displaying Steem posts and previews
 * Provides consistent rendering across post view and create post preview
 */
import PluginSystem from '../utils/markdown/PluginSystem.js';
import ImagePlugin from '../utils/markdown/plugins/ImagePlugin.js';
import YouTubePlugin from '../utils/markdown/plugins/YouTubePlugin.js';
import imageService from '../services/ImageService.js';

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
      // Check if we need to remove the first heading
      let processedContent = content;
      
      if (!this.options.parseFirstHeadingAsTitle) {
        // Avoid treating first # heading as a title if option is disabled
        const firstHeadingMatch = processedContent.match(/^#\s+(.*?)(?:\n|$)/);
        if (firstHeadingMatch) {
          // Skip the first heading when parsing
          processedContent = processedContent.replace(/^#\s+(.*?)(?:\n|$)/, '');
        }
      }
      
      // First pass: Pre-process with plugins to extract and create placeholders
      const preprocessed = this.pluginSystem.preProcess(processedContent, this.options);
      
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
   * Get feature image from content if available
   * @param {string} content - Content to extract image from
   * @returns {Object|null} Image information or null
   */
  getFeatureImage(content) {
    if (!content || !this.options.extractImages) return null;
    
    try {
      // Use imageService to extract the best image
      const imageUrl = imageService.extractImageFromContent(content);
      if (!imageUrl) return null;
      
      return {
        url: imageUrl,
        optimized: this.options.optimizeUrls ? 
          imageService.optimizeImageUrl(imageUrl, { width: this.options.maxImageWidth }) : 
          imageUrl
      };
    } catch (error) {
      console.error('Error extracting feature image:', error);
      return null;
    }
  }
  
  /**
   * Create HTML element for a feature image
   * @param {Object} imageData - Image data
   * @returns {HTMLElement} Feature image element
   */
  createFeatureImageElement(imageData) {
    const container = document.createElement('div');
    container.className = 'feature-image-container';
    
    const img = document.createElement('img');
    img.className = this.options.imageClass || 'feature-image';
    img.src = imageData.optimized || imageData.url;
    img.alt = 'Featured image';
    img.loading = 'lazy';
    
    // Handle loading and errors
    img.onload = () => container.classList.add('loaded');
    img.onerror = () => {
      img.src = imageService.getDataUrlPlaceholder('Image not available');
      container.classList.add('error');
    };
    
    container.appendChild(img);
    return container;
  }
  
  /**
   * Main render method - processes content and returns rendered HTML elements
   * @param {Object} data - Content data to render
   * @param {string} data.title - Post title
   * @param {string} data.body - Post body content (markdown)
   * @param {Object} options - Override default options
   * @returns {Object} Rendered elements (container, title, content, images)
   */
  render(data, options = {}) {
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
    
    let featureImage = null;
    if (renderOptions.extractImages) {
      featureImage = this.getFeatureImage(body);
    }
    
    // Process the content through our plugin system
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
    
    // Add feature image if found and option is enabled
    let featureImageElement = null;
    if (featureImage && renderOptions.renderImages) {
      featureImageElement = this.createFeatureImageElement(featureImage);
      
      // Add feature image based on position preference
      if (renderOptions.imagePosition === 'top' && featureImageElement) {
        container.appendChild(featureImageElement);
      }
    }
    
    // Add title if available
    if (titleElement) {
      container.appendChild(titleElement);
    }
    
    // Add content
    container.appendChild(contentElement);
    
    // Add feature image at bottom if position is not top
    if (featureImage && renderOptions.renderImages && 
        renderOptions.imagePosition !== 'top' && featureImageElement) {
      container.appendChild(featureImageElement);
    }
    
    // Return the rendered elements
    return {
      container,
      titleElement,
      contentElement,
      featureImageElement
    };
  }
}

export default ContentRenderer;