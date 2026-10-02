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
      initialText: this.tag ? `#${this.tag} ` : '',
      onSubmit: async ({ text, images }) => {
        const ping = await pingsService.publishPing({ text, images });
        if (!this.filterFn || this.filterFn(ping)) this.prependPing(ping);
        this.emit('notification', { type: 'success', message: 'Ping sent!' });
      }
    });
    page.appendChild(composer.render());

    this.list = document.createElement('div');
    this.list.className = 'pings-list';
    page.appendChild(this.list);

    // InfiniteScroll appends its sentinel/messages here, after the list
    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'pings-scroll-area';
    page.appendChild(this.scrollArea);

    element.appendChild(createPingsLayout(page));

    if (cached && cached.pings.length) {
      this.restoreState(cached);
    } else {
      await this.loadFeed();
    }
  }

  cacheKey() {
    return `pings:${router.currentPath}`;
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

    const title = document.createElement('h1');
    title.className = 'pings-title';
    title.textContent = this.tag ? `#${this.tag}` : PINGS_CONFIG.label;

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
      title.classList.add('pings-title--grow');
    }

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'ping-icon-btn';
    refresh.title = 'Refresh';
    refresh.innerHTML = '<span class="material-icons">refresh</span>';
    refresh.addEventListener('click', () => {
      pingsService.clearCache();
      this.loadFeed();
    });

    titleRow.append(title, refresh);
    header.appendChild(titleRow);

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
        if (tab.id === this.activeTab) return;
        this.activeTab = tab.id;
        tabs.querySelectorAll('.pings-tab').forEach(b => b.classList.toggle('active', b === btn));
        this.loadFeed();
      });
      tabs.appendChild(btn);
    });

    header.appendChild(tabs);
    return header;
  }

  async loadFeed() {
    const token = ++this.loadToken;

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
    this.destroyInfiniteScroll();
    this.voteController.cleanup();
    super.unmount();
  }
}

export default PingsView;
