import View from './View.js';
import SteemService from '../services/SteemService.js';
import router from '../utils/Router.js';

class CreatePostView extends View {
  constructor(element, params = {}) {
    super(element, params);
    this.steemService = new SteemService();
    this.isSubmitting = false;
  }

  async render() {
    // Check if user is logged in
    const user = this.getCurrentUser();
    if (!user) {
      router.navigate('/login', { returnUrl: '/create' });
      return;
    }

    this.element.innerHTML = `
      <div class="create-post-view">
        <h1>Create New Post</h1>
        <form class="post-form">
          <input type="text" name="title" placeholder="Title" required>
          <textarea name="body" placeholder="Write your post content here..." required></textarea>
          <div class="post-options">
            <input type="text" name="tags" placeholder="Tags (comma separated)">
            <label>
              <input type="checkbox" name="nsfw"> NSFW Content
            </label>
          </div>
          <button type="submit" class="submit-btn" disabled>Publish Post</button>
        </form>
        <div class="error-message" style="display:none"></div>
      </div>
    `;

    this.bindEvents();
  }

  
}

export default CreatePostView;
