import eventEmitter from '../utils/EventEmitter.js';
import authService from './AuthService.js';

/**
 * Service for managing automated curation settings
 * Handles CRUD operations for curation targets via backend API
 */
class CurationManagementService {
  constructor() {
    this.baseUrl = '/api/curation';
    this.cache = new Map();
    
    // Listen for auth changes to clear cache
    eventEmitter.on('auth:changed', () => {
      this.cache.clear();
    });
  }

  /**
   * Get all curation targets for current user
   * @returns {Promise<Array>} Array of curation targets
   */
  async getCurationTargets() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in');
    }

    const cacheKey = `targets_${currentUser.username}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseUrl}/targets?username=${encodeURIComponent(currentUser.username)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const targets = await response.json();
      this.cache.set(cacheKey, targets);
      
      eventEmitter.emit('curation:targets-loaded', { targets });
      return targets;
    } catch (error) {
      console.error('Error fetching curation targets:', error);
      eventEmitter.emit('curation:error', { 
        type: 'fetch_targets',
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Add new curation target
   * @param {Object} targetData - Target configuration
   * @param {string} targetData.target_username - Username to follow
   * @param {number} targetData.vote_delay_minutes - Minutes to wait before voting
   * @param {number} targetData.vote_percentage - Vote percentage (1-100)
   * @returns {Promise<Object>} Created target object
   */
  async addCurationTarget(targetData) {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in');
    }

    try {
      const payload = {
        curator_username: currentUser.username,
        target_username: targetData.target_username,
        vote_delay_minutes: targetData.vote_delay_minutes || 15,
        vote_percentage: targetData.vote_percentage || 100,
        is_active: targetData.is_active !== false
      };

      const response = await fetch(`${this.baseUrl}/targets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const newTarget = await response.json();
      
      // Clear cache to force refresh
      this.cache.clear();
      
      eventEmitter.emit('curation:target-added', { target: newTarget });
      return newTarget;
    } catch (error) {
      console.error('Error adding curation target:', error);
      eventEmitter.emit('curation:error', { 
        type: 'add_target',
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Update existing curation target
   * @param {number} targetId - Target ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated target object
   */
  async updateCurationTarget(targetId, updateData) {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in');
    }

    try {
      const response = await fetch(`${this.baseUrl}/targets/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const updatedTarget = await response.json();
      
      // Clear cache to force refresh
      this.cache.clear();
      
      eventEmitter.emit('curation:target-updated', { target: updatedTarget });
      return updatedTarget;
    } catch (error) {
      console.error('Error updating curation target:', error);
      eventEmitter.emit('curation:error', { 
        type: 'update_target',
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Delete curation target
   * @param {number} targetId - Target ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteCurationTarget(targetId) {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in');
    }

    try {
      const response = await fetch(`${this.baseUrl}/targets/${targetId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      // Clear cache to force refresh
      this.cache.clear();
      
      eventEmitter.emit('curation:target-deleted', { targetId });
      return true;
    } catch (error) {
      console.error('Error deleting curation target:', error);
      eventEmitter.emit('curation:error', { 
        type: 'delete_target',
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Get curation statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getCurationStats() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in');
    }

    try {
      const response = await fetch(`${this.baseUrl}/stats?username=${encodeURIComponent(currentUser.username)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json();
      eventEmitter.emit('curation:stats-loaded', { stats });
      return stats;
    } catch (error) {
      console.error('Error fetching curation stats:', error);
      eventEmitter.emit('curation:error', { 
        type: 'fetch_stats',
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Toggle curation target active status
   * @param {number} targetId - Target ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>} Updated target
   */
  async toggleTargetStatus(targetId, isActive) {
    return this.updateCurationTarget(targetId, { is_active: isActive });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get detailed target information including user avatar and last post
   * @param {string} username - Username to get info for
   * @returns {Promise<Object>} User info with last post
   */
  async getTargetUserInfo(username) {
    try {
      const response = await fetch(`${this.baseUrl}/target-info?username=${encodeURIComponent(username)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const userInfo = await response.json();
      return userInfo;
    } catch (error) {
      console.error('Error fetching target user info:', error);
      // Return default info if API fails
      return {
        username: username,
        avatar_url: `https://steemitimages.com/u/${username}/avatar`,
        last_post: null,
        post_count: 0,
        reputation: 0
      };
    }
  }

  /**
   * Get enhanced curation targets with user info
   * @returns {Promise<Array>} Array of targets with enhanced user data
   */
  async getEnhancedCurationTargets() {
    const targets = await this.getCurationTargets();
    
    // Get user info for each target in parallel
    const enhancedTargets = await Promise.all(
      targets.map(async (target) => {
        try {
          const userInfo = await this.getTargetUserInfo(target.target_username);
          return {
            ...target,
            user_info: userInfo
          };
        } catch (error) {
          // If user info fails, return target with default info
          return {
            ...target,
            user_info: {
              username: target.target_username,
              avatar_url: `https://steemitimages.com/u/${target.target_username}/avatar`,
              last_post: null,
              post_count: 0,
              reputation: 0
            }
          };
        }
      })
    );

    return enhancedTargets;
  }
}

// Export singleton instance
const curationManagementService = new CurationManagementService();
export default curationManagementService;
