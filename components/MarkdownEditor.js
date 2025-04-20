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
    
    this.setupImageUpload();
    
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
  
  /**
   * Inserisce o sostituisce il testo alla posizione corrente del cursore o selezione
   * @param {string} text - Il testo da inserire
   */
  insertTextAtSelection(text) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    
    // Sostituisci il testo selezionato o inserisci alla posizione del cursore
    const beforeText = this.textarea.value.substring(0, start);
    const afterText = this.textarea.value.substring(end);
    this.textarea.value = beforeText + text + afterText;
    
    // Aggiorna il valore e notifica il cambiamento
    this.value = this.textarea.value;
    this.onChange(this.value);
    
    // Ripristina il focus
    this.textarea.focus();
    
    // Posiziona il cursore dopo il testo inserito
    const newCursorPos = start + text.length;
    this.textarea.selectionStart = newCursorPos;
    this.textarea.selectionEnd = newCursorPos;
    
    // Aggiorna la preview se attiva
    if (this.previewMode) {
      this.updatePreview();
    }
  }
  
  /**
   * Gestisce il caricamento e l'inserimento di immagini nell'editor
   */
  setupImageUpload() {
    // Aggiungi un input file nascosto all'editor
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'markdown-image-upload';
    this.element.appendChild(fileInput);
    
    // Trova il pulsante immagine nella toolbar
    const imageButton = this.element.querySelector('[data-action="image"]');
    if (imageButton) {
      // Rimuovi il listener predefinito
      const newImageButton = imageButton.cloneNode(true);
      imageButton.parentNode.replaceChild(newImageButton, imageButton);
      
      // Aggiungi il nuovo listener
      newImageButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Mostra dialog semplice con opzioni
        this.showImageOptions();
      });
    }
  }
  
  /**
   * Mostra opzioni semplici per l'inserimento di immagini
   */
  showImageOptions() {
    // Crea un dialog semplice
    const modal = document.createElement('div');
    modal.className = 'image-upload-modal';
    modal.style.opacity = '0'; // Start with opacity 0 for smooth transition
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Image</h3>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="image-option" id="option-upload">
            <span class="material-icons">cloud_upload</span>
            <span>Upload Image</span>
          </div>
          <div class="image-option" id="option-url">
            <span class="material-icons">link</span>
            <span>Add Image URL</span>
          </div>
        </div>
      </div>
    `;
    
    // Store the current scroll position
    const scrollY = window.scrollY;
    
    // Add to DOM
    document.body.appendChild(modal);
    
    // Aggiungi solo la classe modal-open al body - nessuno stile inline
    document.body.classList.add('modal-open');
    
    // Trigger a reflow and then fade in the dialog
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transition = 'opacity 0.2s ease-in-out';
    }, 10);
    
    // Gestisci chiusura
    const closeButton = modal.querySelector('.close-button');
    const closeModal = () => {
      // Fade out animation
      modal.style.opacity = '0';
      
      // Wait for animation to complete before removing
      setTimeout(() => {
        if (document.body.contains(modal)) {
          modal.remove();
        }
        
        // Restore body styles
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        document.body.style.overflow = '';
        // Rimuovo il riferimento a paddingRight che non è più impostato all'apertura
        document.body.style.top = '';
        document.body.classList.remove('modal-open');
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      }, 200);
    };
    
    closeButton.addEventListener('click', closeModal);
    
    // Click esterno
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Handle ESC key
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscKey);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    // Gestisci opzione upload
    const uploadOption = modal.querySelector('#option-upload');
    uploadOption.addEventListener('click', () => {
      closeModal();
      this.handleImageUpload();
    });
    
    // Gestisci opzione URL
    const urlOption = modal.querySelector('#option-url');
    urlOption.addEventListener('click', () => {
      closeModal();
      this.handleImageURL();
    });
  }
  
  /**
   * Gestisce l'inserimento dell'immagine tramite URL
   */
  handleImageURL() {
    const url = prompt('Enter image URL:');
    if (url) {
      this.insertMarkdown(`![Image](${url})`);
    }
  }
  
  /**
   * Gestisce l'upload di un'immagine
   */
  async handleImageUpload() {
    const fileInput = document.getElementById('markdown-image-upload');
    
    // Quando il file viene selezionato
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        this.showUploadStatus('Uploading image...', 'info');
        
        // Importa il servizio di upload
        const imageUploadService = await import('../services/ImageUploadService.js')
          .then(module => module.default);
        
        // Importa il servizio di autenticazione
        const authService = await import('../services/AuthService.js')
          .then(module => module.default);
        
        const user = authService.getCurrentUser();
        if (!user) {
          this.showUploadStatus('You must be logged in to upload images', 'error');
          return;
        }
        
        // Esegui upload
        const imageUrl = await imageUploadService.uploadImage(file, user.username);
        
        // Inserisci l'immagine nell'editor
        this.insertMarkdown(`![Image](${imageUrl})`);
        
        this.showUploadStatus('Image uploaded successfully!', 'success');
      } catch (error) {
        console.error('Image upload failed:', error);
        this.showUploadStatus(`Upload failed: ${error.message}`, 'error');
      } finally {
        // Reset input
        fileInput.value = '';
      }
    };
    
    // Apri il selettore file
    fileInput.click();
  }
  
  /**
   * Mostra un messaggio di stato per l'upload
   */
  showUploadStatus(message, type) {
    // Rimuovi eventuali messaggi esistenti
    const existingStatus = document.querySelector('.upload-status-message');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // Crea un nuovo messaggio
    const statusEl = document.createElement('div');
    statusEl.className = `upload-status-message ${type}`;
    statusEl.textContent = message;
    
    // Aggiungi al DOM
    this.element.appendChild(statusEl);
    
    // Rimuovi automaticamente dopo un po'
    if (type === 'success') {
      setTimeout(() => {
        statusEl.remove();
      }, 3000);
    }
  }
}