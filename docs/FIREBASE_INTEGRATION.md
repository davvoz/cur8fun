# Firebase Integration Guide

## Overview

This application now supports Firebase Firestore for data storage. Firebase provides real-time synchronization, cloud backup, and better scalability compared to localStorage.

## Features

- **Draft Storage**: Drafts are automatically saved to Firebase Firestore
- **Scheduled Posts**: Scheduled posts can be stored in Firebase
- **Real-time Sync**: Data is synchronized across devices
- **Fallback Support**: If Firebase is not configured, the app falls back to localStorage
- **Hybrid Approach**: Data is saved to both Firebase and localStorage for redundancy

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project
4. Enable Google Analytics if desired (optional)

### 2. Create a Firestore Database

1. In your Firebase project, navigate to "Build" > "Firestore Database"
2. Click "Create database"
3. Choose a location for your database (preferably close to your users)
4. Start in **production mode** for security
5. Configure security rules (see below)

### 3. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

### 4. Configure the Application

Update the file `/config/firebase-config.js` with your Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

export default firebaseConfig;
```

**Security Note:** For production deployments, consider:
- Using environment variables
- Creating a separate config file (e.g., `firebase-config.local.js`) that is git-ignored
- Using Firebase Hosting for automatic environment configuration

### 5. Configure Firestore Security Rules

In Firebase Console, go to Firestore Database > Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Drafts collection - users can only access their own drafts
    match /drafts/{draftId} {
      allow read, write: if request.auth != null && 
                         resource.data.username == request.auth.token.username;
      allow create: if request.auth != null;
    }
    
    // Scheduled posts collection - users can only access their own scheduled posts
    match /scheduled_posts/{postId} {
      allow read, write: if request.auth != null && 
                         resource.data.username == request.auth.token.username;
      allow create: if request.auth != null;
    }
    
    // User preferences collection
    match /user_preferences/{userId} {
      allow read, write: if request.auth != null && 
                         request.auth.uid == userId;
    }
  }
}
```

**Note:** These rules assume you'll implement Firebase Authentication. If you're using a different authentication method, adjust the rules accordingly or use more permissive rules during development (not recommended for production).

## Architecture

### Data Storage Strategy

The application uses a **hybrid approach**:

1. **Primary Storage**: Firebase Firestore (when configured)
2. **Fallback Storage**: localStorage (always available)
3. **Redundancy**: Data is saved to both locations when Firebase is available

This approach ensures:
- Data persistence even if Firebase is unavailable
- Offline capability through localStorage
- Cloud backup and sync when Firebase is available

### Firestore Collections

#### `drafts` Collection

Structure:
```javascript
{
  id: "unique_id",
  username: "username",
  title: "Post Title",
  body: "Post content in markdown",
  tags: ["tag1", "tag2"],
  community: "hive-123456",
  timestamp: "2025-01-15T10:00:00.000Z",
  lastModified: 1705316400000,
  version: "2.0"
}
```

Document ID format: `{username}_{draftId}`

#### `scheduled_posts` Collection

Structure:
```javascript
{
  id: "unique_id",
  username: "username",
  title: "Post Title",
  body: "Post content",
  tags: ["tag1", "tag2"],
  community: "hive-123456",
  scheduledDateTime: "2025-01-20T15:30:00.000Z",
  createdAt: "2025-01-15T10:00:00.000Z",
  status: "scheduled" // scheduled, published, failed
}
```

Document ID format: `{username}_{timestamp}`

## Service Architecture

### FirebaseService.js

The `FirebaseService` class provides:

- **initialization**: Lazy loading of Firebase SDK
- **saveDraft(draftData, draftId)**: Save draft to Firestore
- **getDraft(draftId)**: Retrieve draft from Firestore
- **getAllUserDrafts()**: Get all drafts for current user
- **deleteDraft(draftId)**: Delete a specific draft
- **saveScheduledPost(postData)**: Save scheduled post
- **getScheduledPosts()**: Get all scheduled posts
- **deleteScheduledPost(postId)**: Delete scheduled post
- **cleanupExpiredDrafts(expiryDays)**: Remove old drafts

### CreatePostService.js Integration

The `CreatePostService` now:

