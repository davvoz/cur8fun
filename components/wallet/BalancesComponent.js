import Component from '../Component.js';
import eventEmitter from '../../utils/EventEmitter.js';

export default class BalancesComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleBalanceUpdate = this.handleBalanceUpdate.bind(this);
    
    // Store references to elements that will be updated
    this.balanceElements = {
      steem: { balance: null, usd: null },
      steemPower: { balance: null, usd: null },
      sbd: { balance: null, usd: null }
    };
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'balances-grid';
    
    // Create STEEM balance card
    const steemCard = this.createBalanceCard(
      'payments',
      'STEEM',
      'steem-balance',
      'steem-usd'
    );
    this.balanceElements.steem.balance = steemCard.balanceValue;
    this.balanceElements.steem.usd = steemCard.usdValue;
    this.element.appendChild(steemCard.card);
    
    // Create STEEM POWER balance card
    const spCard = this.createBalanceCard(
      'power',
      'STEEM POWER',
      'sp-balance',
      'sp-usd'
    );
    this.balanceElements.steemPower.balance = spCard.balanceValue;
    this.balanceElements.steemPower.usd = spCard.usdValue;
    this.element.appendChild(spCard.card);
    
    // Create STEEM DOLLARS balance card
    const sbdCard = this.createBalanceCard(
      'savings',
      'STEEM DOLLARS',
      'sbd-balance',
      'sbd-usd'
    );
    this.balanceElements.sbd.balance = sbdCard.balanceValue;
    this.balanceElements.sbd.usd = sbdCard.usdValue;
    this.element.appendChild(sbdCard.card);
    
    this.parentElement.appendChild(this.element);
    
    // Subscribe to balance updates
    eventEmitter.on('wallet:balances-updated', this.handleBalanceUpdate);
    
    return this.element;
  }
  
  handleBalanceUpdate(balances) {
    if (!this.element) return;
    
    this.balanceElements.steem.balance.textContent = balances.steem;
    this.balanceElements.steemPower.balance.textContent = balances.steemPower;
    this.balanceElements.sbd.balance.textContent = balances.sbd;
    
    // Update USD values if price data is available
    if (balances.prices) {
      this.balanceElements.steem.usd.textContent = 
        `$${(balances.steem * balances.prices.steem).toFixed(2)}`;
      this.balanceElements.steemPower.usd.textContent = 
        `$${(balances.steemPower * balances.prices.steem).toFixed(2)}`;
      this.balanceElements.sbd.usd.textContent = 
        `$${(balances.sbd * balances.prices.sbd).toFixed(2)}`;
    }
  }
  
  destroy() {
    eventEmitter.off('wallet:balances-updated', this.handleBalanceUpdate);
    super.destroy();
  }
  
  createBalanceCard(icon, label, balanceId, usdId) {
    const card = document.createElement('div');
    card.className = 'balance-card';
    
    const balanceType = document.createElement('div');
    balanceType.className = 'balance-type';
    balanceType.innerHTML = `<span class="material-icons">${icon}</span> ${label}`;
    card.appendChild(balanceType);
    
    const balanceValue = document.createElement('div');
    balanceValue.className = 'balance-value';
    balanceValue.id = balanceId;
    balanceValue.textContent = '0.000';
    card.appendChild(balanceValue);
    
    const usdValue = document.createElement('div');
    usdValue.className = 'balance-usd';
    usdValue.id = usdId;
    usdValue.textContent = '$0.00';
    card.appendChild(usdValue);
    
    return { card, balanceValue, usdValue };
  }
}