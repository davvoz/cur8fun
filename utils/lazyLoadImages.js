export function initLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without IntersectionObserver
    document.querySelectorAll('.lazy-image-container').forEach(container => {
      const img = container.querySelector('img');
      img.src = container.dataset.src;
      if (container.dataset.srcset) img.srcset = container.dataset.srcset;
      img.classList.remove('lazy-load-image');
    });
    return;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const img = container.querySelector('img');
        
        // Set actual image src
        img.src = container.dataset.src;
        if (container.dataset.srcset) img.srcset = container.dataset.srcset;
        
        // Add load event for animations
        img.onload = () => container.classList.add('loaded');
        
        // Error handling
        img.onerror = () => {
          img.src = getDataUrlPlaceholder('Error loading image');
          container.classList.add('error');
          SHARED_CACHE.failedImageUrls.add(container.dataset.src);
        };
        
        img.classList.remove('lazy-load-image');
        observer.unobserve(container);
      }
    });
  }, {
    rootMargin: '200px 0px', // Load images 200px before they're visible
    threshold: 0.01
  });

  document.querySelectorAll('.lazy-image-container').forEach(container => {
    imageObserver.observe(container);
  });
}

// Helper function duplicated from ImagePlugin
function getDataUrlPlaceholder(text = 'No Image') {
  const safeText = String(text).replace(/[^\w\s-]/g, '');
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text fill="%23999999" font-family="sans-serif" font-size="18" text-anchor="middle" x="100" y="75">${safeText}</text></svg>`;
}