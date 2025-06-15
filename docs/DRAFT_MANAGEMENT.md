# Sistema di Gestione Draft Migliorato

## Panoramica

Il sistema di gestione draft è stato completamente rivisto per offrire una migliore esperienza utente e maggiore flessibilità nella gestione delle bozze dei post.

## Caratteristiche Principali

### 🔄 Sistema Multi-Draft
- **Draft multipli**: Ogni utente può avere fino a 10 draft salvati contemporaneamente
- **Draft corrente**: Mantiene il sistema legacy del "draft corrente" per retrocompatibilità
- **ID univoci**: Ogni draft ha un ID univoco per identificazione precisa

### 💾 Salvataggio Avanzato
- **Auto-save**: Salvataggio automatico ogni 15 secondi del draft corrente
- **Salvataggio manuale**: Pulsante per salvare il draft corrente
- **Salva come nuovo**: Pulsante per salvare come nuovo draft con ID
- **Cleanup automatico**: Rimozione automatica dei draft scaduti (>30 giorni)

### 🎯 Funzionalità Estese
- **Duplicazione**: Possibilità di duplicare draft esistenti
- **Caricamento**: Carica un draft salvato come draft corrente
- **Esportazione**: Esporta tutti i draft in formato JSON
- **Pulizia**: Rimuove manualmente i draft scaduti

## Utilizzo

### In CreatePostView (`/create`)
1. **Auto-save**: La bozza viene salvata automaticamente mentre scrivi
2. **Salva Draft**: Icona 💾 per salvare manualmente il draft corrente
3. **Salva Come Nuovo**: Icona 📄 per salvare come nuovo draft
4. **Visualizza Draft**: Icona 📋 per accedere alla vista draft

### In DraftsView (`/drafts`)
1. **Visualizzazione**: Tutti i draft organizzati per data di modifica
2. **Statistiche**: Contatori per draft totali, correnti e salvati
3. **Azioni per draft**:
   - ✏️ **Modifica**: Carica il draft nell'editor
   - 📄 **Duplica**: Crea una copia del draft
   - 🔄 **Carica**: Imposta come draft corrente
   - 💾 **Salva**: (solo draft corrente) Salva come nuovo draft
   - 🗑️ **Elimina**: Rimuove il draft

### Azioni Globali
- 🧹 **Clean Up**: Rimuove draft scaduti
- 📥 **Export**: Scarica tutti i draft in JSON

## Struttura Tecnica

### Chiavi LocalStorage
```
steemee_post_draft                    // Draft corrente (legacy)
steemee_draft_{username}_{id}         // Draft salvati con ID
```

### Formato Draft
```javascript
{
  id: "unique_id",
  title: "Titolo del post",
  body: "Contenuto markdown",
  tags: ["tag1", "tag2"],
  community: "hive-123456",
  timestamp: "2025-06-15T10:00:00.000Z",
  lastModified: 1718449200000,
  username: "username",
  version: "2.0",
  isCurrent: false
}
```

### API Draft Service

#### CreatePostService Metodi
```javascript
// Gestione base (legacy)
saveDraft(draftData)                  // Salva draft corrente
getDraft()                            // Ottieni draft corrente
clearDraft()                          // Cancella draft corrente
hasDraft()                            // Verifica esistenza draft corrente

// Sistema avanzato
generateDraftId()                     // Genera ID univoco
getAllUserDrafts()                    // Ottieni tutti i draft utente
saveDraftWithId(data, id)             // Salva draft con ID specifico
getDraftById(id)                      // Carica draft per ID
deleteDraftById(id)                   // Elimina draft per ID
duplicateDraft(id)                    // Duplica draft esistente
loadDraftAsCurrent(id)                // Carica come draft corrente
moveCurrentDraftToSaved()             // Sposta corrente in salvato
cleanupExpiredDrafts(username)        // Pulisci draft scaduti
```

## Configurazione

### Parametri Configurabili (CreatePostService)
```javascript
MAX_DRAFTS_PER_USER: 10,              // Massimo draft per utente
DRAFT_EXPIRY_DAYS: 30,                // Giorni prima della scadenza
AUTO_SAVE_INTERVAL: 15000             // Intervallo auto-save (ms)
```

## Benefici

### 👤 Per l'Utente
- **Maggiore sicurezza**: Non perdere mai il lavoro
- **Organizzazione**: Draft multipli organizzati e facilmente accessibili
- **Flessibilità**: Lavora su più post contemporaneamente
- **Backup**: Esportazione e duplicazione facili

### 🔧 Per lo Sviluppo
- **Retrocompatibilità**: Il sistema legacy continua a funzionare
- **Modularità**: Funzioni separate per gestione specifica
- **Manutenibilità**: Cleanup automatico e gestione errori robusti
- **Espandibilità**: Facilmente estendibile per nuove funzionalità

## Migration Path

Il sistema è progettato per la retrocompatibilità:

1. **Draft esistenti**: Continuano a funzionare come "draft corrente"
2. **Nuovi draft**: Utilizzano il sistema ID automaticamente
3. **Graduale migrazione**: Gli utenti possono migrare gradualmente

## Styling

### CSS Classes Principali
- `.drafts-view`: Container principale vista draft
- `.draft-card`: Singola card draft
- `.current-draft`: Badge per draft corrente
- `.draft-actions`: Azioni disponibili per draft
- `.draft-status-pill`: Indicatore stato salvataggio

### Responsive Design
- **Desktop**: Grid multi-colonna
- **Tablet**: 2 colonne
- **Mobile**: Singola colonna

## Future Enhancements

### Possibili Miglioramenti
1. **Sincronizzazione cloud**: Backup su server remoto
2. **Condivisione**: Condividi draft con altri utenti
3. **Template**: Draft come template riutilizzabili
4. **Categorizzazione**: Organizza draft per categorie
5. **Ricerca**: Ricerca full-text nei draft
6. **Versioning**: Storico delle modifiche per draft

### Integrazioni
1. **Community integration**: Draft specifici per community
2. **Scheduling**: Programmazione pubblicazione automatica
3. **Collaboration**: Draft collaborativi
4. **Analytics**: Statistiche di utilizzo draft
