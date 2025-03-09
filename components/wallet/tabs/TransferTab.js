import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';

export default class TransferTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleTransferSubmit = this.handleTransferSubmit.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'transfer-tab';
    this.element.innerHTML = `
      <div class="form-card">
        <h3>Transfer STEEM or SBD</h3>
        <form id="transfer-form">
          <div class="form-group">
            <label for="transfer-to">Send to</label>
            <input type="text" id="transfer-to" placeholder="Username" required>
          </div>
          
          <div class="form-group">
            <label for="transfer-amount">Amount</label>
            <div class="input-group">
              <input type="number" id="transfer-amount" min="0.001" step="0.001" placeholder="0.000" required>
              <select id="transfer-currency">
                <option value="STEEM">STEEM</option>
                <option value="SBD">SBD</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="transfer-memo">Memo (optional)</label>
            <textarea id="transfer-memo" placeholder="Add a memo..."></textarea>
            <small class="text-muted">Memos are public on the blockchain</small>
          </div>
          
          <div id="transfer-error" class="error-message hidden"></div>
          
          <button type="submit" class="btn btn-primary">Send Transfer</button>
        </form>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Add event listener
    const form = this.element.querySelector('#transfer-form');
    this.registerEventHandler(form, 'submit', this.handleTransferSubmit);
    
    return this.element;
  }
  
  async handleTransferSubmit(e) {
    e.preventDefault();
    
    const to = this.element.querySelector('#transfer-to').value;
    const amount = this.element.querySelector('#transfer-amount').value;
    const currency = this.element.querySelector('#transfer-currency').value;
    const memo = this.element.querySelector('#transfer-memo').value;
    
    // Clear previous errors
    const errorDiv = this.element.querySelector('#transfer-error');
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
    
    try {
      // Show loading state
      const submitButton = this.element.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
      
      // Call the appropriate service method based on currency
      if (currency === 'STEEM') {
        await walletService.transferSteem(to, amount, memo);
      } else {
        await walletService.transferSBD(to, amount, memo);
      }
      
      // Reset form
      this.element.querySelector('#transfer-form').reset();
      
      // Show success message
      alert(`Successfully transferred ${amount} ${currency} to @${to}`);
      
    } catch (error) {
      // Show error message
      errorDiv.textContent = error.message || 'Transfer failed';
      errorDiv.classList.remove('hidden');
    } finally {
      // Reset button state
      const submitButton = this.element.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.textContent = 'Send Transfer';
    }
  }
}