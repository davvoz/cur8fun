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
    
    // Configurazione OAuth
    this.clientId = 'YOUR_GITHUB_CLIENT_ID'; // Da sostituire con il tuo Client ID GitHub
    this.redirectUri = `${window.location.origin}/auth-callback.html`;
    this.oauthScope = 'repo workflow';
    
    // Token GitHub (inizialmente null)
    this.githubToken = null;
    
    // Verifica se il token è già salvato
    this.loadTokenFromStorage();
  }

  /**
   * Carica il token dai dati salvati (localStorage o sessionStorage)
   */
  loadTokenFromStorage() {
    try {
      // Prova prima localStorage (persistente tra sessioni)
      const token = localStorage.getItem('github_oauth_token');
      if (token) {
        this.githubToken = token;
        this.updateStatus('Token GitHub caricato dal localStorage', 'info');
        return true;
      }
      
      // Altrimenti prova sessionStorage (solo per la sessione corrente)
      const sessionToken = sessionStorage.getItem('github_oauth_token');
      if (sessionToken) {
        this.githubToken = sessionToken;
        this.updateStatus('Token GitHub caricato dalla sessione', 'info');
        return true;
      }
      
      this.updateStatus('Nessun token GitHub salvato', 'info');
      return false;
    } catch (error) {
      console.error('Errore nel caricamento del token:', error);
      return false;
    }
  }

  /**
   * Salva il token OAuth
   * @param {string} token - Il token da salvare
   * @param {boolean} persistToken - Se true, salva in localStorage, altrimenti in sessionStorage
   */
  saveToken(token, persistToken = false) {
    if (!token) return false;
    
    try {
      this.githubToken = token;
      
      if (persistToken) {
        // Salva in localStorage (persiste tra sessioni)
        localStorage.setItem('github_oauth_token', token);
        this.updateStatus('Token salvato in modo persistente', 'success');
      } else {
        // Salva in sessionStorage (solo per la sessione corrente)
        sessionStorage.setItem('github_oauth_token', token);
        this.updateStatus('Token salvato per questa sessione', 'success');
      }
      
      return true;
    } catch (error) {
      console.error('Errore nel salvataggio del token:', error);
      return false;
    }
  }

  /**
   * Cancella il token salvato
   */
  clearToken() {
    this.githubToken = null;
    try {
      localStorage.removeItem('github_oauth_token');
      sessionStorage.removeItem('github_oauth_token');
      this.updateStatus('Token GitHub rimosso', 'info');
      return true;
    } catch (error) {
      console.error('Errore nella rimozione del token:', error);
      return false;
    }
  }

  /**
   * Verifica se l'utente è autenticato con GitHub
   * @returns {boolean} - true se l'utente è autenticato
   */
  isAuthenticated() {
    return !!this.githubToken;
  }

  /**
   * Avvia il processo di autenticazione OAuth con GitHub
   * @param {boolean} persistToken - Se true, salva il token in localStorage
   */
  initiateOAuth(persistToken = false) {
    // Salva la preferenza di persistenza
    sessionStorage.setItem('oauth_persist_token', persistToken.toString());
    
    // Genera e salva uno stato casuale per sicurezza
    const state = this.generateRandomState();
    
    // Costruisci l'URL di autorizzazione
    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${encodeURIComponent(this.oauthScope)}` +
      `&state=${state}`;
    
    // Reindirizza l'utente alla pagina di autorizzazione GitHub
    window.location.href = authUrl;
  }

  /**
   * Genera una stringa casuale per lo stato OAuth (protezione CSRF)
   * @returns {string} - Stringa casuale
   */
  generateRandomState() {
    const stateValue = Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('oauth_state', stateValue);
    return stateValue;
  }

  /**
   * Gestisce il callback OAuth da GitHub
   * @param {string} code - Il codice di autorizzazione ricevuto da GitHub
   * @param {string} state - Lo stato per la verifica
   * @returns {Promise<boolean>} - Promise che si risolve con true se l'autenticazione ha successo
   */
  async handleOAuthCallback(code, state) {
    // Verifica lo stato per sicurezza (protezione CSRF)
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Errore di sicurezza: stato OAuth non valido');
    }
    
    try {
      // Scambia il codice con un token di accesso usando il proxy
      // In un ambiente reale, questa richiesta dovrebbe essere gestita da un endpoint sicuro
      const response = await fetch('https://your-token-exchange-proxy.herokuapp.com/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!response.ok) {
        throw new Error(`Errore durante lo scambio del token: ${response.status}`);
      }
      
      const data = await response.json();
      const accessToken = data.access_token;
      
      if (!accessToken) {
        throw new Error('Token non ricevuto da GitHub');
      }
      
      // Recupera e salva la preferenza di persistenza
      const persistToken = sessionStorage.getItem('oauth_persist_token') === 'true';
      
      // Salva il token
      this.saveToken(accessToken, persistToken);
      
      // Pulisci i dati temporanei
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_persist_token');
      
      return true;
    } catch (error) {
      console.error('Errore nel processo OAuth:', error);
      throw error;
    }
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
    

    
    // Debug del token (attenzione: mai loggare l'intero token in produzione)
    console.debug("Token disponibile:", !!this.githubToken, 
      "Prefisso:", this.githubToken?.substring(0, 4), 
      "Suffisso:", this.githubToken?.substring(this.githubToken.length - 4));
    
    // Costruisci l'URL per l'API GitHub
    const apiUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFile}/dispatches`;
    console.debug("URL API:", apiUrl);
    
    // Prepara i dati per la richiesta
    const payload = {
      ref: 'master',
      inputs: {
        text: text,
        style: style
      }
    };
    
    // Usa Bearer come formato di autorizzazione
    const authHeader = `Bearer ${this.githubToken}`;
    
    // Esegui la richiesta
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
      
      // Usa Bearer come formato di autorizzazione 
      const authHeader = `Bearer ${this.githubToken}`;
      
      // Esegui la richiesta
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

      // Usa Bearer come formato di autorizzazione
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
   * Mostra un dialog per configurare il token GitHub
   * @returns {Promise<boolean>} - Promise che si risolve con true se il token è stato salvato
   */
  showGitHubTokenDialog() {
    return new Promise((resolve) => {
      // Crea il dialog
      const dialog = document.createElement('div');
      dialog.className = 'github-token-dialog';
      
      const dialogContent = document.createElement('div');
      dialogContent.className = 'dialog-content';
      
      // Header
      const header = document.createElement('div');
      header.className = 'dialog-header';
      
      const title = document.createElement('h3');
      title.textContent = 'Configura Token GitHub';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-button';
      closeBtn.innerHTML = '<span>✕</span>';
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      
      // Body
      const body = document.createElement('div');
      body.className = 'dialog-body';
      
      // Spiegazione
      const explanation = document.createElement('div');
      explanation.className = 'token-explanation';
      explanation.innerHTML = `
        <p>Per utilizzare la funzione di formattazione Markdown, è necessario un token GitHub con permessi <code>repo</code> e <code>workflow</code>.</p>
        <p>Per ottenere un token valido, ti invitiamo a contattarci:</p>
        <ul>
          <li>Visita <a href="https://cur8.fun" target="_blank">cur8.fun</a></li>
          <li>Contattaci su Discord</li>
          <li>Contattaci su Telegram</li>
        </ul>
        <p>Ti forniremo un token da incollare nel campo sottostante.</p>
      `;
      
      body.appendChild(explanation);
      
      // Form per il token
      const form = document.createElement('form');
      form.className = 'token-form';
      
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.htmlFor = 'github-token';
      label.textContent = 'Token GitHub:';
      
      const input = document.createElement('input');
      input.type = 'password';
      input.id = 'github-token';
      input.placeholder = 'Incolla qui il tuo token GitHub';
      input.value = this.githubToken || '';
      
      const toggleVisibility = document.createElement('button');
      toggleVisibility.type = 'button';
      toggleVisibility.className = 'toggle-visibility-btn';
      toggleVisibility.innerHTML = '<span class="material-icons">visibility</span>';
      
      formGroup.appendChild(label);
      
      const inputGroup = document.createElement('div');
      inputGroup.className = 'input-group';
      inputGroup.appendChild(input);
      inputGroup.appendChild(toggleVisibility);
      
      formGroup.appendChild(inputGroup);
      
      const persistCheck = document.createElement('div');
      persistCheck.className = 'persist-check';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'persist-token';
      checkbox.checked = true;
      
      const checkLabel = document.createElement('label');
      checkLabel.htmlFor = 'persist-token';
      checkLabel.textContent = 'Ricorda il token (salva nel browser)';
      
      persistCheck.appendChild(checkbox);
      persistCheck.appendChild(checkLabel);
      
      formGroup.appendChild(persistCheck);
      
      form.appendChild(formGroup);
      
      body.appendChild(form);
      
      // Buttons
      const buttons = document.createElement('div');
      buttons.className = 'dialog-buttons';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn secondary-btn';
      cancelBtn.textContent = 'Annulla';
      
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn primary-btn';
      saveBtn.textContent = 'Salva';
      
      buttons.appendChild(cancelBtn);
      buttons.appendChild(saveBtn);
      
      body.appendChild(buttons);
      
      // Assembla il dialog
      dialogContent.appendChild(header);
      dialogContent.appendChild(body);
      
      dialog.appendChild(dialogContent);
      
      // Aggiungi al DOM
      document.body.appendChild(dialog);
      
      // Event listeners
      closeBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(false);
      });
      
      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(false);
      });
      
      toggleVisibility.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggleVisibility.innerHTML = '<span class="material-icons">visibility_off</span>';
        } else {
          input.type = 'password';
          toggleVisibility.innerHTML = '<span class="material-icons">visibility</span>';
        }
      });
      
      saveBtn.addEventListener('click', () => saveToken());
      
      const that = this; // Salva il riferimento 'this' per usarlo nella funzione di callback
      
      function saveToken() {
        const token = input.value.trim();
        const persist = checkbox.checked;
        
        if (token) {
          dialog.remove();
          // Salva il token
          const success = that.saveToken(token, persist);
          resolve(success);
        } else {
          input.classList.add('error');
          setTimeout(() => input.classList.remove('error'), 3000);
        }
      }
      
      // Chiudi con click fuori
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.remove();
          resolve(false);
        }
      });
      
      // Chiudi con ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.contains(dialog)) {
          dialog.remove();
          resolve(false);
        }
      });
      
      // Focus sull'input
      setTimeout(() => input.focus(), 100);
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