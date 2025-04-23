import profileService from '../../services/ProfileService.js';

export default class CommentLoader {
  constructor(username) {
    this.username = username;
    this.loading = false;
    this.commentsData = null;
    this.allComments = [];
    this.estimatedTotalComments = 0;
    this.pageSize = 20; // Numero di commenti per pagina
    this.hasMoreComments = true; // Flag per tracciare se ci sono altri commenti da caricare
    this.lastFetchedPage = 0; // Ultima pagina caricata
  }

  async loadComments(limit = 20, page = 1) {
    if (this.loading) return this.allComments;
    this.loading = true;

    try {
      // Carica i commenti dal servizio - sempre forza il refresh
      const comments = await profileService.getUserComments(this.username, limit, page, {
        forceRefresh: true, // Forza sempre il refresh
        timeout: 15000
      });

      if (comments && Array.isArray(comments)) {
        if (page === 1) {
          // Se è la prima pagina, resetta la collezione
          this.allComments = comments;
        } else {
          // Altrimenti aggiungi alla collezione esistente
          this.allComments = [...this.allComments, ...comments];
        }
        
        this.commentsData = true;
        this.estimatedTotalComments = this.allComments.length;
        this.lastFetchedPage = page;
        
        // Aggiorna flag se ci sono potenzialmente altri commenti da caricare
        // Assumiamo che se il numero di commenti restituiti è uguale al limite, ce ne sono altri
        this.hasMoreComments = comments.length >= limit;
        
        // Se viene restituito un numero minore del limite, probabilmente abbiamo raggiunto la fine
        if (comments.length < limit) {
          this.hasMoreComments = false;
        }
      } else {
        this.hasMoreComments = false;
      }
      
      return this.allComments;
    } catch (error) {
      console.error('[CommentLoader] Error loading comments:', error);
      return [];
    } finally {
      this.loading = false;
    }
  }
  
  async loadMoreComments(page) {
    if (!this.hasMoreComments || page <= this.lastFetchedPage) {
      return [];
    }
    
    const newComments = await this.loadComments(this.pageSize, page);
    return newComments;
  }
  
  hasMore() {
    return this.hasMoreComments;
  }

  reset() {
    this.loading = false;
    this.commentsData = null;
    this.allComments = [];
    this.lastFetchedPage = 0;
    this.hasMoreComments = true;
    this.estimatedTotalComments = 0;
    return this;
  }

  clear() {
    return this.reset();
  }
}
