import Component from '../../Component.js';
import curationManagementService from '../../../services/CurationManagementService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';

export default class AutoCurationTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    
    this.currentUser = authService.getCurrentUser();
    this.targets = [];
    this.isLoading = false;
    this.stats = null;
    
    // Bind methods
    this.handleAddTarget = this.handleAddTarget.bind(this);
    this.handleDeleteTarget = this.handleDeleteTarget.bind(this);
    this.handleToggleTarget = this.handleToggleTarget.bind(this);
    this.handleTargetUpdate = this.handleTargetUpdate.bind(this);
    this.refreshData = this.refreshData.bind(this);
  }
  
  render() {
    // Create tab container
    this.element = document.createElement('div');
    this.element.className = 'tab-pane auto-curation-tab';
    
    // Create header
    const header = this.createHeader();
    this.element.appendChild(header);
    
    // Create stats panel
    const statsPanel = this.createStatsPanel();
    this.element.appendChild(statsPanel);
    
    // Create add target form
    const addForm = this.createAddTargetForm();
    this.element.appendChild(addForm);
    
    // Create targets list
    const targetsList = this.createTargetsList();
    this.element.appendChild(targetsList);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Append to parent
    this.parentElement.appendChild(this.element);
    
    // Load initial data
    this.loadData();
    
    return this.element;
  }
  
  createHeader() {
    const header = document.createElement('div');
    header.className = 'tab-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Auto Curation';
    title.className = 'tab-title';
    
    const description = document.createElement('p');
    description.className = 'tab-description';
    description.textContent = 'Automatically vote on posts from your favorite authors at the optimal time.';
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn btn-secondary btn-sm refresh-btn';
    refreshBtn.innerHTML = '<span class="material-icons">refresh</span> Refresh';
    refreshBtn.onclick = this.refreshData;
    
    header.appendChild(title);
    header.appendChild(description);
    header.appendChild(refreshBtn);
    
    return header;
  }
  
  createStatsPanel() {
    const panel = document.createElement('div');
    panel.className = 'stats-panel';
    panel.id = 'curation-stats-panel';
    
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    
    // Active targets stat
    const activeTargetsCard = this.createStatCard('Active Targets', '0', 'people');
    statsGrid.appendChild(activeTargetsCard);
    
    // Today's votes stat
    const todayVotesCard = this.createStatCard('Today\'s Votes', '0', 'how_to_vote');
    statsGrid.appendChild(todayVotesCard);
    
    // Success rate stat
    const successRateCard = this.createStatCard('Success Rate', '0%', 'trending_up');
    statsGrid.appendChild(successRateCard);
    
    panel.appendChild(statsGrid);
    return panel;
  }
  
  createStatCard(title, value, icon) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    
    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons stat-icon';
    iconEl.textContent = icon;
    
    const content = document.createElement('div');
    content.className = 'stat-content';
    
    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.textContent = value;
    
    const titleEl = document.createElement('div');
    titleEl.className = 'stat-title';
    titleEl.textContent = title;
    
    content.appendChild(valueEl);
    content.appendChild(titleEl);
    card.appendChild(iconEl);
    card.appendChild(content);
    
    return card;
  }
  
  createAddTargetForm() {
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    const formTitle = document.createElement('h4');
    formTitle.textContent = 'Add New Target';
    formCard.appendChild(formTitle);
    
    const form = document.createElement('form');
    form.className = 'add-target-form';
    form.id = 'add-target-form';
    
    // Username input
    const usernameGroup = document.createElement('div');
    usernameGroup.className = 'form-group';
    
    const usernameLabel = document.createElement('label');
    usernameLabel.textContent = 'Username';
    usernameLabel.setAttribute('for', 'target-username');
    
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.id = 'target-username';
    usernameInput.name = 'target_username';
    usernameInput.placeholder = 'Enter username to follow';
    usernameInput.required = true;
    
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    // Vote delay slider
    const delayGroup = document.createElement('div');
    delayGroup.className = 'form-group';
    
    const delayLabel = document.createElement('label');
    delayLabel.textContent = 'Vote Delay';
    delayLabel.setAttribute('for', 'vote-delay');
    
    const delaySlider = document.createElement('input');
    delaySlider.type = 'range';
    delaySlider.id = 'vote-delay';
    delaySlider.name = 'vote_delay_minutes';
    delaySlider.min = '1';
    delaySlider.max = '60';
    delaySlider.value = '15';
    
    const delayValue = document.createElement('span');
    delayValue.className = 'slider-value';
    delayValue.textContent = '15 minutes';
    
    delaySlider.addEventListener('input', (e) => {
      delayValue.textContent = `${e.target.value} minutes`;
    });
    
    delayGroup.appendChild(delayLabel);
    delayGroup.appendChild(delaySlider);
    delayGroup.appendChild(delayValue);
    
    // Vote percentage slider
    const percentGroup = document.createElement('div');
    percentGroup.className = 'form-group';
    
    const percentLabel = document.createElement('label');
    percentLabel.textContent = 'Vote Percentage';
    percentLabel.setAttribute('for', 'vote-percentage');
    
    const percentSlider = document.createElement('input');
    percentSlider.type = 'range';
    percentSlider.id = 'vote-percentage';
    percentSlider.name = 'vote_percentage';
    percentSlider.min = '1';
    percentSlider.max = '100';
    percentSlider.value = '100';
    
    const percentValue = document.createElement('span');
    percentValue.className = 'slider-value';
    percentValue.textContent = '100%';
    
    percentSlider.addEventListener('input', (e) => {
      percentValue.textContent = `${e.target.value}%`;
    });
    
    percentGroup.appendChild(percentLabel);
    percentGroup.appendChild(percentSlider);
    percentGroup.appendChild(percentValue);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.innerHTML = '<span class="material-icons">add</span> Add Target';
    
    form.appendChild(usernameGroup);
    form.appendChild(delayGroup);
    form.appendChild(percentGroup);
    form.appendChild(submitBtn);
    
    form.addEventListener('submit', this.handleAddTarget);
    
    formCard.appendChild(form);
    return formCard;
  }
  
  createTargetsList() {
    const listCard = document.createElement('div');
    listCard.className = 'form-card';
    
    const listTitle = document.createElement('h4');
    listTitle.textContent = 'Curation Targets';
    listCard.appendChild(listTitle);
    
    const targetsContainer = document.createElement('div');
    targetsContainer.className = 'targets-list';
    targetsContainer.id = 'targets-list';
    
    listCard.appendChild(targetsContainer);
    return listCard;
  }
  
  async handleAddTarget(e) {
    e.preventDefault();
    
    if (this.isLoading) return;
    
    const formData = new FormData(e.target);
    const targetData = {
      target_username: formData.get('target_username').trim(),
      vote_delay_minutes: parseInt(formData.get('vote_delay_minutes')),
      vote_percentage: parseInt(formData.get('vote_percentage'))
    };
    
    if (!targetData.target_username) {
      this.showNotification('Username is required', 'error');
      return;
    }
    
    try {
      this.setLoading(true);
      await curationManagementService.addCurationTarget(targetData);
      
      // Reset form
      e.target.reset();
      document.getElementById('vote-delay').value = '15';
      document.getElementById('vote-percentage').value = '100';
      document.querySelector('#vote-delay + .slider-value').textContent = '15 minutes';
      document.querySelector('#vote-percentage + .slider-value').textContent = '100%';
      
      this.showNotification('Target added successfully', 'success');
      await this.loadData();
    } catch (error) {
      this.showNotification(`Error adding target: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }
  
  async handleDeleteTarget(targetId) {
    if (!confirm('Are you sure you want to delete this target?')) {
      return;
    }
    
    try {
      this.setLoading(true);
      await curationManagementService.deleteCurationTarget(targetId);
      this.showNotification('Target deleted successfully', 'success');
      await this.loadData();
    } catch (error) {
      this.showNotification(`Error deleting target: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }
  
  async handleToggleTarget(targetId, isActive) {
    try {
      await curationManagementService.toggleTargetStatus(targetId, isActive);
      this.showNotification(`Target ${isActive ? 'activated' : 'deactivated'}`, 'success');
      await this.loadData();
    } catch (error) {
      this.showNotification(`Error updating target: ${error.message}`, 'error');
    }
  }
  
  async handleTargetUpdate(targetId, updateData) {
    try {
      await curationManagementService.updateCurationTarget(targetId, updateData);
      this.showNotification('Target updated successfully', 'success');
      await this.loadData(); // Reload to get fresh data
    } catch (error) {
      this.showNotification(`Error updating target: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async loadData() {
    if (this.isLoading) return;
    
    try {
      this.setLoading(true);
      
      // Load enhanced targets and stats in parallel
      const [targets, stats] = await Promise.allSettled([
        curationManagementService.getEnhancedCurationTargets(),
        curationManagementService.getCurationStats()
      ]);
      
      if (targets.status === 'fulfilled') {
        this.targets = targets.value;
        this.renderTargets();
      }
      
      if (stats.status === 'fulfilled') {
        this.stats = stats.value;
        this.updateStatsDisplay();
      }
      
    } catch (error) {
      this.showNotification(`Error loading data: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }
  
  renderTargets() {
    const container = this.element.querySelector('#targets-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.targets.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <span class="material-icons">person_add_disabled</span>
        <p>No curation targets configured yet.</p>
        <p>Add your first target above to start auto-curation.</p>
      `;
      container.appendChild(emptyState);
      return;
    }
    
    this.targets.forEach(target => {
      const targetCard = this.createTargetCard(target);
      container.appendChild(targetCard);
    });
  }
  
  createTargetCard(target) {
    const card = document.createElement('div');
    card.className = `target-card ${target.is_active ? 'active' : 'inactive'}`;
    
    const userInfo = target.user_info || {};
    const lastPost = userInfo.last_post;
    const avatarUrl = userInfo.avatar_url || `https://steemitimages.com/u/${target.target_username}/avatar`;
    
    card.innerHTML = `
      <div class="target-header">
        <div class="target-user-info">
          <div class="user-avatar">
            <img src="${avatarUrl}" alt="${target.target_username}" onerror="this.src='https://steemitimages.com/DQmb2HNSGKN5HJWNJPJegjKJoFAKpfF7yQBX7mJDAPKcMLG/default-avatar.png'">
          </div>
          <div class="user-details">
            <h5 class="target-username">@${target.target_username}</h5>
            <div class="user-stats">
              <span class="post-count">${userInfo.post_count || 0} posts</span>
              <span class="reputation">Rep: ${this.formatReputation(userInfo.reputation || 0)}</span>
            </div>
            <span class="target-status ${target.is_active ? 'active' : 'inactive'}">
              ${target.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div class="target-actions">
          <button class="btn btn-sm edit-btn" data-target-id="${target.id}" title="Edit Target">
            <span class="material-icons">edit</span>
          </button>
          <button class="btn btn-sm toggle-btn" data-target-id="${target.id}" data-active="${target.is_active}" title="${target.is_active ? 'Pause' : 'Activate'}">
            <span class="material-icons">${target.is_active ? 'pause' : 'play_arrow'}</span>
          </button>
          <button class="btn btn-sm btn-danger delete-btn" data-target-id="${target.id}" title="Delete Target">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
      
      ${lastPost ? `
      <div class="last-post-info">
        <div class="last-post-header">
          <span class="material-icons">article</span>
          <span class="last-post-label">Latest Post</span>
          <span class="post-date">${this.formatRelativeTime(lastPost.created)}</span>
        </div>
        <div class="last-post-content">
          <h6 class="post-title">${this.truncateText(lastPost.title, 60)}</h6>
          <div class="post-stats">
            <span class="post-stat">
              <span class="material-icons">thumb_up</span>
              ${lastPost.net_votes || 0}
            </span>
            <span class="post-stat">
              <span class="material-icons">comment</span>
              ${lastPost.children || 0}
            </span>
            <span class="post-stat">
              <span class="material-icons">attach_money</span>
              $${parseFloat(lastPost.pending_payout_value || '0').toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      ` : `
      <div class="no-posts-info">
        <span class="material-icons">info</span>
        <span>No recent posts found</span>
      </div>
      `}
      
      <div class="target-settings">
        <div class="setting-item">
          <label>Vote Delay:</label>
          <span class="setting-value editable" data-field="vote_delay_minutes" data-target-id="${target.id}">
            ${target.vote_delay_minutes} minutes
            <span class="material-icons edit-icon">edit</span>
          </span>
        </div>
        <div class="setting-item">
          <label>Vote Percentage:</label>
          <span class="setting-value editable" data-field="vote_percentage" data-target-id="${target.id}">
            ${target.vote_percentage}%
            <span class="material-icons edit-icon">edit</span>
          </span>
        </div>
        <div class="setting-item">
          <label>Added:</label>
          <span class="setting-value">${new Date(target.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `;
    
    // Add event listeners
    const editBtn = card.querySelector('.edit-btn');
    const toggleBtn = card.querySelector('.toggle-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const editableValues = card.querySelectorAll('.setting-value.editable');
    
    editBtn.addEventListener('click', (e) => {
      const targetId = parseInt(e.currentTarget.dataset.targetId);
      this.showEditTargetModal(target);
    });
    
    toggleBtn.addEventListener('click', (e) => {
      const targetId = parseInt(e.currentTarget.dataset.targetId);
      const isCurrentlyActive = e.currentTarget.dataset.active === 'true';
      this.handleToggleTarget(targetId, !isCurrentlyActive);
    });
    
    deleteBtn.addEventListener('click', (e) => {
      const targetId = parseInt(e.currentTarget.dataset.targetId);
      this.handleDeleteTarget(targetId);
    });
    
    // Add inline editing for settings
    editableValues.forEach(element => {
      element.addEventListener('click', (e) => {
        this.enableInlineEdit(e.currentTarget);
      });
    });
    
    return card;
  }
  
  updateStatsDisplay() {
    if (!this.stats) return;
    
    const statCards = this.element.querySelectorAll('.stat-card');
    if (statCards.length >= 3) {
      statCards[0].querySelector('.stat-value').textContent = this.stats.active_targets || '0';
      statCards[1].querySelector('.stat-value').textContent = this.stats.today_votes || '0';
      statCards[2].querySelector('.stat-value').textContent = `${this.stats.success_rate || 0}%`;
    }
  }
  
  setupEventListeners() {
    // Listen for service events
    this.registerEmitterHandler(eventEmitter, 'curation:target-added', this.refreshData);
    this.registerEmitterHandler(eventEmitter, 'curation:target-updated', this.refreshData);
    this.registerEmitterHandler(eventEmitter, 'curation:target-deleted', this.refreshData);
    this.registerEmitterHandler(eventEmitter, 'curation:error', (data) => {
      this.showNotification(`Curation error: ${data.message}`, 'error');
    });
  }
  
  async refreshData() {
    await this.loadData();
  }
  
  setLoading(loading) {
    this.isLoading = loading;
    const refreshBtn = this.element.querySelector('.refresh-btn');
    const submitBtn = this.element.querySelector('#add-target-form button[type="submit"]');
    
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      if (loading) {
        refreshBtn.innerHTML = '<span class="material-icons spinning">refresh</span> Loading...';
      } else {
        refreshBtn.innerHTML = '<span class="material-icons">refresh</span> Refresh';
      }
    }
    
    if (submitBtn) {
      submitBtn.disabled = loading;
    }
  }
  
  showNotification(message, type = 'info') {
    eventEmitter.emit('notification', {
      type: type,
      message: message
    });
  }
  
  destroy() {
    // Clean up event listeners
    super.destroy();
  }
  
  /**
   * Format reputation score to human readable format
   */
  formatReputation(rawReputation) {
    if (!rawReputation) return '25';
    
    // Convert raw reputation to human readable (simplified calculation)
    const rep = Math.log10(Math.max(Math.abs(rawReputation) - 9, 1)) * 9 + 25;
    return Math.floor(rep);
  }
  
  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }
  
  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  /**
   * Show edit target modal
   */
  showEditTargetModal(target) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'edit-target-modal';
    
    modal.innerHTML = `
      <div class="modal-header">
        <h4>Edit Target: @${target.target_username}</h4>
        <button class="close-btn" type="button">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <form id="edit-target-form">
          <div class="form-group">
            <label for="edit-vote-delay">Vote Delay</label>
            <input type="range" id="edit-vote-delay" name="vote_delay_minutes" 
                   min="1" max="60" value="${target.vote_delay_minutes}">
            <span class="slider-value">${target.vote_delay_minutes} minutes</span>
          </div>
          <div class="form-group">
            <label for="edit-vote-percentage">Vote Percentage</label>
            <input type="range" id="edit-vote-percentage" name="vote_percentage" 
                   min="1" max="100" value="${target.vote_percentage}">
            <span class="slider-value">${target.vote_percentage}%</span>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="is_active" ${target.is_active ? 'checked' : ''}>
              Active
            </label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary save-btn">Save Changes</button>
      </div>
    `;
    
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Setup event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const delaySlider = modal.querySelector('#edit-vote-delay');
    const percentSlider = modal.querySelector('#edit-vote-percentage');
    
    // Update slider values in real time
    delaySlider.addEventListener('input', (e) => {
      const valueSpan = e.target.parentElement.querySelector('.slider-value');
      valueSpan.textContent = `${e.target.value} minutes`;
    });
    
    percentSlider.addEventListener('input', (e) => {
      const valueSpan = e.target.parentElement.querySelector('.slider-value');
      valueSpan.textContent = `${e.target.value}%`;
    });
    
    // Close modal handlers
    const closeModal = () => {
      document.body.removeChild(modalOverlay);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    
    // Save changes handler
    saveBtn.addEventListener('click', async () => {
      try {
        const formData = new FormData(modal.querySelector('#edit-target-form'));
        const updateData = {
          vote_delay_minutes: parseInt(formData.get('vote_delay_minutes')),
          vote_percentage: parseInt(formData.get('vote_percentage')),
          is_active: formData.has('is_active')
        };
        
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        await this.handleTargetUpdate(target.id, updateData);
        closeModal();
      } catch (error) {
        this.showNotification(`Error updating target: ${error.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }
  
  /**
   * Enable inline editing for setting values
   */
  enableInlineEdit(element) {
    const field = element.dataset.field;
    const targetId = parseInt(element.dataset.targetId);
    const currentValue = field === 'vote_delay_minutes' 
      ? parseInt(element.textContent) 
      : parseInt(element.textContent.replace('%', ''));
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentValue;
    input.className = 'inline-edit-input';
    
    if (field === 'vote_delay_minutes') {
      input.min = 1;
      input.max = 60;
    } else if (field === 'vote_percentage') {
      input.min = 1;
      input.max = 100;
    }
    
    // Replace content with input
    const originalContent = element.innerHTML;
    element.innerHTML = '';
    element.appendChild(input);
    
    // Focus and select
    input.focus();
    input.select();
    
    // Save on Enter or blur
    const saveValue = async () => {
      const newValue = parseInt(input.value);
      if (newValue === currentValue) {
        element.innerHTML = originalContent;
        return;
      }
      
      try {
        const updateData = { [field]: newValue };
        await this.handleTargetUpdate(targetId, updateData);
        
        // Update display
        const suffix = field === 'vote_percentage' ? '%' : ' minutes';
        element.innerHTML = `${newValue}${suffix} <span class="material-icons edit-icon">edit</span>`;
      } catch (error) {
        element.innerHTML = originalContent;
        this.showNotification(`Error updating ${field}: ${error.message}`, 'error');
      }
    };
    
    const cancelEdit = () => {
      element.innerHTML = originalContent;
    };
    
    input.addEventListener('blur', saveValue);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveValue();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });
  }
  
  /**
   * Handle target update with full object update
   */
  async handleTargetUpdate(targetId, updateData) {
    try {
      await curationManagementService.updateCurationTarget(targetId, updateData);
      this.showNotification('Target updated successfully', 'success');
      await this.loadData(); // Reload to get fresh data
    } catch (error) {
      this.showNotification(`Error updating target: ${error.message}`, 'error');
      throw error;
    }
  }
}
