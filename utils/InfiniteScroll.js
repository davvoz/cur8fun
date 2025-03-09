export default class InfiniteScroll {
  constructor({
    container,
    loadMore,
    threshold = '200px',
    initialPage = 1
  }) {
    this.container = container;
    this.loadMore = loadMore;
    this.threshold = threshold;
    this.currentPage = initialPage;
    this.isLoading = false;
    this.hasMore = true;
    this.observer = null;
    this.observerTarget = null;
    
    console.log('InfiniteScroll initialized with container:', container);
    this.setupObserver();
  }

  setupObserver() {
    // Remove any existing observer target
    if (this.observerTarget) {
      this.observerTarget.remove();
    }
    
    // Create and add new observer target
    this.observerTarget = document.createElement('div');
    this.observerTarget.className = 'observer-target';
    this.observerTarget.style.height = '20px';
    this.observerTarget.style.width = '100%';
    this.observerTarget.style.margin = '20px 0';
    this.container.appendChild(this.observerTarget);
    
    console.log('Observer target added to container:', this.observerTarget);

    // Clean up any existing observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Create new intersection observer
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isLoading && this.hasMore) {
          console.log('Observer target is intersecting, loading more items');
          this.loadNextPage();
        }
      },
      { 
        rootMargin: this.threshold,
        threshold: 0.1 
      }
    );

    this.observer.observe(this.observerTarget);
    console.log('IntersectionObserver started observing target');
  }

  async loadNextPage() {
    if (this.isLoading || !this.hasMore) return;
    
    try {
      console.log(`Loading page ${this.currentPage+1}`);
      this.isLoading = true;
      
      // Create loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.textContent = 'Loading more...';
      loadingIndicator.style.textAlign = 'center';
      loadingIndicator.style.padding = '10px';
      this.container.appendChild(loadingIndicator);
      
      // Load more content
      const hasMoreItems = await this.loadMore(this.currentPage + 1);
      console.log(`Loaded page ${this.currentPage+1}, has more: ${hasMoreItems}`);
      
      // Remove loading indicator
      if (loadingIndicator.parentNode) {
        loadingIndicator.remove();
      }
      
      // Update state
      this.hasMore = Boolean(hasMoreItems);
      if (this.hasMore) {
        this.currentPage++;
        
        // Reposition the observer target at the end of the container
        if (this.observerTarget && this.observerTarget.parentNode) {
          this.container.appendChild(this.observerTarget);
        }
      } else {
        console.log('No more items to load');
        // Show end message
        const endMessage = document.createElement('div');
        endMessage.className = 'end-message';
        endMessage.textContent = 'No more posts to load';
        endMessage.style.textAlign = 'center';
        endMessage.style.padding = '20px';
        this.container.appendChild(endMessage);
      }
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      this.isLoading = false;
    }
  }

  destroy() {
    console.log('Destroying infinite scroll');
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.observerTarget && this.observerTarget.parentNode) {
      this.observerTarget.remove();
      this.observerTarget = null;
    }
  }

  reset() {
    console.log('Resetting infinite scroll');
    this.currentPage = 1;
    this.hasMore = true;
    this.isLoading = false;
    this.setupObserver();
  }
}
