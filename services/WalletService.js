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
   * Get transaction history for any user (not just the logged-in user)
   * @param {string} username - Username to get history for
   * @param {number} limit - Number of transactions to retrieve
   * @return {Promise<Array>} Array of transactions
   */
  async getUserTransactionHistory(username, limit = 30) {
    if (!username) return [];
    
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getAccountHistory(username, -1, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      console.error(`Error fetching transaction history for ${username}:`, error);
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
      
      // Use requestBroadcast with the claim_reward_balance operation
      return new Promise((resolve, reject) => {
        const operations = [
          ["claim_reward_balance", {
            account: this.currentUser,
            reward_steem: rewardSteem,
            reward_sbd: rewardSBD,
            reward_vests: rewardVests
          }]
        ];
        
        window.steem_keychain.requestBroadcast(
          this.currentUser,
          operations,
          "Active", // The key type needed for claiming rewards
          function(response) {
            console.log('Claim rewards response:', response);
            
            if (response.success) {
              resolve({ 
                success: true,
                rewards: {
                  steem: rewardSteem.split(' ')[0],
                  sbd: rewardSBD.split(' ')[0],
                  vests: rewardVests.split(' ')[0]
                }
              });
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
      
      // Calculate remaining weeks - using 4 weeks as the total duration
      // and limiting the maximum displayed remaining weeks to 4
      let remainingWeeks = 0;
      if (parseFloat(account.to_withdraw) > 0) {
        const withdrawRate = parseFloat(account.vesting_withdraw_rate);
        if (withdrawRate > 0) {
          remainingWeeks = Math.min(
            Math.ceil(parseFloat(account.to_withdraw) / withdrawRate), 
            4 // Maximum of 4 weeks
          );
        }
      }
      
      // Format the weekly rate to 3 decimal places for display
      const formattedWeeklyRate = parseFloat(weeklyRate).toFixed(3);
      
      return {
        isPoweringDown: true,
        weeklyRate: formattedWeeklyRate,
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

  /**
   * Calculate Annual Percentage Rate (APR) based on weekly rewards and vesting shares
   * @param {number} totalWeeklyRewards - Total weekly rewards in STEEM
   * @param {number} vestingShares - Total vesting shares (VESTS)
   * @returns {Promise<number>} Promise resolving to the calculated APR percentage
   */
  async calculateAPR(totalWeeklyRewards, vestingShares) {
    try {
      // Convert vesting shares to STEEM Power
      const totalVestingSteem = await this.vestsToSteem(vestingShares);
      
      // Calculate annual rewards (52 weeks in a year)
      const annualRewards = totalWeeklyRewards * 52;
      
      // Calculate APR as percentage: (annualRewards / totalVestingSteem) * 100
      const apr = (annualRewards / totalVestingSteem) * 100;
      
      // Return APR with 2 decimal places
      return parseFloat(apr.toFixed(2));
    } catch (error) {
      console.error('Error calculating APR:', error);
      throw error;
    }
  }
  
  /**
   * Calculate curation efficiency metrics for a user over a specific time period
   * @param {string} username - Steem username to analyze
   * @param {number} daysBack - Number of days to look back (default: 7)
   * @returns {Promise<Object>} Curation statistics, efficiency data and APR
   */
  async calculateCurationEfficiency(username = null, daysBack = 7) {
    try {
      // Use provided username or current user
      const curator = username || this.currentUser;
      
      if (!curator) {
        throw new Error('No username provided');
      }
      
      // Emit event to notify UI about calculation starting
      eventEmitter.emit('curation:calculation-started', { username: curator });
      
      let allResults = [];
      let lastId = -1;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      let isWithinTimeframe = true;
      let processedCount = 0;
      
      // Set a maximum time or operation count to prevent infinite loops
      const maxOperations = 5000;
      const startTime = Date.now();
      const maxTimeMs = 30000; // 30 seconds maximum
      
      // Continue fetching history until we get data older than the cutoff date
      while (isWithinTimeframe) {
        // Check if we've exceeded time or operation limits
        if (processedCount > maxOperations || (Date.now() - startTime) > maxTimeMs) {
          console.warn(`Stopping curation calculation: reached limits (${processedCount} operations processed)`);
          break;
        }
        
        try {
          // Get account history in batches
          const accountHistory = await this._getAccountHistory(curator, lastId);
          if (!accountHistory || accountHistory.length === 0) break;
          
          // Sort by ID in descending order
          accountHistory.sort((a, b) => b[0] - a[0]);
          
          // Process all operations in this batch
          for (const entry of accountHistory) {
            const [id, operation] = entry;
            
            // Process only curation reward operations
            if (operation.op[0] === 'curation_reward') {
              const timestamp = new Date(operation.timestamp + 'Z');
              
              // Stop if we reach data older than cutoff
              if (timestamp < cutoffDate) {
                isWithinTimeframe = false;
                break;
              }
              
              const opData = operation.op[1];
              
              // Extract operation data
              const comment_author = opData.comment_author || opData.author;
              const comment_permlink = opData.comment_permlink || opData.permlink;
              const reward = opData.reward;
              
              if (!comment_author || !comment_permlink || !reward) {
                console.warn('Invalid curation reward data structure');
                continue;
              }
              
              const postIdentifier = `@${comment_author}/${comment_permlink}`;
              
              try {
                // Get post and vote details
                const { post, votes } = await this._getPostDetails(comment_author, comment_permlink);
                const curatorVote = votes.find(v => v.voter === curator);
                
                if (curatorVote) {
                  // Parse reward amount
                  const reward_vests = parseFloat(reward.split(' ')[0]);
                  
                  // Calculate vote metrics
                  const vote_weight = curatorVote.weight / 100; 
                  const percent = curatorVote.percent / 100;
                  const vote_time = new Date(curatorVote.time + 'Z');
                  const created_time = new Date(post.created + 'Z');
                  const voteAgeMins = Math.floor((vote_time - created_time) / (1000 * 60));
                  
                  // Convert to STEEM Power
                  const effective_reward_sp = await this.vestsToSteem(reward_vests);
                  const estimated_reward = await this.vestsToSteem(vote_weight);
                  const vote_power_sp = estimated_reward * 2; // Full vote value
                  
                  // Calculate efficiency percentage
                  const efficiency = (effective_reward_sp / estimated_reward) * 100;
                  
                  // Store result
                  allResults.push({
                    post: postIdentifier,
                    rewardSP: effective_reward_sp,
                    voteValue: vote_power_sp, 
                    expectedReward: estimated_reward,
                    efficiency: efficiency,
                    percent: percent,
                    time: curatorVote.time,
                    voteAgeMins: voteAgeMins
                  });
                  
                  processedCount++;
                  
                  // Emit progress updates periodically
                  if (processedCount % 10 === 0) {
                    eventEmitter.emit('curation:calculation-progress', {
                      username: curator,
                      processedCount,
                      latestResults: allResults
                    });
                  }
                }
              } catch (error) {
                console.warn(`Error processing post ${postIdentifier}:`, error);
                continue;
              }
            }
            
            // Update last ID for next batch
            lastId = id - 1;
            if (lastId < 0) break;
          }
          
          // Break if we've gone past the timeframe
          if (!isWithinTimeframe) break;
        } catch (error) {
          console.error('Error retrieving account history:', error);
          throw error;
        }
      }
      
      // Handle cases with no results found
      if (allResults.length === 0) {
        const noResultsMessage = `No curation rewards found for ${curator} in the last ${daysBack} days`;
        console.log(noResultsMessage);
        
        // Emit completion event with no results
        eventEmitter.emit('curation:calculation-completed', {
          success: false,
          message: noResultsMessage,
          username: curator,
          timeframe: {
            days: daysBack,
            from: cutoffDate,
            to: new Date()
          },
          summary: {
            totalVotes: 0,
            totalRewards: '0.000',
            avgEfficiency: '0.00',
            highestReward: '0.000',
            apr: '0.00'
          },
          detailedResults: []
        });
        
        return {
          success: false,
          message: noResultsMessage,
          results: []
        };
      }
      
      // Calculate total rewards and statistics
      const totalRewards = allResults.reduce((sum, result) => sum + result.rewardSP, 0);
      const avgEfficiency = allResults.reduce((sum, result) => sum + result.efficiency, 0) / allResults.length;
      const highestReward = Math.max(...allResults.map(result => result.rewardSP));
      const mostEfficientVote = allResults.reduce((best, current) => 
        (current.efficiency > best.efficiency) ? current : best, allResults[0]);
      
      // Calculate APR based on rewards and vesting shares
      let apr = 0;
      try {
        // Get account data for vesting shares calculation
        const account = await steemService.getUser(curator);
        if (account) {
          const delegatedVestingShares = parseFloat(account.delegated_vesting_shares.split(' ')[0]);
          const vestingShares = parseFloat(account.vesting_shares.split(' ')[0]);
          const receivedVestingShares = parseFloat(account.received_vesting_shares.split(' ')[0]);
          const totalVestingShares = vestingShares + receivedVestingShares - delegatedVestingShares;
          
          // Calculate APR
          apr = await this.calculateAPR(totalRewards, totalVestingShares);
        }
      } catch (error) {
        console.warn('Error calculating APR:', error);
      }
      
      // Build result object
      const results = {
        success: true,
        username: curator,
        timeframe: {
          days: daysBack,
          from: cutoffDate,
          to: new Date()
        },
        summary: {
          totalVotes: allResults.length,
          totalRewards: totalRewards.toFixed(3),
          avgEfficiency: avgEfficiency.toFixed(2),
          highestReward: highestReward.toFixed(3),
          mostEfficientVote: {
            post: mostEfficientVote.post,
            efficiency: mostEfficientVote.efficiency.toFixed(2),
            reward: mostEfficientVote.rewardSP.toFixed(3)
          },
          apr: apr.toFixed(2)
        },
        detailedResults: allResults
      };
      
      // Emit completion event with results
      eventEmitter.emit('curation:calculation-completed', results);
      
      return results;
    } catch (error) {
      console.error('Error calculating curation efficiency:', error);
      
      // Emit error event
      eventEmitter.emit('curation:calculation-error', {
        error: error.message || 'Unknown error'
      });
      
      throw error;
    }
  }
  
  /**
   * Helper method to get account history from Steem API
   * @private
   */
  async _getAccountHistory(username, from = -1, limit = 1000) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getAccountHistory(username, from, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      console.error('Error loading Steem library:', error);
      throw error;
    }
  }
  
  /**
   * Helper method to get post and votes details
   * @private
   */
  async _getPostDetails(author, permlink) {
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getContent(author, permlink, (err, post) => {
          if (err) reject(err);
          else {
            // Get voters on this post
            steem.api.getActiveVotes(author, permlink, (voteErr, votes) => {
              if (voteErr) reject(voteErr);
              else resolve({ post, votes });
            });
          }
        });
      });
    } catch (error) {
      console.error('Error loading Steem library:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const walletService = new WalletService();
export default walletService;