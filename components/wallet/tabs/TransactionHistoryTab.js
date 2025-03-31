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
    this.filters = {
      types: {
        transfer: true,
        vote: true,
        comment: true,
        other: true
      },
      direction: {
        byUser: true,
        onUser: true
      }
    };
    this.limit = 50; // Inizia con 50 transazioni
    
    // Riferimenti agli elementi DOM
    this.transactionListElement = null;
    this.loadMoreButton = null;
    this.filterCheckboxes = {};
    
    // Binding dei metodi
    this.handleApplyFilters = this.handleApplyFilters.bind(this);
    this.handleLoadMore = this.handleLoadMore.bind(this);
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
    summary.textContent = 'Advanced Filters';
    details.appendChild(summary);
    
    const filterOptions = document.createElement('div');
    filterOptions.className = 'filter-options';
    
    // Gruppo filtri per tipo
    const typeFilterGroup = document.createElement('div');
    typeFilterGroup.className = 'filter-group';
    
    // Checkboxes per tipi di transazioni
    const typeFilters = [
      { id: 'filter-transfer', label: 'Transfers' },
      { id: 'filter-vote', label: 'Votes' },
      { id: 'filter-comment', label: 'Comments' },
      { id: 'filter-other', label: 'Other' }
    ];
    
    typeFilters.forEach(filter => {
      const label = document.createElement('label');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = filter.id;
      checkbox.checked = true;
      
      // Salva riferimento alla checkbox
      this.filterCheckboxes[filter.id] = checkbox;
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + filter.label));
      
      typeFilterGroup.appendChild(label);
    });
    
    // Gruppo filtri per direzione
    const directionFilterGroup = document.createElement('div');
    directionFilterGroup.className = 'filter-group';
    
    // Checkboxes per direzione
    const directionFilters = [
      { id: 'filter-by', label: 'Actions performed by account' },
      { id: 'filter-on', label: 'Actions received by account' }
    ];
    
    directionFilters.forEach(filter => {
      const label = document.createElement('label');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = filter.id;
      checkbox.checked = true;
      
      // Salva riferimento alla checkbox
      this.filterCheckboxes[filter.id] = checkbox;
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + filter.label));
      
      directionFilterGroup.appendChild(label);
    });
    
    // Pulsante per applicare i filtri
    const applyButton = document.createElement('button');
    applyButton.id = 'apply-filters';
    applyButton.className = 'btn secondary-btn';
    applyButton.textContent = 'Apply Filters';
    
    // Assembla i filtri
    filterOptions.appendChild(typeFilterGroup);
    filterOptions.appendChild(directionFilterGroup);
    filterOptions.appendChild(applyButton);
    
    details.appendChild(filterOptions);
    filterContainer.appendChild(details);
    header.appendChild(filterContainer);
    
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
    // Gestisci i clic sul pulsante dei filtri
    const applyFiltersBtn = this.element.querySelector('#apply-filters');
    if (applyFiltersBtn) {
      this.registerEventHandler(applyFiltersBtn, 'click', this.handleApplyFilters);
    }
    
    // Gestisci i clic sul pulsante "Load More"
    if (this.loadMoreButton) {
      this.registerEventHandler(this.loadMoreButton, 'click', this.handleLoadMore);
    }
  }
  
  handleApplyFilters() {
    this.updateFilters();
    this.renderTransactions();
  }
  
  handleLoadMore() {
    this.limit += 50; // Carica altre 50 transazioni
    this.loadTransactions();
  }
  
  updateFilters() {
    this.filters = {
      types: {
        transfer: this.filterCheckboxes['filter-transfer']?.checked ?? true,
        vote: this.filterCheckboxes['filter-vote']?.checked ?? true,
        comment: this.filterCheckboxes['filter-comment']?.checked ?? true,
        other: this.filterCheckboxes['filter-other']?.checked ?? true
      },
      direction: {
        byUser: this.filterCheckboxes['filter-by']?.checked ?? true,
        onUser: this.filterCheckboxes['filter-on']?.checked ?? true
      }
    };
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
      
      // Recupera la cronologia dell'account usando il nuovo servizio
      const rawTransactions = await transactionHistoryService.getUserTransactionHistory(this.username, this.limit, from);
      
      if (rawTransactions && Array.isArray(rawTransactions)) {
        // Processa e formatta le transazioni
        let formattedTransactions = [];
        for (const tx of rawTransactions) {
          const formattedTx = await transactionHistoryService.formatTransaction(tx, this.username);
          formattedTransactions.push(formattedTx);
        }
        
        this.allTransactions = formattedTransactions;
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
  
  showLoadingState() {
    if (!this.transactionListElement) return;
    
    // Rimuovi contenuti esistenti
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    const loadingState = document.createElement('div');
    loadingState.className = 'loading-state';
    
    const loadingIcon = document.createElement('span');
    loadingIcon.className = 'material-icons loading-icon';
    loadingIcon.textContent = 'hourglass_top';
    
    loadingState.appendChild(loadingIcon);
    loadingState.appendChild(document.createTextNode(' Loading transaction history...'));
    
    this.transactionListElement.appendChild(loadingState);
  }
  
  showErrorState(errorMessage) {
    if (!this.transactionListElement) return;
    
    // Rimuovi contenuti esistenti
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    const errorState = document.createElement('div');
    errorState.className = 'error-state';
    errorState.textContent = `Failed to load transactions: ${errorMessage}`;
    
    this.transactionListElement.appendChild(errorState);
  }
  
  showEmptyState() {
    if (!this.transactionListElement) return;
    
    // Rimuovi contenuti esistenti
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No transactions found matching your filters';
    
    this.transactionListElement.appendChild(emptyState);
  }
  
  renderTransactions() {
    if (!this.transactionListElement) return;
    
    // Filtra le transazioni in base ai filtri correnti
    const filteredTransactions = transactionHistoryService.filterTransactions(
      this.allTransactions, 
      this.filters, 
      this.username
    );
    
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Ordina le transazioni dalla più recente alla meno recente
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
    linkElement.target = '_blank';
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
}