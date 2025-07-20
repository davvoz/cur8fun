import View from './View.js';
import router from '../utils/Router.js';
import registerService from '../services/RegisterService.js';
import eventEmitter from '../utils/EventEmitter.js';

class RegisterView extends View {
  constructor(params) {
    super(params);
    this.returnUrl = params.returnUrl || '/';
  }
    async render(element) {
    this.element = element;
    
    // Clear the element
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    
    // Create container
    const container = document.createElement('div');
    container.className = 'auth-container';    // Dettezione Telegram basata principalmente su telegramId
    const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
    const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
    const telegramId = telegramData?.user?.id;
    const telegramUsername = telegramData?.user?.username;
    const telegramFirstName = telegramData?.user?.first_name;
    const telegramLastName = telegramData?.user?.last_name;
    
    // La validazione principale è basata su telegramId
    const hasValidTelegramId = !!telegramId && telegramId > 0;
    const hasTelegramAuth = hasValidTelegramId && !!telegramUsername;
    
    // Indicatori secondari (meno affidabili)
    const secondaryTelegramIndicators =
      window.location.href.includes('tgWebApp=') ||
      navigator.userAgent.toLowerCase().includes('telegram') ||
      document.referrer.toLowerCase().includes('telegram');
    
    // Livello di confidenza basato su telegramId
    const telegramConfidence = hasValidTelegramId ? 'high' : 
                                isTelegramWebView ? 'medium' : 
                                secondaryTelegramIndicators ? 'low' : 'none';
                                
    const isInTelegram = hasValidTelegramId || isTelegramWebView;
    const isLocalDev = window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1') ||
      window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;

    // Se NON abbiamo un telegramId valido e NON siamo in local dev, mostra solo il banner
    if (!hasValidTelegramId && !isLocalDev) {      const telegramWarning = document.createElement('div');
      telegramWarning.className = 'telegram-auth-none';
      telegramWarning.innerHTML = `
        <p style="margin: 0 0 10px;"><strong>Registrazione disponibile solo con Telegram ID</strong></p>
        <p style="margin: 0 0 10px;">Per creare un account Steem devi accedere tramite il bot Telegram con un ID Telegram valido.</p>
        <p style="margin: 0;"><a href="https://t.me/cur8fun_bot/dapp" target="_blank" style="color: var(--primary-color); font-weight: bold;">Apri il bot su Telegram</a></p>
      `;
      container.appendChild(telegramWarning);
      element.appendChild(container);
      return element;
    }
    
    // Create form
    const form = document.createElement('form');
    form.id = 'register-form';
    form.className = 'auth-form';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'auth-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Crea un Account Steem';
    header.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.className = 'auth-subtitle';
    subtitle.textContent = 'Unisciti al social network basato su blockchain';
    header.appendChild(subtitle);
    
    form.appendChild(header);
    
    // Add spinner style for button loading state
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .button-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }
      .account-creation-status {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .progress-pulse {
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(spinnerStyle);    // Rimuovere tutte le dichiarazioni duplicate di queste variabili nel resto del file
    // e usare solo quelle dichiarate qui all'inizio del metodo render.
    
    if (hasValidTelegramId) {
      // Mostra informazioni Telegram con dati utente verificati
      const telegramInfo = document.createElement('div');
      telegramInfo.className = 'telegram-auth-high';
      telegramInfo.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Utente Telegram:</strong> @${telegramUsername}</p>
        <p style="margin: 0 0 5px;"><strong>ID Telegram:</strong> ${telegramId}</p>
        ${telegramFirstName ? `<p style="margin: 0;"><strong>Nome:</strong> ${telegramFirstName} ${telegramLastName || ''}</p>` : ''}
      `;
      form.appendChild(telegramInfo);
    } else {
      // Nessun ID Telegram valido
      const telegramWarning = document.createElement('div');
      telegramWarning.className = 'telegram-auth-none';
      telegramWarning.innerHTML = `
        <p style="margin: 0 0 10px;"><strong>Nota:</strong> La creazione dell'account richiede un ID Telegram valido.</p>
        <p style="margin: 0 0 10px;">Apri questa app da Telegram per ottenere un ID Telegram valido e creare un nuovo account Steem.</p>
        <p style="margin: 0;"><a href="https://t.me/cur8fun_bot/dapp" target="_blank" style="color: var(--primary-color); font-weight: bold;">Apri in Telegram</a></p>
      `;
      form.appendChild(telegramWarning);
    }
    
    // Create form fields - only username is required
    const usernameField = this.createFormField(
      'username', 
      'Nome Utente', 
      'person', 
      'text',
      'Scegli un nome utente Steem unico'
    );
    form.appendChild(usernameField);    // Add note about account creation
    const note = document.createElement('div');
    note.className = 'auth-note';
    note.innerHTML = `
      <p>Importante: La creazione di un account Steem richiede solitamente una piccola tassa pagata in criptovaluta STEEM.</p>
      <p>Le informazioni del tuo account e le chiavi private ti saranno fornite tramite Telegram.</p>
      <p><strong>Conserva le tue chiavi in un luogo sicuro! Non possono essere recuperate se perse.</strong></p>
      
      <div class="account-creation-process">
        <h4>Processo di Creazione dell'Account:</h4>
        <ol>
          <li>Inserisci un nome utente unico (3-16 caratteri)</li>
          <li>Autenticati con Telegram</li>
          <li>Il nostro sistema creerà il tuo account blockchain Steem</li>
          <li>Riceverai le chiavi del tuo account tramite Telegram</li>
          <li>Usa queste chiavi per accedere al tuo nuovo account</li>
        </ol>
      </div>
    `;
    
    // Add some styles to the process list
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .account-creation-process {
        background-color: #f5f9ff;
        border-left: 4px solid #4285f4;
        padding: 10px 15px;
        margin-top: 15px;
        border-radius: 0 4px 4px 0;
      }
      .account-creation-process h4 {
        margin-top: 0;
        color: #4285f4;
      }
      .account-creation-process ol {
        margin-left: -10px;
      }
    `;
    document.head.appendChild(styleEl);
    form.appendChild(note);    // Create button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'auth-button';
    submitButton.innerHTML = 'Crea Account';
    
    // Add spinner container (hidden by default)
    const spinnerContainer = document.createElement('span');
    spinnerContainer.className = 'button-spinner';
    spinnerContainer.style.display = 'none';
    submitButton.prepend(spinnerContainer);
    
    // Add button click feedback
    submitButton.addEventListener('click', () => {
      if (!submitButton.disabled) {
        // Show immediate feedback that the button was clicked
        spinnerContainer.style.display = 'inline-block';
        submitButton.classList.add('button-clicked');
        
        // Reset after a short delay if the form is invalid
        setTimeout(() => {
          if (!document.querySelector('.account-creation-status')) {
            spinnerContainer.style.display = 'none';
          }
        }, 2000);
      }
    });      // Applica lo stato appropriato del pulsante basato sul telegramId
    if (!hasValidTelegramId && !isLocalDev) {
      // Nessun ID Telegram valido
      submitButton.disabled = true;
      submitButton.textContent = 'ID Telegram Richiesto';
      submitButton.classList.add('auth-button-none');
    } else if (telegramConfidence === 'medium') {
      // In Telegram ma senza ID valido
      submitButton.dataset.telegramPending = 'true';
      submitButton.textContent = 'ID Telegram Necessario';
      submitButton.classList.add('auth-button-medium');
      
      // Aggiungi gestore click per mostrare dialogo di autenticazione
      submitButton.addEventListener('click', (e) => {
        if (submitButton.dataset.telegramPending === 'true') {
          e.preventDefault();
          alert('Assicurati di avere un ID Telegram valido. Prova a riaprire l\'app da Telegram.');
          
          // Prova a ricontrollare l'auth Telegram
          if (window.Telegram && window.Telegram.WebApp) {
            try {
              window.Telegram.WebApp.expand();
              window.Telegram.WebApp.requestContact();
              // Forza il reload dopo un ritardo
              setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
              console.error('Failed to request Telegram auth:', err);
            }
          }
        }
      });
    } else if (telegramConfidence === 'low') {
      // Possibilmente Telegram ma incerto
      submitButton.textContent = 'Crea Account (Verifica ID Necessaria)';
      submitButton.classList.add('auth-button-low');
    } else if (isLocalDev) {
      // In modalità sviluppo - permetti con indicazione visiva
      submitButton.classList.add('auth-button-dev');
      submitButton.textContent = 'Crea Account (Modalità Sviluppo)';
    } else if (hasValidTelegramId) {
      // ID Telegram completamente validato
      submitButton.classList.add('auth-button-high');
      submitButton.textContent = 'Crea Account';
    }
    
    form.appendChild(submitButton);
      // Add login link
    const loginLink = document.createElement('div');
    loginLink.className = 'auth-link';
    loginLink.innerHTML = 'Hai già un account? <a href="/login">Accedi qui</a>';
    form.appendChild(loginLink);
    
    // Add form to container
    container.appendChild(form);
    
    // Add container to element
    element.appendChild(container);
    
    // Add event listener for form submission
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
    return element;
  }
  
  createFormField(id, label, icon, type, placeholder) {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-field';
    
    const fieldLabel = document.createElement('label');
    fieldLabel.htmlFor = id;
    fieldLabel.textContent = label;
    fieldContainer.appendChild(fieldLabel);
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-with-icon';
    
    const iconElement = document.createElement('span');
    iconElement.className = 'material-icons';
    iconElement.textContent = icon;
    inputWrapper.appendChild(iconElement);
    
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.placeholder = placeholder;
    input.required = true;
      // Add lowercase restriction to username field
    if (id === 'username') {
      input.pattern = '[a-z0-9.-]+';
      input.title = 'Only lowercase letters, numbers, dots and dashes allowed';
      
      // Status indicator for username availability
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'username-status';
      statusIndicator.style.marginLeft = '8px';
      statusIndicator.style.fontSize = '14px';
      inputWrapper.appendChild(statusIndicator);
      
      // Debounce function to limit API calls
      let debounceTimer;
      
      input.addEventListener('input', async (e) => {
        e.target.value = e.target.value.toLowerCase();
        
        const username = e.target.value.trim();
        statusIndicator.textContent = '';
        
        // Clear any existing validation messages
        const existingValidation = fieldContainer.querySelector('.username-validation');
        if (existingValidation) {
          existingValidation.remove();
        }
        
        if (username.length < 3 || username.length > 16) {
          return;
        }
        
        clearTimeout(debounceTimer);
        
        // Set loading state
        statusIndicator.textContent = '⟳';
        statusIndicator.style.color = '#666';
        
        debounceTimer = setTimeout(async () => {
          try {
            // Import and use the RegisterService to check availability
            const registerService = (await import('../services/RegisterService.js')).default;
            const exists = await registerService.checkAccountExists(username);
            
            // Update status indicator
            if (exists) {
              statusIndicator.textContent = '✗'; 
              statusIndicator.style.color = '#ff0000';
              
              // Add validation message
              const validationMsg = document.createElement('div');
              validationMsg.className = 'username-validation';
              validationMsg.textContent = 'Questo nome utente è già stato preso';
              validationMsg.style.color = '#ff0000';
              validationMsg.style.fontSize = '12px';
              validationMsg.style.marginTop = '4px';
              fieldContainer.appendChild(validationMsg);
            } else {
              statusIndicator.textContent = '✓';
              statusIndicator.style.color = '#00aa00';
            }
          } catch (error) {
            console.error('Error checking username:', error);
            statusIndicator.textContent = '?';
            statusIndicator.style.color = '#ff6b00';
          }
        }, 500);
      });
    }    // Add validation hints
    if (id === 'username') {
      const hintElement = document.createElement('div');
      hintElement.className = 'field-hint';
      hintElement.textContent = 'Il nome utente deve essere lungo 3-16 caratteri, utilizzando solo lettere minuscole, numeri, punti e trattini.';
      hintElement.style.color = '#666';
      hintElement.style.fontSize = '12px';
      hintElement.style.marginTop = '4px';
      fieldContainer.appendChild(hintElement);
    }
    
    inputWrapper.appendChild(input);
    
    fieldContainer.appendChild(inputWrapper);
    
    return fieldContainer;
  }
  async handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const username = form.username.value;
    
    // Reset previous error messages
    const errorElement = form.querySelector('.auth-error');
    if (errorElement) {
      errorElement.remove();
    }
    
    // Remove any existing status indicator
    const existingStatus = form.querySelector('.account-creation-status');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // Network connectivity monitoring
    let isOffline = !navigator.onLine;
    const updateNetworkStatus = () => {
      if (!navigator.onLine && !isOffline) {
        isOffline = true;
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
          statusMessage.textContent = 'Connessione di rete persa! Attesa di riconnessione...';
        }
        statusIndicator.style.backgroundColor = '#fff3e0';
        statusIndicator.style.borderColor = '#ffcc80';
      } else if (navigator.onLine && isOffline) {
        isOffline = false;
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
          statusMessage.textContent = 'Connessione di rete ripristinata! Continuando...';
        }
        setTimeout(() => {
          if (statusIndicator.style.backgroundColor === 'rgb(255, 243, 224)') { // #fff3e0
            statusIndicator.style.backgroundColor = '#e8f4fd';
            statusIndicator.style.borderColor = '#90caf9';
          }
        }, 1000);
      }
    };
    
