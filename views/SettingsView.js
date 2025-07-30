import View from './View.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import eventEmitter from '../utils/EventEmitter.js';
import { SearchService } from '../services/SearchService.js';
import { getAppVersion, getBuildTimestamp } from '../config/app-version.js';

/**
 * View for user settings and preferences
 */
class SettingsView extends View {
  constructor(params) {
    super(params);
    this.title = 'Settings';
    this.preferredTags = userPreferencesService.getPreferredTags();
    this.homeViewMode = userPreferencesService.getHomeViewMode();
    this.searchService = new SearchService();
    this.searchResults = [];
    this.tagSearchTimeout = null;
  }
  
  // Add this new helper method
  isCustomModeValid() {
    return this.preferredTags && this.preferredTags.length > 0;
  }

  render(container) {
    this.container = container;
    this.container.className = 'settings-view';

    const content = document.createElement('div');
    content.className = 'content-wrapper';

    // Create page header
    const header = document.createElement('h1');
    header.textContent = this.title;
    content.appendChild(header);

    // Create home feed preferences section
    const homeFeedSection = this.createHomeFeedSection();
    content.appendChild(homeFeedSection);

    // Create preferred tags section
    const tagsSection = this.createPreferredTagsSection();
    content.appendChild(tagsSection);

    // Create privacy settings section
    const privacySection = this.createPrivacySection();
    content.appendChild(privacySection);

    // Create app information section
    const appInfoSection = this.createAppInfoSection();
    content.appendChild(appInfoSection);

    // Add save button
    const saveButton = document.createElement('button');
    saveButton.className = 'primary-btn save-settings-btn';
    saveButton.textContent = 'Save Settings';
    saveButton.addEventListener('click', () => this.saveSettings());
    content.appendChild(saveButton);

    this.container.appendChild(content);
  }

  createHomeFeedSection() {
    const section = document.createElement('section');
    section.className = 'settings-section home-feed-settings';

    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = 'Home Feed Settings';
    section.appendChild(sectionTitle);

    const description = document.createElement('p');
    description.textContent = 'Choose what content you want to see on your home feed.';
    section.appendChild(description);    const options = [
        { id: 'trending', label: 'Trending', description: 'Posts that are trending on the platform' },
        { id: 'hot', label: 'Hot', description: 'Posts that are currently hot on the platform' },
        { id: 'new', label: 'New', description: 'Recently created posts' },
        { id: 'custom', label: 'Custom Feed', description: 'Posts based on your preferred tags below' }
    ];

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'feed-options';    options.forEach(option => {
      const radioContainer = document.createElement('div');
      radioContainer.className = 'radio-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'feedType';
      input.id = `feed-${option.id}`;
      input.value = option.id;
      input.checked = this.homeViewMode === option.id;
      
      // Disable custom option if no tags are available
      if (option.id === 'custom' && !this.isCustomModeValid()) {
        radioContainer.classList.add('disabled-option');
        input.disabled = true;
      }

      const label = document.createElement('label');
      label.htmlFor = `feed-${option.id}`;

      const labelText = document.createElement('span');
      labelText.className = 'option-label';
      labelText.textContent = option.label;
      label.appendChild(labelText);

      const labelDescription = document.createElement('span');
      labelDescription.className = 'option-description';
      labelDescription.textContent = option.description;
      
      // Add warning for custom feed if no tags
      if (option.id === 'custom' && !this.isCustomModeValid()) {
        labelDescription.textContent += ' (Add preferred tags below to enable this option)';
        labelDescription.style.color = '#ff6b6b';
      }
      
      label.appendChild(labelDescription);

      // Add event listener for when user tries to click on a disabled custom option
      if (option.id === 'custom') {
        radioContainer.addEventListener('click', (e) => {
          const radio = radioContainer.querySelector('input[type="radio"]');
          if (radio && radio.disabled) {
            e.preventDefault();
            this.showErrorMessage('Please add at least one preferred tag below to enable the Custom Feed option.');
          }
        });
      }

      radioContainer.appendChild(input);
      radioContainer.appendChild(label);
      optionsContainer.appendChild(radioContainer);
    });

    section.appendChild(optionsContainer);
    return section;
  }

