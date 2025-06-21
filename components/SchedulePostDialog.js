import Component from './Component.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';

/**
 * Dialog per la schedulazione di post
 */
class SchedulePostDialog extends Component {
  constructor() {
    super(document.body, {});
    this.modalElement = null;
    this.onSchedule = null;
    this.postData = null;
    this.isLoading = false;
    this.error = null;
    
    this.init();
  }

  init() {
    // Create modal structure in DOM
    this.createModalElement();
    
    // Add to document body
    document.body.appendChild(this.modalElement);
    
    // Set up event listeners
    this.setupEventListeners();
  }

  createModalElement() {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'schedule-post-modal';
    this.modalElement.style.display = 'none';
    
    this.modalElement.innerHTML = `
      <div class="schedule-post-modal-content">
        <div class="schedule-post-modal-header">
          <h2>Schedule Post</h2>
          <span class="schedule-post-modal-close">&times;</span>
        </div>
        <div class="schedule-post-modal-body">
          <div class="post-info-section">
            <h4 class="scheduled-post-title"></h4>
            <div class="post-preview"></div>
          </div>
          
          <div class="auth-warning">
            <div class="warning-icon">
              <span class="material-icons">security</span>
            </div>
            <div class="warning-content">
              <strong>Authorization Required</strong>
              <p>To schedule posts, you need to authorize the <strong>cur8</strong> account to post on your behalf. This is safe and you can revoke this permission at any time.</p>
            </div>
          </div>

          <div class="datetime-section">
            <label for="schedule-datetime" class="form-label">Schedule for:</label>
            <input type="datetime-local" id="schedule-datetime" class="form-control" required>
            <div class="timezone-info">
              <span class="material-icons">schedule</span>
              <span class="timezone-text"></span>
            </div>
          </div>

          <div class="dialog-message-container"></div>
        </div>
        
        <div class="schedule-post-modal-footer">
          <button class="btn secondary-btn cancel-btn">Cancel</button>
          <button class="btn primary-btn schedule-btn">
            <span class="material-icons">schedule</span> Schedule Post
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Close button click
    const closeButton = this.modalElement.querySelector('.schedule-post-modal-close');
    this.registerEventHandler(closeButton, 'click', () => this.close());
    
    // Cancel button click
    const cancelButton = this.modalElement.querySelector('.cancel-btn');
    this.registerEventHandler(cancelButton, 'click', () => this.close());
    
    // Schedule button click
    const scheduleButton = this.modalElement.querySelector('.schedule-btn');
    this.registerEventHandler(scheduleButton, 'click', () => this.handleSchedule());
    
    // Close on click outside modal content
    this.registerEventHandler(this.modalElement, 'click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
    
    // Close on Escape key
    this.escapeKeyHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    };
    this.registerEventHandler(document, 'keydown', this.escapeKeyHandler);
    
    // Validate datetime on change
    const dateTimeInput = this.modalElement.querySelector('#schedule-datetime');
    this.registerEventHandler(dateTimeInput, 'change', () => this.validateDateTime());
  }

  /**
   * Mostra il dialog di schedulazione
   * @param {Object} postData - Dati del post da schedulare
   * @param {Function} onSchedule - Callback da chiamare quando il post viene schedulato
   */
  async show(postData, onSchedule) {
    if (!postData) {
      console.error('Post data is required to open schedule modal');
      return;
    }
    
    this.postData = postData;
    this.onSchedule = onSchedule;
    
    // Update post info
    const titleElement = this.modalElement.querySelector('.scheduled-post-title');
    titleElement.textContent = postData.title || 'Untitled Post';
    
    const previewElement = this.modalElement.querySelector('.post-preview');
    const previewText = postData.body ? 
      postData.body.substring(0, 150) + (postData.body.length > 150 ? '...' : '') : 
      'No content';
    previewElement.textContent = previewText;
    
    // Set timezone info
    const timezoneElement = this.modalElement.querySelector('.timezone-text');
    timezoneElement.textContent = `Times are in your local timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
    
    // Set minimum date to current time + 5 minutes
    const dateTimeInput = this.modalElement.querySelector('#schedule-datetime');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    dateTimeInput.min = now.toISOString().slice(0, 16);
    dateTimeInput.value = '';
    
    // Reset states
    this.clearMessages();
    this.resetScheduleButton();
    
    // Prevent body scrolling
    document.body.classList.add('modal-open');
    
    // Show the modal with smooth animation
    this.modalElement.style.display = 'flex';
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
      this.modalElement.classList.add('visible');
    });
    
    // Focus on datetime input after animation
    setTimeout(() => {
      dateTimeInput.focus();
    }, 300);
  }

  close() {
    // Start closing animation
    this.modalElement.classList.remove('visible');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
      this.modalElement.style.display = 'none';
      
      // Re-enable body scrolling
      document.body.classList.remove('modal-open');
      
      // Reset data
      this.postData = null;
      this.onSchedule = null;
      this.clearMessages();
    }, 300); // Match the CSS transition duration
  }

  isOpen() {
    return this.modalElement.style.display === 'flex';
  }
  /**
   * Valida la data/ora selezionata
   */
  validateDateTime() {
    const dateTimeInput = this.modalElement.querySelector('#schedule-datetime');
    const scheduleBtn = this.modalElement.querySelector('.schedule-btn');
    
    const selectedDate = new Date(dateTimeInput.value);
    const minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() + 5);

    if (selectedDate < minDate) {
      scheduleBtn.disabled = true;
      dateTimeInput.setCustomValidity('Please select a time at least 5 minutes in the future');
    } else {
      scheduleBtn.disabled = false;
      dateTimeInput.setCustomValidity('');
    }
  }

  /**
   * Gestisce la schedulazione del post
   */
  async handleSchedule() {
    const dateTimeInput = this.modalElement.querySelector('#schedule-datetime');
    const scheduleBtn = this.modalElement.querySelector('.schedule-btn');

    if (!dateTimeInput.value) {
      this.showError('Please select a date and time for scheduling');
      return;
    }

    const scheduledDate = new Date(dateTimeInput.value);
    const now = new Date();

    if (scheduledDate <= now) {
      this.showError('Please select a future date and time');
      return;
    }

    try {
      scheduleBtn.disabled = true;
      scheduleBtn.innerHTML = '<span class="spinner"></span> Authorizing...';

      // First, check if user has already authorized cur8
      const hasAuthorization = await authService.checkCur8Authorization();
      
      if (!hasAuthorization) {
        // Request authorization
        scheduleBtn.innerHTML = '<span class="spinner"></span> Requesting authorization...';
        await authService.authorizeCur8ForScheduledPosts();
      }

      // Schedule the post
      scheduleBtn.innerHTML = '<span class="spinner"></span> Scheduling post...';
      
      const scheduleData = {
        ...this.postData,
        scheduledDate: scheduledDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      await createPostService.schedulePost(scheduleData);

      // Success
      this.showSuccess('Post scheduled successfully!');
      
      setTimeout(() => {
        this.close();
        if (this.onSchedule) {
          this.onSchedule(scheduleData);
        }
      }, 2000);

    } catch (error) {
      console.error('Failed to schedule post:', error);
      this.showError(error.message || 'Failed to schedule post');
      this.resetScheduleButton();
    }
  }

  /**
   * Resetta il pulsante di schedulazione allo stato iniziale
   */
  resetScheduleButton() {
    const scheduleBtn = this.modalElement.querySelector('.schedule-btn');
    scheduleBtn.disabled = false;
    scheduleBtn.innerHTML = '<span class="material-icons">schedule</span> Schedule Post';
  }

  /**
   * Mostra un messaggio di errore
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Mostra un messaggio di successo
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Mostra un messaggio nel modal
   */
  showMessage(message, type) {
    const container = this.modalElement.querySelector('.dialog-message-container');
    
    // Rimuovi eventuali messaggi esistenti
    container.innerHTML = '';

    const messageDiv = document.createElement('div');
    messageDiv.className = `dialog-message ${type}`;
    messageDiv.setAttribute('role', type === 'error' ? 'alert' : 'status');
    messageDiv.innerHTML = `
      <span class="material-icons">${type === 'error' ? 'error' : 'check_circle'}</span>
      <span>${message}</span>
    `;

    container.appendChild(messageDiv);

    // Auto remove after 3 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.style.opacity = '0';
          setTimeout(() => messageDiv.remove(), 300);
        }
      }, 3000);
    }

    // Announce to screen readers
    messageDiv.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  }

  /**
   * Rimuove tutti i messaggi
   */
  clearMessages() {
    const container = this.modalElement.querySelector('.dialog-message-container');
    container.innerHTML = '';
  }

  /**
   * Pulisce le referenze
   */
  destroy() {
    // Chiama il cleanup del componente base per rimuovere tutti gli event listener
    super.destroy();
    
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.remove();
    }
    
    this.modalElement = null;
    this.onSchedule = null;
    this.postData = null;
  }
}

// Create singleton instance following the pattern of other modals
const schedulePostDialog = new SchedulePostDialog();
export default schedulePostDialog;