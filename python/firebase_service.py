"""
Firebase Service for Python Backend
Provides optional Firebase Firestore integration for the Flask backend.

This service allows the Python backend to:
- Sync data with Firebase Firestore
- Read data from Firestore
- Provide backup/migration capabilities

Requirements:
    pip install firebase-admin

Setup:
    1. Download service account key from Firebase Console
    2. Place the JSON file in the project (but keep it out of git)
    3. Set the path in FIREBASE_CREDENTIALS_PATH

Usage:
    from python.firebase_service import firebase_service
    
    if firebase_service.is_initialized():
        firebase_service.save_scheduled_post(post_data)
"""

import os
import json
from datetime import datetime

# Firebase Admin SDK (optional dependency)
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("[FirebaseService] firebase-admin not installed. Firebase features disabled.")
    print("[FirebaseService] To enable: pip install firebase-admin")


class FirebaseService:
    """
    Firebase Firestore service for Python backend
    """
    
    def __init__(self):
        self.app = None
        self.db = None
        self.is_initialized = False
        
        # Collections
        self.COLLECTIONS = {
            'DRAFTS': 'drafts',
            'SCHEDULED_POSTS': 'scheduled_posts',
            'USER_PREFERENCES': 'user_preferences'
        }
    
    def initialize(self, credentials_path=None):
        """
        Initialize Firebase Admin SDK
        
        Args:
            credentials_path: Path to Firebase service account credentials JSON
                            If not provided, looks for environment variable
        
        Returns:
            bool: True if initialization was successful
        """
        if not FIREBASE_AVAILABLE:
            print("[FirebaseService] Firebase Admin SDK not available")
            return False
        
        if self.is_initialized:
            return True
        
        try:
            # Get credentials path
            if credentials_path is None:
                credentials_path = os.getenv(
                    'FIREBASE_CREDENTIALS_PATH',
                    'config/firebase-credentials.json'
                )
            
            # Check if credentials file exists
            if not os.path.exists(credentials_path):
                print(f"[FirebaseService] Credentials not found at: {credentials_path}")
                print("[FirebaseService] Firebase features will be disabled")
                return False
            
            # Initialize Firebase
            cred = credentials.Certificate(credentials_path)
            
            # Check if already initialized
            try:
                firebase_admin.get_app()
                print("[FirebaseService] Firebase already initialized")
                self.is_initialized = True
            except ValueError:
                # Not initialized yet, initialize now
                self.app = firebase_admin.initialize_app(cred)
                print("[FirebaseService] Firebase initialized successfully")
                self.is_initialized = True
            
            # Get Firestore client
            self.db = firestore.client()
            
            return True
            
        except Exception as e:
            print(f"[FirebaseService] Failed to initialize Firebase: {e}")
            return False
    
    def ensure_initialized(self):
        """Ensure Firebase is initialized"""
        if not self.is_initialized:
            self.initialize()
        return self.is_initialized
    
    def save_scheduled_post(self, post_data):
        """
        Save a scheduled post to Firestore
        
        Args:
            post_data: Dictionary containing post data
        
        Returns:
            str: Document ID if successful, None otherwise
        """
        if not self.ensure_initialized():
            return None
        
        try:
            username = post_data.get('username')
            post_id = f"{username}_{int(datetime.now().timestamp() * 1000)}"
            
            # Prepare document data
            doc_data = {
                'id': post_id,
                'username': username,
                'title': post_data.get('title'),
                'body': post_data.get('body'),
                'tags': post_data.get('tags', []),
                'community': post_data.get('community'),
                'permlink': post_data.get('permlink'),
                'scheduled_datetime': post_data.get('scheduled_datetime'),
                'created_at': firestore.SERVER_TIMESTAMP,
                'status': 'scheduled'
            }
            
            # Save to Firestore
            doc_ref = self.db.collection(self.COLLECTIONS['SCHEDULED_POSTS']).document(post_id)
            doc_ref.set(doc_data)
            
            print(f"[FirebaseService] Scheduled post saved to Firestore: {post_id}")
            return post_id
            
        except Exception as e:
            print(f"[FirebaseService] Failed to save scheduled post: {e}")
            return None
    
    def get_scheduled_posts(self, username):
        """
        Get all scheduled posts for a user from Firestore
        
        Args:
            username: Username to fetch posts for
        
        Returns:
            list: List of scheduled post documents
        """
        if not self.ensure_initialized():
            return []
        
        try:
            posts_ref = self.db.collection(self.COLLECTIONS['SCHEDULED_POSTS'])
            query = posts_ref.where('username', '==', username).order_by('scheduled_datetime')
            
            posts = []
            for doc in query.stream():
                post_data = doc.to_dict()
                post_data['id'] = doc.id
                posts.append(post_data)
            
            print(f"[FirebaseService] Retrieved {len(posts)} scheduled posts for {username}")
            return posts
            
        except Exception as e:
            print(f"[FirebaseService] Failed to get scheduled posts: {e}")
            return []
    
    def delete_scheduled_post(self, post_id):
        """
        Delete a scheduled post from Firestore
        
        Args:
            post_id: ID of the post to delete
        
        Returns:
            bool: True if successful
        """
        if not self.ensure_initialized():
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTIONS['SCHEDULED_POSTS']).document(post_id)
            doc_ref.delete()
            
            print(f"[FirebaseService] Scheduled post deleted from Firestore: {post_id}")
            return True
            
        except Exception as e:
            print(f"[FirebaseService] Failed to delete scheduled post: {e}")
            return False
    
    def update_scheduled_post(self, post_id, updates):
        """
        Update a scheduled post in Firestore
        
        Args:
            post_id: ID of the post to update
            updates: Dictionary of fields to update
        
        Returns:
            bool: True if successful
        """
        if not self.ensure_initialized():
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTIONS['SCHEDULED_POSTS']).document(post_id)
            doc_ref.update(updates)
            
            print(f"[FirebaseService] Scheduled post updated in Firestore: {post_id}")
            return True
            
        except Exception as e:
            print(f"[FirebaseService] Failed to update scheduled post: {e}")
            return False
    
    def save_draft(self, draft_data, username):
        """
        Save a draft to Firestore
        
        Args:
            draft_data: Dictionary containing draft data
            username: Username of the draft owner
        
        Returns:
            str: Document ID if successful, None otherwise
        """
        if not self.ensure_initialized():
            return None
        
        try:
            draft_id = draft_data.get('id') or f"{username}_{int(datetime.now().timestamp() * 1000)}"
            
            # Prepare document data
            doc_data = {
                'id': draft_id,
                'username': username,
                'title': draft_data.get('title'),
                'body': draft_data.get('body'),
                'tags': draft_data.get('tags', []),
                'community': draft_data.get('community'),
                'timestamp': firestore.SERVER_TIMESTAMP,
                'lastModified': int(datetime.now().timestamp() * 1000),
                'version': '2.0'
            }
            
            # Save to Firestore
            doc_ref = self.db.collection(self.COLLECTIONS['DRAFTS']).document(f"{username}_{draft_id}")
            doc_ref.set(doc_data)
            
            print(f"[FirebaseService] Draft saved to Firestore: {draft_id}")
            return draft_id
            
        except Exception as e:
            print(f"[FirebaseService] Failed to save draft: {e}")
            return None
    
    def get_user_drafts(self, username):
        """
        Get all drafts for a user from Firestore
        
        Args:
            username: Username to fetch drafts for
        
        Returns:
            list: List of draft documents
        """
        if not self.ensure_initialized():
            return []
        
        try:
            drafts_ref = self.db.collection(self.COLLECTIONS['DRAFTS'])
            query = drafts_ref.where('username', '==', username).order_by('lastModified', direction=firestore.Query.DESCENDING)
            
            drafts = []
            for doc in query.stream():
                draft_data = doc.to_dict()
                draft_data['id'] = doc.id
                drafts.append(draft_data)
            
            print(f"[FirebaseService] Retrieved {len(drafts)} drafts for {username}")
            return drafts
            
        except Exception as e:
            print(f"[FirebaseService] Failed to get drafts: {e}")
            return []


# Singleton instance
firebase_service = FirebaseService()

# Auto-initialize if credentials are available
firebase_service.initialize()
