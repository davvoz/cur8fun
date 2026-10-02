import steemService from './SteemService.js';
import commentService from './CommentService.js';
import authService from './AuthService.js';
import { PINGS_CONFIG } from '../config/pings.js';

const HASHTAG_RE = /(^|[^\w&/])#([a-z0-9][a-z0-9-]{0,23})/gi;
const MENTION_RE = /(^|[^\w/@])@([a-z][a-z0-9.-]{2,15})/gi;
const FOLLOWING_TTL_MS = 5 * 60 * 1000;
// Feed and sidebar both read the latest walls; share the request briefly
const WALL_CACHE_TTL_MS = 60 * 1000;
const USER_PAGE_SIZE = 100;
// Pages of a user's comments scanned per profile load (most comments aren't pings)
const MAX_USER_PAGES_PER_LOAD = 3;
// Upper bound of walls scanned by a single loadMore call, so a filtered feed
// (e.g. Following) doesn't walk back through months of walls in one go
const MAX_WALLS_PER_LOAD = 7;

// Text of a body without images/HTML, for hashtag matching
function stripMedia(body) {
  return (body || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '');
}

/**
 * Reads and publishes Pings (see config/pings.js for the on-chain layout).
 */
class PingsService {
  constructor() {
    this.followingCache = new Map(); // username -> { set, at }
    this.wallCache = new Map(); // wall permlink -> { promise, at }
  }

  clearCache() {
    this.wallCache.clear();
  }

  /**
   * Creates an independent feed cursor; each view keeps its own.
   */
  createFeed() {
    return { walls: [], nextWallIndex: 0, wallsDone: false };
  }

  /**
   * Loads the next batch of pings from the feed, newest first.
   * @param {Object} feed - Cursor from createFeed()
   * @param {Function} [filterFn] - Optional predicate on normalized pings
   * @returns {Promise<{pings: Array, hasMore: boolean}>}
   */
  async loadMore(feed, filterFn = null) {
    const collected = [];
    let wallsScanned = 0;

    while (collected.length < PINGS_CONFIG.minItemsPerLoad && wallsScanned < MAX_WALLS_PER_LOAD) {
      if (feed.nextWallIndex >= feed.walls.length) {
        if (feed.wallsDone) break;
        await this._fetchMoreWalls(feed);
        if (feed.nextWallIndex >= feed.walls.length) break;
      }

      const wall = feed.walls[feed.nextWallIndex++];
      wallsScanned++;
      const pings = await this.getWallPings(wall);
      collected.push(...(filterFn ? pings.filter(filterFn) : pings));
    }

    const hasMore = !(feed.wallsDone && feed.nextWallIndex >= feed.walls.length);
    return { pings: collected, hasMore };
  }

  /**
   * Returns the most recent wall, or null if none has been published yet.
   */
  async getLatestWall() {
    const walls = await this._fetchWalls(null, 1);
    return walls[0] || null;
  }

  /**
   * Returns the pings (top-level replies) of a wall, newest first.
   */
  async getWallPings(wall) {
    const cached = this.wallCache.get(wall.permlink);
    if (cached && Date.now() - cached.at < WALL_CACHE_TTL_MS) {
      return cached.promise;
    }
    const promise = this._loadWallPings(wall);
    this.wallCache.set(wall.permlink, { promise, at: Date.now() });
    promise.catch(() => this.wallCache.delete(wall.permlink));
    return promise;
  }

  /**
   * Trending hashtags and most active authors over the last `hours`.
   * @returns {Promise<{tags: Array<[string, number]>, authors: Array<[string, number]>}>}
   */
  async getTrends({ hours = 24, maxTags = 10, maxAuthors = 5 } = {}) {
    // Walls are daily, so the last two cover any 24h window
    const walls = await this._fetchWalls(null, 2);
    const since = Date.now() - hours * 3600 * 1000;
    const pings = (await Promise.all(walls.map(w => this.getWallPings(w))))
      .flat()
      .filter(p => p.created.getTime() >= since);

    const tagCounts = new Map();
    const authorCounts = new Map();
    pings.forEach(ping => {
      this.getPingTags(ping).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
      authorCounts.set(ping.author, (authorCounts.get(ping.author) || 0) + 1);
    });

    const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return { tags: top(tagCounts, maxTags), authors: top(authorCounts, maxAuthors) };
  }

