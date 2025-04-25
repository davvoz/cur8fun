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
          imageProxyFn: (url) => this.optimizeImageUrl(url),
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
        
        // Process YouTube iframes for better responsiveness
        if (mergedOptions.enableYouTube) {
          this.processYouTubeEmbeds(container);
        }
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
   * Process YouTube iframes to make them responsive
   * @param {HTMLElement} container - Container with rendered content
   */
  processYouTubeEmbeds(container) {
    if (!container) return;
    
    // Find all iframes in the content
    const iframes = container.querySelectorAll('iframe');
    
    iframes.forEach(iframe => {
      // Check if it's a YouTube embed
      const src = iframe.getAttribute('src') || '';
      if (this.isValidYouTubeUrl(src)) {
        // Create a responsive container for the iframe
        const wrapper = document.createElement('div');
        wrapper.className = 'youtube-embed-container';
        
        // Clone iframe to prevent reference issues
        const iframeClone = iframe.cloneNode(true);
        
        // Ensure iframe has proper attributes for responsiveness
        iframeClone.setAttribute('width', '100%');
        iframeClone.setAttribute('height', '100%');
        iframeClone.setAttribute('frameborder', '0');
        iframeClone.setAttribute('allowfullscreen', 'true');
        
        // Remove fixed dimensions that might prevent responsiveness
        iframeClone.removeAttribute('style');
        
        // Add YouTube parameters for better mobile experience
        const currentSrc = iframeClone.getAttribute('src');
        if (currentSrc) {
          const updatedSrc = this.addYoutubeParams(currentSrc);
          iframeClone.setAttribute('src', updatedSrc);
        }
        
        // Replace the original iframe with our responsive version
        wrapper.appendChild(iframeClone);
        iframe.parentNode.replaceChild(wrapper, iframe);
      }
    });
  }
  
  /**
   * Add parameters to YouTube URLs for better mobile experience
   * @param {string} url - Original YouTube embed URL
   * @returns {string} Enhanced YouTube embed URL
   */
  addYoutubeParams(url) {
    // Parse the URL to add or modify parameters
    try {
      // Convert youtube.com URLs to youtube-nocookie.com for privacy and to prevent redirects
      let modifiedUrl = url;
      try {
        const urlObj = new URL(modifiedUrl);
        const allowedHosts = ['www.youtube.com', 'youtube.com', 'youtu.be'];
        if (allowedHosts.includes(urlObj.host)) {
          // Convert youtube.com URLs to youtube-nocookie.com for privacy
          if (urlObj.host === 'www.youtube.com' || urlObj.host === 'youtube.com') {
            urlObj.host = 'www.youtube-nocookie.com';
          }
          modifiedUrl = urlObj.toString();
        }
      } catch (e) {
        console.warn('Failed to parse YouTube URL:', e);
      }
      
      const urlObj = new URL(modifiedUrl);
      
      // Add parameters to prevent redirects and improve mobile experience
      urlObj.searchParams.set('playsinline', '1');
      urlObj.searchParams.set('rel', '0');
      urlObj.searchParams.set('enablejsapi', '1');
      urlObj.searchParams.set('origin', window.location.origin);
      
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, return the original URL
      console.warn('Failed to parse YouTube URL:', e);
      return url;
    }
  }
  
  /**
   * Optimize image URL using Steem's image proxy
   * @param {string} url - Original image URL
   * @param {Object} options - Size and quality options
   * @returns {string} Optimized image URL
   */
  optimizeImageUrl(url, options = {}) {
    if (!url) return '';
    
    // Clean the URL first
    url = this.sanitizeUrl(url);
    
    // Default options
    const defaults = {
      width: this.options.maxImageWidth || 640,
      height: 0, // 0 means auto height
      quality: 85
    };
    
    const settings = { ...defaults, ...options };
    
    // Return Steem's proxy URL with appropriate dimensions
    if (settings.height > 0) {
      return `https://steemitimages.com/${settings.width}x${settings.height}/${url}`;
    } else {
      return `https://steemitimages.com/${settings.width}x0/${url}`;
    }
  }
  
  /**
   * Sanitize a URL to ensure it's valid
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  sanitizeUrl(url) {
    if (!url) return '';
    
    // Remove query parameters and fragments
    let cleanUrl = url.split('?')[0].split('#')[0];
    
    // Ensure URL is properly encoded
    try {
      cleanUrl = new URL(cleanUrl).href;
    } catch (e) {
      // If URL is invalid, return original
      return url;
    }
    
    return cleanUrl;
  }
  
  /**
   * Extract the first image URL from content
   * @param {string} content - Markdown content
   * @returns {string} First image URL or empty string
   */
  extractImageFromContent(content) {
    if (!content) return '';
    
    // Use regex to find the first image
    const imgRegex = /!\[.*?\]\((.*?)\)|<img.*?src=["'](.*?)["']/i;
    const match = content.match(imgRegex);
    
    if (match) {
      // Return the URL from the match (either from markdown or HTML format)
      return match[1] || match[2] || '';
    }
    
    return '';
  }
  
  /**
   * Generate a data URL placeholder for missing images
   * @returns {string} Data URL for a placeholder image
   */
  getDataUrlPlaceholder() {
    return 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22288%22%20height%3D%22225%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20288%20225%22%20preserveAspectRatio%3D%22none%22%3E%0A%20%20%20%20%3Cdefs%3E%0A%20%20%20%20%20%20%3Cstyle%20type%3D%22text%2Fcss%22%3E%0A%20%20%20%20%20%20%20%20%23holder%20text%20%7B%0A%20%20%20%20%20%20%20%20%20%20fill%3A%20%23ffffff%3B%0A%20%20%20%20%20%20%20%20%20%20font-family%3A%20sans-serif%3B%0A%20%20%20%20%20%20%20%20%20%20font-size%3A%2014px%3B%0A%20%20%20%20%20%20%20%20%20%20font-weight%3A%20normal%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%3C%2Fstyle%3E%0A%20%20%20%20%3C%2Fdefs%3E%0A%20%20%20%20%3Cg%20id%3D%22holder%22%3E%0A%20%20%20%20%20%20%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23999%22%3E%3C%2Frect%3E%0A%20%20%20%20%20%20%3Cg%3E%0A%20%20%20%20%20%20%20%20%3Ctext%20text-anchor%3D%22middle%22%20x%3D%22144%22%20y%3D%22118%22%3EImage%20Not%20Available%3C%2Ftext%3E%0A%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%3C%2Fg%3E%0A%20%20%20%20%3C%2Fg%3E%0A%20%20%3C%2Fsvg%3E';
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
  /**
   * Validates if a given URL belongs to YouTube
   * @param {string} url - The URL to validate
   * @returns {boolean} - True if the URL is a valid YouTube URL, false otherwise
   */
  isValidYouTubeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      const allowedHosts = ['www.youtube.com', 'youtu.be'];
      return allowedHosts.includes(parsedUrl.hostname);
    } catch (e) {
      // If URL parsing fails, it's not a valid YouTube URL
      return false;
    }
  }
}

export default ContentRenderer;