import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveSecurely, getSecurely, deleteSecurely } from '../utils/secureStorage';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyOTPRequest {
  userId: string;
  otp: string;
}

export interface ResendOTPRequest {
  userId: string;
}

// Constants
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const TOKEN_EXPIRY_KEY = 'token_expiry';
// Default token expiry time (24 hours)
const DEFAULT_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: 'http://192.168.1.118:5000/api/v1', // Update to match server's route pattern
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await getValidToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Clear auth data on 401 errors
        await clearAuthData();
        // Clear axios headers
        delete axiosInstance.defaults.headers.common['Authorization'];
        
        // If we have a token but still getting 401, it might be invalid
        const token = await getValidToken();
        if (token) {
          console.warn('Token exists but request returned 401, clearing token');
          await clearAuthData();
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to get a valid token (not expired)
const getValidToken = async (): Promise<string | null> => {
  try {
    // First check if we have a token
    const tokenData = await getSecurely(AUTH_TOKEN_KEY);
    if (!tokenData?.token) return null;
    
    // Then check if we have expiry info
    const expiryStr = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryStr) return tokenData.token; // If no expiry, assume token is valid
    
    // Check if token is expired
    const expiry = parseInt(expiryStr, 10);
    const now = Date.now();
    
    if (now >= expiry) {
      // Token expired, clear auth data
      await clearAuthData();
      return null;
    }
    
    // Token is valid, ensure it's set in axios headers
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokenData.token}`;
    
    return tokenData.token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Helper to clear all auth related data
const clearAuthData = async (): Promise<void> => {
  try {
    await deleteSecurely(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_EXPIRY_KEY);
    await AsyncStorage.removeItem(USER_DATA_KEY);
    await AsyncStorage.removeItem('lastPasswordChange');
    await AsyncStorage.removeItem('just_registered');
    await AsyncStorage.removeItem('has_completed_onboarding');
    
    // Also clear any other session data
    await AsyncStorage.removeItem('preferred_currency');
    await AsyncStorage.removeItem('user_income');
    await AsyncStorage.removeItem('income_frequency');
    
    // Clear auth headers from axios instance
    delete axiosInstance.defaults.headers.common['Authorization'];
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

// Auth service methods
export const authService = {
  // Token management
  setToken: async (token: string, user?: UserProfile): Promise<void> => {
    try {
      // Save token securely
      await saveSecurely(AUTH_TOKEN_KEY, { token });
      
      // Set token expiry (24 hours from now)
      const expiryTime = Date.now() + DEFAULT_TOKEN_EXPIRY;
      await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      // Save user data if provided
      if (user) {
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      }
      
      // Set the token in the axios instance headers
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  },

  getToken: async (): Promise<string | null> => {
    return getValidToken();
  },

  clearToken: async (): Promise<void> => {
    await clearAuthData();
  },
  
  // Check if user is logged in with a valid token
  isLoggedIn: async (): Promise<boolean> => {
    const token = await getValidToken();
    return !!token;
  },
  
  // Get stored user data
  getStoredUserData: async (): Promise<UserProfile | null> => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error getting stored user data:', error);
      return null;
    }
  },

  // Auth methods
  login: async (credentials: LoginRequest): Promise<string> => {
    try {
      const response: AxiosResponse = await axiosInstance.post('/auth/login', credentials);
      const { token } = response.data;
      const user = response.data.data?.user;
      
      // Store token and user data
      await authService.setToken(token, user);
      return token;
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to login. Please try again.'
      );
    }
  },

  register: async (userData: RegisterRequest): Promise<{ userId: string; email: string } | null> => {
    try {
      // Update endpoint from /auth/register to /auth/signup to match the server
      const response: AxiosResponse = await axiosInstance.post('/auth/signup', userData);
      
      // Check if registration was successful but needs verification
      if (response.data.status === 'success' && !response.data.token) {
        // Return the userId and email for OTP verification
        return {
          userId: response.data.data.userId,
          email: response.data.data.email
        };
      }
      
      // If we get here, there might have been a direct registration (shouldn't happen)
      const { token } = response.data;
      const user = response.data.data?.user;
      
      // Store token and user data
      if (token) {
      await authService.setToken(token, user);
      }
      
      return null;
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to register. Please try again.'
      );
    }
  },

  logout: async (): Promise<void> => {
    try {
      await clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout. Please try again.');
    }
  },

  loginWithGoogle: async (googleToken: string) => {
    try {
      console.log('Sending Google token to backend for verification');
      const response = await axiosInstance.post('/auth/google', { token: googleToken });
      
      if (response.data.status === 'success') {
        console.log('Google Sign-In API response success');
        
        // Get the plain JWT token
        const token = response.data.token;
        const user = response.data.data.user;
        
        // Store token directly in AsyncStorage for use by api.js
        await AsyncStorage.setItem('auth_token', token);
        console.log('Token stored in AsyncStorage directly');
        
        // Also save using secureStorage for other parts of the app
        await saveSecurely(AUTH_TOKEN_KEY, { token });
        console.log('Token stored in secure storage');
        
        // Set token expiry (24 hours from now)
        const expiryTime = Date.now() + DEFAULT_TOKEN_EXPIRY;
        await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        
        // Save user data if provided
        if (user) {
          await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
        }
        
        // Set the token in the axios instance headers
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('Token added to axios headers');
        
        return true;
      }
      
      console.log('Google Sign-In API response failure');
      return false;
    } catch (error) {
      console.error('Google Sign-In API error:', error);
      throw error;
    }
  },

  verifyOTP: async (verifyData: VerifyOTPRequest): Promise<string> => {
    try {
      const response: AxiosResponse = await axiosInstance.post('/auth/verify-otp', verifyData);
      
      const { token } = response.data;
      const user = response.data.data?.user;
      
      // Store token and user data
      await authService.setToken(token, user);
      
      return token;
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to verify OTP. Please try again.'
      );
    }
  },

  resendOTP: async (resendData: ResendOTPRequest): Promise<void> => {
    try {
      await axiosInstance.post('/auth/resend-otp', resendData);
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to resend OTP. Please try again.'
      );
    }
  }
};

// API service methods
export const apiService = {
  // User profile methods
  getUserProfile: async (): Promise<UserProfile> => {
    try {
      const response: AxiosResponse = await axiosInstance.get('/users/profile');
      return response.data.data.user;
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to fetch user profile. Please try again.'
      );
    }
  },

  updateUserProfile: async (name: string): Promise<UserProfile> => {
    try {
      const response: AxiosResponse = await axiosInstance.patch('/users/profile', { name });
      return response.data.data.user;
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to update profile. Please try again.'
      );
    }
  },

  changePassword: async (passwords: ChangePasswordRequest): Promise<void> => {
    try {
      await axiosInstance.patch('/users/change-password', passwords);
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      throw new Error(
        axiosError.response?.data?.message || 'Failed to change password. Please try again.'
      );
    }
  },

  // Get current user profile - Use the new user profile endpoint instead of auth/me
  getCurrentUser: async (): Promise<UserProfile> => {
    try {
      const response = await axiosInstance.get('/users/profile');
      return response.data.data.user;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
};

export default { authService, apiService }; 