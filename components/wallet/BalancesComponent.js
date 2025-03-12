import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import eventEmitter from '../../utils/EventEmitter.js';

export default class BalancesComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000'
    };
    this.rewards = {
      steem: '0.000',
      sbd: '0.000',
      sp: '0.000'
    };
    
    this.handleBalancesUpdated = this.handleBalancesUpdated.bind(this);
    this.handleRewardClick = this.handleRewardClick.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-balances';
    
    this.element.innerHTML = `
      <div class="balances-header">
        <h2>Your Balances</h2>
        <div id="rewards-indicator" class="rewards-indicator hidden" title="You have pending rewards to claim">
          <span class="material-icons">card_giftcard</span>
        </div>
      </div>
      
      <div class="balances-grid">
        <div class="balance-card">
          <div class="balance-type">
            <span class="material-icons">attach_money</span>
            <span>STEEM</span>
          </div>
          <div class="balance-value" id="steem-balance">0.000</div>
          <div class="balance-usd" id="steem-usd">$0.00 USD</div>
        </div>
        
        <div class="balance-card">
          <div class="balance-type">
            <span class="material-icons">timeline</span>
            <span>STEEM POWER</span>
          </div>
          <div class="balance-value" id="sp-balance">0.000</div>
          <div class="balance-usd" id="sp-usd">$0.00 USD</div>
        </div>
        
        <div class="balance-card">
          <div class="balance-type">
            <span class="material-icons">local_atm</span>
            <span>STEEM DOLLARS</span>
          </div>
          <div class="balance-value" id="sbd-balance">0.000</div>
          <div class="balance-usd" id="sbd-usd">$0.00 USD</div>
        </div>
      </div>
    `;
    
    // Add reward indicator click handler
    const rewardsIndicator = this.element.querySelector('#rewards-indicator');
    if (rewardsIndicator) {
      this.registerEventHandler(rewardsIndicator, 'click', this.handleRewardClick);
    }
    
    this.parentElement.appendChild(this.element);
    
    // Listen for balance updates
    eventEmitter.on('wallet:balances-updated', this.handleBalancesUpdated);
    
    // Check for rewards when component loads
    this.checkRewards();
    
    return this.element;
  }
  
  async checkRewards() {
    try {
      this.rewards = await walletService.getAvailableRewards();
      
      // Show/hide rewards indicator
      const hasRewards = 
        parseFloat(this.rewards.steem) > 0 || 
        parseFloat(this.rewards.sbd) > 0 || 
        parseFloat(this.rewards.sp) > 0;
      
      const indicator = this.element.querySelector('#rewards-indicator');
      if (indicator) {
        indicator.classList.toggle('hidden', !hasRewards);
        
        if (hasRewards) {
          // Update the tooltip with reward details
          indicator.title = `Claim rewards: ${this.rewards.steem} STEEM, ${this.rewards.sbd} SBD, ${this.rewards.sp} SP`;
        }
      }
    } catch (error) {
      console.error('Failed to check rewards:', error);
    }
  }
  
  handleBalancesUpdated(balances) {
    this.balances = balances;
    this.updateDisplay();
    
    // Also check for rewards when balances update
    this.checkRewards();
  }
  
  updateDisplay() {
    if (!this.element) return;
    
    // Update balance values
    const steemBalance = this.element.querySelector('#steem-balance');
    const spBalance = this.element.querySelector('#sp-balance');
    const sbdBalance = this.element.querySelector('#sbd-balance');
    
    if (steemBalance) steemBalance.textContent = this.balances.steem;
    if (spBalance) spBalance.textContent = this.balances.steemPower;
    if (sbdBalance) sbdBalance.textContent = this.balances.sbd;
    
    // Update USD values (would require price feed in a real app)
    // Placeholder implementation
  }
  
  async handleRewardClick() {
    try {
      // Show confirmation dialog
      const rewardText = `${this.rewards.steem} STEEM, ${this.rewards.sbd} SBD, ${this.rewards.sp} SP`;
      const confirmed = confirm(`You are about to claim ${rewardText}. Continue?`);
      
      if (confirmed) {
        // Show loading state
        const indicator = this.element.querySelector('#rewards-indicator');
        if (indicator) {
          indicator.classList.add('loading');
          indicator.innerHTML = `<span class="material-icons spin">refresh</span>`;
        }
        
        // Claim rewards
        const result = await walletService.claimRewards();
        
        if (result && result.success) {
          // Show success notification
          eventEmitter.emit('notification', {
            type: 'success',
            message: `Successfully claimed rewards: ${rewardText}`
          });
          
          // Update balances
          await walletService.updateBalances();
          
          // Reset rewards indicator
          this.checkRewards();
        } else {
          throw new Error(result.message || 'Failed to claim rewards');
        }
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      
      // Reset indicator
      const indicator = this.element.querySelector('#rewards-indicator');
      if (indicator) {
        indicator.classList.remove('loading');
        indicator.innerHTML = `<span class="material-icons">card_giftcard</span>`;
      }
      
      // Show error notification
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to claim rewards: ${error.message}`
      });
    }
  }
  
  destroy() {
    eventEmitter.off('wallet:balances-updated', this.handleBalancesUpdated);
    super.destroy();
  }
}