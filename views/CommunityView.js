// Base class
import BasePostView from './BasePostView.js';

// Services
import authService from '../services/AuthService.js';
import steemService from '../services/SteemService.js';
import communityService from '../services/CommunityService.js';
import metaTagService from '../services/MetaTagService.js';
import socialFeedService from '../services/SocialFeedService.js';

// Utilities
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import router from '../utils/Router.js';
import { getImageUrl, proxifyImage } from '../utils/ImageUtils.js';

class CommunityView extends BasePostView {
  constructor(params) {
    super(params);
    this.communityId = this.params.id;
    this.community = null;
    this.isSubscribed = false;
    this.currentUser = authService.getCurrentUser();
    this.sortOrder = 'trending'; // Default sort order
    this._communityCache = {}; // Initialize cache
    this.isSwitchingSort = false;
    this.sortSwitchTimer = null;
    this.commentsOffset = 0; // Offset for comments tab pagination
  }

  escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatMultiline(text) {
    return this.escapeHtml(text).replace(/\n/g, '<br>');
  }

  buildRoleLinksHtml(roleRows) {
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return '<p class="community-empty-note">No roles published.</p>';
    }

    return `
      <div class="community-roles-grid">
        ${roleRows.map((row) => {
          const account = row?.[1] || '';
          const title = row?.[2] || '';
          const role = row?.[3] || '';
          const accountSafe = this.escapeHtml(account);
          const titleSafe = this.escapeHtml(title);
          const roleSafe = this.escapeHtml(role);
          return `
            <a class="community-role-card" href="/@${accountSafe}" data-link>
              <span class="community-role-account">@${accountSafe}</span>
              <span class="community-role-type">${roleSafe || 'member'}</span>
              ${titleSafe ? `<span class="community-role-title">${titleSafe}</span>` : ''}
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  buildRulesHtml(flagText) {
    if (!flagText) {
      return '<p class="community-empty-note">No explicit rules published.</p>';
    }
    return `<p>${this.formatMultiline(flagText)}</p>`;
  }

  /**
   * Implementazione richiesta da BasePostView per identificare il tag corrente
   */
  getCurrentTag() {
    return this.communityId;
  }
  
