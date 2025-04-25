/**
 * Service for sending notifications to Telegram
 * Provides a centralized way to send messages to different Telegram channels/bots
 */
class TelegramService {
  constructor() {
    // API endpoints for different types of notifications
    this.API_ENDPOINTS = {
      // Endpoint per notifiche relative agli animali
      ANIMALS: 'https://develop-imridd.eu.pythonanywhere.com/api/telegram/send_message_animals/?post_url=',
      // Altri endpoint possono essere aggiunti qui in futuro
      // NEWS: 'https://example.com/api/telegram/news',
      // UPDATES: 'https://example.com/api/telegram/updates',
    };
  }

  /**
   * Invia una notifica relativa a un post al canale Telegram degli animali
   * @param {Object} postDetails - Dettagli del post (username, permlink, ecc.)
   * @returns {Promise<boolean>} - true se l'invio è riuscito, false altrimenti
   */
  async sendPostNotification(postDetails) {
    return this.sendNotification('ANIMALS', this._buildPostUrl(postDetails));
  }

  /**
   * Costruisce l'URL completo di un post Steem
   * @param {Object} postDetails - Dettagli del post (username, permlink)
   * @returns {string} - URL completo del post
   * @private
   */
  _buildPostUrl(postDetails) {
    if (!postDetails || !postDetails.username || !postDetails.permlink) {
      throw new Error('Invalid post details: username and permlink are required');
    }
    return `https://steemit.com/@${postDetails.username}/${postDetails.permlink}`;
  }

  /**
   * Invia una notifica Telegram a un endpoint specifico
   * @param {string} endpointKey - Chiave dell'endpoint (da this.API_ENDPOINTS)
   * @param {string} content - Contenuto da inviare
   * @returns {Promise<boolean>} - true se l'invio è riuscito, false altrimenti
   */
  async sendNotification(endpointKey, content) {
    try {
      if (!this.API_ENDPOINTS[endpointKey]) {
        throw new Error(`Invalid endpoint key: ${endpointKey}`);
      }

      const apiUrl = `${this.API_ENDPOINTS[endpointKey]}${encodeURIComponent(content)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Telegram notification failed with status: ${response.status}`);
      }
      
      console.log(`Telegram notification sent successfully to ${endpointKey}`);
      return true;
    } catch (error) {
      console.error(`Failed to send Telegram notification to ${endpointKey}:`, error);
      return false;
    }
  }

  /**
   * Invia una notifica personalizzata a un endpoint specifico
   * @param {string} endpointKey - Chiave dell'endpoint (da this.API_ENDPOINTS)
   * @param {string} message - Messaggio da inviare
   * @returns {Promise<boolean>} - true se l'invio è riuscito, false altrimenti
   */
  async sendCustomNotification(endpointKey, message) {
    return this.sendNotification(endpointKey, message);
  }
}

// Create and export singleton instance
const telegramService = new TelegramService();
export default telegramService;