import reblogService from '../../services/ReblogService.js';
import router from '../../utils/Router.js';

class RebloggersPopup {
  static popupCounter = 0;

  constructor(post) {
    this.post = post;
    this.isMobile = window.innerWidth < 768;
    this.popupId = `rebloggers-popup-${RebloggersPopup.popupCounter++}`;
    this.overlay = null;
    this.popup = null;
    this.closePopupHandler = this.close.bind(this);
  }

  close() {
    document.removeEventListener('keydown', this.escKeyHandler);

    const overlay = this.overlay;
    const popup = this.popup;

    this.overlay = null;
    this.popup = null;

    if (overlay || popup) {
      if (overlay) overlay.style.opacity = '0';
      if (popup) {
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -50%) scale(0.95)';
      }

      setTimeout(() => {
        if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay);
        if (popup && document.body.contains(popup)) document.body.removeChild(popup);
      }, 180);
    }
  }

  escKeyHandler = (e) => {
    if (e.key === 'Escape') this.close();
  };

  show() {
    this.close();
    this._openPopup();
  }

  async _openPopup() {
    this.createPopupElements();
    document.addEventListener('keydown', this.escKeyHandler);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.popup);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.overlay) this.overlay.style.opacity = '1';
      if (this.popup) {
        this.popup.style.opacity = '1';
        this.popup.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }));

    const rebloggers = await reblogService.getRebloggers(this.post.author, this.post.permlink);
    this.renderRebloggers(rebloggers);
  }

  createPopupElements() {
    this.popup = this.createElement('div', `rebloggers-popup ${this.popupId}`, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(0.95)',
      backgroundColor: 'var(--background-light)',
      color: 'var(--text-color)',
      padding: this.isMobile ? 'var(--space-sm)' : 'var(--space-lg)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--popup-box-shadow)',
      zIndex: 'var(--z-modal)',
      maxHeight: '80vh',
      overflow: 'auto',
      width: this.isMobile ? '90%' : null,
      maxWidth: this.isMobile ? '100%' : '90%',
      minWidth: this.isMobile ? 'auto' : '500px',
      opacity: '0',
      transition: 'opacity 0.18s ease, transform 0.18s ease'
    });

    this.overlay = this.createElement('div', `popup-overlay ${this.popupId}-overlay`, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 'calc(var(--z-modal) - 1)',
      opacity: '0',
      transition: 'opacity 0.18s ease'
    });

    this.overlay.addEventListener('click', this.closePopupHandler);

    this.popup.appendChild(this.createPopupHeader());
    this.popup.appendChild(this.createPopupContent());
  }

  createPopupHeader() {
    const header = this.createElement('div', 'rebloggers-popup-header', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color)',
      paddingBottom: 'var(--space-sm)',
      marginBottom: 'var(--space-md)'
    });

    const title = this.createElement('h3', '', {
      color: 'var(--text-heading)',
      margin: 'var(--space-sm) 0'
    }, 'Reblog Details');

    const closeBtn = this.createElement('button', 'close-popup-btn', {
      backgroundColor: 'var(--background-lighter)',
      color: 'var(--text-color)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      padding: 'var(--space-xs) var(--space-sm)',
      fontSize: '1.5rem'
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', this.closePopupHandler);

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  createPopupContent() {
    const content = this.createElement('div', 'rebloggers-popup-content');
    content.appendChild(this.createElement('p', 'rebloggers-loading', {
      color: 'var(--text-muted)',
      textAlign: 'center',
      padding: 'var(--space-md)'
    }, 'Loading reblogs...'));
    return content;
  }

  renderRebloggers(rebloggers) {
    if (!this.popup) return;

    const content = this.popup.querySelector('.rebloggers-popup-content');
    if (!content) return;

    content.innerHTML = '';

    if (!Array.isArray(rebloggers) || rebloggers.length === 0) {
      content.appendChild(this.createElement('p', 'no-rebloggers', {
        color: 'var(--text-muted)',
        textAlign: 'center',
        padding: 'var(--space-md)'
      }, 'No reblogs on this post yet.'));
      return;
    }

    const list = this.createElement('ul', 'rebloggers-list', {
      listStyle: 'none',
      padding: '0',
      margin: '0'
    });

    rebloggers.forEach(username => {
      list.appendChild(this.createRebloggerItem(username));
    });

    content.appendChild(list);
  }

  createRebloggerItem(username) {
    const item = this.createElement('li', 'reblogger-item', {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: this.isMobile ? 'var(--space-xs)' : 'var(--space-sm)',
      borderBottom: '1px solid var(--border-color)',
      cursor: 'pointer'
    });

    const avatar = this.createElement('img', 'reblogger-avatar', {
      width: this.isMobile ? '24px' : '32px',
      height: this.isMobile ? '24px' : '32px',
      borderRadius: 'var(--radius-pill)',
      objectFit: 'cover',
      backgroundColor: 'var(--background-lighter)'
    });
    avatar.src = `https://steemitimages.com/u/${username}/avatar`;
    avatar.alt = `${username}'s avatar`;
    avatar.onerror = function () {
      this.src = 'https://steemitimages.com/u/default/avatar';
      this.onerror = null;
    };

    const name = this.createElement('span', 'reblogger-name', {
      color: 'var(--primary-color)',
      fontWeight: 'bold'
    }, username);

    item.appendChild(avatar);
    item.appendChild(name);

    item.addEventListener('click', () => {
      this.close();
      router.navigate(`/@${username}`);
    });

    return item;
  }

  createElement(tagName, className = '', styles = {}, textContent = '') {
    const element = document.createElement(tagName);

    if (className) element.className = className;
    Object.entries(styles).forEach(([property, value]) => {
      if (value !== null) element.style[property] = value;
    });
    if (textContent) element.textContent = textContent;

    return element;
  }
}

export default RebloggersPopup;