    // Add network listeners
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Create and show a status indicator with improved visibility
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'account-creation-status';
    statusIndicator.style.padding = '15px';
    statusIndicator.style.marginTop = '15px';
    statusIndicator.style.marginBottom = '15px';
    statusIndicator.style.backgroundColor = '#e8f4fd';
    statusIndicator.style.borderRadius = '5px';
    statusIndicator.style.fontSize = '14px';
    statusIndicator.style.border = '1px solid #90caf9';
    statusIndicator.style.position = 'sticky'; // Make it sticky for better visibility
    statusIndicator.style.bottom = '20px';
    statusIndicator.style.zIndex = '100';
    statusIndicator.innerHTML = `
      <p style="margin: 0 0 5px;"><strong>Preparazione creazione account...</strong></p>
      <p style="margin: 0;" id="status-message">Inizializzando...</p>
      <div id="creation-progress" style="margin-top: 10px; height: 6px; background-color: #e0e0e0; border-radius: 2px; overflow: hidden;">
        <div style="width: 10%; height: 100%; background-color: #2196f3; transition: width 0.5s ease;"></div>
      </div>
      <p style="margin: 5px 0 0; font-size: 12px; color: #666;" id="status-time">Inizio...</p>
    `;
    form.appendChild(statusIndicator);
    
