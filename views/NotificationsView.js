import notificationsService from '../services/NotificationsService.js';
import authService from '../services/AuthService.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import { TYPES } from '../models/Notification.js';
import router from '../utils/Router.js';

class NotificationsView {
    constructor(params) {
        this.params = params || {};
        this.container = null;
        this.loading = false;
        this.notifications = [];
        this.renderedNotificationIds = new Set();
        this.activeFilter = this.params.type || TYPES.ALL;
    }

    async render(container) {
        this.container = container;
        this.container.classList.add('notifications-view');
        
        // Check if user is authenticated
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            router.navigate('/login', { returnUrl: '/notifications' });
            return;
        }
        
        // Create main view structure
        this.container.innerHTML = `
            <h1 class="view-title">Notifications</h1>
            
            <div class="notification-filters">
                <button class="filter-btn ${this.activeFilter === TYPES.ALL ? 'active' : ''}" data-filter="${TYPES.ALL}">All</button>
                <button class="filter-btn ${this.activeFilter === TYPES.REPLIES ? 'active' : ''}" data-filter="${TYPES.REPLIES}">Replies</button>
                <button class="filter-btn ${this.activeFilter === TYPES.MENTIONS ? 'active' : ''}" data-filter="${TYPES.MENTIONS}">Mentions</button>
                <button class="filter-btn ${this.activeFilter === TYPES.UPVOTES ? 'active' : ''}" data-filter="${TYPES.UPVOTES}">Upvotes</button>
                <button class="filter-btn ${this.activeFilter === TYPES.FOLLOWS ? 'active' : ''}" data-filter="${TYPES.FOLLOWS}">Follows</button>
                <button class="filter-btn ${this.activeFilter === TYPES.RESTEEMS ? 'active' : ''}" data-filter="${TYPES.RESTEEMS}">Resteems</button>
            </div>
            
            <div class="action-bar">
                <button class="mark-read-btn" title="Mark all as read">
                    <span class="material-icons">done_all</span>
                    <span>Mark all as read</span>
                </button>
                <button class="refresh-btn" title="Refresh notifications">
                    <span class="material-icons">refresh</span>
                </button>
            </div>
            
            <div class="notifications-container"></div>
            <div class="loading-indicator"><div class="spinner"></div></div>
            <div class="empty-state" style="display:none;">
                <div class="empty-icon">
                    <span class="material-icons">notifications_off</span>
                </div>
                <h3>No notifications</h3>
                <p>When you have new notifications, you'll see them here.</p>
            </div>
        `;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Get containers
        this.notificationsContainer = this.container.querySelector('.notifications-container');
        this.loadingIndicator = this.container.querySelector('.loading-indicator');
        this.emptyState = this.container.querySelector('.empty-state');
        
        // Load notifications
        this.loadNotifications(1);
        
