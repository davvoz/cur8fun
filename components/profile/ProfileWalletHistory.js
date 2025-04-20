import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import { formatDate } from '../../utils/DateUtils.js';
import steemService from '../../services/SteemService.js';
import transactionHistoryService from '../../services/TransactionHistoryService.js';
import filterService from '../../services/FilterService.js';
import WalletResourcesComponent from '../wallet/WalletResourcesComponent.js';
import WalletBalancesComponent from '../wallet/WalletBalancesComponent.js';

export default class ProfileWalletHistory extends Component {
  constructor(username) {
    super();
    this.username = username;
    this.isLoading = false;
    this.allTransactions = [];
    this.limit = 30;
    this.transactionList = null;
    this.loadMoreButton = null;
    this.balancesComponent = null;
    this.resourcesComponent = null;
    
    // Struttura per i filtri, simile a TransactionHistoryTab
    this.transactionTypes = new Set();
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
    
    // Riferimenti agli elementi del filtro
    this.filterContainer = null;
    this.filterCheckboxes = {};
    this.typeCounts = {};
    this.resultsCounter = null;
    this.dateRangePicker = null;
    
    // Binding dei metodi
    this.loadTransactions = this.loadTransactions.bind(this);
    this.loadMoreTransactions = this.loadMoreTransactions.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.toggleAllFiltersOfType = this.toggleAllFiltersOfType.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.handleDateRangeChange = this.handleDateRangeChange.bind(this);
    this.resetDateRange = this.resetDateRange.bind(this);
  }
  
