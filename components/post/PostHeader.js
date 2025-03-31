import router from '../../utils/Router.js';

class PostHeader {
  constructor(post, renderCommunityCallback) {
    this.post = post;
    this.renderCommunityCallback = renderCommunityCallback;
    this.element = null;
  }

  render() {
    const postHeader = document.createElement('div');
    postHeader.className = 'post-headero';

    const postTitle = document.createElement('h1');
    postTitle.className = 'post-title';
    postTitle.textContent = this.post.title || 'Comment';

    //se title è Comment creimo un link al post originale
    if (postTitle.textContent === 'Comment') {
      //estraiamo il permalink dal json_metadata
      const metadata = this.parseMetadata(this.post.json_metadata);
      //cerchiamo l'autor del post originale
      const originalAuthor = metadata?.original_author || this.post.parent_author;
      //ora costruiamo la destination
      const destination =   '/@' + originalAuthor + '/' + this.post.parent_permlink;
      //creiamo il link
      const postLink = document.createElement('a');
      postLink.href = "javascript:void(0)";
      postLink.className = 'post-link';
      postLink.textContent = "vedi post originale";
      postLink.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(destination);
      });
      postTitle.textContent = '';
      postTitle.appendChild(postLink);

      postLink.appendChild(document.createTextNode(' '));
      const icon = document.createElement('i');
      icon.className = 'fa fa-link';
      icon.style.fontSize = '0.8em';
      icon.style.color = '#999';
      icon.style.marginLeft = '5px';
      icon.style.verticalAlign = 'middle';
      postLink.appendChild(icon);
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

    // Community handling
    const metadata = this.parseMetadata(this.post.json_metadata);
    const community = metadata?.community || this.post.category || null;

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
    postDate.textContent = new Date(this.post.created).toLocaleString();

    dataro.appendChild(postDate);

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
  
  unmount() {
    // Cleanup any event listeners if necessary
    this.element = null;
  }
}

export default PostHeader;
