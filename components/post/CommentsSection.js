import voteService from '../../services/VoteService.js';
import router from '../../utils/Router.js';
import steemApi from '../../services/SteemApi.js';

// Improved inert attribute polyfill with better event handling
function ensureInertSupport() {
  if (!('inert' in document.createElement('div'))) {
    console.log('Inert attribute not supported natively, adding polyfill');
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      enumerable: true,
      get: function() { return this.hasAttribute('inert'); },
      set: function(inert) {
        if (inert) {
          this.setAttribute('inert', '');
          // Store original tabindex and set to -1 to make elements unfocusable
          Array.from(this.querySelectorAll(
            'button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])'
          )).forEach(el => {
            el.dataset.originalTabindex = el.getAttribute('tabindex') || '';
            el.setAttribute('tabindex', '-1');
          });
        } else {
          this.removeAttribute('inert');
          // Restore original tabindex values
          Array.from(this.querySelectorAll('[data-original-tabindex]')).forEach(el => {
            const originalValue = el.dataset.originalTabindex;
            if (originalValue === '') {
              el.removeAttribute('tabindex');
            } else if (originalValue) {
              el.setAttribute('tabindex', originalValue);
            }
            delete el.dataset.originalTabindex;
          });
        }
      }
    });
  }
}

class CommentsSection {
  constructor(comments, parentPost, handleReplyCallback, handleVoteCallback, contentRenderer) {
    this.comments = comments || [];
    this.parentPost = parentPost;
    this.handleReplyCallback = handleReplyCallback;
    this.handleVoteCallback = handleVoteCallback;
    this.contentRenderer = contentRenderer;
    this.element = null;
    this.commentsListContainer = null;
    this.activeReplyForm = null; // Track the currently active reply form
    this.collapsedComments = new Set(); // Track collapsed comment threads
    this.commentsToShow = 20; // Initial number of comments to show
    this.commentsIncrement = 20; // How many more comments to load when "show more" is clicked
    
    // Ensure inert property is supported
    ensureInertSupport();
    
    // Debugging for reply callback
    if (!this.handleReplyCallback) {
      console.warn('No reply callback provided to CommentsSection');
    }
  }

  async render() {
    try {
      const commentsSection = document.createElement('div');
      commentsSection.className = 'comments-section';

      const commentsHeader = document.createElement('h3');
      commentsHeader.textContent = `Comments (${this.comments.length})`;

      // Create a proper form element instead of div for better accessibility and form submission
      const commentForm = document.createElement('form');
      commentForm.className = 'comment-form';
      // Prevent default form submission to handle it with JavaScript
      commentForm.addEventListener('submit', (e) => e.preventDefault());

      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Write a comment...';
      textarea.name = 'comment-text'; // Add name attribute for better form handling
      textarea.required = true; // Make it required

      const submitButton = document.createElement('button');
      submitButton.className = 'submit-comment';
      submitButton.textContent = 'Post Comment';
      submitButton.type = 'submit'; // Set proper button type
      
      // Add data attributes to help identify the form
      commentForm.dataset.parentAuthor = this.parentPost?.author || '';
      commentForm.dataset.parentPermlink = this.parentPost?.permlink || '';

      commentForm.appendChild(textarea);
      commentForm.appendChild(submitButton);

      const commentsList = document.createElement('div');
      commentsList.className = 'comments-list';

      commentsSection.appendChild(commentsHeader);
      commentsSection.appendChild(commentForm);
      commentsSection.appendChild(commentsList);

      // Store reference to the container
      this.element = commentsSection;
      this.commentsListContainer = commentsList;

      try {
        // Fetch all replies but handle failures gracefully
        await this.fetchAllReplies();
      } catch (fetchError) {
        console.error('Failed to fetch comment replies:', fetchError);
        // Continue with the comments we have instead of totally failing
      }
      
      // Render the comments we have (even if we failed to fetch all replies)
      this.renderComments();

      return commentsSection;
    } catch (error) {
      console.error('Error rendering comments section:', error);
      
      // Create a fallback element to prevent fatal errors
      const fallbackElement = document.createElement('div');
      fallbackElement.className = 'comments-section-error';
      fallbackElement.textContent = 'Could not load comments. Please try refreshing the page.';
      return fallbackElement;
    }
  }

