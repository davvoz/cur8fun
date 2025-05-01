/**
 * CryptoConverterWidget.js
 * Widget per la conversione tra diverse criptovalute
 */
class CryptoConverterWidget {
  constructor() {
    this.cryptoPrices = {};
  }

  /**
   * Crea il widget per la conversione di criptovalute
   */
  render() {
    const widget = document.createElement('div');
    widget.className = 'widget crypto-converter-widget';
    
    const widgetHeader = document.createElement('div');
    widgetHeader.className = 'widget-header';
    widgetHeader.innerHTML = '<h3>Crypto Converter</h3>';
    widget.appendChild(widgetHeader);
    
    const widgetContent = document.createElement('div');
    widgetContent.className = 'widget-content';
    
    // Create converter form
    const converterForm = document.createElement('div');
    converterForm.className = 'converter-form';
    
    // From currency section
    const fromSection = document.createElement('div');
    fromSection.className = 'converter-section';
    
    const fromLabel = document.createElement('label');
    fromLabel.textContent = 'From';
    fromSection.appendChild(fromLabel);
    
    const fromInputWrapper = document.createElement('div');
    fromInputWrapper.className = 'input-select-wrapper';
    
    const fromInput = document.createElement('input');
    fromInput.type = 'number';
    fromInput.className = 'converter-input';
    fromInput.id = 'from-amount';
    fromInput.value = '1';
    fromInput.min = '0';
    fromInput.step = 'any';
    fromInputWrapper.appendChild(fromInput);
    
    const fromSelect = document.createElement('select');
    fromSelect.className = 'converter-select';
    fromSelect.id = 'from-currency';
    
    // Initial loading state
    fromSelect.innerHTML = '<option value="">Loading...</option>';
    
    fromInputWrapper.appendChild(fromSelect);
    fromSection.appendChild(fromInputWrapper);
    
    // To currency section
    const toSection = document.createElement('div');
    toSection.className = 'converter-section';
    
    const toLabel = document.createElement('label');
    toLabel.textContent = 'To';
    toSection.appendChild(toLabel);
    
    const toInputWrapper = document.createElement('div');
    toInputWrapper.className = 'input-select-wrapper';
    
    const toInput = document.createElement('input');
    toInput.type = 'number';
    toInput.className = 'converter-input';
    toInput.id = 'to-amount';
    toInput.value = '0';
    toInput.readOnly = true;
    toInputWrapper.appendChild(toInput);
    
    const toSelect = document.createElement('select');
    toSelect.className = 'converter-select';
    toSelect.id = 'to-currency';
    
    // Initial loading state
    toSelect.innerHTML = '<option value="">Loading...</option>';
    
    toInputWrapper.appendChild(toSelect);
    toSection.appendChild(toInputWrapper);
    
    // Last updated section
    const lastUpdated = document.createElement('div');
    lastUpdated.className = 'last-updated';
    lastUpdated.textContent = 'Loading price data...';
    
    // Swap button
    const swapButton = document.createElement('button');
    swapButton.className = 'swap-button';
    swapButton.innerHTML = '<span class="material-icons">swap_vert</span>';
    swapButton.title = 'Swap currencies';
    
    // Add everything to the form
    converterForm.appendChild(fromSection);
    converterForm.appendChild(swapButton);
    converterForm.appendChild(toSection);
    converterForm.appendChild(lastUpdated);
    
    widgetContent.appendChild(converterForm);
    widget.appendChild(widgetContent);
    
    // Load cryptocurrency data asynchronously
    setTimeout(() => {
      this.initCryptoConverter(fromSelect, toSelect, fromInput, toInput, lastUpdated, swapButton);
    }, 500);
    
    return widget;
  }
  
  /**
   * Initialize crypto converter functionality
   */
  async initCryptoConverter(fromSelect, toSelect, fromInput, toInput, lastUpdatedElement, swapButton) {
    try {
      // Define cryptocurrencies to include
      const cryptos = ['steem', 'bitcoin', 'ethereum', 'hive', 'usdt', 'bnb', 'xrp', 'solana'];
      
      // Fetch current prices
      const prices = await this.fetchCryptoPrices(cryptos);
      this.cryptoPrices = prices;
      
      // Populate selects
      fromSelect.innerHTML = '';
      toSelect.innerHTML = '';
      
      // Add USD option
      const usdOption = document.createElement('option');
      usdOption.value = 'usd';
      usdOption.textContent = 'USD';
      fromSelect.appendChild(usdOption.cloneNode(true));
      toSelect.appendChild(usdOption);
      
      // Add crypto options
      Object.keys(prices).forEach(crypto => {
        const option = document.createElement('option');
        option.value = crypto;
        option.textContent = this.formatCryptoName(crypto);
        
        fromSelect.appendChild(option.cloneNode(true));
        toSelect.appendChild(option);
      });
      
      // Set initial values
      fromSelect.value = 'steem';
      toSelect.value = 'usd';
      
      // Update last updated text
      const now = new Date();
      lastUpdatedElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
      
      // Add event listeners
      fromInput.addEventListener('input', () => this.convertCrypto(fromSelect, toSelect, fromInput, toInput));
      fromSelect.addEventListener('change', () => this.convertCrypto(fromSelect, toSelect, fromInput, toInput));
      toSelect.addEventListener('change', () => this.convertCrypto(fromSelect, toSelect, fromInput, toInput));
      
      // Add swap functionality
      swapButton.addEventListener('click', () => {
        const fromValue = fromSelect.value;
        const toValue = toSelect.value;
        
        // Swap the select values
        fromSelect.value = toValue;
        toSelect.value = fromValue;
        
        // Recalculate with new values
        this.convertCrypto(fromSelect, toSelect, fromInput, toInput);
      });
      
      // Initial conversion
      this.convertCrypto(fromSelect, toSelect, fromInput, toInput);
      
      // Set up auto-refresh every 2 minutes
      setInterval(() => this.refreshCryptoPrices(
        fromSelect, toSelect, fromInput, toInput, lastUpdatedElement
      ), 120000);
      
    } catch (error) {
      console.error('Failed to initialize crypto converter:', error);
      
      // Show error state
      fromSelect.innerHTML = '<option value="">Error loading</option>';
      toSelect.innerHTML = '<option value="">Error loading</option>';
      lastUpdatedElement.textContent = 'Failed to load price data';
      lastUpdatedElement.classList.add('error');
    }
  }
  
