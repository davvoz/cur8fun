import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';

export default class PowerManagementTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handlePowerUpSubmit = this.handlePowerUpSubmit.bind(this);
    this.handlePowerDownSubmit = this.handlePowerDownSubmit.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'power-tab';
    this.element.innerHTML = `
      <div class="form-card">
        <h3>Power Up STEEM</h3>
        <form id="power-up-form">
          <div class="form-group">
            <label for="power-up-amount">Amount to Power Up</label>
            <div class="input-group">
              <input type="number" id="power-up-amount" min="0.001" step="0.001" placeholder="0.000" required>
              <div class="input-suffix">STEEM</div>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary">Power Up</button>
        </form>
      </div>
      
      <div class="form-card">
        <h3>Power Down STEEM</h3>
        <form id="power-down-form">
          <div class="form-group">
            <label for="power-down-amount">Amount to Power Down</label>
            <div class="input-group">
              <input type="number" id="power-down-amount" min="0.001" step="0.001" placeholder="0.000" required>
              <div class="input-suffix">SP</div>
            </div>
          </div>
          
          <p class="info-text">
            <span class="material-icons">info</span>
            Power downs are processed in 13 equal weekly payments
          </p>
          
          <button type="submit" class="btn btn-primary">Start Power Down</button>
        </form>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Add event listeners
    const powerUpForm = this.element.querySelector('#power-up-form');
    if (powerUpForm) {
      this.registerEventHandler(powerUpForm, 'submit', this.handlePowerUpSubmit);
    }
    
    const powerDownForm = this.element.querySelector('#power-down-form');
    if (powerDownForm) {
      this.registerEventHandler(powerDownForm, 'submit', this.handlePowerDownSubmit);
    }
    
    return this.element;
  }
  
  async handlePowerUpSubmit(e) {
    e.preventDefault();
    const amount = this.element.querySelector('#power-up-amount').value;
    alert(`Power up ${amount} STEEM would occur here`);
  }
  
  async handlePowerDownSubmit(e) {
    e.preventDefault();
    const amount = this.element.querySelector('#power-down-amount').value;
    alert(`Power down ${amount} SP would occur here`);
  }
}