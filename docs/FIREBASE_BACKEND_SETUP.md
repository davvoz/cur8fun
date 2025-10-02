# Firebase Backend Setup Guide (Python)

This guide explains how to set up Firebase Admin SDK for the Python Flask backend.

## Overview

The Python backend can optionally use Firebase Admin SDK to:
- Sync scheduled posts with Firestore
- Provide server-side data management
- Enable admin operations
- Create backups and migrations

## Prerequisites

- Python 3.7 or higher
- Firebase project created (see FIREBASE_INTEGRATION.md)
- Flask application running

## Installation

### 1. Install Firebase Admin SDK

```bash
pip install firebase-admin
```

Or add to your `requirements.txt` (already done):

```
firebase-admin>=6.0.0
```

Then install:

```bash
pip install -r requirements.txt
```

### 2. Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon (⚙️) > Project Settings
4. Go to the "Service accounts" tab
5. Click "Generate new private key"
6. Save the JSON file securely
7. **IMPORTANT**: Never commit this file to version control!

### 3. Configure the Service Account Key

**Option A: Place the file in the config directory** (recommended)

```bash
# Place the file in the config directory
mv ~/Downloads/your-project-firebase-adminsdk-xxxxx.json config/firebase-credentials.json
```

**Option B: Use environment variable**

```bash
# Set environment variable
export FIREBASE_CREDENTIALS_PATH=/path/to/your/firebase-credentials.json
```

**Option C: Pass path when initializing**

```python
from python.firebase_service import firebase_service
firebase_service.initialize('/path/to/credentials.json')
```

### 4. Update .gitignore

Make sure your credentials are not committed:

```gitignore
# Already in .gitignore
config/firebase-credentials.json
```

## Usage in Python Backend

### Initialize Firebase Service

```python
from python.firebase_service import firebase_service

# Service auto-initializes on import
# Check if initialized
if firebase_service.is_initialized:
    print("Firebase is ready!")
else:
    print("Firebase not configured")
```

### Save Scheduled Post

```python
post_data = {
    'username': 'john_doe',
    'title': 'My Post',
    'body': 'Post content',
    'tags': ['tag1', 'tag2'],
    'community': 'hive-123456',
    'scheduled_datetime': datetime.now().isoformat()
}

post_id = firebase_service.save_scheduled_post(post_data)
if post_id:
    print(f"Saved to Firebase: {post_id}")
```

### Get User's Scheduled Posts

```python
posts = firebase_service.get_scheduled_posts('john_doe')
for post in posts:
    print(f"Post: {post['title']}")
```

### Update Scheduled Post

```python
updates = {
    'title': 'Updated Title',
    'status': 'published'
}
firebase_service.update_scheduled_post(post_id, updates)
```

### Delete Scheduled Post

```python
firebase_service.delete_scheduled_post(post_id)
```

### Save Draft

```python
draft_data = {
    'id': 'draft_123',
    'title': 'Draft Title',
    'body': 'Draft content',
    'tags': ['draft'],
}

draft_id = firebase_service.save_draft(draft_data, 'john_doe')
```

### Get User's Drafts

```python
drafts = firebase_service.get_user_drafts('john_doe')
for draft in drafts:
    print(f"Draft: {draft['title']}")
```

## Integration with Flask App

### Example: Sync SQLite to Firebase

Add this to your Flask app to sync data:

```python
from python.firebase_service import firebase_service
from python.models import ScheduledPost

@app.route('/api/sync/firebase', methods=['POST'])
def sync_to_firebase():
    """Sync all scheduled posts to Firebase"""
    if not firebase_service.is_initialized:
        return jsonify({"error": "Firebase not initialized"}), 503
    
    posts = ScheduledPost.query.all()
    synced = 0
    
    for post in posts:
        post_data = {
            'username': post.username,
            'title': post.title,
            'body': post.body,
            'tags': post.tags.split(',') if post.tags else [],
            'community': post.community,
            'permlink': post.permlink,
            'scheduled_datetime': post.scheduled_datetime.isoformat(),
            'status': post.status
        }
        
        if firebase_service.save_scheduled_post(post_data):
            synced += 1
    
    return jsonify({
        "success": True,
        "synced": synced,
        "total": len(posts)
    })
```

### Example: Dual Storage

Save to both SQLite and Firebase:

