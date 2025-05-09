/**
 * Markdown Formatter UI Enhancement
 * 
 * Questo script aggiunge elementi UI per mostrare il progresso
 * durante la formattazione Markdown usando GitHub Actions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Verifica se siamo in una pagina con l'editor markdown
  const markdownContainer = document.querySelector('.markdown-editor-container');
  if (!markdownContainer) return;
  
  // Crea gli elementi UI per il progresso
  createProgressUI(markdownContainer);
  
  // Inizializza il formatter status per mostrare messaggi
  createFormatterStatus(markdownContainer);
});

/**
 * Crea gli elementi UI per il progresso della formattazione
 * @param {HTMLElement} container - Contenitore dell'editor markdown
 */
function createProgressUI(container) {
  // Crea il container per il progresso
  const progressContainer = document.createElement('div');
  progressContainer.className = 'markdown-format-progress';
  
  // Crea la barra di progresso
  const progressBarContainer = document.createElement('div');
  progressBarContainer.className = 'markdown-format-progress-bar-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'markdown-format-progress-bar';
  progressBarContainer.appendChild(progressBar);
  
  // Crea il testo di stato
  const progressText = document.createElement('div');
  progressText.className = 'markdown-format-progress-text';
  progressText.textContent = 'In attesa...';
  
  // Assembla il componente
  progressContainer.appendChild(progressBarContainer);
  progressContainer.appendChild(progressText);
  
  // Inserisci prima dei controlli dell'editor
  const controls = container.querySelector('.markdown-controls') || container.firstChild;
  container.insertBefore(progressContainer, controls);
  
  // Nascondi il progresso inizialmente
  progressContainer.style.display = 'none';
}

/**
 * Crea l'elemento per mostrare lo stato del formatter
 * @param {HTMLElement} container - Contenitore dell'editor markdown
 */
function createFormatterStatus(container) {
  // Controlla se esiste già
  if (container.querySelector('.markdown-formatter-status')) return;
  
  // Crea l'elemento di stato
  const statusElement = document.createElement('div');
  statusElement.className = 'markdown-formatter-status info';
  statusElement.style.display = 'none';
  
  // Inserisci prima dei controlli dell'editor
  const controls = container.querySelector('.markdown-controls') || container.firstChild;
  container.insertBefore(statusElement, controls);
}

/**
 * Intercetta le chiamate fetch alle API GitHub per risolvere problemi CORS
 * Questa funzione sostituisce l'uso di header cache-control che causa problemi CORS
 */
function setupGitHubAPIFix() {
  if (window.fetchOriginal) return; // Già configurato
  
  // Salva il metodo fetch originale
  window.fetchOriginal = window.fetch;
    // Sostituisci con la nostra versione
  window.fetch = function(url, options = {}) {
    // Verifica se è una chiamata all'API GitHub
    if (typeof url === 'string' && url.includes('api.github.com')) {
      // Verifica se l'URL ha già parametri e se contiene un problema di sintassi (due punti interrogativi)
      let urlToUse = url;
      
      // Correggi URL con più punti interrogativi (ref=master?timestamp)
      if (url.includes('?') && url.indexOf('?') !== url.lastIndexOf('?')) {
        // Sostituisci il secondo punto interrogativo con una &
        urlToUse = url.replace(/\?([^?]*)$/, '&$1');
      }
      
      // Aggiungi un timestamp all'URL invece di usare cache-control
      const separator = urlToUse.includes('?') ? '&' : '?';
      const urlWithTimestamp = `${urlToUse}${separator}t=${Date.now()}`;
      
      // Rimuovi header problematici
      if (options.headers) {
        const safeHeaders = { ...options.headers };
        
        // Rimuovi gli header che causano problemi CORS
        delete safeHeaders['cache-control'];
        delete safeHeaders['Cache-Control'];
        
        options.headers = safeHeaders;
      }
      
      // Usa il fetch originale con gli header sicuri
      return window.fetchOriginal(urlWithTimestamp, options);
    }
    
    // Per tutti gli altri URL, usa il fetch standard
    return window.fetchOriginal(url, options);
  };
  
  console.log('[MarkdownFormatter] Fix CORS per API GitHub installato');
}

// Inizializza la funzione appena caricato il documento
document.addEventListener('DOMContentLoaded', setupGitHubAPIFix);

// Esporta funzioni utili
export {
  createProgressUI,
  createFormatterStatus,
  setupGitHubAPIFix
};
