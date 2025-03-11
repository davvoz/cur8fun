import ImageUtils from '../utils/ImageUtils.js';
import { generatePostContent } from '../utils/process_body.js';  // Add this import

/**
 * Content Renderer component for displaying Steem posts and previews
 * Provides consistent rendering across post view and create post preview
 */
class ContentRenderer {
  constructor(options = {}) {
    this.options = {
      extractImages: true,
      renderImages: true,
      imageClass: 'content-image',
      containerClass: 'markdown-content',
      useProcessBody: true, // Whether to use the legacy process_body.js
      maxImageWidth: 800,  // Add max width for large images
      ...options
    };
    
    // Dictionary of regex patterns for content processing
    this.regexPatterns = {
      discordImages: /https:\/\/media\.discordapp\.net\/attachments\/[\w\/\-\.]+\.(jpg|jpeg|png|gif|webp)/gi,
      steemitImages: /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/[^\s<>")]+/gi,
      // Add more regex patterns as needed
    };
    
    this.extractedImages = [];
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
    const renderOptions = { ...this.options, ...options };
    this.extractedImages = [];
    
    // Process content based on the type of content
    let processedContent = '';
    let hasLargeImages = false;
    
    // First check if post appears to contain large images
    if (data.body) {
      hasLargeImages = this.detectLargeImages(data.body);
    }
    
    // Process main body content
    if (renderOptions.useProcessBody) {
      // Use the process_body.js function that we've imported
      try {
        const htmlResult = generatePostContent(data.body);
        // Extract just the inner content from the result
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlResult;
        const contentDiv = tempDiv.querySelector('.post-body');
        processedContent = contentDiv ? contentDiv.innerHTML : htmlResult;
        
        // Adjust any remaining large images in the processed content
        if (hasLargeImages) {
          processedContent = this.adjustLargeImagesInHtml(processedContent, renderOptions);
        }
      } catch (error) {
        console.error('Error using generatePostContent:', error);
        // Fall back to simple markdown parsing
        processedContent = this.processMarkdown(data.body);
      }
    } else {
      // Use our simpler markdown processing
      processedContent = this.processMarkdown(data.body);
    }
    
    // Extract images if needed (only if not using processBody or for backup)
    if (renderOptions.extractImages && (!renderOptions.useProcessBody || hasLargeImages)) {
      this.extractedImages = this.extractAllImages(data.body);
    }
    
    // Create the container element
    const container = document.createElement('div');
    container.className = renderOptions.containerClass;
    
    // Create and add title if provided
    let titleElement = null;
    if (data.title) {
      titleElement = document.createElement('h1');
      titleElement.className = 'content-title';
      titleElement.textContent = data.title;
      container.appendChild(titleElement);
    }
    
    // Create content element
    const contentElement = document.createElement('div');
    contentElement.className = 'content-body';
    contentElement.innerHTML = processedContent;
    container.appendChild(contentElement);
    
    // Add extracted images if any and if rendering images is enabled
    // Only add extracted images if we detect they're missing from the content
    let imagesContainer = null;
    if (renderOptions.renderImages && 
        this.extractedImages.length > 0 && 
        hasLargeImages && 
        !this.imagesAlreadyInContent(this.extractedImages, processedContent)) {
      
      imagesContainer = this.renderImagesContainer();
      
      // Place images based on strategy (top, inline, bottom)
      if (renderOptions.imagePosition === 'top' && titleElement) {
        container.insertBefore(imagesContainer, titleElement.nextSibling);
      } else if (renderOptions.imagePosition === 'bottom') {
        container.appendChild(imagesContainer);
      } else {
        // Default: insert after title or at beginning
        if (titleElement) {
          container.insertBefore(imagesContainer, titleElement.nextSibling);
        } else {
          container.insertBefore(imagesContainer, container.firstChild);
        }
      }
    }
    
    return {
      container,
      titleElement,
      contentElement,
      imagesContainer
    };
  }
  
  /**
   * Detect if content has large images that might need special handling
   */
  detectLargeImages(content) {
    if (!content) return false;
    
    // Look for image patterns that typically indicate large images
    const largeImagePatterns = [
      // Discord large image links
      /https:\/\/media\.discordapp\.net\/attachments\/[^\s<>"']+/i,
      
      // Steemit full-size image links (not thumbnails)
      /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/(?:0x0|DQm|p\/)/i,
      
      // Imgur direct links to large images (not thumbnails)
      /https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:jpg|png|gif)/i
    ];
    
    return largeImagePatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Adjust large images in HTML to ensure they display properly
   */
  adjustLargeImagesInHtml(html, options) {
    if (!html) return '';
    
    // Add responsive class and max-width to all images
    return html.replace(
      /<img([^>]*)>/gi,
      `<img$1 style="max-width:${options.maxImageWidth}px; height:auto;" class="${options.imageClass}">`
    );
  }
  
  /**
   * Check if extracted images are already in the rendered content
   */
  imagesAlreadyInContent(imageUrls, content) {
    if (!imageUrls.length || !content) return false;
    
    // Check if at least 50% of the extracted images are already in the content
    const foundImages = imageUrls.filter(url => content.includes(url));
    return foundImages.length >= imageUrls.length / 2;
  }
  
  /**
   * Simpler markdown processing using marked and DOMPurify
   * @param {string} markdown - Markdown content to process
   * @returns {string} Sanitized HTML content
   */
  processMarkdown(markdown) {
    if (!markdown) return '';
    
    try {
      // Convert markdown to HTML
      const html = marked.parse(markdown);
      
      // Sanitize HTML to prevent XSS
      return DOMPurify.sanitize(html);
    } catch (error) {
      console.error('Error processing markdown:', error);
      return `<p>Failed to render content: ${error.message}</p>`;
    }
  }
  
  /**
   * Extract all images from content using regex patterns
   * @param {string} content - Content to extract images from
   * @returns {string[]} Array of image URLs
   */
  extractAllImages(content) {
    if (!content) return [];
    
    // First try ImageUtils if available
    if (typeof ImageUtils === 'object' && typeof ImageUtils.extractAllImageUrls === 'function') {
      try {
        return ImageUtils.extractAllImageUrls(content);
      } catch (error) {
        console.error('Error using ImageUtils.extractAllImageUrls:', error);
      }
    }
    
    // Fallback to our own extraction
    const images = new Set();
    
    // Process each regex pattern
    Object.values(this.regexPatterns).forEach(pattern => {
      // Reset regex state
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(content)) !== null) {
        images.add(match[0]);
      }
    });
    
    return Array.from(images);
  }
  
