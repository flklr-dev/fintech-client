import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBltMT9l6D8USfOdho2C25BWmHZCvawvdI",
  authDomain: "auth-4aa50.firebaseapp.com",
  projectId: "auth-4aa50",
  storageBucket: "auth-4aa50.firebasestorage.app",
  messagingSenderId: "615048959288",
  appId: "1:615048959288:android:e1a9502919543f02c5ddcd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Set persistence to memory (recommended for React Native)
setPersistence(auth, inMemoryPersistence)
  .then(() => {
    // We'll handle token persistence manually using AsyncStorage
    auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, save the user token
        user.getIdToken().then((token) => {
          AsyncStorage.setItem('auth_token', token);
        });
      } else {
        // User is signed out, remove the token
        AsyncStorage.removeItem('auth_token');
      }
    });
  })
  .catch((error) => {
    console.error('Error setting persistence:', error);
  });

export { auth }; 