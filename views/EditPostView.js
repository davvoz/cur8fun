import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import editPostService from '../services/EditPostService.js';
import communityService from '../services/CommunityService.js';

class EditPostView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Edit Post';
    this.user = authService.getCurrentUser();
    this.postTitle = '';
    this.postBody = '';
    this.tags = [];
    this.selectedCommunity = null;
    this.isSubmitting = false;
    this.markdownEditor = null;

    // Original post data
    this.originalPost = null;
    this.author = params.author || '';
    this.permlink = params.permlink || '';
    
    this.isLoading = true;
    this.loadError = null;

    // Timeout per la ricerca community
    this.searchTimeout = null;

    // Reference per i gestori eventi esterni
    this.outsideClickHandler = null;
    this.keyDownHandler = null;
  }

  async render(element) {
    this.element = element;

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Verifica che l'utente sia loggato
    if (!this.user) {
      this.renderLoginRequired();
      return;
    }

    // Show loading state
    this.renderLoadingState();

    try {
      // Load the post data
      await this.loadPostData();

      // Check if post was found
      if (!this.originalPost) {
        this.renderNotFound();
        return;
      }

      // Check if user is the author
      if (this.user.username !== this.originalPost.author) {
        this.renderNotAuthorized();
        return;
      }

      // Render the edit form with loaded data
      this.renderEditForm();
    } catch (error) {
      console.error('Error loading post:', error);
      this.loadError = error.message;
      this.renderError();
    }
  }

  async loadPostData() {
    if (!this.author || !this.permlink) {
      this.loadError = 'Post not found. Missing author or permlink.';
      throw new Error(this.loadError);
    }

    try {
      this.originalPost = await editPostService.getPost(this.author, this.permlink);
      
      // Set initial values from the post
      this.postTitle = this.originalPost.title;
      this.postBody = this.originalPost.body;
      this.tags = this.originalPost.tags || [];
      
      // Set community if available
      if (this.originalPost.community) {
        this.selectedCommunity = { name: this.originalPost.community };
      }
      
      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.loadError = error.message;
      throw error;
    }
  }

  renderLoadingState() {
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.innerHTML = `
      <div class="spinner"></div>
      <p>Loading post data...</p>
    `;
    this.element.appendChild(loadingContainer);
  }

  renderNotFound() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Post Not Found</h2>
      <p>The post you're trying to edit could not be found.</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderNotAuthorized() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Not Authorized</h2>
      <p>You can only edit your own posts.</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderError() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Error Loading Post</h2>
      <p>${this.loadError || 'An unknown error occurred.'}</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderEditForm() {
    // Clear container first
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create post editor container
    const postEditor = document.createElement('div');
    postEditor.className = 'post-editor-container';

    // Create header
    const header = document.createElement('header');
    header.className = 'editor-header';

    const heading = document.createElement('h1');
    heading.textContent = 'Edit Post';
    header.appendChild(heading);

    // Create form
    const form = document.createElement('form');
    form.className = 'post-form';
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Status message container
    const statusArea = document.createElement('div');
    statusArea.id = 'post-status-message';
    statusArea.className = 'status-message hidden';
    form.appendChild(statusArea);

    // Community selection
    const communityGroup = document.createElement('div');
    communityGroup.className = 'form-group';

    const communityLabel = document.createElement('label');
    communityLabel.htmlFor = 'community-selector';
    communityLabel.textContent = 'Community';
    communityGroup.appendChild(communityLabel);

    // Dropdown container
    const communityContainer = document.createElement('div');
    communityContainer.className = 'community-selector-container';

    // Contenitore per l'input con i bottoni
    const inputGroup = document.createElement('div');
    inputGroup.className = 'community-input-group';

    // Bottone per mostrare le community iscritte
    const showSubscribedBtn = document.createElement('button');
    showSubscribedBtn.type = 'button';
    showSubscribedBtn.className = 'show-subscribed-btn';
    showSubscribedBtn.title = 'Show your subscribed communities';
    showSubscribedBtn.innerHTML = '<span class="material-icons">people</span>';
    showSubscribedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSubscribedCommunities();
    });
    inputGroup.appendChild(showSubscribedBtn);

    // Input per ricerca community
    const communitySearch = document.createElement('input');
    communitySearch.type = 'text';
    communitySearch.id = 'community-search';
    communitySearch.className = 'community-search-input';
    communitySearch.placeholder = 'Search or select a community';
    inputGroup.appendChild(communitySearch);

    // Set initial community value if available
    if (this.selectedCommunity) {
      communitySearch.value = this.selectedCommunity.name;
      communitySearch.setAttribute('data-selected', 'true');
    }

    // Add an event listener to allow searching when user types
    communitySearch.addEventListener('input', (e) => {
      // Non fare ricerca se l'input è vuoto o è molto breve
      if (!e.target.value.trim() || e.target.value.trim().length < 2) {
        return;
      }
      
      // Cancel previous timeout
      clearTimeout(this.searchTimeout);
      
      // Setup a new timeout
      this.searchTimeout = setTimeout(() => {
        this.searchCommunities(e.target.value);
      }, 300);
      
      // Mostra il pulsante di pulizia se c'è testo nell'input
      const clearBtn = document.getElementById('clear-community-btn');
      if (clearBtn) {
        if (e.target.value.trim()) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
    });

    // Toggle dropdown on click 
    communitySearch.addEventListener('click', (e) => {
      this.toggleDropdown();
    });

    // Bottone per cancellare la selezione (inizialmente nascosto)
    const clearSelectionBtn = document.createElement('button');
    clearSelectionBtn.type = 'button';
    clearSelectionBtn.className = 'clear-selection-btn';
    clearSelectionBtn.title = 'Clear selection';
    clearSelectionBtn.innerHTML = '<span class="material-icons">close</span>';
    clearSelectionBtn.id = 'clear-community-btn';

    // Fix the conditional class adding - don't use empty string as a class
    if (!this.selectedCommunity) {
      clearSelectionBtn.classList.add('hidden');
    }

    clearSelectionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearCommunitySelection();
    });
    inputGroup.appendChild(clearSelectionBtn);

    communityContainer.appendChild(inputGroup);

    // Dropdown risultati
    const communityDropdown = document.createElement('div');
    communityDropdown.className = 'community-dropdown';
    communityDropdown.id = 'community-dropdown';
    communityContainer.appendChild(communityDropdown);

    communityGroup.appendChild(communityContainer);

    // Help text
    const communityHelp = document.createElement('small');
    communityHelp.className = 'form-text';
    communityHelp.textContent = 'Select a community to post in, or leave empty to post on your personal blog.';
    communityGroup.appendChild(communityHelp);

    form.appendChild(communityGroup);

    // Title input
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';

    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'post-title';
    titleLabel.textContent = 'Title';
    titleGroup.appendChild(titleLabel);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'post-title';
    titleInput.className = 'form-control';
    titleInput.placeholder = 'Enter a title for your post';
    titleInput.required = true;
    titleInput.value = this.postTitle;
    titleInput.addEventListener('input', (e) => {
      this.postTitle = e.target.value;
    });
    titleGroup.appendChild(titleInput);

    form.appendChild(titleGroup);

    // Content editor - Sostituiamo il textarea con MarkdownEditor
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';

    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'markdown-editor-container';
    contentLabel.textContent = 'Content';
    contentGroup.appendChild(contentLabel);

    // Container per l'editor Markdown
    const editorContainer = document.createElement('div');
    editorContainer.id = 'markdown-editor-container';
    contentGroup.appendChild(editorContainer);

    form.appendChild(contentGroup);

    // Tags input
    const tagsGroup = document.createElement('div');
    tagsGroup.className = 'form-group';

    const tagsLabel = document.createElement('label');
    tagsLabel.htmlFor = 'post-tags';
    tagsLabel.textContent = 'Tags';
    tagsGroup.appendChild(tagsLabel);

    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.id = 'post-tags';
    tagsInput.className = 'form-control';
    tagsInput.placeholder = 'Enter tags separated by spaces (e.g., steem art photography)';
    tagsInput.value = this.tags.join(' ');
    tagsInput.addEventListener('input', (e) => {
      this.tags = e.target.value.split(' ').filter(tag => tag.trim() !== '');
    });
    tagsGroup.appendChild(tagsInput);

    const tagsHelp = document.createElement('small');
    tagsHelp.className = 'form-text';
    tagsHelp.textContent = 'Add up to 5 tags to help categorize your post. The first tag becomes the main category.';
    tagsGroup.appendChild(tagsHelp);

    form.appendChild(tagsGroup);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn primary-btn';
    submitBtn.id = 'submit-post-btn';
    submitBtn.textContent = 'Update Post';
    form.appendChild(submitBtn);

    // Add Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn secondary-btn';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      window.history.back();
    });
    form.appendChild(cancelBtn);

    // Append form to container
    postEditor.appendChild(header);
    postEditor.appendChild(form);

    // Add the container to the page
    this.element.appendChild(postEditor);

    // Inizializza l'editor Markdown
    this.markdownEditor = new MarkdownEditor(
      document.getElementById('markdown-editor-container'),
      {
        placeholder: 'Write your post content here using Markdown...',
        onChange: (value) => {
          this.postBody = value;
        },
        height: '500px',
        initialValue: this.postBody || ''
      }
    );
    this.markdownEditor.render();

    // Carica community iscritte inizialmente
    this.loadSubscribedCommunities();

    // Add resize listener to reposition dropdown when window resizes
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Imposta i gestori per chiudere i dropdown
    this.setupKeyboardHandler();
  }

  /**
   * Imposta il gestore per chiudere il dropdown con tasto ESC
   */
  setupKeyboardHandler() {
    // Rimuovi eventuali listener precedenti
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }

    // Crea nuovo handler per il tasto ESC
    this.keyDownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeDropdown();
      }
    };

    // Aggiungi listener
    document.addEventListener('keydown', this.keyDownHandler);
  }

  /**
   * Imposta il gestore per click esterni al dropdown
   */
  setupOutsideClickHandler() {
    // Rimuovi eventuali listener precedenti
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
    }

    // Timeout per evitare che il click che ha aperto il dropdown lo chiuda immediatamente
    setTimeout(() => {
      const dropdown = document.getElementById('community-dropdown');
      const searchInput = document.getElementById('community-search');
      const subscribeBtn = document.querySelector('.show-subscribed-btn');
      
      // Non procedere se il dropdown non è aperto
      if (!dropdown || !dropdown.classList.contains('dropdown-active')) {
        return;
      }

      // Crea nuovo handler per click esterni
      this.outsideClickHandler = (e) => {
        // Non chiudere se il click è sul dropdown, sull'input di ricerca o sul bottone subscribe
        if (dropdown.contains(e.target) || 
            (searchInput && searchInput.contains(e.target)) || 
            (subscribeBtn && subscribeBtn.contains(e.target))) {
          return;
        }
        
        // Chiudi il dropdown per i click esterni
        this.closeDropdown();
      };

      // Aggiungi listener
      document.addEventListener('click', this.outsideClickHandler);
    }, 100);
  }

  /**
   * Carica le community sottoscritte dall'utente
   */
  async loadSubscribedCommunities() {
    try {
      if (!this.user) return;

      const communitySearch = document.getElementById('community-search');
      const dropdown = document.getElementById('community-dropdown');

      // Mostra il caricamento
      dropdown.innerHTML = '<div class="dropdown-loading">Loading your communities</div>';
      dropdown.classList.add('dropdown-active');

      // Position dropdown based on available space
      this.positionDropdown();

      const subscriptions = await communityService.getSubscribedCommunities(this.user.username);

      // Visualizza le community sottoscritte
      this.renderCommunityOptions(subscriptions, 'Your Communities');
    } catch (error) {
      console.error('Failed to load subscribed communities:', error);
      const dropdown = document.getElementById('community-dropdown');
      dropdown.innerHTML = '<div class="dropdown-error">Failed to load communities</div>';
    }
  }

  /**
   * Position the dropdown based on available space
   */
  positionDropdown() {
    const dropdown = document.getElementById('community-dropdown');
    const communityContainer = document.querySelector('.community-selector-container');
    
    if (!dropdown || !communityContainer) return;
    
    // Check if there's enough space on the right
    const containerRect = communityContainer.getBoundingClientRect();
    const availableSpaceRight = window.innerWidth - containerRect.right - 20;
    
    // If there's space on the right, show on the side (floating dropdown)
    if (availableSpaceRight >= 340) {
      dropdown.style.left = 'calc(100% + 15px)';
      dropdown.style.top = '-10px';
      dropdown.classList.remove('show-below');
      
      // Add the arrow for side positioning
      dropdown.classList.add('show-side');
    } else {
      // Default position below
      dropdown.style.left = '0';
      dropdown.style.top = 'calc(100% + 5px)';
      dropdown.classList.remove('show-side');
      dropdown.classList.add('show-below');
    }
  }

  /**
   * Cerca community in base alla query
   * @param {string} query - Query di ricerca
   */
  async searchCommunities(query) {
    const dropdown = document.getElementById('community-dropdown');
    dropdown.classList.add('dropdown-active');
    
    // Position dropdown based on available space
    this.positionDropdown();
    
    // Imposta il gestore per click esterni
    this.setupOutsideClickHandler();

    if (!query || query.trim() === '') {
      // Se la query è vuota, mostra le community sottoscritte
      return this.loadSubscribedCommunities();
    }

    try {
      // Mostra spinner di caricamento
      dropdown.innerHTML = '<div class="dropdown-loading">Searching for communities</div>';

      // Cerca community
      const results = await communityService.searchCommunities(query, 10);

      // Visualizza risultati
      this.renderCommunityOptions(results, 'Search Results');
    } catch (error) {
      console.error('Failed to search communities:', error);
      dropdown.innerHTML = '<div class="dropdown-error">Error searching communities</div>';
    }
  }

  /**
   * Toggle dropdown on click 
   */
  toggleDropdown() {
    const dropdown = document.getElementById('community-dropdown');
    
    if (dropdown.classList.contains('dropdown-active')) {
      this.closeDropdown();
    } else {
      dropdown.classList.add('dropdown-active');
      // Position dropdown based on available space
      this.positionDropdown();
      // Imposta il gestore per click esterni
      this.setupOutsideClickHandler();
    }
  }

  /**
   * Close the community dropdown
   */
  closeDropdown() {
    const dropdown = document.getElementById('community-dropdown');
    const communitySearch = document.getElementById('community-search');

    if (dropdown) dropdown.classList.remove('dropdown-active');
    if (communitySearch) communitySearch.classList.remove('dropdown-active');
    
    // Rimuovi il gestore di click esterni quando chiudi il dropdown
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  /**
   * Visualizza le opzioni delle community nel dropdown
   * @param {Array} communities - Lista di community
   * @param {string} headerText - Testo dell'header
   */
  renderCommunityOptions(communities, headerText) {
    const dropdown = document.getElementById('community-dropdown');
    dropdown.innerHTML = '';

    if (!communities || communities.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-empty">No communities found</div>';
      return;
    }

    // Header dropdown
    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = headerText;
    dropdown.appendChild(header);

    // Lista community
    const list = document.createElement('ul');
    list.className = 'community-list';

    communities.forEach(community => {
      const item = document.createElement('li');
      item.className = 'community-item simple-item';
      
      // Create container for better organization
      const contentContainer = document.createElement('div');
      contentContainer.className = 'community-content';

      // Usa un formato semplice con testo sottolineato
      const title = document.createElement('div');
      title.className = 'community-title-underlined';

      // Usa il titolo dalla community
      const displayTitle = community.title || (community.name ? community.name : 'Unnamed Community');
      title.textContent = displayTitle;

      // Aggiungi il ruolo della community se disponibile
      if (community.role && community.role !== 'guest') {
        const roleTag = document.createElement('span');
        roleTag.className = `role-tag role-${community.role}`;
        roleTag.textContent = community.role;
        title.appendChild(roleTag);
      }

      contentContainer.appendChild(title);
      
      // Aggiungi il nome come tag secondario
      if (community.name) {
        const nameTag = document.createElement('small');
        nameTag.className = 'community-name-small';
        nameTag.textContent = `@${community.id || ('hive-' + community.name)}`;
        contentContainer.appendChild(nameTag);
      }

      item.appendChild(contentContainer);

      // Click handler
      item.addEventListener('click', () => {
        this.selectCommunity(community);
      });

      list.appendChild(item);
    });

    dropdown.appendChild(list);
  }

  /**
   * Visualizza le community iscritte
   * Metodo dedicato attivato dal bottone sottoscrizioni
   */
  showSubscribedCommunities() {
    const dropdown = document.getElementById('community-dropdown');
    
    // Mostra il caricamento
    dropdown.innerHTML = '<div class="dropdown-loading">Loading your communities</div>';
    dropdown.classList.add('dropdown-active');
    
    // Position dropdown based on available space
    this.positionDropdown();
    
    // Imposta il gestore per click esterni
    this.setupOutsideClickHandler();
    
    // Carica le community sottoscritte
    this.loadSubscribedCommunities();
  }

  /**
   * Cancella la selezione della community
   */
  clearCommunitySelection() {
    // Rimuovi la community selezionata
    this.selectedCommunity = null;
    
    // Resetta l'input
    const searchInput = document.getElementById('community-search');
    searchInput.value = '';
    searchInput.setAttribute('data-selected', 'false');
    
    // Nascondi il pulsante di pulizia
    const clearBtn = document.getElementById('clear-community-btn');
    if (clearBtn) {
      clearBtn.classList.add('hidden');
    }
    
    // Dai focus all'input per permettere una nuova ricerca
    searchInput.focus();
  }

  /**
   * Seleziona una community
   * @param {Object} community - Community selezionata
   */
  selectCommunity(community) {
    this.selectedCommunity = community;
    
    // Aggiorna il display
    const searchInput = document.getElementById('community-search');
    const dropdown = document.getElementById('community-dropdown');
    const clearBtn = document.getElementById('clear-community-btn');
    
    // Update the input to show selected community
    searchInput.value = community.title || community.name;
    searchInput.setAttribute('data-selected', 'true');
    
    // Mostra il pulsante per cancellare la selezione
    if (clearBtn) {
      clearBtn.classList.remove('hidden');
    }
    
    // Close the dropdown
    dropdown.classList.remove('dropdown-active');
    searchInput.classList.remove('dropdown-active');
  }

  /**
   * Gestisce il submit del form
   * @param {Event} e - Evento submit
   */
  async handleSubmit(e) {
    e.preventDefault();

    if (this.isSubmitting) return;

    // Verifica dati
    if (!this.postTitle.trim()) {
      this.showError('Please enter a title for your post');
      return;
    }

    if (!this.postBody.trim()) {
      this.showError('Please enter content for your post');
      return;
    }

    if (this.tags.length === 0) {
      this.showError('Please add at least one tag');
      return;
    }

    if (this.tags.length > 5) {
      this.showError('You can only add up to 5 tags');
      return;
    }

    // Imposta stato di invio
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submit-post-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Updating...';

    try {
      // Notifica inizio aggiornamento
      this.showStatus('Updating your post...', 'info');

      // Prepare update data
      const updateData = {
        title: this.postTitle,
        body: this.postBody,
        tags: this.tags,
        author: this.originalPost.author,
        permlink: this.originalPost.permlink,
        parentPermlink: this.originalPost.parentPermlink,
        originalMetadata: this.originalPost.originalMetadata || {}
      };
      
      // Aggiungi la community se selezionata
      if (this.selectedCommunity) {
        updateData.community = this.selectedCommunity.name;
      }

      // Usa il servizio centralizzato per aggiornare post
      const result = await editPostService.updatePost(updateData);
      
      // Mostra messaggio di successo
      this.showStatus('Post updated successfully!', 'success');

      // Reindirizza alla pagina del post dopo un breve ritardo
      setTimeout(() => {
        window.location.href = `/app/@${this.originalPost.author}/${this.originalPost.permlink}`;
      }, 2000);
    } catch (error) {
      console.error('Failed to update post:', error);
      
      // Check if it's a cancellation
      if (error.isCancelled) {
        this.showStatus('Update cancelled.', 'info');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Post';
      } else {
        this.showError(`Failed to update post: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Post';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Mostra un messaggio di errore
   * @param {string} message - Messaggio di errore
   */
  showError(message) {
    this.showStatus(message, 'error');
  }

  /**
   * Mostra un messaggio di stato
   * @param {string} message - Messaggio da mostrare
   * @param {string} type - Tipo di messaggio (info, error, success)
   */
  showStatus(message, type = 'info') {
    const statusArea = document.getElementById('post-status-message');
    if (!statusArea) return;

    statusArea.textContent = message;
    statusArea.className = `status-message ${type}`;

    // Nascondi automaticamente dopo un po' se è un successo
    if (type === 'success') {
      setTimeout(() => {
        statusArea.className = 'status-message hidden';
      }, 5000);
    }
  }

  /**
   * Visualizza messaggio di login richiesto
   */
  renderLoginRequired() {
    const container = document.createElement('div');
    container.className = 'login-required-container';

    const message = document.createElement('div');
    message.className = 'login-message';
    message.innerHTML = `
      <h2>Login Required</h2>
      <p>You need to be logged in to edit a post.</p>
      <a href="/login" class="btn primary-btn">Login Now</a>
    `;

    container.appendChild(message);
    this.element.appendChild(container);
  }

  /**
   * Handle window resize events
   */
  handleResize() {
    const dropdown = document.getElementById('community-dropdown');
    if (dropdown && dropdown.classList.contains('dropdown-active')) {
      this.positionDropdown();
    }
  }

  /**
   * Pulisce gli event listener quando la vista viene smontata
   */
  unmount() {
    if (this.markdownEditor) {
      // Pulizia dell'editor Markdown
      this.markdownEditor = null;
    }

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Remove resize event listener
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Rimuovi il gestore di click esterni
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    
    // Rimuovi il gestore della tastiera
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }

    super.unmount();
  }
}

export default EditPostView;