  /**
   * Render a container with the extracted images
   * @returns {HTMLElement} Container with images
   */
  renderImagesContainer() {
    const container = document.createElement('div');
    container.className = 'content-images-container';
    
    this.extractedImages.forEach(imageUrl => {
      const imageElement = this.createImageWithFallback(imageUrl);
      container.appendChild(imageElement);
    });
    
    return container;
  }
  
  /**
   * Create an image element with error handling
   * @param {string} imageUrl - URL of the image
   * @returns {HTMLElement} Image element
   */
  createImageWithFallback(imageUrl) {
    const image = document.createElement('img');
    image.className = this.options.imageClass;
    image.alt = 'Content image';
    image.loading = 'lazy';
    image.style.maxWidth = '100%';  // Ensure images don't overflow
    
    // Use ImageUtils for optimized URL if available
    if (typeof ImageUtils === 'object' && typeof ImageUtils.optimizeImageUrl === 'function') {
      image.src = ImageUtils.optimizeImageUrl(imageUrl);
    } else {
      image.src = imageUrl;
    }
    
    // Add error handling
    image.onerror = () => {
      console.warn(`Failed to load image: ${imageUrl}`);
      image.style.display = 'none';
      if (typeof ImageUtils === 'object' && typeof ImageUtils.markImageAsFailed === 'function') {
        ImageUtils.markImageAsFailed(imageUrl);
      }
    };
    
    // Add click event to open image in new tab
    image.addEventListener('click', () => {
      window.open(imageUrl, '_blank');
    });
    
    return image;
  }
}

export default ContentRenderer;