import Component from '../Component.js';
import TransferTab from './tabs/TransferTab.js';
import PowerManagementTab from './tabs/PowerManagementTab.js';
import DelegationTab from './tabs/DelegationTab.js';
import TransactionHistoryTab from './tabs/TransactionHistoryTab.js';
import RewardsTab from './tabs/RewardsTab.js';

export default class WalletTabsComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.tabs = {};
    this.activeTab = 'transfer';
    this.handleTabClick = this.handleTabClick.bind(this);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-tabs';
    this.element.innerHTML = `
      <div class="tab-buttons">
        <button class="tab-button active" data-tab="transfer">Transfer</button>
        <button class="tab-button" data-tab="power">Power Up/Down</button>
        <button class="tab-button" data-tab="delegate">Delegate</button>
        <button class="tab-button" data-tab="history">History</button>
        <button class="tab-button" data-tab="rewards">Rewards</button>
      </div>
      <div class="tab-content"></div>
    `;
    
    this.parentElement.appendChild(this.element);
    
    // Add event listeners
    const tabButtons = this.element.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      this.registerEventHandler(button, 'click', this.handleTabClick);
    });
    
    // Create tab content area
    this.tabContent = this.element.querySelector('.tab-content');
    
    // Initialize tabs - only create Transfer tab initially for better performance
    this.initializeTab('transfer');
    
    return this.element;
  }
  
  handleTabClick(e) {
    const tabName = e.currentTarget.getAttribute('data-tab');
    this.showTab(tabName);
  }
  
  showTab(tabName) {
    // Return if already showing this tab
    if (this.activeTab === tabName) return;
    
    // Update active button
    const tabButtons = this.element.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
    });
    
    // Initialize tab if it doesn't exist yet
    if (!this.tabs[tabName]) {
      this.initializeTab(tabName);
    }
    
    // Hide all tabs and show the selected one
    Object.keys(this.tabs).forEach(key => {
      if (this.tabs[key].element) {
        this.tabs[key].element.classList.toggle('active', key === tabName);
      }
    });
    
    this.activeTab = tabName;
  }
  
  initializeTab(tabName) {
    // Create the tab component if it doesn't exist
    if (this.tabs[tabName]) return;
    
    let tabComponent;
    
    switch (tabName) {
      case 'transfer':
        tabComponent = new TransferTab(this.tabContent);
        break;
      case 'power':
        tabComponent = new PowerManagementTab(this.tabContent);
        break;
      case 'delegate':
        tabComponent = new DelegationTab(this.tabContent);
        break;
      case 'history':
        tabComponent = new TransactionHistoryTab(this.tabContent);
        break;
      case 'rewards':
        tabComponent = new RewardsTab(this.tabContent);
        break;
    }
    
    if (tabComponent) {
      tabComponent.render();
      // Only the initial tab should be visible
      if (tabComponent.element) {
        tabComponent.element.classList.toggle('active', tabName === this.activeTab);
      }
      
      this.tabs[tabName] = tabComponent;
    }
  }
  
  destroy() {
    // Clean up all tab components
    Object.values(this.tabs).forEach(tab => tab.destroy());
    
    super.destroy();
  }
}