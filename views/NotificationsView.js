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
        
        // Se siamo nella vista upvotes, aggiungiamo un pulsante speciale per il recupero completo
        if (this.activeFilter === TYPES.UPVOTES) {
            const actionBar = this.container.querySelector('.action-bar');
            const loadAllDiv = document.createElement('div');
            loadAllDiv.className = 'load-all-buttons';
            loadAllDiv.style.margin = '20px 0';
            loadAllDiv.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: 10px;">
                    Per vedere <strong>TUTTI</strong> gli upvote storici:
                </p>
                <div style="display: flex; justify-content: center; gap: 20px;">
                    <button class="load-all-btn primary">
                        <span class="material-icons">history</span>
                        Carica TUTTI gli upvote (COMPLETO)
                    </button>
                </div>
            `;
            
            loadAllDiv.querySelector('.load-all-btn').addEventListener('click', () => {
                this.loadAllHistoricalUpvotes();
            });
            
            this.container.insertBefore(loadAllDiv, this.notificationsContainer);
        }
        
        // Aggiungi un pulsante EFFICACE per forzare recupero completo
        const actionBar = this.container.querySelector('.action-bar');
        const forceButton = document.createElement('button');
        forceButton.className = 'force-load-btn';
        forceButton.innerHTML = '<span class="material-icons">restart_alt</span>';
        forceButton.title = 'Forza recupero completo di tutte le notifiche';
        forceButton.addEventListener('click', () => this.forceCompleteRefresh());
        actionBar.appendChild(forceButton);
        
        // Load initial notifications (reduced starting limit)
        await this.loadNotifications(1, 30);
        
        // Setup infinite scroll after a short delay to ensure content is rendered
        setTimeout(() => {
            this.setupInfiniteScroll();
            console.log("Infinite scroll configurato dopo il caricamento iniziale");
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
        
        // Mostra messaggio temporaneo
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    Caricamento notifiche ${filter}...
                </div>
            `;
        }
        
        // Clear e reload con il nuovo filtro
        await this.forceCompleteRefresh();
        
        // Setup infinite scroll again with the new content type
        setTimeout(() => this.setupInfiniteScroll(), 100);
    }
    
    async loadNotifications(page = 1, limit = 20) {
        if (this.loading) {
            console.log(`Already loading notifications, skipping request for page ${page}`);
            return false;
        }
        
        console.log(`Loading page ${page} with limit ${limit}`);
        this.loading = true;
        
        if (page === 1) {
            this.showLoading();
        }
        
        try {
            // Force refresh solo per la prima pagina
            const forceRefresh = page === 1;
            
            // Per gli upvote, usa un limite più alto
            const actualLimit = this.activeFilter === TYPES.UPVOTES ? 50 : limit;
            
            console.log(`Requesting notifications: type=${this.activeFilter}, page=${page}, limit=${actualLimit}`);
            const { notifications, hasMore } = await notificationsService.getNotifications(
                this.activeFilter, 
                page, 
                actualLimit, 
                forceRefresh
            );
            
            console.log(`Received ${notifications.length} notifications, hasMore: ${hasMore}`);
            
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
            
            console.log(`Added ${uniqueNotifications.length} new unique notifications`);
            console.log(`Total notifications displayed: ${this.notifications.length}`);
            
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
            console.error('Failed to load notifications:', error);
            this.showError('Failed to load notifications. Please try again later.');
            return false;
        } finally {
            this.loading = false;
            this.hideLoading();
        }
    }
    
    async forceCompleteRefresh() {
        // Reset completo
        this.notifications = [];
        this.renderedNotificationIds.clear();
        
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '<div style="text-align:center;padding:20px;">Recupero completo delle notifiche in corso...</div>';
        }
        
        // Elimina completamente la cache
        notificationsService.clearCache();
        
        // Disattiva l'infinite scroll
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        this.showLoading();
        
        // Carica tutto da zero con limite enorme
        try {
            const { notifications } = await notificationsService.getNotifications(
                this.activeFilter, 
                1,
                1000, // Limite massimo
                true  // Forza refresh
            );
            
            // Clear container
            if (this.notificationsContainer) {
                this.notificationsContainer.innerHTML = '';
            }
            
            // Mostra contatore
            const countDiv = document.createElement('div');
            countDiv.style.padding = '10px';
            countDiv.style.textAlign = 'center';
            countDiv.style.backgroundColor = 'var(--background-light)';
            countDiv.style.borderRadius = 'var(--radius-md)';
            countDiv.style.marginBottom = '15px';
            countDiv.innerHTML = `<strong>Recuperate ${notifications.length} notifiche!</strong>`;
            this.notificationsContainer.appendChild(countDiv);
            
            // Aggiorna stato interno
            this.notifications = [...notifications];
            notifications.forEach(n => {
                this.renderedNotificationIds.add(notificationsService.generateNotificationId(n));
            });
            
            // Renderizza
            this.renderNotifications(notifications);
            
            // Aggiorna stato vuoto
            this.updateEmptyState();
            
            // Attiva infinite scroll se necessario
            if (notifications.length >= 50) {
                setTimeout(() => this.setupInfiniteScroll(), 300);
            }
        } catch (error) {
            console.error('Errore nel refresh completo:', error);
            this.showError('Errore nel recupero completo delle notifiche. Riprova più tardi.');
        } finally {
            this.hideLoading();
        }
    }
    
    renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) return;
        
        console.log(`Rendering ${notifications.length} notifications`);
        
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
                    console.log('Observer repositioned after adding new notifications');
                }
            }, 100);
        }
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
        // Reset e ricarica
        this.notifications = [];
        this.renderedNotificationIds.clear();
        
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '';
        }
        
        // Forza il refresh completo della cache
        notificationsService.clearCache();
        
        // Destroy dell'infinite scroll
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        // Carica notifiche con refresh forzato 
        await this.loadNotifications(1, this.activeFilter === TYPES.UPVOTES ? 50 : 30, true);
        
        // Ricrea infinite scroll
        setTimeout(() => this.setupInfiniteScroll(), 300);
    }
    
    /**
     * Carica TUTTI gli upvote storici senza limiti
     */
    async loadAllHistoricalUpvotes() {
        // Reset completo dello stato
        this.notifications = [];
        this.renderedNotificationIds.clear();
        
        if (this.notificationsContainer) {
            this.notificationsContainer.innerHTML = '';
        }
        
        // Disattiva l'infinite scroll perché vogliamo tutto in una volta
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        this.showLoading();
        
        // Aggiungi un messaggio di attesa
        const waitMessage = document.createElement('div');
        waitMessage.className = 'wait-message';
        waitMessage.textContent = 'Recuperando tutti gli upvote dal primo all\'ultimo. Questo processo potrebbe richiedere diversi minuti...';
        waitMessage.style.textAlign = 'center';
        waitMessage.style.padding = '20px';
        waitMessage.style.color = 'var(--text-secondary)';
        waitMessage.style.fontStyle = 'italic';
        this.notificationsContainer.appendChild(waitMessage);
        
        try {
            // Forza il refresh completo
            notificationsService.clearCache();
            
            // Ottieni TUTTI gli upvote storici
            // L'API è limitata, quindi potrebbe richiedere molto tempo
            const allUpvotes = await notificationsService.fetchAllHistoricalNotifications(
                authService.getCurrentUser().username,
                TYPES.UPVOTES
            );
            
            // Rimuovi il messaggio di attesa
            waitMessage.remove();
            
            if (!allUpvotes.length) {
                this.notificationsContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p>Nessun upvote trovato nella storia dell'account.</p>
                    </div>
                `;
                this.hideLoading();
                return;
            }
            
            // Mostra il conteggio totale
            const countMessage = document.createElement('div');
            countMessage.className = 'count-message';
            countMessage.innerHTML = `
                <div style="text-align: center; padding: 10px; background: var(--background-light); border-radius: var(--radius-md); margin-bottom: 20px;">
                    <h3>Recuperati ${allUpvotes.length} upvote totali</h3>
                    <p>Vengono mostrati tutti gli upvote ricevuti dall'inizio dell'account</p>
                </div>
            `;
            this.notificationsContainer.appendChild(countMessage);
            
            // Aggiorna lo stato interno
            this.notifications = [...allUpvotes];
            
            // Traccia gli ID già renderizzati
            allUpvotes.forEach(notification => {
                const notificationId = notificationsService.generateNotificationId(notification);
                this.renderedNotificationIds.add(notificationId);
            });
            
            // Renderizza tutte le notifiche
            this.renderNotifications(allUpvotes);
            
            // Aggiorna lo stato vuoto
            this.updateEmptyState();
            
            console.log(`Caricati e visualizzati TUTTI i ${allUpvotes.length} upvote`);
        } catch (error) {
            console.error('Errore nel caricamento di tutti gli upvote storici:', error);
            this.showError('Si è verificato un errore durante il recupero degli upvote. Riprova più tardi.');
        } finally {
            this.hideLoading();
        }
    }
    
    setupInfiniteScroll() {
        // Clean up any existing infinite scroll instance
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        if (!this.notificationsContainer) {
            console.error('Cannot setup infinite scroll: container not found');
            return;
        }
        
        console.log('Setting up infinite scroll - new instance');
        
        // Create new infinite scroll with the proper container and callback
        this.infiniteScroll = new InfiniteScroll({
            container: this.notificationsContainer,
            loadMore: async (page) => {
                console.log(`InfiniteScroll: triggered load for page ${page}`);
                try {
                    // Utilizzare un limite fisso ma grande per ogni pagina
                    const result = await this.loadNotifications(page, 30);
                    console.log(`InfiniteScroll: page ${page} loaded, hasMore=${result}`);
                    
                    // Importante: forza la riconfigurazione dell'observer
                    setTimeout(() => {
                        if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                            this.infiniteScroll.setupObserver();
                            console.log(`InfiniteScroll: observer riconfigurato dopo caricamento pagina ${page}`);
                        }
                    }, 100);
                    
                    return result;
                } catch (error) {
                    console.error("Error in infinite scroll loadMore:", error);
                    return false;
                }
            },
            threshold: '500px',
            initialPage: 1,
            loadingMessage: 'Caricamento notifiche...',
            endMessage: 'Nessun\'altra notifica da caricare',
            errorMessage: 'Errore nel caricamento delle notifiche. Riprova.'
        });
        
        // Aggiungi un trigger manuale dopo un breve delay per forzare il primo check
        setTimeout(() => {
            if (this.infiniteScroll && typeof this.infiniteScroll.setupObserver === 'function') {
                this.infiniteScroll.setupObserver();
                console.log('InfiniteScroll: observer posizionato manualmente dopo setup');
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
