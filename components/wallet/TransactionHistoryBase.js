import Component from '../Component.js';
import authService from '../../services/AuthService.js';
import transactionHistoryService from '../../services/TransactionHistoryService.js';
import filterService from '../../services/FilterService.js';
import InfiniteScroll from '../../utils/InfiniteScroll.js';
import LoadingIndicator from '../LoadingIndicator.js';
import { formatDate } from '../../utils/DateUtils.js';

/**
 * Base component for transaction history functionality
 * To be extended by specific transaction history views
 */
export default class TransactionHistoryBase extends Component {
  constructor(options = {}) {
    super();
    this.username = options.username || authService.getCurrentUser()?.username || '';
    this.allTransactions = [];
    this.isLoading = false;
    
    // Common filter structure
    this.transactionTypes = new Set();
    this.filters = {
      types: {},
      direction: {
        byUser: true,
        onUser: true
      },
      dateRange: {
        startDate: null,
        endDate: null
      }
    };
    
    this.limit = options.limit || 50;
    this.page = 1;
    this.hasMoreTransactions = true;
    
    // Counter for transaction types
    this.typeCounts = {};
    
    // UI element references
    this.transactionListElement = null;
    this.filterContainer = null;
    this.filterCheckboxes = {};
    this.resultsCounter = null;
    this.dateRangePicker = null;
    this.infiniteScroll = null;
    this.infiniteScrollLoader = null;
    
    // Enable debug mode if needed
    this.debug = options.debug || false;
    
    // Bind methods to this instance
    this.bindMethods();
  }
  
  bindMethods() {
    this.loadTransactions = this.loadTransactions.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.toggleAllFiltersOfType = this.toggleAllFiltersOfType.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.handleDateRangeChange = this.handleDateRangeChange.bind(this);
    this.resetDateRange = this.resetDateRange.bind(this);
    this.setupInfiniteScroll = this.setupInfiniteScroll.bind(this);
    this.renderTransactions = this.renderTransactions.bind(this);
    this.createTransactionItem = this.createTransactionItem.bind(this);
    this.handleTypeSearch = this.handleTypeSearch.bind(this);
    this.switchFilterTab = this.switchFilterTab.bind(this);
    this.resetAllFilters = this.resetAllFilters.bind(this);
  }

