import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';

export default class RewardsTab extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.handleClaimClick = this.handleClaimClick.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'tab-pane';
    this.element.id = 'rewards-tab';
    this.element.innerHTML = `
      <div class="form-card">
        <h3>Pending Rewards</h3>
        <div class="rewards-grid">
          <div class="reward-item">
            <div class="reward-label">STEEM</div>
            <div class="reward-value" id="reward-steem">0.000</div>
          </div>
          
          <div class="reward-item">
            <div class="reward-label">STEEM POWER</div>
            <div class="reward-value" id="reward-sp">0.000</div>
          </div>
          
          <div class="reward-item">
            <div class="reward-label">SBD</div>
            <div class="reward-value" id="reward-sbd">0.000</div>
          </div>
        </div>
        
        <button id="claim-rewards-btn" class="btn btn-primary" disabled>
          Claim Rewards
        </button>
      </div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Add event listeners
    const claimBtn = this.element.querySelector('#claim-rewards-btn');
    if (claimBtn) {
      this.registerEventHandler(claimBtn, 'click', this.handleClaimClick);
    }
    
    // Load rewards data
    this.loadRewards();
    
    return this.element;
  }
  
  async loadRewards() {
    try {
      // Simulate loading rewards with a timeout
      setTimeout(() => {
        // Mock rewards data
        const rewards = {
          steem: '0.125',
          sp: '1.582',
          sbd: '0.314'
        };
        
        // Update UI with rewards data
        this.updateRewardsDisplay(rewards);
      }, 800);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    }
  }
  
  updateRewardsDisplay(rewards) {
    if (!this.element) return;
    
    // Update reward values
    this.element.querySelector('#reward-steem').textContent = rewards.steem;
    this.element.querySelector('#reward-sp').textContent = rewards.sp;
    this.element.querySelector('#reward-sbd').textContent = rewards.sbd;
    
    // Enable/disable claim button based on if there are rewards
    const hasRewards = 
      parseFloat(rewards.steem) > 0 || 
      parseFloat(rewards.sp) > 0 || 
      parseFloat(rewards.sbd) > 0;
      
    const claimBtn = this.element.querySelector('#claim-rewards-btn');
    if (claimBtn) {
      claimBtn.disabled = !hasRewards;
    }
  }
  
  async handleClaimClick() {
    try {
      alert('Rewards would be claimed here');
      // After claiming, refresh rewards
      this.loadRewards();
    } catch (error) {
      console.error('Failed to claim rewards:', error);
    }
  }
}