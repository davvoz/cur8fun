/**
 * Firebase Service
 * Handles all Firebase operations including Firestore database access
 * 
 * Features:
 * - Draft storage and retrieval
 * - Scheduled posts storage
 * - User data synchronization
 * - Real-time updates
 */

import authService from './AuthService.js';

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.isInitialized = false;
    this.isFirebaseEnabled = false;
    
    // Collections
    this.COLLECTIONS = {
      DRAFTS: 'drafts',
      SCHEDULED_POSTS: 'scheduled_posts',
      USER_PREFERENCES: 'user_preferences'
    };
  }

  /**
   * Initialize Firebase
   * Loads Firebase SDK dynamically and initializes the app
   */
  async initialize() {
    if (this.isInitialized) {
      return this.isFirebaseEnabled;
    }

    try {
      console.log('[FirebaseService] Initializing Firebase...');
      
      // Dynamically import Firebase SDK
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit } = 
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      // Import Firebase config
      const { default: firebaseConfig } = await import('../config/firebase-config.js');
      
      // Check if Firebase config is valid (not placeholder)
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY') {
        console.warn('[FirebaseService] Firebase configuration not set. Using localStorage fallback.');
        this.isInitialized = true;
        this.isFirebaseEnabled = false;
        return false;
      }

      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      
      // Store Firestore functions for later use
      this.firestoreFunctions = {
        collection,
        doc,
        setDoc,
        getDoc,
        getDocs,
        deleteDoc,
        query,
        where,
        orderBy,
        limit
      };
      
      this.isInitialized = true;
      this.isFirebaseEnabled = true;
      
      console.log('[FirebaseService] Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('[FirebaseService] Failed to initialize Firebase:', error);
      this.isInitialized = true;
      this.isFirebaseEnabled = false;
      return false;
    }
  }

  /**
   * Ensure Firebase is initialized
   * @returns {Promise<boolean>} true if Firebase is enabled
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.isFirebaseEnabled;
  }

  /**
   * Save a draft to Firestore
   * @param {Object} draftData - Draft data to save
   * @param {string} draftId - Unique draft ID
   * @returns {Promise<Object>} Result object with success status
   */
  async saveDraft(draftData, draftId) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      throw new Error('Firebase is not enabled. Check configuration.');
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const username = currentUser.username;
      const { collection, doc, setDoc } = this.firestoreFunctions;
      
      const draftDoc = {
        ...draftData,
        id: draftId,
        username: username,
        lastModified: Date.now(),
        timestamp: new Date().toISOString(),
        version: '2.0'
      };

      const docRef = doc(this.db, this.COLLECTIONS.DRAFTS, `${username}_${draftId}`);
      await setDoc(docRef, draftDoc);

      console.log('[FirebaseService] Draft saved successfully:', draftId);
      return { success: true, draftId };
    } catch (error) {
      console.error('[FirebaseService] Failed to save draft:', error);
      throw error;
    }
  }

  /**
   * Get a specific draft by ID
   * @param {string} draftId - Draft ID
   * @returns {Promise<Object|null>} Draft data or null if not found
   */
  async getDraft(draftId) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return null;
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return null;
      }

      const username = currentUser.username;
      const { doc, getDoc } = this.firestoreFunctions;
      
      const docRef = doc(this.db, this.COLLECTIONS.DRAFTS, `${username}_${draftId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      return null;
    } catch (error) {
      console.error('[FirebaseService] Failed to get draft:', error);
      return null;
    }
  }

  /**
   * Get all drafts for the current user
   * @returns {Promise<Array>} Array of draft objects
   */
  async getAllUserDrafts() {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return [];
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return [];
      }

      const username = currentUser.username;
      const { collection, query, where, orderBy, getDocs } = this.firestoreFunctions;
      
      const q = query(
        collection(this.db, this.COLLECTIONS.DRAFTS),
        where('username', '==', username),
        orderBy('lastModified', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const drafts = [];
      
      querySnapshot.forEach((doc) => {
        drafts.push(doc.data());
      });

      console.log(`[FirebaseService] Retrieved ${drafts.length} drafts for user ${username}`);
      return drafts;
    } catch (error) {
      console.error('[FirebaseService] Failed to get user drafts:', error);
      return [];
    }
  }

  /**
   * Delete a draft by ID
   * @param {string} draftId - Draft ID to delete
   * @returns {Promise<boolean>} true if deletion was successful
   */
  async deleteDraft(draftId) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return false;
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return false;
      }

      const username = currentUser.username;
      const { doc, deleteDoc } = this.firestoreFunctions;
      
      const docRef = doc(this.db, this.COLLECTIONS.DRAFTS, `${username}_${draftId}`);
      await deleteDoc(docRef);

      console.log('[FirebaseService] Draft deleted successfully:', draftId);
      return true;
    } catch (error) {
      console.error('[FirebaseService] Failed to delete draft:', error);
      return false;
    }
  }

  /**
   * Save a scheduled post to Firestore
   * @param {Object} postData - Scheduled post data
   * @returns {Promise<Object>} Result object with success status
   */
  async saveScheduledPost(postData) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      throw new Error('Firebase is not enabled. Check configuration.');
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const username = currentUser.username;
      const { collection, doc, setDoc } = this.firestoreFunctions;
      
      const postId = `${username}_${Date.now()}`;
      const scheduledPostDoc = {
        ...postData,
        id: postId,
        username: username,
        createdAt: new Date().toISOString(),
        status: 'scheduled'
      };

      const docRef = doc(this.db, this.COLLECTIONS.SCHEDULED_POSTS, postId);
      await setDoc(docRef, scheduledPostDoc);

      console.log('[FirebaseService] Scheduled post saved successfully:', postId);
      return { success: true, postId };
    } catch (error) {
      console.error('[FirebaseService] Failed to save scheduled post:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled posts for the current user
   * @returns {Promise<Array>} Array of scheduled post objects
   */
  async getScheduledPosts() {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return [];
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return [];
      }

      const username = currentUser.username;
      const { collection, query, where, orderBy, getDocs } = this.firestoreFunctions;
      
      const q = query(
        collection(this.db, this.COLLECTIONS.SCHEDULED_POSTS),
        where('username', '==', username),
        orderBy('scheduledDateTime', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const posts = [];
      
      querySnapshot.forEach((doc) => {
        posts.push(doc.data());
      });

      console.log(`[FirebaseService] Retrieved ${posts.length} scheduled posts for user ${username}`);
      return posts;
    } catch (error) {
      console.error('[FirebaseService] Failed to get scheduled posts:', error);
      return [];
    }
  }

  /**
   * Delete a scheduled post by ID
   * @param {string} postId - Post ID to delete
   * @returns {Promise<boolean>} true if deletion was successful
   */
  async deleteScheduledPost(postId) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return false;
    }

    try {
      const { doc, deleteDoc } = this.firestoreFunctions;
      
      const docRef = doc(this.db, this.COLLECTIONS.SCHEDULED_POSTS, postId);
      await deleteDoc(docRef);

      console.log('[FirebaseService] Scheduled post deleted successfully:', postId);
      return true;
    } catch (error) {
      console.error('[FirebaseService] Failed to delete scheduled post:', error);
      return false;
    }
  }

  /**
   * Clean up expired drafts
   * @param {number} expiryDays - Number of days after which drafts are considered expired
   * @returns {Promise<number>} Number of drafts deleted
   */
  async cleanupExpiredDrafts(expiryDays = 30) {
    const isEnabled = await this.ensureInitialized();
    if (!isEnabled) {
      return 0;
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return 0;
      }

      const username = currentUser.username;
      const expiryTime = Date.now() - (expiryDays * 24 * 60 * 60 * 1000);
      
      const drafts = await this.getAllUserDrafts();
      let deletedCount = 0;

      for (const draft of drafts) {
        if (draft.lastModified < expiryTime) {
          const deleted = await this.deleteDraft(draft.id);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      console.log(`[FirebaseService] Cleaned up ${deletedCount} expired drafts`);
      return deletedCount;
    } catch (error) {
      console.error('[FirebaseService] Failed to cleanup expired drafts:', error);
      return 0;
    }
  }
}

// Export singleton instance
const firebaseService = new FirebaseService();
export default firebaseService;
