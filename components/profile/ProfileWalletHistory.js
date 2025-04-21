import TransactionHistoryBase from '../wallet/TransactionHistoryBase.js';
import WalletResourcesComponent from '../wallet/WalletResourcesComponent.js';
import WalletBalancesComponent from '../wallet/WalletBalancesComponent.js';

export default class ProfileWalletHistory extends TransactionHistoryBase {
  constructor(username) {
    super({ username, limit: 30 });
    this.balancesComponent = null;
    this.resourcesComponent = null;
  }
  
  render(container) {
    console.log(`Rendering wallet history for @${this.username}`);
    
    // Save the reference to container
    this.container = container;
    
    // Clear the container
    container.innerHTML = '';
    
    // Create the main layout
    const walletHistoryContainer = document.createElement('div');
    walletHistoryContainer.className = 'wallet-list-container profile-wallet-container';
    walletHistoryContainer.style.width = '100%';
    
    // Header
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
    
    // Separator
    const divider = document.createElement('div');
    divider.className = 'section-divider';
    walletHistoryContainer.appendChild(divider);
    
    // Transaction header with filters
    const transactionsHeader = this.createFilterHeader('Transaction History', 'profile-');
    walletHistoryContainer.appendChild(transactionsHeader);
    
    // Create transaction list container
    const transactionList = document.createElement('div');
    transactionList.className = 'transaction-list';
    walletHistoryContainer.appendChild(transactionList);
    
    // Add to container
    container.appendChild(walletHistoryContainer);
    
    // Set transactionListElement reference for the base class
    this.transactionListElement = transactionList;
    this.transactionList = transactionList; // For compatibility with existing code
    
    // Initialize wallet components
    this.balancesComponent = new WalletBalancesComponent(balancesContainer, {
      username: this.username
    });
    this.balancesComponent.render();
    
    this.resourcesComponent = new WalletResourcesComponent(resourcesContainer, {
      username: this.username
    });
    this.resourcesComponent.render();
    
    // Load transactions
    this.showLoadingState();
    this.loadTransactions();
    
    return walletHistoryContainer;
  }
  
  // Override createTransactionItem to customize the link text
  createTransactionItem(tx) {
    const item = super.createTransactionItem(tx);
    
    // Customize the link text
    const link = item.querySelector('.transaction-link');
    if (link) {
      link.innerHTML = '';
      
      const linkIcon = document.createElement('span');
      linkIcon.className = 'material-icons';
      linkIcon.textContent = 'open_in_new';
      link.appendChild(linkIcon);
      
      const linkText = document.createTextNode('View');
      link.appendChild(linkText);
    }
    
    return item;
  }
  
  /**
   * Aggiorna l'username e ricarica le transazioni
   * @param {string} newUsername - Il nuovo username da visualizzare
   */
  updateUsername(newUsername) {
    if (this.username === newUsername) return;
    
    console.log(`Updating username from ${this.username} to ${newUsername}`);
    
    // Call the base class updateUsername method
    super.updateUsername(newUsername);
    
    // Update the title
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
  
  destroy() {
    // Clean up child components
    if (this.balancesComponent) {
      this.balancesComponent.destroy();
      this.balancesComponent = null;
    }
    
    if (this.resourcesComponent) {
      this.resourcesComponent.destroy();
      this.resourcesComponent = null;
    }
    
    this.container = null;
    
    // Call the base class destroy method
    super.destroy();
  }
}