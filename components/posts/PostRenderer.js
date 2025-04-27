import router from '../../utils/Router.js';

export default class PostRenderer {
  constructor() {
    this.contentRenderer = null; // Optional SteemContentRenderer for extracting images
  }

  renderPost(post) {
    if (!post) {
      console.error('Cannot create post item: post data is missing');
      return document.createElement('div');
    }

    const postItem = document.createElement('div');
    postItem.className = 'post-card';
    postItem.dataset.postId = `${post.author}_${post.permlink}`;

    const metadata = this.parseMetadata(post.json_metadata);
    const imageUrl = this.getBestImage(post, metadata);

    // Header (60px)
    postItem.appendChild(this.createPostHeader(post));

    // Body (Main content - 300px)
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';

    // Immagine (200px)
    mainContent.appendChild(this.createPostImage(imageUrl, post.title));

    // Contenuto testuale (100px)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';

    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';

    contentMiddle.appendChild(this.createPostTitle(post.title));

    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body);
      excerpt.textContent ='dioporco'+ textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
    }

    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }

    contentWrapper.appendChild(contentMiddle);
    mainContent.appendChild(contentWrapper);
    postItem.appendChild(mainContent);
    
    // Footer (40px) - Separato dal main content per garantire la visibilità
    const actions = this.createPostActions(post);
    postItem.appendChild(actions);

    this.addPostNavigationHandler(postItem, post);

    return postItem;
  }
  
  createExcerpt(text, maxLength = 150) {
    if (!text) return '';
    let excerpt = text
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove Markdown images
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove Markdown links
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Replace multiple spaces with one
      .trim();
      
    if (excerpt.length > maxLength) {
      excerpt = excerpt.substring(0, maxLength) + '...';
    }
    
    return excerpt;
  }

  createPostHeader(post) {
    const header = document.createElement('div');
    header.className = 'post-header';

    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';

    const avatar = document.createElement('img');
    avatar.alt = post.author;
    avatar.className = 'avatar';
    avatar.loading = 'lazy';

    let retryCount = 0;

    const loadAvatar = () => {
      const avatarSources = [
        `https://steemitimages.com/u/${post.author}/avatar`,
        `https://images.hive.blog/u/${post.author}/avatar`
      ];

      let currentSourceIndex = 0;

      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          avatar.src = './assets/img/default-avatar.png';
          return;
        }

        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;

        avatar.onerror = () => {
          setTimeout(tryNextSource, 300);
        };

        if (retryCount > 0 && !currentSource.includes('default-avatar')) {
          avatar.src = `${currentSource}?retry=${Date.now()}`;
        } else {
          avatar.src = currentSource;
        }
      };

      tryNextSource();
    };

    loadAvatar();

    avatarContainer.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'post-info';

    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${post.author}`;

    const date = document.createElement('div');
    date.className = 'post-date';
    const postDate = new Date(post.created);
    date.textContent = postDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    info.append(author, date);
    header.append(avatarContainer, info);

    return header;
  }

  createPostImage(imageUrl, title) {
    const content = document.createElement('div');
    content.className = 'post-image-container';
    content.classList.add('loading');

    const image = document.createElement('img');
    image.alt = title || 'Post image';
    image.loading = 'lazy';
    image.decoding = 'async';

    if (!imageUrl || imageUrl === './assets/img/placeholder.png') {
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
      content.appendChild(image);
      return content;
    }

    imageUrl = this.sanitizeImageUrl(imageUrl);

    const cardSize = 'medium'; // Default size
    const layout = 'grid'; // Default layout
    const sizesToTry = this.getImageSizesToTry( layout);

    let currentSizeIndex = 0;
    let isLoadingPlaceholder = false;

    const loadNextSize = () => {
      if (currentSizeIndex >= sizesToTry.length || isLoadingPlaceholder) {
        loadPlaceholder();
        return;
      }

      const sizeOption = sizesToTry[currentSizeIndex++];
      let url;

      if (sizeOption.direct) {
        url = imageUrl;
      } else {
        url = `https://${sizeOption.cdn}/${sizeOption.size}x0/${imageUrl}`;
      }

      loadImage(url);
    };

    const loadImage = (url) => {
      if (isLoadingPlaceholder) return;

      const timeoutId = setTimeout(() => {
        if (!image.complete) {
          tryNextOption("Timeout");
        }
      }, 5000);

      image.onload = () => {
        clearTimeout(timeoutId);
        content.classList.remove('loading', 'error');
        content.classList.add('loaded');
      };

      image.onerror = () => {
        clearTimeout(timeoutId);
        tryNextOption("Failed to load");
      };

      image.src = url;
    };

    const tryNextOption = () => {
      if (isLoadingPlaceholder) return;
      loadNextSize();
    };

    const loadPlaceholder = () => {
      if (isLoadingPlaceholder) return;

      isLoadingPlaceholder = true;
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
    };

    loadNextSize();

    content.appendChild(image);
    return content;
  }

  createPostTitle(title) {
    const element = document.createElement('div');
    element.className = 'post-title';
    element.textContent = title || '(Untitled)';
    return element;
  }

  createPostTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';

    const displayTags = tags.slice(0, 2);

    displayTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'post-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });

    return tagsContainer;
  }

  createPostActions(post) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const voteCount = this.getVoteCount(post);
    const voteAction = this.createActionItem('thumb_up', voteCount);
    voteAction.classList.add('vote-action');

    const commentAction = this.createActionItem('chat', post.children || 0);
    commentAction.classList.add('comment-action');

    const payoutAction = this.createActionItem('attach_money', parseFloat(post.pending_payout_value || 0).toFixed(2));
    payoutAction.classList.add('payout-action');

    actions.append(voteAction, commentAction, payoutAction);

    return actions;
  }

  createActionItem(iconName, text) {
    const actionItem = document.createElement('div');
    actionItem.className = 'action-item';

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;

    actionItem.appendChild(icon);
    actionItem.append(document.createTextNode(` ${text}`));

    return actionItem;
  }

  getBestImage(post, metadata) {
    if (this.contentRenderer) {
      try {
        const renderedContent = this.contentRenderer.render({
          body: post.body.substring(0, 1500)
        });

        if (renderedContent.images && renderedContent.images.length > 0) {
          return renderedContent.images[0].src;
        }
      } catch (error) {
        console.error('Error using SteemContentRenderer for image extraction:', error);
      }
    }

    if (metadata && metadata.image && metadata.image.length > 0) {
      return metadata.image[0];
    }

    const previewImageUrl = this.getPreviewImage(post);
    if (previewImageUrl) {
      return previewImageUrl;
    }

    const imgRegex = /https?:\/\/[^\s'"<>]+?\.(jpg|jpeg|png|gif|webp)(\?[^\s'"<>]+)?/i;
    const match = post.body.match(imgRegex);
    if (match) {
      return match[0];
    }

    return './assets/img/placeholder.png';
  }

  sanitizeImageUrl(url) {
    if (!url) return '';

    let cleanUrl = url.split('?')[0].split('#')[0];

    try {
      cleanUrl = new URL(cleanUrl).href;
    } catch (e) {
      return url;
    }

    return cleanUrl;
  }

  getImageSizesToTry( layout) {
    switch(layout) {
      case 'list':
        return [
          {size: 800, cdn: 'steemitimages.com'},
          {size: 640, cdn: 'steemitimages.com'},
          {size: 400, cdn: 'steemitimages.com'},
          {direct: true}
        ];
      case 'compact':
        return [
          {size: 320, cdn: 'steemitimages.com'},
          {size: 200, cdn: 'steemitimages.com'},
          {direct: true}
        ];
      case 'grid':
      default:
        return [
          {size: 640, cdn: 'steemitimages.com'},
          {size: 400, cdn: 'steemitimages.com'},
          {size: 200, cdn: 'steemitimages.com'},
          {direct: true}
        ];
    }
  }

  addPostNavigationHandler(element, post) {
    if (post.author && post.permlink) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(`/@${post.author}/${post.permlink}`);
      });
    }
  }
  
  getVoteCount(post) {
    if (typeof post.net_votes === 'number') {
      return post.net_votes;
    }
    if (typeof post.active_votes === 'object' && Array.isArray(post.active_votes)) {
      return post.active_votes.length;
    }
    if (typeof post.vote_count === 'number') {
      return post.vote_count;
    }
    return 0;
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

  getPreviewImage(post) {
    const metadata = this.parseMetadata(post.json_metadata);
    const imageUrl = metadata?.image?.[0];
    const body = post.body || '';
    const regex = /!\[.*?\]\((.*?)\)/;
    const match = body.match(regex);
    const imageUrlFromBody = match ? match[1] : null;
    return imageUrl || imageUrlFromBody;
  }
}
