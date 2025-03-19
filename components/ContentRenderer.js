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
      // Estrai immagine usando ImagePlugin direttamente per accedere ai dettagli completi
      const images = this.imagePlugin.extract(content);
      
      if (!images || images.length === 0) return null;
      
      // Prendi la prima immagine
      const firstImage = images[0];
      
      // Salva originalMarkdown per poterlo rimuovere più tardi
      return {
        url: firstImage.url,
        originalMarkdown: firstImage.originalText,
        optimized: this.options.optimizeUrls ? 
          imageService.optimizeImageUrl(firstImage.url, { width: this.options.maxImageWidth }) : 
          firstImage.url,
        linkUrl: firstImage.linkUrl, // Salva anche l'URL del link se è un'immagine cliccabile
        isInHtmlTag: firstImage.isInHtmlTag, // Mantieni l'informazione se è in un tag HTML
        htmlTag: firstImage.htmlTag // Salva il tipo di tag HTML
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
    
    // Se l'immagine era originariamente in un tag HTML come <center>
    // Mantenere quel tag intorno all'immagine
    const isInHtmlTag = imageData.originalMarkdown && (
      imageData.originalMarkdown.includes('<center>') ||
      imageData.originalMarkdown.includes('<div')
    );
    
    // Creare l'elemento img
    const img = document.createElement('img');
    img.className = this.options.imageClass || 'feature-image';
    img.classList.add('markdown-img'); // Aggiungi la classe markdown-img per avere stili coerenti
    img.src = imageData.optimized || imageData.url;
    img.alt = 'Featured image';
    img.loading = 'lazy';
    
    // Aggiungi attributi per responsive
    img.style.maxWidth = '100%';
    img.setAttribute('width', '100%');
    
    // Se è un'immagine cliccabile, renderla un link
    if (imageData.linkUrl) {
      const linkElement = document.createElement('a');
      linkElement.href = imageData.linkUrl;
      linkElement.target = '_blank';
      linkElement.rel = 'noopener noreferrer';
      linkElement.className = 'img-link-container';
      
      linkElement.appendChild(img);
      
      // Aggiungi indicatore di link
      const indicator = document.createElement('div');
      indicator.className = 'img-link-indicator';
      indicator.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      
      linkElement.appendChild(indicator);
      
      container.appendChild(linkElement);
    } else {
      container.appendChild(img);
    }
    
    // Se era in un tag center, mantienilo
    if (isInHtmlTag && imageData.originalMarkdown.includes('<center>')) {
      const wrapperDiv = document.createElement('div');
      wrapperDiv.style.textAlign = 'center';
      wrapperDiv.appendChild(container);
      return wrapperDiv;
    }
    
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
    
    let featureImage = null;
    let originalImageMarkdown = null;
    let modifiedBody = body; // Crea una copia modificabile del body
    
    if (renderOptions.extractImages) {
      // Estrai la feature image prima dell'elaborazione del contenuto
      featureImage = this.getFeatureImage(body);
      
      // Se abbiamo trovato un'immagine in evidenza, rimuovila dal contenuto
      if (featureImage && featureImage.originalMarkdown) {
        // Rimuovi la prima occorrenza dell'immagine dal body
        modifiedBody = body.replace(featureImage.originalMarkdown, '');
      }
    }
    
    // Process the modified content (senza l'immagine in evidenza)
    const processedContent = this.processContent(modifiedBody);
    
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