# Architettura del Progetto cur8.fun

## Panoramica

cur8.fun è un'applicazione web moderna che fornisce un'interfaccia intuitiva per interagire con la blockchain Steem. Il progetto è costruito utilizzando vanilla JavaScript con un'architettura modulare e componentizzata che segue i principi di separazione delle responsabilità e riusabilità del codice.

## Principi Architetturali

### 1. Modularità
- Ogni modulo ha una responsabilità specifica e ben definita
- I componenti sono riutilizzabili e indipendenti
- Le dipendenze sono gestite tramite ES6 modules

### 2. Separazione delle Responsabilità
- **Views**: Gestione delle pagine e layout
- **Components**: Elementi UI riutilizzabili
- **Services**: Logica di business e comunicazione con API
- **Controllers**: Coordinamento tra view e services
- **Utils**: Funzioni di utilità generali

### 3. Event-Driven Architecture
- Sistema di eventi centralizzato tramite EventEmitter
- Comunicazione asincrona tra componenti
- Gestione del ciclo di vita dei componenti

## Struttura del Progetto

```
/
├── assets/                  # Asset statici
│   ├── css/                # Fogli di stile modulari
│   │   ├── base/           # Stili base (reset, tipografia)
│   │   ├── components/     # Stili per componenti
│   │   ├── features/       # Stili per funzionalità specifiche
│   │   ├── layout/         # Stili per layout e griglie
│   │   └── pages/          # Stili specifici per pagine
│   └── img/                # Immagini e grafica
├── components/             # Componenti UI riutilizzabili
│   ├── auth/               # Componenti di autenticazione
│   ├── comments/           # Componenti per commenti
│   ├── post/               # Componenti per post
│   ├── profile/            # Componenti profilo utente
│   ├── pwa/                # Componenti PWA
│   └── wallet/             # Componenti wallet e finanza
├── controllers/            # Controller per logica di business
├── models/                 # Modelli dati (opzionale, non utilizzato nei dialog)
├── services/               # Servizi per API e blockchain
│   └── steem-service-classes/ # Classi specializzate per Steem
├── utils/                  # Utility e helper
├── views/                  # Viste e layout delle pagine
└── test/                   # Test e file di esempio
```

## Architettura a Livelli

### Layer 1: Presentation Layer (Views)

Le **Views** rappresentano le pagine dell'applicazione e gestiscono il layout principale.

**Caratteristiche:**
- Estendono la classe base `View`
- Gestiscono il routing e i parametri URL
- Coordinano i componenti nella pagina
- Implementano il ciclo di vita (render, unmount)

**Esempio:**
```javascript
class HomeView extends View {
  constructor(params) {
    super(params);
    this.components = [];
  }
  
  async render(element) {
    // Logica di rendering
    this.initializeComponents();
    return this.element;
  }
  
  unmount() {
    // Cleanup delle risorse
    super.unmount();
  }
}
```

### Layer 2: Component Layer

I **Components** sono elementi UI riutilizzabili che incapsulano logica e presentazione.

**Caratteristiche:**
- Estendono la classe base `Component`
- Gestiscono eventi DOM e del sistema
- Implementano pattern di cleanup automatico
- Supportano configurazione tramite options

**Esempio:**
```javascript
class WalletBalancesComponent extends Component {
  constructor(parentElement, options) {
    super(parentElement, options);
  }
  
  render() {
    // Creazione DOM
    this.registerEventHandler(button, 'click', this.handleClick);
  }
  
  destroy() {
    // Cleanup automatico
    super.destroy();
  }
}
```

### Layer 3: Service Layer

I **Services** gestiscono la logica di business e le comunicazioni esterne.

**Caratteristiche:**
- Pattern Singleton per condivisione stato
- Interfacce asincrone per API
- Cache e ottimizzazioni
- Gestione errori centralizzata

**Struttura principale:**
- `SteemService`: Facade per interazioni blockchain
- `AuthService`: Gestione autenticazione
- `WalletService`: Operazioni wallet
- `NotificationsService`: Sistema notifiche

### Layer 4: Utility Layer

Gli **Utils** forniscono funzionalità di supporto e helper.

**Componenti principali:**
- `Router`: Gestione navigazione client-side
- `EventEmitter`: Sistema eventi centralizzato
- `NavigationManager`: Gestione UI di navigazione
- `ThemeManager`: Gestione temi

## Pattern di Design

### 1. Facade Pattern
`SteemService` agisce come facade per i servizi blockchain specializzati:

```javascript
class SteemService {
  constructor() {
    this.core = new SteemCore();
    this.postService = new PostService(this.core);
    this.commentService = new CommentService(this.core);
    this.userService = new UserServiceCore(this.core);
  }
}
```

### 2. Observer Pattern
Sistema di eventi per comunicazione disaccoppiata:

```javascript
// Emissione evento
eventEmitter.emit('user:login', userData);

// Ascolto evento
eventEmitter.on('user:login', (userData) => {
  this.updateUI(userData);
});
```

### 3. Component Pattern
Gestione del ciclo di vita dei componenti:

```javascript
class Component {
  constructor(parentElement, options) {
    this.eventHandlers = [];
    this.emitterHandlers = [];
  }
  
  registerEventHandler(element, event, callback) {
    // Registrazione automatica per cleanup
  }
  
  destroy() {
    // Cleanup automatico di tutti gli event listener
  }
}
```

### 4. Router Pattern
Navigazione client-side con supporto hash e history API:

```javascript
router
  .addRoute('/', HomeView, { tag: 'trending' })
  .addRoute('/create', CreatePostView, { requiresAuth: true })
  .addRoute('/@:username', ProfileView)
  .setNotFound(NotFoundView);
```

## Gestione dello Stato

### 1. Stato Locale dei Componenti
Ogni componente mantiene il proprio stato interno.

### 2. Stato Condiviso tramite Services
I services mantengono stato globale accessibile da più componenti.

### 3. Comunicazione tramite Eventi
I cambiamenti di stato vengono propagati tramite eventi.

### 4. Cache Locale
Implementazione di cache a livello di service per ottimizzare le performance.

## Dialog Architecture

I dialog seguono una struttura standardizzata estendendo la classe base Component:

```javascript
class SchedulePostDialog extends Component {
  constructor() {
    super(document.body, {});
    this.overlay = null;
    this.dialog = null;
    this.isOpen = false;
  }
  
  show(data) {
    this.createDialog(data);
    this.attachEventListeners();
  }
  
  hide() {
    this.cleanup();
  }
}

// Singleton instance per condivisione globale
const schedulePostDialog = new SchedulePostDialog();
export default schedulePostDialog;
```

**Caratteristiche dei Dialog:**
- Estendono la classe base Component per cleanup automatico
- Gestione autonoma del DOM
- Event listener con cleanup automatico tramite registerEventHandler
- Validazione integrata
- Comunicazione tramite callback o eventi
- Pattern singleton per condivisione stato

## Authentication & Authorization

### 1. Keychain Integration
Integrazione con Steem Keychain per operazioni sicure:

```javascript
if (window.steem_keychain) {
  steem_keychain.requestSignBuffer(username, message, 'Active', callback);
}
```

### 2. Permission Management
Sistema di autorizzazioni per operazioni specifiche:
- **Posting Key**: Per post e commenti
- **Active Key**: Per operazioni wallet
- **Authorization**: Per account "cur8" per post schedulati

### 3. Session Management
Gestione sessioni utente con persistence locale.

## Performance & Optimization

### 1. Lazy Loading
Caricamento dinamico di componenti quando necessario.

### 2. Virtual Scrolling
Implementazione di infinite scroll per liste lunghe.

### 3. Cache Strategy
Cache intelligente per ridurre chiamate API.

### 4. Component Reuse
Riutilizzo di componenti per ottimizzare memoria.

## Testing Strategy

### 1. Unit Tests
Test per singoli componenti e servizi.

### 2. Integration Tests
Test per interazioni tra componenti.

### 3. E2E Tests
Test end-to-end per flussi utente completi.

## PWA Features

### 1. Service Worker
Gestione cache e funzionalità offline.

### 2. Manifest
Configurazione per installazione come app.

### 3. Offline Support
Supporto per funzionalità base offline.

### 4. Push Notifications
Sistema notifiche push (quando supportato).

## Conclusioni

L'architettura di cur8.fun è progettata per essere:
- **Scalabile**: Facile aggiunta di nuove funzionalità
- **Maintenaible**: Codice pulito e ben organizzato
- **Testabile**: Struttura che facilita il testing
- **Performante**: Ottimizzazioni per una UX fluida
- **Modulare**: Componenti riutilizzabili e indipendenti

Questa architettura supporta lo sviluppo iterativo e la crescita del progetto mantenendo alta la qualità del codice e delle performance.