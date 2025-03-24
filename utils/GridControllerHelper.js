/**
 * GridControllerHelper - Utility to help with grid controller functionality
 */
class GridControllerHelper {
  static applyToAll() {
    // Apply grid layout to all profile posts containers on the page
    const containers = document.querySelectorAll('.profile-posts');
    if (containers.length === 0) {
      console.log('No profile posts containers found for automatic grid application');
      return false;
    }
    
    const savedGridType = localStorage.getItem('profile-grid-type') || 'grid';
    
    containers.forEach(container => {
      this.apply(container, '.post-card', savedGridType);
    });
    
    return true;
  }
  
  static apply(containerOrSelector, postSelector, gridType = 'grid') {
    const container = typeof containerOrSelector === 'string' 
      ? document.querySelector(containerOrSelector) 
      : containerOrSelector;
      
    if (!container) {
      console.error(`GridControllerHelper: Container not found`);
      return false;
    }
    
    console.log(`GridControllerHelper: Applying ${gridType} layout to`, container);
    
    // Apply grid or list class to container
    container.classList.remove('grid-layout', 'list-layout');
    container.classList.add(`${gridType}-layout`);
    
    // Apply appropriate thumbnail class to all thumbnails
    const thumbnails = container.querySelectorAll('.post-thumbnail');
    thumbnails.forEach(thumbnail => {
      thumbnail.classList.remove('post-grid-thumbnail', 'post-list-thumbnail');
      thumbnail.classList.add(`post-${gridType}-thumbnail`);
    });
    
    return true;
  }
  
  static savePreference(gridType) {
    localStorage.setItem('profile-grid-type', gridType);
    return gridType;
  }
  
  static getPreference() {
    return localStorage.getItem('profile-grid-type') || 'grid';
  }
  
  static debug(selector) {
    const container = document.querySelector(selector);
    if (!container) {
      console.error(`GridControllerHelper: Debug - Container not found with selector "${selector}"`);
      return {
        found: false,
        containerInfo: null,
        posts: 0
      };
    }
    
    const posts = container.querySelectorAll('.post-card');
    
    return {
      found: true,
      containerInfo: {
        id: container.id,
        className: container.className,
        childCount: container.children.length
      },
      posts: posts.length,
      postInfo: Array.from(posts).map(post => ({
        id: post.dataset.postId,
        hasChildren: post.children.length > 0,
        hasThumbnail: !!post.querySelector('.post-thumbnail')
      })).slice(0, 3) // Just first 3 for brevity
    };
  }
  

}



export default GridControllerHelper;
