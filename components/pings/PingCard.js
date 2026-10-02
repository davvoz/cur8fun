import router from '../../utils/Router.js';
import eventEmitter from '../../utils/EventEmitter.js';
import { getImageUrl, proxifyImage } from '../../utils/ImageUtils.js';
import pingsService from '../../services/PingsService.js';
import voteService from '../../services/VoteService.js';
import authService from '../../services/AuthService.js';
import VotesPopup from '../post/VotesPopup.js';
import PayoutInfoPopup from '../post/PayoutInfoPopup.js';
import { applyDeclinedPayoutStyle } from '../../utils/PayoutUtils.js';
import DialogUtility from '../DialogUtility.js';
import PingComposer from './PingComposer.js';
import { PINGS_CONFIG } from '../../config/pings.js';

const IMG_MARKDOWN_RE = /!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/g;
const IMG_HTML_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const IMG_URL_RE = /https?:\/\/[^\s<>"')]+?\.(?:jpe?g|png|gif|webp)(?:\?[^\s<>"')]*)?(?=[\s)]|$)/gi;

// One pass over the text: **bold** | *italic* | markdown link | bare URL | @mention | #hashtag
const TOKEN_RE = /\*\*(?<bold>[^*\n]+?)\*\*|(?<![\w*])\*(?<italic>[^*\s](?:[^*\n]*?[^*\s])?)\*(?![\w*])|\[(?<mdLabel>[^\]]+)\]\((?<mdUrl>https?:\/\/[^\s)]+)\)|(?<url>https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])|(?<mentionPrefix>^|[^\w/@])@(?<mention>[a-z][a-z0-9.-]{1,14}[a-z0-9])|(?<tagPrefix>^|[^\w&/])#(?<tag>[a-z0-9][a-z0-9-]{0,23})/gi;

/**
 * Splits a ping body into text and the images it contains.
 * Pings are rendered as text with a few inline marks (bold, italic, links),
 * so content coming from other Steem apps is reduced to that plus a media grid.
 */
export function parsePingBody(body) {
  const images = [];
  const collect = (_, url) => {
    if (/^https?:\/\//i.test(url) && !images.includes(url)) images.push(url);
    return '';
  };

  const text = (body || '')
    .replace(IMG_MARKDOWN_RE, collect)
    .replace(IMG_HTML_RE, collect)
    .replace(IMG_URL_RE, (url) => collect(null, url))
    .replace(/<[^>]+>/g, '')
    // Markdown from other apps: drop headings, keep bold in the ** form we render
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/__(.+?)__/g, '**$1**')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, images };
}

/**
 * Builds the text node tree for a ping: links, mentions and hashtags are
 * created as DOM nodes, so the body is never injected as HTML.
 */
export function renderPingText(text) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const { bold, italic, mdLabel, mdUrl, url, mentionPrefix, mention, tagPrefix, tag } = match.groups;
    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    lastIndex = match.index + match[0].length;

    if (bold || italic) {
      // Inner text can still hold links, mentions and hashtags
      const mark = document.createElement(bold ? 'strong' : 'em');
      mark.appendChild(renderPingText(bold || italic));
      fragment.appendChild(mark);
    } else if (mdUrl) {
      fragment.appendChild(createExternalLink(mdUrl, mdLabel));
    } else if (url) {
      fragment.appendChild(createExternalLink(url, shortenUrl(url)));
    } else if (mention) {
      fragment.appendChild(document.createTextNode(mentionPrefix));
      const link = document.createElement('a');
      link.className = 'ping-mention';
      link.href = `/@${mention.toLowerCase()}`;
      link.textContent = `@${mention}`;
      fragment.appendChild(link);
    } else if (tag) {
      fragment.appendChild(document.createTextNode(tagPrefix));
      const link = document.createElement('a');
      link.className = 'ping-hashtag';
      link.href = getTagUrl(tag);
      link.textContent = `#${tag}`;
      fragment.appendChild(link);
    }
  }

  fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  return fragment;
}

export function getTagUrl(tag) {
  return `${PINGS_CONFIG.path}/tag/${encodeURIComponent(tag.toLowerCase())}`;
}

export function getPingUrl(ping) {
  return `${PINGS_CONFIG.path}/@${ping.author}/${ping.permlink}`;
}

