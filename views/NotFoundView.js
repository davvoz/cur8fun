import View from './View.js';

class NotFoundView extends View {
  async render() {
    this.element.innerHTML = `
      <div class="not-found-view">
        <h1>404 - Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/" class="back-home">Back to Home</a>
      </div>
    `;
  }
}

export default NotFoundView;
