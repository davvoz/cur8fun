import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';

export default class TransferTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleTransferSubmit = this.handleTransferSubmit.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'transfer-tab';
    
    // Create form card
    const formCard = this.createFormCard();
    this.element.appendChild(formCard);
    
    this.parentElement.appendChild(this.element);
    
    return this.element;
  }
  
  createFormCard() {
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    // Create heading
    const heading = document.createElement('h3');
    heading.textContent = 'Transfer STEEM or SBD';
    formCard.appendChild(heading);
    
    // Create form
    const form = document.createElement('form');
    form.id = 'transfer-form';
    this.registerEventHandler(form, 'submit', this.handleTransferSubmit);
    
    // Recipient input group
    form.appendChild(this.createRecipientGroup());
    
    // Amount input group
    form.appendChild(this.createAmountGroup());
    
    // Memo input group
    form.appendChild(this.createMemoGroup());
    
    // Message container
    const messageEl = document.createElement('div');
    messageEl.id = 'transfer-message';
    messageEl.className = 'message hidden';
    form.appendChild(messageEl);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Send Transfer';
    form.appendChild(submitBtn);
    
    formCard.appendChild(form);
    return formCard;
  }
  
  createRecipientGroup() {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.setAttribute('for', 'transfer-to');
    label.textContent = 'Send to';
    group.appendChild(label);
      const input = document.createElement('input');
    input.type = 'text';
    input.id = 'transfer-to';
    input.placeholder = 'Username';
    input.required = true;
    
    // Force lowercase input for usernames
    this.registerEventHandler(input, 'input', (e) => {
      // Store current cursor position
      const cursorPos = e.target.selectionStart;
      
      // Set the value to lowercase
      e.target.value = e.target.value.toLowerCase();
      
      // Restore cursor position
      e.target.setSelectionRange(cursorPos, cursorPos);
    });
    
    group.appendChild(input);
    
    return group;
  }
  
  createAmountGroup() {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.setAttribute('for', 'transfer-amount');
    label.textContent = 'Amount';
    group.appendChild(label);
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'transfer-amount';
    input.min = '0.001';
    input.step = '0.001';
    input.placeholder = '0.000';
    input.required = true;
    inputGroup.appendChild(input);
    
    // Create styled currency selector
    const currencySelector = document.createElement('div');
    currencySelector.className = 'currency-selector';
    
    const select = document.createElement('select');
    select.id = 'transfer-currency';
    select.className = 'currency-select';
    
    // STEEM option with icon
    const steemOption = document.createElement('option');
    steemOption.value = 'STEEM';
    steemOption.textContent = 'STEEM';
    select.appendChild(steemOption);
    
    // SBD option with icon
    const sbdOption = document.createElement('option');
    sbdOption.value = 'SBD';
    sbdOption.textContent = 'SBD';
    select.appendChild(sbdOption);
    
    // Add dropdown arrow icon
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'select-wrapper';
    selectWrapper.appendChild(select);
    
    const selectIcon = document.createElement('span');
    selectIcon.className = 'select-icon material-icons';
    selectIcon.textContent = 'unfold_more';
    selectWrapper.appendChild(selectIcon);
    
    currencySelector.appendChild(selectWrapper);
    inputGroup.appendChild(currencySelector);
    
    group.appendChild(inputGroup);
    
    return group;
  }
  
  createMemoGroup() {
    const group = document.createElement('div');
    group.className = 'form-group memo-group';
    
    // Create label container for better positioning
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const label = document.createElement('label');
    label.setAttribute('for', 'transfer-memo');
    label.textContent = 'Memo';
    labelContainer.appendChild(label);
    
    // Add optional badge
    const optionalBadge = document.createElement('span');
    optionalBadge.className = 'optional-badge';
    optionalBadge.textContent = 'optional';
    labelContainer.appendChild(optionalBadge);
    
    group.appendChild(labelContainer);
    
    // Create memo container
    const memoContainer = document.createElement('div');
    memoContainer.className = 'memo-container';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'transfer-memo';
    textarea.className = 'memo-textarea';
    textarea.placeholder = 'Add a memo...';
    textarea.maxLength = 255; // Standard memo limit
    memoContainer.appendChild(textarea);
    
    // Add character counter
    const charCounter = document.createElement('div');
    charCounter.className = 'char-counter';
    charCounter.textContent = '0/255';
    memoContainer.appendChild(charCounter);
    
    group.appendChild(memoContainer);
    
    // Add info message with icon
    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'memo-info-wrapper';
    
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons memo-info-icon';
    infoIcon.textContent = 'info';
    infoWrapper.appendChild(infoIcon);
    
    const small = document.createElement('small');
    small.className = 'memo-info-text';
    small.textContent = 'Memos are public on the blockchain and cannot be edited after posting';
    infoWrapper.appendChild(small);
    
    group.appendChild(infoWrapper);
    
    // Add character counter functionality
    this.registerEventHandler(textarea, 'input', (e) => {
      const length = e.target.value.length;
      charCounter.textContent = `${length}/255`;
      
      // Add visual indicator when approaching limit
      if (length > 200) {
        charCounter.classList.add('approaching-limit');
      } else {
        charCounter.classList.remove('approaching-limit');
      }
    });
    
    return group;
  }
    async handleTransferSubmit(e) {
    e.preventDefault();
    
    const to = this.element.querySelector('#transfer-to').value.trim().toLowerCase();
    let amount = this.element.querySelector('#transfer-amount').value;
    const currency = this.element.querySelector('#transfer-currency').value;
    const memo = this.element.querySelector('#transfer-memo').value;
    const messageEl = this.element.querySelector('#transfer-message');
    
    // Clear previous messages
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('success', 'error');
    
    // Validate inputs
    if (!to) {
      this.showMessage('Please enter a recipient username', false);
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      this.showMessage('Please enter a valid amount', false);
      return;
    }
    
    // Format amount with exactly 3 decimal places
    try {
      amount = parseFloat(amount).toFixed(3);
    } catch (error) {
      this.showMessage('Invalid amount format', false);
      return;
    }
    
    // Check if user is logged in
    if (!this.currentUser) {
      this.showMessage('You must be logged in to make transfers', false);
      return;
    }
    
    try {
      // Show loading state
      const submitButton = this.element.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
      
      // Use wallet service for transfer instead of direct Keychain call
      let response;
      if (currency === 'STEEM') {
        response = await walletService.transferSteem(to, amount, memo);
      } else if (currency === 'SBD') {
        response = await walletService.transferSBD(to, amount, memo);
      } else {
        throw new Error('Invalid currency');
      }
      
      if (response.success) {
        this.showMessage(`Successfully transferred ${amount} ${currency} to @${to}`, true);
        this.element.querySelector('#transfer-form').reset();
        
        // Update balances
        walletService.updateBalances();
        
        // Emit event so other components can update
        eventEmitter.emit('wallet:transfer-completed', {
          from: this.currentUser,
          to,
          amount,
          currency
        });
      } else {
        this.showMessage(`Transfer failed: ${response.message || 'Unknown error'}`, false);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      this.showMessage(`Error: ${error.message || 'Unknown error'}`, false);
    } finally {
      // Reset button state
      const submitButton = this.element.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.textContent = 'Send Transfer';
    }
  }
  
  showMessage(message, isSuccess) {
    const messageEl = this.element.querySelector('#transfer-message');
    
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.classList.remove('hidden', 'success', 'error');
    messageEl.classList.add(isSuccess ? 'success' : 'error');
  }
  
  destroy() {
    super.destroy();
  }
}