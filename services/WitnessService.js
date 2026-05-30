import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

/**
 * Service for fetching and voting Steem witnesses.
 *
 * On Steem each account can cast up to 30 approval votes for witnesses.
 * Voting uses the `account_witness_vote` op which requires the active authority.
 */
class WitnessService {
  constructor() {
    this.MAX_WITNESS_VOTES = 30;
    this.PROMOTED_WITNESS = 'cur8.witness';

    this._cache = {
      list: null,
      listFetchedAt: 0,
      votesByUser: new Map(),
    };
    this.CACHE_TTL = 60 * 1000; // 1 min

    this._voteInFlight = new Set();
  }

  /**
   * Returns an array of witness objects sorted by votes (desc),
   * limited to `limit` (default 100).
   */
  async getTopWitnesses(limit = 100, { force = false } = {}) {
    const now = Date.now();
    if (!force && this._cache.list && (now - this._cache.listFetchedAt) < this.CACHE_TTL) {
      return this._cache.list.slice(0, limit);
    }

    const result = await steemService.rpcCall('condenser_api.get_witnesses_by_vote', ['', limit]);
    const list = Array.isArray(result) ? result.map(w => this._normalizeWitness(w)) : [];

    this._cache.list = list;
    this._cache.listFetchedAt = now;
    return list;
  }

  /**
   * Fetch a single witness by account name.
   */
  async getWitnessByAccount(account) {
    if (!account) return null;
    try {
      const result = await steemService.rpcCall('condenser_api.get_witness_by_account', [account]);
      return result ? this._normalizeWitness(result) : null;
    } catch (e) {
      console.warn('getWitnessByAccount failed:', e);
      return null;
    }
  }

  /**
   * Returns a Set<string> of witness account names the user currently approves.
   */
  async getApprovedWitnesses(username) {
    if (!username) return new Set();
    const cached = this._cache.votesByUser.get(username);
    if (cached && (Date.now() - cached.fetchedAt) < this.CACHE_TTL) {
      return new Set(cached.witnesses);
    }

    try {
      const accounts = await steemService.rpcCall('condenser_api.get_accounts', [[username]]);
      const account = Array.isArray(accounts) ? accounts[0] : null;
      const witnesses = account?.witness_votes || [];
      const proxy = account?.proxy || '';
      this._cache.votesByUser.set(username, { witnesses, proxy, fetchedAt: Date.now() });
      return new Set(witnesses);
    } catch (e) {
      console.warn('getApprovedWitnesses failed:', e);
      return new Set();
    }
  }

  /**
   * Returns the witness proxy account for `username` (empty string = no proxy).
   * Uses the same cache slot as approved witnesses to avoid a second RPC.
   */
  async getProxy(username) {
    if (!username) return '';
    const cached = this._cache.votesByUser.get(username);
    if (cached && (Date.now() - cached.fetchedAt) < this.CACHE_TTL) {
      return cached.proxy || '';
    }
    await this.getApprovedWitnesses(username);
    return this._cache.votesByUser.get(username)?.proxy || '';
  }

  /**
   * Set or clear the witness proxy.
   *   setProxy('alice')  → delegates witness votes to @alice
   *   setProxy('')       → clears proxy (user votes again themselves)
   */
  async setProxy(proxy) {
    const user = authService.getCurrentUser();
    if (!user) throw new Error('You must be logged in to set a witness proxy');

    const voter = user.username;
    const trimmed = (proxy || '').trim().replace(/^@/, '').toLowerCase();
    if (trimmed === voter) {
      throw new Error('You cannot set yourself as your witness proxy');
    }

    if (trimmed) {
      const accounts = await steemService.rpcCall('condenser_api.get_accounts', [[trimmed]]);
      if (!Array.isArray(accounts) || !accounts[0]) {
        throw new Error(`Account @${trimmed} does not exist`);
      }
    }

    const operation = [
      'account_witness_proxy',
      { account: voter, proxy: trimmed },
    ];

    const loginMethod = user.loginMethod || 'privateKey';
    await steemService.ensureLibraryLoaded();

    let result;
    if (loginMethod === 'keychain') {
      if (!window.steem_keychain) {
        throw new Error('Steem Keychain not available. Use a desktop browser or log in with your active key.');
      }
      result = await this._proxyWithKeychain(voter, trimmed);
    } else if (loginMethod === 'steemlogin') {
      result = await this._broadcastWithSteemLogin([operation]);
    } else {
      const activeKey = await authService.getActiveKeyWithPinFlow(voter, {
        promptTitle: trimmed ? 'Set witness proxy' : 'Clear witness proxy',
        promptHint: 'Changing your witness proxy needs your active key. Enter your PIN to continue.',
      });
      if (!activeKey) {
        const e = new Error('USER_CANCELLED');
        e.isCancelled = true;
        throw e;
      }
      result = await steemService.broadcastWithActiveKey([operation], activeKey);
    }

    this._cache.votesByUser.delete(voter);

    eventEmitter.emit('notification', {
      type: 'success',
      message: trimmed
        ? `Witness proxy set to @${trimmed}`
        : 'Witness proxy cleared',
    });

    return result;
  }

