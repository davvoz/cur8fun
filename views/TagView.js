import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import eventEmitter from '../utils/EventEmitter.js';
import InfiniteScroll from '../utils/InfiniteScroll.js';
import GridController from '../components/GridController.js';
import ContentRenderer from '../components/ContentRenderer.js';
import router from '../utils/Router.js';

class TagView {
    constructor(params) {
        this.params = params || {};
        this.tag = this.params.tag || '';
        
        if (!this.tag) {
            console.error('No tag provided to TagView');
        }
        
        this.posts = [];
        this.loading = false;
        this.loadingIndicator = new LoadingIndicator();
        this.infiniteScroll = null;
        this.renderedPostIds = new Set();
        this.gridController = new GridController({
            targetSelector: '.posts-container'
        });
        
        // Initialize SteemContentRenderer for image extraction
        this.initSteemRenderer();
    }
    
    /**
     * Initialize SteemContentRenderer for image extraction
     */
    async initSteemRenderer() {
        try {
            await ContentRenderer.loadSteemContentRenderer();
            this.contentRenderer = new ContentRenderer({
                useSteemContentRenderer: true,
                extractImages: true,
                renderImages: true
            });
        } catch (error) {
            console.error('Failed to initialize SteemContentRenderer:', error);
            this.contentRenderer = null;
        }
    }
    
    /**
     * Render the view
     */
    async render(container) {
        this.container = container;
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        
        // Create header area with title and grid controls
        const headerArea = document.createElement('div');
        headerArea.className = 'header-area';
        
        // Create heading with tag name
        const heading = document.createElement('h1');
        heading.textContent = `#${this.tag} Posts`;
        headerArea.appendChild(heading);
        
        // Create grid controller container
        const gridControllerContainer = document.createElement('div');
        gridControllerContainer.className = 'grid-controller-container';
        headerArea.appendChild(gridControllerContainer);
        
        contentWrapper.appendChild(headerArea);
        
        // Create tag selection bar (similar to HomeView)
        const tagSelectionBar = this.createTagSelectionBar();
        contentWrapper.appendChild(tagSelectionBar);
        
        // Create posts container
        const postsContainer = document.createElement('div');
        postsContainer.className = 'posts-container';
        
        // Add to content wrapper
        contentWrapper.appendChild(postsContainer);
        
        // Add to container
        container.appendChild(contentWrapper);
        
        // Initialize grid controller
        this.gridController.render(gridControllerContainer);
        
        // Show loading indicator while posts are loading
        this.loadingIndicator.show(postsContainer);
        
        // Load posts
        try {
            await this.loadPosts(1);
            
            // Initialize infinite scroll
            if (postsContainer) {
                console.log('Initializing infinite scroll for TagView');
                this.infiniteScroll = new InfiniteScroll({
                    container: postsContainer,
                    loadMore: (page) => this.loadPosts(page),
                    threshold: '200px'
                });
            }
        } catch (error) {
            console.error('Error loading initial posts:', error);
            this.handleLoadError();
        }
    }
    
    /**
     * Load posts for the tag
     */
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
    
    /**
     * Handle load errors
     */
    handleLoadError() {
        eventEmitter.emit('notification', {
            type: 'error',
            message: 'Failed to load posts. Please try again later.'
        });
        
        const postsContainer = this.container?.querySelector('.posts-container');
        if (!postsContainer) return;
        
        this.clearContainer(postsContainer);
        const errorElement = this.createErrorElement();
        postsContainer.appendChild(errorElement);
    }
    
    /**
     * Create error element
     */
    createErrorElement() {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        
        const errorHeading = document.createElement('h3');
        errorHeading.textContent = 'Failed to load posts';
        
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'There was an error loading posts for this tag.';
        
        const retryButton = document.createElement('button');
        retryButton.className = 'btn-primary retry-btn';
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', () => this.loadPosts());
        
        errorDiv.append(errorHeading, errorMessage, retryButton);
        return errorDiv;
    }
    
