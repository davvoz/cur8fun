import profileService from '../../services/ProfileService.js';

export default class ReplyLoader {
  constructor(username) {
    this.username = username;
    this.loading = false;
    this.allReplies = [];
    this.pageSize = 20;
    this.hasMoreReplies = true;
    this.lastFetchedPage = 0;
  }

  async loadReplies(limit = 20, page = 1) {
    if (this.loading) return this.allReplies;
    this.loading = true;

    try {
      const replies = await profileService.getUserReplies(this.username, limit, page, {
        forceRefresh: false
      });

      if (replies && Array.isArray(replies)) {
        if (page === 1) {
          this.allReplies = replies;
        } else {
          const existingIds = new Set(
            this.allReplies.map(r => `${r.author}_${r.permlink}`)
          );
          const newReplies = replies.filter(
            r => !existingIds.has(`${r.author}_${r.permlink}`)
          );
          this.allReplies = [...this.allReplies, ...newReplies];
        }

        this.lastFetchedPage = page;
        this.hasMoreReplies = replies.length >= limit;
        if (replies.length < limit) this.hasMoreReplies = false;
      } else {
        this.hasMoreReplies = false;
      }

      return page === 1 ? this.allReplies : replies;
    } catch (error) {
      console.error('[ReplyLoader] Error loading replies:', error);
      return [];
    } finally {
      this.loading = false;
    }
  }

  async loadMoreReplies(page) {
    if (!this.hasMoreReplies || page <= this.lastFetchedPage) return [];
    return this.loadReplies(this.pageSize, page);
  }

  hasMore() {
    return this.hasMoreReplies;
  }

  reset() {
    this.loading = false;
    this.allReplies = [];
    this.lastFetchedPage = 0;
    this.hasMoreReplies = true;
    return this;
  }
}
