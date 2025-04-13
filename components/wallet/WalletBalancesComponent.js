import Component from '../Component.js';
import walletService from '../../services/WalletService.js';
import eventEmitter from '../../utils/EventEmitter.js';

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
      },
      steemPowerDetails: {
        delegatedOut: '0.000',
        delegatedIn: '0.000',
        effective: '0.000'
      }
    };
    this.isLoading = true;
    this.error = null;
    this.onBalancesLoaded = options.onBalancesLoaded || null;
    
    // Binding methods
    this.loadBalanceData = this.loadBalanceData.bind(this);
    this.handleBalancesUpdated = this.handleBalancesUpdated.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-balances-section';
    
    // Create container for balance cards
    this.balanceContainer = document.createElement('div');
    this.balanceContainer.className = 'wallet-balance-cards';
    
    // Initial loading state
    this.showLoadingState();
    
    // Register event listener for balance updates
    eventEmitter.on('wallet:balances-updated', this.handleBalancesUpdated);
    
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
        },
        steemPowerDetails: balanceData.steemPowerDetails || {
          delegatedOut: '0.000',
          delegatedIn: '0.000',
          effective: '0.000'
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
  
  /**
   * Handler for when balances are updated through the wallet service
   * @param {Object} updatedBalances - The newly updated balances
   */
  handleBalancesUpdated(updatedBalances) {
    console.log('Balances updated, reloading component data');
    this.loadBalanceData();
  }
  
  showLoadingState() {
    if (!this.balanceContainer) return;

    // Clear existing content
    this.balanceContainer.innerHTML = '';

    // Create loading state elements
    const loadingState = document.createElement('div');
    loadingState.className = 'loading-state';

    const spinner = document.createElement('div');
    spinner.className = 'spinner';

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading wallet data...';

    // Append elements
    loadingState.appendChild(spinner);
    loadingState.appendChild(loadingText);
    this.balanceContainer.appendChild(loadingState);
  }
  
  showErrorState() {
    if (!this.balanceContainer) return;

    // Clear existing content
    this.balanceContainer.innerHTML = '';

    // Create error state elements
    const errorState = document.createElement('div');
    errorState.className = 'error-state';

    const errorIcon = document.createElement('i');
    errorIcon.className = 'material-icons';
    errorIcon.textContent = 'error_outline';

    const errorMessage = document.createElement('p');
    errorMessage.textContent = this.error;

    const retryButton = document.createElement('button');
    retryButton.className = 'btn btn-small retry-button';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', this.loadBalanceData);

    // Append elements
    errorState.appendChild(errorIcon);
    errorState.appendChild(errorMessage);
    errorState.appendChild(retryButton);
    this.balanceContainer.appendChild(errorState);
  }
  
  renderBalances() {
    if (!this.balanceContainer) return;

    // Clear existing content
    this.balanceContainer.innerHTML = '';

    // Build price info section if price data is available
    if (this.balances.prices && this.balances.prices.steem > 0) {
      const priceInfo = document.createElement('div');
      priceInfo.className = 'price-info';

      const currentPrice = document.createElement('span');
      currentPrice.className = 'current-price';
      currentPrice.textContent = `Current STEEM price: $${this.balances.prices.steem.toFixed(4)}`;

      const totalValue = document.createElement('span');
      totalValue.className = 'total-value';
      totalValue.textContent = `Total value: $${this.balances.usdValues.total}`;

      priceInfo.appendChild(currentPrice);
      priceInfo.appendChild(totalValue);
      this.balanceContainer.appendChild(priceInfo);
    }

    // Create balance cards row
    const balanceCardsRow = document.createElement('div');
    balanceCardsRow.className = 'balance-cards-row';

    // STEEM Balance Card
    const steemCard = this.createBalanceCard('account_balance', 'STEEM Balance', `${this.balances.steem} STEEM`, `≈ $${this.balances.usdValues.steem}`);
    balanceCardsRow.appendChild(steemCard);

    // SBD Balance Card
    const sbdCard = this.createBalanceCard('attach_money', 'SBD Balance', `${this.balances.sbd} SBD`, `≈ $${this.balances.usdValues.sbd}`);
    balanceCardsRow.appendChild(sbdCard);

    // STEEM Power Card
    const steemPowerCard = this.createBalanceCard('flash_on', 'STEEM Power', `${this.balances.steemPower} SP`, `≈ $${this.balances.usdValues.steemPower}`);

    const delegationDetails = document.createElement('div');
    delegationDetails.className = 'delegation-details';

    const delegatedOut = document.createElement('span');
    delegatedOut.className = 'delegated-out';
    delegatedOut.textContent = `-${this.balances.steemPowerDetails.delegatedOut} SP`;

    const delegatedIn = document.createElement('span');
    delegatedIn.className = 'delegated-in';
    delegatedIn.textContent = `+${this.balances.steemPowerDetails.delegatedIn} SP`;

    delegationDetails.appendChild(delegatedOut);
    delegationDetails.appendChild(delegatedIn);
    steemPowerCard.querySelector('.balance-card-content').appendChild(delegationDetails);

    balanceCardsRow.appendChild(steemPowerCard);

    // Append balance cards row
    this.balanceContainer.appendChild(balanceCardsRow);
  }

  createBalanceCard(icon, title, value, usdValue) {
    const card = document.createElement('div');
    card.className = 'balance-card';

    const cardIcon = document.createElement('div');
    cardIcon.className = 'balance-card-icon';

    const iconElement = document.createElement('i');
    iconElement.className = 'material-icons';
    iconElement.textContent = icon;

    cardIcon.appendChild(iconElement);

    const cardContent = document.createElement('div');
    cardContent.className = 'balance-card-content';

    const cardTitle = document.createElement('h5');
    cardTitle.textContent = title;

    const cardValue = document.createElement('div');
    cardValue.className = 'balance-value';
    cardValue.textContent = value;

    const cardUsd = document.createElement('div');
    cardUsd.className = 'balance-usd';
    cardUsd.textContent = usdValue;

    cardContent.appendChild(cardTitle);
    cardContent.appendChild(cardValue);
    cardContent.appendChild(cardUsd);

    card.appendChild(cardIcon);
    card.appendChild(cardContent);

    return card;
  }
  
  updateUsername(username) {
    if (this.username === username) return;
    this.username = username;
    if (this.element) {
      this.loadBalanceData();
    }
  }
  
  destroy() {
    // Unregister event listener
    eventEmitter.off('wallet:balances-updated', this.handleBalancesUpdated);
    
    const retryButton = this.balanceContainer?.querySelector('.retry-button');
    if (retryButton) {
      retryButton.removeEventListener('click', this.loadBalanceData);
    }
    super.destroy();
  }
}