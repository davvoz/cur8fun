/**
 * MarkdownFormatService.js
 * Servizio per la formattazione del testo markdown utilizzando l'API di GitHub
 * 
 * Questo servizio interagisce con l'API di GitHub per avviare un workflow dedicato
 * per formattare i testi Markdown con l'aiuto dell'intelligenza artificiale.
 * 
 * Workflow GitHub Actions: https://github.com/davvoz/steemee/actions/workflows/format-markdown.yml
 */

class MarkdownFormatService {
  constructor() {
    // Configurazione di base
    this.isFormatting = false;
    this.formatCallback = null;
    this.statusUpdateCallback = null;
    this.pollInterval = 3000; // Intervallo di polling in ms
    this.maxAttempts = 30; // Numero massimo di tentativi di polling
    
    // Configurazione dell'API GitHub
    this.githubApiBase = 'https://api.github.com';
    this.repoOwner = 'davvoz';
    this.repoName = 'steemee';
    this.workflowFile = 'format-markdown.yml';
    
    // Token per l'API GitHub - deve essere ottenuto in modo sicuro
    // Per l'uso reale, utilizza OAuth o un approccio simile
    this.githubToken = null;
    this.loadToken();
  }

  /**
   * Carica il token dal file config.js generato durante il build
   */
  async loadToken() {
    try {
      // Controlla se il file config.js è già stato caricato
      if (typeof GITHUB_TOKEN !== 'undefined') {
        this.githubToken = GITHUB_TOKEN;
        return;
      }

      // Altrimenti carica dinamicamente il file
      const script = document.createElement('script');
      script.src = '/formatted-results/config.js';
      script.onload = () => {
        this.githubToken = GITHUB_TOKEN;
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('Errore nel caricamento del token:', error);
    }
  }

  /**
   * Imposta il token di accesso GitHub
   * @param {string} token - Token di accesso GitHub
   */
  setGithubToken(token) {
    this.githubToken = token;
  }

  /**
   * Verifica se il token GitHub è disponibile
   * @returns {boolean} - True se il token è disponibile
   */
  hasValidToken() {
    return !!this.githubToken;
  }

  /**
   * Formatta il testo markdown con l'AI tramite GitHub Actions
   * @param {string} text - Il testo Markdown da formattare
   * @param {string} style - Lo stile di formattazione (social, technical, blog)
   * @returns {Promise} - Promise che si risolve quando la formattazione è completata
   */
  async formatMarkdown(text, style = 'social') {
    if (this.isFormatting) {
      throw new Error('Una formattazione è già in corso. Attendere il completamento.');
    }

    if (!text || text.trim() === '') {
      throw new Error('Nessun testo fornito per la formattazione.');
    }

    if (!this.hasValidToken()) {
      throw new Error('Token GitHub non configurato. Utilizzare setGithubToken() per configurarlo.');
    }

    try {
      this.isFormatting = true;
      this.updateStatus('Avvio processo di formattazione...', 'info');

      // Avvia il workflow
      const runId = await this.dispatchWorkflow(text, style);
      this.updateStatus(`Workflow avviato con ID: ${runId}`, 'info');
      
      // Monitora lo stato del workflow
      const workflowResult = await this.pollWorkflowStatus(runId);
      
      if (workflowResult.success) {
        this.updateStatus('Workflow completato con successo!', 'success');
        
        // Scarica il risultato
        const formattedText = await this.downloadFormattedText(runId);
        
        // Applica la formattazione
        await this.applyFormatting(formattedText);
        
        this.updateStatus('Formattazione completata con successo!', 'success');
        return formattedText;
      } else {
        throw new Error('Il workflow non è riuscito: ' + workflowResult.conclusion);
      }
    } catch (error) {
      this.updateStatus(`Errore: ${error.message}`, 'error');
      throw error;
    } finally {
      this.isFormatting = false;
    }
  }

/**
 * Avvia il workflow GitHub tramite API
 * @param {string} text - Il testo da formattare
 * @param {string} style - Lo stile di formattazione
 * @returns {Promise<string>} - Il run ID
 */
async dispatchWorkflow(text, style) {
  try {
    this.updateStatus('Invio della richiesta al servizio di formattazione...', 'info');
    
    // Controlla se il token è disponibile e attendi il caricamento se necessario
    if (!this.githubToken) {
      await this.loadToken();
      
      // Verifica ancora una volta che il token sia caricato
      if (!this.githubToken) {
        throw new Error('Token GitHub non disponibile. Verificare il file config.js');
      }
    }
    
    // Debug del token (attenzione: mai loggare l'intero token in produzione)
    console.debug("Token disponibile:", !!this.githubToken, 
      "Prefisso:", this.githubToken?.substring(0, 4), 
      "Suffisso:", this.githubToken?.substring(this.githubToken.length - 4));
    
    // Costruisci l'URL per l'API GitHub
    const apiUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFile}/dispatches`;
    console.debug("URL API:", apiUrl);
    
    // Prepara i dati per la richiesta usando direttamente 'master' come nel test funzionante
    const payload = {
      ref: 'master',
      inputs: {
        text: text,
        style: style
      }
    };
    
    // Usa Bearer come formato di autorizzazione (come nel test funzionante)
    const authHeader = `Bearer ${this.githubToken}`;
    
    // Esegui la richiesta con dettagli di debug completi
    console.debug("Invio richiesta con payload:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.debug("Risposta API:", response.status, response.statusText);
    
    // GitHub restituisce 204 No Content per le richieste workflow_dispatch riuscite
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Testo risposta errore:", errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`Errore nell'API GitHub (${response.status}): ${errorData.message || 'Errore sconosciuto'}`);
      } catch (jsonError) {
        throw new Error(`Errore nell'API GitHub (${response.status}): ${errorText || response.statusText}`);
      }
    }
    
