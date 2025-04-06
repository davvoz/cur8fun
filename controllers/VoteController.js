import voteService from '../services/VoteService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';

export default class VoteController {
  constructor(view) {
    this.view = view;
    this.popups = [];
  }
  
  async handlePostVote(post) {
    const upvoteBtn = this.view.element.querySelector('.upvote-btn');
    if (!upvoteBtn) return;
    
    const countElement = upvoteBtn.querySelector('.count');

    // Check if user is logged in
    if (!this.checkLoggedIn()) return;

    // Check if already voted
    try {
      const existingVote = await voteService.hasVoted(post.author, post.permlink);
      if (existingVote) {
        this.showAlreadyVotedNotification(existingVote.percent);
        return;
      }
    } catch (error) {
      console.log('Error checking vote status:', error);
    }

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
        
        // Update UI
        this.setVoteSuccessState(upvoteBtn, currentCount, weight);
        
        // Show success notification
        this.view.emit('notification', {
          type: 'success',
          message: `Your ${weight / 100}% vote was recorded successfully!`
        });
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
      console.log('Error checking comment vote status:', error);
    }

    // Show vote percentage selector
    this.showVotePercentagePopup(upvoteBtn, async (weight) => {
      // Safely get the count element
      const countElement = upvoteBtn.querySelector('.count');
      // Get current count safely, ensuring we have a default if element is not found
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
        
        // Update UI - instead of replacing all HTML, handle each element individually
        upvoteBtn.classList.add('voted');
        upvoteBtn.innerHTML = '';  // Clear the button
        
        // Re-create each element to ensure proper structure
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = 'thumb_up_alt';
        upvoteBtn.appendChild(iconElement);
        
        // Create new count element
        const newCountElement = document.createElement('span');
        newCountElement.className = 'count';
        newCountElement.textContent = (currentCount + 1);
        upvoteBtn.appendChild(newCountElement);
        
        // Add vote percentage indicator
        const percentIndicator = document.createElement('span');
        percentIndicator.className = 'vote-percent-indicator';
        percentIndicator.textContent = `${weight / 100}%`;
        upvoteBtn.appendChild(percentIndicator);
        
        this.addSuccessAnimation(upvoteBtn);
        
        // Show success notification
        this.view.emit('notification', {
          type: 'success',
          message: `Your ${weight / 100}% vote on this comment was recorded successfully!`
        });
      } catch (error) {
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
    const currentPercent = percent / 100;
    this.view.emit('notification', {
      type: 'info',
      message: `You've already voted on this item (${currentPercent}%)`
    });
  }
  
  setVotingState(button, isVoting, weight) {
    if (isVoting) {
      button.disabled = true;
      button.classList.add('voting');
      button.innerHTML = `
        <span class="material-icons loading">refresh</span>
        <span>Voting ${weight / 100}%...</span>
      `;
    } else {
      button.disabled = false;
      button.classList.remove('voting');
    }
  }
  
  setVoteSuccessState(button, currentCount, weight) {
    button.disabled = false;
    button.classList.remove('voting');
    button.classList.add('voted');

    button.innerHTML = `
      <span class="material-icons">thumb_up_alt</span>
      <span class="count">${currentCount + 1}</span>
      <span class="vote-percent-indicator">${weight / 100}%</span>
    `;

    this.addSuccessAnimation(button);
  }
  
  addSuccessAnimation(button) {
    button.classList.add('vote-success-animation');
    setTimeout(() => {
      button.classList.remove('vote-success-animation');
    }, 600);
  }
  
  handleVoteError(error, button, countElement) {
    if (error.isCancelled) {
      // Don't show error notification for cancelled votes
      console.log('Vote was cancelled by user');
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
          const percentIndicator = document.createElement('span');
          percentIndicator.className = 'vote-percent-indicator';
          percentIndicator.textContent = `${vote.percent / 100}%`;
          upvoteBtn.appendChild(percentIndicator);
        }
      }
    } catch (error) {
      console.log('Error checking vote status:', error);
    }
  }
  
  showVotePercentagePopup(targetElement, callback, defaultValue = 100) {
    // Remove existing popups
    const existingPopup = document.querySelector('.vote-percentage-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'vote-percentage-popup';
    
    popup.innerHTML = `
      <div class="popup-header">Select Vote Percentage</div>
      <div class="popup-content">
        <div class="slider-container">
          <input type="range" min="0" max="100" value="${defaultValue}" class="percentage-slider">
          <div class="percentage-display">${defaultValue}%</div>
          <div class="slider-labels">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div class="popup-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="confirm-btn">Vote</button>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(popup);
    
    // Track this popup for cleanup
    this.popups.push(popup);

    // Position the popup
    this.positionPopup(popup, targetElement);

    // Setup event handlers
    const slider = popup.querySelector('.percentage-slider');
    const percentageDisplay = popup.querySelector('.percentage-display');
    
    slider.addEventListener('input', () => {
      const value = slider.value;
      percentageDisplay.textContent = `${value}%`;
      this.updatePercentageColor(percentageDisplay, value);
    });

    popup.querySelector('.cancel-btn').addEventListener('click', () => {
      popup.remove();
      const index = this.popups.indexOf(popup);
      if (index > -1) this.popups.splice(index, 1);
    });

    popup.querySelector('.confirm-btn').addEventListener('click', () => {
      const weight = parseInt(slider.value) * 100;
      popup.remove();
      const index = this.popups.indexOf(popup);
      if (index > -1) this.popups.splice(index, 1);
      callback(weight);
    });

    // Close on outside click
    this.setupOutsideClickHandler(popup, targetElement);
  }
  
  updatePercentageColor(element, value) {
    if (value > 75) {
      element.style.color = 'var(--success-color, #28a745)';
    } else if (value > 25) {
      element.style.color = 'var(--primary-color, #ff7518)';
    } else if (value > 0) {
      element.style.color = 'var(--warning-color, #fd7e14)';
    } else {
      element.style.color = 'var(--error-color, #dc3545)';
    }
  }
  
  setupOutsideClickHandler(popup, targetElement) {
    const closeOnOutsideClick = (event) => {
      if (!popup.contains(event.target) && event.target !== targetElement) {
        popup.remove();
        const index = this.popups.indexOf(popup);
        if (index > -1) this.popups.splice(index, 1);
        document.removeEventListener('click', closeOnOutsideClick);
      }
    };

    popup.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    setTimeout(() => {
      document.addEventListener('click', closeOnOutsideClick);
    }, 100);
  }

  positionPopup(popup, targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    popup.style.position = 'fixed';

    const isMobile = window.innerWidth <= 480;

    if (isMobile) {
      popup.style.bottom = '0';
      popup.style.left = '0';
      popup.style.width = '100%';
      popup.style.borderBottomLeftRadius = '0';
      popup.style.borderBottomRightRadius = '0';
      popup.style.transform = 'translateY(0)';
    } else {
      const popupHeight = 180; // Estimated height

      if (targetRect.top > popupHeight + 10) {
        popup.style.bottom = `${window.innerHeight - targetRect.top + 5}px`;
        popup.style.left = `${targetRect.left}px`;
      } else {
        popup.style.top = `${targetRect.bottom + 5}px`;
        popup.style.left = `${targetRect.left}px`;
      }

      // Fix positioning after rendering
      setTimeout(() => {
        const popupRect = popup.getBoundingClientRect();
        
        if (popupRect.right > window.innerWidth) {
          popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
        }

        if (popupRect.bottom > window.innerHeight) {
          popup.style.top = 'auto';
          popup.style.bottom = '10px';
        }
      }, 0);
    }
  }
  
  cleanup() {
    // Close any open popups
    this.popups.forEach(popup => {
      if (popup && popup.parentNode) {
        popup.remove();
      }
    });
    this.popups = [];
  }
}
