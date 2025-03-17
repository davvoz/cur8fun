/**
 * Utility class for handling animations in content
 * Processes GIFs, animated WebP, and other animation formats
 */
class AnimationHandlers {
  /**
   * Detect if a URL points to an animated image
   * @param {string} url - URL to check
   * @returns {boolean} True if URL is likely an animation
   */
  static isAnimatedImage(url) {
    if (!url) return false;
    
    // Check for common animation formats
    return /\.(gif|webp|apng)(\?.*)?$/i.test(url) || 
           url.includes('animation') || 
           url.includes('animated');
  }
  
  /**
   * Process animated content in the markup
   * @param {string} content - Content to process
   * @returns {string} Processed content with optimized animations
   */
  static processAnimations(content) {
    if (!content) return content;
    
    let processedContent = content;
    
    // Process GIFs with auto-play controls
    processedContent = this.processGifs(processedContent);
    
    // Process animated WebP images
    processedContent = this.processAnimatedWebp(processedContent);
    
    return processedContent;
  }
  
  /**
   * Process GIF images and add optional controls
   * @param {string} content - Content to process
   * @returns {string} - Processed content
   */
  static processGifs(content) {
    // Find all img tags with GIF sources
    return content.replace(
      /<img([^>]*)src=["']([^"']+\.gif[^"']*)["']([^>]*)>/gi,
      (match, beforeSrc, src, afterSrc) => {
        // Don't process small GIFs (likely emoji/icons)
        if (this.isLikelyEmoji(src)) {
          return match;
        }
        
        // Add animation control attributes
        const hasControls = match.includes('data-animation-control');
        
        if (!hasControls) {
          const controlsAttr = 'data-animation-control="true"';
          const lazyAttr = 'loading="lazy"';
          const classAttr = afterSrc.includes('class="') ? 
            afterSrc.replace(/class=["']([^"']*)["']/, 'class="$1 animated-content"') : 
            `${afterSrc} class="animated-content"`;
          
          return `<div class="animation-container">
            <img${beforeSrc}src="${src}"${classAttr} ${controlsAttr} ${lazyAttr}>
            <div class="animation-controls">
              <button class="animation-toggle" title="Pause/Play animation">
                <span class="play-icon">▶</span>
                <span class="pause-icon">⏸</span>
              </button>
            </div>
          </div>`;
        }
        
        return match;
      }
    );
  }
  
  /**
   * Process animated WebP images
   * @param {string} content - Content to process
   * @returns {string} - Processed content
   */
  static processAnimatedWebp(content) {
    // Find potential animated WebP images
    return content.replace(
      /<img([^>]*)src=["']([^"']+\.webp[^"']*)["']([^>]*)>/gi,
      (match, beforeSrc, src, afterSrc) => {
        // We need to determine if this WebP is animated
        // Since we can't check the file directly, we make an educated guess
        if (src.includes('anim') || src.includes('animation') || src.includes('animated')) {
          // Treat as animated
          const hasControls = match.includes('data-animation-control');
          
          if (!hasControls) {
            const controlsAttr = 'data-animation-control="true"';
            const lazyAttr = 'loading="lazy"';
            const classAttr = afterSrc.includes('class="') ? 
              afterSrc.replace(/class=["']([^"']*)["']/, 'class="$1 animated-content"') : 
              `${afterSrc} class="animated-content"`;
            
            return `<div class="animation-container">
              <img${beforeSrc}src="${src}"${classAttr} ${controlsAttr} ${lazyAttr}>
              <div class="animation-controls">
                <button class="animation-toggle" title="Pause/Play animation">
                  <span class="play-icon">▶</span>
                  <span class="pause-icon">⏸</span>
                </button>
              </div>
            </div>`;
          }
        }
        
        return match;
      }
    );
  }
  
