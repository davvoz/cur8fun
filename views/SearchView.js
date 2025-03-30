import View from './View.js';
import steemService from '../services/SteemService.js';
import searchService from '../services/SearchService.js';
import router from '../utils/Router.js';
import LoadingIndicator from '../components/LoadingIndicator.js';

class SearchView extends View {
  constructor(params = {}) {
    super(params);
    this.query = params.q || '';
    this.results = [];
    this.isLoading = false;
    this.page = 1;
    this.hasMore = true;
    this.loadingIndicator = null;
    this.searchMethods = [
      { name: 'by-tag', label: 'By Tag' },
      { name: 'by-author', label: 'By Author' },
      { name: 'similar-accounts', label: 'Similar Accounts' },
      { name: 'recent', label: 'Recent Posts' }
    ];
    
    // Imposta il metodo di ricerca iniziale in base alla query
    if (this.query.startsWith('@') || searchService.isPossibleUsername(this.query)) {
      this.activeMethod = 'similar-accounts';
    } else if (this.query.startsWith('#')) {
      this.activeMethod = 'by-tag';
    } else {
      this.activeMethod = 'by-tag';
    }
  }

  async render(element) {
    if (!element) {
      console.error('No element provided to SearchView.render()');
      return;
    }

    // Clear the container
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    this.element = element;
    
    // Create the main search container
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';

    // Create header with search info
    const header = document.createElement('div');
    header.className = 'search-header';
    
    const title = document.createElement('h2');
    title.className = 'search-title';
    title.textContent = `Search results for "${this.query}"`;
    
    // Add search instructions
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-instructions';
    searchInfo.innerHTML = `
        <p>Search tips:</p>
        <ul>
            <li>Type a username (with or without @) to find accounts</li>
            <li>Use <strong>#tag</strong> to search for specific tags</li>
            <li>Use <strong>hive-123</strong> to search for communities</li>
            <li>Simply enter keywords to search for posts</li>
        </ul>
    `;
    
    header.appendChild(title);
    header.appendChild(searchInfo);
    
    // Add search filters
    const filters = document.createElement('div');
    filters.className = 'search-filters';
    
    this.searchMethods.forEach(method => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${method.name === this.activeMethod ? 'active' : ''}`;
      btn.textContent = method.label;
      btn.addEventListener('click', () => {
        this.switchSearchMethod(method.name);
      });
      filters.appendChild(btn);
    });
    
    header.appendChild(title);
    header.appendChild(filters);
    searchContainer.appendChild(header);

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    
    // No results message
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.textContent = 'No results found';
    noResults.style.display = 'none';
    
    // Append all elements
    searchContainer.appendChild(resultsContainer);
    searchContainer.appendChild(noResults);
    
    this.element.appendChild(searchContainer);
    
    this.resultsContainer = resultsContainer;
    this.noResults = noResults;
    
    // Initialize loading indicator
    this.loadingIndicator = new LoadingIndicator('spinner');
    
    // Load results
    await this.loadSearchResults();
  }

  switchSearchMethod(method) {
    if (this.activeMethod === method) return;
    
    this.activeMethod = method;
    this.results = [];
    this.page = 1;
    this.hasMore = true;
    
    // Update active button styles
    const buttons = this.element.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.textContent === this.searchMethods.find(m => m.name === method).label);
    });
    
    // Clear results container
    while (this.resultsContainer.firstChild) {
      this.resultsContainer.removeChild(this.resultsContainer.firstChild);
    }
    
    // Load new results
    this.loadSearchResults();
  }

  async loadSearchResults() {
    if (this.isLoading || !this.hasMore) return;
    
    this.isLoading = true;
    
    // Show loading indicator
    this.loadingIndicator.show(this.resultsContainer, 'Searching...');
    
    try {
      let results = [];
      
      switch (this.activeMethod) {
        case 'similar-accounts':
          // Usa SearchService per cercare account simili
          const response = await searchService.search({
            query: this.query,
            method: 'similar-accounts',
            page: this.page,
            limit: 20
          });
          
          results = response.results || [];
          this.hasMore = response.hasMore;
          break;
          
        case 'by-tag':
          // Per ora, mantieni il codice esistente
          results = await steemService.getPosts({
            tag: this.query.replace(/[^a-zA-Z0-9-]/g, ''),
            limit: 20,
            start_author: this.page > 1 && this.results.length > 0 ? this.results[this.results.length - 1].author : '',
            start_permlink: this.page > 1 && this.results.length > 0 ? this.results[this.results.length - 1].permlink : ''
          });
          break;
          
        case 'by-author':
          // Search by author
          results = await steemService.getPostsByAuthor({
            author: this.query.replace(/[@\s]/g, ''),
            limit: 20,
            start_permlink: this.page > 1 && this.results.length > 0 ? this.results[this.results.length - 1].permlink : ''
          });
          break;
          
        case 'recent':
          // Get recent posts that might match the query text
          results = await steemService.getPostsFromAll({
            limit: 40
          });
          
          // Filter by title or content containing the query
          const searchTerms = this.query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
          if (searchTerms.length > 0) {
            results = results.filter(post => {
              const title = post.title?.toLowerCase() || '';
              const body = post.body?.toLowerCase() || '';
              
              return searchTerms.some(term => 
                title.includes(term) || body.includes(term)
              );
            });
          }
          
          // Limit to 20 posts after filtering
          results = results.slice(0, 20);
          break;
      }
      
      if (!results || results.length === 0) {
        this.hasMore = false;
        
        if (this.page === 1) {
          // Auto-switch del metodo di ricerca se non ci sono risultati
          if (this.activeMethod === 'by-tag') {
            // Prova a cercare account simili se la ricerca per tag fallisce
            this.switchSearchMethod('similar-accounts');
            return;
          } else if (this.activeMethod === 'similar-accounts' && !this.query.startsWith('@')) {
            // Prova la ricerca recente se anche la ricerca di account fallisce
            this.switchSearchMethod('recent');
            return;
          } else {
            this.noResults.style.display = 'block';
          }
        }
      } else {
        // Concatena i risultati solo se è la prima pagina o i risultati non sono vuoti
        if (this.page === 1) {
          this.results = results;
        } else {
          this.results = [...this.results, ...results];
        }
        
        this.renderResults();
        this.page++;
      }
      
    } catch (error) {
      console.error('Search failed:', error);
      this.handleSearchError(error);
    } finally {
      this.isLoading = false;
      this.loadingIndicator.hide();
    }
  }
  
  handleSearchError(error) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'search-error';
    errorMessage.textContent = `Error searching: ${error.message || 'Unknown error'}`;
    
    this.resultsContainer.appendChild(errorMessage);
  }

  renderResults() {
    if (this.results.length === 0) {
      this.noResults.style.display = 'block';
      return;
    }
    
    this.noResults.style.display = 'none';
    
    this.results.forEach(item => {
      let resultItem;
      
      // Determina il tipo di risultato in base al metodo di ricerca attivo
      if (this.activeMethod === 'similar-accounts') {
        resultItem = this.createAccountResultItem(item);
      } else {
        resultItem = this.createResultItem(item);
      }
      
      this.resultsContainer.appendChild(resultItem);
    });
    
    // Add infinite scroll if needed
    if (this.hasMore) {
      this.setupInfiniteScroll();
    }
  }

  createResultItem(post) {
    // Extract post metadata
    const { author, permlink, title, created, body } = post;
    
    // Generate thumbnail URL if available, otherwise use a placeholder
    let thumbnailUrl = 'assets/img/placeholder.png';
    
    // Try to extract the first image from the post body
    const imgMatch = body && body.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif))/i);
    if (imgMatch && imgMatch[0]) {
      thumbnailUrl = imgMatch[0];
    } else if (post.json_metadata) {
      try {
        const metadata = typeof post.json_metadata === 'string' 
          ? JSON.parse(post.json_metadata) 
          : post.json_metadata;
        
        if (metadata.image && metadata.image.length > 0) {
          thumbnailUrl = metadata.image[0];
        }
      } catch (e) {
        console.warn('Failed to parse post metadata', e);
      }
    }
    
    // Create search result item
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    // Add click handler to navigate to post
    resultItem.addEventListener('click', () => {
      router.navigate(`/@${author}/${permlink}`);
    });
    
    // Author info
    const authorContainer = document.createElement('div');
    authorContainer.className = 'result-author';
    
    const authorAvatar = document.createElement('img');
    authorAvatar.className = 'author-avatar small';
    authorAvatar.src = `https://steemitimages.com/u/${author}/avatar`;
    authorAvatar.alt = author;
    
    const authorName = document.createElement('div');
    authorName.className = 'author-name';
    authorName.textContent = `@${author}`;
    
    const postDate = document.createElement('div');
    postDate.className = 'post-date';
    postDate.textContent = new Date(created).toLocaleDateString();
    
    authorContainer.appendChild(authorAvatar);
    authorContainer.appendChild(authorName);
    authorContainer.appendChild(postDate);
    
    // Content preview
    const contentPreview = document.createElement('div');
    contentPreview.className = 'result-content';
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'result-thumbnail';
    thumbnail.style.backgroundImage = `url(${thumbnailUrl})`;
    
    const contentText = document.createElement('div');
    contentText.className = 'result-text';
    
    const postTitle = document.createElement('h3');
    postTitle.className = 'result-title';
    postTitle.textContent = title || '(Untitled)';
    
    // Create excerpt from body
    const excerpt = document.createElement('p');
    excerpt.className = 'result-excerpt';
    
    // Strip HTML tags and limit length for the excerpt
    let plainText = body?.replace(/<[^>]*>?/gm, '') || '';
    plainText = plainText.replace(/\n/g, ' ').trim();
    excerpt.textContent = plainText.length > 140 
      ? plainText.substring(0, 140) + '...' 
      : plainText;
    
    contentText.appendChild(postTitle);
    contentText.appendChild(excerpt);
    
    contentPreview.appendChild(thumbnail);
    contentPreview.appendChild(contentText);
    
    // Assemble result item
    resultItem.appendChild(authorContainer);
    resultItem.appendChild(contentPreview);
    
    return resultItem;
  }

  createAccountResultItem(account) {
    // Considera che ora account.profile è già estratto in SearchService
    const { name, profile = {} } = account;
    
    console.log('Creating account result for:', name, profile);
    
    // Create account result item
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item account-result';
    
    // Aggiungi un badge per indicare che è un account
    const typeBadge = document.createElement('div');
    typeBadge.className = 'result-type-badge badge-account';
    typeBadge.textContent = 'ACCOUNT';
    resultItem.appendChild(typeBadge);
    
    // Add click handler to navigate to profile
    resultItem.addEventListener('click', () => {
      router.navigate(`/@${name}`);
    });
    
    // Account header with avatar
    const accountHeader = document.createElement('div');
    accountHeader.className = 'account-header';
    
    // Avatar
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'account-avatar-container';
    
    const avatar = document.createElement('img');
    avatar.className = 'account-avatar';
    avatar.src = `https://images.hive.blog/u/${name}/avatar`;
    avatar.alt = name;
    avatar.onerror = () => {
      // Fallback to default avatar
      avatar.src = 'assets/img/default_avatar.png';
    };
    avatarContainer.appendChild(avatar);
    
    // Account info
    const accountInfo = document.createElement('div');
    accountInfo.className = 'account-info';
    
    const accountName = document.createElement('h3');
    accountName.className = 'account-name';
    accountName.textContent = `@${name}`;
    
    // Display name if available
    const displayName = document.createElement('div');
    displayName.className = 'account-display-name';
    displayName.textContent = profile.name || '';
    
    accountInfo.appendChild(accountName);
    accountInfo.appendChild(displayName);
    accountHeader.appendChild(avatarContainer);
    accountHeader.appendChild(accountInfo);
    
    // Account details section
    const accountDetails = document.createElement('div');
    accountDetails.className = 'account-details';
    
    // About section if available
    if (profile.about) {
      const about = document.createElement('p');
      about.className = 'account-about';
      
      // Strip HTML tags and limit length for the excerpt
      let plainText = profile.about.replace(/<[^>]*>?/gm, '') || '';
      plainText = plainText.replace(/\n/g, ' ').trim();
      about.textContent = plainText.length > 140 
        ? plainText.substring(0, 140) + '...' 
        : plainText;
      
      accountDetails.appendChild(about);
    }
    
    // Location if available
    if (profile.location) {
      const location = document.createElement('div');
      location.className = 'account-location';
      
      const locationIcon = document.createElement('span');
      locationIcon.className = 'material-icons location-icon';
      locationIcon.textContent = 'location_on';
      
      location.appendChild(locationIcon);
      location.appendChild(document.createTextNode(profile.location));
      accountDetails.appendChild(location);
    }
    
    // Assemble result item
    resultItem.appendChild(accountHeader);
    resultItem.appendChild(accountDetails);
    
    return resultItem;
  }

  setupInfiniteScroll() {
    // Simple intersection observer for infinite scroll
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.isLoading) {
        this.loadSearchResults();
      }
    });
    
    // Observe the last child
    if (this.resultsContainer.lastChild) {
      observer.observe(this.resultsContainer.lastChild);
    }
  }
}

export default SearchView;
