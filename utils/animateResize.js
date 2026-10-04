const running = new WeakMap();

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Starts gently: the first frames after new content is inserted are the ones
// the browser most often drops while it lays that content out
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

// Longer for longer distances, so big changes don't move hundreds of pixels
// per frame and small ones stay snappy
const durationFor = (distance) => Math.round(Math.min(480, Math.max(220, 180 + distance * 0.45)));

/**
 * Runs `update` (which changes the content of `box`) and animates `box` from
 * its previous size to the new one, so a popup or panel grows smoothly when
 * loaded data replaces its placeholder instead of jumping to the new size.
 *
 * Sizes are layout sizes (offsetWidth/Height), unaffected by transforms such
 * as a popup's opening scale. The box is expected to use border-box sizing.
 *
 * @param {HTMLElement} box - The element whose size changes
 * @param {Function} update - Synchronously replaces the content
 * @param {Object} [options]
 * @param {HTMLElement|HTMLElement[]} [options.fade] - New content to fade in
 * @param {boolean} [options.position] - Also animate `top`/`left`, for boxes
 *   that `update` repositions (e.g. a popover kept next to its anchor)
 * @param {number} [options.duration] - Default: based on how much the box changes
 */
export function resizeSmoothly(box, update, { fade = null, position = false, duration = null } = {}) {
  if (!box || !box.isConnected || prefersReducedMotion()) {
    update();
    return;
  }

  // Measured while a previous resize may still be running: the box then
  // continues from where it is now
  const measure = () => {
    const size = { width: box.offsetWidth, height: box.offsetHeight };
    if (position) {
      const style = getComputedStyle(box);
      size.top = parseFloat(style.top) || 0;
      size.left = parseFloat(style.left) || 0;
    }
    return size;
  };
  const from = measure();
  running.get(box)?.cancel();

  update();

  const to = measure();
  const changed = (key) => Math.abs(to[key] - from[key]) >= 1;
  const keys = ['width', 'height', ...(position ? ['top', 'left'] : [])].filter(changed);

  duration ??= durationFor(Math.max(0, ...keys.map(key => Math.abs(to[key] - from[key]))));

  if (keys.length) {
    const frame = (size) => {
      const props = { overflow: 'hidden' };
      keys.forEach(key => { props[key] = `${size[key]}px`; });
      return props;
    };
    const animation = box.animate([frame(from), frame(to)], { duration, easing: EASING });
    running.set(box, animation);
    animation.finished.then(() => running.delete(box), () => {});
  }

  const faded = Array.isArray(fade) ? fade : fade ? [fade] : [];
  faded.forEach(el => el?.animate?.(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: Math.min(duration, 200), easing: 'ease-out' }
  ));
}

/**
 * Animates an element that was just made visible (e.g. a banner shown once
 * data arrives) from zero height, so the content below slides down instead
 * of jumping. Vertical margins and paddings grow with it.
 *
 * @param {HTMLElement} el - The element, already visible
 * @param {Object} [options]
 * @param {number} [options.duration] - Default: based on the element's height
 */
export function revealSmoothly(el, { duration = null } = {}) {
  if (!el) return;
  // Reopened while closing: continue from the current, partly closed state
  running.get(el)?.cancel();
  if (!el.isConnected || prefersReducedMotion()) return;
  const { full, collapsed } = verticalBox(el);
  const height = el.offsetHeight;
  const animation = el.animate([
    { ...collapsed, height: '0px', opacity: 0, overflow: 'hidden' },
    { ...full, height: `${height}px`, opacity: 1, overflow: 'hidden' }
  ], { duration: duration ?? durationFor(height), easing: EASING });
  running.set(el, animation);
  animation.finished.then(() => running.delete(el), () => {});
}

const collapsing = new WeakSet();