1. Initializes Firebase on construction
2. Attempts to use Firebase for all draft operations
3. Falls back to localStorage if Firebase is unavailable
4. Saves to both Firebase and localStorage for redundancy

## Usage Examples

### Saving a Draft

```javascript
import createPostService from './services/CreatePostService.js';

const draftData = {
  title: "My Post",
  body: "Post content",
  tags: ["blockchain", "steem"],
  community: "hive-123456"
};

const result = await createPostService.saveDraftWithId(draftData);
if (result.success) {
  console.log('Draft saved:', result.draftId);
  console.log('Saved to Firebase:', result.savedToFirebase);
}
```

### Loading a Draft

```javascript
const draft = await createPostService.getDraftById(draftId);
if (draft) {
  console.log('Draft loaded:', draft.title);
}
```

### Deleting a Draft

```javascript
const deleted = await createPostService.deleteDraftById(draftId);
console.log('Draft deleted:', deleted);
```

## Testing

### Without Firebase Configuration

If you don't configure Firebase (leave the placeholder values), the application will:
1. Log a warning on initialization
2. Use localStorage as the only storage mechanism
3. Continue to function normally

### With Firebase Configuration

1. Configure your Firebase project
2. Open the browser console
3. Look for initialization messages:
   - `[FirebaseService] Initializing Firebase...`
   - `[FirebaseService] Firebase initialized successfully`
4. Perform draft operations and check the console for confirmation:
   - `[CreatePostService] Draft saved to Firebase: {draftId}`
   - `[CreatePostService] Draft loaded from Firebase: {draftId}`

### Verification

1. **Firestore Console**: Check the Firebase Console > Firestore Database to see stored documents
2. **Browser DevTools**: Check Application > Local Storage to see the localStorage backup
3. **Network Tab**: Monitor Firebase API calls

## Troubleshooting

### Firebase Not Initializing

**Symptoms**: Console shows "Firebase configuration not set"

**Solutions**:
- Verify `firebase-config.js` has correct values
- Check that API key is valid
- Ensure Firestore is enabled in Firebase Console

### Permission Denied Errors

**Symptoms**: Console shows Firebase permission errors

**Solutions**:
- Review Firestore security rules
- Ensure users are authenticated (if using Firebase Auth)
- Check that rules match your authentication method

### Data Not Syncing

**Symptoms**: Data saved to localStorage but not Firebase

**Solutions**:
- Check browser console for errors
- Verify internet connection
- Check Firebase project quota limits
- Review Firestore security rules

## Migration from localStorage Only

If you're upgrading from a version that only used localStorage:

1. Configure Firebase as described above
2. User drafts will continue to work from localStorage
3. New drafts will be saved to both Firebase and localStorage
4. Optionally, implement a migration script to move existing localStorage drafts to Firebase

## Production Considerations

### Security

- **Never commit Firebase credentials** to version control
- Use environment-specific configurations
- Implement proper Firestore security rules
- Consider using Firebase Authentication

### Performance

- Firebase SDK is loaded asynchronously to avoid blocking
- localStorage is used as a fast cache
- Consider implementing pagination for large draft lists

### Costs

- Firebase has a free tier (Spark plan)
- Monitor usage in Firebase Console
- Implement draft limits per user
- Set up billing alerts

### Monitoring

- Enable Firebase Analytics
- Monitor Firestore usage and costs
- Set up error tracking
- Review security rule violations

## Future Enhancements

Potential improvements:

1. **Real-time Sync**: Listen to Firestore changes for multi-device sync
2. **Conflict Resolution**: Handle concurrent edits
3. **Offline Support**: Enhanced offline capabilities with Firebase offline persistence
4. **Firebase Authentication**: Integrate Firebase Auth for better security
5. **Cloud Functions**: Server-side processing for scheduled posts
6. **File Storage**: Use Firebase Storage for images and media
7. **Analytics**: Track user engagement with Firebase Analytics

## Support

For issues or questions:
- Check the [Firebase Documentation](https://firebase.google.com/docs)
- Review the browser console for error messages
- Check Firestore security rules
- Verify Firebase project configuration

## References

- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase JavaScript SDK](https://firebase.google.com/docs/web/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
