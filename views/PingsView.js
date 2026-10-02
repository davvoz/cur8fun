import View from './View.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';
import pingsService from '../services/PingsService.js';
import VoteController from '../controllers/VoteController.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import PingComposer from '../components/pings/PingComposer.js';
import { createPingCard } from '../components/pings/PingCard.js';
import { createPingsLayout } from '../components/pings/PingsSidebar.js';
import { PINGS_CONFIG } from '../config/pings.js';

// Each batch scans up to a week of walls (see PingsService.loadMore)
const MAX_EMPTY_BATCHES = 3;
// How often the feed checks for pings published since it loaded
const NEW_PINGS_POLL_MS = 60 * 1000;

const TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'following', label: 'Following' }
];

/**
 * Pings feed: composer on top, newest pings from the latest walls below.
 * With a `tag` route param it shows only the pings carrying that hashtag.
 */
class PingsView extends View {
  constructor(params = {}) {
    super(params);
    this.voteController = new VoteController(this);
    this.tag = params.tag ? decodeURIComponent(params.tag).toLowerCase() : null;
    this.activeTab = 'latest';
    this.feed = null;
    this.infiniteScroll = null;
    this.renderedKeys = new Set();
    this.pings = []; // rendered pings in display order, cached for back navigation
    this.hasMore = false;
    this.loadToken = 0;
    this.pendingNew = []; // newer pings waiting behind the "N new pings" pill
    this.pollTimer = null;
    this.onVisibilityChange = () => {
      if (document.visibilityState === 'visible') this.checkNewPings();
    };
    // Composer and Following tab depend on the logged-in user
    this.subscribe('auth:changed', () => {
      if (this.element) this.render(this.element);
    });
  }

  async render(element) {
    this.element = element;
    // Back navigation: rebuild the feed from cache instead of reloading it
    const cached = router.isBackNavigation ? router.viewStateCache.get(this.cacheKey()) : null;
    if (cached) this.activeTab = cached.activeTab;

    document.title = this.tag
      ? `#${this.tag} · ${PINGS_CONFIG.label} | cur8.fun`
      : `${PINGS_CONFIG.label} | cur8.fun`;
    if (!authService.getCurrentUser()) this.activeTab = 'latest';
    while (element.firstChild) element.removeChild(element.firstChild);

    const page = document.createElement('div');
    page.className = 'pings-page';

    page.appendChild(this.createHeader());

    const composer = new PingComposer({
      initialText: this.composerInitialText(),
      onSubmit: (draft) => this.publishPing(draft)
    });
    const composerEl = composer.render();
    page.appendChild(composerEl);

    this.list = document.createElement('div');
    this.list.className = 'pings-list';
    page.appendChild(this.list);

    // InfiniteScroll appends its sentinel/messages here, after the list
    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'pings-scroll-area';
    page.appendChild(this.scrollArea);

    element.appendChild(createPingsLayout(page));
    this.setupComposeFab(composerEl, page);

    if (cached && cached.pings.length) {
      this.restoreState(cached);
    } else {
      await this.loadFeed();
    }
    this.startNewPingsWatcher();
  }

  cacheKey() {
    return `pings:${router.currentPath}`;
  }

  composerInitialText() {
    return this.tag ? `#${this.tag} ` : '';
  }

  async publishPing({ text, images }) {
    const ping = await pingsService.publishPing({ text, images });
    if (!this.filterFn || this.filterFn(ping)) this.prependPing(ping);
    this.emit('notification', { type: 'success', message: 'Ping sent!' });
  }

  /**
   * Floating "new ping" button, shown once the inline composer has scrolled
   * out of view. Mounted on #app: the layout's container query would trap a
   * fixed element inside the feed column. It is kept aligned to the feed
   * column, so on desktop it doesn't cover the sidebars.
   */
  setupComposeFab(composerEl, page) {
    this.destroyComposeFab();
    const main = document.getElementById('main-content');
    if (!authService.getCurrentUser() || !main) return;

    this.composeFab = document.createElement('button');
    this.composeFab.type = 'button';
    this.composeFab.className = 'pings-compose-fab';
    this.composeFab.title = 'New ping';
    this.composeFab.setAttribute('aria-label', 'New ping');
    this.composeFab.innerHTML = '<span class="material-icons">edit</span>';
    this.composeFab.addEventListener('click', () => this.openComposeDialog());
    (document.getElementById('app') || document.body).appendChild(this.composeFab);

    this.composerObserver = new IntersectionObserver(([entry]) => {
      this.composeFab?.classList.toggle('is-visible', !entry.isIntersecting);
    }, { root: main });
    this.composerObserver.observe(composerEl);

    // Window resizes move the centered column; layout resizes cover the
    // sidebars appearing or the app's side nav collapsing
    this.alignComposeFab = () => {
      if (!this.composeFab || !page.isConnected) return;
      const inset = Math.max(0, document.documentElement.clientWidth - page.getBoundingClientRect().right);
      this.composeFab.style.setProperty('--pings-fab-inset', `${inset}px`);
      // Near the window corner it shares the spot with the back-to-top button
      this.composeFab.classList.toggle('pings-compose-fab--corner', inset < 60);
    };
    this.layoutObserver = new ResizeObserver(this.alignComposeFab);
    this.layoutObserver.observe(page.closest('.pings-layout') || page);
    window.addEventListener('resize', this.alignComposeFab);
  }

