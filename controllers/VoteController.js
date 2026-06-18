import voteService from '../services/VoteService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';

export default class VoteController {
  constructor(view) {
    this.view = view;
    this.popups = [];
  }
  
  async handlePostVote(post) {
    const upvoteBtn = this.view.element.querySelector('.upvote-btn');
    if (!upvoteBtn) return;

    // Count is a sibling inside .upvote-container, not inside the button itself
    const upvoteContainer = upvoteBtn.closest('.upvote-container');
    const countElement = upvoteContainer?.querySelector('.vote-count-btn .count')
      || upvoteBtn.querySelector('.count');

    // Check if user is logged in
    if (!this.checkLoggedIn()) return;

    // Show vote percentage selector
    this.showVotePercentagePopup(upvoteBtn, async (weight) => {
      try {
        this.setVotingState(upvoteBtn, true, weight);
        
        if (weight === 0) {
          throw new Error('Vote weight cannot be zero');
        }

        // Submit vote
        await voteService.vote({
          author: post.author,
          permlink: post.permlink,
          weight: weight
        });

        const currentCount = parseInt(countElement?.textContent) || 0;

        // Update UI — pass external countElement so it's updated in place, not added inside button
        this.setVoteSuccessState(upvoteBtn, currentCount, weight, countElement);
        

      } catch (error) {
        this.handleVoteError(error, upvoteBtn, countElement);
      }
    });
  }

  async handleCommentVote(commentParam, upvoteBtn) {
    let author, permlink;
    
    // Handle both DOM element with dataset and direct comment object
    if (commentParam && commentParam.dataset) {
      // It's a DOM element
      author = commentParam.dataset.author;
      permlink = commentParam.dataset.permlink;
    } else if (commentParam && typeof commentParam === 'object') {
      // It's a comment object
      author = commentParam.author;
      permlink = commentParam.permlink;
    } else {
      console.error('Invalid comment parameter:', commentParam);
      return;
    }

    // Check if author and permlink are available
    if (!author || !permlink) {
      console.error('Missing author or permlink:', author, permlink);
      return;
    }

    // Check if user is logged in
    if (!this.checkLoggedIn()) return;

    // Check if already voted
    try {
      const existingVote = await voteService.hasVoted(author, permlink);
      if (existingVote) {
        this.showAlreadyVotedNotification(existingVote.percent);
        return;
      }
    } catch (error) {
      // Error checking comment vote status - silently fail
    }

    // Show vote percentage selector
    this.showVotePercentagePopup(upvoteBtn, async (weight) => {
      // Count is a sibling .comment-vote-count, not inside the button
      const countElement = upvoteBtn.parentElement?.querySelector('.comment-vote-count')
        || upvoteBtn.querySelector('.count');
      const currentCount = countElement ? (parseInt(countElement.textContent) || 0) : 0;

      try {
        upvoteBtn.disabled = true;
        upvoteBtn.classList.add('voting');

        // Store the current HTML to restore if needed
        const originalButtonHtml = upvoteBtn.innerHTML;
        upvoteBtn.innerHTML = `<span class="material-icons loading">refresh</span>`;

        if (weight === 0) {
          throw new Error('Vote weight cannot be zero');
        }

        // Submit vote
        await voteService.vote({
          author,
          permlink,
          weight
        });
        
        // Update UI using the same approach as setVoteSuccessState
        upvoteBtn.classList.remove('voting');
        upvoteBtn.classList.add('voted');
        upvoteBtn.disabled = false;
        
        // Clear any existing content
        upvoteBtn.innerHTML = '';

        // Restore icon only
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = 'thumb_up_alt';
        upvoteBtn.appendChild(iconElement);

        // Update external count sibling in place
        if (countElement) {
          countElement.textContent = currentCount + 1;
        }

        // Add percentage indicator
        const percentIndicator = document.createElement('span');
        percentIndicator.className = 'vote-percent-indicator';
        const displayPercent = weight / 100;
        percentIndicator.textContent = `${displayPercent}%`;
        upvoteBtn.appendChild(percentIndicator);

        this.addSuccessAnimation(upvoteBtn);
        
        // Update the comment model if available
        if (commentParam && typeof commentParam === 'object') {
          if (!commentParam.active_votes) {
            commentParam.active_votes = [];
          }
          
          const user = authService.getCurrentUser();
          if (user) {
            // Add the user's vote to the active_votes array
            commentParam.active_votes.push({
              voter: user.username,
              percent: weight
            });
          }
        }
        
      } catch (error) {
        // Restore original button state in case of error
        upvoteBtn.disabled = false;
        upvoteBtn.classList.remove('voting');
        upvoteBtn.innerHTML = originalButtonHtml;
        
        this.handleVoteError(error, upvoteBtn, countElement);
      }
    });
  }
  
