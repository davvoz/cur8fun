/**
 * SteemChartWidget.js
 * Widget che mostra il grafico dell'andamento di Steem
 */
class SteemChartWidget {
  constructor() {
    this.chartInstance = null;
    this.steemHistoricalData = [];
    
    // Flag per tracciare se le librerie sono in fase di caricamento
    this.isLoadingChartLibs = false;
    
    // Carichiamo le librerie necessarie all'inizializzazione
    this.loadChartLibraries();
  }
  
  /**
   * Pre-carica tutte le librerie necessarie per Chart.js
   */
  loadChartLibraries() {
    if (typeof Chart !== 'undefined' || this.isLoadingChartLibs) {
      return; // Già caricato o in fase di caricamento
    }
    
    this.isLoadingChartLibs = true;
    
    // Utilizziamo un approccio con bundle unico che include già tutti gli adapter
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js';
    document.head.appendChild(chartScript);
    
    chartScript.onload = () => {
      // Una volta caricato Chart.js, carichiamo il necessario per il time adapter
      const luxonScript = document.createElement('script');
      luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@2.3.1/build/global/luxon.min.js';
      document.head.appendChild(luxonScript);
      
      luxonScript.onload = () => {
        const adapterScript = document.createElement('script');
        adapterScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.1.0/dist/chartjs-adapter-luxon.min.js';
        document.head.appendChild(adapterScript);
        
        adapterScript.onload = () => {
          this.isLoadingChartLibs = false;
          console.log('Chart.js libraries loaded successfully');
        };
        
        adapterScript.onerror = (error) => {
          console.error('Failed to load Chart.js adapter:', error);
          this.isLoadingChartLibs = false;
        };
      };
      
      luxonScript.onerror = (error) => {
        console.error('Failed to load Luxon:', error);
        this.isLoadingChartLibs = false;
      };
    };
    
    chartScript.onerror = (error) => {
      console.error('Failed to load Chart.js:', error);
      this.isLoadingChartLibs = false;
    };
  }

  /**
   * Crea il widget del grafico di Steem
   */
  render() {
    const widget = document.createElement('div');
    widget.className = 'widget steem-chart-widget';
    
    const widgetHeader = document.createElement('div');
    widgetHeader.className = 'widget-header';
    widgetHeader.innerHTML = '<h3>Steem Price</h3>';
    widget.appendChild(widgetHeader);
    
    const widgetContent = document.createElement('div');
    widgetContent.className = 'widget-content';
    
    // Price overview section
    const priceOverview = document.createElement('div');
    priceOverview.className = 'price-overview';
    priceOverview.innerHTML = '<div class="widget-loading">Loading price data...</div>';
    widgetContent.appendChild(priceOverview);
    
    // Chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.style.height = '200px';
    widgetContent.appendChild(chartContainer);
    
    // Range selector
    const rangeSelector = document.createElement('div');
    rangeSelector.className = 'range-selector';
    
    ['24h', '7d', '1m', '3m', '1y'].forEach(range => {
      const button = document.createElement('button');
      button.className = 'range-button';
      button.textContent = range;
      button.addEventListener('click', () => this.updateChartRange(range, chartContainer));
      
      // Set 7d as default
      if (range === '7d') {
        button.classList.add('active');
      }
      
      rangeSelector.appendChild(button);
    });
    
    widgetContent.appendChild(rangeSelector);
    widget.appendChild(widgetContent);
    
    // Load price data asynchronously
    setTimeout(() => {
      this.loadSteemPriceData(priceOverview, chartContainer);
    }, 300);
    
    return widget;
  }
  
  /**
   * Load Steem price data and update the chart
   */
  async loadSteemPriceData(priceElement, chartContainer) {
    try {
      // Fetch current price
      const priceData = await this.fetchCryptoPrices(['steem']);
      
      if (priceData && priceData.steem) {
        const steemData = priceData.steem;
        
        // Update price overview
        priceElement.innerHTML = `
          <div class="current-price">
            <span class="price-value">$${steemData.price.toFixed(3)}</span>
            <span class="price-change ${steemData.priceChange24h >= 0 ? 'positive' : 'negative'}">
              ${steemData.priceChange24h >= 0 ? '+' : ''}${steemData.priceChange24h.toFixed(2)}%
              <span class="material-icons">
                ${steemData.priceChange24h >= 0 ? 'arrow_upward' : 'arrow_downward'}
              </span>
            </span>
          </div>
        `;
        
        // Fetch historical data for chart
        const historicalData = await this.fetchSteemHistoricalData('7d');
        this.steemHistoricalData = historicalData;
        
        // Initialize chart
        this.initChart(chartContainer, historicalData, '7d');
      } else {
        throw new Error('Invalid price data');
      }
    } catch (error) {
      console.error('Failed to load Steem price data:', error);
      priceElement.innerHTML = '<div class="widget-error">Failed to load price data</div>';
      chartContainer.innerHTML = '<div class="widget-error">Chart unavailable</div>';
    }
  }
  
  /**
   * Initialize price chart
   */
  initChart(container, data, range) {
    // Clear any existing chart
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="widget-error">No chart data available</div>';
      return;
    }
    
