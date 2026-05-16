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
    this._resteemApiEndpoints = [
      'https://sds.steemworld.org',
      'https://sds0.steemworld.org'
    ];
  }

  _extractUsernames(payload) {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return payload
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            return entry.username || entry.account || entry.name || entry.resteemer || entry.user || null;
          }
          return null;
        })
        .filter(Boolean);
    }

    if (typeof payload === 'object') {
      const directArrays = [
        payload.accounts,
        payload.rebloggers,
        payload.resteems,
        payload.rows,
        payload.items,
        payload.data,
        payload.result
      ];

      for (const arr of directArrays) {
        if (Array.isArray(arr)) {
          return this._extractUsernames(arr);
        }
      }

      // Handle SDS-like tabular payloads: { result: { cols: {...}, rows: [...] } }
      const cols = payload.cols || payload.result?.cols;
      const rows = payload.rows || payload.result?.rows;
      if (cols && Array.isArray(rows)) {
        const candidateKeys = ['account', 'username', 'name', 'resteemer', 'from'];
        const colIndex = candidateKeys
          .map((k) => cols[k])
          .find((v) => Number.isInteger(v));

        if (Number.isInteger(colIndex)) {
          return rows
            .map((r) => (Array.isArray(r) ? r[colIndex] : null))
            .filter(Boolean);
        }
      }
    }

    return [];
  }

  _normalizeRebloggers(payload) {
    const usernames = this._extractUsernames(payload)
      .map(name => String(name || '').trim())
      .filter(Boolean);

    const seen = new Set();
    const normalized = [];
    for (const username of usernames) {
      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(username);
    }

    return normalized;
  }

  _hydrateReblogCache(author, permlink, rebloggers) {
    if (!author || !permlink || !Array.isArray(rebloggers)) return;
    for (const account of rebloggers) {
      const username = String(account || '').trim();
      if (!username) continue;
      const cacheKey = `${username}_${author}_${permlink}`;
      this.reblogCache.set(cacheKey, true);
      lsSet(cacheKey);
    }
  }

  async getRebloggers(author, permlink, options = {}) {
    const { suppressErrors = true } = options;
    const key = `${author}_${permlink}`;
    const cached = this._rebloggersCache.get(key);
    // Reuse within 5 minutes
    if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) {
      return cached.list;
    }

    try {
      const encodedAuthor = encodeURIComponent(author);
      const encodedPermlink = encodeURIComponent(permlink);
      let list = [];
      let steemWorldAnyResponse = false;

      // Primary source: SteemWorld resteems API
      for (const endpoint of this._resteemApiEndpoints) {
        try {
          const response = await fetch(
            `${endpoint}/post_resteems_api/getResteems/${encodedAuthor}/${encodedPermlink}`,
            { signal: AbortSignal.timeout(10000) }
          );
          steemWorldAnyResponse = true;
          if (!response.ok) continue;
          const json = await response.json();
          list = this._normalizeRebloggers(json);
          // If endpoint is valid and returns data shape, keep result (even empty)
          break;
        } catch (_) {
          // Try next endpoint
        }
      }

      // Fallback to condenser/follow API if SteemWorld failed or returned no parseable payload
      if (!Array.isArray(list) || list.length === 0) {
        const fallback = await steemService.getRebloggers(author, permlink);
        list = this._normalizeRebloggers(fallback);
      }

      // If no source answered at all, expose a recoverable error to callers that need fail-open behavior.
      if (!steemWorldAnyResponse && (!Array.isArray(list) || list.length === 0) && suppressErrors === false) {
        throw new Error('Reblog sources unavailable');
      }

      this._rebloggersCache.set(key, { list, ts: Date.now() });
      this._hydrateReblogCache(author, permlink, list);
      return list;
    } catch (error) {
      console.error('Error getting rebloggers list:', error);
      if (!suppressErrors) {
        throw error;
      }
      return [];
    }
  }

  async getReblogInfo(username, author, permlink, options = {}) {
    try {
      const rebloggers = await this.getRebloggers(author, permlink, options);
      const normalizedUsername = String(username || '').toLowerCase();
      const hasReblogged = normalizedUsername
        ? rebloggers.some(account => String(account || '').toLowerCase() === normalizedUsername)
        : false;

      if (username && hasReblogged === true) {
        const cacheKey = `${username}_${author}_${permlink}`;
        this.reblogCache.set(cacheKey, true);
        lsSet(cacheKey);
      }

      return {
        hasReblogged,
        reblogCount: rebloggers.length
      };
    } catch (error) {
      console.error('Error getting reblog info:', error);
      if (options?.suppressErrors === false) {
        throw error;
      }
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

  async hasReblogged(username, author, permlink, options = {}) {
    const { failOpen = false } = options;
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
      const info = await this.getReblogInfo(username, author, permlink, {
        suppressErrors: !failOpen
      });
      const result = info.hasReblogged;
      if (result === true) {
        this.reblogCache.set(cacheKey, true);
        lsSet(cacheKey); // persist positive results only
      }

      return result;
    } catch (error) {
      console.error('Error checking reblog status:', error);
      // In profile blog filtering we prefer fail-open to avoid skipping posts on temporary API outages.
      if (failOpen) return true;
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