  /**
   * Carica post della community utilizzando il pattern di BasePostView
   */
  async loadPosts(page = 1) {
    if (this.loading) {
      return false;
    }

    this.loading = true;

    if (page === 1) {
      this.posts = [];
      this.renderedPostIds.clear();
      // Show post skeletons on sort change / initial load (render() already shows them on first open)
      const postsContainer = this.container?.querySelector('.posts-container');
      if (postsContainer && postsContainer.querySelectorAll('.post-card').length === 0) {
        this.showPostSkeletons(8);
      }
    }

    try {
      // Assicurati che i dettagli della community siano caricati
      if (!this.community && !(await this.fetchCommunityDetails())) {
        console.error('Failed to load community details');
        this.handleLoadError();
        return false;
      }

      // ── Comments tab: separate offset-based pagination ─────────────────
      if (this.sortOrder === 'comments') {
        if (page === 1) this.commentsOffset = 0;
        const currentUser = authService.getCurrentUser();
        const observer = currentUser?.username || '';
        const limit = 30;
        const { comments, hasMore } = await socialFeedService.getCommunityComments(
          this.communityId, observer, limit, this.commentsOffset
        );

        const existingIds = new Set(this.posts.map(p => `${p.author}_${p.permlink}`));
        const unique = comments.filter(c => !existingIds.has(`${c.author}_${c.permlink}`));

        if (unique.length > 0) {
          this.commentsOffset += unique.length;
          this.posts = [...this.posts, ...unique];
          this.renderPosts(page > 1);
        } else if (page > 1) {
          return false;
        }
        return hasMore;
      }

      // Fetch posts
      const result = await this.communityFetch('posts', {
        communityId: this.communityId,
        sort: this.sortOrder,
        limit: 30, // Numero di post per pagina
        lastAuthor: page > 1 && this.posts.length > 0 ? this.posts[this.posts.length - 1].author : undefined,
        lastPermlink: page > 1 && this.posts.length > 0 ? this.posts[this.posts.length - 1].permlink : undefined,
        communityDetails: this.community
      });

      if (!result || !result.posts) {
        console.error('Invalid result from communityFetch:', result);
        return false;
      }

      const { posts, hasMore } = result;

      // Filter duplicates without touching renderedPostIds —
      // renderPosts() owns that set and will update it during render
      const existingIds = new Set(this.posts.map(p => `${p.author}_${p.permlink}`));
      const uniquePosts = posts.filter(post => {
        const postId = `${post.author}_${post.permlink}`;
        return !existingIds.has(postId);
      });

      if (uniquePosts.length > 0) {
        this.posts = [...this.posts, ...uniquePosts];
        this.renderPosts(page > 1);
        return hasMore;
      }

      // API returned posts but all were already known — cursor didn't advance
      // (can happen with trending sort). Stop to avoid infinite loop.
      if (page > 1 && posts.length > 0) {
        console.warn(`[CommunityView] Page ${page}: all ${posts.length} posts were duplicates (sort=${this.sortOrder}). Stopping.`);
        return false;
      }

      return hasMore;
    } catch (error) {
      console.error('Failed to load community posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  /**
   * Fetch community details
   */
  async fetchCommunityDetails() {
    try {
      // Use the optimized communityFetch method that takes advantage of cached data
      const result = await this.communityFetch('details', { communityId: this.communityId });
      
      if (!result) {
        console.error(`Community ${this.communityId} not found`);
        this.showError('Community not found');
        return false;
      }
      
      this.community = result;
      
      // Update meta tags for better social sharing
      metaTagService.updateCommunityMetaTags(this.community);
      
      // Check if user is subscribed - only if logged in
      if (this.currentUser) {
        try {
          // Get subscribed communities from the optimized cache
          const subscriptions = await communityService.getSubscribedCommunities(this.currentUser.username, true);
          
          // Normalize community names for comparison
          const normalizedCommunityName = this.community.name.replace(/^hive-/, '');
          const communityFullName = this.community.name.startsWith('hive-') 
            ? this.community.name 
            : `hive-${this.community.name}`;
          
          // Check subscriptions more efficiently
          this.isSubscribed = subscriptions.some(sub => {
            if (typeof sub === 'string') {
              return sub === normalizedCommunityName || sub === communityFullName;
            }
            
            const subName = sub.name || '';
            const subId = sub.id || '';
            
            return [subName, subId, subName.replace(/^hive-/, ''), subId.replace(/^hive-/, '')]
              .includes(normalizedCommunityName) || 
              [subName, subId].includes(communityFullName);
          });
        } catch (error) {
          console.error('Could not check subscription status:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error fetching community details:', error);
      return false;
    }
  }

  /**
   * Render method delegating to BasePostView pattern
   */
  render(container) {
    this.container = container;
    this.container.className = 'community-view';
    this.container.innerHTML = '';
    // Capture back-nav flag immediately (Router resets it after render() returns)
    const isBack = router.isBackNavigation;
    if (isBack) router.isBackNavigation = false;
    
    // Create community header — skeleton until data arrives
    const headerContainer = document.createElement('div');
    headerContainer.className = 'community-header';
    headerContainer.innerHTML = `
      <div class="skeleton-community-header" style="border:none;margin:0">
        <div class="sk-block sk-banner"></div>
        <div class="sk-info">
          <div class="sk-block sk-comm-title"></div>
          <div class="sk-block sk-comm-sub"></div>
          <div class="sk-block sk-comm-desc"></div>
        </div>
      </div>
    `;
    this.container.appendChild(headerContainer);
    
    // Create posts container
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    
    // Create sort controls
    const sortControlsContainer = document.createElement('div');
    sortControlsContainer.className = 'community-sort-options';
    contentWrapper.appendChild(sortControlsContainer);
    
    // Create posts container that BasePostView will use
    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';
    contentWrapper.appendChild(postsContainer);
    
    this.container.appendChild(contentWrapper);

    // Show post skeletons immediately so the page looks populated
    this.showPostSkeletons(8);
    
    // Load community details first
    this.fetchCommunityDetails().then(success => {
      if (success) {
        this.renderCommunityHeader(headerContainer);
        this.renderSortOptions(sortControlsContainer);
        
        // Initialize the GridController
        this.initGridController(postsContainer);

        // --- Back navigation: restore from cache instead of API call ---
        if (isBack) {
          const cached = this.restoreState();
          if (cached) {
            this.posts = cached.posts;
            this.renderedPostIds = new Set(cached.renderedPostIds);
            this.loading = false;
            this.loadingIndicator.hide();

            // Consume pendingScrollRestore before renderPosts uses it,
            // so we can apply it ourselves after the header images settle
            const scrollTarget = router.pendingScrollRestore;
            router.pendingScrollRestore = undefined;

            this.renderPosts(false);
            this.infiniteScroll = new InfiniteScroll({
              container: postsContainer,
              loadMore: (page) => this.loadPosts(page),
              threshold: '200px',
              initialPage: cached.currentPage,
              loadingMessage: 'Loading more posts...',
              endMessage: 'No more posts in this community',
              errorMessage: 'Failed to load posts. Please check your connection.'
            });
            // Make posts visible (same pattern as _reloadWithInfiniteScroll)
            void postsContainer.offsetHeight;
            requestAnimationFrame(() => { postsContainer.classList.add('is-visible'); });

            // Restore scroll after header + sort controls + grid have all settled.
            // Hide content during restore to avoid the visible position jump.
            if (scrollTarget !== undefined) {
              const mainContent = document.getElementById('main-content');
              if (mainContent) {
                mainContent.style.visibility = 'hidden';
                requestAnimationFrame(() => setTimeout(() => {
                  mainContent.scrollTop = scrollTarget;
                  mainContent.style.visibility = '';
                }, 100));
              }
            }
            return;
          }
        }
        // --- end back navigation restore ---

        // Load initial posts with fresh InfiniteScroll
        this._reloadWithInfiniteScroll();
      }
    });
  }

  /**
   * Render community header with details
   */
  renderCommunityHeader(headerContainer) {
    if (!this.community) return;
    
    const communityName = this.community.name.startsWith('hive-') 
      ? this.community.name 
      : `hive-${this.community.name}`;
    
    // Get numeric ID from community
    const communityId = communityName.replace('hive-', '');
    
    const steemitAvatar = `https://steemitimages.com/u/hive-${communityId}/avatar`;
    const rawAvatar = this.community.avatar_url || null;
    const avatarPrimary = rawAvatar ? getImageUrl(rawAvatar, 256) : steemitAvatar;
    const avatarFallback = rawAvatar ? proxifyImage(rawAvatar, 256) : steemitAvatar;

    // Prepare banner URL (or use default)
    const bannerUrl = this.community.banner_url || null;
    const bannerPrimary = bannerUrl ? getImageUrl(bannerUrl, 1400) : null;
    const bannerFallback = bannerUrl ? proxifyImage(bannerUrl, 1400) : null;
    const lang = (this.community.lang || '').toUpperCase();
    const pendingAmount = Number(this.community.sum_pending || 0);
    const roleRows = Array.isArray(this.community.roles?.rows) ? this.community.roles.rows : [];
    
    // Render community header
    headerContainer.innerHTML = `
      <div class="community-banner">
        <div class="community-overlay"></div>
        <div class="community-info">
          <img src="${avatarPrimary}" alt="${this.community.title}" class="community-avatar" />
          <div class="community-title-area">
            <h1 class="community-title">${this.community.title || communityName}</h1>
            <div class="community-stats">
              <span class="community-stat community-stat-subscribers">
                <span class="material-icons">group</span>
                <span class="community-stat-value">${this.community.subscribers || 0}</span>
                <span class="community-stat-label community-stat-label-full">subscribers</span>
                <span class="community-stat-label community-stat-label-short">subs</span>
              </span>
              <span class="community-stat">
                <span class="material-icons">article</span>
                <span class="community-stat-value">${this.community.num_pending || this.community.count_pending || 0}</span>
                <span class="community-stat-label community-stat-label-full">pending posts</span>
                <span class="community-stat-label community-stat-label-short">pending</span>
              </span>
              <span class="community-stat">
                <span class="material-icons">attach_money</span>
                <span class="community-stat-value">${pendingAmount.toFixed(2)}</span>
                <span class="community-stat-label community-stat-label-full">pending payout</span>
                <span class="community-stat-label community-stat-label-short">payout</span>
              </span>
              <span class="community-stat">
                <span class="material-icons">edit</span>
                <span class="community-stat-value">${this.community.count_authors || 0}</span>
                <span class="community-stat-label community-stat-label-full">authors</span>
                <span class="community-stat-label community-stat-label-short">authors</span>
              </span>
              ${lang ? `
              <span class="community-stat community-stat-language">
                <span class="material-icons">translate</span>
                <span class="community-stat-value">${lang}</span>
                <span class="community-stat-label community-stat-label-full">language</span>
                <span class="community-stat-label community-stat-label-short">lang</span>
              </span>
              ` : ''}
            </div>
            <p class="community-about-inline">
              ${this.community.about
                ? this.escapeHtml(this.community.about)
                : 'No short about provided.'}
            </p>
          </div>
          ${this.currentUser ? `
            <div class="community-actions">
              <button id="subscribe-button" class="${this.isSubscribed ? 'outline-btn' : 'primary-btn'}">
                ${this.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              </button>
              <button id="community-create-post-button" class="outline-btn">
                Post
              </button>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="community-details-grid">
        <details class="community-collapsible community-description-collapsible">
          <summary>Full description</summary>
          <div class="community-collapsible-content community-full-content">
            ${this.community.description
              ? `<p>${this.formatMultiline(this.community.description)}</p>`
              : '<p class="community-empty-note">No extended description provided.</p>'}
            <div class="community-extras-block">
              <h4>Rules</h4>
              ${this.buildRulesHtml(this.community.flag_text)}
            </div>
            <div class="community-extras-block">
              <h4>Roles</h4>
              <div class="community-roles-scroll">
                ${this.buildRoleLinksHtml(roleRows)}
              </div>
            </div>
          </div>
        </details>
      </div>
    `;
    
    // Add event listeners
    const subscribeButton = headerContainer.querySelector('#subscribe-button');
    if (subscribeButton) {
      subscribeButton.addEventListener('click', () => this.handleSubscription());
    }

    const createPostButton = headerContainer.querySelector('#community-create-post-button');
    if (createPostButton) {
      createPostButton.addEventListener('click', () => {
        router.navigate('/create', {
          community: this.community.name,
          communityTitle: this.community.title || communityName
        });
      });
    }

    // Robust avatar fallback chain: original/API URL -> proxied URL -> steemit -> default
    const avatarEl = headerContainer.querySelector('.community-avatar');
    if (avatarEl) {
      avatarEl.onerror = () => {
        if (avatarFallback && avatarFallback !== avatarPrimary) {
          avatarEl.onerror = () => {
            avatarEl.onerror = () => {
              avatarEl.onerror = null;
              avatarEl.src = 'https://steemitimages.com/u/default/avatar';
            };
            avatarEl.src = steemitAvatar;
          };
          avatarEl.src = avatarFallback;
          return;
        }
        avatarEl.onerror = () => {
          avatarEl.onerror = null;
          avatarEl.src = 'https://steemitimages.com/u/default/avatar';
        };
        avatarEl.src = steemitAvatar;
      };
    }

    // Robust cover fallback chain: original/API URL -> proxied URL -> gradient
    const bannerEl = headerContainer.querySelector('.community-banner');
    if (bannerEl && bannerPrimary) {
      const tryBanner = (url, next) => {
        const img = new Image();
        img.onload = () => {
          bannerEl.style.backgroundImage = `url('${url}')`;
        };
        img.onerror = () => {
          if (typeof next === 'function') next();
        };
        img.src = url;
      };

      if (bannerFallback && bannerFallback !== bannerPrimary) {
        tryBanner(bannerPrimary, () => tryBanner(bannerFallback));
      } else {
        tryBanner(bannerPrimary);
      }
    }

    // Steemit-like fallback: read hive-NNN account metadata directly for profile_image/cover_image.
    communityService.getCommunityAccountImages(communityName).then((images) => {
      if (!images) return;

      if (avatarEl && images.profile_image) {
        const onChainPrimary = getImageUrl(images.profile_image, 256);
        const onChainFallback = proxifyImage(images.profile_image, 256);

        avatarEl.onerror = () => {
          if (onChainFallback && onChainFallback !== onChainPrimary) {
            avatarEl.onerror = () => {
              avatarEl.onerror = () => {
                avatarEl.onerror = null;
                avatarEl.src = 'https://steemitimages.com/u/default/avatar';
              };
              avatarEl.src = steemitAvatar;
            };
            avatarEl.src = onChainFallback;
            return;
          }

          avatarEl.onerror = () => {
            avatarEl.onerror = null;
            avatarEl.src = 'https://steemitimages.com/u/default/avatar';
          };
          avatarEl.src = steemitAvatar;
        };

        avatarEl.src = onChainPrimary;
      }

      if (bannerEl && images.cover_image) {
        const onChainBannerPrimary = getImageUrl(images.cover_image, 1400);
        const onChainBannerFallback = proxifyImage(images.cover_image, 1400);

        const tryBanner = (url, next) => {
          const img = new Image();
          img.onload = () => {
            bannerEl.style.backgroundImage = `url('${url}')`;
          };
          img.onerror = () => {
            if (typeof next === 'function') next();
          };
          img.src = url;
        };

        if (onChainBannerFallback && onChainBannerFallback !== onChainBannerPrimary) {
          tryBanner(onChainBannerPrimary, () => tryBanner(onChainBannerFallback));
        } else {
          tryBanner(onChainBannerPrimary);
        }
      }
    }).catch(() => {});
  }

  /**
   * Render sort options
   */
  renderSortOptions(container) {
    container.innerHTML = `
      <div class="sort-buttons">
        <button class="sort-button ${this.sortOrder === 'trending' ? 'active' : ''}" data-sort="trending">
          <span class="material-icons">trending_up</span> Trending
        </button>
        <button class="sort-button ${this.sortOrder === 'hot' ? 'active' : ''}" data-sort="hot">
          <span class="material-icons">local_fire_department</span> Hot
        </button>
        <button class="sort-button ${this.sortOrder === 'created' ? 'active' : ''}" data-sort="created">
          <span class="material-icons">schedule</span> New
        </button>
        <button class="sort-button ${this.sortOrder === 'comments' ? 'active' : ''}" data-sort="comments">
          <span class="material-icons">comment</span> Comments
        </button>
      </div>
    `;
    
    // Add event listeners for sort buttons
    const sortButtons = container.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.changeSortOrder(button.dataset.sort);
      });
    });
  }

  /**
   * Change post sort order
   */
  changeSortOrder(order) {
    if (this.sortOrder === order) {
      // Force reload even if same order
      this.commentsOffset = 0;
      this._reloadWithInfiniteScroll();
      return;
    }

    this.sortOrder = order;
    this.commentsOffset = 0;
    this.isSwitchingSort = true;

    // Update active button
    const sortButtons = this.container.querySelectorAll('.sort-button');
    sortButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === order);
    });

    this._reloadWithInfiniteScroll();
  }

  _reloadWithInfiniteScroll() {
    // 1. Destroy old InfiniteScroll (removes observer target from DOM)
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }

    const postsContainer = this.container.querySelector('.posts-container');

    if (this.sortSwitchTimer) {
      clearTimeout(this.sortSwitchTimer);
      this.sortSwitchTimer = null;
    }

    const doReload = () => {
      this.showPostSkeletons(8);

      // Fade in skeletons, then real posts will replace them after load
      if (postsContainer) {
        void postsContainer.offsetHeight; // force reflow so transition fires
        requestAnimationFrame(() => {
          postsContainer.classList.add('is-visible');
        });
      }

      this.loadPosts(1).then(() => {
        if (postsContainer) {
          this.infiniteScroll = new InfiniteScroll({
            container: postsContainer,
            loadMore: (page) => this.loadPosts(page),
            threshold: '200px',
            loadingMessage: 'Loading more posts...',
            endMessage: 'No more posts in this community',
            errorMessage: 'Failed to load posts. Please check your connection.'
          });
        }
      });
    };

    if (postsContainer && postsContainer.classList.contains('is-visible')) {
      // Fade out, then swap content once transition finishes
      postsContainer.classList.remove('is-visible');
      this.sortSwitchTimer = setTimeout(doReload, 200);
    } else {
      doReload();
    }
  }

  /**
   * Handle subscribe/unsubscribe
   */
  async handleSubscription() {
    if (!this.currentUser) {
      window.location.href = '/login';
      return;
    }
    
    const button = this.container.querySelector('#subscribe-button');
    if (button) {
      button.disabled = true;
      button.classList.add('button-loading');
      button.innerHTML = '<span class="loading-spinner-sm"></span> Processing...';
    }
    
    try {
      if (this.isSubscribed) {
        // Unsubscribe - invoca direttamente il metodo del service invece di usare communityFetch
        await communityService.unsubscribeFromCommunity(
          this.currentUser.username,
          this.community.name
        );
        this.isSubscribed = false;
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully unsubscribed from community'
        });
      } else {
        // Subscribe - invoca direttamente il metodo del service invece di usare communityFetch
        await communityService.subscribeToCommunity(
          this.currentUser.username, 
          this.community.name
        );
        this.isSubscribed = true;
        eventEmitter.emit('notification', {
          type: 'success',
          message: 'Successfully subscribed to community'
        });
      }
    } catch (error) {
      console.error('Error handling subscription:', error);
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to ${this.isSubscribed ? 'unsubscribe from' : 'subscribe to'} community: ${error.message}`
      });
    } finally {
      // Re-enable button and update state
      if (button) {
        button.disabled = false;
        button.classList.remove('button-loading');
        button.textContent = this.isSubscribed ? 'Unsubscribe' : 'Subscribe';
        button.className = this.isSubscribed ? 'outline-btn' : 'primary-btn';
      }
    }
  }

  /**
   * Handle load errors without showing any message
   */
  handleLoadError() {
    const postsContainer = this.container.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '';
      // No error message will be shown
    }
  }

  /**
   * Show custom error without any UI
   */
  showError(message) {
    if (!this.container) return;
    
    const contentWrapper = this.container.querySelector('.content-wrapper');
    if (!contentWrapper) return;
    
    const postsContainer = contentWrapper.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '';
      // No error message will be shown
    }
  }

  /**
   * Called by Router on navigation away
   */
  unmount() {
    // Cancel any pending sort-switch reload so it doesn't fire after navigation
    if (this.sortSwitchTimer) {
      clearTimeout(this.sortSwitchTimer);
      this.sortSwitchTimer = null;
    }
    // Reset the shared #main-content className so the next view isn't affected
    if (this.container) {
      this.container.className = '';
    }
    this.onBeforeUnmount();
  }

  /**
   * Clean up resources when leaving the view
   */
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
    
    // Clean up GridController instance
    if (this.gridController) {
      this.gridController.unmount();
      this.gridController = null;
    }
    
    // Clear any remaining post data to prevent leakage to other views
    this.posts = [];
    this.renderedPostIds.clear();
    
    // Clear community data
    this.community = null;
    
    // Remove any event listeners
    const subscribeButton = this.container?.querySelector('#subscribe-button');
    if (subscribeButton) {
      subscribeButton.replaceWith(subscribeButton.cloneNode(true));
    }

    // Clear container references
    this.container = null;
  }

