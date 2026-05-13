import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';

export default class TransferTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleTransferSubmit = this.handleTransferSubmit.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
    this._recipientValid = true;
    this._amountValid = true;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'transfer-tab';
    
    // Create form card
    const formCard = this.createFormCard();
    this.element.appendChild(formCard);
    
    this.parentElement.appendChild(this.element);

    // Async: set max on amount input after balances are fetched
    this._initAmountLimits();

    // Gate active-key operations if only posting key is available
    this._applyActiveKeyGate();
    
    return this.element;
  }
  
  async _initAmountLimits() {
    try {
      const balances = await walletService.fetchBalances();
      this._balances = balances;
      this._updateAmountMax();
    } catch { /* non-blocking */ }
  }

  _updateAmountMax() {
    const input = this.element?.querySelector('#transfer-amount');
    const hint = this.element?.querySelector('#transfer-amount-hint');
    if (!input || !this._balances) return;
    const currency = this.element.querySelector('#transfer-currency')?.value || 'STEEM';
    const max = parseFloat(currency === 'STEEM' ? this._balances.steem : this._balances.sbd);
    if (!isNaN(max)) {
      input.max = max.toFixed(3);
      // Re-validate current value
      this._validateAmountInput(input, hint, max, currency);
    }
  }

  _updateSubmitState() {
    const btn = this.element?.querySelector('button[type="submit"]');
    if (btn) btn.disabled = !this._recipientValid || !this._amountValid;
  }

  _validateAmountInput(input, hint, max, currency) {
    const val = input.valueAsNumber;
    if (!isNaN(val) && !isNaN(max) && val > max) {
      hint.textContent = `Available: ${max.toFixed(3)} ${currency}`;
      hint.className = 'amount-hint invalid';
      this._amountValid = false;
    } else {
      hint.textContent = max >= 0 ? `Available: ${max.toFixed(3)} ${currency}` : '';
      hint.className = 'amount-hint';
      this._amountValid = true;
    }
    this._updateSubmitState();
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
    
    // Force lowercase + reset recipient state while typing
    this.registerEventHandler(input, 'input', (e) => {
      const cursorPos = e.target.selectionStart;
      e.target.value = e.target.value.toLowerCase();
      e.target.setSelectionRange(cursorPos, cursorPos);
      const hint = group.querySelector('.username-hint');
      if (hint) { hint.textContent = ''; hint.className = 'username-hint'; }
      // Reset to valid while user is re-typing so amount errors stay visible
      this._recipientValid = true;
      this._updateSubmitState();
    });

    // Live validation on blur
    const hint = document.createElement('small');
    hint.className = 'username-hint';
    this.registerEventHandler(input, 'blur', async (e) => {
      const val = e.target.value.trim();
      if (!val) {
        hint.textContent = ''; hint.className = 'username-hint';
        this._recipientValid = true;
        this._updateSubmitState();
        return;
      }
      hint.textContent = 'Checking...';
      hint.className = 'username-hint';
      const exists = await walletService.validateAccountExists(val);
      if (exists) {
        hint.textContent = '✓ Account found';
        hint.className = 'username-hint valid';
        this._recipientValid = true;
      } else {
        hint.textContent = '✗ Account not found';
        hint.className = 'username-hint invalid';
        this._recipientValid = false;
      }
      this._updateSubmitState();
    });

    group.appendChild(input);
    group.appendChild(hint);
    
    return group;
  }
  
  createAmountGroup() {
    const group = document.createElement('div');
    group.className = 'form-group';

    const labelRow = document.createElement('div');
    labelRow.className = 'label-row';
    const label = document.createElement('label');
    label.setAttribute('for', 'transfer-amount');
    label.textContent = 'Amount';
    labelRow.appendChild(label);
    const maxBtn = document.createElement('button');
    maxBtn.type = 'button';
    maxBtn.className = 'max-btn';
    maxBtn.textContent = 'Max';
    this.registerEventHandler(maxBtn, 'click', () => {
      const currency = this.element.querySelector('#transfer-currency').value;
      // Use cached balances instantly
      const cached = walletService.balances;
      if (cached) {
        this._balances = cached;
        const max = currency === 'STEEM' ? cached.steem : cached.sbd;
        this.element.querySelector('#transfer-amount').value = parseFloat(max).toFixed(3);
        this._updateAmountMax();
      }
      // Refresh in background
      walletService.fetchBalances().then(b => { this._balances = b; this._updateAmountMax(); }).catch(() => {});
    });
    labelRow.appendChild(maxBtn);
    group.appendChild(labelRow);

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
    
    // Update max and hint when currency changes
    this.registerEventHandler(select, 'change', () => this._updateAmountMax());

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

    // Live amount validation + 3 decimal cap (locale-safe: handles both . and ,)
    this.registerEventHandler(input, 'input', (e) => {
      const num = e.target.valueAsNumber;
      if (!isNaN(num)) {
        const truncated = Math.round(num * 1000) / 1000;
        if (num !== truncated) e.target.valueAsNumber = truncated;
      }
      const hint = group.querySelector('#transfer-amount-hint');
      const currency = this.element.querySelector('#transfer-currency')?.value || 'STEEM';
      const max = parseFloat(input.max);
      this._validateAmountInput(input, hint, max, currency);
    });
    
    group.appendChild(inputGroup);

    // Inline hint below the input group
    const amountHint = document.createElement('small');
    amountHint.id = 'transfer-amount-hint';
    amountHint.className = 'amount-hint';
    group.appendChild(amountHint);
    
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

    // Pre-flight: balance check (fetch fresh data from blockchain)
    this.showMessage('Checking balance…', null);
    const freshBalances = await walletService.fetchBalances();
    const available = parseFloat(
      currency === 'STEEM' ? freshBalances.steem : freshBalances.sbd
    );
    if (!isNaN(available) && parseFloat(amount) > available) {
      this.showMessage(
        `Insufficient ${currency} balance. Available: ${available.toFixed(3)} ${currency}`,
        false
      );
      return;
    }

    // Pre-flight: recipient account existence
    this.showMessage('Verifying recipient account...', null);
    const recipientExists = await walletService.validateAccountExists(to);
    if (!recipientExists) {
      this.showMessage(`Account @${to} does not exist on the Steem blockchain`, false);
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

        // Refresh balances and amount limits immediately
        this._initAmountLimits();

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
    messageEl.classList.remove('hidden', 'success', 'error', 'info');
    if (isSuccess === true) messageEl.classList.add('success');
    else if (isSuccess === false) messageEl.classList.add('error');
    else messageEl.classList.add('info');
  }
  
  destroy() {
    super.destroy();
  }
}