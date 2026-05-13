import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';
import DialogUtility from '../../DialogUtility.js';

export default class DelegationTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleDelegateSubmit = this.handleDelegateSubmit.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
    this.viewedUsername = options.username || this.currentUser;
    this.delegations = [];
    this._delegateeValid = true;
    this._amountValid = true;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'delegate-tab';
    
    // Create form section
    const formCard = this.createFormSection();
    
    // Create delegations section
    const delegationsContainer = this.createDelegationsSection();

    // Create expiring delegations section
    const expiringContainer = this.createExpiringSection();

    // Wrap the two list cards side-by-side on desktop
    const listsRow = document.createElement('div');
    listsRow.className = 'delegation-lists-row';
    listsRow.appendChild(delegationsContainer);
    listsRow.appendChild(expiringContainer);

    // Append sections to main element
    this.element.appendChild(formCard);
    this.element.appendChild(listsRow);

    this.parentElement.appendChild(this.element);

    // Async: set max on SP input
    this._initAmountLimits();

    // Load delegations
    this.loadDelegations();
    this.loadExpiringDelegations();

    // Gate active-key operations if only posting key is available
    this._applyActiveKeyGate();

    return this.element;
  }
  
  _updateSubmitState() {
    const btn = this.element?.querySelector('button[type="submit"]');
    if (btn) btn.disabled = !this._delegateeValid || !this._amountValid;
  }

  async _initAmountLimits() {
    try {
      const balances = await walletService.fetchBalances();
      const input = this.element?.querySelector('#delegate-amount');
      const hint = this.element?.querySelector('#delegate-amount-hint');
      if (!input) return;
      const details = balances.steemPowerDetails;
      const max = parseFloat(details?.delegatable ?? details?.own ?? balances.steemPower ?? 0);
      const powerDown = parseFloat(details?.powerDown ?? 0);
      if (!isNaN(max)) {
        input.max = max.toFixed(3);
        input.dataset.powerDown = powerDown.toFixed(3);
        hint.textContent = powerDown > 0
          ? `Available: ${max.toFixed(3)} SP (${powerDown.toFixed(3)} SP in power-down)`
          : `Available: ${max.toFixed(3)} SP`;
        hint.className = 'amount-hint';
      }
    } catch { /* non-blocking */ }
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
    
    // Force lowercase + reset state while typing
    this.registerEventHandler(toInput, 'input', (e) => {
      const cursorPos = e.target.selectionStart;
      e.target.value = e.target.value.toLowerCase();
      e.target.setSelectionRange(cursorPos, cursorPos);
      const hint = toGroup.querySelector('.username-hint');
      if (hint) { hint.textContent = ''; hint.className = 'username-hint'; }
      this._delegateeValid = true;
      this._updateSubmitState();
    });

    // Live validation on blur
    const delegateHint = document.createElement('small');
    delegateHint.className = 'username-hint';
    this.registerEventHandler(toInput, 'blur', async (e) => {
      const val = e.target.value.trim();
      if (!val) {
        delegateHint.textContent = ''; delegateHint.className = 'username-hint';
        this._delegateeValid = true;
        this._updateSubmitState();
        return;
      }
      delegateHint.textContent = 'Checking...';
      delegateHint.className = 'username-hint';
      const exists = await walletService.validateAccountExists(val);
      if (exists) {
        delegateHint.textContent = '✓ Account found';
        delegateHint.className = 'username-hint valid';
        this._delegateeValid = true;
      } else {
        delegateHint.textContent = '✗ Account not found';
        delegateHint.className = 'username-hint invalid';
        this._delegateeValid = false;
      }
      this._updateSubmitState();
    });

    toGroup.appendChild(toInput);
    toGroup.appendChild(delegateHint);
    form.appendChild(toGroup);
    
    // Amount input group
    const amountGroup = document.createElement('div');
    amountGroup.className = 'form-group';
    const amountLabelRow = document.createElement('div');
    amountLabelRow.className = 'label-row';
    const amountLabel = document.createElement('label');
    amountLabel.textContent = 'Amount';
    amountLabelRow.appendChild(amountLabel);
    const maxSpBtn = document.createElement('button');
    maxSpBtn.type = 'button';
    maxSpBtn.className = 'max-btn';
    maxSpBtn.textContent = 'Max SP';
    this.registerEventHandler(maxSpBtn, 'click', () => {
      // Use cached balances instantly
      const cached = walletService.balances;
      if (cached) {
        const cd = cached.steemPowerDetails;
        const max = parseFloat(cd?.delegatable ?? cd?.own ?? cached.steemPower ?? 0);
        const powerDown = parseFloat(cd?.powerDown ?? 0);
        const input = this.element.querySelector('#delegate-amount');
        const hint = this.element.querySelector('#delegate-amount-hint');
        input.value = max.toFixed(3);
        input.max = max.toFixed(3);
        input.dataset.powerDown = powerDown.toFixed(3);
        if (hint) {
          hint.textContent = powerDown > 0
            ? `Available: ${max.toFixed(3)} SP (${powerDown.toFixed(3)} SP in power-down)`
            : `Available: ${max.toFixed(3)} SP`;
          hint.className = 'amount-hint';
        }
        this._amountValid = true;
        this._updateSubmitState();
      }
      // Refresh in background
      walletService.fetchBalances().then(b => {
        const bd = b.steemPowerDetails;
        const max = parseFloat(bd?.delegatable ?? bd?.own ?? b.steemPower ?? 0);
        const powerDown = parseFloat(bd?.powerDown ?? 0);
        const input = this.element?.querySelector('#delegate-amount');
        const hint = this.element?.querySelector('#delegate-amount-hint');
        if (input) { input.max = max.toFixed(3); input.dataset.powerDown = powerDown.toFixed(3); }
        if (hint) {
          hint.textContent = powerDown > 0
            ? `Available: ${max.toFixed(3)} SP (${powerDown.toFixed(3)} SP in power-down)`
            : `Available: ${max.toFixed(3)} SP`;
          hint.className = 'amount-hint';
        }
      }).catch(() => {});
    });
    amountLabelRow.appendChild(maxSpBtn);
    amountGroup.appendChild(amountLabelRow);
    const amountContainer = document.createElement('div');
    amountContainer.className = 'input-group';
    
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.id = 'delegate-amount';
    amountInput.min = '0.001';
    amountInput.step = '0.001';
    amountInput.placeholder = '0.000';
    amountInput.required = true;

    // Live amount validation + 3 decimal cap (locale-safe: handles both . and ,)
    this.registerEventHandler(amountInput, 'input', (e) => {
      const num = e.target.valueAsNumber;
      if (!isNaN(num)) {
        const truncated = Math.round(num * 1000) / 1000;
        if (num !== truncated) e.target.valueAsNumber = truncated;
      }
      const hint = amountGroup.querySelector('#delegate-amount-hint');
      const max = parseFloat(amountInput.max);
      const val = amountInput.valueAsNumber;
      if (!isNaN(val) && !isNaN(max) && val > max) {
        hint.textContent = `Max: ${max.toFixed(3)} SP`;
        hint.className = 'amount-hint invalid';
        this._amountValid = false;
      } else {
        const pd = parseFloat(amountInput.dataset.powerDown ?? 0);
        hint.textContent = !isNaN(max)
          ? (pd > 0 ? `Available: ${max.toFixed(3)} SP (${pd.toFixed(3)} SP in power-down)` : `Available: ${max.toFixed(3)} SP`)
          : '';
        hint.className = 'amount-hint';
        this._amountValid = true;
      }
      this._updateSubmitState();
    });

    amountContainer.appendChild(amountInput);
    
    const amountSuffix = document.createElement('div');
    amountSuffix.className = 'input-suffix';
    amountSuffix.textContent = 'SP';
    amountContainer.appendChild(amountSuffix);
    
    amountGroup.appendChild(amountContainer);

    // Inline hint below the input group
    const amountHint = document.createElement('small');
    amountHint.id = 'delegate-amount-hint';
    amountHint.className = 'amount-hint';
    amountGroup.appendChild(amountHint);

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
    delegationsContainer.className = 'form-card';

    const heading = document.createElement('h4');
    heading.textContent = 'Outgoing Delegations';
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

  createExpiringSection() {
    const container = document.createElement('div');
    container.className = 'form-card';

    const heading = document.createElement('h4');
    heading.textContent = 'Returning Delegations';
    container.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'power-description';
    desc.style.marginBottom = '0';
    desc.textContent = 'Delegations removed and in the 5-day return window before SP is available again.';
    container.appendChild(desc);

    const listContainer = document.createElement('div');
    listContainer.id = 'expiring-delegations-list';
    listContainer.className = 'delegations-list';
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading...';
    listContainer.appendChild(loadingIndicator);
    container.appendChild(listContainer);

    return container;
  }

  async loadExpiringDelegations() {
    const container = this.element?.querySelector('#expiring-delegations-list');
    if (!container) return;
    try {
      const delegations = await walletService.getExpiringDelegations(this.viewedUsername);
      while (container.firstChild) container.removeChild(container.firstChild);
      if (!delegations || delegations.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No delegations currently returning.';
        container.appendChild(empty);
        return;
      }
      const table = document.createElement('table');
      table.className = 'delegations-table';
      table.innerHTML = `<thead><tr><th>Amount</th><th>Returns on</th></tr></thead>`;
      const tbody = document.createElement('tbody');
      delegations.forEach(d => {
        const tr = document.createElement('tr');
        const expiry = new Date((d.expiration || d.expiration_date || '') + 'Z').toLocaleString();
        tr.innerHTML = `<td>${d.sp_amount} SP</td><td>${expiry}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    } catch (error) {
      console.error('Failed to load expiring delegations:', error);
      while (container.firstChild) container.removeChild(container.firstChild);
      const err = document.createElement('p');
      err.className = 'error-state';
      err.textContent = 'Failed to load expiring delegations.';
      container.appendChild(err);
    }
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

    // Pre-flight: own SP balance check (fetch fresh data)
    this.showMessage('Checking balance…', null);
    const freshBalances = await walletService.fetchBalances();
    const delegatableSP = parseFloat(
      freshBalances.steemPowerDetails?.delegatable ?? freshBalances.steemPowerDetails?.own ?? freshBalances.steemPower ?? 0
    );
    if (!isNaN(delegatableSP) && parseFloat(amount) > delegatableSP) {
      this.showMessage(
        `Insufficient STEEM POWER. Available to delegate: ${delegatableSP.toFixed(3)} SP`,
        false
      );
      return;
    }

    // Pre-flight: delegatee existence
    this.showMessage('Verifying account...', null);
    const delegateeExists = await walletService.validateAccountExists(delegatee);
    if (!delegateeExists) {
      this.showMessage(`Account @${delegatee} does not exist on the Steem blockchain`, false);
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

        // Refresh balances, amount limits and delegations immediately
        this._initAmountLimits();
        this.loadDelegations();
        this.loadExpiringDelegations();
        
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
    messageEl.classList.remove('hidden', 'success', 'error', 'info');
    if (isSuccess === true) messageEl.classList.add('success');
    else if (isSuccess === false) messageEl.classList.add('error');
    else messageEl.classList.add('info');
  }
  
  async loadDelegations() {
    const container = this.element.querySelector('#delegations-list');
    if (!container) return;
    
    try {
      // Get delegations from wallet service
      this.delegations = await walletService.getDelegations(this.viewedUsername);
      
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
      const hasActive = authService.hasActiveKeyAccess();
      if (!hasActive) {
        editBtn.disabled = true;
        editBtn.title = 'Unlock wallet to edit delegation';
        removeBtn.disabled = true;
        removeBtn.title = 'Unlock wallet to remove delegation';
      }
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
    const delegateeLower = delegatee.toLowerCase();

    const confirmed = await DialogUtility.showConfirmationDialog({
      title: 'Remove Delegation',
      message: `Remove delegation to @${delegateeLower}?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      icon: 'link_off',
      type: 'warning',
      compact: true
    });
    if (!confirmed) return;

    try {
      // To remove a delegation, delegate 0 SP
      const zeroAmount = "0.000";

      const response = await walletService.delegateSteemPower(delegateeLower, zeroAmount);
      if (response.success) {
        this.showMessage(`Delegation to @${delegateeLower} successfully removed`, true);

        // Refresh balances, amount limits and delegations immediately
        this._initAmountLimits();
        this.loadDelegations();
        this.loadExpiringDelegations();

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
  
  destroy() {
    super.destroy();
  }
}