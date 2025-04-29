import steemService from '../services/SteemService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import eventEmitter from '../utils/EventEmitter.js'; // Aggiungiamo importazione per mostrare notifiche

/**
 * View dedicata per mostrare i post più recenti (New Releases)
 * Questa vista è separata da HomeView per garantire che mostri sempre 
 * i post più recenti, indipendentemente dalle preferenze dell'utente
 */
class NewReleasesView extends BasePostView {
  constructor(params) {
    super(params);
    this.tag = 'created'; // Impostiamo sempre il tag 'created' per mostrare i post più recenti
    console.log('🚀 NewReleasesView costruita - Questa è la vista per i post più recenti');
    
    // Emettiamo una notifica per confermare che la vista è stata caricata correttamente
    setTimeout(() => {
      eventEmitter.emit('notification', {
        type: 'info',
        message: 'Stai visualizzando i post più recenti',
        duration: 3000
      });
    }, 500);
  }

  async loadPosts(page = 1) {
    if (page === 1) {
      this.loading = true;
      this.posts = [];
      this.renderedPostIds.clear();
      this.renderPosts();
      
      // Reset infinite scroll if it exists
      if (this.infiniteScroll) {
        this.infiniteScroll.reset(1);
      }
    }
    
    try {
      // Usiamo direttamente getNewPosts per avere i post più recenti
      const result = await steemService.getNewPosts(page);
      console.log('🆕 Caricati nuovi post nella NewReleasesView:', result?.posts?.length || 0);
      
      // Check if result has the expected structure
      if (!result || !result.posts) {
        return false;
      }
      
      const { posts, hasMore } = result;
      
      // Filter out any duplicates before adding to the post array
      if (Array.isArray(posts)) {
        const uniquePosts = posts.filter(post => {
          // Create a unique ID using author and permlink
          const postId = `${post.author}_${post.permlink}`;
          // Only include posts we haven't seen yet
          const isNew = !this.renderedPostIds.has(postId);
          return isNew;
        });
        
        if (uniquePosts.length > 0) {
          this.posts = [...this.posts, ...uniquePosts];
          this.renderPosts(page > 1);
        }
      }
      
      return hasMore;
    } catch (error) {
      console.error('Failed to load recent posts:', error);
      this.handleLoadError();
      return false;
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }
  
  getCurrentTag() {
    return this.tag;
  }

  render(container) {
    console.log('📋 Rendering NewReleasesView');
    
    const { postsContainer } = this.renderBaseView(
      container,
      'New Releases', // Titolo modificato con emoji per renderlo visivamente distinguibile
      { showSearchForm: false }
    );
 
    postsContainer.innerHTML = ''; // Clear previous posts
    
    this.postsContainer = postsContainer;
    this.postsContainer.classList.add('new-releases-view'); // Aggiungiamo una classe per lo stile


    
    // Destroy existing infinite scroll if it exists
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
    }
    
    // Load first page of posts
    this.loadPosts(1).then((hasMore) => {
      // Initialize infinite scroll after first page loads
      if (postsContainer) {
        this.infiniteScroll = new InfiniteScroll({
          container: postsContainer,
          loadMore: (page) => this.loadPosts(page),
          threshold: '200px',
          loadingMessage: 'Loading more posts...',
          endMessage: 'No more new posts to load',
          errorMessage: 'Failed to load posts. Please check your connection.'
        });
      }
    });
  }
  
  onBeforeUnmount() {
    // Clean up infinite scroll when switching views
    if (this.infiniteScroll) {
      this.infiniteScroll.destroy();
      this.infiniteScroll = null;
    }
  }
}

export default NewReleasesView;