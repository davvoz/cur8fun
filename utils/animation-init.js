import AnimationHandlers from './process-body/plugins/AnimationHandlers.js';

/**
 * Initialize animation controls after DOM is loaded
 */
export function initializeAnimationControls() {
  // Attach event listeners for animation controls
  AnimationHandlers.attachAnimationControls();
  
  // Listen for dynamic content changes (e.g., new posts loaded)
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        // When content is added, reinitialize animation controls
        AnimationHandlers.attachAnimationControls();
      }
    }
  });
  
  // Start observing the document body for added nodes
  observer.observe(document.body, { childList: true, subtree: true });
  
  return {
    // Method to manually reinitialize controls
    reinitialize: () => AnimationHandlers.attachAnimationControls(),
    
    // Method to clean up observer
    disconnect: () => observer.disconnect()
  };
}

// Automatically initialize when the module is loaded
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAnimationControls);
  } else {
    initializeAnimationControls();
  }
}