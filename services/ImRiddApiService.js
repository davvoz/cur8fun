// Service to fetch curation stats from im-ridd API
class ImRiddApiService {
  constructor() {
    this.baseUrl = 'https://imridd.eu.pythonanywhere.com/api/steem';
  }

  async getCur8Stats() {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) throw new Error('API error');
      return await response.json();
    } catch (e) {
      console.error('Failed to fetch im-ridd stats:', e);
      return null;
    }
  }
}

export default new ImRiddApiService();