export function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Creates a ping card.
 * @param {Object} ping - Normalized ping from PingsService
 * @param {Object} options
 * @param {VoteController} options.voteController - Handles upvotes
 * @param {boolean} [options.focused] - Large variant used as thread root
 * @param {string} [options.replyingTo] - Shows "Replying to @user"
 * @param {Function} [options.onDeleted] - Called after the user deletes the ping;
 *   by default the card is removed
 * @returns {HTMLElement}
 */
export function createPingCard(ping, options = {}) {
  const { voteController, focused = false, replyingTo = null } = options;
  const card = document.createElement('article');
  card.className = `ping-card${focused ? ' ping-card--focused' : ''}`;
  card.dataset.author = ping.author;
  card.dataset.permlink = ping.permlink;

  const avatarLink = document.createElement('a');
  avatarLink.className = 'ping-avatar';
  avatarLink.href = `/@${ping.author}`;
  const avatar = document.createElement('img');
  avatar.src = `https://steemitimages.com/u/${ping.author}/avatar/small`;
  avatar.alt = ping.author;
  avatar.loading = 'lazy';
  avatar.onerror = function () {
    this.onerror = null;
    this.src = '/assets/img/default-avatar.png';
  };
  avatarLink.appendChild(avatar);

  const main = document.createElement('div');
  main.className = 'ping-main';
  const header = createHeader(ping, focused);
  if (pingsService.isOwn(ping)) {
    header.appendChild(createOwnerMenu(ping, card, options));
  }
  main.appendChild(header);

  if (replyingTo) {
    const replying = document.createElement('div');
    replying.className = 'ping-replying-to';
    replying.append('Replying to ');
    const link = document.createElement('a');
    link.href = `/@${replyingTo}`;
    link.textContent = `@${replyingTo}`;
    replying.appendChild(link);
    main.appendChild(replying);
  }

  main.appendChild(createContent(ping));
  main.appendChild(createActions(ping, voteController));

  card.appendChild(avatarLink);
  card.appendChild(main);

  // The whole card opens the thread, except interactive children
  if (!focused) {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, textarea, .vote-inline-bar, .ping-composer')) return;
      if (window.getSelection()?.toString()) return;
      router.navigate(getPingUrl(ping));
    });
  }

  return card;
}

// Text + media, swapped for an inline editor while editing
function createContent(ping) {
  const content = document.createElement('div');
  content.className = 'ping-content';

  const { text, images } = parsePingBody(ping.body);
  if (text) {
    const textEl = document.createElement('div');
    textEl.className = 'ping-text';
    textEl.appendChild(renderPingText(text));
    content.appendChild(textEl);
  }
  if (images.length) {
    content.appendChild(createMediaGrid(images));
  }
  return content;
}

function createOwnerMenu(ping, card, options) {
  const wrap = document.createElement('div');
  wrap.className = 'ping-menu-wrap';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ping-icon-btn ping-menu-btn';
  toggle.title = 'More';
  toggle.innerHTML = '<span class="material-icons">more_horiz</span>';

  const menu = document.createElement('div');
  menu.className = 'ping-menu';
  menu.hidden = true;

  const close = () => {
    menu.hidden = true;
    document.removeEventListener('click', onOutsideClick, true);
  };
  const onOutsideClick = (e) => {
    if (!wrap.contains(e.target)) close();
  };

  const addItem = (icon, label, onClick, { danger = false, disabledReason = null } = {}) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `ping-menu-item${danger ? ' ping-menu-item--danger' : ''}`;
    item.innerHTML = `<span class="material-icons">${icon}</span>`;
    item.append(label);
    if (disabledReason) {
      item.disabled = true;
      item.title = disabledReason;
    }
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      onClick();
    });
    menu.appendChild(item);
  };

  addItem('edit', 'Edit', () => startEdit(ping, card));
  addItem('delete_outline', 'Delete', () => confirmDelete(ping, card, options), {
    danger: true,
    disabledReason: pingsService.canDelete(ping)
      ? null
      : 'On Steem, pings with replies or upvotes cannot be deleted'
  });

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      menu.hidden = false;
      document.addEventListener('click', onOutsideClick, true);
    } else {
      close();
    }
  });

  wrap.append(toggle, menu);
  return wrap;
}

