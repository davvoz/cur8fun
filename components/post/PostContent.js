class PostContent {
  constructor(post, contentRenderer) {
    this.post = post;
    this.contentRenderer = contentRenderer;
  }

  render() {
    // Use ContentRenderer for post body with SteemContentRenderer integration
    if (!this.contentRenderer) {
      console.error('ContentRenderer not initialized');
      // Create a simple container with error message
      const errorContainer = document.createElement('div');
      errorContainer.className = 'error-message';
      errorContainer.textContent = 'Could not render post content';
      return errorContainer;
    }

    // Render the post content using ContentRenderer
    const renderedContent = this.contentRenderer.render({
      title: this.post.title,
      body: this.post.body
    });

    return renderedContent.container;
  }

  unmount() {
    // Any cleanup needed
  }
}

export default PostContent;
