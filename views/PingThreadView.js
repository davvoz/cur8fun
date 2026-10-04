import View from './View.js';
import router from '../utils/Router.js';
import pingsService from '../services/PingsService.js';
import VoteController from '../controllers/VoteController.js';
import PingComposer from '../components/pings/PingComposer.js';
import { createPingCard, createPingSkeletons, getPingUrl } from '../components/pings/PingCard.js';
import { createPingsLayout } from '../components/pings/PingsSidebar.js';
import { PINGS_CONFIG } from '../config/pings.js';
import { fadeIn } from '../utils/animateResize.js';

/**
 * A single ping with its replies. Direct replies are listed oldest first;
 * deeper replies are flattened under each direct reply, Twitter-style.
 */
class PingThreadView extends View {
  constructor(params = {}) {
    super(params);
    this.author = params.author;
    this.permlink = params.permlink;
    this.voteController = new VoteController(this);
  }

  async render(element) {
    this.element = element;
    document.title = `Ping by @${this.author} | cur8.fun`;
    while (element.firstChild) element.removeChild(element.firstChild);

    const page = document.createElement('div');
    page.className = 'pings-page pings-thread-page';
    page.appendChild(this.createTopBar());

    const content = document.createElement('div');
    content.className = 'pings-thread';
    // A placeholder ping, shown only if loading is slow
    const loading = document.createElement('div');
    loading.className = 'pings-status pings-status--loading pings-status--skeleton';
    loading.append(...createPingSkeletons(1, { focused: true }));
    content.replaceChildren(loading);
    page.appendChild(content);
    element.appendChild(createPingsLayout(page));

    let root;
    try {
      root = await pingsService.getThread(this.author, this.permlink);
    } catch (error) {
      console.error('Failed to load ping thread:', error);
    }
    if (this.element !== element || !element.contains(page)) return; // navigated away

    content.innerHTML = '';
    // The ping and its replies replace the loading text with a fade
    fadeIn(content);
    if (!root) {
      content.innerHTML = '<div class="pings-status pings-status--error">This ping could not be found.</div>';
      return;
    }

    // Replies to replies: link back to the parent conversation
    if (root.parentAuthor && root.parentAuthor !== PINGS_CONFIG.wallAccount) {
      const parentLink = document.createElement('a');
      parentLink.className = 'pings-parent-link';
      parentLink.href = getPingUrl({ author: root.parentAuthor, permlink: root.parentPermlink });
      parentLink.innerHTML = '<span class="material-icons">subdirectory_arrow_left</span>';
      parentLink.append(`Show the conversation with @${root.parentAuthor}`);
      content.appendChild(parentLink);
    }

    content.appendChild(createPingCard(root, {
      voteController: this.voteController,
      focused: true,
      onDeleted: () => router.navigate(PINGS_CONFIG.path, {}, true)
    }));

    const composer = new PingComposer({
      placeholder: 'Post your reply',
      submitLabel: 'Reply',
      guestText: 'Log in to reply.',
      onSubmit: async ({ text, images }) => {
        const reply = await pingsService.reply({
          parentAuthor: root.author,
          parentPermlink: root.permlink,
          text,
          images
        });
        this.repliesList.appendChild(this.createReplyGroup(reply));
        this.repliesEmpty?.remove();
        this.bumpReplyCount(content);
        this.emit('notification', { type: 'success', message: 'Reply sent!' });
      }
    });
    const composerEl = composer.render();
    composerEl.classList.add('ping-composer--reply');
    content.appendChild(composerEl);

    this.repliesList = document.createElement('div');
    this.repliesList.className = 'pings-replies';
    content.appendChild(this.repliesList);

    if (root.replies.length === 0) {
      this.repliesEmpty = document.createElement('div');
      this.repliesEmpty.className = 'pings-status pings-status--empty';
      this.repliesEmpty.textContent = 'No replies yet.';
      this.repliesList.appendChild(this.repliesEmpty);
    } else {
      root.replies.forEach(reply => this.repliesList.appendChild(this.createReplyGroup(reply)));
    }
  }

  createTopBar() {
    const bar = document.createElement('div');
    bar.className = 'pings-topbar';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'ping-icon-btn';
    back.title = 'Back';
    back.innerHTML = '<span class="material-icons">arrow_back</span>';
    back.addEventListener('click', () => {
      if (router.navigationHistory.length > 1) router.goBack();
      else router.navigate(PINGS_CONFIG.path);
    });

    const title = document.createElement('h1');
    title.className = 'pings-title';
    title.textContent = 'Ping';

    bar.append(back, title);
    return bar;
  }

  /**
   * A direct reply followed by all of its descendants in chronological order.
   */
  createReplyGroup(reply) {
    const group = document.createElement('div');
    group.className = 'ping-reply-group';
    group.appendChild(createPingCard(reply, { voteController: this.voteController }));

    const descendants = [];
    const walk = (node) => node.replies.forEach(child => {
      descendants.push({ node: child, parentAuthor: node.author });
      walk(child);
    });
    walk(reply);
    descendants.sort((a, b) => a.node.created - b.node.created);

    if (descendants.length) {
      const nested = document.createElement('div');
      nested.className = 'ping-reply-nested';
      descendants.forEach(({ node, parentAuthor }) => {
        nested.appendChild(createPingCard(node, {
          voteController: this.voteController,
          replyingTo: parentAuthor
        }));
      });
      group.appendChild(nested);
    }

    return group;
  }

  bumpReplyCount(content) {
    const focused = content.querySelector('.ping-card--focused .ping-reply-count');
    if (focused) focused.textContent = (parseInt(focused.textContent, 10) || 0) + 1;
  }

  unmount() {
    this.voteController.cleanup();
    super.unmount();
  }
}

export default PingThreadView;
