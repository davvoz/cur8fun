import InfiniteScroll from '../../utils/InfiniteScroll.js';
import router from '../../utils/Router.js';
import profileService from '../../services/ProfileService.js';
import UIComponents from '../../utils/UIComponents.js';
import BasePostView from '../../views/BasePostView.js';

export default class CommentsList extends BasePostView {
  constructor(username, useCache = false) {
    super(); // Initialize gridController from BasePostView
    this.username = username;
    this.useCache = useCache;
    this.commentsData = null; // Store fetched data flag - THIS WAS NEVER GETTING SET TO TRUE
    this.comments = [];
    this.allComments = [];
    this.page = 1;
    this.loading = false;
    this.hasMore = true;
    this.infiniteScroll = null;
    this.container = null;
    this.commentsContainer = null; // Ensure this is initialized
    this.progressInterval = null;
  }
  
  async render(container) {
    console.log("CommentsList render called, useCache:", this.useCache, "commentsData:", this.commentsData);
    
    if (container) {
      this.container = container;
      this.commentsContainer = container;
    }
    
    if (!this.commentsContainer) {
      console.error("No container available for comments!");
      return;
    }
    
    // Only fetch data if not already cached or cache not requested
    if (!this.commentsData || !this.useCache) {
      console.log("Fetching comments (not cached)");
      // Show loading state - add simple loading indicator
      const loadingElement = document.createElement('div');
      loadingElement.className = 'comments-loading';
      loadingElement.innerHTML = '<div class="loading-spinner"></div><p>Loading comments...</p>';
      this.commentsContainer.appendChild(loadingElement);
      
      try {
        // Fetch comments data
        await this.loadAllComments();
        // Mark data as cached - THIS WAS MISSING!
        this.commentsData = true;
      } catch (error) {
        console.error('Error fetching comments:', error);
        this.commentsContainer.innerHTML = `
          <div class="error-message">
            <h3>Error loading comments</h3>
            <p>${error.message || 'Unknown error'}</p>
            <button class="retry-btn">Retry</button>
          </div>
        `;
        
        this.commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
          this.render(this.commentsContainer);
        });
      } finally {
        // Remove loading indicator
        const existingLoader = this.commentsContainer.querySelector('.comments-loading');
        if (existingLoader) {
          existingLoader.remove();
        }
      }
    } else {
      // Use cached data
      console.log("Using cached comments data, comments count:", this.allComments?.length || 0);
      
      // If data exists but UI needs to be rendered again
      if (this.allComments && this.allComments.length > 0) {
        this.renderLoadedComments(this.allComments.length);
      } else {
        console.warn("Cache flag set but no comments data available!");
      }
    }
  }
  
  // Add this method to set container after initialization
  setContainer(container) {
    if (container) {
      this.container = container;
      this.commentsContainer = container;
    }
    return this;
  }

  // Add reset method to ensure component can be reused
  reset() {
    // Keep cached data but reset UI-related properties
    this.loading = false;
    this.infiniteScroll = null;
    // Do NOT reset commentsData here - it would break caching
    return this;
  }

  // Add this method to refresh the grid layout
  refreshLayout() {
    if (this.gridLayout) {
      // If using Masonry, isotope or similar library
      this.gridLayout.layout();
    }
  }
  
  async loadAllComments() {
    if (this.loading) return;
    if (!this.commentsContainer) return;

    this.loading = true;

    // Show loading indicator
    const progressIndicator = this.createProgressIndicator();
    this.commentsContainer.innerHTML = '';
    this.commentsContainer.appendChild(progressIndicator);

    try {
      // Set up progress tracking
      let commentsCount = 0;
      let batchNumber = 1;
      
      // Function to update progress UI
      const updateProgress = (count, batch) => {
        const counter = progressIndicator.querySelector('.loading-counter');
        if (counter) counter.textContent = `${count} commenti caricati`;
        
        const batchIndicator = progressIndicator.querySelector('.loading-batch');
        if (batchIndicator) batchIndicator.textContent = `Recupero batch #${batch}`;
        
        const progressBar = progressIndicator.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.animation = 'pulse 1.5s infinite';
        }
      };
      
      // Start with a high limit to retrieve as many comments as possible in one batch
      const COMMENTS_PER_PAGE = 100;
      let currentPage = 1;
      let hasMoreComments = true;
      let allCommentsArray = [];
      
      // Create a Set to track unique comments
      const uniqueCommentIds = new Set();
      
      // Loop to load all available comments
      while (hasMoreComments) {
        updateProgress(commentsCount, batchNumber);
        
        // Load a batch of comments
        try {
          const params = { 
            forceRefresh: currentPage === 1,
            timeout: 30000 // Increase timeout for large batches
          };
          
          const newComments = await profileService.getUserComments(this.username, COMMENTS_PER_PAGE, currentPage, params);
          
          // Verify if we received valid comments
          if (!newComments || newComments.length === 0) {
            hasMoreComments = false;
          } else {
            // Filter comments to ensure they are unique
            const uniqueNewComments = newComments.filter(comment => {
              const commentId = `${comment.author}_${comment.permlink}`;
              if (uniqueCommentIds.has(commentId)) {
                return false;
              }
              uniqueCommentIds.add(commentId);
              return true;
            });
            
            // Add unique comments to the total array
            allCommentsArray = [...allCommentsArray, ...uniqueNewComments];
            commentsCount = allCommentsArray.length;
            
            // Check if there are more comments to load
            hasMoreComments = newComments.length >= COMMENTS_PER_PAGE;
            currentPage++;
            batchNumber++;
          }
        } catch (error) {
          console.error(`Errore caricamento batch ${batchNumber}:`, error);
          // Continue with the next batch despite the error
        }
        
        // Update UI
        updateProgress(commentsCount, batchNumber);
        
        // Brief pause to avoid overloading the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Store all retrieved comments
      this.allComments = allCommentsArray;
      
      // Mark data as loaded - THIS WAS MISSING!
      this.commentsData = true;
      
      // Update UI with completion
      const loadingText = progressIndicator.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = 'Caricamento completato!';
      
      const batchIndicator = progressIndicator.querySelector('.loading-batch');
      if (batchIndicator) batchIndicator.textContent = `Totale batch: ${batchNumber - 1}`;
      
      const progressBar = progressIndicator.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#4caf50';
      }
      
      // Show comments after a brief pause
      setTimeout(() => {
        this.renderLoadedComments(commentsCount);
      }, 500);
      
    } catch (error) {
      console.error('Errore nel caricamento di tutti i commenti:', error);
      this.commentsContainer.innerHTML = `
        <div class="error-message">
          <h3>Errore caricamento commenti</h3>
          <p>Si è verificato un errore durante il caricamento dei commenti per @${this.username}</p>
          <p class="error-details">${error.message || 'Errore sconosciuto'}</p>
          <button class="retry-btn">Riprova</button>
        </div>
      `;
      
      // Handler for retry
      this.commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.loadAllComments();
      });
    } finally {
      this.loading = false;
    }
  }
  
  createProgressIndicator() {
    const div = document.createElement('div');
    div.className = 'comments-progress';
    div.innerHTML = `
      <div class="loading-indicator">
        <div class="spinner"></div>
        <div class="loading-text">Caricamento commenti...</div>
        <div class="loading-batch">Recupero batch #1</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="loading-counter">0 commenti caricati</div>
      </div>
    `;
    return div;
  }
  
  async renderLoadedComments(totalCount) {
    if (!this.commentsContainer) return;

    // Clear container content but preserve the element
    this.commentsContainer.innerHTML = '';
    
    // Make sure we apply the current grid layout
    const currentLayout = this.gridController.settings.layout || 'grid';
    this.commentsContainer.className = `comments-container grid-layout-${currentLayout}`;

    try {
      // Show comments counter
      const countDiv = document.createElement('div');
      countDiv.className = 'comments-count';
      countDiv.innerHTML = `
        <div class="count-badge">${totalCount}</div>
        <div class="count-text">Commenti totali di @${this.username}</div>
      `;

      countDiv.style.margin = '20px 0';
      countDiv.style.textAlign = 'center';
      countDiv.style.fontWeight = 'bold';
      countDiv.style.background = 'var(--primary-color)';
      countDiv.style.color = 'var(--primary-text-color)';
      countDiv.style.padding = '10px 15px';
      countDiv.style.borderRadius = '8px';
      countDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      this.commentsContainer.appendChild(countDiv);

      // Handle the case where there are no comments
      if (!this.allComments || this.allComments.length === 0) {
        this.commentsContainer.innerHTML = `
          <div class="empty-comments-message">
            @${this.username} non ha ancora pubblicato commenti.
          </div>
        `;
        return;
      }

      // Create a wrapper that will handle the grid layout
      const commentsWrapper = document.createElement('div');
      commentsWrapper.className = 'comments-cards-wrapper';
      
      // Apply matching layout class to wrapper
      commentsWrapper.classList.add(`layout-${currentLayout}`);
      
      // Append wrapper to container
      this.commentsContainer.appendChild(commentsWrapper);

      // Render the first batch of comments
      const BATCH_SIZE = 20;
      const firstBatch = this.allComments.slice(0, BATCH_SIZE);
      
      firstBatch.forEach(comment => {
        const commentItem = this.createCommentItem(comment);
        commentsWrapper.appendChild(commentItem);
      });

      // Log for debugging
      console.log(`Rendered ${firstBatch.length} comments with layout: ${currentLayout}`);

      // Set up infinite scroll for remaining comments
      this.hasMore = totalCount > BATCH_SIZE;
      this.page = 2; // Start from page 2 next time
      this.setupBatchedInfiniteScroll(BATCH_SIZE, totalCount, commentsWrapper);
      
      // Emit a custom event that comments are ready
      window.dispatchEvent(new CustomEvent('comments-rendered', {
        detail: { container: this.commentsContainer }
      }));
      
      // Reapply grid settings after comments are rendered
      this.gridController.target = this.commentsContainer;
      this.gridController.applySettings();
      
      // Force re-apply settings to ensure layout is applied
      setTimeout(() => {
        this.gridController.applySettings();
      }, 100);
    } catch (error) {
      console.error('Errore nel rendering dei commenti:', error);
      this.commentsContainer.innerHTML = `
        <div class="error-message">
          <h3>Errore visualizzazione commenti</h3>
          <p>Si è verificato un errore durante la visualizzazione dei commenti.</p>
          <button class="retry-btn">Riprova</button>
        </div>
      `;

      this.commentsContainer.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.renderLoadedComments(totalCount);
      });
    }
  }
  
  setupBatchedInfiniteScroll(batchSize = 20, totalCount = 0, commentsWrapper) {
    // Cleanup any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    if (!this.commentsContainer || !this.allComments || !commentsWrapper) {
      console.warn('Container, wrapper o commenti non disponibili per infinite scroll');
      return;
    }

    console.log(`Impostazione infinite scroll per ${this.allComments.length} commenti totali`);

    // Verify that there are actually more comments to load
    if (this.allComments.length <= batchSize) {
      console.log('Nessun altro commento da caricare, infinite scroll non necessario');
      return;
    }

    // Create an infiniteScroll that loads comments directly from memory
    this.infiniteScroll = new InfiniteScroll({
      container: this.commentsContainer,
      loadMore: (page) => {
        // Page index is 1-based, but arrays are 0-based
        const startIndex = (page - 1) * batchSize;

        // Check if we've reached the end
        if (startIndex >= this.allComments.length) {
          console.log('Infinite scroll: fine dei commenti raggiunta');
          return false;
        }

        console.log(`Caricamento commenti per pagina ${page} (indice ${startIndex})`);

        // Calculate end index (not included)
        const endIndex = Math.min(startIndex + batchSize, this.allComments.length);

        // Extract the batch of comments
        const batch = this.allComments.slice(startIndex, endIndex);

        // If there are no comments in this batch, end
        if (batch.length === 0) return false;

        console.log(`Mostrando ${batch.length} commenti (${startIndex + 1}-${endIndex} di ${this.allComments.length})`);

        // Render the comments
        batch.forEach(comment => {
          const commentItem = this.createCommentItem(comment);
          commentsWrapper.appendChild(commentItem);
        });

        // If we've reached the last batch
        if (endIndex >= this.allComments.length) {
          // Add an "end of comments" message
          const endMessage = document.createElement('div');
          endMessage.className = 'comments-end-message';
          endMessage.innerHTML = `
            <div class="end-message">
              <span class="material-icons">check_circle</span>
              Hai visualizzato tutti i ${this.allComments.length} commenti
            </div>
          `;

          this.commentsContainer.appendChild(endMessage);

          return false; // End of loading
        }

        return true; // Continue loading
      },
      threshold: '200px', // Start loading when we're 200px from the end
      initialPage: this.page // Start from current page
    });
  }
  
  createCommentItem(comment) {
    if (!comment) {
      console.error('Cannot create comment item: comment data is missing');
      return document.createElement('div');
    }

    // Create comment container - maintain the comment-card class for styling
    const commentItem = document.createElement('div');
    commentItem.className = 'post-card comment-card'; // Use both classes for compatibility
    commentItem.dataset.commentId = `${comment.author}_${comment.permlink}`;

    // Parse metadata
    const metadata = this.parseMetadata(comment.json_metadata);
    
    // 1. Add header (author info) - Always at the top
    commentItem.appendChild(this.createPostHeader(comment));
    
    // 2. Main content
    const mainContent = document.createElement('div');
    mainContent.className = 'post-main-content';
    
    // 2b. Wrapper for text content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'post-content-wrapper';
    
    // Middle section with parent info, body, tags
    const contentMiddle = document.createElement('div');
    contentMiddle.className = 'post-content-middle';
    
    // Add parent post info as a special element
    this.addParentInfo(contentMiddle, comment);
    
    // Add comment body as title
    const title = document.createElement('div');
    title.className = 'post-title';
    // Comments don't have titles, so use a truncated body excerpt
    const excerpt = this.createExcerpt(comment.body || '', 60);
    title.textContent = excerpt || 'Comment';
    contentMiddle.appendChild(title);
    
    // Add full comment body
    const body = document.createElement('div');
    body.className = 'post-excerpt';
    body.textContent = this.createExcerpt(comment.body || '', 150);
    contentMiddle.appendChild(body);
    
    // Add tags if available
    if (metadata && metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      contentMiddle.appendChild(this.createPostTags(metadata.tags.slice(0, 2)));
    }
    
    contentWrapper.appendChild(contentMiddle);
    
    // Actions (votes)
    contentWrapper.appendChild(this.createCommentActions(comment));
    
    // Add text content to main content
    mainContent.appendChild(contentWrapper);
    
    // Add main content to card
    commentItem.appendChild(mainContent);
    
    // Click event - Navigate to comment
    this.addCommentNavigationHandler(commentItem, comment);
    
    return commentItem;
  }

  createPostHeader(comment) {
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';
    
    const avatar = document.createElement('img');
    avatar.alt = comment.author;
    avatar.className = 'avatar';
    avatar.loading = 'lazy';
    
    // Add retry mechanism for avatars
    let retryCount = 0;
    
    const loadAvatar = () => {
      // Try multiple sources in sequence
      const avatarSources = [
        `https://steemitimages.com/u/${comment.author}/avatar`,
        `https://images.hive.blog/u/${comment.author}/avatar`
      ];
      
      let currentSourceIndex = 0;
      
      const tryNextSource = () => {
        if (currentSourceIndex >= avatarSources.length) {
          // We've tried all sources, use default
          avatar.src = './assets/img/default-avatar.png';
          return;
        }
        
        const currentSource = avatarSources[currentSourceIndex];
        currentSourceIndex++;
        
        avatar.onerror = () => {
          // Try next source after a short delay
          setTimeout(tryNextSource, 300);
        };
        
        // Add cache busting only for retries on same source
        if (retryCount > 0 && !currentSource.includes('default-avatar')) {
          avatar.src = `${currentSource}?retry=${Date.now()}`;
        } else {
          avatar.src = currentSource;
        }
      };
      
      // Start the loading process
      tryNextSource();
    };
    
    loadAvatar();
    
    avatarContainer.appendChild(avatar);
    
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
    header.append(avatarContainer, info);
    
    return header;
  }

  addParentInfo(container, comment) {
    // Create parent post info container
    const parentInfo = document.createElement('div');
    parentInfo.className = 'comment-parent-info';
    
    // Add icon
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'reply';
    parentInfo.appendChild(icon);
    
    // Add text "Risposta a..."
    const infoText = document.createElement('span');
    infoText.className = 'parent-info-text';
    
    // Use parent_author and parent_permlink if available
    if (comment.parent_author) {
      infoText.textContent = `Risposta a @${comment.parent_author}`;
      
      // Make it clickable
      parentInfo.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the comment's click handler
        router.navigate(`/@${comment.parent_author}/${comment.parent_permlink}`);
      });
      
      // Add clickable styling
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

  createPostTags(tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags';
    
    // Show max 2 tags to avoid crowding the UI
    const displayTags = tags.slice(0, 2);
    
    displayTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'post-tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
    
    return tagsContainer;
  }

  // Keep navigation handler but updated to match BasePostView style
  addCommentNavigationHandler(element, comment) {
    if (comment.author && comment.permlink) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        // For comments, navigate to the parent post with the comment anchor
        const url = comment.parent_author && comment.parent_permlink
          ? `/@${comment.parent_author}/${comment.parent_permlink}#@${comment.author}/${comment.permlink}`
          : `/@${comment.author}/${comment.permlink}`;
          
        router.navigate(url);
      });
    }
  }

  // We'll keep the existing parseMetadata method
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
  
  createExcerpt(body, maxLength = 150) {
    if (!body) return '';
    
    // Remove markdown and html
    const plainText = body
        .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // remove markdown links keeping the text
        .replace(/<a.*?href=["'](.+?)["'].*?>(.+?)<\/a>/gi, '$2') // remove HTML links keeping text
        .replace(/https?:\/\/\S+/g, '') // remove all URLs
        .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
        .replace(/#{1,6}\s/g, '') // remove headings (1-6 hashes)
        .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // convert bold to normal text
        .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // convert italic to normal text
        .replace(/~~(.*?)~~/g, '$1') // convert strikethrough to normal text
        .replace(/>\s*(.*?)(\n|$)/g, '') // remove blockquotes
        .replace(/```[\s\S]*?```/g, '') // remove code blocks with triple backticks
        .replace(/`[^`]*`/g, '') // remove inline code with single backticks
        .replace(/~~~[\s\S]*?~~~/g, '') // remove code blocks with triple tildes
        .replace(/\n\n/g, ' ') // replace double newlines with space
        .replace(/\n/g, ' ') // replace single newlines with space
        .replace(/\s+/g, ' ') // replace multiple spaces with a single space
        .trim();
    
    // Truncate and add ellipsis if necessary
    if (plainText.length <= maxLength) {
        return plainText;
    }
    
    return plainText.substring(0, maxLength) + '...';
  }
  
  getVoteCount(comment) {
    // Try different properties that might contain vote count
    if (typeof comment.net_votes === 'number') {
      return comment.net_votes;
    }
    if (typeof comment.active_votes === 'object' && Array.isArray(comment.active_votes)) {
      return comment.active_votes.length;
    }
    if (typeof comment.vote_count === 'number') {
      return comment.vote_count;
    }
    // Default to 0 if no valid vote count is found
    return 0;
  }
  
  unmount() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    // Properly disconnect the grid controller
    if (this.gridController) {
      this.gridController.target = null;
      this.gridController.unmount();
    }
  }
  
  getGridType() {
    // Use the gridController's current layout setting
    return this.gridController ? this.gridController.settings.layout : 'grid';
  }

  refreshGridLayout() {
    console.log("Refreshing comments grid layout");
    
    if (!this.commentsContainer) {
      console.warn("No comments container available for refresh");
      return;
    }
    
    console.log("Comments container:", this.commentsContainer.className);
    console.log("Comments data available:", !!this.allComments, "count:", this.allComments?.length || 0);
    console.log("Children in container:", this.commentsContainer.children.length);
    console.log("Comments cards:", this.commentsContainer.querySelectorAll('.comment-card').length);
    
    // Force render if we have data but not displayed
    if (this.allComments && this.allComments.length > 0) {
      // Check if comments are not rendered yet
      if (this.commentsContainer.querySelectorAll('.comment-card').length === 0) {
        console.log("Comments data exists but not rendered, rendering now");
        this.renderLoadedComments(this.allComments.length);
        return;
      }
    } else if (!this.commentsData && this.useCache) {
      // If we should use cache but don't have data yet, load it
      console.log("Need to load comments first");
      this.render(this.commentsContainer);
      return;
    }
    
    // Otherwise just refresh the layout
    if (this.gridController) {
      this.gridController.target = this.commentsContainer;
      setTimeout(() => {
        this.gridController.applySettings();
      }, 50);
    }
  }
}
