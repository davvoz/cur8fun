// Enhanced debug helper for grid layout troubleshooting
window.debugGridLayout = function() {
  console.clear();
  console.log('%c===== GRID LAYOUT DEBUG =====', 'font-size:16px;font-weight:bold;color:#007bff;');
  
  // Check container classes
  const containers = document.querySelectorAll('.posts-container, .comments-container');
  console.log(`Found ${containers.length} containers`);
  
  containers.forEach((container, i) => {
    console.log(`%cContainer ${i+1}: ${container.className}`, 'font-weight:bold;color:#28a745;');
    
    // Check for wrapper
    const wrapper = container.querySelector('.posts-cards-wrapper, .comments-cards-wrapper');
    if (wrapper) {
      console.log(`  Wrapper: ${wrapper.className}`);
      console.log(`  Computed display: ${getComputedStyle(wrapper).display}`);
      console.log(`  Computed grid-template-columns: ${getComputedStyle(wrapper).gridTemplateColumns}`);
      
      // Log the style rules that apply to this element
      console.log('  Applied CSS rules:');
      const sheets = document.styleSheets;
      let matchingRules = [];
      
      for (let i = 0; i < sheets.length; i++) {
        try {
          const rules = sheets[i].cssRules || sheets[i].rules;
          for (let j = 0; j < rules.length; j++) {
            try {
              if (rules[j].selectorText && wrapper.matches(rules[j].selectorText)) {
                matchingRules.push({
                  selector: rules[j].selectorText,
                  css: rules[j].style.cssText,
                  sheet: sheets[i].href || 'inline'
                });
              }
            } catch (e) { /* Skip this rule */ }
          }
        } catch (e) { /* Cross-domain sheet access error - skip */ }
      }
      
      // Sort rules by specificity (roughly - just based on selector length)
      matchingRules.sort((a, b) => b.selector.length - a.selector.length);
      matchingRules.forEach(rule => {
        console.log(`    ${rule.selector} {${rule.css}}`);
      });
      
      // Check cards
      const cards = wrapper.querySelectorAll('.post-card');
      console.log(`  Cards: ${cards.length}`);
      
      if (cards.length > 0) {
        const firstCard = cards[0];
        console.log(`  First card dimensions: ${getComputedStyle(firstCard).width} × ${getComputedStyle(firstCard).height}`);
        
        // Check image containers
        const imageContainer = firstCard.querySelector('.post-image-container');
        if (imageContainer) {
          console.log(`  Image container: ${getComputedStyle(imageContainer).width} × ${getComputedStyle(imageContainer).height}`);
          console.log(`  Image container display: ${getComputedStyle(imageContainer).display}`);
          
          // Check actual image
          const image = imageContainer.querySelector('img');
          if (image) {
            console.log(`  Image: ${image.naturalWidth}×${image.naturalHeight}, displayed as ${getComputedStyle(image).width}×${getComputedStyle(image).height}`);
            console.log(`  Image src: ${image.src}`);
          } else {
            console.log('  No image found inside container!');
          }
        } else {
          console.log('  No image container found!');
        }
      }
    } else {
      console.log('  No wrapper element found!');
    }
    
    console.log('-'.repeat(40));
  });
  
  console.log('Debug complete. Run window.fixGridLayout() to attempt automatic fixes.');
};

// Self-healing function to attempt fixing grid layout issues
window.fixGridLayout = function() {
  const containers = document.querySelectorAll('.posts-container, .comments-container');
  containers.forEach(container => {
    const currentLayout = Array.from(container.classList)
      .find(cls => cls.startsWith('grid-layout-')) || 'grid-layout-grid';
    const layout = currentLayout.replace('grid-layout-', '');
    
    const wrapper = container.querySelector('.posts-cards-wrapper, .comments-cards-wrapper');
    if (wrapper) {
      // Add layout class directly to wrapper to ensure it's styled correctly
      if (!wrapper.classList.contains(`layout-${layout}`)) {
        wrapper.classList.add(`layout-${layout}`);
      }
      
      // Force grid display on wrapper based on layout
      if (layout === 'grid' || layout === 'compact') {
        wrapper.style.display = 'grid';
        wrapper.style.gridTemplateColumns = layout === 'grid' 
          ? 'repeat(3, 1fr)' 
          : 'repeat(5, 1fr)';
      } else if (layout === 'list') {
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
      }
      
      console.log(`Applied fixes to ${wrapper.className}`);
    }
  });
  
  console.log('Layout fixes applied. Refresh the page to see changes.');
};

// Run the debug automatically when viewing a profile
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    // Only run automatically on profile pages
    if (location.hash && location.hash.includes('/@')) {
      console.log('Profile page detected, running debug helper in 2 seconds...');
      setTimeout(() => {
        if (window.debugGridLayout) window.debugGridLayout();
      }, 2000);
    }
  }, 500);
});
