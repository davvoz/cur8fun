import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';
// Import SteemCore class
import SteemCore from './steem-service-classes/SteemCore.js';

class WalletService {
  constructor() {
    this.currentUser = null;
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000'
    };
    
    // Initialize SteemCore instance
    this.steemCore = new SteemCore();

    // Listen for auth changes
    eventEmitter.on('auth:changed', ({ user }) => {
      this.currentUser = user ? user.username : null;
      if (this.currentUser) {
        this.updateBalances();
      }
    });
    
    // Set initial user if already logged in
    const user = authService.getCurrentUser();
    if (user) {
      this.currentUser = user.username;
    }
  }
  
  /**
   * Helper method to make JSON-RPC API calls using SteemCore's endpoints
   * @param {string} method - The API method to call
   * @param {Object} params - The parameters to pass
   * @returns {Promise<any>} The API response
   */
  async callJsonRpc(method, params) {
    const steem = await this.steemCore.ensureLibraryLoaded();
    
    return this.steemCore.executeWithRetry(async () => {
      const endpoint = this.steemCore.apiEndpoints[this.steemCore.currentEndpoint];
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: method,
          params: params,
          id: 1
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`);
      }
      
      return response.json();
    });
  }
  
  /**
   * Convert vests to STEEM POWER (SP)
   */
  async vestsToSteem(vests) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      return new Promise((resolve, reject) => {
        steem.api.getDynamicGlobalProperties(function (err, result) {
          if (err) {
            reject(err);
            return;
          }
          const totalVests = parseFloat(result.total_vesting_shares.split(' ')[0]);
          const totalSteem = parseFloat(result.total_vesting_fund_steem.split(' ')[0]);
          const steemPerVest = totalSteem / totalVests;
          const steemPower = parseFloat(vests) * steemPerVest;
          resolve(steemPower);
        });
      });
    } catch (error) {
      console.error('Error converting vests:', error);
      throw error;
    }
  }
  
  /**
   * Convert STEEM POWER (SP) to vests
   */
  async steemToVests(steemPower) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      return new Promise((resolve, reject) => {
        steem.api.getDynamicGlobalProperties(function (err, result) {
          if (err) {
            reject(err);
            return;
          }
          const totalVests = parseFloat(result.total_vesting_shares.split(' ')[0]);
          const totalSteem = parseFloat(result.total_vesting_fund_steem.split(' ')[0]);
          const vestsPerSteem = totalVests / totalSteem;
          const vests = parseFloat(steemPower) * vestsPerSteem;
          resolve(vests.toFixed(6));
        });
      });
    } catch (error) {
      console.error('Error converting steem power to vests:', error);
      throw error;
    }
  }
  
  /**
   * Update user balances
   */
  async updateBalances() {
    if (!this.currentUser) return;
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (account) {
        const steemBalance = parseFloat(account.balance).toFixed(3);
        const sbdBalance = parseFloat(account.sbd_balance).toFixed(3);
        
        // Extract vesting shares data 
        const vestingShares = parseFloat(account.vesting_shares);
        const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
        const receivedVestingShares = parseFloat(account.received_vesting_shares);
        
        // Calculate actual SP values
        const ownVestingShares = vestingShares - delegatedVestingShares;
        const ownSteemPower = await this.vestsToSteem(ownVestingShares);
        const delegatedOutSP = await this.vestsToSteem(delegatedVestingShares);
        const delegatedInSP = await this.vestsToSteem(receivedVestingShares);
        
        // Calculate effective STEEM Power (with delegations)
        const steemPower = await this.vestsToSteem(
          vestingShares - delegatedVestingShares + receivedVestingShares
        );
        
        this.balances = {
          steem: steemBalance,
          sbd: sbdBalance,
          steemPower: steemPower.toFixed(3),
          // Add detailed delegation information
          steemPowerDetails: {
            total: steemPower.toFixed(3),
            own: ownSteemPower.toFixed(3),
            delegatedOut: delegatedOutSP.toFixed(3),
            delegatedIn: delegatedInSP.toFixed(3),
            effective: (ownSteemPower + delegatedInSP).toFixed(3)
          }
        };
        
        // Notify listeners about balance update
        eventEmitter.emit('wallet:balances-updated', this.balances);
      }
    } catch (error) {
      console.error('Error updating balances:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: 'Failed to update wallet balances'
      });
    }
  }
  
  /**
   * Get resource credits (RC) data for a user
   * @param {string} username - The username to get RC data for
   * @returns {Promise<Object>} RC data including percentage
   */
  async getResourceCredits(username) {
    try {
      const user = username || this.currentUser;
      if (!user) throw new Error('No username provided');
      
      // Fetch RC data using SteemCore's endpoints and retry mechanism
      const data = await this.callJsonRpc('rc_api.find_rc_accounts', { accounts: [user] });
      
      if (!data.result || !data.result.rc_accounts || !data.result.rc_accounts[0]) {
        throw new Error('Invalid RC data response');
      }
      
      const rcAccount = data.result.rc_accounts[0];
      const currentMana = parseInt(rcAccount.rc_manabar.current_mana);
      const maxMana = parseInt(rcAccount.max_rc); // Max mana from account
      
      // If max_rc is missing, we need to calculate it
      let maxRc = maxMana;
      if (!maxRc || maxRc === 0) {
        // Calculate max RC based on account VESTS
        const account = await steemService.getUser(user);
        if (account) {
          const vestingShares = parseFloat(account.vesting_shares);
          // Approximation - in real app you'd use a more accurate calculation
          maxRc = vestingShares * 1000000;
        }
      }
      
      // Calculate RC percentage
      const rcPercentage = Math.min(100, Math.floor((currentMana / maxRc) * 100));
      
      return {
        currentMana,
        maxMana: maxRc,
        percentage: rcPercentage
      };
    } catch (error) {
      console.error('Error fetching RC data:', error);
      return {
        currentMana: 0,
        maxMana: 0,
        percentage: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch current STEEM and SBD prices from market APIs
   * @returns {Promise<Object>} Current prices in USD
   */
  async getCryptoPrices() {
    try {
      // Fetch STEEM price data using SteemCore
      const steemData = await this.callJsonRpc('market_history_api.get_ticker', {});
      
      // Extract the latest price from the response
      let steemPrice = 0;
      let sbdPrice = 1; // SBD is a stablecoin pegged at ~1 USD
      
      if (steemData.result && steemData.result.latest) {
        steemPrice = parseFloat(steemData.result.latest);
        console.log('Current STEEM price:', steemPrice);
      } else {
        console.warn('Could not extract STEEM price from API response', steemData);
      }
      
      return {
        steem: steemPrice,
        sbd: sbdPrice
      };
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      return {
        steem: 0,
        sbd: 1 // Default to 1 USD for SBD as it's a stablecoin
      };
    }
  }

  /**
   * Calculate voting power based on account data
   * @param {Object} account - The account data object
   * @returns {number} Current voting power as percentage (0-100)
   */
  calculateVotingPower(account) {
    // Voting Power calculation
    const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
    const secondsPassedSinceLastVote = (new Date().getTime() - lastVoteTime) / 1000;
    const regeneratedVotingPower = secondsPassedSinceLastVote * (10000 / (5 * 24 * 60 * 60));
    const currentVotingPower = Math.min(10000, account.voting_power + regeneratedVotingPower) / 100;
      
    return Math.floor(currentVotingPower);
  }

  /**
   * Get account resource usage (voting power, RC)
   * @param {string} username - Username to get resources for
   * @returns {Promise<Object>} Resource usage data
   */
  async getAccountResources(username) {
    try {
      const user = username || this.currentUser;
      if (!user) throw new Error('No username provided');
      
      // Use SteemCore to get account info
      const steem = await this.steemCore.ensureLibraryLoaded();
      
      const account = await this.steemCore.executeWithRetry(() => {
        return new Promise((resolve, reject) => {
          steem.api.getAccounts([user], (err, accounts) => {
            if (err) reject(err);
            else if (accounts && accounts.length > 0) resolve(accounts[0]);
            else reject(new Error('Account not found'));
          });
        });
      });
      
      if (!account) throw new Error('Account not found');
      
      // Calculate voting power
      const votingPower = this.calculateVotingPower(account);
      
      // Get RC data
      const rc = await this.getResourceCredits(user);
      
      return {
        voting: votingPower,
        rc: rc.percentage
      };
    } catch (error) {
      console.error('Error fetching account resources:', error);
      return {
        voting: 0,
        rc: 0,
        error: error.message
      };
    }
  }

  /**
   * Get user's wallet balances
   * @param {string} username - Username to get balances for
   * @returns {Promise<Object>} User's balances
   */
  async getUserBalances(username) {
    try {
      const user = username || this.currentUser;
      if (!user) throw new Error('No username provided');
      
      // Get account data using SteemCore
      const steem = await this.steemCore.ensureLibraryLoaded();
      
      const account = await this.steemCore.executeWithRetry(() => {
        return new Promise((resolve, reject) => {
          steem.api.getAccounts([user], (err, accounts) => {
            if (err) reject(err);
            else if (accounts && accounts.length > 0) resolve(accounts[0]);
            else reject(new Error('Account not found'));
          });
        });
      });
      
      if (!account) throw new Error('Failed to load account data');
      
      // Extract balances
      const steemBalance = parseFloat(account.balance).toFixed(3);
      const sbdBalance = parseFloat(account.sbd_balance).toFixed(3);
      
      // Calculate STEEM Power
      const vestingShares = parseFloat(account.vesting_shares);
      const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
      const receivedVestingShares = parseFloat(account.received_vesting_shares);
      
      const steemPower = await this.vestsToSteem(
        vestingShares - delegatedVestingShares + receivedVestingShares
      );
      
      // Fetch current prices using our new SteemCore-based method
      const prices = await this.getCryptoPrices();
      
      // Calculate USD values
      const steemUsdValue = (parseFloat(steemBalance) * prices.steem).toFixed(2);
      const sbdUsdValue = (parseFloat(sbdBalance) * prices.sbd).toFixed(2);
      const spUsdValue = (parseFloat(steemPower) * prices.steem).toFixed(2);
      
      // Calculate total USD value
      const totalUsdValue = (
        parseFloat(steemUsdValue) + 
        parseFloat(sbdUsdValue) + 
        parseFloat(spUsdValue)
      ).toFixed(2);
      
      return {
        steem: steemBalance,
        sbd: sbdBalance,
        steemPower: steemPower.toFixed(3),
        prices: {
          steem: prices.steem,
          sbd: prices.sbd
        },
        usdValues: {
          steem: steemUsdValue,
          sbd: sbdUsdValue,
          steemPower: spUsdValue,
          total: totalUsdValue
        },
        account // Include the full account for advanced usage
      };
    } catch (error) {
      console.error('Error fetching user balances:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const walletService = new WalletService();
export default walletService;