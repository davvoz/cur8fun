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
    // Merge new values, preserving existing USD/price data
    this.balances = {
      ...this.balances,
      steem: updatedBalances.steem,
      sbd: updatedBalances.sbd,
      steemPower: updatedBalances.steemPower,
      steemPowerDetails: updatedBalances.steemPowerDetails || this.balances?.steemPowerDetails
    };

    // If cards aren't rendered yet, do a full render
    if (!this.balanceContainer || !this.balanceContainer.querySelector('.balance-cards-row')) {
      this.renderBalances();
      return;
    }

    // Update in-place to avoid flicker — no skeleton, no re-fetch
    const values = this.balanceContainer.querySelectorAll('.balance-value');
    if (values[0]) values[0].textContent = `${this.balances.steem} STEEM`;
    if (values[1]) values[1].textContent = `${this.balances.sbd} SBD`;
    if (values[2]) values[2].textContent = `${this.balances.steemPower} SP`;

    const details = this.balances.steemPowerDetails;
    if (details) {
      const delegOut = this.balanceContainer.querySelector('.delegated-out');
      const delegIn = this.balanceContainer.querySelector('.delegated-in');
      if (delegOut) delegOut.innerHTML = `<span class="material-icons">arrow_upward</span> ${details.delegatedOut} SP`;
      if (delegIn) delegIn.innerHTML = `<span class="material-icons">arrow_downward</span> ${details.delegatedIn} SP`;
    }
  }

  showLoadingState() {
    if (!this.balanceContainer) return;

    // Skeleton mirrors real layout: 3 cards (icon + label + value + usd) then price bar below
    this.balanceContainer.innerHTML = `
      <div class="balance-cards-row">
        ${[1,2,3].map((_, i) => `
          <div class="balance-card${i === 2 ? ' sp-card' : ''}">
            <div class="balance-card-icon"><div class="sk-block" style="width:45px;height:45px;border-radius:50%"></div></div>
            <div class="balance-card-content">
              <div class="sk-block" style="width:60%;height:16px;border-radius:5px;margin-bottom:4px"></div>
              <div class="sk-block" style="width:85%;height:26px;border-radius:6px;margin-bottom:2px"></div>
              <div class="sk-block" style="width:45%;height:13px;border-radius:5px"></div>
            </div>
            ${i === 2 ? `<div class="delegation-details" style="gap:6px">
              <div class="sk-block" style="width:80px;height:22px;border-radius:4px"></div>
              <div class="sk-block" style="width:80px;height:22px;border-radius:4px"></div>
            </div>` : ''}
          </div>`).join('')}
      </div>
      <div class="price-info">
        <div class="sk-block" style="width:160px;height:16px;border-radius:5px"></div>
        <div class="sk-block" style="width:120px;height:16px;border-radius:5px"></div>
      </div>`;
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

    // Create balance cards row
    const balanceCardsRow = document.createElement('div');
    balanceCardsRow.className = 'balance-cards-row';

    // STEEM Balance Card
    const steemCard = this.createBalanceCard('account_balance', 'STEEM Balance', `${this.balances.steem} STEEM`, `≈ $${this.balances.usdValues.steem}`);
    balanceCardsRow.appendChild(steemCard);

    // SBD Balance Card
    const sbdCard = this.createBalanceCard('attach_money', 'SBD Balance', `${this.balances.sbd} SBD`, `≈ $${this.balances.usdValues.sbd}`);
    balanceCardsRow.appendChild(sbdCard);

    // STEEM Power Card — shows total owned SP (all vesting shares)
    const steemPowerCard = this.createBalanceCard('flash_on', 'STEEM Power', `${this.balances.steemPower} SP`, `≈ $${this.balances.usdValues.steemPower}`);

    const details = this.balances.steemPowerDetails;

    // Right-side delegation badges column
    const delegationDetails = document.createElement('div');
    delegationDetails.className = 'delegation-details';

    const delegatedOut = document.createElement('button');
    delegatedOut.className = 'delegated-out delegation-badge';
    delegatedOut.innerHTML = `<span class="material-icons">arrow_upward</span> ${details?.delegatedOut ?? '0.000'} SP`;
    delegatedOut.title = 'Outgoing delegations — click for details';
    delegatedOut.addEventListener('click', () => this._showDelegationModal('out'));

    const delegatedIn = document.createElement('button');
    delegatedIn.className = 'delegated-in delegation-badge';
    delegatedIn.innerHTML = `<span class="material-icons">arrow_downward</span> ${details?.delegatedIn ?? '0.000'} SP`;
    delegatedIn.title = 'Incoming delegations — click for details';
    delegatedIn.addEventListener('click', () => this._showDelegationModal('in'));

    delegationDetails.appendChild(delegatedOut);
    delegationDetails.appendChild(delegatedIn);

    // Attach to the outer card element (not content), so it sits on the right
    steemPowerCard.classList.add('sp-card');
    steemPowerCard.appendChild(delegationDetails);

    balanceCardsRow.appendChild(steemPowerCard);

    // Append balance cards row
    this.balanceContainer.appendChild(balanceCardsRow);

    // Price / total value bar — below the cards
    if (this.balances.prices && this.balances.prices.steem > 0) {
      const priceInfo = document.createElement('div');
      priceInfo.className = 'price-info';

      const currentPrice = document.createElement('span');
      currentPrice.className = 'current-price';
      currentPrice.textContent = `STEEM price: $${this.balances.prices.steem.toFixed(4)}`;

      const totalValue = document.createElement('span');
      totalValue.className = 'total-value';
      totalValue.textContent = `Portfolio value: $${this.balances.usdValues.total}`;

      priceInfo.appendChild(currentPrice);
      priceInfo.appendChild(totalValue);
      this.balanceContainer.appendChild(priceInfo);
    }
  }

  async _showDelegationModal(type) {
    // Remove any existing modal
    document.querySelector('.delegation-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'delegation-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const card = document.createElement('div');
    card.className = 'delegation-modal-card';

    const header = document.createElement('div');
    header.className = 'delegation-modal-header';
    const title = document.createElement('h4');
    title.textContent = type === 'out' ? 'Outgoing Delegations' : 'Incoming Delegations';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'delegation-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'delegation-modal-body';
    body.textContent = 'Loading…';
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if (type === 'out') {
      try {
        const [delegations, expiring] = await Promise.all([
          walletService.getDelegations(this.username),
          walletService.getExpiringDelegations(this.username)
        ]);
        body.innerHTML = '';

        // Expiring total row
        if (expiring && expiring.length) {
          const expiringTotal = expiring.reduce((sum, d) => sum + parseFloat(d.sp_amount), 0);
          const expiringRow = document.createElement('p');
          expiringRow.className = 'delegation-modal-info';
          expiringRow.innerHTML = `Returning (5-day window): <strong>${expiringTotal.toFixed(3)} SP</strong>`;
          body.appendChild(expiringRow);
        }

        if (!delegations.length) {
          const empty = document.createElement('p');
          empty.className = 'delegation-modal-empty';
          empty.textContent = 'No outgoing delegations.';
          body.appendChild(empty);
        } else {
          const table = document.createElement('table');
          table.className = 'delegations-table';
          table.innerHTML = `<thead><tr><th>Delegatee</th><th>Amount</th><th>Since</th></tr></thead>`;
          const tbody = document.createElement('tbody');
          delegations.forEach(d => {
            const tr = document.createElement('tr');
            const date = new Date(d.min_delegation_time + 'Z').toLocaleDateString();
            tr.innerHTML = `<td>@${d.delegatee}</td><td>${d.sp_amount} SP</td><td>${date}</td>`;
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          body.appendChild(table);
        }
      } catch {
        body.textContent = 'Failed to load delegations.';
      }
    } else {
      // Incoming: fetch fresh balances to get accurate delegatedIn total
      try {
        const incoming = await walletService.getIncomingDelegations(this.username);
        body.innerHTML = '';
        const freshBalances = await walletService.getUserBalances(this.username);
        const total = freshBalances?.steemPowerDetails?.delegatedIn ?? this.balances?.steemPowerDetails?.delegatedIn ?? '0.000';
        const totalRow = document.createElement('p');
        totalRow.className = 'delegation-modal-info';
        totalRow.innerHTML = `Total received: <strong>${total} SP</strong>`;
        body.appendChild(totalRow);
        if (incoming && incoming.length) {
          const table = document.createElement('table');
          table.className = 'delegations-table';
          table.innerHTML = `<thead><tr><th>Delegator</th><th>Amount</th></tr></thead>`;
          const tbody = document.createElement('tbody');
          incoming.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>@${d.delegator}</td><td>${d.sp_amount} SP</td>`;
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          body.appendChild(table);
        } else if (!total || total === '0.000') {
          const empty = document.createElement('p');
          empty.className = 'delegation-modal-empty';
          empty.textContent = 'No incoming delegations.';
          body.appendChild(empty);
        } else {
          const note = document.createElement('p');
          note.className = 'delegation-modal-note';
          note.textContent = 'Loading delegator list from account history failed.';
          body.appendChild(note);
        }
      } catch {
        body.textContent = 'Failed to load incoming delegations.';
      }
    }
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