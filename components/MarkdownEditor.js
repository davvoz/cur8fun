import Component from './Component.js';
import ContentRenderer from './ContentRenderer.js';

export default class MarkdownEditor extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    
    this.value = options.initialValue || '';
    this.placeholder = options.placeholder || 'Write your content here...';
    this.onChange = options.onChange || (() => {});
    this.height = options.height || '400px';
    this.previewMode = false;
    
    // Initialize ContentRenderer with preview-specific options
    this.contentRenderer = new ContentRenderer({
      containerClass: 'markdown-preview',
      imageClass: 'preview-image',
      useProcessBody: true,
      allowIframes: true,
      allowYouTube: true,
      ...options.rendererOptions
    });
    
    // Bind methods
    this.handleInput = this.handleInput.bind(this);
    this.insertMarkdown = this.insertMarkdown.bind(this);
    this.handleToolbarAction = this.handleToolbarAction.bind(this);
    this.togglePreview = this.togglePreview.bind(this);
    this.updatePreview = this.updatePreview.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'markdown-editor';
    
    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-toolbar';
    
    const toolbarItems = [
      { icon: 'format_bold', action: 'bold', tooltip: 'Bold' },
      { icon: 'format_italic', action: 'italic', tooltip: 'Italic' },
      { icon: 'format_quote', action: 'quote', tooltip: 'Quote' },
      { icon: 'code', action: 'code', tooltip: 'Code' },
      { icon: 'link', action: 'link', tooltip: 'Link' },
      { icon: 'image', action: 'image', tooltip: 'Image' },
      { type: 'separator' },
      { icon: 'format_list_bulleted', action: 'bullet-list', tooltip: 'Bullet List' },
      { icon: 'format_list_numbered', action: 'ordered-list', tooltip: 'Numbered List' },
      { icon: 'horizontal_rule', action: 'hr', tooltip: 'Horizontal Rule' },
      { type: 'separator' },
      { icon: 'title', action: 'h1', tooltip: 'Heading 1' },
      { icon: 'text_fields', action: 'h2', tooltip: 'Heading 2' },
      { icon: 'text_format', action: 'h3', tooltip: 'Heading 3' },
      { type: 'separator' },
      { icon: 'table_chart', action: 'table', tooltip: 'Table' },
      { icon: 'preview', action: 'preview', tooltip: 'Preview', toggle: true }
    ];
    
    toolbarItems.forEach(item => {
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.className = 'toolbar-separator';
        toolbar.appendChild(separator);
        return;
      }
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toolbar-button';
      button.dataset.action = item.action;
      button.title = item.tooltip;
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = item.icon;
      button.appendChild(icon);
      
      this.registerEventHandler(button, 'click', () => this.handleToolbarAction(item.action, item.toggle));
      toolbar.appendChild(button);
    });
    
    this.element.appendChild(toolbar);
    
    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'editor-container';
    
    // Text area for editing
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'markdown-textarea';
    this.textarea.placeholder = this.placeholder;
    this.textarea.value = this.value;
    this.textarea.style.height = this.height;
    this.registerEventHandler(this.textarea, 'input', this.handleInput);
    editorContainer.appendChild(this.textarea);
    
    // Disabilita menu contestuale su mobile ma mantiene selezione
    this.textarea.addEventListener('contextmenu', (e) => {
      // Verifica se è un dispositivo mobile
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        e.preventDefault();
        return false;
      }
    });
    
    // Gestione migliorata del tocco su mobile
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let hasMoved = false;
    
    this.textarea.addEventListener('touchstart', (e) => {
      // Registra il momento e la posizione di inizio tocco
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      hasMoved = false;
    });
    
    this.textarea.addEventListener('touchmove', (e) => {
      // Controlla se il dito si è mosso significativamente
      const moveX = Math.abs(e.touches[0].clientX - touchStartX);
      const moveY = Math.abs(e.touches[0].clientY - touchStartY);
      
      if (moveX > 10 || moveY > 10) {
        hasMoved = true;
      }
    });
    
    this.textarea.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - touchStartTime;
      
      // Se è un tap rapido, non fare nulla di speciale (comportamento nativo)
      if (touchDuration < 300 && !hasMoved) {
        return;
      }
      
      // Solo per tocchi lunghi o movimenti (selezioni)
      const hasSelection = this.textarea.selectionStart !== this.textarea.selectionEnd;
      
      // Se c'è testo selezionato dopo un tocco lungo, mostra la toolbar
      if (hasSelection) {
        // Preveniamo il menu contestuale nativo
        e.preventDefault();
        
        // Piccolo timeout per assicurarci che la selezione sia completa
        setTimeout(() => {
          this.showFormattingToolbar();
        }, 10);
      }
    });
    
    // Preview area
    this.previewArea = document.createElement('div');
    this.previewArea.className = 'markdown-preview content-body';
    this.previewArea.style.display = 'none';
    this.previewArea.style.height = this.height;
    editorContainer.appendChild(this.previewArea);
    
    this.element.appendChild(editorContainer);
    
    // Create helpful tips container
    const tipsContainer = document.createElement('div');
    tipsContainer.className = 'markdown-tips';
    
    const tipsToggle = document.createElement('button');
    tipsToggle.type = 'button';
    tipsToggle.className = 'tips-toggle';
    tipsToggle.innerHTML = '<span class="material-icons">help_outline</span> Markdown Tips';
    
    const tipsContent = document.createElement('div');
    tipsContent.className = 'tips-content';
    tipsContent.style.display = 'none';
    tipsContent.innerHTML = `
      <h4>Markdown Formatting Tips</h4>
      <div class="tips-grid">
        <div class="tip-item">
          <code># Heading</code>
          <span>Creates a Heading 1</span>
        </div>
        <div class="tip-item">
          <code>## Heading</code>
          <span>Creates a Heading 2</span>
        </div>
        <div class="tip-item">
          <code>**bold**</code>
          <span>Makes text <strong>bold</strong></span>
        </div>
        <div class="tip-item">
          <code>*italic*</code>
          <span>Makes text <em>italic</em></span>
        </div>
        <div class="tip-item">
          <code>[link](url)</code>
          <span>Creates a link</span>
        </div>
        <div class="tip-item">
          <code>![alt](image-url)</code>
          <span>Inserts an image</span>
        </div>
        <div class="tip-item">
          <code>\`code\`</code>
          <span>Formats as <code>code</code></span>
        </div>
        <div class="tip-item">
          <code>- item</code>
          <span>Creates a bullet list</span>
        </div>
      </div>
    `;
    
    this.registerEventHandler(tipsToggle, 'click', () => {
      const isVisible = tipsContent.style.display !== 'none';
      tipsContent.style.display = isVisible ? 'none' : 'block';
      tipsToggle.classList.toggle('active', !isVisible);
    });
    
    tipsContainer.appendChild(tipsToggle);
    tipsContainer.appendChild(tipsContent);
    this.element.appendChild(tipsContainer);
    
    // Add reference to the parent
    this.parentElement.appendChild(this.element);
    
    return this.element;
  }
  
  handleInput() {
    this.value = this.textarea.value;
    this.onChange(this.value);
    
    if (this.previewMode) {
      this.updatePreview();
    }
  }
  
  insertMarkdown(markdownToInsert, selectionOffset = 0) {
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    // Replace the selected text with the markdown formatted text
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);
    
    // Insert the formatted text
    const formatted = markdownToInsert.replace('{{selection}}', selectedText);
    textarea.value = beforeText + formatted + afterText;
    
    // Update our stored value
    this.value = textarea.value;
    this.onChange(this.value);
    
    // Restore focus and selection
    textarea.focus();
    
    // Calculate where to place the cursor
    const newCursorPos = start + formatted.length - selectionOffset;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;
    
    if (this.previewMode) {
      this.updatePreview();
    }
  }
  
  handleToolbarAction(action, isToggle = false) {
    // For toggle actions like preview
    if (isToggle && action === 'preview') {
      this.togglePreview();
      return;
    }
    
    // Gestione speciale per l'azione image
    if (action === 'image') {
      this.showImageUploadDialog();
      return;
    }
    
    const formats = {
      'bold': {
        markdown: '**{{selection}}**',
        selectionOffset: 2,
        placeholder: 'bold text'
      },
      'italic': {
        markdown: '*{{selection}}*',
        selectionOffset: 1,
        placeholder: 'italic text'
      },
      'quote': {
        markdown: '> {{selection}}',
        selectionOffset: 0,
        placeholder: 'quote'
      },
      'code': {
        markdown: '`{{selection}}`',
        selectionOffset: 1,
        placeholder: 'code'
      },
      'link': {
        markdown: '[{{selection}}](url)',
        selectionOffset: 1,
        placeholder: 'link text'
      },
      'image': {
        markdown: '![{{selection}}](image-url)',
        selectionOffset: 1,
        placeholder: 'image alt text'
      },
      'bullet-list': {
        markdown: '- {{selection}}',
        selectionOffset: 0,
        placeholder: 'list item'
      },
      'ordered-list': {
        markdown: '1. {{selection}}',
        selectionOffset: 0,
        placeholder: 'list item'
      },
      'h1': {
        markdown: '# {{selection}}',
        selectionOffset: 0,
        placeholder: 'heading 1'
      },
      'h2': {
        markdown: '## {{selection}}',
        selectionOffset: 0,
        placeholder: 'heading 2'
      },
      'h3': {
        markdown: '### {{selection}}',
        selectionOffset: 0,
        placeholder: 'heading 3'
      },
      'hr': {
        markdown: '\n---\n',
        selectionOffset: 0,
        placeholder: ''
      },
      'table': {
        markdown: '\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |\n',
        selectionOffset: 0,
        placeholder: ''
      }
    };
    
    const format = formats[action];
    if (!format) return;
    
    const selected = this.textarea.value.substring(
      this.textarea.selectionStart,
      this.textarea.selectionEnd
    );
    
    // If no text is selected, use placeholder
    const markdownToInsert = selected ? format.markdown : format.markdown.replace('{{selection}}', format.placeholder);
    
    this.insertMarkdown(
      markdownToInsert,
      selected ? format.selectionOffset : format.placeholder.length + format.selectionOffset
    );
  }
  
  togglePreview() {
    this.previewMode = !this.previewMode;
    
    // Update UI
    this.textarea.style.display = this.previewMode ? 'none' : 'block';
    this.previewArea.style.display = this.previewMode ? 'block' : 'none';
    
    // Update toggle button
    const previewButton = this.element.querySelector('[data-action="preview"]');
    if (previewButton) {
      previewButton.classList.toggle('active', this.previewMode);
    }
    
    if (this.previewMode) {
      this.updatePreview();
    }
  }
  
  updatePreview() {
    // Use our content renderer to process the markdown properly
    try {
      // Clear previous content
      while (this.previewArea.firstChild) {
        this.previewArea.removeChild(this.previewArea.firstChild);
      }
      
      // Use the content renderer to process the markdown
      const rendered = this.contentRenderer.render({
        body: this.value
      });
      
      // Append the processed content to our preview area
      if (rendered.container) {
        this.previewArea.appendChild(rendered.container);
      }
    } catch (error) {
      console.error('Error rendering preview:', error);
      this.previewArea.textContent = 'Error rendering preview.';
    }
  }
  
  getValue() {
    return this.value;
  }
  
  setValue(value) {
    this.value = value;
    this.textarea.value = value;
    
    if (this.previewMode) {
      this.updatePreview();
    }
    
    return this;
  }
  
  showFormattingToolbar() {
    // Se esiste già una mini toolbar, rimuovila
    const existingToolbar = document.querySelector('.mini-formatting-toolbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }
    
    // Ottieni la selezione corrente
    const selectedText = this.textarea.value.substring(
      this.textarea.selectionStart, 
      this.textarea.selectionEnd
    );
    
    if (!selectedText) return;
    
    // Crea una mini toolbar contestuale
    const toolbar = document.createElement('div');
    toolbar.className = 'mini-formatting-toolbar';
    
    // Aggiungi pulsanti comuni di formattazione
    const actions = [
      { icon: 'format_bold', action: 'bold', label: 'Bold' },
      { icon: 'format_italic', action: 'italic', label: 'Italic' },
      { icon: 'link', action: 'link', label: 'Link' }
    ];
    
    actions.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mini-toolbar-btn';
      button.innerHTML = `<span class="material-icons">${item.icon}</span>`;
      button.setAttribute('aria-label', item.label);
      button.addEventListener('click', () => {
        this.handleToolbarAction(item.action);
        toolbar.remove();
      });
      toolbar.appendChild(button);
    });
    
    // Calcola la posizione migliore per la toolbar
    const rect = this.textarea.getBoundingClientRect();
    
    // In mobile potrebbe non esserci una selection range precisa,
    // quindi posizionare sopra l'area di testo è più affidabile
    let top = rect.top - 50; // Posiziona la toolbar sopra la textarea
    let left = rect.left + (rect.width / 2) - 75; // Centra orizzontalmente
    
    try {
      // Prova a ottenere una posizione più precisa se possibile
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectionRect = range.getBoundingClientRect();
        
        if (selectionRect && selectionRect.top) {
          top = selectionRect.top - 45;
          left = selectionRect.left;
        }
      }
    } catch (e) {
      console.log('Fallback to default positioning');
    }
    
    // Assicura che la toolbar rimanga all'interno della viewport
    top = Math.max(10, top); // Non posizionarla troppo in alto
    left = Math.max(10, Math.min(left, window.innerWidth - 150)); // Limita orizzontalmente
    
    toolbar.style.position = 'fixed'; // Use fixed position for better mobile support
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    
    // Aggiungi la toolbar al DOM
    document.body.appendChild(toolbar);
    
    // Auto rimozione dopo 5 secondi o tap altrove
    const removeToolbar = () => {
      if (document.body.contains(toolbar)) {
        toolbar.remove();
      }
      document.removeEventListener('touchstart', documentTapHandler);
    };
    
    // Rimuovi quando si tocca altrove
    const documentTapHandler = (e) => {
      if (!toolbar.contains(e.target)) {
        removeToolbar();
      }
    };
    
    document.addEventListener('touchstart', documentTapHandler);
    setTimeout(removeToolbar, 5000);
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
    urlTabBtn.className = 'tab-button active';
    urlTabBtn.dataset.tab = 'url';
    urlTabBtn.textContent = 'URL';
    
    const uploadTabBtn = document.createElement('button');
    uploadTabBtn.className = 'tab-button';
    uploadTabBtn.dataset.tab = 'upload';
    uploadTabBtn.textContent = 'Upload';
    
    tabsContainer.appendChild(urlTabBtn);
    tabsContainer.appendChild(uploadTabBtn);
    
    // Corpo del dialog
    const dialogBody = document.createElement('div');
    dialogBody.className = 'dialog-body';
    
    // Tab URL
    const urlTab = document.createElement('div');
    urlTab.className = 'tab-content active';
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
    uploadTab.className = 'tab-content';
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
    urlTabBtn.addEventListener('click', () => this.switchTab(dialog, 'url'));
    uploadTabBtn.addEventListener('click', () => this.switchTab(dialog, 'upload'));
    
    // Inserimento da URL
    insertUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      const alt = altInput.value.trim() || 'Image';
      
      if (url) {
        this.insertMarkdown(`![${alt}](${url})`);
        dialog.remove();
      }
    });
    
    // Inizializza funzionalità di upload
    this.initializeImageUpload(dialog);
  }
  
  /**
   * Cambia il tab attivo nel dialog
   */
  switchTab(dialog, tabId) {
    // Deseleziona tutti i tab e nasconde tutti i contenuti
    const tabButtons = dialog.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    const tabContents = dialog.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Attiva il tab selezionato
    const selectedButton = dialog.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }
    
    const selectedContent = dialog.querySelector(`#${tabId}-tab`);
    if (selectedContent) {
      selectedContent.classList.add('active');
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
      
      // Ottieni l'utente corrente
      // Prima importiamo il servizio di autenticazione
      const authService = await import('../services/AuthService.js')
        .then(module => module.default)
        .catch(error => {
          console.error('Error loading auth service:', error);
          throw new Error('Could not load authentication service');
        });
      
      const user = authService.getCurrentUser();
      if (!user) {
        this.showUploadStatus('You must be logged in to upload images', 'error', statusEl);
        return;
      }
      
      // Mostra spinner e stato caricamento
      if (spinner) spinner.classList.remove('hide');
      this.showUploadStatus('Uploading image...', 'info', statusEl);
      
      // Leggi il file come base64
      const base64Data = await this.readFileAsBase64(file);
      if (!base64Data) {
        throw new Error('Failed to read image file');
      }
      
      // Estrai la parte base64 (rimuovi il prefisso data:image/...)
      const base64Image = base64Data.split(',')[1];
      
      // Prepara i dati per l'upload
      const payload = {
        image_base64: base64Image,
        username: user.username,
        id_telegram: 'steemee_app'
      };
      
      // URL del servizio di upload (configura per HIVE o STEEM)
      const uploadUrl = 'https://develop-imridd.eu.pythonanywhere.com/api/hive/upload_base64_image';
      
      // Esegui la richiesta con timeout
      const response = await this.fetchWithTimeout(
        uploadUrl, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 
        60000 // 60 secondi timeout
      );
      
      // Gestisci la risposta
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.image_url) {
        throw new Error('Invalid response from server');
      }
      
      // Inserisci l'immagine nel markdown
      this.insertMarkdown(`![Image](${result.image_url})`);
      
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
   * Legge un file come base64
   */
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Esegue una fetch con timeout
   */
  fetchWithTimeout(url, options, timeout) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }
}