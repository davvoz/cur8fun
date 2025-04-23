import View from './View.js';
import searchService from '../services/SearchService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

class SearchView extends View {
  constructor(params = {}) {
    super();
    this.params = params;
    this.searchInput = null;
    this.suggestionsContainer = null;
    this.resultsContainer = null;
    this.loadingIndicator = new LoadingIndicator();
    this.currentSearchMethod = 'users'; // Rinominato per chiarezza
  }

  async render(container) {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    // Aggiungi un riferimento alla SearchView nel container
    searchContainer.searchView = this;

    // Add title section with animated subtitle
    const title = document.createElement('h1');
    title.className = 'search-title';
    title.textContent = 'Search Steem';

    const subtitle = document.createElement('p');
    subtitle.className = 'search-subtitle';
    subtitle.innerHTML = this.getAnimatedSubtitle();
    
    const header = document.createElement('div');
    header.className = 'search-header';
    header.appendChild(title);
    header.appendChild(subtitle);

    // Create search controls
    const searchControls = this.createSearchControls();
    header.appendChild(searchControls);

    searchContainer.appendChild(header);

    // Create results container
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'search-results';
    searchContainer.appendChild(this.resultsContainer);

    // Get search query from URL if exists
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    container.appendChild(searchContainer);

    if (query) {
      this.searchInput.value = query;
      await this.performSearch(query);
    }

    return searchContainer;
  }

  getAnimatedSubtitle() {
    return `
      <span class="typed-text" data-text="Find users and explore content across the Steem ecosystem"></span>
      <span class="cursor"></span>
    `;
  }

