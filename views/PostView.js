import View from './View.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js'; 
import ContentRenderer from '../components/ContentRenderer.js';
import steemService from '../services/SteemService.js'; 
import communityService from '../services/CommunityService.js';
import authService from '../services/AuthService.js';

// Import components
import PostHeader from '../components/post/PostHeader.js';
import PostContent from '../components/post/PostContent.js';
import PostActions from '../components/post/PostActions.js';
import PostTags from '../components/post/PostTags.js';
import CommentsSection from '../components/post/CommentsSection.js';

// Import controllers and helpers
import VoteController from '../controllers/VoteController.js';
import CommentController from '../controllers/CommentController.js';

class PostView extends View {
  constructor(params = {}) {
    super(params);
    this.steemService = steemService;
    this.post = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.comments = [];
    this.element = null;
    this.loadingIndicator = new LoadingIndicator('spinner');
    

    this.postContent = null;
    this.errorMessage = null;
    this.commentsContainer = null;
    
    // Component instances
    this.postHeaderComponent = null;
    this.postContentComponent = null;
    this.postActionsComponent = null;
    this.postTagsComponent = null;
    this.commentsSectionComponent = null;
    
    // Controllers
    this.voteController = new VoteController(this);
    this.commentController = new CommentController(this);

    // Content renderer for post body
    this.initializeContentRenderer();
  }

