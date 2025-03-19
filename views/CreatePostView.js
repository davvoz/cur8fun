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
    
    // Initialize ContentRenderer for post previews
    this.contentRenderer = new ContentRenderer({
      containerClass: 'preview-content',
      imageClass: 'preview-image',
      useProcessBody: true,
      maxImageWidth: 600,
      imagePosition: 'top'
    });
    
    this.previewMode = false;
    
    // Set up event listeners for post creation events
    this.setupEventHandlers();
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
    
    // Add a preview toggle button
    // const previewToggle = document.createElement('button');
    // previewToggle.type = 'button';
    // previewToggle.className = 'btn secondary-btn preview-toggle-btn';
    // previewToggle.id = 'preview-toggle-btn';
    // previewToggle.textContent = 'Show Preview';
    // previewToggle.addEventListener('click', () => this.togglePreview());
    
    // Preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'post-preview-container';
    previewContainer.id = 'post-preview';
    previewContainer.style.display = 'none';
    
    const previewHeader = document.createElement('h2');
    previewHeader.textContent = 'Post Preview';
    previewContainer.appendChild(previewHeader);
    
    const previewContent = document.createElement('div');
    previewContent.className = 'post-preview-content';
    previewContainer.appendChild(previewContent);
    
    // Add buttons side by side
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
    // buttonGroup.appendChild(previewToggle);
    buttonGroup.appendChild(submitBtn);
    
    form.appendChild(buttonGroup);
    form.appendChild(previewContainer);
    
    // Append form to container
    postEditor.appendChild(header);
    postEditor.appendChild(form);
    
    // IMPORTANT: Add the element to the DOM first!
    this.element.appendChild(postEditor);
    
    // AFTER DOM insertion, we can safely get the container reference
    const markdownContainer = document.getElementById('markdown-editor-container');
    
    // Initialize the Markdown editor with the actual DOM element
    this.markdownEditor = new MarkdownEditor(
      markdownContainer,
      {
        placeholder: 'Write your post content here using Markdown...',
        onChange: (value) => {
          this.postBody = value;
          // Update preview if it's currently shown
          if (this.previewMode) {
            this.updatePreview();
          }
        },
        height: '500px',
        // Pass the ContentRenderer to MarkdownEditor
        rendererOptions: {
          containerClass: 'preview-content',
          imageClass: 'preview-image'
        }
      }
    );
    
    // Now render the editor
    this.markdownEditor.render();
    
    // Set up additional input handlers for real-time preview updates
    this.setupPreviewListeners();
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
  
  /**
   * Set up event listeners for preview updates
   */
  setupPreviewListeners() {
    // Update preview when title changes
    const titleInput = document.getElementById('post-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.postTitle = e.target.value;
        if (this.previewMode) {
          this.updatePreview();
        }
      });
    }
    
    // Update preview when tags change
    const tagsInput = document.getElementById('post-tags');
    if (tagsInput) {
      tagsInput.addEventListener('input', (e) => {
        this.tags = e.target.value.split(' ').filter(tag => tag.trim() !== '');
        if (this.previewMode) {
          this.updatePreview();
        }
      });
    }
  }
  
  // /**
  //  * Toggle preview visibility
  //  */
  // togglePreview() {
  //   this.previewMode = !this.previewMode;
    
  //   const previewContainer = document.getElementById('post-preview');
  //   const previewToggleBtn = document.getElementById('preview-toggle-btn');
    
  //   if (this.previewMode) {
  //     // Update preview content
  //     this.updatePreview();
      
  //     // Show preview
  //     previewContainer.style.display = 'block';
  //     previewToggleBtn.textContent = 'Hide Preview';
  //     previewToggleBtn.classList.add('active');
      
  //     // Scroll to preview
  //     previewContainer.scrollIntoView({ behavior: 'smooth' });
  //   } else {
  //     // Hide preview
  //     previewContainer.style.display = 'none';
  //     previewToggleBtn.textContent = 'Show Preview';
  //     previewToggleBtn.classList.remove('active');
  //   }
  // }
  
  /**
   * Update preview content
   */
  updatePreview() {
    const previewContent = document.querySelector('.post-preview-content');
    if (!previewContent) return;
    
    // Clear previous content
    while (previewContent.firstChild) {
      previewContent.removeChild(previewContent.firstChild);
    }
    
    // Create preview data
    const previewData = {
      title: this.postTitle,
      body: this.postBody
    };
    
    try {
      // Render post content using ContentRenderer
      const rendered = this.contentRenderer.render(previewData);
      
      // Add tags preview if available
      if (this.tags && this.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'preview-tags';
        
        this.tags.forEach(tag => {
          const tagElement = document.createElement('span');
          tagElement.className = 'preview-tag';
          tagElement.textContent = tag;
          tagsContainer.appendChild(tagElement);
        });
        
        previewContent.appendChild(tagsContainer);
      }
      
      // Add the rendered content
      previewContent.appendChild(rendered.container);
    } catch (error) {
      console.error('Error rendering preview:', error);
      previewContent.innerHTML = `
        <div class="error-message">
          Error generating preview: ${error.message}
        </div>`;
    }
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