  createSearchControls() {
    const controls = document.createElement('div');
    controls.className = 'search-controls';

    // Create input wrapper with icon
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'search-input-wrapper';
    // Assicuriamo che il wrapper abbia position: relative
    inputWrapper.style.position = 'relative';
    // Cambio da display:flex a display:block per permettere agli elementi di posizionarsi uno sotto l'altro
    inputWrapper.style.display = 'block'; 

    // Creiamo un contenitore specifico per l'input e l'icona
    const inputIconWrapper = document.createElement('div');
    inputIconWrapper.style.position = 'relative';
    inputIconWrapper.style.width = '100%';

    // Creiamo prima l'icona di ricerca con posizionamento assoluto
    const searchIcon = document.createElement('div');
    searchIcon.innerHTML = '<i class="fas fa-search"></i>';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '15px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.color = '#666';
    searchIcon.style.pointerEvents = 'none';
    searchIcon.style.zIndex = '10';
    searchIcon.style.fontSize = '16px';
    searchIcon.style.display = 'flex';
    searchIcon.style.alignItems = 'center';
    searchIcon.style.justifyContent = 'center';
    inputIconWrapper.appendChild(searchIcon);

    // Ora creiamo l'input di ricerca
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'search-input';
    this.searchInput.dataset.searchMethod = this.currentSearchMethod;
    this.updatePlaceholder(this.currentSearchMethod);
    this.searchInput.style.paddingLeft = '40px';
    this.searchInput.style.width = '100%';
    inputIconWrapper.appendChild(this.searchInput);

    // Aggiungiamo il wrapper di input e icona al wrapper principale
    inputWrapper.appendChild(inputIconWrapper);

    // Aggiungiamo un contenitore per gli elementi che devono stare sotto l'input
    const belowInputContainer = document.createElement('div');
    belowInputContainer.style.marginTop = '8px';

    // Aggiungi un hint sotto il campo di ricerca
    const searchHint = document.createElement('div');
    searchHint.className = 'search-hint';
    this.updateSearchHint(searchHint, this.currentSearchMethod);
    searchHint.style.marginBottom = '5px';
    belowInputContainer.appendChild(searchHint);

    // Add search stats counter
    const searchStats = document.createElement('div');
    searchStats.className = 'search-stats';
    searchStats.innerHTML = '<span class="stat-count">0</span> results found';
    searchStats.style.marginBottom = '5px';
    belowInputContainer.appendChild(searchStats);

    // Add keyboard shortcuts hint
    const keyboardHint = document.createElement('div');
    keyboardHint.className = 'keyboard-shortcuts';
    keyboardHint.innerHTML = `
      <span><kbd>↵</kbd> to search</span>
      <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
      <span><kbd>ESC</kbd> to close</span>
    `;
    belowInputContainer.appendChild(keyboardHint);
    
    // Aggiungiamo il contenitore degli elementi sotto l'input
    inputWrapper.appendChild(belowInputContainer);

    this.searchInput.addEventListener('input', (event) => {
      const query = this.searchInput.value.trim();
      if (query.length >= 2) {
        searchService.showSuggestions(query, this.currentSearchMethod);
      } else {
        searchService.hideSuggestions();
      }
    });

    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const query = this.searchInput.value.trim();
        if (query) {
          searchService.hideSuggestions();
          if (this.currentSearchMethod === 'tags') {
            router.navigate(`/tag/${query}`);
          } else {
            searchService.handleSearch(query);
          }
        }
      }
    });

    this.suggestionsContainer = document.createElement('div');
    this.suggestionsContainer.className = 'search-suggestions';
    inputWrapper.appendChild(this.suggestionsContainer);

    // IMPORTANTE: Assegna il container dei suggerimenti al servizio, 
    // ma non inizializzare gli eventi
    searchService.suggestionsContainer = this.suggestionsContainer;

    controls.appendChild(inputWrapper);

    // Create filter buttons with modern icons
    const filterButtons = document.createElement('div');
    filterButtons.className = 'search-filter-buttons';

    // Migliorare i testi dei pulsanti di filtro per maggiore chiarezza
    const filters = [
      { id: 'users', icon: 'fas fa-users', text: 'Search Users' },
      { id: 'tags', icon: 'fas fa-hashtag', text: 'Search Tags' }
    ];

    filters.forEach(filter => {
      const button = document.createElement('button');
      button.className = `filter-button ${this.currentSearchMethod === filter.id ? 'active' : ''}`;
      button.innerHTML = `<i class="${filter.icon}"></i> ${filter.text}`;
      button.addEventListener('click', () => {
        this.changeSearchMethod(filter.id);
        this.updatePlaceholder(filter.id);
      });
      filterButtons.appendChild(button);
    });

    controls.appendChild(filterButtons);

    return controls;
  }

  updatePlaceholder(method) {
    const placeholders = {
      users: 'Type a username to search...',
      tags: 'Type a tag name without # to search...',
    };
    this.searchInput.placeholder = placeholders[method] || 'Search...';
  }

  updateSearchHint(hintElement, method) {
    if (!hintElement) return;
    
    const hints = {
      users: 'Start typing to find users. Click on a result to view their profile.',
      tags: 'Enter a tag name (without #) to find content. Results update as you type.',
    };
    
    hintElement.innerHTML = `<i class="fas fa-info-circle"></i> ${hints[method] || ''}`;
  }

  changeSearchMethod(method) {
    this.currentSearchMethod = method;
    
    // Update search input dataset
    if (this.searchInput) {
      this.searchInput.dataset.searchMethod = method;
    }

    // Update active button state
    document.querySelectorAll('.filter-button').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().includes(method));
    });

    // Clear suggestions and update placeholder
    searchService.hideSuggestions();
    this.updatePlaceholder(method);
    
    // Aggiorna l'hint
    const hintElement = document.querySelector('.search-hint');
    if (hintElement) {
      this.updateSearchHint(hintElement, method);
    }

    // Re-run search and show suggestions if there's a query
    const query = this.searchInput.value.trim();
    if (query) {
      this.performSearch(query);
      if (query.length >= 2) {
        searchService.showSuggestions(query, method);
      }
    }
  }

  async performSearch(query) {
    const queryTrimmed = query.trim();
    if (!queryTrimmed) return;

    try {
      this.resultsContainer.innerHTML = '';
      this.loadingIndicator.show(this.resultsContainer);

      let results;
      if (this.currentSearchMethod === 'tags') {
        results = await searchService.searchTags(queryTrimmed);
      } else if (this.currentSearchMethod === 'users') {
        results = await searchService.findSimilarAccounts(queryTrimmed);
      }

      this.displayResults(results);
    } catch (error) {
      console.error('Search error:', error);
      this.showError('An error occurred while searching');
    } finally {
      this.loadingIndicator.hide();
    }
  }

  displayResults(results) {
    this.resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      
      if (this.currentSearchMethod === 'users') {
        noResults.innerHTML = `
          <div class="no-results-icon"><i class="fas fa-user-slash"></i></div>
          <h3>No users found</h3>
          <p>We couldn't find any users matching your search.</p>
          <p>Try a different username or check your spelling.</p>
        `;
      } else if (this.currentSearchMethod === 'tags') {
        noResults.innerHTML = `
          <div class="no-results-icon"><i class="fas fa-hashtag"></i></div>
          <h3>No tags found</h3>
          <p>We couldn't find any tags matching your search.</p>
          <p>You can still search for this tag by pressing Enter.</p>
          <button class="search-tag-anyway">Search for this tag</button>
        `;
        
        // Add event listener to the button
        setTimeout(() => {
          const button = noResults.querySelector('.search-tag-anyway');
          if (button) {
            button.addEventListener('click', () => {
              const query = this.searchInput.value.trim();
              if (query) {
                router.navigate(`/tag/${query}`);
              }
            });
          }
        }, 0);
      } else {
        noResults.textContent = 'No results found';
      }
      
      this.resultsContainer.appendChild(noResults);
      return;
    }

    // Add search results count and summary
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    resultsHeader.innerHTML = `
      <h2>Search Results</h2>
      <p>Found ${results.length} ${this.currentSearchMethod === 'users' ? 'users' : 'tags'} matching your search</p>
    `;
    this.resultsContainer.appendChild(resultsHeader);

    const resultsList = document.createElement('div');
    resultsList.className = 'results-list';

    // Add staggered animation delay to results
    results.forEach((result, index) => {
      const resultItem = this.createResultItem(result);
      resultItem.style.animationDelay = `${index * 0.1}s`; 
      resultsList.appendChild(resultItem);
    });

    this.resultsContainer.appendChild(resultsList);
  }

  createResultItem(result) {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    switch (result.type) {
      case 'user':
        item.innerHTML = `
          <div class="user-result">
            <img src="https://images.hive.blog/u/${result.name}/avatar/small" 
                 onerror="this.src='assets/img/default_avatar.png'" 
                 alt="${result.name}" 
                 class="user-avatar">
            <div class="user-info">
              <h3>${result.profile?.name || result.name}</h3>
              <span>@${result.name}</span>
              ${result.profile?.about ? `<p class="user-about">${result.profile.about.substring(0, 60)}${result.profile.about.length > 60 ? '...' : ''}</p>` : ''}
              <div class="user-action">
                <span class="view-profile">View Profile <i class="fas fa-arrow-right"></i></span>
              </div>
            </div>
          </div>
        `;
        item.addEventListener('click', () => router.navigate(`/@${result.name}`));
        break;

      case 'tag':
        item.innerHTML = `
          <div class="tag-result">
            <i class="fas fa-hashtag"></i>
            <div class="tag-info">
              <h3>${result.name}</h3>
              <span class="tag-count">${result.count} posts</span>
              <div class="tag-action">
                <span class="view-tag">Browse Tag <i class="fas fa-arrow-right"></i></span>
              </div>
            </div>
          </div>
        `;
        item.addEventListener('click', () => router.navigate(`/tag/${result.name}`));
        break;
      default:
        console.error('Unknown result type:', result.type);
        return null; // Return null for unknown types 
    }

    // Add hover effect
    item.addEventListener('mouseenter', () => {
      item.classList.add('hover');
    });
    
    item.addEventListener('mouseleave', () => {
      item.classList.remove('hover');
    });

    return item;
  }

  showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    this.resultsContainer.appendChild(error);
  }
}

export default SearchView;
