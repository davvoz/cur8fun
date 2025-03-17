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
    
    // Element references
    this.steemBalanceElement = null;
    this.spBalanceElement = null;
    this.sbdBalanceElement = null;
    this.steemUsdElement = null;
    this.spUsdElement = null;
    this.sbdUsdElement = null;
    this.rewardsIndicator = null;
    
    this.handleBalancesUpdated = this.handleBalancesUpdated.bind(this);
    this.handleRewardClick = this.handleRewardClick.bind(this);
  }
  
  render() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'wallet-balances';
    
    // Create header section
    const balancesHeader = document.createElement('div');
    balancesHeader.className = 'balances-header';
    
    const heading = document.createElement('h2');
    heading.textContent = 'Your Balances';
    balancesHeader.appendChild(heading);
    
    // Create rewards indicator
    this.rewardsIndicator = document.createElement('div');
    this.rewardsIndicator.id = 'rewards-indicator';
    this.rewardsIndicator.className = 'rewards-indicator hidden';
    this.rewardsIndicator.title = 'You have pending rewards to claim';
    
    const giftIcon = document.createElement('span');
    giftIcon.className = 'material-icons';
    giftIcon.textContent = 'card_giftcard';
    this.rewardsIndicator.appendChild(giftIcon);
    
    this.registerEventHandler(this.rewardsIndicator, 'click', this.handleRewardClick);
    balancesHeader.appendChild(this.rewardsIndicator);
    
    // Add header to main element
    this.element.appendChild(balancesHeader);
    
    // Create balances grid
    const balancesGrid = document.createElement('div');
    balancesGrid.className = 'balances-grid';
    
    // Create STEEM balance card
    const steemCard = this.createBalanceCard(
      'attach_money', 'STEEM', 
      this.balances.steem, '$0.00 USD',
      'steem-balance', 'steem-usd'
    );
    balancesGrid.appendChild(steemCard);
    
    // Create STEEM POWER balance card
    const spCard = this.createBalanceCard(
      'timeline', 'STEEM POWER', 
      this.balances.steemPower, '$0.00 USD',
      'sp-balance', 'sp-usd'
    );
    balancesGrid.appendChild(spCard);
    
    // Create STEEM DOLLARS balance card
    const sbdCard = this.createBalanceCard(
      'local_atm', 'STEEM DOLLARS', 
      this.balances.sbd, '$0.00 USD',
      'sbd-balance', 'sbd-usd'
    );
    balancesGrid.appendChild(sbdCard);
    
    // Add balances grid to main element
    this.element.appendChild(balancesGrid);
    
    // Store references to elements we need to update
    this.steemBalanceElement = this.element.querySelector('#steem-balance');
    this.spBalanceElement = this.element.querySelector('#sp-balance');
    this.sbdBalanceElement = this.element.querySelector('#sbd-balance');
    this.steemUsdElement = this.element.querySelector('#steem-usd');
    this.spUsdElement = this.element.querySelector('#sp-usd');
    this.sbdUsdElement = this.element.querySelector('#sbd-usd');
    
    // Add to parent
    this.parentElement.appendChild(this.element);
    
    // Listen for balance updates
    eventEmitter.on('wallet:balances-updated', this.handleBalancesUpdated);
    
    // Check for rewards when component loads
    this.checkRewards();
    
    return this.element;
  }
  
  /**
   * Helper method to create a balance card
   */
  createBalanceCard(iconName, typeName, balanceValue, usdValue, balanceId, usdId) {
    const card = document.createElement('div');
    card.className = 'balance-card';
    
    // Create type section
    const typeSection = document.createElement('div');
    typeSection.className = 'balance-type';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;
    typeSection.appendChild(icon);
    
    const typeText = document.createElement('span');
    typeText.textContent = typeName;
    typeSection.appendChild(typeText);
    
    // Create balance value
    const balanceValueElement = document.createElement('div');
    balanceValueElement.className = 'balance-value';
    balanceValueElement.id = balanceId;
    balanceValueElement.textContent = balanceValue;
    
    // Create USD value
    const usdValueElement = document.createElement('div');
    usdValueElement.className = 'balance-usd';
    usdValueElement.id = usdId;
    usdValueElement.textContent = usdValue;
    
    // Add all elements to card
    card.appendChild(typeSection);
    card.appendChild(balanceValueElement);
    card.appendChild(usdValueElement);
    
    return card;
  }
  
  async checkRewards() {
    try {
      this.rewards = await walletService.getAvailableRewards();
      
      // Show/hide rewards indicator
      const hasRewards = 
        parseFloat(this.rewards.steem) > 0 || 
        parseFloat(this.rewards.sbd) > 0 || 
        parseFloat(this.rewards.sp) > 0;
      
      if (this.rewardsIndicator) {
        this.rewardsIndicator.classList.toggle('hidden', !hasRewards);
        
        if (hasRewards) {
          // Update the tooltip with reward details
          this.rewardsIndicator.title = `Claim rewards: ${this.rewards.steem} STEEM, ${this.rewards.sbd} SBD, ${this.rewards.sp} SP`;
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
    
    // Update balance values using stored references
    if (this.steemBalanceElement) this.steemBalanceElement.textContent = this.balances.steem;
    if (this.spBalanceElement) this.spBalanceElement.textContent = this.balances.steemPower;
    if (this.sbdBalanceElement) this.sbdBalanceElement.textContent = this.balances.sbd;
    
    // Update USD values (would require price feed in a real app)
    // For now we'll just leave them as placeholders
  }
  
  async handleRewardClick() {
    try {
      // Show confirmation dialog
      const rewardText = `${this.rewards.steem} STEEM, ${this.rewards.sbd} SBD, ${this.rewards.sp} SP`;
      const confirmed = confirm(`You are about to claim ${rewardText}. Continue?`);
      
      if (confirmed) {
        // Show loading state
        if (this.rewardsIndicator) {
          this.rewardsIndicator.classList.add('loading');
          
          // Clear existing content
          while (this.rewardsIndicator.firstChild) {
            this.rewardsIndicator.removeChild(this.rewardsIndicator.firstChild);
          }
          
          // Add loading spinner
          const spinner = document.createElement('span');
          spinner.className = 'material-icons spin';
          spinner.textContent = 'refresh';
          this.rewardsIndicator.appendChild(spinner);
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
          this.resetRewardsIndicator();
        } else {
          throw new Error(result.message || 'Failed to claim rewards');
        }
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      
      // Reset indicator
      this.resetRewardsIndicator();
      
      // Show error notification
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to claim rewards: ${error.message}`
      });
    }
  }
  
  resetRewardsIndicator() {
    if (this.rewardsIndicator) {
      this.rewardsIndicator.classList.remove('loading');
      
      // Clear existing content
      while (this.rewardsIndicator.firstChild) {
        this.rewardsIndicator.removeChild(this.rewardsIndicator.firstChild);
      }
      
      // Add gift icon back
      const giftIcon = document.createElement('span');
      giftIcon.className = 'material-icons';
      giftIcon.textContent = 'card_giftcard';
      this.rewardsIndicator.appendChild(giftIcon);
    }
  }
  
  destroy() {
    // Remove event listeners
    eventEmitter.off('wallet:balances-updated', this.handleBalancesUpdated);
    
    // Clear element references
    this.steemBalanceElement = null;
    this.spBalanceElement = null;
    this.sbdBalanceElement = null;
    this.steemUsdElement = null;
    this.spUsdElement = null;
    this.sbdUsdElement = null;
    this.rewardsIndicator = null;
    
    // Call parent destroy method
    super.destroy();
  }
}