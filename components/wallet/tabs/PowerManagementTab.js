import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';
import DialogUtility from '../../DialogUtility.js';

export default class PowerManagementTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handlePowerUpSubmit = this.handlePowerUpSubmit.bind(this);
    this.handlePowerDownSubmit = this.handlePowerDownSubmit.bind(this);
    this.handleStopPowerDown = this.handleStopPowerDown.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
    this.viewedUsername = options.username || this.currentUser;
    this.powerDownInfo = null;
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'power-tab';
    
    // Create power up card
    const powerUpCard = this.createPowerUpCard();
    this.element.appendChild(powerUpCard);
    
    // Create power down card
    const powerDownCard = this.createPowerDownCard();
    this.element.appendChild(powerDownCard);
    
    this.parentElement.appendChild(this.element);

    // Async: set max on both amount inputs
    this._initAmountLimits();
    
    // Load power down status
    this.loadPowerDownStatus();

    // Gate active-key operations if only posting key is available
    this._applyActiveKeyGate();
    
    return this.element;
  }
  
  async _initAmountLimits() {
    try {
      const balances = await walletService.fetchBalances();
      // Power Up: max = liquid STEEM
      const puInput = this.element?.querySelector('#power-up-amount');
      const puHint = this.element?.querySelector('#power-up-amount-hint');
      const steemMax = parseFloat(balances.steem || 0);
      if (puInput && !isNaN(steemMax)) {
        puInput.max = steemMax.toFixed(3);
        if (puHint) { puHint.textContent = `Available: ${steemMax.toFixed(3)} STEEM`; puHint.className = 'amount-hint'; }
      }
      // Power Down: max = own SP
      const pdInput = this.element?.querySelector('#power-down-amount');
      const pdHint = this.element?.querySelector('#power-down-amount-hint');
      const spMax = parseFloat(balances.steemPowerDetails?.own ?? balances.steemPower ?? 0);
      if (pdInput && !isNaN(spMax)) {
        pdInput.max = spMax.toFixed(3);
        if (pdHint) { pdHint.textContent = `Available: ${spMax.toFixed(3)} SP`; pdHint.className = 'amount-hint'; }
      }
    } catch { /* non-blocking */ }
  }

  createPowerUpCard() {
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    // Add heading
    const heading = document.createElement('h3');
    heading.textContent = 'Power Up STEEM';
    formCard.appendChild(heading);
    
    // Create description
    const description = document.createElement('p');
    description.className = 'power-description';
    description.textContent = 'Convert your liquid STEEM to STEEM POWER for increased influence and curation rewards';
    formCard.appendChild(description);
    
    // Create form
    const form = document.createElement('form');
    form.id = 'power-up-form';
    this.registerEventHandler(form, 'submit', this.handlePowerUpSubmit);
    
    // Amount group
    const amountGroup = document.createElement('div');
    amountGroup.className = 'form-group';
    
    const amountLabelRowPU = document.createElement('div');
    amountLabelRowPU.className = 'label-row';
    const amountLabel = document.createElement('label');
    amountLabel.setAttribute('for', 'power-up-amount');
    amountLabel.textContent = 'Amount to Power Up';
    amountLabelRowPU.appendChild(amountLabel);
    const maxSteemBtn = document.createElement('button');
    maxSteemBtn.type = 'button';
    maxSteemBtn.className = 'max-btn';
    maxSteemBtn.textContent = 'Max';
    this.registerEventHandler(maxSteemBtn, 'click', () => {
      // Use cached balances instantly
      const cached = walletService.balances;
      if (cached) {
        const max = parseFloat(cached.steem);
        const input = this.element.querySelector('#power-up-amount');
        const hint = this.element.querySelector('#power-up-amount-hint');
        input.value = max.toFixed(3);
        input.max = max.toFixed(3);
        if (hint) { hint.textContent = `Available: ${max.toFixed(3)} STEEM`; hint.className = 'amount-hint'; }
        const btn = this.element?.querySelector('#power-up-form button[type="submit"]');
        if (btn) btn.disabled = false;
      }
      // Refresh in background
      walletService.fetchBalances().then(b => {
        const max = parseFloat(b.steem);
        const input = this.element?.querySelector('#power-up-amount');
        const hint = this.element?.querySelector('#power-up-amount-hint');
        if (input) { input.max = max.toFixed(3); }
        if (hint) { hint.textContent = `Available: ${max.toFixed(3)} STEEM`; hint.className = 'amount-hint'; }
      }).catch(() => {});
    });
    amountLabelRowPU.appendChild(maxSteemBtn);
    amountGroup.appendChild(amountLabelRowPU);
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.id = 'power-up-amount';
    amountInput.min = '0.001';
    amountInput.step = '0.001';
    amountInput.placeholder = '0.000';
    amountInput.required = true;
    inputGroup.appendChild(amountInput);
    
    const currencyLabel = document.createElement('div');
    currencyLabel.className = 'input-suffix';
    currencyLabel.textContent = 'STEEM';
    inputGroup.appendChild(currencyLabel);
    
    // Live validation + 3 decimal cap (locale-safe: handles both . and ,)
    this.registerEventHandler(amountInput, 'input', (e) => {
      const num = e.target.valueAsNumber;
      if (!isNaN(num)) {
        const truncated = Math.round(num * 1000) / 1000;
        if (num !== truncated) e.target.valueAsNumber = truncated;
      }
      const hint = amountGroup.querySelector('#power-up-amount-hint');
      const max = parseFloat(amountInput.max);
      const val = amountInput.valueAsNumber;
      const btn = this.element?.querySelector('#power-up-form button[type="submit"]');
      if (!isNaN(val) && !isNaN(max) && val > max) {
        hint.textContent = `Available: ${max.toFixed(3)} STEEM`;
        hint.className = 'amount-hint invalid';
        if (btn) btn.disabled = true;
      } else {
        hint.textContent = !isNaN(max) ? `Available: ${max.toFixed(3)} STEEM` : '';
        hint.className = 'amount-hint';
        if (btn) btn.disabled = false;
      }
    });

    amountGroup.appendChild(inputGroup);

    const puHint = document.createElement('small');
    puHint.id = 'power-up-amount-hint';
    puHint.className = 'amount-hint';
    amountGroup.appendChild(puHint);

    form.appendChild(amountGroup);
    
    // Message container
    const messageEl = document.createElement('div');
    messageEl.id = 'power-up-message';
    messageEl.className = 'message hidden';
    form.appendChild(messageEl);
    
    // Button with icon
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary with-icon';
    
    const btnIcon = document.createElement('span');
    btnIcon.className = 'material-icons';
    btnIcon.textContent = 'arrow_upward';
    submitBtn.appendChild(btnIcon);
    
    const btnText = document.createElement('span');
    btnText.textContent = 'Power Up';
    submitBtn.appendChild(btnText);
    
    form.appendChild(submitBtn);
    formCard.appendChild(form);
    
    return formCard;
  }
  
  createPowerDownCard() {
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    // Add heading
    const heading = document.createElement('h3');
    heading.textContent = 'Power Down STEEM';
    formCard.appendChild(heading);
    
    // Create description
    const description = document.createElement('p');
    description.className = 'power-description';
    description.textContent = 'Convert your STEEM POWER back to liquid STEEM in equal weekly payments over 4 weeks';
    formCard.appendChild(description);
    
    // Create status container
    const statusContainer = document.createElement('div');
    statusContainer.id = 'power-down-status';
    statusContainer.className = 'power-down-status';
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading power down status...';
    statusContainer.appendChild(loadingIndicator);
    
    formCard.appendChild(statusContainer);
    
    // Create form
    const form = document.createElement('form');
    form.id = 'power-down-form';
    this.registerEventHandler(form, 'submit', this.handlePowerDownSubmit);
    
    // Amount group
    const amountGroup = document.createElement('div');
    amountGroup.className = 'form-group';
    
    const amountLabelRowPD = document.createElement('div');
    amountLabelRowPD.className = 'label-row';
    const amountLabel2 = document.createElement('label');
    amountLabel2.setAttribute('for', 'power-down-amount');
    amountLabel2.textContent = 'Amount to Power Down';
    amountLabelRowPD.appendChild(amountLabel2);
    const maxSpBtnPD = document.createElement('button');
    maxSpBtnPD.type = 'button';
    maxSpBtnPD.className = 'max-btn';
    maxSpBtnPD.textContent = 'Max';
    this.registerEventHandler(maxSpBtnPD, 'click', () => {
      // Use cached balances instantly
      const cached = walletService.balances;
      if (cached) {
        const rawMax = cached.steemPowerDetails?.own ?? cached.steemPower ?? '0.000';
        const max = parseFloat(rawMax);
        const input = this.element.querySelector('#power-down-amount');
        const hint = this.element.querySelector('#power-down-amount-hint');
        input.value = max.toFixed(3);
        input.max = max.toFixed(3);
        if (hint) { hint.textContent = `Available: ${max.toFixed(3)} SP`; hint.className = 'amount-hint'; }
        const btn = this.element?.querySelector('#power-down-form button[type="submit"]');
        if (btn) btn.disabled = false;
      }
      // Refresh in background
      walletService.fetchBalances().then(b => {
        const rawMax = b.steemPowerDetails?.own ?? b.steemPower ?? '0.000';
        const max = parseFloat(rawMax);
        const input = this.element?.querySelector('#power-down-amount');
        const hint = this.element?.querySelector('#power-down-amount-hint');
        if (input) { input.max = max.toFixed(3); }
        if (hint) { hint.textContent = `Available: ${max.toFixed(3)} SP`; hint.className = 'amount-hint'; }
      }).catch(() => {});
    });
    amountLabelRowPD.appendChild(maxSpBtnPD);
    amountGroup.appendChild(amountLabelRowPD);
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.id = 'power-down-amount';
    amountInput.min = '0.001';
    amountInput.step = '0.001';
    amountInput.placeholder = '0.000';
    amountInput.required = true;
    inputGroup.appendChild(amountInput);
    
    const currencyLabel2 = document.createElement('div');
    currencyLabel2.className = 'input-suffix';
    currencyLabel2.textContent = 'SP';
    inputGroup.appendChild(currencyLabel2);

    // Live validation + 3 decimal cap (locale-safe: handles both . and ,)
    this.registerEventHandler(amountInput, 'input', (e) => {
      const num = e.target.valueAsNumber;
      if (!isNaN(num)) {
        const truncated = Math.round(num * 1000) / 1000;
        if (num !== truncated) e.target.valueAsNumber = truncated;
      }
      const hint = amountGroup.querySelector('#power-down-amount-hint');
      const max = parseFloat(amountInput.max);
      const val = amountInput.valueAsNumber;
      const btn = this.element?.querySelector('#power-down-form button[type="submit"]');
      if (!isNaN(val) && !isNaN(max) && val > max) {
        hint.textContent = `Available: ${max.toFixed(3)} SP`;
        hint.className = 'amount-hint invalid';
        if (btn) btn.disabled = true;
      } else {
        hint.textContent = !isNaN(max) ? `Available: ${max.toFixed(3)} SP` : '';
        hint.className = 'amount-hint';
        if (btn) btn.disabled = false;
      }
    });

    amountGroup.appendChild(inputGroup);

    const pdHint = document.createElement('small');
    pdHint.id = 'power-down-amount-hint';
    pdHint.className = 'amount-hint';
    amountGroup.appendChild(pdHint);

    form.appendChild(amountGroup);
    const infoText = document.createElement('p');
    infoText.className = 'info-text';
    
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons';
    infoIcon.textContent = 'info';
    infoText.appendChild(infoIcon);
    
    const infoContent = document.createTextNode('Power downs are processed in 4 equal weekly payments');
    infoText.appendChild(infoContent);
    
    form.appendChild(infoText);
    
    // Message container
    const messageEl = document.createElement('div');
    messageEl.id = 'power-down-message';
    messageEl.className = 'message hidden';
    form.appendChild(messageEl);
    
    // Button with icon
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary with-icon';
    
    const btnIcon = document.createElement('span');
    btnIcon.className = 'material-icons';
    btnIcon.textContent = 'arrow_downward';
    submitBtn.appendChild(btnIcon);
    
    const btnText = document.createElement('span');
    btnText.textContent = 'Start Power Down';
    submitBtn.appendChild(btnText);
    
    form.appendChild(submitBtn);
    formCard.appendChild(form);
    
    return formCard;
  }
  
  async loadPowerDownStatus() {
    const statusContainer = this.element.querySelector('#power-down-status');
    if (!statusContainer) return;
    
    try {
      // Clear the container first
      while (statusContainer.firstChild) {
        statusContainer.removeChild(statusContainer.firstChild);
      }
      
      // Get power down information from service
      this.powerDownInfo = await walletService.getPowerDownInfo(this.viewedUsername);
      
      if (this.powerDownInfo.isPoweringDown) {
        this.createActivePowerDownUI(statusContainer);
      } else {
        this.createNoPowerDownUI(statusContainer);
      }
    } catch (error) {
      console.error('Error loading power down status:', error);
      
      // Create error UI
      const errorState = document.createElement('div');
      errorState.className = 'error-state';
      errorState.textContent = 'Failed to load power down status';
      
      // Clear the container first
      while (statusContainer.firstChild) {
        statusContainer.removeChild(statusContainer.firstChild);
      }
      
      statusContainer.appendChild(errorState);
    }
  }
  
  createActivePowerDownUI(container) {
    const activePowerDown = document.createElement('div');
    activePowerDown.className = 'active-power-down';
    
    // Create status header
    const statusHeader = document.createElement('div');
    statusHeader.className = 'status-header';
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator active';
    statusHeader.appendChild(statusIndicator);
    
    const statusTitle = document.createElement('h4');
    statusTitle.className = 'status-title';
    statusTitle.textContent = 'Power Down Active';
    statusHeader.appendChild(statusTitle);
    
    activePowerDown.appendChild(statusHeader);
    
    // Create status details
    const statusItems = [
      { label: 'Weekly rate', value: `${this.powerDownInfo.weeklyRate} SP` },
      { label: 'Next payment', value: new Date(this.powerDownInfo.nextPowerDown).toLocaleDateString() }
    ];
    
    statusItems.forEach(item => {
      const statusItem = document.createElement('div');
      statusItem.className = 'status-item';
      
      const label = document.createElement('span');
      label.className = 'status-label';
      label.textContent = item.label + ':';
      statusItem.appendChild(label);
      
      const value = document.createElement('span');
      value.className = 'status-value';
      value.textContent = item.value;
      statusItem.appendChild(value);
      
      activePowerDown.appendChild(statusItem);
    });
    
    // Add progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressLabel = document.createElement('div');
    progressLabel.className = 'progress-label';
    progressLabel.textContent = 'Progress';
    progressContainer.appendChild(progressLabel);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    // Use 4 weeks instead of 13
    const totalWeeks = 4;
    const remainingWeeks = Math.min(this.powerDownInfo.remainingWeeks, totalWeeks);
    const completedWeeks = totalWeeks - remainingWeeks;
    const progressPercent = (completedWeeks / totalWeeks) * 100;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${progressPercent}%`;
    progressBar.appendChild(progressFill);
    
    progressContainer.appendChild(progressBar);
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.textContent = `${completedWeeks} of ${totalWeeks} weeks completed`;
    progressContainer.appendChild(progressText);
    
    activePowerDown.appendChild(progressContainer);
    
    // Add stop button
    const stopButtonContainer = document.createElement('div');
    stopButtonContainer.className = 'button-container';
    
    const stopButton = document.createElement('button');
    stopButton.id = 'stop-power-down';
    stopButton.className = 'btn btn-danger with-icon';

    const hasActive = authService.hasActiveKeyAccess();
    if (!hasActive) {
      stopButton.disabled = true;
      stopButton.title = 'Unlock wallet to stop power down';
    }
    
    const stopIcon = document.createElement('span');
    stopIcon.className = 'material-icons';
    stopIcon.textContent = 'cancel';
    stopButton.appendChild(stopIcon);
    
    const stopText = document.createElement('span');
    stopText.textContent = 'Stop Power Down';
    stopButton.appendChild(stopText);
    
    this.registerEventHandler(stopButton, 'click', this.handleStopPowerDown);
    
    stopButtonContainer.appendChild(stopButton);
    activePowerDown.appendChild(stopButtonContainer);
    
    // Clear container and append our new content
    container.appendChild(activePowerDown);
  }
  
  createNoPowerDownUI(container) {
    const noPowerDown = document.createElement('div');
    noPowerDown.className = 'no-power-down';
    
    // Create status header
    const statusHeader = document.createElement('div');
    statusHeader.className = 'status-header';
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator inactive';
    statusHeader.appendChild(statusIndicator);
    
    const statusTitle = document.createElement('h4');
    statusTitle.className = 'status-title';
    statusTitle.textContent = 'No Active Power Down';
    statusHeader.appendChild(statusTitle);
    
    noPowerDown.appendChild(statusHeader);
    
    container.appendChild(noPowerDown);
  }
  
  async handlePowerUpSubmit(e) {
    e.preventDefault();
    
    const amountInput = this.element.querySelector('#power-up-amount');
    let amount = amountInput.value;
    const messageEl = this.element.querySelector('#power-up-message');
    
    // Clear previous messages
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('success', 'error');
    
    if (!amount) {
      this.showMessage('Please enter an amount', false, messageEl);
      return;
    }
    
    // Format amount as string with 3 decimal places
    try {
      amount = parseFloat(amount).toFixed(3);
    } catch (error) {
      this.showMessage('Invalid amount format', false, messageEl);
      return;
    }
    
    // Pre-flight: STEEM balance check (fetch fresh data)
    this.showMessage('Checking balance…', null, messageEl);
    const freshBalancesPU = await walletService.fetchBalances();
    const steemBalance = parseFloat(freshBalancesPU.steem || 0);
    if (!isNaN(steemBalance) && parseFloat(amount) > steemBalance) {
      this.showMessage(
        `Insufficient STEEM balance. Available: ${steemBalance.toFixed(3)} STEEM`,
        false, messageEl
      );
      return;
    }

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      
      // Store original button content
      const originalBtnContent = submitBtn.innerHTML;
      
      // Replace with loading state
      const spinner = document.createElement('div');
      spinner.className = 'button-spinner';
      submitBtn.innerHTML = '';
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(document.createTextNode(' Processing...'));
      
      // Call the wallet service to process the power up
      const response = await walletService.powerUp(amount);
      
      if (response.success) {
        eventEmitter.emit('notification', { type: 'success', message: `Power up of ${amount} STEEM completed!` });
        amountInput.value = '';

        // Refresh balances and amount limits immediately
        this._initAmountLimits();
      } else {
        eventEmitter.emit('notification', { type: 'error', message: `Power up failed: ${response.message || 'Unknown error'}` });
      }
      
      // Restore original button content
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Power up error:', error);
      eventEmitter.emit('notification', { type: 'error', message: `Power up error: ${error.message || 'Unknown error'}` });
      
      // Reset button
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const btnIcon = document.createElement('span');
      btnIcon.className = 'material-icons';
      btnIcon.textContent = 'arrow_upward';
      
      const btnText = document.createElement('span');
      btnText.textContent = 'Power Up';
      
      submitBtn.innerHTML = '';
      submitBtn.appendChild(btnIcon);
      submitBtn.appendChild(btnText);
      submitBtn.disabled = false;
    }
  }
  
  async handlePowerDownSubmit(e) {
    e.preventDefault();
    
    const amountInput = this.element.querySelector('#power-down-amount');
    let amount = amountInput.value;
    const messageEl = this.element.querySelector('#power-down-message');
    
    // Clear previous messages
    messageEl.textContent = '';
    messageEl.classList.add('hidden');
    messageEl.classList.remove('success', 'error');
    
    if (!amount) {
      this.showMessage('Please enter an amount', false, messageEl);
      return;
    }
    
    // Format amount as string with 3 decimal places
    try {
      amount = parseFloat(amount).toFixed(3);
    } catch (error) {
      this.showMessage('Invalid amount format', false, messageEl);
      return;
    }
    
    // Pre-flight: own SP balance check (fetch fresh data)
    this.showMessage('Checking balance…', null, messageEl);
    const freshBalancesPD = await walletService.fetchBalances();
    const ownSP = parseFloat(
      freshBalancesPD.steemPowerDetails?.own ?? freshBalancesPD.steemPower ?? 0
    );
    if (!isNaN(ownSP) && parseFloat(amount) > ownSP) {
      this.showMessage(
        `Insufficient STEEM POWER. Available to power down: ${ownSP.toFixed(3)} SP`,
        false, messageEl
      );
      return;
    }

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      
      // Store original button content
      const originalBtnContent = submitBtn.innerHTML;
      
      // Replace with loading state
      const spinner = document.createElement('div');
      spinner.className = 'button-spinner';
      submitBtn.innerHTML = '';
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(document.createTextNode(' Processing...'));
      
      // Call the wallet service to process the power down
      const response = await walletService.powerDown(amount);
      
      if (response.success) {
        eventEmitter.emit('notification', { type: 'success', message: `Power down of ${amount} SP initiated!` });
        amountInput.value = '';

        // Refresh balances, amount limits and power-down status immediately
        this._initAmountLimits();
        this.loadPowerDownStatus();
      } else {
        eventEmitter.emit('notification', { type: 'error', message: `Power down failed: ${response.message || 'Unknown error'}` });
      }
      
      // Restore original button content
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Power down error:', error);
      eventEmitter.emit('notification', { type: 'error', message: `Power down error: ${error.message || 'Unknown error'}` });
      
      // Reset button
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const btnIcon = document.createElement('span');
      btnIcon.className = 'material-icons';
      btnIcon.textContent = 'arrow_downward';
      
      const btnText = document.createElement('span');
      btnText.textContent = 'Start Power Down';
      
      submitBtn.innerHTML = '';
      submitBtn.appendChild(btnIcon);
      submitBtn.appendChild(btnText);
      submitBtn.disabled = false;
    }
  }
  
  async handleStopPowerDown(e) {
    const confirmed = await DialogUtility.showConfirmationDialog({
      title: 'Stop Power Down',
      message: 'Stop the current power down?',
      confirmText: 'Stop',
      cancelText: 'Cancel',
      icon: 'cancel',
      type: 'warning',
      compact: true
    });
    if (!confirmed) return;
    
    e.target.disabled = true;
    
    // Store original button content
    const originalBtnContent = e.target.innerHTML;
    
    // Replace with loading state
    const spinner = document.createElement('div');
    spinner.className = 'button-spinner';
    e.target.innerHTML = '';
    e.target.appendChild(spinner);
    e.target.appendChild(document.createTextNode(' Processing...'));
    
    try {
      // Use the cancelPowerDown method from wallet service
      const response = await walletService.cancelPowerDown();
      
      if (response.success) {
        eventEmitter.emit('notification', { type: 'success', message: 'Power down stopped successfully!' });
        // Refresh balances, amount limits and power-down status immediately
        this._initAmountLimits();
        this.loadPowerDownStatus();
      } else {
        eventEmitter.emit('notification', { type: 'error', message: `Failed to stop power down: ${response.message || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Stop power down error:', error);
      eventEmitter.emit('notification', { type: 'error', message: `Stop power down error: ${error.message || 'Unknown error'}` });
    } finally {
      // Reset button 
      const btnIcon = document.createElement('span');
      btnIcon.className = 'material-icons';
      btnIcon.textContent = 'cancel';
      
      const btnText = document.createElement('span');
      btnText.textContent = 'Stop Power Down';
      
      e.target.innerHTML = '';
      e.target.appendChild(btnIcon);
      e.target.appendChild(btnText);
      e.target.disabled = false;
    }
  }
  
  showMessage(message, isSuccess, element) {
    element.textContent = message;
    element.classList.remove('hidden', 'success', 'error', 'info');
    if (isSuccess === true) element.classList.add('success');
    else if (isSuccess === false) element.classList.add('error');
    else element.classList.add('info');
  }
  
  destroy() {
    super.destroy();
  }
}