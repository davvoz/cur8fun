import router from '../../utils/Router.js';

class VotesPopup {
  static popupCounter = 0;

  constructor(post) {
    this.post = post;
    this.isMobile = window.innerWidth < 768; // Check if device is mobile
    this.popupId = `votes-popup-${VotesPopup.popupCounter++}`;
    this.overlay = null;
    this.popup = null;
    this.contentContainer = null;
    this.isLoadingVotes = false;
    this.closePopupHandler = this.close.bind(this);

    this.ensureLoadingStyles();
  }

  // Close method to properly clean up the popup
  close() {
    // Remove the key event listener first to prevent multiple calls
    document.removeEventListener('keydown', this.escKeyHandler);

    const overlay = this.overlay;
    const popup = this.popup;

    // Null out references immediately so re-entrant calls are no-ops
    this.overlay = null;
    this.popup = null;

    // Animate out then remove
    if (overlay || popup) {
      if (overlay) { overlay.style.opacity = '0'; }
      if (popup) {
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -50%) scale(0.95)';
      }
      setTimeout(() => {
        if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay);
        if (popup && document.body.contains(popup)) document.body.removeChild(popup);
      }, 180);
    }
  }

  // Escape key handler
  escKeyHandler = (e) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  show() {
    // Close any existing popup first
    this.close();

    // Fetch when: active_votes is empty/missing but net_votes > 0 (votes exist but not loaded)
    //          OR active_votes has entries but time is missing (feed/home data)
    const hasVotes = (this.post.net_votes > 0) ||
      (Array.isArray(this.post.active_votes) && this.post.active_votes.length > 0);
    const votesIncomplete = !Array.isArray(this.post.active_votes) ||
      this.post.active_votes.length === 0 ||
      this.post.active_votes[0].time == null;
    const needsFetch = hasVotes && votesIncomplete && !!this.post.author && !!this.post.permlink;

    if (needsFetch) {
      // Open immediately with a lightweight loading state, then hydrate content.
      this.isLoadingVotes = true;
      this._openPopup();

      window.steem.api.getActiveVotes(this.post.author, this.post.permlink, (err, votes) => {
        if (!err && Array.isArray(votes) && votes.length > 0) {
          this.post = { ...this.post, active_votes: votes };
        }
        this.isLoadingVotes = false;
        this.refreshPopupContent();
      });
    } else {
      this.isLoadingVotes = false;
      this._openPopup();
    }
  }

  _openPopup() {
    this.createPopupElements();
    document.addEventListener('keydown', this.escKeyHandler);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.popup);

    // Double-rAF: ensures initial state is painted before transition starts
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.overlay) this.overlay.style.opacity = '1';
      if (this.popup) {
        this.popup.style.opacity = '1';
        this.popup.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }));
  }

  createPopupElements() {
    this.popup = this.createElement('div', `votes-popup ${this.popupId}`, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(0.95)',
      backgroundColor: 'var(--background-light)',
      color: 'var(--text-color)',
      padding: this.isMobile ? 'var(--space-sm)' : 'var(--space-lg)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--popup-box-shadow)',
      zIndex: 'var(--z-modal)',
      maxHeight: '80vh',
      overflow: 'auto',
      width: this.isMobile ? '90%' : null,
      maxWidth: this.isMobile ? '100%' : '90%',
      minWidth: this.isMobile ? 'auto' : '500px',
      opacity: '0',
      transition: 'opacity 0.18s ease, transform 0.18s ease'
    });

    this.overlay = this.createElement('div', `popup-overlay ${this.popupId}-overlay`, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 'calc(var(--z-modal) - 1)',
      opacity: '0',
      transition: 'opacity 0.18s ease'
    });

    // Add overlay click handler
    this.overlay.addEventListener('click', this.closePopupHandler);

    // Create and add content
    this.popup.appendChild(this.createPopupHeader());
    this.contentContainer = this.createPopupContent();
    this.popup.appendChild(this.contentContainer);
  }

  createPopupHeader() {
    const header = this.createElement('div', 'votes-popup-header', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color)',
      paddingBottom: 'var(--space-sm)',
      marginBottom: 'var(--space-md)'
    });

    const title = this.createElement('h3', '', {
      color: 'var(--text-heading)',
      margin: 'var(--space-sm) 0'
    });
    title.textContent = 'Vote Details';

    const closeBtn = this.createElement('button', 'close-popup-btn', {
      backgroundColor: 'var(--background-lighter)',
      color: 'var(--text-color)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      padding: 'var(--space-xs) var(--space-sm)',
      fontSize: '1.5rem'
    });
    closeBtn.innerHTML = '&times;';

    // Add click handler for close button
    closeBtn.addEventListener('click', this.closePopupHandler);

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  createPopupContent() {
    const content = this.createElement('div', 'votes-popup-content');

    if (this.isLoadingVotes) {
      content.appendChild(this.createLoadingState());
      return content;
    }

    if (!this.post.active_votes || this.post.active_votes.length === 0) {
      content.appendChild(this.createNoVotesMessage());
      return content;
    }

    const totalPayoutValue = this.getPendingPayout(this.post);
    const totalVotingPower = this.calculateTotalVotingPower();
    const votesList = this.createVotesList(totalPayoutValue, totalVotingPower);

    content.appendChild(votesList);
    return content;
  }

  refreshPopupContent() {
    if (!this.contentContainer || !this.popup || !document.body.contains(this.popup)) return;

    const nextContent = this.createPopupContent();
    this.contentContainer.replaceWith(nextContent);
    this.contentContainer = nextContent;
  }

  createLoadingState() {
    const wrapper = this.createElement('div', 'votes-loading-wrapper', {
      padding: this.isMobile ? 'var(--space-sm) 0' : 'var(--space-md) 0'
    });

    const hint = this.createElement('div', 'votes-loading-hint', {
      color: 'var(--text-muted)',
      fontSize: '0.92rem',
      marginBottom: 'var(--space-sm)'
    }, 'Loading votes...');

    const list = this.createElement('div', 'votes-loading-list', {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const rows = this.isMobile ? 4 : 5;
    for (let i = 0; i < rows; i++) {
      list.appendChild(this.createLoadingRow());
    }

    wrapper.appendChild(hint);
    wrapper.appendChild(list);
    return wrapper;
  }

  createLoadingRow() {
    const row = this.createElement('div', 'votes-loading-row', {
      display: 'grid',
      gridTemplateColumns: this.isMobile ? '24px 1fr 74px' : '32px 1fr 96px 140px',
      alignItems: 'center',
      gap: '10px',
      padding: this.isMobile ? '8px 0' : '10px 0',
      borderBottom: '1px solid var(--border-color)'
    });

    const avatar = this.createElement('span', 'votes-loading-pulse', {
      width: this.isMobile ? '24px' : '32px',
      height: this.isMobile ? '24px' : '32px',
      borderRadius: '50%',
      background: 'var(--background-lighter)'
    });

    const name = this.createElement('span', 'votes-loading-pulse', {
      width: this.isMobile ? '120px' : '180px',
      height: '12px',
      borderRadius: '999px',
      background: 'var(--background-lighter)'
    });

    const value = this.createElement('span', 'votes-loading-pulse', {
      width: this.isMobile ? '64px' : '84px',
      justifySelf: 'end',
      height: '12px',
      borderRadius: '999px',
      background: 'var(--background-lighter)'
    });

    row.appendChild(avatar);
    row.appendChild(name);
    row.appendChild(value);

    if (!this.isMobile) {
      const time = this.createElement('span', 'votes-loading-pulse', {
        width: '120px',
        justifySelf: 'end',
        height: '12px',
        borderRadius: '999px',
        background: 'var(--background-lighter)'
      });
      row.appendChild(time);
    }

    return row;
  }

  ensureLoadingStyles() {
    if (document.getElementById('votes-popup-loading-style')) return;

    const style = document.createElement('style');
    style.id = 'votes-popup-loading-style';
    style.textContent = `
      @keyframes votes-popup-pulse {
        0% { opacity: 0.42; }
        50% { opacity: 0.8; }
        100% { opacity: 0.42; }
      }
      .votes-loading-pulse {
        animation: votes-popup-pulse 1.15s ease-in-out infinite;
      }
    `;

    document.head.appendChild(style);
  }

  createNoVotesMessage() {
    return this.createElement('p', 'no-votes', {
      color: 'var(--text-muted)',
      textAlign: 'center',
      padding: 'var(--space-md)'
    }, 'No votes on this post yet.');
  }

  calculateTotalVotingPower() {
    // Change to calculate total rshares instead of percent
    return this.post.active_votes.reduce((sum, vote) => {
      return sum + parseFloat(vote.rshares || 0);
    }, 0);
  }

  createVotesList(totalPayoutValue, totalVotingPower) {
    const votesList = this.createElement('ul', 'votes-list', {
      listStyle: 'none',
      padding: '0',
      margin: '0'
    });

    // Sort votes by rshares (voting power) rather than percent
    const sortedVotes = [...this.post.active_votes].sort((a, b) =>
      parseFloat(b.rshares || 0) - parseFloat(a.rshares || 0)
    );

    sortedVotes.forEach(vote => {
      votesList.appendChild(this.createVoteItem(vote, totalPayoutValue, totalVotingPower));
    });

    votesList.appendChild(this.createSummaryItem(totalPayoutValue));

    return votesList;
  }

  createVoteItem(vote, totalPayoutValue, totalVotingPower) {
    const voteItem = this.createElement('li', 'vote-item', {
      display: 'flex',
      flexWrap: this.isMobile ? 'wrap' : 'nowrap',
      justifyContent: 'space-between',
      alignItems: this.isMobile ? 'flex-start' : 'center',
      padding: this.isMobile ? 'var(--space-xs)' : 'var(--space-sm)',
      borderBottom: '1px solid var(--border-color)',
      transition: 'var(--transition-fast)'
    });

    const percentage = (vote.percent / 100).toFixed(2);
    const voteValue = this.calculateVoteValue(vote.rshares, totalVotingPower, totalPayoutValue);
    const formattedValue = voteValue.toFixed(3);

    const voterWrapper = this.createVoterWrapper(vote.voter);

    if (this.isMobile) {
      const infoTimeRow = this.createMobileInfoTimeRow(percentage, formattedValue, vote);
      voteItem.appendChild(voterWrapper);
      voteItem.appendChild(infoTimeRow);
    } else {
      const voteInfoWrapper = this.createVoteInfoWrapper(percentage, formattedValue, false);
      const timeWrapper = this.createTimeWrapper(vote.time, false);

      voteItem.appendChild(voterWrapper);
      voteItem.appendChild(voteInfoWrapper);
      voteItem.appendChild(timeWrapper);
    }

    this.addHoverEffect(voteItem);

    return voteItem;
  }

  createVoterWrapper(voter) {
    const voterWrapper = this.createElement('div', '', {
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: this.isMobile ? '100%' : 'auto',
      marginBottom: this.isMobile ? 'var(--space-xs)' : null
    });

    const avatarWrapper = this.createElement('div', '', {
      marginRight: 'var(--space-sm)'
    });

    const avatar = this.createElement('img', 'voter-avatar', {
      width: this.isMobile ? '24px' : '32px',
      height: this.isMobile ? '24px' : '32px',
      borderRadius: 'var(--radius-pill)',
      border: '2px solid var(--primary-color)',
      objectFit: 'cover',
      backgroundColor: 'var(--background-lighter)'
    });

    avatar.src = `https://steemitimages.com/u/${voter}/avatar`;
    avatar.alt = `${voter}'s avatar`;
    avatar.onerror = function () {
      this.src = 'https://steemitimages.com/u/default/avatar';
      this.onerror = null;
    };

    const voterName = this.createElement('span', 'voter-name', {
      color: 'var(--primary-color)',
      fontWeight: 'bold',
      textDecoration: 'none',
      cursor: 'pointer'
    }, voter);

    this.addProfileLinkBehavior(voterName, voter);

    avatarWrapper.appendChild(avatar);
    voterWrapper.appendChild(avatarWrapper);
    voterWrapper.appendChild(voterName);

    return voterWrapper;
  }

  addProfileLinkBehavior(element, username) {
    element.addEventListener('click', () => {
      // Close popup first
      this.close();
      // Then navigate
      router.navigate(`/@${username}`);
    });

    element.addEventListener('mouseover', () => {
      element.style.textDecoration = 'underline';
    });

    element.addEventListener('mouseout', () => {
      element.style.textDecoration = 'none';
    });
  }

  createVoteInfoWrapper(percentage, formattedValue, isMobile) {
    const voteInfoWrapper = this.createElement('div', '', {
      display: 'flex',
      flexDirection: isMobile ? 'row' : 'column',
      alignItems: isMobile ? 'center' : 'flex-end',
      justifyContent: isMobile ? 'flex-start' : 'center',
      minWidth: isMobile ? 'auto' : '100px',
      marginRight: isMobile ? 'var(--space-md)' : '0'
    });

    const isPositive = parseFloat(percentage) >= 0;
    const votePercentage = this.createElement('span', 'vote-percentage', {
      color: isPositive ? 'var(--secondary-color)' : 'var(--text-muted)'
    }, `${percentage}%`);

    const voteValueElem = this.createElement('span', 'vote-value', {
      color: 'var(--primary-light)',
      fontSize: '0.85em',
      marginLeft: isMobile ? 'var(--space-sm)' : null
    }, `${formattedValue} USD`);

    voteInfoWrapper.appendChild(votePercentage);
    voteInfoWrapper.appendChild(voteValueElem);

    return voteInfoWrapper;
  }

  createTimeWrapper(voteTime, isMobile) {
    const timeWrapper = this.createElement('div', '', {
      minWidth: isMobile ? 'auto' : '140px',
      textAlign: isMobile ? 'left' : 'right',
      paddingLeft: isMobile ? '0' : 'var(--space-md)',
      fontSize: isMobile ? '0.8em' : null,
      color: isMobile ? 'var(--text-muted)' : null
    });

    // Parse Steem vote timestamp robustly
    let voteDate;
    if (!voteTime) {
      voteDate = null;
    } else if (typeof voteTime === 'number') {
      // Unix timestamp: Steem uses seconds if < 1e10, else ms
      voteDate = new Date(voteTime < 1e10 ? voteTime * 1000 : voteTime);
    } else if (typeof voteTime === 'string') {
      // Steem timestamps are UTC but lack 'Z', e.g. "2020-01-01T12:00:00"
      const ts = voteTime.endsWith('Z') || voteTime.includes('+') ? voteTime : voteTime + 'Z';
      voteDate = new Date(ts);
    } else {
      voteDate = new Date(voteTime);
    }
    const isValidDate = voteDate && !isNaN(voteDate.getTime());
    const formattedDate = !isValidDate ? '—' : isMobile ?
      this.formatDateForMobile(voteDate) :
      voteDate.toLocaleString();

    const timeElement = this.createElement('span', 'vote-time', {
      color: 'var(--text-secondary)',
      fontSize: isMobile ? '0.9em' : '0.9em'
    }, formattedDate);

    timeWrapper.appendChild(timeElement);
    return timeWrapper;
  }

  createMobileInfoTimeRow(percentage, formattedValue, vote) {
    const infoTimeRow = this.createElement('div', '', {
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center'
    });

    const voteInfoWrapper = this.createVoteInfoWrapper(percentage, formattedValue, true);
    //dobbiamo adeguare votetime per tutti i fusi orari
    const timeWrapper = this.createTimeWrapper(vote.time, true);

    infoTimeRow.appendChild(voteInfoWrapper);
    infoTimeRow.appendChild(timeWrapper);

    return infoTimeRow;
  }

  createSummaryItem(totalPayoutValue) {
    const summaryItem = this.createElement('li', 'vote-summary', {
      padding: this.isMobile ? 'var(--space-sm)' : 'var(--space-md)',
      display: 'flex',
      justifyContent: 'space-between',
      borderTop: '2px solid var(--border-color)',
      marginTop: 'var(--space-sm)',
      fontWeight: 'bold'
    });

    const summaryLabel = this.createElement('span', '', {
      color: 'var(--text-heading)'
    }, 'Total Payout:');

    const summaryValue = this.createElement('span', '', {
      color: 'var(--primary-color)'
    }, `${totalPayoutValue} USD`);

    summaryItem.appendChild(summaryLabel);
    summaryItem.appendChild(summaryValue);

    return summaryItem;
  }

  calculateVoteValue(rshares, totalRshares, totalPayoutValue) {
    if (totalRshares <= 0) {
      return 0;
    }
    // Calculate vote value based on the proportion of rshares to total rshares
    return (parseFloat(rshares) / totalRshares) * parseFloat(totalPayoutValue);
  }

  addHoverEffect(element) {
    element.addEventListener('mouseover', () => {
      element.style.backgroundColor = 'var(--background-lighter)';
    });

    element.addEventListener('mouseout', () => {
      element.style.backgroundColor = 'transparent';
    });
  }

  createElement(tagName, className = '', styles = {}, textContent = '') {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    Object.entries(styles).forEach(([property, value]) => {
      if (value !== null) {
        element.style[property] = value;
      }
    });

    if (textContent) {
      element.textContent = textContent;
    }

    return element;
  }

  // New helper method to format dates on mobile
  formatDateForMobile(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    }

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays}d ago`;
    }

    // For older dates, show the date in short format
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
}

export default VotesPopup;
