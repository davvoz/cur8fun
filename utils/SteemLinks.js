/**
 * Links to steemit.com (e.g. a post linking another post) open the same page
 * on cur8.fun instead: steemit URLs are mapped to the app's own routes.
 */

const STEEMIT_HOST = /^(www\.)?steemit\.com$/i;

// steemit.com/@user/<section>: tabs of a profile, not posts
const PROFILE_SECTIONS = new Set([
  'blog', 'posts', 'comments', 'replies', 'recent-replies', 'feed', 'transfers',
  'wallet', 'followers', 'followed', 'communities', 'notifications', 'settings',
  'permissions', 'password', 'curation-rewards', 'author-rewards', 'payout'
]);

// steemit.com/<sort>[/<tag>]
const FEEDS = {
  trending: '/trending',
  hot: '/hot',
  created: '/new',
  promoted: '/promoted'
};

/**
 * The app path for a steemit.com URL, or null when it is not one (or has no
 * equivalent here, in which case it stays an external link).
 * @param {string} href - Absolute or relative URL
 * @returns {string|null}
 */
export function toAppPath(href) {
  let url;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }
  if (!STEEMIT_HOST.test(url.hostname)) return null;

  // A link to a comment: steemit.com/<category>/@author/post#@commenter/permlink
  const anchor = url.hash.match(/^#@([a-z0-9.-]+)\/([^/?#]+)$/i);
  if (anchor) return `/@${anchor[1].toLowerCase()}/${anchor[2]}`;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/home';

  // /@user, /@user/<section>, /@user/permlink
  if (parts[0].startsWith('@')) {
    const user = parts[0].slice(1).toLowerCase();
    if (parts.length === 1 || PROFILE_SECTIONS.has(parts[1].toLowerCase())) return `/@${user}`;
    return `/@${user}/${parts[1]}`;
  }

  // /<category>/@author/permlink: a post
  if (parts.length >= 3 && parts[1].startsWith('@')) {
    return `/@${parts[1].slice(1).toLowerCase()}/${parts[2]}`;
  }

  // /trending, /trending/<tag>, /created/hive-123 (a community)
  const feed = feedPath(parts);
  if (feed) return feed;

  if (parts[0].toLowerCase() === 'communities') return '/communities';
  return null;
}

function feedPath(parts) {
  const feed = FEEDS[parts[0].toLowerCase()];
  if (!feed) return null;
  if (parts.length === 1) return feed;
  const tag = parts[1].toLowerCase();
  return /^hive-\d+$/.test(tag) ? `/community/${tag}` : `/tag/${tag}`;
}

// App routes shaped like a steemit post path (/<segment>/@author/permlink)
const APP_SECTIONS = new Set(['pings', 'edit', 'comment']);

/**
 * The Steem renderer links hashtags and posts with steemit-style relative
 * paths (/trending/<tag>, /<category>/@author/permlink) that aren't routes
 * here: their app equivalent, or null.
 */
function fromSteemitPath(path) {
  const clean = path.split(/[?#]/)[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 2) return feedPath(parts);
  if (parts.length >= 3 && parts[1].startsWith('@') && !APP_SECTIONS.has(parts[0].toLowerCase())) {
    return `/@${parts[1].slice(1).toLowerCase()}/${parts[2]}`;
  }
  return null;
}

/**
 * Points the steemit.com links inside `container` to the app, so they open
 * here (and show the app's URL on hover or when opened in a new tab).
 * @param {HTMLElement} container - Rendered content (post, comment, ping)
 */
export function rewriteSteemitLinks(container) {
  if (!container) return;
  container.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    const path = toAppPath(href) || (/^\/[^/]/.test(href) ? fromSteemitPath(href) : null);
    if (!path) return;
    link.setAttribute('href', path);
    link.removeAttribute('target');
    link.removeAttribute('rel');
  });
}
