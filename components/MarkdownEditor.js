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
}