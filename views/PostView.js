import View from './View.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js'; 
import ContentRenderer from '../components/ContentRenderer.js';
import steemService from '../services/SteemService.js'; 
import communityService from '../services/CommunityService.js';
import authService from '../services/AuthService.js';
import metaTagService from '../services/MetaTagService.js';

// Import components
import PostHeader from '../components/post/PostHeader.js';
import PostContent from '../components/post/PostContent.js';
import PostActions from '../components/post/PostActions.js';
import PostTags from '../components/post/PostTags.js';
import CommentsSection from '../components/post/CommentsSection.js';

// Import controllers and helpers
import VoteController from '../controllers/VoteController.js';
import CommentController from '../controllers/CommentController.js';
import PostReblogHandler from '../components/post/PostReblogHandler.js';

class PostView extends View {  constructor(params = {}) {
    super(params);
    this.steemService = steemService;
    this.post = null;
    this.isLoading = false;
    this.author = params.author;
    this.permlink = params.permlink;
    this.comments = [];
    this.element = null;    this.loadingIndicator = new LoadingIndicator('spinner');
    this.reblogHandler = new PostReblogHandler(); // Inizializzare il handler del reblog
    
    // Import the necessary CSS for reblog button
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/components/reblog-button.css';
    document.head.appendChild(link);
    

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

      // Add Open Graph meta tags for better sharing preview using MetaTagService
      metaTagService.updatePostMetaTags(this.post);
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

    // Rimuovi i meta tag OG/Twitter esistenti per evitare duplicati
    this.removeStaticMetaTags();