function startEdit(ping, card) {
  const content = card.querySelector('.ping-content');
  const actions = card.querySelector('.ping-actions');
  if (!content) return;

  const { text, images } = parsePingBody(ping.body);
  let editor;
  const finish = (newContent) => {
    editor.replaceWith(newContent);
    actions.hidden = false;
  };

  const composer = new PingComposer({
    placeholder: 'Edit your ping',
    submitLabel: 'Save',
    initialText: text,
    initialImages: images.slice(0, PINGS_CONFIG.maxImages),
    showAvatar: false,
    onCancel: () => finish(content),
    onSubmit: async (data) => {
      const updated = await pingsService.editPing(ping, data);
      ping.body = updated.body;
      finish(createContent(ping));
      eventEmitter.emit('notification', { type: 'success', message: 'Ping updated' });
    }
  });

  editor = composer.render();
  editor.classList.add('ping-composer--inline');
  content.replaceWith(editor);
  actions.hidden = true;
  composer.focus();
}

async function confirmDelete(ping, card, options) {
  const confirmed = await DialogUtility.showConfirmationDialog({
    title: 'Delete ping?',
    message: 'The ping will be removed from Steem. This cannot be undone.',
    confirmText: 'Delete',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    await pingsService.deletePing(ping);
    eventEmitter.emit('notification', { type: 'success', message: 'Ping deleted' });
    if (options.onDeleted) options.onDeleted(ping, card);
    else card.remove();
  } catch (error) {
    eventEmitter.emit('notification', {
      type: 'error',
      message: error?.message || 'Failed to delete the ping'
    });
  }
}

function createHeader(ping, focused) {
  const header = document.createElement('header');
  header.className = 'ping-header';

  const author = document.createElement('a');
  author.className = 'ping-author';
  author.href = `/@${ping.author}`;
  author.textContent = `@${ping.author}`;
  header.appendChild(author);

  const dot = document.createElement('span');
  dot.className = 'ping-dot';
  dot.textContent = '·';
  header.appendChild(dot);

  const time = document.createElement('time');
  time.className = 'ping-time';
  time.dateTime = ping.created.toISOString();
  time.title = ping.created.toLocaleString('en-US');
  time.textContent = focused ? ping.created.toLocaleString('en-US', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric'
  }) : formatTimeAgo(ping.created);
  header.appendChild(time);

  return header;
}

function createMediaGrid(images) {
  const grid = document.createElement('div');
  const shown = images.slice(0, PINGS_CONFIG.maxImages);
  grid.className = `ping-media ping-media--${shown.length}`;

  shown.forEach(url => {
    const img = document.createElement('img');
    img.className = 'ping-media-item';
    img.src = getImageUrl(url, 640);
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function () {
      this.onerror = null;
      this.src = proxifyImage(url, 640);
    };
    // In the feed the image opens the ping like the rest of the card;
    // on the ping's own page it opens full screen
    img.addEventListener('click', (e) => {
      if (!img.closest('.ping-card--focused')) return;
      e.stopPropagation();
      openImageViewer(img.src);
    });
    grid.appendChild(img);
  });

  return grid;
}

function openImageViewer(src) {
  const overlay = document.createElement('div');
  overlay.className = 'ping-image-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Image');

  const img = document.createElement('img');
  img.src = src;
  img.alt = '';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ping-image-viewer-close';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = '<span class="material-icons">close</span>';

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  overlay.append(img, closeBtn);
  document.body.appendChild(overlay);
}