// Vertical margins/paddings of an element, and the same set at zero
function verticalBox(el) {
  const style = getComputedStyle(el);
  const full = {};
  ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(key => { full[key] = style[key]; });
  const collapsed = { marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' };
  return { full, collapsed };
}

/**
 * The opposite of revealSmoothly: the element shrinks to nothing and fades
 * out, then gets `display: none`. Revealing it again meanwhile (with
 * revealSmoothly) cancels the collapse.
 *
 * @param {HTMLElement} el
 * @param {Object} [options]
 * @param {Function} [options.onHidden] - Called once the element is hidden
 */
export function collapseSmoothly(el, { onHidden = null, duration = null } = {}) {
  if (!el) return;
  const hide = () => {
    el.style.display = 'none';
    onHidden?.();
  };
  running.get(el)?.cancel();
  const height = el.offsetHeight;
  if (!el.isConnected || prefersReducedMotion() || height === 0) {
    hide();
    return;
  }
  const { full, collapsed } = verticalBox(el);
  const animation = el.animate([
    { ...full, height: `${height}px`, opacity: 1, overflow: 'hidden' },
    { ...collapsed, height: '0px', opacity: 0, overflow: 'hidden' }
  ], { duration: duration ?? Math.round(durationFor(height) * 0.8), easing: EASING, fill: 'forwards' });
  running.set(el, animation);
  collapsing.add(el);
  animation.finished.then(() => {
    collapsing.delete(el);
    running.delete(el);
    hide();
    animation.cancel(); // drop the held end frame now that it is hidden
  }, () => collapsing.delete(el));
}

/** Whether `el` is being hidden by collapseSmoothly (it is still displayed). */
export function isCollapsing(el) {
  return collapsing.has(el);
}

/**
 * Fades in content that replaces a placeholder (e.g. a page's skeleton).
 * Opacity only: a transform would affect the element's fixed descendants.
 */
export function fadeIn(el, { duration = 220 } = {}) {
  if (!el || prefersReducedMotion()) return;
  el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
}

// Height of each watched image at its last layout
const imageHeights = new WeakMap();
const imageObserver = typeof ResizeObserver === 'function' && new ResizeObserver(entries => {
  entries.forEach(({ target: img }) => {
    // Measured only once in the document: being inserted is not loading
    if (!img.isConnected) return;
    const height = img.offsetHeight;
    const previous = imageHeights.get(img);
    imageHeights.set(img, height);
    // Done once the image is complete and laid out at its size
    if (img.complete && img.naturalHeight > 0) imageObserver.unobserve(img);
    if (previous === undefined || height - previous < 24) return;
    // Its size is known now: animate once and stop watching, or the
    // animation's own frames would be taken for new sizes
    imageObserver.unobserve(img);
    // Called after layout but before paint: starting from the previous height
    // means the jump is never drawn
    img.animate([
      { height: `${previous}px`, opacity: 0, objectFit: 'cover' },
      { height: `${height}px`, opacity: 1, objectFit: 'cover' }
    ], { duration: durationFor(height - previous), easing: EASING });
  });
});

/**
 * Images without known dimensions get their height only when the browser
 * learns their size, pushing everything below them down in a single frame.
 * This makes the images inside `container` that are still loading grow to
 * their size (and fade in) instead, so text below them slides down.
 *
 * @param {HTMLElement} container - Content that may hold <img> elements;
 *   it may be not inserted yet (it is then watched from the next frame)
 */
export function smoothImageLoading(container, retried = false) {
  if (!container || !imageObserver || prefersReducedMotion()) return;
  if (!container.isConnected) {
    // Built before being inserted (e.g. a card): start watching once it is
    // in the document, so the first measurement is its real starting size
    if (!retried) requestAnimationFrame(() => smoothImageLoading(container, true));
    return;
  }
  const images = container.tagName === 'IMG' ? [container] : container.querySelectorAll('img');
  images.forEach(img => {
    if (img.complete && img.naturalHeight > 0) return; // already has its size
    // Decoded off the main thread, so a big image doesn't stall the frames
    // of its own growth animation
    img.decoding = 'async';
    // Starting height recorded here: an observer reports nothing for an
    // element that is still 0px tall
    imageHeights.set(img, img.offsetHeight);
    imageObserver.observe(img);
  });
}

/**
 * Animates a freshly inserted element from the height of the one it replaced
 * (e.g. a section re-rendered once its data arrives) to its own height.
 * Does nothing on a first render, when there was no previous element.
 *
 * @param {HTMLElement} el - The new element, already in the document
 * @param {number|undefined} fromHeight - offsetHeight of the replaced element
 * @param {Object} [options]
 * @param {boolean} [options.fade] - Also fade the new element in
 * @param {number} [options.duration] - Default: based on how much it grows
 */
export function growFrom(el, fromHeight, { fade = false, duration = null } = {}) {
  if (!el || !el.isConnected || typeof fromHeight !== 'number' || prefersReducedMotion()) return;
  const to = el.offsetHeight;
  if (Math.abs(to - fromHeight) < 1) return;
  duration ??= durationFor(Math.abs(to - fromHeight));
  el.animate([
    { height: `${fromHeight}px`, overflow: 'hidden' },
    { height: `${to}px`, overflow: 'hidden' }
  ], { duration, easing: EASING });
  if (fade) {
    el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: Math.min(duration, 200), easing: 'ease-out' });
  }
}