    // Dopo aver avviato il workflow, dobbiamo ottenere l'ID del run
    // Recuperiamo l'ultimo run del workflow per il nostro branch
    const runsResponse = await fetch(
      `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFile}/runs?branch=master&per_page=1`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    
    if (!runsResponse.ok) {
      throw new Error(`Impossibile ottenere lo stato del workflow (${runsResponse.status})`);
    }
    
    const runsData = await runsResponse.json();
    
    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      throw new Error('Nessun workflow run trovato');
    }
    
    // Ottieni l'ID del run più recente
    const runId = runsData.workflow_runs[0].id;
    
    return runId.toString();
  } catch (error) {
    console.error('Errore nell\'avvio del workflow:', error);
    throw new Error(`Impossibile avviare il workflow: ${error.message}`);
  }
}

  /**
   * Monitora lo stato del workflow GitHub Actions
   * @param {string} runId - ID del workflow da monitorare
   * @returns {Promise<Object>} - Risultato del workflow
   */
  async pollWorkflowStatus(runId) {
    this.updateStatus('Monitoraggio stato del workflow...', 'info');
    
    // Numero di tentativi eseguiti
    let attempts = 0;
    
    // Funzione che controlla lo stato del workflow
    const checkStatus = async () => {
      attempts++;
      
      // Se abbiamo superato il numero massimo di tentativi, termina con errore
      if (attempts > this.maxAttempts) {
        throw new Error(`Timeout raggiunto dopo ${this.maxAttempts} tentativi`);
      }
      
      // Costruisci l'URL per ottenere lo stato del run
      const statusUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`;
      
      // Usa Bearer come formato di autorizzazione (come nel test funzionante)
      const authHeader = `Bearer ${this.githubToken}`;
      
      // Esegui la richiesta con gli header aggiornati
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Impossibile ottenere lo stato del run (${response.status})`);
      }
      
      const data = await response.json();
      
      // Controlla lo stato del workflow
      if (data.status === 'completed') {
        if (data.conclusion === 'success') {
          this.updateStatus('Workflow completato con successo', 'success');
          return { success: true, conclusion: data.conclusion };
        } else {
          return { success: false, conclusion: data.conclusion };
        }
      } else {
        // Workflow ancora in esecuzione, attendi e riprova
        this.updateStatus(`Workflow in esecuzione (tentativo ${attempts}/${this.maxAttempts})...`, 'info');
        
        // Attendi l'intervallo di polling prima di riprovare
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
        // Riprova
        return checkStatus();
      }
    };
    
    // Avvia il monitoraggio
    return checkStatus();
  }

  /**
   * Scarica il testo formattato dal workflow GitHub Actions
   * @param {string} runId - ID del workflow
   * @returns {Promise<string>} - Testo formattato
   */
  async downloadFormattedText(runId) {
    try {
      this.updateStatus('Download del testo formattato...', 'info');
      
      // Usa Bearer come formato di autorizzazione (come nel test funzionante)
      const authHeader = `Bearer ${this.githubToken}`;
      
      // Ottieni i dettagli del run per verificare che sia completato con successo
      const runDetailsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`;
      
      const runResponse = await fetch(runDetailsUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (!runResponse.ok) {
        throw new Error(`Impossibile ottenere i dettagli del run (${runResponse.status})`);
      }
      
      const runData = await runResponse.json();
      
      // Controlla che il run sia stato completato con successo
      if (runData.status !== 'completed' || runData.conclusion !== 'success') {
        throw new Error(`Il workflow non è stato completato con successo: ${runData.conclusion}`);
      }
      
      // Ottieni gli step del job per trovare il percorso del file salvato
      const jobsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}/jobs`;
      
      const jobsResponse = await fetch(jobsUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (!jobsResponse.ok) {
        throw new Error(`Impossibile ottenere i jobs del run (${jobsResponse.status})`);
      }
      
      const jobsData = await jobsResponse.json();
      let resultPath = null;
      
      // Cerca negli output dei job il percorso del file risultato
      if (jobsData.jobs && jobsData.jobs.length > 0) {
        for (const job of jobsData.jobs) {
          if (job.outputs && job.outputs.result_path) {
            resultPath = job.outputs.result_path;
            break;
          }
        }
      }
      
      // Se non troviamo il percorso negli output, possiamo cercare di fare una richiesta
      // al repository per trovare il file più recente nella cartella formatted-results
      if (!resultPath) {
        // Otteniamo l'elenco dei file nella cartella formatted-results
        const contentsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results`;
        
        const contentsResponse = await fetch(contentsUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });
        
        if (!contentsResponse.ok) {
          throw new Error(`Impossibile ottenere i contenuti della cartella (${contentsResponse.status})`);
        }
        
        const contents = await contentsResponse.json();
        
        // Trova il file più recente (i nomi file includono timestamp)
        if (Array.isArray(contents) && contents.length > 0) {
          const files = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));
          if (files.length > 0) {
            // Ordina per nome file (che include timestamp) in ordine decrescente
            files.sort((a, b) => b.name.localeCompare(a.name));
            resultPath = `formatted-results/${files[0].name}`;
          }
        }
      }
      
      if (!resultPath) {
        throw new Error('Impossibile trovare il percorso del file risultato');
      }
      
      // Ora che abbiamo il percorso del file, lo scarichiamo direttamente utilizzando l'URL raw di GitHub
      const rawUrl = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/master/${resultPath}`;
      
      const fileResponse = await fetch(rawUrl);
      
      if (!fileResponse.ok) {
        throw new Error(`Impossibile scaricare il file risultato (${fileResponse.status})`);
      }
      
      const formattedText = await fileResponse.text();
      
      this.updateStatus('Testo formattato scaricato con successo', 'success');
      
      return formattedText;
    } catch (error) {
      console.error('Errore nel download del testo formattato:', error);
      throw new Error(`Impossibile scaricare il testo formattato: ${error.message}`);
    }
  }

  /**
   * Applica il testo formattato all'editor
   * @param {string} formattedText - Il testo formattato
   */
  async applyFormatting(formattedText) {
    try {
      // Ottieni un riferimento all'editor markdown direttamente dal DOM
      
      // Metodo 1: Prima cerca un editor Markdown inizializzato 
      const editorElement = document.querySelector('.markdown-editor');
      if (!editorElement) {
        throw new Error('Editor markdown non trovato nel DOM');
      }
      
      // Metodo 2: Cerca il contenitore dell'editor e l'editor stesso
      const container = document.getElementById('markdown-editor-container');
      if (!container) {
        throw new Error('Contenitore dell\'editor markdown non trovato');
      }
      
      // Ottieni l'elemento textarea interno
      const textarea = container.querySelector('.markdown-textarea');
      if (!textarea) {
        throw new Error('Textarea dell\'editor markdown non trovato');
      }
      
      // Aggiorna il valore della textarea
      textarea.value = formattedText;
      
      // Emula l'evento input per attivare eventuali listener interni
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
      
      // Cerca di aggiornare anche il riferimento dell'oggetto View
      const viewElement = document.querySelector('#main-content > div') || 
                          document.querySelector('.view.active');
      
      if (viewElement) {
        const createOrEditPostView = Array.from(document.querySelectorAll('.post-editor-container')).find(
          el => el.closest('#main-content')
        )?.closest('#main-content > div');
        
        if (createOrEditPostView) {
          if (typeof createOrEditPostView.__view?.postBody !== 'undefined') {
            createOrEditPostView.__view.postBody = formattedText;
            createOrEditPostView.__view.hasUnsavedChanges = true;
          }
        }
      }
      
      this.updateStatus('Formattazione applicata con successo!', 'success');
      return true;
    } catch (error) {
      console.error('Errore nell\'applicazione della formattazione:', error);
      
      // Fallback: se non riusciamo ad applicare automaticamente, mostriamo un dialog
      this.showFormattedTextDialog(formattedText);
      
      throw new Error(`Non è stato possibile applicare automaticamente la formattazione: ${error.message}`);
    }
  }

  /**
   * Mostra un dialog con il testo formattato (fallback)
   * @param {string} formattedText - Il testo formattato
   */
  showFormattedTextDialog(formattedText) {
    // Crea il dialog
    const dialog = document.createElement('div');
    dialog.className = 'formatted-text-dialog';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Testo Formattato';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.innerHTML = '<span>✕</span>';
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Body
    const body = document.createElement('div');
    body.className = 'dialog-body';
    
    const instructions = document.createElement('p');
    instructions.className = 'dialog-instructions';
    instructions.textContent = 'Non è stato possibile applicare automaticamente la formattazione. Copia il testo formattato qui sotto:';
    
    const textArea = document.createElement('textarea');
    textArea.className = 'formatted-text-area';
    textArea.value = formattedText;
    textArea.readOnly = true;
    
    body.appendChild(instructions);
    body.appendChild(textArea);
    
    // Pulsanti
    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn primary-btn';
    copyBtn.innerHTML = '<span class="material-icons">content_copy</span> Copia';
    
    buttons.appendChild(copyBtn);
    
    // Assembla il dialog
    dialogContent.appendChild(header);
    dialogContent.appendChild(body);
    dialogContent.appendChild(buttons);
    
    dialog.appendChild(dialogContent);
    
    // Aggiungi al DOM
    document.body.appendChild(dialog);
    
    // Event listeners
    closeBtn.addEventListener('click', () => dialog.remove());
    
    copyBtn.addEventListener('click', () => {
      textArea.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copiato!';
      setTimeout(() => {
        copyBtn.innerHTML = '<span class="material-icons">content_copy</span> Copia';
      }, 2000);
    });
    
    // Chiudi con click fuori
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
    
    // Chiudi con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.contains(dialog)) {
        dialog.remove();
      }
    });
  }

  /**
   * Aggiorna lo stato corrente dell'operazione
   * @param {string} message - Messaggio di stato
   * @param {string} type - Tipo di messaggio (info, error, success)
   */
  updateStatus(message, type = 'info') {
    console.log(`[MarkdownFormatter] ${message}`);
    
    // Se è impostata una callback per l'aggiornamento dello stato, chiamala
    if (typeof this.statusUpdateCallback === 'function') {
      this.statusUpdateCallback(message, type);
    }
    
    // Trova l'elemento di stato e aggiornalo, se esiste
    const statusElement = document.querySelector('.markdown-formatter-status');
    if (statusElement) {
      // Rimuovi tutte le classi di stato precedenti
      statusElement.classList.remove('info', 'error', 'success');
      // Aggiungi la classe appropriata
      statusElement.classList.add(type);
      // Aggiorna il testo
      statusElement.textContent = message;
    }
  }

  /**
   * Registra una callback per gli aggiornamenti di stato
   * @param {Function} callback - Funzione di callback per gli aggiornamenti di stato
   */
  onStatusUpdate(callback) {
    if (typeof callback === 'function') {
      this.statusUpdateCallback = callback;
    }
  }
}

// Esporta un'istanza singleton del servizio
export default new MarkdownFormatService();