  destroyComposeFab() {
    this.composerObserver?.disconnect();
    this.composerObserver = null;
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    if (this.alignComposeFab) window.removeEventListener('resize', this.alignComposeFab);
    this.alignComposeFab = null;
    this.composeFab?.remove();
    this.composeFab = null;
    this.closeComposeDialog?.();
  }

  openComposeDialog() {
    if (this.closeComposeDialog) return;

    const overlay = document.createElement('div');
    overlay.className = 'pings-compose-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'New ping');

    const panel = document.createElement('div');
    panel.className = 'pings-compose-dialog-panel';

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      this.closeComposeDialog = null;
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && !composer.submitting) close();
    };

    const composer = new PingComposer({
      initialText: this.composerInitialText(),
      onSubmit: async (draft) => {
        await this.publishPing(draft);
        close();
      },
      onCancel: close
    });
    panel.appendChild(composer.render());

    // Backdrop click closes, unless a ping is being sent
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !composer.submitting) close();
    });
    document.addEventListener('keydown', onKey);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.closeComposeDialog = close;
    composer.focus();
  }

  /**
   * Called by the router before navigating away (see Router.navigate).
   */
  saveState() {
    if (!this.feed || this.pings.length === 0) return;
    router.viewStateCache.set(this.cacheKey(), {
      feed: this.feed,
      pings: this.pings,
      hasMore: this.hasMore,
      activeTab: this.activeTab,
      filterFn: this.filterFn,
      anchor: this.getScrollAnchor()
    });
  }

  restoreState(state) {
    const token = ++this.loadToken;
    this.feed = state.feed;
    this.filterFn = state.filterFn;
    this.hasMore = state.hasMore;
    this.appendPings(state.pings);
    if (this.hasMore) this.startInfiniteScroll(token);

    // The anchor is more reliable than the router's raw scrollTop because
    // images may still be reloading and change the page height
    const fallbackTop = router.pendingScrollRestore;
    router.pendingScrollRestore = undefined;
    this.restoreScroll(state.anchor, fallbackTop);
  }

  /**
   * First ping visible at the top of the scroll area, with its offset.
   */
  getScrollAnchor() {
    const main = document.getElementById('main-content');
    if (!main || !this.list) return null;
    const top = main.getBoundingClientRect().top;
    const card = [...this.list.children].find(c => c.getBoundingClientRect().bottom > top);
    if (!card) return null;
    return {
      author: card.dataset.author,
      permlink: card.dataset.permlink,
      offset: card.getBoundingClientRect().top - top
    };
  }

  restoreScroll(anchor, fallbackTop) {
    const main = document.getElementById('main-content');
    if (!main) return;

    const apply = () => {
      const card = anchor && [...this.list.children].find(c =>
        c.dataset.author === anchor.author && c.dataset.permlink === anchor.permlink);
      if (card) {
        main.scrollTop += card.getBoundingClientRect().top - main.getBoundingClientRect().top - anchor.offset;
      } else if (typeof fallbackTop === 'number') {
        main.scrollTop = fallbackTop;
      }
    };

    // Re-apply while images settle, unless the user starts scrolling
    let userScrolled = false;
    const stop = () => { userScrolled = true; };
    main.addEventListener('wheel', stop, { once: true, passive: true });
    main.addEventListener('touchstart', stop, { once: true, passive: true });
    requestAnimationFrame(apply);
    [150, 400, 800, 1500].forEach(ms => setTimeout(() => {
      if (!userScrolled && this.list?.isConnected) apply();
    }, ms));
  }

  createHeader() {
    const header = document.createElement('div');
    header.className = 'pings-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'pings-title-row';

    if (this.tag) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'ping-icon-btn';
      back.title = 'Back';
      back.innerHTML = '<span class="material-icons">arrow_back</span>';
      back.addEventListener('click', () => {
        if (router.navigationHistory.length > 1) router.goBack();
        else router.navigate(PINGS_CONFIG.path);
      });
      titleRow.appendChild(back);
    }

    // Brand block; clicking it scrolls the feed back to the top
    const brand = document.createElement('button');
    brand.type = 'button';
    brand.className = 'pings-brand';
    brand.title = 'Back to top';
    const brandText = document.createElement('span');
    brandText.className = 'pings-brand-text';
    const title = document.createElement('h1');
    title.className = 'pings-title';
    title.textContent = this.tag ? `#${this.tag}` : PINGS_CONFIG.label;
    const subtitle = document.createElement('span');
    subtitle.className = 'pings-subtitle';
    subtitle.textContent = this.tag ? 'Pings with this hashtag' : 'Short posts from the Steem community';
    brandText.append(title, subtitle);
    brand.appendChild(brandText);
    brand.addEventListener('click', () => this.scrollToTop());
    titleRow.appendChild(brand);

    header.appendChild(titleRow);

    // "N new pings" pill, hanging just below the sticky header
    this.newPill = document.createElement('button');
    this.newPill.type = 'button';
    this.newPill.className = 'pings-new-pill';
    this.newPill.hidden = true;
    this.newPill.addEventListener('click', () => this.showPendingNew());
    header.appendChild(this.newPill);

    // Following needs a user; with a single tab there is nothing to switch
    if (this.tag || !authService.getCurrentUser()) return header;

    const tabs = document.createElement('div');
    tabs.className = 'pings-tabs';
    tabs.setAttribute('role', 'tablist');

    TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pings-tab';
      btn.setAttribute('role', 'tab');
      btn.textContent = tab.label;
      btn.classList.toggle('active', tab.id === this.activeTab);
      btn.addEventListener('click', () => {
        if (tab.id === this.activeTab) {
          this.scrollToTop();
          return;
        }
        this.activeTab = tab.id;
        tabs.querySelectorAll('.pings-tab').forEach(b => b.classList.toggle('active', b === btn));
        this.loadFeed();
      });
      tabs.appendChild(btn);
    });

    header.appendChild(tabs);
    return header;
  }

  scrollToTop() {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startNewPingsWatcher() {
    this.stopNewPingsWatcher();
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') this.checkNewPings();
    }, NEW_PINGS_POLL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  stopNewPingsWatcher() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Looks for pings newer than the newest one shown and offers them in the pill.
   */
  async checkNewPings() {
    if (!this.feed || this.pings.length === 0 || this.checkingNew) return;
    this.checkingNew = true;
    const token = this.loadToken;
    try {
      const newest = this.pings.reduce((max, p) => (p.created > max ? p.created : max), this.pings[0].created);
      const fresh = await pingsService.getNewPings(newest, this.filterFn);
      if (token !== this.loadToken) return; // feed reloaded meanwhile
      this.pendingNew = fresh.filter(p => !this.renderedKeys.has(`${p.author}/${p.permlink}`));
      this.updateNewPill();
    } catch (error) {
      console.warn('Could not check for new pings:', error);
    } finally {
      this.checkingNew = false;
    }
  }

  updateNewPill() {
    if (!this.newPill) return;
    const count = this.pendingNew.length;
    this.newPill.hidden = count === 0;
    if (count === 0) return;

    this.newPill.innerHTML = '<span class="material-icons">arrow_upward</span>';
    const avatars = document.createElement('span');
    avatars.className = 'pings-new-avatars';
    [...new Set(this.pendingNew.map(p => p.author))].slice(0, 3).forEach(author => {
      const img = document.createElement('img');
      img.src = `https://steemitimages.com/u/${author}/avatar/small`;
      img.alt = '';
      avatars.appendChild(img);
    });
    this.newPill.append(avatars, count === 1 ? '1 new ping' : `${count} new pings`);
  }

  showPendingNew() {
    // Prepend oldest first so the newest ends up on top
    [...this.pendingNew].reverse().forEach(ping => this.prependPing(ping));
    this.pendingNew = [];
    this.updateNewPill();
    this.scrollToTop();
  }

  async loadFeed() {
    const token = ++this.loadToken;
    this.pendingNew = [];
    this.updateNewPill();

    this.destroyInfiniteScroll();
    this.feed = pingsService.createFeed();
    this.renderedKeys.clear();
    this.pings = [];
    this.hasMore = false;
    this.list.innerHTML = '';
    this.scrollArea.innerHTML = '';
    this.showStatus('Loading pings…', 'loading');

    try {
      this.filterFn = await this.getFilter();
      const { pings, hasMore } = await this.fetchBatch();
      if (token !== this.loadToken) return; // tab switched meanwhile

      this.clearStatus();
      if (this.feed.walls.length === 0) {
        this.showStatus(`${PINGS_CONFIG.label} are warming up — the first wall will be published soon.`, 'empty');
        return;
      }
      this.appendPings(pings);
      if (pings.length === 0) {
        this.showStatus(this.getEmptyMessage(), 'empty');
        return;
      }

      this.hasMore = hasMore;
      if (hasMore) this.startInfiniteScroll(token);
    } catch (error) {
      if (token !== this.loadToken) return;
      console.error('Failed to load pings:', error);
      this.showStatus('Failed to load pings. Please try again.', 'error');
    }
  }

  startInfiniteScroll(token) {
    this.infiniteScroll = new InfiniteScroll({
      container: this.scrollArea,
      loadMore: () => this.loadNextPage(token),
      threshold: '400px',
      loadingMessage: 'Loading more pings…',
      endMessage: "You're all caught up",
      errorMessage: 'Failed to load pings. Please check your connection.'
    });
  }

  async loadNextPage(token) {
    const { pings, hasMore } = await this.fetchBatch();
    if (token !== this.loadToken) return false;
    this.appendPings(pings);
    // An empty batch would leave the sentinel in view without re-triggering
    // the observer, so treat it as the end of the feed
    this.hasMore = hasMore && pings.length > 0;
    return this.hasMore;
  }

  /**
   * Loads the next non-empty batch. A filtered feed (Following) can have
   * several days without matches, so a few batches are tried before giving up.
   */
  async fetchBatch() {
    let result;
    for (let attempt = 0; attempt < MAX_EMPTY_BATCHES; attempt++) {
      result = await pingsService.loadMore(this.feed, this.filterFn);
      if (result.pings.length > 0 || !result.hasMore) break;
    }
    return result;
  }

  getEmptyMessage() {
    if (this.tag) return `No pings with #${this.tag} recently.`;
    if (this.activeTab === 'following') return 'Nobody you follow has pinged recently.';
    return 'No pings yet. Be the first!';
  }

  async getFilter() {
    if (this.tag) return (ping) => pingsService.matchesTag(ping, this.tag);
    if (this.activeTab !== 'following') return null;
    const user = authService.getCurrentUser();
    if (!user) return null;
    const following = await pingsService.getFollowingSet(user.username);
    return (ping) => following.has(ping.author) || ping.author === user.username;
  }

  appendPings(pings) {
    pings.forEach(ping => {
      const key = `${ping.author}/${ping.permlink}`;
      if (this.renderedKeys.has(key)) return;
      this.renderedKeys.add(key);
      this.pings.push(ping);
      this.list.appendChild(this.createCard(ping));
    });
  }

  prependPing(ping) {
    const key = `${ping.author}/${ping.permlink}`;
    if (this.renderedKeys.has(key)) return;
    this.renderedKeys.add(key);
    this.pings.unshift(ping);
    this.clearStatus();
    const card = this.createCard(ping);
    card.classList.add('ping-card--new');
    this.list.prepend(card);
  }

  createCard(ping) {
    return createPingCard(ping, {
      voteController: this.voteController,
      onDeleted: (deleted, card) => {
        this.pings = this.pings.filter(p => p !== deleted);
        this.renderedKeys.delete(`${deleted.author}/${deleted.permlink}`);
        card.remove();
      }
    });
  }

  showStatus(message, type) {
    this.clearStatus();
    const status = document.createElement('div');
    status.className = `pings-status pings-status--${type}`;
    status.textContent = message;
    this.list.before(status);
  }

  clearStatus() {
    this.element?.querySelectorAll('.pings-status').forEach(el => el.remove());
  }

  destroyInfiniteScroll() {
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }

  unmount() {
    this.loadToken++;
    this.stopNewPingsWatcher();
    this.destroyInfiniteScroll();
    this.destroyComposeFab();
    this.voteController.cleanup();
    super.unmount();
  }
}

export default PingsView;
