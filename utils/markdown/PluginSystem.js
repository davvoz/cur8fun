import DiscordMediaPlugin from './plugins/DiscordMediaPlugin.js';

/**
 * Central plugin system for markdown content processing
 */
export default class PluginSystem {
  constructor() {
    this.plugins = [];
    this.extractedItems = new Map(); // Plugin name -> extracted items
  }
  
  /**
   * Register a new plugin
   * @param {BasePlugin} plugin - Plugin instance
   */
  registerPlugin(plugin) {
    if (!plugin || typeof plugin.name !== 'string') {
      console.error('Invalid plugin registration attempt');
      return;
    }
    
    this.plugins.push(plugin);
    // Sort by priority (highest first)
    this.plugins.sort((a, b) => b.priority - a.priority);
    
    // Initialize extracted items storage for this plugin
    this.extractedItems.set(plugin.name, []);
  }
  
  /**
   * Get a plugin by its name
   * @param {string} name - Plugin name
   * @returns {BasePlugin|null} Plugin instance or null if not found
   */
  getPluginByName(name) {
    return this.plugins.find(plugin => plugin.name === name) || null;
  }
  
  /**
   * Process content through all the registered plugins
   * @param {string} content - Original markdown content
   * @param {Object} options - Processing options
   * @returns {string} Processed content with placeholders
   */
  preProcess(content, options = {}) {
    if (!content) return '';
    
    let processedContent = content;
    
    // Clear previous extractions
    this.extractedItems.clear();
    
    // For each plugin:
    // 1. Check if it can handle this content
    // 2. Extract relevant items
    // 3. Replace with placeholders
    this.plugins.forEach(plugin => {
      if (plugin.canProcess(processedContent)) {
        const extractedItems = plugin.extract(processedContent);
        
        if (extractedItems && extractedItems.length > 0) {
          // Store extracted items
          this.extractedItems.set(plugin.name, extractedItems);
          
          // Replace with placeholders
          processedContent = plugin.createPlaceholders(
            processedContent, 
            extractedItems
          );
        }
      }
    });
    
    return processedContent;
  }
  
  /**
   * Restore placeholders with rich content
   * @param {string} content - Content with placeholders
   * @param {Object} options - Rendering options
   * @returns {string} Final content with rich elements
   */
  postProcess(content, options = {}) {
    if (!content) return '';
    
    let processedContent = content;
    
    // Process plugins in order (based on priority)
    this.plugins.forEach(plugin => {
      const items = this.extractedItems.get(plugin.name) || [];
      
      if (items.length > 0) {
        processedContent = plugin.restoreContent(
          processedContent,
          items,
          options
        );
      }
    });
    
    return processedContent;
  }

  registerPlugins() {
    // Registra prima il plugin Discord con alta priorità
    this.registerPlugin(new DiscordMediaPlugin());
    
    // Poi registra gli altri plugin
    // ...codice esistente per registrare altri plugin...
  }
}