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
      // Error checking comment vote status - silently fail
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
        
        // Update UI using the same approach as setVoteSuccessState
        upvoteBtn.classList.remove('voting');
        upvoteBtn.classList.add('voted');
        upvoteBtn.disabled = false;
        
        // Clear any existing content
        upvoteBtn.innerHTML = '';
        
        // Add icon
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = 'thumb_up_alt';
        upvoteBtn.appendChild(iconElement);
        
        // Add count
        const newCountElement = document.createElement('span');
        newCountElement.className = 'count';
        newCountElement.textContent = currentCount + 1;
        upvoteBtn.appendChild(newCountElement);
        
        // Add percentage indicator with proper formatting
        const percentIndicator = document.createElement('span');
        percentIndicator.className = 'vote-percent-indicator';
        const displayPercent = weight / 100;
        percentIndicator.textContent = `${displayPercent}%`;
        upvoteBtn.appendChild(percentIndicator);
        
        this.addSuccessAnimation(upvoteBtn);
        
        // Show success notification
        this.view.emit('notification', {
          type: 'success',
          message: `Your ${displayPercent}% vote on this comment was recorded successfully!`
        });
        
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
    // Il valore percent può arrivare direttamente dall'API ed essere già in scala -10000 a +10000
    // Assicuriamoci di formattarlo correttamente
    let formattedPercent = percent;
    if (Math.abs(percent) > 100) {
      // Se percent è in scala -10000 a +10000, dividiamo per 100
      formattedPercent = percent / 100;
    }


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

    // Clear any existing content first
    button.innerHTML = '';
    
    // Add icon
    const iconElement = document.createElement('span');
    iconElement.className = 'material-icons';
    iconElement.textContent = 'thumb_up_alt';
    button.appendChild(iconElement);
    
    // Add count
    const countElement = document.createElement('span');
    countElement.className = 'count';
    countElement.textContent = currentCount + 1;
    button.appendChild(countElement);
    
    // Add percentage indicator with proper formatting
    const percentIndicator = document.createElement('span');
    percentIndicator.className = 'vote-percent-indicator';
    
    // Ensure the percentage is displayed correctly
    const displayPercent = weight / 100;
    percentIndicator.textContent = `${displayPercent}%`;
    
    button.appendChild(percentIndicator);

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
  
  showVotePercentagePopup(targetElement, callback, defaultValue = 100) {
    // Remove existing popups
    const existingPopup = document.querySelector('.vote-percentage-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'vote-percentage-popup';
    
    // Create popup header
    const popupHeader = document.createElement('div');
    popupHeader.className = 'popup-header';
    popupHeader.textContent = 'Select Vote Percentage';
    popup.appendChild(popupHeader);
    
    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'popup-content';
    
    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    // Create slider input
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '100';
    slider.value = defaultValue.toString();
    slider.className = 'percentage-slider';
    sliderContainer.appendChild(slider);
    
    // Create percentage display
    const percentageDisplay = document.createElement('div');
    percentageDisplay.className = 'percentage-display';
    percentageDisplay.textContent = `${defaultValue}%`;
    sliderContainer.appendChild(percentageDisplay);
    
    // Create slider labels
    const sliderLabels = document.createElement('div');
    sliderLabels.className = 'slider-labels';
    
    const minLabel = document.createElement('span');
    minLabel.textContent = '1%';
    sliderLabels.appendChild(minLabel);
    
    const maxLabel = document.createElement('span');
    maxLabel.textContent = '100%';
    sliderLabels.appendChild(maxLabel);
    
    sliderContainer.appendChild(sliderLabels);
    popupContent.appendChild(sliderContainer);
    
    // Create popup actions
    const popupActions = document.createElement('div');
    popupActions.className = 'popup-actions';
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = 'Cancel';
    popupActions.appendChild(cancelBtn);
    
    // Create confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-btn';
    confirmBtn.textContent = 'Vote';
    popupActions.appendChild(confirmBtn);
    
    popupContent.appendChild(popupActions);
    popup.appendChild(popupContent);

    // Add to DOM
    document.body.appendChild(popup);
    
    // Track this popup for cleanup
    this.popups.push(popup);

    // Position the popup
    this.positionPopup(popup, targetElement);

    // Setup event handlers
    slider.addEventListener('input', () => {
      const value = slider.value;
      percentageDisplay.textContent = `${value}%`;
      this.updatePercentageColor(percentageDisplay, value);
    });

    cancelBtn.addEventListener('click', () => {
      popup.remove();
      const index = this.popups.indexOf(popup);
      if (index > -1) this.popups.splice(index, 1);
    });

    confirmBtn.addEventListener('click', () => {
      // Converte il valore percentuale (0-100) in peso di voto (0-10000)
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
