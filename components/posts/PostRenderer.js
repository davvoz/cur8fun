import router from '../../utils/Router.js';
import { proxifyImage, getImageUrl } from '../../utils/ImageUtils.js';
import authService from '../../services/AuthService.js';
import profileService from '../../services/ProfileService.js';

export default class PostRenderer {
  constructor() {
    this.contentRenderer = null; // Optional SteemContentRenderer for extracting images
    this.avatarUrlCache = new Map();
    this.avatarPending = new Map();
  }

  async resolveAuthorAvatarUrl(author) {
    if (!author) return null;
    if (this.avatarUrlCache.has(author)) return this.avatarUrlCache.get(author);
    if (this.avatarPending.has(author)) return this.avatarPending.get(author);

    const pending = (async () => {
      try {
        const currentUser = authService.getCurrentUser?.();
        if (
          currentUser &&
          currentUser.username === author &&
          currentUser.avatar &&
          !currentUser.avatar.includes('steemitimages.com/u/')
        ) {
          return proxifyImage(currentUser.avatar, 256);
        }

        const forceRefresh = !!(currentUser && currentUser.username === author);
        const profile = await profileService.getProfile(author, forceRefresh);
        const rawAvatar = profile?.profileImage || profile?.profile?.profile_image || null;
        if (!rawAvatar) return null;

        return rawAvatar.includes('steemitimages.com/u/')
          ? rawAvatar
          : proxifyImage(rawAvatar, 256);
      } catch (_) {
        return null;
      } finally {
        this.avatarPending.delete(author);
      }
    })();

    this.avatarPending.set(author, pending);
    const resolved = await pending;
    if (resolved) this.avatarUrlCache.set(author, resolved);
    return resolved;
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

    // Immagine (null se il post non ha immagini — evita spazio vuoto)
    const postImageEl = this.createPostImage(imageUrl, post.title);
    if (postImageEl) {
      mainContent.appendChild(postImageEl);
    } else {
      postItem.classList.add('no-image');
    }

    // Contenuto testuale (100px)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';

    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';

    contentMiddle.appendChild(this.createPostTitle(post.title));

    if (post.body) {
      const excerpt = document.createElement('div');
      excerpt.className = 'post-excerpt';
      const textExcerpt = this.createExcerpt(post.body, 200);
      excerpt.textContent = textExcerpt.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
      contentMiddle.appendChild(excerpt);
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

    const loadAvatar = () => {
      const steemitAvatar = `https://steemitimages.com/u/${post.author}/avatar`;
      const avatarSources = [
        steemitAvatar,
        `https://images.hive.blog/u/${post.author}/avatar`
      ];

      let currentSourceIndex = 0;

      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          avatar.src = steemitAvatar;
          return;
        }

        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;

        avatar.onerror = () => {
          setTimeout(tryNextSource, 300);
        };

        avatar.src = currentSource;
      };

      tryNextSource();
    };

    loadAvatar();

    // Upgrade to the real profile_image URL when available.
    this.resolveAuthorAvatarUrl(post.author).then((resolvedAvatar) => {
      if (!resolvedAvatar || !avatar.isConnected) return;
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = `https://steemitimages.com/u/${post.author}/avatar`;
      };
      avatar.src = resolvedAvatar;
    });

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
    // Return null when there is no image — callers must check to avoid empty space
    if (!imageUrl || imageUrl === './assets/img/placeholder.png') return null;

    const content = document.createElement('div');
    content.className = 'post-image-container';
    content.classList.add('loading');

    const image = document.createElement('img');
    image.alt = title || 'Post image';
    image.loading = 'lazy';
    image.decoding = 'async';

    imageUrl = this.sanitizeImageUrl(imageUrl);

    const attempts = imageUrl.includes('steemitimages.com/p/')
      ? [() => imageUrl]
      : [
          () => getImageUrl(imageUrl, 640),
          () => proxifyImage(imageUrl, 640),
        ];
    let attemptIndex = 0;
    let failed = false;

    const tryNext = () => {
      if (failed) return;
      if (attemptIndex >= attempts.length) { showError(); return; }
      loadImage(attempts[attemptIndex++]());
    };

    const loadImage = (url) => {
      if (failed) return;
      image.onload = () => {
        content.classList.remove('loading', 'error');
        content.classList.add('loaded');
      };
      image.onerror = () => tryNext();
      image.src = url;
    };

    const showError = () => {
      if (failed) return;
      failed = true;
      content.classList.remove('loading');
      content.classList.add('error');
      image.src = './assets/img/placeholder.png';
    };

    tryNext();

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
    // 1. metadata.image[] — most reliable
    if (metadata && metadata.image && metadata.image.length > 0) {
      const img = metadata.image[0];
      if (img && typeof img === 'string' && img.startsWith('http')) return img;
    }

    // 2. SteemContentRenderer rendered HTML string — handles any host, bare URLs, etc.
    if (this.contentRenderer && this.contentRenderer.steemRenderer) {
      try {
        const html = this.contentRenderer.steemRenderer.render(
          (post.body || '').substring(0, 3000)
        );
        const srcMatch = html.match(/src=["'](https?:\/\/[^"'\s]+)["']/i);
        if (srcMatch) return srcMatch[1];
      } catch (e) { /* ignore */ }
    }

    // 3. Regex scan of raw body (fallback when renderer isn't ready).
    if (post.body) {
      const mdMatch = post.body.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/);
      if (mdMatch) return mdMatch[1];

      const htmlMatch = post.body.match(/<img[^>]+src=["'](https?:\/\/[^"'\s]+)["']/i);
      if (htmlMatch) return htmlMatch[1];

      const extMatch = post.body.match(
        /https?:\/\/[^\s'"<>)]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s'"<>)]+)?/i
      );
      if (extMatch) return extMatch[0];
    }

    return null;
  }

  sanitizeImageUrl(url) {
    if (!url) return '';

    // Unwrap legacy proxy URLs recursively (handles double-wrapped URLs, e.g.
    // steemitimages.com/0x0/https://imgp.blurt.blog/768x0/https://cdn.steemitimages.com/...)
    let unwrapped = url;
    let prev;
    do {
      prev = unwrapped;
      const m = unwrapped.match(/^https?:\/\/[^/]+\/\d+x\d+\/(https?:\/\/.+)$/i);
      if (m) unwrapped = m[1];
    } while (unwrapped !== prev);
    url = unwrapped;

    // Query params are preserved — they may be required (CDN signing, hmac, etc.).
    return url;
  }

  getImageSizesToTry( layout) {
    switch(layout) {
      case 'list':
        return [
          {direct: true},
          {size: 800},
          {size: 640},
        ];
      case 'compact':
        return [
          {direct: true},
          {size: 320},
        ];
      case 'grid':
      default:
        return [
          {direct: true},
          {size: 640},
          {size: 400},
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
