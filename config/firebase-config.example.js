/**
 * Firebase Configuration Example
 * 
 * This is an example configuration file for Firebase.
 * Copy this file to firebase-config.js and replace with your actual Firebase credentials.
 * 
 * Steps to get your Firebase configuration:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select your project (or create a new one)
 * 3. Click on the gear icon (Project Settings)
 * 4. Scroll down to "Your apps" section
 * 5. Click on the web icon (</>) to add a web app (if not already done)
 * 6. Copy the firebaseConfig object and paste it below
 * 
 * SECURITY WARNING:
 * - Never commit the actual firebase-config.js with real credentials to version control
 * - Use environment variables for production deployments
 * - Configure proper Firestore security rules
 */

const firebaseConfig = {
  // Your Firebase API key
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  
  // Your Firebase auth domain
  authDomain: "your-project-id.firebaseapp.com",
  
  // Your Firebase project ID
  projectId: "your-project-id",
  
  // Your Firebase storage bucket
  storageBucket: "your-project-id.appspot.com",
  
  // Your Firebase messaging sender ID
  messagingSenderId: "123456789012",
  
  // Your Firebase app ID
  appId: "1:123456789012:web:abcdef1234567890abcdef",
  
  // Optional: Your Firebase measurement ID (for Analytics)
  measurementId: "G-XXXXXXXXXX"
};

export default firebaseConfig;