    // Se Chart.js non è ancora disponibile, ma è in fase di caricamento
    if (typeof Chart === 'undefined') {
      // Mostra stato di caricamento
      container.innerHTML = '<div class="widget-loading">Loading chart library...</div>';
      
      // Controlliamo periodicamente se Chart.js è disponibile
      const checkInterval = setInterval(() => {
        if (typeof Chart !== 'undefined' && !this.isLoadingChartLibs) {
          clearInterval(checkInterval);
          this.createPriceChart(container, data, range);
        }
      }, 300);
      
      // Timeout di sicurezza dopo 10 secondi
      setTimeout(() => {
        if (typeof Chart === 'undefined') {
          clearInterval(checkInterval);
          container.innerHTML = '<div class="widget-error">Failed to load chart library</div>';
        }
      }, 10000);
    } else {
      // Chart.js è già disponibile
      this.createPriceChart(container, data, range);
    }
  }
  
  /**
   * Create price chart with Chart.js
   */
  createPriceChart(container, data, range) {
    try {
      // Destroy existing chart if any
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
      
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      
      // Prepare chart data
      const ctx = canvas.getContext('2d');
      
      // Extract timestamps and prices
      const timestamps = data.map(item => item.timestamp);
      const prices = data.map(item => item.price);
      
      // Determine if chart shows upward or downward trend
      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const isPositive = endPrice >= startPrice;
      
      // Create gradient for chart area
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(46, 204, 113, 0.3)');
        gradient.addColorStop(1, 'rgba(46, 204, 113, 0.0)');
      } else {
        gradient.addColorStop(0, 'rgba(231, 76, 60, 0.3)');
        gradient.addColorStop(1, 'rgba(231, 76, 60, 0.0)');
      }

      // Create chart with simplified time axis configuration
      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'Steem Price',
            data: prices,
            borderColor: isPositive ? '#2ecc71' : '#e74c3c',
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return `$${context.raw.toFixed(4)}`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: this.getTimeUnitForRange(range)
              },
              ticks: {
                maxRotation: 0,
                autoSkip: true
              },
              grid: {
                display: false
              }
            },
            y: {
              ticks: {
                callback: function(value) {
                  return '$' + value.toFixed(3);
                }
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)'
              }
            }
          },
          interaction: {
            mode: 'index',
            intersect: false
          }
        }
      });
    } catch (error) {
      console.error('Error creating chart:', error);
      container.innerHTML = '<div class="widget-error">Error creating chart</div>';
    }
  }
  
  /**
   * Get appropriate time unit for chart based on range
   */
  getTimeUnitForRange(range) {
    switch(range) {
      case '24h': return 'hour';
      case '7d': return 'day';
      case '1m': return 'day';
      case '3m': return 'week';
      case '1y': return 'month';
      default: return 'day';
    }
  }
  
  /**
   * Update chart range and reload data
   */
  async updateChartRange(range, chartContainer) {
    // Update UI
    const buttons = document.querySelectorAll('.range-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.range-button:nth-child(${['24h', '7d', '1m', '3m', '1y'].indexOf(range) + 1})`).classList.add('active');
    
    try {
      // Show loading state
      chartContainer.innerHTML = '<div class="widget-loading">Loading chart data...</div>';
      
      // Fetch new data based on range
      const historicalData = await this.fetchSteemHistoricalData(range);
      this.steemHistoricalData = historicalData;
      
      // Update chart
      this.initChart(chartContainer, historicalData, range);
    } catch (error) {
      console.error(`Failed to update chart for range ${range}:`, error);
      chartContainer.innerHTML = '<div class="widget-error">Failed to load chart data</div>';
    }
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
  
  /**
   * Fetch historical price data for Steem
   */
  async fetchSteemHistoricalData(range) {
    try {
      // In a real application, you would call your backend API
      // For demo purposes, we'll use CoinGecko API
      
      // Define range parameters
      const ranges = {
        '24h': { days: 1, interval: 'hourly' },
        '7d': { days: 7, interval: 'daily' },
        '1m': { days: 30, interval: 'daily' },
        '3m': { days: 90, interval: 'daily' },
        '1y': { days: 365, interval: 'daily' }
      };
      
      const rangeInfo = ranges[range] || ranges['7d'];
      
      // Call CoinGecko API
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/steem/market_chart?vs_currency=usd&days=${rangeInfo.days}&interval=${rangeInfo.interval}`
      );
      
      if (!response.ok) {
        throw new Error(`API response: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format data for our chart
      return data.prices.map(item => ({
        timestamp: new Date(item[0]),
        price: item[1]
      }));
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
      
      // For demo, return simulated data if API fails
      return this.getSimulatedHistoricalData(range);
    }
  }
  
  /**
   * Generate simulated historical data if API fails
   */
  getSimulatedHistoricalData(range) {
    const now = new Date();
    const data = [];
    
    // Base price and volatility
    const basePrice = 0.19;
    const volatility = 0.02;
    
    // Determine number of data points and interval based on range
    let points = 24; // Default for 24h
    let interval = 60 * 60 * 1000; // 1 hour in milliseconds
    
    switch(range) {
      case '7d':
        points = 7;
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '1m':
        points = 30;
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '3m':
        points = 90;
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '1y':
        points = 365;
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
    }
    
    // Generate data points
    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * interval));
      const randomFactor = 1 + (Math.random() * volatility * 2 - volatility);
      const price = basePrice * randomFactor;
      
      data.push({
        timestamp,
        price
      });
    }
    
    return data;
  }
}

export default SteemChartWidget;