  _proxyWithKeychain(voter, proxy) {
    return new Promise((resolve, reject) => {
      window.steem_keychain.requestProxy(voter, proxy, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          const msg = response.error || response.message || 'Witness proxy failed';
          if (/cancel/i.test(msg)) {
            const e = new Error('USER_CANCELLED');
            e.isCancelled = true;
            reject(e);
          } else {
            reject(new Error(msg));
          }
        }
      });
    });
  }

  async _broadcastWithSteemLogin(operations) {
    const token = authService.getSteemLoginToken?.();
    if (!token) throw new Error('SteemLogin token not available');

    const response = await fetch('https://api.steemlogin.com/api/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ operations }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'SteemLogin broadcast failed');
    }
    return response.json();
  }

  /**
   * Cast or remove a witness vote.
   *   approve === true  → vote
   *   approve === false → unvote
   * Picks the right signing flow based on the user's loginMethod
   * (keychain | steemlogin | privateKey/active).
   */
  async voteForWitness(witnessName, approve) {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('You must be logged in to vote for witnesses');
    }
    if (!witnessName) {
      throw new Error('Witness name is required');
    }

    const voter = user.username;
    const flightKey = `${voter}_${witnessName}`;
    if (this._voteInFlight.has(flightKey)) {
      throw new Error('Vote already in progress');
    }

    const loginMethod = user.loginMethod || 'privateKey';

    try {
      this._voteInFlight.add(flightKey);
      await steemService.ensureLibraryLoaded();

      let result;
      if (loginMethod === 'keychain') {
        if (!window.steem_keychain) {
          throw new Error('Steem Keychain not available. Use a desktop browser or log in with your active key.');
        }
        result = await this._voteWithKeychain(voter, witnessName, approve);
      } else if (loginMethod === 'steemlogin') {
        result = await this._voteWithSteemLogin(voter, witnessName, approve);
      } else {
        result = await this._voteWithActiveKey(voter, witnessName, approve);
      }

      // Refresh cached vote set for this user
      this._cache.votesByUser.delete(voter);

      eventEmitter.emit('notification', {
        type: 'success',
        message: approve
          ? `Vote cast for @${witnessName}`
          : `Vote removed from @${witnessName}`,
      });

      return result;
    } catch (err) {
      if (!err?.isCancelled) {
        console.error('Witness vote failed:', err);
        eventEmitter.emit('notification', {
          type: 'error',
          message: err?.message || 'Failed to update witness vote',
        });
      }
      throw err;
    } finally {
      this._voteInFlight.delete(flightKey);
    }
  }

  _voteWithKeychain(voter, witness, approve) {
    return new Promise((resolve, reject) => {
      window.steem_keychain.requestWitnessVote(
        voter,
        witness,
        !!approve,
        (response) => {
          if (response.success) {
            resolve(response);
          } else {
            const msg = response.error || response.message || 'Witness vote failed';
            if (/cancel/i.test(msg)) {
              const e = new Error('USER_CANCELLED');
              e.isCancelled = true;
              reject(e);
            } else {
              reject(new Error(msg));
            }
          }
        }
      );
    });
  }

  async _voteWithSteemLogin(voter, witness, approve) {
    return this._broadcastWithSteemLogin([[
      'account_witness_vote',
      { account: voter, witness, approve: !!approve },
    ]]);
  }

  async _voteWithActiveKey(voter, witness, approve) {
    const activeKey = await authService.getActiveKeyWithPinFlow(voter, {
      promptTitle: 'Witness vote',
      promptHint: 'Witness votes need your active key. Enter your PIN to continue.',
    });
    if (!activeKey) {
      const e = new Error('USER_CANCELLED');
      e.isCancelled = true;
      throw e;
    }

    const operation = [
      'account_witness_vote',
      { account: voter, witness, approve: !!approve },
    ];
    return steemService.broadcastWithActiveKey([operation], activeKey);
  }

  /**
   * Normalize witness object so the view doesn't have to know API quirks.
   */
  _normalizeWitness(w) {
    const votesRaw = w.votes ? String(w.votes) : '0';
    // votes are in "raw" units (vests * 1e6). Steem standard divisor for display is 1e15.
    let votesMv = 0;
    try {
      votesMv = Number(BigInt(votesRaw) / BigInt(1e9)) / 1e6;
    } catch {
      votesMv = Number(votesRaw) / 1e15;
    }

    const props = w.props || {};
    const sbdBase = props.sbd_exchange_rate?.base || w.sbd_exchange_rate?.base || '0.000 SBD';
    const sbdQuote = props.sbd_exchange_rate?.quote || w.sbd_exchange_rate?.quote || '0.000 STEEM';
    const lastConfirmed = w.last_confirmed_block_num || 0;

    return {
      owner: w.owner,
      votes: votesRaw,
      votesMv,
      runningVersion: w.running_version || '—',
      totalMissed: w.total_missed || 0,
      lastConfirmed,
      url: w.url || '',
      props: {
        accountCreationFee: props.account_creation_fee,
        maximumBlockSize: props.maximum_block_size,
        sbdInterestRate: props.sbd_interest_rate,
      },
      priceFeed: `${this._stripAsset(sbdBase)} / ${this._stripAsset(sbdQuote)}`,
      created: w.created,
      raw: w,
    };
  }

  _stripAsset(s) {
    if (!s) return '0.000';
    return String(s).split(' ')[0];
  }
}

const witnessService = new WitnessService();
export default witnessService;
