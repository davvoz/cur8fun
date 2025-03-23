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
    
    // Input per ricerca community
    const communitySearch = document.createElement('input');
    communitySearch.type = 'text';
    communitySearch.id = 'community-search';
    communitySearch.className = 'community-search-input';
    communitySearch.placeholder = 'Search for a community...';
    
    // Evento input per cercare community
    communitySearch.addEventListener('input', (e) => {
      // Cancella il timeout precedente per evitare troppe richieste
      clearTimeout(this.searchTimeout);
      
      // Imposta un nuovo timeout
      this.searchTimeout = setTimeout(() => {
        this.searchCommunities(e.target.value);
      }, 300);
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
      
      const subscriptions = await communityService.getSubscribedCommunities(this.user.username);
      
      // Visualizza le community sottoscritte
      this.renderCommunityOptions(subscriptions, 'Your Communities');
    } catch (error) {
      console.error('Failed to load subscribed communities:', error);
    }
  }
  
  /**
   * Cerca community in base alla query
   * @param {string} query - Query di ricerca
   */
  async searchCommunities(query) {
    const dropdown = document.getElementById('community-dropdown');
    
    if (!query || query.trim() === '') {
      // Se la query è vuota, mostra le community sottoscritte
      return this.loadSubscribedCommunities();
    }
    
    try {
      // Mostra spinner di caricamento
      dropdown.innerHTML = '<div class="dropdown-loading">Searching...</div>';
      
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
      item.className = 'community-item';
      
      // Community avatar
      const avatar = document.createElement('div');
      avatar.className = 'community-avatar';
      
      // Se c'è un avatar, usalo, altrimenti usa un placeholder
      if (community.avatar_url) {
        const img = document.createElement('img');
        img.src = community.avatar_url;
        img.alt = community.title || community.name;
        img.onerror = () => {
          img.style.display = 'none';
          this.createTextAvatar(avatar, community.name);
        };
        avatar.appendChild(img);
      } else {
        this.createTextAvatar(avatar, community.name);
      }
      
      item.appendChild(avatar);
      
      // Info community
      const info = document.createElement('div');
      info.className = 'community-info';
      
      const title = document.createElement('div');
      title.className = 'community-title';
      title.textContent = community.title || community.name;
      info.appendChild(title);
      
      const name = document.createElement('div');
      name.className = 'community-name';
      name.textContent = `@${community.name}`;
      info.appendChild(name);
      
      item.appendChild(info);
      
      // Click handler
      item.addEventListener('click', () => {
        this.selectCommunity(community);
      });
      
      list.appendChild(item);
    });
    
    dropdown.appendChild(list);
  }
  
  /**
   * Crea un avatar testuale quando l'immagine non è disponibile
   * @param {HTMLElement} container - Container dell'avatar
   * @param {string} name - Nome della community
   */
  createTextAvatar(container, name) {
    const textAvatar = document.createElement('div');
    textAvatar.className = 'text-avatar';
    
    // Usa la prima lettera del nome community
    const initial = name.charAt(0).toUpperCase();
    textAvatar.textContent = initial;
    
    // Crea un colore consistente basato sul nome
    const hue = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360);
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
    const display = document.getElementById('selected-community');
    const searchInput = document.getElementById('community-search');
    const dropdown = document.getElementById('community-dropdown');
    
    // Mostra la community selezionata
    display.innerHTML = `
      <div class="selected-community-info">
        <span class="selected-community-name">@${community.name}</span>
        <span class="selected-community-title">${community.title || ''}</span>
      </div>
      <button type="button" class="clear-community-btn">
        <span class="material-icons">close</span>
      </button>
    `;
    
    // Aggiungi handler per il pulsante di cancellazione
    const clearBtn = display.querySelector('.clear-community-btn');
    clearBtn.addEventListener('click', () => {
      this.selectedCommunity = null;
      display.innerHTML = '';
      display.classList.add('hidden');
      searchInput.classList.remove('hidden');
    });
    
    // Mostra il display e nascondi l'input
    display.classList.remove('hidden');
    searchInput.classList.add('hidden');
    
    // Nascondi il dropdown
    dropdown.innerHTML = '';
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
      
      // Usa il servizio appropriato per pubblicare
      let result;
      
      if (this.selectedCommunity) {
        // Pubblica in una community
        result = await communityService.postToCommunity(
          username,
          this.selectedCommunity.name,
          postData
        );
      } else {
        // Pubblica sul blog personale
        result = await createPostService.createPost(postData);
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
    
    super.unmount();
  }
}

export default CreatePostView;
