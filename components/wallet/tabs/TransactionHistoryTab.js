import Component from '../../Component.js';
import authService from '../../../services/AuthService.js';
import { formatDate } from '../../../utils/DateUtils.js';
import transactionHistoryService from '../../../services/TransactionHistoryService.js';

export default class TransactionHistoryTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.allTransactions = [];
    this.username = authService.getCurrentUser()?.username || '';
    this.isLoading = false;
    
    // Struttura modificata per supportare tipi dinamici
    this.transactionTypes = new Set(); // Per memorizzare i tipi unici di transazione
    this.filters = {
      types: {}, // Sarà popolato dinamicamente
      direction: {
        byUser: true,
        onUser: true
      }
    };
    this.limit = 50; // Inizia con 50 transazioni
    
    // Aggiungi contatori per i tipi di transazioni
    this.typeCounts = {};
    
    // Riferimenti agli elementi DOM
    this.transactionListElement = null;
    this.loadMoreButton = null;
    this.filterCheckboxes = {};
    this.filterContainer = null;
    this.resultsCounter = null;
    
    // Binding dei metodi
    this.handleApplyFilters = this.handleApplyFilters.bind(this);
    this.handleLoadMore = this.handleLoadMore.bind(this);
    this.updateFilterUI = this.updateFilterUI.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.toggleAllFiltersOfType = this.toggleAllFiltersOfType.bind(this);
  }
  
  render() {
    // Crea l'elemento principale del tab
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'history-tab';
    
    // Aggiungi l'intestazione con filtri
    this.element.appendChild(this.createHeaderElement());
    
    // Aggiungi il contenitore delle transazioni
    const transactionContainer = this.createTransactionContainer();
    this.element.appendChild(transactionContainer);
    
    // Aggiungi al DOM
    this.parentElement.appendChild(this.element);
    
    // Salva riferimenti agli elementi DOM che dovranno essere aggiornati
    this.transactionListElement = this.element.querySelector('#transaction-list');
    this.loadMoreButton = this.element.querySelector('#load-more');
    
    // Aggiungi event listeners
    this.setupEventListeners();
    
    // Carica le transazioni
    this.loadTransactions();
    
    return this.element;
  }
  
  createHeaderElement() {
    const header = document.createElement('div');
    header.className = 'transaction-header';
    
    // Titolo
    const title = document.createElement('h3');
    title.textContent = 'Transaction History';
    header.appendChild(title);
    
    // Contenitore filtri
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    
    const details = document.createElement('details');
    
    const summary = document.createElement('summary');
    summary.textContent = 'Filters';
    details.appendChild(summary);
    
    const filterOptions = document.createElement('div');
    filterOptions.className = 'filter-options';
    
    // Gruppo filtri per tipo (vuoto inizialmente, sarà popolato dinamicamente)
    const typeFilterGroup = document.createElement('div');
    typeFilterGroup.className = 'filter-group type-filter-group';
    typeFilterGroup.id = 'type-filters';
    
    // Intestazione con opzioni select/deselect all
    const typeFilterHeader = document.createElement('div');
    typeFilterHeader.className = 'filter-group-header';
    
    const typeHeaderText = document.createElement('span');
    typeHeaderText.textContent = 'Transaction Types';
    typeFilterHeader.appendChild(typeHeaderText);
    
    // Aggiungi pulsanti select/deselect all
    const selectAllTypesButton = document.createElement('button');
    selectAllTypesButton.className = 'filter-select-btn';
    selectAllTypesButton.textContent = 'Select All';
    selectAllTypesButton.dataset.action = 'select';
    selectAllTypesButton.dataset.filterType = 'type';
    this.registerEventHandler(selectAllTypesButton, 'click', this.toggleAllFiltersOfType);
    
    const deselectAllTypesButton = document.createElement('button');
    deselectAllTypesButton.className = 'filter-select-btn';
    deselectAllTypesButton.textContent = 'Deselect All';
    deselectAllTypesButton.dataset.action = 'deselect';
    deselectAllTypesButton.dataset.filterType = 'type';
    this.registerEventHandler(deselectAllTypesButton, 'click', this.toggleAllFiltersOfType);
    
    const selectButtons = document.createElement('div');
    selectButtons.className = 'filter-select-actions';
    selectButtons.appendChild(selectAllTypesButton);
    selectButtons.appendChild(deselectAllTypesButton);
    
    typeFilterHeader.appendChild(selectButtons);
    typeFilterGroup.appendChild(typeFilterHeader);
    
    // Contenitore per i filtri di tipo (verrà popolato dinamicamente)
    const typeFiltersContainer = document.createElement('div');
    typeFiltersContainer.className = 'filters-container';
    typeFilterGroup.appendChild(typeFiltersContainer);
    
    // Aggiungi un contatore dei risultati filtrati
    const resultsCounter = document.createElement('div');
    resultsCounter.id = 'filtered-results-count';
    resultsCounter.className = 'results-counter';
    resultsCounter.textContent = 'Loading transactions...';
    
    // Gruppo filtri per direzione
    const directionFilterGroup = document.createElement('div');
    directionFilterGroup.className = 'filter-group';
    
    // Intestazione con opzioni select/deselect all per direzione
    const dirHeaderText = document.createElement('div');
    dirHeaderText.className = 'filter-group-header';
    
    const dirHeaderTextSpan = document.createElement('span');
    dirHeaderTextSpan.textContent = 'Direction';
    dirHeaderText.appendChild(dirHeaderTextSpan);
    
    const selectAllDirButton = document.createElement('button');
    selectAllDirButton.className = 'filter-select-btn';
    selectAllDirButton.textContent = 'Select All';
    selectAllDirButton.dataset.action = 'select';
    selectAllDirButton.dataset.filterType = 'direction';
    this.registerEventHandler(selectAllDirButton, 'click', this.toggleAllFiltersOfType);
    
    const deselectAllDirButton = document.createElement('button');
    deselectAllDirButton.className = 'filter-select-btn';
    deselectAllDirButton.textContent = 'Deselect All';
    deselectAllDirButton.dataset.action = 'deselect';
    deselectAllDirButton.dataset.filterType = 'direction';
    this.registerEventHandler(deselectAllDirButton, 'click', this.toggleAllFiltersOfType);
    
    const dirSelectButtons = document.createElement('div');
    dirSelectButtons.className = 'filter-select-actions';
    dirSelectButtons.appendChild(selectAllDirButton);
    dirSelectButtons.appendChild(deselectAllDirButton);
    
    dirHeaderText.appendChild(dirSelectButtons);
    directionFilterGroup.appendChild(dirHeaderText);
    
    // Checkboxes per direzione
    const directionFilters = [
      { id: 'filter-by', label: 'Actions performed by account', icon: 'arrow_upward' },
      { id: 'filter-on', label: 'Actions received by account', icon: 'arrow_downward' }
    ];
    
    const dirFiltersContainer = document.createElement('div');
    dirFiltersContainer.className = 'filters-container';
    
    directionFilters.forEach(filter => {
      const filterItem = document.createElement('div');
      filterItem.className = 'filter-item';
      
      const label = document.createElement('label');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = filter.id;
      checkbox.checked = true;
      checkbox.dataset.filterType = 'direction';
      
      // Aggiungi event listener per applicare il filtro al cambio
      this.registerEventHandler(checkbox, 'change', this.handleFilterChange);
      
      // Salva riferimento alla checkbox
      this.filterCheckboxes[filter.id] = checkbox;
      
      const icon = document.createElement('span');
      icon.className = 'material-icons filter-icon';
      icon.textContent = filter.icon;
      
      const labelText = document.createElement('span');
      labelText.textContent = filter.label;
      
      label.appendChild(checkbox);
      label.appendChild(icon);
      label.appendChild(labelText);
      
      filterItem.appendChild(label);
      dirFiltersContainer.appendChild(filterItem);
    });
    
    directionFilterGroup.appendChild(dirFiltersContainer);
    
    // Assembla i filtri
    filterOptions.appendChild(typeFilterGroup);
    filterOptions.appendChild(directionFilterGroup);
    filterOptions.appendChild(resultsCounter);
    
    details.appendChild(filterOptions);
    filterContainer.appendChild(details);
    header.appendChild(filterContainer);
    
    // Memorizza il riferimento al contenitore dei filtri di tipo per aggiornamenti futuri
    this.filterContainer = typeFiltersContainer;
    this.resultsCounter = resultsCounter;
    
    return header;
  }
  
  createTransactionContainer() {
    const container = document.createElement('div');
    container.className = 'transaction-container';
    
    // Contenitore lista transazioni
    const transactionList = document.createElement('div');
    transactionList.id = 'transaction-list';
    transactionList.className = 'transaction-list';
    
    // Stato di caricamento iniziale
    const loadingState = document.createElement('div');
    loadingState.className = 'loading-state';
    loadingState.textContent = 'Loading transaction history...';
    
    transactionList.appendChild(loadingState);
    container.appendChild(transactionList);
    
    // Azioni per le transazioni (load more)
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'transaction-actions';
    
    const loadMoreButton = document.createElement('button');
    loadMoreButton.id = 'load-more';
    loadMoreButton.className = 'btn primary-btn';
    loadMoreButton.textContent = 'Load More';
    
    actionsContainer.appendChild(loadMoreButton);
    container.appendChild(actionsContainer);
    
    return container;
  }
  
  setupEventListeners() {
    // Gestisci i clic sul pulsante "Load More"
    if (this.loadMoreButton) {
      this.registerEventHandler(this.loadMoreButton, 'click', this.handleLoadMore);
    }
    
    // Note: non abbiamo più bisogno del pulsante apply filters perché i filtri
    // si applicano automaticamente al cambio delle checkbox
  }
  
  handleApplyFilters() {
    // Prima di applicare i filtri, salva lo stato corrente 
    // di tutte le checkbox nel this.filters
    this.updateFilters();
    
    // Log dei filtri applicati
    console.log('Applying filters:', JSON.stringify(this.filters, null, 2));
    
    // Renderizza le transazioni con i nuovi filtri
    this.renderTransactions();
  }
  
  handleLoadMore() {
    this.limit += 50; // Carica altre 50 transazioni
    this.loadTransactions();
  }
  
  // Nuovo metodo per gestire il cambio di un filtro
  handleFilterChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const isChecked = checkbox.checked;
    
    console.log(`Filter changed: ${type} = ${isChecked}`);
    
    // Aggiorna direttamente lo stato del filtro
    if (type && checkbox.dataset.filterType === 'type') {
      this.filters.types[type] = isChecked;
    }
    
    this.updateFilters();
    this.renderTransactions();
  }
  
  // Nuovo metodo per selezionare/deselezionare tutti i filtri di un tipo
  toggleAllFiltersOfType(event) {
    const action = event.currentTarget.dataset.action;
    const filterType = event.currentTarget.dataset.filterType;
    const shouldCheck = action === 'select';
    
    if (filterType === 'type') {
      // Seleziona/deseleziona tutti i tipi di transazione
      this.transactionTypes.forEach(type => {
        const checkboxId = `filter-${type}`;
        if (this.filterCheckboxes[checkboxId]) {
          this.filterCheckboxes[checkboxId].checked = shouldCheck;
        }
      });
    } else if (filterType === 'direction') {
      // Seleziona/deseleziona tutte le direzioni
      ['filter-by', 'filter-on'].forEach(id => {
        if (this.filterCheckboxes[id]) {
          this.filterCheckboxes[id].checked = shouldCheck;
        }
      });
    }
    
    // Aggiorna i filtri e renderizza
    this.updateFilters();
    this.renderTransactions();
  }
  
  updateFilters() {
    // Aggiorna i filtri di direzione
    this.filters.direction = {
      byUser: this.filterCheckboxes['filter-by']?.checked ?? true,
      onUser: this.filterCheckboxes['filter-on']?.checked ?? true
    };
    
    // Aggiorna i filtri di tipo SOLO se la checkbox esiste
    // Altrimenti, mantieni lo stato esistente
    Array.from(this.transactionTypes).forEach(type => {
      const checkboxId = `filter-${type}`;
      if (this.filterCheckboxes[checkboxId]) {
        this.filters.types[type] = this.filterCheckboxes[checkboxId].checked;
      }
    });
  }
  
  async loadTransactions() {
    if (!this.username || this.isLoading || !this.transactionListElement) return;
    
    this.isLoading = true;
    
    // Mostra stato di caricamento
    if (this.allTransactions.length === 0) {
      this.showLoadingState();
    } else if (this.loadMoreButton) {
      this.loadMoreButton.disabled = true;
      
      // Rimuovi il testo esistente
      while (this.loadMoreButton.firstChild) {
        this.loadMoreButton.removeChild(this.loadMoreButton.firstChild);
      }
      
      // Aggiungi icona di caricamento e testo
      const loadingIcon = document.createElement('span');
      loadingIcon.className = 'material-icons loading-icon';
      loadingIcon.textContent = 'hourglass_top';
      this.loadMoreButton.appendChild(loadingIcon);
      
      this.loadMoreButton.appendChild(document.createTextNode(' Loading...'));
    }
    
    try {
      // Usa il from=-1 per ottenere le transazioni più recenti
      // Se abbiamo già alcune transazioni, usa l'ultima come punto di partenza
      let from = -1;
      if (this.allTransactions.length > 0) {
        from = this.allTransactions[this.allTransactions.length - 1].id - 1;
      }
      
      // Recupera la cronologia dell'account usando il servizio
      const rawTransactions = await transactionHistoryService.getUserTransactionHistory(this.username, this.limit, from);
      
      if (rawTransactions && Array.isArray(rawTransactions)) {
        // Processa e formatta le transazioni
        let formattedTransactions = [];
        for (const tx of rawTransactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          formattedTransactions.push(formattedTx);
        }
        
        // IMPORTANTE: Salva i filtri correnti prima di aggiornare i dati
        const currentFilters = { ...this.filters };
        
        // Aggiungi le nuove transazioni invece di sovrascrivere tutto l'array
        // Se è il primo caricamento, sostituisci l'array, altrimenti aggiungi
        if (this.allTransactions.length === 0) {
          this.allTransactions = formattedTransactions;
        } else {
          // Evita duplicati confrontando gli ID delle transazioni
          const existingIds = new Set(this.allTransactions.map(tx => tx.id));
          const uniqueNewTransactions = formattedTransactions.filter(tx => !existingIds.has(tx.id));
          this.allTransactions = [...this.allTransactions, ...uniqueNewTransactions];
        }
        
        // Estrai i tipi di transazione e aggiorna i filtri
        this.extractTransactionTypes(currentFilters);
        this.updateFilterUI(true); // passa true per mantenere lo stato dei filtri
        
        this.renderTransactions();
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      this.showErrorState(error.message || 'Unknown error');
    } finally {
      this.isLoading = false;
      if (this.loadMoreButton) {
        this.loadMoreButton.disabled = false;
        this.loadMoreButton.textContent = 'Load More';
      }
    }
  }
  
  extractTransactionTypes(currentFilters = {}) {
    // Salva i filtri correnti
    const existingFilters = { ...this.filters.types };
    
    // Reset dei conteggi o inizializzazione se è il primo caricamento
    if (!this.typeCounts) this.typeCounts = {};
    
    // Set di ID già contati per evitare duplicazioni nel conteggio
    const countedIds = new Set();
    
    // Per ogni transazione
    for (const tx of this.allTransactions) {
      // Evita di contare due volte la stessa transazione
      if (countedIds.has(tx.id)) continue;
      countedIds.add(tx.id);
      
      // Determina il tipo di transazione
      const txType = tx.type || 'other';
      
      // Aggiungi al set di tipi
      this.transactionTypes.add(txType);
      
      // Aggiorna il conteggio per questo tipo
      this.typeCounts[txType] = (this.typeCounts[txType] || 0) + 1;
    }
    
    // Aggiorna i filtri mantenendo lo stato esistente
    const newFilters = {};
    for (const type of this.transactionTypes) {
      // Se il filtro esisteva già, mantieni il suo stato
      if (existingFilters.hasOwnProperty(type)) {
        newFilters[type] = existingFilters[type];
      } 
      // Se era nell'oggetto currentFilters (stato precedente salvato), usa quello
      else if (currentFilters.types && currentFilters.types.hasOwnProperty(type)) {
        newFilters[type] = currentFilters.types[type];
      }
      // Altrimenti imposta a true per default
      else {
        newFilters[type] = true;
      }
    }
    
    // Aggiorna i filtri con i valori aggiornati
    this.filters.types = newFilters;
    
    if (this.debug) {
      console.log(`Extracted ${this.transactionTypes.size} transaction types with counts:`, this.typeCounts);
      console.log('Updated filters:', this.filters.types);
    }
  }
  
  updateFilterUI(preserveState = false) {
    if (!this.filterContainer) return;
    
    // Salva lo stato corrente delle checkbox per tipo e checkbox ID
    const savedTypeStates = {};
    
    if (preserveState) {
      // Crea una mappatura tipo -> stato checkbox
      Object.keys(this.filterCheckboxes).forEach(id => {
        if (id.startsWith('filter-') && this.filterCheckboxes[id]) {
          // Estrai il tipo dalla checkbox ID (filter-transfer -> transfer)
          const type = id.replace('filter-', '');
          savedTypeStates[type] = this.filterCheckboxes[id].checked;
        }
      });
      
      console.log('Preserving filter states:', savedTypeStates);
    }
    
    // Rimuovi i filtri esistenti per ricrearli
    while (this.filterContainer.firstChild) {
      this.filterContainer.removeChild(this.filterContainer.firstChild);
    }
    
    // Ordina i tipi alfabeticamente per una UI coerente
    const sortedTypes = Array.from(this.transactionTypes).sort();
    
    // Ricrea le checkbox per ogni tipo di transazione
    sortedTypes.forEach(type => {
      const filterItem = document.createElement('div');
      filterItem.className = 'filter-item';
      
      const label = document.createElement('label');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `filter-${type}`;
      
      // Determina lo stato corretto della checkbox
      let isChecked;
      
      if (preserveState && savedTypeStates[type] !== undefined) {
        // Usa lo stato salvato se disponibile
        isChecked = savedTypeStates[type];
      } else {
        // Altrimenti usa lo stato dal filtro o default a true
        isChecked = this.filters.types[type] !== false;
      }
      
      checkbox.checked = isChecked;
      checkbox.dataset.filterType = 'type';
      checkbox.dataset.type = type; // Memorizza il tipo per riferimento facile
      
      // Aggiungi event listener
      this.registerEventHandler(checkbox, 'change', this.handleFilterChange);
      
      // Salva riferimento alla checkbox
      this.filterCheckboxes[`filter-${type}`] = checkbox;
      
      label.appendChild(checkbox);
      
      // Icona corrispondente al tipo
      const icon = document.createElement('span');
      icon.className = 'material-icons filter-icon';
      icon.textContent = this.getIconForType(type);
      label.appendChild(icon);
      
      // Formatta il nome del tipo
      const displayName = document.createElement('span');
      displayName.textContent = `${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}`;
      label.appendChild(displayName);
      
      // Aggiungi conteggio con controllo di validità
      const count = document.createElement('span');
      count.className = 'filter-count';
      count.textContent = this.typeCounts[type] || 0;
      label.appendChild(count);
      
      filterItem.appendChild(label);
      this.filterContainer.appendChild(filterItem);
    });
  }
  
  renderTransactions() {
    if (!this.transactionListElement) return;
    
    console.log('Rendering transactions with filters:', JSON.stringify(this.filters));
    
    // Aggiorna i filtri
    this.updateFilters();
    
    // Filtra le transazioni - aggiungi timestamp performance
    const startTime = performance.now();
    const filteredTransactions = transactionHistoryService.filterTransactions(
      this.allTransactions, 
      this.filters, 
      this.username
    );
    const endTime = performance.now();
    
    console.log(`Filtered ${filteredTransactions.length} of ${this.allTransactions.length} transactions in ${(endTime - startTime).toFixed(2)}ms`);
    
    // Aggiorna il conteggio dei risultati
    if (this.resultsCounter) {
      this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
    }
    
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Ordina le transazioni
    const sortedTransactions = transactionHistoryService.sortTransactions(filteredTransactions);
    
    // Rimuovi contenuti esistenti
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    // Crea lista transazioni
    const transactionListElement = document.createElement('ul');
    transactionListElement.className = 'transaction-list';
    
    // Aggiungi ogni transazione alla lista
    for (const tx of sortedTransactions) {
      const transactionItem = this.createTransactionItem(tx);
      transactionListElement.appendChild(transactionItem);
    }
    
    this.transactionListElement.appendChild(transactionListElement);
  }
  
  createTransactionItem(tx) {
    // Crea l'elemento della transazione
    const listItem = document.createElement('li');
    listItem.className = 'transaction-item';
    
    // Determina se è un'azione dell'utente o verso l'utente
    const isActionByUser = tx.isActionByUser;
    const isActionOnUser = tx.isActionOnUser;
    
    // Crea l'icona della transazione
    const iconElement = document.createElement('div');
    iconElement.className = `transaction-icon ${tx.iconClass}`;
    
    const iconText = document.createElement('span');
    iconText.className = 'material-icons';
    iconText.textContent = tx.icon;
    
    iconElement.appendChild(iconText);
    listItem.appendChild(iconElement);
    
    // Crea i dettagli della transazione
    const detailsElement = document.createElement('div');
    detailsElement.className = 'transaction-details';
    
    // Titolo della transazione
    const titleElement = document.createElement('div');
    titleElement.className = 'transaction-title';
    titleElement.textContent = tx.title;
    detailsElement.appendChild(titleElement);
    
    // Metadati della transazione
    const metaElement = document.createElement('div');
    metaElement.className = 'transaction-meta';
    
    const dateElement = document.createElement('span');
    dateElement.className = 'transaction-date';
    dateElement.textContent = tx.formattedDate;
    metaElement.appendChild(dateElement);
    
    const memoElement = document.createElement('span');
    memoElement.className = 'transaction-memo';
    memoElement.textContent = tx.description;
    metaElement.appendChild(memoElement);
    
    // Aggiungi metaElement a detailsElement
    detailsElement.appendChild(metaElement);
    
    // Aggiungi indicatore direzione (in/out)
    const directionElement = document.createElement('div');
    directionElement.className = `transaction-direction ${isActionByUser ? 'outgoing' : 'incoming'}`;
    directionElement.textContent = isActionByUser ? 'Out' : 'In';
    detailsElement.appendChild(directionElement);
    
    // Aggiungi link all'explorer
    const linkElement = document.createElement('a');
    linkElement.className = 'transaction-link';
    linkElement.href = transactionHistoryService.createExplorerLink(tx, tx.data);
    linkElement.target =  (tx.data.author && tx.data.permlink) ? '_self' : '_blank';
    linkElement.rel = 'noopener noreferrer';
    
    const linkIcon = document.createElement('span');
    linkIcon.className = 'material-icons';
    linkIcon.textContent = 'open_in_new';
    linkElement.appendChild(linkIcon);
    
    const linkText = document.createTextNode('View on Explorer');
    linkElement.appendChild(linkText);
    
    detailsElement.appendChild(linkElement);
    
    // Aggiungi detailsElement all'elemento principale
    listItem.appendChild(detailsElement);
    
    return listItem;
  }

  destroy() {
    // Rimuovi i riferimenti agli elementi DOM
    this.transactionListElement = null;
    this.loadMoreButton = null;
    this.filterCheckboxes = {};
    
    // Chiama il metodo destroy della classe genitore
    super.destroy();
  }

  /**
   * Mostra lo stato di caricamento
   */
  showLoadingState() {
    if (!this.transactionListElement) return;
    
    // Pulisci l'elemento
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    // Crea e aggiungi l'elemento di caricamento
    const loadingState = document.createElement('div');
    loadingState.className = 'loading-state';
    
    const spinnerIcon = document.createElement('span');
    spinnerIcon.className = 'material-icons loading-icon spinning';
    spinnerIcon.textContent = 'sync';
    loadingState.appendChild(spinnerIcon);
    
    const loadingText = document.createElement('span');
    loadingText.textContent = 'Loading transactions...';
    loadingState.appendChild(loadingText);
    
    this.transactionListElement.appendChild(loadingState);
  }

  /**
   * Mostra lo stato di errore
   * @param {string} errorMessage - Messaggio di errore da mostrare
   */
  showErrorState(errorMessage) {
    if (!this.transactionListElement) return;
    
    // Pulisci l'elemento
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    // Crea e aggiungi l'elemento di errore
    const errorState = document.createElement('div');
    errorState.className = 'error-state';
    
    const errorIcon = document.createElement('span');
    errorIcon.className = 'material-icons error-icon';
    errorIcon.textContent = 'error_outline';
    errorState.appendChild(errorIcon);
    
    const errorText = document.createElement('span');
    errorText.textContent = errorMessage || 'Failed to load transactions';
    errorState.appendChild(errorText);
    
    const retryButton = document.createElement('button');
    retryButton.className = 'btn secondary-btn retry-button';
    retryButton.textContent = 'Retry';
    this.registerEventHandler(retryButton, 'click', () => {
      this.loadTransactions();
    });
    
    errorState.appendChild(retryButton);
    this.transactionListElement.appendChild(errorState);
  }

  /**
   * Mostra lo stato vuoto quando non ci sono transazioni da mostrare
   */
  showEmptyState() {
    if (!this.transactionListElement) return;
    
    // Pulisci l'elemento
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    // Crea e aggiungi l'elemento di stato vuoto
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const emptyIcon = document.createElement('span');
    emptyIcon.className = 'material-icons empty-icon';
    emptyIcon.textContent = 'info_outline';
    emptyState.appendChild(emptyIcon);
    
    const emptyText = document.createElement('span');
    
    // Determina se è vuoto perché non ci sono transazioni o perché i filtri non mostrano nulla
    if (this.allTransactions.length > 0) {
      emptyText.textContent = 'No transactions match your current filters.';
      
      // Aggiungi un pulsante per resettare i filtri
      const resetButton = document.createElement('button');
      resetButton.className = 'btn secondary-btn';
      resetButton.textContent = 'Reset Filters';
      this.registerEventHandler(resetButton, 'click', () => {
        // Ripristina tutti i filtri a true
        this.transactionTypes.forEach(type => {
          const checkboxId = `filter-${type}`;
          if (this.filterCheckboxes[checkboxId]) {
            this.filterCheckboxes[checkboxId].checked = true;
          }
        });
        
        // Ripristina anche i filtri di direzione
        if (this.filterCheckboxes['filter-by']) {
          this.filterCheckboxes['filter-by'].checked = true;
        }
        if (this.filterCheckboxes['filter-on']) {
          this.filterCheckboxes['filter-on'].checked = true;
        }
        
        // Aggiorna i filtri e renderizza di nuovo
        this.updateFilters();
        this.renderTransactions();
      });
      
      emptyState.appendChild(emptyText);
      emptyState.appendChild(resetButton);
    } else {
      emptyText.textContent = 'No transactions found for this account.';
      emptyState.appendChild(emptyText);
    }
    
    this.transactionListElement.appendChild(emptyState);
  }

  /**
   * Ottiene l'icona appropriata per il tipo di transazione
   * @param {string} type - Il tipo di transazione
   * @returns {string} - Il nome dell'icona Material Icons da utilizzare
   */
  getIconForType(type) {
    // Mappa dei tipi di transazione alle icone
    const iconMap = {
      transfer: 'swap_horiz',
      claim_reward: 'card_giftcard',
      vote: 'thumb_up',
      comment: 'comment',
      curation_reward: 'workspace_premium',
      author_reward: 'stars',
      delegate_vesting_shares: 'engineering',
      fill_order: 'shopping_cart',
      limit_order: 'receipt_long',
      producer_reward: 'verified',
      account_update: 'manage_accounts',
      effective_comment_vote: 'how_to_vote',
      withdraw_vesting: 'power_off',
      liquidity_reward: 'water_drop',
      interest: 'trending_up',
      transfer_to_vesting: 'upgrade',
      cancel_transfer_from_savings: 'cancel',
      return_vesting_delegation: 'keyboard_return',
      proposal_pay: 'description',
      escrow_transfer: 'security',
      escrow_approve: 'check_circle',
      escrow_dispute: 'gavel',
      escrow_release: 'lock_open',
      fill_convert_request: 'sync_alt',
      transfer_to_savings: 'savings',
      transfer_from_savings: 'move_up',
      comment_benefactor_reward: 'volunteer_activism',
      comment_reward: 'emoji_events',
      witness_update: 'update',
      witness_vote: 'how_to_vote',
      create_claimed_account: 'person_add',
      feed_publish: 'publish',
      other: 'more_horiz'
    };
    
    return iconMap[type] || 'help_outline';
  }
}