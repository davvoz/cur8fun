/**
 * SocialFeedService
 *
 * Aggregates three SteemWorld streams into a single "Following" feed:
 *   1. getAccountFriendsFeed      – posts + resteems by followed accounts
 *   2. getAccountCommunitiesFeedByCreated – posts from subscribed communities
 *   3. getActiveCommentsByCreated (filtered) – comments by followed accounts
 *
 * All calls use offset-based pagination, run in parallel, are merged,
 * deduplicated and sorted newest-first before being returned.
 */

import steemService from './SteemService.js';

// ── SteemWorld endpoint pool ────────────────────────────────────────────────
const SW_ENDPOINTS = [
    'https://sds.steemworld.org',
    'https://sds0.steemworld.org'
];

async function _swFetch(path) {
    for (const base of SW_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(12000) });
            if (!res.ok) continue;
            const json = await res.json();
            if (json.code !== 0 || !json.result?.cols || !Array.isArray(json.result.rows)) continue;
            return json.result; // { cols, rows }
        } catch (_) {
            // try next endpoint
        }
    }
    return null;
}

// ── Row mappers ─────────────────────────────────────────────────────────────

function _rowToPost(cols, row) {
    let jsonMeta = {};
    try { jsonMeta = JSON.parse(row[cols.json_metadata] || '{}'); } catch (_) {}

    let images = [];
    try { images = JSON.parse(row[cols.json_images] || '[]'); } catch (_) {}

    const createdTs = row[cols.created];
    const cashoutTs = row[cols.cashout_time];
    const created = createdTs
        ? new Date(createdTs * 1000).toISOString().replace('.000Z', '')
        : '';
    const cashout_time = cashoutTs
        ? new Date(cashoutTs * 1000).toISOString().replace('.000Z', '')
        : '1969-12-31T23:59:59';

    const payout = Number(row[cols.payout] ?? 0);
    const pending_payout_value = cashoutTs > 0 ? `${payout.toFixed(3)} SBD` : '0.000 SBD';
    const total_payout_value   = cashoutTs > 0 ? '0.000 SBD' : `${payout.toFixed(3)} SBD`;
    const curator_payout_value = '0.000 SBD';

    const resteemedBy = Array.isArray(row[cols.resteemed_by]) ? row[cols.resteemed_by] : [];

    return {
        id:                   row[cols.link_id] ?? 0,
        author:               row[cols.author] ?? '',
        permlink:             row[cols.permlink] ?? '',
        title:                row[cols.title] ?? '',
        body:                 row[cols.body] ?? '',
        category:             row[cols.category] ?? '',
        parent_permlink:      row[cols.category] ?? '',
        community:            row[cols.community] ?? '',
        created,
        cashout_time,
        net_rshares:          row[cols.net_rshares] ?? 0,
        children:             row[cols.children] ?? 0,
        pending_payout_value,
        total_payout_value,
        curator_payout_value,
        max_accepted_payout:  `${(row[cols.max_accepted_payout] ?? 0).toFixed(3)} SBD`,
        percent_steem_dollars: row[cols.percent_steem_dollars] ?? 10000,
        net_votes:            (row[cols.upvote_count] ?? 0) + (row[cols.downvote_count] ?? 0),
        active_votes:         [],
        json_metadata:        row[cols.json_metadata] ?? '{}',
        reblog_count:         row[cols.resteem_count] ?? 0,
        reblogged_by:         resteemedBy,
        stats: {
            num_reblogs: row[cols.resteem_count] ?? 0,
        },
        _images:    images,
        _jsonMeta:  jsonMeta,
        _swSource:  true,
    };
}