  checkLoggedIn() {
    const user = authService.getCurrentUser();
    if (!user) {
      this.view.emit('notification', {
        type: 'error',
        message: 'You need to log in to vote'
      });
      router.navigate('/login', { returnUrl: window.location.pathname + window.location.search });
      return false;
    }
    return true;
  }
  
  showAlreadyVotedNotification(percent) {
    let formattedPercent = percent;
    if (Math.abs(percent) > 100) {
      formattedPercent = percent / 100;
    }
    const notify = (this.view && typeof this.view.emit === 'function')
      ? (data) => this.view.emit('notification', data)
      : (data) => eventEmitter.emit('notification', data);
    notify({ type: 'info', message: `You already voted ${formattedPercent}% on this post` });
  }
  
  setVotingState(button, isVoting, weight) {
    if (isVoting) {
      button.disabled = true;
      button.classList.add('voting');
      button.innerHTML = `<span class="material-icons loading">refresh</span>`;
    } else {
      button.disabled = false;
      button.classList.remove('voting');
    }
  }
  
  setVoteSuccessState(button, currentCount, weight, externalCountEl = null) {
    button.disabled = false;
    button.classList.remove('voting');
    button.classList.add('voted');

    button.innerHTML = '';

    // Restore icon
    const iconElement = document.createElement('span');
    iconElement.className = 'material-icons';
    iconElement.textContent = 'thumb_up_alt';
    button.appendChild(iconElement);

    // Update count: prefer external element (sibling), else add inside button
    if (externalCountEl) {
      externalCountEl.textContent = currentCount + 1;
    } else {
      const countElement = document.createElement('span');
      countElement.className = 'count';
      countElement.textContent = currentCount + 1;
      button.appendChild(countElement);
    }

    // Percentage indicator
    const percentIndicator = document.createElement('span');
    percentIndicator.className = 'vote-percent-indicator';
    percentIndicator.textContent = `${weight / 100}%`;
    button.appendChild(percentIndicator);

    this.addSuccessAnimation(button);
    this.animatePayoutAfterVote(button, weight);
  }

  addSuccessAnimation(button) {
    button.classList.add('vote-success-animation');
    setTimeout(() => {
      button.classList.remove('vote-success-animation');
    }, 600);
    this.playVoteBurst(button);
  }
  
  handleVoteError(error, button, countElement) {
    if (error.isCancelled) {
      // Don't show error notification for cancelled votes
      // Cancelled by user - no action needed
    } else if (error.isAuthError) {
      console.error('Authentication error:', error.message);
      
      // Extract the specific reason from the error message
      let reason = 'Your login session has expired';
      
      if (error.message.includes('Posting key not available')) {
        reason = 'Your posting key is not available';
      } else if (error.message.includes('keychain')) {
        reason = 'There was an issue with Steem Keychain';
      } else if (error.message.includes('authority')) {
        reason = 'You don\'t have the required permissions';
      }
      
      // Show the auth error notification without automatic redirect
      this.view.emit('notification', {
        type: 'error',
        message: `Authentication failed: ${reason}. Please log in again to vote.`,
        duration: 5000,
        action: {
          text: 'Login',
          callback: () => {
            router.navigate('/login', { 
              returnUrl: window.location.pathname + window.location.search,
              authError: true,
              errorReason: reason
            });
          }
        }
      });
      
      // No automatic redirect timeout
    } else {
      console.error('Failed to vote:', error);
      this.view.emit('notification', {
        type: 'error',
        message: error.message || 'Failed to vote. Please try again.'
      });
    }

    // Reset button state
    button.disabled = false;
    button.classList.remove('voting');
    
    const countText = countElement?.textContent || '0';
    button.innerHTML = `
      <span class="material-icons">thumb_up</span>
      <span class="count">${countText}</span>
    `;
  }
  