```python
@app.route('/api/scheduled_posts', methods=['POST'])
def create_scheduled_post():
    try:
        data = request.json
        
        # Save to SQLite (existing code)
        post = ScheduledPost(
            username=data['username'],
            title=data['title'],
            body=data['body'],
            tags=','.join(data.get('tags', [])),
            community=data.get('community'),
            permlink=data.get('permlink'),
            scheduled_datetime=datetime.fromisoformat(data['scheduled_datetime'])
        )
        db.session.add(post)
        db.session.commit()
        
        # Also save to Firebase if available
        if firebase_service.is_initialized:
            firebase_service.save_scheduled_post(data)
        
        return jsonify(post.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
```

## Firestore Security Rules

For the Python backend with Admin SDK, you still need proper security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admin SDK full access (server-side)
    // Client-side rules still apply for web SDK
    
    match /scheduled_posts/{postId} {
      // Server can write anything
      allow write: if request.auth != null;
      
      // Users can only read their own
      allow read: if request.auth != null && 
                     resource.data.username == request.auth.token.username;
    }
    
    match /drafts/{draftId} {
      allow write: if request.auth != null;
      allow read: if request.auth != null && 
                     resource.data.username == request.auth.token.username;
    }
  }
}
```

## Testing

### Test Firebase Connection

```python
from python.firebase_service import firebase_service

# Check if initialized
print(f"Initialized: {firebase_service.is_initialized}")

# Test operations
if firebase_service.is_initialized:
    # Test save
    test_post = {
        'username': 'test_user',
        'title': 'Test Post',
        'body': 'Test content',
        'tags': ['test'],
        'scheduled_datetime': datetime.now().isoformat()
    }
    
    post_id = firebase_service.save_scheduled_post(test_post)
    print(f"Saved post: {post_id}")
    
    # Test retrieve
    posts = firebase_service.get_scheduled_posts('test_user')
    print(f"Found {len(posts)} posts")
    
    # Test delete
    if post_id:
        firebase_service.delete_scheduled_post(post_id)
        print("Deleted test post")
```

## Troubleshooting

### "Firebase not initialized"

**Cause**: Credentials file not found or invalid

**Solutions**:
1. Check credentials file path
2. Verify file exists and is readable
3. Ensure JSON is valid
4. Check file permissions

### "Permission denied" errors

**Cause**: Service account doesn't have proper permissions

**Solutions**:
1. Verify service account has "Cloud Datastore User" role
2. Check Firebase project settings
3. Regenerate service account key

### Import errors

**Cause**: firebase-admin not installed

**Solution**:
```bash
pip install firebase-admin
```

## Best Practices

### Security

1. **Never commit credentials**: Use .gitignore
2. **Rotate keys regularly**: Generate new service account keys periodically
3. **Limit permissions**: Give service account only required roles
4. **Use environment variables**: For production deployments

### Performance

1. **Batch operations**: Use batched writes when possible
2. **Limit queries**: Use pagination for large datasets
3. **Cache results**: Cache frequently accessed data
4. **Index fields**: Create indexes for common queries

### Data Management

1. **Backup regularly**: Export Firestore data periodically
2. **Monitor costs**: Set up billing alerts
3. **Clean up old data**: Remove expired posts and drafts
4. **Validate data**: Validate before saving to Firestore

## Migration from SQLite

To migrate existing data from SQLite to Firebase:

```python
from python.firebase_service import firebase_service
from python.models import ScheduledPost

def migrate_to_firebase():
    """Migrate all SQLite data to Firebase"""
    if not firebase_service.is_initialized:
        print("Firebase not initialized")
        return
    
    posts = ScheduledPost.query.all()
    print(f"Migrating {len(posts)} posts...")
    
    for post in posts:
        post_data = {
            'username': post.username,
            'title': post.title,
            'body': post.body,
            'tags': post.tags.split(',') if post.tags else [],
            'community': post.community,
            'permlink': post.permlink,
            'scheduled_datetime': post.scheduled_datetime.isoformat(),
            'status': post.status
        }
        
        post_id = firebase_service.save_scheduled_post(post_data)
        if post_id:
            print(f"Migrated: {post.title}")
        else:
            print(f"Failed: {post.title}")
    
    print("Migration complete!")

# Run migration
if __name__ == '__main__':
    migrate_to_firebase()
```

## Monitoring

### Check Firebase Usage

1. Go to Firebase Console
2. Navigate to "Usage and billing"
3. Monitor:
   - Document reads
   - Document writes
   - Storage usage
   - Network egress

### Set Up Alerts

1. Configure billing alerts in Google Cloud Console
2. Set spending limits
3. Monitor daily usage
4. Review monthly reports

## References

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firestore Python Client](https://firebase.google.com/docs/firestore/quickstart)
- [Service Account Keys](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)
- [Firestore Pricing](https://firebase.google.com/pricing)
