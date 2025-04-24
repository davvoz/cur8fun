/**
 * FilterService.js
 * Servizio centralizzato per il filtraggio dei dati nell'applicazione
 */

class FilterService {
  constructor() {
    // Configurazione globale per il filtraggio
    this.config = {
      debug: false
    };
  }

  /**
   * Filtra le transazioni in base ai tipi e direzione specificati
   * @param {Array} transactions - Array di transazioni da filtrare
   * @param {Object} filters - Oggetto con i filtri da applicare { types: {}, direction: {}, dateRange: {} }
   * @param {Object} context - Contesto aggiuntivo per il filtraggio (es. username, funzioni helper)
   * @returns {Array} - Transazioni filtrate
   */
  filterTransactions(transactions, filters, context = {}) {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    // Se non ci sono filtri, restituisci tutte le transazioni
    if (!filters) return transactions;
    
    const { username, isActionBy, isActionOn } = context;
    
    return transactions.filter(tx => {
      // Ottieni il tipo di transazione
      let type, data, isActionByUser, isActionOnUser, timestamp;
      
      // Per array di transazioni già elaborate (formato oggetto)
      if (!Array.isArray(tx)) {
        type = tx.type;
        data = tx.data;
        isActionByUser = tx.isActionByUser;
        isActionOnUser = tx.isActionOnUser;
        timestamp = tx.timestamp;
      } 
      // Per array [id, txData] dalla API di Steem (formato grezzo)
      else {
        const [id, txData] = tx;
        type = txData.op[0];
        data = txData.op[1];
        timestamp = txData.timestamp;
        
        // Calcola dinamicamente se l'azione è dell'utente o sull'utente
        if (username && isActionBy && isActionOn) {
          isActionByUser = isActionBy(type, data, username);
          isActionOnUser = isActionOn(type, data, username);
        }
      }
      
      // 1. Filtra per tipo di transazione - usa filtro dinamico
      if (filters.types && Object.keys(filters.types).length > 0) {
        // Se il tipo esiste nei filtri, usa quel valore
        if (filters.types[type] !== undefined) {
          if (!filters.types[type]) return false;
        }
        // Controlla se tutti i tipi sono disattivati
        const allTypesDisabled = Object.values(filters.types).every(value => !value);
        if (allTypesDisabled) return false;
      }
      
      // 2. Filtra per direzione (in/out)
      if (filters.direction && username) {
        const dirByUser = filters.direction.byUser;
        const dirOnUser = filters.direction.onUser;
        
        // Se entrambe le direzioni sono disattivate, nascondi tutto
        if (!dirByUser && !dirOnUser) {
          return false;
        }
        
        // Casi speciali dove l'utente è sia mittente che destinatario
        const isSelfTransaction = isActionByUser && isActionOnUser;
        
        // Se è una transazione su sé stesso, mostra se almeno una direzione è attiva
        if (isSelfTransaction) {
          return dirByUser || dirOnUser;
        }
        
        // Altrimenti filtra per direzione
        if (isActionByUser && !dirByUser) return false;
        if (isActionOnUser && !dirOnUser) return false;
        
        // Se non è né by né on user, non dovrebbe essere mostrato
        if (!isActionByUser && !isActionOnUser) return false;
      }
      
      // 3. Filtra per intervallo di date
      if (filters.dateRange) {
        const txDate = new Date(timestamp + 'Z');
        
        // Filtra per data di inizio
        if (filters.dateRange.startDate) {
          const startDate = new Date(filters.dateRange.startDate);
          if (txDate < startDate) return false;
        }
        
        // Filtra per data di fine
        if (filters.dateRange.endDate) {
          const endDate = new Date(filters.dateRange.endDate);
          // Imposta la fine della giornata (23:59:59)
          endDate.setHours(23, 59, 59, 999);
          if (txDate > endDate) return false;
        }
      }
      
      // La transazione ha passato tutti i filtri
      return true;
    });
  }
  
  /**
   * Ordina le transazioni per timestamp
   * @param {Array} transactions - Array di transazioni da ordinare
   * @param {string} direction - Direzione di ordinamento ('asc' o 'desc')
   * @returns {Array} - Transazioni ordinate
   */
  sortTransactions(transactions, direction = 'desc') {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    return [...transactions].sort((a, b) => {
      let timestampA, timestampB;
      
      if (Array.isArray(a)) {
        timestampA = new Date(a[1].timestamp + 'Z').getTime();
      } else {
        timestampA = new Date(a.timestamp + 'Z').getTime();
      }
      
      if (Array.isArray(b)) {
        timestampB = new Date(b[1].timestamp + 'Z').getTime();
      } else {
        timestampB = new Date(b.timestamp + 'Z').getTime();
      }
      
      return direction === 'desc' ? timestampB - timestampA : timestampA - timestampB;
    });
  }
  
  /**
   * Abilita o disabilita il debug logging
   * @param {boolean} enabled - Se abilitare il debug
   */
  setDebug(enabled) {
    this.config.debug = enabled;
  }
}

// Crea e esporta una singola istanza del servizio
const filterService = new FilterService();
export default filterService;