  // Completamente revisionato per risolvere il problema della profondità
  async fetchAllReplies() {
    if (!this.comments || this.comments.length === 0) return;
    
    // Crea un indicatore di caricamento
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-replies';
    loadingIndicator.textContent = 'Caricamento commenti e risposte...';
    loadingIndicator.style.padding = '10px';
    loadingIndicator.style.backgroundColor = '#f0f0f0';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.margin = '10px 0';
    loadingIndicator.style.textAlign = 'center';
    
    if (this.commentsListContainer) {
      this.commentsListContainer.appendChild(loadingIndicator);
    }
    
    try {
      // 1. Primo passo: otteniamo le risposte dirette al post principale
      
      // Per maggiore sicurezza, recuperiamo nuovamente anche le risposte dirette al post
      const directReplies = await steemApi.getContentReplies(
        this.parentPost.author, 
        this.parentPost.permlink
      );
      
      // 2. Creiamo una mappa per tenere traccia di tutti i commenti
      const allCommentsMap = new Map();
      // Inizializza con i commenti che già abbiamo
      this.comments.forEach(c => allCommentsMap.set(`${c.author}/${c.permlink}`, c));
      // Aggiungi le risposte dirette se non le abbiamo già
      directReplies.forEach(reply => {
        const key = `${reply.author}/${reply.permlink}`;
        if (!allCommentsMap.has(key)) {
          allCommentsMap.set(key, reply);
        }
      });
      
      // 3. Per ogni commento/risposta che abbiamo, procediamo a recuperare tutte le risposte
      const allComments = Array.from(allCommentsMap.values());
      let totalRepliesFound = 0;
      
      // 4. La magia avviene qui: per OGNI commento, recuperiamo le risposte come se fosse un post
      for (const comment of allComments) {
        try {
          // Questo è il cambiamento fondamentale: trattiamo OGNI commento come un post
          const replies = await steemApi.getContentReplies(comment.author, comment.permlink);
          
          if (replies && replies.length > 0) {
            totalRepliesFound += replies.length;
            
            // Aggiungi solo le risposte che non abbiamo già
            for (const reply of replies) {
              const key = `${reply.author}/${reply.permlink}`;
              if (!allCommentsMap.has(key)) {
                allCommentsMap.set(key, reply);
                allComments.push(reply); // Aggiungi anche all'array che stiamo iterando
              }
            }
          }
        } catch (err) {
          console.error(`❌ Errore nel recupero risposte per ${comment.permlink}:`, err);
        }
      }
      
      // 5. Ora abbiamo tutti i commenti e tutte le risposte
      this.comments = Array.from(allCommentsMap.values());
      
      // IMPORTANTE: analizza la struttura dei commenti per debug
      this.analyzeComments();
      
    } catch (error) {
      console.error('❌ Errore generale nel recupero risposte:', error);
    } finally {
      // Rimuovi l'indicatore di caricamento
      if (this.commentsListContainer && loadingIndicator.parentNode === this.commentsListContainer) {
        this.commentsListContainer.removeChild(loadingIndicator);
      }
    }
  }
  
  // Nuovo metodo per analizzare la struttura dei commenti e risposte
  analyzeComments() {
    // Contiamo i commenti radice (risposte dirette al post)
    const rootComments = this.comments.filter(c => 
      c.parent_author === this.parentPost.author && 
      c.parent_permlink === this.parentPost.permlink
    );
    
    // Contiamo i commenti che sono risposte ad altri commenti
    const replies = this.comments.filter(c => 
      !(c.parent_author === this.parentPost.author && c.parent_permlink === this.parentPost.permlink)
    );
    
    // Verifichiamo la profondità massima
    const depths = {};
    const commentsWithNoParent = [];
    
    // Costruisci un grafo di commenti per calcolare le profondità
    const graph = new Map();
    this.comments.forEach(c => {
      const key = `${c.author}/${c.permlink}`;
      const parentKey = `${c.parent_author}/${c.parent_permlink}`;
      
      if (!graph.has(key)) graph.set(key, { node: c, children: [] });
      
      // Se è una risposta diretta al post, è un nodo radice
      if (c.parent_author === this.parentPost.author && c.parent_permlink === this.parentPost.permlink) {
        // È un commento radice (profondità 0)
      } else {
        // È una risposta a un altro commento
        if (graph.has(parentKey)) {
          graph.get(parentKey).children.push(key);
        } else {
          // Il genitore non esiste ancora, lo aggiungeremo dopo
          commentsWithNoParent.push(key);
        }
      }
    });
  }

