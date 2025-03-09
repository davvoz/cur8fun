import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';

export default class PowerManagementTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handlePowerUpSubmit = this.handlePowerUpSubmit.bind(this);
    this.handlePowerDownSubmit = this.handlePowerDownSubmit.bind(this);
    this.handleStopPowerDown = this.handleStopPowerDown.bind(this);
    this.currentUser = authService.getCurrentUser()?.username;
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
    
    // Load power down status
    this.loadPowerDownStatus();
    
    return this.element;
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
    
    const amountLabel = document.createElement('label');
    amountLabel.setAttribute('for', 'power-up-amount');
    amountLabel.textContent = 'Amount to Power Up';
    amountGroup.appendChild(amountLabel);
    
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
    
    amountGroup.appendChild(inputGroup);
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
    
    const amountLabel = document.createElement('label');
    amountLabel.setAttribute('for', 'power-down-amount');
    amountLabel.textContent = 'Amount to Power Down';
    amountGroup.appendChild(amountLabel);
    
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
    
    const currencyLabel = document.createElement('div');
    currencyLabel.className = 'input-suffix';
    currencyLabel.textContent = 'SP';
    inputGroup.appendChild(currencyLabel);
    
    amountGroup.appendChild(inputGroup);
    form.appendChild(amountGroup);
    
    // Info text with icon
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
      this.powerDownInfo = await walletService.getPowerDownInfo();
      
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
      { label: 'Next payment', value: new Date(this.powerDownInfo.nextPowerDown).toLocaleDateString() },
      { label: 'Remaining payments', value: this.powerDownInfo.remainingWeeks }
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
    
    // Check if Keychain is installed
    if (typeof window.steem_keychain === 'undefined') {
      this.showMessage('Steem Keychain extension is not installed. Please install it to use this feature.', false, messageEl);
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
        this.showMessage('Power up successful!', true, messageEl);
        amountInput.value = '';
        
        // Update balances
        walletService.updateBalances();
      } else {
        this.showMessage(`Power up failed: ${response.message || 'Unknown error'}`, false, messageEl);
      }
      
      // Restore original button content
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Power up error:', error);
      this.showMessage(`Error: ${error.message || 'Unknown error'}`, false, messageEl);
      
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
    
    // Check if Keychain is installed
    if (typeof window.steem_keychain === 'undefined') {
      this.showMessage('Steem Keychain extension is not installed. Please install it to use this feature.', false, messageEl);
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
        this.showMessage('Power down initiated successfully!', true, messageEl);
        amountInput.value = '';
        
        // Update balances and power down status
        walletService.updateBalances();
        this.loadPowerDownStatus();
      } else {
        this.showMessage(`Power down failed: ${response.message || 'Unknown error'}`, false, messageEl);
      }
      
      // Restore original button content
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Power down error:', error);
      this.showMessage(`Error: ${error.message || 'Unknown error'}`, false, messageEl);
      
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
    if (!confirm('Are you sure you want to stop your current power down?')) {
      return;
    }
    
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
        // Show success message
        const messageEl = this.element.querySelector('#power-down-message');
        this.showMessage('Power down stopped successfully!', true, messageEl);
        
        // Update balances and power down status
        walletService.updateBalances();
        this.loadPowerDownStatus();
      } else {
        const messageEl = this.element.querySelector('#power-down-message');
        this.showMessage(`Failed to stop power down: ${response.message}`, false, messageEl);
      }
    } catch (error) {
      console.error('Stop power down error:', error);
      const messageEl = this.element.querySelector('#power-down-message');
      this.showMessage(`Error: ${error.message || 'Unknown error'}`, false, messageEl);
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
    element.classList.remove('hidden', 'success', 'error');
    element.classList.add(isSuccess ? 'success' : 'error');
  }
  
  destroy() {
    super.destroy();
  }
}