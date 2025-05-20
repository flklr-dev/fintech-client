import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { theme } from '../theme';

interface GoogleSignInButtonProps {
  onPress: () => void;
  isLoading?: boolean;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onPress, isLoading = false }) => {
  // Handle press with signOut first to force account selection
  const handlePress = async () => {
    try {
      // Sign out from Google first to force account selection on next sign-in
      await GoogleSignin.signOut().catch(err => {
        // Ignore sign out errors, as we might not be signed in yet
        console.log('Pre-sign in sign out error (can be ignored):', err);
      });
      
      // Call the provided onPress handler
      onPress();
    } catch (error) {
      console.error('Error preparing for Google Sign-In:', error);
      // Still call onPress to allow error handling in parent component
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.white} />
      ) : (
        <Text style={styles.buttonText}>Sign in with Google</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GoogleSignInButton; 