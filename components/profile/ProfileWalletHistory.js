import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import { formatDate } from '../../utils/DateUtils.js';
import steemService from '../../services/SteemService.js';
import transactionHistoryService from '../../services/TransactionHistoryService.js';
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
    
    // Binding dei metodi
    this.loadTransactions = this.loadTransactions.bind(this);
    this.loadMoreTransactions = this.loadMoreTransactions.bind(this);
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
   * Pulisce le risorse quando il componente viene rimosso
   */
  unmount() {
    // Rimuovi gli event listeners
    if (this.loadMoreButton) {
      this.loadMoreButton.removeEventListener('click', this.loadMoreTransactions);
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
    
    // Resetta lo stato
    this.allTransactions = [];
    this.isLoading = false;
    
    console.log(`ProfileWalletHistory: unmounted for @${this.username}`);
  }
}