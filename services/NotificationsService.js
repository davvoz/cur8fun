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
        console.log(`Current user: ${username}, looking for notifications of type: ${type}`);
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
            console.log(`Calling getAccountHistory with username: ${username}, startFrom: ${startFrom}, limit: ${limit + 1}`);
            
            // Option to use test data if in development environment or explicitly requested
            const useTestData = localStorage.getItem('use_test_notifications') === 'true';
            let accountHistory;
            
            if (useTestData) {
                console.log('Using test notification data instead of calling API');
                accountHistory = this.getMockAccountHistory();
            } else {
                accountHistory = await steemService.getAccountHistory(username, startFrom, limit + 1);
                // Save a copy of raw data for debugging
                try {
                    localStorage.setItem('last_account_history', JSON.stringify(accountHistory));
                    console.log('Raw account history saved to localStorage for debugging');
                } catch (e) {
                    console.warn('Could not save account history to localStorage:', e);
                }
            }
            
            if (accountHistory && Array.isArray(accountHistory)) {
                console.log(`Received account history with ${accountHistory.length} items`);
                
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
                if (notifications.length === 0) {
                    console.warn("No notifications found after processing account history");
                    
                    // Show first few items of history for debugging
                    if (accountHistory.length > 0) {
                        console.log("First few items from account history:");
                        accountHistory.slice(0, 3).forEach((item, i) => {
                            console.log(`History item ${i}:`, JSON.stringify(item));
                        });
                    }
                }
            } else {
                console.error("Account history is empty or not an array:", accountHistory);
                // If no valid data received, try with example data
                if (!useTestData) {
                    console.log("Trying with mock data to verify notification processing logic");
                    const mockHistory = this.getMockAccountHistory();
                    const mockNotifications = this.processAccountHistory(mockHistory, type);
                    console.log(`Mock processing found ${mockNotifications.length} notifications`);
                    
                    // Do not cache, only display for debugging purposes
                    if (mockNotifications.length > 0) {
                        console.log("Mock notifications processed successfully. Consider enabling test mode for development.");
                    }
                }
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
        if (!history || !Array.isArray(history)) {
            console.error('Invalid history data received:', history);
            return [];
        }
        
        console.log(`Processing account history: ${history.length} items, filtering for type: ${type}`);
        console.debug('Account history structure sample:', JSON.stringify(history.slice(0, 2)));
        
        const notifications = [];
        const currentUser = authService.getCurrentUser()?.username;
        
        if (!currentUser) {
            console.warn('Cannot process notifications: Current user not available');
            return [];
        }
        
        console.log(`Looking for notifications for user: ${currentUser}`);
        
        // Debug counters
        let countChecked = 0, countSkipped = 0;
        let countByType = {
            comment: 0,
            vote: 0,
            follow: 0,
            reblog: 0,
            custom_json: 0,
            other: 0
        };
        
        history.forEach((historyItem, index) => {
            try {
                if (!Array.isArray(historyItem) || historyItem.length < 2) {
                    console.warn(`Invalid history item format at index ${index}:`, historyItem);
                    countSkipped++;
                    return;
                }
                
                const [id, transaction] = historyItem;
                
                // Log the exact structure of the item
                console.debug(`Structure of history item ${index}:`, JSON.stringify(historyItem).substring(0, 200));
                
                // Handle different possible data formats
                let opType, opData;
                
                if (transaction.op && Array.isArray(transaction.op) && transaction.op.length >= 2) {
                    // Standard format
                    opType = transaction.op[0];
                    opData = transaction.op[1];
                } else if (transaction.operation && Array.isArray(transaction.operation) && transaction.operation.length >= 2) {
                    // Alternative format
                    opType = transaction.operation[0];
                    opData = transaction.operation[1];
                } else if (transaction.operations && Array.isArray(transaction.operations) && transaction.operations.length > 0) {
                    // Another possible format
                    const firstOp = transaction.operations[0];
                    if (Array.isArray(firstOp) && firstOp.length >= 2) {
                        opType = firstOp[0];
                        opData = firstOp[1];
                    } else {
                        console.warn(`Unsupported operation format in transaction:`, transaction);
                        countSkipped++;
                        return;
                    }
                } else {
                    console.warn(`Transaction at index ${index} does not contain recognizable operation data:`, transaction);
                    countSkipped++;
                    return;
                }
                
                // Increment the operation type counter
                if (countByType.hasOwnProperty(opType)) {
                    countByType[opType]++;
                } else {
                    countByType.other++;
                }
                
                console.debug(`Processing operation: ${opType}`, JSON.stringify(opData).substring(0, 150));
                
                // Parse based on operation type
                let notification = null;
                
                switch (opType) {
                    case 'comment': 
                        if (opData.parent_author === currentUser) {
                            notification = this.createNotification(
                                TYPES.REPLIES,
                                {
                                    author: opData.author,
                                    permlink: opData.permlink,
                                    parent_permlink: opData.parent_permlink,
                                    body: opData.body.substring(0, 140) + (opData.body.length > 140 ? '...' : ''),
                                    timestamp: transaction.timestamp || new Date().toISOString()
                                },
                                false
                            );
                        } else if (opData.body && opData.body.includes(`@${currentUser}`)) {
                            notification = this.createNotification(
                                TYPES.MENTIONS,
                                {
                                    author: opData.author,
                                    permlink: opData.permlink,
                                    body: opData.body.substring(0, 140) + (opData.body.length > 140 ? '...' : ''),
                                    timestamp: transaction.timestamp || new Date().toISOString()
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
                                    timestamp: transaction.timestamp || new Date().toISOString()
                                },
                                false
                            );
                        }
                        break;
                        
                    case 'follow':
                        if (opData.what && opData.following === currentUser) {
                            notification = this.createNotification(
                                TYPES.FOLLOWS,
                                {
                                    follower: opData.follower,
                                    timestamp: transaction.timestamp || new Date().toISOString()
                                },
                                false
                            );
                        }
                        break;
                        
                    case 'reblog':
                        if (opData.author === currentUser) {
                            notification = this.createNotification(
                                TYPES.RESTEEMS,
                                {
                                    account: opData.account,
                                    permlink: opData.permlink,
                                    timestamp: transaction.timestamp || new Date().toISOString()
                                },
                                false
                            );
                        }
                        break;
                    
                    case 'custom_json':
                        try {
                            let jsonData;
                            try {
                                jsonData = typeof opData.json === 'string' ? JSON.parse(opData.json) : opData.json;
                            } catch (e) {
                                break;
                            }
                            
                            if (jsonData && Array.isArray(jsonData) && jsonData.length > 1 && jsonData[0] === 'follow') {
                                const followData = jsonData[1];
                                if (followData && followData.following === currentUser && 
                                    followData.what && Array.isArray(followData.what) && followData.what.includes('blog')) {
                                    notification = this.createNotification(
                                        TYPES.FOLLOWS,
                                        {
                                            follower: followData.follower,
                                            timestamp: transaction.timestamp || new Date().toISOString()
                                        },
                                        false
                                    );
                                }
                            } else if (jsonData && Array.isArray(jsonData) && jsonData.length > 1 && jsonData[0] === 'reblog') {
                                const reblogData = jsonData[1];
                                if (reblogData && reblogData.author === currentUser) {
                                    notification = this.createNotification(
                                        TYPES.RESTEEMS,
                                        {
                                            account: reblogData.account,
                                            permlink: reblogData.permlink,
                                            timestamp: transaction.timestamp || new Date().toISOString()
                                        },
                                        false
                                    );
                                }
                            }
                        } catch (e) {}
                        break;
                }
                
                if (notification) {
                    if (type === TYPES.ALL || notification.type === type) {
                        notifications.push(notification);
                    }
                }
            } catch (error) {
                countSkipped++;
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
     * Creates sample account history data for testing
     * @returns {Array} Mock account history
     */
    getMockAccountHistory() {
        const currentUser = authService.getCurrentUser()?.username || 'testuser';
        const now = new Date().toISOString();
        
        return [
            [
                1234,
                {
                    trx_id: "abc123",
                    block: 12345678,
                    timestamp: now,
                    op: ["vote", {
                        voter: "voter1",
                        author: currentUser,
                        permlink: "test-post-1",
                        weight: 10000
                    }]
                }
            ],
            [
                1235,
                {
                    trx_id: "def456",
                    block: 12345679,
                    timestamp: now,
                    op: ["comment", {
                        parent_author: currentUser,
                        parent_permlink: "test-post-1",
                        author: "commenter1",
                        permlink: "re-test-post-1",
                        title: "",
                        body: "This is a reply to your post!",
                        json_metadata: "{}"
                    }]
                }
            ],
            [
                1236,
                {
                    trx_id: "ghi789",
                    block: 12345680,
                    timestamp: now,
                    op: ["comment", {
                        parent_author: "someoneelse",
                        parent_permlink: "their-post",
                        author: "mentioner1",
                        permlink: "mentioning-you",
                        title: "",
                        body: `Hey @${currentUser}, check this out!`,
                        json_metadata: "{}"
                    }]
                }
            ],
            [
                1237,
                {
                    trx_id: "jkl012",
                    block: 12345681,
                    timestamp: now,
                    op: ["custom_json", {
                        required_auths: [],
                        required_posting_auths: ["follower1"],
                        id: "follow",
                        json: JSON.stringify(["follow", {
                            follower: "follower1",
                            following: currentUser,
                            what: ["blog"]
                        }])
                    }]
                }
            ],
            [
                1238,
                {
                    trx_id: "mno345",
                    block: 12345682,
                    timestamp: now,
                    op: ["custom_json", {
                        required_auths: [],
                        required_posting_auths: ["reblogger1"],
                        id: "reblog",
                        json: JSON.stringify(["reblog", {
                            account: "reblogger1",
                            author: currentUser,
                            permlink: "test-post-1"
                        }])
                    }]
                }
            ]
        ];
    }
    
    /**
     * Load notifications using test data
     * Enable this in the browser console with: 
     * localStorage.setItem('use_test_notifications', 'true')
     * Then reload the page
     */
    async testNotifications() {
        localStorage.setItem('use_test_notifications', 'true');
        console.log('Test notifications enabled. Refresh the page to see mock notifications.');
        return this.getNotifications(TYPES.ALL, 1, 20, true);
    }
    
    /**
     * Display the last account history data received from the API
     * Can be used for debugging in the browser console
     */
    displayLastAccountHistory() {
        try {
            const history = localStorage.getItem('last_account_history');
            if (!history) {
                console.log('No saved account history found');
                return null;
            }
            
            const parsedHistory = JSON.parse(history);
            console.log(`Found saved account history with ${parsedHistory.length} items`);
            console.log('First few items:');
            parsedHistory.slice(0, 3).forEach((item, i) => {
                console.log(`Item ${i}:`, item);
            });
            
            return parsedHistory;
        } catch (e) {
            console.error('Error displaying saved account history:', e);
            return null;
        }
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
            this.saveNotificationStatus(currentUser.username, notification);
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
        
        this.notificationsCache.forEach((value, key) => {
            if (key.startsWith(`${currentUser.username}_`)) {
                const updated = {
                    ...value,
                    notifications: value.notifications.map(n => ({...n, isRead: true}))
                };
                this.notificationsCache.set(key, updated);
            }
        });
        
        this.saveAllNotificationsRead(currentUser.username);
        this.unreadCount = 0;
        eventEmitter.emit('notifications:updated', { unreadCount: 0 });
    }
    
    /**
     * Save notification read status (implementation depends on storage strategy)
     */
    saveNotificationStatus(username, notification) {
        try {
            const readStatusKey = `${username}_read_notifications`;
            let readStatuses = {};
            
            try {
                const stored = localStorage.getItem(readStatusKey);
                if (stored) {
                    readStatuses = JSON.parse(stored);
                }
            } catch (e) {}
            
            const notificationId = this.generateNotificationId(notification);
            readStatuses[notificationId] = true;
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
        const { type, data, timestamp } = notification;
        let idParts = [type];
        
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