  render(container) {
    console.log(`Rendering wallet history for @${this.username}`);
    
    // Salva il riferimento al container
    this.container = container;
    
    // Svuota il container
    container.innerHTML = '';
    
    // Crea il layout principale
    const walletHistoryContainer = document.createElement('div');
    walletHistoryContainer.className = 'wallet-list-container profile-wallet-container';
    walletHistoryContainer.style.width = '100%';
    
    // Intestazione
    const header = document.createElement('div');
    header.className = 'wallet-section-header';
    
    const title = document.createElement('h3');
    title.className = 'wallet-section-title';
    title.textContent = `Wallet Details for @${this.username}`;
    header.appendChild(title);
    
    walletHistoryContainer.appendChild(header);
    
    // Top Section: Balances and Resources in Horizontal Layout
    const topSection = document.createElement('div');
    topSection.className = 'wallet-top-section';
    
    // Container for balances
    const balancesContainer = document.createElement('div');
    balancesContainer.className = 'wallet-balances-container';
    topSection.appendChild(balancesContainer);
    
    // Container for resource meters
    const resourcesContainer = document.createElement('div');
    resourcesContainer.className = 'wallet-resources-container';
    topSection.appendChild(resourcesContainer);
    
    walletHistoryContainer.appendChild(topSection);
    
    // Separatore
    const divider = document.createElement('div');
    divider.className = 'section-divider';
    walletHistoryContainer.appendChild(divider);
    
    // Intestazione transazioni con filtri
    const transactionsHeader = document.createElement('div');
    transactionsHeader.className = 'wallet-section-header';
    
    const transactionsTitle = document.createElement('h4');
    transactionsTitle.className = 'wallet-section-title';
    transactionsTitle.textContent = 'Transaction History';
    transactionsHeader.appendChild(transactionsTitle);
    
    // Aggiungiamo il container per i filtri
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    
    const filterDetails = document.createElement('details');
    
    const filterSummary = document.createElement('summary');
    filterSummary.textContent = 'Filters';
    filterDetails.appendChild(filterSummary);
    
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
    startDateLabel.setAttribute('for', 'profile-start-date');
    startDateLabel.textContent = 'From:';
    
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date';
    startDateInput.id = 'profile-start-date';
    startDateInput.className = 'date-picker';
    startDateInput.valueAsDate = null; // Nessuna data di default
    startDateInput.addEventListener('change', this.handleDateRangeChange);
    
    startDateContainer.appendChild(startDateLabel);
    startDateContainer.appendChild(startDateInput);
    
    // Selettore data di fine
    const endDateContainer = document.createElement('div');
    endDateContainer.className = 'date-input-group';
    
    const endDateLabel = document.createElement('label');
    endDateLabel.setAttribute('for', 'profile-end-date');
    endDateLabel.textContent = 'To:';
    
    const endDateInput = document.createElement('input');
    endDateInput.type = 'date';
    endDateInput.id = 'profile-end-date';
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
    
    // Gruppo filtri per tipo
    const typeFilterGroup = document.createElement('div');
    typeFilterGroup.className = 'filter-group type-filter-group';
    typeFilterGroup.id = 'profile-type-filters';
    
    // Intestazione con opzioni select/deselect all
    const typeFilterHeader = document.createElement('div');
    typeFilterHeader.className = 'filter-group-header';
    
    const typeHeaderText = document.createElement('span');
    typeHeaderText.textContent = 'Transaction Types';
    typeFilterHeader.appendChild(typeHeaderText);
    
    // Pulsanti select/deselect all per tipo
    const selectAllTypesButton = document.createElement('button');
    selectAllTypesButton.className = 'filter-select-btn';
    selectAllTypesButton.textContent = 'Select All';
    selectAllTypesButton.dataset.action = 'select';
    selectAllTypesButton.dataset.filterType = 'type';
    selectAllTypesButton.addEventListener('click', this.toggleAllFiltersOfType);
    
    const deselectAllTypesButton = document.createElement('button');
    deselectAllTypesButton.className = 'filter-select-btn';
    deselectAllTypesButton.textContent = 'Deselect All';
    deselectAllTypesButton.dataset.action = 'deselect';
    deselectAllTypesButton.dataset.filterType = 'type';
    deselectAllTypesButton.addEventListener('click', this.toggleAllFiltersOfType);
    
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
    resultsCounter.id = 'profile-filtered-results-count';
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
    selectAllDirButton.addEventListener('click', this.toggleAllFiltersOfType);
    
    const deselectAllDirButton = document.createElement('button');
    deselectAllDirButton.className = 'filter-select-btn';
    deselectAllDirButton.textContent = 'Deselect All';
    deselectAllDirButton.dataset.action = 'deselect';
    deselectAllDirButton.dataset.filterType = 'direction';
    deselectAllDirButton.addEventListener('click', this.toggleAllFiltersOfType);
    
    const dirSelectButtons = document.createElement('div');
    dirSelectButtons.className = 'filter-select-actions';
    dirSelectButtons.appendChild(selectAllDirButton);
    dirSelectButtons.appendChild(deselectAllDirButton);
    
    dirHeaderText.appendChild(dirSelectButtons);
    directionFilterGroup.appendChild(dirHeaderText);
    
    // Checkboxes per direzione
    const directionFilters = [
      { id: 'profile-filter-by', label: 'Actions performed by account', icon: 'arrow_upward' },
      { id: 'profile-filter-on', label: 'Actions received by account', icon: 'arrow_downward' }
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
      checkbox.addEventListener('click', this.handleFilterChange);
      
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
    
    filterDetails.appendChild(filterOptions);
    filterContainer.appendChild(filterDetails);
    transactionsHeader.appendChild(filterContainer);
    
    walletHistoryContainer.appendChild(transactionsHeader);
    
    // Salva riferimenti ai container dei filtri
    this.filterContainer = typeFiltersContainer;
    this.resultsCounter = resultsCounter;
    
    // Lista transazioni
    this.transactionList = document.createElement('div');
    this.transactionList.className = 'transaction-list';
    walletHistoryContainer.appendChild(this.transactionList);
    
    // Pulsante "Load More"
    this.loadMoreButton = document.createElement('button');
    this.loadMoreButton.className = 'load-more-btn';
    this.loadMoreButton.textContent = 'Load More Transactions';
    this.loadMoreButton.addEventListener('click', this.loadMoreTransactions);
    this.loadMoreButton.style.display = 'none'; // Nascosto fino a quando non servono più transazioni
    walletHistoryContainer.appendChild(this.loadMoreButton);
    
    // Aggiungi al container
    container.appendChild(walletHistoryContainer);
    
    // Update container reference for internal operations
    this.container = walletHistoryContainer;
    
    // Initialize wallet balances component
    this.balancesComponent = new WalletBalancesComponent(balancesContainer, {
      username: this.username
    });
    this.balancesComponent.render();
    
    // Initialize wallet resources component
    this.resourcesComponent = new WalletResourcesComponent(resourcesContainer, {
      username: this.username
    });
    this.resourcesComponent.render();
    
    // Carica le transazioni
    this.showLoadingState();
    this.loadTransactions();
    
    return walletHistoryContainer;
  }
  
  async loadTransactions() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      
      // Mostra stato di caricamento
      this.showLoadingState();
      
      // Carica le transazioni usando il nuovo TransactionHistoryService
      const transactions = await transactionHistoryService.getUserTransactionHistory(this.username, this.limit);
      
      if (Array.isArray(transactions) && transactions.length > 0) {
        // Formatta le transazioni e aggiornale
        this.allTransactions = [];
        
        // Processa ogni transazione in modo asincrono per consentire conversioni VESTS->SP
        for (const tx of transactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          this.allTransactions.push(formattedTx);
        }
        
        // Estrai i tipi di transazione e aggiorna i filtri
        this.extractTransactionTypes();
        this.updateFilterUI();
        
        // Renderizza le transazioni
        await this.renderTransactions();
        
        // Mostra il pulsante "Load More" se ci sono più transazioni
        if (transactions.length >= this.limit) {
          this.loadMoreButton.style.display = 'block';
        } else {
          this.loadMoreButton.style.display = 'none';
        }
      } else {
        // Mostra messaggio se non ci sono transazioni
        this.showEmptyState();
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.showErrorState(`Failed to load transactions: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }
  
  async loadMoreTransactions() {
    this.limit += 30; // Aumenta il limite di 30
    this.loadTransactions(); // Ricarica con il nuovo limite
  }
  
  showLoadingState() {
    if (!this.transactionList) return;
    
    this.transactionList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading transactions...</p>
      </div>
    `;
  }
  
  showErrorState(message) {
    if (!this.transactionList) return;
    
    this.transactionList.innerHTML = `
      <div class="error-state">
        <i class="material-icons">error_outline</i>
        <p>${message}</p>
      </div>
    `;
  }
  
  showEmptyState() {
    if (!this.transactionList) return;
    
    // Determina se è vuoto perché non ci sono transazioni o perché i filtri non mostrano nulla
    if (this.allTransactions.length > 0) {
      // Verifica se il filtro di data è attivo
      const hasDateFilter = this.filters.dateRange.startDate || this.filters.dateRange.endDate;
      
      let emptyMessage = 'No transactions match your current filters.';
      if (hasDateFilter) {
        emptyMessage = 'No transactions match your current filters. Try changing the date range.';
      }
      
      this.transactionList.innerHTML = `
        <div class="empty-state">
          <i class="material-icons">info_outline</i>
          <p>${emptyMessage}</p>
          <button class="btn secondary-btn reset-filters-btn">Reset All Filters</button>
        </div>
      `;
      
      // Aggiungi event listener al pulsante reset
      const resetButton = this.transactionList.querySelector('.reset-filters-btn');
      if (resetButton) {
        resetButton.addEventListener('click', () => {
          // Reset di tutti i filtri
          this.transactionTypes.forEach(type => {
            const checkboxId = `profile-filter-${type}`;
            if (this.filterCheckboxes[checkboxId]) {
              this.filterCheckboxes[checkboxId].checked = true;
            }
          });
          
          // Reset dei filtri di direzione
          ['profile-filter-by', 'profile-filter-on'].forEach(id => {
            if (this.filterCheckboxes[id]) {
              this.filterCheckboxes[id].checked = true;
            }
          });
          
          // Reset date
          this.resetDateRange();
          
          this.updateFilters();
          this.renderTransactions();
        });
      }
    } else {
      this.transactionList.innerHTML = `
        <div class="empty-state">
          <i class="material-icons">info_outline</i>
          <p>No transaction history found for @${this.username}</p>
        </div>
      `;
    }
  }
  
  async renderTransactions() {
    if (!this.transactionList) return;
    
    // Aggiorna i filtri
    this.updateFilters();
    
    // Filtra le transazioni
    const filteredTransactions = transactionHistoryService.filterTransactions(
      this.allTransactions, 
      this.filters, 
      this.username
    );
    
    // Aggiorna il conteggio dei risultati
    if (this.resultsCounter) {
      this.resultsCounter.textContent = `Showing ${filteredTransactions.length} of ${this.allTransactions.length} transactions`;
    }
    
    // Controlla se ci sono transazioni dopo il filtraggio
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Svuota la lista
    this.transactionList.innerHTML = '';
    
    // Ordina le transazioni dalla più recente alla più vecchia
    const sortedTransactions = transactionHistoryService.sortTransactions(filteredTransactions);
    
    // Crea lista transazioni
    const transactionListElement = document.createElement('ul');
    transactionListElement.className = 'transaction-list';
    
    // Renderizza ogni transazione
    for (const tx of sortedTransactions) {
      const txElement = this.createTransactionItem(tx);
      transactionListElement.appendChild(txElement);
    }
    
    // Aggiungi la lista al contenitore
    this.transactionList.appendChild(transactionListElement);
  }
  
  createTransactionItem(tx) {
    // Crea l'elemento della transazione
    const listItem = document.createElement('li');
    listItem.className = 'transaction-item';
    
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
    
    // Aggiungi link all'explorer
    const linkElement = document.createElement('a');
    linkElement.className = 'transaction-link';
    linkElement.href = transactionHistoryService.createExplorerLink(tx, tx.data);
    linkElement.target = (tx.data.author && tx.data.permlink) ? '_self' : '_blank';
    linkElement.rel = 'noopener noreferrer';
    
    const linkIcon = document.createElement('span');
    linkIcon.className = 'material-icons';
    linkIcon.textContent = 'open_in_new';
    linkElement.appendChild(linkIcon);
    
    const linkText = document.createTextNode('View');
    linkElement.appendChild(linkText);
    
    detailsElement.appendChild(linkElement);
    
    // Aggiungi detailsElement all'elemento principale
    listItem.appendChild(detailsElement);
    
    return listItem;
  }

  /**
   * Aggiorna l'username e ricarica le transazioni
   * @param {string} newUsername - Il nuovo username da visualizzare
   */
  updateUsername(newUsername) {
    if (this.username === newUsername) return;
    
    console.log(`Updating username from ${this.username} to ${newUsername}`);
    this.username = newUsername;
    
    // Reset delle transazioni
    this.allTransactions = [];
    this.limit = 30;
    
    // Aggiorna il titolo se esiste
    if (this.container) {
      const title = this.container.querySelector('.wallet-section-title');
      if (title) {
        title.textContent = `Wallet Details for @${this.username}`;
      }
      
      // Update child components
      if (this.balancesComponent) {
        this.balancesComponent.updateUsername(newUsername);
      }
      
      if (this.resourcesComponent) {
        this.resourcesComponent.updateUsername(newUsername);
      }
      
      // Ricarica le transazioni
      this.showLoadingState();
      this.loadTransactions();
    }
  }

  /**
   * Imposta la visibilità del componente
   * @param {boolean} isVisible - Se il componente è visibile
   */
  setVisibility(isVisible) {
    if (!isVisible) return;
    
    // Se diventa visibile e non ha transazioni, caricale
    if (isVisible && this.allTransactions.length === 0 && !this.isLoading) {
      this.loadTransactions();
    }
  }

  /**
   * Estrae i tipi di transazione e aggiorna i conteggi
   */
  extractTransactionTypes() {
    // Reset dei conteggi o inizializzazione
    this.typeCounts = {};
    this.transactionTypes.clear();
    
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
    
    // Inizializza i filtri per ogni tipo trovato
    const newFilters = {};
    for (const type of this.transactionTypes) {
      // Imposta a true per default
      newFilters[type] = true;
    }
    
    // Aggiorna i filtri con i valori aggiornati
    this.filters.types = newFilters;
  }
  
  /**
   * Aggiorna l'interfaccia dei filtri
   */
  updateFilterUI() {
    if (!this.filterContainer) return;
    
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
      checkbox.id = `profile-filter-${type}`;
      checkbox.checked = this.filters.types[type] !== false;
      checkbox.dataset.filterType = 'type';
      checkbox.dataset.type = type; // Memorizza il tipo per riferimento facile
      
      // Aggiungi event listener
      checkbox.addEventListener('click', this.handleFilterChange);
      
      // Salva riferimento alla checkbox
      this.filterCheckboxes[`profile-filter-${type}`] = checkbox;
      
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
      
      // Aggiungi conteggio
      const count = document.createElement('span');
      count.className = 'filter-count';
      count.textContent = this.typeCounts[type] || 0;
      label.appendChild(count);
      
      filterItem.appendChild(label);
      this.filterContainer.appendChild(filterItem);
    });
  }
  
