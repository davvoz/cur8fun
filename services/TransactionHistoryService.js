import steemService from './SteemService.js';
import walletService from './WalletService.js';
import { formatDate } from '../utils/DateUtils.js';

class TransactionHistoryService {
  constructor() {
    // Cache per le conversioni VESTS -> SP per evitare calcoli ripetuti
    this.vestsToSPCache = new Map();
  }

  /**
   * Recupera la cronologia delle transazioni per un utente
   * @param {string} username - Nome utente di cui recuperare la cronologia
   * @param {number} limit - Numero massimo di transazioni da recuperare
   * @param {number} from - ID transazione da cui iniziare (default: -1 per le più recenti)
   * @return {Promise<Array>} - Array di transazioni
   */
  async getUserTransactionHistory(username, limit = 30, from = -1) {
    if (!username) return [];
    
    try {
      const steem = await steemService.ensureLibraryLoaded();
      
      return new Promise((resolve, reject) => {
        steem.api.getAccountHistory(username, from, limit, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      console.error(`Error fetching transaction history for ${username}:`, error);
      return [];
    }
  }

  /**
   * Formatta una transazione per la visualizzazione
   * @param {Object} transaction - Transazione da formattare
   * @param {string} currentUsername - Nome utente corrente per confrontare con la transazione
   * @return {Object} - Transazione formattata
   */
  async formatTransaction(transaction, currentUsername = null) {
    const [id, txData] = transaction;
    const type = txData.op[0];
    const data = txData.op[1];
    const timestamp = txData.timestamp;
    const trx_id = txData.trx_id;

    const { icon, iconClass } = this.getIconForType(type, data);
    const title = this.formatTitle(type);
    const description = await this.formatTransactionDescription(type, data, currentUsername);
    
    // Determina se è un'azione dell'utente o sull'utente
    const isActionByUser = currentUsername ? this.isActionBy(type, data, currentUsername) : false;
    const isActionOnUser = currentUsername ? this.isActionOn(type, data, currentUsername) : false;

    return {
      id,
      type,
      data,
      timestamp,
      trx_id,
      icon,
      iconClass,
      title,
      description,
      isActionByUser,
      isActionOnUser,
      formattedDate: formatDate(timestamp)
    };
  }

  /**
   * Controlla se un'operazione è eseguita dall'utente specificato
   */
  isActionBy(type, data, username) {
    switch (type) {
      case 'transfer':
        return data.from === username;
      case 'vote':
        return data.voter === username;
      case 'comment':
      case 'comment_options':
        return data.author === username;
      case 'transfer_to_vesting':
        return data.from === username;
      case 'delegate_vesting_shares':
        return data.delegator === username;
      case 'claim_reward_balance':
        return data.account === username;
      case 'custom_json':
        return Array.isArray(data.required_posting_auths) && 
               data.required_posting_auths.includes(username);
      default:
        return false;
    }
  }

  /**
   * Controlla se un'operazione è eseguita sull'utente specificato
   */
  isActionOn(type, data, username) {
    switch (type) {
      case 'transfer':
        return data.to === username;
      case 'vote':
        return data.author === username;
      case 'comment':
        return data.parent_author === username;
      case 'transfer_to_vesting':
        return data.to === username;
      case 'delegate_vesting_shares':
        return data.delegatee === username;
      case 'claim_reward_balance':
        return data.account === username;
      case 'curation_reward':
        return data.curator === username;
      case 'author_reward':
      case 'comment_reward':
        return data.author === username;
      default:
        return false;
    }
  }

  /**
   * Ottiene l'icona appropriata per un tipo di transazione
   */
  getIconForType(type, data) {
    switch (type) {
      case 'transfer':
        return { icon: 'swap_horiz', iconClass: 'transfer' };
      case 'vote':
        return data.weight > 0 
          ? { icon: 'thumb_up', iconClass: 'upvote' } 
          : { icon: 'thumb_down', iconClass: 'downvote' };
      case 'comment':
        return data.parent_author 
          ? { icon: 'chat', iconClass: 'reply' } 
          : { icon: 'create', iconClass: 'post' };
      case 'claim_reward_balance':
        return { icon: 'redeem', iconClass: 'claim' };
      case 'transfer_to_vesting':
        return { icon: 'trending_up', iconClass: 'power-up' };
      case 'withdraw_vesting':
        return { icon: 'trending_down', iconClass: 'power-down' };
      case 'curation_reward':
        return { icon: 'stars', iconClass: 'curation' };
      case 'author_reward':
      case 'comment_reward':
        return { icon: 'payment', iconClass: 'reward' };
      case 'delegate_vesting_shares':
        return { icon: 'share', iconClass: 'delegation' };
      case 'custom_json':
        return { icon: 'code', iconClass: 'custom' };
      default:
        return { icon: 'receipt', iconClass: 'other' };
    }
  }

  /**
   * Formatta il titolo di una transazione
   */
  formatTitle(type) {
    switch (type) {
      case 'transfer':
        return 'Transfer';
      case 'vote':
        return 'Vote';
      case 'comment':
        return 'Comment/Post';
      case 'claim_reward_balance':
        return 'Claim Rewards';
      case 'transfer_to_vesting':
        return 'Power Up';
      case 'withdraw_vesting':
        return 'Power Down';
      case 'curation_reward':
        return 'Curation Reward';
      case 'author_reward':
      case 'comment_reward':
        return 'Author Reward';
      case 'delegate_vesting_shares':
        return 'Delegation';
      case 'custom_json':
        return 'Custom JSON';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  /**
   * Converte VESTS in SP con cache per migliorare le prestazioni
   */
  async convertVestsToSP(vestsAmount) {
    if (!vestsAmount) return '0 SP';
    
    // Estrai solo il valore numerico, rimuovendo 'VESTS'
    const vestsValue = parseFloat(vestsAmount.split(' ')[0]);
    
    // Controlla se il valore è già in cache
    if (this.vestsToSPCache.has(vestsValue)) {
      return this.vestsToSPCache.get(vestsValue);
    }
    
    try {
      // Converti VESTS in SP usando il WalletService
      const spValue = await walletService.vestsToSteem(vestsValue);
      const result = `${spValue.toFixed(3)} SP`;
      
      // Salva in cache il risultato
      this.vestsToSPCache.set(vestsValue, result);
      
      return result;
    } catch (error) {
      console.error('Error converting VESTS to SP:', error);
      return vestsAmount; // Fallback al valore originale in caso di errore
    }
  }

  /**
   * Formatta la descrizione di una transazione con conversione VESTS->SP
   */
  async formatTransactionDescription(type, data, currentUsername = null) {
    // Determina il contesto dell'azione rispetto all'utente corrente
    const isSent = currentUsername && this.isActionBy(type, data, currentUsername);
    
    switch (type) {
      case 'transfer':
        if (currentUsername) {
          if (data.from === currentUsername) {
            return `To @${data.to}: ${data.amount} ${data.memo ? `- Memo: ${data.memo}` : ''}`;
          } else if (data.to === currentUsername) {
            return `From @${data.from}: ${data.amount} ${data.memo ? `- Memo: ${data.memo}` : ''}`;
          }
        }
        return `${data.from} → ${data.to}: ${data.amount} ${data.memo ? `- Memo: ${data.memo}` : ''}`;
        
      case 'vote':
        const weightPercent = (data.weight / 100).toFixed(0);
        if (currentUsername) {
          if (data.voter === currentUsername) {
            return `Voted ${weightPercent}% on @${data.author}/${data.permlink.substring(0, 15)}...`;
          } else if (data.author === currentUsername) {
            return `@${data.voter} voted ${weightPercent}% on your post`;
          }
        }
        return `${data.voter} voted ${weightPercent}% on @${data.author}/${data.permlink.substring(0, 15)}...`;
        
      case 'comment':
        if (data.parent_author) {
          return `Reply to @${data.parent_author}/${data.parent_permlink.substring(0, 15)}...`;
        }
        return `Post: "${data.title || data.permlink.substring(0, 30)}"`;
        
      case 'claim_reward_balance':
        // Converti reward_vests in SP
        const rewardSP = await this.convertVestsToSP(data.reward_vests);
        return `Claimed ${data.reward_steem || '0 STEEM'}, ${data.reward_sbd || '0 SBD'}, ${rewardSP}`;
        
      case 'transfer_to_vesting':
        return `Powered up ${data.amount} to ${data.to}`;
        
      case 'delegate_vesting_shares':
        // Converti vesting_shares in SP
        const delegatedSP = await this.convertVestsToSP(data.vesting_shares);
        if (currentUsername) {
          if (data.delegator === currentUsername) {
            return `Delegated ${delegatedSP} to @${data.delegatee}`;
          } else if (data.delegatee === currentUsername) {
            return `Received delegation of ${delegatedSP} from @${data.delegator}`;
          }
        }
        return `${data.delegator} delegated ${delegatedSP} to ${data.delegatee}`;
        
      case 'curation_reward':
        // Converti reward in SP
        const curationSP = await this.convertVestsToSP(data.reward);
        return `Received ${curationSP} for curating @${data.comment_author}/${data.comment_permlink.substring(0, 15)}...`;
        
      case 'author_reward':
      case 'comment_reward':
        // Converti vesting_payout in SP
        const authorSP = await this.convertVestsToSP(data.vesting_payout);
        return `Received ${data.sbd_payout || '0 SBD'}, ${data.steem_payout || '0 STEEM'}, ${authorSP} for content`;
        
      case 'withdraw_vesting':
        // Converti vesting_shares in SP
        const withdrawSP = await this.convertVestsToSP(data.vesting_shares);
        return `Power down of ${withdrawSP}`;
        
      default:
        return `Operation: ${type}`;
    }
  }

  /**
   * Crea un link all'explorer per una transazione specifica
   */
  createExplorerLink(transaction, data) {
    if (data.author && data.permlink) {
      return `https://davvoz.github.io/steemee/#/@${data.author}/${data.permlink}`;
    }
    return `https://steemblockexplorer.com/tx/${transaction.trx_id || transaction.id}`;
  }

  /**
   * Filtra le transazioni in base ai tipi e direzione specificati
   */
  filterTransactions(transactions, filters, currentUsername = null) {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    // Se non ci sono filtri, restituisci tutte le transazioni
    if (!filters) return transactions;
    
    return transactions.filter(tx => {
      // Per array di transazioni già elaborate
      if (!Array.isArray(tx)) {
        const type = tx.type;
        
        // Filtra per tipo di transazione
        let passTypeFilter = true;
        if (filters.types) {
          if (filters.types.transfer !== undefined && 
              ['transfer', 'transfer_to_vesting', 'withdraw_vesting'].includes(type)) {
            passTypeFilter = filters.types.transfer;
          } else if (filters.types.vote !== undefined && 
                    ['vote', 'effective_comment_vote'].includes(type)) {
            passTypeFilter = filters.types.vote;
          } else if (filters.types.comment !== undefined && 
                    ['comment', 'comment_reward', 'comment_options'].includes(type)) {
            passTypeFilter = filters.types.comment;
          } else if (filters.types.other !== undefined) {
            passTypeFilter = filters.types.other;
          }
        }
        
        if (!passTypeFilter) return false;
        
        // Filtra per direzione
        if (filters.direction && currentUsername) {
          const isActionByUser = tx.isActionByUser || this.isActionBy(type, tx.data, currentUsername);
          const isActionOnUser = tx.isActionOnUser || this.isActionOn(type, tx.data, currentUsername);
          
          return (filters.direction.byUser && isActionByUser) || 
                 (filters.direction.onUser && isActionOnUser);
        }
        
        return true;
      } 
      // Per array [id, txData] dalla API di Steem
      else {
        const [id, txData] = tx;
        const type = txData.op[0];
        const data = txData.op[1];
        
        // Filtra per tipo di transazione
        let passTypeFilter = true;
        if (filters.types) {
          if (filters.types.transfer !== undefined && 
              ['transfer', 'transfer_to_vesting', 'withdraw_vesting'].includes(type)) {
            passTypeFilter = filters.types.transfer;
          } else if (filters.types.vote !== undefined && 
                    ['vote', 'effective_comment_vote'].includes(type)) {
            passTypeFilter = filters.types.vote;
          } else if (filters.types.comment !== undefined && 
                    ['comment', 'comment_reward', 'comment_options'].includes(type)) {
            passTypeFilter = filters.types.comment;
          } else if (filters.types.other !== undefined) {
            passTypeFilter = filters.types.other;
          }
        }
        
        if (!passTypeFilter) return false;
        
        // Filtra per direzione
        if (filters.direction && currentUsername) {
          const isActionByUser = this.isActionBy(type, data, currentUsername);
          const isActionOnUser = this.isActionOn(type, data, currentUsername);
          
          return (filters.direction.byUser && isActionByUser) || 
                 (filters.direction.onUser && isActionOnUser);
        }
        
        return true;
      }
    });
  }

  /**
   * Ordina le transazioni per timestamp, dalla più recente alla più vecchia
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
}

// Crea e esporta una singola istanza del servizio
const transactionHistoryService = new TransactionHistoryService();
export default transactionHistoryService;