        // Setup infinite scroll
        this.setupInfiniteScroll();
    }
    
    setupEventListeners() {
        // Filter buttons
        const filterButtons = this.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.getAttribute('data-filter');
                this.changeFilter(filter);
            });
        });
        
        // Mark all as read button
        const markReadBtn = this.container.querySelector('.mark-read-btn');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
        
        // Refresh button
        const refreshBtn = this.container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshNotifications();
            });
        }
    }
    
    async changeFilter(filter) {
        if (this.activeFilter === filter) return;
        
        this.activeFilter = filter;
        
        // Update active class on filter buttons
        const filterButtons = this.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            const buttonFilter = button.getAttribute('data-filter');
            button.classList.toggle('active', buttonFilter === filter);
        });
        
        // Reset notifications and load with new filter
        this.notifications = [];
        this.renderedNotificationIds.clear();
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '';
        }
        
        // Update URL without triggering a full page reload
        const url = `#/notifications${filter !== TYPES.ALL ? `/${filter}` : ''}`;
        history.pushState(null, '', url);
        
        // Load notifications with new filter
        this.loadNotifications(1);
    }
    
    async loadNotifications(page = 1) {
        if (this.loading) return false;
        
        this.loading = true;
        
        if (page === 1) {
            this.showLoading();
        }
        
        try {
            // Get notifications from service
            const { notifications, hasMore } = await notificationsService.getNotifications(
                this.activeFilter, 
                page, 
                20, 
                page === 1
            );
            
            if (page === 1) {
                // Clear existing notifications for first page
                this.notifications = [];
                this.renderedNotificationIds.clear();
                this.notificationsContainer.innerHTML = '';
            }
            
            // Filter out any duplicates
            const uniqueNotifications = notifications.filter(notification => {
                const notificationId = notificationsService.generateNotificationId(notification);
                const isNew = !this.renderedNotificationIds.has(notificationId);
                if (isNew) {
                    this.renderedNotificationIds.add(notificationId);
                }
                return isNew;
            });
            
            // Add new notifications to array
            this.notifications = [...this.notifications, ...uniqueNotifications];
            
            // Render the notifications
            this.renderNotifications(uniqueNotifications);
            
            // Update empty state
            this.updateEmptyState();
            
            // Return whether there are more notifications to load
            return hasMore;
        } catch (error) {
            console.error('Failed to load notifications:', error);
            this.showError('Failed to load notifications. Please try again later.');
            return false;
        } finally {
            this.loading = false;
            this.hideLoading();
        }
    }
    
    renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) return;
        
        // For each notification, create and append element
        notifications.forEach(notification => {
            const notificationElement = this.createNotificationElement(notification);
            this.notificationsContainer.appendChild(notificationElement);
        });
    }
    
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification ${notification.isRead ? 'read' : 'unread'} ${notification.type}`;
        
        // Different templates based on notification type
        let contentHtml = '';
        const data = notification.data;
        
        switch (notification.type) {
            case TYPES.REPLIES:
                contentHtml = `
                    <a href="/@${data.author}" class="user">${data.author}</a>
                    replied to your 
                    <a href="/@${data.author}/${data.permlink}" class="content-link">post</a>: 
                    <span class="excerpt">${data.body}</span>
                `;
                break;
                
            case TYPES.MENTIONS:
                contentHtml = `
                    <a href="/@${data.author}" class="user">${data.author}</a> 
                    mentioned you in a 
                    <a href="/@${data.author}/${data.permlink}" class="content-link">comment</a>: 
                    <span class="excerpt">${data.body}</span>
                `;
                break;
                
            case TYPES.FOLLOWS:
                contentHtml = `
                    <a href="/@${data.follower}" class="user">${data.follower}</a> 
                    started following you
                `;
                break;
                
            case TYPES.UPVOTES:
                contentHtml = `
                    <a href="/@${data.voter}" class="user">${data.voter}</a> 
                    upvoted your 
                    <a href="/@${authService.getCurrentUser().username}/${data.permlink}" class="content-link">post</a>
                    (${data.weight}%)
                `;
                break;
                
            case TYPES.RESTEEMS:
                contentHtml = `
                    <a href="/@${data.account}" class="user">${data.account}</a> 
                    resteemed your 
                    <a href="/@${authService.getCurrentUser().username}/${data.permlink}" class="content-link">post</a>
                `;
                break;
        }
        
        // Format timestamp
        const timestamp = new Date(notification.timestamp);
        const timeAgo = this.formatTimeAgo(timestamp);
        
        // Create notification inner HTML
        element.innerHTML = `
            <div class="notification-icon">
                <span class="material-icons">
                    ${this.getIconForType(notification.type)}
                </span>
            </div>
            <div class="notification-content">
                <div class="notification-text">${contentHtml}</div>
                <div class="notification-time">${timeAgo}</div>
            </div>
            ${!notification.isRead ? '<div class="unread-indicator"></div>' : ''}
        `;
        
        // Add click handler to mark as read
        element.addEventListener('click', () => {
            this.markAsRead(notification, element);
            
            // Extract target link
            const contentLink = element.querySelector('.content-link');
            if (contentLink) {
                router.navigate(contentLink.getAttribute('href'));
            }
        });
        
        return element;
    }
    
    getIconForType(type) {
        const icons = {
            [TYPES.REPLIES]: 'reply',
            [TYPES.MENTIONS]: 'alternate_email',
            [TYPES.FOLLOWS]: 'person_add',
            [TYPES.UPVOTES]: 'thumb_up',
            [TYPES.RESTEEMS]: 'repeat'
        };
        
        return icons[type] || 'notifications';
    }
    
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 30) {
            return date.toLocaleDateString();
        } else if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
    
    async markAsRead(notification, element) {
        if (notification.isRead) return;
        
        await notificationsService.markAsRead(notification);
        
        // Update UI
        notification.isRead = true;
        element.classList.remove('unread');
        element.classList.add('read');
        
        // Remove unread indicator
        const indicator = element.querySelector('.unread-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    async markAllAsRead() {
        await notificationsService.markAllAsRead();
        
        // Update UI for all notifications
        const unreadElements = this.container.querySelectorAll('.notification.unread');
        unreadElements.forEach(element => {
            element.classList.remove('unread');
            element.classList.add('read');
            
            const indicator = element.querySelector('.unread-indicator');
            if (indicator) {
                indicator.remove();
            }
        });
        
        // Update notification objects
        this.notifications.forEach(notification => {
            notification.isRead = true;
        });
    }
    
    async refreshNotifications() {
        // Reset and reload with force refresh
        this.notifications = [];
        this.renderedNotificationIds.clear();
        
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '';
        }
        
        // Restart infinite scroll
        if (this.infiniteScroll) {
            this.infiniteScroll.reset(1);
        }
        
        // Load notifications
        this.loadNotifications(1);
    }
    
    setupInfiniteScroll() {
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
        }
        
        this.infiniteScroll = new InfiniteScroll({
            container: this.notificationsContainer,
            loadMore: (page) => this.loadNotifications(page),
            threshold: '200px',
            loadingMessage: 'Loading more notifications...',
            endMessage: 'No more notifications to load',
            errorMessage: 'Failed to load notifications. Please try again.'
        });
    }
    
    updateEmptyState() {
        if (this.notifications.length === 0) {
            this.emptyState.style.display = 'block';
            this.notificationsContainer.style.display = 'none';
        } else {
            this.emptyState.style.display = 'none';
            this.notificationsContainer.style.display = 'block';
        }
    }
    
    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
    }
    
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    showError(message) {
        // Simple error message - in a real app this could be a popup or toast
        console.error(message);
        
        // Update UI to show error state
        if (this.notificationsContainer) {
            if (this.notifications.length === 0) {
                this.notificationsContainer.innerHTML = `
                    <div class="error-message">
                        <span class="material-icons">error</span>
                        <p>${message}</p>
                    </div>
                `;
            }
        }
    }
    
    onBeforeUnmount() {
        // Cleanup
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
    }
}

export default NotificationsView;
