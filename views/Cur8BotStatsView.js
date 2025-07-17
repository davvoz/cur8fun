import View from './View.js';
import imRiddApiService from '../services/ImRiddApiService.js';
import LoadingIndicator from '../components/LoadingIndicator.js';
import metaTagService from '../services/MetaTagService.js';

/**
 * CUR8 Bot Statistics View - Shows curation bot performance metrics
 */
class Cur8BotStatsView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'CUR8 Bot Statistics | cur8.fun';
    this.loadingIndicator = new LoadingIndicator();
    this.botData = null;
    this.loading = false;
  }

  async render(element) {
    this.element = element;

    // Set meta tags for the bot statistics page
    metaTagService.setMetaTags({
      title: 'CUR8 Bot Statistics - Curation Performance & Metrics',
      description: 'Real-time performance metrics and curation data from the @cur8 automated curation bot on Steem blockchain.',
      image: 'https://cur8.fun/assets/img/logo_tra.png',
      url: `${window.location.origin}/cur8-bot-stats`,
      type: 'website'
    }, 'default');

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create main container
    const container = document.createElement('div');
    container.className = 'cur8-bot-stats-container';

    // Create header
    this.renderHeader(container);

    // Create stats content
    const statsContent = document.createElement('div');
    statsContent.className = 'bot-stats-content';
    container.appendChild(statsContent);

    // Add loading indicator
    this.loadingIndicator.show(statsContent);

    this.element.appendChild(container);

    // Load and display statistics
    await this.loadBotStatistics(statsContent);
  }

  renderHeader(container) {
    const header = document.createElement('div');
    header.className = 'stats-header';
    header.innerHTML = `
      <div class="header-content">
        <div class="header-icon">
          <span class="material-icons">smart_toy</span>
        </div>
        <div class="header-text">
          <h1>CUR8 Bot Statistics</h1>
          <p>Performance metrics and curation data from the automated @cur8 account</p>
        </div>
      </div>
    `;
    container.appendChild(header);
  }

  async loadBotStatistics(container) {
    try {
      this.loading = true;
      console.log('Loading CUR8 bot statistics...');

      const data = await imRiddApiService.getCur8Stats();
      if (!data || !Array.isArray(data) || data.length === 0) {
        this.renderError(container, 'No data available from curation bot API');
        return;
      }

      this.botData = data[0];
      this.renderBotStats(container);

    } catch (error) {
      console.error('Error loading CUR8 bot statistics:', error);
      this.renderError(container, error.message);
    } finally {
      this.loading = false;
      this.loadingIndicator.hide();
    }
  }

  renderBotStats(container) {
    container.innerHTML = '';

    // Main bot stats section
    const mainSection = document.createElement('section');
    mainSection.className = 'stats-section';
    mainSection.innerHTML = `
      <div class="section-header">
        <h2><span class="material-icons">account_circle</span> Account Overview</h2>
        <p>Core metrics and account information for @${this.botData.account_name}</p>
      </div>
    `;

    const mainStatsGrid = document.createElement('div');
    mainStatsGrid.className = 'bot-main-stats';
    
    const mainStats = [
      {
        icon: 'stars', 
        value: this.botData.current_sp.toLocaleString(), 
        label: 'Steem Power', 
        color: 'var(--primary-color)'
      },
      {
        icon: 'groups', 
        value: this.botData.follower_count, 
        label: 'Followers', 
        color: '#43a047'
      },
      {
        icon: 'person_add', 
        value: this.botData.deleg_count, 
        label: 'Delegators', 
        color: '#1976d2'
      },
      {
        icon: 'how_to_vote', 
        value: `$${this.botData.vote_value.toFixed(2)}`, 
        label: 'Vote Value', 
        color: '#ff9800'
      },
      {
        icon: 'trending_up', 
        value: `${this.botData.daily_APR}%`, 
        label: 'Daily APR', 
        color: '#e91e63'
      },
      {
        icon: 'people_outline', 
        value: this.botData.follow_count, 
        label: 'Following', 
        color: '#9c27b0'
      }
    ];

    mainStats.forEach(stat => {
      const card = document.createElement('div');
      card.className = 'stat-card bot-stat-card';
      card.innerHTML = `
        <div class="stat-icon" style="background:${stat.color}">
          <span class="material-icons">${stat.icon}</span>
        </div>
        <div class="stat-content">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-label">${stat.label}</div>
        </div>
      `;
      mainStatsGrid.appendChild(card);
    });

    mainSection.appendChild(mainStatsGrid);
    container.appendChild(mainSection);

    // Curation rewards section
    const rewardsSection = document.createElement('section');
    rewardsSection.className = 'stats-section rewards-section';
    rewardsSection.innerHTML = `
      <div class="section-header">
        <h2><span class="material-icons">monetization_on</span> Curation Rewards</h2>
        <p>Earnings from automated content curation over different time periods</p>
      </div>
    `;

    const rewardsGrid = document.createElement('div');
    rewardsGrid.className = 'bot-rewards-grid';
    
    const rewards = [
      {
        icon: 'today', 
        value: `${this.botData.curation_rewards_24h.toFixed(2)} STEEM`, 
        label: 'Last 24 Hours', 
        color: '#00bcd4'
      },
      {
        icon: 'date_range', 
        value: `${this.botData.curation_rewards_7d.toFixed(2)} STEEM`, 
        label: 'Last 7 Days', 
        color: '#ab47bc'
      },
      {
        icon: 'calendar_month', 
        value: `${this.botData.curation_rewards_30d.toFixed(2)} STEEM`, 
        label: 'Last 30 Days', 
        color: '#fbc02d'
      },
      {
        icon: 'savings', 
        value: `${this.botData.total_rewards.toFixed(2)} STEEM`, 
        label: 'Total Earned', 
        color: '#009688'
      }
    ];

    rewards.forEach(reward => {
      const card = document.createElement('div');
      card.className = 'stat-card bot-reward-card';
      card.innerHTML = `
        <div class="stat-icon" style="background:${reward.color}">
          <span class="material-icons">${reward.icon}</span>
        </div>
        <div class="stat-content">
          <div class="stat-value">${reward.value}</div>
          <div class="stat-label">${reward.label}</div>
        </div>
      `;
      rewardsGrid.appendChild(card);
    });

    rewardsSection.appendChild(rewardsGrid);
    container.appendChild(rewardsSection);
  }

  renderError(container, message) {
    container.innerHTML = `
      <div class="error-state">
        <span class="material-icons">error_outline</span>
        <h3>Unable to Load Bot Statistics</h3>
        <p>${message}</p>
        <button class="retry-btn" onclick="location.reload()">
          <span class="material-icons">refresh</span>
          Retry
        </button>
      </div>
    `;
  }

  unmount() {
    if (this.loadingIndicator) {
      this.loadingIndicator.hide();
    }
    super.unmount();
  }
}

export default Cur8BotStatsView;