  async checkVoteStatus(post) {
    if (!post || !authService.isAuthenticated()) return;

    try {
      const upvoteBtn = this.view.element.querySelector('.upvote-btn');
      if (!upvoteBtn) return;

      const vote = await voteService.hasVoted(post.author, post.permlink);

      if (vote) {
        upvoteBtn.classList.add('voted');

        const iconElement = upvoteBtn.querySelector('.material-icons');
        if (iconElement) {
          iconElement.textContent = 'thumb_up_alt';
        }

        if (vote.percent > 0) {
          // Remove any existing percentage indicator first
          const existingIndicator = upvoteBtn.querySelector('.vote-percent-indicator');
          if (existingIndicator) {
            existingIndicator.remove();
          }
          
          const percentIndicator = document.createElement('span');
          percentIndicator.className = 'vote-percent-indicator';
          
          // Make sure to properly format the percentage
          const displayPercent = Math.abs(vote.percent) > 100 
            ? (vote.percent / 100) 
            : vote.percent;
            
          percentIndicator.textContent = `${displayPercent}%`;
          upvoteBtn.appendChild(percentIndicator);
        }
      }
    } catch (error) {
      // Silently fail on vote status check error
      console.warn('Error checking vote status:', error);
    }
  }
  
  showVotePercentagePopup(targetElement, callback, defaultValue = null) {
    // Remove any existing inline bars first
    document.querySelectorAll('.vote-inline-bar').forEach(el => this._closeInlineVoteBar(el, true));

    // Start from the last percentage the user picked (remembered), unless an
    // explicit default was passed.
    const initial = (defaultValue != null) ? defaultValue : this._getLastVotePercent();

    // The bar overlays the post's action row, replacing its icons in place.
    const row = targetElement.closest('.post-actions, .post-actions-post, .comment-actions')
      || targetElement.parentElement;
    if (!row) { callback(initial * 100); return; }

    // The row must be a positioning context for the absolute bar
    if (!('votePrevPosition' in row.dataset)) {
      row.dataset.votePrevPosition = row.style.position || '';
    }
    if (getComputedStyle(row).position === 'static') {
      row.style.position = 'relative';
    }

    const bar = document.createElement('div');
    bar.className = 'vote-inline-bar';
    bar._row = row;
    bar._target = targetElement;

    // Live percentage readout
    const pctEl = document.createElement('span');
    pctEl.className = 'vote-inline-pct';
    pctEl.textContent = `${initial}%`;

    // Slider (fills the bar)
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '100';
    slider.value = String(initial);
    slider.className = 'percentage-slider';

    // Confirm thumb at the far end of the bar
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'vote-inline-confirm';
    confirmBtn.setAttribute('aria-label', 'Confirm vote');
    confirmBtn.innerHTML = '<span class="material-icons">thumb_up_alt</span>';

    bar.appendChild(pctEl);
    bar.appendChild(slider);
    bar.appendChild(confirmBtn);

    // Opaque background matching the surface behind the row, so the bar cleanly
    // covers the icons it overlaps (items to its right stay visible).
    bar.style.background = this._resolveSurfaceColor(row);

    row.appendChild(bar);
    row.classList.add('vote-inline-active');

    // Use the empty space up to — but not glued to — the payout (leaving a small
    // gap). Falls back to a comfortable width on rows without a payout (e.g.
    // comment likes).
    const rowRect = row.getBoundingClientRect();
    const payoutEl = row.querySelector('.card-payout-info, .payout-info');
    let barWidth;
    if (payoutEl) {
      barWidth = payoutEl.getBoundingClientRect().left - rowRect.left - 14;
    } else {
      barWidth = Math.min(320, rowRect.width);
    }
    if (barWidth > 60) {
      bar.style.right = 'auto';
      bar.style.width = `${barWidth}px`;
    }

    // Track for cleanup
    this.popups.push(bar);

    const setPct = (val) => {
      const v = Math.max(1, Math.min(100, parseInt(val) || 1));
      slider.value = String(v);
      pctEl.textContent = `${v}%`;
      const color = this._percentColor(v);
      pctEl.style.color = color;
      slider.style.setProperty('--fill', `${v}%`);
      // Drive the slider fill, thumb and confirm button color from the % too
      bar.style.setProperty('--vote-color', color);
    };
    setPct(initial);

    // Play the wipe-in on the next frame
    requestAnimationFrame(() => bar.classList.add('open'));

    // While dragging the value is free (full control, no jumping); the
    // magnetic snap to multiples of 5 only settles on release (change event).
    slider.addEventListener('input', () => setPct(parseInt(slider.value, 10) || 1));
    slider.addEventListener('change', () => setPct(this._magneticSnap(parseInt(slider.value, 10) || 1)));

    const onKey = (e) => {
      if (e.key === 'Escape') this._closeInlineVoteBar(bar);
    };
    document.addEventListener('keydown', onKey);
    bar._onKey = onKey;

    // Close when clicking outside the bar or the vote button
    const onOutside = (e) => {
      if (!bar.contains(e.target) && !targetElement.contains(e.target) && e.target !== targetElement) {
        this._closeInlineVoteBar(bar);
      }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 50);
    bar._onOutside = onOutside;

    confirmBtn.addEventListener('click', () => {
      const pct = parseInt(slider.value, 10);
      this._setLastVotePercent(pct);            // remember for next time
      const weight = pct * 100;                  // percentage (1-100) → weight (100-10000)
      confirmBtn.classList.add('confirming');
      setTimeout(() => this._closeInlineVoteBar(bar), 160);
      callback(weight);
    });
  }

