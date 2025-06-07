import View from './View.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

/**
 * View for displaying user drafts and scheduled posts
 */
class DraftsView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Drafts | cur8.fun';
    this.currentUser = authService.getCurrentUser();
    this.loadingIndicator = new LoadingIndicator();
    this.drafts = [];
  }

  /**
   * Render the drafts view
   * @param {HTMLElement} container - Container element to render into
   */
  async render(container) {
    this.container = container;
    
    // Check authentication
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return;
    }

    this.container.className = 'drafts-view';
    
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Create page header
    const pageHeader = this.createPageHeader();
    contentWrapper.appendChild(pageHeader);

    // Create drafts container
    const draftsContainer = document.createElement('div');
    draftsContainer.className = 'drafts-container';
    contentWrapper.appendChild(draftsContainer);

    // Show loading while fetching drafts
    this.loadingIndicator.show(draftsContainer);

    // Add to container
    this.container.appendChild(contentWrapper);

    // Load and render drafts
    await this.loadDrafts(draftsContainer);
  }

  /**
   * Create page header with title and actions
   */
  createPageHeader() {
    const header = document.createElement('div');
    header.className = 'page-header';

    const titleSection = document.createElement('div');
    titleSection.className = 'title-section';

    const title = document.createElement('h1');
    title.textContent = 'My Drafts';
    titleSection.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Manage your saved drafts and scheduled posts';
    subtitle.className = 'page-subtitle';
    titleSection.appendChild(subtitle);

    header.appendChild(titleSection);

    // Add action buttons
    const actionsSection = document.createElement('div');
    actionsSection.className = 'header-actions';

    const newPostBtn = document.createElement('a');
    newPostBtn.href = '/create';
    newPostBtn.className = 'primary-btn create-new-btn';
    newPostBtn.innerHTML = `
      <span class="material-icons">add</span>
      <span>New Post</span>
    `;
    actionsSection.appendChild(newPostBtn);

    header.appendChild(actionsSection);

    return header;
  }

  /**
   * Load drafts from the service
   */
  async loadDrafts(container) {
    try {
      // Get all drafts for the current user
      const allDrafts = this.getAllUserDrafts();
      
      // Hide loading indicator
      this.loadingIndicator.hide();

      if (allDrafts.length === 0) {
        this.renderEmptyState(container);
      } else {
        this.renderDrafts(container, allDrafts);
      }

    } catch (error) {
      console.error('Error loading drafts:', error);
      this.loadingIndicator.hide();
      this.renderErrorState(container, error);
    }
  }
  /**
   * Get all drafts for the current user from localStorage
   */
  getAllUserDrafts() {
    const drafts = [];
    const username = this.currentUser.username;
    
    // 1. Get the current draft from CreatePostService (single draft system)
    try {
      const currentDraft = createPostService.getDraft();
      if (currentDraft && currentDraft.username === username) {
        const draftData = {
          id: 'current',
          storageKey: 'steemee_post_draft',
          title: currentDraft.title || 'Untitled Draft',
          body: currentDraft.body || '',
          tags: currentDraft.tags || [],
          community: currentDraft.community || null,
          lastModified: new Date(currentDraft.timestamp).getTime(),
          wordCount: this.getWordCount(currentDraft.body || ''),
          age: this.getDraftAge(new Date(currentDraft.timestamp).getTime()),
          isCurrent: true // Flag to identify the current draft
        };
        drafts.push(draftData);
      }
    } catch (error) {
      console.warn('Failed to load current draft:', error);
    }
    
    // 2. Get multiple drafts (future expansion - for now using user-specific pattern)
    const prefix = `draft_${username}_`;
    
    // Iterate through localStorage to find all drafts for this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const draftData = JSON.parse(localStorage.getItem(key));
          if (draftData && (draftData.title || draftData.body)) {
            // Extract draft ID from key
            const draftId = key.replace(prefix, '');
            
            // Add metadata
            draftData.id = draftId;
            draftData.storageKey = key;
            draftData.lastModified = draftData.lastModified || Date.now();
            draftData.wordCount = this.getWordCount(draftData.body || '');
            draftData.age = this.getDraftAge(draftData.lastModified);
            draftData.isCurrent = false;
            
            drafts.push(draftData);
          }
        } catch (error) {
          console.warn('Failed to parse draft:', key, error);
        }
      }
    }
    
    // 3. Also check for any other steemee drafts with different patterns
    const steemeePattern = 'steemee_draft_';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(steemeePattern) && key !== 'steemee_post_draft') {
        try {
          const draftData = JSON.parse(localStorage.getItem(key));
          if (draftData && (draftData.title || draftData.body)) {
            // Check if this draft belongs to current user
            if (!draftData.username || draftData.username === username) {
              const draftId = key.replace(steemeePattern, '');
              
              draftData.id = draftId;
              draftData.storageKey = key;
              draftData.lastModified = draftData.lastModified || Date.now();
              draftData.wordCount = this.getWordCount(draftData.body || '');
              draftData.age = this.getDraftAge(draftData.lastModified);
              draftData.isCurrent = false;
              
              drafts.push(draftData);
            }
          }
        } catch (error) {
          console.warn('Failed to parse steemee draft:', key, error);
        }
      }
    }
    
    // Sort by last modified (newest first)
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Get word count for content
   */
  getWordCount(content) {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get draft age in human readable format
   */
  getDraftAge(timestamp) {
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    
    if (ageMinutes < 1) return 'Just now';
    if (ageMinutes < 60) return `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
    
    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
    
    const ageDays = Math.floor(ageHours / 24);
    if (ageDays < 7) return `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
    
    const ageWeeks = Math.floor(ageDays / 7);
    return `${ageWeeks} week${ageWeeks !== 1 ? 's' : ''} ago`;
  }

  /**
   * Render drafts list
   */
  renderDrafts(container, drafts) {
    container.innerHTML = '';

    // Add stats header
    const statsHeader = document.createElement('div');
    statsHeader.className = 'drafts-stats';
    statsHeader.innerHTML = `
      <div class="stat-item">
        <span class="stat-number">${drafts.length}</span>
        <span class="stat-label">Draft${drafts.length !== 1 ? 's' : ''}</span>
      </div>
    `;
    container.appendChild(statsHeader);

    // Create drafts grid
    const draftsGrid = document.createElement('div');
    draftsGrid.className = 'drafts-grid';
    
    drafts.forEach(draft => {
      const draftCard = this.createDraftCard(draft);
      draftsGrid.appendChild(draftCard);
    });

    container.appendChild(draftsGrid);
  }
  /**
   * Create a draft card
   */
  createDraftCard(draft) {
    const card = document.createElement('div');
    card.className = `draft-card ${draft.isCurrent ? 'current-draft' : ''}`;
    
    // Add click handler to edit draft
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (!e.target.closest('.draft-actions')) {
        this.editDraft(draft);
      }
    });

    card.innerHTML = `
      <div class="draft-header">
        ${draft.isCurrent ? '<div class="current-draft-badge">Current Draft</div>' : ''}
        <h3 class="draft-title" title="${this.escapeHtml(draft.title)}">
          ${this.escapeHtml(draft.title) || 'Untitled Draft'}
        </h3>
        <div class="draft-meta">
          <span class="draft-age">${draft.age}</span>
          <span class="draft-words">${draft.wordCount} words</span>
        </div>
      </div>
      
      <div class="draft-content">
        <div class="draft-excerpt">
          ${this.createExcerpt(draft.body || '')}
        </div>
        
        ${draft.tags && draft.tags.length > 0 ? `
          <div class="draft-tags">
            ${draft.tags.slice(0, 3).map(tag => 
              `<span class="draft-tag">${this.escapeHtml(tag)}</span>`
            ).join('')}
            ${draft.tags.length > 3 ? `<span class="draft-tag-more">+${draft.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
      
      <div class="draft-footer">
        <div class="draft-info">
          ${draft.community ? `
            <span class="draft-community">
              <span class="material-icons">groups</span>
              ${this.escapeHtml(draft.community)}
            </span>
          ` : ''}
        </div>
        
        <div class="draft-actions">
          <button class="draft-action-btn edit-btn" title="Edit draft">
            <span class="material-icons">edit</span>
          </button>
          ${!draft.isCurrent ? `
            <button class="draft-action-btn delete-btn" title="Delete draft">
              <span class="material-icons">delete</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editDraft(draft);
    });

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteDraft(draft);
      });
    }

    return card;
  }

  /**
   * Create excerpt from content
   */
  createExcerpt(content, maxLength = 150) {
    if (!content) return 'No content';
    
    // Remove markdown formatting and get plain text
    const plainText = content
      .replace(/[#*_`~\[\]()]/g, '') // Remove markdown characters
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (plainText.length <= maxLength) return plainText;
    
    // Find the last space before the limit to avoid cutting words
    const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
    const cutIndex = lastSpaceIndex > maxLength * 0.8 ? lastSpaceIndex : maxLength;
    
    return plainText.substring(0, cutIndex) + '...';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  /**
   * Edit a draft
   */
  editDraft(draft) {
    if (draft.isCurrent) {
      // For current draft, just navigate to create view
      router.navigate('/create');
    } else {
      // For other drafts, we need to load the specific draft
      // For now, navigate to create view with draft data in URL params
      router.navigate('/create', { draftId: draft.id });
    }
  }

  /**
   * Delete a draft with confirmation
   */
  deleteDraft(draft) {
    // Create confirmation modal
    const modal = this.createConfirmationModal(
      'Delete Draft',
      `Are you sure you want to delete "${draft.title || 'Untitled Draft'}"? This action cannot be undone.`,
      () => {
        // Confirm delete
        this.performDeleteDraft(draft);
        this.closeModal(modal);
      },
      () => {
        // Cancel
        this.closeModal(modal);
      }
    );
    
    document.body.appendChild(modal);
  }
  /**
   * Actually delete the draft
   */
  performDeleteDraft(draft) {
    try {
      if (draft.isCurrent) {
        // Use CreatePostService to clear the current draft
        createPostService.clearDraft();
        this.showToast('Current draft cleared successfully', 'success');
      } else {
        // Remove from localStorage directly
        localStorage.removeItem(draft.storageKey);
        this.showToast('Draft deleted successfully', 'success');
      }
      
      // Reload the view
      this.render(this.container);
      
    } catch (error) {
      console.error('Error deleting draft:', error);
      this.showToast('Failed to delete draft', 'error');
    }
  }

  /**
   * Create confirmation modal
   */
  createConfirmationModal(title, message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal-content confirmation-modal">
        <div class="modal-header">
          <h3>${this.escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${this.escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="outline-btn cancel-btn">Cancel</button>
          <button class="danger-btn confirm-btn">Delete</button>
        </div>
      </div>
    `;

    // Add event listeners
    const cancelBtn = modal.querySelector('.cancel-btn');
    const confirmBtn = modal.querySelector('.confirm-btn');

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        onCancel();
      }
    });

    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        onCancel();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    return modal;
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add to page
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Render empty state when no drafts
   */
  renderEmptyState(container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <span class="material-icons">draft</span>
        </div>
        <h3>No drafts yet</h3>
        <p>Your saved drafts will appear here. Start writing your first post!</p>
        <a href="/create" class="primary-btn">
          <span class="material-icons">add</span>
          Create New Post
        </a>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderErrorState(container, error) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">
          <span class="material-icons">error</span>
        </div>
        <h3>Failed to load drafts</h3>
        <p>There was an error loading your drafts. Please try again.</p>
        <button class="primary-btn retry-btn">
          <span class="material-icons">refresh</span>
          Try Again
        </button>
      </div>
    `;

    const retryBtn = container.querySelector('.retry-btn');
    retryBtn.addEventListener('click', () => {
      this.render(this.container);
    });
  }

  /**
   * Render login prompt for unauthenticated users
   */
  renderLoginPrompt() {
    this.container.innerHTML = `
      <div class="auth-required">
        <div class="auth-required-icon">
          <span class="material-icons">login</span>
        </div>
        <h2>Login Required</h2>
        <p>You need to be logged in to view your drafts.</p>
        <a href="/login" class="primary-btn">
          <span class="material-icons">login</span>
          Login
        </a>
      </div>
    `;
  }

  /**
   * Clean up resources when view is unmounted
   */
  unmount() {
    super.unmount();
    
    // Hide loading indicator if still showing
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    
    // Remove any remaining modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });
  }
}

export default DraftsView;
