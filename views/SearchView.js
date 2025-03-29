import View from './View.js';
import steemService from '../services/SteemService.js';
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
      { name: 'recent', label: 'Recent Posts' }
    ];
    this.activeMethod = 'by-tag';
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
            <li>Use <strong>@username</strong> to search for profiles</li>
            <li>Use <strong>#tag</strong> to search for tags</li>
            <li>Use <strong>hive-123</strong> for communities</li>
            <li>Or just type keywords to search posts</li>
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
    this.loadingIndicator.show(this.loadingContainer, 'Searching...');
    
    try {
      let results = [];
      
      switch (this.activeMethod) {
        case 'by-tag':
          // Search by tag
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
          if (this.activeMethod === 'by-tag') {
            // Try another search method if tag search fails
            this.switchSearchMethod('recent');
            return;
          } else {
            this.noResults.style.display = 'block';
          }
        }
      } else {
        this.results = [...this.results, ...results];
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
    
    this.results.forEach(post => {
      const resultItem = this.createResultItem(post);
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