  createPreferredTagsSection() {
    const section = document.createElement('section');
    section.className = 'settings-section preferred-tags-settings';

    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = 'Preferred Tags';
    section.appendChild(sectionTitle);

    const description = document.createElement('p');
    description.textContent = 'Add tags that interest you for your custom feed.';
    description.innerHTML += ' <strong>Posts with these tags will appear in your custom feed.</strong>';
    section.appendChild(description);

    // Tag search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'tag-search-container';

    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'tag-search-input';
    tagInput.placeholder = 'Search for tags...';
    tagInput.addEventListener('input', (e) => this.handleTagSearch(e.target.value));
    searchContainer.appendChild(tagInput);

    const searchResults = document.createElement('div');
    searchResults.className = 'tag-search-results';
    searchResults.style.display = 'none';
    searchContainer.appendChild(searchResults);

    section.appendChild(searchContainer);

    // Current tags display
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'preferred-tags-container';
    
    const tagsHeader = document.createElement('h3');
    tagsHeader.textContent = 'Your preferred tags';
    tagsContainer.appendChild(tagsHeader);

    const tagsList = document.createElement('div');
    tagsList.className = 'tags-list';
    tagsList.id = 'preferred-tags-list';
    
    // Add existing tags
    this.renderPreferredTags(tagsList);
    
    tagsContainer.appendChild(tagsList);
    section.appendChild(tagsContainer);

    return section;
  }

  createPrivacySection() {
    const section = document.createElement('section');
    section.className = 'settings-section privacy-settings';

    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = '🔒 Privacy & Analytics';
    section.appendChild(sectionTitle);

    const description = document.createElement('p');
    description.textContent = 'Manage your privacy preferences and data collection settings.';
    section.appendChild(description);

    // Analytics toggle
    const analyticsContainer = document.createElement('div');
    analyticsContainer.className = 'privacy-option';

    const analyticsToggle = document.createElement('div');
    analyticsToggle.className = 'toggle-option';

    const analyticsLabel = document.createElement('label');
    analyticsLabel.className = 'toggle-label';
    analyticsLabel.innerHTML = `
      <div class="toggle-text">
        <span class="toggle-title">📊 Google Analytics</span>
        <span class="toggle-description">Help us improve the app by sharing anonymous usage data</span>
      </div>
    `;

    const analyticsInput = document.createElement('input');
    analyticsInput.type = 'checkbox';
    analyticsInput.id = 'analytics-toggle';
    analyticsInput.checked = userPreferencesService.isAnalyticsEnabled();
    analyticsInput.addEventListener('change', (e) => this.handleAnalyticsToggle(e.target.checked));

    const analyticsSwitch = document.createElement('div');
    analyticsSwitch.className = 'toggle-switch';
    analyticsSwitch.appendChild(analyticsInput);
    analyticsSwitch.appendChild(document.createElement('span'));

    analyticsLabel.appendChild(analyticsSwitch);
    analyticsToggle.appendChild(analyticsLabel);
    analyticsContainer.appendChild(analyticsToggle);

    // Info about data collection
    const infoContainer = document.createElement('div');
    infoContainer.className = 'privacy-info';
    infoContainer.innerHTML = `
      <div class="privacy-info-item">
        <span class="material-icons">shield</span>
        <span>Your IP address is anonymized</span>
      </div>
      <div class="privacy-info-item">
        <span class="material-icons">block</span>
        <span>No personal data is shared for advertising</span>
      </div>
      <div class="privacy-info-item">
        <span class="material-icons">analytics</span>
        <span>Data helps us understand how to improve the app</span>
      </div>
    `;

    section.appendChild(analyticsContainer);
    section.appendChild(infoContainer);

    return section;
  }

  renderPreferredTags(container) {
    // Clear container
    container.innerHTML = '';

    if (this.preferredTags.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'empty-tags-message';
      emptyMessage.textContent = 'You haven\'t added any preferred tags yet.';
      container.appendChild(emptyMessage);
      return;
    }

    // Create a tag pill for each preferred tag
    this.preferredTags.forEach(tag => {
      const tagPill = document.createElement('div');
      tagPill.className = 'tag-pill';
      
      const tagText = document.createElement('span');
      tagText.className = 'tag-text';
      tagText.textContent = tag;
      tagPill.appendChild(tagText);
      
      const removeBtn = document.createElement('span');
      removeBtn.className = 'tag-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.setAttribute('title', 'Remove tag');
      removeBtn.addEventListener('click', () => this.removePreferredTag(tag));
      tagPill.appendChild(removeBtn);
      
      container.appendChild(tagPill);
    });
  }

