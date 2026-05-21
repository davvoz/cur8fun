import notificationsService from '../services/NotificationsService.js';
import authService from '../services/AuthService.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import { TYPES } from '../models/Notification.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';

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
        const notContainer = document.createElement('div');
        notContainer.classList.add('notifications-view');
        container.appendChild(notContainer);
        
        // Check if user is authenticated
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            router.navigate('/login', { returnUrl: '/notifications' });
            return;
        }
        
        // Create title
        const title = document.createElement('h1');
        title.className = 'view-title';
        title.textContent = 'Notifications';
        notContainer.appendChild(title);
        
        // Create notification filters
        const notificationFilters = document.createElement('div');
        notificationFilters.className = 'notification-filters';
        
        // Create filter buttons
        const filterLabels = {
            [TYPES.ALL]:     'All',
            [TYPES.VOTE]:    'Votes',
            [TYPES.REPLY]:   'Replies',
            [TYPES.MENTION]: 'Mentions',
            [TYPES.FOLLOW]:  'Follows',
            [TYPES.REBLOG]:  'Reblogs',
            [TYPES.WALLET]:  'Wallet'
        };
        Object.entries(filterLabels).forEach(([type, label]) => {
            const button = document.createElement('button');
            button.className = `filter-btn ${this.activeFilter === type ? 'active' : ''}`;
            button.setAttribute('data-filter', type);
            button.textContent = label;
            notificationFilters.appendChild(button);
        });
        notContainer.appendChild(notificationFilters);
        
        // Create action bar
        const actionBar = document.createElement('div');
        actionBar.className = 'action-bar';
        
        // Create mark as read button
        const markReadBtn = document.createElement('button');
        markReadBtn.className = 'mark-read-btn';
        markReadBtn.title = 'Mark all as read';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons';
        iconSpan.textContent = 'done_all';
        markReadBtn.appendChild(iconSpan);
        
        const textSpan = document.createElement('span');
        textSpan.textContent = 'Mark all as read';
        markReadBtn.appendChild(textSpan);
        
        actionBar.appendChild(markReadBtn);
        notContainer.appendChild(actionBar);
        
        // Create notifications container
        const notificationsContainer = document.createElement('div');
        notificationsContainer.className = 'notifications-container';
        notContainer.appendChild(notificationsContainer);
        
        // Create empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.style.display = 'none';
        
        const emptyIcon = document.createElement('div');
        emptyIcon.className = 'empty-icon';
        
        const emptyIconSpan = document.createElement('span');
        emptyIconSpan.className = 'material-icons';
        emptyIconSpan.textContent = 'notifications_off';
        emptyIcon.appendChild(emptyIconSpan);
        
        const emptyTitle = document.createElement('h3');
        emptyTitle.textContent = 'No notifications';
        
        const emptyText = document.createElement('p');
        emptyText.textContent = 'When you have new notifications, you\'ll see them here.';
        
        emptyState.appendChild(emptyIcon);
        emptyState.appendChild(emptyTitle);
        emptyState.appendChild(emptyText);
        
        notContainer.appendChild(emptyState);
        
        // Create a custom loading element for showing/hiding
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator';
        this.loadingIndicator.innerHTML = '<div class="spinner"></div>';
        this.loadingIndicator.style.display = 'none';
        notContainer.appendChild(this.loadingIndicator);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Get containers
        this.notificationsContainer = notContainer.querySelector('.notifications-container');
        this.emptyState = notContainer.querySelector('.empty-state');
        
        // Load initial notifications
        await this.loadNotifications(1, 30);
        
        // Setup infinite scroll after a short delay to ensure content is rendered
        setTimeout(() => {
            this.setupInfiniteScroll();
        }, 300);

        // Update unread count after rendering
        await this.afterRender();
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
                // Mark all notifications as read
                this.markAllAsRead();
            });
        }
    }
    
    // When the notifications view is rendered, update the unread count
    async afterRender() {
        // Wait for notifications to load, then update the unread count
        setTimeout(() => {
            notificationsService.updateUnreadCount();
        }, 500);
    }
    
    async changeFilter(filter) {
        if (this.activeFilter === filter) return;
        
        this.activeFilter = filter;

        // Hide mark-all-read on wallet tab (wallet events are always read)
        const markReadBtn = this.container.querySelector('.mark-read-btn');
        if (markReadBtn) markReadBtn.style.display = filter === TYPES.WALLET ? 'none' : '';
        
        // Update active class on filter buttons
        const filterButtons = this.container.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            const buttonFilter = button.getAttribute('data-filter');
            button.classList.toggle('active', buttonFilter === filter);
        });
        
        // Reset and reload with new filter (cache already has all notifications)
        this.notifications = [];
        this.renderedNotificationIds.clear();
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '';
        }
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }

        await this.loadNotifications(1, 30);
        setTimeout(() => this.setupInfiniteScroll(), 100);
    }
    
    async loadNotifications(page = 1, limit = 20) {
        if (this.loading) {
            return false;
        }
        
        this.loading = true;
        
        if (page === 1) {
            this.showLoading();
        }
        
        try {
            // Only force-refresh on first page (clears the service cache)
            const forceRefresh = page === 1 && this.notifications.length === 0;

            const { notifications, hasMore } = this.activeFilter === TYPES.WALLET
                ? await notificationsService.getWalletNotifications(page, limit, forceRefresh)
                : await notificationsService.getNotifications(this.activeFilter, page, limit, forceRefresh);
            
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
            
            // Force observer repositioning
            if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                setTimeout(() => {
                    this.infiniteScroll.setupObserver();
                }, 100);
            }
            
            return hasMore && uniqueNotifications.length > 0;
        } catch (error) {
            console.error('NotificationsView: loadNotifications failed', error);
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
        
        // Force repositioning of the infinite scroll observer after adding new content
        if (this.infiniteScroll) {
            // Give the DOM time to update
            setTimeout(() => {
                // Reset the infinite scroll which will recreate and position the observer
                if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                    this.infiniteScroll.setupObserver();
                }
            }, 100);
        }
    }
    
    createNotificationElement(notification) {
        const isRead = notification.isRead;
        const { account, author, permlink, type } = notification;

        const element = document.createElement('div');
        const voteDir = type === TYPES.VOTE ? (notification.rshares >= 0 ? ' upvote' : ' downvote') : '';
        element.className = `notification ${isRead ? 'read' : 'unread'} ${type}${voteDir}`;

        let contentHtml = '';
        let targetHref  = null;

        switch (type) {
            case TYPES.VOTE: {
                const isVoteOnComment = notification.linkDepth > 0;
                targetHref  = isVoteOnComment
                    ? `/comment/@${author}/${permlink}`
                    : `/@${author}/${permlink}`;
                const voteVal = notificationsService.rsharesToDollarString(notification.rshares);
                const valStr  = voteVal ? ` <span class="vote-value ${notification.rshares >= 0 ? 'positive' : 'negative'}">${voteVal}</span>` : '';
                contentHtml = `<a href="/@${account}" class="user">${account}</a> voted your <a href="${targetHref}" class="content-link">${isVoteOnComment ? 'comment' : 'post'}</a>${valStr}`;
                break;
            }

            case TYPES.REPLY:
                targetHref  = `/comment/@${author}/${permlink}`;
                contentHtml = `<a href="/@${account}" class="user">${account}</a> replied to your <a href="${targetHref}" class="content-link">content</a>`;
                break;

            case TYPES.MENTION: {
                const isMentionInComment = notification.linkDepth > 0;
                targetHref  = isMentionInComment
                    ? `/comment/@${author}/${permlink}`
                    : `/@${author}/${permlink}`;
                contentHtml = `<a href="/@${account}" class="user">${account}</a> mentioned you in a <a href="${targetHref}" class="content-link">${isMentionInComment ? 'comment' : 'post'}</a>`;
                break;
            }

            case TYPES.FOLLOW:
                contentHtml = `<a href="/@${account}" class="user">${account}</a> started following you`;
                break;

            case TYPES.REBLOG:
                targetHref  = `/@${author}/${permlink}`;
                contentHtml = `<a href="/@${account}" class="user">${account}</a> reblogged your <a href="${targetHref}" class="content-link">post</a>`;
                break;

            case TYPES.WALLET: {
                const { subtype, amount } = notification;
                targetHref = '/wallet';
                if (subtype === 'transfer') {
                    contentHtml = `<a href="/@${account}" class="user">${account}</a> sent you <span class="wallet-amount">${amount}</span>`;
                } else if (subtype === 'delegate_vesting_shares') {
                    contentHtml = `<a href="/@${account}" class="user">${account}</a> delegated <span class="wallet-amount">${amount}</span> to you`;
                } else {
                    contentHtml = `Power-down payment: <span class="wallet-amount">${amount}</span> received`;
                }
                break;
            }

            default: {
                const fallbackHref = permlink ? `/@${author}/${permlink}` : null;
                if (fallbackHref) targetHref = fallbackHref;
                contentHtml = fallbackHref
                    ? `<a href="/@${account}" class="user">${account}</a> interacted with your <a href="${fallbackHref}" class="content-link">content</a>`
                    : `<a href="/@${account}" class="user">${account}</a> interacted with your content`;
            }
        }

        // Format timestamp
        const timeAgo = this.formatTimeAgo(notification.timestamp);
        
        // Create notification inner HTML
        element.innerHTML = `
            <div class="notification-icon">
                <span class="material-icons">
                    ${this.getIconForType(notification)}
                </span>
            </div>
            <div class="notification-content">
                <div class="notification-text">${contentHtml}</div>
                <div class="notification-time">${timeAgo}</div>
            </div>
            ${!isRead ? '<div class="unread-indicator"></div>' : ''}
        `;
        
        // Click: mark as locally read + navigate
        element.addEventListener('click', (e) => {
            if (!notification.isRead) {
                notification.isRead = true;
                element.classList.remove('unread');
                element.classList.add('read');
                const indicator = element.querySelector('.unread-indicator');
                if (indicator) indicator.remove();
                notificationsService.markLocallyRead(notificationsService.generateNotificationId(notification));
            }
            if (e.target.closest('a')) return; // let link clicks bubble normally
            if (targetHref) router.navigate(targetHref);
        });

        return element;
    }
    
    getIconForType(notification) {
        if (notification.type === TYPES.VOTE) {
            return notification.rshares >= 0 ? 'thumb_up' : 'thumb_down';
        }
        if (notification.type === TYPES.WALLET) {
            const walletIcons = {
                transfer:                'payments',
                delegate_vesting_shares: 'trending_up',
                fill_vesting_withdraw:   'account_balance_wallet',
            };
            return walletIcons[notification.subtype] || 'account_balance_wallet';
        }
        const icons = {
            [TYPES.REPLY]:   'reply',
            [TYPES.MENTION]: 'alternate_email',
            [TYPES.FOLLOW]:  'person_add',
            [TYPES.REBLOG]:  'repeat'
        };
        return icons[notification.type] || 'notifications';
    }
    
    formatTimeAgo(date) {
        let timestamp;
        if (typeof date === 'string') {
            // Timestamps from _parseResponse are already ISO with Z; guard duplicates
            timestamp = new Date(date.endsWith('Z') ? date : date + 'Z');
        } else if (date instanceof Date) {
            // If we already have a Date object, create a new one from ISO string with Z
            timestamp = new Date(date.toISOString());
        } else {
            // Fallback to current date
            timestamp = new Date();
        }
        
        // Calculate time elapsed since notification timestamp in minutes
        const timeElapsed = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));

        if (timeElapsed < 60) {
            return timeElapsed <= 1 ? 'Just now' : `${timeElapsed} min ago`;
        } else if (timeElapsed < 24 * 60) {
            // Convert minutes to hours
            const hours = Math.floor(timeElapsed / 60);
            return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        } else if (timeElapsed < 30 * 24 * 60) {
            // Convert minutes to days
            const days = Math.floor(timeElapsed / (24 * 60));
            return days === 1 ? '1 day ago' : `${days} days ago`;
        } else if (timeElapsed < 365 * 24 * 60) {
            // Convert minutes to months
            const months = Math.floor(timeElapsed / (30 * 24 * 60));
            return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
            // Use locale date for anything older than a year
            return timestamp.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    
    async markAllAsRead() {
        const btn = this.container.querySelector('.mark-read-btn');
        const originalHTML = btn ? btn.innerHTML : null;
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.innerHTML = '<span class="material-icons mark-read-spinner">hourglass_empty</span><span>Loading...</span>';
        }

        try {
            await notificationsService.markAllAsRead();

            // Optimistic UI: flip all unread elements to read
            this.container.querySelectorAll('.notification.unread').forEach(el => {
                el.classList.replace('unread', 'read');
                const ind = el.querySelector('.unread-indicator');
                if (ind) ind.remove();
            });
            this.notifications.forEach(n => { n.isRead = true; });

            eventEmitter.emit('notification', { type: 'success', message: 'All notifications marked as read' });
        } catch (err) {
            console.error('markAllAsRead failed:', err);
            eventEmitter.emit('notification', { type: 'error', message: 'Failed to mark as read: ' + err.message });
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '';
                if (originalHTML) btn.innerHTML = originalHTML;
            }
        }
    }
    
    async refreshNotifications() {
        this.notifications = [];
        this.renderedNotificationIds.clear();
        if (this.notificationsContainer) this.notificationsContainer.innerHTML = '';
        notificationsService.clearCache();
        if (this.infiniteScroll) { this.infiniteScroll.destroy(); this.infiniteScroll = null; }
        await this.loadNotifications(1, 30);
        setTimeout(() => this.setupInfiniteScroll(), 300);
    }
    
    setupInfiniteScroll() {
        // Clean up any existing infinite scroll instance
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        if (!this.notificationsContainer) {
            return;
        }
        
        // Create new infinite scroll with the proper container and callback
        this.infiniteScroll = new InfiniteScroll({
            container: this.notificationsContainer,
            loadMore: async (page) => {
                try {
                    // Utilizzare un limite fisso ma grande per ogni pagina
                    const result = await this.loadNotifications(page, 30);
                    
                    // Importante: forza la riconfigurazione dell'observer
                    setTimeout(() => {
                        if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                            this.infiniteScroll.setupObserver();
                        }
                    }, 100);
                    
                    return result;
                } catch (error) {
                    return false;
                }
            },
            threshold: '500px',
            initialPage: 1,
            loadingMessage: 'Loading notifications...',
            endMessage: 'Nessun\'altra notifica da caricare',
            errorMessage: 'Errore nel caricamento delle notifiche. Riprova.'
        });
        
        // Aggiungi un trigger manuale dopo un breve delay per forzare il primo check
        setTimeout(() => {
            if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                this.infiniteScroll.setupObserver();
            }
        }, 500);
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
