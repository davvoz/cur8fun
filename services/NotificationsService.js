import steemService from './SteemService.js';
import authService from './AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';
import { TYPES } from '../models/Notification.js';

/**
 * Service for managing user notifications in the Steem application
 */
class NotificationsService {
    constructor() {
        this.notificationsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.unreadCount = 0;
        
        // Listen for authentication changes
        eventEmitter.on('auth:changed', ({ user }) => {
            if (!user) {
                // Clear cache when user logs out
                this.clearCache();
            }
        });
    }

    /**
     * Fetches notifications for the current user
     * @param {string} type - Type of notifications to fetch (default: all)
     * @param {number} page - Page number for pagination
     * @param {number} limit - Number of notifications per page
     * @param {boolean} forceRefresh - Whether to bypass cache
     * @returns {Promise<{notifications: Array, hasMore: boolean}>} 
     */
    async getNotifications(type = TYPES.ALL, page = 1, limit = 20, forceRefresh = false) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            console.warn('Cannot get notifications: No authenticated user');
            return { notifications: [], hasMore: false };
        }

        const username = currentUser.username;
        const cacheKey = `${username}_${type}_notifications_page_${page}`;
        
        // Check cache first unless forceRefresh is true
        if (!forceRefresh) {
            const cachedNotifications = this.getCachedNotifications(cacheKey);
            if (cachedNotifications) {
                console.log(`Using cached notifications for ${username}, type: ${type}, page: ${page}`);
                return cachedNotifications;
            }
        }
        
        try {
            console.log(`Fetching ${type} notifications for ${username}, page: ${page}`);
            // Different logic based on notification type
            let notifications = [];
            let hasMore = false;
            
            // Use account history to get notifications
            const startFrom = page > 1 ? (page - 1) * limit : -1;
            const accountHistory = await steemService.getAccountHistory(username, startFrom, limit + 1);
            
            if (accountHistory && Array.isArray(accountHistory)) {
                // Process account history to extract notifications
                const processedNotifications = this.processAccountHistory(accountHistory, type);
                notifications = processedNotifications.slice(0, limit);
                hasMore = accountHistory.length > limit;
                
                // Update unread count on first page fetch
                if (page === 1 && type === TYPES.ALL) {
                    this.unreadCount = notifications.filter(n => !n.isRead).length;
                    eventEmitter.emit('notifications:updated', { unreadCount: this.unreadCount });
                }
                
                // Cache the results
                this.cacheNotifications(cacheKey, { notifications, hasMore });
                
                console.log(`Retrieved ${notifications.length} notifications`);
            }
            
            return { notifications, hasMore };
        } catch (error) {
            console.error(`Error fetching notifications for ${username}:`, error);
            return { notifications: [], hasMore: false };
        }
    }
    
    /**
     * Process account history to extract notifications
     * @param {Array} history - Account history from the blockchain
     * @param {string} type - Type of notifications to filter
     * @returns {Array} - Processed notifications
     */
    processAccountHistory(history, type) {
        if (!history || !Array.isArray(history)) return [];
        
        const notifications = [];
        const currentUser = authService.getCurrentUser()?.username;
        
        history.forEach(historyItem => {
            const [id, operation] = historyItem;
            
            if (!operation || !operation[1] || !operation[0]) return;
            
            const opType = operation[0];
            const opData = operation[1];
            
            // Parse based on operation type
            let notification = null;
            
            switch (opType) {
                case 'comment': 
                    // Comments on user's posts are replies
                    if (opData.parent_author === currentUser) {
                        notification = this.createNotification(
                            TYPES.REPLIES,
                            {
                                author: opData.author,
                                permlink: opData.permlink,
                                parent_permlink: opData.parent_permlink,
                                body: opData.body.substring(0, 140) + (opData.body.length > 140 ? '...' : ''),
                                timestamp: new Date().toISOString()
                            },
                            false
                        );
                    }
                    // Check if comment mentions the user
                    else if (opData.body && opData.body.includes(`@${currentUser}`)) {
                        notification = this.createNotification(
                            TYPES.MENTIONS,
                            {
                                author: opData.author,
                                permlink: opData.permlink,
                                body: opData.body.substring(0, 140) + (opData.body.length > 140 ? '...' : ''),
                                timestamp: new Date().toISOString()
                            },
                            false
                        );
                    }
                    break;
                    
                case 'vote':
                    if (opData.author === currentUser && opData.weight > 0) {
                        notification = this.createNotification(
                            TYPES.UPVOTES,
                            {
                                voter: opData.voter,
                                permlink: opData.permlink,
                                weight: opData.weight / 100,
                                timestamp: new Date().toISOString()
                            },
                            false
                        );
                    }
                    break;
                    
                case 'follow':
                    try {
                        // Follow operations are in custom_json
                        if (opData.what && opData.what.includes('blog') && opData.following === currentUser) {
                            notification = this.createNotification(
                                TYPES.FOLLOWS,
                                {
                                    follower: opData.follower,
                                    timestamp: new Date().toISOString()
                                },
                                false
                            );
                        }
                    } catch (e) {
                        console.warn('Error parsing follow operation:', e);
                    }
                    break;
                    
                case 'reblog':
                    if (opData.author === currentUser) {
                        notification = this.createNotification(
                            TYPES.RESTEEMS,
                            {
                                account: opData.account,
                                permlink: opData.permlink,
                                timestamp: new Date().toISOString()
                            },
                            false
                        );
                    }
                    break;
            }
            
            if (notification && (type === TYPES.ALL || notification.type === type)) {
                notifications.push(notification);
            }
        });
        
        return notifications;
    }
    
    /**
     * Creates a notification object
     */
    createNotification(type, data, isRead = false) {
        return {
            type,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
            isRead
        };
    }
    
    /**
     * Mark a notification as read
     * @param {object} notification - The notification to mark
     */
    async markAsRead(notification) {
        if (!notification) return;
        
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;
        
        // Update notification status
        notification.isRead = true;
        
        try {
            // Storage might be implemented with local storage or a remote service
            this.saveNotificationStatus(currentUser.username, notification);
            
            // Update unread count
            this.decrementUnreadCount();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;
        
        // Update all cached notifications
        this.notificationsCache.forEach((value, key) => {
            if (key.startsWith(`${currentUser.username}_`)) {
                const updated = {
                    ...value,
                    notifications: value.notifications.map(n => ({...n, isRead: true}))
                };
                this.notificationsCache.set(key, updated);
            }
        });
        
        // Save the status
        this.saveAllNotificationsRead(currentUser.username);
        
        // Reset unread count
        this.unreadCount = 0;
        eventEmitter.emit('notifications:updated', { unreadCount: 0 });
    }
    
    /**
     * Save notification read status (implementation depends on storage strategy)
     */
    saveNotificationStatus(username, notification) {
        try {
            // Get existing read statuses
            const readStatusKey = `${username}_read_notifications`;
            let readStatuses = {};
            
            try {
                const stored = localStorage.getItem(readStatusKey);
                if (stored) {
                    readStatuses = JSON.parse(stored);
                }
            } catch (e) {
                console.warn('Error parsing stored notification statuses:', e);
            }
            
            // Create a unique ID for this notification
            const notificationId = this.generateNotificationId(notification);
            
            // Update the status
            readStatuses[notificationId] = true;
            
            // Store back in localStorage
            localStorage.setItem(readStatusKey, JSON.stringify(readStatuses));
        } catch (error) {
            console.error('Error saving notification status:', error);
        }
    }
    
    /**
     * Save all notifications as read
     */
    saveAllNotificationsRead(username) {
        try {
            const timestamp = new Date().toISOString();
            localStorage.setItem(`${username}_all_read_timestamp`, timestamp);
        } catch (error) {
            console.error('Error saving all-read status:', error);
        }
    }
    
    /**
     * Generate a unique ID for a notification
     */
    generateNotificationId(notification) {
        // This is a simplified implementation - production code would need a more robust approach
        const { type, data, timestamp } = notification;
        let idParts = [type];
        
        // Add type-specific fields to ID
        switch (type) {
            case TYPES.REPLIES:
            case TYPES.MENTIONS:
                idParts.push(data.author, data.permlink);
                break;
            case TYPES.UPVOTES:
                idParts.push(data.voter, data.permlink);
                break;
            case TYPES.FOLLOWS:
                idParts.push(data.follower);
                break;
            case TYPES.RESTEEMS:
                idParts.push(data.account, data.permlink);
                break;
        }
        
        // Add timestamp for uniqueness
        idParts.push(timestamp);
        return idParts.join('_');
    }
    
    /**
     * Decrement the unread count
     */
    decrementUnreadCount() {
        if (this.unreadCount > 0) {
            this.unreadCount--;
            eventEmitter.emit('notifications:updated', { unreadCount: this.unreadCount });
        }
    }
    
    /**
     * Get the count of unread notifications
     */
    getUnreadCount() {
        return this.unreadCount;
    }
    
    /**
     * Load the unread count for the current user
     */
    async loadUnreadCount() {
        const { notifications } = await this.getNotifications(TYPES.ALL, 1, 50);
        this.unreadCount = notifications.filter(n => !n.isRead).length;
        eventEmitter.emit('notifications:updated', { unreadCount: this.unreadCount });
        return this.unreadCount;
    }
    
    /**
     * Get notifications from cache
     */
    getCachedNotifications(cacheKey) {
        const cacheEntry = this.notificationsCache.get(cacheKey);
        
        if (!cacheEntry) {
            return null;
        }
        
        // Check if cache is expired
        const now = Date.now();
        if (now - cacheEntry.timestamp > this.cacheExpiry) {
            this.notificationsCache.delete(cacheKey);
            return null;
        }
        
        return cacheEntry.data;
    }
    
    /**
     * Cache notifications
     */
    cacheNotifications(cacheKey, data) {
        this.notificationsCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clear the notifications cache
     */
    clearCache() {
        this.notificationsCache.clear();
        this.unreadCount = 0;
        console.log('Notifications cache cleared');
    }
}

// Initialize singleton instance
const notificationsService = new NotificationsService();
export default notificationsService;
