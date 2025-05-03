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
    
    document.body.appendChild(modal);
    
    // Gestisci chiusura
    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
      modal.remove();
    });
    
    // Click esterno
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Gestisci opzione upload
    const uploadOption = modal.querySelector('#option-upload');
    uploadOption.addEventListener('click', () => {
      modal.remove();
      this.handleImageUpload();
    });
    
    // Gestisci opzione URL
    const urlOption = modal.querySelector('#option-url');
    urlOption.addEventListener('click', () => {
      modal.remove();
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
    
    // Aggiungi attributo multiple per permettere selezione multipla
    fileInput.multiple = true;
    
    // Quando i file vengono selezionati
    fileInput.onchange = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      try {
        // Importa i servizi necessari
        const imageUploadService = await import('../services/ImageUploadService.js')
          .then(module => module.default);
        
        const authService = await import('../services/AuthService.js')
          .then(module => module.default);
        
        const user = authService.getCurrentUser();
        if (!user) {
          this.showUploadStatus('You must be logged in to upload images', 'error');
          return;
        }
        
        // Mostra messaggio iniziale
        this.showUploadStatus(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`, 'info');
        
        // Crea un buffer di markup per tutte le immagini
        let imagesMarkup = '';
        
        // Processa ogni file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file || !file.type.startsWith('image/')) continue;
          
          try {
            // Aggiorna stato per ogni file se ci sono più immagini
            if (files.length > 1) {
              this.showUploadStatus(`Uploading image ${i+1} of ${files.length}...`, 'info');
            }
            
            // Esegui upload
            const imageUrl = await imageUploadService.uploadImage(file, user.username);
            
            // Aggiungi l'immagine con spaziatura appropriata
            if (i > 0) {
              // Aggiungi una riga vuota tra le immagini per migliorare la leggibilità
              imagesMarkup += '\n\n';
            }
            
            imagesMarkup += `![${file.name || 'Image'}](${imageUrl})`;
            
          } catch (error) {
            console.error(`Failed to upload image ${file.name}:`, error);
            this.showUploadStatus(`Failed to upload ${file.name}: ${error.message}`, 'error');
            // Continua con altri file anche se uno fallisce
          }
        }
        
        // Inserisci le immagini nell'editor con spaziatura intelligente
        if (imagesMarkup) {
          // Ottieni la posizione corrente del cursore
          const cursorPos = this.textarea.selectionStart;
          const text = this.textarea.value;
          
          // Controlla se dobbiamo aggiungere una riga vuota prima o dopo
          let finalMarkup = imagesMarkup;
          
          // Se non siamo all'inizio del testo e non c'è già una riga vuota prima
          if (cursorPos > 0 && text.charAt(cursorPos - 1) !== '\n') {
            finalMarkup = '\n\n' + finalMarkup;
          }
          
          // Se non siamo alla fine del testo e non c'è già una riga vuota dopo
          if (cursorPos < text.length && text.charAt(cursorPos) !== '\n') {
            finalMarkup = finalMarkup + '\n\n';
          }
          
          // Inserisci il markup completo
          this.insertTextAtSelection(finalMarkup);
        }
        
        // Mostra messaggio di successo finale
        this.showUploadStatus(`${files.length > 1 ? `${files.length} images` : 'Image'} uploaded successfully!`, 'success');
        
      } catch (error) {
        console.error('Image upload process failed:', error);
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