  /**
   * Hashtags of a ping (text + json_metadata), without app/community markers.
   */
  getPingTags(ping) {
    const metaTags = Array.isArray(ping.meta?.tags) ? ping.meta.tags : [];
    const tags = new Set([
      ...metaTags.map(t => String(t).toLowerCase()),
      ...this.extractHashtags(stripMedia(ping.body))
    ]);
    tags.delete(PINGS_CONFIG.pingTag);
    return [...tags].filter(t => t && !/^hive-\d+$/.test(t));
  }

  async _loadWallPings(wall) {
    const discussion = await steemService.rpcCall('bridge.get_discussion', {
      author: wall.author,
      permlink: wall.permlink
    });
    if (!discussion) return [];

    return Object.values(discussion)
      .filter(post =>
        post.parent_author === wall.author &&
        post.parent_permlink === wall.permlink &&
        !this._isHidden(post))
      .map(post => this.normalize(post))
      .sort((a, b) => b.created - a.created);
  }

  /**
   * Loads a ping (or any reply) with its whole reply tree.
   * @returns {Promise<Object|null>} Normalized root with nested `replies` arrays
   */
  async getThread(author, permlink) {
    const discussion = await steemService.rpcCall('bridge.get_discussion', { author, permlink });
    const rootKey = `${author}/${permlink}`;
    if (!discussion || !discussion[rootKey]) return null;

    const build = (key) => {
      const raw = discussion[key];
      const node = this.normalize(raw);
      node.replies = (raw.replies || [])
        .filter(childKey => discussion[childKey] && !this._isHidden(discussion[childKey]))
        .map(build)
        .sort((a, b) => a.created - b.created);
      return node;
    };

    return build(rootKey);
  }

  /**
   * Publishes a new ping on the latest wall.
   * @param {Object} data
   * @param {string} data.text - Ping text (max PINGS_CONFIG.maxLength chars)
   * @param {string[]} [data.images] - Already uploaded image URLs
   * @returns {Promise<Object>} The new ping, normalized
   */
  async publishPing({ text, images = [] }) {
    const wall = await this.getLatestWall();
    if (!wall) {
      throw new Error('No Pings wall is available yet. Please try again later.');
    }
    return this.reply({ parentAuthor: wall.author, parentPermlink: wall.permlink, text, images });
  }

  /**
   * Replies to a ping or to another reply.
   * @returns {Promise<Object>} The new reply, normalized
   */
  async reply({ parentAuthor, parentPermlink, text, images = [] }) {
    const cleanText = (text || '').trim();
    this.validate(cleanText, images);

    const body = this.buildBody(cleanText, images);

    const hashtags = this.extractHashtags(cleanText);
    const mentions = this.extractMentions(cleanText);

    const result = await commentService.createComment({
      parentAuthor,
      parentPermlink,
      body,
      metadata: {
        type: PINGS_CONFIG.pingType,
        tags: [PINGS_CONFIG.pingTag, ...hashtags].slice(0, 10),
        ...(images.length ? { image: images } : {}),
        ...(mentions.length ? { users: mentions } : {})
      }
    });

    return {
      author: result.author,
      permlink: result.permlink,
      parentAuthor,
      parentPermlink,
      body,
      created: new Date(),
      children: 0,
      votes: [],
      payout: 0,
      isPaidout: false,
      replies: []
    };
  }

  /**
   * Edits one of the current user's pings or replies, keeping its permlink.
   * @returns {Promise<Object>} The updated ping
   */
  async editPing(ping, { text, images = [] }) {
    const cleanText = (text || '').trim();
    this.validate(cleanText, images);

    const body = this.buildBody(cleanText, images);
    // app/format are set by CommentService; image/users are rebuilt below
    const { app, format, image, users, ...keptMeta } = ping.meta || {};
    const mentions = this.extractMentions(cleanText);

    await commentService.updateComment({
      author: ping.author,
      permlink: ping.permlink,
      parentAuthor: ping.parentAuthor,
      parentPermlink: ping.parentPermlink,
      body,
      metadata: {
        ...keptMeta,
        type: keptMeta.type || PINGS_CONFIG.pingType,
        tags: [PINGS_CONFIG.pingTag, ...this.extractHashtags(cleanText)].slice(0, 10),
        ...(images.length ? { image: images } : {}),
        ...(mentions.length ? { users: mentions } : {})
      }
    });

    return { ...ping, body };
  }

