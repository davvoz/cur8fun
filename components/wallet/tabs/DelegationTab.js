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
    
    // Create form section
    const formCard = this.createFormSection();
    
    // Create delegations section
    const delegationsContainer = this.createDelegationsSection();
    
    // Append sections to main element
    this.element.appendChild(formCard);
    this.element.appendChild(delegationsContainer);
    
    this.parentElement.appendChild(this.element);
    
    // Load delegations
    this.loadDelegations();
    
    return this.element;
  }
  
  createFormSection() {
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    // Create heading
    const heading = document.createElement('h3');
    heading.textContent = 'Delegate STEEM POWER';
    formCard.appendChild(heading);
    
    // Create form
    const form = document.createElement('form');
    form.id = 'delegate-form';
    this.registerEventHandler(form, 'submit', this.handleDelegateSubmit);
    
    // Recipient input group
    const toGroup = this.createFormGroup('Delegate to');    const toInput = document.createElement('input');
    toInput.type = 'text';
    toInput.id = 'delegate-to';
    toInput.placeholder = 'Username';
    toInput.required = true;
    
    // Force lowercase input for usernames
    this.registerEventHandler(toInput, 'input', (e) => {
      // Store current cursor position
      const cursorPos = e.target.selectionStart;
      
      // Set the value to lowercase
      e.target.value = e.target.value.toLowerCase();
      
      // Restore cursor position
      e.target.setSelectionRange(cursorPos, cursorPos);
    });
    
    toGroup.appendChild(toInput);
    form.appendChild(toGroup);
    
    // Amount input group
    const amountGroup = this.createFormGroup('Amount');
    const amountContainer = document.createElement('div');
    amountContainer.className = 'input-group';
    
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.id = 'delegate-amount';
    amountInput.min = '0.001';
    amountInput.step = '0.001';
    amountInput.placeholder = '0.000';
    amountInput.required = true;
    amountContainer.appendChild(amountInput);
    
    const amountSuffix = document.createElement('div');
    amountSuffix.className = 'input-suffix';
    amountSuffix.textContent = 'SP';
    amountContainer.appendChild(amountSuffix);
    
    amountGroup.appendChild(amountContainer);
    form.appendChild(amountGroup);
    
    // Message container
    const messageEl = document.createElement('div');
    messageEl.id = 'delegate-message';
    messageEl.className = 'message hidden';
    form.appendChild(messageEl);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Delegate';
    form.appendChild(submitBtn);
    
    formCard.appendChild(form);
    return formCard;
  }
  
  createFormGroup(labelText) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    group.appendChild(label);
    
    return group;
  }
  
  createDelegationsSection() {
    const delegationsContainer = document.createElement('div');
    delegationsContainer.className = 'delegations-container';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Your Delegations';
    delegationsContainer.appendChild(heading);
    
    const listContainer = document.createElement('div');
    listContainer.id = 'delegations-list';
    listContainer.className = 'delegations-list';
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading your delegations...';
    
    listContainer.appendChild(loadingIndicator);
    delegationsContainer.appendChild(listContainer);
    
    return delegationsContainer;
  }
    async handleDelegateSubmit(e) {
    e.preventDefault();
    
    const delegatee = this.element.querySelector('#delegate-to').value.trim().toLowerCase();
    let amount = this.element.querySelector('#delegate-amount').value;
    const messageEl = this.element.querySelector('#delegate-message');
    
    // Clear previous messages
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('success', 'error');
    
    if (!delegatee || !amount) {
      this.showMessage('Please fill in all required fields', false);
      return;
    }
    
    // Format amount as string with 3 decimal places
    try {
      // Convert to float first to handle any format issues
      amount = parseFloat(amount).toFixed(3);
    } catch (error) {
      this.showMessage('Invalid amount format', false);
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
      
      // Use the centralized delegateSteemPower service method
      const response = await walletService.delegateSteemPower(delegatee, amount);
      
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
      
      // Clear container
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      if (!this.delegations || this.delegations.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = "You haven't made any delegations yet.";
        container.appendChild(emptyState);
        return;
      }
      
      // Create table
      const table = this.createDelegationsTable();
      container.appendChild(table);
      
    } catch (error) {
      console.error('Failed to load delegations:', error);
      
      // Clear container
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      const errorState = document.createElement('p');
      errorState.className = 'error-state';
      errorState.textContent = 'Failed to load delegations';
      container.appendChild(errorState);
    }
  }
  
  createDelegationsTable() {
    const table = document.createElement('table');
    table.className = 'delegations-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Delegatee', 'Amount (SP)', 'Date', 'Actions'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Add rows for each delegation
    this.delegations.forEach(delegation => {
      const row = document.createElement('tr');
      
      // Delegatee cell
      const delegateeCell = document.createElement('td');
      delegateeCell.textContent = `@${delegation.delegatee}`;
      row.appendChild(delegateeCell);
      
      // Amount cell
      const amountCell = document.createElement('td');
      amountCell.textContent = `${delegation.sp_amount} SP`;
      row.appendChild(amountCell);
      
      // Date cell
      const dateCell = document.createElement('td');
      const date = new Date(delegation.min_delegation_time + 'Z').toLocaleDateString();
      dateCell.textContent = date;
      row.appendChild(dateCell);
      
      // Actions cell
      const actionsCell = document.createElement('td');
      
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-user', delegation.delegatee);
      this.registerEventHandler(editBtn, 'click', () => {
        this.prepareEditDelegation(delegation.delegatee);
      });
      actionsCell.appendChild(editBtn);
      
      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('data-user', delegation.delegatee);
      this.registerEventHandler(removeBtn, 'click', () => {
        this.removeDelegation(delegation.delegatee);
      });
      actionsCell.appendChild(removeBtn);
      
      row.appendChild(actionsCell);
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    return table;
  }
  
  prepareEditDelegation(delegatee) {
    // Find delegation data
    const delegation = this.delegations.find(d => d.delegatee === delegatee);
    if (!delegation) return;
      // Fill form with delegation data
    this.element.querySelector('#delegate-to').value = delegatee.toLowerCase();
    this.element.querySelector('#delegate-amount').value = delegation.sp_amount;
    
    // Scroll to form
    this.element.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
  }
    async removeDelegation(delegatee) {
    // Ensure delegatee is in lowercase
    const delegateeLower = delegatee.toLowerCase();
    
    if (confirm(`Are you sure you want to remove delegation to @${delegateeLower}?`)) {
      try {
        // To remove a delegation, delegate 0 SP
        const zeroAmount = "0.000"; // Properly formatted zero amount
        
        // Use the centralized delegateSteemPower service method with zero amount
        const response = await walletService.delegateSteemPower(delegateeLower, zeroAmount);
          if (response.success) {
          this.showMessage(`Delegation to @${delegateeLower} successfully removed`, true);
          
          // Update balances and delegations
          walletService.updateBalances();
          this.loadDelegations();
          
          // Emit event
          eventEmitter.emit('wallet:delegation-updated');
        } else {
          this.showMessage(`Failed to remove delegation: ${response.message || 'Unknown error'}`, false);
        }
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