  async initializeContentRenderer() {
    try {
      await this.ensureSteemRendererLoaded();
      this.contentRenderer = new ContentRenderer({
        containerClass: 'post-content-body',
        imageClass: 'post-image',
        imagePosition: 'top',
        useProcessBody: false,
        useSteemContentRenderer: true,
        maxImageWidth: 800,
        enableYouTube: true
      });
    } catch (err) {
      console.error('Failed to load SteemContentRenderer:', err);
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: false
      });
    }
  }

  async ensureSteemRendererLoaded() {
    if (typeof SteemContentRenderer === 'undefined') {
      try {
        await ContentRenderer.loadSteemContentRenderer();
      } catch (error) {
        console.error('Error loading SteemContentRenderer:', error);
        throw error;
      }
    }
    return SteemContentRenderer;
  }

  async render(element) {
    this.element = element;

    if (!this.element) {
      console.error('No element provided to PostView.render()');
      return;
    }

    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    this.createPostViewStructure();
    await this.loadPost();
  }

  createPostViewStructure() {
    const postView = document.createElement('div');
    postView.className = 'post-view';

    // Post content container
    this.postContent = document.createElement('div');
    this.postContent.className = 'post-content';
    this.postContent.style.display = 'none';

    // Error message
    this.errorMessage = document.createElement('div');
    this.errorMessage.className = 'error-message';
    this.errorMessage.style.display = 'none';

    // Comments section
    this.commentsContainer = document.createElement('div');
    this.commentsContainer.className = 'comments-section';

    // Append all elements
    postView.appendChild(this.postContent);
    postView.appendChild(this.errorMessage);
    postView.appendChild(this.commentsContainer);

    this.element.appendChild(postView);
  }

  async loadPost() {
    if (this.isLoading) return;
    this.isLoading = true;

    this.postContent.style.display = 'none';
    this.errorMessage.style.display = 'none';

    try {
      const { author, permlink } = this.params;

      this.loadingIndicator.updateProgress(20);

      const [post, replies] = await Promise.all([
        this.steemService.getContent(author, permlink),
        this.steemService.getContentReplies(author, permlink)
      ]);

      this.loadingIndicator.updateProgress(80);

      if (!post || post.id === 0) {
        throw new Error('not_found');
      }

      this.post = post;
      this.comments = replies || [];

      this.loadingIndicator.updateProgress(100);

      // Add Open Graph meta tags for better sharing preview
      this.updateOpenGraphMetaTags();

      this.initComponents();
      await this.renderComponents(); // Make this call await
      await this.voteController.checkVoteStatus(this.post);
    } catch (error) {
      console.error('Failed to load post:', error);

      if (error.message === 'not_found') {
        this.renderNotFoundError();
      } else {
        this.errorMessage.textContent = `Failed to load post: ${error.message || 'Failed to load post. Please try again later.'}`;
        this.errorMessage.style.display = 'block';
      }
    } finally {
      this.isLoading = false;
      this.loadingIndicator.hide();
    }
  }

  /**
   * Adds or updates Open Graph meta tags in the document head
   * for better link preview when sharing
   */
  updateOpenGraphMetaTags() {
    if (!this.post) return;
    
    // Update the dynamic meta container with current post info
    const metaContainer = document.getElementById('dynamic-meta-container');
    if (metaContainer) {
      metaContainer.setAttribute('data-post-id', `${this.post.id || ''}`);
      metaContainer.setAttribute('data-author', this.post.author || '');
      metaContainer.setAttribute('data-permlink', this.post.permlink || '');
    }
    
    // Helper function to update meta tags by ID and property/name
    const updateMetaTag = (id, attributeType, attributeName, content) => {
      // Try to get by ID first (our custom meta tags)
      let metaTag = document.getElementById(id);
      
      // If not found by ID, try to find by property/name attribute
      if (!metaTag) {
        metaTag = document.querySelector(`meta[${attributeType}="${attributeName}"]`);
      }
      
      // If still not found, create a new one
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute(attributeType, attributeName);
        if (id) {
          metaTag.id = id;
        }
        document.head.appendChild(metaTag);
      }
      
      // Set the content
      metaTag.setAttribute('content', content);
    };
    
    // Get the canonical URL for this post
    const canonicalUrl = this.getCanonicalUrl();
    
    // Create description from post body (strip markdown and limit length)
    const description = this.stripMarkdown(this.post.body).substring(0, 160) + '...';
    
    // Get image URL from post body or metadata with multiple fallback options
    const imageUrl = this.getPostImageUrl();
    
    // Basic Open Graph meta tags
    updateMetaTag('og-title', 'property', 'og:title', this.post.title || 'STEEM Post');
    updateMetaTag('og-type', 'property', 'og:type', 'article');
    updateMetaTag('og-url', 'property', 'og:url', canonicalUrl);
    updateMetaTag('og-desc', 'property', 'og:description', description);
    
    // Image (only add if we have a valid URL)
    if (imageUrl) {
      updateMetaTag('og-image', 'property', 'og:image', imageUrl);
      console.log('Setting og:image to:', imageUrl);
    }
    
    // Additional Open Graph meta tags
    updateMetaTag(null, 'property', 'og:site_name', 'STEEM Social Network');
    updateMetaTag(null, 'property', 'og:article:published_time', this.post.created);
    updateMetaTag(null, 'property', 'og:article:author', this.post.author);
    updateMetaTag(null, 'property', 'og:article:section', this.post.category || '');
    
    // Twitter Card meta tags
    updateMetaTag('twitter-card', 'name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary');
    updateMetaTag('twitter-title', 'name', 'twitter:title', this.post.title || 'STEEM Post');
    updateMetaTag('twitter-desc', 'name', 'twitter:description', description);
    
    // Set Twitter image only if we have a valid URL
    if (imageUrl) {
      updateMetaTag('twitter-image', 'name', 'twitter:image', imageUrl);
      console.log('Setting twitter:image to:', imageUrl);
    }
    
    // Add canonical link element for better SEO
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
    
    // Update document title as well for better browser history/bookmarks
    document.title = `${this.post.title} - STEEM Social Network`;
  }
  
  /**
   * Get the canonical URL for this post
   * @returns {string} The canonical URL
   */
  getCanonicalUrl() {
    const baseUrl = window.location.origin;
    const path = `/@${this.post.author}/${this.post.permlink}`;
    
    // Handle hash-based routing properly
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
      return `${baseUrl}/#${path}`;
    }
    
    return `${baseUrl}${path}`;
  }

  /**
   * Extracts the first image URL from post body or metadata
   * @returns {string|null} Image URL or null if no image found
   */
  getPostImageUrl() {
    if (!this.post) return null;
    
    try {
      // First check json_metadata for image
      const metadata = this.parseMetadata(this.post.json_metadata);
      
      // Check if there's an explicit image property or images array in metadata
      if (metadata && metadata.image && metadata.image.length > 0) {
        const imageUrl = this.sanitizeImageUrl(metadata.image[0]);
        if (imageUrl) return this.ensureAbsoluteUrl(imageUrl);
      }
      
      // Try to find image inside SteemContentRenderer extracted images
      if (this.contentRenderer) {
        try {
          const renderedContent = this.contentRenderer.render({
            body: this.post.body.substring(0, 1500) // Only render the first part for performance
          });
          
          // Check if any images were extracted
          if (renderedContent && renderedContent.images && renderedContent.images.length > 0) {
            const imageUrl = this.sanitizeImageUrl(renderedContent.images[0].src);
            if (imageUrl) return this.ensureAbsoluteUrl(imageUrl);
          }
        } catch (error) {
          console.error('Error using content renderer for image extraction:', error);
        }
      }
      
      // Fallback to searching the post body for images
      // Markdown image syntax: ![alt text](image-url)
      const imgRegex = /!\[.*?\]\((.*?)\)/;
      const imgMatch = this.post.body.match(imgRegex);
      if (imgMatch && imgMatch[1]) {
        const imageUrl = this.sanitizeImageUrl(imgMatch[1]);
        if (imageUrl) return this.ensureAbsoluteUrl(imageUrl);
      }
      
      // Alternative method to find HTML img tags
      const htmlImgRegex = /<img.*?src=["'](.*?)["']/;
      const htmlImgMatch = this.post.body.match(htmlImgRegex);
      if (htmlImgMatch && htmlImgMatch[1]) {
        const imageUrl = this.sanitizeImageUrl(htmlImgMatch[1]);
        if (imageUrl) return this.ensureAbsoluteUrl(imageUrl);
      }
      
      // Check for any URL that ends with common image extensions
      const urlRegex = /https?:\/\/[^\s"'<>]+?\.(jpe?g|png|gif|webp)(\?[^\s"'<>]+)?/i;
      const urlMatch = this.post.body.match(urlRegex);
      if (urlMatch && urlMatch[0]) {
        const imageUrl = this.sanitizeImageUrl(urlMatch[0]);
        if (imageUrl) return imageUrl; // Already absolute
      }
      
      // Last resort: if no image is found but the post has a thumbnail reference, try to use it
      if (metadata && metadata.thumbnail) {
        const thumbnailUrl = this.sanitizeImageUrl(metadata.thumbnail);
        if (thumbnailUrl) return this.ensureAbsoluteUrl(thumbnailUrl);
      }
      
      // As a fallback, if no image is found in the post, try to get the author's avatar
      // But use a larger size for better sharing display
      if (this.post.author) {
        return `https://steemitimages.com/u/${this.post.author}/avatar/large`;
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting post image URL:', error);
      return null;
    }
  }
  
  /**
   * Sanitizes an image URL by removing unsafe parts and checking for validity
   * @param {string} url - The image URL to sanitize
   * @returns {string|null} - The sanitized URL or null if invalid
   */
  sanitizeImageUrl(url) {
    if (!url) return null;
    
    try {
      // Remove query parameters and fragments, but keep those that might be needed for some image services
      let cleanUrl = url.trim();
      
      // If URL contains query parameters that look like Steem/Hive proxy params, keep them
      if (!url.includes('steemitimages.com') && !url.includes('images.hive.blog')) {
        cleanUrl = url.split('?')[0].split('#')[0].trim();
      }
      
      // Check for common image extensions
      const hasImageExtension = /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(cleanUrl);
      
      // If it doesn't have an image extension but seems to be from an image service, accept it
      const isImageService = /steemitimages\.com|hivebuzz\.me|images\.hive\.blog|ipfs|imgur|cloudinary|googleusercontent|giphy|unsplash/i.test(cleanUrl);
      
      if (!hasImageExtension && !isImageService) {
        // If it's not obviously an image URL, check for potential proxy URLs or image paths
        if (!/\/ipfs\/|\/image\/|\/photos\/|\/images\/|\/img\/|\/media\/|\/content\/|\/uploads\//i.test(cleanUrl)) {
          // It's not obviously an image URL, but we'll try to use it anyway
          console.log('URL might not be an image, but will try:', cleanUrl);
        }
      }
      
      // Make sure URL is properly formed
      try {
        // For absolute URLs, use the URL constructor
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
          cleanUrl = new URL(cleanUrl).href;
        } else if (cleanUrl.startsWith('//')) {
          // For protocol-relative URLs
          cleanUrl = `https:${cleanUrl}`;
        }
        // Relative URLs will be handled by ensureAbsoluteUrl
      } catch (e) {
        // URL parsing failed, but we'll still try to use it
        console.log('URL parsing failed for:', cleanUrl);
      }
      
      return cleanUrl;
    } catch (e) {
      console.error('Error sanitizing image URL:', e);
      return url; // Return the original URL as a fallback
    }
  }

  /**
   * Ensures that a URL is absolute
   * @param {string} url - The URL to process
   * @returns {string} The absolute URL
   */
  ensureAbsoluteUrl(url) {
    if (!url) return null;
    
    try {
      // If the URL is already absolute, return it
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Handle protocol-relative URLs
      if (url.startsWith('//')) {
        return `https:${url}`;
      }
      
      // For IPFS URLs
      if (url.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${url.slice(7)}`;
      }
      
      // Handle Steem/Hive specific formats
      if (url.startsWith('@')) {
        return `https://steemitimages.com/u/${url.slice(1)}/avatar/large`;
      }
      
      // For URLs that start with a slash, prepend with Steem's image proxy
      if (url.startsWith('/')) {
        // Remove the leading slash to avoid double slashes in the final URL
        const urlWithoutLeadingSlash = url.startsWith('/') ? url.slice(1) : url;
        return `https://steemitimages.com/800x0/${urlWithoutLeadingSlash}`;
      }
      
      // For all other relative URLs, use Steem's image proxy with maximum size for better social sharing
      return `https://steemitimages.com/800x0/${url}`;
    } catch (e) {
      console.error('Error ensuring absolute URL:', e, url);
      // In case of error, try to make a best effort to return something useful
      if (url.includes('://')) {
        return url; // Return as is if it has a protocol
      } else {
        return `https://steemitimages.com/800x0/${url}`; // Use Steem proxy as fallback
      }
    }
  }

  initComponents() {
    if (!this.post) return;
    
    const communityTag = this.getCommunityTag();
    
    this.postHeaderComponent = new PostHeader(
      this.post,
      (community) => this.renderCommunityBadge(community)
    );
    
    this.postContentComponent = new PostContent(
      this.post, 
      this.contentRenderer
    );
    
    // Pass canEditPost() result to PostActions component
    this.postActionsComponent = new PostActions(
      this.post,
      () => this.voteController.handlePostVote(this.post),       
      () => this.commentController.handleNewComment(this.post),  
      () => this.handleShare(),
      () => this.handleEdit(),
      this.canEditPost()                                  
    );
    
    this.postTagsComponent = new PostTags(
      this.getPostTags() // Questa ora filtrerà correttamente il tag community
    );
    
    this.commentsSectionComponent = new CommentsSection(
      this.comments,
      this.post,
      (comment, text) => this.commentController.handleReply(comment, text),
      (commentEl, voteBtn) => this.voteController.handleCommentVote(commentEl, voteBtn),
      this.contentRenderer
    );
    
    // Se abbiamo un tag community valido, passiamolo a PostHeaderComponent
    if (communityTag) {
      this.postHeaderComponent.setCommunity(communityTag);
    }
  }

  /**
   * Handle edit button click
   * Redirects the user to the edit page
   */
  handleEdit() {
    const { author, permlink } = this.post;
    router.navigate(`/edit/@${author}/${permlink}`);
  }

  /**
   * Check if current user can edit the post
   * @returns {boolean} true if user is the author
   */
  canEditPost() {
    const currentUser = authService.getCurrentUser();
    return currentUser && currentUser.username === this.post.author;
  }

  // Update this method to be async and handle asynchronous component rendering
  async renderComponents() {
    if (!this.post) return;
    
    while (this.postContent.firstChild) {
      this.postContent.removeChild(this.postContent.firstChild);
    }

    try {
      // Synchronous components
      this.postContent.appendChild(this.postHeaderComponent.render());
      this.postContent.appendChild(this.postContentComponent.render());
      this.postContent.appendChild(this.postActionsComponent.render());
      this.postContent.appendChild(this.postTagsComponent.render());
      
      // Handle CommentsSection separately since it's async
      const commentsElement = await this.commentsSectionComponent.render();
      
      // Make sure what we're appending is actually a DOM node
      if (commentsElement && commentsElement.nodeType === Node.ELEMENT_NODE) {
        this.postContent.appendChild(commentsElement);
      } else {
        console.error('Comments section did not return a valid DOM element:', commentsElement);
        // Create a fallback element
        const fallbackComments = document.createElement('div');
        fallbackComments.className = 'comments-fallback';
        fallbackComments.textContent = 'Comments could not be loaded';
        this.postContent.appendChild(fallbackComments);
      }

      this.postContent.style.display = 'block';
    } catch (error) {
      console.error('Error rendering components:', error);
      // Handle rendering error
      const errorMessage = document.createElement('div');
      errorMessage.className = 'component-render-error';
      errorMessage.textContent = 'Could not display post components';
      this.postContent.appendChild(errorMessage);
      this.postContent.style.display = 'block';
    }
  }

  renderNotFoundError() {
    while (this.errorMessage.firstChild) {
      this.errorMessage.removeChild(this.errorMessage.firstChild);
    }

    this.errorMessage.className = 'error-message not-found-error';

    const errorContainer = document.createElement('div');
    errorContainer.className = 'not-found-container';

    const errorCode = document.createElement('h1');
    errorCode.className = 'error-code';
    errorCode.textContent = '404';

    const errorHeading = document.createElement('h2');
    errorHeading.textContent = 'Post Not Found';

    const errorDesc = document.createElement('p');
    errorDesc.className = 'error-description';
    errorDesc.textContent = `We couldn't find the post at @${this.params.author}/${this.params.permlink}`;

    const homeButton = document.createElement('button');
    homeButton.className = 'back-to-home-btn';
    homeButton.textContent = 'Back to Home';
    homeButton.addEventListener('click', () => {
      router.navigate('/');
    });

    errorContainer.appendChild(errorCode);
    errorContainer.appendChild(errorHeading);
    errorContainer.appendChild(errorDesc);
    errorContainer.appendChild(homeButton);

    this.errorMessage.appendChild(errorContainer);
    this.errorMessage.style.display = 'block';
  }

  /**
   * Verifica se un tag rappresenta una community valida
   * @param {string} tag - Tag da verificare
   * @returns {boolean} - true se è una community valida
   */
  isValidCommunityTag(tag) {
    if (!tag || typeof tag !== 'string') return false;
    
    // La maggior parte delle community Hive hanno un formato hive-NUMERO
    if (tag.startsWith('hive-')) {
      // Estrai la parte dopo "hive-"
      const communityId = tag.substring(5);
      
      // Le community valide hanno generalmente ID numerico
      return /^\d+$/.test(communityId);
    }
    
    return false;
  }

  /**
   * Estrae il tag community dal post
   * @returns {string|null} - Tag community o null se non presente
   */
  getCommunityTag() {
    if (!this.post) return null;
    
    try {
      const metadata = this.parseMetadata(this.post.json_metadata);
      
      // Cerca nella proprietà community (più affidabile)
      if (metadata && metadata.community) {
        const communityTag = metadata.community.startsWith('hive-') 
          ? metadata.community 
          : `hive-${metadata.community}`;
          
        if (this.isValidCommunityTag(communityTag)) {
          return communityTag;
        }
      }
      
      // Come fallback, cerca nei tag
      if (metadata && Array.isArray(metadata.tags)) {
        const communityTag = metadata.tags.find(tag => 
          tag && typeof tag === 'string' && this.isValidCommunityTag(tag)
        );
        
        if (communityTag) {
          return communityTag;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting community tag:', error);
      return null;
    }
  }

  /**
   * Ottiene i tag del post, escludendo il tag community
   * @returns {Array} - Array di tag senza il tag community
   */
  getPostTags() {
    if (!this.post) return [];

    try {
      const metadata = this.parseMetadata(this.post.json_metadata);
      const communityTag = this.getCommunityTag();

      if (metadata && Array.isArray(metadata.tags)) {
        return metadata.tags
          .filter(tag => 
            typeof tag === 'string' && 
            tag.trim() !== '' && 
            (!communityTag || tag !== communityTag) // Escludi il tag community
          )
          .slice(0, 10);
      }

      if (this.post.category && typeof this.post.category === 'string' && 
          (!communityTag || this.post.category !== communityTag)) {
        return [this.post.category];
      }
    } catch (error) {
      console.error('Error extracting tags:', error);
    }

    return [];
  }

  handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: this.post.title,
        text: `Check out this post: ${this.post.title}`,
        url: url
      }).catch(err => console.error('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.emit('notification', {
          type: 'success',
          message: 'Link copied to clipboard'
        });
      }).catch(err => console.error('Could not copy link:', err));
    }
  }

  async renderCommunityBadge(community) {
    if (!community) return null;
    
    const baseDisplayName = this.getCommunityBaseDisplayName(community);
    const communitySlug = community.replace(/^hive-/, '');
    const container = this.createCommunityContainerStructure(baseDisplayName);
    
    const { communityContainer, communityIcon, communityInfo, loadingSpinner } = container;
    
    // Check if this is a valid community with a numeric ID
    if (!this.isValidCommunityTag(community)) {
      // Per non-valid communities, display as "blog" instead of hiding
      this.clearElement(communityInfo);
      
      const blogLabel = document.createElement('div');
      blogLabel.className = 'community-title';
      blogLabel.textContent = 'blog';
      
      communityInfo.appendChild(blogLabel);
      
      // Use blog icon instead of group
      communityIcon.textContent = 'rss_feed';
      
      return communityContainer;
    }
    
    try {
      // Show loading state
      communityIcon.style.display = 'none';
      communityContainer.insertBefore(loadingSpinner, communityInfo);
      
      const communityData = await communityService.findCommunityByName(community);
      
      // Remove loading spinner and show icon
      this.removeElementIfExists(loadingSpinner);
      communityIcon.style.display = 'inline-flex';
      
      this.updateCommunityDisplay(communityInfo, communityIcon, communityData, baseDisplayName, communitySlug, communityContainer);
    } catch (error) {
      // Handle error state
      this.removeElementIfExists(loadingSpinner);
      communityIcon.style.display = 'inline-flex';
      console.log('Error fetching community details:', error);
      
      this.renderSimpleCommunityLink(communityInfo, baseDisplayName, communitySlug);
    }
    
    return communityContainer;
  }
  
  getCommunityBaseDisplayName(community) {
    return community.startsWith('hive-') ? community : `hive-${community}`;
  }
  
  createCommunityContainerStructure(baseDisplayName) {
    const communityContainer = document.createElement('div');
    communityContainer.className = 'community-container';
    
    const communityIcon = document.createElement('span');
    communityIcon.className = 'material-icons community-icon';
    communityIcon.textContent = 'group';
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'community-loading-spinner';
    
    const communityInfo = document.createElement('div');
    communityInfo.className = 'community-info-container';
    
    const communityId = document.createElement('div');
    communityId.className = 'community-id';
    communityId.textContent = baseDisplayName;
    
    communityInfo.appendChild(communityId);
    communityContainer.appendChild(communityIcon);
    communityContainer.appendChild(communityInfo);
    
    return { communityContainer, communityIcon, communityInfo, loadingSpinner };
  }
  
  removeElementIfExists(element) {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  
  updateCommunityDisplay(infoContainer, iconElement, communityData, baseDisplayName, communitySlug, container) {
    this.clearElement(infoContainer);
    
    if (communityData) {
      this.renderDetailedCommunityInfo(
        infoContainer, 
        iconElement, 
        communityData, 
        baseDisplayName, 
        communitySlug, 
        container
      );
    } else {
      this.renderSimpleCommunityLink(infoContainer, baseDisplayName, communitySlug);
    }
  }
  
  renderDetailedCommunityInfo(infoContainer, iconElement, communityData, baseDisplayName, communitySlug, container) {
    const communityTitle = this.createLinkElement(
      communityData.title || baseDisplayName,
      'community-title'
    );
    
    const communityIdLink = this.createLinkElement(baseDisplayName, 'community-id');
    
    infoContainer.appendChild(communityTitle);
    infoContainer.appendChild(communityIdLink);
    
    const navigateHandler = this.createCommunityNavigationHandler(communitySlug);
    communityTitle.addEventListener('click', navigateHandler);
    communityIdLink.addEventListener('click', navigateHandler);
    
    if (communityData.about) {
      container.title = communityData.about;
    }
    
    if (communityData.avatar_url) {
      this.renderCommunityAvatar(iconElement, communityData);
    }
  }
  
  renderCommunityAvatar(iconElement, communityData) {
    iconElement.textContent = '';
    
    const avatarImg = document.createElement('img');
    avatarImg.src = communityData.avatar_url;
    avatarImg.alt = communityData.title || '';
    avatarImg.className = 'community-avatar-img';
    
    iconElement.appendChild(avatarImg);
  }
  
  renderSimpleCommunityLink(infoContainer, baseDisplayName, communitySlug) {
    this.clearElement(infoContainer);
    
    const communityIdLink = this.createLinkElement(baseDisplayName, 'community-id');
    infoContainer.appendChild(communityIdLink);
    
    const navigateHandler = this.createCommunityNavigationHandler(communitySlug);
    communityIdLink.addEventListener('click', navigateHandler);
  }
  
  createLinkElement(text, className) {
    const link = document.createElement('a');
    link.href = "javascript:void(0)";
    link.className = className;
    link.textContent = text;
    return link;
  }
  
  createCommunityNavigationHandler(communitySlug) {
    return (e) => {
      e.preventDefault();
      router.navigate(`/community/${communitySlug}`);
    };
  }
  
  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
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

  updateWithNewComment(commentResult) {
    if (!commentResult || !commentResult.success) return;

    // Create a new comment object with the necessary properties
    const newComment = {
      author: commentResult.author,
      permlink: commentResult.permlink,
      parent_author: this.post.author,
      parent_permlink: this.post.permlink,
      body: commentResult.body || 'New comment',
      created: new Date().toISOString(),
      net_votes: 0,
      active_votes: [],
      children: [],
      isNew: true  // Add this flag to highlight new comments
    };

    // Add to our local comments array
    if (!this.comments) this.comments = [];
    this.comments.push(newComment);

    // Instead of reloading the entire post, just update the comments section
    if (this.commentsSectionComponent) {
      // Use the new addNewComment method we just added to CommentsSection
      if (typeof this.commentsSectionComponent.addNewComment === 'function') {
        this.commentsSectionComponent.addNewComment(commentResult);
      } else {
        // Fallback to updating all comments (less optimal but better than full page reload)
        this.commentsSectionComponent.updateComments(this.comments);
      }
    }

    // Update the comment count in the UI
    this.updateCommentCount();
  }

  updateCommentCount() {
    const commentBtn = this.element.querySelector('.comment-btn');
    if (commentBtn) {
      const countElement = commentBtn.querySelector('.count');
      if (countElement) {
        const currentCount = parseInt(countElement.textContent) || 0;
        countElement.textContent = currentCount + 1;
      }
    }
  }

  unmount() {
    // Unmount all component instances and controllers
    const components = [
      this.postHeaderComponent,
      this.postContentComponent,
      this.postActionsComponent,
      this.postTagsComponent,
      this.commentsSectionComponent
    ];
    
    components.forEach(component => {
      if (component && typeof component.unmount === 'function') {
        component.unmount();
      }
    });
    
    this.voteController.cleanup();
    this.commentController.cleanup();
    
    // Clear references
    this.postHeaderComponent = null;
    this.postContentComponent = null;
    this.postActionsComponent = null;
    this.postTagsComponent = null;
    this.commentsSectionComponent = null;
    this.voteController = null;
    this.commentController = null;
  }

  /**
   * Removes markdown syntax from text
   * @param {string} markdown - The markdown text
   * @returns {string} Plain text without markdown
   */
  stripMarkdown(markdown) {
    if (!markdown) return '';
    
    return markdown
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Replace links with just the text
      .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/g, '$1') // Remove bold
      .replace(/(?:\*|_)(.*?)(?:\*|_)/g, '$1') // Remove italic
      .replace(/(?:~~)(.*?)(?:~~)/g, '$1') // Remove strikethrough
      .replace(/```.*?```/gs, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/#+ /g, '') // Remove headings
      .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Consolidate whitespace
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .trim();
  }
}

export default PostView;
