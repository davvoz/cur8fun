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
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'history-tab';
    
    // Crea l'intestazione con filtri
    const header = document.createElement('div');
    header.className = 'transaction-header';
    header.innerHTML = `
      <h3>Transaction History</h3>
      
      <div class="filter-container">
        <details>
          <summary>Advanced Filters</summary>
          <div class="filter-options">
            <div class="filter-group">
              <label><input type="checkbox" id="filter-transfer" checked> Transfers</label>
              <label><input type="checkbox" id="filter-vote" checked> Votes</label>
              <label><input type="checkbox" id="filter-comment" checked> Comments</label>
              <label><input type="checkbox" id="filter-other" checked> Other</label>
            </div>
            <div class="filter-group">
              <label><input type="checkbox" id="filter-by" checked> Actions performed by account</label>
              <label><input type="checkbox" id="filter-on" checked> Actions received by account</label>
            </div>
            <button id="apply-filters" class="btn secondary-btn">Apply Filters</button>
          </div>
        </details>
      </div>
    `;
    
    // Contenitore delle transazioni
    const transactionContainer = document.createElement('div');
    transactionContainer.className = 'transaction-container';
    transactionContainer.innerHTML = `
      <div id="transaction-list" class="transaction-list">
        <div class="loading-state">Loading transaction history...</div>
      </div>
      <div class="transaction-actions">
        <button id="load-more" class="btn primary-btn">Load More</button>
      </div>
    `;
    
    this.element.appendChild(header);
    this.element.appendChild(transactionContainer);
    this.parentElement.appendChild(this.element);
    
    // Aggiungi event listeners
    this.setupEventListeners();
    
    // Carica le transazioni
    this.loadTransactions();
    
    return this.element;
  }
  
  setupEventListeners() {
    // Gestisci i clic sul pulsante dei filtri
    const applyFiltersBtn = this.element.querySelector('#apply-filters');
    if (applyFiltersBtn) {
      this.registerEventHandler(applyFiltersBtn, 'click', () => {
        this.updateFilters();
        this.renderTransactions();
      });
    }
    
    // Gestisci i clic sul pulsante "Load More"
    const loadMoreBtn = this.element.querySelector('#load-more');
    if (loadMoreBtn) {
      this.registerEventHandler(loadMoreBtn, 'click', () => {
        this.limit += 50; // Carica altre 50 transazioni
        this.loadTransactions();
      });
    }
  }
  
  updateFilters() {
    this.filters = {
      transfer: this.element.querySelector('#filter-transfer').checked,
      vote: this.element.querySelector('#filter-vote').checked,
      comment: this.element.querySelector('#filter-comment').checked,
      other: this.element.querySelector('#filter-other').checked,
      byUser: this.element.querySelector('#filter-by').checked,
      onUser: this.element.querySelector('#filter-on').checked
    };
  }
  
  async loadTransactions() {
    if (!this.username || this.isLoading) return;
    
    const container = this.element.querySelector('#transaction-list');
    const loadMoreBtn = this.element.querySelector('#load-more');
    
    if (!container) return;
    
    this.isLoading = true;
    
    // Mostra stato di caricamento solo la prima volta
    if (this.allTransactions.length === 0) {
      container.innerHTML = '<div class="loading-state"><span class="material-icons loading-icon">hourglass_top</span> Loading transaction history...</div>';
    } else if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.innerHTML = '<span class="material-icons loading-icon">hourglass_top</span> Loading...';
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
      container.innerHTML = `<div class="error-state">Failed to load transactions: ${error.message || 'Unknown error'}</div>`;
    } finally {
      this.isLoading = false;
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      }
    }
  }
  
  renderTransactions() {
    const container = this.element.querySelector('#transaction-list');
    if (!container) return;
    
    const filteredTransactions = this.filterTransactions(this.allTransactions);
    
    if (filteredTransactions.length === 0) {
      container.innerHTML = '<div class="empty-state">No transactions found matching your filters</div>';
      return;
    }
    
    // Costruisci l'HTML per ogni transazione
    let html = '<ul class="transaction-list">';
    
    filteredTransactions.forEach(([id, transaction]) => {
      const op = transaction.op;
      const type = op[0];
      const data = op[1];
      
      // Determina se è un'azione dell'utente o verso l'utente
      const isActionByUser = this.isActionBy(type, data, this.username);
      const isActionOnUser = this.isActionOn(type, data, this.username);
      
      // Seleziona l'icona appropriata e colore per il tipo di transazione
      const { icon, iconClass } = this.getIconForType(type, data);
      
      // Formatta la descrizione della transazione in base al tipo
      const description = this.formatTransactionDescription(type, data);
      
      // Crea il link all'explorer
      const peakdLink = this.createExplorerLink(transaction, data);
      
      // Determina la direzione dell'azione
      let directionLabel = '';
      if (isActionByUser && this.filters.byUser) {
        directionLabel = '<span class="transaction-direction outgoing">Outgoing</span>';
      } else if (isActionOnUser && this.filters.onUser) {
        directionLabel = '<span class="transaction-direction incoming">Incoming</span>';
      }
      
      html += `
        <li class="transaction-item">
          <div class="transaction-icon ${iconClass}">
            <span class="material-icons">${icon}</span>
          </div>
          <div class="transaction-details">
            <div class="transaction-title">${this.formatTitle(type)}</div>
            <div class="transaction-meta">
              <span class="transaction-date">${formatDate(transaction.timestamp)}</span>
              <span class="transaction-memo">${description}</span>
              ${directionLabel}
            </div>
            <a href="${peakdLink}" target="_blank" class="transaction-link">
              <span class="material-icons">open_in_new</span> View on Explorer
            </a>
          </div>
        </li>
      `;
    });
    
    html += '</ul>';
    container.innerHTML = html;
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
}