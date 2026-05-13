import router from '../../utils/Router.js';

class PostHeader {
  constructor(post, renderCommunityCallback, options = {}) {
    if (typeof options !== 'object' || options === null) {
      options = {};
    }

    this.post = post;
    this.renderCommunityCallback = renderCommunityCallback;
    this.element = null;
    this.community = null; // Add community property
    this.showActionsMenu = options.showActionsMenu === true;
    this.onShare = typeof options.onShare === 'function' ? options.onShare : null;
    this.onEdit = typeof options.onEdit === 'function' ? options.onEdit : null;
    this.canEdit = options.canEdit === true;
    this.menuOpen = false;
    this.menuRoot = null;
    this.menuDropdown = null;

    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleEscapeKey = this.handleEscapeKey.bind(this);
  }

  // Add the missing setCommunity method
  setCommunity(community) {
    this.community = community;
    
    // If the element is already rendered, update it
    if (this.element) {
      const communityPlaceholder = this.element.querySelector('.community-placeholder');
      if (communityPlaceholder && this.renderCommunityCallback) {
        this.renderCommunityCallback(community).then(communityBadge => {
          if (communityBadge && communityPlaceholder.parentNode) {
            communityPlaceholder.parentNode.replaceChild(communityBadge, communityPlaceholder);
          }
        });
      }
    }
  }

  render() {
    const postHeader = document.createElement('div');
    postHeader.className = 'post-headero';

    const postTitle = document.createElement('h1');
    postTitle.className = 'post-title-header';
    postTitle.textContent = this.post.title || 'Comment';

    //se title è Comment creimo un link al post originale
    if (postTitle.textContent === 'Comment') {
      
    }

    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';

    // First container for avatar and author name
    const avataro = document.createElement('div');
    avataro.className = 'avataro';

    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar';
    authorAvatar.src = `https://steemitimages.com/u/${this.post.author}/avatar`;
    authorAvatar.alt = this.post.author;
    authorAvatar.style.cursor = 'pointer';
    authorAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      router.navigate(`/@${this.post.author}`);
    });

    const authorName = document.createElement('a');
    // Use click event handler instead of href for more reliable routing
    authorName.href = "javascript:void(0)";
    authorName.className = 'author-name';
    authorName.textContent = `@${this.post.author}`;
    authorName.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(`/@${this.post.author}`);
    });

    avataro.appendChild(authorAvatar);
    avataro.appendChild(authorName);

    // Community handling - use this.community if it was set
    const metadata = this.parseMetadata(this.post.json_metadata);
    const community = this.community || metadata?.community || this.post.category || null;

    if (community) {
      // Create a placeholder for the community badge
      const communityPlaceholder = document.createElement('div');
      communityPlaceholder.className = 'community-placeholder';
      avataro.appendChild(communityPlaceholder);
      
      // Load the community badge asynchronously if callback provided
      if (this.renderCommunityCallback) {
        this.renderCommunityCallback(community).then(communityBadge => {
          if (communityBadge && communityPlaceholder.parentNode) {
            communityPlaceholder.parentNode.replaceChild(communityBadge, communityPlaceholder);
          }
        });
      }
    }

    // Second container for date
    const dataro = document.createElement('div');
    dataro.className = 'dataro';

    const postDate = document.createElement('span');
    postDate.className = 'post-date';
    
    //post date handling with time zone consideration
    const timeElapsed = Math.floor((Date.now() - new Date(this.post.created + "Z").getTime()) / (1000 * 60));

    if (timeElapsed < 60) {
      postDate.textContent = timeElapsed <= 1 ? 'Just now' : `${timeElapsed} min ago`;
    } else if (timeElapsed < 24 * 60) {
      // Convert minutes to hours
      const hours = Math.floor(timeElapsed / 60);
      postDate.textContent = hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (timeElapsed < 30 * 24 * 60) {
      // Convert minutes to days
      const days = Math.floor(timeElapsed / (24 * 60));
      postDate.textContent = days === 1 ? '1 day ago' : `${days} days ago`;
    } else if (timeElapsed < 365 * 24 * 60) {
      // Convert minutes to months
      const months = Math.floor(timeElapsed / (30 * 24 * 60));
      postDate.textContent = months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      // Use locale date for anything older than a year
      postDate.textContent = new Date(this.post.created + "Z").toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    dataro.appendChild(postDate);

    if (this.showActionsMenu && (this.onShare || (this.canEdit && this.onEdit))) {
      const menuRoot = document.createElement('div');
      menuRoot.className = 'post-header-menu';

      const menuTrigger = document.createElement('button');
      menuTrigger.type = 'button';
      menuTrigger.className = 'post-header-menu-trigger';
      menuTrigger.title = 'More actions';
      menuTrigger.setAttribute('aria-label', 'More actions');
      menuTrigger.innerHTML = '<span class="material-icons">more_vert</span>';

      const menuDropdown = document.createElement('div');
      menuDropdown.className = 'post-header-menu-dropdown';
      menuDropdown.setAttribute('hidden', 'hidden');

      if (this.onShare) {
        const shareItem = this.createMenuItem('share', 'Share', () => {
          this.closeActionsMenu();
          this.onShare();
        });
        menuDropdown.appendChild(shareItem);
      }

      if (this.canEdit && this.onEdit) {
        const editItem = this.createMenuItem('edit', 'Edit', () => {
          this.closeActionsMenu();
          this.onEdit();
        });
        menuDropdown.appendChild(editItem);
      }

      menuTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleActionsMenu();
      });

      menuRoot.appendChild(menuTrigger);
      menuRoot.appendChild(menuDropdown);
      dataro.appendChild(menuRoot);

      this.menuRoot = menuRoot;
      this.menuDropdown = menuDropdown;
    }

    // Add both containers to post meta
    postMeta.appendChild(avataro);
    postMeta.appendChild(dataro);

    postHeader.appendChild(postTitle);
    postHeader.appendChild(postMeta);
    
    this.element = postHeader;
    return postHeader;
  }
  
  parseMetadata(jsonMetadata) {
    try {
      if (typeof jsonMetadata === 'string') {
        return JSON.parse(jsonMetadata);
      }
      return jsonMetadata || {};
    } catch (e) {
      return {};
    }
  }

  createMenuItem(icon, label, onClick) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'post-header-menu-item';
    item.innerHTML = `<span class="material-icons">${icon}</span><span>${label}</span>`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return item;
  }

  toggleActionsMenu() {
    if (!this.menuDropdown) return;
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.menuDropdown.removeAttribute('hidden');
      document.addEventListener('click', this.handleDocumentClick);
      document.addEventListener('keydown', this.handleEscapeKey);
    } else {
      this.closeActionsMenu();
    }
  }

  closeActionsMenu() {
    this.menuOpen = false;
    if (this.menuDropdown) {
      this.menuDropdown.setAttribute('hidden', 'hidden');
    }
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  handleDocumentClick(event) {
    if (!this.menuRoot) return;
    if (!this.menuRoot.contains(event.target)) {
      this.closeActionsMenu();
    }
  }

  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      this.closeActionsMenu();
    }
  }
  
  unmount() {
    // Cleanup any event listeners if necessary
    this.closeActionsMenu();
    this.menuRoot = null;
    this.menuDropdown = null;
    this.element = null;
  }
}

export default PostHeader;
