import Component from '../../Component.js';
import walletService from '../../../services/WalletService.js';
import authService from '../../../services/AuthService.js';
import eventEmitter from '../../../utils/EventEmitter.js';
import router from '../../../utils/Router.js';

/**
 * Componente per il pulsante di claim rewards
 */
export default class WalletRewardsComponent extends Component {
  constructor(parentElement, options = {}) {
    super(parentElement, options);
    this.rewards = {
      steem: '0.000',
      sbd: '0.000',
      vest: '0.000',
      sp: '0.000'
    };
    this.hasRewards = false;
    this.tooltipVisible = false;
    this.isMobileDevice = this.checkIfMobile();
    
    // Binding dei metodi
    this.checkForRewards = this.checkForRewards.bind(this);
    this.handleClaimRewards = this.handleClaimRewards.bind(this);
    this.handleBalancesUpdated = this.handleBalancesUpdated.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
  }
  
  /**
   * Rileva se l'utente sta usando un dispositivo mobile
   * @returns {boolean} True se è un dispositivo mobile
   */
  checkIfMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768);
  }
  
  render() {
    this.element = document.createElement('div');
    this.element.className = 'wallet-rewards-component hidden'; // Inizia nascosto
    
    // Crea il pulsante di claim rewards (solo icona)
    this.rewardsButton = document.createElement('button');
    this.rewardsButton.type = 'button';
    this.rewardsButton.className = 'rewards-claim-button';
    this.rewardsButton.setAttribute('aria-label', 'Claim rewards');
    
    // Icona regalo
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = 'card_giftcard';
    this.rewardsButton.appendChild(icon);
    
    // Badge per indicare se ci sono ricompense (sarà visibile solo quando ci sono ricompense)
    this.rewardsBadge = document.createElement('span');
    this.rewardsBadge.className = 'rewards-badge';
    this.rewardsBadge.style.display = 'none';
    this.rewardsBadge.textContent = '!';
    this.rewardsButton.appendChild(this.rewardsBadge);
    
    // Testo del pulsante (nascosto tramite CSS)
    const buttonText = document.createElement('span');
    buttonText.className = 'rewards-button-text';
    buttonText.textContent = 'Claim Rewards';
    this.rewardsButton.appendChild(buttonText);
    
    // Crea tooltip per mostrare le ricompense disponibili
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'rewards-tooltip';
    
    const tooltipHeader = document.createElement('div');
    tooltipHeader.className = 'rewards-tooltip-header';
    tooltipHeader.textContent = 'Available Rewards:';
    this.tooltip.appendChild(tooltipHeader);
    
    // Contenitore per i dettagli delle ricompense
    this.rewardsDetails = document.createElement('div');
    this.rewardsDetails.className = 'rewards-tooltip-details';
    this.tooltip.appendChild(this.rewardsDetails);
    
    // Su mobile aggiungiamo un pulsante di claim nel tooltip
    if (this.isMobileDevice) {
      const claimButton = document.createElement('button');
      claimButton.className = 'rewards-claim-button-mobile';
      claimButton.textContent = 'Claim Rewards';
      this.tooltip.appendChild(claimButton);
      this.registerEventHandler(claimButton, 'click', this.handleClaimRewards);
    }
    
    this.rewardsButton.appendChild(this.tooltip);
    
    // Registra handler per il pulsante - su mobile prima mostra il tooltip
    if (this.isMobileDevice) {
      this.registerEventHandler(this.rewardsButton, 'click', this.toggleTooltip);
    } else {
      this.registerEventHandler(this.rewardsButton, 'click', this.handleClaimRewards);
    }
    
    // Aggiungi al contenitore
    this.element.appendChild(this.rewardsButton);
    this.parentElement.appendChild(this.element);
    
    // Registra eventi
    eventEmitter.on('wallet:balances-updated', this.handleBalancesUpdated);
    
    // Controlla se ci sono ricompense disponibili
    this.checkForRewards();
    
    return this.element;
  }
  
  /**
   * Mostra o nasconde il tooltip su dispositivi mobili
   * @param {Event} event - Evento click
   */
  toggleTooltip(event) {
    event.stopPropagation(); // Previene la propagazione dell'evento

    if (!this.tooltipVisible && this.hasRewards) {
      // Mostra il tooltip
      this.tooltipVisible = true;
      this.tooltip.classList.add('visible');
      
      // Registra handler per chiudere il tooltip quando si clicca altrove
      setTimeout(() => {
        document.addEventListener('click', this.closeTooltip = (e) => {
          if (!this.tooltip.contains(e.target) && e.target !== this.rewardsButton) {
            this.tooltip.classList.remove('visible');
            this.tooltipVisible = false;
            document.removeEventListener('click', this.closeTooltip);
          }
        });
      }, 10);
    } else {
      // Nascondi il tooltip se è già visibile
      this.tooltip.classList.remove('visible');
      this.tooltipVisible = false;
      if (this.closeTooltip) {
        document.removeEventListener('click', this.closeTooltip);
      }
    }
  }
  
  /**
   * Controlla se ci sono ricompense disponibili da reclamare
   * @returns {Promise<void>}
   */
  async checkForRewards() {
    try {
      if (!authService.isAuthenticated()) return;
      
      const rewards = await walletService.getAvailableRewards();
      this.rewards = rewards;
      
      // Controlla se ci sono ricompense da reclamare
      this.hasRewards = parseFloat(rewards.steem) > 0 || 
                        parseFloat(rewards.sbd) > 0 || 
                        parseFloat(rewards.sp) > 0;
      
      // Aggiorna l'interfaccia
      this.updateRewardsUI();
    } catch (error) {
      console.error('Error checking for rewards:', error);
    }
  }
  
  /**
   * Aggiorna l'interfaccia in base alle ricompense disponibili
   */
  updateRewardsUI() {
    // Mostra/nascondi il componente in base alla disponibilità di ricompense
    if (this.hasRewards) {
      this.element.classList.remove('hidden'); // Mostra il componente
      this.rewardsButton.classList.add('has-rewards');
      this.rewardsBadge.style.display = 'flex'; // Mostra il badge
      
      // Aggiorna i dettagli delle ricompense nel tooltip
      this.rewardsDetails.innerHTML = '';
      
      if (parseFloat(this.rewards.steem) > 0) {
        this.rewardsDetails.appendChild(this.createTooltipItem('STEEM:', this.rewards.steem));
      }
      
      if (parseFloat(this.rewards.sbd) > 0) {
        this.rewardsDetails.appendChild(this.createTooltipItem('SBD:', this.rewards.sbd));
      }
      
      if (parseFloat(this.rewards.sp) > 0) {
        this.rewardsDetails.appendChild(this.createTooltipItem('STEEM Power:', this.rewards.sp));
      }
    } else {
      this.element.classList.add('hidden'); // Nascondi completamente il componente
      this.rewardsButton.classList.remove('has-rewards');
      this.rewardsBadge.style.display = 'none'; // Nascondi il badge
      this.rewardsDetails.innerHTML = '<div class="rewards-tooltip-item"><span class="rewards-tooltip-label">No rewards available</span></div>';
    }
  }
  
  /**
   * Crea un elemento del tooltip per mostrare un tipo di ricompensa
   * @param {string} label - Etichetta della ricompensa
   * @param {string} value - Valore della ricompensa
   * @returns {HTMLElement} Elemento del tooltip
   */
  createTooltipItem(label, value) {
    const item = document.createElement('div');
    item.className = 'rewards-tooltip-item';
    
    const labelEl = document.createElement('span');
    labelEl.className = 'rewards-tooltip-label';
    labelEl.textContent = label;
    
    const valueEl = document.createElement('span');
    valueEl.className = 'rewards-tooltip-value';
    valueEl.textContent = value;
    
    item.appendChild(labelEl);
    item.appendChild(valueEl);
    
    return item;
  }
    /**
   * Gestisce il click sul pulsante di claim rewards
   * @param {Event} event - Evento click
   */
  async handleClaimRewards(event) {
    event.stopPropagation(); // Previene la propagazione dell'evento
    const button = event.currentTarget;
    
    // Chiudi il tooltip se visibile
    if (this.tooltipVisible) {
      this.tooltip.classList.remove('visible');
      this.tooltipVisible = false;
      if (this.closeTooltip) {
        document.removeEventListener('click', this.closeTooltip);
      }
    }
      // Verifica che l'utente sia autenticato
    if (!authService.isAuthenticated()) {
      this._showAuthErrorPopup(
        'Access Required',
        'You need to be logged in to claim rewards. Please log in to your account.' 
      );
      return;
    }
    
    // Se non ci sono ricompense, non fare nulla
    if (!this.hasRewards) {
      eventEmitter.emit('notification', {
        type: 'info',
        message: 'No rewards available to claim'
      });
      return;
    }
    
    try {
      // Mostra stato di caricamento
      const targetButton = this.isMobileDevice && button.classList.contains('rewards-claim-button-mobile') 
        ? button 
        : this.rewardsButton;
      
      targetButton.classList.add('loading');
      targetButton.disabled = true;
      
      if (!this.isMobileDevice || !button.classList.contains('rewards-claim-button-mobile')) {
        const icon = targetButton.querySelector('i');
        if (icon) {
          icon.textContent = 'hourglass_bottom';
        }
      }
      
      // Nascondi il badge durante il caricamento
      if (this.rewardsBadge) {
        this.rewardsBadge.style.display = 'none';
      }
      
      // Chiama il service per reclamare le ricompense
      const result = await walletService.claimRewards();
      
      if (result.success) {
        // Mostra notifica di successo
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Successfully claimed rewards: ${result.rewards.steem} STEEM, ${result.rewards.sbd} SBD, ${result.rewards.vests.split(' ')[0]} VESTS`
        });
        
        // Nascondi il pulsante dopo aver reclamato le ricompense
        this.hasRewards = false;
        this.element.classList.add('hidden'); // Nascondi l'intero componente
        
        // Aggiorna i saldi dopo aver reclamato le ricompense
        setTimeout(() => {
          walletService.updateBalances();
        }, 1500);
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
        // Controlla se l'errore è relativo all'autenticazione
      if (error.message && (
          error.message.includes('login') || 
          error.message.includes('sessione') || 
          error.message.includes('scaduta') || 
          error.message.includes('autenticazione') ||
          error.message.includes('Non sei loggato')
      )) {
        // Mostra il popup di errore di autenticazione
        this._showAuthErrorPopup(
          'Sessione Scaduta', 
          'La tua sessione è scaduta. Effettua nuovamente il login per continuare.'
        );
      } else {
        // Per altri tipi di errori, mostriamo una notifica normale
        eventEmitter.emit('notification', {
          type: 'error',
          message: `Failed to claim rewards: ${error.message}`
        });
      }
      
      // Ripristina lo stato del pulsante
      const targetButton = this.isMobileDevice && button.classList.contains('rewards-claim-button-mobile') 
        ? button 
        : this.rewardsButton;
      
      targetButton.classList.remove('loading');
      targetButton.disabled = false;
      
      if (!this.isMobileDevice || !button.classList.contains('rewards-claim-button-mobile')) {
        const icon = targetButton.querySelector('i');
        if (icon) {
          icon.textContent = 'card_giftcard';
        }
      }
      
      // Mostra nuovamente il badge se ci sono ricompense
      if (this.hasRewards && this.rewardsBadge) {
        this.rewardsBadge.style.display = 'flex';
      }
    }
  }
  
  /**
   * Gestisce l'evento di aggiornamento dei saldi
   */
  handleBalancesUpdated() {
    // Controlla nuovamente le ricompense quando i saldi vengono aggiornati
    this.checkForRewards();
  }
  
  destroy() {
    // Rimuovi gli event listener
    eventEmitter.off('wallet:balances-updated', this.handleBalancesUpdated);
    
    // Rimuovi il listener per chiudere il tooltip
    if (this.closeTooltip) {
      document.removeEventListener('click', this.closeTooltip);
    }
    
    // Chiama il metodo destroy della classe parent
    super.destroy();
  }



}