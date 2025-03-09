import View from './View.js';
import authService from '../services/AuthService.js';

class WalletView extends View {
  constructor(params) {
    super(params);
    this.title = 'Wallet | SteemGram';
    this.currentUser = authService.getCurrentUser()?.username;
  }
  
  async render(element) {
    this.element = element;
    
    if (!this.currentUser) {
      this.element.innerHTML = `
        <div class="login-required">
          <h2>Login Required</h2>
          <p>Please login to view your wallet.</p>
          <a href="/login" class="btn btn-primary">Login Now</a>
        </div>
      `;
      return this.element;
    }
    
    this.element.innerHTML = `
      <div class="wallet-container">
        <div class="page-header">
          <h1>Wallet</h1>
          <p>Manage your STEEM, HIVE and tokens</p>
        </div>
        
        <div class="wallet-content">
          <div class="placeholder-message">
            <span class="material-icons">account_balance_wallet</span>
            <h3>Wallet functionality coming soon</h3>
            <p>Your wallet interface is being implemented.</p>
          </div>
        </div>
      </div>
    `;
    
    return this.element;
  }
}

export default WalletView;