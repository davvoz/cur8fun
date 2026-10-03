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
  if (!el || !el.isConnected || prefersReducedMotion()) return;
  const style = getComputedStyle(el);
  const full = {};
  ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(key => { full[key] = style[key]; });
  const collapsed = { marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' };
  const height = el.offsetHeight;
  el.animate([
    { ...collapsed, height: '0px', opacity: 0, overflow: 'hidden' },
    { ...full, height: `${height}px`, opacity: 1, overflow: 'hidden' }
  ], { duration: duration ?? durationFor(height), easing: EASING });
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
