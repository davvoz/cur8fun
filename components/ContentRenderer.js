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
      useProcessBody: false,
      maxImageWidth: 800,
      enableYouTube: true,
      videoDimensions: { width: '100%', height: '480px' },
      useSteemContentRenderer: true,
      ...options
    };
    
    // Initialize Steem Content Renderer if available
    if (this.options.useSteemContentRenderer) {
      this.initSteemRenderer();
    }
  }
  
  /**
   * Initialize the Steem Content Renderer
   */
  initSteemRenderer() {
    try {
      // Check if SteemContentRenderer is globally available
      if (typeof SteemContentRenderer !== 'undefined') {
        this.steemRenderer = new SteemContentRenderer.DefaultRenderer({
          baseUrl: "https://steemit.com/",
          breaks: true,
          skipSanitization: false,
          allowInsecureScriptTags: false,
          addNofollowToLinks: true,
          doNotShowImages: !this.options.renderImages,
          ipfsPrefix: "",
          assetsWidth: this.options.maxImageWidth || 640,
          assetsHeight: this.options.maxImageWidth * 0.75 || 480,
          imageProxyFn: (url) => url,
          usertagUrlFn: (account) => "/@" + account,
          hashtagUrlFn: (hashtag) => "/trending/" + hashtag,
          isLinkSafeFn: (url) => true,
        });
      } else {
        console.warn('SteemContentRenderer library not found. Make sure to include the script in your HTML.');
        this.steemRenderer = null;
      }
    } catch (error) {
      console.error('Failed to initialize SteemContentRenderer:', error);
      this.steemRenderer = null;
    }
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
    const mergedOptions = { ...this.options, ...options };
    const body = data.body || '';
    
    // Create container for content
    const container = document.createElement('div');
    container.className = mergedOptions.containerClass;
    
    // Render content with Steem Content Renderer if available
    if (this.steemRenderer) {
      try {
        const renderedHTML = this.steemRenderer.render(body);
        container.innerHTML = renderedHTML;
      } catch (error) {
        console.error('Error rendering content with SteemContentRenderer:', error);
        container.innerHTML = '<p>Error rendering content. Please try again later.</p>';
      }
    } else {
      // Fallback rendering if SteemContentRenderer is not available
      container.innerHTML = '<p>Content rendering is unavailable. Please check if SteemContentRenderer is properly loaded.</p>';
    }
    
    // Extract and process images if needed
    let images = [];
    if (mergedOptions.extractImages) {
      const imgElements = container.querySelectorAll('img');
      images = Array.from(imgElements).map(img => ({
        src: img.src,
        alt: img.alt || '',
        element: img
      }));
      
      // Apply image class if specified
      if (mergedOptions.imageClass) {
        images.forEach(img => {
          img.element.classList.add(mergedOptions.imageClass);
        });
      }
    }
    
    // Return the rendered content and metadata
    return {
      container,
      content: container.innerHTML,
      images,
      title: data.title || ''
    };
  }
  
  /**
   * Loads the SteemContentRenderer library dynamically if not already loaded
   * @returns {Promise} Resolves when the library is loaded
   */
  static loadSteemContentRenderer() {
    return new Promise((resolve, reject) => {
      if (typeof SteemContentRenderer !== 'undefined') {
        resolve(SteemContentRenderer);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/steem-content-renderer';
      script.async = true;
      
      script.onload = () => {
        if (typeof SteemContentRenderer !== 'undefined') {
          resolve(SteemContentRenderer);
        } else {
          reject(new Error('SteemContentRenderer not available after loading'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load SteemContentRenderer'));
      };
      
      document.head.appendChild(script);
    });
  }
}

export default ContentRenderer;