function _rowToComment(cols, row) {
    let jsonMeta = {};
    try { jsonMeta = JSON.parse(row[cols.json_metadata] || '{}'); } catch (_) {}

    const createdTs = row[cols.created];
    const cashoutTs = row[cols.cashout_time];
    const created = createdTs
        ? new Date(createdTs * 1000).toISOString().replace('.000Z', '')
        : '';
    const cashout_time = cashoutTs
        ? new Date(cashoutTs * 1000).toISOString().replace('.000Z', '')
        : '1969-12-31T23:59:59';

    const payout = Number(row[cols.payout] ?? 0);
    const pending_payout_value = cashoutTs > 0 ? `${payout.toFixed(3)} SBD` : '0.000 SBD';
    const total_payout_value   = cashoutTs > 0 ? '0.000 SBD' : `${payout.toFixed(3)} SBD`;

    return {
        id:                    row[cols.link_id] ?? 0,
        author:                row[cols.author] ?? '',
        permlink:              row[cols.permlink] ?? '',
        parent_author:         row[cols.parent_author] ?? '',
        parent_permlink:       row[cols.parent_permlink] ?? '',
        root_author:           row[cols.root_author] ?? '',
        root_permlink:         row[cols.root_permlink] ?? '',
        root_title:            row[cols.root_title] ?? '',
        title:                 row[cols.title] ?? '',
        body:                  row[cols.body] ?? '',
        category:              row[cols.category] ?? '',
        community:             row[cols.community] ?? '',
        created,
        cashout_time,
        net_rshares:           row[cols.net_rshares] ?? 0,
        children:              row[cols.children] ?? 0,
        pending_payout_value,
        total_payout_value,
        curator_payout_value:  '0.000 SBD',
        max_accepted_payout:   `${(row[cols.max_accepted_payout] ?? 0).toFixed(3)} SBD`,
        percent_steem_dollars: row[cols.percent_steem_dollars] ?? 10000,
        net_votes:             (row[cols.upvote_count] ?? 0) + (row[cols.downvote_count] ?? 0),
        active_votes:          [],
        json_metadata:         row[cols.json_metadata] ?? '{}',
        _jsonMeta:             jsonMeta,
        _swSource:             true,
        // ── Social-feed specific markers ───────────────────────────────────
        _isComment:            true,
        _replyContext: {
            rootAuthor:   row[cols.root_author]   ?? '',
            rootPermlink: row[cols.root_permlink] ?? '',
            rootTitle:    row[cols.root_title]    ?? '',
        },
    };
}

// ── Service class ────────────────────────────────────────────────────────────

class SocialFeedService {
    constructor() {
        this._followingSet  = null;
        this._followingAt   = 0;
        this._followingUser = null;

        // Single sorted master buffer per account.
        // Built once, served as slices — guarantees correct global order.
        // { account, items: Array, fetchedAt: number }
        this._buffer = null;
    }

    // ── Following set (10-min TTL) ────────────────────────────────────────

    async _getFollowingSet(username) {
        const age = Date.now() - this._followingAt;
        if (this._followingSet && this._followingUser === username && age < 10 * 60 * 1000) {
            return this._followingSet;
        }
        try {
            const list = await steemService.getFollowing(username);
            this._followingSet = new Set(list.map(f => f.following ?? f));
        } catch (_) {
            this._followingSet = this._followingSet ?? new Set();
        }
        this._followingAt   = Date.now();
        this._followingUser = username;
        return this._followingSet;
    }

    // ── Individual stream fetchers ────────────────────────────────────────

    /**
     * Posts + resteems from accounts the user follows.
     */
    async getFriendsFeed(account, limit = 1000, offset = 0) {
        const enc = encodeURIComponent(account);
        const path = `/feeds_api/getAccountFriendsFeed/${enc}/${enc}/250/${limit}/${offset}`;
        const result = await _swFetch(path);
        if (!result) return [];
        return result.rows.map(row => _rowToPost(result.cols, row));
    }

    /**
     * Posts from communities the user has subscribed to.
     */
    async getCommunitiesFeed(account, limit = 1000, offset = 0) {
        const enc = encodeURIComponent(account);
        const path = `/feeds_api/getAccountCommunitiesFeedByCreated/${enc}/${enc}/250/${limit}/${offset}`;
        const result = await _swFetch(path);
        if (!result) return [];
        return result.rows.map(row => _rowToPost(result.cols, row));
    }

    /**
     * All active comments (~7 days) for a single author.
     * @private
     */
    async _fetchAuthorComments(author, observer) {
        const enc = encodeURIComponent(author);
        const obs = encodeURIComponent(observer);
        const path = `/feeds_api/getActiveCommentsByAuthor/${enc}/${obs}/250/1000/0`;
        const result = await _swFetch(path);
        if (!result) return [];
        return result.rows.map(row => _rowToComment(result.cols, row));
    }

