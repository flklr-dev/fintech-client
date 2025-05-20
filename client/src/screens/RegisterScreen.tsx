import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { observer } from 'mobx-react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Google from 'expo-auth-session/providers/google';
import { runInAction } from 'mobx';
import { theme } from '../theme';
import { authViewModel } from '../viewmodels/authViewModel';
import InputField from '../components/InputField';
import GoogleButton from '../components/GoogleButton';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import MessageDialog from '../components/MessageDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithGoogle } from '../services/googleSignIn';
import { auth } from '../config/firebase';
import useScreenSecurity from '../hooks/useScreenSecurity';

// Define the navigation prop type
type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Budgets: undefined;
  Transactions: undefined;
  Goals: undefined;
  Reports: undefined;
  OTPVerification: { userId: string; email: string };
};

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

const RegisterScreen = observer(() => {
  // Use the screen security hook to prevent screenshots
  useScreenSecurity(true);
  
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Form validation tracking
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // UI states
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogProps, setDialogProps] = useState({
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: '',
    onAction: () => {},
  });

  // Google Sign-In
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    clientId: 'YOUR_WEB_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
  });

  // Handle Google Sign-In response
  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.authentication) {
      // Handle Google sign in success
      handleGoogleLogin(googleResponse.authentication.accessToken);
    }
  }, [googleResponse]);

  // Reset form errors on component load
  useEffect(() => {
    // Clear any existing authentication state that might be lingering
    const cleanupAuth = async () => {
      try {
        // Reset auth state using MobX-safe method
        authViewModel.resetForRegistration();
        
        // If we're not logged in, ensure all auth tokens are cleared
        if (!authViewModel.isLoggedIn) {
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('token_expiry');
          await AsyncStorage.removeItem('user_data');
          await AsyncStorage.removeItem('has_completed_onboarding');
          await AsyncStorage.removeItem('just_registered');
        }
      } catch (error) {
        console.error('Error cleaning up auth state:', error);
      }
    };
    
    cleanupAuth();
  }, []);

  // Add useEffect for session check
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Check if user is already logged in
  const checkExistingSession = async () => {
    // If the user is already logged in, navigate directly to Home
    if (authViewModel.isLoggedIn) {
      navigation.navigate('Home');
    }
  };

  // Handle input changes with validation
  const handleNameChange = (text: string) => {
    setName(text);
    if (touched.name) {
      authViewModel.validateName(text);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (touched.email) {
      authViewModel.validateEmail(text);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (touched.password) {
      authViewModel.validatePassword(text);
    }
    if (touched.confirmPassword && confirmPassword) {
      authViewModel.validateConfirmPassword(text, confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (touched.confirmPassword) {
      authViewModel.validateConfirmPassword(password, text);
    }
  };

  // Mark fields as touched on blur
  const handleNameBlur = () => {
    setTouched({ ...touched, name: true });
    if (name.trim() === '') {
      runInAction(() => {
        authViewModel.nameError = 'This field is required';
      });
    } else {
      authViewModel.validateName(name);
    }
  };

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true });
    if (email.trim() === '') {
      runInAction(() => {
        authViewModel.emailError = 'This field is required';
      });
    } else {
      authViewModel.validateEmail(email);
    }
  };

  const handlePasswordBlur = () => {
    setTouched({ ...touched, password: true });
    if (password === '') {
      runInAction(() => {
        authViewModel.passwordError = 'This field is required';
        authViewModel.passwordStrength = 'weak';
      });
    } else {
      authViewModel.validatePassword(password);
    }
    setIsPasswordFocused(false);
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
  };

  const handleConfirmPasswordBlur = () => {
    setTouched({ ...touched, confirmPassword: true });
    if (confirmPassword === '') {
      runInAction(() => {
        authViewModel.confirmPasswordError = 'This field is required';
      });
    } else {
      authViewModel.validateConfirmPassword(password, confirmPassword);
    }
  };

  // Handle registration button press
  const handleRegister = async () => {
    // Mark all fields as touched
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    
    // Check for empty fields first
    let hasError = false;
    
    if (name.trim() === '') {
      runInAction(() => {
        authViewModel.nameError = 'This field is required';
      });
      hasError = true;
    }
    
    if (email.trim() === '') {
      runInAction(() => {
        authViewModel.emailError = 'This field is required';
      });
      hasError = true;
    }
    
    if (password === '') {
      runInAction(() => {
        authViewModel.passwordError = 'This field is required';
        authViewModel.passwordStrength = 'weak';
      });
      hasError = true;
    }
    
    if (confirmPassword === '') {
      runInAction(() => {
        authViewModel.confirmPasswordError = 'This field is required';
      });
      hasError = true;
    }
    
    // If there are empty fields, don't proceed
    if (hasError) {
      return;
    }
    
    // Validate all fields
    const isNameValid = authViewModel.validateName(name);
    const isEmailValid = authViewModel.validateEmail(email);
    const isPasswordValid = authViewModel.validatePassword(password);
    const isConfirmPasswordValid = authViewModel.validateConfirmPassword(
      password,
      confirmPassword
    );
    
    // Check for validation errors
    if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }
    
    setIsLoading(true);
    
    try {
    // Attempt registration
      const result = await authViewModel.register(
      { name, email, password },
      confirmPassword
    );
    
      if (result) {
        // Navigate to OTP verification screen
        navigation.navigate('OTPVerification', {
          userId: result.userId,
          email: result.email
        });
      } else {
        // This should not happen with the new flow, but handle it just in case
      showDialog({
        type: 'success',
        title: 'Registration Successful',
        message: 'Your account has been created successfully.',
          onAction: () => navigation.navigate('Login')
      });
      }
    } catch (error: any) {
      showDialog({
        type: 'error',
        title: 'Registration Failed',
        message: error.message || 'Failed to register. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async (token: string) => {
    const success = await authViewModel.signInWithGoogle(token);
    
    if (success) {
      showDialog({
        type: 'success',
        title: 'Google Sign-up Successful',
        message: 'Your account has been created and you have been logged in successfully with Google.',
        onAction: () => navigation.navigate('Home')
      });
    } else if (authViewModel.error) {
      showDialog({
        type: 'error',
        title: 'Google Sign-up Failed',
        message: authViewModel.error
      });
    }
  };

  // Handle Google Sign-In using native Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const user = await signInWithGoogle();
      console.log('Google Sign-In Success:', user);
      
      // Check if this is a new user or an existing user by looking for specific fields
      // This is a best-effort approach since the server doesn't explicitly tells us
      const isNewAccount = !user.metadata || user.metadata.creationTime === user.metadata.lastSignInTime;
      
      if (isNewAccount) {
        // Set the flag to indicate this is a new registration that needs onboarding
        await AsyncStorage.setItem('just_registered', 'true');
        
        // Show success dialog for new account
        showDialog({
          type: 'success',
          title: 'Account Created!',
          message: `You've successfully created an account with ${user.email}`,
          actionText: 'Continue',
          onAction: () => navigation.navigate('OnboardingCurrency' as never),
        });
      } else {
        // Show message for existing account
        showDialog({
          type: 'info',
          title: 'Account Already Exists',
          message: `You're already registered with ${user.email}. We've logged you in.`,
          actionText: 'Continue',
          onAction: () => navigation.navigate('Home'),
        });
      }
      
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      showDialog({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: 'Failed to sign in with Google. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to show dialog
  const showDialog = ({ type, title, message, actionText, onAction }: {
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    actionText?: string,
    onAction?: () => void,
  }) => {
    setDialogProps({
      type,
      title,
      message,
      actionText: actionText || '',
      onAction: onAction || (() => {}),
    });
    setDialogVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to get started with the app
          </Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={handleNameChange}
            onBlur={handleNameBlur}
            error={authViewModel.nameError}
            touched={touched.name}
            autoCapitalize="words"
          />

          <InputField
            label="Email"
            placeholder="your.email@example.com"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            error={authViewModel.emailError}
            touched={touched.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <InputField
            label="Password"
            placeholder="Create a secure password"
            value={password}
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            onFocus={handlePasswordFocus}
            error={authViewModel.passwordError}
            touched={touched.password}
            isPassword
          />
          
          <PasswordStrengthMeter 
            password={password} 
            visible={isPasswordFocused || (touched.password && !!authViewModel.passwordError)}
          />

          <InputField
            label="Confirm Password"
            placeholder="Retype your password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            onBlur={handleConfirmPasswordBlur}
            error={authViewModel.confirmPasswordError}
            touched={touched.confirmPassword}
            isPassword
          />

          <TouchableOpacity
            style={[
              styles.button,
              authViewModel.isLoading && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={authViewModel.isLoading}
          >
            {authViewModel.isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleButton 
            onPress={handleGoogleSignIn} 
            isLoading={isLoading}
            label="Continue with Google"
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Message Dialog */}
      <MessageDialog
        visible={dialogVisible}
        type={dialogProps.type}
        title={dialogProps.title}
        message={dialogProps.message}
        actionText={dialogProps.actionText}
        onAction={dialogProps.onAction}
        onDismiss={() => setDialogVisible(false)}
        autoDismiss={dialogProps.type === 'success'} // Auto dismiss success messages
      />
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  header: {
    marginTop: 60,
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textLight,
    paddingHorizontal: theme.spacing.sm,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    color: theme.colors.textLight,
    fontSize: 14,
  },
  footerLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default RegisterScreen; 