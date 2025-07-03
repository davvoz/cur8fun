import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import eventEmitter from '../../../utils/EventEmitter.js';
import authService from '../../../services/AuthService.js';

export default class CurationTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    
    this.currentUsername = authService.getCurrentUser()?.username || '';
    this.isLoading = false;
    this.curationResults = null;
    this.targetUsername = this.currentUsername;
    this.selectedDays = 7;
    
    // Track event handlers for cleanup
    this.eventHandlers = [];
    
    // Bind methods
    this.handleCalculateClick = this.handleCalculateClick.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handleDaysChange = this.handleDaysChange.bind(this);
    this.updateResultsDisplay = this.updateResultsDisplay.bind(this);
  }
  
  render() {
    // Create tab container
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    
    // Create form card
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Curation Efficiency Analysis';
    formCard.appendChild(heading);
    
    // Add info text with icon
    const description = document.createElement('p');
    description.className = 'info-text';
    
    const infoIcon = document.createElement('span');
    infoIcon.className = 'material-icons';
    infoIcon.textContent = 'insights';
    description.appendChild(infoIcon);
    
    description.appendChild(document.createTextNode('Analyze curation rewards and calculate estimated APR based on voting history.'));
    formCard.appendChild(description);
    
    // Create controls section with proper layout
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'curation-controls';
    
    // Username input with proper styling matching other inputs
    const usernameGroup = document.createElement('div');
    usernameGroup.className = 'form-group';
    
    const usernameLabel = document.createElement('label');
    usernameLabel.htmlFor = 'curator-username';
    usernameLabel.className = 'form-label';
    usernameLabel.textContent = 'Account to analyze:';
    usernameGroup.appendChild(usernameLabel);
      const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.id = 'curator-username';
    usernameInput.className = 'form-control';
    usernameInput.value = this.currentUsername;
    usernameInput.placeholder = 'Enter Steem username';
    
    // Force lowercase input for usernames
    this.registerEventHandler(usernameInput, 'input', (e) => {
      // Store current cursor position
      const cursorPos = e.target.selectionStart;
      
      // Set the value to lowercase
      e.target.value = e.target.value.toLowerCase();
      
      // Restore cursor position
      e.target.setSelectionRange(cursorPos, cursorPos);
      
      // Call original handler to update the internal state
      this.handleUsernameChange(e);
    });
    
    usernameGroup.appendChild(usernameInput);
    
    controlsDiv.appendChild(usernameGroup);
    
    // Days selector matching other select elements
    const daysGroup = document.createElement('div');
    daysGroup.className = 'form-group';
    
    const daysLabel = document.createElement('label');
    daysLabel.htmlFor = 'analysis-days';
    daysLabel.className = 'form-label';
    daysLabel.textContent = 'Time period:';
    daysGroup.appendChild(daysLabel);
    
    // Add select wrapper for consistent styling
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'select-wrapper';
    
    const daysSelect = document.createElement('select');
    daysSelect.id = 'analysis-days';
    daysSelect.className = 'form-control';
    
    const dayOptions = [
      { value: 7, text: 'Last 7 days' },
      { value: 14, text: 'Last 14 days' },
      { value: 30, text: 'Last 30 days' }
    ];
    
    dayOptions.forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.text;
      if (option.value === this.selectedDays) {
        optionEl.selected = true;
      }
      daysSelect.appendChild(optionEl);
    });
    
    this.registerEventHandler(daysSelect, 'change', this.handleDaysChange);
    selectWrapper.appendChild(daysSelect);
    
    // Add dropdown icon for select
    const selectIcon = document.createElement('span');
    selectIcon.className = 'material-icons select-icon';
    selectIcon.textContent = 'expand_more';
    selectWrapper.appendChild(selectIcon);
    
    daysGroup.appendChild(selectWrapper);
    controlsDiv.appendChild(daysGroup);
    
    // Calculate button matching other buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'form-group button-group';
    
    const calculateBtn = document.createElement('button');
    calculateBtn.id = 'calculate-curation-btn';
    calculateBtn.className = 'btn primary-btn';
    calculateBtn.type = 'button';
    
    // Add icon to button
    const btnIcon = document.createElement('span');
    btnIcon.className = 'material-icons';
    btnIcon.textContent = 'calculate';
    calculateBtn.appendChild(btnIcon);
    
    calculateBtn.appendChild(document.createTextNode(' Calculate Efficiency'));
    
    this.registerEventHandler(calculateBtn, 'click', this.handleCalculateClick);
    buttonGroup.appendChild(calculateBtn);
    
    controlsDiv.appendChild(buttonGroup);
    formCard.appendChild(controlsDiv);
    
    // Status message container
    const statusDiv = document.createElement('div');
    statusDiv.id = 'curation-status';
    statusDiv.className = 'status-message hidden';
    formCard.appendChild(statusDiv);
    
    // Results section
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'curation-results';
    resultsDiv.className = 'curation-results hidden';
    
    // Summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'curation-summary';
    
    const summaryTitle = document.createElement('h4');
    summaryTitle.textContent = 'Summary';
    summaryDiv.appendChild(summaryTitle);
    
    // Create summary stats grid with improved styling
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    
    // Define stats with better labels and icons
    const statItems = [
      { id: 'total-votes', label: 'Total Votes', icon: 'how_to_vote' },
      { id: 'total-rewards', label: 'Total Rewards', icon: 'payments' },
      { id: 'avg-efficiency', label: 'Avg Efficiency', icon: 'trending_up' },
      { id: 'curation-apr', label: 'Est. APR', icon: 'percent' }
    ];
    
    statItems.forEach(item => {
      const statItem = document.createElement('div');
      statItem.className = 'stat-item';
      
      // Add icon to each stat
      const statIcon = document.createElement('div');
      statIcon.className = 'stat-icon';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = item.icon;
      statIcon.appendChild(icon);
      
      statItem.appendChild(statIcon);
      
      const statContent = document.createElement('div');
      statContent.className = 'stat-content';
      
      const statLabel = document.createElement('div');
      statLabel.className = 'stat-label';
      statLabel.textContent = item.label;
      statContent.appendChild(statLabel);
      
      const statValue = document.createElement('div');
      statValue.className = 'stat-value';
      statValue.id = item.id;
      statValue.textContent = '0';
      statContent.appendChild(statValue);
      
      statItem.appendChild(statContent);
      statsGrid.appendChild(statItem);
    });
    
    summaryDiv.appendChild(statsGrid);
    resultsDiv.appendChild(summaryDiv);
    
    // Results table with improved styling and headers
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    const resultsTitle = document.createElement('h4');
    resultsTitle.textContent = 'Detailed Results';
    tableContainer.appendChild(resultsTitle);
    
    // Add sort controls
    const sortControls = document.createElement('div');
    sortControls.className = 'sort-controls';
    
    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Sort by: ';
    sortControls.appendChild(sortLabel);
    
    const sortSelect = document.createElement('select');
    sortSelect.id = 'sort-curation';
    sortSelect.className = 'sort-select';
    
    const sortOptions = [
      { value: 'efficiency-desc', text: 'Efficiency (high to low)' },
      { value: 'efficiency-asc', text: 'Efficiency (low to high)' },
      { value: 'reward-desc', text: 'Reward (high to low)' },
      { value: 'reward-asc', text: 'Reward (low to high)' },
      { value: 'age-desc', text: 'Vote Age (newest first)' },
      { value: 'age-asc', text: 'Vote Age (oldest first)' }
    ];
    
    sortOptions.forEach(option => {
      const sortOption = document.createElement('option');
      sortOption.value = option.value;
      sortOption.textContent = option.text;
      sortSelect.appendChild(sortOption);
    });
    
    // Add sort handler
    this.registerEventHandler(sortSelect, 'change', () => {
      if (this.curationResults) {
        this.updateResultsDisplay(this.curationResults, sortSelect.value);
      }
    });
    
    sortControls.appendChild(sortSelect);
    tableContainer.appendChild(sortControls);
    
    // Create responsive table with hover effects
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-responsive';
    
    const table = document.createElement('table');
    table.className = 'curation-table';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Define better column headers with appropriate widths
    const headers = [
      { text: 'Post', width: '30%' },
      { text: 'Vote Time', width: '15%' },
      { text: 'Vote %', width: '10%' },
      { text: 'Reward', width: '15%' },
      { text: 'Expected', width: '15%' },
      { text: 'Efficiency', width: '15%' }
    ];
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header.text;
      th.style.width = header.width;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    tbody.id = 'curation-results-body';
    table.appendChild(tbody);
    
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);
    resultsDiv.appendChild(tableContainer);
    
    formCard.appendChild(resultsDiv);
    this.element.appendChild(formCard);
    
    this.parentElement.appendChild(this.element);
    
    // Set up event listeners for the curation calculation events
    this.setupEventListeners();
    
    // Auto-calculate for current user on initial load
    if (this.currentUsername) {
      setTimeout(() => this.handleCalculateClick(), 500);
    }
    
    return this.element;
  }
  
  setupEventListeners() {
    // Listen for calculation events - store handlers for cleanup
    
    // Handler for calculation started
    const startHandler = (data) => {
      this.isLoading = true;
      this.showStatus('Analyzing curation rewards...', 'info');
      
      const calculateBtn = this.element.querySelector('#calculate-curation-btn');
      if (calculateBtn) {
        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Analyzing...';
        
        // Replace icon with loader
        const icon = calculateBtn.querySelector('.material-icons');
        if (icon) icon.textContent = 'hourglass_top';
      }
    };
    
    // Use registerEmitterHandler if available, otherwise fall back to direct registration
    if (typeof this.registerEmitterHandler === 'function') {
      this.registerEmitterHandler(eventEmitter, 'curation:calculation-started', startHandler);
      this.registerEmitterHandler(eventEmitter, 'curation:calculation-progress', (data) => {
        this.showStatus(`Analyzed ${data.processedCount} curation rewards...`, 'info');
      });
      
      this.registerEmitterHandler(eventEmitter, 'curation:calculation-completed', (results) => {
        this.isLoading = false;
        this.curationResults = results;
        
        // Get the current sort option
        const sortSelect = this.element.querySelector('#sort-curation');
        const sortValue = sortSelect ? sortSelect.value : 'efficiency-desc';
        
        this.updateResultsDisplay(results, sortValue);
        
        const calculateBtn = this.element.querySelector('#calculate-curation-btn');
        if (calculateBtn) {
          calculateBtn.disabled = false;
          
          // Restore button text and icon
          const icon = calculateBtn.querySelector('.material-icons');
          if (icon) icon.textContent = 'calculate';
          
          // Append text node (clear first)
          while (calculateBtn.childNodes.length > 1) {
            calculateBtn.removeChild(calculateBtn.lastChild);
          }
          calculateBtn.appendChild(document.createTextNode(' Calculate Efficiency'));
        }
        
        this.hideStatus();
      });
      
      this.registerEmitterHandler(eventEmitter, 'curation:calculation-error', (data) => {
        this.isLoading = false;
        this.showStatus(data.error || 'An error occurred during calculation', 'error');
        
        const calculateBtn = this.element.querySelector('#calculate-curation-btn');
        if (calculateBtn) {
          calculateBtn.disabled = false;
          
          // Restore button text and icon
          const icon = calculateBtn.querySelector('.material-icons');
          if (icon) icon.textContent = 'calculate';
          
          // Append text node (clear first)
          while (calculateBtn.childNodes.length > 1) {
            calculateBtn.removeChild(calculateBtn.lastChild);
          }
          calculateBtn.appendChild(document.createTextNode(' Calculate Efficiency'));
        }
      });
    } else {
      // Fallback for older versions that don't have registerEmitterHandler
      eventEmitter.on('curation:calculation-started', startHandler);
      this.eventHandlers.push({ event: 'curation:calculation-started', handler: startHandler });
      
      const progressHandler = (data) => {
        this.showStatus(`Analyzed ${data.processedCount} curation rewards...`, 'info');
      };
      eventEmitter.on('curation:calculation-progress', progressHandler);
      this.eventHandlers.push({ event: 'curation:calculation-progress', handler: progressHandler });
      
      const completedHandler = (results) => {
        this.isLoading = false;
        this.curationResults = results;
        
        // Get the current sort option
        const sortSelect = this.element.querySelector('#sort-curation');
        const sortValue = sortSelect ? sortSelect.value : 'efficiency-desc';
        
        this.updateResultsDisplay(results, sortValue);
        
        const calculateBtn = this.element.querySelector('#calculate-curation-btn');
        if (calculateBtn) {
          calculateBtn.disabled = false;
          
          // Restore button text and icon
          const icon = calculateBtn.querySelector('.material-icons');
          if (icon) icon.textContent = 'calculate';
          
          // Append text node (clear first)
          while (calculateBtn.childNodes.length > 1) {
            calculateBtn.removeChild(calculateBtn.lastChild);
          }
          calculateBtn.appendChild(document.createTextNode(' Calculate Efficiency'));
        }
        
        this.hideStatus();
      };
      eventEmitter.on('curation:calculation-completed', completedHandler);
      this.eventHandlers.push({ event: 'curation:calculation-completed', handler: completedHandler });
      
      const errorHandler = (data) => {
        this.isLoading = false;
        this.showStatus(data.error || 'An error occurred during calculation', 'error');
        
        const calculateBtn = this.element.querySelector('#calculate-curation-btn');
        if (calculateBtn) {
          calculateBtn.disabled = false;
          
          // Restore button text and icon
          const icon = calculateBtn.querySelector('.material-icons');
          if (icon) icon.textContent = 'calculate';
          
          // Append text node (clear first)
          while (calculateBtn.childNodes.length > 1) {
            calculateBtn.removeChild(calculateBtn.lastChild);
          }
          calculateBtn.appendChild(document.createTextNode(' Calculate Efficiency'));
        }
      };
      eventEmitter.on('curation:calculation-error', errorHandler);
      this.eventHandlers.push({ event: 'curation:calculation-error', handler: errorHandler });
    }
  }
  
  handleUsernameChange(event) {
    // Salva il valore originale per la visualizzazione ma converti in lowercase per la ricerca
    this.targetUsername = event.target.value.trim().toLowerCase();
  }
  
  handleDaysChange(event) {
    this.selectedDays = parseInt(event.target.value, 10);
  }
  
  async handleCalculateClick() {
    if (this.isLoading) return;
    
    const username = this.targetUsername || this.element.querySelector('#curator-username').value.trim().toLowerCase();
    const days = this.selectedDays || parseInt(this.element.querySelector('#analysis-days').value, 10);
    
    if (!username) {
      this.showStatus('Please enter a valid username', 'error');
      return;
    }
    
    try {
      // Hide any previous results while loading
      const resultsDiv = this.element.querySelector('#curation-results');
      if (resultsDiv) resultsDiv.classList.add('hidden');
      
      // The actual calculation is triggered via the service
      await walletService.calculateCurationEfficiency(username, days);
    } catch (error) {
      console.error('Error calculating curation efficiency:', error);
      this.showStatus('Failed to calculate curation efficiency', 'error');
    }
  }
  
  updateResultsDisplay(results, sortBy = 'efficiency-desc') {
    if (!results) {
      this.showStatus('No results available', 'warning');
      return;
    }
    
    if (!results.success) {
      this.showStatus(results.message || 'No curation rewards found', 'warning');
      return;
    }
    
    // Update summary statistics with proper formatting
    const totalVotes = this.element.querySelector('#total-votes');
    if (totalVotes) totalVotes.textContent = results.summary.totalVotes;
    
    const totalRewards = this.element.querySelector('#total-rewards');
    if (totalRewards) totalRewards.textContent = `${results.summary.totalRewards} SP`;
    
    const avgEfficiency = this.element.querySelector('#avg-efficiency');
    if (avgEfficiency) avgEfficiency.textContent = `${results.summary.avgEfficiency}%`;
    
    const curationApr = this.element.querySelector('#curation-apr');
    if (curationApr) curationApr.textContent = `${results.summary.apr}%`;
    
    // Populate table rows
    const tbody = this.element.querySelector('#curation-results-body');
    if (!tbody) return;
    
    // Clear existing rows
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
    
    if (results.detailedResults.length === 0) {
      // Create empty state row
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 6;
      emptyCell.className = 'empty-results';
      emptyCell.textContent = 'No curation rewards found in the selected time period';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      
      // Show the results section
      const resultsDiv = this.element.querySelector('#curation-results');
      if (resultsDiv) resultsDiv.classList.remove('hidden');
      
      return;
    }
    
    // Sort results based on selected option
    let sortedResults = [...results.detailedResults];
    switch (sortBy) {
      case 'efficiency-desc':
        sortedResults.sort((a, b) => b.efficiency - a.efficiency);
        break;
      case 'efficiency-asc':
        sortedResults.sort((a, b) => a.efficiency - b.efficiency);
        break;
      case 'reward-desc':
        sortedResults.sort((a, b) => b.rewardSP - a.rewardSP);
        break;
      case 'reward-asc':
        sortedResults.sort((a, b) => a.rewardSP - b.rewardSP);
        break;
      case 'age-desc':
        sortedResults.sort((a, b) => new Date(b.time) - new Date(a.time));
        break;
      case 'age-asc':
        sortedResults.sort((a, b) => new Date(a.time) - new Date(b.time));
        break;
      default:
        sortedResults.sort((a, b) => b.efficiency - a.efficiency);
    }
    
    // Add results to the table with improved formatting
    sortedResults.forEach((item, index) => {
      const row = document.createElement('tr');
      // Add alternating row styling
      row.className = index % 2 === 0 ? 'even-row' : 'odd-row';
      
      // Post column with link and tooltip
      const postCell = document.createElement('td');
      postCell.className = 'post-cell';
      
      const postLink = document.createElement('a');
      // Use internal routing for post links instead of external Steemit links
      postLink.href = `/${item.post}`;
      postLink.target = '_self'; // Ensure links open in the same window
      postLink.rel = 'noopener noreferrer';
      
      // Display post with truncation if needed
      const displayText = item.post.length > 30 ? 
                          item.post.substring(0, 27) + '...' : 
                          item.post;
      
      postLink.textContent = displayText;
      postLink.title = item.post; // Full post as tooltip
      postCell.appendChild(postLink);
      row.appendChild(postCell);
      
      // Vote age column with formatted time
      const timeCell = document.createElement('td');
      timeCell.className = 'time-cell';
      
      const voteMinutes = item.voteAgeMins;
      let timeDisplay;
      
      if (voteMinutes < 60) {
        timeDisplay = `${voteMinutes}m`;
      } else if (voteMinutes < 1440) {
        const hours = Math.floor(voteMinutes / 60);
        const mins = voteMinutes % 60;
        timeDisplay = `${hours}h ${mins}m`;
      } else {
        const days = Math.floor(voteMinutes / 1440);
        const hours = Math.floor((voteMinutes % 1440) / 60);
        timeDisplay = `${days}d ${hours}h`;
      }
      
      // Create a badge for the time
      const timeBadge = document.createElement('span');
      timeBadge.className = 'time-badge';
      
      // Add color based on optimal voting time (5-30 minutes is often optimal)
      if (voteMinutes >= 5 && voteMinutes <= 30) {
        timeBadge.classList.add('optimal-time');
      } else if (voteMinutes < 5) {
        timeBadge.classList.add('early-time');
      } else {
        timeBadge.classList.add('late-time');
      }
      
      timeBadge.textContent = timeDisplay;
      timeCell.appendChild(timeBadge);
      
      // Add title with exact timestamp
      const voteDate = new Date(item.time + 'Z');
      timeCell.title = `Voted ${voteDate.toLocaleString()}`;
      
      row.appendChild(timeCell);
      
      // Vote percentage column with badge
      const percentCell = document.createElement('td');
      percentCell.className = 'percent-cell';
      
      const percentValue = document.createElement('span');
      percentValue.className = 'percent-badge';
      percentValue.textContent = `${item.percent.toFixed(0)}%`;
      
      percentCell.appendChild(percentValue);
      row.appendChild(percentCell);
      
      // Reward column with formatted value
      const rewardCell = document.createElement('td');
      rewardCell.className = 'reward-cell';
      rewardCell.textContent = `${item.rewardSP.toFixed(3)} SP`;
      row.appendChild(rewardCell);
      
      // Expected reward column
      const expectedCell = document.createElement('td');
      expectedCell.className = 'expected-cell';
      expectedCell.textContent = `${item.expectedReward.toFixed(3)} SP`;
      row.appendChild(expectedCell);
      
      // Efficiency column with visual indicator
      const efficiencyCell = document.createElement('td');
      efficiencyCell.className = 'efficiency-cell';
      
      const efficiencyValue = parseFloat(item.efficiency.toFixed(1));
      const efficiencySpan = document.createElement('span');
      efficiencySpan.className = 'efficiency-value';
      
      // Add classes based on efficiency for color coding
      if (efficiencyValue >= 90) {
        efficiencySpan.classList.add('high-efficiency');
      } else if (efficiencyValue >= 70) {
        efficiencySpan.classList.add('medium-efficiency');
      } else {
        efficiencySpan.classList.add('low-efficiency');
      }
      
      efficiencySpan.textContent = `${efficiencyValue}%`;
      efficiencyCell.appendChild(efficiencySpan);
      
      // Add visual bar to represent efficiency
      const barContainer = document.createElement('div');
      barContainer.className = 'efficiency-bar-container';
      
      const efficiencyBar = document.createElement('div');
      efficiencyBar.className = 'efficiency-bar';
      efficiencyBar.style.width = `${Math.min(100, efficiencyValue)}%`;
      
      // Color the bar based on efficiency
      if (efficiencyValue >= 90) {
        efficiencyBar.classList.add('high-bar');
      } else if (efficiencyValue >= 70) {
        efficiencyBar.classList.add('medium-bar');
      } else {
        efficiencyBar.classList.add('low-bar');
      }
      
      barContainer.appendChild(efficiencyBar);
      efficiencyCell.appendChild(barContainer);
      
      row.appendChild(efficiencyCell);
      tbody.appendChild(row);
    });
    
    // Show the results section
    const resultsDiv = this.element.querySelector('#curation-results');
    if (resultsDiv) resultsDiv.classList.remove('hidden');
  }
  
  showStatus(message, type = 'info') {
    const statusDiv = this.element.querySelector('#curation-status');
    if (!statusDiv) return;
    
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
  }
  
  hideStatus() {
    const statusDiv = this.element.querySelector('#curation-status');
    if (statusDiv) {
      statusDiv.classList.add('hidden');
    }
  }
  
  destroy() {
    // Clean up event emitter listeners
    this.eventHandlers.forEach(handler => {
      if (handler.event && handler.handler) {
        eventEmitter.off(handler.event, handler.handler);
      }
    });
    
    // Clean up any event listeners and subscriptions
    super.destroy();
  }
}