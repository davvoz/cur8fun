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
        // Nota: ora accettiamo anche risultati con avviso
        if (workflowResult.hasWarning) {
          this.updateStatus('Workflow completato con avvisi, tentativamente proseguiamo...', 'warning');
        } else {
          this.updateStatus('Workflow completato con successo!', 'success');
        }

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

      // Attendiamo un breve periodo iniziale molto breve (500ms) prima di iniziare i tentativi
      this.updateStatus('Dispatch eseguito, in attesa dell\'inizio del workflow...', 'info');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Dopo aver avviato il workflow, dobbiamo ottenere l'ID del run
      // Recuperiamo l'ultimo run del workflow per il nostro branch con un approccio più resiliente
      let runId = null;
      let maxRetries = 10; // Aumentiamo il numero massimo di tentativi
      let retryCount = 0;
      let backoffDelay = 500; // Iniziamo con 500ms e incrementiamo a ogni tentativo (backoff esponenziale)

      while (runId === null && retryCount < maxRetries) {
        try {
          // Incrementa il contatore tentativi
          retryCount++;

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
            console.debug(`Tentativo ${retryCount}/${maxRetries}: nessun workflow run trovato ancora, riprovo...`);
            // Calcola il prossimo ritardo con backoff esponenziale (max 3 secondi)
            backoffDelay = Math.min(backoffDelay * 1.5, 3000);
            this.updateStatus(`In attesa dell'inizio del workflow (${retryCount}/${maxRetries})...`, 'info');
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }

          // Ottieni l'ID del run più recente
          runId = runsData.workflow_runs[0].id.toString();
          console.debug(`ID workflow ottenuto al tentativo ${retryCount}: ${runId}`);
        } catch (error) {
          console.error(`Errore nel tentativo ${retryCount} di ottenere l'ID del run:`, error);
          if (retryCount >= maxRetries) {
            throw error; // Rilancia l'errore solo se abbiamo finito i tentativi
          }
          // Calcola il prossimo ritardo con backoff esponenziale (max 3 secondi)
          backoffDelay = Math.min(backoffDelay * 1.5, 3000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      if (runId === null) {
        throw new Error(`Impossibile ottenere l'ID del workflow dopo ${maxRetries} tentativi`);
      }

      this.updateStatus(`Workflow avviato con ID: ${runId}`, 'success');
      return runId;
    } catch (error) {
      console.error('Errore nell\'avvio del workflow:', error);
      throw new Error(`Impossibile avviare il workflow: ${error.message}`);
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
          // Anche se il workflow ha fallito, continuiamo a restituire successo 
          // così possiamo tentare di ottenere comunque il risultato
          this.updateStatus(`Workflow completato con stato: ${data.conclusion}. Tentativo di recuperare risultato...`, 'warning');
          return { success: true, conclusion: data.conclusion, hasWarning: true };
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

      // Intestazioni standard compatibili con CORS
      const standardHeaders = {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };

      // Ottieni i dettagli del run per verificare che sia completato con successo
      const runDetailsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`;

      const runResponse = await fetch(runDetailsUrl, {
        headers: standardHeaders
      });

      if (!runResponse.ok) {
        throw new Error(`Impossibile ottenere i dettagli del run (${runResponse.status})`);
      }

      const runData = await runResponse.json();

      // Timestamp di inizio del workflow - useremo questo per trovare file creati dopo l'avvio
      const workflowStartTime = new Date(runData.created_at);
      console.debug('Workflow avviato il:', workflowStartTime.toISOString());      // Controlla lo stato del run, ma continua anche se non ha avuto "success"
      // Questo ci permette di recuperare il file anche se il workflow ha dato errori non critici
      if (runData.status !== 'completed') {
        this.updateStatus('Il workflow non è ancora completato, attendo...', 'info');
        
        // Attendiamo che il workflow sia completato prima di cercare il file
        await this.waitForWorkflowCompletion(runId);
        
        // Ricarica i dati del run dopo l'attesa
        const updatedRunResponse = await fetch(runDetailsUrl, {
          headers: standardHeaders
        });
        
        if (!updatedRunResponse.ok) {
          throw new Error(`Impossibile ottenere i dettagli aggiornati del run (${updatedRunResponse.status})`);
        }
        
        const updatedRunData = await updatedRunResponse.json();
        
        // Aggiorna il timestamp di fine del workflow
        const workflowEndTime = new Date(updatedRunData.updated_at);
        console.debug('Workflow completato il:', workflowEndTime.toISOString());
        
        // Avvisa ma non fallire se il workflow non è stato completato con successo
        if (updatedRunData.conclusion !== 'success') {
          console.warn(`Il workflow ha concluso con stato: ${updatedRunData.conclusion}, ma tentiamo comunque di recuperare il risultato`);
          this.updateStatus(`Attenzione: workflow completato con stato "${updatedRunData.conclusion}", ma tentiamo comunque di recuperare il risultato`, 'warning');
        } else {
          this.updateStatus('Workflow completato con successo', 'success');
        }
      }
      
      // Avvisa ma non fallire se il workflow non è stato completato con successo
      if (runData.conclusion !== 'success') {
        console.warn(`Il workflow ha concluso con stato: ${runData.conclusion}, ma tentiamo comunque di recuperare il risultato`);
        this.updateStatus(`Attenzione: workflow completato con stato "${runData.conclusion}", ma tentiamo comunque di recuperare il risultato`, 'warning');
      }

      // Attendiamo altri 2 secondi dopo il completamento del workflow per dare tempo al file di essere visibile      this.updateStatus('Workflow completato, attendo che il file sia disponibile...', 'info');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Implementa un polling per verificare quando il file diventa disponibile
      const maxAttempts = 20; // Riduciamo il numero massimo di tentativi per evitare loop troppo lunghi
      let attempts = 0;
      let contentFound = false;
      
      // Verifichiamo se abbiamo file locali nella cartella formatted-results
      // che possiamo usare direttamente (utile per sviluppo locale)
      try {
        // Controllo se siamo in un ambiente browser
        if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
          console.debug('Ambiente locale rilevato, potremmo usare file locali');
        }
      } catch (err) {
        console.debug('Non in ambiente browser o errore nel controllo:', err);
      }      // Helper per aggiungere un parametro anti-cache all'URL
      const addNoCacheParam = (url) => `${url}?_=${Date.now()}`;

      // Prima di tutto, controlliamo se esiste un file marker con l'ID del run
      try {
        const markerUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results/run-${runId}.txt`;
        
        this.updateStatus('Ricerca del file marker specifico per questo run...', 'info');
        console.debug('Cerco il file marker:', markerUrl);
        
        const markerResponse = await fetch(addNoCacheParam(markerUrl), {
          headers: standardHeaders
        });
        
        if (markerResponse.ok) {
          const markerData = await markerResponse.json();
          const resultFilePath = atob(markerData.content).trim();
          
          console.debug('✅ File marker trovato! Percorso del risultato:', resultFilePath);
          this.updateStatus('File marker trovato, scarico il risultato direttamente...', 'success');
          
          // Scarica direttamente il file risultato
          const fileContentUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${resultFilePath}`;
          const fileResponse = await fetch(addNoCacheParam(fileContentUrl), {
            headers: standardHeaders
          });
          
          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            const fileContent = atob(fileData.content);
            
            this.updateStatus('Testo formattato scaricato con successo tramite marker', 'success');
            return fileContent;
          } else {
            console.warn('Marker trovato ma impossibile scaricare il file:', resultFilePath);
            this.updateStatus('File marker trovato ma non è stato possibile scaricare il file - proseguo con metodo alternativo', 'warning');
            // Continua con il metodo di fallback
          }
        } else {
          console.debug('File marker non trovato, proseguo con metodo standard');
        }
      } catch (err) {
        console.debug('Errore nella ricerca del file marker:', err);
        // Continuiamo con il polling normale in caso di errore
      }

      // Prima di tutto, proviamo a vedere se abbiamo già un file valido nel repository
      try {
        const contentsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results`;
        const contentsResponse = await fetch(addNoCacheParam(contentsUrl), {
          headers: standardHeaders
        });
        
        if (contentsResponse.ok) {
          const contentsData = await contentsResponse.json();
          if (Array.isArray(contentsData) && contentsData.length > 0) {
            const markdownFiles = contentsData
              .filter(file => file.name.endsWith('.md') && !file.name.includes('README'))
              .sort((a, b) => b.name.localeCompare(a.name));
            
            if (markdownFiles.length > 0) {
              for (const file of markdownFiles) {
                if (this.isFileCreatedAfterWorkflow(file.name, workflowStartTime)) {
                  console.debug('File valido trovato immediatamente:', file.name);
                  // Ottieni direttamente il contenuto
                  const fileContentUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${file.path}`;
                  const fileResponse = await fetch(addNoCacheParam(fileContentUrl), {
                    headers: standardHeaders
                  });
                  
                  if (fileResponse.ok) {
                    const fileData = await fileResponse.json();
                    const fileContent = atob(fileData.content);
                    this.updateStatus('Testo formattato trovato immediatamente', 'success');
                    return fileContent;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.debug('Errore nel controllo iniziale dei file:', err);
        // Continuiamo con il polling normale in caso di errore
      }      while (!contentFound && attempts < maxAttempts) {
        attempts++;
        
        // Esci dal ciclo se abbiamo superato tentativi massimi o se abbiamo già trovato un contenuto
        if (contentFound) {
          console.debug('Contenuto trovato, esco dal ciclo di polling');
          break;
        }

        try {
          // Ottieni l'elenco dei file nella cartella formatted-results
          const contentsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results`;

          // Usa parametro query per evitare cache (compatibile con CORS)
          const noCacheUrl = addNoCacheParam(contentsUrl);

          const contentsResponse = await fetch(noCacheUrl, {
            headers: standardHeaders
          });

          // Se la cartella non esiste ancora, attendiamo
          if (contentsResponse.status === 404) {
            this.updateStatus(`Attendo la creazione della cartella (tentativo ${attempts}/${maxAttempts})...`, 'info');
            // Attendi meno tempo nei primi tentativi, più tempo nei successivi
            const waitTime = Math.min(1000 + (attempts * 200), 3000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          if (!contentsResponse.ok) {
            throw new Error(`Impossibile ottenere l'elenco dei file (${contentsResponse.status})`);
          }

          const contentsData = await contentsResponse.json();

          // Controlla se abbiamo una risposta valida (array di file)
          if (!Array.isArray(contentsData)) {
            this.updateStatus(`Formato risposta non valido, riprovo (${attempts}/${maxAttempts})...`, 'info');
            console.warn('Risposta non valida:', contentsData);
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }          console.debug(`Trovati ${contentsData.length} file nella cartella formatted-results`);
          contentsData.forEach(file => {
            console.debug(`- ${file.name} (${file.type})`);
          });

          // Filtra i file per assicurarci di prendere solo i file .md
          const markdownFiles = contentsData.filter(file =>
            file.name.endsWith('.md') && !file.name.includes('README')
          );

          if (!markdownFiles || markdownFiles.length === 0) {
            this.updateStatus(`Nessun file Markdown trovato, riprovo (${attempts}/${maxAttempts})...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }

          console.debug(`Trovati ${markdownFiles.length} file Markdown nella cartella formatted-results:`);
          markdownFiles.forEach(file => {
            console.debug(`- ${file.name}`);
          });
          
          // Prendi i file più recenti e verifica quali sono stati creati dopo l'inizio del workflow
          markdownFiles.sort((a, b) => b.name.localeCompare(a.name));
          
          // Cerca un file creato dopo l'inizio del workflow corrente
          let validFile = null;
          for (const file of markdownFiles) {
            if (this.isFileCreatedAfterWorkflow(file.name, workflowStartTime)) {
              validFile = file;
              console.debug(`File valido trovato: ${file.name} creato dopo l'inizio del workflow`);
              break;
            } else {
              console.debug(`File scartato: ${file.name} creato prima dell'inizio del workflow`);
            }
          }          if (!validFile) {
            // Se dopo 5 tentativi non abbiamo ancora trovato un file valido,
            // proviamo a prendere il file più recente a prescindere dalla data
            if (attempts > 5 && markdownFiles.length > 0) {
              console.debug('⚠️ FALLBACK: Nessun file valido trovato dopo 5 tentativi');
              console.debug('Provando con il fallback: utilizzo il file più recente indipendentemente dal timestamp');
              console.debug(`File selezionato per fallback: ${markdownFiles[0].name}`);
              
              this.updateStatus('Nessun file con timestamp valido, prendo il più recente...', 'warning');
              validFile = markdownFiles[0]; // Prendi semplicemente il file più recente
              console.debug('Usando file più recente come fallback:', validFile.name);
            } else {
              this.updateStatus(`Nessun file recente trovato, riprovo (${attempts}/${maxAttempts})...`, 'info');
              console.debug(`❌ Tentativo ${attempts}: nessun file valido trovato, continuo con il polling...`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
          }
          
          console.debug('File Markdown valido trovato:', validFile.name, 'URL:', validFile.download_url);

          // Ottieni il contenuto del file usando l'API GitHub
          const fileContentUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${validFile.path}`;
          const fileResponse = await fetch(addNoCacheParam(fileContentUrl), {
            headers: standardHeaders
          });

          if (!fileResponse.ok) {
            throw new Error(`Impossibile scaricare il file risultato (${fileResponse.status})`);
          }

          const fileData = await fileResponse.json();
          // Il contenuto è in base64, dobbiamo decodificarlo
          const fileContent = atob(fileData.content);          // Se contiene un messaggio di errore, mostra un avviso ma comunque lo restituiamo
          if (fileContent.includes('# Errore di formattazione') ||
            fileContent.includes('Si è verificato un errore')) {
            this.updateStatus('Il file contiene un errore di formattazione, ma lo mostro comunque', 'warning');
          } else {
            this.updateStatus('Testo formattato scaricato con successo', 'success');
          }

          // Interrompiamo immediatamente il ciclo e restituiamo il contenuto
          console.debug('=======================================================');
          console.debug(`✅ FILE VALIDO TROVATO! Interrompo il polling al tentativo ${attempts}/${maxAttempts}`);
          console.debug(`File: ${validFile.name}`);
          console.debug(`Download URL: ${validFile.download_url}`);
          console.debug('=======================================================');
          
          contentFound = true;
          return fileContent;

        } catch (error) {
          console.warn(`Errore durante il tentativo ${attempts}: ${error.message}`);
          // Se ci sono errori di rete o altri problemi, attendiamo e riproveremo
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }      // Se siamo qui e non abbiamo ancora trovato un file valido, proviamo un approccio diverso
      if (!contentFound) {
        this.updateStatus('Tentativo alternativo: scarico il primo file disponibile...', 'info');

        // Ottieni di nuovo l'elenco dei file
        const contentsUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/formatted-results`;

        const contentsResponse = await fetch(addNoCacheParam(contentsUrl), {
          headers: standardHeaders
        });

        if (!contentsResponse.ok) {
          throw new Error(`Impossibile ottenere l'elenco dei file (${contentsResponse.status})`);
        }

        const contentsData = await contentsResponse.json();

        // Prendi qualsiasi file Markdown
        const mdFiles = Array.isArray(contentsData) ?
          contentsData.filter(file => file.name.endsWith('.md')) : [];

        if (mdFiles.length > 0) {
          // Ordina per nome decrescente (più recenti prima)
          mdFiles.sort((a, b) => b.name.localeCompare(a.name));
          const firstFile = mdFiles[0];

          console.debug('Ultimo tentativo con file:', firstFile.name);

          // Scarica il contenuto tramite API per decodificare il base64
          const fileContentUrl = `${this.githubApiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${firstFile.path}`;
          const fileResponse = await fetch(addNoCacheParam(fileContentUrl), {
            headers: standardHeaders
          });

          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            const fileContent = atob(fileData.content);
            
            this.updateStatus('Testo scaricato con approccio alternativo', 'warning');
            return fileContent;
          }
        }
      }

      throw new Error(`Non è stato possibile trovare il file di formattazione valido dopo ${maxAttempts} tentativi`);
    } catch (error) {
      console.error('Errore nel download del testo formattato:', error);
      throw new Error(`Impossibile scaricare il testo formattato: ${error.message}`);
    }
  }  // Metodo helper per verificare se un file è stato creato dopo l'inizio del workflow
  isFileCreatedAfterWorkflow(filename, workflowStartTime) {
    try {
      // Estrai la data dal nome del file (assumendo formato YYYYMMDDHHmmss.md)
      const dateStr = filename.split('.')[0];
      if (dateStr.length !== 14) {
        console.debug(`Il file ${filename} non ha un formato di timestamp valido`);
        return false; // Non è nel formato atteso
      }

      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Mesi in JS sono 0-based
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(8, 10));
      const minute = parseInt(dateStr.substring(10, 12));
      const second = parseInt(dateStr.substring(12, 14));

      const fileDate = new Date(year, month, day, hour, minute, second);
      
      // Aggiungi un buffer di tempo di 2 secondi per gestire eventuali imprecisioni di timestamp
      const workflowWithBuffer = new Date(workflowStartTime.getTime() - 2000);
      
      console.debug(`######## ANALISI FILE #########`);
      console.debug(`File: ${filename}`);
      console.debug(`- Data file: ${fileDate.toISOString()}`);
      console.debug(`- Data workflow: ${workflowStartTime.toISOString()}`);
      console.debug(`- Data workflow con buffer: ${workflowWithBuffer.toISOString()}`);
      
      const isValid = fileDate > workflowWithBuffer;
      console.debug(`- RISULTATO: Il file è ${isValid ? 'VALIDO ✓' : 'NON VALIDO ✗'} (${isValid ? 'più recente' : 'più vecchio'} del workflow)`);
      console.debug(`################################`);

      // Verifichiamo che il file sia stato creato dopo l'inizio del workflow (con buffer)
      return isValid;
    } catch (err) {
      console.error(`Errore nel parsing della data del file ${filename}:`, err);
      return false; // In caso di errore nel parsing, escludiamo il file
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