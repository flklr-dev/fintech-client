import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { authService } from './apiService';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '615048959288-411ri03eldq6hg0fu7k705f5jr5c0ceu.apps.googleusercontent.com', // Web client ID from Firebase Console
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

export const signInWithGoogle = async () => {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Sign out first to ensure the account chooser is displayed
    try {
      await GoogleSignin.signOut();
    } catch (signOutError) {
      console.log('Pre-signIn signOut error (can be ignored):', signOutError);
    }
    
    // Get the users ID token with account selection prompt
    const userInfo = await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();
    
    if (!idToken) {
      throw new Error('Failed to get ID token from Google');
    }
    
    // Create a Google credential with the token
    const googleCredential = GoogleAuthProvider.credential(idToken);
    
    // Sign-in the user with the credential
    const userCredential = await signInWithCredential(auth, googleCredential);
    
    // Get the Firebase ID token
    const firebaseToken = await userCredential.user.getIdToken();
    
    if (!firebaseToken) {
      throw new Error('Failed to get Firebase token');
    }
    
    // Send the token to our backend for verification
    const success = await authService.loginWithGoogle(firebaseToken);
    
    if (!success) {
      throw new Error('Failed to verify token with backend');
    }
    
    return userCredential.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    await auth.signOut();
    await authService.clearToken();
  } catch (error) {
    console.error('Sign Out Error:', error);
    throw error;
  }
}; 