  /**
   * Initialize the GridController
   */
  initGridController(postsContainer) {
    if (!postsContainer) return;
    
    // Correggi il percorso di importazione - è in components, non in utils
    import('../components/GridController.js').then(module => {
      const GridController = module.default;
      
      // Crea il controller
      this.gridController = new GridController({
        // Il controller si aspetta targetSelector, non container
        targetSelector: '.posts-container',
        // Altre opzioni se necessarie
      });
      
      // Il GridController.js attuale aspetta un container per il render
      // non un contenitore separato per i controlli
      const gridControlContainer = document.createElement('div');
      gridControlContainer.className = 'grid-controller-container';
      
      // Aggiungi il container dei controlli subito prima del posts-container
      const sortOptions = this.container.querySelector('.community-sort-options');
      sortOptions.appendChild(gridControlContainer);
      
      // Chiama il metodo render (non renderControls)
      this.gridController.render(gridControlContainer);
    }).catch(err => {
      console.error('Could not initialize grid controller:', err);
    });
  }

  /**
   * Unified method for community-related API calls with caching support
   * @param {string} operation - The operation type ('details', 'posts', 'subscriptions', etc.)
   * @param {Object} params - Parameters for the operation
   * @param {boolean} useCache - Whether to use cached results if available
   * @returns {Promise<Object>} - The result of the operation
   */
  async communityFetch(operation, params = {}, useCache = true) {
    // Create cache key based on operation and parameters
    const cacheKey = `${operation}:${JSON.stringify(params)}`;
    
    // Check if we have this in cache
    if (useCache && this._communityCache && this._communityCache[cacheKey]) {
      const cachedData = this._communityCache[cacheKey];
      // Only use cache if it hasn't expired
      if (Date.now() - cachedData.timestamp < 300000) { // 5 minutes expiry
        return cachedData.data;
      }
    }

    // Initialize cache if needed
    if (!this._communityCache) {
      this._communityCache = {};
    }

    // Show operation-specific loading state
    this.showOperationLoading(operation);

    try {
      let result;
      
      // Route to the appropriate API call based on operation
      switch (operation) {
        case 'details':
          const communityName = params.communityId?.startsWith('hive-') 
            ? params.communityId 
            : `hive-${params.communityId}`;
          result = await communityService.findCommunityByName(communityName);
          break;
          
        case 'posts':
          const postsPerPage = params.limit || 30; // Aumenta il limite predefinito a 30
          const currentUser = authService.getCurrentUser();
          const fetchParams = {
            community: params.communityId.replace(/^hive-/, ''),
            sort: params.sort || 'trending',
            limit: postsPerPage,
            observer: currentUser?.username || ''
          };

          if (params.lastAuthor && params.lastPermlink) {
            fetchParams.start_author = params.lastAuthor;
            fetchParams.start_permlink = params.lastPermlink;
          }

          const rawPosts = await steemService.fetchCommunityPosts(fetchParams);

          if (Array.isArray(rawPosts) && rawPosts.length > 0) {
            const community = params.communityDetails || this.community;
            const enrichedPosts = rawPosts.map(post => ({
              ...post,
              community: params.communityId.replace(/^hive-/, ''),
              community_title: community?.title || communityService.formatCommunityTitle(params.communityId)
            }));

            result = {
              posts: enrichedPosts,
              hasMore: enrichedPosts.length >= postsPerPage,
              lastPost: enrichedPosts[enrichedPosts.length - 1]
            };
          } else {
            result = { posts: [], hasMore: false };
          }
          break;
          
        case 'subscriptions':
          result = await communityService.getSubscribedCommunities(params.username, false);
          break;
          
        case 'subscribe':
          result = await communityService.subscribeToCommunity(params.username, params.communityName);
          break;
          
        case 'unsubscribe':
          result = await communityService.unsubscribeFromCommunity(params.username, params.communityName);
          break;
          
        case 'members':
          result = await communityService.getCommunityMembers(params.communityId, params.page || 1);
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      // Cache the successful result
      this._communityCache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
    } catch (error) {
      console.error(`Error in communityFetch (${operation}):`, error);
      // Emit error event for UI notification
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Failed to fetch community ${operation}: ${error.message}`
      });
      return null;
    } finally {
      // Hide operation-specific loading state
      this.hideOperationLoading(operation);
    }
  }

  /**
   * Show loading state for specific operation
   */
  showOperationLoading(operation) {
    if (!this.container) return;
    
    switch (operation) {
      case 'details':
        const headerLoading = this.container.querySelector('.community-header-loading');
        if (headerLoading) headerLoading.style.display = 'flex';
        break;
        
      case 'posts':
        // Skeletons are already shown by loadPosts() — no spinner needed here
        break;
        
      case 'subscribe':
      case 'unsubscribe':
        const button = this.container.querySelector('#subscribe-button');
        if (button) {
          button.disabled = true;
          button.classList.add('button-loading');
          button.innerHTML = '<span class="loading-spinner-sm"></span> Processing...';
        }
        break;
    }
  }

  /**
   * Hide loading state for specific operation
   */
  hideOperationLoading(operation) {
    if (!this.container) return;
    
    switch (operation) {
      case 'details':
        const headerLoading = this.container.querySelector('.community-header-loading');
        if (headerLoading) headerLoading.style.display = 'none';
        break;
        
      case 'posts':
        this.loadingIndicator.hide();
        break;
        
      case 'subscribe':
      case 'unsubscribe':
        const button = this.container.querySelector('#subscribe-button');
        if (button) {
          button.disabled = false;
          button.classList.remove('button-loading');
        }
        break;
    }
  }
}

export default CommunityView;