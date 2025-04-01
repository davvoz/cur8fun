import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import { formatDate } from '../../utils/DateUtils.js';
import steemService from '../../services/SteemService.js';
import transactionHistoryService from '../../services/TransactionHistoryService.js';

export default class ProfileWalletHistory extends Component {
  constructor(username) {
    super();
    this.username = username;
    this.isLoading = false;
    this.allTransactions = [];
    this.limit = 30;
    this.transactionList = null;
    this.loadMoreButton = null;
    this.walletSummary = null;
    
    // Dati del portafoglio
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000'
    };
    
    // Stato delle risorse
    this.resources = {
      voting: 0,
      bandwidth: 0,
      rc: 0
    };
    
    // Binding dei metodi
    this.loadTransactions = this.loadTransactions.bind(this);
    this.loadMoreTransactions = this.loadMoreTransactions.bind(this);
    this.loadWalletData = this.loadWalletData.bind(this);
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
    
    // Sezione riepilogo portafoglio
    this.walletSummary = document.createElement('div');
    this.walletSummary.className = 'wallet-summary';
    this.walletSummary.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading wallet data...</p>
      </div>
    `;
    walletHistoryContainer.appendChild(this.walletSummary);
    
    // Separatore
    const divider = document.createElement('div');
    divider.className = 'section-divider';
    walletHistoryContainer.appendChild(divider);
    
    // Intestazione transazioni
    const transactionsHeader = document.createElement('div');
    transactionsHeader.className = 'wallet-section-header';
    
    const transactionsTitle = document.createElement('h4');
    transactionsTitle.className = 'wallet-section-title';
    transactionsTitle.textContent = 'Transaction History';
    transactionsHeader.appendChild(transactionsTitle);
    
    walletHistoryContainer.appendChild(transactionsHeader);
    
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
    
    // Carica le transazioni e i dati del portafoglio
    this.loadWalletData();
    this.showLoadingState();
    this.loadTransactions();
    
    return walletHistoryContainer;
  }
  
  async loadWalletData() {
    try {
      // Ottieni informazioni sull'account
      const account = await steemService.getUser(this.username);
      
      if (!account) {
        this.showWalletSummaryError("Failed to load account data");
        return;
      }
      
      // Estrai i saldi
      const steemBalance = parseFloat(account.balance).toFixed(3);
      const sbdBalance = parseFloat(account.sbd_balance).toFixed(3);
      
      // Calcola STEEM Power
      const vestingShares = parseFloat(account.vesting_shares);
      const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
      const receivedVestingShares = parseFloat(account.received_vesting_shares);
      
      const steemPower = await walletService.vestsToSteem(
        vestingShares - delegatedVestingShares + receivedVestingShares
      );
      
      // Aggiorna i saldi
      this.balances = {
        steem: steemBalance,
        sbd: sbdBalance,
        steemPower: steemPower.toFixed(3)
      };
      
      // Ottieni informazioni sulle risorse
      // Nota: questi valori sono simulati, in un'implementazione reale sarebbero ottenuti dalla blockchain
      this.resources = {
        voting: this.calculateVotingPower(account),
        bandwidth: 75, // Valore simulato
        rc: 80 // Valore simulato
      };
      
      // Renderizza il riepilogo del portafoglio
      this.renderWalletSummary();
      
    } catch (error) {
      console.error('Error loading wallet data:', error);
      this.showWalletSummaryError("Failed to load wallet data");
    }
  }
  
  calculateVotingPower(account) {
    // Voting Power calculation
    const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
    const secondsPassedSinceLastVote = (new Date().getTime() - lastVoteTime) / 1000;
    const regeneratedVotingPower = secondsPassedSinceLastVote * (10000 / (5 * 24 * 60 * 60));
    const currentVotingPower = Math.min(10000, account.voting_power + regeneratedVotingPower) / 100;
    
    return Math.floor(currentVotingPower);
  }
  
  renderWalletSummary() {
    if (!this.walletSummary) return;
    
    this.walletSummary.innerHTML = `
      <div class="wallet-summary-grid">
        <div class="balance-card">
          <h5>STEEM Balance</h5>
          <div class="balance-value">${this.balances.steem} STEEM</div>
        </div>
        <div class="balance-card">
          <h5>SBD Balance</h5>
          <div class="balance-value">${this.balances.sbd} SBD</div>
        </div>
        <div class="balance-card">
          <h5>STEEM Power</h5>
          <div class="balance-value">${this.balances.steemPower} SP</div>
        </div>
      </div>
      
