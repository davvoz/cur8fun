import ContentRenderer from '../ContentRenderer.js';
import router from '../../utils/Router.js';

export default class CommentRenderer {
  constructor() {
    this.contentRenderer = new ContentRenderer({
      renderImages: true,
      imageClass: 'comment-content-image',
      containerClass: 'comment-markdown-content',
      maxImageWidth: 600
    });
  }

  renderComment(comment, container, options = {}) {
    // Support the legacy direct rendering method while also supporting the new card layout
    if (options.useCardLayout) {
      return this._renderCommentCard(comment, container);
    } else {
      if (!comment) {
        console.error('Cannot render comment: data is missing');
        return document.createElement('div');
      }

      const commentItem = document.createElement('div');
      commentItem.className = 'post-card comment-card';
      commentItem.dataset.commentId = `${comment.author}_${comment.permlink}`;

      commentItem.appendChild(this.createHeader(comment));
      commentItem.appendChild(this.createMainContent(comment, metadata || this.parseMetadata(comment.json_metadata)));
      
      // Add navigation handler
      this.addNavigationHandler(commentItem, comment);

      return commentItem;
    }
  }

  _renderCommentCard(comment, container) {
    // This is a simplified version that can be used by CommentUIManager
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item card-style';
    commentElement.dataset.author = comment.author;
    commentElement.dataset.permlink = comment.permlink;
    
    // Add basic content - actual rendering is handled by CommentUIManager
    commentElement.textContent = `Comment by @${comment.author}`;
    
    if (container) {
      container.appendChild(commentElement);
    }
    
    return commentElement;
  }

  createHeader(comment) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatarContainer = this.createAvatarContainer(comment);
    const info = this.createAuthorInfo(comment);
    
    header.append(avatarContainer, info);
    return header;
  }

  createAvatarContainer(comment) {
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';
    
    const avatar = document.createElement('img');
    avatar.alt = comment.author;
    avatar.className = 'avatar';
    avatar.loading = 'lazy';
    
    // Load avatar with retry mechanism
    this.loadAvatar(avatar, comment.author);
    
    avatarContainer.appendChild(avatar);
    return avatarContainer;
  }
  
  loadAvatar(avatar, username) {
    let retryCount = 0;
    
    const avatarSources = [
      `https://steemitimages.com/u/${username}/avatar`,
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
  }

  createAuthorInfo(comment) {
    const info = document.createElement('div');
    info.className = 'post-info';
    
    const author = document.createElement('div');
    author.className = 'post-author';
    author.textContent = `@${comment.author}`;
    
    const date = document.createElement('div');
    date.className = 'post-date';
    const commentDate = new Date(comment.created);
    date.textContent = commentDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    info.append(author, date);
    return info;
  }

  createMainContent(comment, metadata) {
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    const contentMiddle = this.createContentMiddle(comment, metadata);
    contentWrapper.appendChild(contentMiddle);
    
    // Add comment actions
    contentWrapper.appendChild(this.createCommentActions(comment));
    
    mainContent.appendChild(contentWrapper);
    return mainContent;
  }

  createContentMiddle(comment, metadata) {
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Add parent info
    this.addParentInfo(contentMiddle, comment);
    
    // Render comment title (excerpt)
    const excerptText = this.createExcerpt(comment.body || '', 60);
    const title = document.createElement('div');
    title.className = 'post-title';
    title.textContent = excerptText || 'Comment';
    contentMiddle.appendChild(title);
    
    // Render comment body with markdown
    const body = document.createElement('div');
    body.className = 'post-content';
    
    const renderedContent = this.contentRenderer.render({
      body: comment.body || '',
      title: ''
    });
    
    if (renderedContent && renderedContent.container) {
      body.appendChild(renderedContent.container);
    } else {
      const plainText = document.createElement('div');
      plainText.className = 'post-excerpt';
      plainText.textContent = this.createExcerpt(comment.body || '', 150);
      body.appendChild(plainText);
    }
    
    contentMiddle.appendChild(body);
    
    // Add tags if available
    if (metadata && metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createTags(metadata.tags.slice(0, 2)));
    }
    
    return contentMiddle;
  }

  addParentInfo(container, comment) {
    const parentInfo = document.createElement('div');
    parentInfo.className = 'comment-parent-info';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'reply';
    parentInfo.appendChild(icon);
    
    const infoText = document.createElement('span');
    infoText.className = 'parent-info-text';
    
    if (comment.parent_author) {
      infoText.textContent = `Risposta a @${comment.parent_author}`;
      
      parentInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        router.navigate(`/@${comment.parent_author}/${comment.parent_permlink}`);
      });
      
      parentInfo.classList.add('clickable');
    } else {
      infoText.textContent = 'Risposta a post';
    }
    
    parentInfo.appendChild(infoText);
    container.appendChild(parentInfo);
  }

  createCommentActions(comment) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const voteCount = this.getVoteCount(comment);
    const voteAction = this.createActionItem('thumb_up', voteCount);
    voteAction.classList.add('vote-action');
    
    actions.appendChild(voteAction);
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
  
  createTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';
    
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'post-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
    
    return tagsContainer;
  }

  addNavigationHandler(element, comment) {
    if (comment.author && comment.permlink) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Se il commento ha un parent_author, naviga al post padre
        // altrimenti naviga alla vista commento
        let url;
        if (comment.parent_author && comment.parent_permlink) {
          // Verifica se il parent è un post (nessun parent_author) o un commento
          if (comment.parent_author && comment.parent_permlink) {
            // Naviga al post padre
            url = `/@${comment.parent_author}/${comment.parent_permlink}`;
          }
        } else {
          // Naviga alla vista commento
          url = `/comment/@${comment.author}/${comment.permlink}`;
        }
        
        router.navigate(url);
      });
    }
  }

  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
        .replace(/<a.*?href=["'](.+?)["'].*?>(.+?)<\/a>/gi, '$2')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2')
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/>\s*(.*?)(\n|$)/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        .replace(/~~~[\s\S]*?~~~/g, '')
        .replace(/\n\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }
  
  getVoteCount(comment) {
    if (typeof comment.net_votes === 'number') {
      return comment.net_votes;
    }
    if (typeof comment.active_votes === 'object' && Array.isArray(comment.active_votes)) {
      return comment.active_votes.length;
    }
    if (typeof comment.vote_count === 'number') {
      return comment.vote_count;
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
}
