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
    const options = {
      root: null, // use viewport as root
      rootMargin: '100px', // Correzione: aggiungi unità (px o %)
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loading) {
          this.loading = true;
          
          this.loadMore()
            .then(hasMore => {
              this.loading = false;
              
              // Rimuovi l'observer se non ci sono altri elementi da caricare
              if (!hasMore) {
                this.observer.disconnect();
                console.log('InfiniteScroll: No more content to load, disconnecting observer');
              }
            })
            .catch(error => {
              console.error('InfiniteScroll loading error:', error);
              this.loading = false;
            });
        }
      });
    }, options);

    // Crea e osserva un target alla fine del container
    this.observerTarget = document.createElement('div');
    this.observerTarget.className = 'infinite-scroll-target';
    this.container.appendChild(this.observerTarget);
    
    this.observer.observe(this.observerTarget);
    console.log('Observer target added to container:', this.observerTarget);
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
        
        // Check if we already have an end message
        const existingEndMessage = this.container.querySelector('.end-message');
        if (!existingEndMessage) {
          // Show end message
          const endMessage = document.createElement('div');
          endMessage.className = 'end-message';
          endMessage.textContent = 'No more posts to load';
          endMessage.style.textAlign = 'center';
          endMessage.style.padding = '20px';
          this.container.appendChild(endMessage);
        }
        
        // Remove observer target since we don't need it anymore
        if (this.observerTarget && this.observerTarget.parentNode) {
          this.observerTarget.remove();
        }
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
