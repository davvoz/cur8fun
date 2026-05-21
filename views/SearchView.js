import View from './View.js';
import searchService from '../services/SearchService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class SearchView extends View {
  constructor(params = {}) {
    super();
    this.params = params;
    this.searchInput = null;
    this.resultsContainer = null;
    this._debounceTimer = null;
    this._currentSearchId = null;
    this._postOffset = 0;
    this._postQuery = '';
    this._infiniteScroll = null;
    this._resultsList = null;
    this._emptyHint = null;
    this.loadingIndicator = new LoadingIndicator();
    this.currentSearchMethod = 'users';
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

    // Welcome hint — sibling of resultsContainer so innerHTML='' never kills it
    this._emptyHint = document.createElement('div');
    this._emptyHint.className = 'search-empty-hint';
    searchContainer.appendChild(this._emptyHint);
    this._updateHint();

    // Get search query from URL if exists
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    container.appendChild(searchContainer);

    if (query) {
      this.searchInput.value = query;
      await this.performSearch(query);
    }

    // Focus the search input so the user can start typing immediately
    requestAnimationFrame(() => {
      if (this.searchInput) this.searchInput.focus();
    });

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

    // No extra hints/stats between input and results

    this.searchInput.addEventListener('input', (event) => {
      const query = this.searchInput.value.trim();
      clearTimeout(this._debounceTimer);
      if (query.length >= 2) {
        this._debounceTimer = setTimeout(() => this.performSearch(query), 500);
      } else {
        this._destroyInfiniteScroll();
        this.resultsContainer.innerHTML = '';
        this._updateHint();
        if (this._emptyHint) this._emptyHint.style.display = '';
      }
    });

    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const query = this.searchInput.value.trim();
        if (query) {
          if (this.currentSearchMethod === 'tags') {
            router.navigate(`/tag/${query}`);
          } else if (this.currentSearchMethod === 'posts') {
            this.performSearch(query);
          } // do nothing for users
        }
      }
    });

    // Create filter tabs — placed BEFORE the input so they're not hidden by the mobile keyboard
    const filterButtons = document.createElement('div');
    filterButtons.className = 'search-filter-buttons';

    const filters = [
      { id: 'users', icon: 'person',    text: 'Users' },
      { id: 'tags',  icon: 'tag',       text: 'Tags'  },
      { id: 'posts', icon: 'article',   text: 'Posts'  }
    ];

    filters.forEach(filter => {
      const button = document.createElement('button');
      button.className = `filter-button ${this.currentSearchMethod === filter.id ? 'active' : ''}`;
      button.dataset.filter = filter.id;
      button.innerHTML = `<span class="material-icons" style="font-size:1.1rem">${filter.icon}</span> ${filter.text}`;
      button.addEventListener('click', () => {
        this.changeSearchMethod(filter.id);
        this.updatePlaceholder(filter.id);
        if (this.searchInput) this.searchInput.focus();
      });
      filterButtons.appendChild(button);
    });

    controls.appendChild(filterButtons);
    controls.appendChild(inputWrapper);

    return controls;
  }

  updatePlaceholder(method) {
    const placeholders = {
      users: 'Type a username to search...',
      tags: 'Type a tag name without # to search...',
      posts: 'Search posts by keyword...',
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

  _updateHint() {
    if (!this._emptyHint) return;
    const hints = {
      users: {
        icon: 'person_search',
        title: 'Search for Steem users',
        desc: 'Type a username to find accounts on the Steem blockchain. Results appear as you type.'
      },
      tags: {
        icon: 'tag',
        title: 'Explore tags and topics',
        desc: 'Type a keyword to discover trending tags. Press Enter to browse all posts for a tag.'
      },
      posts: {
        icon: 'article',
        title: 'Search posts',
        desc: 'Type any keyword to find posts across the Steem ecosystem. Results load automatically.'
      }
    };
    const h = hints[this.currentSearchMethod] || hints.users;
    this._emptyHint.innerHTML = `
      <div style="text-align:center; margin-top:32px; margin-bottom:24px;">
        <span class="material-icons" style="font-size:3rem; color:var(--primary-color);">${h.icon}</span><br>
        <b style="font-size:1.15rem; color:var(--text-color);">${h.title}</b><br>
        <span style="font-size:1rem; color:var(--text-muted);">${h.desc}</span>
      </div>
    `;
  }

  changeSearchMethod(method) {
    this.currentSearchMethod = method;
    
    // Update search input dataset
    if (this.searchInput) {
      this.searchInput.dataset.searchMethod = method;
    }

    // Update active button state
    document.querySelectorAll('.filter-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === method);
    });

    this.updatePlaceholder(method);

    // Re-run search if there's a query
    const query = this.searchInput.value.trim();
    if (query.length >= 2) {
      this.performSearch(query);
    } else {
      this._destroyInfiniteScroll();
      this.resultsContainer.innerHTML = '';
      this._updateHint();
      if (this._emptyHint) this._emptyHint.style.display = '';
    }
  }

  async performSearch(query) {
    const queryTrimmed = query.trim();
    if (!queryTrimmed) return;

    // Store search ID to handle race conditions
    const searchId = Date.now();
    this._currentSearchId = searchId;

    // Reset infinite scroll state for new search
    this._destroyInfiniteScroll();
    this._postOffset = 0;
    this._postQuery = queryTrimmed;

    try {
      // Subtle loading indication
      if (this.resultsContainer.innerHTML) {
        this.resultsContainer.style.opacity = '0.7';
      }

      let results;
      if (this.currentSearchMethod === 'tags') {
        results = await searchService.searchTags(queryTrimmed);
      } else if (this.currentSearchMethod === 'users') {
        results = await searchService.findSimilarAccounts(queryTrimmed);
      } else if (this.currentSearchMethod === 'posts') {
        results = await searchService.searchPosts(queryTrimmed, 20, 0);
        this._postOffset = results.length;
      }

      // Only display if this is still the latest search
      if (this._currentSearchId === searchId) {
        requestAnimationFrame(() => {
          this.displayResults(results);
          this.resultsContainer.style.opacity = '1';
          // Setup infinite scroll for posts
          if (this.currentSearchMethod === 'posts' && results && results.length >= 20) {
            this._setupInfiniteScroll();
          }
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      if (this._currentSearchId === searchId) {
        this.showError('An error occurred while searching');
        this.resultsContainer.style.opacity = '1';
      }
    }
  }

  async _loadMorePosts() {
    const results = await searchService.searchPosts(this._postQuery, 20, this._postOffset);
    if (!results || results.length === 0) return [];
    this._postOffset += results.length;

    // Append to existing list
    if (this._resultsList) {
      results.forEach(result => {
        const item = this.createResultItem(result);
        if (item) this._resultsList.appendChild(item);
      });
    }

    return results;
  }

  _setupInfiniteScroll() {
    this._destroyInfiniteScroll();
    this._infiniteScroll = new InfiniteScroll({
      container: this.resultsContainer,
      loadMore: async () => {
        const results = await this._loadMorePosts();
        return results && results.length >= 20;
      },
      threshold: '300px',
      loadingMessage: 'Loading more posts...',
      endMessage: 'No more posts to load'
    });
  }

  _destroyInfiniteScroll() {
    if (this._infiniteScroll) {
      this._infiniteScroll.destroy?.();
      this._infiniteScroll = null;
    }
  }

  displayResults(results) {
    this.resultsContainer.innerHTML = '';
    if (this._emptyHint) this._emptyHint.style.display = 'none';

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
        const tagQuery = this.searchInput.value.trim();
        noResults.innerHTML = `
          <div class="no-results-icon"><i class="fas fa-hashtag"></i></div>
          <h3>No matching tags</h3>
          <p>Want to explore posts with this keyword?</p>
          <button class="search-tag-anyway">
            <i class="fas fa-hashtag"></i> Browse ${tagQuery}
          </button>
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
      } else if (this.currentSearchMethod === 'posts') {
        noResults.innerHTML = `
          <div class="no-results-icon"><span class="material-icons" style="font-size:2.5rem">article</span></div>
          <h3>No posts found</h3>
          <p>We couldn't find any posts matching your search.</p>
        `;
      } else {
        noResults.textContent = 'No results found';
      }
      
      this.resultsContainer.appendChild(noResults);
      return;
    }

    this._resultsList = document.createElement('div');
    this._resultsList.className = 'results-list';

    results.forEach((result) => {
      const resultItem = this.createResultItem(result);
      if (resultItem) this._resultsList.appendChild(resultItem);
    });

    this.resultsContainer.appendChild(this._resultsList);
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
            </div>
          </div>
        `;
        item.addEventListener('click', () => router.navigate(`/tag/${result.name}`));
        break;

      case 'post':
        const snippet = result.body ? result.body.substring(0, 120) + (result.body.length > 120 ? '...' : '') : '';
        // Format date (created is a unix timestamp in seconds)
        let dateStr = '';
        if (result.created) {
          const d = new Date(result.created * 1000);
          dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        item.innerHTML = `
          <div class="post-result">
            <img src="https://images.hive.blog/u/${result.author}/avatar/small"
                 onerror="this.src='assets/img/default_avatar.png'"
                 alt="${result.author}"
                 class="user-avatar">
            <div class="post-info">
              <h3>${result.title}</h3>
              <span class="post-author">@${result.author}${dateStr ? ' · <span class=\'post-date\'>' + dateStr + '</span>' : ''}</span>
              ${snippet ? `<p class="post-snippet">${snippet}</p>` : ''}
            </div>
          </div>
        `;
        item.addEventListener('click', () => router.navigate(`/@${result.author}/${result.permlink}`));
        break;
      default:
        console.error('Unknown result type:', result.type);
        return null; // Return null for unknown types 
    }

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
