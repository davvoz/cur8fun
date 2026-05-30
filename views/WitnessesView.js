import authService from '../services/AuthService.js';
import witnessService from '../services/WitnessService.js';
import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';

/**
 * /witnesses
 * Lets users see top Steem witnesses and approve / un-approve up to 30 of them.
 * cur8.witness is pinned at the top as a sponsored slot.
 */
class WitnessesView {
  constructor() {
    this.viewContainer = null;
    this.witnesses = [];
    this.extraApproved = []; // approved witnesses that are NOT in the top 100
    this.featuredWitness = null;
    this.approvedSet = new Set();
    this.proxy = '';
    this.isLoading = true;
    this.currentUser = authService.getCurrentUser();
    this.searchQuery = '';
    this.pendingVotes = new Set();
    this.proxyPending = false;

    this._onAuthChanged = this._onAuthChanged.bind(this);
  }

  async render(container) {
    container.innerHTML = '';
    this.viewContainer = document.createElement('div');
    this.viewContainer.className = 'witnesses-view';
    container.appendChild(this.viewContainer);

    this._renderHeader();
    this._renderFeaturedSlot();
    this._renderProxyPanel();
    this._renderToolbar();

    const listWrap = document.createElement('div');
    listWrap.className = 'witnesses-content';
    this.viewContainer.appendChild(listWrap);

    this._showLoading(listWrap);

    try {
      await this._loadData();
      this._renderList(listWrap);
      this._renderFeaturedSlot(); // re-render with vote state
      this._renderProxyPanel(); // re-render with proxy state
      this._renderHeader(); // refresh the counter
    } catch (err) {
      console.error('Failed to load witnesses:', err);
      this._showError(listWrap, 'Could not load witnesses. Please try again.');
    } finally {
      this.isLoading = false;
    }

    eventEmitter.on('auth:changed', this._onAuthChanged);
  }

  async _loadData() {
    const promoted = witnessService.PROMOTED_WITNESS;

    const [list, featured, approved, proxy] = await Promise.all([
      witnessService.getTopWitnesses(100),
      witnessService.getWitnessByAccount(promoted),
      this.currentUser
        ? witnessService.getApprovedWitnesses(this.currentUser.username)
        : Promise.resolve(new Set()),
      this.currentUser
        ? witnessService.getProxy(this.currentUser.username)
        : Promise.resolve(''),
    ]);

    this.witnesses = list;
    this.featuredWitness = featured;
    this.approvedSet = approved;
    this.proxy = proxy || '';

    await this._refreshExtras();
  }

  /**
   * Build the list of approved witnesses that aren't in the top 100 — so the
   * user can see and manage them too.
   */
  async _refreshExtras() {
    if (!this.currentUser || !this.approvedSet.size) {
      this.extraApproved = [];
      return;
    }
    const topOwners = new Set(this.witnesses.map(w => w.owner));
    const featuredOwner = this.featuredWitness?.owner;
    const extraNames = [...this.approvedSet].filter(n => !topOwners.has(n) && n !== featuredOwner);

    const cache = new Map(this.extraApproved.map(w => [w.owner, w]));
    const missing = extraNames.filter(n => !cache.has(n));

    if (missing.length) {
      const fetched = await Promise.all(missing.map(n => witnessService.getWitnessByAccount(n)));
      fetched.forEach(w => { if (w) cache.set(w.owner, w); });
    }

    this.extraApproved = extraNames
      .map(n => cache.get(n))
      .filter(Boolean);
  }

  _renderHeader() {
    let header = this.viewContainer.querySelector('.witnesses-header');
    if (header) header.remove();

    header = document.createElement('div');
    header.className = 'witnesses-header';

    const approvedCount = this.approvedSet?.size || 0;
    const max = witnessService.MAX_WITNESS_VOTES;

    header.innerHTML = `
      <div class="witnesses-title-row">
        <div>
          <h1><span class="material-icons">gavel</span> Steem Witnesses</h1>
          <p class="witnesses-subtitle">
            Witnesses run the nodes that produce blocks. Each account can approve up to ${max} of them — vote for who you trust to keep the chain healthy.
          </p>
        </div>
        ${this.currentUser ? `
          <div class="vote-counter ${approvedCount >= max ? 'is-full' : ''}">
            <div class="vote-counter-bar">
              <div class="vote-counter-fill" style="width:${(approvedCount / max) * 100}%"></div>
            </div>
            <div class="vote-counter-label">
              <strong>${approvedCount}</strong> / ${max} witness votes used
            </div>
          </div>
        ` : `
          <div class="vote-counter vote-counter-cta">
            <a href="/login" class="btn-primary">Log in to vote</a>
          </div>
        `}
      </div>
    `;

    this.viewContainer.insertBefore(header, this.viewContainer.firstChild);
  }

