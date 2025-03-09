import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';

export default class TransactionHistoryTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'history-tab';
    this.element.innerHTML = `
      <div class="transaction-history">
        <h3>Transaction History</h3>
        <div id="transaction-list" class="transaction-list">
          <div class="loading-state">Loading transaction history...</div>
        </div>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Load transaction history
    this.loadTransactions();
    
    return this.element;
  }
  
  async loadTransactions() {
    const container = this.element.querySelector('#transaction-list');
    if (!container) return;
    
    try {
      // For now, just simulate loading with a delay
      setTimeout(() => {
        container.innerHTML = `
          <ul class="transaction-list">
            <li class="transaction-item">
              <div class="transaction-icon transfer">
                <span class="material-icons">swap_horiz</span>
              </div>
              <div class="transaction-details">
                <div class="transaction-title">Transfer</div>
                <div class="transaction-meta">
                  <span class="transaction-date">March 8, 2025</span>
                  <span class="transaction-memo">Sent 10 STEEM to @user123</span>
                </div>
              </div>
            </li>
            <li class="transaction-item">
              <div class="transaction-icon claim">
                <span class="material-icons">redeem</span>
              </div>
              <div class="transaction-details">
                <div class="transaction-title">Claim Rewards</div>
                <div class="transaction-meta">
                  <span class="transaction-date">March 7, 2025</span>
                  <span class="transaction-memo">Claimed 5.2 SP and 2.1 SBD</span>
                </div>
              </div>
            </li>
          </ul>
        `;
      }, 1000);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      container.innerHTML = '<div class="error-state">Failed to load transactions</div>';
    }
  }
}