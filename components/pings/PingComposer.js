import authService from '../../services/AuthService.js';
import imageUploadService from '../../services/ImageUploadService.js';
import pingsService from '../../services/PingsService.js';
import eventEmitter from '../../utils/EventEmitter.js';
import { getImageUrl } from '../../utils/ImageUtils.js';
import { PINGS_CONFIG } from '../../config/pings.js';

const WARN_THRESHOLD = 20;

/**
 * Text box with image attachments and a character counter, used both for new
 * pings and for replies.
 */
export default class PingComposer {
  /**
   * @param {Object} options
   * @param {string} [options.placeholder]
   * @param {string} [options.submitLabel]
   * @param {string} [options.guestText] - Shown instead of the box when logged out
   * @param {string} [options.initialText] - Prefilled text (hashtag pages, edits)
   * @param {string[]} [options.initialImages] - Prefilled image URLs (edits)
   * @param {boolean} [options.showAvatar=true]
   * @param {Function} options.onSubmit - async ({ text, images }) => void; throw to keep the draft
   * @param {Function} [options.onCancel] - Adds a Cancel button when set
   */
  constructor({
    placeholder = "What's happening?",
    submitLabel = 'Ping',
    guestText = 'Log in to post your own pings.',
    initialText = '',
    initialImages = [],
    showAvatar = true,
    onSubmit,
    onCancel = null
  }) {
    this.placeholder = placeholder;
    this.submitLabel = submitLabel;
    this.guestText = guestText;
    this.initialText = initialText;
    this.showAvatar = showAvatar;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.images = [...initialImages];
    this.uploading = 0;
    this.submitting = false;
    this.element = null;
  }

  render() {
    const user = authService.getCurrentUser();
    this.element = document.createElement('div');
    this.element.className = 'ping-composer';

    if (!user) {
      this.element.classList.add('ping-composer--guest');
      const text = document.createElement('p');
      text.textContent = this.guestText;
      const login = document.createElement('a');
      login.className = 'ping-btn ping-btn--primary';
      login.href = '/login';
      login.textContent = 'Log in';
      this.element.append(text, login);
      return this.element;
    }

    const avatar = document.createElement('img');
    avatar.className = 'ping-composer-avatar';
    avatar.src = `https://steemitimages.com/u/${user.username}/avatar/small`;
    avatar.alt = user.username;

    const body = document.createElement('div');
    body.className = 'ping-composer-body';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'ping-composer-input';
    this.textarea.placeholder = this.placeholder;
    this.textarea.rows = 2;
    this.textarea.addEventListener('input', () => {
      this.autoResize();
      this.updateState();
    });
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.submit();
      }
    });

    this.attachments = document.createElement('div');
    this.attachments.className = 'ping-composer-attachments';

    const footer = document.createElement('div');
    footer.className = 'ping-composer-footer';

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.multiple = true;
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => {
      this.addImages([...this.fileInput.files]);
      this.fileInput.value = '';
    });

    this.imageBtn = document.createElement('button');
    this.imageBtn.type = 'button';
    this.imageBtn.className = 'ping-icon-btn';
    this.imageBtn.title = 'Add image';
    this.imageBtn.innerHTML = '<span class="material-icons">image</span>';
    this.imageBtn.addEventListener('click', () => this.fileInput.click());

    this.counter = document.createElement('span');
    this.counter.className = 'ping-composer-counter';

    this.submitBtn = document.createElement('button');
    this.submitBtn.type = 'button';
    this.submitBtn.className = 'ping-btn ping-btn--primary';
    this.submitBtn.textContent = this.submitLabel;
    this.submitBtn.addEventListener('click', () => this.submit());

    const spacer = document.createElement('span');
    spacer.className = 'ping-composer-spacer';

    footer.append(this.imageBtn, this.fileInput, spacer, this.counter);
    if (this.onCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ping-btn ping-btn--ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this.onCancel());
      footer.appendChild(cancelBtn);
    }
    footer.appendChild(this.submitBtn);
    body.append(this.textarea, this.attachments, footer);
    if (this.showAvatar) this.element.appendChild(avatar);
    this.element.appendChild(body);

    this.textarea.value = this.initialText;
    this.images.forEach(url => this.attachments.appendChild(this.createAttachment(url)));

    // Paste images straight into the box
    this.textarea.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        this.addImages(files);
      }
    });

    this.updateState();
    return this.element;
  }

  focus() {
    if (!this.textarea) return;
    this.textarea.focus();
    const end = this.textarea.value.length;
    this.textarea.setSelectionRange(end, end);
    this.autoResize();
  }

  autoResize() {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;
  }

  updateState() {
    if (!this.textarea) return;
    const remaining = PINGS_CONFIG.maxLength - pingsService.countChars(this.textarea.value);
    const hasContent = this.textarea.value.trim().length > 0 || this.images.length > 0;

    this.counter.textContent = remaining <= WARN_THRESHOLD ? String(remaining) : '';
    this.counter.classList.toggle('is-warning', remaining <= WARN_THRESHOLD && remaining >= 0);
    this.counter.classList.toggle('is-over', remaining < 0);

    this.imageBtn.disabled = this.submitting || this.images.length + this.uploading >= PINGS_CONFIG.maxImages;
    this.submitBtn.disabled = this.submitting || this.uploading > 0 || !hasContent || remaining < 0;
    this.textarea.disabled = this.submitting;
  }

  async addImages(files) {
    const user = authService.getCurrentUser();
    if (!user) return;

    const free = PINGS_CONFIG.maxImages - this.images.length - this.uploading;
    if (files.length > free) {
      eventEmitter.emit('notification', {
        type: 'warning',
        message: `You can attach up to ${PINGS_CONFIG.maxImages} images`
      });
    }

    await Promise.all(files.slice(0, Math.max(free, 0)).map(async (file) => {
      const placeholder = this.createAttachment(null);
      this.uploading++;
      this.updateState();
      try {
        const url = await imageUploadService.uploadImage(file, user.username);
        this.images.push(url);
        placeholder.replaceWith(this.createAttachment(url));
      } catch {
        // ImageUploadService already shows the error toast
        placeholder.remove();
      } finally {
        this.uploading--;
        this.updateState();
      }
    }));
  }

  createAttachment(url) {
    const item = document.createElement('div');
    item.className = 'ping-attachment';

    if (!url) {
      item.classList.add('is-uploading');
      item.innerHTML = '<span class="material-icons">hourglass_empty</span>';
      this.attachments.appendChild(item);
      return item;
    }

    const img = document.createElement('img');
    img.src = getImageUrl(url, 320);
    img.alt = '';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ping-attachment-remove';
    remove.title = 'Remove image';
    remove.innerHTML = '<span class="material-icons">close</span>';
    remove.addEventListener('click', () => {
      this.images = this.images.filter(u => u !== url);
      item.remove();
      this.updateState();
    });
    item.append(img, remove);
    return item;
  }

  async submit() {
    if (this.submitBtn.disabled) return;
    this.submitting = true;
    this.submitBtn.textContent = 'Sending…';
    this.updateState();

    try {
      await this.onSubmit({ text: this.textarea.value.trim(), images: [...this.images] });
      this.reset();
    } catch (error) {
      if (!error?.isCancelled) {
        eventEmitter.emit('notification', {
          type: 'error',
          message: error?.message || 'Failed to send'
        });
      }
    } finally {
      this.submitting = false;
      if (this.submitBtn) this.submitBtn.textContent = this.submitLabel;
      this.updateState();
    }
  }

  reset() {
    this.textarea.value = this.initialText;
    this.images = [];
    this.attachments.innerHTML = '';
    this.autoResize();
  }
}
