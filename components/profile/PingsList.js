import pingsService from '../../services/PingsService.js';
import VoteController from '../../controllers/VoteController.js';
import eventEmitter from '../../utils/EventEmitter.js';
import InfiniteScroll from '../../utils/InfiniteScroll.js';
import { createPingCard } from '../pings/PingCard.js';

// Each batch scans up to 300 of the user's comments (see PingsService.loadUserPings)
const MAX_EMPTY_BATCHES = 3;

/**
 * Profile tab listing the pings written by a user.
 */
export default class PingsList {
  constructor(username) {
    this.username = username;
    this.container = null;
    this.infiniteScroll = null;
    this.loadToken = 0;
    // VoteController only needs emit() from its host view
    this.voteController = new VoteController({
      emit: (event, data) => eventEmitter.emit(event, data)
    });
  }

  render(container) {
    // Already loaded in this container: keep the list and scroll position
    if (this.container === container && container.querySelector('.pings-list')) return;

    this.container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'pings-page pings-profile';

    this.list = document.createElement('div');
    this.list.className = 'pings-list';
    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'pings-scroll-area';

    wrapper.append(this.list, this.scrollArea);
    container.appendChild(wrapper);

    return this.load();
  }

  async load() {
    const token = ++this.loadToken;
    this.destroyInfiniteScroll();
    this.feed = pingsService.createUserFeed(this.username);
    this.showStatus('Loading pings…', 'loading');

    try {
      const { pings, hasMore } = await this.fetchBatch();
      if (token !== this.loadToken) return;

      this.clearStatus();
      if (pings.length === 0) {
        this.showStatus(`@${this.username} hasn't pinged yet.`, 'empty');
        return;
      }
      this.appendPings(pings);

      if (hasMore) {
        this.infiniteScroll = new InfiniteScroll({
          container: this.scrollArea,
          loadMore: async () => {
            const next = await this.fetchBatch();
            if (token !== this.loadToken) return false;
            this.appendPings(next.pings);
            // An empty batch would stall the observer: treat it as the end
            return next.hasMore && next.pings.length > 0;
          },
          threshold: '400px',
          loadingMessage: 'Loading more pings…',
          endMessage: 'No more pings',
          errorMessage: 'Failed to load pings. Please check your connection.'
        });
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      console.error('Failed to load user pings:', error);
      this.showStatus('Failed to load pings. Please try again.', 'error');
    }
  }

  async fetchBatch() {
    let result;
    for (let attempt = 0; attempt < MAX_EMPTY_BATCHES; attempt++) {
      result = await pingsService.loadUserPings(this.feed);
      if (result.pings.length > 0 || !result.hasMore) break;
    }
    return result;
  }

  appendPings(pings) {
    pings.forEach(ping => {
      this.list.appendChild(createPingCard(ping, { voteController: this.voteController }));
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
    this.container?.querySelectorAll('.pings-status').forEach(el => el.remove());
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
    this.container = null;
  }
}
