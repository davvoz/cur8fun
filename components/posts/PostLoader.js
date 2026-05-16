import profileService from '../../services/ProfileService.js';
import reblogService from '../../services/ReblogService.js';

export default class PostLoader {
  constructor(username, mode = 'blog') {
    this.username = username;
    this.mode = mode; // 'blog' = getDiscussionsByBlog (blog + reblogs); 'posts' = all author posts, no reblogs
    this.loading = false;
    this.postsData = null;
    this.allPosts = [];
    this.estimatedTotalPosts = 0;
    this.pageSize = 20;
    this.hasMorePosts = true;
    this.lastFetchedPage = 0;
  }

  async loadPosts(limit = 20, page = 1) {
    if (this.loading) return this.allPosts;
    this.loading = true;

    try {
      const normalizedUsername = String(this.username || '').toLowerCase();
      let fetchPage = page;
      let visiblePosts = [];
      let rawCount = 0;

      // In blog mode, continue until we find at least one visible blog item
      // or until there are no more raw results.
      while (true) {
        let posts;

        if (this.mode === 'posts') {
          posts = await profileService.getUserAuthorPosts(this.username, limit, fetchPage, {
            forceRefresh: page === 1 && fetchPage === 1,
            timeout: 15000
          });
        } else {
          // default: 'blog' mode (blog posts + reblogs)
          posts = await profileService.getUserPosts(this.username, limit, fetchPage, {
            forceRefresh: page === 1 && fetchPage === 1,
            timeout: 15000
          });
        }

        if (!posts || !Array.isArray(posts)) {
          this.hasMorePosts = false;
          visiblePosts = [];
          break;
        }

        // Save raw count before filtering to correctly determine hasMore
        rawCount = posts.length;
        visiblePosts = posts;

        // In 'blog' mode, exclude the user's own community posts (keep reblogs + non-community originals)
        if (this.mode === 'blog') {
          const hasUserReblogMarker = (post) => {
            const hasRebloggedByArray = Array.isArray(post?.reblogged_by)
              && post.reblogged_by.some(account => String(account || '').toLowerCase() === normalizedUsername);
            if (hasRebloggedByArray) return true;

            // Some nodes expose only first_reblogged_by on blog entries.
            const firstReblogger = String(post?.first_reblogged_by || '').toLowerCase();
            if (firstReblogger && firstReblogger === normalizedUsername) return true;

            return false;
          };

          // Debug counters
          let debugMarkerCount = 0;
          let debugAuthorMismatchCount = 0;
          let debugNonCommunityCount = 0;
          let debugCommunityCheckCount = 0;
          let debugCommunityRebloggedCount = 0;
          let debugCommunityRejectedCount = 0;

          // Track which posts to include, preserving original order
          const inclusionMap = new Map(); // index -> boolean (true=include)
          const pendingChecks = []; // { index, post }

          for (let i = 0; i < posts.length; i++) {
            const post = posts[i];

            // Explicit reblog by this user (includes self-reblogs): always show
            if (hasUserReblogMarker(post)) {
              inclusionMap.set(i, true);
              debugMarkerCount++;
              continue;
            }

            // Reblog detected by author mismatch (fallback when reblogged_by is absent): always show
            if (String(post.author || '').toLowerCase() !== normalizedUsername) {
              inclusionMap.set(i, true);
              debugAuthorMismatchCount++;
              continue;
            }

            // Own original post: show only if it's NOT a community post
            const parentPermlink = String(post.parent_permlink || post.category || '');
            const isCommunityPost = parentPermlink.startsWith('hive-');
            if (!isCommunityPost) {
              inclusionMap.set(i, true);
              debugNonCommunityCount++;
              continue;
            }

            // Own community post without reblog marker: need to check if it's actually a self-reblog.
            // This handles cases where the node omits reblogged_by for community posts.
            debugCommunityCheckCount++;
            pendingChecks.push({
              index: i,
              post
            });
          }
          // Resolve pending checks for ambiguous community posts
          if (pendingChecks.length > 0) {
            for (const check of pendingChecks) {
              // Sequential checks are slower but much more reliable on public APIs
              // than firing dozens of concurrent requests.
              const hasReblogged = await reblogService.hasReblogged(
                this.username,
                check.post.author,
                check.post.permlink,
                { failOpen: true }
              );

              if (hasReblogged) {
                debugCommunityRebloggedCount++;
              } else {
                debugCommunityRejectedCount++;
              }

              inclusionMap.set(check.index, hasReblogged);
            }
          }
          // Rebuild visiblePosts in original order
          visiblePosts = [];
          for (let i = 0; i < posts.length; i++) {
            if (inclusionMap.get(i) === true) {
              visiblePosts.push(posts[i]);
            }
          }

          console.log(`[Blog Filter] Page ${fetchPage}: raw=${posts.length}, marker=${debugMarkerCount}, mismatch=${debugAuthorMismatchCount}, nonComm=${debugNonCommunityCount}, commCheck=${debugCommunityCheckCount}, commReblogged=${debugCommunityRebloggedCount}, commRejected=${debugCommunityRejectedCount}, visible=${visiblePosts.length}`);
        }

        this.hasMorePosts = rawCount >= limit;

        // For posts mode (no extra filtering) one fetch is enough.
        // For blog mode keep going until we have visible posts or no more content.
        if (this.mode !== 'blog' || visiblePosts.length > 0 || !this.hasMorePosts) {
          break;
        }

        fetchPage += 1;
      }

      if (page === 1) {
        // If it's the first page, reset the collection
        this.allPosts = visiblePosts;
      } else {
        // Otherwise add to existing collection
        this.allPosts = [...this.allPosts, ...visiblePosts];
      }

      this.postsData = true;
      this.estimatedTotalPosts = this.allPosts.length;
      this.lastFetchedPage = fetchPage;

      return visiblePosts;
    } catch (error) {
      console.error('Error loading posts:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }
  
  async loadMorePosts(page) {
    if (!this.hasMorePosts || page <= this.lastFetchedPage) {
      return [];
    }
    
    const newPosts = await this.loadPosts(this.pageSize, page);
    return newPosts;
  }
  
  hasMore() {
    return this.hasMorePosts;
  }

  reset() {
    this.loading = false;
    this.postsData = null;
    this.allPosts = [];
    this.lastFetchedPage = 0;
    this.hasMorePosts = true;
    this.estimatedTotalPosts = 0;
    return this;
  }
}