/**
 * Keeps an image invisible until it has loaded, then fades it in, instead of
 * having it appear (or paint top to bottom) at once. If loading fails it is
 * shown again right away, so fallback sources set by onerror work as before.
 *
 * @param {HTMLImageElement} img - With its src set (or about to be)
 */
export function fadeInWhenLoaded(img) {
  if (!img || prefersReducedMotion() || (img.complete && img.naturalWidth > 0)) return;
  img.style.opacity = '0';
  const done = () => {
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onError);
  };
  const onLoad = () => {
    done();
    img.style.opacity = '';
    img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
  };
  const onError = () => {
    done();
    img.style.opacity = '';
  };
  img.addEventListener('load', onLoad);
  img.addEventListener('error', onError);
}

/**
 * Sets a loaded image as the background of `el` (e.g. a cover) with a fade
 * over what it showed before, such as a gradient. Browsers don't fade a
 * background change, so the image fades in on a temporary layer first
 * (.bg-fade-layer, under the element's own overlays and content).
 *
 * @param {HTMLElement} el - A positioned element
 * @param {string} url - An image that has already loaded
 */
export function fadeInBackground(el, url) {
  if (!el) return;
  const background = `url("${url}")`;
  if (!el.isConnected || prefersReducedMotion()) {
    el.style.backgroundImage = background;
    return;
  }
  const layer = document.createElement('span');
  layer.className = 'bg-fade-layer';
  layer.style.backgroundImage = background;
  el.prepend(layer);
  layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' }).finished.then(() => {
    el.style.backgroundImage = background;
    layer.remove();
  }, () => layer.remove());
}

/**
 * Keeps a floating element (position: fixed, placed from an anchor's
 * position on screen, like a popover or a vote effect) on its anchor while
 * the page scrolls or the window resizes. `place(rect)` positions it from the
 * anchor's current rect; it runs at most once per frame. Following stops by
 * itself once either element leaves the document.
 *
 * @param {HTMLElement} el - The floating element
 * @param {HTMLElement} anchor - The element it belongs to
 * @param {Function} place - Called with the anchor's DOMRect
 * @returns {Function} stop
 */
export function followAnchor(el, anchor, place) {
  let frame = null;
  const update = () => {
    frame = null;
    if (!el.isConnected || !anchor.isConnected) {
      stop();
      return;
    }
    place(anchor.getBoundingClientRect());
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    // capture: also the scrolling of #main-content and other containers
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
  };
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  return stop;
}
