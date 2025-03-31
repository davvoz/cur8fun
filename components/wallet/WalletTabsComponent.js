import Component from '../Component.js';
import TransferTab from './tabs/TransferTab.js';
import PowerManagementTab from './tabs/PowerManagementTab.js';
import DelegationTab from './tabs/DelegationTab.js';
import TransactionHistoryTab from './tabs/TransactionHistoryTab.js';
import CurationTab from './tabs/CurationTab.js';

export default class WalletTabsComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.tabs = {};
    this.activeTab = 'history';
    this.handleTabClick = this.handleTabClick.bind(this);
  }
  
  render() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'wallet-tabs';
    
    // Create tab buttons container
    const tabButtonsContainer = document.createElement('div');
    tabButtonsContainer.className = 'tab-buttons';
    
    // Define tab data - Moved history to first position
    const tabData = [
      { id: 'history', label: 'History', isActive: true },
      { id: 'transfer', label: 'Transfer', isActive: false },
      { id: 'power', label: 'Power Up/Down', isActive: false },
      { id: 'delegate', label: 'Delegate', isActive: false },
      { id: 'curation', label: 'Curation', isActive: false }
    ];
    
    // Create all tab buttons
    tabData.forEach(tab => {
      const button = document.createElement('button');
      button.className = 'tab-button';
      if (tab.isActive) {
        button.classList.add('active');
      }
      button.setAttribute('data-tab', tab.id);
      button.textContent = tab.label;
      
      this.registerEventHandler(button, 'click', this.handleTabClick);
      tabButtonsContainer.appendChild(button);
    });
    
    // Create tab content container
    this.tabContent = document.createElement('div');
    this.tabContent.className = 'tab-content';
    
    // Build the DOM structure
    this.element.appendChild(tabButtonsContainer);
    this.element.appendChild(this.tabContent);
    
    this.parentElement.appendChild(this.element);
    
    // Initialize the default tab
    this.initializeTab('history');
    
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
      case 'curation':
        tabComponent = new CurationTab(this.tabContent);
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