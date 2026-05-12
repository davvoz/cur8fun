import steemService from './SteemService.js';
import authService from './AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';

const LS_KEY = 'reblog_cache';

function lsGet(cacheKey) {
  try {
    const store = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return store[cacheKey]; // true | undefined
  } catch { return undefined; }
}

function lsSet(cacheKey) {
  try {
    const store = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    store[cacheKey] = true;
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
}

class ReblogService {
  constructor() {
    this.reblogCache = new Map(); // in-memory layer (session)
    this._rebloggersCache = new Map(); // author_permlink → { list, ts }
  }

  async getRebloggers(author, permlink) {
    const key = `${author}_${permlink}`;
    const cached = this._rebloggersCache.get(key);
    // Reuse within 5 minutes
    if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) {
      return cached.list;
    }
    try {
      const rebloggers = await steemService.getRebloggers(author, permlink);
      const list = Array.isArray(rebloggers) ? rebloggers : [];
      this._rebloggersCache.set(key, { list, ts: Date.now() });
      return list;
    } catch (error) {
      console.error('Error getting rebloggers list:', error);
      return [];
    }
  }

  async getReblogInfo(username, author, permlink) {
    try {
      const info = await steemService.getReblogInfo(username, author, permlink);

      if (username && info?.hasReblogged === true) {
        const cacheKey = `${username}_${author}_${permlink}`;
        this.reblogCache.set(cacheKey, true);
        lsSet(cacheKey);
      }

      return {
        hasReblogged: info?.hasReblogged === true,
        reblogCount: Number.isFinite(info?.reblogCount) ? info.reblogCount : 0
      };
    } catch (error) {
      console.error('Error getting reblog info:', error);
      return { hasReblogged: false, reblogCount: 0 };
    }
  }

  async reblogPost(author, permlink) {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) throw new Error('You must be logged in to reblog a post');

      const username = currentUser.username;

      const hasReblogged = await this.hasReblogged(username, author, permlink);
      if (hasReblogged) throw new Error('You have already reblogged this post');

      const result = await steemService.reblogPost(username, author, permlink);

      // Persist in both caches immediately
      const cacheKey = `${username}_${author}_${permlink}`;
      this.reblogCache.set(cacheKey, true);
      lsSet(cacheKey);

      eventEmitter.emit('post:reblogged', { username, author, permlink });
      eventEmitter.emit('notification', { type: 'success', message: 'Post successfully reblogged', duration: 3000 });

      return result;
    } catch (error) {
      eventEmitter.emit('notification', { type: 'error', message: error.message || 'Failed to reblog post', duration: 3000 });
      throw error;
    }
  }

  async hasReblogged(username, author, permlink) {
    try {
      const cacheKey = `${username}_${author}_${permlink}`;

      // 1. In-memory cache (fastest)
      if (this.reblogCache.has(cacheKey)) {
        const inMemoryValue = this.reblogCache.get(cacheKey);
        if (inMemoryValue === true) return true;
        this.reblogCache.delete(cacheKey);
      }

      // 2. localStorage (survives reload, set when user reblogged this session or previous)
      const lsCached = lsGet(cacheKey);
      if (lsCached === true) {
        this.reblogCache.set(cacheKey, true);
        return true;
      }

      // 3. Blockchain (slowest, only if not found locally)
      const info = await this.getReblogInfo(username, author, permlink);
      const result = info.hasReblogged;
      if (result === true) {
        this.reblogCache.set(cacheKey, true);
        lsSet(cacheKey); // persist positive results only
      }

      return result;
    } catch (error) {
      console.error('Error checking reblog status:', error);
      return false;
    }
  }

  /**
   * Synchronous cache-only check — no network call.
   * Returns true if the in-memory or localStorage cache says the user reblogged.
   */
  isRebloggedInCache(username, author, permlink) {
    if (!username || !author || !permlink) return false;
    const cacheKey = `${username}_${author}_${permlink}`;
    if (this.reblogCache.get(cacheKey) === true) return true;
    if (lsGet(cacheKey) === true) return true;
    return false;
  }

  clearCache(username, author, permlink) {
    if (username && author && permlink) {
      const cacheKey = `${username}_${author}_${permlink}`;
      this.reblogCache.delete(cacheKey);
    } else {
      this.reblogCache.clear();
    }
  }
}

const reblogService = new ReblogService();
export default reblogService;
