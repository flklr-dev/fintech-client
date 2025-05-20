import axios from 'axios';
// import { API_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a base axios instance with baseURL
const api = axios.create({
  baseURL: 'http://192.168.1.118:5000/api/v1', // Update to match server's route pattern
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 seconds timeout
});

// Add a request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    try {
      // Try to get token from AsyncStorage - get the plain token, not the object
      const tokenObj = await AsyncStorage.getItem('auth_token');
      let token = tokenObj;
      
      // If token exists and is an object (from newer implementations), extract the token
      try {
        const parsed = JSON.parse(tokenObj);
        if (parsed && parsed.token) {
          token = parsed.token;
        }
      } catch (e) {
        // If it's not JSON, use it as is
      }
      
      // If token exists, add it to the request headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Adding token to request:', config.url);
      } else {
        console.log('No token available for request:', config.url);
      }
      
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      
      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return config; // Continue with request even if getting token fails
    }
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`API Response [${response.status}]: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 response and not already retrying, attempt to refresh token or log out
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      console.error('Authentication error - clearing token due to 401');
      
      // Clear token as it's invalid
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('token_expiry');
      await AsyncStorage.removeItem('user_data');
      
      // Clear auth headers
      delete api.defaults.headers.common['Authorization'];
    }
    
    // Handle specific error cases
    if (error.response) {
      // Server responded with an error status
      console.error('API error response:', {
        status: error.response.status,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        data: error.response.data
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network error - no response received:', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      });
    } else {
      // Something else caused the error
      console.error('Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper methods for token management
const setAuthToken = (token) => {
  if (token) {
    console.log('Setting auth token in api instance');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Also store in AsyncStorage - plain token
    AsyncStorage.setItem('auth_token', token)
      .then(() => console.log('Token stored in AsyncStorage'))
      .catch(err => console.error('Failed to store token:', err));
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

const clearAuthToken = () => {
  console.log('Clearing auth token from api instance');
  delete api.defaults.headers.common['Authorization'];
  AsyncStorage.removeItem('auth_token')
    .then(() => console.log('Token removed from AsyncStorage'))
    .catch(err => console.error('Failed to remove token:', err));
};

// Attach token management methods to the api object
api.setAuthToken = setAuthToken;
api.clearAuthToken = clearAuthToken;

export default api; 