    // Helper per creare o aggiornare meta tag
    function setMeta(property, content, useProperty = true) {
      if (!content) return;
      let tag = document.querySelector(`meta[${useProperty ? 'property' : 'name'}="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(useProperty ? 'property' : 'name', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    }

    // Titolo
    setMeta('og:title', this.post.title || 'STEEM Post');
    setMeta('og:type', 'article');
    setMeta('og:url', window.location.href);
    setMeta('og:site_name', 'cur8.fun');

    // Descrizione (primi 160 caratteri del body senza markdown)
    const description = this.stripMarkdown(this.post.body).substring(0, 160) + '...';
    setMeta('og:description', description);

    // Immagine principale (se presente)
    const imageUrl = this.getPostImageUrl();
    if (imageUrl) {
      setMeta('og:image', imageUrl);
      setMeta('og:image:url', imageUrl);
      setMeta('og:image:secure_url', imageUrl);
      setMeta('og:image:alt', this.post.title || 'STEEM Post Image');
      setMeta('og:image:width', '1200');
      setMeta('og:image:height', '630');
      setMeta('og:image:type', 'image/jpeg');
      // Twitter Card meta tags
      setMeta('twitter:card', 'summary_large_image', false);
      setMeta('twitter:image', imageUrl, false);
      setMeta('twitter:image:alt', this.post.title || 'STEEM Post Image', false);
      // image_src link
      let linkElem = document.querySelector('link[rel="image_src"]');
      if (!linkElem) {
        linkElem = document.createElement('link');
        linkElem.setAttribute('rel', 'image_src');
        document.head.appendChild(linkElem);
      }
      linkElem.setAttribute('href', imageUrl);
      // itemprop per Google+
      setMeta('image', imageUrl, false);
    } else {
      // Fallback a un logo se non c'è immagine
      const logoUrl = window.location.origin + '/assets/img/logo_tra.png';
      setMeta('og:image', logoUrl);
      setMeta('og:image:url', logoUrl);
      setMeta('twitter:card', 'summary', false);
      setMeta('twitter:image', logoUrl, false);
    }

    // Twitter base
    setMeta('twitter:title', this.post.title || 'STEEM Post', false);
    setMeta('twitter:description', description, false);

    // Extra OG
    setMeta('og:article:published_time', this.post.created);
    setMeta('og:article:author', this.post.author);
  }
  
  /**
   * Rimuove i meta tag statici originali per evitare conflitti
   */
  removeStaticMetaTags() {
    // Rimuovi i meta tag esistenti di Open Graph e Twitter
    const metaSelectors = [
      'meta[property^="og:"]',
      'meta[name^="twitter:"]',
      'meta[name="image"]',
      'meta[itemprop="image"]'
    ];
    
    metaSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(tag => {
        tag.parentNode.removeChild(tag);
      });
    });
    
    // Assicuriamoci che anche i tag con ID specifici vengano rimossi
    const specificIds = [
      'og-title', 'og-desc', 'og-image', 'og-url',
      'twitter-title', 'twitter-desc', 'twitter-image'
    ];
    
    specificIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.parentNode.removeChild(element);
      }
    });
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
        return this.ensureAbsoluteUrl(metadata.image[0]);
      }
      
      // Check for other common metadata image formats
      if (metadata) {
        // Check for thumbnail property
        if (metadata.thumbnail) {
          return this.ensureAbsoluteUrl(metadata.thumbnail);
        }
        
        // Check for featured_image property
        if (metadata.featured_image) {
          return this.ensureAbsoluteUrl(metadata.featured_image);
        }
      }
      
      // Fallback to searching the post body for images - regex patterns
      // 1. First look for Markdown images ![alt](url)
      const markdownImgRegex = /!\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)/;
      const mdMatch = this.post.body.match(markdownImgRegex);
      if (mdMatch && mdMatch[1]) {
        return this.ensureAbsoluteUrl(mdMatch[1]);
      }
      
      // 2. Look for HTML img tags
      const htmlImgRegex = /<img.*?src=["'](.*?)["']/i;
      const htmlMatch = this.post.body.match(htmlImgRegex);
      if (htmlMatch && htmlMatch[1]) {
        return this.ensureAbsoluteUrl(htmlMatch[1]);
      }
      
      // 3. Check for image URLs directly (common formats)
      const urlRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i;
      const urlMatch = this.post.body.match(urlRegex);
      if (urlMatch && urlMatch[1]) {
        return this.ensureAbsoluteUrl(urlMatch[1]);
      }
      
      // 4. Last resort: Try to extract images using a more general approach
      // from steem avators or similar URLs
      const generalImgRegex = /https?:\/\/(?:steemitimages\.com|images\.hive\.blog|gateway\.pinata\.cloud)\/\S+/i;
      const generalMatch = this.post.body.match(generalImgRegex);
      if (generalMatch && generalMatch[0]) {
        return this.ensureAbsoluteUrl(generalMatch[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting post image URL:', error);
      return null;
    }
  }
  
  /**
   * Ensures that a URL is absolute
   * @param {string} url - The URL to process
   * @returns {string} The absolute URL
   */
  ensureAbsoluteUrl(url) {
    if (!url) return null;
    
    // If the URL is already absolute, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    // Handle relative URLs - try different approaches
    // First, try steemitimages which is commonly used for STEEM content
    if (url.startsWith('/')) {
      // URL is relative to root
      return `https://steemitimages.com${url}`;
    } else {
      // Try to determine if this is a Markdown-style path reference or plain filename
      // For steemit/hive content, use the steemitimages CDN
      return `https://steemitimages.com/0x0/${url}`;
    }
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
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Consolidate whitespace
      .trim();
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
      () => this.handleReblog(),
      this.canEditPost(),
      false // hasReblogged sarà aggiornato dinamicamente                                  
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
   * Redirects the user to the appropriate edit page based on content type
   */
  handleEdit() {
    const { author, permlink } = this.post;
    
    if (this.isComment()) {
      // È un commento, gestisci l'editing del commento
      this.handleCommentEdit();
    } else {
      // È un post, reindirizza alla pagina di modifica normale
      router.navigate(`/edit/@${author}/${permlink}`);
    }
  }

  /**
   * Gestisce l'editing di un commento
   * Apre una finestra di dialogo per modificare il commento invece di navigare
   */
  handleCommentEdit() {
    if (this.commentController && typeof this.commentController.handleEditComment === 'function') {
      this.commentController.handleEditComment(this.post);
    } else {
      console.error('CommentController non implementa handleEditComment');
      
      // Fallback: notifica all'utente
      this.emit('notification', {
        type: 'info',
        message: 'L\'editing dei commenti sarà disponibile presto'
      });
    }
  }

  /**
   * Check if current user can edit the content
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

  /**
   * Gestisci il reblog del post
   */
  async handleReblog() {
    try {
      // Verifica che l'utente sia loggato
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        this.emit('notification', {
          type: 'info',
          message: 'You must be logged in to reblog a post'
        });
        router.navigate('/login');
        return;
      }
      
      console.log(`Reblogging post by ${this.post.author}/${this.post.permlink}`);
      
      // Usa il servizio per effettuare il reblog
      await steemService.reblogPost(currentUser.username, this.post.author, this.post.permlink);
      
      // Aggiorna lo stato del pulsante di reblog
      if (this.postActionsComponent) {
        const reblogBtn = this.element.querySelector('.reblog-btn');
        if (reblogBtn) {
          reblogBtn.classList.add('reblogged');
          const textSpan = reblogBtn.querySelector('span:last-child');
          if (textSpan) {
            textSpan.textContent = 'Reblogged';
          }
        }
      }
      
      // Notifica l'utente
      this.emit('notification', {
        type: 'success',
        message: 'Post reblogged successfully!'
      });
    } catch (error) {
      console.error('Error reblogging post:', error);
      this.emit('notification', {
        type: 'error',
        message: error.message || 'Failed to reblog post'
      });
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
      this.removeElementIfExists(loadingSpinner);
      communityIcon.style.display = 'inline-flex';
      
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
   * Verifica se il contenuto è un commento invece di un post
   * @returns {boolean} true se è un commento
   */
  isComment() {
    return this.post && this.post.parent_author && this.post.parent_author !== '';
  }
}

export default PostView;