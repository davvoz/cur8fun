import View from './View.js';
import router from '../utils/Router.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import DialogUtility from '../components/DialogUtility.js';

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
   */  async render(container) {
    this.container = container;
    
    // Check authentication
    if (!this.currentUser) {
      this.renderLoginPrompt();
      return;
    }

    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // Create main wrapper with drafts-view class instead of applying to container
    const draftsViewWrapper = document.createElement('div');
    draftsViewWrapper.className = 'drafts-view';

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

    // Add content wrapper to drafts view wrapper
    draftsViewWrapper.appendChild(contentWrapper);

    // Show loading while fetching drafts
    this.loadingIndicator.show(draftsContainer);

    // Add drafts view wrapper to main container
    this.container.appendChild(draftsViewWrapper);

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
  }  /**
   * Get all drafts for the current user using the improved draft system
   */
  getAllUserDrafts() {
    try {
      // Use the improved draft system from CreatePostService
      return createPostService.getAllUserDrafts();
    } catch (error) {
      console.error('Error getting user drafts:', error);
      return [];
    }
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
   * Render drafts list with improved functionality
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
      <div class="stat-item">
        <span class="stat-number">${drafts.filter(d => d.isCurrent).length}</span>
        <span class="stat-label">Current</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${drafts.filter(d => !d.isCurrent).length}</span>
        <span class="stat-label">Saved</span>
      </div>
    `;
    container.appendChild(statsHeader);

    // Add actions bar
    const actionsBar = document.createElement('div');
    actionsBar.className = 'drafts-actions-bar';
    actionsBar.innerHTML = `
      <button class="outline-btn cleanup-btn" title="Clean up expired drafts">
        <span class="material-icons">cleaning_services</span>
        Clean Up
      </button>
      <button class="outline-btn export-btn" title="Export drafts">
        <span class="material-icons">download</span>
        Export
      </button>
    `;
    container.appendChild(actionsBar);

    // Add event listeners for action buttons
    const cleanupBtn = actionsBar.querySelector('.cleanup-btn');
    const exportBtn = actionsBar.querySelector('.export-btn');

    cleanupBtn.addEventListener('click', () => this.cleanupExpiredDrafts());
    exportBtn.addEventListener('click', () => this.exportDrafts(drafts));

    // Create drafts grid
    const draftsGrid = document.createElement('div');
    draftsGrid.className = 'drafts-grid';
    
    drafts.forEach(draft => {
      const draftCard = this.createDraftCard(draft);
      draftsGrid.appendChild(draftCard);
    });

    container.appendChild(draftsGrid);
  }  /**
   * Create a draft card with enhanced functionality
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

    // Calculate additional metadata
    const wordCount = this.getWordCount(draft.body || '');
    const age = this.getDraftAge(draft.lastModified);

    card.innerHTML = `
      <div class="draft-header">
        ${draft.isCurrent ? '<div class="current-draft-badge">Current Draft</div>' : ''}
        <h3 class="draft-title" title="${this.escapeHtml(draft.title || 'Untitled Draft')}">
          ${this.escapeHtml(draft.title || 'Untitled Draft')}
        </h3>
        <div class="draft-meta">
          <span class="draft-age">${age}</span>
          <span class="draft-words">${wordCount} words</span>
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
            <button class="draft-action-btn duplicate-btn" title="Duplicate draft">
              <span class="material-icons">content_copy</span>
            </button>
            <button class="draft-action-btn load-current-btn" title="Load as current draft">
              <span class="material-icons">open_in_new</span>
            </button>
          ` : `
            <button class="draft-action-btn save-as-btn" title="Save as new draft">
              <span class="material-icons">save_as</span>
            </button>
          `}
          <button class="draft-action-btn delete-btn" title="Delete draft">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const duplicateBtn = card.querySelector('.duplicate-btn');
    const loadCurrentBtn = card.querySelector('.load-current-btn');
    const saveAsBtn = card.querySelector('.save-as-btn');

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editDraft(draft);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteDraft(draft);
    });

    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateDraft(draft);
      });
    }

    if (loadCurrentBtn) {
      loadCurrentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadDraftAsCurrent(draft);
      });
    }

    if (saveAsBtn) {
      saveAsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentDraftAsNew();
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
  }  /**
   * Edit a draft using the improved system
   */
  editDraft(draft) {
    if (draft.isCurrent) {
      // For current draft, just navigate to create view
      router.navigate('/create');
    } else {
      // For saved drafts, load as current and navigate
      const success = createPostService.loadDraftAsCurrent(draft.id);
      if (success) {
        router.navigate('/create');
      } else {
        this.showToast('Failed to load draft', 'error');
      }
    }
  }
  /**
   * Delete a draft with confirmation using standard dialog pattern
   */
  async deleteDraft(draft) {
    try {
      // Show confirmation dialog following the standard pattern
      const confirmed = await this.showDeleteDraftDialog(draft);
      if (!confirmed) return;
      
      // Show loading state
      this.showToast('Deleting draft...', 'loading');
      
      // Perform delete operation
      const success = createPostService.deleteDraftById(draft.id);
      
      if (success) {
        this.showToast('Draft deleted successfully', 'success');
        // Reload the view
        this.render(this.container);
      } else {
        this.showToast('Failed to delete draft', 'error');
      }
      
    } catch (error) {
      console.error('Error deleting draft:', error);
      this.showToast('Failed to delete draft', 'error');
    }
  }
  /**
   * Show delete draft confirmation dialog using standardized DialogUtility
   * @param {Object} draft - Draft to delete
   * @returns {Promise<boolean>} - true if user confirms, false otherwise
   */
  async showDeleteDraftDialog(draft) {
    // Calculate draft metadata
    const wordCount = this.getWordCount(draft.body || '');
    const age = this.getDraftAge(draft.lastModified);
    
    // Create rich preview content for the dialog
    const previewData = `
      <div class="draft-preview">
        <h4>${this.escapeHtml(draft.title || 'Untitled Draft')}</h4>
        <div class="draft-meta-info">
          <span class="meta-item">
            <span class="material-icons">schedule</span>
            ${age}
          </span>
          <span class="meta-item">
            <span class="material-icons">subject</span>
            ${wordCount} words
          </span>
          ${draft.community ? `
            <span class="meta-item">
              <span class="material-icons">groups</span>
              ${this.escapeHtml(draft.community)}
            </span>
          ` : ''}
        </div>
        ${draft.tags && draft.tags.length > 0 ? `
          <div class="draft-tags-preview">
            ${draft.tags.slice(0, 3).map(tag => 
              `<span class="tag-chip">${this.escapeHtml(tag)}</span>`
            ).join('')}
            ${draft.tags.length > 3 ? `<span class="tag-more">+${draft.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
        ${draft.body ? `
          <div class="draft-excerpt-preview">
            ${this.escapeHtml(this.createExcerpt(draft.body, 100))}
          </div>
        ` : ''}
      </div>
    `;

    // Additional warning for current drafts
    const additionalDetails = draft.isCurrent ? `
      <div class="current-draft-warning">
        <span class="material-icons">warning</span>
        <span>This is your current draft. Deleting it will remove your work in progress.</span>
      </div>
    ` : null;

    // Use DialogUtility for consistent experience
    return await DialogUtility.showConfirmationDialog({
      title: 'Delete Draft',
      message: 'Are you sure you want to delete this draft?',
      confirmText: 'Delete Draft',
      cancelText: 'Cancel',
      icon: 'delete_forever',      type: 'danger',
      showPreview: true,
      previewData: previewData,
      details: additionalDetails
    });
  }

  /**
   * Duplicate a draft
   */
  duplicateDraft(draft) {
    try {
      const result = createPostService.duplicateDraft(draft.id);
      
      if (result.success) {
        this.showToast('Draft duplicated successfully', 'success');
        // Reload the view to show the new draft
        this.render(this.container);
      } else {
        this.showToast(result.error || 'Failed to duplicate draft', 'error');
      }
    } catch (error) {
      console.error('Error duplicating draft:', error);
      this.showToast('Failed to duplicate draft', 'error');
    }
  }

  /**
   * Load a draft as the current draft
   */
  loadDraftAsCurrent(draft) {
    try {
      const success = createPostService.loadDraftAsCurrent(draft.id);
      
      if (success) {
        this.showToast('Draft loaded as current', 'success');
        // Navigate to create view
        router.navigate('/create');
      } else {
        this.showToast('Failed to load draft', 'error');
      }
    } catch (error) {
      console.error('Error loading draft as current:', error);
      this.showToast('Failed to load draft', 'error');
    }
  }

  /**
   * Save current draft as a new saved draft
   */
  saveCurrentDraftAsNew() {
    try {
      const result = createPostService.moveCurrentDraftToSaved();
      
      if (result.success) {
        this.showToast('Current draft saved', 'success');
        // Reload the view to show the new saved draft
        this.render(this.container);
      } else {
        this.showToast(result.error || 'Failed to save draft', 'error');
      }
    } catch (error) {
      console.error('Error saving current draft as new:', error);
      this.showToast('Failed to save draft', 'error');
    }
  }

  /**
   * Clean up expired drafts
   */
  cleanupExpiredDrafts() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return;

      createPostService.cleanupExpiredDrafts(currentUser.username);
      this.showToast('Expired drafts cleaned up', 'success');
      
      // Reload the view
      this.render(this.container);
    } catch (error) {
      console.error('Error cleaning up drafts:', error);
      this.showToast('Failed to clean up drafts', 'error');
    }
  }

  /**
   * Export drafts as JSON
   */
  exportDrafts(drafts) {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        user: this.currentUser.username,
        drafts: drafts.map(draft => ({
          id: draft.id,
          title: draft.title,
          body: draft.body,
          tags: draft.tags,
          community: draft.community,
          timestamp: draft.timestamp,
          isCurrent: draft.isCurrent
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steemee-drafts-${this.currentUser.username}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Drafts exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting drafts:', error);
      this.showToast('Failed to export drafts', 'error');
    }
  }  /**
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
  }  /**
   * Clean up resources when view is unmounted
   */
  unmount() {
    super.unmount();
    
    // Hide loading indicator if still showing
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    
    // Remove any remaining modals (including standard dialogs)
    const modals = document.querySelectorAll('.modal-overlay, .delete-draft-dialog-overlay, .standard-dialog-overlay');
    modals.forEach(modal => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });
    
    // Remove any event listeners that might still be active
    document.removeEventListener('keydown', this.escapeHandler);
  }
}

export default DraftsView;
