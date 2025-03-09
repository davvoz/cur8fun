import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';

export default class DelegationTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleDelegateSubmit = this.handleDelegateSubmit.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
    this.delegations = [];
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'delegate-tab';
    this.element.innerHTML = `
      <div class="form-card">
        <h3>Delegate STEEM POWER</h3>
        <form id="delegate-form">
          <div class="form-group">
            <label for="delegate-to">Delegate to</label>
            <input type="text" id="delegate-to" placeholder="Username" required>
          </div>
          
          <div class="form-group">
            <label for="delegate-amount">Amount</label>
            <div class="input-group">
              <input type="number" id="delegate-amount" min="0.001" step="0.001" placeholder="0.000" required>
              <div class="input-suffix">SP</div>
            </div>
          </div>
          
          <div id="delegate-message" class="message hidden"></div>
          
          <button type="submit" class="btn btn-primary">Delegate</button>
        </form>
      </div>
      
      <div class="delegations-container">
        <h3>Your Delegations</h3>
        <div id="delegations-list" class="delegations-list">
          <div class="loading-indicator">Loading your delegations...</div>
        </div>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Add event listener
    const form = this.element.querySelector('#delegate-form');
    if (form) {
      this.registerEventHandler(form, 'submit', this.handleDelegateSubmit);
    }
    
    // Load delegations
    this.loadDelegations();
    
    return this.element;
  }
  
  async handleDelegateSubmit(e) {
    e.preventDefault();
    
    const delegatee = this.element.querySelector('#delegate-to').value;
    const amount = this.element.querySelector('#delegate-amount').value;
    const messageEl = this.element.querySelector('#delegate-message');
    
    // Clear previous messages
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('success', 'error');
    
    if (!delegatee || !amount) {
      this.showMessage('Please fill in all required fields', false);
      return;
    }
    
    // Check if Keychain is installed
    if (typeof window.steem_keychain === 'undefined') {
      this.showMessage('Steem Keychain extension is not installed. Please install it to use this feature.', false);
      return;
    }
    
    // Get current user from auth service
    if (!this.currentUser) {
      this.showMessage('You need to be logged in to delegate', false);
      return;
    }
    
    try {
      // Disable button during processing
      const submitBtn = this.element.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      
      // Request delegation through Steem Keychain
      window.steem_keychain.requestDelegation(
        this.currentUser,  // From (current user)
        delegatee,         // To (delegatee)
        amount,            // Amount
        'SP',              // Unit (SP)
        (response) => {    // Callback
          if (response.success) {
            this.showMessage('Delegation completed successfully!', true);
            this.element.querySelector('#delegate-form').reset();
            
            // Update balances and delegations
            walletService.updateBalances();
            this.loadDelegations();
            
            // Emit event so other components can update
            eventEmitter.emit('wallet:delegation-updated');
          } else {
            this.showMessage(`Delegation failed: ${response.message || 'Unknown error'}`, false);
          }
          
          // Re-enable button
          submitBtn.disabled = false;
          submitBtn.textContent = 'Delegate';
        }
      );
    } catch (error) {
      console.error('Delegation error:', error);
      this.showMessage(`Error: ${error.message || 'Unknown error'}`, false);
      
      // Re-enable button
      const submitBtn = this.element.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Delegate';
    }
  }
  
  showMessage(message, isSuccess) {
    const messageEl = this.element.querySelector('#delegate-message');
    messageEl.textContent = message;
    messageEl.classList.remove('hidden', 'success', 'error');
    messageEl.classList.add(isSuccess ? 'success' : 'error');
  }
  
  async loadDelegations() {
    const container = this.element.querySelector('#delegations-list');
    if (!container) return;
    
    try {
      // Get delegations from wallet service
      this.delegations = await walletService.getDelegations();
      
      if (!this.delegations || this.delegations.length === 0) {
        container.innerHTML = `<p class="empty-state">You haven't made any delegations yet.</p>`;
        return;
      }
      
      // Create table to display delegations
      let html = `
        <table class="delegations-table">
          <thead>
            <tr>
              <th>Delegatee</th>
              <th>Amount (SP)</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      // Add rows for each delegation
      this.delegations.forEach(delegation => {
        const date = new Date(delegation.min_delegation_time + 'Z').toLocaleDateString();
        html += `
          <tr>
            <td>@${delegation.delegatee}</td>
            <td>${delegation.sp_amount} SP</td>
            <td>${date}</td>
            <td>
              <button class="edit-btn" data-user="${delegation.delegatee}">Edit</button>
              <button class="remove-btn" data-user="${delegation.delegatee}">Remove</button>
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
      
      // Update container with table
      container.innerHTML = html;
      
      // Add event listeners to buttons
      const editButtons = container.querySelectorAll('.edit-btn');
      const removeButtons = container.querySelectorAll('.remove-btn');
      
      editButtons.forEach(btn => {
        this.registerEventHandler(btn, 'click', () => {
          const delegatee = btn.getAttribute('data-user');
          this.prepareEditDelegation(delegatee);
        });
      });
      
      removeButtons.forEach(btn => {
        this.registerEventHandler(btn, 'click', () => {
          const delegatee = btn.getAttribute('data-user');
          this.removeDelegation(delegatee);
        });
      });
      
    } catch (error) {
      console.error('Failed to load delegations:', error);
      container.innerHTML = '<p class="error-state">Failed to load delegations</p>';
    }
  }
  
  prepareEditDelegation(delegatee) {
    // Find delegation data
    const delegation = this.delegations.find(d => d.delegatee === delegatee);
    if (!delegation) return;
    
    // Fill form with delegation data
    this.element.querySelector('#delegate-to').value = delegatee;
    this.element.querySelector('#delegate-amount').value = delegation.sp_amount;
    
    // Scroll to form
    this.element.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
  }
  
  async removeDelegation(delegatee) {
    if (confirm(`Are you sure you want to remove delegation to @${delegatee}?`)) {
      try {
        // To remove a delegation, delegate 0 SP
        window.steem_keychain.requestDelegation(
          this.currentUser,
          delegatee,
          0,
          'SP',
          (response) => {
            if (response.success) {
              this.showMessage(`Delegation to @${delegatee} successfully removed`, true);
              
              // Update balances and delegations
              walletService.updateBalances();
              this.loadDelegations();
              
              // Emit event
              eventEmitter.emit('wallet:delegation-updated');
            } else {
              this.showMessage(`Failed to remove delegation: ${response.message}`, false);
            }
          }
        );
      } catch (error) {
        console.error('Remove delegation error:', error);
        this.showMessage(`Error: ${error.message || 'Unknown error'}`, false);
      }
    }
  }
  
  destroy() {
    super.destroy();
  }
}