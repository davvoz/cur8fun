import Component from '../Component.js';
import walletService from '../../services/WalletService.js';

export default class WalletBalancesComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.username = options.username || null;
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000',
      usdValues: {
        steem: '0.00',
        sbd: '0.00',
        steemPower: '0.00',
        total: '0.00'
      },
      prices: {
        steem: 0,
        sbd: 1
      }
    };
    this.isLoading = true;
    this.error = null;
    this.onBalancesLoaded = options.onBalancesLoaded || null;
    
    // Binding methods
    this.loadBalanceData = this.loadBalanceData.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-balances-section';
    
    // Create container for balance cards
    this.balanceContainer = document.createElement('div');
    this.balanceContainer.className = 'wallet-balance-cards';
    
    // Initial loading state
    this.showLoadingState();
    
    this.element.appendChild(this.balanceContainer);
    this.parentElement.appendChild(this.element);
    
    // Load balance data
    this.loadBalanceData();
    
    return this.element;
  }
  
  async loadBalanceData() {
    try {
      this.isLoading = true;
      this.showLoadingState();
      
      // Get user balances through wallet service
      const balanceData = await walletService.getUserBalances(this.username);
      
      if (!balanceData) {
        throw new Error('Failed to load balance data');
      }
      
      // Update balances
      this.balances = {
        steem: balanceData.steem,
        sbd: balanceData.sbd,
        steemPower: balanceData.steemPower,
        usdValues: balanceData.usdValues || {
          steem: '0.00',
          sbd: '0.00',
          steemPower: '0.00',
          total: '0.00'
        },
        prices: balanceData.prices || {
          steem: 0,
          sbd: 1
        }
      };
      
      this.isLoading = false;
      this.renderBalances();
      
      // Notify parent if callback is provided
      if (typeof this.onBalancesLoaded === 'function') {
        this.onBalancesLoaded(this.balances);
      }
      
    } catch (error) {
      console.error('Error loading wallet data:', error);
      this.error = error.message || 'Failed to load wallet data';
      this.showErrorState();
    }
  }
  
  showLoadingState() {
    if (!this.balanceContainer) return;
    
    this.balanceContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading wallet data...</p>
      </div>
    `;
  }
  
  showErrorState() {
    if (!this.balanceContainer) return;
    
    this.balanceContainer.innerHTML = `
      <div class="error-state">
        <i class="material-icons">error_outline</i>
        <p>${this.error}</p>
        <button class="btn btn-small retry-button">Retry</button>
      </div>
    `;
    
    // Add retry handler
    const retryButton = this.balanceContainer.querySelector('.retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', this.loadBalanceData);
    }
  }
  
  renderBalances() {
    if (!this.balanceContainer) return;
    
    // Build price info section if price data is available
    const hasPriceData = this.balances.prices && this.balances.prices.steem > 0;
    const priceInfoHtml = hasPriceData ? 
      `<div class="price-info">
         <span class="current-price">Current STEEM price: $${this.balances.prices.steem.toFixed(4)}</span>
         <span class="total-value">Total value: $${this.balances.usdValues.total}</span>
       </div>` : '';
    
    this.balanceContainer.innerHTML = `
      ${priceInfoHtml}
      <div class="balance-cards-row">
        <div class="balance-card">
          <div class="balance-card-icon">
            <i class="material-icons">account_balance</i>
          </div>
          <div class="balance-card-content">
            <h5>STEEM Balance</h5>
            <div class="balance-value">${this.balances.steem} STEEM</div>
            <div class="balance-usd">≈ $${this.balances.usdValues.steem}</div>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-card-icon">
            <i class="material-icons">attach_money</i>
          </div>
          <div class="balance-card-content">
            <h5>SBD Balance</h5>
            <div class="balance-value">${this.balances.sbd} SBD</div>
            <div class="balance-usd">≈ $${this.balances.usdValues.sbd}</div>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-card-icon">
            <i class="material-icons">flash_on</i>
          </div>
          <div class="balance-card-content">
            <h5>STEEM Power</h5>
            <div class="balance-value">${this.balances.steemPower} SP</div>
            <div class="balance-usd">≈ $${this.balances.usdValues.steemPower}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  updateUsername(username) {
    if (this.username === username) return;
    this.username = username;
    if (this.element) {
      this.loadBalanceData();
    }
  }
  
  destroy() {
    const retryButton = this.balanceContainer?.querySelector('.retry-button');
    if (retryButton) {
      retryButton.removeEventListener('click', this.loadBalanceData);
    }
    super.destroy();
  }
}