  renderComments() {
    // First check if container exists
    if (!this.commentsListContainer) {
      console.error('Comments list container not found');
      return;
    }
    
    // Clear existing comments
    while (this.commentsListContainer.firstChild) {
      this.commentsListContainer.removeChild(this.commentsListContainer.firstChild);
    }

    if (!this.comments || this.comments.length === 0) {
      const noComments = document.createElement('div');
      noComments.className = 'no-comments';
      noComments.textContent = 'No comments yet. Be the first to comment!';
      this.commentsListContainer.appendChild(noComments);
      return;
    }

    // Build comment tree
    const commentTree = this.buildCommentTree(this.comments);

    // Add a container style to the comments list to ensure proper layout
    this.commentsListContainer.style.display = 'flex';
    this.commentsListContainer.style.flexDirection = 'column';
    this.commentsListContainer.style.gap = '20px';

    // Count total number of root comments
    const totalRootComments = commentTree.length;
    
    // Show a limited number of root comments initially
    const commentsToRender = commentTree.slice(0, this.maxRootCommentsToShow);
    
    // Render each root comment with its replies
    commentsToRender.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      this.commentsListContainer.appendChild(commentElement);
      
      // Render replies if any
      if (comment.children && comment.children.length > 0) {
        this.renderReplies(commentElement, comment);
      }
    });
    
    // Add "Show more comments" button if there are more comments
    if (totalRootComments > this.maxRootCommentsToShow) {
      const remaining = totalRootComments - this.maxRootCommentsToShow;
      const showMoreContainer = document.createElement('div');
      showMoreContainer.className = 'show-more-comments';
      
      const showMoreButton = document.createElement('button');
      showMoreButton.textContent = `Show ${remaining} more ${remaining === 1 ? 'comment' : 'comments'}`;
      showMoreButton.className = 'show-more-button';
      showMoreButton.addEventListener('click', () => {
        this.maxRootCommentsToShow = totalRootComments;
        this.renderComments();
      });
      
      showMoreContainer.appendChild(showMoreButton);
      this.commentsListContainer.appendChild(showMoreContainer);
    }
  }

  // Questa funzione deve essere completamente modificata per garantire la corretta gestione della profondità
  buildCommentTree(comments) {
    
    // 1. Creiamo una mappa di tutti i commenti per accessi veloci
    const commentMap = new Map();
    comments.forEach(comment => {
      commentMap.set(`${comment.author}/${comment.permlink}`, {...comment, children: []});
    });
    
    // 2. Prepariamo l'array per i commenti radice
    const rootComments = [];
    
    // 3. Costruiamo le relazioni tra commenti
    comments.forEach(comment => {
      const commentKey = `${comment.author}/${comment.permlink}`;
      const commentNode = commentMap.get(commentKey);
      
      if (!commentNode) return;
      
      // Un commento è radice se il suo parent è il post principale
      const isRootComment = comment.parent_author === this.parentPost.author && 
                           comment.parent_permlink === this.parentPost.permlink;
      
      if (isRootComment) {
        rootComments.push(commentNode);
      } else {
        // È una risposta a un altro commento
        const parentKey = `${comment.parent_author}/${comment.parent_permlink}`;
        const parentComment = commentMap.get(parentKey);
        
        if (parentComment) {
          // Aggiungi come figlio del genitore
          parentComment.children.push(commentNode);
        } else {
          // Se non troviamo il genitore, aggiungi come radice
          rootComments.push(commentNode);
        }
      }
    });
    
    // 4. Assegna le profondità correttamente
    const assignDepths = (comments, depth = 0) => {
      comments.forEach(comment => {
        comment.depth = depth;
        if (comment.children && comment.children.length > 0) {
          assignDepths(comment.children, depth + 1);
        }
      });
    };
    
    assignDepths(rootComments);
    
    // 5. Ordina i commenti per data
    const sortCommentsByDate = (comments) => {
      comments.sort((a, b) => new Date(a.created) - new Date(b.created));
      comments.forEach(comment => {
        if (comment.children && comment.children.length > 0) {
          sortCommentsByDate(comment.children);
        }
      });
    };
    
    sortCommentsByDate(rootComments);
    
    return rootComments;
  }

  createCommentElement(comment, depth = null) {
    // Validate input first
    if (!comment) {
      const errorElement = document.createElement('div');
      errorElement.className = 'comment-error';
      errorElement.textContent = 'Invalid comment data';
      return errorElement;
    }
    
    try {
      // Use the depth from comment object or parameter, with fallback to 0
      const commentDepth = depth !== null ? depth : (comment.depth || 0);
      
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      commentDiv.setAttribute('data-depth', commentDepth); // Add data-depth attribute for CSS styling
      
      // Detect mobile view with correct media query
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      
      // Apply appropriate indentation based on device type
      // Mobile: drastically reduced indentation to prevent overflow
      if (isMobile) {
        // Usa indentazione minima per commenti annidati su mobile
        // Usa un valore fisso molto piccolo invece di moltiplicare per la profondità
        const mobileIndent = 1; // Valore fisso di 4px per tutti i livelli di nidificazione
        
        if (commentDepth > 0) {
          commentDiv.style.marginLeft = `${mobileIndent}px`; // Margine fisso piccolo
          commentDiv.style.paddingLeft = `${mobileIndent}px`; // Padding fisso piccolo
        } else {
          // Per commenti di primo livello, nessun bordo o indentazione
          commentDiv.style.borderLeft = 'none';
          commentDiv.style.marginLeft = '0';
          commentDiv.style.paddingLeft = '0';
        }
      } else {
        // Desktop: normal indentation
        commentDiv.style.marginLeft = `${Math.min(commentDepth * 2, 2)}px`; // Normal margin for desktop, max 40px
        commentDiv.style.paddingLeft = `${Math.min(commentDepth * 1, 1)}px`; // Normal padding for desktop, max 20px
      }
      
      // Add critical data attributes for finding this comment later
      commentDiv.setAttribute('data-author', comment.author);
      commentDiv.setAttribute('data-permlink', comment.permlink);
      
      if (comment.isNew) {
        commentDiv.classList.add('new-comment');
      }

      // Comment header
      const commentHeader = document.createElement('div');
      commentHeader.className = 'comment-header';

      // Author container
      const authorContainer = document.createElement('div');
      authorContainer.className = 'author-container';

      const authorAvatar = document.createElement('img');
      authorAvatar.className = 'author-avatar small';
      authorAvatar.src = `https://steemitimages.com/u/${comment.author}/avatar`;
      authorAvatar.alt = comment.author;
      authorAvatar.loading = 'lazy'; // Add lazy loading for images

      const authorName = document.createElement('a');
      authorName.href = "javascript:void(0)";
      authorName.className = 'author-name';
      authorName.textContent = `@${comment.author}`;
      authorName.setAttribute('aria-label', `View profile of ${comment.author}`);
      authorName.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(`/@${comment.author}`);
      });

      // Add replyCount only if there are any replies
      if (comment.children && comment.children.length > 0) {
        const replyCountBadge = document.createElement('span');
        replyCountBadge.className = 'replies-count';
        replyCountBadge.textContent = `${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}`;
        authorContainer.appendChild(authorAvatar);
        authorContainer.appendChild(authorName);
        authorContainer.appendChild(replyCountBadge);
      } else {
        authorContainer.appendChild(authorAvatar);
        authorContainer.appendChild(authorName);
      }

      // Date container
      const dateContainer = document.createElement('div');
      dateContainer.className = 'date-container';

 
      const commentDate = document.createElement('time');
      commentDate.className = 'comment-date';
      const postDate = new Date(comment.created);

       // Calculate time elapsed since post creation in minutes
       const timeElapsed = Math.floor((Date.now() - postDate.getTime()) / 1000 / 60);
       if (timeElapsed < 60) {
        commentDate.textContent = `${timeElapsed} min ago`;
       } else if (timeElapsed < 24 * 60) {
         // Convert minutes to hours
         commentDate.textContent = `${Math.floor(timeElapsed / 60)} hours ago`;
       } else if (timeElapsed < 30 * 24 * 60) {
         // Convert minutes to days
         commentDate.textContent = `${Math.floor(timeElapsed / (24 * 60))} days ago`;
       } else if (timeElapsed < 365 * 24 * 60) {
         // Convert minutes to months
         commentDate.textContent = `${Math.floor(timeElapsed / (30 * 24 * 60))} months ago`;
       } else {
         date.textContent = postDate.toLocaleDateString(undefined, {
           year: 'numeric',
           month: 'short',
           day: 'numeric'
         });
       }
      dateContainer.appendChild(commentDate);
      commentHeader.appendChild(authorContainer);
      commentHeader.appendChild(dateContainer);

      // Comment body
      const commentBody = document.createElement('div');
      commentBody.className = 'comment-body';

      try {
        if (!this.contentRenderer) {
          throw new Error('ContentRenderer not available');
        }
        
        const renderedComment = this.contentRenderer.render({
          body: comment.body || ''
        });
        
        if (renderedComment && renderedComment.container && 
            renderedComment.container.nodeType === Node.ELEMENT_NODE) {
          commentBody.appendChild(renderedComment.container);
        } else {
          throw new Error('Renderer did not return a valid node');
        }
      } catch (renderError) {
        const fallbackContent = document.createElement('div');
        fallbackContent.className = 'comment-text-fallback';
        fallbackContent.textContent = comment.body || '';
        commentBody.appendChild(fallbackContent);
      }

      // Comment actions
      const commentActions = document.createElement('div');
      commentActions.className = 'comment-actions';

      const upvoteBtn = document.createElement('button');
      upvoteBtn.className = 'action-btn upvote-btn';
      upvoteBtn.setAttribute('aria-label', `Upvote comment by ${comment.author}`);
      
      const upvoteIcon = document.createElement('span');
      upvoteIcon.className = 'material-icons';
      upvoteIcon.textContent = 'thumb_up';
      upvoteIcon.setAttribute('aria-hidden', 'true');
      
      const upvoteCount = document.createElement('span');
      upvoteCount.className = 'count';
      // Fix: Properly count and display the number of votes from active_votes array
      const votesCount = Array.isArray(comment.active_votes) ? comment.active_votes.length : 0;
      upvoteCount.textContent = votesCount;
      
      upvoteBtn.appendChild(upvoteIcon);
      upvoteBtn.appendChild(upvoteCount);

      const replyBtn = document.createElement('button');
      replyBtn.className = 'action-btn reply-btn';
      replyBtn.textContent = 'Reply';
      replyBtn.setAttribute('aria-label', `Reply to ${comment.author}'s comment`);
      replyBtn.setAttribute('aria-expanded', 'false');
      replyBtn.dataset.author = comment.author; // Store for debugging

      commentActions.appendChild(upvoteBtn);
      commentActions.appendChild(replyBtn);

      // Reply form with improved accessibility and functionality
      const replyForm = document.createElement('div');
      replyForm.className = 'reply-form';
      replyForm.style.display = 'none';
      
      const replyTextarea = document.createElement('textarea');
      replyTextarea.placeholder = `Reply to @${comment.author}...`;
      replyTextarea.setAttribute('aria-label', `Reply to ${comment.author}`);
      replyTextarea.id = `reply-textarea-${comment.author}-${Date.now()}`;

      const submitReplyBtn = document.createElement('button');
      submitReplyBtn.className = 'submit-reply';
      submitReplyBtn.textContent = 'Post Reply';
      submitReplyBtn.type = 'button'; // Explicit button type

      replyForm.appendChild(replyTextarea);
      replyForm.appendChild(submitReplyBtn);

      // Initially disable form with inert attribute
      if ('inert' in replyForm) {
        replyForm.inert = true;
      }

      // Append all to comment div
      commentDiv.appendChild(commentHeader);
      commentDiv.appendChild(commentBody);
      commentDiv.appendChild(commentActions);
      commentDiv.appendChild(replyForm);

      // Add reply button handler with fixes for form display issues
      replyBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default button behavior
        
        const isVisible = replyForm.style.display !== 'none';
        
        // Close any other open reply forms first
        if (this.activeReplyForm && this.activeReplyForm !== replyForm) {
          this.closeReplyForm(this.activeReplyForm);
        }
        
        if (isVisible) {
          this.closeReplyForm(replyForm, replyBtn);
        } else {
          this.openReplyForm(replyForm, replyBtn, replyTextarea);
        }
      });

      // Add submit reply handler with improved reliability
      if (this.handleReplyCallback) {
        const submitReply = () => {
          const replyText = replyTextarea.value.trim();
          
          if (replyText) {
            try {
              this.handleReplyCallback(comment, replyText);
              replyTextarea.value = '';
              this.closeReplyForm(replyForm, replyBtn);
            } catch (error) {
              console.error('Error submitting reply:', error);
              alert('Sorry, there was an error submitting your reply. Please try again.');
            }
          }
        };
        
        submitReplyBtn.addEventListener('click', submitReply);
        
        // Allow submitting with Ctrl+Enter
        replyTextarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submitReply();
          }
        });
      } else {
        submitReplyBtn.disabled = true;
        submitReplyBtn.title = 'Reply functionality not available';
      }

      // Add upvote button handler
      if (this.handleVoteCallback) {
        upvoteBtn.addEventListener('click', () => {
          this.handleVoteCallback(comment, upvoteBtn);
        });
      }

      // Check if user has already voted
      this.checkCommentVoteStatus(comment, upvoteBtn);

      // Render child comments
      if (comment.children && comment.children.length > 0) {
        // Create replies container with proper structure for our CSS
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies';
        
        // IMPORTANTE: Aggiungo attributo data-level per controllare l'indentazione in CSS
        repliesContainer.setAttribute('data-level', commentDepth); 
        
        // Create wrapper for replies as per our CSS
        const repliesWrapper = document.createElement('div');
        repliesWrapper.className = 'replies-wrapper';
        
        // Sort replies chronologically
        const sortedReplies = [...comment.children].sort((a, b) => 
          new Date(a.created) - new Date(b.created)
        );

        // IMPORTANTE: non incrementare la profondità quando creiamo gli elementi figlio
        // Usiamo lo stesso commentDepth per tutti i figli, poiché l'indentazione viene
        // gestita dalla struttura HTML e dal CSS
        sortedReplies.forEach(reply => {
          const replyElement = this.createCommentElement(reply, commentDepth + 1);
          repliesWrapper.appendChild(replyElement);
        });

        repliesContainer.appendChild(repliesWrapper);
        commentDiv.appendChild(repliesContainer);
      }

      return commentDiv;
    } catch (error) {
      const errorElement = document.createElement('div');
      errorElement.className = 'comment-error';
      errorElement.textContent = `Error displaying comment`;
      return errorElement;
    }
  }
  
  // Adding the missing renderReplies method
  renderReplies(parentElement, comment) {
    if (!comment.children || comment.children.length === 0) return;
    
    // Create a container for replies if it doesn't exist
    let repliesContainer = parentElement.querySelector('.replies');
    if (!repliesContainer) {
      repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';
      repliesContainer.setAttribute('data-level', comment.depth || 0);
      
      const repliesWrapper = document.createElement('div');
      repliesWrapper.className = 'replies-wrapper';
      
      repliesContainer.appendChild(repliesWrapper);
      parentElement.appendChild(repliesContainer);
    }
    
    // Get the wrapper where replies should be added
    const repliesWrapper = repliesContainer.querySelector('.replies-wrapper');
    if (!repliesWrapper) return;
    
    // Clear existing replies
    while (repliesWrapper.firstChild) {
      repliesWrapper.removeChild(repliesWrapper.firstChild);
    }
    
    // Sort replies chronologically
    const sortedReplies = [...comment.children].sort((a, b) => 
      new Date(a.created) - new Date(b.created)
    );
    
    // Render each reply
    sortedReplies.forEach(reply => {
      const replyElement = this.createCommentElement(reply, (comment.depth || 0) + 1);
      repliesWrapper.appendChild(replyElement);
      
      // Recursively render replies to this reply
      if (reply.children && reply.children.length > 0) {
        this.renderReplies(replyElement, reply);
      }
    });
  }

  toggleRepliesCollapse(comment, repliesWrapper, collapseBtn) {
    const commentKey = `${comment.author}/${comment.permlink}`;
    const isCurrentlyCollapsed = this.collapsedComments.has(commentKey);
    
    // Toggle the collapsed state
    if (isCurrentlyCollapsed) {
      this.collapsedComments.delete(commentKey);
      repliesWrapper.style.display = 'block';
      collapseBtn.innerHTML = `
        <span class="material-icons">expand_less</span>
        <span class="collapse-text">Hide ${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}</span>
      `;
      
      // Animate the expansion
      repliesWrapper.style.maxHeight = '0';
      setTimeout(() => {
        repliesWrapper.style.maxHeight = `${repliesWrapper.scrollHeight}px`;
      }, 10);
      
      // Remove the animation properties after it completes
      setTimeout(() => {
        repliesWrapper.style.maxHeight = '';
      }, 300);
    } else {
      this.collapsedComments.add(commentKey);
      
      // Animate the collapse
      repliesWrapper.style.maxHeight = `${repliesWrapper.scrollHeight}px`;
      setTimeout(() => {
        repliesWrapper.style.maxHeight = '0';
      }, 10);
      
      // Hide after animation completes
      setTimeout(() => {
        repliesWrapper.style.display = 'none';
        repliesWrapper.style.maxHeight = '';
      }, 300);
      
      collapseBtn.innerHTML = `
        <span class="material-icons">expand_more</span>
        <span class="collapse-text">Show ${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}</span>
      `;
    }
  }
  
  // Helper method to close a reply form with proper cleanup
  closeReplyForm(replyForm, replyBtn) {
    if (!replyForm) return;
    
    // First set display none to hide it visually
    replyForm.style.display = 'none';
    
    // Then set the button state if provided
    if (replyBtn) {
      replyBtn.setAttribute('aria-expanded', 'false');
    }
    
    // Finally make it inert if supported (do this after hiding)
    if ('inert' in replyForm) {
      replyForm.inert = true;
    }
    
    // Clear active form reference if this was the active one
    if (this.activeReplyForm === replyForm) {
      this.activeReplyForm = null;
    }
  }
  
  // Helper method to open a reply form with proper setup
  openReplyForm(replyForm, replyBtn, replyTextarea) {
    if (!replyForm) return;
    
    // First remove inert to enable interactions (before showing)
    if ('inert' in replyForm) {
      replyForm.inert = false;
    }
    
    // Then show it visually
    replyForm.style.display = 'block';
    
    // Then update button state
    if (replyBtn) {
      replyBtn.setAttribute('aria-expanded', 'true');
    }
    
    // Focus the textarea after a short delay to ensure it's visible and interactive
    if (replyTextarea) {
      setTimeout(() => {
        try {
          replyTextarea.focus();
        } catch (e) {
        }
      }, 100);
    }
    
    // Track this as the active form
    this.activeReplyForm = replyForm;
  }

  async checkCommentVoteStatus(comment, upvoteBtn) {
    try {
      const vote = await voteService.hasVoted(comment.author, comment.permlink);
      if (vote) {
        upvoteBtn.classList.add('voted');
        
        // Update icon to filled version
        const iconElement = upvoteBtn.querySelector('.material-icons');
        if (iconElement) {
          iconElement.textContent = 'thumb_up_alt';
        }

        // Add vote percentage indicator
        if (vote.percent > 0) {
          const percentIndicator = document.createElement('span');
          percentIndicator.className = 'vote-percent-indicator';
          percentIndicator.textContent = `${vote.percent / 100}%`;
          upvoteBtn.appendChild(percentIndicator);
        }
      }
    } catch (err) {
      console.warn('Error checking vote status:', err);
    }
  }

  updateComments(newComments) {
    // Close any open reply forms before updating
    if (this.activeReplyForm) {
      this.closeReplyForm(this.activeReplyForm);
    }
    
    // Mark any new comments for highlighting
    if (newComments && this.comments) {
      const existingPermalinks = new Set(this.comments.map(c => c.permlink));
      newComments.forEach(comment => {
        if (!existingPermalinks.has(comment.permlink)) {
          comment.isNew = true; // Flag for highlighting with the new-comment class
        }
      });
    }
    
    this.comments = newComments || [];
    
    // Try to re-fetch replies to ensure proper structure
    // Use a lighter version of fetchAllReplies that doesn't show loading indicator
    this.quickRefreshReplies().then(() => {
      // Then render comments with the updated tree
      this.renderComments();
      
      // Update the comments count in header
      const commentsHeader = this.element?.querySelector('h3');
      if (commentsHeader) {
        commentsHeader.textContent = `Comments (${this.comments.length})`;
      }
    }).catch(err => {
      // Fallback to just rendering what we have
      this.renderComments();
    });
  }
  
  /**
   * A lighter version of fetchAllReplies that doesn't show loading indicator
   * Used when quickly refreshing after new comments are added
   */
  async quickRefreshReplies() {
    if (!this.comments || this.comments.length === 0 || !this.parentPost) return;
    
    try {
      // Create a map of existing comments
      const allCommentsMap = new Map();
      this.comments.forEach(c => allCommentsMap.set(`${c.author}/${c.permlink}`, c));
      
      // Get direct replies to the post to ensure we have all top-level comments
      const directReplies = await steemApi.getContentReplies(
        this.parentPost.author, 
        this.parentPost.permlink
      );
      
      // Add new direct replies if any
      let newCommentsFound = false;
      directReplies.forEach(reply => {
        const key = `${reply.author}/${reply.permlink}`;
        if (!allCommentsMap.has(key)) {
          allCommentsMap.set(key, reply);
          newCommentsFound = true;
        }
      });
      
      // Only refresh the whole tree if we found new comments
      if (newCommentsFound) {
        // Get all comments for processing
        const allComments = Array.from(allCommentsMap.values());
        
        // For each comment, fetch its replies
        for (const comment of allComments) {
          try {
            const replies = await steemApi.getContentReplies(comment.author, comment.permlink);
            
            if (replies && replies.length > 0) {
              for (const reply of replies) {
                const key = `${reply.author}/${reply.permlink}`;
                if (!allCommentsMap.has(key)) {
                  allCommentsMap.set(key, reply);
                  allComments.push(reply); // Add to processing queue
                }
              }
            }
          } catch (err) {
          }
        }
        
        // Update the comments array with all found comments
        this.comments = Array.from(allCommentsMap.values());
      }
      
    } catch (error) {
    }
  }
  
  /**
   * Add a new comment to the UI without refreshing the entire page
   * @param {Object} commentResult - The result from comment creation
   */
  addNewComment(commentResult) {
    if (!commentResult || !commentResult.success) {
      return;
    }
    
    try {
      // Create a new comment object with the necessary properties
      const newComment = {
        author: commentResult.author,
        permlink: commentResult.permlink,
        parent_author: this.parentPost?.author || '',
        parent_permlink: this.parentPost?.permlink || '',
        body: commentResult.body,
        created: new Date().toISOString(),
        net_votes: 0,
        active_votes: [],
        children: [],
        depth: 0, // top-level comment
        isNew: true // Mark as new for highlighting
      };
      
      // Add to comments array
      if (!this.comments) this.comments = [];
      this.comments.push(newComment);
      
      // Create a proper comment element
      const commentElement = this.createCommentElement(newComment);
      
      // Update the comments list container
      if (this.commentsListContainer) {
        // Append the new comment to the comments list
        this.commentsListContainer.appendChild(commentElement);
        
        // Update the comment count in the header
        const commentsHeader = this.element?.querySelector('h3');
        if (commentsHeader) {
          commentsHeader.textContent = `Comments (${this.comments.length})`;
        }
        
        // Scroll to the new comment
        setTimeout(() => {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (error) {
      // Fallback method: do a full refresh of comments
      this.quickRefreshReplies().then(() => {
        this.renderComments();
      }).catch(err => {
      });
    }
  }

  unmount() {
    // Close any open reply forms
    if (this.activeReplyForm) {
      try {
        this.closeReplyForm(this.activeReplyForm, this.activeReplyBtn);
      } catch (e) {
      }
    }
    
    // Remove all references to avoid memory leaks
    this.comments = null;
    this.parentPost = null;
    this.handleReplyCallback = null;
    this.handleVoteCallback = null;
    this.contentRenderer = null;
    this.commentsListContainer = null;
    this.element = null;
    this.activeReplyForm = null;
    this.activeReplyBtn = null;
    this.collapsedComments = null;
  }

  // Add a diagnostic method to help troubleshoot
  diagnoseCommentIssues() {
    console.log('=========== COMMENTS DIAGNOSTIC ===========');
    console.log(`Total comments loaded: ${this.comments.length}`);
    
    // Check if parentPost is valid
    if (!this.parentPost) {
      console.error('Parent post is missing!');
    } else {
      console.log(`Parent post permlink: ${this.parentPost.permlink}`);
    }
    
    // Check direct replies to post
    const directReplies = this.comments.filter(c => 
      c.parent_permlink === this.parentPost?.permlink
    );
    console.log(`Direct replies to post: ${directReplies.length}`);
    
    // Check for comments with missing parents
    const commentsWithMissingParents = this.comments.filter(c => {
      // Skip root comments
      if (c.parent_permlink === this.parentPost?.permlink) return false;
      
      // Check if parent comment exists in our collection
      return !this.comments.some(p => p.permlink === c.parent_permlink);
    });
    
    console.log(`Comments with missing parent: ${commentsWithMissingParents.length}`);
    
    // Log the first few problem comments if any
    if (commentsWithMissingParents.length > 0) {
      console.log('Examples of comments with missing parents:');
      commentsWithMissingParents.slice(0, 3).forEach(c => {
        console.log(`- Comment ${c.permlink} by ${c.author} looking for parent ${c.parent_permlink}`);
      });
    }
    
    console.log('=========================================');
  }
}

export default CommentsSection;
