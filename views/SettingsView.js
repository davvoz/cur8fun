import View from './View.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import eventEmitter from '../utils/EventEmitter.js';
import { SearchService } from '../services/SearchService.js';

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
    section.appendChild(description);

    const options = [
        { id: 'trending', label: 'Trending', description: 'Posts that are trending on the platform' },
      { id: 'custom', label: 'Custom Feed', description: 'Posts based on your preferred tags below' }
    ];

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'feed-options';

    options.forEach(option => {
      const radioContainer = document.createElement('div');
      radioContainer.className = 'radio-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'feedType';
      input.id = `feed-${option.id}`;
      input.value = option.id;
      input.checked = this.homeViewMode === option.id;

      const label = document.createElement('label');
      label.htmlFor = `feed-${option.id}`;

      const labelText = document.createElement('span');
      labelText.className = 'option-label';
      labelText.textContent = option.label;
      label.appendChild(labelText);

      const labelDescription = document.createElement('span');
      labelDescription.className = 'option-description';
      labelDescription.textContent = option.description;
      label.appendChild(labelDescription);

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
  }

  removePreferredTag(tag) {
    // Remove from list
    this.preferredTags = this.preferredTags.filter(t => t !== tag);
    
    // Update UI
    const tagsList = this.container.querySelector('#preferred-tags-list');
    this.renderPreferredTags(tagsList);
  }

  getSelectedHomeViewMode() {
    const selectedOption = this.container.querySelector('input[name="feedType"]:checked');
    return selectedOption ? selectedOption.value : 'trending';
  }

  saveSettings() {
    // Get current settings
    const homeViewMode = this.getSelectedHomeViewMode();
    
    // Save settings
    userPreferencesService.setPreferredTags(this.preferredTags);
    userPreferencesService.setHomeViewMode(homeViewMode);
    
    // Emit event for views to update
    eventEmitter.emit('user:preferences:updated');
    
    // Show success message
    this.showSuccessMessage();
  }

  showSuccessMessage() {
    // Check if message already exists
    let message = this.container.querySelector('.settings-success-message');
    
    if (!message) {
      message = document.createElement('div');
      message.className = 'settings-success-message';
      this.container.querySelector('.content-wrapper').appendChild(message);
    }
    
    message.textContent = 'Settings saved successfully!';
    message.classList.add('show');
    
    // Hide message after 3 seconds
    setTimeout(() => {
      message.classList.remove('show');
    }, 3000);
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
}

export default SettingsView;