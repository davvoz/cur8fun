import steemService from './SteemService.js';
import walletService from './WalletService.js';
import filterService from './FilterService.js';
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
      console.error('Error fetching transaction history for %s:', username, error);
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
      case 'withdraw_vesting':
        return data.account === username;
      case 'set_withdraw_vesting_route':
        return data.from_account === username;
      case 'delegate_vesting_shares':
        return data.delegator === username;
      case 'claim_reward_balance':
      case 'account_update':
      case 'account_update2':
        return data.account === username;
      case 'custom_json':
        return (Array.isArray(data.required_posting_auths) && data.required_posting_auths.includes(username)) ||
               (Array.isArray(data.required_auths) && data.required_auths.includes(username));
      case 'transfer_to_savings':
      case 'transfer_from_savings':
      case 'cancel_transfer_from_savings':
        return data.from === username;
      case 'limit_order_create':
      case 'limit_order_create2':
      case 'limit_order_cancel':
        return data.owner === username;
      case 'witness_vote':
        return data.account === username;
      case 'witness_update':
        return data.owner === username;
      case 'escrow_transfer':
      case 'escrow_dispute':
        return data.from === username;
      case 'escrow_approve':
      case 'escrow_release':
        return data.who === username || data.from === username;
      case 'return_vesting_delegation':
        return data.account === username;
      case 'create_claimed_account':
        return data.creator === username;
      case 'feed_publish':
        return data.publisher === username;
      case 'proposal_pay':
        return data.payer === username;
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
      case 'interest':
        return data.owner === username;
      case 'producer_reward':
        return data.producer === username;
      case 'return_vesting_delegation':
        return data.account === username;
      case 'fill_convert_request':
        return data.owner === username;
      case 'transfer_to_savings':
        return data.to === username;
      case 'transfer_from_savings':
        return data.to === username;
      case 'comment_benefactor_reward':
        return data.author === username || data.benefactor === username;
      case 'fill_order':
        return data.current_owner === username || data.open_owner === username;
      case 'escrow_transfer':
        return data.to === username || data.agent === username;
      case 'escrow_approve':
      case 'escrow_release':
        return data.to === username;
      case 'proposal_pay':
        return data.receiver === username;
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
      case 'set_withdraw_vesting_route':
        return { icon: 'alt_route', iconClass: 'power-down' };
      case 'curation_reward':
        return { icon: 'stars', iconClass: 'curation' };
      case 'author_reward':
      case 'comment_reward':
        return { icon: 'payment', iconClass: 'reward' };
      case 'comment_benefactor_reward':
        return { icon: 'volunteer_activism', iconClass: 'reward' };
      case 'delegate_vesting_shares':
        return { icon: 'share', iconClass: 'delegation' };
      case 'return_vesting_delegation':
        return { icon: 'keyboard_return', iconClass: 'delegation' };
      case 'account_update':
      case 'account_update2':
        return { icon: 'manage_accounts', iconClass: 'account-update' };
      case 'custom_json':
        return { icon: 'code', iconClass: 'custom' };
      case 'transfer_to_savings':
        return { icon: 'savings', iconClass: 'transfer' };
      case 'transfer_from_savings':
        return { icon: 'move_up', iconClass: 'transfer' };
      case 'cancel_transfer_from_savings':
        return { icon: 'cancel', iconClass: 'transfer' };
      case 'interest':
        return { icon: 'percent', iconClass: 'reward' };
      case 'producer_reward':
        return { icon: 'verified', iconClass: 'reward' };
      case 'fill_convert_request':
        return { icon: 'sync_alt', iconClass: 'transfer' };
      case 'limit_order_create':
      case 'limit_order_create2':
        return { icon: 'receipt_long', iconClass: 'transfer' };
      case 'limit_order_cancel':
        return { icon: 'cancel', iconClass: 'transfer' };
      case 'fill_order':
        return { icon: 'shopping_cart', iconClass: 'transfer' };
      case 'witness_vote':
        return { icon: 'how_to_vote', iconClass: 'custom' };
      case 'witness_update':
        return { icon: 'update', iconClass: 'account-update' };
      case 'feed_publish':
        return { icon: 'publish', iconClass: 'custom' };
      case 'escrow_transfer':
        return { icon: 'security', iconClass: 'transfer' };
      case 'escrow_approve':
        return { icon: 'check_circle', iconClass: 'transfer' };
      case 'escrow_dispute':
        return { icon: 'gavel', iconClass: 'transfer' };
      case 'escrow_release':
        return { icon: 'lock_open', iconClass: 'transfer' };
      case 'proposal_pay':
        return { icon: 'description', iconClass: 'transfer' };
      case 'create_claimed_account':
        return { icon: 'person_add', iconClass: 'account-update' };
      default:
        return { icon: 'receipt', iconClass: 'other' };
    }
  }

  /**
   * Formatta il titolo di una transazione
   */
  formatTitle(type) {
    switch (type) {
      case 'transfer':               return 'Transfer';
      case 'vote':                   return 'Vote';
      case 'comment':                return 'Comment/Post';
      case 'comment_options':        return 'Post Options';
      case 'claim_reward_balance':   return 'Claim Rewards';
      case 'transfer_to_vesting':    return 'Power Up';
      case 'withdraw_vesting':       return 'Power Down';
      case 'set_withdraw_vesting_route': return 'Power Down Route';
      case 'curation_reward':        return 'Curation Reward';
      case 'author_reward':
      case 'comment_reward':         return 'Author Reward';
      case 'comment_benefactor_reward': return 'Benefactor Reward';
      case 'delegate_vesting_shares': return 'Delegation';
      case 'return_vesting_delegation': return 'Delegation Returned';
      case 'account_update':
      case 'account_update2':        return 'Account Update';
      case 'custom_json':            return 'Custom JSON';
      case 'transfer_to_savings':    return 'Transfer to Savings';
      case 'transfer_from_savings':  return 'Withdraw from Savings';
      case 'cancel_transfer_from_savings': return 'Cancel Savings Withdrawal';
      case 'interest':               return 'SBD Interest';
      case 'producer_reward':        return 'Block Producer Reward';
      case 'fill_convert_request':   return 'Convert Completed';
      case 'limit_order_create':
      case 'limit_order_create2':    return 'Limit Order Created';
      case 'limit_order_cancel':     return 'Limit Order Cancelled';
      case 'fill_order':             return 'Order Filled';
      case 'witness_vote':           return 'Witness Vote';
      case 'witness_update':         return 'Witness Update';
      case 'feed_publish':           return 'Price Feed Published';
      case 'escrow_transfer':        return 'Escrow Transfer';
      case 'escrow_approve':         return 'Escrow Approved';
      case 'escrow_dispute':         return 'Escrow Dispute';
      case 'escrow_release':         return 'Escrow Released';
      case 'proposal_pay':           return 'Proposal Payment';
      case 'create_claimed_account': return 'Account Created';
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
      
      case 'account_update':
        const updates = [];
        if (data.owner) updates.push('owner keys');
        if (data.active) updates.push('active keys');
        if (data.posting) updates.push('posting keys');
        if (data.memo_key) updates.push('memo key');
        if (data.json_metadata) updates.push('profile info');
        
        const updateItems = updates.length > 0 ? updates.join(', ') : 'account details';
        return `Updated ${updateItems}`;
        
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
      
      case 'set_withdraw_vesting_route':
        return `Route ${data.percent / 100}% of power-down to @${data.to_account}`;

      case 'transfer_to_savings':
        if (currentUsername) {
          if (data.from === currentUsername) return `Saved ${data.amount} → @${data.to}`;
          if (data.to === currentUsername) return `Received savings ${data.amount} from @${data.from}`;
        }
        return `${data.from} → ${data.to}: ${data.amount}`;

      case 'transfer_from_savings':
        if (currentUsername) {
          if (data.from === currentUsername) return `Withdrew ${data.amount} from savings → @${data.to}`;
          if (data.to === currentUsername) return `Received ${data.amount} from @${data.from} savings`;
        }
        return `${data.from} withdrew ${data.amount} → ${data.to}`;

      case 'cancel_transfer_from_savings':
        return `Cancelled savings withdrawal #${data.request_id}`;

      case 'interest':
        return `Received ${data.interest} SBD interest`;

      case 'producer_reward': {
        const prSP = await this.convertVestsToSP(data.vesting_shares);
        return `Block producer reward: ${prSP}`;
      }

      case 'return_vesting_delegation': {
        const retSP = await this.convertVestsToSP(data.vesting_shares);
        return `Delegation returned: ${retSP}`;
      }

      case 'fill_convert_request':
        return `Converted ${data.amount_in} → ${data.amount_out}`;

      case 'limit_order_create':
      case 'limit_order_create2':
        return `Sell ${data.amount_to_sell} for ${data.min_to_receive}`;

      case 'limit_order_cancel':
        return `Cancelled order #${data.orderid}`;

      case 'fill_order':
        return `Order filled: ${data.current_pays} for ${data.open_pays}`;

      case 'witness_vote':
        return data.approve
          ? `Approved witness @${data.witness}`
          : `Removed vote for witness @${data.witness}`;

      case 'witness_update':
        return `Updated witness configuration`;

      case 'feed_publish':
        return `Published price feed: ${data.exchange_rate?.base} per ${data.exchange_rate?.quote}`;

      case 'comment_benefactor_reward': {
        const bSP = await this.convertVestsToSP(data.vesting_payout);
        if (currentUsername === data.benefactor)
          return `Benefactor reward ${data.sbd_payout || '0 SBD'}, ${bSP} on @${data.author}'s post`;
        return `Paid ${data.sbd_payout || '0 SBD'}, ${bSP} to benefactor @${data.benefactor}`;
      }

      case 'escrow_transfer':
        return `Escrow ${data.steem_amount || data.sbd_amount} to @${data.to} (agent: @${data.agent})`;

      case 'escrow_approve':
        return `Approved escrow #${data.escrow_id} between @${data.from} and @${data.to}`;

      case 'escrow_dispute':
        return `Disputed escrow #${data.escrow_id}`;

      case 'escrow_release':
        return `Released ${data.steem_amount || data.sbd_amount} from escrow #${data.escrow_id}`;

      case 'proposal_pay':
        return `Proposal payment: ${data.payment} to @${data.receiver}`;

      case 'create_claimed_account':
        return `Created new account @${data.new_account_name}`;

      case 'comment_options':
        return `Options set for post @${data.author}/${data.permlink?.substring(0, 20)}...`;
      
      default:
        return `Operation: ${type}`;
    }
  }

  /**
   * Crea un link all'explorer per una transazione specifica
   */
  createExplorerLink(transaction, data) {
    if (data.author && data.permlink) {
      // Use internal application routing instead of full URL
      return `/@${data.author}/${data.permlink}`;
    }
    return `https://steemblockexplorer.com/tx/${transaction.trx_id || transaction.id}`;
  }

  /**
   * Filtra le transazioni usando il FilterService centralizzato
   * @param {Array} transactions - Array di transazioni da filtrare
   * @param {Object} filters - Oggetto con i filtri da applicare
   * @param {string} currentUsername - Username dell'utente corrente
   * @returns {Array} - Transazioni filtrate
   */
  filterTransactions(transactions, filters, currentUsername = null) {
    // Crea il contesto da passare al filterService
    const context = {
      username: currentUsername,
      isActionBy: this.isActionBy.bind(this),
      isActionOn: this.isActionOn.bind(this)
    };
    
    return filterService.filterTransactions(transactions, filters, context);
  }

  /**
   * Ordina le transazioni usando il FilterService centralizzato
   * @param {Array} transactions - Array di transazioni da ordinare
   * @param {string} direction - Direzione di ordinamento ('asc' o 'desc')
   * @returns {Array} - Transazioni ordinate
   */
  sortTransactions(transactions, direction = 'desc') {
    return filterService.sortTransactions(transactions, direction);
  }
  
  /**
   * Recupera e unifica i tipi di transazione unici da un array di transazioni
   * @param {Array} transactions - Array di transazioni da analizzare
   * @returns {Object} - Oggetto con i tipi di transazione come chiavi e conteggio come valori
   */
  extractTransactionTypes(transactions) {
    const typeCounts = {};
    const processedIds = new Set();
    
    for (const tx of transactions) {
      // Evita di contare la stessa transazione due volte
      if (processedIds.has(tx.id)) continue;
      processedIds.add(tx.id);
      
      const txType = tx.type || 'other';
      typeCounts[txType] = (typeCounts[txType] || 0) + 1;
    }
    
    return typeCounts;
  }
  
  /**
   * Ottiene la mappa standard di icone per i tipi di transazione
   * @returns {Object} - Oggetto con tipi di transazione come chiavi e nomi di icone come valori
   */
  getStandardIconMap() {
    return {
      transfer: 'swap_horiz',
      claim_reward_balance: 'card_giftcard',
      vote: 'thumb_up',
      comment: 'comment',
      curation_reward: 'workspace_premium',
      author_reward: 'stars',
      delegate_vesting_shares: 'engineering',
      fill_order: 'shopping_cart',
      limit_order: 'receipt_long',
      producer_reward: 'verified',
      account_update: 'manage_accounts',
      effective_comment_vote: 'how_to_vote',
      withdraw_vesting: 'power_off',
      liquidity_reward: 'water_drop',
      interest: 'trending_up',
      transfer_to_vesting: 'upgrade',
      cancel_transfer_from_savings: 'cancel',
      return_vesting_delegation: 'keyboard_return',
      proposal_pay: 'description',
      escrow_transfer: 'security',
      escrow_approve: 'check_circle',
      escrow_dispute: 'gavel',
      escrow_release: 'lock_open',
      fill_convert_request: 'sync_alt',
      transfer_to_savings: 'savings',
      transfer_from_savings: 'move_up',
      comment_benefactor_reward: 'volunteer_activism',
      comment_reward: 'emoji_events',
      witness_update: 'update',
      witness_vote: 'how_to_vote',
      create_claimed_account: 'person_add',
      feed_publish: 'publish',
      other: 'more_horiz'
    };
  }
  
  /**
   * Recupera lo stato di filtro predefinito per tutti i tipi di transazioni
   * @param {boolean} defaultValue - Valore predefinito per i filtri (true = attivo)
   * @returns {Object} - Oggetto con tipi di transazione come chiavi e defaultValue come valori
   */
  getDefaultFilterState(defaultValue = true) {
    return {
      transfer: defaultValue,
      vote: defaultValue,
      comment: defaultValue,
      claim_reward_balance: defaultValue,
      transfer_to_vesting: defaultValue,
      withdraw_vesting: defaultValue,
      curation_reward: defaultValue,
      author_reward: defaultValue,
      comment_reward: defaultValue,
      delegate_vesting_shares: defaultValue,
      custom_json: defaultValue,
      other: defaultValue
    };
  }
}

// Crea e esporta una singola istanza del servizio
const transactionHistoryService = new TransactionHistoryService();
export default transactionHistoryService;