  /**
   * Gestisce il cambio di un filtro
   * @param {Event} event - Evento cambio checkbox
   */
  handleFilterChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const isChecked = checkbox.checked;
    
    // Aggiorna direttamente lo stato del filtro
    if (type && checkbox.dataset.filterType === 'type') {
      this.filters.types[type] = isChecked;
    }
    
    this.updateFilters();
    this.renderTransactions();
  }
  
  /**
   * Gestisce il cambio nell'intervallo di date
   */
  handleDateRangeChange() {
    const startDateValue = this.dateRangePicker.startDate.value;
    const endDateValue = this.dateRangePicker.endDate.value;
    
    // Aggiorna i filtri con le nuove date
    this.filters.dateRange.startDate = startDateValue || null;
    this.filters.dateRange.endDate = endDateValue || null;
    
    // Se è stata selezionata una data, abilita il filtro
    if (startDateValue || endDateValue) {
      // Log delle date selezionate
      console.log(`Date range filter applied: ${startDateValue || 'any'} to ${endDateValue || 'any'}`);
    } else {
      console.log('Date range filter cleared');
    }
    
    // Renderizza le transazioni con i nuovi filtri
    this.renderTransactions();
  }
  
  /**
   * Reimposta l'intervallo di date
   */
  resetDateRange() {
    // Reimposta i campi di input
    if (this.dateRangePicker) {
      this.dateRangePicker.startDate.value = '';
      this.dateRangePicker.endDate.value = '';
    }
    
    // Reimposta il filtro
    this.filters.dateRange = {
      startDate: null,
      endDate: null
    };
    
    // Renderizza le transazioni con i filtri aggiornati
    this.renderTransactions();
  }
  
  /**
   * Seleziona/deseleziona tutti i filtri di un tipo
   * @param {Event} event - Evento click bottone
   */
  toggleAllFiltersOfType(event) {
    const action = event.currentTarget.dataset.action;
    const filterType = event.currentTarget.dataset.filterType;
    const shouldCheck = action === 'select';
    
    if (filterType === 'type') {
      // Seleziona/deseleziona tutti i tipi di transazione
      this.transactionTypes.forEach(type => {
        const checkboxId = `profile-filter-${type}`;
        if (this.filterCheckboxes[checkboxId]) {
          this.filterCheckboxes[checkboxId].checked = shouldCheck;
        }
      });
    } else if (filterType === 'direction') {
      // Seleziona/deseleziona tutte le direzioni
      ['profile-filter-by', 'profile-filter-on'].forEach(id => {
        if (this.filterCheckboxes[id]) {
          this.filterCheckboxes[id].checked = shouldCheck;
        }
      });
    }
    
    // Aggiorna i filtri e renderizza
    this.updateFilters();
    this.renderTransactions();
  }
  
  /**
   * Aggiorna l'oggetto filtri in base allo stato delle checkbox
   */
  updateFilters() {
    // Aggiorna i filtri di direzione
    this.filters.direction = {
      byUser: this.filterCheckboxes['profile-filter-by']?.checked ?? true,
      onUser: this.filterCheckboxes['profile-filter-on']?.checked ?? true
    };
    
    // Aggiorna i filtri di tipo SOLO se la checkbox esiste
    Array.from(this.transactionTypes).forEach(type => {
      const checkboxId = `profile-filter-${type}`;
      if (this.filterCheckboxes[checkboxId]) {
        this.filters.types[type] = this.filterCheckboxes[checkboxId].checked;
      }
    });
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

  /**
   * Pulisce le risorse quando il componente viene rimosso
   */
  unmount() {
    // Rimuovi gli event listeners
    if (this.loadMoreButton) {
      this.loadMoreButton.removeEventListener('click', this.loadMoreTransactions);
    }
    
    // Pulisci i listener dei filtri
    Object.values(this.filterCheckboxes).forEach(checkbox => {
      if (checkbox) {
        checkbox.removeEventListener('click', this.handleFilterChange);
      }
    });
    
    // Clean up date pickers
    if (this.dateRangePicker) {
      this.dateRangePicker.startDate.removeEventListener('change', this.handleDateRangeChange);
      this.dateRangePicker.endDate.removeEventListener('change', this.handleDateRangeChange);
      this.dateRangePicker = null;
    }
    
    // Clean up child components
    if (this.balancesComponent) {
      this.balancesComponent.destroy();
      this.balancesComponent = null;
    }
    
    if (this.resourcesComponent) {
      this.resourcesComponent.destroy();
      this.resourcesComponent = null;
    }
    
    // Pulisci i riferimenti DOM
    this.container = null;
    this.transactionList = null;
    this.loadMoreButton = null;
    this.filterContainer = null;
    this.filterCheckboxes = {};
    this.resultsCounter = null;
    
    // Resetta lo stato
    this.allTransactions = [];
    this.isLoading = false;
    this.transactionTypes.clear();
    this.typeCounts = {};
    
    console.log(`ProfileWalletHistory: unmounted for @${this.username}`);
  }
}