/**
 * A post has declined its payout when its `max_accepted_payout` is set to 0.
 * Steem stores this as a string asset (e.g. "0.000 SBD" or "0.000 STEEM"),
 * so we just check the numeric prefix.
 */
export function isPayoutDeclined(post) {
  if (!post || !post.max_accepted_payout) return false;
  const amount = parseFloat(String(post.max_accepted_payout).split(' ')[0]);
  return amount === 0;
}

/**
 * Adds the `payout-declined` class + tooltip to an element when the post's
 * payout has been declined. The CSS draws a strikethrough through the value.
 */
export function applyDeclinedPayoutStyle(el, post) {
  if (!el || !isPayoutDeclined(post)) return;
  el.classList.add('payout-declined');
  if (!el.title) el.title = 'Author declined payout for this post';
}
