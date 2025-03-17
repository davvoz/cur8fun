import ImageUtils from '../utils/process-body/ImageUtils.js';
import YouTubeUtils from '../utils/process-body/plugins/youtube.js';
import { generatePostContent } from '../utils/process-body/process_body.js';
import { imagePatterns, largeImagePatterns, resetRegexLastIndex } from '../utils/process-body/RegexPatterns.js';
// Remove the marked import - we'll use the globally available marked from CDN

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
      enableYouTube: true, // Enable YouTube embedding
      videoDimensions: { width: '100%', height: '480px' }, // Default video dimensions
      useSteemContentRenderer: true, // Whether to use the steem-content-renderer from unpkg
      ...options
    };
    
    // Utilizza i pattern regex importati
    this.regexPatterns = imagePatterns;
    
    this.extractedImages = [];
    this.extractedVideos = [];
    
    // Check if steem-content-renderer is available
    this.steemRenderer = typeof window !== 'undefined' && window.steemContentRenderer;
    if (this.options.useSteemContentRenderer && !this.steemRenderer) {
      console.warn('steem-content-renderer not found. Fallback to custom renderer.');
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
    const renderOptions = { ...this.options, ...options };
    this.extractedImages = [];
    this.extractedVideos = [];
    
    // Process content based on the type of content
    let processedContent = '';
    let hasLargeImages = false;
    
    // First check if post appears to contain large images
    if (data.body) {
      // Enhance image URL detection before processing markdown
      data.body = this.enhanceImageUrls(data.body);
      
      hasLargeImages = this.detectLargeImages(data.body);
      
      // Extract YouTube videos before processing content
      if (renderOptions.enableYouTube) {
        this.extractedVideos = YouTubeUtils.extractYouTubeVideos(data.body);
        // Convert YouTube links to placeholders that won't be affected by other processing
        data.body = YouTubeUtils.replaceYouTubeLinksWithPlaceholders(data.body, this.extractedVideos);
      }
    }
    
    // Process main body content using steem-content-renderer if available and enabled
    if (renderOptions.useSteemContentRenderer && this.steemRenderer) {
      try {
        processedContent = this.renderWithSteemRenderer(data.body);
      } catch (error) {
        console.error('Error using steem-content-renderer:', error);
        // Fall back to our custom processing
        processedContent = this.renderWithFallback(data.body, renderOptions);
      }
    } else {
      // Use our custom processing as fallback
      processedContent = this.renderWithFallback(data.body, renderOptions);
    }
    
    // Restore YouTube videos from placeholders to embed iframes
    if (renderOptions.enableYouTube && this.extractedVideos.length > 0) {
      processedContent = YouTubeUtils.restoreYouTubeEmbeds(
        processedContent, 
        this.extractedVideos,
        renderOptions.videoDimensions
      );
    }
    
    // Extract images if needed
    if (renderOptions.extractImages && hasLargeImages) {
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
    
    // Apply responsive image processing to all images in the container
    this.makeImagesResponsive(container);
    
    // Add proper attributes to external links
    this.enhanceExternalLinks(container);
    
    return {
      container,
      titleElement,
      contentElement,
      imagesContainer
    };
  }
  
  /**
   * Render content using the steem-content-renderer library
   * @param {string} markdown - Raw markdown content
   * @returns {string} HTML content
   */
  renderWithSteemRenderer(markdown) {
    if (!markdown) return '';
    
    try {
      // Create a new renderer with default options
      const renderer = new window.steemContentRenderer.DefaultRenderer({
        baseUrl: 'https://steemit.com/',
        breaks: true,
        skipSanitization: false,
        allowInsecureScriptTags: false,
        addNofollowToLinks: true,
        doNotShowImages: false,
        ipfsPrefix: '',
        assetsWidth: 640,
        assetsHeight: 480,
        imageProxyFn: (url) => url.startsWith('https://steemitimages.com') ? url : `https://steemitimages.com/640x0/${url}`,
        usertagUrlFn: (account) => `/@${account}`,
        hashtagUrlFn: (hashtag) => `/trending/${hashtag}`,
        isLinkSafeFn: (url) => true
      });
      
      // Render the content
      const rendered = renderer.render(markdown);
      
      // Fix image links that might have been missed
      return this.fixImageTags(rendered);
    } catch (error) {
      console.error('Error in steem-content-renderer:', error);
      // Fall back to our custom markdown processing
      return this.processMarkdown(markdown);
    }
  }
  
  /**
   * Fallback render method using our custom logic
   * @param {string} markdown - Raw markdown content
   * @param {Object} options - Rendering options
   * @returns {string} HTML content
   */
  renderWithFallback(markdown, options) {
    if (!markdown) return '';
    
    // DIRECT FIX: Replace the exact problematic pattern before any processing
    // This catches the specific |       | followed by | ----------| pattern
    markdown = this.fixExactMinimalTablePattern(markdown);
      
    // Continue with other preprocessing
    if (markdown.includes('| |') || markdown.includes('|  |')) {
      markdown = this.replaceMinimalTables(markdown);
    }
    
    let processedContent = '';
    
    if (options.useProcessBody) {
      // Use the process_body.js function that we've imported
      try {
        const htmlResult = generatePostContent(markdown);
        // Extract just the inner content from the result
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlResult;
        const contentDiv = tempDiv.querySelector('.post-body');
        processedContent = contentDiv ? contentDiv.innerHTML : htmlResult;
      } catch (error) {
        console.error('Error using generatePostContent:', error);
        // Fall back to simple markdown parsing
        processedContent = this.processMarkdown(markdown);
      }
      // After processing content with process_body.js, apply the post-processing fix
      processedContent = this.postProcessContent(processedContent);
    } else {
      // Use our simpler markdown processing
      processedContent = this.processMarkdown(markdown);
      // Also apply post-processing to our markdown processor output
      processedContent = this.postProcessContent(processedContent);
    }
    
    // Fix image links that might have been missed
    return this.fixImageTags(processedContent);
  }
  
  /**
   * Make all images in the container responsive with srcset attributes
   * @param {HTMLElement} container - The container with images to process
   */
  makeImagesResponsive(container) {
    if (!container) return;
    
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        // Skip if already has srcset
        if (!img.hasAttribute('srcset') && !src.includes('srcset=')) {
          // Create responsive srcset for steemit images
          if (src.includes('cdn.steemitimages.com') || 
              src.includes('steemitimages.com') || 
              src.includes('files.peakd.com')) {
            
            // Create 1x and 2x versions for srcset
            let baseUrl = src;
            
            // Replace any existing dimension parameters
            if (baseUrl.includes('steemitimages.com/0x0/')) {
              baseUrl = baseUrl.replace('steemitimages.com/0x0/', 'steemitimages.com/640x0/');
            } else if (!baseUrl.includes('steemitimages.com/640x0/')) {
              baseUrl = `https://steemitimages.com/640x0/${baseUrl}`;
            }
            
            // Create 2x version for high resolution
            const highResUrl = baseUrl.replace('640x0', '1280x0');
            
            // Set srcset attribute
            img.setAttribute('srcset', `${baseUrl} 1x, ${highResUrl} 2x`);
            
            // Ensure the src is the 1x version
            img.src = baseUrl;
          }
        }
      }
    });
  }
  
  /**
   * Enhance external links with proper attributes
   * @param {HTMLElement} container - The container with links to process
   */
  enhanceExternalLinks(container) {
    if (!container) return;
    
    const links = container.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.startsWith('http') || href.startsWith('https'))) {
        // This is an external link
        if (!link.hasAttribute('rel')) {
          link.setAttribute('rel', 'noopener');
        }
        
        // Add title for better accessibility if not already present
        if (!link.hasAttribute('title')) {
          link.setAttribute('title', 'This link will take you away from steemit.com');
        }
      }
    });
  }
  
  /**
   * Fix the exact minimal table pattern that's causing issues
   * This specifically targets |       | followed by | -----------|
   */
  fixExactMinimalTablePattern(content) {
    if (!content) return '';
    
    console.log('Looking for exact minimal table pattern');
    
    // First, try exact string match (most reliable)
    if (content.includes('|       |\n| -----------|')) {
      console.log('Found exact minimal table pattern via string match!');
      return content.replace(
        '|       |\n| -----------|', 
        '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>'
      );
    }
    
    // More general matcher for slight variations, using careful regex
    // This matches | followed by 1+ spaces, followed by | and newline
    // Then | followed by space, followed by 5+ hyphens, followed by |
    const exactPattern = /\|[ ]{1,}\|\n\|[ ][-]{5,}[ ]*\|/g;
    
    if (exactPattern.test(content)) {
      console.log('Found minimal table via precise regex');
      return content.replace(
        exactPattern,
        '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>'
      );
    }
    
    return content;
  }
  
  /**
   * Detect if content has large images that might need special handling
   */
  detectLargeImages(content) {
    if (!content) return false;
    
    // Usa i pattern per immagini grandi importati
    return largeImagePatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Adjust large images in HTML to ensure they display properly
   */
  adjustLargeImagesInHtml(html, options) {
    if (!html) return '';
    
    // Detect mobile devices
    const isMobile = typeof window !== 'undefined' && window.innerWidth && window.innerWidth <= 768;
    
    // First fix any potential markdown tables that weren't processed
    html = this.fixUnprocessedTables(html);
    

      // On mobile, just add the class without max-width style
      return html.replace(
        /<img([^>]*)>/gi,
        `<img$1 class="${options.imageClass}">`
      );
  }
  
  /**
   * Fix unprocessed markdown tables in HTML content
   * @param {string} html - HTML content that might contain unprocessed markdown tables
   * @returns {string} HTML with tables fixed
   */
  fixUnprocessedTables(html) {
    if (!html) return '';
    
    // Make sure marked is available from the global scope (from CDN)
    if (typeof window.marked === 'undefined') {
      console.warn('marked library not loaded from CDN');
      return html;
    }
    
    // Handle the specific problematic pattern as a special case
    // This will catch any remaining instances that weren't handled by replaceMinimalTables
    html = html.replace(/\|\s*\|\s*\n\|\s*-+\s*\|/g, (match) => {
      console.log('Found minimal table pattern in HTML, creating direct table');
      return '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
    });
    
    // First handle specifically the minimal empty table case that markdown parsers often miss
    // This handles the "|       |" followed by "| -----------|" pattern exactly
    html = html.replace(/\|\s*\|\s*\n\|\s*[-]+\s*\|/g, (match) => {
      console.log('Found minimal table pattern, creating HTML table directly');
      return '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
    });
    
    // Special handling for minimal tables like | | and | -----|
    html = html.replace(/\|\s*\|\s*\n\|\s*[-]+\s*\|/g, (match) => {
      return '<table class="markdown-table"><thead><tr><th>&nbsp;</th></tr></thead><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
    });
    
    // Find markdown table patterns that weren't processed
    // Updated regex to catch more table formats including single-cell tables
    const tableRegex = /\|[^\n]*\|\s*\n\|[\s\-:]+\|.*\n?(\|.*\|.*\n?)*/g;
    
    return html.replace(tableRegex, (table) => {
      try {
        // Handle empty or minimal cell content
        let processedTable = table;
        
        // Special handling for very minimal tables
        if (table.trim().startsWith('|') && table.trim().endsWith('|')) {
          // Extract rows
          const rows = table.trim().split('\n');
          
          // If we have the minimal format with empty cells
          if (rows.length >= 2) {
            const headerCells = rows[0].split('|').filter(s => s.trim().length > 0);
            
            // Check if this is the specific case we're having trouble with
            if (rows.length === 2 && rows[1].includes('-') && !rows[1].includes('|--')) {
              console.log('Handling 2-row minimal table');
              return '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
            }
            
            // If header row has no content or just whitespace
            if (headerCells.length === 0 || headerCells.every(cell => cell.trim() === '')) {
              // Create a manual HTML table for this case
              return '<table class="markdown-table"><thead><tr><th>&nbsp;</th></tr></thead><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
            }
          }
        }
        
        // Process the table with marked
        window.marked.setOptions({ 
          gfm: true, 
          tables: true,
          headerIds: false,
          mangle: false 
        });
        
        // For minimal tables, add a content row explicitly
        if (table.split('\n').length === 2) {
          processedTable = table + "| &nbsp; |\n";
        }
        
        const htmlTable = window.marked.parse(processedTable);
        
        // If parsing didn't result in a table, force create one
        if (!htmlTable.includes('<table')) {
          return this.createManualHtmlTable(table);
        }
        
        return htmlTable;
      } catch(e) {
        console.warn('Failed to process markdown table:', e);
        return this.createManualHtmlTable(table);
      }
    });
  }
  
  /**
   * Create a manual HTML table from markdown table syntax
   * @param {string} tableMarkdown - Markdown table text
   * @returns {string} HTML table
   */
  createManualHtmlTable(tableMarkdown) {
    try {
      const rows = tableMarkdown.trim().split('\n');
      if (rows.length >= 1) {
        // Very simple format - create a basic table
        let htmlTable = '<table class="markdown-table"><tbody>';
        
        // Skip separator rows when processing
        rows.forEach((row, index) => {
          // Skip separator rows (rows with only dashes, colons, and pipes)
          if (index === 1 && /^[\s|\-:]+$/.test(row)) {
            return;
          }
          
          // Process each cell in the row
          const cells = row.split('|').filter((cell, idx, arr) => 
            // Skip first/last empty cells from pipe at beginning/end of line
            !(idx === 0 && cell.trim() === '') && 
            !(idx === arr.length - 1 && cell.trim() === '')
          );
          
          if (cells.length > 0) {
            htmlTable += '<tr>';
            
            // For completely empty rows/cells, add a non-breaking space
            if (cells.every(cell => cell.trim() === '')) {
              htmlTable += '<td>&nbsp;</td>';
            } else {
              cells.forEach(cell => {
                htmlTable += `<td>${cell.trim() || '&nbsp;'}</td>`;
              });
            }
            
            htmlTable += '</tr>';
          } else {
            // For rows with no cells (just pipes), add an empty cell
            htmlTable += '<tr><td>&nbsp;</td></tr>';
          }
        });
        
        htmlTable += '</tbody></table>';
        return htmlTable;
      }
    } catch (fallbackError) {
      console.error('Manual table creation failed:', fallbackError);
    }
    
    // Last resort - return a basic table with one empty cell
    return '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>';
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
      // First do a direct replacement of the problematic pattern before any markdown processing
      const fixedMarkdown = markdown.replace(
        /\|\s*\|\s*\n\|\s*[-]+\s*\|/g,
        '<div data-special-table="1"><table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table></div>'
      );
      
      // Improve table preprocessing before sending to marked
      // Look for table-like structures and ensure they're properly formatted
      const enhancedMarkdown = this.preprocessMarkdownTables(fixedMarkdown);
      
      // Configure marked to handle tables and other extended features
      window.marked.setOptions({
        gfm: true,         // GitHub Flavored Markdown mode (tables, strikethrough)
        tables: true,      // Enable table support explicitly
        breaks: true,      // Enable line breaks
        pedantic: false,   // Conform to markdown.pl
        smartLists: true,  // Smarter list behavior
        headerIds: false,  // Disable header IDs to avoid deprecation warnings
        mangle: false,     // Disable mangling to avoid deprecation warnings
        // Add this option to render raw HTML embedded in markdown
        renderer: new window.marked.Renderer(),
        sanitize: false
      });
      
      // Convert markdown to HTML
      const html = window.marked.parse(enhancedMarkdown);
      
      // Sanitize HTML to prevent XSS with DOMPurify
      if (typeof window.DOMPurify !== 'undefined') {
        // Use DOMPurify with explicit allowed tags configuration
        return window.DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            // Default HTML tags
            'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'small', 's', 'span', 'strong', 'sub',
            'sup', 'u', 'ul',
            // Table elements
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            // Other elements we want to allow
            'blockquote', 'center', 'details', 'summary'
          ]
        });
      } else {
        // If DOMPurify is not available, just return the HTML
        console.warn('DOMPurify not loaded, returning unfiltered HTML');
        return html;
      }
    } catch (error) {
      console.error('Error processing markdown:', error);
      return `<p>Failed to render content: ${error.message}</p>`;
    }
  }
  
  /**
   * Preprocess markdown to ensure tables are properly formatted
   * @param {string} markdown - Raw markdown content
   * @returns {string} Processed markdown
   */
  preprocessMarkdownTables(markdown) {
    if (!markdown) return '';
    
    // Special direct handling for our problematic pattern
    const modifiedMarkdown = markdown.replace(
      /\|\s*\|\s*\n\|\s*-+\s*\|/g,
      '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tbody></table>'
    );
    
    if (modifiedMarkdown !== markdown) {
      console.log('Replaced minimal table during preprocessing');
      return modifiedMarkdown;
    }
    
    // Special handling for minimal single-cell tables with just a divider in second row
    let enhancedMarkdown = markdown.replace(
      /(\|\s*\|\s*\n\|\s*[-]+\s*\|)(?!\s*\n\|)/gm,
      (match) => {
        // Add an additional cell row to make sure it's recognized
        console.log('Preprocessing minimal table format');
        return match + "\n| &nbsp; |";
      }
    );
    
    // Special handling for minimal tables
    enhancedMarkdown = enhancedMarkdown.replace(
      /(\|\s*\|\s*\n\|\s*[-]+\s*\|)/g,
      (match) => {
        // Add a content row to minimal tables
        return match + "\n| &nbsp; |";
      }
    );
    
    // Check for tables at the very end of content
    if (/\|\s*[-]+\s*\|\s*$/.test(enhancedMarkdown)) {
      enhancedMarkdown += "\n| &nbsp; |";
    }
    
    // Identify potential table patterns, particularly minimal or malformed ones
    enhancedMarkdown = enhancedMarkdown.replace(
      /(\|[^\n]*\|\s*\n\|[\s\-:]+\|[^\n]*\n)(?!\|)/g,
      (match) => {
        // This looks like a table header and separator without content rows
        // Add a content row to make it a valid table
        return match + "| &nbsp; |\n";
      }
    ).replace(
      /(\|[^\n\|]+\|\s*\n)(\|[\s\-:]+\|[^\n]*\n)$/gm,
      (match, headerRow, separatorRow) => {
        // Table at the end of text or section without content rows
        return match + "| &nbsp; |\n";
      }
    );
    
    return enhancedMarkdown;
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
    
    // Add special handling for peakd.com URLs
    const peakdRegex = /(https?:\/\/files\.peakd\.com\/file\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/gi;
    let match;
    while ((match = peakdRegex.exec(content)) !== null) {
      if (match[1]) {
        images.add(match[1]);
      }
    }
    
    // Process each regex pattern from ImagePatterns
    Object.values(this.regexPatterns).forEach(pattern => {
      // Resetta il lastIndex prima dell'uso
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(content)) !== null) {
        images.add(match[1] || match[0]);
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
  
  /**
   * Handle minimal empty tables directly in the markdown
   * @param {string} markdown - Raw markdown content
   * @returns {string} - Processed markdown with handled empty tables
   */
  handleMinimalEmptyTables(markdown) {
    if (!markdown) return '';
    
    // Direct replacement for the problematic pattern
    return markdown.replace(
      /\|\s*\|\s*\n\|\s*[-]+\s*\|/g, 
      '<div class="manual-table-html"><table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table></div>'
    );
  }
  
  /**
   * Replace minimal tables with direct HTML before any other processing
   * This is a direct and focused approach for the specific pattern we're having trouble with
   */
  replaceMinimalTables(markdown) {
    if (!markdown) return '';
    
    // Create a line-by-line analysis for more precise replacement
    const lines = markdown.split('\n');
    const newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      // Debug the current line to help troubleshoot
      if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        console.log('Potential table line:', lines[i]);
        
        // Check for multi-space pattern specifically
        if (lines[i].match(/^\|\s{3,}\|$/)) {
          console.log('Found multi-space line pattern!');
        }
      }
      
      // Enhanced check for the first line of our problematic pattern
      // Much more precise matching than before
      if ((lines[i].match(/^\|\s{1,}\|$/) || lines[i].trim() === '| |' || lines[i].trim() === '|  |') && 
          i + 1 < lines.length && 
          lines[i+1].match(/^\|\s*[-]{1,}\s*\|$/)) {
        
        console.log('Found minimal table at line', i, 'Line content:', lines[i], 'Next line:', lines[i+1]);
        
        // Add a direct HTML table replacement
        newLines.push('<div class="minimal-table-wrapper">');
        newLines.push('<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>');
        newLines.push('</div>');
        
        // Skip the next line as we've already handled it
        i++;
      } else {
        // Keep existing line
        newLines.push(lines[i]);
      }
    }
    
    return newLines.join('\n');
  }

  /**
   * Post-process HTML content to fix any issues with tables that were incorrectly rendered as paragraphs
   * @param {string} html - HTML content that might contain incorrectly formatted tables
   * @returns {string} Fixed HTML content
   */
  postProcessContent(html) {
    if (!html) return '';
    
    // Look for the exact pattern where a minimal table is wrapped in paragraph tags
    return html.replace(
      /<p>\s*\|\s*\|\s*<\/p>\s*<p>\s*\|\s*[-]+\s*\|\s*<\/p>/g,
      '<table class="markdown-table"><tbody><tr><td>&nbsp;</td></tr></tbody></table>'
    );
  }

  /**
   * Enhance image URLs in the content before processing
   * Particularly useful for peakd.com URLs and other complex formats
   */
  enhanceImageUrls(content) {
    if (!content) return '';
    
    // Function to convert plain URLs to markdown image syntax
    const convertUrlsToMarkdown = (text) => {
      // Make sure we're looking for peakd.com URLs specifically
      const peakdRegex = /(https?:\/\/files\.peakd\.com\/file\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/gi;
      
      return text.replace(peakdRegex, (match) => {
        // Wrap in markdown image syntax if not already wrapped
        if (!text.includes(`![](${match})`) && !text.includes(`<img src="${match}"`)) {
          return `![](${match})`;
        }
        return match;
      });
    };
    
    return convertUrlsToMarkdown(content);
  }

  /**
   * Fix image tags in the processed HTML content
   * Ensures all image URLs are properly handled, especially peakd.com URLs
   */
  fixImageTags(html) {
    if (!html) return '';
    
    // Fix images in table cells first - this is important for properly displaying images in tables
    html = this.fixImagesInTableCells(html);
    
    // Find all img tags
    return html.replace(/<img\s+([^>]*?)src=(['"])(.*?)\2([^>]*?)>/gi, (match, beforeSrc, quote, src, afterSrc) => {
      // Check if this is a peakd.com URL
      if (src.includes('files.peakd.com')) {
        // Make sure it has proper loading attributes and class
        return `<img ${beforeSrc}src=${quote}${src}${quote} loading="lazy" class="${this.options.imageClass}" ${afterSrc}>`;
      }
      
      // Special handling for DQm format URLs from steemitimages.com
      if (src.includes('steemitimages.com/DQm') || src.includes('cdn.steemitimages.com/DQm')) {
        return `<img ${beforeSrc}src=${quote}${src}${quote} loading="lazy" class="${this.options.imageClass}" ${afterSrc}>`;
      }
      
      // For other URLs, optimize with ImageUtils if available
      if (typeof ImageUtils === 'object' && typeof ImageUtils.optimizeImageUrl === 'function') {
        const optimizedSrc = ImageUtils.optimizeImageUrl(src);
        return `<img ${beforeSrc}src=${quote}${optimizedSrc}${quote} loading="lazy" class="${this.options.imageClass}" ${afterSrc}>`;
      }
      
      return match;
    });
  }
  
  /**
   * Special processor for fixing images inside table cells
   * Table cells often need special handling to ensure images display correctly
   */
  fixImagesInTableCells(html) {
    if (!html) return '';
    
    // Look for image URLs inside table cells
    return html.replace(/<td[^>]*>(.*?)<\/td>/gi, (match, cellContent) => {
      // First check for Markdown image syntax - this is what we were missing!
      const markdownImgRegex = /!\[(?:.*?)\]\(([^)]+)\)/gi;
      
      // Check if the cell content looks like an image URL but isn't wrapped in an img tag
      const imageUrlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/gi;
      
      // Special check for steemitimages.com DQm format URLs
      const dqmRegex = /(https?:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/DQm[^\s<>"']+)/gi;
      
      // Check for peakd.com URLs
      const peakdRegex = /(https?:\/\/files\.peakd\.com\/file\/[^\s<>"']+)/gi;
      
      // Replace direct image URLs with proper img tags
      let processedContent = cellContent;
      
      // Handle Markdown image syntax first
      processedContent = processedContent.replace(markdownImgRegex, (markdown, url) => {
        // Check if the content already has an img tag with this URL
        if (processedContent.includes(`<img`) && processedContent.includes(url)) {
          return markdown;
        }
        return `<img src="${url}" loading="lazy" class="table-cell-image" alt="Table cell image">`;
      });
      
      // Handle DQm format URLs
      processedContent = processedContent.replace(dqmRegex, (url) => {
        if (!processedContent.includes(`<img`) || !processedContent.includes(url)) {
          return `<img src="${url}" loading="lazy" class="table-cell-image" alt="Table cell image">`;
        }
        return url;
      });
      
      // Handle peakd.com URLs
      processedContent = processedContent.replace(peakdRegex, (url) => {
        if (!processedContent.includes(`<img`) || !processedContent.includes(url)) {
          return `<img src="${url}" loading="lazy" class="table-cell-image" alt="Table cell image">`;
        }
        return url;
      });
      
      // Handle general image URLs 
      processedContent = processedContent.replace(imageUrlRegex, (url) => {
        // Skip if this URL is already in an img tag or has already been processed
        if (
          (processedContent.includes(`<img`) && 
          processedContent.includes(url) && 
          processedContent.includes('src=')) ||
          url.includes('steemitimages.com/DQm') ||
          url.includes('cdn.steemitimages.com/DQm') ||
          url.includes('files.peakd.com')
        ) {
          return url;
        }
        return `<img src="${url}" loading="lazy" class="table-cell-image" alt="Table cell image">`;
      });
      
      if (processedContent !== cellContent) {
        return `<td>${processedContent}</td>`;
      }
      
      return match;
    });
  }
}

export default ContentRenderer;