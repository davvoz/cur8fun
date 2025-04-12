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
    this.showContextMenu = this.showContextMenu.bind(this);
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
    
    // Gestione del menu contestuale personalizzato
    this.textarea.addEventListener('contextmenu', (e) => {
      // Su desktop, lasciamo il menu nativo per semplificare l'uso
      if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return;
      }

      // Su mobile, mostriamo il nostro menu personalizzato
      e.preventDefault();
      this.showContextMenu(e);
      return false;
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
      
      // Se è un tocco lungo senza movimento, mostra il menu contestuale
      if (touchDuration > 500 && !hasMoved) {
        e.preventDefault();
        this.showContextMenu(e);
        return;
      }
      
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
   * Mostra un menu contestuale personalizzato con opzioni di copia/incolla
   * @param {Event} event - evento che ha attivato il menu
   */
  showContextMenu(event) {
    // Rimuovi menu esistenti
    const existingMenu = document.querySelector('.custom-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // Crea il menu contestuale
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    
    // Ottieni la selezione corrente
    const hasSelection = this.textarea.selectionStart !== this.textarea.selectionEnd;
    const selectedText = hasSelection ? 
      this.textarea.value.substring(this.textarea.selectionStart, this.textarea.selectionEnd) : '';
    
    // Crea la struttura organizzata del menu
    const menuGroups = {
      edit: document.createElement('div'),
      format: document.createElement('div'),
      advanced: document.createElement('div')
    };
    
    Object.values(menuGroups).forEach(group => {
      group.className = 'menu-group';
      menu.appendChild(group);
    });
    
    // Opzioni per l'editing - sempre visibili ma abilitate in base al contesto
    if (hasSelection) {
      // Azioni per il testo selezionato
      this.addMenuItem(menuGroups.edit, 'content_cut', 'Taglia', () => {
        navigator.clipboard.writeText(selectedText)
          .then(() => this.insertTextAtSelection(''))
          .catch(err => console.error('Impossibile tagliare il testo:', err));
      });
      
      this.addMenuItem(menuGroups.edit, 'content_copy', 'Copia', () => {
        navigator.clipboard.writeText(selectedText)
          .catch(err => console.error('Impossibile copiare il testo:', err));
      });
      
      this.addMenuItem(menuGroups.edit, 'delete', 'Elimina', () => {
        this.insertTextAtSelection('');
      });
      
      // Aggiungi opzioni di formattazione
      menuGroups.format.appendChild(document.createElement('div')).className = 'menu-section-title';
      menuGroups.format.lastChild.textContent = 'Formatta';
      
      this.addMenuItem(menuGroups.format, 'format_bold', 'Grassetto', () => {
        this.handleToolbarAction('bold');
      });
      
      this.addMenuItem(menuGroups.format, 'format_italic', 'Corsivo', () => {
        this.handleToolbarAction('italic');
      });
      
      this.addMenuItem(menuGroups.format, 'code', 'Codice', () => {
        this.handleToolbarAction('code');
      });
      
      this.addMenuItem(menuGroups.format, 'link', 'Link', () => {
        this.handleToolbarAction('link');
      });
    } else {
      // Opzione incolla sempre disponibile
      if (navigator.clipboard && navigator.clipboard.readText) {
        this.addMenuItem(menuGroups.edit, 'content_paste', 'Incolla', () => {
          navigator.clipboard.readText()
            .then(text => {
              this.insertTextAtSelection(text);
            })
            .catch(err => console.error('Impossibile incollare il testo:', err));
        });
      }
    }
    
    // Aggiungi sempre l'opzione "Seleziona tutto"
    this.addMenuItem(menuGroups.edit, 'select_all', 'Seleziona tutto', () => {
      this.textarea.setSelectionRange(0, this.textarea.value.length);
      this.textarea.focus();
    });
    
    // Rimuovi i gruppi vuoti
    Object.entries(menuGroups).forEach(([key, group]) => {
      if (!group.children.length) {
        menu.removeChild(group);
      }
    });
    
    // Ottieni le coordinate per posizionare il menu
    let x, y;
    
    if (event.touches && event.touches[0]) {
      // Evento touch
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    } else {
      // Evento mouse
      x = event.clientX;
      y = event.clientY;
    }
    
    // Calcola la posizione ideale: vicino al punto di tocco ma non sovrapposto
    const offset = 15; // Leggero offset per non coprire il punto di tocco
    y = y + offset;
    
    // Aggiungi il menu al DOM
    document.body.appendChild(menu);
    
    // Calcola le dimensioni del menu e assicurati che rimanga nella viewport
    const menuRect = menu.getBoundingClientRect();
    
    // Calcola la posizione ottimale senza uscire dallo schermo
    if (y + menuRect.height > window.innerHeight) {
      // Se il menu finisce fuori dallo schermo in basso, posizionalo sopra il punto di tocco
      y = Math.max(10, y - offset * 2 - menuRect.height);
    }
    
    // Evita che il menu esca dai bordi orizzontali
    if (x + menuRect.width > window.innerWidth) {
      x = window.innerWidth - menuRect.width - 10;
    } else if (x < 10) {
      x = 10;
    }
    
    // Posiziona il menu
    menu.style.position = 'fixed';
    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;
    
    // Gestione chiusura del menu
    const closeMenu = () => {
      if (document.body.contains(menu)) {
        menu.classList.add('context-menu-hide');
        setTimeout(() => {
          if (document.body.contains(menu)) {
            menu.remove();
          }
        }, 200); // Durata della transizione CSS
      }
      document.removeEventListener('touchstart', documentClickHandler);
      document.removeEventListener('mousedown', documentClickHandler);
    };
    
    // Chiudi il menu quando si tocca altrove
    const documentClickHandler = (e) => {
      if (!menu.contains(e.target)) {
        closeMenu();
      }
    };
    
    document.addEventListener('touchstart', documentClickHandler);
    document.addEventListener('mousedown', documentClickHandler);
    
    // Aggiungi classe di fade-in per animazione
    setTimeout(() => menu.classList.add('context-menu-show'), 10);
    
    // Chiudi automaticamente dopo 3 secondi (se non c'è stata interazione)
    setTimeout(() => {
      // Controlla se un elemento del menu ha il focus o il mouse è sopra il menu
      const hasFocus = menu.contains(document.activeElement);
      const isHovered = menu.matches(':hover');
      
      if (!hasFocus && !isHovered) {
        closeMenu();
      }
    }, 3000);
  }
  
  /**
   * Aggiunge un elemento al menu contestuale
   * @param {HTMLElement} container - Elemento container del menu
   * @param {string} icon - Icona Material
   * @param {string} label - Testo dell'elemento
   * @param {Function} action - Funzione da eseguire al click
   * @param {boolean} disabled - Se l'elemento è disabilitato
   */
  addMenuItem(container, icon, label, action, disabled = false) {
    const menuItem = document.createElement('div');
    menuItem.className = `menu-item ${disabled ? 'menu-item-disabled' : ''}`;
    menuItem.innerHTML = `
      <span class="material-icons">${icon}</span>
      <span>${label}</span>
    `;
    
    // Aggiungi tooltip per aiutare l'utente
    menuItem.title = label;
    
    if (!disabled) {
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        
        // Chiudi solo questo menu, non eventuali elementi parent
        const menu = menuItem.closest('.custom-context-menu');
        if (menu) {
          menu.remove();
        }
      });
    }
    
    container.appendChild(menuItem);
    return menuItem;
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