  /**
   * Convert from one crypto to another
   */
  convertCrypto(fromSelect, toSelect, fromInput, toInput) {
    const fromCurrency = fromSelect.value;
    const toCurrency = toSelect.value;
    const amount = parseFloat(fromInput.value) || 0;
    
    let result = 0;
    
    // Different conversion logic based on currency pairs
    if (fromCurrency === 'usd' && toCurrency === 'usd') {
      // USD to USD
      result = amount;
    } else if (fromCurrency === 'usd') {
      // USD to crypto
      const cryptoPrice = this.cryptoPrices[toCurrency]?.price || 0;
      result = cryptoPrice > 0 ? amount / cryptoPrice : 0;
    } else if (toCurrency === 'usd') {
      // Crypto to USD
      const cryptoPrice = this.cryptoPrices[fromCurrency]?.price || 0;
      result = amount * cryptoPrice;
    } else {
      // Crypto to crypto
      const fromPrice = this.cryptoPrices[fromCurrency]?.price || 0;
      const toPrice = this.cryptoPrices[toCurrency]?.price || 0;
      
      if (fromPrice > 0 && toPrice > 0) {
        // Convert to USD first, then to target crypto
        const usdValue = amount * fromPrice;
        result = usdValue / toPrice;
      }
    }
    
    // Format the result based on value
    if (result === 0) {
      toInput.value = '0';
    } else if (result < 0.001) {
      toInput.value = result.toFixed(8);
    } else if (result < 1) {
      toInput.value = result.toFixed(6);
    } else if (result < 1000) {
      toInput.value = result.toFixed(4);
    } else {
      toInput.value = result.toFixed(2);
    }
  }
  
  /**
   * Refresh crypto prices
   */
  async refreshCryptoPrices(fromSelect, toSelect, fromInput, toInput, lastUpdatedElement) {
    try {
      // Get current cryptos in the dropdown
      const cryptos = Array.from(fromSelect.options)
        .map(option => option.value)
        .filter(value => value !== 'usd');
      
      // Fetch fresh prices
      const prices = await this.fetchCryptoPrices(cryptos);
      this.cryptoPrices = prices;
      
      // Update last updated text
      const now = new Date();
      lastUpdatedElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
      
      // Recalculate with new prices
      this.convertCrypto(fromSelect, toSelect, fromInput, toInput);
    } catch (error) {
      console.error('Failed to refresh crypto prices:', error);
      lastUpdatedElement.textContent = 'Failed to update prices';
      lastUpdatedElement.classList.add('error');
    }
  }
  
  /**
   * Format cryptocurrency name for display
   */
  formatCryptoName(crypto) {
    const names = {
      'steem': 'STEEM',
      'bitcoin': 'Bitcoin (BTC)',
      'ethereum': 'Ethereum (ETH)',
      'hive': 'HIVE',
      'usdt': 'Tether (USDT)',
      'bnb': 'Binance Coin (BNB)',
      'xrp': 'Ripple (XRP)',
      'solana': 'Solana (SOL)'
    };
    
    return names[crypto] || crypto.charAt(0).toUpperCase() + crypto.slice(1);
  }
  
  /**
   * Fetch cryptocurrency prices from CoinGecko API
   */
  async fetchCryptoPrices(cryptos) {
    try {
      // In a real application, this would call your backend API
      // For demo purposes, we're using CoinGecko's public API directly
      const ids = cryptos.join(',');
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=100&price_change_percentage=24h`);
      
      if (!response.ok) {
        throw new Error(`API response: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format data into a more usable structure
      const priceData = {};
      data.forEach(coin => {
        priceData[coin.id] = {
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          price: coin.current_price,
          priceChange24h: coin.price_change_percentage_24h || 0,
          volume: coin.total_volume,
          marketCap: coin.market_cap
        };
      });
      
      return priceData;
    } catch (error) {
      console.error('Failed to fetch crypto prices:', error);
      throw error;
    }
  }
}

export default CryptoConverterWidget;