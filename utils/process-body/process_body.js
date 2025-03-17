import { REGEX_PATTERNS } from './regex-config.js';
import { MediaHandlers } from './media-handlers.js';
import { TableHandler } from './table-handlers.js';
import YouTubeUtils from './plugins/youtube.js';
import ImageProcessor from './plugins/ImageProcessor.js';
import AnimationHandlers from './plugins/AnimationHandlers.js';
import MediaExtractor from './plugins/MediaExtractor.js';

/**
 * ContentProcessor - Elaborazione strutturata del contenuto post
 */
class ContentProcessor {
  constructor(rawContent) {
    console.log('ContentProcessor', rawContent);
    this.rawContent = rawContent || '';
    this.processedContent = rawContent || '';
    this.processedUrls = new Set();
    this.youtubeVideos = [];
  }

  /**
   * Main processing pipeline that calls each step in sequence
   * @returns {string} Fully processed HTML content
   */
  process() {
    try {
      console.log('Starting content processing...');
      
      // Extract YouTube videos for special handling
      this.extractYouTubeVideos();
      
      // Process in a clear, sequential way
      this.processMarkdownImages()
          .processAnimations()  // Aggiungi questa riga
          .processLinks()
          .processTables()
          .processUserMentions()
          .processTextFormatting()
          .restoreYouTubeEmbeds()
          .transformSteemitLinks()
          .wrapTextInParagraphs();
      
      // Final wrapping with any warnings
      return this.wrapFinalContent();
    } catch (error) {
      console.error('Content processing error:', error);
      return `<div class="post-content">
        <div class="post-body markdown-content">
          <p>Error processing content: ${error.message}</p>
        </div>
      </div>`;
    }
  }

  /**
   * Extract YouTube videos and replace with placeholders
   */
  extractYouTubeVideos() {
    this.youtubeVideos = YouTubeUtils.extractYouTubeVideos(this.processedContent);
    if (this.youtubeVideos.length > 0) {
      this.processedContent = YouTubeUtils.replaceYouTubeLinksWithPlaceholders(
        this.processedContent,
        this.youtubeVideos
      );
    }
    return this;
  }

  /**
   * Process markdown image syntax: ![alt](url)
   * Delegating to ImageHandlers module
   */
  processMarkdownImages() {
    this.processedContent = ImageProcessor.processMarkdownImages(this.processedContent);
    return this;
  }

  /**
   * Process animations like GIFs and animated WebP
   */
  processAnimations() {
    this.processedContent = AnimationHandlers.processAnimations(this.processedContent);
    
    // Optimize large GIFs for performance if not disabled
    if (!this.options?.disableGifOptimization) {
      this.processedContent = AnimationHandlers.convertLargeGifsToVideo(this.processedContent);
    }
    
    // Apply animation policy (reduced motion, etc)
    this.processedContent = AnimationHandlers.applyAnimationPolicy(this.processedContent);
    
    return this;
  }

  /**
   * Process HTML links
   */
  processLinks() {
    // Process markdown links that aren't images
    this.processedContent = this.processedContent.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      (match, text, url) => {
        // Skip image URLs which were already processed
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return match;
        }
        return `<a href="${url}" class="markdown-external-link" target="_blank" rel="noopener">${text}</a>`;
      }
    );

    return this;
  }

  /**
   * Process markdown tables
   */
  processTables() {
    this.processedContent = TableHandler.processAllTables(this.processedContent);
    return this;
  }

  /**
   * Process @username mentions
   */
  processUserMentions() {
    // Convert @username to proper links
    this.processedContent = this.processedContent.replace(
      /@([a-z0-9\.-]+)/gi,
      '<a class="markdown-author-link" href="/@$1">@$1</a>'
    );
    
    return this;
  }

  /**
   * Process various text formatting patterns
   */
  processTextFormatting() {
    // Headers (## style)
    this.processedContent = this.processedContent.replace(
      /^##\s+(.+)$/gm,
      '<h2>$1</h2>'
    );
    
    // Headers (### style)
    this.processedContent = this.processedContent.replace(
      /^###\s+(.+)$/gm,
      '<h3>$1</h3>'
    );
    
    // Headers (# style)
    this.processedContent = this.processedContent.replace(
      /^#\s+(.+)$/gm,
      '<h1>$1</h1>'
    );

    // Bold text with double asterisks
    this.processedContent = this.processedContent.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong>$1</strong>'
    );

    // Italic text with single asterisks
    this.processedContent = this.processedContent.replace(
      /(?<!\*)\*([^*]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    // Handle horizontal rules
    this.processedContent = this.processedContent.replace(
      /^\*{3,}$/gm,
      '<hr>'
    );
    
    // Remove extra line breaks
    this.processedContent = this.processedContent.replace(/\n\n\n+/g, '\n\n');

    return this;
  }

  /**
   * Wrap text blocks in paragraphs that aren't already in HTML tags
   */
  wrapTextInParagraphs() {
    // Split content by newlines
    const lines = this.processedContent.split('\n');
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines or lines that already have HTML tags
      if (!line || line.startsWith('<') && line.endsWith('>')) {
        continue;
      }
      
      // Skip lines that are part of HTML elements
      if (line.startsWith('<') || line.endsWith('>')) {
        continue;
      }
      
      // Wrap text in paragraph tags
      lines[i] = `<p>${line}</p>`;
    }
    
    this.processedContent = lines.join('\n');
    
    // Final enhancement of image tags
    this.processedContent = ImageProcessor.enhanceImageTags(this.processedContent);
    
    return this;
  }

  /**
   * Restore YouTube embeds from placeholders
   */
  restoreYouTubeEmbeds() {
    if (this.youtubeVideos.length > 0) {
      this.processedContent = YouTubeUtils.restoreYouTubeEmbeds(
        this.processedContent,
        this.youtubeVideos
      );
    }
    return this;
  }

  /**
   * Transform Steemit links to our app format
   */
  transformSteemitLinks() {
    this.processedContent = this.processedContent.replace(
      /https:\/\/steemit\.com\/[^\/]+\/@([^\/]+)\/([^\/\s"']+)/gi,
      (match, author, permlink) => {
        if (author && permlink) {
          return `#/post/${author}/${permlink}`;
        }
        return match;
      }
    ).replace(
      /https:\/\/steemit\.com\/@([^\/\s"']+)/gi,
      (match, username) => `#/profile/${username}`
    );

    return this;
  }

  /**
   * Wrap the final content with container and add any necessary warnings
   */
  wrapFinalContent() {
    // Just return the processed content as-is to match the desiderata format
    console.log('Content processing complete!', this.processedContent);
    return this.processedContent;
  }
}

/**
 * Main function to generate post content
 * @param {string} htmlContent - Raw content from Steemit
 * @returns {string} Processed HTML content
 */
export function generatePostContent(htmlContent) {
  const processor = new ContentProcessor(htmlContent);
  return processor.process();
}