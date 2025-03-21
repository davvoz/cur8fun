import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import createPostService from '../services/CreatePostService.js';
import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';
import ContentRenderer from '../components/ContentRenderer.js';

class CreatePostView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Create Post | SteemGram';
    this.currentUser = authService.getCurrentUser();
    this.postTitle = '';
    this.postBody = '';
    this.tags = [];
    this.isSubmitting = false;
    this.markdownEditor = null;
    this.contentRenderer = null;
    this.previewEnabled = false;
    
    // Set up event listeners for post creation events
    this.setupEventHandlers();
    
    // Initialize the content renderer for previews
    this.initContentRenderer();
  }
  
  async initContentRenderer() {
    try {
      // Try to load SteemContentRenderer if needed
      await ContentRenderer.loadSteemContentRenderer();
      
      // Initialize the renderer
      this.contentRenderer = new ContentRenderer({
        containerClass: 'post-preview-content',
        imageClass: 'preview-image',
        useSteemContentRenderer: true
      });
    } catch (error) {
      console.error('Failed to initialize content renderer:', error);
      // Create fallback renderer
      this.contentRenderer = new ContentRenderer({
        useSteemContentRenderer: false
      });
    }
  }
  
  setupEventHandlers() {
    // Store handlers for cleanup
    this.eventHandlers = [];
    
    // Handler for post creation started
    const startHandler = (data) => {
      this.showStatus(`Publishing post "${data.title}"...`, 'info');
    };
    eventEmitter.on('post:creation-started', startHandler);
    this.eventHandlers.push({ event: 'post:creation-started', handler: startHandler });
    
    // Handler for post creation completed
    const completedHandler = (data) => {
      if (data.success) {
        // Show success notification
        eventEmitter.emit('notification', {
          type: 'success', 
          message: 'Your post has been published successfully!'
        });
        
        // Redirect to the new post
        router.navigate(`/@${data.author}/${data.permlink}`);
      }
    };
    eventEmitter.on('post:creation-completed', completedHandler);
    this.eventHandlers.push({ event: 'post:creation-completed', handler: completedHandler });
    
    // Handler for post creation error
    const errorHandler = (data) => {
      this.showError(`Failed to publish post: ${data.error}`);
      
      // Reset submit button
      const submitBtn = document.getElementById('submit-post-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Post';
      }
      
      this.isSubmitting = false;
    };
    eventEmitter.on('post:creation-error', errorHandler);
    this.eventHandlers.push({ event: 'post:creation-error', handler: errorHandler });
  }
  
  async render(element) {
    this.element = element;
    
    // Clear the container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create post editor container
    const postEditor = document.createElement('div');
    postEditor.className = 'post-editor-container';
    
    // Create header
    const header = document.createElement('header');
    header.className = 'editor-header';
    
    const heading = document.createElement('h1');
    heading.textContent = 'Create New Post';
    header.appendChild(heading);
    
    // Create form
    const form = document.createElement('form');
    form.className = 'post-form';
    form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Status message area
    const statusArea = document.createElement('div');
    statusArea.id = 'post-status-message';
    statusArea.className = 'status-message hidden';
    form.appendChild(statusArea);
    
    // Title input
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';
    
    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'post-title';
    titleLabel.textContent = 'Title';
    titleGroup.appendChild(titleLabel);
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'post-title';
    titleInput.className = 'form-control';
    titleInput.placeholder = 'Enter a title for your post';
    titleInput.required = true;
    titleInput.addEventListener('input', (e) => {
      this.postTitle = e.target.value;
      // Remove the preview update reference
      // if (this.previewEnabled) {
      //   this.updatePreview();
      // }
    });
    titleGroup.appendChild(titleInput);
    
    form.appendChild(titleGroup);
    
    // Content editor container
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'post-content';
    contentLabel.textContent = 'Content';
    contentGroup.appendChild(contentLabel);
    
    // Editor container
    const editorContainer = document.createElement('div');
    editorContainer.id = 'markdown-editor-container';
    contentGroup.appendChild(editorContainer);
    
    form.appendChild(contentGroup);
    
    // Tags input
    const tagsGroup = document.createElement('div');
    tagsGroup.className = 'form-group';
    
    const tagsLabel = document.createElement('label');
    tagsLabel.htmlFor = 'post-tags';
    tagsLabel.textContent = 'Tags';
    tagsGroup.appendChild(tagsLabel);
    
    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.id = 'post-tags';
    tagsInput.className = 'form-control';
    tagsInput.placeholder = 'Enter tags separated by spaces (e.g., steem art photography)';
    tagsInput.addEventListener('input', (e) => {
      this.tags = e.target.value.split(' ').filter(tag => tag.trim() !== '');
    });
    tagsGroup.appendChild(tagsInput);
    
    const tagsHelp = document.createElement('small');
    tagsHelp.className = 'form-text';
    tagsHelp.textContent = 'Add up to 5 tags to help categorize your post. The first tag becomes the main category.';
    tagsGroup.appendChild(tagsHelp);
    
    form.appendChild(tagsGroup);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn primary-btn';
    submitBtn.id = 'submit-post-btn';
    submitBtn.textContent = 'Publish Post';
    form.appendChild(submitBtn);
    
    // Append form to container
    postEditor.appendChild(header);
    postEditor.appendChild(form);
    
    // Add the container to the page
    this.element.appendChild(postEditor);
    
    // Initialize the Markdown editor
    this.markdownEditor = new MarkdownEditor(
      document.getElementById('markdown-editor-container'),
      {
        placeholder: 'Write your post content here using Markdown...',
        onChange: (value) => {
          this.postBody = value;
          // Remove the preview update reference
          // if (this.previewEnabled) {
          //   this.updatePreview();
          // }
        },
        height: '500px'
      }
    );
    this.markdownEditor.render();
    
    // Store references to DOM elements
    this.editorContainer = editorContainer;
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isSubmitting) return;
    
    // Start submission process
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submit-post-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Publishing...';
    
    try {
      // Use the CreatePostService to handle post creation
      await createPostService.createPost({
        title: this.postTitle,
        body: this.postBody,
        tags: this.tags
      });
      
      // The success action is handled by the event handler
    } catch (error) {
      console.error('Failed to publish post:', error);
      // Error handling is done by the event handler
    }
  }
  
  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('post-status-message');
    if (!statusDiv) return;
    
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
  }
  
  showError(message) {
    this.showStatus(message, 'error');
    
    // Hide after 5 seconds
    setTimeout(() => {
      const statusDiv = document.getElementById('post-status-message');
      if (statusDiv) {
        statusDiv.classList.add('hidden');
      }
    }, 5000);
  }
  
  unmount() {
    // Clean up event listeners
    if (this.eventHandlers && this.eventHandlers.length) {
      this.eventHandlers.forEach(handler => {
        eventEmitter.off(handler.event, handler.handler);
      });
    }
    
    super.unmount();
  }
}

export default CreatePostView;
