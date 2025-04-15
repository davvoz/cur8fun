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
    
    // Determine if the post has already been paid
    this.hasBeenPaid = this.checkIfPaid();
    
    // Bind methods
    this.close = this.close.bind(this);
    this.escKeyHandler = this.escKeyHandler.bind(this);
  }
  
  /**
   * Check if the post has already been paid
   */
  checkIfPaid() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
    
    // If total_payout_value or curator_payout_value are > 0, the post has been paid
    return (total > 0 || curator > 0);
  }
  
  /**
   * Get total payout (pending or completed)
   */
  getTotalPayout() {
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
  
  /**
   * Get SBD, STEEM and SP breakdown
   * Analyze and display values exactly as on Steemit
   */
  getPayoutBreakdown() {
    // If it's an already paid post, try to use actual values from the completed payout
    if (this.hasBeenPaid) {
      // For already paid posts, first check specific properties
      if (this.post.payout_details) {
        return {
          sbd: parseFloat(this.post.payout_details.sbd_payout || 0).toFixed(2),
          steem: parseFloat(this.post.payout_details.steem_payout || 0).toFixed(2),
          sp: parseFloat(this.post.payout_details.sp_payout || 0).toFixed(2)
        };
      }
      
      // If there are no specific details, calculate based on standard values
      const totalPayout = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
      const curatorPayout = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
      const authorPayout = totalPayout - curatorPayout;
      
      // Typically on STEEM, completed payouts are split between author and curators
      // with the author's payout split 50/50 between liquid and SP
      return {
        sbd: "0.00",  // Typically 0 in current Steem settings
        steem: authorPayout.toFixed(2),
        sp: authorPayout.toFixed(2)
      };
    }
    
    // For pending payouts
    const pendingPayout = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    
    // Look for specific details in the post
    // If there are special metadata for the breakdown, use them
    if (this.post.breakdown) {
      return {
        sbd: parseFloat(this.post.breakdown.sbd || 0).toFixed(2),
        steem: parseFloat(this.post.breakdown.steem || 0).toFixed(2),
        sp: parseFloat(this.post.breakdown.sp || 0).toFixed(2)
      };
    }
    
    // Otherwise use the standard split
    return {
      sbd: "0.00", 
      steem: pendingPayout.toFixed(2),
      sp: pendingPayout.toFixed(2)
    };
  }
  
  /**
   * Calculate days until payout or get payout date if already paid
   */
  getPayoutInfo() {
    if (this.hasBeenPaid) {
      if (this.post.cashout_time) {
        // If we have the actual payout date
        const payoutDate = new Date(this.post.cashout_time + 'Z');
        return {
          isPaid: true,
          date: payoutDate.toLocaleDateString(),
          daysAgo: this.getDaysSince(payoutDate)
        };
      }
      return {
        isPaid: true,
        date: 'Completed',
        daysAgo: null
      };
    } else {
      // For pending payouts
      if (!this.post.created) return { isPaid: false, daysLeft: 'Soon' };
      
      const created = new Date(this.post.created + 'Z');
      const payoutTime = new Date(created.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days after creation
      const now = new Date();
      
      // Calculate the difference in days
      const diffTime = payoutTime - now;
      if (diffTime <= 0) return { isPaid: false, daysLeft: 'Processing' };
      
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { isPaid: false, daysLeft: diffDays };
    }
  }
  
  /**
   * Calculate days since a date
   */
  getDaysSince(date) {
    const now = new Date();
    const diffTime = now - date;
    if (diffTime <= 0) return 0;
    
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Get beneficiary payout details
   */
  getBeneficiaryPayouts() {
    const beneficiaries = this.post.beneficiaries || [];
    const totalPayout = this.hasBeenPaid ? 
      parseFloat(this.post.total_payout_value?.split(' ')[0] || 0) :
      parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    
    return beneficiaries.map(b => {
      const percentage = b.weight / 10000;
      const payout = (totalPayout * percentage).toFixed(2);
      return {
        account: b.account,
        percentage: (percentage * 100).toFixed(1),
        payout
      };
    });
  }
  
  /**
   * Show the popup
   */
  show() {
    // First close any existing popups to prevent stacking
    this.close();
    
    // Create popup elements
    this.createPopupElements();
    
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
  createPopupElements() {
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
    
    // Add payout breakdown
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
    const totalPayout = this.getTotalPayout();
    const payoutInfo = this.getPayoutInfo();
    
    const mainPayoutInfo = document.createElement('div');
    mainPayoutInfo.className = 'main-payout-info';
    
    if (this.hasBeenPaid) {
      // For already paid posts, show a different format
      const payoutLabel = document.createElement('div');
      payoutLabel.className = 'payout-label';
      payoutLabel.textContent = 'Previous payout of';
      
      const payoutValue = document.createElement('div');
      payoutValue.className = 'payout-value';
      payoutValue.textContent = `${totalPayout} $`;
      
      mainPayoutInfo.appendChild(payoutLabel);
      mainPayoutInfo.appendChild(payoutValue);
      
      // Create list for author and curators
      const payoutList = document.createElement('div');
      payoutList.className = 'payout-distribution-list';
      
      // Author row
      const authorRow = document.createElement('div');
      authorRow.className = 'payout-distribution-item';
      
      const authorBullet = document.createElement('span');
      authorBullet.textContent = '- ';
      authorRow.appendChild(authorBullet);
      
      const authorLabel = document.createElement('span');
      authorLabel.textContent = 'Author ';
      authorRow.appendChild(authorLabel);
      
      const authorValue = document.createElement('span');
      authorValue.className = 'distribution-value';
      authorValue.textContent = `${this.getAuthorPayout()} $`;
      authorRow.appendChild(authorValue);
      
      payoutList.appendChild(authorRow);
      
      // Curator row
      const curatorRow = document.createElement('div');
      curatorRow.className = 'payout-distribution-item';
      
      const curatorBullet = document.createElement('span');
      curatorBullet.textContent = '- ';
      curatorRow.appendChild(curatorBullet);
      
      const curatorLabel = document.createElement('span');
      curatorLabel.textContent = 'Curators ';
      curatorRow.appendChild(curatorLabel);
      
      const curatorValue = document.createElement('span');
      curatorValue.className = 'distribution-value';
      curatorValue.textContent = `${this.getCuratorPayout()} $`;
      curatorRow.appendChild(curatorValue);
      
      payoutList.appendChild(curatorRow);
      
      mainPayoutInfo.appendChild(payoutList);
    } else {
      // For pending payouts, keep the original format
      const payoutLabel = document.createElement('div');
      payoutLabel.className = 'payout-label';
      payoutLabel.textContent = 'Pending Payout';
      
      const payoutValue = document.createElement('div');
      payoutValue.className = 'payout-value';
      payoutValue.textContent = `$${totalPayout}`;
      
      mainPayoutInfo.appendChild(payoutLabel);
      mainPayoutInfo.appendChild(payoutValue);
      
      // Add payout date info
      const payoutDateInfo = document.createElement('div');
      payoutDateInfo.className = 'payout-date-info';
      payoutDateInfo.textContent = `Payout in ${payoutInfo.daysLeft} ${payoutInfo.daysLeft === 1 ? 'day' : 'days'}`;
      mainPayoutInfo.appendChild(payoutDateInfo);
    }
    
    section.appendChild(mainPayoutInfo);
    
    // Breakdown title (only for pending payouts)
    if (!this.hasBeenPaid) {
      const breakdownTitle = document.createElement('h3');
      breakdownTitle.textContent = 'Breakdown:';
      section.appendChild(breakdownTitle);
      
      // Create breakdown table for currency distribution
      const currencyBreakdown = this.getPayoutBreakdown();
      const currencyTable = document.createElement('div');
      currencyTable.className = 'payout-breakdown-table currency-breakdown';
      
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
      
      section.appendChild(currencyTable);
    }
    
    return section;
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
      nameLabel.className = 'beneficiary-name';
      
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