  _renderFeaturedSlot() {
    let slot = this.viewContainer.querySelector('.witness-featured-slot');
    if (slot) slot.remove();

    slot = document.createElement('section');
    slot.className = 'witness-featured-slot';

    const f = this.featuredWitness;
    const name = witnessService.PROMOTED_WITNESS;
    const isApproved = this.approvedSet.has(name);
    const isPending = this.pendingVotes.has(name);

    slot.innerHTML = `
      <div class="featured-card">
        <div class="featured-ribbon">
          <span class="material-icons">favorite</span> Support cur8.fun
        </div>
        <div class="featured-body">
          <img class="featured-avatar"
               src="https://steemitimages.com/u/${name}/avatar"
               alt="@${name}"
               onerror="this.src='https://steemitimages.com/u/default/avatar'">
          <div class="featured-info">
            <h2>@${name}</h2>
            <p class="featured-tagline">
              cur8.witness is the witness behind this app. Approving it helps keep cur8.fun and our community running. Every vote counts ❤️
            </p>
            <div class="featured-stats">
              ${f ? `
                <span class="stat"><span class="material-icons">how_to_vote</span> ${this._formatVotes(f.votesMv)} MV</span>
                <span class="stat"><span class="material-icons">update</span> v${f.runningVersion}</span>
                <span class="stat"><span class="material-icons">attach_money</span> ${f.priceFeed}</span>
              ` : `<span class="stat">Loading witness details…</span>`}
            </div>
          </div>
          <div class="featured-actions">
            ${this.currentUser ? `
              <button class="witness-vote-btn featured-vote-btn ${isApproved ? 'is-approved' : ''} ${isPending ? 'is-pending' : ''}"
                      data-witness="${name}"
                      ${isPending ? 'disabled' : ''}>
                ${isPending
                  ? '<span class="loading-spinner-sm"></span>'
                  : isApproved
                    ? '<span class="material-icons">check_circle</span> Voted'
                    : '<span class="material-icons">favorite</span> Vote for cur8.witness'}
              </button>
            ` : `
              <a href="/login" class="witness-vote-btn featured-vote-btn">
                <span class="material-icons">login</span> Log in to vote
              </a>
            `}
          </div>
        </div>
      </div>
    `;

    const headerEl = this.viewContainer.querySelector('.witnesses-header');
    if (headerEl && headerEl.nextSibling) {
      this.viewContainer.insertBefore(slot, headerEl.nextSibling);
    } else {
      this.viewContainer.appendChild(slot);
    }

    const btn = slot.querySelector('.witness-vote-btn[data-witness]');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleVoteClick(name, !isApproved);
      });
    }
  }

  _renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'witnesses-toolbar';
    toolbar.innerHTML = `
      <div class="witnesses-search">
        <span class="material-icons">search</span>
        <input type="text" id="witness-search" placeholder="Search witness in the list…" autocomplete="off">
      </div>
      <div class="witnesses-manual-vote">
        <span class="material-icons">how_to_vote</span>
        <input type="text" id="witness-manual" placeholder="Vote a witness by name…" autocomplete="off" ${this.currentUser ? '' : 'disabled'}>
        <button type="button" id="witness-manual-btn" class="manual-vote-btn" ${this.currentUser ? '' : 'disabled'}>
          Vote
        </button>
      </div>
    `;
    this.viewContainer.appendChild(toolbar);

    toolbar.querySelector('#witness-search').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      const listWrap = this.viewContainer.querySelector('.witnesses-content');
      if (listWrap) this._renderList(listWrap);
    });

    const manualInput = toolbar.querySelector('#witness-manual');
    const manualBtn = toolbar.querySelector('#witness-manual-btn');
    const submit = () => this._handleManualVote(manualInput, manualBtn);

    manualBtn.addEventListener('click', submit);
    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  async _handleManualVote(input, button) {
    if (!this.currentUser) {
      router.navigate('/login');
      return;
    }
    const raw = (input.value || '').trim().replace(/^@/, '').toLowerCase();
    if (!raw) {
      eventEmitter.emit('notification', { type: 'warning', message: 'Enter a witness account name' });
      input.focus();
      return;
    }
    if (this.pendingVotes.has(raw)) return;

    if (this.approvedSet.has(raw)) {
      eventEmitter.emit('notification', { type: 'info', message: `You already vote for @${raw}` });
      return;
    }
    if (this.approvedSet.size >= witnessService.MAX_WITNESS_VOTES) {
      eventEmitter.emit('notification', {
        type: 'warning',
        message: `You already use all ${witnessService.MAX_WITNESS_VOTES} witness votes. Remove one first.`,
      });
      return;
    }

    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner-sm"></span>';
    input.disabled = true;

    try {
      const witness = await witnessService.getWitnessByAccount(raw);
      if (!witness) {
        eventEmitter.emit('notification', {
          type: 'error',
          message: `@${raw} is not a witness (or the account doesn't exist).`,
        });
        return;
      }

      await this._handleVoteClick(raw, true);
      input.value = '';
    } catch (err) {
      // notifications already emitted upstream
    } finally {
      button.disabled = false;
      button.innerHTML = originalLabel;
      input.disabled = false;
    }
  }

  _renderProxyPanel() {
    let panel = this.viewContainer.querySelector('.witness-proxy-panel');
    if (panel) panel.remove();

    this.viewContainer.classList.toggle('has-active-proxy', !!this.proxy);

    panel = document.createElement('div');
    panel.className = 'witness-proxy-panel';

    if (!this.currentUser) {
      panel.innerHTML = `
        <a href="/login" class="proxy-link">
          <span class="material-icons">supervisor_account</span>
          Log in to set a witness proxy
        </a>
      `;
    } else if (this.proxy) {
      panel.innerHTML = `
        <button type="button" class="proxy-link has-proxy" id="proxy-open-btn">
          <span class="material-icons">supervisor_account</span>
          Voting through <strong>@${this.proxy}</strong>
          <span class="proxy-link-change">change</span>
        </button>
      `;
    } else {
      panel.innerHTML = `
        <button type="button" class="proxy-link" id="proxy-open-btn">
          <span class="material-icons">supervisor_account</span>
          Set a witness proxy
        </button>
      `;
    }

    const slot = this.viewContainer.querySelector('.witness-featured-slot');
    if (slot && slot.nextSibling) {
      this.viewContainer.insertBefore(panel, slot.nextSibling);
    } else {
      this.viewContainer.appendChild(panel);
    }

    panel.querySelector('#proxy-open-btn')?.addEventListener('click', () => this._openProxyModal());
  }

  _openProxyModal() {
    // Remove any existing instance
    document.querySelector('.witness-proxy-modal')?.remove();

    const hasProxy = !!this.proxy;
    const overlay = document.createElement('div');
    overlay.className = 'witness-proxy-modal modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog standard-dialog compact">
        <div class="modal-header">
          <h3>
            <span class="material-icons">supervisor_account</span>
            Witness proxy
          </h3>
          <button class="close-button" type="button" aria-label="Close">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          ${hasProxy ? `
            <p class="dialog-message">
              You're currently voting through <a href="/@${this.proxy}" class="proxy-name">@${this.proxy}</a>.
              Your own witness votes are ignored while a proxy is active.
            </p>
          ` : `
            <p class="dialog-message">
              Don't want to pick 30 witnesses yourself? Delegate your votes to another account — they'll vote on your behalf.
            </p>
          `}
          <label class="proxy-modal-label" for="proxy-modal-input">Account name</label>
          <input type="text" id="proxy-modal-input" placeholder="e.g. cur8" autocomplete="off" value="${hasProxy ? this.proxy : ''}">
        </div>
        <div class="modal-footer">
          ${hasProxy ? `
            <button type="button" class="btn danger-btn" id="proxy-modal-clear">
              <span class="material-icons">link_off</span> Clear proxy
            </button>
          ` : ''}
          <button type="button" class="btn secondary-btn" id="proxy-modal-cancel">
            <span class="material-icons">close</span> Cancel
          </button>
          <button type="button" class="btn primary-btn" id="proxy-modal-set">
            <span class="material-icons">check</span> ${hasProxy ? 'Update' : 'Set proxy'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-button')?.addEventListener('click', close);
    overlay.querySelector('#proxy-modal-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const input = overlay.querySelector('#proxy-modal-input');
    const submit = async () => {
      const value = (input.value || '').trim();
      if (!value) {
        eventEmitter.emit('notification', { type: 'warning', message: 'Enter an account name first' });
        input.focus();
        return;
      }
      close();
      await this._handleProxyChange(value);
    };

    overlay.querySelector('#proxy-modal-set')?.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') close();
    });

    overlay.querySelector('#proxy-modal-clear')?.addEventListener('click', async () => {
      close();
      await this._handleProxyChange('');
    });

    setTimeout(() => input.focus(), 0);
  }

  async _handleProxyChange(value) {
    if (this.proxyPending) return;
    this.proxyPending = true;
    this._renderProxyPanel();

    try {
      await witnessService.setProxy(value);
      this.proxy = value.trim().replace(/^@/, '').toLowerCase();
      if (this.currentUser) {
        this.approvedSet = await witnessService.getApprovedWitnesses(this.currentUser.username);
      }
    } catch (err) {
      // notification already emitted
    } finally {
      this.proxyPending = false;
      this._renderProxyPanel();
      this._renderHeader();
      const listWrap = this.viewContainer.querySelector('.witnesses-content');
      if (listWrap) this._renderList(listWrap);
      this._renderFeaturedSlot();
    }
  }

  _renderList(container) {
    container.innerHTML = '';

    const filtered = this.searchQuery
      ? this.witnesses.filter(w => w.owner.toLowerCase().includes(this.searchQuery))
      : this.witnesses;

    const extras = this.extraApproved.length && this.searchQuery
      ? this.extraApproved.filter(w => w.owner.toLowerCase().includes(this.searchQuery))
      : this.extraApproved;

    if (!filtered.length && !extras.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">search_off</span>
          <p>No witnesses match "${this.searchQuery}"</p>
        </div>`;
      return;
    }

    if (filtered.length) {
      const table = document.createElement('div');
      table.className = 'witnesses-table';
      table.innerHTML = this._tableHeaderHtml();

      const rankByOwner = new Map();
      this.witnesses.forEach((w, i) => rankByOwner.set(w.owner, i + 1));

      filtered.forEach((w) => {
        table.appendChild(this._createRow(w, rankByOwner.get(w.owner) ?? '—'));
      });

      container.appendChild(table);
    }

    // Extras section (approved witnesses outside the top 100) — rendered after the main table
    if (extras.length) {
      const extrasWrap = document.createElement('div');
      extrasWrap.className = 'witnesses-extras';
      extrasWrap.innerHTML = `
        <div class="extras-title">
          <span class="material-icons">bookmark</span>
          Your other voted witnesses
          <span class="extras-hint">(outside top 100)</span>
        </div>
      `;

      const extrasTable = document.createElement('div');
      extrasTable.className = 'witnesses-table witnesses-table-extras';
      extrasTable.innerHTML = this._tableHeaderHtml();
      extras.forEach(w => extrasTable.appendChild(this._createRow(w, '—')));

      extrasWrap.appendChild(extrasTable);
      container.appendChild(extrasWrap);
    }
  }

  _tableHeaderHtml() {
    return `
      <div class="witnesses-table-header">
        <div class="col col-rank">#</div>
        <div class="col col-witness">Witness</div>
        <div class="col col-votes">Votes (MV)</div>
        <div class="col col-version">Version</div>
        <div class="col col-feed">Price Feed</div>
        <div class="col col-missed">Missed</div>
        <div class="col col-action">Vote</div>
      </div>
    `;
  }

  _createRow(w, rank) {
    const row = document.createElement('div');
    const isApproved = this.approvedSet.has(w.owner);
    const isPending = this.pendingVotes.has(w.owner);
    const isPromoted = w.owner === witnessService.PROMOTED_WITNESS;

    row.className = `witness-row ${isApproved ? 'is-approved' : ''} ${isPromoted ? 'is-promoted' : ''}`;
    row.innerHTML = `
      <div class="col col-rank">${rank}</div>
      <div class="col col-witness">
        <img class="witness-avatar"
             src="https://steemitimages.com/u/${w.owner}/avatar"
             alt="@${w.owner}"
             onerror="this.src='https://steemitimages.com/u/default/avatar'">
        <div class="witness-id">
          <a href="/@${w.owner}" class="witness-name">@${w.owner}</a>
          ${isPromoted ? '<span class="promoted-badge">cur8</span>' : ''}
          ${w.url ? `<a href="${w.url}" class="witness-url" target="_blank" rel="noopener noreferrer" title="Witness post"><span class="material-icons">link</span></a>` : ''}
        </div>
      </div>
      <div class="col col-votes">${this._formatVotes(w.votesMv)}</div>
      <div class="col col-version">${w.runningVersion}</div>
      <div class="col col-feed">${w.priceFeed}</div>
      <div class="col col-missed">${w.totalMissed.toLocaleString()}</div>
      <div class="col col-action">
        ${this.currentUser ? `
          <button class="witness-vote-btn ${isApproved ? 'is-approved' : ''} ${isPending ? 'is-pending' : ''}"
                  data-witness="${w.owner}"
                  title="${isApproved ? 'Remove vote' : 'Vote for this witness'}"
                  ${isPending ? 'disabled' : ''}>
            ${isPending
              ? '<span class="loading-spinner-sm"></span>'
              : isApproved
                ? '<span class="material-icons">check_circle</span>'
                : '<span class="material-icons">how_to_vote</span>'}
          </button>
        ` : `
          <a href="/login" class="witness-vote-btn" title="Log in to vote">
            <span class="material-icons">how_to_vote</span>
          </a>
        `}
      </div>
    `;

    const btn = row.querySelector('.witness-vote-btn[data-witness]');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleVoteClick(w.owner, !isApproved);
      });
    }

    return row;
  }

  async _handleVoteClick(witnessName, approve) {
    if (!this.currentUser) {
      router.navigate('/login');
      return;
    }
    if (this.pendingVotes.has(witnessName)) return;

    if (approve && this.approvedSet.size >= witnessService.MAX_WITNESS_VOTES) {
      eventEmitter.emit('notification', {
        type: 'warning',
        message: `You already use all ${witnessService.MAX_WITNESS_VOTES} witness votes. Remove one first.`,
      });
      return;
    }

    this.pendingVotes.add(witnessName);
    this._refreshRowsFor(witnessName);

    try {
      await witnessService.voteForWitness(witnessName, approve);

      if (approve) this.approvedSet.add(witnessName);
      else this.approvedSet.delete(witnessName);

      await this._refreshExtras();
    } catch (err) {
      // notification already emitted by service
    } finally {
      this.pendingVotes.delete(witnessName);
      this._refreshRowsFor(witnessName);
      this._renderHeader();
      this._renderFeaturedSlot();
    }
  }

  _refreshRowsFor(witnessName) {
    const listWrap = this.viewContainer.querySelector('.witnesses-content');
    if (!listWrap) return;

    // Cheap: re-render the visible list (filtered) so vote-state reflects.
    this._renderList(listWrap);
  }

  _formatVotes(mv) {
    if (!mv && mv !== 0) return '—';
    return mv.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }

  _showLoading(container) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading witnesses…</p>
      </div>
    `;
  }

  _showError(container, message) {
    container.innerHTML = `
      <div class="error-container">
        <span class="material-icons">error</span>
        <p>${message}</p>
        <button id="witness-retry" class="primary-btn">Retry</button>
      </div>
    `;
    container.querySelector('#witness-retry')?.addEventListener('click', () => {
      this._showLoading(container);
      this._loadData()
        .then(() => {
          this._renderList(container);
          this._renderFeaturedSlot();
          this._renderHeader();
        })
        .catch(() => this._showError(container, message));
    });
  }

  _onAuthChanged() {
    this.currentUser = authService.getCurrentUser();
    if (!this.viewContainer) return;

    const listWrap = this.viewContainer.querySelector('.witnesses-content');
    if (!listWrap) return;

    if (this.currentUser) {
      Promise.all([
        witnessService.getApprovedWitnesses(this.currentUser.username),
        witnessService.getProxy(this.currentUser.username),
      ]).then(async ([set, proxy]) => {
        this.approvedSet = set;
        this.proxy = proxy || '';
        await this._refreshExtras();
        this._renderList(listWrap);
        this._renderFeaturedSlot();
        this._renderProxyPanel();
        this._renderHeader();
      });
    } else {
      this.approvedSet = new Set();
      this.proxy = '';
      this.extraApproved = [];
      this._renderList(listWrap);
      this._renderFeaturedSlot();
      this._renderProxyPanel();
      this._renderHeader();
    }
  }

  onBeforeUnmount() {
    eventEmitter.off('auth:changed', this._onAuthChanged);
  }
}

export default WitnessesView;
