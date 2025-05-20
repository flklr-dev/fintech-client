import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, LoginRequest, RegisterRequest } from '../services/apiService';
import api from '../api/api';

// Define user type
type User = {
  id: string;
  name: string;
  email: string;
};

// Define types
type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  
  // Form validation states
  emailError: string | null;
  passwordError: string | null;
  confirmPasswordError: string | null;
  nameError: string | null;
  
  // Password strength
  passwordStrength: 'weak' | 'medium' | 'strong' | 'very-strong' | null;
  
  // Methods
  login: (data: LoginRequest) => Promise<boolean>;
  register: (data: RegisterRequest, confirmPassword: string) => Promise<{ userId: string; email: string } | null>;
  signInWithGoogle: (token: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resetErrors: () => void;
  validateEmail: (email: string) => boolean;
  validatePassword: (password: string) => boolean;
  validateConfirmPassword: (password: string, confirmPassword: string) => boolean;
  validateName: (name: string) => boolean;
};

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: false,
  error: null,
  user: null,
  
  emailError: null,
  passwordError: null,
  confirmPasswordError: null,
  nameError: null,
  
  passwordStrength: null,
  
  login: async () => false,
  register: async () => null,
  signInWithGoogle: async () => false,
  logout: async () => false,
  resetErrors: () => {},
  validateEmail: () => false,
  validatePassword: () => false,
  validateConfirmPassword: () => false,
  validateName: () => false,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading by default
  const [error, setError] = useState<string | null>(null);
  
  // User data
  const [user, setUser] = useState<User | null>(null);
  
  // Form validation states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong' | null>(null);

  // Check initial auth state on load
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        console.log('Checking auth state on app launch...');
        
        // Check if user is logged in
        const isUserLoggedIn = await authService.isLoggedIn();
        
        if (!isUserLoggedIn) {
          console.log('No valid token found, user is not logged in');
          setIsLoggedIn(false);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        console.log('Valid token found, loading user data...');
        
        // Try to get stored user data for immediate UI update
        const storedUserData = await authService.getStoredUserData();
        if (storedUserData) {
          console.log('Found stored user data:', storedUserData.name);
          setUser(storedUserData);
          setIsLoggedIn(true);
        }
        
        // Try to fetch latest user data
        try {
          // Get token to apply to our api instance
          const token = await authService.getToken();
          if (token) {
            api.setAuthToken(token);
          }
          
          // Fetch user profile
          const response = await api.get('/users/profile');
          if (response.data && response.data.data && response.data.data.user) {
            const userData = response.data.data.user;
            console.log('Successfully fetched user profile:', userData.name);
            
            // Update user state and storage
            setUser(userData);
            await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          }
          
          setIsLoggedIn(true);
        } catch (profileError) {
          console.error('Error fetching user profile:', profileError);
          // If we can't fetch profile but have valid token and cached data,
          // we'll still consider the user logged in with cached data
          if (!storedUserData) {
            // If we have no stored data and can't fetch profile, log out
            await authService.clearToken();
            setIsLoggedIn(false);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthState();
  }, []);

  // Reset all form errors
  const resetErrors = () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setNameError(null);
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    setEmailError(isValid ? null : 'Invalid email address');
    return isValid;
  };

  // Validate password strength
  const validatePassword = (password: string): boolean => {
    // Minimum 8 characters
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      setPasswordStrength('weak');
      return false;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Calculate strength
    let strength = 0;
    if (hasUppercase) strength++;
    if (hasLowercase) strength++;
    if (hasNumber) strength++;
    if (hasSpecial) strength++;
    
    // Set strength level
    if (strength === 1) setPasswordStrength('weak');
    else if (strength === 2) setPasswordStrength('medium');
    else if (strength === 3) setPasswordStrength('strong');
    else if (strength === 4) setPasswordStrength('very-strong');
    
    // All requirements met?
    const isValid = hasUppercase && hasLowercase && hasNumber && hasSpecial;
    setPasswordError(isValid 
      ? null 
      : 'Password must contain uppercase, lowercase, number, and special character');
    
    return isValid;
  };

  // Validate password confirmation
  const validateConfirmPassword = (password: string, confirmPassword: string): boolean => {
    const isValid = password === confirmPassword;
    setConfirmPasswordError(isValid ? null : 'Passwords do not match');
    return isValid;
  };

  // Validate name
  const validateName = (name: string): boolean => {
    const isValid = name.trim().length > 0;
    setNameError(isValid ? null : 'Name is required');
    return isValid;
  };

  // Login flow
  const login = async (data: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate input
      const isEmailValid = validateEmail(data.email);
      const isPasswordValid = data.password.length > 0;
      
      if (!isEmailValid || !isPasswordValid) {
        if (!isPasswordValid) setPasswordError('This field is required');
        throw new Error('Please correct the form errors');
      }
      
      console.log('Attempting login for', data.email);
      
      // Attempt login
      const response = await api.post('/auth/login', data);
      
      console.log('Login response received:', response.status);
      
      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from server');
      }
      
      // Store token
      const token = response.data.token;
      console.log('Token received, storing it');
      await AsyncStorage.setItem('auth_token', token);
      
      // Set token in API instance
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Token set in API headers');
      
      // Store user data if available
      if (response.data.data && response.data.data.user) {
        const userData = response.data.data.user;
        console.log('User data received, storing it');
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        setUser(userData);
      } else {
        console.log('No user data in response, creating fallback user data');
        const basicUserData = {
          id: 'temp-id',
          name: 'User',
          email: data.email
        };
        setUser(basicUserData);
        await AsyncStorage.setItem('user_data', JSON.stringify(basicUserData));
      }
      
      // Set logged in state
      console.log('Setting logged in state to true');
      setIsLoggedIn(true);
      
      // Add a small delay to ensure token is properly set
      console.log('Adding delay for token propagation');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Login process completed successfully');
      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoading(false);
      
      // Handle specific API errors
      if (error.response) {
        if (error.response.status === 401) {
          setError('Invalid email or password');
        } else if (error.response.data && error.response.data.message) {
          setError(error.response.data.message);
        } else {
          setError('Login failed. Please try again.');
        }
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Network error. Please check your connection.');
      }
      return false;
    }
  };

  // Register flow
  const register = async (data: RegisterRequest, confirmPassword: string): Promise<{ userId: string; email: string } | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate all inputs
      const isNameValid = validateName(data.name);
      const isEmailValid = validateEmail(data.email);
      const isPasswordValid = validatePassword(data.password);
      const isConfirmPasswordValid = validateConfirmPassword(data.password, confirmPassword);
      
      if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
        throw new Error('Please correct the form errors');
      }
      
      // Attempt registration - returns userId and email for OTP verification 
      // instead of directly storing the token
      const result = await authService.register(data);
      
      // Return the result for OTP verification
      return result;
    } catch (error: any) {
      // Handle specific API errors
      if (error.message.includes('email already exists')) {
        setError('Email already exists');
      } else {
        setError(error.message || 'Registration failed. Please try again.');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-in
  const signInWithGoogle = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('AuthContext: Processing Google Sign-In token');
      
      // Attempt Google login - this will automatically store the token
      const success = await authService.loginWithGoogle(token);
      
      if (!success) {
        throw new Error('Failed to authenticate with Google');
      }
      
      console.log('AuthContext: Google Sign-In successful, getting token');
      
      // Get token to set in api instance
      const authToken = await authService.getToken();
      if (authToken) {
        console.log('AuthContext: Setting token in API instance');
        api.setAuthToken(authToken);
      } else {
        console.warn('AuthContext: No token returned after Google Sign-In');
      }
      
      // Get user data (should have been saved by authService)
      const userData = await authService.getStoredUserData();
      if (userData) {
        console.log('AuthContext: Setting user data', userData.name);
        setUser(userData);
      } else {
        console.warn('AuthContext: No user data found after Google Sign-In');
      }
      
      // Set logged in state
      console.log('AuthContext: Setting logged in state to true');
      setIsLoggedIn(true);
      
      // Add a small delay to ensure token is properly set
      console.log('AuthContext: Adding delay for token propagation');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('AuthContext: Google Sign-In process completed successfully');
      return true;
    } catch (error: any) {
      console.error('AuthContext: Google Sign-In error:', error);
      setError(error.message || 'Google sign-in failed. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout flow
  const logout = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // First reset the auth state
      setIsLoggedIn(false);
      setUser(null);
      resetErrors();
      
      // Clear all auth-related storage
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('token_expiry');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('lastPasswordChange');
      
      // Clear auth-related flags to prevent issues on next login
      await AsyncStorage.removeItem('just_registered');
      await AsyncStorage.removeItem('has_completed_onboarding');
      
      // Clear token from API instance
      api.clearAuthToken();
      
      // Call the auth service to clean up any remaining state
      await authService.clearToken();

      // Add a short delay to ensure all async operations are completed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    isLoggedIn,
    isLoading,
    error,
    user,
    
    emailError,
    passwordError,
    confirmPasswordError,
    nameError,
    
    passwordStrength,
    
    login,
    register,
    signInWithGoogle,
    logout,
    resetErrors,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
    validateName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 