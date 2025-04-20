import Component from '../../Component.js';
import authService from '../../../services/AuthService.js';
import { formatDate } from '../../../utils/DateUtils.js';
import transactionHistoryService from '../../../services/TransactionHistoryService.js';
import filterService from '../../../services/FilterService.js';
import InfiniteScroll from '../../../utils/InfiniteScroll.js';
import LoadingIndicator from '../../LoadingIndicator.js';

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
      },
      dateRange: {
        startDate: null,
        endDate: null
      }
    };
    this.limit = 50; // Inizia con 50 transazioni
    this.page = 1; // Per l'infinite scroll
    this.hasMoreTransactions = true; // Flag per controllare se ci sono altre transazioni
    
    // Aggiungi contatori per i tipi di transazioni
    this.typeCounts = {};
    
    // Riferimenti agli elementi DOM
    this.transactionListElement = null;
    this.loadMoreButton = null;
    this.filterCheckboxes = {};
    this.filterContainer = null;
    this.resultsCounter = null;
    this.dateRangePicker = null;
    
    // Riferimenti per l'infinite scroll
    this.infiniteScroll = null;
    this.infiniteScrollLoader = null;
    
    // Abilita il debug per il filterService se necessario
    if (options.debug) {
      filterService.setDebug(true);
    }
    
    // Binding dei metodi
    this.handleApplyFilters = this.handleApplyFilters.bind(this);
    this.handleLoadMore = this.handleLoadMore.bind(this);
    this.updateFilterUI = this.updateFilterUI.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.toggleAllFiltersOfType = this.toggleAllFiltersOfType.bind(this);
    this.handleDateRangeChange = this.handleDateRangeChange.bind(this);
    this.resetDateRange = this.resetDateRange.bind(this);
    this.setupInfiniteScroll = this.setupInfiniteScroll.bind(this);
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
    
    // Carica le transazioni e configura l'infinite scroll
    this.loadTransactions();
    
    // Configura l'infinite scroll dopo che le transazioni iniziali sono caricate
    setTimeout(() => {
      this.setupInfiniteScroll();
    }, 500);
    
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
    
    // Aggiungi il selettore dell'intervallo di date
    const dateRangeGroup = document.createElement('div');
    dateRangeGroup.className = 'filter-group date-range-group';
    
    const dateRangeHeader = document.createElement('div');
    dateRangeHeader.className = 'filter-group-header';
    
    const dateRangeTitle = document.createElement('span');
    dateRangeTitle.textContent = 'Date Range';
    dateRangeHeader.appendChild(dateRangeTitle);
    
    // Pulsante reset per date
    const resetDatesButton = document.createElement('button');
    resetDatesButton.className = 'filter-select-btn';
    resetDatesButton.textContent = 'Reset Dates';
    resetDatesButton.addEventListener('click', this.resetDateRange);
    
    const dateButtonsContainer = document.createElement('div');
    dateButtonsContainer.className = 'filter-select-actions';
    dateButtonsContainer.appendChild(resetDatesButton);
    dateRangeHeader.appendChild(dateButtonsContainer);
    
    dateRangeGroup.appendChild(dateRangeHeader);
    
    // Selettori di data
    const dateInputsContainer = document.createElement('div');
    dateInputsContainer.className = 'date-inputs-container';
    
    // Selettore data di inizio
    const startDateContainer = document.createElement('div');
    startDateContainer.className = 'date-input-group';
    
    const startDateLabel = document.createElement('label');
    startDateLabel.setAttribute('for', 'start-date');
    startDateLabel.textContent = 'From:';
    
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date';
    startDateInput.id = 'start-date';
    startDateInput.className = 'date-picker';
    startDateInput.valueAsDate = null; // Nessuna data di default
    
    startDateInput.addEventListener('change', this.handleDateRangeChange);
    
    startDateContainer.appendChild(startDateLabel);
    startDateContainer.appendChild(startDateInput);
    
    // Selettore data di fine
    const endDateContainer = document.createElement('div');
    endDateContainer.className = 'date-input-group';
    
    const endDateLabel = document.createElement('label');
    endDateLabel.setAttribute('for', 'end-date');
    endDateLabel.textContent = 'To:';
    
    const endDateInput = document.createElement('input');
    endDateInput.type = 'date';
    endDateInput.id = 'end-date';
    endDateInput.className = 'date-picker';
    endDateInput.valueAsDate = null; // Nessuna data di default
    
    endDateInput.addEventListener('change', this.handleDateRangeChange);
    
    endDateContainer.appendChild(endDateLabel);
    endDateContainer.appendChild(endDateInput);
    
    // Salva i riferimenti ai selettori di data
    this.dateRangePicker = {
      startDate: startDateInput,
      endDate: endDateInput
    };
    
    dateInputsContainer.appendChild(startDateContainer);
    dateInputsContainer.appendChild(endDateContainer);
    dateRangeGroup.appendChild(dateInputsContainer);
    
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
    filterOptions.appendChild(dateRangeGroup);
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
    
    return container;
  }
  
  setupEventListeners() {
    // Gestisci i clic sul pulsante "Load More"
    if (this.loadMoreButton) {
      this.registerEventHandler(this.loadMoreButton, 'click', this.handleLoadMore);
    }
  }
  
  handleApplyFilters() {
    this.updateFilters();
    console.log('Applying filters:', JSON.stringify(this.filters, null, 2));
    this.renderTransactions();
  }
  
  handleLoadMore() {
    this.limit += 50; // Carica altre 50 transazioni
    this.loadTransactions();
  }
  
  handleFilterChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const isChecked = checkbox.checked;
    
    console.log(`Filter changed: ${type} = ${isChecked}`);
    
    if (type && checkbox.dataset.filterType === 'type') {
      this.filters.types[type] = isChecked;
    }
    
    this.updateFilters();
    this.renderTransactions();
  }
  
  toggleAllFiltersOfType(event) {
    const action = event.currentTarget.dataset.action;
    const filterType = event.currentTarget.dataset.filterType;
    const shouldCheck = action === 'select';
    
    if (filterType === 'type') {
      this.transactionTypes.forEach(type => {
        const checkboxId = `filter-${type}`;
        if (this.filterCheckboxes[checkboxId]) {
          this.filterCheckboxes[checkboxId].checked = shouldCheck;
        }
      });
    } else if (filterType === 'direction') {
      ['filter-by', 'filter-on'].forEach(id => {
        if (this.filterCheckboxes[id]) {
          this.filterCheckboxes[id].checked = shouldCheck;
        }
      });
    }
    
    this.updateFilters();
    this.renderTransactions();
  }
  
  handleDateRangeChange() {
    const startDateValue = this.dateRangePicker.startDate.value;
    const endDateValue = this.dateRangePicker.endDate.value;
    
    this.filters.dateRange.startDate = startDateValue || null;
    this.filters.dateRange.endDate = endDateValue || null;
    
    if (startDateValue || endDateValue) {
      console.log(`Date range filter applied: ${startDateValue || 'any'} to ${endDateValue || 'any'}`);
    } else {
      console.log('Date range filter cleared');
    }
    
    this.renderTransactions();
  }
  
  resetDateRange() {
    if (this.dateRangePicker) {
      this.dateRangePicker.startDate.value = '';
      this.dateRangePicker.endDate.value = '';
    }
    
    this.filters.dateRange = {
      startDate: null,
      endDate: null
    };
    
    this.renderTransactions();
  }
  
  updateFilters() {
    this.filters.direction = {
      byUser: this.filterCheckboxes['filter-by']?.checked ?? true,
      onUser: this.filterCheckboxes['filter-on']?.checked ?? true
    };
    
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
    
    if (this.allTransactions.length === 0) {
      this.showLoadingState();
    } else if (this.loadMoreButton) {
      this.loadMoreButton.disabled = true;
      
      while (this.loadMoreButton.firstChild) {
        this.loadMoreButton.removeChild(this.loadMoreButton.firstChild);
      }
      
      const loadingIcon = document.createElement('span');
      loadingIcon.className = 'material-icons loading-icon';
      loadingIcon.textContent = 'hourglass_top';
      this.loadMoreButton.appendChild(loadingIcon);
      
      this.loadMoreButton.appendChild(document.createTextNode(' Loading...'));
    }
    
    try {
      let from = -1;
      if (this.allTransactions.length > 0) {
        from = this.allTransactions[this.allTransactions.length - 1].id - 1;
      }
      
      const rawTransactions = await transactionHistoryService.getUserTransactionHistory(this.username, this.limit, from);
      
      if (rawTransactions && Array.isArray(rawTransactions)) {
        let formattedTransactions = [];
        for (const tx of rawTransactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          formattedTransactions.push(formattedTx);
        }
        
        const currentFilters = { ...this.filters };
        
        if (this.allTransactions.length === 0) {
          this.allTransactions = formattedTransactions;
        } else {
          const existingIds = new Set(this.allTransactions.map(tx => tx.id));
          const uniqueNewTransactions = formattedTransactions.filter(tx => !existingIds.has(tx.id));
          this.allTransactions = [...this.allTransactions, ...uniqueNewTransactions];
        }
        
        this.extractTransactionTypes(currentFilters);
        this.updateFilterUI(true);
        
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
    const existingFilters = { ...this.filters.types };
    
    if (!this.typeCounts) this.typeCounts = {};
    
    const countedIds = new Set();
    
    for (const tx of this.allTransactions) {
      if (countedIds.has(tx.id)) continue;
      countedIds.add(tx.id);
      
      const txType = tx.type || 'other';
      
      this.transactionTypes.add(txType);
      
      this.typeCounts[txType] = (this.typeCounts[txType] || 0) + 1;
    }
    
    const newFilters = {};
    for (const type of this.transactionTypes) {
      if (existingFilters.hasOwnProperty(type)) {
        newFilters[type] = existingFilters[type];
      } else if (currentFilters.types && currentFilters.types.hasOwnProperty(type)) {
        newFilters[type] = currentFilters.types[type];
      } else {
        newFilters[type] = true;
      }
    }
    
    this.filters.types = newFilters;
    
    if (this.debug) {
      console.log(`Extracted ${this.transactionTypes.size} transaction types with counts:`, this.typeCounts);
      console.log('Updated filters:', this.filters.types);
    }
  }
  
  updateFilterUI(preserveState = false) {
    if (!this.filterContainer) return;
    
    const savedTypeStates = {};
    
    if (preserveState) {
      Object.keys(this.filterCheckboxes).forEach(id => {
        if (id.startsWith('filter-') && this.filterCheckboxes[id]) {
          const type = id.replace('filter-', '');
          savedTypeStates[type] = this.filterCheckboxes[id].checked;
        }
      });
      
      console.log('Preserving filter states:', savedTypeStates);
    }
    
    while (this.filterContainer.firstChild) {
      this.filterContainer.removeChild(this.filterContainer.firstChild);
    }
    
    const sortedTypes = Array.from(this.transactionTypes).sort();
    
    sortedTypes.forEach(type => {
      const filterItem = document.createElement('div');
      filterItem.className = 'filter-item';
      
      const label = document.createElement('label');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `filter-${type}`;
      
      let isChecked;
      
      if (preserveState && savedTypeStates[type] !== undefined) {
        isChecked = savedTypeStates[type];
      } else {
        isChecked = this.filters.types[type] !== false;
      }
      
      checkbox.checked = isChecked;
      checkbox.dataset.filterType = 'type';
      checkbox.dataset.type = type;
      
      this.registerEventHandler(checkbox, 'change', this.handleFilterChange);
      
      this.filterCheckboxes[`filter-${type}`] = checkbox;
      
      label.appendChild(checkbox);
      
      const icon = document.createElement('span');
      icon.className = 'material-icons filter-icon';
      icon.textContent = this.getIconForType(type);
      label.appendChild(icon);
      
      const displayName = document.createElement('span');
      displayName.textContent = `${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}`;
      label.appendChild(displayName);
      
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
    
    this.updateFilters();
    
    const startTime = performance.now();
    const filteredTransactions = transactionHistoryService.filterTransactions(
      this.allTransactions, 
      this.filters, 
      this.username
    );
    const endTime = performance.now();
    
    console.log(`Filtered ${filteredTransactions.length} of ${this.allTransactions.length} transactions in ${(endTime - startTime).toFixed(2)}ms`);
    
    if (this.resultsCounter) {
      this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
    }
    
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    const sortedTransactions = transactionHistoryService.sortTransactions(filteredTransactions);
    
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    const transactionListElement = document.createElement('ul');
    transactionListElement.className = 'transaction-list';
    
    for (const tx of sortedTransactions) {
      const transactionItem = this.createTransactionItem(tx);
      transactionListElement.appendChild(transactionItem);
    }
    
    this.transactionListElement.appendChild(transactionListElement);
  }
  
  createTransactionItem(tx) {
    const listItem = document.createElement('li');
    listItem.className = 'transaction-item';
    
    const isActionByUser = tx.isActionByUser;
    const isActionOnUser = tx.isActionOnUser;
    
    const iconElement = document.createElement('div');
    iconElement.className = `transaction-icon ${tx.iconClass}`;
    
    const iconText = document.createElement('span');
    iconText.className = 'material-icons';
    iconText.textContent = tx.icon;
    
    iconElement.appendChild(iconText);
    listItem.appendChild(iconElement);
    
    const detailsElement = document.createElement('div');
    detailsElement.className = 'transaction-details';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'transaction-title';
    titleElement.textContent = tx.title;
    detailsElement.appendChild(titleElement);
    
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
    
    detailsElement.appendChild(metaElement);
    
    const directionElement = document.createElement('div');
    directionElement.className = `transaction-direction ${isActionByUser ? 'outgoing' : 'incoming'}`;
    directionElement.textContent = isActionByUser ? 'Out' : 'In';
    detailsElement.appendChild(directionElement);
    
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
    
    listItem.appendChild(detailsElement);
    
    return listItem;
  }

  destroy() {
    // Distruggi l'InfiniteScroll se esiste
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.infiniteScrollLoader) {
      this.infiniteScrollLoader = null;
    }
    
    this.transactionListElement = null;
    this.filterCheckboxes = {};
    this.dateRangePicker = null;
    
    super.destroy();
  }

  showLoadingState() {
    if (!this.transactionListElement) return;
    
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
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

  showErrorState(errorMessage) {
    if (!this.transactionListElement) return;
    
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
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

  showEmptyState() {
    if (!this.transactionListElement) return;
    
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const emptyIcon = document.createElement('span');
    emptyIcon.className = 'material-icons empty-icon';
    emptyIcon.textContent = 'info_outline';
    emptyState.appendChild(emptyIcon);
    
    const emptyText = document.createElement('span');
    
    if (this.allTransactions.length > 0) {
      const hasDateFilter = this.filters.dateRange.startDate || this.filters.dateRange.endDate;
      
      if (hasDateFilter) {
        emptyText.textContent = 'No transactions match your current filters. Try changing the date range.';
      } else {
        emptyText.textContent = 'No transactions match your current filters.';
      }
      
      const resetButton = document.createElement('button');
      resetButton.className = 'btn secondary-btn';
      resetButton.textContent = 'Reset All Filters';
      this.registerEventHandler(resetButton, 'click', () => {
        this.transactionTypes.forEach(type => {
          const checkboxId = `filter-${type}`;
          if (this.filterCheckboxes[checkboxId]) {
            this.filterCheckboxes[checkboxId].checked = true;
          }
        });
        
        if (this.filterCheckboxes['filter-by']) {
          this.filterCheckboxes['filter-by'].checked = true;
        }
        if (this.filterCheckboxes['filter-on']) {
          this.filterCheckboxes['filter-on'].checked = true;
        }
        
        this.resetDateRange();
        
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

  getIconForType(type) {
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

  /**
   * Configura l'infinite scroll per caricare automaticamente più transazioni
   */
  setupInfiniteScroll() {
    // Se il container delle transazioni non esiste, esci
    if (!this.transactionListElement) {
      console.warn('Nessun container delle transazioni trovato per configurare l\'infinite scroll');
      return;
    }
    
    console.log('Configurazione dell\'infinite scroll per la cronologia delle transazioni');
    
    // Crea un indicatore di caricamento dedicato per l'infinite scroll
    if (!this.infiniteScrollLoader) {
      this.infiniteScrollLoader = new LoadingIndicator('progressBar');
    }
    
    // Distruggi eventuali infinite scroll esistenti
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Assicurati che il transactionListElement abbia una dimensione sufficiente per avere uno scrolling
    if (this.transactionListElement && this.transactionListElement.style) {
      // Stili migliorati per garantire che il container supporti lo scrolling
      this.transactionListElement.style.minHeight = '400px';
      this.transactionListElement.style.height = '70vh';  // Imposta un'altezza fissa come percentuale della viewport
      this.transactionListElement.style.maxHeight = '1000px';
      this.transactionListElement.style.overflowY = 'auto';
      this.transactionListElement.style.position = 'relative';
      this.transactionListElement.style.paddingBottom = '50px';  // Spazio alla fine per permettere lo scrolling
    }
    
    // Debug element visibility
    console.log('Container dimensions:', {
      clientHeight: this.transactionListElement.clientHeight,
      scrollHeight: this.transactionListElement.scrollHeight,
      offsetHeight: this.transactionListElement.offsetHeight
    });
    
    // Configura l'infinite scroll con threshold più aggressivo
    this.infiniteScroll = new InfiniteScroll({
      container: this.transactionListElement,
      loadMore: async (page) => {
        try {
          console.log(`Caricamento altre transazioni, pagina ${page}`);
          
          // Mostra indicatore di caricamento
          this.infiniteScrollLoader.show(this.transactionListElement);
          
          // Se siamo in modalità di caricamento, non fare nulla
          if (this.isLoading) {
            this.infiniteScrollLoader.hide();
            return true;
          }
          
          this.isLoading = true;
          
          // Ottieni l'ID dell'ultima transazione per fare una richiesta da un punto specifico
          let from = -1;
          if (this.allTransactions.length > 0) {
            from = this.allTransactions[this.allTransactions.length - 1].id - 1;
          }
          
          // Carica transazioni aggiuntive (50 alla volta)
          const rawTransactions = await transactionHistoryService.getUserTransactionHistory(this.username, 50, from);
          
          if (rawTransactions && Array.isArray(rawTransactions)) {
            let formattedTransactions = [];
            for (const tx of rawTransactions) {
              const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
              formattedTransactions.push(formattedTx);
            }
            
            // Mantieni i filtri correnti mentre aggiungiamo nuove transazioni
            const currentFilters = { ...this.filters };
            
            // Aggiungi solo transazioni uniche
            if (formattedTransactions.length > 0) {
              const existingIds = new Set(this.allTransactions.map(tx => tx.id));
              const uniqueNewTransactions = formattedTransactions.filter(tx => !existingIds.has(tx.id));
              
              if (uniqueNewTransactions.length > 0) {
                console.log(`Aggiunte ${uniqueNewTransactions.length} nuove transazioni al dataset`);
                this.allTransactions = [...this.allTransactions, ...uniqueNewTransactions];
                
                // Aggiorna i filtri con i nuovi tipi di transazioni
                this.extractTransactionTypes(currentFilters);
                this.updateFilterUI(true);
                
                // Filtra e ordina le transazioni
                const filteredTransactions = transactionHistoryService.filterTransactions(
                  this.allTransactions,
                  this.filters,
                  this.username
                );
                
                // Aggiorna il contatore dei risultati
                if (this.resultsCounter) {
                  this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
                }
                
                // Renderizza le nuove transazioni
                this.renderTransactions();
                
                // Verifica se ci sono altre transazioni da caricare
                const hasMore = rawTransactions.length >= 50;
                this.hasMoreTransactions = hasMore;
                console.log(`Caricate ${uniqueNewTransactions.length} nuove transazioni, altre disponibili: ${hasMore}`);
                
                this.infiniteScrollLoader.hide();
                this.isLoading = false;
                return hasMore;
              }
            }
            
            console.log('Nessuna nuova transazione unica trovata');
            this.infiniteScrollLoader.hide();
            this.isLoading = false;
            return false;
          }
          
          // Se arriviamo qui, non ci sono altre transazioni
          console.log('Nessuna nuova transazione trovata');
          this.hasMoreTransactions = false;
          this.infiniteScrollLoader.hide();
          this.isLoading = false;
          return false;
          
        } catch (error) {
          console.error('Errore durante il caricamento di altre transazioni:', error);
          this.infiniteScrollLoader.hide();
          this.isLoading = false;
          return false;
        }
      },
      threshold: '600px', // Aumentato il threshold per iniziare a caricare molto prima
      initialPage: this.page,
      loadingMessage: 'Caricamento altre transazioni...',
      endMessage: 'Hai visualizzato tutte le transazioni',
      errorMessage: 'Errore nel caricamento delle transazioni. Riprova.'
    });
    
    console.log('Infinite scroll configurato per la cronologia delle transazioni');
    
    // Forza un primo check
    setTimeout(() => {
      if (this.infiniteScroll && !this.isLoading) {
        console.log('Verifico se è necessario caricare più contenuti...');
        const target = document.getElementById(this.infiniteScroll.observerTarget?.id);
        if (target) {
          const rect = target.getBoundingClientRect();
          console.log('Observer target position:', rect);
          
          // Se il target è già visibile, forza il caricamento della pagina successiva
          if (rect.top < window.innerHeight) {
            console.log('Observer target già visibile, carico automaticamente più contenuti');
            this.infiniteScroll.loadNextPage();
          }
        }
      }
    }, 1000);
    
    return this.infiniteScroll;
  }
}