      <div class="resources-section">
        <h5>Account Resources</h5>
        <div class="resource-meters">
          <div class="resource-meter">
            <div class="resource-label">Voting Power</div>
            <div class="meter-container">
              <div class="meter" style="width: ${this.resources.voting}%"></div>
            </div>
            <div class="meter-value">${this.resources.voting}%</div>
          </div>
          
          <div class="resource-meter">
            <div class="resource-label">Bandwidth</div>
            <div class="meter-container">
              <div class="meter" style="width: ${this.resources.bandwidth}%"></div>
            </div>
            <div class="meter-value">${this.resources.bandwidth}%</div>
          </div>
          
          <div class="resource-meter">
            <div class="resource-label">Resource Credits</div>
            <div class="meter-container">
              <div class="meter" style="width: ${this.resources.rc}%"></div>
            </div>
            <div class="meter-value">${this.resources.rc}%</div>
          </div>
        </div>
      </div>
      
      <style>
        .wallet-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .balance-card {
          background-color: #f5f5f5;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .balance-card h5 {
          margin: 0 0 8px;
          color: #555;
          font-weight: 500;
        }
        
        .balance-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a5099;
        }
        
        .resources-section {
          margin-top: 24px;
        }
        
        .resources-section h5 {
          margin: 0 0 16px;
        }
        
        .resource-meters {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .resource-meter {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .resource-label {
          width: 120px;
          font-size: 0.9rem;
        }
        
        .meter-container {
          flex: 1;
          height: 8px;
          background-color: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .meter {
          height: 100%;
          background-color: #4caf50;
          border-radius: 4px;
        }
        
        .meter-value {
          width: 50px;
          text-align: right;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .section-divider {
          height: 1px;
          background-color: #e0e0e0;
          margin: 24px 0;
        }
      </style>
    `;
  }
  
  showWalletSummaryError(message) {
    if (!this.walletSummary) return;
    
    this.walletSummary.innerHTML = `
      <div class="error-state">
        <i class="material-icons">error_outline</i>
        <p>${message}</p>
      </div>
    `;
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
    
    this.transactionList.innerHTML = `
      <div class="empty-state">
        <i class="material-icons">info_outline</i>
        <p>No transaction history found for @${this.username}</p>
      </div>
    `;
  }
  
  async renderTransactions() {
    if (!this.transactionList) return;
    
    // Svuota la lista
    this.transactionList.innerHTML = '';
    
    // Ordina le transazioni dalla più recente alla più vecchia
    const sortedTransactions = transactionHistoryService.sortTransactions(this.allTransactions);
    
    // Renderizza ogni transazione
    for (const tx of sortedTransactions) {
      const txElement = this.createTransactionItem(tx);
      this.transactionList.appendChild(txElement);
    }
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
    linkElement.target = '_blank';
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
      
      // Ricarica i dati del portafoglio
      this.loadWalletData();
      
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
   * Pulisce le risorse quando il componente viene rimosso
   */
  unmount() {
    // Rimuovi gli event listeners
    if (this.loadMoreButton) {
      this.loadMoreButton.removeEventListener('click', this.loadMoreTransactions);
    }
    
    // Pulisci i riferimenti DOM
    this.container = null;
    this.transactionList = null;
    this.loadMoreButton = null;
    this.walletSummary = null;
    
    // Resetta lo stato
    this.allTransactions = [];
    this.isLoading = false;
    
    console.log(`ProfileWalletHistory: unmounted for @${this.username}`);
  }
}