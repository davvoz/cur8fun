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
  
  getPendingPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }
  
  getAuthorPayout() {
    const total = parseFloat(this.post.total_payout_value?.split(' ')[0] || 0);
    return total.toFixed(2);
  }
  
  getCuratorPayout() {
    const curator = parseFloat(this.post.curator_payout_value?.split(' ')[0] || 0);
    return curator.toFixed(2);
  }
  
  getPendingAuthorPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    // Authors typically get 75% of pending payout
    return (pending * 0.75).toFixed(2);
  }
  
  getPendingCuratorPayout() {
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    // Curators typically get 25% of pending payout
    return (pending * 0.25).toFixed(2);
  }
  
  getBeneficiaryPayouts() {
    const beneficiaries = this.post.beneficiaries || [];
    const pending = parseFloat(this.post.pending_payout_value?.split(' ')[0] || 0);
    
    return beneficiaries.map(b => {
      const percentage = b.weight / 10000;
      const payout = (pending * percentage).toFixed(2);
      return {
        account: b.account,
        percentage: (percentage * 100).toFixed(1),
        payout
      };
    });
  }
  
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
  
  escKeyHandler(event) {
    if (event.key === 'Escape') {
      this.close();
    }
  }
  
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
    
    // Add payout explanation
    content.appendChild(this.createPayoutExplanation());
    
    // Put it all together
    this.popup.appendChild(header);
    this.popup.appendChild(content);
  }
  
  createPayoutBreakdown() {
    const section = document.createElement('div');
    section.className = 'payout-section';
    
    // Main payout info
    const pendingPayout = this.getPendingPayout();
    
    const mainPayoutInfo = document.createElement('div');
    mainPayoutInfo.className = 'main-payout-info';
    
    const payoutLabel = document.createElement('div');
    payoutLabel.className = 'payout-label';
    payoutLabel.textContent = 'Pending Payout';
    
    const payoutValue = document.createElement('div');
    payoutValue.className = 'payout-value';
    payoutValue.textContent = `$${pendingPayout}`;
    
    mainPayoutInfo.appendChild(payoutLabel);
    mainPayoutInfo.appendChild(payoutValue);
    section.appendChild(mainPayoutInfo);
    
    // Breakdown title
    const breakdownTitle = document.createElement('h3');
    breakdownTitle.textContent = 'Breakdown';
    section.appendChild(breakdownTitle);
    
    // Create breakdown table
    const authorPayout = this.getPendingAuthorPayout();
    const curatorPayout = this.getPendingCuratorPayout();
    
    const breakdownTable = document.createElement('div');
    breakdownTable.className = 'payout-breakdown-table';
    
    // Author row
    const authorRow = document.createElement('div');
    authorRow.className = 'payout-row';
    
    const authorLabel = document.createElement('div');
    authorLabel.className = 'payout-item-label';
    
    const authorIcon = document.createElement('span');
    authorIcon.className = 'material-icons';
    authorIcon.textContent = 'person';
    authorIcon.style.color = 'var(--primary-color)';
    
    authorLabel.appendChild(authorIcon);
    authorLabel.appendChild(document.createTextNode('Author Payout (75%)'));
    
    const authorValue = document.createElement('div');
    authorValue.className = 'payout-item-value';
    authorValue.textContent = `$${authorPayout}`;
    
    authorRow.appendChild(authorLabel);
    authorRow.appendChild(authorValue);
    breakdownTable.appendChild(authorRow);
    
    // Curator row
    const curatorRow = document.createElement('div');
    curatorRow.className = 'payout-row';
    
    const curatorLabel = document.createElement('div');
    curatorLabel.className = 'payout-item-label';
    
    const curatorIcon = document.createElement('span');
    curatorIcon.className = 'material-icons';
    curatorIcon.textContent = 'workspace_premium';
    curatorIcon.style.color = 'var(--success-color)';
    
    curatorLabel.appendChild(curatorIcon);
    curatorLabel.appendChild(document.createTextNode('Curator Payout (25%)'));
    
    const curatorValue = document.createElement('div');
    curatorValue.className = 'payout-item-value';
    curatorValue.textContent = `$${curatorPayout}`;
    
    curatorRow.appendChild(curatorLabel);
    curatorRow.appendChild(curatorValue);
    breakdownTable.appendChild(curatorRow);
    
    section.appendChild(breakdownTable);
    
    return section;
  }
  
  createBeneficiarySection(beneficiaries) {
    const section = document.createElement('div');
    section.className = 'payout-section';
    
    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Beneficiaries';
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
  
  createPayoutExplanation() {
    const section = document.createElement('div');
    section.className = 'payout-explanation';
    
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons';
    infoIcon.textContent = 'info';
    infoIcon.style.verticalAlign = 'middle';
    infoIcon.style.marginRight = 'var(--space-xs)';
    
    const explanationText = document.createElement('div');
    explanationText.innerHTML = `
      <p><strong>Payout Information:</strong> Payouts occur 7 days after posting. The payout amount may change based on votes received until payout time.</p>
      <p>Author receives 75% of rewards in SP (50%) and SBD (25%). Curators receive 25% of rewards in SP.</p>
    `;
    
    section.appendChild(infoIcon);
    section.appendChild(explanationText);
    
    return section;
  }
}

export default PayoutInfoPopup;