/**
 * PayoutInfoPopup.js
 * Displays detailed payout information for a post in a popup
 */
class PayoutInfoPopup {
  constructor(post) {
    this.post = post;
    this.overlay = null;
    this.popup = null;
    this.isMobile = window.innerWidth < 768;

    // Bind methods
    this.close = this.close.bind(this);
    this.escKeyHandler = this.escKeyHandler.bind(this);
  }

  /**
   * Get total pending payout
   */
  getPendingPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  /**
   * Get author's payout
   */
  getAuthorPayout() {
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    return total.toFixed(2);
  }

  /**
   * Get curator's payout
   */
  getCuratorPayout() {
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
    return curator.toFixed(2);
  }

  /**
   * Calculate payout percentages for author and curator
   */
  getPayoutPercentages() {
    // Calculate percentages based on post data or blockchain parameters
    // Default values as fallback
    let authorPercent = 75;
    let curatorPercent = 25;

    // Try to extract percentages from post data if available
    if (this.post.max_accepted_payout && this.post.curator_payout_percentage) {
      // Some posts may have custom percentages
      curatorPercent = this.post.curator_payout_percentage / 100;
      authorPercent = 100 - curatorPercent;
    } else if (this.post.reward_weight) {
      // The reward_weight might affect distribution
      const rewardWeight = this.post.reward_weight / 10000; // Convert from basis points to percentage

      // Default curator percentage in Steem blockchain is typically 25%
      // but this can vary depending on blockchain settings and post parameters
      curatorPercent = 25 * rewardWeight;
      authorPercent = 100 * rewardWeight - curatorPercent;
    }

    return {
      author: authorPercent,
      curator: curatorPercent
    };
  }