  /**
   * Convert GIFs to video for performance
   * @param {string} content - Content to process
   * @returns {string} - Processed content with GIFs converted to videos where appropriate
   */
  static convertLargeGifsToVideo(content) {
    // This is an advanced optimization that converts large GIFs to video
    // Due to the complexity, we're providing a simplified version
    
    return content.replace(
      /<img([^>]*)src=["']([^"']+\.gif[^"']*)["']([^>]*)>/gi,
      (match, beforeSrc, src, afterSrc) => {
        // Skip small GIFs and already processed ones
        if (this.isLikelyEmoji(src) || match.includes('data-gif-converted')) {
          return match;
        }
        
        // For large GIFs (>1MB or specific pattern), we'd convert to MP4/WebM
        // In a production app, you'd check file size or have a service to convert
        if (this.isLikelyLargeGif(src)) {
          // In reality, you'd need a service to convert GIFs or pre-converted versions
          // This is just a conceptual demonstration
          const videoSrc = src.replace(/\.gif/, '.mp4');
          
          return `<div class="video-container" data-gif-converted="true">
            <video autoplay loop muted playsinline class="converted-gif">
              <source src="${videoSrc}" type="video/mp4">
              <img src="${src}" alt="Animated GIF" class="gif-fallback">
            </video>
          </div>`;
        }
        
        return match;
      }
    );
  }
  
  /**
   * Check if a GIF is likely to be an emoji/small icon
   * @param {string} url - GIF URL
   * @returns {boolean} - True if likely an emoji
   */
  static isLikelyEmoji(url) {
    return url.includes('emoji') || 
           url.includes('icon') || 
           url.includes('emoticon') ||
           url.match(/\/e\/|\/emojis\/|\/icons\//i);
  }
  
  /**
   * Check if a GIF is likely to be large
   * @param {string} url - GIF URL
   * @returns {boolean} - True if likely a large GIF
   */
  static isLikelyLargeGif(url) {
    // In production, you might have a list of domains known for large GIFs
    // or a way to check file size
    return url.includes('giphy.com') || 
           url.includes('tenor.com') ||
           url.includes('imgur.com') ||
           url.includes('gfycat.com');
  }
  
  /**
   * Add animation autoplay policies
   * @param {string} content - Content to process
   * @returns {string} - Processed content
   */
  static applyAnimationPolicy(content) {
    // Example of applying a "reduced motion" policy
    // This could be used for users who have prefers-reduced-motion enabled
    
    if (this.shouldReduceMotion()) {
      return content.replace(
        /<img([^>]*)data-animation-control=["']true["']([^>]*)>/gi,
        '<img$1data-animation-control="true" data-animation-paused="true"$2>'
      );
    }
    
    return content;
  }
  
  /**
   * Check if we should reduce motion (for accessibility)
   * @returns {boolean} - True if motion should be reduced
   */
  static shouldReduceMotion() {
    if (typeof window === 'undefined') return false;
    
    // Check for system preference
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  
  /**
   * Helper function to attach event listeners for animation controls
   * This would be called by the UI component after rendering
   */
  static attachAnimationControls() {
    if (typeof document === 'undefined') return;
    
    // Find all animation toggle buttons
    const toggleButtons = document.querySelectorAll('.animation-toggle');
    
    toggleButtons.forEach(button => {
      // Skip if already initialized
      if (button.hasAttribute('data-initialized')) return;
      
      button.setAttribute('data-initialized', 'true');
      
      button.addEventListener('click', () => {
        const container = button.closest('.animation-container');
        const img = container.querySelector('img[data-animation-control]');
        
        // Toggle paused state
        const isPaused = img.hasAttribute('data-animation-paused');
        
        if (isPaused) {
          img.removeAttribute('data-animation-paused');
          container.classList.remove('animation-paused');
          // For GIFs, we need to reload the image
          const originalSrc = img.src;
          img.src = '';
          setTimeout(() => { img.src = originalSrc; }, 0);
        } else {
          img.setAttribute('data-animation-paused', 'true');
          container.classList.add('animation-paused');
        }
      });
    });
  }
}

export default AnimationHandlers;