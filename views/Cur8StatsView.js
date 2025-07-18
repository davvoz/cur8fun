import View from './View.js';
import steemService from '../services/SteemService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import metaTagService from '../services/MetaTagService.js';
import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';

/**
 * Statistics view for posts tagged with "cur8"
 */
class Cur8StatsView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'CUR8 Statistics | cur8.fun';
    this.loadingIndicator = new LoadingIndicator();
    this.stats = null;
    this.posts = [];
    this.loading = false;
  }

  async render(element) {
    this.element = element;

    // Set meta tags for the statistics page
    metaTagService.setMetaTags({
      title: 'CUR8 Statistics - Content Performance & Analytics',
      description: 'Discover statistics and analytics for CUR8 tagged content on the blockchain. View top performing posts, community engagement, and content trends.',
      image: 'https://cur8.fun/assets/img/logo_tra.png',
      url: `${window.location.origin}/cur8-stats`,
      type: 'website'
    }, 'default');

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create main container
    const container = document.createElement('div');
    container.className = 'cur8-stats-container';

    // Create header
    this.renderHeader(container);

    // Create Content Statistics Section
    const contentStatsSection = document.createElement('section');
    contentStatsSection.className = 'stats-section';
    contentStatsSection.innerHTML = `
      <div class="section-header">
        <h2><span class="material-icons">article</span> Content Statistics</h2>
        <p>Analysis of posts tagged with #cur8 on the Steem blockchain</p>
      </div>
    `;
    const statsContent = document.createElement('div');
    statsContent.className = 'stats-content';
    contentStatsSection.appendChild(statsContent);
    container.appendChild(contentStatsSection);

    // Add loading indicator
    this.loadingIndicator.show(statsContent);

    this.element.appendChild(container);

    // Load and display statistics
    await this.loadStatistics(statsContent);
  }

  renderHeader(container) {
    const header = document.createElement('div');
    header.className = 'stats-header';
    header.innerHTML = `
      <div class="header-content">
        <div class="header-icon">
          <span class="material-icons">analytics</span>
        </div>
        <div class="header-text">
          <h1>CUR8 Statistics</h1>
          <p>Analytics and insights for CUR8 tagged content on the blockchain</p>
        </div>
      </div>
    `;
    container.appendChild(header);
  }

  async loadStatistics(container) {
    try {
      this.loading = true;

      // Fetch CUR8 tagged posts
      console.log('Loading CUR8 statistics...');
      
      // Load multiple pages to get comprehensive data
      const promises = [];
      for (let page = 1; page <= 5; page++) {
        promises.push(steemService.getPostsByTag('cur8', page, 20));
      }

      const results = await Promise.all(promises);
      
      // Combine all posts
      this.posts = [];
      results.forEach(result => {
        if (result && Array.isArray(result.posts)) {
          this.posts = [...this.posts, ...result.posts];
        }
      });

      // Remove duplicates
      this.posts = this.posts.filter((post, index, self) => 
        index === self.findIndex(p => p.author === post.author && p.permlink === post.permlink)
      );

      console.log(`Loaded ${this.posts.length} CUR8 posts for analysis`);

      // Calculate statistics
      this.stats = this.calculateStatistics(this.posts);

      // Render statistics
      this.renderStatistics(container);

    } catch (error) {
      console.error('Error loading CUR8 statistics:', error);
      this.renderError(container, error.message);
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  calculateStatistics(posts) {
    if (!posts || posts.length === 0) {
      return {
        totalPosts: 0,
        totalAuthors: 0,
        totalVotes: 0,
        totalComments: 0,
        totalPayout: 0,
        averageVotes: 0,
        averageComments: 0,
        averagePayout: 0,
        topAuthors: [],
        topPosts: [],
        recentPosts: [],
        timeDistribution: {},
        payoutDistribution: {}
      };
    }

    const stats = {
      totalPosts: posts.length,
      totalAuthors: new Set(posts.map(p => p.author)).size,
      totalVotes: 0,
      totalComments: 0,
      totalPayout: 0
    };

    // Author stats tracking
    const authorStats = {};
    const timeDistribution = {};
    const payoutRanges = {
      '0-1': 0,
      '1-5': 0,
      '5-10': 0,
      '10-50': 0,
      '50+': 0
    };

    posts.forEach(post => {
      // Vote count
      const votes = post.net_votes || post.active_votes?.length || 0;
      stats.totalVotes += votes;

      // Comment count
      const comments = parseInt(post.children) || 0;
      stats.totalComments += comments;

      // Payout calculation
      const pending = parseFloat(post.pending_payout_value?.split(' ')[0] || 0);
      const total = parseFloat(post.total_payout_value?.split(' ')[0] || 0);
      const curator = parseFloat(post.curator_payout_value?.split(' ')[0] || 0);
      const payout = pending + total + curator;
      stats.totalPayout += payout;

      // Payout distribution
      if (payout < 1) payoutRanges['0-1']++;
      else if (payout < 5) payoutRanges['1-5']++;
      else if (payout < 10) payoutRanges['5-10']++;
      else if (payout < 50) payoutRanges['10-50']++;
      else payoutRanges['50+']++;

      // Author statistics
      if (!authorStats[post.author]) {
        authorStats[post.author] = {
          posts: 0,
          totalVotes: 0,
          totalComments: 0,
          totalPayout: 0
        };
      }
      authorStats[post.author].posts++;
      authorStats[post.author].totalVotes += votes;
      authorStats[post.author].totalComments += comments;
      authorStats[post.author].totalPayout += payout;

      // Time distribution (by day of week)
      const date = new Date(post.created);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      timeDistribution[dayOfWeek] = (timeDistribution[dayOfWeek] || 0) + 1;

      // Store post data for sorting
      post._calculatedPayout = payout;
      post._voteCount = votes;
    });

    // Calculate averages
    stats.averageVotes = stats.totalPosts > 0 ? Math.round(stats.totalVotes / stats.totalPosts) : 0;
    stats.averageComments = stats.totalPosts > 0 ? Math.round(stats.totalComments / stats.totalPosts) : 0;
    stats.averagePayout = stats.totalPosts > 0 ? (stats.totalPayout / stats.totalPosts).toFixed(2) : 0;

    // Top authors (by total payout)
    stats.topAuthors = Object.entries(authorStats)
      .map(([author, data]) => ({ author, ...data }))
      .sort((a, b) => b.totalPayout - a.totalPayout)
      .slice(0, 10);

    // Top posts (by payout)
    stats.topPosts = [...posts]
      .sort((a, b) => b._calculatedPayout - a._calculatedPayout)
      .slice(0, 10);

    // Recent posts
    stats.recentPosts = [...posts]
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 10);

    stats.timeDistribution = timeDistribution;
    stats.payoutDistribution = payoutRanges;

    return stats;
  }

  renderStatistics(container) {
    container.innerHTML = '';

    if (!this.stats || this.stats.totalPosts === 0) {
      this.renderEmptyState(container);
      return;
    }

    // Overview stats
    this.renderOverviewStats(container);

    // Create Analytics & Insights Section
    const analyticsSection = document.createElement('section');
    analyticsSection.className = 'stats-section analytics-section';
    analyticsSection.innerHTML = `
      <div class="section-header">
        <h2><span class="material-icons">insights</span> Analytics & Insights</h2>
        <p>Distribution charts and engagement patterns from community posts</p>
      </div>
    `;
    container.appendChild(analyticsSection);
    
    // Charts and detailed stats
    this.renderDetailedStats(analyticsSection);

    // Create Recent Activity Section
    const activitySection = document.createElement('section');
    activitySection.className = 'stats-section activity-section';
    activitySection.innerHTML = `
      <div class="section-header">
        <h2><span class="material-icons">schedule</span> Recent Activity</h2>
        <p>Latest and top performing posts from the CUR8 community</p>
      </div>
    `;
    container.appendChild(activitySection);

    // Top content sections
    this.renderTopContent(activitySection);
  }

  renderOverviewStats(container) {
    const overviewSection = document.createElement('div');
    overviewSection.className = 'stats-overview';
    
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    const stats = [
      { label: 'Total Posts', value: this.stats.totalPosts, icon: 'article' },
      { label: 'Total Authors', value: this.stats.totalAuthors, icon: 'people' },
      { label: 'Total Votes', value: this.stats.totalVotes.toLocaleString(), icon: 'thumb_up' },
      { label: 'Total Comments', value: this.stats.totalComments.toLocaleString(), icon: 'comment' },
      { label: 'Total Payout', value: `$${this.stats.totalPayout.toFixed(2)}`, icon: 'payments' },
      { label: 'Avg. Votes/Post', value: this.stats.averageVotes, icon: 'trending_up' },
      { label: 'Avg. Comments/Post', value: this.stats.averageComments, icon: 'forum' },
      { label: 'Avg. Payout/Post', value: `$${this.stats.averagePayout}`, icon: 'attach_money' }
    ];

    stats.forEach(stat => {
      const statCard = document.createElement('div');
      statCard.className = 'stat-card';
      statCard.innerHTML = `
        <div class="stat-content">
          <div class="stat-value">
            <span class="material-icons">${stat.icon}</span>
            ${stat.value}
          </div>
          <div class="stat-label">${stat.label}</div>
        </div>
      `;
      statsGrid.appendChild(statCard);
    });

    overviewSection.appendChild(statsGrid);
    container.appendChild(overviewSection);
  }

  renderDetailedStats(container) {
    const detailedSection = document.createElement('div');
    detailedSection.className = 'detailed-stats';

    // Payout distribution
    this.renderPayoutDistribution(detailedSection);

    // Time distribution
    this.renderTimeDistribution(detailedSection);

    container.appendChild(detailedSection);
  }

  renderPayoutDistribution(container) {
    const section = document.createElement('div');
    section.className = 'chart-section';
    
    const title = document.createElement('h3');
    title.textContent = 'Payout Distribution';
    section.appendChild(title);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'simple-chart';

    Object.entries(this.stats.payoutDistribution).forEach(([range, count]) => {
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      
      const maxCount = Math.max(...Object.values(this.stats.payoutDistribution));
      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
      
      bar.innerHTML = `
        <div class="bar-label">${range} SBD</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${percentage}%"></div>
          <div class="bar-value">${count}</div>
        </div>
      `;
      chartContainer.appendChild(bar);
    });

    section.appendChild(chartContainer);
    container.appendChild(section);
  }

  renderTimeDistribution(container) {
    const section = document.createElement('div');
    section.className = 'chart-section';
    
    const title = document.createElement('h3');
    title.textContent = 'Posts by Day of Week';
    section.appendChild(title);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'simple-chart';

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const maxCount = Math.max(...Object.values(this.stats.timeDistribution));

    days.forEach(day => {
      const count = this.stats.timeDistribution[day] || 0;
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      
      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
      
      bar.innerHTML = `
        <div class="bar-label">${day}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${percentage}%"></div>
          <div class="bar-value">${count}</div>
        </div>
      `;
      chartContainer.appendChild(bar);
    });

    section.appendChild(chartContainer);
    container.appendChild(section);
  }

  renderTopContent(container) {
    const topSection = document.createElement('div');
    topSection.className = 'top-content';

    // Top Authors
    this.renderTopAuthors(topSection);

    // Top Posts
    this.renderTopPosts(topSection);

    // Recent Posts
    this.renderRecentPosts(topSection);

    container.appendChild(topSection);
  }

  renderTopAuthors(container) {
    const section = document.createElement('div');
    section.className = 'top-section';

    const title = document.createElement('h3');
    title.textContent = 'Top Authors by Total Payout';
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'top-list';

    this.stats.topAuthors.forEach((author, index) => {
      const item = document.createElement('div');
      item.className = 'top-item';
      item.innerHTML = `
        <div class="rank">#${index + 1}</div>
        <div class="content">
          <div class="primary">@${author.author}</div>
          <div class="secondary">${author.posts} posts • $${author.totalPayout.toFixed(2)} total</div>
        </div>
        <div class="action">
          <button class="view-profile-btn" data-username="${author.author}">
            <span class="material-icons">person</span>
          </button>
        </div>
      `;
      
      // Add click handler for profile button
      const profileBtn = item.querySelector('.view-profile-btn');
      profileBtn.addEventListener('click', () => {
        router.navigate(`/@${author.author}`);
      });

      list.appendChild(item);
    });

    section.appendChild(list);
    container.appendChild(section);
  }

  renderTopPosts(container) {
    const section = document.createElement('div');
    section.className = 'top-section';

    const title = document.createElement('h3');
    title.textContent = 'Top Posts by Payout';
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'top-list';

    this.stats.topPosts.forEach((post, index) => {
      const item = document.createElement('div');
      item.className = 'top-item';
      
      const truncatedTitle = post.title.length > 60 ? 
        post.title.substring(0, 60) + '...' : post.title;
      
      item.innerHTML = `
        <div class="rank">#${index + 1}</div>
        <div class="content">
          <div class="primary">${truncatedTitle}</div>
          <div class="secondary">by @${post.author} • $${post._calculatedPayout.toFixed(2)} • ${post._voteCount} votes</div>
        </div>
        <div class="action">
          <button class="view-post-btn" data-author="${post.author}" data-permlink="${post.permlink}">
            <span class="material-icons">open_in_new</span>
          </button>
        </div>
      `;
      
      // Add click handler for post button
      const postBtn = item.querySelector('.view-post-btn');
      postBtn.addEventListener('click', () => {
        router.navigate(`/@${post.author}/${post.permlink}`);
      });

      list.appendChild(item);
    });

    section.appendChild(list);
    container.appendChild(section);
  }

  renderRecentPosts(container) {
    const section = document.createElement('div');
    section.className = 'top-section';

    const title = document.createElement('h3');
    title.textContent = 'Recent Posts';
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'top-list';

    this.stats.recentPosts.forEach((post, index) => {
      const item = document.createElement('div');
      item.className = 'top-item';
      
      const truncatedTitle = post.title.length > 60 ? 
        post.title.substring(0, 60) + '...' : post.title;
      
      const timeAgo = this.getTimeAgo(new Date(post.created));
      
      item.innerHTML = `
        <div class="rank">•</div>
        <div class="content">
          <div class="primary">${truncatedTitle}</div>
          <div class="secondary">by @${post.author} • ${timeAgo}</div>
        </div>
        <div class="action">
          <button class="view-post-btn" data-author="${post.author}" data-permlink="${post.permlink}">
            <span class="material-icons">open_in_new</span>
          </button>
        </div>
      `;
      
      // Add click handler for post button
      const postBtn = item.querySelector('.view-post-btn');
      postBtn.addEventListener('click', () => {
        router.navigate(`/@${post.author}/${post.permlink}`);
      });

      list.appendChild(item);
    });

    section.appendChild(list);
    container.appendChild(section);
  }

  renderEmptyState(container) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-icon">
        <span class="material-icons">analytics</span>
      </div>
      <h3>No CUR8 Posts Found</h3>
      <p>There are currently no posts tagged with "cur8" to analyze.</p>
      <button class="primary-btn" onclick="window.location.href='/tag/cur8'">
        View CUR8 Tag
      </button>
    `;
    container.appendChild(emptyState);
  }

  renderError(container, message) {
    container.innerHTML = '';
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    errorContainer.innerHTML = `
      <div class="error-icon">
        <span class="material-icons">error</span>
      </div>
      <h3>Failed to Load Statistics</h3>
      <p>${message}</p>
      <button class="primary-btn" onclick="window.location.reload()">
        Try Again
      </button>
    `;
    container.appendChild(errorContainer);
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  unmount() {
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    super.unmount();
  }
}

export default Cur8StatsView;
