import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import { formatDate } from '../../../utils/DateUtils.js';

export default class TransactionHistoryTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.allTransactions = [];
    this.username = authService.getCurrentUser()?.username || '';
    this.isLoading = false;
    this.filters = {
      transfer: true,
      vote: true,
      comment: true,
      other: true,
      byUser: true,
      onUser: true
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
      transfer: this.filterCheckboxes['filter-transfer']?.checked ?? true,
      vote: this.filterCheckboxes['filter-vote']?.checked ?? true,
      comment: this.filterCheckboxes['filter-comment']?.checked ?? true,
      other: this.filterCheckboxes['filter-other']?.checked ?? true,
      byUser: this.filterCheckboxes['filter-by']?.checked ?? true,
      onUser: this.filterCheckboxes['filter-on']?.checked ?? true
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
        from = this.allTransactions[this.allTransactions.length - 1][0] - 1;
      }
      
      // Recupera la cronologia dell'account
      const result = await walletService._getAccountHistory(this.username, from, this.limit);
      
      if (result && Array.isArray(result)) {
        this.allTransactions = result;
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
    
    const filteredTransactions = this.filterTransactions(this.allTransactions);
    
    if (filteredTransactions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Rimuovi contenuti esistenti
    while (this.transactionListElement.firstChild) {
      this.transactionListElement.removeChild(this.transactionListElement.firstChild);
    }
    
    // Crea lista transazioni
    const transactionListElement = document.createElement('ul');
    transactionListElement.className = 'transaction-list';
    
    // Aggiungi ogni transazione alla lista
    filteredTransactions.forEach(([id, transaction]) => {
      const transactionItem = this.createTransactionItem(transaction);
      transactionListElement.appendChild(transactionItem);
    });
    
    this.transactionListElement.appendChild(transactionListElement);
  }
  
  createTransactionItem(transaction) {
    const op = transaction.op;
    const type = op[0];
    const data = op[1];
    
    // Crea l'elemento della transazione
    const listItem = document.createElement('li');
    listItem.className = 'transaction-item';
    
    // Determina se è un'azione dell'utente o verso l'utente
    const isActionByUser = this.isActionBy(type, data, this.username);
    const isActionOnUser = this.isActionOn(type, data, this.username);
    
    // Seleziona l'icona appropriata e colore per il tipo di transazione
    const { icon, iconClass } = this.getIconForType(type, data);
    
    // Crea l'icona della transazione
    const iconElement = document.createElement('div');
    iconElement.className = `transaction-icon ${iconClass}`;
    
    const iconText = document.createElement('span');
    iconText.className = 'material-icons';
    iconText.textContent = icon;
    
    iconElement.appendChild(iconText);
    listItem.appendChild(iconElement);
    
    // Crea i dettagli della transazione
    const detailsElement = document.createElement('div');
    detailsElement.className = 'transaction-details';
    
    // Titolo della transazione
    const titleElement = document.createElement('div');
    titleElement.className = 'transaction-title';
    titleElement.textContent = this.formatTitle(type);
    detailsElement.appendChild(titleElement);
    
    // Metadati della transazione
    const metaElement = document.createElement('div');
    metaElement.className = 'transaction-meta';
    
    const dateElement = document.createElement('span');
    dateElement.className = 'transaction-date';
    dateElement.textContent = formatDate(transaction.timestamp);
    metaElement.appendChild(dateElement);
    
    const memoElement = document.createElement('span');
    memoElement.className = 'transaction-memo';
    memoElement.textContent = this.formatTransactionDescription(type, data);
    metaElement.appendChild(memoElement);
    
    // Direzione della transazione
    if ((isActionByUser && this.filters.byUser) || (isActionOnUser && this.filters.onUser)) {
      const directionElement = document.createElement('span');
      directionElement.className = 'transaction-direction';
      
      if (isActionByUser && this.filters.byUser) {
        directionElement.classList.add('outgoing');
        directionElement.textContent = 'Outgoing';
      } else if (isActionOnUser && this.filters.onUser) {
        directionElement.classList.add('incoming');
        directionElement.textContent = 'Incoming';
      }
      
      metaElement.appendChild(directionElement);
    }
    
    detailsElement.appendChild(metaElement);
    
    // Link all'explorer
    const linkElement = document.createElement('a');
    linkElement.href = this.createExplorerLink(transaction, data);
    linkElement.target = '_blank';
    linkElement.className = 'transaction-link';
    
    const linkIconElement = document.createElement('span');
    linkIconElement.className = 'material-icons';
    linkIconElement.textContent = 'open_in_new';
    
    linkElement.appendChild(linkIconElement);
    linkElement.appendChild(document.createTextNode(' View on Explorer'));
    
    detailsElement.appendChild(linkElement);
    listItem.appendChild(detailsElement);
    
    return listItem;
  }
  
  filterTransactions(transactions) {
    return transactions.filter(([id, transaction]) => {
      const type = transaction.op[0];
      const data = transaction.op[1];
      
      // Filtra per tipo di transazione
      let passTypeFilter = false;
      switch (type) {
        case 'transfer':
        case 'transfer_to_vesting':
        case 'withdraw_vesting':
          passTypeFilter = this.filters.transfer;
          break;
        case 'vote':
        case 'effective_comment_vote':
          passTypeFilter = this.filters.vote;
          break;
        case 'comment':
        case 'comment_reward':
        case 'comment_options':
          passTypeFilter = this.filters.comment;
          break;
        default:
          passTypeFilter = this.filters.other;
      }
      if (!passTypeFilter) {
        return false;
      }
      
      // Filtra per direzione (da/verso l'utente)
      const isActionByUser = this.isActionBy(type, data, this.username);
      const isActionOnUser = this.isActionOn(type, data, this.username);
      
      return (isActionByUser && this.filters.byUser) || 
             (isActionOnUser && this.filters.onUser);
    });
  }
  
  isActionBy(type, data, username) {
    switch (type) {
      case 'transfer':
        return data.from === username;
      case 'vote':
        return data.voter === username;
      case 'comment':
      case 'comment_options':
        return data.author === username;
      case 'transfer_to_vesting':
        return data.from === username;
      case 'delegate_vesting_shares':
        return data.delegator === username;
      case 'claim_reward_balance':
        return data.account === username;
      case 'custom_json':
        return Array.isArray(data.required_posting_auths) && 
               data.required_posting_auths.includes(username);
      default:
        return false;
    }
  }
  
  isActionOn(type, data, username) {
    switch (type) {
      case 'transfer':
        return data.to === username;
      case 'vote':
        return data.author === username;
      case 'comment':
        return data.parent_author === username;
      case 'transfer_to_vesting':
        return data.to === username;
      case 'delegate_vesting_shares':
        return data.delegatee === username;
      case 'claim_reward_balance':
        return data.account === username;
      case 'curation_reward':
        return data.curator === username;
      case 'author_reward':
      case 'comment_reward':
        return data.author === username;
      default:
        return false;
    }
  }
  
  getIconForType(type, data) {
    switch (type) {
      case 'transfer':
        return { icon: 'swap_horiz', iconClass: 'transfer' };
      case 'vote':
        return data.weight > 0 
          ? { icon: 'thumb_up', iconClass: 'upvote' } 
          : { icon: 'thumb_down', iconClass: 'downvote' };
      case 'comment':
        return data.parent_author 
          ? { icon: 'chat', iconClass: 'reply' } 
          : { icon: 'create', iconClass: 'post' };
      case 'claim_reward_balance':
        return { icon: 'redeem', iconClass: 'claim' };
      case 'transfer_to_vesting':
        return { icon: 'trending_up', iconClass: 'power-up' };
      case 'withdraw_vesting':
        return { icon: 'trending_down', iconClass: 'power-down' };
      case 'curation_reward':
        return { icon: 'stars', iconClass: 'curation' };
      case 'author_reward':
      case 'comment_reward':
        return { icon: 'payment', iconClass: 'reward' };
      case 'delegate_vesting_shares':
        return { icon: 'share', iconClass: 'delegation' };
      case 'custom_json':
        return { icon: 'code', iconClass: 'custom' };
      default:
        return { icon: 'receipt', iconClass: 'other' };
    }
  }
  
  formatTitle(type) {
    switch (type) {
      case 'transfer':
        return 'Transfer';
      case 'vote':
        return 'Vote';
      case 'comment':
        return 'Comment/Post';
      case 'claim_reward_balance':
        return 'Claim Rewards';
      case 'transfer_to_vesting':
        return 'Power Up';
      case 'withdraw_vesting':
        return 'Power Down';
      case 'curation_reward':
        return 'Curation Reward';
      case 'author_reward':
      case 'comment_reward':
        return 'Author Reward';
      case 'delegate_vesting_shares':
        return 'Delegation';
      case 'custom_json':
        return 'Custom JSON';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  
  formatTransactionDescription(type, data) {
    switch (type) {
      case 'transfer':
        return `${data.from === this.username ? 'Sent' : 'Received'} ${data.amount} ${data.memo ? `- Memo: ${data.memo}` : ''}`;
      case 'vote':
        const weightPercent = (data.weight / 100).toFixed(0);
        return `${data.voter === this.username ? 'Voted' : 'Received vote'} ${weightPercent}% on @${data.author}/${data.permlink.substring(0, 20)}...`;
      case 'comment':
        if (data.parent_author) {
          return `Replied to @${data.parent_author}/${data.parent_permlink.substring(0, 20)}...`;
        }
        return `Created post "${data.title || data.permlink}"`;
      case 'claim_reward_balance':
        return `Claimed ${data.reward_steem || '0 STEEM'}, ${data.reward_sbd || '0 SBD'}, ${data.reward_vests || '0 VESTS'}`;
      case 'transfer_to_vesting':
        return `Powered up ${data.amount} to ${data.to}`;
      case 'delegate_vesting_shares':
        return `${data.delegator === this.username ? 'Delegated' : 'Received delegation of'} ${data.vesting_shares}`;
      case 'curation_reward':
        return `Received ${data.reward} for curating @${data.comment_author}/${data.comment_permlink.substring(0, 15)}...`;
      case 'author_reward':
      case 'comment_reward':
        return `Received ${data.sbd_payout || '0 SBD'}, ${data.steem_payout || '0 STEEM'}, ${data.vesting_payout || '0 VESTS'} for @${data.author}/${data.permlink.substring(0, 15)}...`;
      default:
        return `Operation: ${type}`;
    }
  }
  
  createExplorerLink(transaction, data) {
    // Link alle transazioni su steemblocks o altro explorer
    if (data.author && data.permlink) {
      return `https://davvoz.github.io/steemee/#/@${data.author}/${data.permlink}`;
    }
    return `https://steemblockexplorer.com/tx/${transaction.trx_id}`;
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