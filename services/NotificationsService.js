import authService from './AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import walletService from './WalletService.js';
import { TYPES } from '../models/Notification.js';

const STEEMWORLD_API = 'https://sds.steemworld.org';

/**
 * Service for managing user notifications via the SteemWorld API.
 *
 * Notification read state is managed on-chain using the `notify` custom_json
 * operation (["setLastRead", {"date": "..."}]), so it is consistent across
 * all Steem frontends.
 */
class NotificationsService {
    constructor() {
        this._cache = new Map();
        this._cacheExpiry = 2 * 60 * 1000; // 2 minutes
        this.unreadCount = 0;
        this._cachedRewardFund = null;
        this._rewardFundCacheTime = 0;
        this._cachedSteemPrice = 1; // STEEM price in SBD ≈ USD; default 1 if unavailable
        this._walletState = new Map(); // per-user progressive wallet scan: { items, from, complete }
        this._lastReadTimestamp = new Map(); // per-user cached lastRead cutoff (ISO) derived from SW data
        this._vestsRate = null;     // VESTS → SP conversion rate (totalSteem / totalVests)
        this._vestsRateTime = 0;    // timestamp of last _vestsRate fetch
    }

    // â”€â”€â”€ SteemWorld API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async _fetchFromAPI(username, status, limit = 250, offset = 0) {
        const url = `${STEEMWORLD_API}/notifications_api/getNotificationsByStatus/${encodeURIComponent(username)}/${status}/${limit}/${offset}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`SteemWorld API error: ${resp.status}`);
        const data = await resp.json();
        if (data.code !== 0) throw new Error(`SteemWorld API returned code ${data.code}`);
        return this._parseResponse(data.result);
    }

    _parseResponse(result) {
        if (!result || !result.rows || !result.cols) return [];
        const c = result.cols;
        return result.rows.map(row => {
            const rawType = row[c.type];
            return {
                id:        row[c.id],
                timestamp: new Date(row[c.time] * 1000).toISOString(),
                type:      rawType === 'resteem' ? 'reblog' : rawType,
                isRead:    row[c.is_read] === 1,
                account:   row[c.account],   // who performed the action
                author:    row[c.author],    // author of the target content
                permlink:  row[c.permlink],
                linkDepth: row[c.link_depth],
                rshares:   row[c.voted_rshares]
            };
        });
    }

    // â”€â”€â”€ Cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    _getCached(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this._cacheExpiry) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _setCached(key, data) {
        this._cache.set(key, { data, ts: Date.now() });
    }

    clearCache() {
        this._cache.clear();
        this._walletState.clear();
        this._lastReadTimestamp.clear();
    }

    // --- Reward Fund -------------------------------------------------------

    async _ensureRewardFund() {
        const TTL = 5 * 60 * 1000;
        if (this._cachedRewardFund && Date.now() - this._rewardFundCacheTime < TTL) return;
        try {
            await steemService.ensureLibraryLoaded();
            const [fund, price] = await Promise.all([
                new Promise((resolve, reject) => {
                    window.steem.api.getRewardFund('post', (err, r) => err ? reject(err) : resolve(r));
                }),
                new Promise((resolve) => {
                    // getCurrentMedianHistoryPrice returns { base: "0.XXX SBD", quote: "1.000 STEEM" }
                    window.steem.api.getCurrentMedianHistoryPrice((err, r) => resolve(err ? null : r));
                })
            ]);
            this._cachedRewardFund = fund;
            if (price) {
                const base  = parseFloat(price.base);   // SBD
                const quote = parseFloat(price.quote);  // STEEM
                this._cachedSteemPrice = (quote > 0) ? base / quote : 1;
            }
            this._rewardFundCacheTime = Date.now();
        } catch (e) {
            console.warn('Could not fetch reward fund:', e);
        }
    }

    /**
     * Converts raw rshares to a formatted dollar string (e.g. "+$0.05"), or null if unavailable.
     */
    rsharesToDollarString(rshares) {
        if (!this._cachedRewardFund || !rshares) return null;
        const recentClaims  = parseFloat(this._cachedRewardFund.recent_claims);
        const rewardBalance = parseFloat(this._cachedRewardFund.reward_balance);
        if (!recentClaims || !rewardBalance || recentClaims <= 0) return null;
        // value in STEEM × price feed (SBD per STEEM ≈ USD per STEEM)
        const value = (rshares / recentClaims) * rewardBalance * this._cachedSteemPrice;
        if (Math.abs(value) < 0.005) return null;
        const sign = value >= 0 ? '+' : '-';
        return `${sign}$${Math.abs(value).toFixed(2)}`;
    }
    
    // --- Public API --------------------------------------------------------

    /**
     * Called at app startup (after login) to populate the unread badge.
     */
    async preloadNotifications() {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;
        await this.updateUnreadCount();
    }

    getUnreadCount() {
        return this.unreadCount;
    }

    /**
     * Fetches the count of unread notifications (status=new) and updates the badge.
     */
    async updateUnreadCount() {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            this.unreadCount = 0;
            eventEmitter.emit('notifications:unread_count_updated', 0);
            return 0;
        }
        try {
            const cacheKey = `${currentUser.username}_new_count`;
            let count = this._getCached(cacheKey);
            if (count === null) {
                const notifications = await this._fetchFromAPI(currentUser.username, 'new', 2500, 0);
                count = notifications.length;
                this._setCached(cacheKey, count);
            }
            this.unreadCount = count;
        } catch (error) {
            console.error('NotificationsService: error getting unread count', error);
        }
        eventEmitter.emit('notifications:unread_count_updated', this.unreadCount);
        return this.unreadCount;
    }

    /**
     * Get notifications for the current user with optional type filter and
     * page-based pagination (the full list is fetched once and cached).
     *
     * @param {string}  type         - TYPES.ALL or a specific type ('vote', 'reply', â€¦)
     * @param {number}  page         - 1-based page number
     * @param {number}  limit        - items per page
     * @param {boolean} forceRefresh - bypass cache
     * @returns {{ notifications: Array, hasMore: boolean }}
     */
    async getNotifications(type = TYPES.ALL, page = 1, limit = 20, forceRefresh = false) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return { notifications: [], hasMore: false };

        const username = currentUser.username;
        const cacheKey = `${username}_all_notifications`;

        if (forceRefresh) {
            this._cache.delete(cacheKey);
            this._walletState.delete(username);
            this._lastReadTimestamp.delete(username);
        }

        let allNotifications = this._getCached(cacheKey);
        if (!allNotifications) {
            // Fetch notifications and reward fund in parallel.
            // Give the reward fund up to 3s; if it's not ready by then we proceed anyway.
            const fundTimeout = new Promise(resolve => setTimeout(resolve, 3000));
            [allNotifications] = await Promise.all([
                this._fetchFromAPI(username, 'all', 2500, 0),
                Promise.race([this._ensureRewardFund().catch(() => {}), fundTimeout])
            ]);
            this._setCached(cacheKey, allNotifications);
        } else {
            this._ensureRewardFund().catch(() => {});
        }

        // Non-wallet filters: simple pagination from the SteemWorld list
        if (type !== TYPES.ALL) {
            const filtered = allNotifications.filter(n => n.type === type);
            const start = (page - 1) * limit;
            const end   = start + limit;
            return { notifications: this._applyLocalRead(username, filtered.slice(start, end)), hasMore: end < filtered.length };
        }

        // ALL type: progressively merge wallet events as the user scrolls
        const state = this._getWalletState(username);
        const start = (page - 1) * limit;
        const end   = start + limit;

        // The cutoff: timestamp of the oldest SW item that would appear on this page.
        // We need to scan wallet history at least this far back to catch interleaved wallet events.
        const cutoffItem = allNotifications[end - 1] ?? allNotifications[allNotifications.length - 1];
        const swCutoff   = cutoffItem?.timestamp ?? null;

        // Fetch wallet batches until the scan has gone back past the cutoff (or history is exhausted)
        while (!state.complete) {
            if (swCutoff && state.oldestTimestamp && state.oldestTimestamp <= swCutoff) break;
            if (!swCutoff && end <= this._buildMergedList(allNotifications, state.items).length) break;
            await this._fetchNextWalletBatch(username, state);
        }

        // Apply blockchain lastRead cutoff to wallet items
        const lastReadTs = this._getLastReadTimestamp(username, allNotifications);
        const correctedWallet = state.items.map(item => ({
            ...item,
            isRead: lastReadTs ? item.timestamp <= lastReadTs : false
        }));
        const merged = this._buildMergedList(allNotifications, correctedWallet);
        return {
            notifications: this._applyLocalRead(username, merged.slice(start, end)),
            hasMore: end < merged.length || !state.complete
        };
    }

    /** Stable unique ID for a notification (used for deduplication in the view). */
    generateNotificationId(notification) {
        return String(notification.id);
    }

    // ─── Client-side read tracking (localStorage) ─────────────────────────────

    _getLocalReadKey(username) {
        return `cur8_read_${username}`;
    }

    _getLocallyReadIds(username) {
        try {
            const raw = localStorage.getItem(this._getLocalReadKey(username));
            return new Set(raw ? JSON.parse(raw) : []);
        } catch {
            return new Set();
        }
    }

    /** Marks a single notification as locally read (persisted in localStorage). */
    markLocallyRead(notificationId) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;
        try {
            const ids = this._getLocallyReadIds(currentUser.username);
            ids.add(String(notificationId));
            const arr = [...ids].slice(-2000);
            localStorage.setItem(this._getLocalReadKey(currentUser.username), JSON.stringify(arr));
        } catch {
            // localStorage unavailable or full — fail silently
        }
    }

    /** Applies locally-cached read state on top of server-provided isRead flags. */
    _applyLocalRead(username, items) {
        const locallyRead = this._getLocallyReadIds(username);
        if (!locallyRead.size) return items;
        return items.map(n => (!n.isRead && locallyRead.has(String(n.id)) ? { ...n, isRead: true } : n));
    }

    /**
     * Derives the "last read" cutoff timestamp from SW notification data:
     * the max timestamp among notifications already marked isRead=true on the blockchain.
     * This mirrors the date broadcast by setLastRead custom_json.
     */
    _getLastReadTimestamp(username, allSWNotifications) {
        if (this._lastReadTimestamp.has(username)) {
            return this._lastReadTimestamp.get(username);
        }
        let maxTs = null;
        for (const n of allSWNotifications) {
            if (n.isRead && (!maxTs || n.timestamp > maxTs)) {
                maxTs = n.timestamp;
            }
        }
        this._lastReadTimestamp.set(username, maxTs);
        return maxTs;
    }

    /**
     * Marks all notifications as read by broadcasting a `notify` custom_json
     * with ["setLastRead", {"date": "<UTC datetime>"}].
     * Clears the local cache and resets the unread badge on success.
     */
    async markAllAsRead() {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) throw new Error('Not authenticated');

        const date = new Date().toISOString().slice(0, 19); // "2026-05-21T09:27:20"
        const jsonStr = JSON.stringify(['setLastRead', { date }]);

        const operations = [['custom_json', {
            required_auths:         [],
            required_posting_auths: [currentUser.username],
            id:   'notify',
            json: jsonStr
        }]];

        await this._broadcast(currentUser, operations);

        // Optimistic update: everything is now read
        this.unreadCount = 0;
        this.clearCache();
        // Preserve the new cutoff so wallet items are shown as read immediately on next render
        this._lastReadTimestamp.set(currentUser.username, new Date().toISOString());
        eventEmitter.emit('notifications:unread_count_updated', 0);
    }

    async _broadcast(user, operations) {
        const { username, loginMethod } = user;

        if (loginMethod === 'keychain') {
            if (!window.steem_keychain) throw new Error('Steem Keychain non installato');
            return new Promise((resolve, reject) => {
                window.steem_keychain.requestBroadcast(
                    username, operations, 'posting',
                    (response) => {
                        if (response.success) resolve(response);
                        else reject(new Error(response.error || 'Keychain error'));
                    }
                );
            });
        }

        if (loginMethod === 'privateKey') {
            await steemService.ensureLibraryLoaded();
            const postingKey = authService.getPostingKey();
            if (!postingKey) throw new Error('Chiave posting non disponibile. Rieffettua il login.');
            return new Promise((resolve, reject) => {
                window.steem.broadcast.send(
                    { operations, extensions: [] },
                    { posting: postingKey },
                    (err, result) => { if (err) reject(err); else resolve(result); }
                );
            });
        }

        throw new Error('markAllAsRead non supportato per il metodo di login corrente.');
    }

    /** Returns (creating if needed) the per-user wallet scan state. */
    _getWalletState(username) {
        if (!this._walletState.has(username)) {
            // oldestTimestamp: ISO string of the oldest op seen so far (used to know how far back the scan has reached)
            this._walletState.set(username, { items: [], from: -1, complete: false, oldestTimestamp: null });
        }
        return this._walletState.get(username);
    }

    /** Merges SteemWorld notifications with wallet items, sorted most-recent-first. */
    _buildMergedList(swItems, walletItems) {
        if (!walletItems.length) return swItems;
        const merged = [...swItems, ...walletItems];
        merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return merged;
    }

    /**
     * Returns (and caches for 5 min) the VESTS-to-SP conversion rate.
     * One API call per 5 minutes regardless of how many delegations are in a batch.
     */
    async _getVestsRate() {
        const TTL = 5 * 60 * 1000;
        if (this._vestsRate && Date.now() - this._vestsRateTime < TTL) return this._vestsRate;
        const steem = await steemService.ensureLibraryLoaded();
        const props = await new Promise((resolve, reject) => {
            steem.api.getDynamicGlobalProperties((err, r) => err ? reject(err) : resolve(r));
        });
        const totalVests = parseFloat(props.total_vesting_shares.split(' ')[0]);
        const totalSteem = parseFloat(props.total_vesting_fund_steem.split(' ')[0]);
        this._vestsRate = totalSteem / totalVests;
        this._vestsRateTime = Date.now();
        return this._vestsRate;
    }

    /** Converts a VESTS string (e.g. "123456.123456 VESTS") to "X.XXX SP". */
    async _vestsToSP(vestsString) {
        try {
            const v = parseFloat(vestsString.split(' ')[0]);
            const rate = await this._getVestsRate();
            return `${(v * rate).toFixed(3)} SP`;
        } catch {
            return vestsString; // fallback: show raw VESTS
        }
    }

    /** Fetches ONE batch of 1000 account-history ops going backwards in time.
     * Appends matching wallet events to state.items and advances state.from.
     * Sets state.complete = true when history is exhausted.
     */
    async _fetchNextWalletBatch(username, state) {
        if (state.complete) return;
        const steem  = await steemService.ensureLibraryLoaded();
        const WANTED = new Set(['transfer', 'delegate_vesting_shares', 'fill_vesting_withdraw']);

        const batch = await new Promise((resolve, reject) => {
            steem.api.getAccountHistory(username, state.from, 1000, (err, result) => {
                if (err) reject(err);
                else resolve(result || []);
            });
        });

        if (!batch.length) { state.complete = true; return; }

        // Pre-fetch VESTS rate once for the whole batch (used for delegations)
        let vestsRate = null;
        const hasDelegation = batch.some(([, tx]) => tx.op[0] === 'delegate_vesting_shares' &&
            tx.op[1].delegatee === username);
        if (hasDelegation) {
            try { vestsRate = await this._getVestsRate(); } catch { /* fallback to raw */ }
        }

        for (const [index, tx] of batch) {
            const [type, op] = tx.op;
            if (!WANTED.has(type)) continue;
            if (type === 'transfer'                && op.to        !== username) continue;
            if (type === 'delegate_vesting_shares' && op.delegatee !== username) continue;
            if (type === 'fill_vesting_withdraw'   && op.to_account !== username) continue;

            const account = type === 'transfer'                 ? op.from
                          : type === 'delegate_vesting_shares'  ? op.delegator
                          : op.from_account;

            let amount;
            if (type === 'transfer') {
                amount = op.amount;
            } else if (type === 'delegate_vesting_shares') {
                if (vestsRate) {
                    const v = parseFloat(op.vesting_shares.split(' ')[0]);
                    amount = `${(v * vestsRate).toFixed(3)} SP`;
                } else {
                    amount = op.vesting_shares;
                }
            } else {
                amount = op.deposited; // fill_vesting_withdraw: deposited is already in STEEM
            }

            state.items.push({
                id:        `wallet_${tx.trx_id || index}`,
                timestamp: new Date(tx.timestamp + 'Z').toISOString(),
                type:      TYPES.WALLET,
                subtype:   type,
                isRead:    false,
                account,
                amount,
                memo: type === 'transfer' ? (op.memo || '') : null,
            });
        }

        // Track how far back in time this scan has reached
        const oldestInBatch = batch.reduce((min, [, tx]) => {
            const t = new Date(tx.timestamp + 'Z').getTime();
            return t < min ? t : min;
        }, Infinity);
        if (isFinite(oldestInBatch)) {
            state.oldestTimestamp = new Date(oldestInBatch).toISOString();
        }

        const lowestIndex = batch[0][0];
        if (lowestIndex <= 0 || batch.length < 1000) {
            state.complete = true;
        } else {
            state.from = lowestIndex - 1;
        }
    }

    /**
     * Fetches received wallet events with progressive loading.
     * Each call may trigger a new account-history batch if more items are needed.
     */
    async getWalletNotifications(page = 1, limit = 20, forceRefresh = false) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return { notifications: [], hasMore: false };

        const username = currentUser.username;
        if (forceRefresh) this._walletState.delete(username);

        const state = this._getWalletState(username);
        const start = (page - 1) * limit;
        const end   = start + limit;

        // Fetch batches until we have enough items for this page or scan is done
        while (state.items.length < end && !state.complete) {
            await this._fetchNextWalletBatch(username, state);
        }

        // Apply blockchain lastRead cutoff to wallet items
        const swCacheKey = `${username}_all_notifications`;
        const swItems = this._getCached(swCacheKey);
        const lastReadTs = swItems
            ? this._getLastReadTimestamp(username, swItems)
            : (this._lastReadTimestamp.get(username) ?? null);

        const correctedItems = state.items.map(item => ({
            ...item,
            isRead: lastReadTs ? item.timestamp <= lastReadTs : false
        }));

        // Sort most-recent-first before slicing
        const sorted = [...correctedItems].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return {
            notifications: this._applyLocalRead(username, sorted.slice(start, end)),
            hasMore: end < sorted.length || !state.complete
        };
    }
}

// Initialize singleton instance
const notificationsService = new NotificationsService();
export default notificationsService;