    /**
     * Clear container
     */
    clearContainer(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }
    
    /**
     * Render posts
     */
    renderPosts(append = false) {
        const postsContainer = this.container?.querySelector('.posts-container');
        
        if (!postsContainer) return;
        
        if (!append) {
            this.clearContainer(postsContainer);
            this.renderedPostIds.clear();
        }
        
        // Calculate which posts to render
        let postsToRender = [];
        if (append) {
            // When appending, get only the new posts
            const currentPostCount = postsContainer.querySelectorAll('.post-card').length;
            postsToRender = this.posts.slice(currentPostCount);
        } else {
            // When not appending (fresh render), get all posts
            postsToRender = this.posts;
        }
        
        console.log(`Rendering ${postsToRender.length} posts (append: ${append})`);
        
        // Filter out any duplicates that might have slipped through
        const uniquePostsToRender = postsToRender.filter(post => {
            const postId = `${post.author}_${post.permlink}`;
            if (this.renderedPostIds.has(postId)) {
                return false;
            }
            this.renderedPostIds.add(postId);
            return true;
        });
        
        console.log(`Rendering ${uniquePostsToRender.length} unique posts`);
        
        if (uniquePostsToRender.length === 0 && this.posts.length === 0) {
            // If no posts at all, show message
            const noPostsMessage = document.createElement('div');
            noPostsMessage.className = 'no-posts-message';
            noPostsMessage.innerHTML = `
                <h3>No posts found</h3>
                <p>No posts found with the tag #${this.tag}.</p>
                <a href="/" class="btn-primary">Back to Home</a>
            `;
            postsContainer.appendChild(noPostsMessage);
            return;
        }
        
        // Import HomeView's renderPostCard directly for simplicity
        // In a real app, this should be extracted to a shared component
        uniquePostsToRender.forEach(post => this.renderPostCard(post, postsContainer));
    }
    
    // Import all the post rendering methods from HomeView
    // For brevity, we'll reference them from a HomeView instance
    // or create a shared PostCard component in a production app
    // Here we'll just add a simple implementation
    