  async handleTagSearch(query) {
    // Clear previous timeout
    if (this.tagSearchTimeout) {
      clearTimeout(this.tagSearchTimeout);
    }

    const searchResults = this.container.querySelector('.tag-search-results');
    
    // Hide results if query is empty
    if (!query || query.trim().length < 2) {
      searchResults.style.display = 'none';
      return;
    }
    
    // Set a timeout to avoid making too many requests
    this.tagSearchTimeout = setTimeout(async () => {
      // Show loading indicator
      searchResults.style.display = 'block';
      searchResults.innerHTML = '<div class="loading-indicator">Searching...</div>';
      
      try {
        // Search for tags
        const results = await this.searchService.searchTags(query);
        
        // Update UI with results
        this.updateTagSearchResults(results);
      } catch (error) {
        console.error('Error searching for tags:', error);
        searchResults.innerHTML = '<div class="error-message">Error searching for tags</div>';
      }
    }, 300);
  }

  updateTagSearchResults(results) {
    const searchResults = this.container.querySelector('.tag-search-results');
    searchResults.innerHTML = '';
    
    // Hide results if no results
    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No tags found</div>';
      return;
    }
    
    // Create a list item for each result
    results.forEach(result => {
      const item = document.createElement('div');
      item.className = 'tag-result-item';
      item.dataset.tag = result.name;
      
      const tagName = document.createElement('span');
      tagName.className = 'tag-name';
      tagName.textContent = result.name;
      item.appendChild(tagName);
      
      if (result.count) {
        const tagCount = document.createElement('span');
        tagCount.className = 'tag-count';
        tagCount.textContent = `${result.count} posts`;
        item.appendChild(tagCount);
      }
      
      // Check if tag is already in preferred tags
      if (this.preferredTags.includes(result.name)) {
        item.classList.add('already-added');
        item.title = 'Already in your preferred tags';
      } else {
        item.addEventListener('click', () => this.addPreferredTag(result.name));
      }
      
      searchResults.appendChild(item);
    });
    