    // Variables for tracking request timing
    let startTime = Date.now();
    let timeoutTimers = [];
    
    // Functions to update status and progress
    const updateStatus = (message, progressPercent) => {
      const statusMessage = document.getElementById('status-message');
      const timeElement = document.getElementById('status-time');
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      
      if (statusMessage) {
        statusMessage.textContent = message;
        console.log('Status update:', message);
      }
      
      if (timeElement) {
        timeElement.textContent = `Tempo trascorso: ${elapsedSec} secondi`;
      }
      
      const progressBar = document.querySelector('#creation-progress > div');
      if (progressBar && progressPercent !== undefined) {
        progressBar.style.width = `${progressPercent}%`;
      }
    };
    
    // Function to handle potential timeouts
    const startTimeoutDetection = (stage, timeoutMs = 15000) => {
      const timerId = setTimeout(() => {
        updateStatus(`${stage} richiede più tempo del previsto, sto ancora provando...`, null);
        statusIndicator.style.backgroundColor = '#fff3e0';
        statusIndicator.style.borderColor = '#ffcc80';
      }, timeoutMs);
      
      timeoutTimers.push(timerId);
      return timerId;
    };
    
    // Clear all timeout timers
    const clearAllTimeouts = () => {
      timeoutTimers.forEach(id => clearTimeout(id));
      timeoutTimers = [];
    };
      try {
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creazione Account...';
      submitButton.style.position = 'relative';
      submitButton.style.color = 'rgba(255, 255, 255, 0.7)';
      submitButton.innerHTML = `
        <span style="position: absolute; display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s linear infinite; left: calc(50% - 40px);"></span>
        Creazione Account...
      `;
      
      // Reset any previous errors
      const existingErrors = form.querySelectorAll('.auth-error');
      existingErrors.forEach(error => error.remove());
      
      // Add the spinner animation style
      if (!document.getElementById('spinner-style')) {
        const spinnerStyle = document.createElement('style');
        spinnerStyle.id = 'spinner-style';
        spinnerStyle.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(spinnerStyle);
      }
        // Step 1: Dettezione Telegram migliorata basata su telegramId (10%)
      updateStatus('Controllo ID Telegram...', 10);
      await new Promise(resolve => setTimeout(resolve, 500)); // Piccolo ritardo per feedback UI
      
      // Dettezione Telegram migliorata con validazione più rigorosa basata su telegramId
      const isTelegramWebView = !!window.Telegram && !!window.Telegram.WebApp;
      const telegramData = window.Telegram?.WebApp?.initDataUnsafe;
      const telegramId = telegramData?.user?.id;
      const telegramUsername = telegramData?.user?.username;
      
      // Controllo per integrazione app Telegram reale - DEVE avere dati utente effettivi con ID valido
      const hasValidTelegramId = !!telegramId && telegramId > 0;
      const hasTelegramAuth = hasValidTelegramId && !!telegramUsername;
      
      // Altri indicatori (meno affidabili)
      const secondaryTelegramIndicators = 
          window.location.href.includes('tgWebApp=') || 
          navigator.userAgent.toLowerCase().includes('telegram') ||
          document.referrer.toLowerCase().includes('telegram');
      
      // Dettezione combinata con gerarchia appropriata - validazione PIÙ RIGOROSA basata su ID
      const telegramConfidence = hasValidTelegramId ? 'high' : 
                                isTelegramWebView ? 'medium' : 
                                secondaryTelegramIndicators ? 'low' : 'none';
                                
      // Considera veramente IN Telegram solo se abbiamo ID utente valido o integrazione WebApp
      const isInTelegram = hasValidTelegramId || isTelegramWebView;
      const hasFullTelegramAuth = hasValidTelegramId;
      
      const isLocalDev = window.location.hostname.includes('localhost') || 
                        window.location.hostname.includes('127.0.0.1') ||
                        window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;
      
      // Log risultati dettezione
      console.log('Risultati dettezione Telegram migliorata in handleSubmit:', {
        isTelegramWebView,
        telegramConfidence,
        isInTelegram,
        hasFullTelegramAuth,
        telegramId: telegramId || 'undefined',
        telegramUsername: telegramUsername || 'undefined',
        hasValidTelegramId,
        hasTelegramAuth,
        userAgent: navigator.userAgent,
        hostname: window.location.hostname,
        isLocalDev,
        secondaryTelegramIndicators
      });
      
      // Solo validazione rigorosa per ambiente di produzione
      if (!isLocalDev) {
        // In produzione, richiediamo ALTA confidenza (ID Telegram autenticato con dati utente)
        if (!hasValidTelegramId) {
          throw new Error('È richiesto un ID Telegram valido. Apri questa app direttamente da Telegram e assicurati di essere connesso con un account Telegram che ha un ID valido.');
        }
      } else if (!isInTelegram && !isLocalDev) {
        // Controllo di fallback (non dovrebbe essere necessario con la nuova logica)
        throw new Error('È richiesto un ID Telegram valido per creare un account.');
      }
      
      // Step 2: Checking API connectivity (30%)
      updateStatus('Connessione al servizio API...', 30);
      let timeoutId = startTimeoutDetection('Controllo connessione API');
      
      try {
        const apiCheck = await registerService.testApiConnection();
        clearTimeout(timeoutId);
        console.log('API connectivity check:', apiCheck);
        
        if (!apiCheck.success) {
          throw new Error(`Connessione API fallita: ${apiCheck.message}`);
        }
        updateStatus('Connessione API riuscita', 35);
      } catch (apiError) {
        clearTimeout(timeoutId);
        console.error('API connectivity error:', apiError);
        throw new Error(`Impossibile connettersi all'API: ${apiError.message || 'Errore sconosciuto'}`);
      }
      
      // Step 3: Verifying account creation service (50%)
      updateStatus('Verifica del servizio di creazione account...', 50);
      timeoutId = startTimeoutDetection('Verifica servizio');
      
      try {
        const serviceCheck = await registerService.checkAccountCreationService();
        clearTimeout(timeoutId);
        console.log('Service check:', serviceCheck);
        
        if (!serviceCheck.success) {
          throw new Error(`Servizio di creazione account non disponibile: ${serviceCheck.message}`);
        }
        updateStatus('Servizio di creazione account disponibile', 60);
      } catch (serviceError) {
        clearTimeout(timeoutId);
        console.error('Service check error:', serviceError);
        throw new Error(`Servizio di creazione account non disponibile: ${serviceError.message || 'Errore sconosciuto'}`);
      }
        // Step 4: Sending account creation request (70%)
      updateStatus('Invio richiesta di creazione account...', 70);
      timeoutId = startTimeoutDetection('Creazione account', 30000); // Longer timeout for account creation
      
      let result;      try {
        // Chiama il servizio di registrazione con username e telegramId
        result = await registerService.createAccount({
          username,
          telegramId: telegramId || null  // Passa il telegramId se disponibile
        });
        clearTimeout(timeoutId);
        console.log('Account creation result:', result);
        
        // Check if the response contains "created successfully" message regardless of success flag
        if (result && typeof result === 'object') {
          const messageText = result.message || '';
          
          // Look for success message pattern in the response
          if (messageText.includes('created successfully') || 
              messageText.includes('account created') ||
              messageText.toLowerCase().includes('success')) {
            console.log('Success message detected in response:', messageText);
            
            // Override success flag if needed
            if (!result.success) {
              console.log('Success message found but success flag was false - overriding to true');
              result.success = true;
            }
          }
        }
        
        // Make sure the result has a success flag
        if (!result || typeof result.success === 'undefined') {
          console.error('Invalid response format:', result);
          throw new Error('Invalid response from account creation service');
        }
        
        // Handle failure case from API
        if (!result.success) {
          throw new Error(result.message || 'Failed to create account');
        }
        
      } catch (creationError) {
        clearTimeout(timeoutId);
        console.error('Account creation error:', creationError);
        
        // Check if the error message actually indicates success
        if (creationError.message && creationError.message.includes('created successfully')) {
          console.log('Success message found in error response - treating as success');
          // We'll continue execution and not throw here
          result = {
            success: true,
            message: creationError.message,
            // Extract username from message if possible
            createdUsername: (creationError.message.match(/Account (\w+) created successfully/) || [])[1] || username
          };
        } else {
          // This is a genuine error
          throw new Error(`Failed to create account: ${creationError.message || 'Unknown error'}`);
        }
      }
        // Step 5: Finalizing (100%)
      updateStatus('Account creato con successo!', 100);
      
      // Get the created username from result if available
      const createdUsername = result.createdUsername || username;
      
      // Extract keys from result if available
      const accountKeys = result.keys || null;
      console.log('Account keys from API:', accountKeys);
      
      // Update status indicator with success message
      statusIndicator.style.backgroundColor = '#e8f5e9';
      statusIndicator.style.borderColor = '#a5d6a7';
      statusIndicator.innerHTML = `
        <p style="margin: 0 0 5px;"><strong>Account Creato con Successo!</strong></p>
        <p style="margin: 0;">Nome Utente: <strong>${createdUsername}</strong></p>
        <p style="margin: 5px 0 0;">Il tuo account è stato creato sulla blockchain.</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: #4caf50;">Tempo totale: ${Math.floor((Date.now() - startTime) / 1000)} secondi</p>
      `;
    
      // Success! Show notification with appropriate message
      let successMessage = 'Account creato con successo!';
      
      if (result && result.telegramId) {
        successMessage += ' Controlla il tuo Telegram per i dettagli dell\'account.';
      } else if (isInTelegram) {
        successMessage += ' I dettagli dell\'account saranno inviati tramite Telegram.';
      } else if (isLocalDev) {
        successMessage += ' (Modalità Sviluppo)';
      }
      
      // Emit notification event
      eventEmitter.emit('notification', {
        type: 'success',
        message: successMessage
      });
      
      // Remove network listeners
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
        // Mostra messaggio di successo nel form dopo un piccolo ritardo
      setTimeout(() => {
        this.showSuccessMessage(form, createdUsername, hasValidTelegramId, accountKeys);
      }, 1500);
      
    } catch (error) {
      console.error('Registrazione fallita:', error);
      clearAllTimeouts();
      
      // Remove network listeners
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      // Update status indicator with error
      statusIndicator.style.backgroundColor = '#ffebee';
      statusIndicator.style.borderColor = '#ef9a9a';      // Controllo per vari indicatori di successo nei messaggi di errore
      const successIndicators = [
        'created successfully', 
        'account created', 
        'success'
      ];
      
      const hasSuccessIndicator = successIndicators.some(indicator => 
        error.message.toLowerCase().includes(indicator));
      
      if (hasSuccessIndicator) {
        console.log('Rilevata creazione account riuscita nel messaggio di errore:', error.message);
        
        // Estrai lo username dal messaggio di errore usando pattern diversi
        let createdUsername = username;
        
        // Prova pattern regex diversi per estrarre lo username
        const patterns = [
          /Account (\w+) created successfully/i,
          /(\w+) account created/i,
          /account (\w+) has been created/i,
          /created account (\w+)/i
        ];
        
        for (const pattern of patterns) {
          const match = error.message.match(pattern);
          if (match && match[1]) {
            createdUsername = match[1];
            break;
          }
        }
        
        console.log(`Username estratto dal messaggio di successo: ${createdUsername}`);
        
        // Questo è in realtà un caso di successo - gestiscilo come tale
        clearAllTimeouts();
        
        // Aggiorna indicatore di stato con messaggio di successo
        statusIndicator.style.backgroundColor = '#e8f5e9';
        statusIndicator.style.borderColor = '#a5d6a7';
        statusIndicator.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <span class="material-icons" style="color: #4caf50; font-size: 24px; margin-right: 10px;">check_circle</span>
            <strong>Account Creato con Successo!</strong>
          </div>
          <p style="margin: 0;">Nome Utente: <strong>${createdUsername}</strong></p>
          ${hasValidTelegramId ? `<p style="margin: 5px 0 0;">ID Telegram: <strong>${telegramId}</strong></p>` : ''}
          <p style="margin: 5px 0 0;">Il tuo account è stato creato sulla blockchain.</p>
          <p style="margin: 5px 0 0; font-size: 12px; color: #4caf50;">Tempo totale: ${Math.floor((Date.now() - startTime) / 1000)} secondi</p>
        `;
        
        // Resetta stato pulsante per mostrare successo
        submitButton.disabled = false;
        submitButton.innerHTML = 'Account Creato!';
        submitButton.style.backgroundColor = 'var(--success-color)';
        submitButton.style.color = 'white';
        
        // Emetti notifica di successo invece di errore
        const successMessage = `Account ${createdUsername} creato con successo!${hasValidTelegramId ? ` (ID Telegram: ${telegramId})` : ''}`;
        eventEmitter.emit('notification', {
          type: 'success',
          message: successMessage
        });
        
        // Estrai chiavi se presenti nell'oggetto errore
        let accountKeys = null;
        if (error.keys) {
          accountKeys = error.keys;
          console.log('Chiavi account dall\'oggetto errore:', accountKeys);
        }
        
        // Mostra messaggio di successo nel form
        setTimeout(() => {
          this.showSuccessMessage(form, createdUsername, hasValidTelegramId, accountKeys);
        }, 1500);
        
        return; // Esci dalla gestione errori dato che questo è in realtà un caso di successo
      }
      
      // Normal error handling for actual errors      // Controllo per tipi di errore specifici per fornire migliore orientamento
      let specificHelp = '';
      if (error.message.includes('Network') || error.message.includes('connect')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Problema di Connessione Rilevato</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Controlla la tua connessione a internet</li>
            <li>Assicurati di avere una connessione stabile</li>
            <li>Prova a chiudere e riaprire l'app Telegram</li>
          </ul>
        `;
      } else if (error.message.includes('timed out') || error.message.includes('timeout')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Richiesta Scaduta</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Il server impiega troppo tempo a rispondere</li>
            <li>Potrebbe essere sotto traffico elevato</li>
            <li>Riprovare tra qualche minuto</li>
          </ul>
        `;
      } else if (error.message.includes('already exists') || error.message.includes('taken')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Nome Utente Non Disponibile</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Prova un nome utente diverso</li>
            <li>Aggiungi numeri o caratteri per renderlo unico</li>
          </ul>
        `;
      } else if (error.message.includes('Telegram') || error.message.includes('ID')) {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Problema ID Telegram</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Assicurati di avere un ID Telegram valido</li>
            <li>Apri questa app dall'app Telegram</li>
            <li>Prova a chiudere e riaprire l'app</li>
            <li>Aggiorna l'app Telegram se necessario</li>
          </ul>
        `;
      } else {
        specificHelp = `
          <p style="margin: 5px 0 0; font-size: 14px;">
            <strong>Errore Generale</strong>
          </p>
          <ul style="margin-top: 5px; padding-left: 15px; font-size: 13px;">
            <li>Riprovare tra pochi istanti</li>
            <li>Controlla la tua connessione a internet</li>
            <li>Assicurati di avere un ID Telegram valido</li>
            <li>Se il problema persiste, contatta il supporto</li>
          </ul>
        `;
      }
        statusIndicator.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span class="material-icons" style="color: #d32f2f; font-size: 24px; margin-right: 10px;">error</span>
          <strong>Errore Registrazione</strong>
        </div>
        <div class="error-message" style="padding: 10px; background-color: rgba(255,255,255,0.7); border-radius: 4px; margin-bottom: 10px;">
          <p style="margin: 0; color: #c62828; font-weight: bold;">${error.message || 'Impossibile creare l\'account'}</p>
          <p style="margin: 5px 0 0; font-size: 12px; color: #666;">Tempo totale: ${Math.floor((Date.now() - startTime) / 1000)} secondi</p>
        </div>
        <div class="error-help">
          ${specificHelp}
        </div>
        <div class="action-buttons" style="display: flex; margin-top: 15px;">
          <button id="retry-button" style="flex: 1; margin-right: 10px; padding: 8px 16px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <span class="material-icons" style="font-size: 18px; margin-right: 5px;">refresh</span>
            Riprova
          </button>
          <button id="help-button" style="flex: 1; margin-left: 10px; padding: 8px 16px; background-color: #e0e0e0; color: #333; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <span class="material-icons" style="font-size: 18px; margin-right: 5px;">help_outline</span>
            Ottieni Aiuto
          </button>
        </div>
      `;
        // Add event listeners to buttons
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          // Reset the form and try again
          statusIndicator.remove();
          submitButton.disabled = false;
          submitButton.innerHTML = 'Crea Account';
          submitButton.style.backgroundColor = '';
          document.querySelector('.button-spinner').style.display = 'none';
        });
      }
      
      // Help button could link to documentation or support
      const helpButton = document.getElementById('help-button');
      if (helpButton) {
        helpButton.addEventListener('click', () => {
          // Open help documentation or support chat
          window.open('https://steemit.com/faq.html', '_blank');
        });
      }
      
      this.showError(form, error.message || 'Impossibile creare l\'account');
      
      // Reset button state
      submitButton.disabled = false;
      submitButton.innerHTML = 'Riprova';
      submitButton.style.color = '';
    }
  }  showSuccessMessage(form, username, hasValidTelegramId = false, keys = null) {
    // Nascondi il form
    form.style.display = 'none';

    // Crea contenitore di successo
    const successContainer = document.createElement('div');
    successContainer.className = 'auth-success';

    // Controlla se siamo in modalità sviluppo
    const isLocalDev = window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1') ||
      window.location.hostname.match(/^192\.168\.\d+\.\d+$/) !== null;

    // Genera chiavi mock per display se siamo in local dev e non abbiamo chiavi reali
    const accountKeys = keys || this.generateMockKeysForDisplay(username);
    
    // Memorizza le chiavi per la generazione PDF con migliore logging
    console.log('Memorizzazione dati account per generazione PDF:', {
      username,
      keys: accountKeys,
      hasValidTelegramId,
      isLocalDev
    });

    successContainer.accountData = {
      accountName: username,
      keys: accountKeys,
      hasValidTelegramId,
      isLocalDev
    };

    // Aggiungi messaggio di successo
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';

    // Header uguale per tutti i casi
    const header = `
      <div class="success-header">
        <span class="material-icons">check_circle</span>
        <h3>Account Creato con Successo!${isLocalDev ? ' (Modalità Sviluppo)' : ''}</h3>
      </div>
      <div class="account-details">
        <p>Il tuo account Steem <strong>${username}</strong> è stato creato.</p>
      </div>
    `;

    let keysContent = '';
    let warningContent = '';

    // Contenuto diverso basato sull'ambiente e presence di telegramId valido
    if (hasValidTelegramId) {
      // Con ID Telegram valido - mostra chiavi con opzione di nasconderle
      keysContent = `
        <div class="keys-section">
          <p><strong>Le tue chiavi dell'account:</strong></p>
          <div class="keys-container" id="keysContent">
            <p><strong>Chiave Attiva:</strong> <code class="copyable">${accountKeys.active_key || 'Inviata tramite Telegram'}</code></p>
            <p><strong>Chiave Proprietario:</strong> <code class="copyable">${accountKeys.owner_key || 'Inviata tramite Telegram'}</code></p>
            <p><strong>Chiave di Posting:</strong> <code class="copyable">${accountKeys.posting_key || 'Inviata tramite Telegram'}</code></p>
            <p><strong>Chiave Memo:</strong> <code class="copyable">${accountKeys.memo_key || 'Inviata tramite Telegram'}</code></p>
            ${accountKeys.master_key ? `<p><strong>Chiave Master:</strong> <code class="copyable">${accountKeys.master_key}</code></p>` : ''}
          </div>
          <p>Queste chiavi ti sono state inviate anche tramite Telegram.</p>
        </div>
      `;
      warningContent = `
        <div class="key-warning telegram-auth-high">
          <p><strong>Importante:</strong> Le tue chiavi private sono l'unico modo per accedere al tuo account. Non possono essere recuperate se perse!</p>
          <p>Salvale in un luogo sicuro.</p>
        </div>
      `;
    } else if (isLocalDev) {
      // Modalità sviluppo locale - mostra chiavi mock
      keysContent = `
        <div class="keys-section">
          <p><strong>Le tue chiavi di test (solo per sviluppo):</strong></p>
          <div class="keys-container" id="keysContent">
            <p><strong>Chiave Attiva:</strong> <code class="copyable">${accountKeys.active_key}</code></p>
            <p><strong>Chiave Proprietario:</strong> <code class="copyable">${accountKeys.owner_key}</code></p>
            <p><strong>Chiave di Posting:</strong> <code class="copyable">${accountKeys.posting_key}</code></p>
            <p><strong>Chiave Memo:</strong> <code class="copyable">${accountKeys.memo_key}</code></p>
            ${accountKeys.master_key ? `<p><strong>Chiave Master:</strong> <code class="copyable">${accountKeys.master_key}</code></p>` : ''}
          </div>
          <p>In produzione, i dettagli dell'account e le chiavi verrebbero inviati tramite Telegram con ID valido.</p>
        </div>
      `;
      warningContent = `
        <div class="key-warning dev-info">
          <p><strong>Modalità Sviluppo:</strong> Solo per scopi di test. Questo account potrebbe non essere accessibile sulla blockchain.</p>
        </div>
      `;
    } else {
      // Messaggio generico come fallback
      keysContent = `
        <p>Controlla il tuo Telegram per i dettagli dell'account e le chiavi private.</p>
      `;
      warningContent = `
        <div class="key-warning auth-warning">
          <p><strong>Importante:</strong> Le tue chiavi private sono l'unico modo per accedere al tuo account. Non possono essere recuperate se perse!</p>
        </div>
      `;
    }

    successMessage.innerHTML = header + keysContent + warningContent;
    successContainer.appendChild(successMessage);

    // Add buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'success-buttons';

    // Download PDF button (shown in all modes for demonstration)
    const downloadPdfButton = document.createElement('button');
    downloadPdfButton.className = 'auth-button';
    downloadPdfButton.innerHTML = '<span class="material-icons" aria-hidden="true">download</span> <span>Scarica chiavi come PDF</span>';
    downloadPdfButton.addEventListener('click', () => {
      this.downloadAccountPDF(successContainer.accountData);
    });
    buttonsContainer.appendChild(downloadPdfButton);

    // Login button
    const loginButton = document.createElement('button');
    loginButton.className = 'auth-button';
    loginButton.innerHTML = '<span class="material-icons" aria-hidden="true">login</span> <span>Vai al Login</span>';
    loginButton.addEventListener('click', () => {
      router.navigate('/login');
    });
    buttonsContainer.appendChild(loginButton);

    // Create another account button
    const createAnotherButton = document.createElement('button');
    createAnotherButton.className = 'secondary-button';
    createAnotherButton.innerHTML = '<span class="material-icons" aria-hidden="true">person_add</span> <span>Crea un Altro Account</span>';
    createAnotherButton.addEventListener('click', () => {
      // Clear the container and re-render the form
      this.render(this.element);
    });
    buttonsContainer.appendChild(createAnotherButton);

    successContainer.appendChild(buttonsContainer);

    // Add to parent element
    this.element.querySelector('.auth-container').appendChild(successContainer);

    // Add click to copy functionality
    this.addCopyToClipboardFunctionality();
  }
  
  showError(form, message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'auth-error';
    errorElement.textContent = message;
    
    // Insert after header
    const header = form.querySelector('.auth-header');
    form.insertBefore(errorElement, header.nextSibling);
  }
  
  /**
   * Generate mock keys for display in development mode
   * @param {string} username - The account username
   * @returns {Object} - Object containing mock keys
   */
  generateMockKeysForDisplay(username) {
    return {
      active_key: `MOCK_ACTIVE_KEY_${username}_${Math.random().toString(36).substring(2, 10)}`,
      owner_key: `MOCK_OWNER_KEY_${username}_${Math.random().toString(36).substring(2, 10)}`,
      posting_key: `MOCK_POSTING_KEY_${username}_${Math.random().toString(36).substring(2, 10)}`,
      memo_key: `MOCK_MEMO_KEY_${username}_${Math.random().toString(36).substring(2, 10)}`,
      master_key: `MOCK_MASTER_KEY_${username}_${Math.random().toString(36).substring(2, 10)}`
    };
  }
  
  /**
   * Add copy to clipboard functionality to all elements with .copyable class
   */
  addCopyToClipboardFunctionality() {
    // Add copy functionality to key codes
    document.querySelectorAll('.copyable').forEach(codeElement => {
      codeElement.addEventListener('click', function() {
        const textToCopy = this.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
          // Show a brief "copied" feedback
          const originalText = this.textContent;
          const originalBackground = this.style.backgroundColor;
          
          this.textContent = 'Copiato!';
          this.style.backgroundColor = '#d4edda';
          
          setTimeout(() => {
            this.textContent = originalText;
            this.style.backgroundColor = originalBackground;
          }, 1000);
        });
      });
      codeElement.title = 'Clicca per copiare';
    });
  }
  
  /**
   * Downloads account information as a PDF
   * @param {Object} accountData - Data for the account including keys
   */
  downloadAccountPDF(accountData) {
    if (!window.jspdf) {
      console.log('Loading jsPDF library...');
      // Load jsPDF if not already loaded
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        console.log('jsPDF loaded successfully');
        this.generatePDF(accountData);
      };
      script.onerror = () => {
        console.error('Failed to load jsPDF');
        alert('Could not load the PDF generation library. Offering text download instead.');
        this.offerTextDownload(accountData);
      };
      document.body.appendChild(script);
    } else {
      this.generatePDF(accountData);
    }
  }
  
  /**
   * Generates a PDF with account details
   * @param {Object} data - Account data including keys
   */
  generatePDF(data) {
    try {
      console.log('Generating PDF for account:', data.accountName);
      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.setTextColor(0, 102, 204);
      doc.text('Dettagli Account Steem', 20, 20);
      
      // Add account info
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Nome Account: ${data.accountName}`, 20, 40);
      
      // Environment notice
      if (data.isLocalDev) {
        doc.setTextColor(255, 0, 0);
        doc.text('MODALITÀ SVILUPPO - SOLO PER TEST', 20, 50);
        doc.setTextColor(0, 0, 0);
      }
      
      // Add keys section
      doc.text('Chiavi:', 20, 60);
      doc.setFont(undefined, 'bold');
      doc.text('Chiave Attiva:', 20, 70);
      doc.setFont(undefined, 'normal');
      doc.text(data.keys.active_key, 55, 70);
      
      doc.setFont(undefined, 'bold');
      doc.text('Chiave Proprietario:', 20, 80);
      doc.setFont(undefined, 'normal');
      doc.text(data.keys.owner_key, 55, 80);
      
      doc.setFont(undefined, 'bold');
      doc.text('Chiave di Posting:', 20, 90);
      doc.setFont(undefined, 'normal');
      doc.text(data.keys.posting_key, 55, 90);
      
      doc.setFont(undefined, 'bold');
      doc.text('Chiave Memo:', 20, 100);
      doc.setFont(undefined, 'normal');
      doc.text(data.keys.memo_key, 55, 100);
      
      if (data.keys.master_key) {
        doc.setFont(undefined, 'bold');
        doc.text('Chiave Master:', 20, 110);
        doc.setFont(undefined, 'normal');
        doc.text(data.keys.master_key, 55, 110);
      }
      
      // Add warning
      doc.setTextColor(255, 0, 0);
      doc.text('IMPORTANTE:', 20, 130);
      doc.setTextColor(0, 0, 0);
      doc.text('Conserva le tue chiavi in un luogo sicuro! Non possono essere recuperate se perse.', 20, 140);
      doc.text('Non condividere mai le tue chiavi private con nessuno.', 20, 150);
      
      // Add date stamp
      const now = new Date();
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generato il ${now.toLocaleString()}`, 20, 170);
      
      // For mobile compatibility, use blob and data URL approach
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create a temporary link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = pdfUrl;
      downloadLink.download = `steem-account-${data.accountName}.pdf`;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
        document.body.removeChild(downloadLink);
      }, 100);
      
      // Show success message
      this.showNotification('Download PDF avviato', 'success');
    } catch (error) {
      console.error("PDF generation error:", error);
      this.showNotification('Generazione PDF fallita', 'error');
      
      // Fallback: offer text information if PDF fails
      this.offerTextDownload(data);
    }
  }
  
  /**
   * Fallback function to offer account details as text if PDF fails
   * @param {Object} data - Account data including keys
   */
  offerTextDownload(data) {
    const textContent = `
Dettagli Account Steem
====================
Nome Account: ${data.accountName}

Chiavi:
- Chiave Attiva: ${data.keys.active_key}
- Chiave Proprietario: ${data.keys.owner_key}
- Chiave di Posting: ${data.keys.posting_key}
- Chiave Memo: ${data.keys.memo_key}
${data.keys.master_key ? `- Chiave Master: ${data.keys.master_key}` : ''}

IMPORTANTE:
Conserva le tue chiavi in un luogo sicuro! Non possono essere recuperate se perse.
Non condividere mai le tue chiavi private con nessuno.

Generato il ${new Date().toLocaleString()}
${data.isLocalDev ? '\nMODALITÀ SVILUPPO - SOLO PER TEST' : ''}
    `;
    
    const textBlob = new Blob([textContent], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = textUrl;
    downloadLink.download = `steem-account-${data.accountName}.txt`;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(textUrl);
      document.body.removeChild(downloadLink);
    }, 100);
    
    this.showNotification('Download file di testo avviato', 'success');
  }
  
  /**
   * Show a notification message
   * @param {string} message - The message to show
   * @param {string} type - The type of notification (success, error, etc)
   */
  showNotification(message, type = 'info') {
    // Use the event emitter for notifications if available
    if (typeof eventEmitter !== 'undefined') {
      eventEmitter.emit('notification', {
        type: type,
        message: message
      });
      return;
    }
    
    // Fallback to alert if event emitter not available
    alert(message);
  }
}

export default RegisterView;