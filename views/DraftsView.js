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
      // Get all local drafts for the current user
      const allDrafts = this.getAllUserDrafts();
      
      // Get scheduled posts from API ridd
      const scheduledPosts = await this.getScheduledPosts();
      
      // Combine local drafts and scheduled posts
      const combinedDrafts = [...allDrafts, ...scheduledPosts];
      
      // Hide loading indicator
      this.loadingIndicator.hide();

      if (combinedDrafts.length === 0) {
        this.renderEmptyState(container);
      } else {
        this.renderDrafts(container, combinedDrafts);
      }

    } catch (error) {
      console.error('Error loading drafts:', error);
      this.loadingIndicator.hide();
      this.renderErrorState(container, error);
    }
  }

  /**
   * Get scheduled posts from API ridd
   */
  async getScheduledPosts() {
    try {
      if (!this.currentUser?.username) {
        return [];
      }

      // Use createPostService to get scheduled posts
      const scheduledData = await createPostService.getScheduledPosts(this.currentUser.username);
      
      // Transform API data to be compatible with local drafts format
      return scheduledData.map(scheduled => ({
        id: `scheduled_${scheduled.id}`,
        title: scheduled.title || 'Untitled Scheduled Post',
        body: scheduled.body || '',
        tags: Array.isArray(scheduled.tags) ? scheduled.tags : (scheduled.tags ? scheduled.tags.split(',') : []),
        community: scheduled.community || '',
        isScheduled: true,
        scheduledDateTime: scheduled.scheduled_time,
        timezone: scheduled.timezone || 'UTC',
        status: scheduled.status || 'scheduled',
        lastModified: new Date(scheduled.created_at || scheduled.scheduled_time).getTime(),
        timestamp: scheduled.created_at || scheduled.scheduled_time,
        username: scheduled.username,
        apiId: scheduled.id // Keep original ID for API operations
      }));
      
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      // Don't throw error, return empty array to not block local drafts
      return [];
    }
  }
  /**
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
   * Renders the drafts page split into two clean sections.
   * Stats live as a single one-line summary, Export is the only action.
   */
  renderDrafts(container, drafts) {
    container.innerHTML = '';

    const localDrafts = drafts.filter(d => !d.isScheduled);
    const scheduledPosts = drafts.filter(d => d.isScheduled);

    // ── Compact summary line + optional Export ──
    const summaryRow = document.createElement('div');
    summaryRow.className = 'drafts-summary-row';

    const summary = document.createElement('div');
    summary.className = 'drafts-summary-text';
    summary.textContent = `${localDrafts.length} draft${localDrafts.length === 1 ? '' : 's'} · ${scheduledPosts.length} scheduled`;
    summaryRow.appendChild(summary);

    if (drafts.length > 0) {
      const exportBtn = document.createElement('button');
      exportBtn.className = 'outline-btn export-btn';
      exportBtn.title = 'Export drafts as JSON';
      exportBtn.innerHTML = '<span class="material-icons">download</span> Export';
      exportBtn.addEventListener('click', () => this.exportDrafts(drafts));
      summaryRow.appendChild(exportBtn);
    }

    container.appendChild(summaryRow);

    // ── My drafts: current first, then by last modified desc ──
    const sortedLocal = [...localDrafts].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return (b.lastModified || 0) - (a.lastModified || 0);
    });
    container.appendChild(
      this.renderDraftsSection('My drafts', sortedLocal, 'No saved drafts yet.')
    );

    // ── Scheduled: by scheduled_time asc (next first) ──
    const sortedScheduled = [...scheduledPosts].sort((a, b) => {
      const ta = a.scheduledDateTime ? new Date(a.scheduledDateTime).getTime() : Infinity;
      const tb = b.scheduledDateTime ? new Date(b.scheduledDateTime).getTime() : Infinity;
      return ta - tb;
    });
    container.appendChild(
      this.renderDraftsSection('Scheduled posts', sortedScheduled, 'No scheduled posts.')
    );
  }

  /**
   * Builds a titled section with a grid of cards or a quiet empty hint.
   */
  renderDraftsSection(title, items, emptyMessage) {
    const section = document.createElement('section');
    section.className = 'drafts-section';

    const heading = document.createElement('h2');
    heading.className = 'drafts-section-title';
    heading.textContent = `${title} (${items.length})`;
    section.appendChild(heading);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'drafts-section-empty';
      empty.textContent = emptyMessage;
      section.appendChild(empty);
      return section;
    }

    const grid = document.createElement('div');
    grid.className = 'drafts-grid';
    items.forEach(draft => grid.appendChild(this.createDraftCard(draft)));
    section.appendChild(grid);

    return section;
  }  /**
   * Removes a single card from the page without a full re-render.
   */
  removeCardFromDom(predicate) {
    document.querySelectorAll('.draft-card').forEach(el => {
      if (predicate(el)) el.remove();
    });
  }

  /**
   * Compact draft card.
   * - Click anywhere on the card to edit
   * - Top-right corner: small icon buttons (Duplicate for local non-current
   *   drafts, Delete always). Buttons stopPropagation so they don't trigger
   *   the card-level edit.
   * - Body: excerpt + tag chips + meta line
   */
  createDraftCard(draft) {
    const card = document.createElement('article');
    card.className = 'draft-card';
    if (draft.isCurrent) card.classList.add('current-draft');
    if (draft.isScheduled) card.classList.add('scheduled-draft');

    card.dataset.draftId = draft.id;
    if (draft.apiId != null) card.dataset.apiId = String(draft.apiId);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.draft-actions')) return;
      if (draft.isScheduled) {
        this.editScheduledPost(draft);
      } else {
        this.editDraft(draft);
      }
    });

    const wordCount = this.getWordCount(draft.body || '');

    // ── Header: badges + title + action icons ──
    const header = document.createElement('header');
    header.className = 'draft-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'draft-header-left';

    if (draft.isCurrent) {
      const badge = document.createElement('span');
      badge.className = 'draft-badge draft-badge-current';
      badge.textContent = 'Current';
      headerLeft.appendChild(badge);
    }
    if (draft.isScheduled) {
      const badge = document.createElement('span');
      badge.className = 'draft-badge draft-badge-scheduled';
      badge.innerHTML = '<span class="material-icons">schedule</span> Scheduled';
      headerLeft.appendChild(badge);
    }

    const title = document.createElement('h3');
    title.className = 'draft-title';
    title.textContent = draft.title || 'Untitled draft';
    title.title = draft.title || 'Untitled draft';
    headerLeft.appendChild(title);

    header.appendChild(headerLeft);

    const actions = document.createElement('div');
    actions.className = 'draft-actions';

    // Duplicate: only meaningful for non-current local drafts
    if (!draft.isScheduled && !draft.isCurrent) {
      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'draft-action-btn duplicate-btn';
      dupBtn.title = 'Duplicate draft';
      dupBtn.innerHTML = '<span class="material-icons">content_copy</span>';
      dupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateDraft(draft);
      });
      actions.appendChild(dupBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'draft-action-btn delete-btn';
    delBtn.title = draft.isScheduled ? 'Cancel scheduled post' : 'Delete draft';
    delBtn.innerHTML = '<span class="material-icons">delete</span>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (draft.isScheduled) {
        this.deleteScheduledPost(draft);
      } else {
        this.deleteDraft(draft);
      }
    });
    actions.appendChild(delBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // ── Body: excerpt + tag chips ──
    const body = document.createElement('div');
    body.className = 'draft-body';

    const excerpt = document.createElement('p');
    excerpt.className = 'draft-excerpt';
    excerpt.textContent = this.createExcerpt(draft.body || '');
    body.appendChild(excerpt);

    if (Array.isArray(draft.tags) && draft.tags.length > 0) {
      const tagRow = document.createElement('div');
      tagRow.className = 'draft-tags';
      draft.tags.slice(0, 3).forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'draft-tag';
        chip.textContent = t;
        tagRow.appendChild(chip);
      });
      if (draft.tags.length > 3) {
        const more = document.createElement('span');
        more.className = 'draft-tag-more';
        more.textContent = `+${draft.tags.length - 3}`;
        tagRow.appendChild(more);
      }
      body.appendChild(tagRow);
    }

    card.appendChild(body);

    // ── Footer: meta line (time + words + community) ──
    const footer = document.createElement('footer');
    footer.className = 'draft-footer';

    const meta = document.createElement('div');
    meta.className = 'draft-meta';

    if (draft.isScheduled && draft.scheduledDateTime) {
      const when = new Date(draft.scheduledDateTime);
      const whenLabel = isNaN(when.getTime()) ? '—' : when.toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const span = document.createElement('span');
      span.className = 'draft-meta-item';
      span.innerHTML = `<span class="material-icons">schedule</span> ${whenLabel}`;
      meta.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'draft-meta-item';
      span.textContent = this.getDraftAge(draft.lastModified);
      meta.appendChild(span);
    }

    const wordsSpan = document.createElement('span');
    wordsSpan.className = 'draft-meta-item';
    wordsSpan.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
    meta.appendChild(wordsSpan);

    if (draft.community) {
      const communitySpan = document.createElement('span');
      communitySpan.className = 'draft-meta-item';
      communitySpan.innerHTML = `<span class="material-icons">groups</span> ${this.escapeHtml(draft.community)}`;
      meta.appendChild(communitySpan);
    }

    footer.appendChild(meta);
    card.appendChild(footer);

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
      // For saved drafts, navigate passing the draftId so CreatePostView
      // can load it directly via loadSpecificDraft.
      router.navigate('/create', { draftId: draft.id });
    }
  }
  /**
   * Edit a scheduled post.
   * Scheduled posts live only on the ridd API — we never persist them in
   * local draft storage. We just pass the API id forward; CreatePostView
   * fetches the fresh record from the API on entry and submits via
   * updateScheduledPost.
   */
  editScheduledPost(draft) {
    if (!draft.isScheduled || draft.apiId == null) {
      this.showToast('Invalid scheduled post', 'error');
      return;
    }
    router.navigate('/create', {
      mode: 'edit-scheduled',
      scheduledPostId: draft.apiId
    });
  }

  /**
   * Delete (cancel) a scheduled post — single unified action.
   */
  async deleteScheduledPost(draft) {
    if (!draft.isScheduled || !draft.apiId) {
      this.showToast('Invalid scheduled post', 'error');
      return;
    }

    try {
      const confirmed = await this.showDeleteScheduledPostDialog(draft);
      if (!confirmed) return;

      this.showToast('Deleting scheduled post...', 'loading');

      const success = await createPostService.deleteScheduledPost(draft.apiId, draft.username);

      if (success) {
        this.showToast('Scheduled post deleted successfully', 'success');
        this.removeCardFromDom(el => el.dataset.apiId === String(draft.apiId));
      } else {
        this.showToast('Failed to delete scheduled post', 'error');
      }
    } catch (error) {
      console.error('Error deleting scheduled post:', error);
      this.showToast('Failed to delete scheduled post', 'error');
    }
  }

  /**
   * Show delete scheduled post confirmation dialog
   */
  async showDeleteScheduledPostDialog(draft) {
    const scheduledTime = new Date(draft.scheduledDateTime).toLocaleString();
    
    const previewData = `
      <div class="scheduled-post-preview">
        <h4>${this.escapeHtml(draft.title || 'Untitled Scheduled Post')}</h4>
        <div class="scheduled-meta-info">
          <span class="meta-item">
            <span class="material-icons">schedule</span>
            Scheduled for: ${scheduledTime}
          </span>
          <span class="meta-item">
            <span class="material-icons">subject</span>
            ${this.getWordCount(draft.body)} words
          </span>
          ${draft.community ? `
            <span class="meta-item">
              <span class="material-icons">groups</span>
              ${this.escapeHtml(draft.community)}
            </span>
          ` : ''}
        </div>
        ${draft.tags && draft.tags.length > 0 ? `
          <div class="scheduled-tags-preview">
            ${draft.tags.slice(0, 3).map(tag => 
              `<span class="tag-chip">${this.escapeHtml(tag)}</span>`
            ).join('')}
            ${draft.tags.length > 3 ? `<span class="tag-more">+${draft.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    return await DialogUtility.showConfirmationDialog({
      title: 'Delete Scheduled Post',
      message: 'Are you sure you want to permanently delete this scheduled post?',
      confirmText: 'Delete Post',
      cancelText: 'Cancel',
      icon: 'delete_forever',
      type: 'danger',
      showPreview: true,
      previewData: previewData,
      details: 'This action cannot be undone. The scheduled post will be permanently removed from the queue.'
    });
  }

  /**
   * Delete a draft with confirmation using standard dialog pattern
   */
  async deleteDraft(draft) {
    try {
      const confirmed = await this.showDeleteDraftDialog(draft);
      if (!confirmed) return;

      this.showToast('Deleting draft...', 'loading');

      const success = createPostService.deleteDraftById(draft.id);

      if (success) {
        this.showToast('Draft deleted successfully', 'success');
        this.removeCardFromDom(el => el.dataset.draftId === String(draft.id));
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
    const title = draft.title ? `"${this.escapeHtml(draft.title)}"` : 'this draft';
    return await DialogUtility.showConfirmationDialog({
      title: 'Delete draft',
      message: `Delete ${title}? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'delete',
      type: 'danger'
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
        <span class="material-icons">edit_note</span>
        <p>No drafts yet. <a href="/create">Write something</a></p>
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