    searchResults.style.display = 'block';
  }
  addPreferredTag(tag) {
    // Don't add if already in the list
    if (this.preferredTags.includes(tag)) {
      return;
    }
    
    // Add to list
    this.preferredTags.push(tag);
    
    // Update UI
    const tagsList = this.container.querySelector('#preferred-tags-list');
    this.renderPreferredTags(tagsList);
    
    // Hide search results
    const searchResults = this.container.querySelector('.tag-search-results');
    searchResults.style.display = 'none';
    
    // Clear search input
    const searchInput = this.container.querySelector('.tag-search-input');
    searchInput.value = '';
    
    // Enable custom feed option if this is the first tag
    if (this.preferredTags.length === 1) {
      const customRadio = this.container.querySelector('input[value="custom"]');
      if (customRadio) {
        customRadio.disabled = false;
        const radioContainer = customRadio.closest('.radio-option');
        if (radioContainer) {
          radioContainer.classList.remove('disabled-option');
          const description = radioContainer.querySelector('.option-description');
          if (description) {
            description.textContent = 'Posts based on your preferred tags below';
            description.style.color = ''; // Reset color
          }
        }
      }
    }
  }
  removePreferredTag(tag) {
    // Remove from list
    this.preferredTags = this.preferredTags.filter(t => t !== tag);
    
    // Update UI
    const tagsList = this.container.querySelector('#preferred-tags-list');
    this.renderPreferredTags(tagsList);
    
    // If all tags are removed, disable custom feed option and select trending
    if (this.preferredTags.length === 0) {
      const customRadio = this.container.querySelector('input[value="custom"]');
      if (customRadio) {
        customRadio.disabled = true;
        
        // If custom was selected, switch to trending
        if (customRadio.checked) {
          const trendingRadio = this.container.querySelector('input[value="trending"]');
          if (trendingRadio) {
            trendingRadio.checked = true;
          }
        }
        
        const radioContainer = customRadio.closest('.radio-option');
        if (radioContainer) {
          radioContainer.classList.add('disabled-option');
          const description = radioContainer.querySelector('.option-description');
          if (description) {
            description.textContent = 'Posts based on your preferred tags below (Add preferred tags below to enable this option)';
            description.style.color = '#ff6b6b';
          }
        }
      }
    }
  }

  getSelectedHomeViewMode() {
    const selectedOption = this.container.querySelector('input[name="feedType"]:checked');
    return selectedOption ? selectedOption.value : 'trending';
  }

  handleAnalyticsToggle(enabled) {
    userPreferencesService.setCookieConsent(enabled);
    
    const message = enabled ? 
      'Analytics enabled. Thank you for helping us improve!' : 
      'Analytics disabled. Your privacy is respected.';
      
    this.showSuccessMessage(message);
  }
  saveSettings() {
    // Get current settings
    const homeViewMode = this.getSelectedHomeViewMode();
    
    // Save tags first
    userPreferencesService.setPreferredTags(this.preferredTags);

    // Special handling for custom mode
    if (homeViewMode === 'custom' && this.preferredTags.length === 0) {
      // Show a message to the user
      this.showErrorMessage('Custom feed requires at least one preferred tag. Please add tags or select another feed type.');
      
      // Find the trending radio button and select it
      const trendingRadio = this.container.querySelector('input[value="trending"]');
      if (trendingRadio) {
        trendingRadio.checked = true;
      }
      return;
    }
    
    // Save home view mode after tag validation
    userPreferencesService.setHomeViewMode(homeViewMode);
    
    // Emit event for views to update
    eventEmitter.emit('user:preferences:updated');
    
    // Show success message
    this.showSuccessMessage();
  }
  showSuccessMessage(customMessage) {
    // Check if message already exists
    let message = this.container.querySelector('.settings-success-message');
    
    if (!message) {
      message = document.createElement('div');
      message.className = 'settings-success-message';
      this.container.querySelector('.content-wrapper').appendChild(message);
    }
    
    message.textContent = customMessage || 'Settings saved successfully!';
    message.classList.add('show');
    
    // Hide message after 3 seconds
    setTimeout(() => {
      message.classList.remove('show');
    }, 3000);
  }
  
  showErrorMessage(errorText) {
    // Check if message already exists
    let message = this.container.querySelector('.settings-error-message');
    
    if (!message) {
      message = document.createElement('div');
      message.className = 'settings-error-message';
      this.container.querySelector('.content-wrapper').appendChild(message);
    }
    
    message.textContent = errorText;
    message.classList.add('show');
    
    // Hide message after 5 seconds
    setTimeout(() => {
      message.classList.remove('show');
    }, 5000);
  }

  unmount() {
    // Clear any timeouts
    if (this.tagSearchTimeout) {
      clearTimeout(this.tagSearchTimeout);
    }
    
    // Close any open dropdowns
    const searchResults = this.container?.querySelector('.tag-search-results');
    if (searchResults) {
      searchResults.style.display = 'none';
    }
  }

createAppInfoSection() {
    const section = document.createElement('section');
    section.className = 'settings-section app-info-section';

    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = 'App Information';
    section.appendChild(sectionTitle);

    // App version
    const versionContainer = document.createElement('div');
    versionContainer.className = 'app-info-item';

    const versionLabel = document.createElement('span');
    versionLabel.className = 'app-info-label';
    versionLabel.textContent = 'Version:';
    versionContainer.appendChild(versionLabel);

    const versionValue = document.createElement('span');
    versionValue.className = 'app-info-value';
    versionValue.textContent = getAppVersion();
    versionContainer.appendChild(versionValue);

    section.appendChild(versionContainer);

    // Last update date
    const buildDateContainer = document.createElement('div');
    buildDateContainer.className = 'app-info-item';

    const buildDateLabel = document.createElement('span');
    buildDateLabel.className = 'app-info-label';
    buildDateLabel.textContent = 'Last update:';
    buildDateContainer.appendChild(buildDateLabel);

    const buildTimestamp = getBuildTimestamp();
    const buildDate = new Date(buildTimestamp);
    
    const buildDateValue = document.createElement('span');
    buildDateValue.className = 'app-info-value';
    buildDateValue.textContent = buildDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    buildDateContainer.appendChild(buildDateValue);

    section.appendChild(buildDateContainer);

    return section;
}
}

export default SettingsView;