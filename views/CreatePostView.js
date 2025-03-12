import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import steemService from '../services/SteemService.js';
import router from '../utils/Router.js';

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
    
    // Content editor container - we'll attach our Markdown editor here
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
        },
        height: '500px'
      }
    );
    this.markdownEditor.render();
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isSubmitting) return;
    
    if (!this.postTitle.trim()) {
      this.showError('Please enter a title for your post');
      return;
    }
    
    if (!this.postBody.trim()) {
      this.showError('Please enter some content for your post');
      return;
    }
    
    if (this.tags.length === 0) {
      this.showError('Please add at least one tag');
      return;
    }
    
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submit-post-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Publishing...';
    
    try {
      // Call the steemService to create the post
      await steemService.createPost(
        this.postTitle,
        this.postBody,
        this.tags
      );
      
      this.emit('notification', {
        type: 'success',
        message: 'Your post has been published successfully!'
      });
      
      // Redirect to the home page
      router.navigate('/');
    } catch (error) {
      console.error('Failed to publish post:', error);
      
      this.showError(`Failed to publish post: ${error.message || 'Unknown error'}`);
      
      // Reset submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Post';
    } finally {
      this.isSubmitting = false;
    }
  }
  
  showError(message) {
    // Check if error message element already exists
    let errorMsg = document.getElementById('post-error-message');
    
    if (!errorMsg) {
      // Create the error message element
      errorMsg = document.createElement('div');
      errorMsg.id = 'post-error-message';
      errorMsg.className = 'alert alert-danger';
      
      // Insert it at the top of the form
      const form = document.querySelector('.post-form');
      form.insertBefore(errorMsg, form.firstChild);
    }
    
    errorMsg.textContent = message;
    
    // Hide after 5 seconds
    setTimeout(() => {
      errorMsg.remove();
    }, 5000);
  }
  
  unmount() {
    super.unmount();
  }
}

export default CreatePostView;