  /**
   * Steem only deletes comments with no replies and no positive votes.
   */
  canDelete(ping) {
    const hasUpvotes = ping.votes.some(v => Number(v.rshares ?? v.percent ?? 0) > 0);
    return this.isOwn(ping) && ping.children === 0 && !hasUpvotes;
  }

  async deletePing(ping) {
    if (!this.canDelete(ping)) {
      throw new Error('Pings with replies or upvotes cannot be deleted');
    }
    await this._broadcast([
      ['delete_comment', { author: ping.author, permlink: ping.permlink }]
    ]);
  }

  /**
   * Where a Steem post/comment should open if it belongs to Pings: the wall
   * itself opens the feed, anything below it opens its ping thread.
   * @param {Object} content - Condenser post object (needs root_author/depth)
   * @returns {string|null} Path, or null for regular content
   */
  getRedirectPath(content) {
    if (!content || content.root_author !== PINGS_CONFIG.wallAccount) return null;
    return content.depth > 0
      ? `${PINGS_CONFIG.path}/@${content.author}/${content.permlink}`
      : PINGS_CONFIG.path;
  }

  isOwn(ping) {
    return authService.getCurrentUser()?.username === ping.author;
  }

  /**
   * True if the ping carries the hashtag, in its text or in json_metadata.tags
   * (pings from other Steem apps may only have the latter).
   */
  matchesTag(ping, tag) {
    const wanted = tag.toLowerCase();
    const metaTags = Array.isArray(ping.meta?.tags) ? ping.meta.tags : [];
    return metaTags.some(t => String(t).toLowerCase() === wanted) ||
      this.extractHashtags(stripMedia(ping.body)).includes(wanted);
  }

  /**
   * Cursor over a user's pings (their comments posted directly on a wall).
   */
  createUserFeed(username) {
    return { username, last: null, done: false };
  }

  /**
   * Loads the user's next pings, newest first.
   * @returns {Promise<{pings: Array, hasMore: boolean}>}
   */
  async loadUserPings(feed) {
    const collected = [];
    let pages = 0;

    while (!feed.done && collected.length < PINGS_CONFIG.minItemsPerLoad && pages < MAX_USER_PAGES_PER_LOAD) {
      const params = { account: feed.username, sort: 'comments', limit: USER_PAGE_SIZE };
      if (feed.last) {
        params.start_author = feed.last.author;
        params.start_permlink = feed.last.permlink;
      }
      const raw = await steemService.rpcCall('bridge.get_account_posts', params) || [];
      // With a start cursor the first result is the last item of the previous page
      const page = raw.filter(c => !feed.last || c.permlink !== feed.last.permlink);
      pages++;

      if (page.length === 0) {
        feed.done = true;
        break;
      }
      feed.last = page[page.length - 1];
      if (raw.length < USER_PAGE_SIZE) feed.done = true;

      collected.push(...page
        .filter(c => c.parent_author === PINGS_CONFIG.wallAccount && !this._isHidden(c))
        .map(c => this.normalize(c)));
    }

    return { pings: collected, hasMore: !feed.done };
  }

  buildBody(text, images) {
    return [text, ...images.map(url => `![](${url})`)]
      .filter(Boolean)
      .join('\n\n');
  }

  validate(text, images = []) {
    if (!text && images.length === 0) {
      throw new Error('Write something or add an image');
    }
    if (this.countChars(text) > PINGS_CONFIG.maxLength) {
      throw new Error(`Pings are limited to ${PINGS_CONFIG.maxLength} characters`);
    }
    if (images.length > PINGS_CONFIG.maxImages) {
      throw new Error(`You can attach up to ${PINGS_CONFIG.maxImages} images`);
    }
  }

  /**
   * Counts user-perceived characters (emoji count as one).
   */
  countChars(text) {
    return [...(text || '')].length;
  }

  extractHashtags(text) {
    const tags = new Set();
    for (const match of (text || '').matchAll(HASHTAG_RE)) {
      tags.add(match[2].toLowerCase());
    }
    return [...tags];
  }

  extractMentions(text) {
    const users = new Set();
    for (const match of (text || '').matchAll(MENTION_RE)) {
      users.add(match[2].toLowerCase().replace(/[.-]+$/, ''));
    }
    return [...users];
  }

