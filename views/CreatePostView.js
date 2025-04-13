import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import communityService from '../services/CommunityService.js';
import userService from '../services/UserService.js';

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
    this.hasUnsavedChanges = false;
    
    // Opzioni beneficiari - versione aggiornata con supporto multiplo
    this.includeBeneficiary = true;
    this.beneficiaries = [{
      account: createPostService.defaultBeneficiary.name,
      weight: createPostService.defaultBeneficiary.weight
    }];
    this.totalWeight = createPostService.defaultBeneficiary.weight;

    // Timeout per la ricerca community
    this.searchTimeout = null;
    // Timeout per la ricerca beneficiari
    this.beneficiarySearchTimeout = null;

    // Reference per i gestori eventi esterni
    this.outsideClickHandler = null;
    this.keyDownHandler = null;
    this.autoSaveTimeout = null;
    
    // Per gestire i suggerimenti dei beneficiari
    this.beneficiarySuggestions = [];
    
    // Indice del beneficiario attualmente in modifica
    this.currentBeneficiaryIndex = -1;
  }

  // Aggiornamento della funzione render per un'interfaccia più compatta
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

    // Create header compatto
    const header = document.createElement('div');
    header.className = 'editor-header';

    // Titolo 
    const heading = document.createElement('h1');
    heading.textContent = 'Create New Post';
    header.appendChild(heading);

    // Editor quick actions
    const quickActions = document.createElement('div');
    quickActions.className = 'editor-quick-actions';
    
    // Save button
    const saveButton = document.createElement('button');
    saveButton.className = 'action-button save-button';
    saveButton.title = 'Save Draft';
    saveButton.innerHTML = '<span class="material-icons">save</span>';
    saveButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.saveIfChanged();
    });
    quickActions.appendChild(saveButton);

    // Draft status pill
    const draftStatus = document.createElement('div');
    draftStatus.className = 'draft-status-pill';
    draftStatus.id = 'draft-status';
    draftStatus.innerHTML = `
      <span class="material-icons">sync</span>
      <span id="draft-status-text">Auto-saving</span>
    `;
    quickActions.appendChild(draftStatus);
    
    header.appendChild(quickActions);
    postEditor.appendChild(header);

    // Create form
    const form = document.createElement('form');
    form.className = 'post-form';
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Status message container
    const statusArea = document.createElement('div');
    statusArea.id = 'post-status-message';
    statusArea.className = 'status-message hidden';
    form.appendChild(statusArea);

    // COMPATTO: Draft recovery banner integrato nella parte superiore
    const draftRecovery = document.createElement('div');
    draftRecovery.id = 'draft-recovery';
    draftRecovery.className = 'draft-recovery-banner hidden';
    form.appendChild(draftRecovery);

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
    clearSelectionBtn.className = 'clear-selection-btn hidden';
    clearSelectionBtn.title = 'Clear selection';
    clearSelectionBtn.innerHTML = '<span class="material-icons">close</span>';
    clearSelectionBtn.id = 'clear-community-btn';
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
    titleInput.addEventListener('input', (e) => {
      this.postTitle = e.target.value;
      this.hasUnsavedChanges = true;
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
      this.hasUnsavedChanges = true;
    });
    tagsGroup.appendChild(tagsInput);

    const tagsHelp = document.createElement('small');
    tagsHelp.className = 'form-text';
    tagsHelp.textContent = 'Add up to 5 tags to help categorize your post. The first tag becomes the main category.';
    tagsGroup.appendChild(tagsHelp);

    form.appendChild(tagsGroup);

    // Beneficiary section
    const beneficiaryGroup = document.createElement('div');
    beneficiaryGroup.className = 'form-group beneficiary-group';

    const beneficiaryLabel = document.createElement('div');
    beneficiaryLabel.className = 'form-label-with-toggle';
    
    const beneficiaryLabelText = document.createElement('label');
    beneficiaryLabelText.textContent = 'Reward Beneficiaries';
    beneficiaryLabelText.htmlFor = 'beneficiary-toggle';
    
    const beneficiaryToggleContainer = document.createElement('div');
    beneficiaryToggleContainer.className = 'toggle-switch-container';
    
    const beneficiaryToggle = document.createElement('input');
    beneficiaryToggle.type = 'checkbox';
    beneficiaryToggle.id = 'beneficiary-toggle';
    beneficiaryToggle.className = 'toggle-switch';
    beneficiaryToggle.checked = this.includeBeneficiary;
    
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'beneficiary-toggle';
    toggleLabel.className = 'toggle-label';
    
    beneficiaryToggleContainer.appendChild(beneficiaryToggle);
    beneficiaryToggleContainer.appendChild(toggleLabel);
    
    beneficiaryLabel.appendChild(beneficiaryLabelText);
    beneficiaryLabel.appendChild(beneficiaryToggleContainer);
    
    beneficiaryGroup.appendChild(beneficiaryLabel);

    // Beneficiary content container (shown/hidden based on toggle)
    const beneficiaryContent = document.createElement('div');
    beneficiaryContent.className = 'beneficiary-content';
    beneficiaryContent.style.display = this.includeBeneficiary ? 'block' : 'none';

    // Lista di beneficiari
    const beneficiariesList = document.createElement('div');
    beneficiariesList.className = 'beneficiaries-list';
    beneficiariesList.id = 'beneficiaries-list';
    
    // Popola la lista con i beneficiari esistenti
    this.renderBeneficiaryItems(beneficiariesList);
    
    beneficiaryContent.appendChild(beneficiariesList);
    
    // Pulsante per aggiungere nuovo beneficiario
    const addBeneficiaryBtn = document.createElement('button');
    addBeneficiaryBtn.type = 'button';
    addBeneficiaryBtn.className = 'add-beneficiary-btn';
    addBeneficiaryBtn.id = 'add-beneficiary-btn';
    addBeneficiaryBtn.innerHTML = '<span class="material-icons">add</span> Add Beneficiary';
    addBeneficiaryBtn.disabled = this.beneficiaries.length >= createPostService.maxBeneficiaries;
    
    addBeneficiaryBtn.addEventListener('click', () => {
      this.showAddBeneficiaryDialog();
    });
    
    beneficiaryContent.appendChild(addBeneficiaryBtn);
    
    // Riepilogo beneficiari (percentuale totale)
    const beneficiarySummary = document.createElement('div');
    beneficiarySummary.className = 'beneficiary-summary';
    beneficiarySummary.id = 'beneficiary-summary';
    
    this.updateBeneficiarySummary(beneficiarySummary);
    
    beneficiaryContent.appendChild(beneficiarySummary);
    
    // Beneficiary info text
    const beneficiaryHelp = document.createElement('div');
    beneficiaryHelp.className = 'beneficiary-help';
    
    // Icon for info
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons info-icon';
    infoIcon.textContent = 'info';
    
    // Help text
    const helpText = document.createElement('small');
    helpText.className = 'form-text';
    helpText.textContent = 'Beneficiaries receive a percentage of your post rewards. You can add up to 8 beneficiaries.';
    
    beneficiaryHelp.appendChild(infoIcon);
    beneficiaryHelp.appendChild(helpText);
    beneficiaryContent.appendChild(beneficiaryHelp);
    
    beneficiaryGroup.appendChild(beneficiaryContent);
    form.appendChild(beneficiaryGroup);
    
    // Event handlers for beneficiary section
    beneficiaryToggle.addEventListener('change', (e) => {
      this.includeBeneficiary = e.target.checked;
      beneficiaryContent.style.display = this.includeBeneficiary ? 'block' : 'none';
      this.hasUnsavedChanges = true;
    });

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn primary-btn';
    submitBtn.id = 'submit-post-btn';
    submitBtn.textContent = 'Publish Post';
    form.appendChild(submitBtn);

    // Append form to container
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
          this.hasUnsavedChanges = true;
        },
        height: '500px',
        initialValue: this.postBody || ''
      }
    );
    this.markdownEditor.render();

    // Verifica se esiste una bozza e mostra il prompt
    this.checkForDraft();
    
    // Avvia il salvataggio automatico
    this.startAutoSave();

    // Add resize listener to reposition dropdown when window resizes
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Imposta i gestori per chiudere i dropdown
    this.setupKeyboardHandler();
  }

  /**
   * Controlla se esiste una bozza salvata precedentemente e la mostra
   * Versione compatta del metodo
   */
  checkForDraft() {
    if (createPostService.hasDraft()) {
      const draft = createPostService.getDraft();
      if (!draft) return;
      
      const draftAge = createPostService.getDraftAge();
      
      // Crea il prompt per recuperare la bozza in versione compatta
      const draftRecovery = document.getElementById('draft-recovery');
      if (draftRecovery) {
        draftRecovery.classList.remove('hidden');
        
        // Clear any existing content
        while (draftRecovery.firstChild) {
          draftRecovery.removeChild(draftRecovery.firstChild);
        }
        
        // Create icon container
        const iconDiv = document.createElement('div');
        iconDiv.className = 'draft-recovery-icon';
        const icon = document.createElement('i');
        icon.className = 'material-icons';
        icon.textContent = 'history';
        iconDiv.appendChild(icon);
        
        // Create message container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'draft-recovery-message';
        const strong = document.createElement('strong');
        strong.textContent = 'Draft available';
        messageDiv.appendChild(strong);
        
        // Add text node for the message
        messageDiv.appendChild(document.createTextNode(' '));
        messageDiv.appendChild(document.createTextNode(`Draft from ${draftAge}: "${draft.title || '(No title)'}""`));
        
        // Create actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'draft-recovery-actions';
        
        // Discard button
        const discardBtn = document.createElement('button');
        discardBtn.className = 'btn secondary-btn';
        discardBtn.id = 'discard-draft-btn';
        discardBtn.textContent = 'Discard';
        
        // Recover button
        const recoverBtn = document.createElement('button');
        recoverBtn.className = 'btn primary-btn';
        recoverBtn.id = 'recover-draft-btn';
        recoverBtn.textContent = 'Recover';
        
        // Append buttons to actions
        actionsDiv.appendChild(discardBtn);
        actionsDiv.appendChild(recoverBtn);
        
        // Append all elements to draft recovery container
        draftRecovery.appendChild(iconDiv);
        draftRecovery.appendChild(messageDiv);
        draftRecovery.appendChild(actionsDiv);
        
        // Aggiungi gli event listener ai pulsanti
        recoverBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.loadDraft();
          draftRecovery.classList.add('hidden');
        });
        
        discardBtn.addEventListener('click', () => {
          createPostService.clearDraft();
          draftRecovery.classList.add('hidden');
        });
      }
    }
  }

  /**
   * Carica la bozza salvata nei campi del form
   */
  loadDraft() {
    const draft = createPostService.getDraft();
    if (!draft) return;
    
    // Carica i dati negli input
    if (draft.title) {
      this.postTitle = draft.title;
      const titleInput = document.getElementById('post-title');
      if (titleInput) titleInput.value = draft.title;
    }
    
    if (draft.body) {
      this.postBody = draft.body;
      if (this.markdownEditor) {
        // Fix: MarkdownEditor non ha il metodo updateValue
        // Usa il metodo setValue che è quello corretto
        if (typeof this.markdownEditor.setValue === 'function') {
          this.markdownEditor.setValue(draft.body);
        } 
        // Fallback: prova anche altri metodi comuni se setValue non è disponibile
        else if (typeof this.markdownEditor.setContent === 'function') {
          this.markdownEditor.setContent(draft.body);
        }
        else if (typeof this.markdownEditor.setMarkdown === 'function') {
          this.markdownEditor.setMarkdown(draft.body);
        }
        // Se nessuno dei metodi è disponibile, registra un errore
        else {
          console.error('Non è possibile aggiornare il contenuto dell\'editor: metodo non trovato');
        }
      }
    }
    
    if (draft.tags && Array.isArray(draft.tags)) {
      this.tags = draft.tags;
      const tagsInput = document.getElementById('post-tags');
      if (tagsInput) tagsInput.value = draft.tags.join(' ');
    } else if (typeof draft.tags === 'string') {
      this.tags = draft.tags.split(' ').filter(tag => tag.trim() !== '');
      const tagsInput = document.getElementById('post-tags');
      if (tagsInput) tagsInput.value = draft.tags;
    }
    
    if (draft.community) {
      this.selectedCommunity = {
        name: draft.community
      };
      
      const communitySearch = document.getElementById('community-search');
      if (communitySearch) {
        communitySearch.value = draft.community;
        communitySearch.setAttribute('data-selected', 'true');
      }
      
      const clearBtn = document.getElementById('clear-community-btn');
      if (clearBtn) {
        clearBtn.classList.remove('hidden');
      }
    }
    
    // Segnala che non ci sono modifiche non salvate
    this.hasUnsavedChanges = false;
    
    // Mostra notifica
    this.showStatus('Draft loaded successfully', 'success');
    
    // Aggiorna lo stato della bozza
    this.updateDraftStatus('Saved');
    
    // Nascondi correttamente il banner di recupero bozza
    const draftRecovery = document.getElementById('draft-recovery');
    if (draftRecovery) {
      draftRecovery.classList.add('hidden');
    }
    
    // Sposta il focus al titolo per una migliore esperienza utente
    const titleInput = document.getElementById('post-title');
    if (titleInput) {
      titleInput.focus();
    }
  }

  /**
   * Aggiorna lo stato visualizzato del draft
   * Versione ottimizzata
   */
  updateDraftStatus(status) {
    const draftStatusEl = document.getElementById('draft-status');
    const statusText = document.getElementById('draft-status-text');
    
    if (!draftStatusEl || !statusText) return;
    
    // Rimuovi tutte le classi di stato
    draftStatusEl.classList.remove('saving', 'saved', 'unsaved');
    
    // Aggiorna icona e testo in base allo stato
    let icon = 'sync';
    
    if (status === 'Saving...') {
      draftStatusEl.classList.add('saving');
      statusText.textContent = 'Saving...';
      icon = 'sync';
    } else if (status === 'Saved') {
      draftStatusEl.classList.add('saved');
      statusText.textContent = 'Saved';
      icon = 'check_circle';
      
      // Nascondi dopo 3 secondi
      setTimeout(() => {
        draftStatusEl.classList.remove('saved');
        statusText.textContent = 'Auto-save on';
        draftStatusEl.querySelector('.material-icons').textContent = 'sync';
      }, 3000);
    } else if (status === 'Unsaved changes') {
      draftStatusEl.classList.add('unsaved');
      statusText.textContent = 'Unsaved';
      icon = 'edit';
    }
    
    // Aggiorna l'icona
    draftStatusEl.querySelector('.material-icons').textContent = icon;
  }

  /**
   * Salva solo se ci sono modifiche non salvate
   */
  saveIfChanged() {
    if (!this.hasUnsavedChanges) return;
    
    // Mostra stato "Saving..."
    this.updateDraftStatus('Saving...');
    
    // Salva la bozza
    const draftData = {
      title: this.postTitle,
      body: this.postBody,
      tags: this.tags,
      community: this.selectedCommunity?.name
    };
    
    if (createPostService.saveDraft(draftData)) {
      // Aggiorna lo stato di salvataggio
      this.hasUnsavedChanges = false;
      
      // Mostra "Saved" con ritardo per l'animazione
      setTimeout(() => {
        this.updateDraftStatus('Saved');
      }, 500);
      
      // DEBUG: per test
      console.log("Draft saved:", draftData);
    } else {
      this.updateDraftStatus('Failed to save');
      console.error("Failed to save draft");
    }
  }

  /**
   * Avvia il salvataggio automatico
   */
  startAutoSave() {
    // Pulisci eventuali timeout esistenti
    if (this.autoSaveTimeout) {
      clearInterval(this.autoSaveTimeout);
    }
    
    // Imposta un nuovo intervallo per il salvataggio automatico (ogni 15 secondi)
    this.autoSaveTimeout = setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.saveIfChanged();
      }
    }, 15000);
    
    // DEBUG: per test
    console.log("AutoSave started");
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
   * Position the dropdown based on available space
   */
  positionDropdown() {
    const dropdown = document.getElementById('community-dropdown');
    const communityContainer = document.querySelector('.community-selector-container');
    
    if (!dropdown || !communityContainer) return;
    
    // Remove all positioning classes first
    dropdown.classList.remove('dropdown-side', 'dropdown-below');
    
    // Always position dropdown below the input
    dropdown.classList.add('dropdown-below');
    
    // Ensure dropdown width matches container width
    dropdown.style.width = `${communityContainer.offsetWidth}px`;
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
    this.hasUnsavedChanges = true;
  }

  /**
   * Seleziona una community
   * Funzione aggiornata per non impostare readonly
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
    
    // Non rendere readOnly per permettere la modifica
    // searchInput.readOnly = true;
    
    // Mostra il pulsante per cancellare la selezione
    if (clearBtn) {
      clearBtn.classList.remove('hidden');
    }
    
    // Close the dropdown
    dropdown.classList.remove('dropdown-active');
    searchInput.classList.remove('dropdown-active');
    this.hasUnsavedChanges = true;
  }

  /**
   * Gestisce il submit del form
   * @param {Event} e - Evento submit
   */
  async handleSubmit(e) {
    e.preventDefault();

    if (this.isSubmitting) return;

    // Debug: log dei dati del post prima della validazione
    console.log("Post submission data:", {
      title: this.postTitle,
      bodyLength: this.postBody?.length || 0,
      tags: this.tags,
      tagCount: this.tags.length,
      community: this.selectedCommunity?.name,
      beneficiaries: this.includeBeneficiary ? this.beneficiaries : 'none',
      totalBeneficiaryPercentage: this.includeBeneficiary ? (this.totalWeight / 100).toFixed(1) + '%' : '0%'
    });

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

    // Validazione del numero massimo di tag con log esplicito
    if (this.tags.length > 5) {
      console.error(`Too many tags: ${this.tags.length} tags provided, maximum is 5`);
      this.showError('Maximum 5 tags allowed. Please remove some tags to continue.');
      
      // Focus sull'input dei tag per facilitare la correzione
      const tagsInput = document.getElementById('post-tags');
      if (tagsInput) {
        tagsInput.focus();
      }
      return;
    }

    // Verifica che la percentuale totale dei beneficiari non superi il limite
    if (this.includeBeneficiary) {
      if (!createPostService.validateBeneficiaryPercentage(this.beneficiaries)) {
        this.showError('Total beneficiary percentage cannot exceed 90%');
        return;
      }
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
        permlink: permlink
      };
      
      // Aggiungi la community se selezionata
      if (this.selectedCommunity) {
        postData.community = this.selectedCommunity.name || this.selectedCommunity.id;
      }

      // Opzioni per i beneficiari
      const options = {
        includeBeneficiary: this.includeBeneficiary
      };

      // Se i beneficiari sono abilitati, passa l'array completo
      if (this.includeBeneficiary && this.beneficiaries.length > 0) {
        options.beneficiaries = this.beneficiaries;
      }

      console.log("Attempting to create post with data:", {
        ...postData,
        bodyLength: postData.body.length,
        options
      });

      // Usa il servizio centralizzato per creare post con le opzioni dei beneficiari
      const result = await createPostService.createPost(postData, options);

      // Send notification to Telegram after successful post creation
      if (result) {
        try {
          // Optional: implementa la notifica
        } catch (notifyErr) {
          console.error("Failed to send notification:", notifyErr);
          // Non bloccare il flusso per errori di notifica
        }
      }
      
      // Mostra messaggio di successo
      this.showStatus('Post published successfully!', 'success');

      // Reindirizza alla pagina del post dopo un breve ritardo
      setTimeout(() => {
        window.location.href = `#/post/@${username}/${permlink}`;
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

    // Rimuovi classi esistenti e aggiungi quelle appropriate
    statusArea.className = `status-message ${type} visible`;
    
    // Aggiungi icone appropriate per migliorare la visibilità
    let icon = '';
    if (type === 'error') {
      icon = '<i class="material-icons">error</i> ';
    } else if (type === 'success') {
      icon = '<i class="material-icons">check_circle</i> ';
    } else if (type === 'info') {
      icon = '<i class="material-icons">info</i> ';
    }
    
    // Aggiorna il contenuto con icona
    statusArea.innerHTML = icon + message;

    // Nascondi automaticamente dopo un po' se è un successo
    if (type === 'success') {
      setTimeout(() => {
        statusArea.className = 'status-message hidden';
      }, 5000);
    } 
    
    // Fai scorrere in vista il messaggio di errore
    if (type === 'error') {
      statusArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // Clear auto-save interval
    if (this.autoSaveTimeout) {
      clearInterval(this.autoSaveTimeout);
    }

    super.unmount();
  }

  /**
   * Cerca account utenti per l'autocomplete del beneficiario
   * @param {string} query - La query di ricerca (nome utente)
   */
  async searchBeneficiaries(query) {
    try {
      if (!query || query.length < 3) {
        return;
      }
      
      // Mostra indicatore di caricamento
      const suggestionsContainer = document.getElementById('beneficiary-suggestions');
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '<div class="loading-suggestions">Searching accounts...</div>';
        suggestionsContainer.classList.add('active');
      }
      
      // Cerca gli account attraverso il servizio utenti
      const users = await userService.searchUsers(query, 5);
      
      // Aggiorna la lista interna dei suggerimenti
      this.beneficiarySuggestions = users;
      
      // Mostra i suggerimenti
      this.showBeneficiarySuggestions();
      
    } catch (error) {
      console.error('Error searching for beneficiaries:', error);
      this.hideBeneficiarySuggestions();
    }
  }
  
  /**
   * Mostra i suggerimenti per l'autocomplete del beneficiario
   */
  showBeneficiarySuggestions() {
    const container = document.getElementById('beneficiary-suggestions');
    if (!container) return;
    
    // Pulisci contenuti precedenti
    container.innerHTML = '';
    
    // Se non ci sono suggerimenti, mostra un messaggio appropriato
    if (!this.beneficiarySuggestions || this.beneficiarySuggestions.length === 0) {
      container.innerHTML = '<div class="no-suggestions">No accounts found</div>';
      container.classList.add('active');
      return;
    }
    
    // Crea la lista di suggerimenti
    const list = document.createElement('ul');
    list.className = 'suggestions-list';
    
    this.beneficiarySuggestions.forEach((user, index) => {
      const item = document.createElement('li');
      item.className = 'suggestion-item';
      item.dataset.username = user.name || user.username; // Gestisci entrambi i formati possibili
      item.dataset.index = index;
      
      // Aggiungi avatar con container migliorato
      const avatarContainer = document.createElement('div');
      avatarContainer.className = 'suggestion-avatar-container';
      
      const avatar = document.createElement('img');
      avatar.className = 'suggestion-avatar';
      avatar.src = `https://steemitimages.com/u/${user.name || user.username}/avatar/small`;
      avatar.onerror = () => {
        // Se l'immagine non si carica, mostra un avatar testuale
       
      };
      
      avatarContainer.appendChild(avatar);
      
      // Container per le informazioni
      const infoContainer = document.createElement('div');
      infoContainer.className = 'suggestion-info';
      
      // Nome utente
      const username = document.createElement('div');
      username.className = 'suggestion-username';
      username.textContent = `@${user.name || user.username}`;
      infoContainer.appendChild(username);
      
      // Aggiungi descrizione se disponibile
      if (user.about || user.profile?.about) {
        const about = document.createElement('div');
        about.className = 'suggestion-about';
        about.textContent = (user.about || user.profile?.about || '').substring(0, 60);
        if ((user.about || user.profile?.about || '').length > 60) {
          about.textContent += '...';
        }
        infoContainer.appendChild(about);
      }
      
      // Assembla l'elemento
      item.appendChild(avatarContainer);
      item.appendChild(infoContainer);
      
      // Aggiungi evento click
      item.addEventListener('click', () => {
        this.selectBeneficiary(user.name || user.username);
      });
      
      list.appendChild(item);
    });
    
    container.appendChild(list);
    container.classList.add('active');
    
    // Imposta il gestore per i click fuori dal dropdown
    this.setupBeneficiaryOutsideClickHandler();
  }
  
  /**
   * Nasconde i suggerimenti del beneficiario
   */
  hideBeneficiarySuggestions() {
    const container = document.getElementById('beneficiary-suggestions');
    if (container) {
      container.classList.remove('active');
      container.innerHTML = '';
    }
    
    // Rimuovi il gestore per i click esterni
    if (this.beneficiaryOutsideClickHandler) {
      document.removeEventListener('click', this.beneficiaryOutsideClickHandler);
      this.beneficiaryOutsideClickHandler = null;
    }
  }
  
  /**
   * Imposta il gestore per click esterni ai suggerimenti beneficiari
   */
  setupBeneficiaryOutsideClickHandler() {
    // Rimuovi eventuali listener precedenti
    if (this.beneficiaryOutsideClickHandler) {
      document.removeEventListener('click', this.beneficiaryOutsideClickHandler);
    }
    
    // Timeout per evitare che il click che ha aperto il dropdown lo chiuda immediatamente
    setTimeout(() => {
      const suggestionsContainer = document.getElementById('beneficiary-suggestions');
      const inputField = document.getElementById('beneficiary-name');
      
      // Non procedere se il dropdown non è aperto
      if (!suggestionsContainer || !suggestionsContainer.classList.contains('active')) {
        return;
      }
      
      // Crea nuovo handler per click esterni
      this.beneficiaryOutsideClickHandler = (e) => {
        // Non chiudere se il click è sul container o sull'input
        if (suggestionsContainer.contains(e.target) || 
            (inputField && inputField.contains(e.target))) {
          return;
        }
        
        // Chiudi per i click esterni
        this.hideBeneficiarySuggestions();
      };
      
      // Aggiungi listener
      document.addEventListener('click', this.beneficiaryOutsideClickHandler);
    }, 100);
  }
  
  /**
   * Seleziona un beneficiario dai suggerimenti
   * @param {string} username - Nome utente del beneficiario
   */
  selectBeneficiary(username) {
    if (!username) return;
    
    this.customBeneficiary = username;
    
    // Aggiorna l'input con il nome selezionato
    const beneficiaryInput = document.getElementById('beneficiary-name');
    if (beneficiaryInput) {
      beneficiaryInput.value = username;
    }
    
    // Aggiorna il testo informativo
    const currentBeneficiarySpan = document.getElementById('current-beneficiary');
    if (currentBeneficiarySpan) {
      currentBeneficiarySpan.textContent = username;
    }
    
    // Nascondi i suggerimenti
    this.hideBeneficiarySuggestions();
    
    // Marca come modificato
    this.hasUnsavedChanges = true;
  }
  
  /**
   * Naviga tra i suggerimenti con la tastiera
   * @param {number} direction - Direzione: 1 per giù, -1 per su
   */
  navigateBeneficiarySuggestions(direction) {
    const container = document.getElementById('beneficiary-suggestions');
    if (!container || !container.classList.contains('active')) return;
    
    const items = container.querySelectorAll('.suggestion-item');
    if (!items.length) return;
    
    // Trova l'elemento attualmente selezionato
    let currentIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].classList.contains('selected')) {
        currentIndex = i;
        break;
      }
    }
    
    // Calcola il nuovo indice
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;
    
    // Rimuovi la selezione attuale
    items.forEach(item => item.classList.remove('selected'));
    
    // Imposta la nuova selezione
    items[newIndex].classList.add('selected');
    
    // Assicurati che l'elemento selezionato sia visibile
    items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Renderizza gli elementi della lista dei beneficiari
   * @param {HTMLElement} container - Il container della lista
   */
  renderBeneficiaryItems(container) {
    // Pulisci il container
    container.innerHTML = '';
    
    // Se non ci sono beneficiari, mostra un messaggio
    if (!this.beneficiaries || this.beneficiaries.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'beneficiary-empty';
      emptyMessage.textContent = 'No beneficiaries added';
      container.appendChild(emptyMessage);
      return;
    }
    
    // Crea un elemento per ogni beneficiario
    this.beneficiaries.forEach((beneficiary, index) => {
      const item = document.createElement('div');
      item.className = 'beneficiary-item';
      
      // Nome del beneficiario
      const nameDiv = document.createElement('div');
      nameDiv.className = 'beneficiary-name';
      nameDiv.textContent = `@${beneficiary.account}`;
      
      // Slider per il peso
      const sliderDiv = document.createElement('div');
      sliderDiv.className = 'beneficiary-weight-slider';
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '5000';
      slider.step = '50';
      slider.value = beneficiary.weight;
      slider.dataset.index = index;
      
      slider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const weight = parseInt(e.target.value);
        this.updateBeneficiaryWeight(idx, weight);
      });
      
      sliderDiv.appendChild(slider);
      
      // Percentuale
      const percentDiv = document.createElement('div');
      percentDiv.className = 'beneficiary-percentage';
      percentDiv.textContent = `${(beneficiary.weight / 100).toFixed(1)}%`;
      
      // Pulsanti di azione
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'beneficiary-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.title = 'Remove beneficiary';
      deleteBtn.dataset.index = index;
      deleteBtn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        this.removeBeneficiary(idx);
      });
      
      const deleteIcon = document.createElement('span');
      deleteIcon.className = 'material-icons';
      deleteIcon.textContent = 'delete';
      deleteBtn.appendChild(deleteIcon);
      
      actionsDiv.appendChild(deleteBtn);
      
      // Assembla l'elemento
      item.appendChild(nameDiv);
      item.appendChild(sliderDiv);
      item.appendChild(percentDiv);
      item.appendChild(actionsDiv);
      
      container.appendChild(item);
    });
  }

  /**
   * Aggiorna il peso di un beneficiario
   * @param {number} index - L'indice del beneficiario
   * @param {number} weight - Il nuovo peso (0-10000)
   */
  updateBeneficiaryWeight(index, weight) {
    if (index < 0 || index >= this.beneficiaries.length) return;
    
    // Aggiorna il peso
    this.beneficiaries[index].weight = parseInt(weight);
    
    // Aggiorna la visualizzazione della percentuale
    const beneficiariesList = document.getElementById('beneficiaries-list');
    if (beneficiariesList) {
      const items = beneficiariesList.querySelectorAll('.beneficiary-item');
      if (index < items.length) {
        const percentElement = items[index].querySelector('.beneficiary-percentage');
        if (percentElement) {
          percentElement.textContent = `${(weight / 100).toFixed(1)}%`;
        }
      }
    }
    
    // Calcola il peso totale
    this.calculateTotalWeight();
    
    // Aggiorna il riepilogo
    const summaryElement = document.getElementById('beneficiary-summary');
    if (summaryElement) {
      this.updateBeneficiarySummary(summaryElement);
    }
    
    this.hasUnsavedChanges = true;
  }

  /**
   * Calcola il peso totale dei beneficiari
   */
  calculateTotalWeight() {
    this.totalWeight = this.beneficiaries.reduce((sum, ben) => sum + ben.weight, 0);
    return this.totalWeight;
  }

  /**
   * Aggiorna il riepilogo dei beneficiari
   * @param {HTMLElement} container - Il container del riepilogo
   */
  updateBeneficiarySummary(container) {
    container.innerHTML = '';
    
    // Calcola il totale
    const totalWeight = this.calculateTotalWeight();
    const totalPercentage = (totalWeight / 100).toFixed(1);
    const authorPercentage = (100 - totalPercentage).toFixed(1);
    
    // Label
    const label = document.createElement('div');
    label.className = 'beneficiary-summary-label';
    label.textContent = 'Reward Distribution';
    
    // Contenuto
    const content = document.createElement('div');
    content.className = 'beneficiary-summary-content';
    
    const authorPart = document.createElement('div');
    authorPart.textContent = `Author: ${authorPercentage}%`;
    
    // Determina la classe per il totale in base al valore
    let totalClass = 'total-ok';
    if (totalWeight > 8000) {
      totalClass = 'total-exceed';
    } else if (totalWeight > 5000) {
      totalClass = 'total-warning';
    }
    
    const totalPart = document.createElement('div');
    totalPart.className = `beneficiary-summary-total ${totalClass}`;
    totalPart.textContent = `Beneficiaries: ${totalPercentage}%`;
    
    content.appendChild(authorPart);
    content.appendChild(totalPart);
    
    container.appendChild(label);
    container.appendChild(content);
  }

  /**
   * Mostra il dialog per aggiungere un nuovo beneficiario
   */
  showAddBeneficiaryDialog() {
    // Verifica se è stato raggiunto il limite massimo
    if (this.beneficiaries.length >= createPostService.maxBeneficiaries) {
      return this.showStatus(`Maximum ${createPostService.maxBeneficiaries} beneficiaries allowed`, 'error');
    }
    
    // Verifica se esiste già un dialog e rimuovilo
    const existingDialog = document.querySelector('.add-beneficiary-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // Crea il dialog
    const dialog = document.createElement('div');
    dialog.className = 'add-beneficiary-dialog';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Add Beneficiary';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<span>✕</span>';
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Body
    const body = document.createElement('div');
    body.className = 'dialog-body';
    
    // Campo per il nome del beneficiario
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'form-label-with-info';
    
    const nameText = document.createElement('label');
    nameText.htmlFor = 'new-beneficiary-name';
    nameText.textContent = 'Account Name';
    
    // Info icon with tooltip
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons info-icon';
    infoIcon.textContent = 'info';
    infoIcon.title = 'Enter a valid Hive account name';
    
    nameLabel.appendChild(nameText);
    nameLabel.appendChild(infoIcon);
    
    const nameInputContainer = document.createElement('div');
    nameInputContainer.className = 'beneficiary-input-container';
    
    // Add search icon inside the input
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-icon-wrapper';
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'material-icons input-icon';
    searchIcon.textContent = 'search';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'new-beneficiary-name';
    nameInput.className = 'form-control with-icon';
    nameInput.placeholder = 'Search by username';
    nameInput.autocomplete = 'off';
    
    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(nameInput);
    
    nameInputContainer.appendChild(inputWrapper);
    
    // Container per i suggerimenti con header
    const suggestionsWrapper = document.createElement('div');
    suggestionsWrapper.className = 'suggestions-wrapper';
    
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'beneficiary-suggestions';
    suggestionsContainer.id = 'beneficiary-suggestions';
    
    suggestionsWrapper.appendChild(suggestionsContainer);
    nameInputContainer.appendChild(suggestionsWrapper);
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInputContainer);
    
    // Frequently used accounts section
    const frequentSection = document.createElement('div');
    frequentSection.className = 'frequent-accounts-section';
    
    const frequentHeader = document.createElement('div');
    frequentHeader.className = 'frequent-accounts-header';
    frequentHeader.innerHTML = '<span class="material-icons">history</span> Recent Beneficiaries';
    
    const frequentList = document.createElement('div');
    frequentList.className = 'frequent-accounts-list';
    
    // Aggiungiamo alcuni account frequenti (useremo account recenti in una implementazione futura)
    const recentBeneficiaries = [
      { name: 'micro.cur8', isDefault: true },
      ...(this.getRecentBeneficiaries() || [])
    ];
    
    recentBeneficiaries.forEach(account => {
      if (!account.name) return;
      
      const accountChip = document.createElement('div');
      accountChip.className = 'account-chip';
      if (account.isDefault) {
        accountChip.classList.add('default-account');
      }
      
      accountChip.textContent = account.name;
      accountChip.addEventListener('click', () => {
        nameInput.value = account.name;
        // Trigger input event to update UI
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      
      frequentList.appendChild(accountChip);
    });
    
    frequentSection.appendChild(frequentHeader);
    frequentSection.appendChild(frequentList);
    
    nameGroup.appendChild(frequentSection);
    
    // Campo per la percentuale
    const percentGroup = document.createElement('div');
    percentGroup.className = 'form-group';
    
    const percentLabel = document.createElement('div');
    percentLabel.className = 'form-label-with-info';
    
    const percentText = document.createElement('label');
    percentText.htmlFor = 'new-beneficiary-percent';
    percentText.textContent = 'Percentage';
    
    percentLabel.appendChild(percentText);
    
    // Visualizzazione migliorata dello slider
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    const percentSlider = document.createElement('input');
    percentSlider.type = 'range';
    percentSlider.id = 'new-beneficiary-percent';
    percentSlider.className = 'form-control range-input';
    percentSlider.min = '0';
    percentSlider.max = '5000';
    percentSlider.step = '50';
    percentSlider.value = '500'; // 5% predefinito
    
    const sliderMarks = document.createElement('div');
    sliderMarks.className = 'slider-marks';
    
    // Aggiungiamo alcuni mark points
    [0, 25, 50].forEach(percent => {
      const mark = document.createElement('span');
      mark.className = 'slider-mark';
      mark.style.left = `${percent}%`;
      mark.dataset.value = `${percent}%`;
      
      sliderMarks.appendChild(mark);
    });
    
    sliderContainer.appendChild(percentSlider);
    sliderContainer.appendChild(sliderMarks);
    
    // Visualizzazione percentuale
    const percentageDisplay = document.createElement('div');
    percentageDisplay.className = 'percentage-display';
    
    const percentValue = document.createElement('div');
    percentValue.className = 'range-value';
    percentValue.textContent = '5.0%';
    
    percentageDisplay.appendChild(percentValue);
    
    // Quick percentage presets
    const percentPresets = document.createElement('div');
    percentPresets.className = 'percent-presets';
    
    [1, 5, 10, 20, 50].forEach(percent => {
      const preset = document.createElement('button');
      preset.type = 'button';
      preset.className = 'percent-preset-btn';
      preset.textContent = `${percent}%`;
      preset.addEventListener('click', () => {
        percentSlider.value = percent * 100;
        percentValue.textContent = `${percent}.0%`;
      });
      
      percentPresets.appendChild(preset);
    });
    
    // Update percentage value when slider changes
    percentSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value) / 100;
      percentValue.textContent = `${value.toFixed(1)}%`;
    });
    
    percentGroup.appendChild(percentLabel);
    percentGroup.appendChild(sliderContainer);
    percentGroup.appendChild(percentageDisplay);
    percentGroup.appendChild(percentPresets);
    
    // Pulsanti
    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn secondary-btn';
    cancelBtn.textContent = 'Cancel';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary-btn';
    addBtn.innerHTML = '<span class="material-icons">add</span> Add Beneficiary';
    addBtn.disabled = true; // Inizialmente disabilitato
    
    buttons.appendChild(cancelBtn);
    buttons.appendChild(addBtn);
    
    // Assembla il dialog
    body.appendChild(nameGroup);
    body.appendChild(percentGroup);
    body.appendChild(buttons);
    
    dialogContent.appendChild(header);
    dialogContent.appendChild(body);
    
    dialog.appendChild(dialogContent);
    
    // Aggiungi il dialog al DOM
    document.body.appendChild(dialog);
    
    // Event handlers
    closeBtn.addEventListener('click', () => {
      dialog.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
      dialog.remove();
    });
    
    // Abilita/disabilita il pulsante in base all'input
    nameInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      addBtn.disabled = !value;
      
      // Cerca utenti solo se la query ha almeno 3 caratteri
      if (value && value.length >= 3) {
        // Cancella il timeout precedente
        clearTimeout(this.beneficiarySearchTimeout);
        
        // Imposta un nuovo timeout
        this.beneficiarySearchTimeout = setTimeout(() => {
          this.searchBeneficiaries(value);
        }, 300);
      } else {
        this.hideBeneficiarySuggestions();
      }
    });
    
    addBtn.addEventListener('click', () => {
      const account = nameInput.value.trim();
      const weight = parseInt(percentSlider.value);
      
      if (!account) {
        this.showDialogError('Please enter a valid account name', dialog);
        return;
      }
      
      this.addBeneficiary(account, weight, dialog);
      
      // Aggiungi alla lista di account recenti
      this.saveRecentBeneficiary(account);
    });
    
    // Chiudi con Escape
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dialog.remove();
      }
    });
    
    // Click fuori per chiudere
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
    
    // Focus sull'input del nome
    nameInput.focus();
  }

  /**
   * Mostra un errore nel dialog
   * @param {string} message - Il messaggio di errore
   * @param {HTMLElement} dialog - Il dialog
   */
  showDialogError(message, dialog) {
    // Rimuovi eventuali errori precedenti
    const existingError = dialog.querySelector('.dialog-error');
    if (existingError) {
      existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'dialog-error';
    errorDiv.textContent = message;
    
    const body = dialog.querySelector('.dialog-body');
    if (body) {
      body.insertBefore(errorDiv, body.firstChild);
    }
  }

  /**
   * Aggiunge un nuovo beneficiario
   * @param {string} account - Il nome dell'account
   * @param {number} weight - Il peso (0-10000)
   * @param {HTMLElement} dialog - Il dialog da chiudere dopo l'aggiunta
   */
  addBeneficiary(account, weight, dialog) {
    // Verifica se è stato raggiunto il limite massimo
    if (this.beneficiaries.length >= createPostService.maxBeneficiaries) {
      this.showDialogError(`Maximum ${createPostService.maxBeneficiaries} beneficiaries allowed`, dialog);
      return;
    }
    
    // Verifica se il beneficiario esiste già
    const existingIndex = this.beneficiaries.findIndex(b => b.account.toLowerCase() === account.toLowerCase());
    if (existingIndex !== -1) {
      this.showDialogError('This beneficiary is already in the list', dialog);
      return;
    }
    
    // Aggiungi il beneficiario
    this.beneficiaries.push({
      account: account,
      weight: weight
    });
    
    // Aggiorna la UI
    const beneficiariesList = document.getElementById('beneficiaries-list');
    if (beneficiariesList) {
      this.renderBeneficiaryItems(beneficiariesList);
    }
    
    // Aggiorna il pulsante di aggiunta
    const addBtn = document.getElementById('add-beneficiary-btn');
    if (addBtn) {
      addBtn.disabled = this.beneficiaries.length >= createPostService.maxBeneficiaries;
    }
    
    // Aggiorna il riepilogo
    const summaryElement = document.getElementById('beneficiary-summary');
    if (summaryElement) {
      this.updateBeneficiarySummary(summaryElement);
    }
    
    // Chiudi il dialog
    if (dialog) {
      dialog.remove();
    }
    
    this.hasUnsavedChanges = true;
  }

  /**
   * Rimuove un beneficiario
   * @param {number} index - L'indice del beneficiario da rimuovere
   */
  removeBeneficiary(index) {
    if (index < 0 || index >= this.beneficiaries.length) return;
    
    // Rimuovi il beneficiario
    this.beneficiaries.splice(index, 1);
    
    // Aggiorna la UI
    const beneficiariesList = document.getElementById('beneficiaries-list');
    if (beneficiariesList) {
      this.renderBeneficiaryItems(beneficiariesList);
    }
    
    // Aggiorna il pulsante di aggiunta
    const addBtn = document.getElementById('add-beneficiary-btn');
    if (addBtn) {
      addBtn.disabled = this.beneficiaries.length >= createPostService.maxBeneficiaries;
    }
    
    // Aggiorna il riepilogo
    const summaryElement = document.getElementById('beneficiary-summary');
    if (summaryElement) {
      this.updateBeneficiarySummary(summaryElement);
    }
    
    this.hasUnsavedChanges = true;
  }

  /**
   * Salva un beneficiario nell'elenco dei beneficiari recenti
   * @param {string} accountName - Nome dell'account da salvare
   */
  saveRecentBeneficiary(accountName) {
    if (!accountName) return;
    
    try {
      // Ottieni la lista corrente
      const recents = this.getRecentBeneficiaries() || [];
      
      // Verifica se l'account è già presente e rimuovilo (così verrà spostato in cima)
      const accountIndex = recents.findIndex(b => b.name.toLowerCase() === accountName.toLowerCase());
      if (accountIndex !== -1) {
        recents.splice(accountIndex, 1);
      }
      
      // Aggiungi in cima
      recents.unshift({ name: accountName, timestamp: new Date().toISOString() });
      
      // Mantieni solo gli ultimi 5
      const limitedRecents = recents.slice(0, 5);
      
      // Salva in localStorage
      localStorage.setItem('steemee_recent_beneficiaries', JSON.stringify(limitedRecents));
    } catch (error) {
      console.error('Failed to save recent beneficiary:', error);
    }
  }
  
  /**
   * Ottiene la lista dei beneficiari recenti
   * @returns {Array} - Lista dei beneficiari recenti
   */
  getRecentBeneficiaries() {
    try {
      const recentsJson = localStorage.getItem('steemee_recent_beneficiaries');
      if (!recentsJson) return [];
      
      return JSON.parse(recentsJson);
    } catch (error) {
      console.error('Failed to get recent beneficiaries:', error);
      return [];
    }
  }
}

export default CreatePostView;
