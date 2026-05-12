/**
 * Service for sending notifications to Telegram
 * Provides a centralized way to send messages to different Telegram channels/bots
 */
class TelegramService {
  constructor() {
    // API endpoints for different types of notifications
    this.API_ENDPOINTS = {
      ANIMALS: 'https://imridd.eu.pythonanywhere.com/api/telegram/send_message_animals',
    };
  }

  async sendPostNotification(postDetails) {
    return this.sendNotification('ANIMALS', this._buildPostUrl(postDetails));
  }

  _buildPostUrl(postDetails) {
    if (!postDetails || !postDetails.username || !postDetails.permlink) {
      throw new Error('Invalid post details: username and permlink are required');
    }
    return `https://cur8.fun/@${postDetails.username}/${postDetails.permlink}`;
  }


  async sendNotification(endpointKey, content) {
    try {
      if (!this.API_ENDPOINTS[endpointKey]) {
        throw new Error(`Invalid endpoint key: ${endpointKey}`);
      }

      // Usa l'endpoint corretto senza il parametro di query
      const baseUrl = this.API_ENDPOINTS[endpointKey].split('?')[0];
      
      const headers = new Headers({
        'Content-Type': 'application/json'
      });
      
      // Invia il post_url nel body come JSON
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ post_url: content })
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