function createActions(ping, voteController) {
  // Same markup as the post cards (BasePostView.createPostActions), so pings
  // share their look, the vote bar and the votes/payout popups
  const actions = document.createElement('div');
  actions.className = 'post-actions ping-actions';

  // Vote: thumb votes, count opens the voters list
  const voteContainer = document.createElement('div');
  voteContainer.className = 'card-vote-container';

  const voteWrapper = document.createElement('div');
  voteWrapper.className = 'action-item card-vote-wrapper vote-action';
  voteWrapper.title = 'Upvote';
  voteWrapper.innerHTML = '<span class="material-icons">thumb_up</span>';
  if (pingsService.hasVoted(ping)) voteWrapper.classList.add('voted');

  const voteCount = document.createElement('span');
  voteCount.className = 'card-vote-count';
  voteCount.title = 'Show voters';
  voteCount.textContent = ping.votes.length;
  voteCount.addEventListener('click', (e) => {
    e.stopPropagation();
    new VotesPopup(pingsService.toSteemPost(ping)).show();
  });

  if (authService.getCurrentUser()) voteWrapper.classList.add('interactive');
  voteWrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!authService.getCurrentUser()) {
      eventEmitter.emit('notification', { type: 'info', message: 'You must be logged in to vote' });
      return;
    }
    if (voteController) handlePingVote(ping, voteWrapper, voteCount, voteController);
  });

  voteContainer.append(voteWrapper, voteCount);

  // Replies: opens the thread
  const commentAction = document.createElement('a');
  commentAction.className = 'action-item comment-action';
  commentAction.href = getPingUrl(ping);
  commentAction.title = 'Reply';
  commentAction.innerHTML = '<span class="material-icons">chat</span>';
  const replyCount = document.createElement('span');
  replyCount.className = 'ping-reply-count';
  replyCount.textContent = ping.children;
  commentAction.appendChild(replyCount);

  // Share
  const shareAction = document.createElement('div');
  shareAction.className = 'action-item interactive ping-share-action';
  shareAction.title = 'Share';
  shareAction.innerHTML = '<span class="material-icons">share</span>';
  shareAction.addEventListener('click', (e) => {
    e.stopPropagation();
    sharePing(ping);
  });

  // Payout: opens the payout breakdown
  const steemPost = pingsService.toSteemPost(ping);
  const payout = document.createElement('div');
  payout.className = 'action-item card-payout-info';
  payout.textContent = `$${ping.payout.toFixed(2)}`;
  payout.addEventListener('click', (e) => {
    e.stopPropagation();
    new PayoutInfoPopup(pingsService.toSteemPost(ping)).show(payout);
  });
  applyDeclinedPayoutStyle(payout, steemPost);

  actions.append(voteContainer, commentAction, shareAction, payout);
  return actions;
}

/**
 * Same flow as BasePostView.handleVoteAction: percentage bar, broadcast,
 * voted state and animated payout.
 */
async function handlePingVote(ping, wrapper, countEl, voteController) {
  if (wrapper.classList.contains('disabled')) return;

  if (wrapper.classList.contains('voted')) {
    const vote = await voteService.hasVoted(ping.author, ping.permlink).catch(() => null);
    voteController.showAlreadyVotedNotification(vote?.percent || 0);
    return;
  }

  voteController.showVotePercentagePopup(wrapper, async (weight) => {
    const originalHTML = wrapper.innerHTML;
    try {
      if (weight === 0) throw new Error('Vote weight cannot be zero');
      wrapper.classList.add('disabled', 'voting');
      wrapper.innerHTML = '<span class="material-icons loading">refresh</span>';

      await voteService.vote({ author: ping.author, permlink: ping.permlink, weight });

      wrapper.classList.remove('voting', 'disabled');
      wrapper.classList.add('voted');
      wrapper.innerHTML = '<span class="material-icons">thumb_up_alt</span>';

      const user = authService.getCurrentUser();
      ping.votes.push({ voter: user.username, percent: weight, rshares: 1 });
      countEl.textContent = ping.votes.length;

      voteController.addSuccessAnimation(wrapper);
      voteController.animatePayoutAfterVote(wrapper, weight);
    } catch (error) {
      wrapper.classList.remove('voting', 'disabled');
      wrapper.innerHTML = originalHTML;
      if (!error?.isCancelled) {
        eventEmitter.emit('notification', {
          type: 'error',
          message: error?.message || 'Failed to vote. Please try again.'
        });
      }
    }
  });
}

async function sharePing(ping) {
  const url = `${window.location.origin}${getPingUrl(ping)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `Ping by @${ping.author}`, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    eventEmitter.emit('notification', { type: 'success', message: 'Link copied to clipboard' });
  } catch {
    eventEmitter.emit('notification', { type: 'error', message: 'Could not copy the link' });
  }
}

function createExternalLink(href, label) {
  const link = document.createElement('a');
  link.className = 'ping-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer nofollow';
  link.textContent = label;
  return link;
}

function shortenUrl(url) {
  const display = url.replace(/^https?:\/\/(www\.)?/, '');
  return display.length > 32 ? `${display.slice(0, 31)}…` : display;
}
