import ReplyLoader from '../comments/ReplyLoader.js';
import CommentRenderer from '../comments/CommentRenderer.js';
import CommentUIManager from '../comments/CommentUIManager.js';
import LoadingIndicator from '../LoadingIndicator.js';

export default class RepliesList {
  constructor(username) {
    this.username = username;
    this._renderer = new CommentRenderer();
    this._loader = new ReplyLoader(username);
    this._uiManager = null;
    this.infiniteScrollLoader = null;

    this.allReplies = [];
    this.loading = false;
    this.currentPage = 1;
    this.container = null;

    this.uniqueContainerId = `replies-container-${Math.random().toString(36).substring(2, 10)}`;
  }

  async render(container) {
    if (!container) return;

    const hasExistingData = this.allReplies && this.allReplies.length > 0;

    container.innerHTML = '';
    this.container = container;

    container.innerHTML = `
      <div class="comments-unique-wrapper">
        <div id="${this.uniqueContainerId}" class="comments-main-container"></div>
      </div>
    `;

    const box = container.querySelector(`#${this.uniqueContainerId}`);
    this._uiManager = new CommentUIManager(box, this._renderer);

    box.addEventListener('retry-comments', () => this._load());

    if (hasExistingData) {
      await this._renderLoaded();
    } else {
      await this._load();
    }
  }

  async _load() {
    if (this.loading) return;
    this.loading = true;

    const box = this.container?.querySelector(`#${this.uniqueContainerId}`);
    if (!box) { this.loading = false; return; }

    this._renderSkeleton(box);

    try {
      await this._loader.loadReplies(20, 1);
      this.allReplies = this._loader.allReplies;
      this.currentPage = 1;
      await this._renderLoaded();
    } catch (err) {
      console.error('[RepliesList] Error loading replies:', err);
      if (box && this._uiManager) this._uiManager.showError(err);
    } finally {
      this.loading = false;
    }
  }

  async _renderLoaded() {
    const box = this.container?.querySelector(`#${this.uniqueContainerId}`);
    if (!box) return;

    box.innerHTML = '';
    this._uiManager.setupLayout('list');

    if (!this.allReplies?.length) {
      this._renderEmpty(box);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'comments-list-wrapper';
    box.appendChild(wrapper);

    this._uiManager.renderComments(this.allReplies, wrapper);
    this._setupInfiniteScroll(wrapper);
  }

  _setupInfiniteScroll(wrapper) {
    if (!this._uiManager || !wrapper) return;

    if (!this.infiniteScrollLoader) {
      this.infiniteScrollLoader = new LoadingIndicator('progressBar');
    }

    const box = this.container?.querySelector(`#${this.uniqueContainerId}`);
    if (!box) return;

    this._uiManager.setupInfiniteScroll(async (page) => {
      try {
        this.infiniteScrollLoader.show(box);
        const newReplies = await this._loader.loadMoreReplies(page);
        this.infiniteScrollLoader.hide();

        if (newReplies?.length) {
          this.currentPage = page;
          this.allReplies = this._loader.allReplies;
          this._uiManager.renderComments(newReplies, wrapper);
          return this._loader.hasMore();
        }
        return false;
      } catch (err) {
        console.error('[RepliesList] Error loading more replies:', err);
        this.infiniteScrollLoader.hide();
        return false;
      }
    }, wrapper, 1);
  }

  _renderSkeleton(container) {
    const items = [1, 2, 3].map(() => `
      <div class="comment-list-item comment-skeleton-item" aria-hidden="true">
        <div class="comment-avatar"><span class="sk-block sk-comment-avatar"></span></div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="sk-block sk-comment-author"></span>
            <span class="sk-block sk-comment-date"></span>
          </div>
          <div class="comment-body">
            <span class="sk-block sk-comment-line"></span>
            <span class="sk-block sk-comment-line sk-comment-line-short"></span>
          </div>
        </div>
      </div>`).join('');
    container.innerHTML = `<div class="comments-list-wrapper comments-skeleton-wrapper">${items}</div>`;
  }

  _renderEmpty(container) {
    const msg = document.createElement('div');
    msg.className = 'empty-comments-message';
    msg.innerHTML = `<h3>No replies found</h3><p>@${this.username} hasn't received any replies yet.</p>`;
    container.appendChild(msg);
  }

  prepareForReuse() {
    this.loading = false;
    return this;
  }

  reset() {
    this.loading = false;
    this.allReplies = [];
    this.currentPage = 1;
    this._loader.reset();
    return this;
  }
}