  /**
   * Calculate author's pending payout
   */
  getPendingAuthorPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const percentages = this.getPayoutPercentages();
    return (pending * percentages.author / 100).toFixed(2);
  }

  /**
   * Calculate curator's pending payout
   */
  getPendingCuratorPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const percentages = this.getPayoutPercentages();
    return (pending * percentages.curator / 100).toFixed(2);
  }

  _getDynamicGlobalProperties() {
    return new Promise((resolve, reject) => {
      window.steem.api.getDynamicGlobalProperties((err, result) => {
        console.log('Dynamic Global Properties:', result);
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get SBD, STEEM and SP breakdown
   * Analyzes and displays the values exactly as on Steemit
   */
  /**
   * Get SBD, STEEM and SP breakdown
   * Analyzes and displays the values exactly as on Steemit
   */
  async getPayoutBreakdown() {
    try {
      // Fetch prices once at the beginning
      const prices = await fetch('https://imridd.eu.pythonanywhere.com/api/prices')
        .then(res => res.json())
        .catch(() => ({ STEEM: 1 })); // Fallback if API fails

      const steemPrice = prices.STEEM || 1;
      const payout = this.getPendingPayout();

      // Initialize breakdown values
      let sbd = 0, steem = 0, sp = 0;


      // Handle different payout scenarios
      if (this.post.percent_steem_dollars === 10000) {
        // 100% SBD payout mode
        const totalSteemValue = payout / steemPrice;
        steem = totalSteemValue / 2;
        sp = totalSteemValue / 2;
      } else {
        // 100% SP payout mode
        sp = payout / steemPrice;
      }

      // Return formatted values
      return {
        sbd: sbd.toFixed(2),
        steem: steem.toFixed(2),
        sp: sp.toFixed(2)
      };
    } catch (error) {
      console.error('Error calculating payout breakdown:', error);
      // Return default values in case of error
      return { sbd: '0.00', steem: '0.00', sp: '0.00' };
    }
  }

  /**
   * Calculate days until payout
   */
  getDaysUntilPayout() {
    if (!this.post.created) return 'Soon';

    const created = new Date(this.post.created + 'Z');
    const payoutTime = new Date(created.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days after creation
    const now = new Date();

    // If the post has been paid out
    if (this.isPostPaidOut()) {
      return 'Completed';
    }

    // Calculate difference in days
    const diffTime = payoutTime - now;
    if (diffTime <= 0) return 'Processing';

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get beneficiary payout details
   */
  getBeneficiaryPayouts() {
    const beneficiaries = this.post.beneficiaries || [];

    // Se il post è stato pagato, il beneficiario prende il totale pagato moltiplicato per il suo peso
    if (this.isPostPaidOut()) {
      // Per i post pagati, consideriamo l'importo totale author + curator
      const authorPayout = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);

      return beneficiaries.map(b => {
        const percentage = b.weight / 10000;
        // Il beneficiario riceve la sua percentuale del totale
        const payout = (authorPayout * percentage).toFixed(2);
        return {
          account: b.account,
          percentage: (percentage * 100).toFixed(1),
          payout
        };
      });
    }
    // Per i post in pending payout, calcoliamo il payout atteso
    const pending = this.getPendingPayout() / 2;
    return beneficiaries.map(b => {
      const percentage = b.weight / 10000;
      // Per i post in pending, calcoliamo lo stesso modo dei post pagati
      const payout = (pending * percentage).toFixed(2);
      return {
        account: b.account,
        percentage: (percentage * 100).toFixed(1),
        payout
      };
    });
  }

  /**
   * Check if the post has already been paid out
   */
  isPostPaidOut() {
    // Check if pending payout is zero and total payout has value
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);

    // If there's no pending payout but there is a total/curator payout, the post has been paid out
    return pending <= 0 && (total > 0 || curator > 0);
  }

  /**
   * Get payout status for display
   */
  getPayoutStatus() {
    if (this.isPostPaidOut()) {
      return 'Paid Out';
    } else {
      return 'Pending Payout';
    }
  }

  /**
   * Show the popup
   */
  async show() {
    // First close any existing popups to prevent stacking
    this.close();

    // Create popup elements
    await this.createPopupElements();

    // Add Escape key listener
    document.addEventListener('keydown', this.escKeyHandler);

    // Add to DOM
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.popup);
  }

  /**
   * Close the popup
   */
  close() {
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
    }

    if (this.popup) {
      document.body.removeChild(this.popup);
      this.popup = null;
    }

    document.removeEventListener('keydown', this.escKeyHandler);
  }

  /**
   * Handle escape key press
   */
  escKeyHandler(event) {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  /**
   * Create popup DOM elements
   */
  async createPopupElements() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'payout-overlay';
    this.overlay.addEventListener('click', this.close);

    // Create popup container
    this.popup = document.createElement('div');
    this.popup.className = 'payout-popup';

    // Create popup header
    const header = document.createElement('div');
    header.className = 'payout-popup-header';

    const title = document.createElement('h2');
    title.textContent = 'Payout Information';

    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.addEventListener('click', this.close);

    const closeIcon = document.createElement('span');
    closeIcon.className = 'material-icons';
    closeIcon.textContent = 'close';
    closeButton.appendChild(closeIcon);

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create popup content
    const content = document.createElement('div');
    content.className = 'payout-popup-content';

    // Add payout breakdown - la funzione createPayoutBreakdown gestisce la propria operazione asincrona
    content.appendChild(this.createPayoutBreakdown());

    // Add beneficiary information if applicable
    const beneficiaries = this.getBeneficiaryPayouts();
    if (beneficiaries.length > 0) {
      content.appendChild(this.createBeneficiarySection(beneficiaries));
    }

    // Put it all together
    this.popup.appendChild(header);
    this.popup.appendChild(content);
  }

  /**
   * Create payout breakdown section
   */
  createPayoutBreakdown() {
    const section = document.createElement('div');
    section.className = 'payout-section';

    // Main payout info
    const pendingPayout = this.getPendingPayout();
    const daysUntilPayout = this.getDaysUntilPayout();
    const payoutStatus = this.getPayoutStatus();
    const isPaidOut = this.isPostPaidOut();

    const mainPayoutInfo = document.createElement('div');
    mainPayoutInfo.className = 'main-payout-info';

    const payoutLabel = document.createElement('div');
    payoutLabel.className = 'payout-label';
    payoutLabel.textContent = payoutStatus;

    const payoutValue = document.createElement('div');
    payoutValue.className = 'payout-value';
    payoutValue.textContent = `$${pendingPayout}`;

    mainPayoutInfo.appendChild(payoutLabel);
    mainPayoutInfo.appendChild(payoutValue);

    // Add payout date info
    const payoutDateInfo = document.createElement('div');
    payoutDateInfo.className = 'payout-date-info';

    if (isPaidOut) {
      payoutDateInfo.textContent = 'Payout has been completed';
    } else if (daysUntilPayout === 'Processing') {
      payoutDateInfo.textContent = 'Processing payout';
    } else {
      payoutDateInfo.textContent = `Payout in ${daysUntilPayout} ${daysUntilPayout === 1 ? 'day' : 'days'}`;
    }

    mainPayoutInfo.appendChild(payoutDateInfo);
    section.appendChild(mainPayoutInfo);

    // Breakdown title
    const breakdownTitle = document.createElement('h3');
    breakdownTitle.textContent = 'Breakdown:';
    section.appendChild(breakdownTitle);

    // Create breakdown table for currency distribution
    const currencyTable = document.createElement('div');
    currencyTable.className = 'payout-breakdown-table currency-breakdown';

    if (!isPaidOut) {
      // Add loading indicator solo per i post non pagati
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.textContent = 'Loading breakdown data...';
      currencyTable.appendChild(loadingIndicator);

      section.appendChild(currencyTable);
      
      // Fetch payout breakdown asynchronously
      this.getPayoutBreakdown()
        .then(currencyBreakdown => {
          console.log('Currency Breakdown:', currencyBreakdown);

          // Clear the loading indicator
          currencyTable.innerHTML = '';

          if (!currencyBreakdown) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'Unable to load payout breakdown';
            currencyTable.appendChild(errorMessage);
            return;
          }

          // SBD Row
          const sbdRow = document.createElement('div');
          sbdRow.className = 'payout-row';

          const sbdLabel = document.createElement('div');
          sbdLabel.className = 'payout-item-label';
          sbdLabel.textContent = 'SBD';

          const sbdValue = document.createElement('div');
          sbdValue.className = 'payout-item-value';
          sbdValue.textContent = `${currencyBreakdown.sbd} SBD`;

          sbdRow.appendChild(sbdLabel);
          sbdRow.appendChild(sbdValue);
          currencyTable.appendChild(sbdRow);

          // STEEM Row
          const steemRow = document.createElement('div');
          steemRow.className = 'payout-row';

          const steemLabel = document.createElement('div');
          steemLabel.className = 'payout-item-label';
          steemLabel.textContent = 'STEEM';

          const steemValue = document.createElement('div');
          steemValue.className = 'payout-item-value';
          steemValue.textContent = `${currencyBreakdown.steem} STEEM`;

          steemRow.appendChild(steemLabel);
          steemRow.appendChild(steemValue);
          currencyTable.appendChild(steemRow);

          // SP Row
          const spRow = document.createElement('div');
          spRow.className = 'payout-row';

          const spLabel = document.createElement('div');
          spLabel.className = 'payout-item-label';
          spLabel.textContent = 'SP';

          const spValue = document.createElement('div');
          spValue.className = 'payout-item-value';
          spValue.textContent = `${currencyBreakdown.sp} SP`;

          spRow.appendChild(spLabel);
          spRow.appendChild(spValue);
          currencyTable.appendChild(spRow);
        })
        .catch(error => {
          console.error('Error fetching payout breakdown:', error);
          currencyTable.innerHTML = '';

          const errorMessage = document.createElement('div');
          errorMessage.className = 'error-message';
          errorMessage.textContent = 'Error loading payout breakdown';
          currencyTable.appendChild(errorMessage);
        });

      return section;
    } else {
      // If the post is paid out, show the total payout value instead sbd, steem and sp -> author reward and curator reward in dollars
      const authorPayout = this.getAuthorPayout();
      const curatorPayout = this.getCuratorPayout();
      const authorPayoutRow = document.createElement('div');
      authorPayoutRow.className = 'payout-row';

      const authorPayoutLabel = document.createElement('div');
      authorPayoutLabel.className = 'payout-item-label';
      authorPayoutLabel.textContent = 'Author Reward';

      const authorPayoutValue = document.createElement('div');
      authorPayoutValue.className = 'payout-item-value';
      authorPayoutValue.textContent = `$${authorPayout}`;

      authorPayoutRow.appendChild(authorPayoutLabel);
      authorPayoutRow.appendChild(authorPayoutValue);
      currencyTable.appendChild(authorPayoutRow);

      // Curator Row
      const curatorPayoutRow = document.createElement('div');
      curatorPayoutRow.className = 'payout-row';

      const curatorPayoutLabel = document.createElement('div');
      curatorPayoutLabel.className = 'payout-item-label';
      curatorPayoutLabel.textContent = 'Curator Reward';

      const curatorPayoutValue = document.createElement('div');
      curatorPayoutValue.className = 'payout-item-value';
      curatorPayoutValue.textContent = `$${curatorPayout}`;

      curatorPayoutRow.appendChild(curatorPayoutLabel);
      curatorPayoutRow.appendChild(curatorPayoutValue);
      currencyTable.appendChild(curatorPayoutRow);

      // Add the table to the section
      section.appendChild(currencyTable);
      return section;
    }
  }

  /**
   * Create beneficiaries section
   */
  createBeneficiarySection(beneficiaries) {
    const section = document.createElement('div');
    section.className = 'payout-section';

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Beneficiaries:';
    section.appendChild(title);

    // Create beneficiary table
    const beneficiaryTable = document.createElement('div');
    beneficiaryTable.className = 'beneficiary-table';

    beneficiaries.forEach(b => {
      const row = document.createElement('div');
      row.className = 'beneficiary-row';

      const nameLabel = document.createElement('div');
      nameLabel.className = 'beneficiary-nameop';

      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = 'volunteer_activism';
      icon.style.color = 'var(--info-color)';

      nameLabel.appendChild(icon);
      nameLabel.appendChild(document.createTextNode(`@${b.account} (${b.percentage}%)`));

      const value = document.createElement('div');
      value.className = 'beneficiary-value';
      value.textContent = `$${b.payout}`;

      row.appendChild(nameLabel);
      row.appendChild(value);
      beneficiaryTable.appendChild(row);
    });

    section.appendChild(beneficiaryTable);
    return section;
  }
}

export default PayoutInfoPopup;