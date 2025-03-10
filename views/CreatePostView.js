import View from './View.js';
import eventEmitter from '../utils/EventEmitter.js';
import steemService from '../services/SteemService.js';
import authService from '../services/AuthService.js';
import Post from '../models/Post.js';

export default class CreatePostView extends View {
  constructor(params) {
    super(params);
    this.isSubmitting = false;
  }

  async render(container) {
    this.element = container;
    
    // Check if user is logged in
    if (!authService.isAuthenticated()) {
      container.innerHTML = this.renderLoginRequired();
      const loginBtn = container.querySelector('#login-redirect');
      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          window.location.hash = '#/login';
        });
      }
      return;
    }
    
    container.innerHTML = this.renderCreatePostForm();
    this.bindEvents();
  }
  
  renderLoginRequired() {
    return `
      <div class="create-post-container auth-required">
        <h2>Create Post</h2>
        <div class="card">
          <div class="card-content">
            <p>You need to be logged in to create posts.</p>
            <button id="login-redirect" class="btn primary-btn">Login</button>
          </div>
        </div>
      </div>
    `;
  }
  
  renderCreatePostForm() {
    return `
      <div class="create-post-container">
        <h2>Create Post</h2>
        <div class="card">
          <div class="card-content">
            <form id="create-post-form">
              <div id="status-container" class="status-container"></div>

              <div class="form-group">
                <label for="post-title">Title</label>
                <input type="text" id="post-title" placeholder="Enter your post title" required>
              </div>
              
              <div class="form-group">
                <label for="post-body">Content (Markdown supported)</label>
                <textarea id="post-body" rows="12" placeholder="Write your post content here..." required></textarea>
              </div>
              
              <div class="form-group">
                <label for="post-tags">Tags (separated by spaces)</label>
                <input type="text" id="post-tags" placeholder="tag1 tag2 tag3">
                <small class="form-hint">First tag will be the main category</small>
              </div>
              
              <div class="form-group form-group-inline">
                <input type="checkbox" id="post-nsfw">
                <label for="post-nsfw">Mark as NSFW (Not Safe For Work)</label>
              </div>
              
              <div class="form-actions">
                <button type="button" id="preview-btn" class="btn secondary-btn">Preview</button>
                <button type="submit" id="publish-btn" class="btn primary-btn">Publish Post</button>
              </div>
            </form>
            
            <div id="preview-container" class="preview-container hidden">
              <h3>Preview</h3>
              <div id="preview-content"></div>
              <button id="back-to-edit" class="btn secondary-btn">Back to editing</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    const form = this.element.querySelector('#create-post-form');
    const previewBtn = this.element.querySelector('#preview-btn');
    const backToEditBtn = this.element.querySelector('#back-to-edit');
    
    form.addEventListener('submit', this.handleSubmit.bind(this));
    previewBtn.addEventListener('click', this.handlePreview.bind(this));
    backToEditBtn.addEventListener('click', this.handleBackToEdit.bind(this));
  }
  
  handlePreview() {
    const titleInput = this.element.querySelector('#post-title');
    const bodyInput = this.element.querySelector('#post-body');
    const form = this.element.querySelector('#create-post-form');
    const previewContainer = this.element.querySelector('#preview-container');
    const previewContent = this.element.querySelector('#preview-content');
    
    // Prepare preview content
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    
    if (!title || !body) {
      this.showStatus('Please enter both title and content to preview', 'error');
      return;
    }
    
    // Convert markdown to HTML safely
    const htmlContent = DOMPurify.sanitize(marked.parse(body));
    
    previewContent.innerHTML = `
      <div class="preview-title">${title}</div>
      <div class="preview-body">${htmlContent}</div>
    `;
    
    // Hide form, show preview
    form.classList.add('hidden');
    previewContainer.classList.remove('hidden');
  }
  
  handleBackToEdit() {
    const form = this.element.querySelector('#create-post-form');
    const previewContainer = this.element.querySelector('#preview-container');
    
    form.classList.remove('hidden');
    previewContainer.classList.add('hidden');
  }
  
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isSubmitting) return;
    
    const titleInput = this.element.querySelector('#post-title');
    const bodyInput = this.element.querySelector('#post-body');
    const tagsInput = this.element.querySelector('#post-tags');
    const nsfwCheckbox = this.element.querySelector('#post-nsfw');
    const publishBtn = this.element.querySelector('#publish-btn');
    
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    let tags = tagsInput.value.trim().toLowerCase().split(/\s+/).filter(tag => tag);
    const isNSFW = nsfwCheckbox.checked;
    
    // Validate inputs
    if (!title) {
      this.showStatus('Please enter a title for your post', 'error');
      return;
    }
    
    if (!body) {
      this.showStatus('Please enter content for your post', 'error');
      return;
    }
    
    // Ensure we have at least one tag
    if (tags.length === 0) {
      tags = ['steemee']; // Default tag
    }
    
    const category = tags[0]; // First tag is the main category
    
    // Start submission
    this.isSubmitting = true;
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';
    this.showStatus('Publishing your post...', 'info');
    
    try {
      // Check if Steem Keychain is installed
      if (!window.steem_keychain) {
        throw new Error('Steem Keychain extension is not installed');
      }
      
      const user = authService.getCurrentUser();
      
      // Create a unique permlink from the title
      const permlink = this.generatePermlink(title);
      
      await this.publishPost(user.username, permlink, title, body, category, tags, isNSFW);
      
      this.showStatus('Post published successfully! Redirecting...', 'success');
      
      // Redirect to the post after a short delay
      setTimeout(() => {
        window.location.hash = `#/@${user.username}/${permlink}`;
      }, 1500);
      
    } catch (error) {
      this.showStatus(`Error publishing post: ${error.message}`, 'error');
      console.error('Post submission error:', error);
    } finally {
      this.isSubmitting = false;
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publish Post';
    }
  }
  
  // Generate a permlink from title
  generatePermlink(title) {
    const permlink = title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')   // Remove special chars
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
    
    // Add a timestamp to ensure uniqueness
    return `${permlink}-${Math.floor(Date.now() / 1000)}`;
  }
  
  // Publish post using Keychain
  publishPost(username, permlink, title, body, category, tags, isNSFW) {
    return new Promise((resolve, reject) => {
      // Prepare operation
      const operations = [
        ["comment",
          {
            parent_author: "",
            parent_permlink: category,
            author: username,
            permlink: permlink,
            title: title,
            body: body,
            json_metadata: JSON.stringify({
              tags: tags,
              app: "steemee/1.0",
              format: "markdown",
              isNSFW: isNSFW
            })
          }
        ]
      ];
      
      // Add beneficiaries if needed
      operations.push([
        "comment_options",
        {
          author: username,
          permlink: permlink,
          max_accepted_payout: "1000000.000 SBD",
          percent_steem_dollars: 10000,
          allow_votes: true,
          allow_curation_rewards: true,
          extensions: [
            [0, {
              beneficiaries: [
                { account: 'steemee', weight: 500 } // 5% beneficiary
              ]
            }]
          ]
        }
      ]);
      
      // Broadcast to blockchain using Keychain
      window.steem_keychain.requestBroadcast(
        username,
        operations,
        'posting',
        response => {
          if (response.success) {
            resolve({
              author: username,
              permlink,
            });
          } else {
            reject(new Error(response.error || 'Failed to publish post'));
          }
        }
      );
    });
  }
  
  showStatus(message, type = 'error') {
    const statusContainer = this.element.querySelector('#status-container');
    statusContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (statusContainer.querySelector('.alert-success')) {
          statusContainer.innerHTML = '';
        }
      }, 5000);
    }
  }
  
  removeEventListeners() {
    const form = this.element.querySelector('#create-post-form');
    const previewBtn = this.element.querySelector('#preview-btn');
    const backToEditBtn = this.element.querySelector('#back-to-edit');
    
    if (form) form.removeEventListener('submit', this.handleSubmit);
    if (previewBtn) previewBtn.removeEventListener('click', this.handlePreview);
    if (backToEditBtn) backToEditBtn.removeEventListener('click', this.handleBackToEdit);
  }
}
