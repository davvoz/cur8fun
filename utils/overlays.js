/**
 * Dialogs and popups opened over the page (on <body>) register here how to
 * close themselves. Two things follow:
 *
 * - The back button closes them, like in a native app: each open dialog has
 *   a history entry of its own (same URL), and going back from it closes the
 *   dialog instead of leaving the page. Closing it any other way (its X,
 *   Escape, a tap outside) drops that entry again.
 * - Leaving the page (a link, or a link inside the dialog) closes them
 *   instead of leaving them on screen over the next one: the router calls
 *   closeOverlays(), and the new page takes the place of the dialog's
 *   history entry (see isOverlayHistoryEntry).
 *
 * Prompts that guard an operation in progress (PIN, active key) and app-wide
 * notices (cookies, updates, toasts) are not registered.
 */

const stack = []; // open dialogs, the most recent last: { el, close, id }
let nextId = 1;
let ignoredPops = 0; // history.back() calls made here to drop an entry
let waiting = [];    // navigations waiting for those to complete
let settleTimer = null;

const isOpen = (el) => el.isConnected && getComputedStyle(el).display !== 'none';

/**
 * @param {HTMLElement} el - The dialog's root element: it counts as closed
 *   once it leaves the document (or when overlayClosed(el) is called)
 * @param {Function} close - Closes it the way its own close button does
 *   (cleanup, and a "cancel" answer for dialogs waiting for one)
 */
export function trackOverlay(el, close) {
  const entry = { el, close, id: nextId++ };
  stack.push(entry);
  history.pushState({ ...(history.state || {}), overlay: entry.id }, '', window.location.href);
}

/**
 * For dialogs that are hidden instead of removed: they call this when they
 * close, so their history entry is dropped.
 */
export function overlayClosed(el) {
  const entry = stack.find(item => item.el === el);
  if (entry) forget(entry);
}

/** Whether the current history entry is one of an open dialog. */
export function isOverlayHistoryEntry() {
  return !!history.state?.overlay;
}

/**
 * Runs `fn` once a dialog that just closed has dropped its history entry
 * (history.back() is asynchronous); right away if none is pending. A
 * navigation made meanwhile would otherwise mix up the history.
 * @returns {boolean} true if `fn` was deferred
 */
export function afterOverlayHistory(fn) {
  if (ignoredPops === 0) return false;
  waiting.push(fn);
  return true;
}

function settle() {
  clearTimeout(settleTimer);
  settleTimer = null;
  const run = waiting;
  waiting = [];
  run.forEach(fn => fn());
}

/** Closes every open dialog (the router calls it when leaving the page). */
export function closeOverlays() {
  stack.splice(0).forEach(entry => {
    if (!isOpen(entry.el)) return;
    try {
      entry.close();
    } catch (error) {
      console.warn('Could not close a dialog:', error);
    }
  });
}

// Closed by its own controls: drop its history entry, unless the browser is
// no longer on it (then going back simply lands on the page it was open on)
function forget(entry) {
  const index = stack.indexOf(entry);
  if (index === -1) return;
  stack.splice(index, 1);
  if (history.state?.overlay === entry.id) {
    ignoredPops++;
    history.back();
    // Safety net, should the browser not report the traversal
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { ignoredPops = 0; settle(); }, 500);
  }
}

// Registered before the router's own listener (this module is imported by
// it), so a back that closes a dialog never reaches the router
window.addEventListener('popstate', (event) => {
  if (ignoredPops > 0) {
    ignoredPops--;
    event.stopImmediatePropagation();
    if (ignoredPops === 0) settle();
    return;
  }
  const top = [...stack].reverse().find(entry => isOpen(entry.el));
  if (!top) return;
  event.stopImmediatePropagation();
  stack.splice(stack.indexOf(top), 1); // its entry was just left by the browser
  try {
    top.close();
  } catch (error) {
    console.warn('Could not close a dialog:', error);
  }
});

// Dialogs closed by removing them from <body>
new MutationObserver(() => {
  stack.filter(entry => !entry.el.isConnected).forEach(forget);
}).observe(document.body, { childList: true });
