/**
 * Safety net for user avatars (steemitimages.com/u/<name>/avatar...).
 *
 * The avatar service fails for some accounts (e.g. it refuses to proxy
 * their profile_image) and answers with an error instead of a picture: the
 * browser then shows the alt text next to a broken image icon. Avatars are
 * created in many places, so failures are caught once for the whole page:
 * the account's profile image is loaded directly instead, and the default
 * avatar if that fails too.
 */

const AVATAR_URL = /^https:\/\/steemitimages\.com\/u\/([a-z0-9.-]+)\/avatar/i;
const DEFAULT_AVATAR = '/assets/img/default-avatar.png';

// username -> Promise<profile image url | null>, fetched once per account
const profileImages = new Map();

function getProfileImage(username) {
  if (!profileImages.has(username)) {
    profileImages.set(username, new Promise(resolve => {
      if (!window.steem?.api) return resolve(null);
      window.steem.api.getAccounts([username], (err, accounts) => {
        const account = !err && accounts?.[0];
        if (!account) return resolve(null);
        for (const raw of [account.posting_json_metadata, account.json_metadata]) {
          try {
            const url = JSON.parse(raw)?.profile?.profile_image;
            if (typeof url === 'string' && url.startsWith('https://')) return resolve(url);
          } catch { /* not JSON */ }
        }
        resolve(null);
      });
    }));
  }
  return profileImages.get(username);
}

async function onImageError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  const failed = img.src;
  const match = AVATAR_URL.exec(failed);
  // The profile image set here failed too
  const profileFailed = !match && img.dataset.avatarFallback === failed;
  if (!match && !profileFailed) return; // not an avatar: left to its own handlers

  // Handled here: the image's own error handlers (retrying other sizes of
  // the same failing service, or giving up) are skipped
  event.stopPropagation();

  if (profileFailed) {
    img.src = DEFAULT_AVATAR;
    return;
  }
  const profileImage = await getProfileImage(match[1].toLowerCase());
  if (img.src !== failed) return; // replaced meanwhile
  if (profileImage) {
    img.src = profileImage;
    img.dataset.avatarFallback = img.src; // as the browser normalised it
  } else {
    img.src = DEFAULT_AVATAR;
  }
}

// Capture phase: error events don't bubble, and this runs before the
// image's own listeners
document.addEventListener('error', onImageError, true);
