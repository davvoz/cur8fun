import eventEmitter from '../utils/EventEmitter.js';
import steemService from './SteemService.js';
import authService from './AuthService.js';

class WalletService {
  constructor() {
    this.currentUser = null;
    this.balances = {
      steem: '0.000',
      sbd: '0.000',
      steemPower: '0.000'
    };
    
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
        const vestingShares = parseFloat(account.vesting_shares);
        const delegatedVestingShares = parseFloat(account.delegated_vesting_shares);
        const receivedVestingShares = parseFloat(account.received_vesting_shares);
        
        const steemPower = await this.vestsToSteem(
          vestingShares - delegatedVestingShares + receivedVestingShares
        );
        
        this.balances = {
          steem: steemBalance,
          sbd: sbdBalance,
          steemPower: steemPower.toFixed(3)
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
   * Get user delegations
   */
  async getDelegations() {
    try {
      const username = authService.getCurrentUser()?.username;
      if (!username) return [];
      
      const delegations = await new Promise((resolve, reject) => {
        window.steem.api.getVestingDelegations(username, null, 100, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Convert vests to SP for each delegation
      return Promise.all(delegations.map(async (delegation) => {
        const sp_amount = await this.vestsToSteem(delegation.vesting_shares);
        return {
          ...delegation,
          sp_amount: parseFloat(sp_amount).toFixed(3)
        };
      }));
    } catch (error) {
      console.error('Error fetching delegations:', error);
      return [];
    }
  }
  
  /**
   * Transfer STEEM to another account
   */
  async transferSteem(recipient, amount, memo = '') {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestTransfer(
          this.currentUser,
          recipient,
          parseFloat(amount).toFixed(3),
          memo,
          'STEEM',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Transfer failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error transferring STEEM:', error);
      throw error;
    }
  }
  
  /**
   * Power up STEEM to STEEM POWER
   */
  async powerUp(amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestPowerUp(
          this.currentUser,
          this.currentUser,
          parseFloat(amount).toFixed(3),
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Power up failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error powering up STEEM:', error);
      throw error;
    }
  }
  
  /**
   * Delegate STEEM POWER to another account
   */
  async delegateSteemPower(delegatee, amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestDelegation(
          this.currentUser,
          delegatee,
          parseFloat(amount).toFixed(3),
          'SP',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Delegation failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error delegating STEEM POWER:', error);
      throw error;
    }
  }
  
  /**
   * Get account transaction history
   */
  async getTransactionHistory(limit = 20) {
    if (!this.currentUser) return [];
    
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      const result = await new Promise((resolve, reject) => {
        steem.api.getAccountHistory(this.currentUser, -1, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  /**
   * Power down STEEM POWER
   */
  async powerDown(amount) {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestPowerDown(
          this.currentUser,
          this.currentUser,
          parseFloat(amount).toFixed(3),
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Power down failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error powering down STEEM:', error);
      throw error;
    }
  }

  /**
   * Cancel a STEEM POWER down
   */
  async cancelPowerDown() {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return this.powerDown('0.000'); // Setting to 0 cancels power down
    } catch (error) {
      console.error('Error canceling power down:', error);
      throw error;
    }
  }

  /**
   * Get power down schedule and current power down status
   */
  async getPowerDownInfo() {
    if (!this.currentUser) return null;
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) return null;
      
      // Calculate next power down date
      const nextVestingWithdrawal = new Date(account.next_vesting_withdrawal + 'Z');
      const isWithdrawing = parseFloat(account.vesting_withdraw_rate) > 0;
      
      // Calculate weekly withdrawal rate in SP
      const withdrawRateVests = parseFloat(account.vesting_withdraw_rate);
      const withdrawRateSP = await this.vestsToSteem(withdrawRateVests);
      
      // Calculate remaining weeks (if powering down)
      let remainingWeeks = 0;
      if (isWithdrawing) {
        const totalVestingShares = parseFloat(account.vesting_shares);
        remainingWeeks = Math.ceil(totalVestingShares / withdrawRateVests);
      }
      
      return {
        isPoweringDown: isWithdrawing,
        nextPowerDown: isWithdrawing ? nextVestingWithdrawal : null,
        weeklyRate: isWithdrawing ? withdrawRateSP.toFixed(3) : '0.000',
        remainingWeeks
      };
    } catch (error) {
      console.error('Error getting power down info:', error);
      return null;
    }
  }

  /**
   * Transfer SBD to another account
   */
  async transferSBD(recipient, amount, memo = '') {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestTransfer(
          this.currentUser,
          recipient,
          parseFloat(amount).toFixed(3),
          memo,
          'SBD',
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Transfer failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error transferring SBD:', error);
      throw error;
    }
  }

  /**
   * Claim rewards (STEEM, STEEM POWER, SBD)
   */
  async claimRewards() {
    if (!this.currentUser) throw new Error('Not logged in');
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) throw new Error('Failed to retrieve account information');
      
      const rewardSteem = account.reward_steem_balance;
      const rewardSBD = account.reward_sbd_balance;
      const rewardVests = account.reward_vesting_balance;
      
      // Check if there are rewards to claim
      if (parseFloat(rewardSteem) === 0 && 
          parseFloat(rewardSBD) === 0 && 
          parseFloat(rewardVests) === 0) {
        throw new Error('No rewards to claim');
      }
      
      return new Promise((resolve, reject) => {
        window.steem_keychain.requestClaimRewards(
          this.currentUser,
          rewardSteem,
          rewardSBD,
          rewardVests,
          function(response) {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Claim rewards failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    }
  }

  /**
   * Get available rewards to claim
   */
  async getAvailableRewards() {
    if (!this.currentUser) return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
    
    try {
      const account = await steemService.getUser(this.currentUser);
      
      if (!account) return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
      
      const rewardSteem = account.reward_steem_balance || '0.000 STEEM';
      const rewardSBD = account.reward_sbd_balance || '0.000 SBD';
      const rewardVests = account.reward_vesting_balance || '0.000 VESTS';
      
      // Convert vests to SP
      const vestAmount = parseFloat(rewardVests.split(' ')[0]);
      const sp = await this.vestsToSteem(vestAmount);
      
      return {
        steem: rewardSteem.split(' ')[0],
        sbd: rewardSBD.split(' ')[0],
        vest: rewardVests.split(' ')[0],
        sp: sp.toFixed(3)
      };
    } catch (error) {
      console.error('Error getting available rewards:', error);
      return { steem: '0.000', sbd: '0.000', vest: '0.000', sp: '0.000' };
    }
  }

  /**
   * Power up STEEM to STEEM POWER using Steem Keychain
   * @param {string} amount - Amount to power up with 3 decimal places
   * @returns {Promise} Promise resolving to response object
   */
  powerUp(amount) {
    return new Promise((resolve, reject) => {
      try {
        const username = authService.getCurrentUser()?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        if (!window.steem_keychain) {
          return reject(new Error('Steem Keychain not available'));
        }
        
        // Steem Keychain uses "transfer_to_vesting" operation
        const operations = [
          ["transfer_to_vesting", {
            from: username,
            to: username, // Self power-up
            amount: `${amount} STEEM` // Format must be "0.000 STEEM"
          }]
        ];
        
        window.steem_keychain.requestBroadcast(
          username,      // Username
          operations,    // Operations array
          "Active",      // Key type required
          (response) => {
            console.log('Power up response:', response);
            
            if (response.success) {
              resolve({ success: true });
            } else {
              resolve({ 
                success: false, 
                message: response.message || 'Unknown error' 
              });
            }
          }
        );
      } catch (error) {
        console.error('Power up error:', error);
        reject(error);
      }
    });
  }

  /**
   * Power down SP to STEEM using Steem Keychain
   * @param {string} amount - Amount to power down with 3 decimal places
   * @returns {Promise} Promise resolving to response object
   */
  powerDown(amount) {
    return new Promise((resolve, reject) => {
      try {
        const username = authService.getCurrentUser()?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        if (!window.steem_keychain) {
          return reject(new Error('Steem Keychain not available'));
        }

        // Convert to vests first (required for withdraw_vesting operation)
        this.steemToVests(amount)
          .then(vests => {
            // Steem Keychain uses "withdraw_vesting" operation
            const operations = [
              ["withdraw_vesting", {
                account: username,
                vesting_shares: `${vests} VESTS` // Format must be "0.000000 VESTS"
              }]
            ];
            
            window.steem_keychain.requestBroadcast(
              username,      // Username
              operations,    // Operations array
              "Active",      // Key type required
              (response) => {
                console.log('Power down response:', response);
                
                if (response.success) {
                  resolve({ success: true });
                } else {
                  resolve({ 
                    success: false, 
                    message: response.message || 'Unknown error' 
                  });
                }
              }
            );
          })
          .catch(error => {
            console.error('Error converting SP to VESTS:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Power down error:', error);
        reject(error);
      }
    });
  }

  /**
   * Cancel an active power down using Steem Keychain
   * @returns {Promise} Promise resolving to response object
   */
  cancelPowerDown() {
    return new Promise((resolve, reject) => {
      try {
        const username = authService.getCurrentUser()?.username;
        
        if (!username) {
          return reject(new Error('User not logged in'));
        }
        
        if (!window.steem_keychain) {
          return reject(new Error('Steem Keychain not available'));
        }
        
        // To cancel power down, set vesting_shares to 0
        const operations = [
          ["withdraw_vesting", {
            account: username,
            vesting_shares: "0.000000 VESTS" // Zero vests to cancel power down
          }]
        ];
        
        window.steem_keychain.requestBroadcast(
          username,      // Username
          operations,    // Operations array
          "Active",      // Key type required
          (response) => {
            console.log('Cancel power down response:', response);
            
            if (response.success) {
              resolve({ success: true });
            } else {
              resolve({ 
                success: false, 
                message: response.message || 'Unknown error' 
              });
            }
          }
        );
      } catch (error) {
        console.error('Cancel power down error:', error);
        reject(error);
      }
    });
  }

  /**
   * Get power down information for current user
   * @returns {Promise} Promise resolving to power down info object
   */
  async getPowerDownInfo() {
    try {
      const username = authService.getCurrentUser()?.username;
      
      if (!username) {
        throw new Error('User not logged in');
      }
      
      // Get account information
      const account = await new Promise((resolve, reject) => {
        window.steem.api.getAccounts([username], (err, accounts) => {
          if (err) reject(err);
          else if (accounts && accounts.length > 0) resolve(accounts[0]);
          else reject(new Error('Account not found'));
        });
      });
      
      // Check if powering down
      const isPoweringDown = parseFloat(account.vesting_withdraw_rate) > 0.000001;
      
      if (!isPoweringDown) {
        return {
          isPoweringDown: false,
          weeklyRate: '0.000',
          nextPowerDown: null,
          remainingWeeks: 0
        };
      }
      
      // Calculate weekly rate
      const weeklyRate = await this.vestsToSteem(account.vesting_withdraw_rate.split(' ')[0]);
      
      // Calculate next power down time
      const nextPowerDown = new Date(account.next_vesting_withdrawal + 'Z');
      
      // Calculate remaining weeks
      let remainingWeeks = 0;
      if (parseFloat(account.to_withdraw) > 0) {
        remainingWeeks = Math.ceil(
          parseFloat(account.to_withdraw) / parseFloat(account.vesting_withdraw_rate)
        );
      }
      
      return {
        isPoweringDown: true,
        weeklyRate,
        nextPowerDown,
        remainingWeeks
      };
      
    } catch (error) {
      console.error('Error getting power down info:', error);
      return {
        isPoweringDown: false,
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
const walletService = new WalletService();
export default walletService;