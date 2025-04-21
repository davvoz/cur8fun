import TransactionHistoryBase from '../TransactionHistoryBase.js';
import authService from '../../../services/AuthService.js';
import filterService from '../../../services/FilterService.js';

export default class TransactionHistoryTab extends TransactionHistoryBase {
  constructor(parentElement, options = {}) {
    super(options);
    this.parentElement = parentElement;
    
    // Enable debug mode if needed
    if (options.debug) {
      this.debug = true;
      filterService.setDebug(true);
    }
  }
  
  render() {
    // Create the main tab element
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'history-tab';
    
    // Add the header with filters
    const header = this.createFilterHeader('Transaction History');
    this.element.appendChild(header);
    
    // Add the transaction container
    const transactionContainer = this.createTransactionContainer('transaction-list');
    this.element.appendChild(transactionContainer);
    
    // Add to DOM
    this.parentElement.appendChild(this.element);
    
    // Save reference to transaction list element that will need to be updated
    this.transactionListElement = this.element.querySelector('#transaction-list');
    
    // Load transactions
    this.loadTransactions();
    
    return this.element;
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
      
      const linkText = document.createTextNode('View on Explorer');
      link.appendChild(linkText);
    }
    
    return item;
  }
  
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    super.destroy();
  }
}