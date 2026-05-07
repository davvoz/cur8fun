/**
 * Utilities for Steemit image URL handling.
 *
 * steemitimages.com /p/<base58(url)> proxy use cases:
 *   1. steemitimages.com CDN content — new required format since the legacy /{w}x{h}/ was disabled
 *   2. http:// URLs on an https:// page (mixed content upgrade)
 *   3. Fallback for any URL that fails to load directly (hotlink protection, etc.)
 *
 * All other public images (imgur, ecency, hive, IPFS, etc.) are served directly —
 * faster, no extra hop, no dependency on steemitimages.com availability.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a string using base58 (Bitcoin/Steemit alphabet).
 */
export function base58Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }
  let result = '';
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result;
    num = num / 58n;
  }
  for (const byte of bytes) {
    if (byte === 0) result = '1' + result;
    else break;
  }
  return result || '1';
}

/**
 * Returns the proxied URL via steemitimages.com for cases where direct loading fails
 * or is not appropriate (mixed content, steemitimages CDN new format).
 * This is NOT called for all URLs — use it as a fallback after direct loading fails.
 * @param {string} url
 * @param {number} [width=640]
 * @returns {string}
 */
export function proxifyImage(url, width = 640) {
  if (!url) return '';

  // Already proxied or avatar — return as-is
  if (url.includes('steemitimages.com/p/') || url.includes('steemitimages.com/u/')) {
    return url;
  }
  if (url.startsWith('data:')) return url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `https://steemitimages.com/p/${base58Encode(url)}?mode=fit&format=match&width=${width}`;
  }

  return url;
}

/**
 * Returns the best initial URL for an image — direct for most hosts,
 * proxied immediately only for steemitimages.com CDN (which requires the new /p/ format)
 * and http:// URLs (mixed content).
 * @param {string} url
 * @param {number} [width=640]
 * @returns {string}
 */
export function getImageUrl(url, width = 640) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('steemitimages.com/p/') || url.includes('steemitimages.com/u/')) return url;

  // steemitimages.com CDN content (not already /p/ or /u/) must use new proxy format
  if (/steemitimages\.com/i.test(url)) {
    return proxifyImage(url, width);
  }

  // http:// on an https page = mixed content — upgrade via proxy
  if (url.startsWith('http://')) {
    return proxifyImage(url, width);
  }

  // Everything else: serve directly (imgur, ecency, hive, IPFS, postimg, etc.)
  return url;
}
