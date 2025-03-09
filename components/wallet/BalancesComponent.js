import Component from '../Component.js';
import eventEmitter from '../../utils/EventEmitter.js';

export default class BalancesComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleBalanceUpdate = this.handleBalanceUpdate.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'balances-grid';
    this.element.innerHTML = `
      <div class="balance-card">
        <div class="balance-type">
          <span class="material-icons">payments</span> STEEM
        </div>
        <div class="balance-value" id="steem-balance">0.000</div>
        <div class="balance-usd" id="steem-usd">$0.00</div>
      </div>
      
      <div class="balance-card">
        <div class="balance-type">
          <span class="material-icons">power</span> STEEM POWER
        </div>
        <div class="balance-value" id="sp-balance">0.000</div>
        <div class="balance-usd" id="sp-usd">$0.00</div>
      </div>
      
      <div class="balance-card">
        <div class="balance-type">
          <span class="material-icons">savings</span> STEEM DOLLARS
        </div>
        <div class="balance-value" id="sbd-balance">0.000</div>
        <div class="balance-usd" id="sbd-usd">$0.00</div>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Subscribe to balance updates
    eventEmitter.on('wallet:balances-updated', this.handleBalanceUpdate);
    
    return this.element;
  }
  
  handleBalanceUpdate(balances) {
    if (!this.element) return;
    
    this.element.querySelector('#steem-balance').textContent = balances.steem;
    this.element.querySelector('#sp-balance').textContent = balances.steemPower;
    this.element.querySelector('#sbd-balance').textContent = balances.sbd;
    
    // Update USD values if price data is available
    if (balances.prices) {
      this.element.querySelector('#steem-usd').textContent = 
        `$${(balances.steem * balances.prices.steem).toFixed(2)}`;
      this.element.querySelector('#sp-usd').textContent = 
        `$${(balances.steemPower * balances.prices.steem).toFixed(2)}`;
      this.element.querySelector('#sbd-usd').textContent = 
        `$${(balances.sbd * balances.prices.sbd).toFixed(2)}`;
    }
  }
  
  destroy() {
    eventEmitter.off('wallet:balances-updated', this.handleBalanceUpdate);
    super.destroy();
  }
}