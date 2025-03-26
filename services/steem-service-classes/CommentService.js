/**
 * Service for comment-related operations
 */
export default class CommentService {
    constructor(core) {
        this.core = core;
    }

    async createComment(parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata) {
        console.log('createComment method called with:', { parentAuthor, parentPermlink, author, permlink, title });

        await this.core.ensureLibraryLoaded();

        // Sanitize the permlink for base58 compatibility
        const sanitizedPermlink = this.sanitizePermlink(permlink);

        console.log('About to broadcast comment to Steem blockchain');

        // Check if Steem Keychain is available
        if (window.steem_keychain) {
            console.log('Using Steem Keychain for signing');

            return new Promise((resolve, reject) => {
                const operations = [
                    ['comment', {
                        parent_author: parentAuthor,
                        parent_permlink: parentPermlink,
                        author: author,
                        permlink: sanitizedPermlink,
                        title: title,
                        body: body,
                        json_metadata: JSON.stringify(jsonMetadata)
                    }]
                ];

                window.steem_keychain.requestBroadcast(author, operations, 'posting', (response) => {
                    if (response.success) {
                        console.log('Comment posted successfully with Keychain:', response);
                        resolve(response);
                    } else {
                        console.error('Keychain broadcast error:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
        } else {
            // Fallback to posting key method
            const postingKey = localStorage.getItem('postingKey');

            if (!postingKey) {
                throw new Error('No posting key found and Keychain not available. Please log in to comment.');
            }

            // Use the standard broadcast.comment method with a Promise wrapper
            return new Promise((resolve, reject) => {
                this.core.steem.broadcast.comment(
                    postingKey,
                    parentAuthor,
                    parentPermlink,
                    author,
                    sanitizedPermlink,
                    title,
                    body,
                    jsonMetadata,
                    (err, result) => {
                        if (err) {
                            console.error('Comment broadcast error:', err);
                            reject(err);
                        } else {
                            console.log('Comment posted successfully:', result);
                            resolve(result);
                        }
                    }
                );
            });
        }
    }

    sanitizePermlink(permlink) {
        if (!permlink || typeof permlink !== 'string') {
            // Generate a fallback permlink based on timestamp
            return `re-comment-${Date.now().toString(36)}`;
        }

        // First, convert to lowercase (Steem requires lowercase)
        let sanitized = permlink.toLowerCase();

        // Replace spaces with hyphens
        sanitized = sanitized.replace(/\s+/g, '-');

        // Keep only alphanumeric characters, hyphens, and dots
        sanitized = sanitized.replace(/[^a-z0-9\-\.]/g, '');

        // Steem doesn't like permalinks starting with numbers or dots
        if (/^[0-9\.]/.test(sanitized)) {
            sanitized = `re-${sanitized}`;
        }

        // Make sure it's not too long (max 256 characters)
        if (sanitized.length > 256) {
            sanitized = sanitized.substring(0, 256);
        }

        // Ensure the permlink is not empty
        if (!sanitized || sanitized.length === 0) {
            sanitized = `re-comment-${Date.now().toString(36)}`;
        }

        console.log('Sanitized permlink:', sanitized);
        return sanitized;
    }

    async getCommentsByAuthor(author, limit = -1) {
        try {
            console.log(`Getting comments for author ${author} (limit: ${limit === -1 ? 'ALL' : limit})`);
            await this.core.ensureLibraryLoaded();

            // Raccogliamo tutti i commenti con approccio a finestra scorrevole
            const allComments = [];
            let startPermlink = '';
            let hasMoreComments = true;
            let attempts = 0;

            // Batch size ottimale per l'API
            const BATCH_SIZE = 100;

            // -1 significa "carica tutti quelli disponibili"
            const loadAll = limit === -1;
            const targetLimit = loadAll ? Number.MAX_SAFE_INTEGER : limit;

            // Finestra scorrevole: continua a caricare finché ci sono più commenti
            // o finché non raggiungiamo il limite richiesto
            while (hasMoreComments && allComments.length < targetLimit && attempts < 50) {
                console.log(`[Batch ${attempts+1}] Caricate ${allComments.length} commenti finora`);

                try {
                    // Carica il prossimo batch di commenti
                    const comments = await this.getAuthorComments(author, startPermlink, BATCH_SIZE);

                    // Se non ci sono risultati, interrompi
                    if (!comments || comments.length === 0) {
                        console.log('Nessun altro commento da caricare');
                        hasMoreComments = false;
                        break;
                    }

                    // Determina quali commenti sono nuovi
                    // Se questo non è il primo batch, salta il primo risultato (duplicato)
                    const newComments = (startPermlink && comments.length > 0) 
                        ? comments.slice(1).filter(c => c.parent_author !== '') 
                        : comments.filter(c => c.parent_author !== '');

                    // Se non ci sono nuovi commenti validi in questo batch
                    if (newComments.length === 0) {
                        // Tenta di avanzare oltre il punto di stallo
                        if (comments.length >= 2) {
                            console.log('Nessun nuovo commento in questo batch, provo a saltare al commento successivo');
                            startPermlink = comments[1].permlink;
                            attempts++;
                            continue;
                        } else {
                            console.log('Non è possibile avanzare oltre, fine del caricamento');
                            hasMoreComments = false;
                            break;
                        }
                    }

                    // Aggiungi i nuovi commenti alla collezione
                    allComments.push(...newComments);
                    console.log(`Aggiunti ${newComments.length} nuovi commenti (totale: ${allComments.length})`);

                    // Aggiorna il permlink di partenza per il prossimo batch
                    const lastComment = comments[comments.length - 1];
                    startPermlink = lastComment.permlink;

                    // Emetti progresso per l'UI
                    if (typeof window !== 'undefined' && window.eventEmitter) {
                        window.eventEmitter.emit('comments:progress', {
                            author,
                            total: allComments.length,
                            batch: newComments.length,
                            batchNumber: attempts + 1
                        });
                    }

                    // Pausa breve per evitare limiti di richieste
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Errore nel batch ${attempts+1}:`, error);
                    // Prova un altro endpoint in caso di errore
                    this.core.switchEndpoint();
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                attempts++;
            }

            // Riporta il numero finale di commenti caricati
            console.log(`Caricamento commenti completato: ${allComments.length} commenti totali per ${author}`);

            // Rimuovi eventuali duplicati (possono verificarsi in caso di errori)
            const seen = new Set();
            const uniqueComments = allComments.filter(comment => {
                const id = `${comment.author}_${comment.permlink}`;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            if (uniqueComments.length < allComments.length) {
                console.log(`Rimossi ${allComments.length - uniqueComments.length} commenti duplicati`);
            }

            // Ordina per data, dal più recente al più vecchio
            return uniqueComments.sort((a, b) => new Date(b.created) - new Date(a.created));
        } catch (error) {
            console.error('Errore in getCommentsByAuthor:', error);
            return [];
        }
    }

    async getAuthorComments(username, startPermlink, limit) {
        // Assicurati che la libreria sia caricata
        await this.core.ensureLibraryLoaded();
        
        console.log(`Fetching comments for ${username} starting from ${startPermlink || 'beginning'}, limit: ${limit || 20}`);
        
        const query = {
            start_author: username,
            start_permlink: startPermlink || '',
            limit: limit || 20
        };
        
        try {
            // Utilizziamo la versione sincrona con Promise
            return await new Promise((resolve, reject) => {
                this.core.steem.api.getDiscussionsByComments(query, (err, result) => {
                    if (err) {
                        console.error('Error in getDiscussionsByComments:', err);
                        reject(err);
                    } else {
                        console.log(`Retrieved ${result ? result.length : 0} comments`);
                        resolve(result || []);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching author comments:', error);
            // Prova con un altro endpoint in caso di errore
            this.core.switchEndpoint();
            
            // Ritenta una volta con il nuovo endpoint
            try {
                return await new Promise((resolve, reject) => {
                    this.core.steem.api.getDiscussionsByComments(query, (err, result) => {
                        if (err) reject(err);
                        else resolve(result || []);
                    });
                });
            } catch (retryError) {
                console.error('Retry for comments also failed:', retryError);
                return [];
            }
        }
    }
}