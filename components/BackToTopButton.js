/**
 * Floating "back to top" button.
 * Singleton: mounts once on app boot, listens to #main-content scroll,
 * appears past a threshold and smooth-scrolls to top on click.
 */
class BackToTopButton {
  constructor() {
    this.threshold = 400;
    this.scrollContainer = null;
    this.button = null;
    this.visible = false;
    this.ticking = false;
    this.initialized = false;

    this.handleScroll = this.handleScroll.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  init() {
    if (this.initialized) return;

    this.scrollContainer = document.getElementById('main-content');
    if (!this.scrollContainer) return;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'back-to-top-btn';
    this.button.setAttribute('aria-label', 'Back to top');
    this.button.setAttribute('title', 'Back to top');
    this.button.innerHTML = '<span class="material-icons">arrow_upward</span>';
    this.button.addEventListener('click', this.handleClick);

    const host = document.getElementById('app') || document.body;
    host.appendChild(this.button);

    this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
    // In case the view replacement leaves scroll at top, ensure correct initial state
    this.updateVisibility();

    this.initialized = true;
  }

  handleScroll() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.updateVisibility();
      this.ticking = false;
    });
  }

  updateVisibility() {
    if (!this.scrollContainer || !this.button) return;
    const shouldShow = this.scrollContainer.scrollTop > this.threshold;
    if (shouldShow === this.visible) return;
    this.visible = shouldShow;
    this.button.classList.toggle('is-visible', shouldShow);
  }

  handleClick() {
    if (!this.scrollContainer) return;
    const prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scrollContainer.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth'
    });
  }
}

const backToTopButton = new BackToTopButton();
export default backToTopButton;
