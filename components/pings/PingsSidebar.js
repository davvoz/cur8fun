import authService from '../../services/AuthService.js';
import profileService from '../../services/ProfileService.js';
import pingsService from '../../services/PingsService.js';
import { getImageUrl } from '../../utils/ImageUtils.js';
import { getTagUrl } from './PingCard.js';

const TRENDS_TTL_MS = 5 * 60 * 1000;

// The side columns are built once and moved into each new Pings page, so
// navigating between feed, threads and hashtags doesn't rebuild or refetch them
const columns = {
  username: undefined, // user the profile column was built for
  left: null,
  right: null,
  trendsLoadedAt: 0
};

/**
 * Wraps a Pings page in a three-column layout: profile card on the left,
 * trends on the right. The side columns only show on wide screens
 * (container queries in pings.css), the center column is the page itself.
 * @param {HTMLElement} center - The page content
 * @returns {HTMLElement}
 */
export function createPingsLayout(center) {
  const layout = document.createElement('div');
  layout.className = 'pings-layout';

  const grid = document.createElement('div');
  grid.className = 'pings-layout-grid';

  const username = authService.getCurrentUser()?.username || null;
  if (!columns.left || columns.username !== username) {
    columns.username = username;
    columns.left = createAside('left');
    fillProfileColumn(columns.left.firstChild);
  }

  if (!columns.right) {
    columns.right = createAside('right');
    initTrendsColumn(columns.right.firstChild);
  } else if (Date.now() - columns.trendsLoadedAt > TRENDS_TTL_MS) {
    loadTrends(columns.right.firstChild);
  }

  grid.append(columns.left, center, columns.right);
  layout.appendChild(grid);
  return layout;
}

function createAside(side) {
  const aside = document.createElement('aside');
  aside.className = `pings-aside pings-aside--${side}`;
  const inner = document.createElement('div');
  inner.className = 'pings-aside-inner';
  aside.appendChild(inner);
  return aside;
}

async function fillProfileColumn(column) {
  const user = authService.getCurrentUser();

  if (!user) {
    const card = createCard('pings-join-card');
    card.innerHTML = `
      <h2 class="pings-card-title">Join the conversation</h2>
      <p class="pings-card-text">Share short thoughts, photos and links with the Steem community, and earn rewards for them.</p>
      <div class="pings-join-actions">
        <a class="ping-btn ping-btn--primary" href="/login">Log in</a>
        <a class="ping-btn ping-btn--ghost" href="https://join.cur8.fun" target="_blank" rel="noopener">Create account</a>
      </div>`;
    column.appendChild(card);
    return;
  }

  const card = createCard('pings-profile-card');
  card.innerHTML = `
    <a class="pings-profile-cover" href="/@${user.username}"></a>
    <a class="pings-profile-avatar" href="/@${user.username}">
      <img src="https://steemitimages.com/u/${user.username}/avatar" alt="">
    </a>
    <div class="pings-profile-body">
      <a class="pings-profile-name" href="/@${user.username}">@${user.username}</a>
      <p class="pings-profile-about"></p>
      <div class="pings-profile-stats">
        <div><span class="pings-stat-label">Followers</span><span class="pings-stat-value" data-stat="followers">–</span></div>
        <div><span class="pings-stat-label">Following</span><span class="pings-stat-value" data-stat="following">–</span></div>
      </div>
    </div>`;
  column.appendChild(card);

  const [profile, counts] = await Promise.allSettled([
    profileService.getProfile(user.username),
    profileService.getFollowCounts(user.username)
  ]);

  if (profile.status === 'fulfilled' && profile.value) {
    const { coverImage, about } = profile.value;
    if (coverImage) {
      card.querySelector('.pings-profile-cover').style.backgroundImage = `url("${getImageUrl(coverImage, 640)}")`;
    }
    card.querySelector('.pings-profile-about').textContent = about || '';
  }
  if (counts.status === 'fulfilled') {
    card.querySelector('[data-stat="followers"]').textContent = counts.value.followers.toLocaleString('en-US');
    card.querySelector('[data-stat="following"]').textContent = counts.value.following.toLocaleString('en-US');
  }
}

function initTrendsColumn(column) {
  const trendsCard = createCard('pings-trends-card');
  trendsCard.innerHTML = `
    <h2 class="pings-card-title">What's happening</h2>
    <p class="pings-card-subtitle">Trending hashtags of the last 24 hours</p>
    <div class="pings-trends-list"><div class="pings-card-text">Loading…</div></div>`;
  column.appendChild(trendsCard);

  const authorsCard = createCard('pings-authors-card');
  authorsCard.hidden = true;
  authorsCard.innerHTML = `
    <h2 class="pings-card-title">Most active today</h2>
    <div class="pings-authors-list"></div>`;
  column.appendChild(authorsCard);

  loadTrends(column);
}

/**
 * Loads trends and swaps them in; the previous content stays visible
 * until the new data is ready.
 */
async function loadTrends(column) {
  columns.trendsLoadedAt = Date.now();
  const list = column.querySelector('.pings-trends-list');
  const authorsCard = column.querySelector('.pings-authors-card');

  let trends;
  try {
    trends = await pingsService.getTrends();
  } catch (error) {
    console.error('Failed to load ping trends:', error);
    columns.trendsLoadedAt = 0; // retry on the next page
    if (list.querySelector('.pings-trend')) return;
    list.innerHTML = '<div class="pings-card-text">Trends are not available right now.</div>';
    return;
  }

  const tagRows = trends.tags.map(([tag, count]) => {
    const row = document.createElement('a');
    row.className = 'pings-trend';
    row.href = getTagUrl(tag);
    const name = document.createElement('span');
    name.className = 'pings-trend-tag';
    name.textContent = `#${tag}`;
    const value = document.createElement('span');
    value.className = 'pings-trend-count';
    value.textContent = count;
    row.append(name, value);
    return row;
  });
  if (tagRows.length) {
    list.replaceChildren(...tagRows);
  } else {
    list.innerHTML = '<div class="pings-card-text">No hashtags yet today. Start one!</div>';
  }

  const authorRows = trends.authors.map(([author, count]) => {
    const row = document.createElement('a');
    row.className = 'pings-author-row';
    row.href = `/@${author}`;
    const avatar = document.createElement('img');
    avatar.src = `https://steemitimages.com/u/${author}/avatar/small`;
    avatar.alt = '';
    avatar.loading = 'lazy';
    const name = document.createElement('span');
    name.className = 'pings-author-name';
    name.textContent = `@${author}`;
    const value = document.createElement('span');
    value.className = 'pings-trend-count';
    value.textContent = count === 1 ? '1 ping' : `${count} pings`;
    row.append(avatar, name, value);
    return row;
  });
  authorsCard.querySelector('.pings-authors-list').replaceChildren(...authorRows);
  authorsCard.hidden = authorRows.length === 0;
}

function createCard(extraClass) {
  const card = document.createElement('section');
  card.className = `pings-side-card ${extraClass}`;
  return card;
}
