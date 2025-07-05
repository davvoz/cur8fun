# Miglioramenti alla Gestione dei Post Schedulati

## Problema Identificato

Il progetto aveva un approccio inconsistente nella gestione dei post schedulati:

1. **Doppia gestione API**: 
   - `ApiClient` con metodo `getUserDrafts()` 
   - `ApiScheduledClient` con metodo `Get_ScheduledPosts()` 

2. **Utilizzo scorretto**: `DraftsView.js` usava `ApiClient.getUserDrafts()` invece di `ApiScheduledClient.Get_ScheduledPosts()`

3. **Metodo sottoutilizzato**: `Get_ScheduledPosts()` non veniva mai utilizzato nel codice

## Modifiche Implementate

### 1. Aggiornamento di `CreatePostService.js`

Aggiunto nuovo metodo per gestire i post schedulati:

```javascript
/**
 * Gets all scheduled posts for a user using ApiScheduledClient
 * @param {string} username - Username to get scheduled posts for
 * @returns {Promise<Array>} - Array of scheduled posts
 */
async getScheduledPosts(username) {
  try {
    if (!username) {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No user authenticated');
      }
      username = currentUser.username;
    }
    
    // Use ApiScheduledClient instead of ApiClient for scheduled posts
    const scheduledPosts = await this.apiScheduledClient.Get_ScheduledPosts(username);
    
    return scheduledPosts || [];
  } catch (error) {
    console.error('Failed to get scheduled posts:', error);
    throw error;
  }
}
```

### 2. Aggiornamento di `DraftsView.js`

Modificato il metodo `getScheduledPosts()` per usare il servizio centralizzato:

```javascript
// PRIMA (scorretto)
const { ApiClient } = await import('../services/api-ridd.js');
const apiClient = new ApiClient();
const scheduledData = await apiClient.getUserDrafts(this.currentUser.username);

// DOPO (corretto)
const scheduledData = await createPostService.getScheduledPosts(this.currentUser.username);
```

## Vantaggi delle Modifiche

1. **Consistenza**: Usa sempre `ApiScheduledClient` per i post schedulati
2. **Centralizzazione**: Tutta la logica dei post schedulati è gestita da `CreatePostService`
3. **Manutenibilità**: Più facile da mantenere e debuggare
4. **Utilizzo corretto**: Finalmente usa il metodo `Get_ScheduledPosts()` come previsto

## Struttura API Definitiva

### Per i Draft (bozze locali):
- `CreatePostService.getAllUserDrafts()` - Draft salvati localmente
- `CreatePostService.saveDraft()` - Salva draft localmente
- `CreatePostService.getDraft()` - Recupera draft corrente

### Per i Post Schedulati:
- `CreatePostService.getScheduledPosts()` - **NUOVO** - Recupera tutti i post schedulati
- `CreatePostService.saveScheduledPost()` - Salva post schedulato
- `CreatePostService.updateScheduledPost()` - Aggiorna post schedulato
- `CreatePostService.getScheduledPostById()` - Recupera post schedulato specifico

## Endpoint API Utilizzati

### ApiClient (per draft e operazioni generali):
- `/get_user_drafts` - **NON PIÙ USATO** per scheduled posts
- `/delete_draft` - Per eliminare draft
- `/login`, `/logout`, etc. - Operazioni di autenticazione

### ApiScheduledClient (per post schedulati):
- `/get_scheduled_posts` - **ORA UTILIZZATO** tramite `Get_ScheduledPosts()`
- `/save_scheduled` - Tramite `SchedulePost()`

## Test Consigliati

1. Verifica che `DraftsView` carichi correttamente i post schedulati
2. Controlla che non ci siano errori nella console quando si accede a `/drafts`
3. Verifica che i post schedulati siano visualizzati correttamente nella UI
4. Testa la creazione di nuovi post schedulati

## Note per gli Sviluppatori

- **Non usare mai direttamente** `ApiClient.getUserDrafts()` per i post schedulati
- **Usa sempre** `CreatePostService.getScheduledPosts()` per recuperare post schedulati
- **Mantieni la separazione** tra draft locali e post schedulati
- Il metodo `Get_ScheduledPosts()` è ora il metodo ufficiale per recuperare post schedulati