    /**
     * Create a tag selection bar with tag input and popular tags
     */
    createTagSelectionBar() {
        const tagBarContainer = document.createElement('div');
        tagBarContainer.className = 'tag-selection-bar';
        
        // Create scrollable area for tag pills
        const tagScrollArea = document.createElement('div');
        tagScrollArea.className = 'tag-scroll-area';
        
        // Add popular tags
        const popularTags = [
            'trending', 'hot', 'new', 'photography', 'art', 'travel', 
            'food', 'music', 'gaming', 'life', 'blockchain', 'crypto'
        ];
        
        // Add popular tag pills
        popularTags.forEach(tag => {
            const tagPill = this.createTagPill(tag);
            tagScrollArea.appendChild(tagPill);
        });
        
        // Add custom tag input
        const customTagContainer = document.createElement('div');
        customTagContainer.className = 'custom-tag-container';
        
        const customTagInput = document.createElement('input');
        customTagInput.type = 'text';
        customTagInput.placeholder = 'Enter custom tag...';
        customTagInput.className = 'custom-tag-input';
        customTagInput.value = this.tag; // Pre-fill with current tag
        
        const searchButton = document.createElement('button');
        searchButton.className = 'custom-tag-button';
        searchButton.innerHTML = '<span class="material-icons">search</span>';
        
        // Handle custom tag search
        searchButton.addEventListener('click', () => {
            const customTag = customTagInput.value.trim().toLowerCase();
            if (customTag) {
                this.navigateToTag(customTag);
            }
        });
        
        // Also handle Enter key
        customTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const customTag = customTagInput.value.trim().toLowerCase();
                if (customTag) {
                    this.navigateToTag(customTag);
                }
            }
        });
        
        // Add smooth scrolling for the active tag
        this.addActiveTagScrolling(tagScrollArea);
        
        customTagContainer.appendChild(customTagInput);
        customTagContainer.appendChild(searchButton);
        
        // Add elements to container
        tagBarContainer.appendChild(tagScrollArea);
        tagBarContainer.appendChild(customTagContainer);
        
        return tagBarContainer;
    }
    
    /**
     * Add scrolling to make active tag visible
     */
    addActiveTagScrolling(scrollContainer) {
        // Wait for the next frame when elements are rendered
        setTimeout(() => {
            const activeTag = scrollContainer.querySelector('.tag-pill.active');
            if (activeTag) {
                // Calculate position to center the active tag
                const containerWidth = scrollContainer.offsetWidth;
                const tagWidth = activeTag.offsetWidth;
                const tagLeft = activeTag.offsetLeft;
                const scrollPosition = tagLeft - (containerWidth / 2) + (tagWidth / 2);
                
                // Scroll to position smoothly
                scrollContainer.scrollTo({
                    left: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                });
            }
        }, 100);
    }
    
    /**
     * Creates a pill-style button for a tag
     */
    createTagPill(tag) {
        const pill = document.createElement('button');
        pill.className = 'tag-pill';
        pill.textContent = this.formatTagName(tag);
        
        // Highlight the active tag
        if (tag === this.tag) {
            pill.classList.add('active');
        }
        
        // Add click handler to navigate to tag
        pill.addEventListener('click', () => {
            this.navigateToTag(tag);
        });
        
        return pill;
    }
    
    /**
     * Format tag name for display (capitalize first letter)
     */
    formatTagName(tag) {
        return tag.charAt(0).toUpperCase() + tag.slice(1);
    }
    
    /**
     * Navigate to a specific tag
     */
    navigateToTag(tag) {
        if (tag === 'trending' || tag === 'hot' || tag === 'new' || tag === 'promoted') {
            router.navigate(`/${tag}`);
        } else {
            router.navigate(`/tag/${tag}`);
        }
    }
    
    // Import renderPostCard and other necessary post rendering methods from HomeView
    // For brevity, we'll reference an example implementation
    renderPostCard(post, container) {
        // Create a basic post card - in real implementation, this should be shared with HomeView
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        
        // Parse metadata
        const metadata = this.parseMetadata(post.json_metadata);
        
        // Basic author and title
        const author = document.createElement('div');
        author.className = 'post-author';
        author.textContent = `@${post.author}`;
        
        const title = document.createElement('div');
        title.className = 'post-title';
        title.textContent = post.title;
        
        // Basic content
        const content = document.createElement('div');
        content.className = 'post-content';
        
        // Extract a short excerpt
        const excerpt = document.createElement('div');
        excerpt.className = 'post-excerpt';
        excerpt.textContent = this.createExcerpt(post.body);
        
        // Add to container
        content.append(title, excerpt);
        postCard.append(author, content);
        
        // Evento click - navigate to post
        postCard.addEventListener('click', (e) => {
            e.preventDefault();
            const postUrl = `/@${post.author}/${post.permlink}`;
            router.navigate(postUrl);
        });
        
        container.appendChild(postCard);
    }
    
    // Utilities
    parseMetadata(jsonMetadata) {
        try {
            if (typeof jsonMetadata === 'string') {
                return JSON.parse(jsonMetadata);
            }
            return jsonMetadata || {};
        } catch (e) {
            return {};
        }
    }
    
    createExcerpt(body, maxLength = 150) {
        if (!body) return '';
        
        // Simple text extraction
        const plainText = body
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .replace(/#{1,6}\s/g, '')
            .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2')
            .replace(/(\*|_)(.*?)(\*|_)/g, '$2')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\n\n/g, ' ')
            .replace(/\n/g, ' ')
            .trim();
        
        // Truncate if needed
        if (plainText.length <= maxLength) {
            return plainText;
        }
        
        return plainText.substring(0, maxLength) + '...';
    }
    
    unmount() {
        if (this.infiniteScroll) {
            this.infiniteScroll.destroy();
            this.infiniteScroll = null;
        }
        
        if (this.gridController) {
            this.gridController.unmount();
        }
    }
}

export default TagView;