  /**
   * Accounts followed by the given user, cached for a few minutes.
   * @returns {Promise<Set<string>>}
   */
  async getFollowingSet(username) {
    const cached = this.followingCache.get(username);
    if (cached && Date.now() - cached.at < FOLLOWING_TTL_MS) {
      return cached.set;
    }
    const following = await steemService.getFollowing(username) || [];
    const set = new Set(following.map(f => f.following));
    this.followingCache.set(username, { set, at: Date.now() });
    return set;
  }

  hasVoted(ping) {
    const user = authService.getCurrentUser();
    if (!user) return false;
    return ping.votes.some(v => v.voter === user.username && (v.percent === undefined || v.percent > 0 || v.rshares > 0));
  }

  /**
   * Maps a bridge post object to the shape used by the Pings UI.
   */
  normalize(post) {
    let meta = post.json_metadata || {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = {}; }
    }

    const payout = typeof post.payout === 'number'
      ? post.payout
      : parseFloat(post.pending_payout_value) || 0;

    return {
      author: post.author,
      permlink: post.permlink,
      parentAuthor: post.parent_author,
      parentPermlink: post.parent_permlink,
      body: post.body || '',
      // Steem timestamps are UTC without a zone suffix
      created: new Date(post.created.endsWith('Z') ? post.created : `${post.created}Z`),
      children: post.children || 0,
      votes: post.active_votes || [],
      payout,
      isPaidout: !!post.is_paidout,
      depth: post.depth,
      meta,
      replies: [],
      raw: post
    };
  }

  /**
   * Condenser-style post object expected by the shared post components
   * (VotesPopup, PayoutInfoPopup); bridge names the author payout differently.
   */
  toSteemPost(ping) {
    const raw = ping.raw || {};
    return {
      ...raw,
      author: ping.author,
      permlink: ping.permlink,
      created: raw.created || ping.created.toISOString().slice(0, 19),
      active_votes: ping.votes,
      net_votes: ping.votes.length,
      pending_payout_value: raw.pending_payout_value || '0.000 SBD',
      total_payout_value: raw.total_payout_value || raw.author_payout_value || '0.000 SBD',
      curator_payout_value: raw.curator_payout_value || '0.000 SBD'
    };
  }

  /**
   * Broadcasts posting-authority operations with the user's login method.
   */
  async _broadcast(operations) {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('You must be logged in');

    if (user.loginMethod === 'keychain') {
      return steemService.broadcastWithKeychain(user.username, operations);
    }

    if (user.loginMethod === 'steemlogin') {
      const token = authService.getSteemLoginToken();
      if (!token) throw new Error('SteemLogin token not available. Please login again.');
      const response = await fetch('https://api.steemlogin.com/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ operations })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_description || error.error || 'SteemLogin broadcast failed');
      }
      return response.json();
    }

    const postingKey = authService.getPostingKey();
    if (!postingKey) throw new Error('Posting key not available. Please login again.');
    return steemService.broadcastWithPostingKey(operations, postingKey);
  }

  async _fetchMoreWalls(feed) {
    const last = feed.walls[feed.walls.length - 1] || null;
    const walls = await this._fetchWalls(last, PINGS_CONFIG.wallsPerRequest);
    if (walls.length === 0) {
      feed.wallsDone = true;
      return;
    }
    feed.walls.push(...walls);
    if (walls.length < PINGS_CONFIG.wallsPerRequest) {
      feed.wallsDone = true;
    }
  }

  /**
   * Root posts of the wall account, newest first, starting after `after`.
   */
  async _fetchWalls(after, limit) {
    const params = {
      account: PINGS_CONFIG.wallAccount,
      sort: 'posts',
      limit: after ? limit + 1 : limit
    };
    if (after) {
      params.start_author = after.author;
      params.start_permlink = after.permlink;
    }

    const posts = await steemService.rpcCall('bridge.get_account_posts', params) || [];
    return posts
      .filter(p => p.author === PINGS_CONFIG.wallAccount && p.depth === 0)
      .filter(p => !after || p.permlink !== after.permlink)
      .slice(0, limit)
      .map(p => ({ author: p.author, permlink: p.permlink, created: p.created }));
  }

  // Muted in the community or greyed out (low reputation / heavily flagged)
  _isHidden(post) {
    return !!(post.stats && (post.stats.hide || post.stats.gray));
  }
}

const pingsService = new PingsService();
export default pingsService;
