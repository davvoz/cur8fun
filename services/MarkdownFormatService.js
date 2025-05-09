/**
 * MarkdownFormatService.js
 * Servizio per la formattazione del testo markdown utilizzando l'API di GitHub
 * 
 * Questo servizio interagisce con l'API di GitHub per avviare un workflow dedicato
 * per formattare i testi Markdown con l'aiuto dell'intelligenza artificiale.
 * 
 * Workflow GitHub Actions: https://github.com/davvoz/steemee/actions/workflows/format-markdown.yml
 */

class MarkdownFormatService {  constructor() {
    // Configurazione di base
    this.isFormatting = false;
    this.formatCallback = null;
    this.statusUpdateCallback = null;
    this.pollInterval = 5000; // Intervallo di polling in ms (aumentato a 5s)
    this.maxAttempts = 40; // Numero massimo di tentativi di polling (aumentato a 40)

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
  }  /**
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

      // Genera un nome file univoco basato sul timestamp corrente
      const timestamp = Date.now();
      const filename = `format_${timestamp}`;

      // Avvia il workflow con il nome file generato
      const runId = await this.dispatchWorkflow(text, style, filename);
      this.updateStatus(`Workflow GitHub Actions avviato con ID: ${runId}`, 'info');

      // Non c'è bisogno di monitorare separatamente lo stato del workflow qui
      // Il metodo downloadFormattedText si occuperà di verificare lo stato e attendere il risultato
      
      try {
        // Scarica il risultato (questo metodo ora include la verifica dello stato del workflow)
        const formattedText = await this.downloadFormattedText(runId);
        
        // Applica la formattazione
        await this.applyFormatting(formattedText);

        this.updateStatus('Formattazione completata con successo!', 'success');
        return formattedText;
      } catch (downloadError) {
        console.error('Errore durante il download del testo formattato:', downloadError);
        this.updateStatus(`Errore nel recupero del risultato: ${downloadError.message}`, 'error');
        throw new Error(`Impossibile recuperare il testo formattato: ${downloadError.message}`);
      }
    } catch (error) {
      this.updateStatus(`Errore: ${error.message}`, 'error');
      throw error;
    } finally {
      this.isFormatting = false;
    }
  }  /**
   * Avvia il workflow GitHub tramite API
   * @param {string} text - Il testo da formattare
   * @param {string} style - Lo stile di formattazione
   * @param {string} filename - Il nome file desiderato per il risultato
   * @returns {Promise<string>} - Il run ID
   */
  async dispatchWorkflow(text, style, filename) {
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
          style: style,
          filename: filename
        }
      };

      // Usa Bearer come formato di autorizzazione
      const authHeader = `Bearer ${this.githubToken}`;

      // Helper per fare richieste fetch con timeout
      const fetchWithTimeout = async (url, options, timeout = 30000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          if (error.name === 'AbortError') {
            throw new Error('Timeout della richiesta');
          }
          throw error;
        }
      };

      // Esegui la richiesta con timeout
      console.debug("Invio richiesta con payload:", JSON.stringify(payload, null, 2));
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 20000); // 20 secondi di timeout

      console.debug("Risposta API:", response.status, response.statusText);      // GitHub restituisce 204 No Content per le richieste workflow_dispatch riuscite
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

      // Dopo aver avviato il workflow, dobbiamo attendere che sia visibile nel sistema
      // Può passare un momento prima che l'API di GitHub mostri il nuovo workflow
      this.updateStatus('Dispatch eseguito, in attesa dell\'inizio del workflow...', 'info');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Attesa iniziale di 1.5 secondi

      // Recupera l'ID del run con strategia di retry più robusta
      let runId = null;
      let maxRetries = 12; // Aumentato il numero massimo di tentativi
      let retryCount = 0;
      let backoffDelay = 1000; // Parte da 1 secondo

      // Funzione per ottenere l'ultimo workflow run
      const getLatestWorkflowRun = async () => {
        // Aggiungi timestamp per evitare caching
        const timestamp = Date.now();
        const url = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFile}/runs?branch=master&per_page=5&timestamp=${timestamp}`;
        
        const runsResponse = await fetchWithTimeout(
          url,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'Cache-Control': 'no-cache, no-store'
            }
          },
          15000 // 15 secondi di timeout
        );

        if (!runsResponse.ok) {
          throw new Error(`Impossibile ottenere i workflow runs (${runsResponse.status})`);
        }

        const runsData = await runsResponse.json();
        return runsData;
      };

      while (runId === null && retryCount < maxRetries) {
        try {
          // Incrementa il contatore tentativi
          retryCount++;
          
          // Log dettagliato
          this.updateStatus(`Tentativo ${retryCount}/${maxRetries} di ottenere l'ID del run...`, 'info');
          
          const runsData = await getLatestWorkflowRun();

          if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
            console.debug(`Tentativo ${retryCount}/${maxRetries}: nessun workflow run trovato ancora, riprovo...`);
            this.updateStatus(`In attesa dell'inizio del workflow (${retryCount}/${maxRetries})...`, 'info');
          } else {
            // Cerca tra i workflow run recenti (può esserci un piccolo ritardo tra runs)
            // Cerchiamo tra i primi 5 workflow più recenti per sicurezza
            const recentRuns = runsData.workflow_runs.slice(0, 5);
            
            // Debug info
            console.debug("Workflow runs recenti:", recentRuns.map(run => ({
              id: run.id,
              status: run.status,
              created_at: run.created_at,
              updated_at: run.updated_at
            })));
            
            // Ottieni il run più recente avviato negli ultimi 2 minuti
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            const recentRun = recentRuns.find(run => new Date(run.created_at) > new Date(twoMinutesAgo));
            
            if (recentRun) {
              runId = recentRun.id.toString();
              console.debug(`ID workflow ottenuto al tentativo ${retryCount}: ${runId} (creato il ${recentRun.created_at})`);
              break;
            } else {
              console.debug(`Nessun workflow recente trovato al tentativo ${retryCount}, riprovo...`);
            }
          }
          
          // Calcola il prossimo ritardo con backoff esponenziale (max 5 secondi)
          backoffDelay = Math.min(backoffDelay * 1.5, 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } catch (error) {
          console.error(`Errore nel tentativo ${retryCount} di ottenere l'ID del run:`, error);
          
          if (retryCount >= maxRetries) {
            throw error; // Rilancia l'errore solo se abbiamo finito i tentativi
          }
          
          // Calcola il prossimo ritardo con backoff esponenziale (max 5 secondi)
          backoffDelay = Math.min(backoffDelay * 1.5, 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      if (runId === null) {
        throw new Error(`Impossibile ottenere l'ID del workflow dopo ${maxRetries} tentativi`);
      }

      this.updateStatus(`Workflow avviato con ID: ${runId}`, 'success');
      return runId;    } catch (error) {
      console.error('Errore nell\'avvio del workflow:', error);
      
      // Messaggi di errore più dettagliati e comprensibili
      let errorMessage = 'Impossibile avviare il workflow';
      
      if (error.message.includes('API GitHub')) {
        // Errori API di GitHub
        if (error.message.includes('401')) {
          errorMessage = 'Token GitHub non valido o scaduto. Riprova con un token valido.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Permessi insufficienti per accedere al repository o avviare il workflow.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Repository o workflow non trovato. Verifica le impostazioni.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Timeout durante la comunicazione con GitHub. Riprova tra qualche istante.';
        } else {
          errorMessage = `Errore di GitHub: ${error.message}`;
        }
      } else if (error.message.includes('ID del workflow')) {
        // Errori di recupero dell'ID del workflow
        errorMessage = 'Impossibile ottenere l\'ID del workflow. Potrebbe esserci un problema di accesso o il servizio GitHub potrebbe essere temporaneamente non disponibile.';
      } else if (error.message.includes('network') || error.message.includes('Network')) {
        // Errori di rete
        errorMessage = 'Errore di connessione alla rete. Verifica la tua connessione internet e riprova.';
      }
      
      throw new Error(errorMessage);
    }
  }  /**
   * Monitora lo stato del workflow GitHub Actions
   * @param {string} runId - ID del workflow da monitorare
   * @returns {Promise<Object>} - Risultato del workflow
   */
  async pollWorkflowStatus(runId) {
    this.updateStatus('Monitoraggio stato del workflow...', 'info');

    // Numero di tentativi eseguiti
    let attempts = 0;
    
    // Helper per fare richieste fetch con timeout
    const fetchWithTimeout = async (url, options, timeout = 30000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
          throw new Error('Timeout della richiesta');
        }
        throw error;
      }
    };

    // Funzione che controlla lo stato del workflow
    const checkStatus = async () => {
      attempts++;

      // Se abbiamo superato il numero massimo di tentativi, termina con errore
      if (attempts > this.maxAttempts) {
        throw new Error(`Timeout raggiunto dopo ${this.maxAttempts} tentativi di controllo dello stato`);
      }

      // Costruisci l'URL per ottenere lo stato del run con parametro timestamp per evitare caching
      const timestamp = Date.now();
      const statusUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}?timestamp=${timestamp}`;

      // Usa Bearer come formato di autorizzazione 
      const authHeader = `Bearer ${this.githubToken}`;

      try {
        // Esegui la richiesta con timeout
        const response = await fetchWithTimeout(
          statusUrl, 
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'Cache-Control': 'no-cache, no-store'
            }
          },
          15000 // 15 secondi di timeout
        );

        if (!response.ok) {
          // Se siamo ai primi tentativi, riprova
          if (attempts < this.maxAttempts / 2) {
            console.warn(`Risposta non valida al tentativo ${attempts}, riprovo...`, response.status);
            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
            return checkStatus();
          }
          throw new Error(`Impossibile ottenere lo stato del run (${response.status})`);
        }

        const data = await response.json();
        
        // Log dettagliato sullo stato corrente del workflow
        console.debug(`Stato workflow #${attempts}: ${data.status} (${data.conclusion || 'in corso'})`);

        // Controlla lo stato del workflow
        if (data.status === 'completed') {
          if (data.conclusion === 'success') {
            this.updateStatus('Workflow completato con successo', 'success');
            return { success: true, conclusion: data.conclusion };
          } else if (data.conclusion === 'skipped' || data.conclusion === 'cancelled') {
            this.updateStatus(`Workflow ${data.conclusion}. Riprova più tardi.`, 'warning');
            return { success: false, conclusion: data.conclusion };
          } else {
            // Per altri stati conclusivi (failure, timed_out, etc.) continuiamo comunque 
            // per provare a ottenere il risultato
            this.updateStatus(`Workflow completato con stato: ${data.conclusion}. Tentativo di recuperare risultato...`, 'warning');
            return { success: true, conclusion: data.conclusion, hasWarning: true };
          }
        } else if (data.status === 'queued') {
          // Il workflow è in coda, potrebbe richiedere più tempo
          this.updateStatus(`Workflow in coda su GitHub (tentativo ${attempts}/${this.maxAttempts})...`, 'info');
        } else {
          // Workflow ancora in esecuzione
          this.updateStatus(`Workflow in esecuzione: ${data.status} (tentativo ${attempts}/${this.maxAttempts})...`, 'info');
        }

        // Attendi l'intervallo di polling prima di riprovare
        // Aumenta progressivamente il tempo tra le richieste per non sovraccaricare l'API
        const waitTime = Math.min(this.pollInterval, this.pollInterval + (attempts * 200));
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Riprova
        return checkStatus();
      } catch (error) {
        console.error(`Errore nel controllo dello stato (tentativo ${attempts}):`, error);
        
        // Per errori di connessione o temporanei, riprova se non abbiamo superato il limite
        if (attempts < this.maxAttempts) {
          // Attendi un po' più a lungo prima di riprovare dopo un errore
          await new Promise(resolve => setTimeout(resolve, this.pollInterval * 1.5));
          return checkStatus();
        }
        
        throw error;
      }
    };

    // Avvia il monitoraggio
    return checkStatus();
  }async downloadFormattedText(runId) {
    try {
      // Helper per fare richieste fetch con timeout
      const fetchWithTimeout = async (url, options, timeout = 30000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          if (error.name === 'AbortError') {
            throw new Error('Timeout della richiesta');
          }
          throw error;
        }
      };

      // Prima verifichiamo che il workflow sia VERAMENTE completato e il file sia stato committato
      this.updateStatus('Verifica stato completo del workflow...', 'info');
      
      // Controlla lo stato dettagliato del workflow e attendi il completamento effettivo
      const workflowComplete = await this.waitForGitHubActionsCompletion(runId);
      
      if (!workflowComplete) {
        throw new Error('Il workflow non è stato completato correttamente dopo numerosi tentativi');
      }
      
      // Attendi che GitHub abbia effettivamente processato il commit
      this.updateStatus('Workflow completato, attendo la propagazione del file nel repository...', 'info');
      await new Promise(resolve => setTimeout(resolve, 8000)); // Attendi 8 secondi iniziali

      // Funzione per cercare il file risultato
      const findResultFile = async (attempt = 1, maxAttempts = 15) => {
        if (attempt > maxAttempts) {
          throw new Error(`File risultato non trovato dopo ${maxAttempts} tentativi`);
        }
        
        this.updateStatus(`Ricerca del file risultato (tentativo ${attempt}/${maxAttempts})...`, 'info');
        
        // Aggiungi parametro di timestamp per evitare il caching
        const timestamp = Date.now();
        const listUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results?timestamp=${timestamp}`;
        
        try {
          const listResponse = await fetchWithTimeout(
            listUrl,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache, no-store'
              }
            }
          );
          
          if (!listResponse.ok) {
            throw new Error(`Impossibile ottenere la lista dei file: ${listResponse.status}`);
          }
          
          const files = await listResponse.json();
          
          // Cerca il file che ha l'ID del run nel nome
          const resultFile = files.find(file => 
            file.name.endsWith('.md') && file.name.includes(`-${runId}.md`)
          );
          
          if (resultFile) {
            this.updateStatus(`File trovato al tentativo ${attempt}!`, 'success');
            return resultFile;
          }
          
          // File non trovato, attendiamo e riproviamo
          this.updateStatus(`File non ancora disponibile, attendo (${attempt}/${maxAttempts})...`, 'info');
          
          // Incrementa gradualmente il tempo di attesa tra i tentativi (backoff esponenziale)
          const waitTime = Math.min(3000 + (attempt * 1000), 10000); // Da 4s a max 10s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Ricorsione: prova ancora
          return findResultFile(attempt + 1, maxAttempts);
        } catch (error) {
          console.error(`Errore nel tentativo ${attempt}:`, error);
          
          if (attempt >= maxAttempts) {
            throw error;
          }
          
          // Attendi prima di riprovare
          await new Promise(resolve => setTimeout(resolve, 5000));
          return findResultFile(attempt + 1, maxAttempts);
        }
      };
      
      // Cerca il file con tentativi multipli
      const resultFile = await findResultFile();
      
      if (!resultFile) {
        throw new Error(`File risultato non trovato per il run ID: ${runId} dopo numerosi tentativi`);
      }

      // Scarica il contenuto del file
      this.updateStatus('File trovato! Scarico il risultato...', 'info');
      
      // Aggiungi parametro per evitare cache
      const noCacheUrl = `${resultFile.url}?timestamp=${Date.now()}`;
      
      const fileResponse = await fetchWithTimeout(
        noCacheUrl,
        {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache, no-store'
          }
        }
      );

      if (!fileResponse.ok) {
        throw new Error(`Errore nel download del file: ${fileResponse.status}`);
      }

      const fileData = await fileResponse.json();
      const fileContent = atob(fileData.content);

      this.updateStatus('Testo formattato scaricato con successo', 'success');
      return fileContent;
    } catch (error) {
      this.updateStatus(`Errore: ${error.message}`, 'error');
      console.error('Errore nel download del testo formattato:', error);
      throw error;
    }
  }
  /**
   * Attende che il workflow GitHub Actions sia completato e che i file siano stati committati
   * @param {string} runId - ID del workflow da monitorare
   * @returns {Promise<boolean>} - Promise che si risolve con true se il workflow è completato
   */
  async waitForGitHubActionsCompletion(runId) {
    this.updateStatus('Verifica completamento effettivo di GitHub Actions...', 'info');

    // Verifica iniziale dello stato del workflow
    const workflowStatus = await this.getWorkflowStatus(runId);
    if (!workflowStatus.success) {
      this.updateStatus('Workflow risulta fallito, ma tentativo comunque di recuperare il risultato...', 'warning');
    }

    // Ora verifichiamo se i commit associati al workflow sono stati processati
    const maxAttempts = 20;
    const initialWaitTime = 2000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.updateStatus(`Verifica dei commit del workflow (${attempt}/${maxAttempts})...`, 'info');
      
      try {
        // Ottieni i dettagli del workflow per trovare eventuali commit generati
        const response = await fetch(
          `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}?timestamp=${Date.now()}`,
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Cache-Control': 'no-cache, no-store'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Impossibile ottenere i dettagli del workflow: ${response.status}`);
        }

        const data = await response.json();
        
        // Verifica se il workflow è in uno stato di conclusione
        if (data.status === 'completed') {
          // Verifica se ci sono commit associati al workflow
          if (data.head_commit && data.head_commit.id) {
            this.updateStatus('Commit rilevato, verifico disponibilità...', 'info');
            
            // Verifica l'esistenza dei commit nel repository
            const commitCheck = await this.checkIfCommitIsAvailable(data.head_commit.id);
            
            if (commitCheck) {
              this.updateStatus('Commit verificato e disponibile nel repository!', 'success');
              return true;
            }
          } else if (attempt >= maxAttempts / 2) {
            // Se siamo oltre metà dei tentativi e il workflow è completato, proviamo a proseguire comunque
            this.updateStatus('Workflow completato, procedo al recupero del file...', 'info');
            return true;
          }
        }
        
        // Incrementa gradualmente il tempo di attesa tra i tentativi (backoff esponenziale)
        const waitTime = Math.min(initialWaitTime + (attempt * 500), 10000); // Da 2.5s a max 10s
        this.updateStatus(`Attendo ${waitTime/1000} secondi prima del prossimo controllo...`, 'info');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error) {
        console.error(`Errore nel controllo del workflow (tentativo ${attempt}):`, error);
        
        if (attempt >= maxAttempts) {
          this.updateStatus('Troppi errori nel controllo del workflow, tento comunque di recuperare il file...', 'warning');
          return true; // Proseguiamo comunque come best effort
        }
        
        // Attendi prima di riprovare
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Se arriviamo qui dopo tutti i tentativi, procediamo comunque come best effort
    this.updateStatus('Timeout nel controllo del workflow, tento comunque di recuperare il file...', 'warning');
    return true;
  }

  /**
   * Verifica se un commit è disponibile nel repository
   * @param {string} commitId - ID del commit da verificare
   * @returns {Promise<boolean>} - Promise che si risolve con true se il commit è disponibile
   */
  async checkIfCommitIsAvailable(commitId) {
    try {
      const response = await fetch(
        `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/commits/${commitId}?timestamp=${Date.now()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache, no-store'
          }
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Errore nella verifica del commit:', error);
      return false;
    }
  }
  
  /**
   * Ottiene lo stato attuale di un workflow
   * @param {string} runId - ID del workflow
   * @returns {Promise<Object>} - Stato del workflow
   */
  async getWorkflowStatus(runId) {
    try {
      const response = await fetch(
        `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}?timestamp=${Date.now()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache, no-store'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Impossibile ottenere lo stato del workflow: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'completed') {
        if (data.conclusion === 'success') {
          return { success: true, conclusion: data.conclusion };
        } else {
          // Anche se il workflow ha fallito, continuiamo a restituire successo 
          // così possiamo tentare di ottenere comunque il risultato
          return { 
            success: true, 
            conclusion: data.conclusion, 
            hasWarning: true 
          };
        }
      } else {
        return { success: false, status: data.status };
      }
    } catch (error) {
      console.error('Errore nel recupero dello stato del workflow:', error);
      return { success: false, error: error.message };
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
   * @param {string} type - Tipo di messaggio (info, error, success, warning)
   */
  updateStatus(message, type = 'info') {
    // Timestamp per log più precisi
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [MarkdownFormatter] ${message}`);
    this.showToast(message, type);
    // Se è impostata una callback per l'aggiornamento dello stato, chiamala
    if (typeof this.statusUpdateCallback === 'function') {
      this.statusUpdateCallback(message, type);
    }

    // Trova l'elemento di stato e aggiornalo, se esiste
    const statusElement = document.querySelector('.markdown-formatter-status');
    if (statusElement) {
      // Rimuovi tutte le classi di stato precedenti
      statusElement.classList.remove('info', 'error', 'success', 'warning');
      // Aggiungi la classe appropriata
      statusElement.classList.add(type);
      // Aggiorna il testo
      statusElement.textContent = message;
      
      // Aggiungi animazione per messaggi importanti
      if (type === 'error' || type === 'success') {
        statusElement.classList.add('highlight');
        setTimeout(() => {
          statusElement.classList.remove('highlight');
        }, 2000);
      }
    }
    
    // Aggiorna anche eventuali elementi di stato nella UI
    this.updateProgressUI(message, type);
  }
  
  showToast(message, type) {
    // Crea un toast
    const toast = document.createElement('div');
    toast.className ='toast';
    toast.classList.add(type);
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    
    
    
    // Aggiungi il toast al body
    document.body.appendChild(toast);


    // Rimuovi il toast dopo 3 secondi
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Aggiorna elementi di progresso nell'interfaccia utente
   * @param {string} message - Messaggio di stato
   * @param {string} type - Tipo di messaggio
   */
  updateProgressUI(message, type) {
    // Trova elementi di progresso nella UI (se esistono)
    const progressElement = document.querySelector('.markdown-format-progress');
    const progressBarElement = document.querySelector('.markdown-format-progress-bar');
    const progressTextElement = document.querySelector('.markdown-format-progress-text');
    
    if (progressElement) {
      // Mostra l'elemento di progresso
      progressElement.style.display = 'block';
      
      // Aggiorna lo stato visivo in base al tipo di messaggio
      if (type === 'success') {
        progressElement.classList.add('complete');
        if (progressBarElement) progressBarElement.style.width = '100%';
      } else if (type === 'error') {
        progressElement.classList.add('error');
      } else if (type === 'info' && message.includes('tentativo')) {
        // Estrai informazioni sul tentativo dal messaggio (es: "tentativo 3/10")
        const match = message.match(/tentativo (\d+)\/(\d+)/);
        if (match && progressBarElement) {
          const [, current, total] = match;
          const percent = Math.min(Math.floor((parseInt(current) / parseInt(total)) * 100), 95);
          progressBarElement.style.width = `${percent}%`;
        }
      }
      
      // Aggiorna il testo di progresso
      if (progressTextElement) {
        progressTextElement.textContent = message;
        progressTextElement.className = `markdown-format-progress-text ${type}`;
      }
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

  /**
   * Attende che il workflow sia completato
   * @param {string} runId - ID del workflow da monitorare
   * @returns {Promise<Object>} - Dettagli del workflow completato
   */
  async waitForWorkflowCompletion(runId) {
    this.updateStatus('Attesa del completamento del workflow...', 'info');

    let attempts = 0;
    const maxAttempts = this.maxAttempts;

    // Funzione che controlla lo stato del workflow
    const checkCompletion = async () => {
      attempts++;

      // Se abbiamo superato il numero massimo di tentativi, termina con errore
      if (attempts > maxAttempts) {
        throw new Error(`Timeout raggiunto dopo ${maxAttempts} tentativi`);
      }

      // Costruisci l'URL per ottenere lo stato del run
      const statusUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`;
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

      // Controlla se il workflow è completato
      if (data.status === 'completed') {
        this.updateStatus(`Workflow completato con stato: ${data.conclusion}`, 'info');
        return data;
      } else {
        // Workflow ancora in esecuzione, attendiamo e riproviamo
        this.updateStatus(`Workflow in esecuzione (tentativo ${attempts}/${maxAttempts})...`, 'info');
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        return checkCompletion();
      }
    };

    return checkCompletion();
  }
}

// Esporta un'istanza singleton del servizio
export default new MarkdownFormatService();