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
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import InputField from '../components/InputField';
import GoogleButton from '../components/GoogleButton';
import MessageDialog from '../components/MessageDialog';
import { authViewModel } from '../viewmodels/authViewModel';
import { signInWithGoogle } from '../services/googleSignIn';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useScreenSecurity from '../hooks/useScreenSecurity';
import api from '../api/api';

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
  ForgotPassword: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = observer(() => {
  // Use the screen security hook to prevent screenshots
  useScreenSecurity(true);
  
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const auth = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form validation tracking
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogProps, setDialogProps] = useState({
    type: 'error' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: '',
    onAction: () => {},
  });

  // Reset auth errors when screen is mounted
  useEffect(() => {
    auth.resetErrors();
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    if (auth.isLoggedIn) {
      navigation.navigate('Home');
    }
  }, [auth.isLoggedIn]);

  // Handle input changes with validation
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (touched.email) {
      auth.validateEmail(text);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (touched.password) {
      // Simple presence validation for login
      if (text.length === 0) {
        auth.passwordError = 'This field is required';
      } else {
        auth.passwordError = null;
      }
    }
  };

  // Mark fields as touched on blur
  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true });
    if (email.trim() === '') {
      auth.emailError = 'This field is required';
    } else {
      auth.validateEmail(email);
    }
  };

  const handlePasswordBlur = () => {
    setTouched({ ...touched, password: true });
    auth.passwordError = password.length === 0 ? 'This field is required' : null;
  };

  // Handle login button press
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      auth.resetErrors();

      // Validate input
      const isEmailValid = auth.validateEmail(email);
      const isPasswordValid = password.length > 0;
      
      if (!isEmailValid || !isPasswordValid) {
        if (!isPasswordValid) auth.passwordError = 'This field is required';
        throw new Error('Please correct the form errors');
      }
      
      // Use the auth context login method directly, which handles token storage properly
      const success = await auth.login({ email, password });
      
      if (success) {
        console.log('Login successful, navigating to Home');
        // Navigate directly to Home screen without checking token again
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else if (auth.error) {
        // If there's an error message from auth context, show it
        showDialog({
          type: 'error',
          title: 'Login Failed',
          message: auth.error
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Check if response indicates unverified account
      if (error.response && error.response.data && error.response.data.requiresVerification) {
        // Navigate to verification screen with the provided details
        navigation.navigate('OTPVerification', {
          userId: error.response.data.data.userId,
          email: error.response.data.data.email
        });
        return;
      }
      
      showDialog({
        type: 'error',
        title: 'Login Failed',
        message: error.response?.data?.message || error.message || 'Failed to log in. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async (token: string) => {
    const success = await auth.signInWithGoogle(token);
    
    if (success) {
      showDialog({
        type: 'success',
        title: 'Google Login Successful',
        message: 'You have been logged in successfully with Google.',
        onAction: () => navigation.navigate('Home'),
      });
    } else if (auth.error) {
      showDialog({
        type: 'error',
        title: 'Google Login Failed',
        message: auth.error
      });
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

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const user = await signInWithGoogle();
      console.log('Google Sign-In Success:', user);
      
      // Check if this is a new user or an existing user by looking at metadata
      const isNewAccount = !user.metadata || user.metadata.creationTime === user.metadata.lastSignInTime;
      
      if (isNewAccount) {
        // This is a new user, mark as just registered and send to onboarding
        await AsyncStorage.setItem('just_registered', 'true');
        
        // Show success dialog for new account
        showDialog({
          type: 'success',
          title: 'Account Created!',
          message: `Welcome to Fintech App! Your account has been created with ${user.email}`,
          actionText: 'Get Started',
          onAction: () => navigation.navigate('OnboardingCurrency' as never),
        });
      } else {
        // This is an existing user, proceed to home
        showDialog({
          type: 'success',
          title: 'Welcome Back!',
          message: `You've successfully signed in as ${user.email}`,
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your account to continue
          </Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="Email"
            placeholder="your.email@example.com"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            error={auth.emailError}
            touched={touched.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <InputField
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            error={auth.passwordError}
            touched={touched.password}
            isPassword
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <GoogleButton 
            onPress={handleGoogleSignIn} 
            isLoading={isLoading}
            label="Continue with Google"
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => {
                // Force immediate reset of auth context
                auth.resetErrors();
                
                // Use MobX action-safe method to reset auth state
                authViewModel.resetForRegistration();
                
                // Use reset navigation instead of navigate to completely clear the stack
                // This bypasses any navigation issues caused by loading states
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Register' }],
                });
              }}
            >
              <Text style={styles.footerLink}>Sign Up</Text>
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
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: theme.spacing.md,
  },
  divider: {
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -16,
    marginBottom: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen; 