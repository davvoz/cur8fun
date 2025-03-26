class VotesPopup {
  constructor(post) {
    this.post = post;
    this.isMobile = window.innerWidth < 768; // Check if device is mobile
  }

  getPendingPayout(post) {
    const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
    const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
    const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
    return (pending + total + curator).toFixed(2);
  }

  show() {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'votes-popup';
    
    // Create header for popup
    const header = document.createElement('div');
    header.className = 'votes-popup-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Vote Details';
    title.style.color = 'var(--text-heading)';
    title.style.margin = 'var(--space-sm) 0';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-popup-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.backgroundColor = 'var(--background-lighter)';
    closeBtn.style.color = 'var(--text-color)';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = 'var(--radius-sm)';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = 'var(--space-xs) var(--space-sm)';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.body.removeChild(popup);
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = `1px solid var(--border-color)`;
    header.style.paddingBottom = 'var(--space-sm)';
    header.style.marginBottom = 'var(--space-md)';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'votes-popup-content';
    
    // Check if we have active votes
    if (this.post.active_votes && this.post.active_votes.length > 0) {
      // Get the total payout value
      const totalPayoutValue = this.getPendingPayout(this.post);
      
      // Calculate the sum of all vote percentages (absolute values)
      const totalVotingPower = this.post.active_votes.reduce((sum, vote) => {
        return sum + Math.abs(vote.percent);
      }, 0);
      
      const votesList = document.createElement('ul');
      votesList.className = 'votes-list';
      votesList.style.listStyle = 'none';
      votesList.style.padding = '0';
      votesList.style.margin = '0';
      
      // Sort votes by percentage (highest first)
      const sortedVotes = [...this.post.active_votes].sort((a, b) => 
        Math.abs(b.percent) - Math.abs(a.percent)
      );
      
      sortedVotes.forEach(vote => {
        const voteItem = document.createElement('li');
        voteItem.className = 'vote-item';
        voteItem.style.display = 'flex';
        voteItem.style.flexWrap = this.isMobile ? 'wrap' : 'nowrap';
        voteItem.style.justifyContent = 'space-between';
        voteItem.style.alignItems = this.isMobile ? 'flex-start' : 'center';
        voteItem.style.padding = this.isMobile ? 'var(--space-xs)' : 'var(--space-sm)';
        voteItem.style.borderBottom = `1px solid var(--border-color)`;
        voteItem.style.transition = 'var(--transition-fast)';
        
        // Calculate vote percentage (from -10000 to 10000 in Steem)
        const percentage = (vote.percent / 100).toFixed(2);
        
        // Calculate the vote value based on its proportion of the total
        let voteValue = 0;
        if (totalVotingPower > 0) {
          voteValue = (Math.abs(vote.percent) / totalVotingPower) * totalPayoutValue;
        }
        
        // Format to 3 decimal places for USD
        const formattedValue = voteValue.toFixed(3);
        
        // Create wrapper for voter avatar and name
        const voterWrapper = document.createElement('div');
        voterWrapper.style.display = 'flex';
        voterWrapper.style.alignItems = 'center';
        voterWrapper.style.flex = '1';
        voterWrapper.style.minWidth = this.isMobile ? '100%' : 'auto';
        if (this.isMobile) {
          voterWrapper.style.marginBottom = 'var(--space-xs)';
        }
        
        // Add avatar image
        const avatarWrapper = document.createElement('div');
        avatarWrapper.style.marginRight = 'var(--space-sm)';
        
        const avatar = document.createElement('img');
        avatar.className = 'voter-avatar';
        // Use the Steem avatar service (you can change this URL to match your specific avatar service)
        avatar.src = `https://steemitimages.com/u/${vote.voter}/avatar`;

        avatar.alt = `${vote.voter}'s avatar`;
        avatar.style.width = this.isMobile ? '24px' : '32px';
        avatar.style.height = this.isMobile ? '24px' : '32px';
        avatar.style.borderRadius = 'var(--radius-pill)';
        avatar.style.border = '2px solid var(--primary-color)';
        avatar.style.objectFit = 'cover';
        avatar.style.backgroundColor = 'var(--background-lighter)';
        
        // Fallback for when avatar fails to load
        avatar.onerror = function() {
          this.src = 'https://steemitimages.com/u/default/avatar';
          this.onerror = null;
        };
        
        avatarWrapper.appendChild(avatar);
        voterWrapper.appendChild(avatarWrapper);
        
        const voterName = document.createElement('span');
        voterName.className = 'voter-name';
        voterName.textContent = vote.voter;
        voterName.style.color = 'var(--primary-color)';
        voterName.style.fontWeight = 'bold';
        voterName.style.textDecoration = 'none';
        voterName.style.cursor = 'pointer';
        
        // Make username clickable to view profile (optional)
        voterName.addEventListener('click', () => {
          window.open(`https://steemit.com/@${vote.voter}`, '_blank');
        });
        
        voterName.addEventListener('mouseover', () => {
          voterName.style.textDecoration = 'underline';
        });
        
        voterName.addEventListener('mouseout', () => {
          voterName.style.textDecoration = 'none';
        });
        
        voterWrapper.appendChild(voterName);
        
        // Create wrapper for vote info (percentage and value)
        const voteInfoWrapper = document.createElement('div');
        voteInfoWrapper.style.display = 'flex';
        voteInfoWrapper.style.flexDirection = this.isMobile ? 'row' : 'column';
        voteInfoWrapper.style.alignItems = this.isMobile ? 'center' : 'flex-end';
        voteInfoWrapper.style.justifyContent = this.isMobile ? 'flex-start' : 'center';
        voteInfoWrapper.style.minWidth = this.isMobile ? 'auto' : '100px';
        voteInfoWrapper.style.marginRight = this.isMobile ? 'var(--space-md)' : '0';
        
        const votePercentage = document.createElement('span');
        votePercentage.className = 'vote-percentage';
        votePercentage.textContent = `${percentage}%`;
        votePercentage.style.color = vote.percent >= 0 ? 'var(--secondary-color)' : 'var(--text-muted)';
        voteInfoWrapper.appendChild(votePercentage);
        
        const voteValueElem = document.createElement('span');
        voteValueElem.className = 'vote-value';
        voteValueElem.textContent = `${formattedValue} USD`;
        voteValueElem.style.color = 'var(--primary-light)';
        voteValueElem.style.fontSize = '0.85em';
        if (this.isMobile) {
          voteValueElem.style.marginLeft = 'var(--space-sm)';
        }
        voteInfoWrapper.appendChild(voteValueElem);
        
        // Create wrapper for timestamp
        const timeWrapper = document.createElement('div');
        timeWrapper.style.minWidth = this.isMobile ? 'auto' : '140px';
        timeWrapper.style.textAlign = this.isMobile ? 'left' : 'right';
        timeWrapper.style.paddingLeft = this.isMobile ? '0' : 'var(--space-md)';
        if (this.isMobile) {
          timeWrapper.style.fontSize = '0.8em';
          timeWrapper.style.color = 'var(--text-muted)';
        }
        
        const voteTime = document.createElement('span');
        voteTime.className = 'vote-time';
        
        // Format date differently for mobile
        const voteDate = new Date(vote.time);
        const formattedDate = this.isMobile ? 
          this.formatDateForMobile(voteDate) : 
          voteDate.toLocaleString();
        
        voteTime.textContent = formattedDate;
        voteTime.style.color = 'var(--text-secondary)';
        voteTime.style.fontSize = this.isMobile ? '0.9em' : '0.9em';
        timeWrapper.appendChild(voteTime);
        
        // Add all elements to vote item
        voteItem.appendChild(voterWrapper);
        
        // For mobile, create a container for the info and time
        if (this.isMobile) {
          const infoTimeRow = document.createElement('div');
          infoTimeRow.style.display = 'flex';
          infoTimeRow.style.width = '100%';
          infoTimeRow.style.justifyContent = 'space-between';
          infoTimeRow.style.alignItems = 'center';
          
          infoTimeRow.appendChild(voteInfoWrapper);
          infoTimeRow.appendChild(timeWrapper);
          
          voteItem.appendChild(infoTimeRow);
        } else {
          voteItem.appendChild(voteInfoWrapper);
          voteItem.appendChild(timeWrapper);
        }
        
        voteItem.addEventListener('mouseover', () => {
          voteItem.style.backgroundColor = 'var(--background-lighter)';
        });
        
        voteItem.addEventListener('mouseout', () => {
          voteItem.style.backgroundColor = 'transparent';
        });
        
        votesList.appendChild(voteItem);
      });
      
      // Add summary of total votes
      const summaryItem = document.createElement('li');
      summaryItem.className = 'vote-summary';
      summaryItem.style.padding = this.isMobile ? 'var(--space-sm)' : 'var(--space-md)';
      summaryItem.style.display = 'flex';
      summaryItem.style.justifyContent = 'space-between';
      summaryItem.style.borderTop = '2px solid var(--border-color)';
      summaryItem.style.marginTop = 'var(--space-sm)';
      summaryItem.style.fontWeight = 'bold';
      
      const summaryLabel = document.createElement('span');
      summaryLabel.textContent = 'Total Payout:';
      summaryLabel.style.color = 'var(--text-heading)';
      
      const summaryValue = document.createElement('span');
      summaryValue.textContent = `${totalPayoutValue} USD`;
      summaryValue.style.color = 'var(--primary-color)';
      
      summaryItem.appendChild(summaryLabel);
      summaryItem.appendChild(summaryValue);
      votesList.appendChild(summaryItem);
      
      content.appendChild(votesList);
    } else {
      const noVotes = document.createElement('p');
      noVotes.className = 'no-votes';
      noVotes.textContent = 'No votes on this post yet.';
      noVotes.style.color = 'var(--text-muted)';
      noVotes.style.textAlign = 'center';
      noVotes.style.padding = 'var(--space-md)';
      content.appendChild(noVotes);
    }
    
    // Assemble the popup
    popup.appendChild(header);
    popup.appendChild(content);
    
    // Style the popup with CSS variables - make responsive
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = 'var(--background-light)';
    popup.style.color = 'var(--text-color)';
    popup.style.padding = this.isMobile ? 'var(--space-sm)' : 'var(--space-lg)';
    popup.style.borderRadius = 'var(--radius-md)';
    popup.style.boxShadow = 'var(--popup-box-shadow)';
    popup.style.zIndex = 'var(--z-modal)';
    popup.style.maxHeight = '80vh';
    popup.style.overflow = 'auto';
    
    // Responsive width
    if (this.isMobile) {
      popup.style.width = '90%';
      popup.style.maxWidth = '100%';
      popup.style.minWidth = 'auto';
    } else {
      popup.style.minWidth = '500px';
      popup.style.maxWidth = '90%';
    }
    
    // Create and style the overlay with CSS variables
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = 'calc(var(--z-modal) - 1)';
    
    // Close popup when clicking overlay
    overlay.addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.body.removeChild(popup);
    });
    
    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
  }
  
  // New helper method to format dates on mobile
  formatDateForMobile(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    }
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays}d ago`;
    }
    
    // For older dates, show the date in short format
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
}

export default VotesPopup;