  // Common UI creation methods
  createFilterHeader(title = 'Transaction History', filterIdPrefix = '') {
    const header = document.createElement('div');
    header.className = 'transaction-header';
    
    // Title row with counter
    const titleRow = document.createElement('div');
    titleRow.className = 'transaction-header-row';
    
    // Title
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleRow.appendChild(titleElement);
    
    // Results counter - spostato qui per maggiore visibilità
    const resultsCounter = document.createElement('div');
    resultsCounter.id = `${filterIdPrefix}filtered-results-count`;
    resultsCounter.className = 'results-counter';
    resultsCounter.textContent = 'Loading transactions...';
    this.resultsCounter = resultsCounter;
    titleRow.appendChild(resultsCounter);
    
    header.appendChild(titleRow);
    
    // Filter container with improved styling
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    
    const details = document.createElement('details');
    details.className = 'filter-details';
    
    const summary = document.createElement('summary');
    summary.className = 'filter-summary';
    
    // Improved summary with icon
    const filterIcon = document.createElement('span');
    filterIcon.className = 'material-icons filter-toggle-icon';
    filterIcon.textContent = 'filter_list';
    summary.appendChild(filterIcon);
    
    const summaryText = document.createElement('span');
    summaryText.textContent = 'Transaction Filters';
    summary.appendChild(summaryText);
    
    details.appendChild(summary);
    
    // Container for all filter options with improved layout
    const filterOptions = document.createElement('div');
    filterOptions.className = 'filter-options';
    
    // Quick filter row
    const quickFilterRow = document.createElement('div');
    quickFilterRow.className = 'quick-filter-row';
    
    // Search for transaction types
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-filter-container';
    
    const searchLabel = document.createElement('label');
    searchLabel.setAttribute('for', `${filterIdPrefix}transaction-search`);
    searchLabel.className = 'search-label';
    searchLabel.textContent = 'Search types:';
    
    // Corretto il contenitore dell'input di ricerca
    const searchInputContainer = document.createElement('div');
    searchInputContainer.className = 'search-input-container';
    searchInputContainer.style.position = 'relative'; // Assicuriamo che il contenitore sia posizionato relativamente
    
    // Creiamo prima l'input di ricerca
    const txSearchInput = document.createElement('input');
    txSearchInput.type = 'text';
    txSearchInput.id = `${filterIdPrefix}transaction-search`;
    txSearchInput.className = 'transaction-search-input';
    txSearchInput.placeholder = 'Type to filter...';
    txSearchInput.addEventListener('input', this.handleTypeSearch.bind(this));
    txSearchInput.style.paddingLeft = '30px'; // Aggiungiamo padding a sinistra per fare spazio all'icona
    
    // Ora creiamo l'icona di ricerca
    const searchIcon = document.createElement('span');
    searchIcon.className = 'material-icons';
    searchIcon.textContent = 'search';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '8px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.color = 'var(--text-muted, #999)';
    searchIcon.style.pointerEvents = 'none'; // Previene interferenze con l'input
    
    // Aggiungiamo gli elementi nell'ordine corretto
    searchInputContainer.appendChild(txSearchInput); // Prima l'input
    searchInputContainer.appendChild(searchIcon); // Poi l'icona sopra
    
    searchContainer.appendChild(searchLabel);
    searchContainer.appendChild(searchInputContainer);
    
    // Action buttons container
    const actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.className = 'filter-action-buttons';
    
    // Reset all filters button
    const resetAllButton = document.createElement('button');
    resetAllButton.className = 'btn primary-btn reset-all-btn';
    resetAllButton.innerHTML = '<span class="material-icons">refresh</span> Reset All Filters';
    resetAllButton.addEventListener('click', this.resetAllFilters.bind(this));
    actionButtonsContainer.appendChild(resetAllButton);
    
    quickFilterRow.appendChild(searchContainer);
    quickFilterRow.appendChild(actionButtonsContainer);
    filterOptions.appendChild(quickFilterRow);
    
    // Tabs for filter categories
    const filterTabs = document.createElement('div');
    filterTabs.className = 'filter-tabs';
    
    const tabButtons = document.createElement('div');
    tabButtons.className = 'filter-tab-buttons';
    
    // Create tab buttons
    const tabs = [
      { id: 'date', icon: 'event', text: 'Date' },
      { id: 'type', icon: 'category', text: 'Types' },
      { id: 'direction', icon: 'swap_vert', text: 'Direction' }
    ];
    
    tabs.forEach((tab, index) => {
      const tabButton = document.createElement('button');
      tabButton.className = `filter-tab-button ${index === 0 ? 'active' : ''}`;
      tabButton.dataset.tabId = tab.id;
      tabButton.addEventListener('click', this.switchFilterTab.bind(this));
      
      const tabIcon = document.createElement('span');
      tabIcon.className = 'material-icons';
      tabIcon.textContent = tab.icon;
      tabButton.appendChild(tabIcon);
      
      const tabText = document.createElement('span');
      tabText.textContent = tab.text;
      tabButton.appendChild(tabText);
      
      tabButtons.appendChild(tabButton);
    });
    
    filterTabs.appendChild(tabButtons);
    
    // Tab content
    const tabContents = document.createElement('div');
    tabContents.className = 'filter-tab-contents';
    
    // Date range tab
    const dateTab = document.createElement('div');
    dateTab.className = 'filter-tab-content active';
    dateTab.dataset.tabId = 'date';
    dateTab.appendChild(this.createDateRangeFilter(filterIdPrefix));
    
    // Type filters tab
    const typeTab = document.createElement('div');
    typeTab.className = 'filter-tab-content';
    typeTab.dataset.tabId = 'type';
    typeTab.appendChild(this.createTypeFilterGroup(filterIdPrefix));
    
    // Direction filters tab
    const directionTab = document.createElement('div');
    directionTab.className = 'filter-tab-content';
    directionTab.dataset.tabId = 'direction';
    directionTab.appendChild(this.createDirectionFilterGroup(filterIdPrefix));
    
    tabContents.appendChild(dateTab);
    tabContents.appendChild(typeTab);
    tabContents.appendChild(directionTab);
    
    filterTabs.appendChild(tabContents);
    filterOptions.appendChild(filterTabs);
    
    details.appendChild(filterOptions);
    filterContainer.appendChild(details);
    header.appendChild(filterContainer);
    
    return header;
  }
  
  createDateRangeFilter(filterIdPrefix = '') {
    const dateRangeGroup = document.createElement('div');
    dateRangeGroup.className = 'filter-group date-range-group';
    
    const dateRangeHeader = document.createElement('div');
    dateRangeHeader.className = 'filter-group-header';
    
    const dateRangeTitle = document.createElement('span');
    dateRangeTitle.textContent = 'Date Range';
    dateRangeHeader.appendChild(dateRangeTitle);
    
    // Reset button for dates
    const resetDatesButton = document.createElement('button');
    resetDatesButton.className = 'filter-select-btn';
    resetDatesButton.textContent = 'Reset Dates';
    resetDatesButton.addEventListener('click', this.resetDateRange);
    
    const dateButtonsContainer = document.createElement('div');
    dateButtonsContainer.className = 'filter-select-actions';
    dateButtonsContainer.appendChild(resetDatesButton);
    dateRangeHeader.appendChild(dateButtonsContainer);
    
    dateRangeGroup.appendChild(dateRangeHeader);
    
    // Date selectors
    const dateInputsContainer = document.createElement('div');
    dateInputsContainer.className = 'date-inputs-container';
    
    // Start date selector
    const startDateContainer = document.createElement('div');
    startDateContainer.className = 'date-input-group';
    
    const startDateLabel = document.createElement('label');
    startDateLabel.setAttribute('for', `${filterIdPrefix}start-date`);
    startDateLabel.textContent = 'From:';
    
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date';
    startDateInput.id = `${filterIdPrefix}start-date`;
    startDateInput.className = 'date-picker';
    startDateInput.valueAsDate = null;
    startDateInput.addEventListener('change', this.handleDateRangeChange);
    
    startDateContainer.appendChild(startDateLabel);
    startDateContainer.appendChild(startDateInput);
    
    // End date selector
    const endDateContainer = document.createElement('div');
    endDateContainer.className = 'date-input-group';
    
    const endDateLabel = document.createElement('label');
    endDateLabel.setAttribute('for', `${filterIdPrefix}end-date`);
    endDateLabel.textContent = 'To:';
    
    const endDateInput = document.createElement('input');
    endDateInput.type = 'date';
    endDateInput.id = `${filterIdPrefix}end-date`;
    endDateInput.className = 'date-picker';
    endDateInput.valueAsDate = null;
    endDateInput.addEventListener('change', this.handleDateRangeChange);
    
    endDateContainer.appendChild(endDateLabel);
    endDateContainer.appendChild(endDateInput);
    
    // Save references to date pickers
    this.dateRangePicker = {
      startDate: startDateInput,
      endDate: endDateInput
    };
    
    dateInputsContainer.appendChild(startDateContainer);
    dateInputsContainer.appendChild(endDateContainer);
    dateRangeGroup.appendChild(dateInputsContainer);
    
    return dateRangeGroup;
  }
  
  createTypeFilterGroup(filterIdPrefix = '') {
    const typeFilterGroup = document.createElement('div');
    typeFilterGroup.className = 'filter-group type-filter-group';
    typeFilterGroup.id = `${filterIdPrefix}type-filters`;
    
    // Header with select/deselect all options
    const typeFilterHeader = document.createElement('div');
    typeFilterHeader.className = 'filter-group-header';
    
    const typeHeaderText = document.createElement('span');
    typeHeaderText.textContent = 'Transaction Types';
    typeFilterHeader.appendChild(typeHeaderText);
    
    // Add select/deselect all buttons
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
    
    // Container for type filters (will be populated dynamically)
    const typeFiltersContainer = document.createElement('div');
    typeFiltersContainer.className = 'filters-container';
    typeFilterGroup.appendChild(typeFiltersContainer);
    
    // Store reference to filter container for future updates
    this.filterContainer = typeFiltersContainer;
    
    return typeFilterGroup;
  }
  
  createDirectionFilterGroup(filterIdPrefix = '') {
    const directionFilterGroup = document.createElement('div');
    directionFilterGroup.className = 'filter-group';
    
    // Header with select/deselect all options for direction
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
    
    // Checkboxes for direction
    const directionFilters = [
      { id: `${filterIdPrefix}filter-by`, label: 'Actions performed by account', icon: 'arrow_upward' },
      { id: `${filterIdPrefix}filter-on`, label: 'Actions received by account', icon: 'arrow_downward' }
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
      
      this.registerEventHandler(checkbox, 'click', this.handleFilterChange);
      
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
    
    return directionFilterGroup;
  }
  
  createTransactionContainer(containerId = 'transaction-list') {
    const container = document.createElement('div');
    container.className = 'transaction-container';
    
    // Transaction list container
    const transactionList = document.createElement('div');
    transactionList.id = containerId;
    transactionList.className = 'transaction-list';
    
    container.appendChild(transactionList);
    return container;
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
    
    // Non mostrare il link al block explorer per le transazioni di tipo curation_reward
    if (tx.type !== 'curation_reward') {
      const linkElement = document.createElement('a');
      linkElement.className = 'transaction-link';
      linkElement.href = transactionHistoryService.createExplorerLink(tx, tx.data);
      linkElement.target = (tx.data.author && tx.data.permlink) ? '_self' : '_blank';
      linkElement.rel = 'noopener noreferrer';
      
      const linkIcon = document.createElement('span');
      linkIcon.className = 'material-icons';
      linkIcon.textContent = 'open_in_new';
      linkElement.appendChild(linkIcon);
      
      const linkText = document.createTextNode('View on Explorer');
      linkElement.appendChild(linkText);
      
      detailsElement.appendChild(linkElement);
    }
    
    listItem.appendChild(detailsElement);
    
    return listItem;
  }
  
  // Data loading and processing methods
  async loadTransactions() {
    if (!this.username || this.isLoading || !this.transactionListElement) return;
    
    this.isLoading = true;
    
    if (this.allTransactions.length === 0) {
      this.showLoadingState();
    }
    
    try {
      let from = -1;
      if (this.allTransactions.length > 0) {
        from = this.allTransactions[this.allTransactions.length - 1].id - 1;
      }
      
      const rawTransactions = await transactionHistoryService.getUserTransactionHistory(
        this.username, 
        this.limit, 
        from
      );
      
      if (rawTransactions && Array.isArray(rawTransactions) && rawTransactions.length > 0) {
        let formattedTransactions = [];
        for (const tx of rawTransactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          formattedTransactions.push(formattedTx);
        }
        
        const currentFilters = { ...this.filters };
        
        if (this.allTransactions.length === 0) {
          this.allTransactions = formattedTransactions;
        } else {
          // Add only unique transactions
          const existingIds = new Set(this.allTransactions.map(tx => tx.id));
          const uniqueNewTransactions = formattedTransactions.filter(tx => !existingIds.has(tx.id));
          this.allTransactions = [...this.allTransactions, ...uniqueNewTransactions];
        }
        
        // Update filters with new transaction types
        this.extractTransactionTypes(currentFilters);
        this.updateFilterUI(true);
        
        this.renderTransactions();
        
        // Determine if there are more transactions to load
        this.hasMoreTransactions = rawTransactions.length >= this.limit;
        
        // Set up infinite scroll
        if (!this.infiniteScroll) {
          this.setupInfiniteScroll();
        }
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.showErrorState(error.message || 'Failed to load transactions');
    } finally {
      this.isLoading = false;
    }
  }
  
  extractTransactionTypes(currentFilters = {}) {
    const existingFilters = { ...this.filters.types };
    
    // Resettiamo i conteggi dei tipi ad ogni chiamata per evitare conteggi cumulativi errati
    this.typeCounts = {};
    
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
        if (id.includes('filter-') && !id.includes('filter-by') && !id.includes('filter-on') && this.filterCheckboxes[id]) {
          const type = id.replace(/^.*?filter-/, '');
          savedTypeStates[type] = this.filterCheckboxes[id].checked;
        }
      });
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
      
      // Determine checkbox state
      let isChecked;
      if (preserveState && savedTypeStates[type] !== undefined) {
        isChecked = savedTypeStates[type];
      } else {
        isChecked = this.filters.types[type] !== false;
      }
      
      checkbox.checked = isChecked;
      checkbox.dataset.filterType = 'type';
      checkbox.dataset.type = type;
      
      this.registerEventHandler(checkbox, 'click', this.handleFilterChange);
      
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
    
    this.updateFilters();
    
    const filteredTransactions = transactionHistoryService.filterTransactions(
      this.allTransactions, 
      this.filters, 
      this.username
    );
    
    if (this.resultsCounter) {
      this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
    }
    
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    const sortedTransactions = transactionHistoryService.sortTransactions(filteredTransactions);
    
    // Salva riferimento a eventuali elementi di infinite scroll
    const observerTarget = this.transactionListElement.querySelector('.observer-target');
    
    // Svuota il contenitore
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
    
    // Se abbiamo trovato un observer target prima, ripristinalo
    if (observerTarget) {
      this.transactionListElement.appendChild(observerTarget);
    }
  }
  
  handleFilterChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const isChecked = checkbox.checked;
    
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
        const fullId = id.startsWith('profile-') ? id : id;
        if (this.filterCheckboxes[fullId]) {
          this.filterCheckboxes[fullId].checked = shouldCheck;
        }
      });
    }
    
    this.updateFilters();
    this.renderTransactions();
  }
  
  handleDateRangeChange() {
    const startDateValue = this.dateRangePicker?.startDate.value;
    const endDateValue = this.dateRangePicker?.endDate.value;
    
    this.filters.dateRange.startDate = startDateValue || null;
    this.filters.dateRange.endDate = endDateValue || null;
    
    // Se sono state specificate delle date, ricarichiamo i dati
    if (startDateValue || endDateValue) {
      this.reloadTransactionsWithDateFilter();
    } else {
      // Altrimenti applica il filtro normalmente
      this.renderTransactions();
    }
  }
  
  async reloadTransactionsWithDateFilter() {
    if (!this.username || this.isLoading || !this.transactionListElement) return;
    
    // Mostra indicatore di caricamento
    this.isLoading = true;
    this.showLoadingState();
    
    try {
      const startDate = this.filters.dateRange.startDate ? new Date(this.filters.dateRange.startDate) : null;
      const endDate = this.filters.dateRange.endDate ? new Date(this.filters.dateRange.endDate) : null;
      
      // Calcola l'intervallo di tempo in giorni
      let daysRange = 30; // Default: 30 giorni se non specificate date
      
      if (startDate && endDate) {
        const diffTime = Math.abs(endDate - startDate);
        daysRange = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRange = Math.max(daysRange, 7); // Minimo 7 giorni
      }
      
      // Aumenta il limite in base alla dimensione dell'intervallo di date
      const adjustedLimit = Math.max(50, Math.min(500, daysRange * 15));
      
      // Resetta lo stato
      this.allTransactions = [];
      this.page = 1;
      this.hasMoreTransactions = true;
      
      // Carica le transazioni con un limite maggiore per coprire l'intervallo di tempo
      const rawTransactions = await transactionHistoryService.getUserTransactionHistory(
        this.username, 
        adjustedLimit, 
        -1
      );
      
      if (rawTransactions && Array.isArray(rawTransactions) && rawTransactions.length > 0) {
        let formattedTransactions = [];
        for (const tx of rawTransactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          formattedTransactions.push(formattedTx);
        }
        
        // Aggiorna le transazioni
        this.allTransactions = formattedTransactions;
        
        // Estrai i tipi di transazione e aggiorna l'UI dei filtri
        this.extractTransactionTypes();
        this.updateFilterUI(true);
        
        // Renderizza le transazioni
        this.renderTransactions();
        
        // Determina se ci sono altre transazioni da caricare
        this.hasMoreTransactions = rawTransactions.length >= adjustedLimit;
        
        // Aggiorna lo scroll infinito
        if (this.infiniteScroll) {
          this.infiniteScroll.destroy();
          this.infiniteScroll = null;
        }
        this.setupInfiniteScroll();
        
        // Notifica all'utente
        if (window.eventEmitter) {
          window.eventEmitter.emit('notification', {
            type: 'success',
            message: `Loaded ${rawTransactions.length} transactions for the selected date range`
          });
        }
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('Error loading transactions by date range:', error);
      this.showErrorState(error.message || 'Failed to load transactions for the selected dates');
    } finally {
      this.isLoading = false;
    }
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
    // Update direction filters
    const byUserCheckbox = this.filterCheckboxes['filter-by'] || this.filterCheckboxes['profile-filter-by'];
    const onUserCheckbox = this.filterCheckboxes['filter-on'] || this.filterCheckboxes['profile-filter-on'];
    
    this.filters.direction = {
      byUser: byUserCheckbox?.checked ?? true,
      onUser: onUserCheckbox?.checked ?? true
    };
    
    // Update type filters
    Array.from(this.transactionTypes).forEach(type => {
      const checkboxId = `filter-${type}`;
      if (this.filterCheckboxes[checkboxId]) {
        this.filters.types[type] = this.filterCheckboxes[checkboxId].checked;
      }
    });
  }
  
  setupInfiniteScroll() {
    if (!this.transactionListElement) {
      console.warn('No transaction list element found for infinite scroll setup');
      return;
    }
    
    // Create a loading indicator for infinite scroll
    if (!this.infiniteScrollLoader) {
      this.infiniteScrollLoader = new LoadingIndicator('progressBar');
    }
    
    // Destroy any existing infinite scroll
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Ensure the transaction list element has enough size for scrolling
    if (this.transactionListElement.style) {
      this.transactionListElement.style.minHeight = '400px';
      this.transactionListElement.style.maxHeight = '1000px';
      this.transactionListElement.style.overflowY = 'auto';
      this.transactionListElement.style.position = 'relative';
    }
    
    // Inizializzazione immediata senza timeout
    console.log('Setting up infinite scroll for transaction list');
    
    // Create infinite scroll with threshold
    this.infiniteScroll = new InfiniteScroll({
      container: this.transactionListElement,
      loadMore: async (page) => {
        try {
          // Evita caricamenti duplicati
          if (this.isLoading) {
            console.log('Already loading transactions, skipping this request');
            return true;
          }
          
          this.infiniteScrollLoader.show(this.transactionListElement);
          this.isLoading = true;
          
          console.log(`InfiniteScroll triggered, loading page ${page}, current transactions:`, 
                       this.allTransactions.length);
          
          let from = -1;
          if (this.allTransactions.length > 0) {
            from = this.allTransactions[this.allTransactions.length - 1].id - 1;
            console.log(`Loading from transaction ID: ${from}`);
          }
          
          // Load more transactions
          const rawTransactions = await transactionHistoryService.getUserTransactionHistory(
            this.username, 
            50, 
            from
          );
          
          if (rawTransactions && Array.isArray(rawTransactions) && rawTransactions.length > 0) {
            console.log(`Received ${rawTransactions.length} new transactions`);
            
            let formattedTransactions = [];
            for (const tx of rawTransactions) {
              const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
              formattedTransactions.push(formattedTx);
            }
            
            // Keep current filters while adding new transactions
            const currentFilters = { ...this.filters };
            
            // Add only unique transactions
            const existingIds = new Set(this.allTransactions.map(tx => tx.id));
            const uniqueNewTransactions = formattedTransactions.filter(tx => !existingIds.has(tx.id));
            
            console.log(`Found ${uniqueNewTransactions.length} unique new transactions`);
            
            if (uniqueNewTransactions.length > 0) {
              this.allTransactions = [...this.allTransactions, ...uniqueNewTransactions];
              
              this.extractTransactionTypes(currentFilters);
              this.updateFilterUI(true);
              
              const filteredTransactions = transactionHistoryService.filterTransactions(
                this.allTransactions,
                this.filters,
                this.username
              );
              
              if (this.resultsCounter) {
                this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
              }
              
              // Render the transactions
              this.renderTransactions();
              
              // Controllo se ci sono altre transazioni da caricare
              const hasMore = rawTransactions.length >= 50;
              this.hasMoreTransactions = hasMore;
              
              console.log(`Has more transactions: ${hasMore}`);
              
              this.infiniteScrollLoader.hide();
              this.isLoading = false;
              return hasMore;
            } else {
              console.log('No new unique transactions found');
              this.hasMoreTransactions = false;
              this.infiniteScrollLoader.hide();
              this.isLoading = false;
              return false;
            }
          } else {
            console.log('No more transactions available');
            this.hasMoreTransactions = false;
            this.infiniteScrollLoader.hide();
            this.isLoading = false;
            return false;
          }
          
        } catch (error) {
          console.error('Error loading more transactions:', error);
          this.infiniteScrollLoader.hide();
          this.isLoading = false;
          return false;
        }
      },
      threshold: '300px', // Riduci la soglia per attivare il caricamento più rapidamente
      initialPage: this.page,
      loadingMessage: 'Loading more transactions...',
      endMessage: 'You\'ve viewed all transactions',
      errorMessage: 'Error loading transactions. Please try again.'
    });
    
    return this.infiniteScroll;
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
        
        ['filter-by', 'filter-on', 'profile-filter-by', 'profile-filter-on'].forEach(id => {
          if (this.filterCheckboxes[id]) {
            this.filterCheckboxes[id].checked = true;
          }
        });
        
        this.resetDateRange();
        
        this.updateFilters();
        this.renderTransactions();
      });
      
      emptyState.appendChild(emptyText);
      emptyState.appendChild(resetButton);
    } else {
      emptyText.textContent = `No transactions found for ${this.username ? '@' + this.username : 'this account'}.`;
      emptyState.appendChild(emptyText);
    }
    
    this.transactionListElement.appendChild(emptyState);
  }
  
  getIconForType(type) {
    const iconMap = {
      transfer: 'swap_horiz',
      claim_reward_balance: 'card_giftcard',
      vote: 'thumb_up',
      comment: 'comment',
      curation_reward: 'emoji_events', // Cambiato da workspace_premium a emoji_events (trofeo)
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
  
  updateUsername(newUsername) {
    if (this.username === newUsername) return;
    
    console.log(`Updating username from ${this.username} to ${newUsername}`);
    this.username = newUsername;
    
    // Reset the transactions
    this.allTransactions = [];
    this.transactionTypes.clear();
    this.typeCounts = {};
    
    // Reload transactions if the component is visible
    if (this.transactionListElement) {
      this.showLoadingState();
      this.loadTransactions();
    }
  }
  
  destroy() {
    // Destroy infinite scroll if it exists
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    if (this.infiniteScrollLoader) {
      this.infiniteScrollLoader = null;
    }
    
    // Clean up references
    this.transactionListElement = null;
    this.filterCheckboxes = {};
    this.filterContainer = null;
    this.dateRangePicker = null;
    this.resultsCounter = null;
    
    super.destroy();
  }
  
  handleTypeSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!this.filterContainer) return;
    
    // Trova tutti gli elementi di tipo transazione
    const filterItems = this.filterContainer.querySelectorAll('.filter-item');
    
    filterItems.forEach(item => {
      const label = item.querySelector('label');
      if (!label) return;
      
      const displayName = label.textContent.toLowerCase();
      
      // Mostra/nascondi in base al termine di ricerca
      if (searchTerm === '' || displayName.includes(searchTerm)) {
        item.style.display = '';
        item.classList.remove('hidden');
      } else {
        item.style.display = 'none';
        item.classList.add('hidden');
      }
    });
    
    // Mostra un messaggio se nessun risultato è trovato
    const hasVisibleItems = Array.from(filterItems).some(item => !item.classList.contains('hidden'));
    let noResultsMsg = this.filterContainer.querySelector('.no-search-results');
    
    if (!hasVisibleItems) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-search-results';
        noResultsMsg.textContent = `No transaction types match "${searchTerm}"`;
        this.filterContainer.appendChild(noResultsMsg);
      } else {
        noResultsMsg.textContent = `No transaction types match "${searchTerm}"`;
        noResultsMsg.style.display = '';
      }
    } else if (noResultsMsg) {
      noResultsMsg.style.display = 'none';
    }
  }
  
  switchFilterTab(event) {
    // Trova il pulsante e l'ID della tab
    const button = event.currentTarget;
    const tabId = button.dataset.tabId;
    
    if (!tabId) return;
    
    // Trova tutti i pulsanti delle tab e le tab stesse
    const tabButtons = document.querySelectorAll('.filter-tab-button');
    const tabContents = document.querySelectorAll('.filter-tab-content');
    
    // Rimuovi la classe active da tutti i pulsanti e tutte le tab
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Aggiungi la classe active al pulsante corrente
    button.classList.add('active');
    
    // Trova e attiva il contenuto della tab corrispondente
    const activeTabContent = document.querySelector(`.filter-tab-content[data-tab-id="${tabId}"]`);
    if (activeTabContent) {
      activeTabContent.classList.add('active');
    }
  }
  
  resetAllFilters() {
    // Resetta i filtri per tipo transazione
    this.transactionTypes.forEach(type => {
      const checkboxId = `filter-${type}`;
      if (this.filterCheckboxes[checkboxId]) {
        this.filterCheckboxes[checkboxId].checked = true;
      }
    });
    
    // Resetta i filtri per direzione
    ['filter-by', 'filter-on', 'profile-filter-by', 'profile-filter-on'].forEach(id => {
      if (this.filterCheckboxes[id]) {
        this.filterCheckboxes[id].checked = true;
      }
    });
    
    // Resetta i filtri per data
    this.resetDateRange();
    
    // Resetta il campo di ricerca
    const searchInput = document.getElementById('transaction-search');
    if (searchInput) {
      searchInput.value = '';
      // Trigger di un evento input per aggiornare la visualizzazione dei filtri
      const event = new Event('input', { bubbles: true });
      searchInput.dispatchEvent(event);
    }
    
    // Aggiorna i filtri e renderizza nuovamente le transazioni
    this.updateFilters();
    this.renderTransactions();
    
    // Notifica l'utente
    if (window.eventEmitter) {
      window.eventEmitter.emit('notification', {
        type: 'info',
        message: 'All filters have been reset'
      });
    }
  }
}