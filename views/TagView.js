import steemService from '../services/SteemService.js';
import BasePostView from './BasePostView.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';

class TagView extends BasePostView {
    constructor(params) {
        super(params);
        this.tag = this.params.tag || '';
        
        if (!this.tag) {
            console.error('No tag provided to TagView');
        }
    }
    
    async loadPosts(page = 1) {
        if (page === 1) {
            this.loading = true;
            this.posts = [];
            this.renderedPostIds.clear();
            this.renderPosts();
        }
        
        try {
            if (!this.tag) {
                throw new Error('No tag specified');
            }
            
            console.log(`Loading posts for tag: ${this.tag}, page: ${page}`);
            const result = await steemService.getPostsByTag(this.tag, page);
            
            // Check if result has the expected structure
            if (!result || !result.posts) {
                console.warn('Invalid result from getPostsByTag:', result);
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
                } else {
                    console.log('No new unique posts in this batch.');
                }
            }
            
            return hasMore;
        } catch (error) {
            console.error('Error loading posts for tag:', error);
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
    
    renderNoPostsMessage(container) {
        const noPostsMessage = document.createElement('div');
        noPostsMessage.className = 'no-posts-message';
        noPostsMessage.innerHTML = `
            <h3>No posts found</h3>
            <p>No posts found with the tag #${this.tag}.</p>
            <a href="/" class="btn-primary">Back to Home</a>
        `;
        container.appendChild(noPostsMessage);
    }
    
    render(container) {
        const { postsContainer } = this.renderBaseView(
            container,
            `#${this.tag} Posts`
        );
        
        // Load posts
        this.loadPosts(1).then(hasMore => {
            // Initialize infinite scroll
            if (postsContainer) {
                console.log('Initializing infinite scroll for TagView');
                this.infiniteScroll = new InfiniteScroll({
                    container: postsContainer,
                    loadMore: (page) => this.loadPosts(page),
                    threshold: '200px'
                });
            }
        }).catch(error => {
            console.error('Error loading initial posts:', error);
            this.handleLoadError();
        });
    }
}

export default TagView;
