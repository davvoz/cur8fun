import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import communityService from '../services/CommunityService.js';
import eventEmitter from '../utils/EventEmitter.js';

class CreatePostView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Create Post';
    this.user = authService.getCurrentUser();
    this.postTitle = '';
    this.postBody = '';
    this.tags = [];
    this.selectedCommunity = null;
    this.isSubmitting = false;
    this.markdownEditor = null;

    // Timeout per la ricerca community
    this.searchTimeout = null;
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

    // Create post editor container
    const postEditor = document.createElement('div');
    postEditor.className = 'post-editor-container';

    // Create header
    const header = document.createElement('header');
    header.className = 'editor-header';

    const heading = document.createElement('h1');
    heading.textContent = 'Create New Post';
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

    // Search icon
    const searchIcon = document.createElement('span');
    searchIcon.className = 'material-icons community-search-icon';
    searchIcon.textContent = 'people';
    communityContainer.appendChild(searchIcon);

    // Input per ricerca community
    const communitySearch = document.createElement('input');
    communitySearch.type = 'text';
    communitySearch.id = 'community-search';
    communitySearch.className = 'community-search-input';
    communitySearch.placeholder = 'Select or search community';
    communitySearch.readOnly = window.innerWidth > 768;

    // Add event listener for focus to make the input writeable
    communitySearch.addEventListener('focus', () => {
      communitySearch.readOnly = false;
      const dropdown = document.getElementById('community-dropdown');

      // Only show dropdown on focus for larger screens
      // On mobile, wait for click to show the dropdown
      if (window.innerWidth > 768) {
        dropdown.classList.add('dropdown-active');
        communitySearch.classList.add('dropdown-active');

        // If opening the dropdown, load communities
        if (dropdown.classList.contains('dropdown-active') &&
            (!dropdown.innerHTML || dropdown.innerHTML.trim() === '')) {
          this.loadSubscribedCommunities();
        }
      }
    });

    // Toggle dropdown on click instead of input event
    communitySearch.addEventListener('click', (e) => {
      const dropdown = document.getElementById('community-dropdown');

      // For mobile, always show dropdown on click
      if (window.innerWidth <= 768) {
        dropdown.classList.add('dropdown-active');
        communitySearch.classList.add('dropdown-active');
        this.toggleDropdownBackdrop(true);

        // If opening the dropdown, load communities
        if (!dropdown.innerHTML || dropdown.innerHTML.trim() === '') {
          this.loadSubscribedCommunities();
        }

        // Prevent keyboard showing on first click for mobile, let the second click focus
        if (communitySearch.readOnly) {
          communitySearch.readOnly = false;
          e.preventDefault(); // Prevent focusing on first click
        }
      } else {
        // For desktop, toggle dropdown
        dropdown.classList.toggle('dropdown-active');
        communitySearch.classList.toggle('dropdown-active');

        // If opening the dropdown, load communities
        if (dropdown.classList.contains('dropdown-active') &&
            (!dropdown.innerHTML || dropdown.innerHTML.trim() === '')) {
          this.loadSubscribedCommunities();
        }
      }
    });

    // Add an event listener to allow searching when user types
    communitySearch.addEventListener('keyup', (e) => {
      // Remove readonly when user starts typing
      if (communitySearch.readOnly) {
        communitySearch.readOnly = false;
      }

      // Cancel previous timeout
      clearTimeout(this.searchTimeout);

      // Setup a new timeout
      this.searchTimeout = setTimeout(() => {
        this.searchCommunities(e.target.value);
      }, 300);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      // Don't close if clicking on the search input
      if (e.target === communitySearch) return;

      const dropdown = document.getElementById('community-dropdown');
      if (!dropdown) return;

      // Check if click was inside the dropdown
      if (dropdown.contains(e.target)) return;

      // Don't close dropdown if clicking on mobile dropdown header close button (handled separately)
      if (e.target.closest('.dropdown-mobile-close')) return;

      // Close dropdown
      this.closeDropdown();
    });

    communityContainer.appendChild(communitySearch);

    // Visualizzazione community selezionata
    const selectedCommunityDisplay = document.createElement('div');
    selectedCommunityDisplay.className = 'selected-community hidden';
    selectedCommunityDisplay.id = 'selected-community';
    communityContainer.appendChild(selectedCommunityDisplay);

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
    submitBtn.textContent = 'Publish Post';
    form.appendChild(submitBtn);

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
      dropdown.innerHTML = '<div class="dropdown-loading">Loading communities...</div>';
      dropdown.classList.add('dropdown-active');

      // Add mobile-friendly header when on mobile
      if (window.innerWidth <= 768) {
        this.addMobileDropdownHeader(dropdown);
      }

      const subscriptions = await communityService.getSubscribedCommunities(this.user.username);

      // Visualizza le community sottoscritte
      this.renderCommunityOptions(subscriptions, 'Your Communities');

      // STAMPA IN CONSOLE PER VALUTAZIONE DEL DESIGN
      console.group('🎨 Elenco Community per Valutazione Design');
      console.log(`Trovate ${subscriptions.length} community sottoscritte per ${this.user.username}`);

      // Tabella con le informazioni principali
      console.table(subscriptions.map(community => ({
        name: community.name,
        title: community.title || '[Senza Titolo]',
        subscribers: community.subscribers || 'N/A',
        hasAvatar: !!community.avatar_url,
        isNSFW: community.is_nsfw ? '⚠️ Sì' : 'No',
        initialLetter: (community.title || community.name || '?').charAt(0).toUpperCase(),
        colorHue: this.getConsistentHue((community.title || community.name || ''))
      })));

      // Anteprima del design per le prime 5 community
      console.log('Anteprima Design (prime 5 community):');
      subscriptions.slice(0, 5).forEach((community, index) => {
        const title = community.title || community.name || 'Senza Nome';
        const letter = title.charAt(0).toUpperCase();
        const hue = this.getConsistentHue(title);
        const colorCode = `hsl(${hue}, 70%, 50%)`;

        console.log(
          `%c ${letter} %c ${title} %c ${community.subscribers || 0} iscritti`,
          `background-color: ${colorCode}; color: white; border-radius: 50%; padding: 3px 8px; font-weight: bold;`,
          'font-weight: bold; font-size: 14px;',
          'color: gray; font-size: 12px;'
        );
      });

      // Esempi di formattazione del container
      console.log('\nEsempi di Container:');
      console.log('%cGrid Layout%c (3 colonne, spazio tra le community: 10px)',
        'background: #555; color: white; padding: 2px 5px;', 'color: black;');
      console.log('%cLista Scorrimento Orizzontale%c (larghezza fissa: 120px per item)',
        'background: #555; color: white; padding: 2px 5px;', 'color: black;');
      console.log('%cLista Verticale%c (altezza: 50px per item, bordo sottile separatore)',
        'background: #555; color: white; padding: 2px 5px;', 'color: black;');

      console.groupEnd();
    } catch (error) {
      console.error('Failed to load subscribed communities:', error);
      const dropdown = document.getElementById('community-dropdown');
      dropdown.innerHTML = '<div class="dropdown-error">Failed to load communities</div>';
    }
  }

  /**
   * Cerca community in base alla query
   * @param {string} query - Query di ricerca
   */
  async searchCommunities(query) {
    const dropdown = document.getElementById('community-dropdown');
    dropdown.classList.add('dropdown-active');

    // Add backdrop for mobile
    this.toggleDropdownBackdrop(true);

    // Add mobile-friendly header when on mobile
    if (window.innerWidth <= 768) {
      this.addMobileDropdownHeader(dropdown);
    }

    if (!query || query.trim() === '') {
      // Se la query è vuota, mostra le community sottoscritte
      return this.loadSubscribedCommunities();
    }

    try {
      // Mostra spinner di caricamento
      dropdown.innerHTML = '<div class="dropdown-loading">Searching...</div>';

      // Re-add mobile header after innerHTML change if on mobile
      if (window.innerWidth <= 768) {
        this.addMobileDropdownHeader(dropdown);
      }

      // Cerca community
      const results = await communityService.searchCommunities(query, 10);

      // Visualizza risultati
      this.renderCommunityOptions(results, 'Search Results');
    } catch (error) {
      console.error('Failed to search communities:', error);
      dropdown.innerHTML = '<div class="dropdown-error">Error searching communities</div>';

      // Re-add mobile header after innerHTML change if on mobile
      if (window.innerWidth <= 768) {
        this.addMobileDropdownHeader(dropdown);
      }
    }
  }

  /**
   * Add mobile-friendly header to dropdown
   * @param {HTMLElement} dropdown - Dropdown element
   */
  addMobileDropdownHeader(dropdown) {
    // Check if header already exists
    if (dropdown.querySelector('.dropdown-mobile-header')) {
      return;
    }

    // Create mobile header and prepend to dropdown
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'dropdown-mobile-header';

    const mobileTitle = document.createElement('div');
    mobileTitle.className = 'dropdown-mobile-title';
    mobileTitle.textContent = 'Select Community';

    const closeButton = document.createElement('button');
    closeButton.className = 'dropdown-mobile-close';
    closeButton.setAttribute('aria-label', 'Close dropdown');
    closeButton.innerHTML = '✕';
    closeButton.addEventListener('click', () => this.closeDropdown());

    mobileHeader.appendChild(mobileTitle);
    mobileHeader.appendChild(closeButton);

    // Check if dropdown has content and prepend header
    if (dropdown.firstChild) {
      dropdown.insertBefore(mobileHeader, dropdown.firstChild);
    } else {
      dropdown.appendChild(mobileHeader);
    }
  }

  /**
   * Toggle dropdown backdrop for mobile
   * @param {boolean} show - Whether to show or hide backdrop
   */
  toggleDropdownBackdrop(show) {
    // Only relevant for mobile
    if (window.innerWidth > 768) return;

    let backdrop = document.querySelector('.dropdown-backdrop');

    if (show) {
      // Create backdrop if it doesn't exist
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'dropdown-backdrop';
        document.body.appendChild(backdrop);

        // Add click listener to close dropdown
        backdrop.addEventListener('click', () => this.closeDropdown());
      }

      // Show backdrop with animation
      setTimeout(() => backdrop.classList.add('active'), 10);
    } else if (backdrop) {
      // Hide and remove backdrop
      backdrop.classList.remove('active');

      // Remove after animation completes
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }, 200);
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

    // Remove backdrop
    this.toggleDropdownBackdrop(false);
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

      // Aggiungi il nome come tag secondario
      if (community.name) {
        const nameTag = document.createElement('small');
        nameTag.className = 'community-name-small';
        nameTag.textContent = `@${community.id || ('hive-' + community.name)}`;
        title.appendChild(nameTag);
      }

      item.appendChild(title);

      // Click handler
      item.addEventListener('click', () => {
        this.selectCommunity(community);
      });

      list.appendChild(item);
    });

    dropdown.appendChild(list);
  }

  /**
   * Crea un avatar testuale per una community che non ha avatar
   * @param {Object} community - Oggetto community
   * @returns {string} - HTML per l'avatar testuale
   */
  createTextAvatar(community) {
    // Verifica se community è definito
    if (!community) {
      return '<div class="text-avatar">?</div>';
    }

    // Estrai il nome o il titolo dalla community con gestione dei valori undefined
    const title = community.title || '';
    const name = community.name || '';

    // Usa il titolo se disponibile, altrimenti usa il nome
    const displayText = title || name;

    // Gestisci il caso in cui entrambi siano undefined o stringhe vuote
    if (!displayText) {
      return '<div class="text-avatar">?</div>';
    }

    // Ottieni la prima lettera (gestendo correttamente stringhe vuote)
    const firstLetter = displayText.charAt(0).toUpperCase();

    // Genera un colore consistente basato sul nome della community
    const hue = this.getConsistentHue(displayText);

    return `<div class="text-avatar" style="background-color: hsl(${hue}, 70%, 50%)">${firstLetter}</div>`;
  }

  /**
   * Genera un valore hue consistente per una stringa
   * @param {string} str - Stringa da utilizzare per generare il colore
   * @returns {number} - Valore hue (0-360)
   */
  getConsistentHue(str) {
    if (!str) return 0;

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return hash % 360;
  }

  /**
   * Crea un avatar testuale quando l'immagine non è disponibile
   * @param {HTMLElement} container - Container dell'avatar
   * @param {string} name - Nome della community
   */
  createTextAvatar(container, name) {
    if (!container || !name) {
      console.warn('Invalid parameters for createTextAvatar', { container, name });

      // Crea comunque un avatar di fallback se container è valido
      if (container) {
        const fallbackAvatar = document.createElement('div');
        fallbackAvatar.className = 'text-avatar';
        fallbackAvatar.textContent = '?';
        fallbackAvatar.style.backgroundColor = 'hsl(0, 0%, 50%)';
        container.appendChild(fallbackAvatar);
      }
      return;
    }

    const textAvatar = document.createElement('div');
    textAvatar.className = 'text-avatar';

    // Usa la prima lettera del nome community, con fallback su '?'
    const initial = typeof name === 'string' && name.length > 0
      ? name.charAt(0).toUpperCase()
      : '?';

    textAvatar.textContent = initial;

    // Crea un colore consistente basato sul nome
    const stringToHash = typeof name === 'string' ? name : 'default';
    const hue = Math.abs(stringToHash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
    textAvatar.style.backgroundColor = `hsl(${hue}, 65%, 50%)`;

    container.appendChild(textAvatar);
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

    // Update the input to show selected community
    searchInput.value = community.title || community.name;
    searchInput.setAttribute('data-selected', 'true');
    searchInput.readOnly = true;

    // Close the dropdown
    dropdown.classList.remove('dropdown-active');
    searchInput.classList.remove('dropdown-active');

    // Update selected community in form data
    this.selectedCommunity = community;
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
    submitBtn.innerHTML = '<span class="spinner"></span> Publishing...';

    try {
      // Notifica inizio creazione
      this.showStatus('Publishing your post...', 'info');

      // Genera permlink dal titolo
      const permlink = this.generatePermlink(this.postTitle);
      const username = this.user.username;

      // Dati post
      const postData = {
        title: this.postTitle,
        body: this.postBody,
        tags: this.tags,
        permlink: permlink // Passa il permlink generato
      };
      
      // Aggiungi la community se selezionata
      if (this.selectedCommunity) {
        postData.community = this.selectedCommunity.name;
      }

      // Usa il servizio centralizzato per creare post
      const result = await createPostService.createPost(postData);

      // Send notification to Telegram after successful post creation
      if (result) {
        const postUrl = `https://davvoz.github.io/steemee/#/@${username}/${permlink}`;
        try {
          await fetch('https://imridd.eu.pythonanywhere.com/api/telegram/send_message_animals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ post_url: postUrl })
          });
        } catch (error) {
          console.error('Failed to notify Telegram:', error);
          // We don't throw here as the post was created successfully
        }
      }
      
      // Mostra messaggio di successo
      this.showStatus('Post published successfully!', 'success');

      // Reindirizza alla pagina del post dopo un breve ritardo
      setTimeout(() => {
        // Usa router per navigare alla pagina del post
        window.location.href = `#/@${username}/${permlink}`;
      }, 2000);
    } catch (error) {
      console.error('Failed to publish post:', error);
      this.showError(`Failed to publish post: ${error.message}`);

      // Ripristina pulsante
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Post';
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Genera un permlink basato sul titolo
   * @param {string} title - Titolo del post
   * @returns {string} - Permlink generato
   */
  generatePermlink(title) {
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Rimuovi caratteri speciali
      .replace(/\s+/g, '-')     // Sostituisci spazi con trattini
      .replace(/-+/g, '-')      // Evita trattini multipli
      .trim();

    // Aggiungi timestamp per evitare conflitti
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `${slug}-${timestamp}`;
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
      <p>You need to be logged in to create a post.</p>
      <a href="#/login" class="btn primary-btn">Login Now</a>
    `;

    container.appendChild(message);
    this.element.appendChild(container);
  }

  /**
   * Mostra il dialog per l'upload o inserimento di immagini
   */
  showImageUploadDialog() {
    // Verifica se esiste già un dialog e rimuovilo
    const existingDialog = document.querySelector('.image-upload-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Crea elementi principali del dialog con DOM puro
    const dialog = document.createElement('div');
    dialog.className = 'image-upload-dialog';

    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';

    // Header del dialog
    const header = document.createElement('div');
    header.className = 'dialog-header';

    const title = document.createElement('h3');
    title.textContent = 'Insert Image';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.setAttribute('aria-label', 'Close');

    const closeIcon = document.createElement('span');
    closeIcon.textContent = '✕';
    closeBtn.appendChild(closeIcon);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'dialog-tabs';

    const urlTabBtn = document.createElement('button');
    urlTabBtn.className = 'img-tab-button img-active';
    urlTabBtn.dataset.tab = 'url';
    urlTabBtn.textContent = 'URL';

    const uploadTabBtn = document.createElement('button');
    uploadTabBtn.className = 'img-tab-button';
    uploadTabBtn.dataset.tab = 'upload';
    uploadTabBtn.textContent = 'Upload';

    tabsContainer.appendChild(urlTabBtn);
    tabsContainer.appendChild(uploadTabBtn);

    // Corpo del dialog
    const dialogBody = document.createElement('div');
    dialogBody.className = 'dialog-body';

    // Tab URL
    const urlTab = document.createElement('div');
    urlTab.className = 'img-tab-content img-active';
    urlTab.id = 'url-tab';

    // URL Form Group
    const urlFormGroup = document.createElement('div');
    urlFormGroup.className = 'form-group';

    const urlLabel = document.createElement('label');
    urlLabel.setAttribute('for', 'image-url');
    urlLabel.textContent = 'Image URL:';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'image-url';
    urlInput.placeholder = 'https://example.com/image.jpg';

    urlFormGroup.appendChild(urlLabel);
    urlFormGroup.appendChild(urlInput);

    // Alt Text Form Group
    const altFormGroup = document.createElement('div');
    altFormGroup.className = 'form-group';

    const altLabel = document.createElement('label');
    altLabel.setAttribute('for', 'image-alt');
    altLabel.textContent = 'Alt text:';

    const altInput = document.createElement('input');
    altInput.type = 'text';
    altInput.id = 'image-alt';
    altInput.placeholder = 'Image description';

    altFormGroup.appendChild(altLabel);
    altFormGroup.appendChild(altInput);

    // Insert URL Button
    const insertUrlBtn = document.createElement('button');
    insertUrlBtn.className = 'btn primary-btn';
    insertUrlBtn.id = 'insert-url-btn';
    insertUrlBtn.textContent = 'Insert Image';

    urlTab.appendChild(urlFormGroup);
    urlTab.appendChild(altFormGroup);
    urlTab.appendChild(insertUrlBtn);

    // Tab Upload
    const uploadTab = document.createElement('div');
    uploadTab.className = 'img-tab-content';
    uploadTab.id = 'upload-tab';

    // Drop Zone
    const dropZone = document.createElement('div');
    dropZone.id = 'dropZone';
    dropZone.className = 'drop-zone';

    const dropIcon = document.createElement('div');
    dropIcon.className = 'drop-icon';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.textContent = 'cloud_upload';
    dropIcon.appendChild(iconSpan);

    const dropText = document.createElement('p');
    dropText.textContent = 'Drag & drop an image here or click to select';

    const dropInfo = document.createElement('p');
    dropInfo.className = 'drop-zone-info';
    dropInfo.textContent = 'Maximum size: 15MB';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    dropZone.appendChild(dropIcon);
    dropZone.appendChild(dropText);
    dropZone.appendChild(dropInfo);
    dropZone.appendChild(fileInput);

    // Upload Status
    const uploadStatus = document.createElement('div');
    uploadStatus.id = 'upload-status';
    uploadStatus.className = 'upload-status hidden';

    // Spinner
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    spinner.className = 'spinner-container hide';

    const spinnerEl = document.createElement('div');
    spinnerEl.className = 'spinner';

    const spinnerText = document.createElement('span');
    spinnerText.textContent = 'Uploading...';

    spinner.appendChild(spinnerEl);
    spinner.appendChild(spinnerText);

    uploadTab.appendChild(dropZone);
    uploadTab.appendChild(uploadStatus);
    uploadTab.appendChild(spinner);

    // Assembla il dialog
    dialogBody.appendChild(urlTab);
    dialogBody.appendChild(uploadTab);

    dialogContent.appendChild(header);
    dialogContent.appendChild(tabsContainer);
    dialogContent.appendChild(dialogBody);

    dialog.appendChild(dialogContent);

    // Aggiungi il dialog al DOM
    document.body.appendChild(dialog);

    // Event handlers
    // Chiusura
    closeBtn.addEventListener('click', () => {
      dialog.remove();
    });

    // Cambio tab
    urlTabBtn.addEventListener('click', () => this.switchDialogTab(dialog, 'url'));
    uploadTabBtn.addEventListener('click', () => this.switchDialogTab(dialog, 'upload'));

    // Inserimento da URL
    insertUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      const alt = altInput.value.trim() || 'Image';

      if (url) {
        this.insertImageToEditor(`![${alt}](${url})`);
        dialog.remove();
      }
    });

    // Inizializza funzionalità di upload
    this.initializeImageUpload(dialog);
  }

  /**
   * Cambia il tab attivo nel dialog
   */
  switchDialogTab(dialog, tabId) {
    // Deseleziona tutti i tab e nasconde tutti i contenuti
    const tabButtons = dialog.querySelectorAll('.img-tab-button');
    tabButtons.forEach(btn => btn.classList.remove('img-active'));

    const tabContents = dialog.querySelectorAll('.img-tab-content');
    tabContents.forEach(content => content.classList.remove('img-active'));

    // Attiva il tab selezionato
    const selectedButton = dialog.querySelector(`.img-tab-button[data-tab="${tabId}"]`);
    if (selectedButton) {
      selectedButton.classList.add('img-active');
    }

    const selectedContent = dialog.querySelector(`#${tabId}-tab`);
    if (selectedContent) {
      selectedContent.classList.add('img-active');
    }
  }

  /**
   * Inizializza la funzionalità di upload immagini
   */
  initializeImageUpload(dialog) {
    if (!dialog) return;

    const dropZone = dialog.querySelector('#dropZone');
    const fileInput = dialog.querySelector('#fileInput');
    const spinner = dialog.querySelector('#spinner');
    const uploadStatus = dialog.querySelector('#upload-status');

    if (!dropZone || !fileInput) return;

    const MAX_FILE_SIZE_MB = 15;

    // Gestione click sulla drop zone
    dropZone.addEventListener('click', () => fileInput.click());

    // Gestione drag over
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    // Gestione drag leave
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    // Gestione drop
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.uploadImage(file, spinner, uploadStatus, dialog);
      }
    });

    // Gestione selezione file
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        this.uploadImage(file, spinner, uploadStatus, dialog);
      }
    });
  }

  /**
   * Verifica la dimensione del file
   */
  isFileSizeValid(file, maxSizeMB = 15) {
    const fileSizeInMB = file.size / (1024 * 1024);
    return fileSizeInMB <= maxSizeMB;
  }

  /**
   * Mostra un messaggio di stato per l'upload
   */
  showUploadStatus(message, type, statusEl) {
    if (!statusEl) return;

    // Rimuovi tutte le classi di tipo
    statusEl.classList.remove('error', 'success', 'info', 'hidden');

    // Imposta il messaggio
    statusEl.textContent = message;

    // Aggiungi la classe appropriata
    statusEl.classList.add(type);

    // Nascondi automaticamente dopo un po'
    if (type === 'success') {
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Esegue l'upload dell'immagine
   */
  async uploadImage(file, spinner, statusEl, dialog) {
    try {
      // Controlla la dimensione del file
      if (!this.isFileSizeValid(file)) {
        this.showUploadStatus(`File too large. Maximum size is 15MB.`, 'error', statusEl);
        return;
      }

      // Mostra spinner e stato caricamento
      if (spinner) spinner.classList.remove('hide');
      this.showUploadStatus('Uploading image...', 'info', statusEl);

      // Importa il servizio di upload immagini
      const ImageUploadService = await import('../services/ImageUploadService.js')
        .then(module => module.default)
        .catch(err => {
          throw new Error('Could not load image upload service: ' + err.message);
        });

      if (!this.user) {
        this.showUploadStatus('You must be logged in to upload images', 'error', statusEl);
        return;
      }

      // Carica l'immagine usando il servizio
      const imageUrl = await ImageUploadService.uploadImage(file, this.user.username);

      // Inserisci l'immagine nell'editor
      this.insertImageToEditor(`![Image](${imageUrl})`);

      // Mostra messaggio di successo
      this.showUploadStatus('Image uploaded successfully!', 'success', statusEl);

      // Chiudi il dialog dopo un breve ritardo
      setTimeout(() => {
        if (dialog && document.body.contains(dialog)) {
          dialog.remove();
        }
      }, 1500);
    } catch (error) {
      console.error('Upload failed:', error);
      this.showUploadStatus(`Upload failed: ${error.message}`, 'error', statusEl);
    } finally {
      // Nascondi spinner
      if (spinner) spinner.classList.add('hide');
    }
  }

  /**
   * Inserisce un'immagine nell'editor Markdown
   */
  insertImageToEditor(markdownText) {
    if (this.markdownEditor) {
      this.markdownEditor.insertMarkdown(markdownText);
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

    // Clean up backdrop if exists
    const backdrop = document.querySelector('.dropdown-backdrop');
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }

    super.unmount();
  }
}

export default CreatePostView;
