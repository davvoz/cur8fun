/**
 * PayoutInfoPopup.js
 * Displays detailed payout information for a post in a popup
 */
import { isPayoutDeclined, applyDeclinedPayoutStyle } from '../../utils/PayoutUtils.js';

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
   * Show the popup as a small popover anchored above the payout element.
   * @param {HTMLElement} [anchorEl] - the clicked payout element to anchor to
   */
  async show(anchorEl = null) {
    // Remove any existing payout popups to prevent stacking
    document.querySelectorAll('.payout-popup, .payout-overlay').forEach(el => el.remove());
    this.anchorEl = anchorEl;

    // Create popup elements
    await this.createPopupElements();

    // Add to DOM, position next to the anchor, then animate in
    document.body.appendChild(this.popup);
    this.positionPopup();
    requestAnimationFrame(() => this.popup && this.popup.classList.add('open'));

    // Close on Escape or outside click
    document.addEventListener('keydown', this.escKeyHandler);
    this._outsideHandler = (e) => {
      if (!this.popup) return;
      if (!this.popup.contains(e.target) &&
          !(this.anchorEl && this.anchorEl.contains(e.target))) {
        this.close();
      }
    };
    setTimeout(() => document.addEventListener('click', this._outsideHandler), 50);
  }

  /**
   * Position the popover above the anchor (or below if there's no room),
   * horizontally centered and clamped to the viewport.
   */
  positionPopup() {
    if (!this.popup) return;
    const anchor = this.anchorEl;
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      this.popup.style.left = `${(window.innerWidth - this.popup.offsetWidth) / 2}px`;
      this.popup.style.top = `${(window.innerHeight - this.popup.offsetHeight) / 2}px`;
      return;
    }
    const margin = 8;

    // Confine the popover to the post card's bounds when inside a card;
    // otherwise (e.g. the post detail page) fall back to the viewport.
    const card = anchor.closest('.post-card');
    const cardRect = card ? card.getBoundingClientRect() : null;
    const minX = cardRect ? cardRect.left + margin : margin;
    const maxX = cardRect ? cardRect.right - margin : window.innerWidth - margin;
    const minY = cardRect ? cardRect.top + margin : margin;
    const maxY = cardRect ? cardRect.bottom - margin : window.innerHeight - margin;

    // Cap the popover size so it can never exceed the card
    const availW = maxX - minX;
    const availH = maxY - minY;
    this.popup.style.maxWidth = `${Math.max(0, availW)}px`;
    this.popup.style.maxHeight = `${Math.max(0, availH)}px`;

    const w = Math.min(this.popup.offsetWidth, availW);
    const h = Math.min(this.popup.offsetHeight, availH);
    const rect = anchor.getBoundingClientRect();

    let top;
    let originY;
    if (rect.top - minY >= h + margin) {
      top = rect.top - h - margin;   // above the payout
      originY = 'bottom';
    } else {
      top = rect.bottom + margin;    // below it
      originY = 'top';
    }

    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(minX, Math.min(left, maxX - w));
    top = Math.max(minY, Math.min(top, maxY - h));

    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
    this.popup.style.transformOrigin = `center ${originY}`;
  }

  /**
   * Close the popup (animated)
   */
  close() {
    document.removeEventListener('keydown', this.escKeyHandler);
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
      this._outsideHandler = null;
    }

    // Legacy overlay cleanup (no longer created)
    if (this.overlay) {
      if (this.overlay.parentNode) this.overlay.remove();
      this.overlay = null;
    }

    const popup = this.popup;
    this.popup = null;
    if (!popup) return;

    popup.classList.remove('open');
    popup.classList.add('closing');
    const remove = () => { if (popup.parentNode) popup.remove(); };
    popup.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 300); // fallback
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
    // Create popup container (anchored popover — no full-screen overlay)
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

    const pendingPayout = this.getPendingPayout();
    const daysUntilPayout = this.getDaysUntilPayout();
    const payoutStatus = this.getPayoutStatus();
    const isPaidOut = this.isPostPaidOut();

    // Headline: big value + a single compact subtitle (status · timing)
    const mainPayoutInfo = document.createElement('div');
    mainPayoutInfo.className = 'main-payout-info';

    const payoutValue = document.createElement('div');
    payoutValue.className = 'payout-value';
    payoutValue.textContent = `$${pendingPayout}`;
    applyDeclinedPayoutStyle(payoutValue, this.post);
    mainPayoutInfo.appendChild(payoutValue);

    const sub = document.createElement('div');
    sub.className = 'payout-date-info';
    if (isPayoutDeclined(this.post)) {
      sub.textContent = 'Author declined payout';
    } else if (isPaidOut) {
      sub.textContent = 'Paid out';
    } else if (daysUntilPayout === 'Processing') {
      sub.textContent = 'Processing payout';
    } else {
      sub.textContent = `${payoutStatus} · in ${daysUntilPayout} ${daysUntilPayout === 1 ? 'day' : 'days'}`;
    }
    mainPayoutInfo.appendChild(sub);
    section.appendChild(mainPayoutInfo);

    // Breakdown as compact inline chips (only non-zero amounts), kept on one row
    const chips = document.createElement('div');
    chips.className = 'payout-chips currency-chips';
    section.appendChild(chips);

    if (!isPaidOut) {
      const loading = document.createElement('div');
      loading.className = 'loading-indicator';
      loading.textContent = 'Loading…';
      chips.appendChild(loading);

      this.getPayoutBreakdown()
        .then(b => {
          chips.innerHTML = '';
          if (b) {
            this._appendChip(chips, 'STEEM', b.steem, b.steem);
            this._appendChip(chips, 'SP', b.sp, b.sp);
            this._appendChip(chips, 'SBD', b.sbd, b.sbd);
          }
          if (!chips.children.length) chips.remove();
          this._reposition();
        })
        .catch(() => {
          chips.remove();
          this._reposition();
        });
    } else {
      this._appendChip(chips, 'Author', `$${this.getAuthorPayout()}`, this.getAuthorPayout());
      this._appendChip(chips, 'Curator', `$${this.getCuratorPayout()}`, this.getCuratorPayout());
      if (!chips.children.length) chips.remove();
    }

    return section;
  }

  /**
   * Append a compact chip "LABEL value" — only when the amount is non-zero.
   */
  _appendChip(container, label, value, amount) {
    if (!(parseFloat(amount) > 0)) return;
    const chip = document.createElement('div');
    chip.className = 'payout-chip';

    const labelEl = document.createElement('span');
    labelEl.className = 'payout-chip-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'payout-chip-value';
    valueEl.textContent = value;

    chip.appendChild(labelEl);
    chip.appendChild(valueEl);
    container.appendChild(chip);
  }

  /** Re-anchor the popover to the payout after its content (height) changed. */
  _reposition() {
    if (this.popup) {
      try { this.positionPopup(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Append a label/value row to a table, but only when the amount is non-zero
   * (so empty currencies/rewards don't clutter the popover).
   */
  _appendPayoutRow(table, label, valueText, amount) {
    if (!(parseFloat(amount) > 0)) return;
    const row = document.createElement('div');
    row.className = 'payout-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'payout-item-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'payout-item-value';
    valueEl.textContent = valueText;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    table.appendChild(row);
  }

  /**
   * Create beneficiaries section
   */
  createBeneficiarySection(beneficiaries) {
    const section = document.createElement('div');
    section.className = 'payout-section';

    // Compact inline chips: "🤝 @account 100%"
    const chips = document.createElement('div');
    chips.className = 'payout-chips beneficiary-chips';

    beneficiaries.forEach(b => {
      const chip = document.createElement('div');
      chip.className = 'payout-chip beneficiary-chip';

      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = 'volunteer_activism';

      const name = document.createElement('span');
      name.className = 'payout-chip-label';
      name.textContent = `@${b.account}`;

      const value = document.createElement('span');
      value.className = 'payout-chip-value';
      value.textContent = `${b.percentage}%`;

      chip.appendChild(icon);
      chip.appendChild(name);
      chip.appendChild(value);
      chips.appendChild(chip);
    });

    section.appendChild(chips);
    return section;
  }
}

export default PayoutInfoPopup;