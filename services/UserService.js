class UserService {
    constructor() {
        // Nessun parametro apiClient - useremo direttamente l'API di Steem
        this.steemLoaded = false;
    }

    /**
     * Carica la libreria Steem se non è già caricata
     * @returns {Promise<Object>} - L'oggetto steem
     */
    async ensureSteemLibraryLoaded() {
        if (typeof window.steem !== 'undefined') {
            this.steemLoaded = true;
            return window.steem;
        }

        // Importa steemService per utilizzare il suo metodo di caricamento della libreria
        try {
            const steemServiceModule = await import('./SteemService.js');
            const steemService = steemServiceModule.default;
            
            // Utilizza il metodo esistente in steemService per caricare la libreria
            const steem = await steemService.ensureLibraryLoaded();
            this.steemLoaded = true;
            return steem;
        } catch (error) {
            console.error('Failed to load Steem library:', error);
            throw new Error('Could not load Steem library');
        }
    }

    /**
     * Cerca utenti su Steem in base a una query
     * @param {string} query - La query di ricerca (nome utente o parte di esso)
     * @param {number} limit - Numero massimo di risultati da restituire
     * @returns {Promise<Array>} - Lista di account trovati
     */
    async searchUsers(query, limit = 5) {
        try {
            if (!query || query.length < 3) {
                return [];
            }
            
            // Assicurati che la libreria steem sia caricata
            await this.ensureSteemLibraryLoaded();
            
            return new Promise((resolve, reject) => {
                window.steem.api.lookupAccounts(query, limit, (err, result) => {
                    if (err) {
                        console.error('Error searching for users:', err);
                        reject(err);
                    } else {
                        // Trasforma i risultati in oggetti con struttura coerente
                        const formattedResults = result.map(username => ({
                            name: username,
                            username: username, // Duplicato per compatibilità
                            id: username
                        }));
                        resolve(formattedResults);
                    }
                });
            });
        } catch (error) {
            console.error('Error in searchUsers:', error);
            throw error;
        }
    }

    /**
     * Ottiene il profilo completo di un utente
     * @param {string} username - Nome utente
     * @returns {Promise<Object>} - Dati del profilo
     */
    async getUserProfile(username) {
        try {
            // Assicurati che la libreria steem sia caricata
            await this.ensureSteemLibraryLoaded();
            
            return new Promise((resolve, reject) => {
                window.steem.api.getAccounts([username], (err, result) => {
                    if (err) {
                        console.error('Error fetching user profile:', err);
                        reject(err);
                    } else if (result && result.length > 0) {
                        // Parse JSON metadata if available
                        try {
                            const account = result[0];
                            if (account.json_metadata) {
                                try {
                                    const metadata = JSON.parse(account.json_metadata);
                                    account.metadata = metadata;
                                    account.profile = metadata.profile || {};
                                    account.about = account.profile.about || '';
                                } catch (e) {
                                    console.warn('Failed to parse account metadata', e);
                                    account.metadata = {};
                                    account.profile = {};
                                }
                            }
                            resolve(account);
                        } catch (parseError) {
                            console.error('Error parsing profile data:', parseError);
                            reject(parseError);
                        }
                    } else {
                        reject(new Error('User not found'));
                    }
                });
            });
        } catch (error) {
            console.error('Error in getUserProfile:', error);
            throw error;
        }
    }

    /**
     * Aggiorna il profilo di un utente
     * @param {string} username - Nome utente
     * @param {Object} profileData - Dati del profilo da aggiornare
     * @returns {Promise<Object>} - Risultato dell'aggiornamento
     */
    async updateUserProfile(username, profileData, postingKey) {
        try {
            // Implementation for updating user profile goes here
            // This would use the blockchain operations
            // For now, just return a dummy response
            return {
                success: true,
                message: 'Profile updated successfully'
            };
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
}

// Crea ed esporta un'istanza singleton del servizio
const userService = new UserService();
export default userService;