    /**
     * All active comments from ALL followed accounts, fired in parallel.
     * @private
     */
    async _getAllFriendsComments(account, following) {
        if (!following.size) return [];
        const results = await Promise.all(
            [...following].map(author =>
                this._fetchAuthorComments(author, account).catch(() => [])
            )
        );
        return results.flat();
    }

    // ── Buffer build ──────────────────────────────────────────────────────

    /**
     * Fetches all three streams in parallel, merges, deduplicates and sorts
     * into a single chronological array stored in this._buffer.
     * @private
     */
    async _buildBuffer(account, following) {
        const [friendsResult, commResult, commentsResult] = await Promise.allSettled([
            this.getFriendsFeed(account, 1000, 0),
            this.getCommunitiesFeed(account, 1000, 0),
            this._getAllFriendsComments(account, following),
        ]);

        const friends   = friendsResult.status   === 'fulfilled' ? friendsResult.value   : [];
        const community = commResult.status       === 'fulfilled' ? commResult.value       : [];
        const comments  = commentsResult.status   === 'fulfilled' ? commentsResult.value   : [];

        // Merge & deduplicate
        const seen  = new Set();
        const items = [...friends, ...community, ...comments].filter(item => {
            const key = `${item.author}_${item.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Single global sort — correct ordering guaranteed for all pages
        items.sort((a, b) => {
            const ta = a.created ? (new Date(a.created).getTime() || 0) : 0;
            const tb = b.created ? (new Date(b.created).getTime() || 0) : 0;
            return tb - ta;
        });

        this._buffer = { account, items, fetchedAt: Date.now() };
    }

    // ── Public API ────────────────────────────────────────────────────────

    clearCache() {
        this._buffer        = null;
        this._followingSet  = null;
        this._followingAt   = 0;
        this._followingUser = null;
    }

    /**
     * Returns a slice of the sorted social feed buffer for the given page.
     * The buffer is built once and reused for all subsequent pages (5-min TTL).
     *
     * @param {string} account
     * @param {number} limit  - items per page
     * @param {number} page   - 1-based
     * @returns {Promise<{posts: Array, hasMore: boolean}>}
     */
    async getMixedSocialFeed(account, limit = 20, page = 1) {
        const BUFFER_TTL = 5 * 60 * 1000;

        const bufferStale =
            !this._buffer ||
            this._buffer.account !== account ||
            Date.now() - this._buffer.fetchedAt > BUFFER_TTL;

        if (bufferStale) {
            const following = await this._getFollowingSet(account);
            await this._buildBuffer(account, following);
        }

        const { items } = this._buffer;
        const start = (page - 1) * limit;
        const end   = start + limit;

        return {
            posts:   items.slice(start, end),
            hasMore: end < items.length,
        };
    }

    /**
     * Comments from a community ordered by created time descending.
     * Uses the getCommunityCommentsByCreated SteemWorld endpoint.
     * @param {string} community  - Community id (with or without "hive-" prefix)
     * @param {string} observer   - Observer account for vote flags (optional)
     * @param {number} limit      - Max items to return (1-1000)
     * @param {number} offset     - Pagination offset
     * @returns {Promise<{comments: Array, hasMore: boolean}>}
     */
    async getCommunityComments(community, observer = '', limit = 50, offset = 0) {
        // Normalise: API expects the bare community id (e.g. "hive-172186")
        const communityId = community.startsWith('hive-') ? community : `hive-${community}`;
        const enc = encodeURIComponent(communityId);
        const obs = encodeURIComponent(observer || '');
        const path = `/feeds_api/getCommunityCommentsByCreated/${enc}/${obs}/250/${limit}/${offset}`;
        const result = await _swFetch(path);
        if (!result) return { comments: [], hasMore: false };
        const comments = result.rows.map(row => _rowToComment(result.cols, row));
        return {
            comments,
            hasMore: comments.length >= limit,
        };
    }
}

const socialFeedService = new SocialFeedService();
export default socialFeedService;