  /**
   * Last vote percentage the user picked, persisted across sessions.
   * Defaults to 100 when nothing is stored.
   */
  _getLastVotePercent() {
    try {
      const v = parseInt(localStorage.getItem('cur8_last_vote_percent'), 10);
      if (v >= 1 && v <= 100) return v;
    } catch (e) { /* localStorage unavailable */ }
    return 100;
  }

  _setLastVotePercent(pct) {
    try {
      if (pct >= 1 && pct <= 100) {
        localStorage.setItem('cur8_last_vote_percent', String(pct));
      }
    } catch (e) { /* localStorage unavailable */ }
  }

  /**
   * Make multiples of 5 "sticky": a value within 1 of a multiple of 5 snaps to
   * it, so the user easily lands on 5/10/15/20/… while in-between values
   * (…,17,18,22,23,…) are still reachable.
   */
  _magneticSnap(v) {
    const rem = v % 5;
    let snapped = v;
    if (rem === 1) snapped = v - 1;
    else if (rem === 4) snapped = v + 1;
    return Math.max(1, Math.min(100, snapped));
  }

  /**
   * Close + cleanup for the inline vote bar: wipe it back out, fade the row's
   * icons back in, and restore the row's original position style.
   * @param {HTMLElement} bar
   * @param {boolean} immediate - skip the close animation (used when replacing)
   */
  _closeInlineVoteBar(bar, immediate = false) {
    if (!bar || bar._closing) return;
    bar._closing = true;

    if (bar._onKey) {
      document.removeEventListener('keydown', bar._onKey);
      bar._onKey = null;
    }
    if (bar._onOutside) {
      document.removeEventListener('click', bar._onOutside);
      bar._onOutside = null;
    }

    const index = this.popups.indexOf(bar);
    if (index > -1) this.popups.splice(index, 1);

    const row = bar._row;
    const restoreRow = () => {
      if (!row) return;
      // Only restore once no inline bar remains in this row
      if (!row.querySelector('.vote-inline-bar') || row.querySelector('.vote-inline-bar') === bar) {
        row.classList.remove('vote-inline-active');
        const prev = row.dataset.votePrevPosition;
        if (prev !== undefined) {
          row.style.position = prev;
          delete row.dataset.votePrevPosition;
        }
      }
    };

    const remove = () => {
      if (bar.parentNode) bar.remove();
      restoreRow();
    };

    if (immediate) {
      remove();
      return;
    }

    // Quick opacity fade-out (keeps the wipe revealed); snappier than reversing
    // the clip-path, which animated poorly / felt laggy.
    if (row) row.classList.remove('vote-inline-active');
    bar.classList.add('closing');
    bar.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 220); // fallback if transitionend doesn't fire
  }

  /**
   * Find the first opaque background color among the row's ancestors, so the
   * inline bar can match the card surface in any theme. Falls back to a var.
   */
  _resolveSurfaceColor(el) {
    try {
      let node = el;
      while (node && node !== document.body) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c;
        node = node.parentElement;
      }
    } catch (e) { /* ignore */ }
    return 'var(--background-lighter, #fff)';
  }
  
  /**
   * Continuous intensity color for a vote percentage (low → high):
   * orange → yellow → green, linearly interpolated so it morphs smoothly
   * instead of jumping between fixed colors.
   */
  _percentColor(value) {
    const v = Math.max(1, Math.min(100, value));
    const stops = [
      { p: 1,   c: [243, 156, 18] },  // orange  #f39c12
      { p: 50,  c: [241, 196, 15] },  // yellow  #f1c40f
      { p: 100, c: [46, 204, 113] }   // green   #2ecc71
    ];
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (v >= stops[i].p && v <= stops[i + 1].p) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }
    const t = (v - lo.p) / ((hi.p - lo.p) || 1);
    const mix = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${mix(lo.c[0], hi.c[0])}, ${mix(lo.c[1], hi.c[1])}, ${mix(lo.c[2], hi.c[2])})`;
  }

  updatePercentageColor(element, value) {
    element.style.color = this._percentColor(value);
  }
  
  /**
   * Spawn a celebratory burst (popping thumb + radiating particles) at the
   * center of the vote button. Purely cosmetic; fails silently.
   */
  playVoteBurst(button) {
    try {
      if (!button || typeof button.getBoundingClientRect !== 'function') return;
      const rect = button.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const layer = document.createElement('div');
      layer.className = 'vote-burst-layer';
      layer.style.left = `${cx}px`;
      layer.style.top = `${cy}px`;

      const thumb = document.createElement('span');
      thumb.className = 'vote-burst-thumb material-icons';
      thumb.textContent = 'thumb_up_alt';
      layer.appendChild(thumb);

      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('span');
        particle.className = 'vote-burst-particle';
        const angle = (Math.PI * 2 * i) / particleCount;
        const distance = 26 + Math.random() * 14;
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        layer.appendChild(particle);
      }

      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 900);
    } catch (e) {
      // cosmetic only
    }
  }

  /**
   * After a successful vote, estimate the value this vote adds and animate the
   * post's payout figure counting up, with a pulse and a floating "+$x" gain.
   * No-ops gracefully for comments (no payout element) or declined-payout posts.
   * @param {HTMLElement} voteEl - the vote button/wrapper that was clicked
   * @param {number} weight - vote weight (100-10000)
   */
  async animatePayoutAfterVote(voteEl, weight) {
    try {
      if (!voteEl || !weight) return;

      const bar = voteEl.closest('.post-actions-post, .post-actions');
      const payoutEl = bar?.querySelector('.payout-info, .card-payout-info');
      if (!payoutEl) return;                                  // e.g. comments
      if (payoutEl.classList.contains('payout-declined')) return;

      const current = parseFloat((payoutEl.textContent || '').replace(/[^0-9.]/g, '')) || 0;

      const fullValue = await voteService.getEstimatedVoteValue();
      if (!fullValue || fullValue <= 0) {
        this.pulsePayout(payoutEl);
        return;
      }

      const delta = fullValue * (weight / 10000);
      if (!(delta > 0)) {
        this.pulsePayout(payoutEl);
        return;
      }

      this.showPayoutGain(payoutEl, delta);
      this.animateCountUp(payoutEl, current, current + delta);
      this.pulsePayout(payoutEl);
    } catch (e) {
      // non-critical
    }
  }

  pulsePayout(el) {
    if (!el) return;
    el.classList.remove('payout-pulse');
    // force reflow so the animation can replay
    void el.offsetWidth;
    el.classList.add('payout-pulse');
    setTimeout(() => el.classList.remove('payout-pulse'), 800);
  }

  showPayoutGain(el, delta) {
    try {
      const rect = el.getBoundingClientRect();
      const gain = document.createElement('div');
      gain.className = 'payout-gain';
      gain.textContent = `+$${delta < 0.01 ? delta.toFixed(3) : delta.toFixed(2)}`;
      gain.style.left = `${rect.left + rect.width / 2}px`;
      gain.style.top = `${rect.top - 6}px`;
      document.body.appendChild(gain);
      setTimeout(() => gain.remove(), 1200);
    } catch (e) {
      // cosmetic only
    }
  }

  animateCountUp(el, from, to, duration = 900) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = from + (to - from) * eased;
      el.textContent = `$${value.toFixed(2)}`;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `$${to.toFixed(2)}`;
      }
    };
    requestAnimationFrame(step);
  }

  cleanup() {
    // Close any open inline vote bars (restores their host rows)
    [...this.popups].forEach(el => {
      if (el && el.classList && el.classList.contains('vote-inline-bar')) {
        this._closeInlineVoteBar(el, true);
      } else if (el && el.parentNode) {
        el.remove();
      }
    });
    this.popups = [];
  }
}
