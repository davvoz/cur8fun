/**
 * MarkdownFormatService.js
 * Servizio per la formattazione del testo markdown utilizzando GitHub Actions
 * 
 * Questo servizio interagisce con un workflow GitHub Actions dedicato
 * per formattare i testi Markdown con l'aiuto dell'intelligenza artificiale.
 */

class MarkdownFormatService {
  constructor() {
    // Configurazione di base
    this.isFormatting = false;
    this.formatCallback = null;
    this.statusUpdateCallback = null;
    this.pollInterval = 3000; // Intervallo di polling in ms
    this.maxAttempts = 30; // Numero massimo di tentativi di polling
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
      this.updateStatus('Avvio processo di formattazione...');

      // Avvia il workflow GitHub Actions
      const runId = await this.triggerWorkflow(text, style);
      this.updateStatus(`Workflow avviato con ID: ${runId}`);

      // Monitora lo stato del workflow
      const result = await this.pollWorkflowStatus(runId);
      
      // Se il workflow è completato correttamente, scarica e processa il risultato
      if (result.success) {
        this.updateStatus('Download del risultato...');
        const formattedText = await this.downloadFormattedText(runId);
        
        // Applica la formattazione al testo originale
        await this.applyFormatting(formattedText);
        
        this.updateStatus('Formattazione completata con successo!');
        return true;
      } else {
        throw new Error(`Il workflow è fallito: ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      this.updateStatus(`Errore: ${error.message}`, 'error');
      throw error;
    } finally {
      this.isFormatting = false;
    }
  }

  /**
   * Avvia il workflow GitHub Actions
   * @param {string} text - Il testo da formattare
   * @param {string} style - Lo stile di formattazione
   * @returns {Promise<string>} - ID del workflow avviato
   */
  async triggerWorkflow(text, style) {
    try {
      this.updateStatus('Invio della richiesta al servizio di formattazione...');
      
      // Crea un oggetto FormData per l'invio dei dati
      const formData = new FormData();
      formData.append('text', text);
      formData.append('style', style);
      
      // URL del servizio API che fa da proxy per GitHub Actions
      const apiUrl = 'https://api.steemee.app/markdown-formatter';
      
      // Esegui la richiesta al server
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Errore dal server: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.runId) {
        throw new Error('Nessun ID workflow restituito dal server');
      }
      
      return data.runId;
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
    let attemptCount = 0;
    
    while (attemptCount < this.maxAttempts) {
      attemptCount++;
      
      try {
        // URL del servizio API per controllare lo stato
        const statusUrl = `https://api.steemee.app/markdown-formatter/status/${runId}`;
        
        const response = await fetch(statusUrl);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Errore nel controllo dello stato: ${errorData.error || response.statusText}`);
        }
        
        const status = await response.json();
        
        // Aggiorna lo stato
        this.updateStatus(`Elaborazione in corso... (${attemptCount}/${this.maxAttempts})`);
        
        // Se il workflow è completato
        if (status.status === 'completed') {
          if (status.conclusion === 'success') {
            return { success: true };
          } else {
            return { success: false, error: `Workflow fallito con stato: ${status.conclusion}` };
          }
        }
        
        // Attendi prima del prossimo polling
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
      } catch (error) {
        console.error('Errore nel polling dello stato:', error);
        
        // Continuiamo a fare polling anche in caso di errore
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      }
    }
    
    // Se arriviamo qui, il timeout è scaduto
    return { success: false, error: 'Timeout nell\'attesa del completamento del workflow' };
  }

  /**
   * Scarica il testo formattato dal server
   * @param {string} runId - ID del workflow
   * @returns {Promise<string>} - Testo formattato
   */
  async downloadFormattedText(runId) {
    try {
      // URL per scaricare il risultato
      const downloadUrl = `https://api.steemee.app/markdown-formatter/result/${runId}`;
      
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Errore nel download del risultato: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.text) {
        throw new Error('Nessun testo formattato ricevuto dal server');
      }
      
      return data.text;
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
      // Ottieni un riferimento all'editor markdown
      const editorContainer = document.getElementById('markdown-editor-container');
      if (!editorContainer) {
        throw new Error('Editor markdown non trovato');
      }
      
      // Cerca l'istanza dell'editor all'interno dell'applicazione
      const appInstance = window.app;
      if (!appInstance) {
        throw new Error('Istanza dell\'applicazione non trovata');
      }
      
      // Recupera la vista corrente
      const currentView = appInstance.getCurrentView();
      if (!currentView || !currentView.markdownEditor) {
        throw new Error('Editor markdown non disponibile nella vista corrente');
      }
      
      // Applica il testo formattato all'editor
      currentView.markdownEditor.setValue(formattedText);
      
      // Imposta il testo anche nella proprietà di testo
      currentView.postBody = formattedText;
      
      // Segna che ci sono modifiche non salvate
      currentView.hasUnsavedChanges = true;
      
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