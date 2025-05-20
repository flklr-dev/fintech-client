import api from './api';
import { saveSecurely, deleteSecurely } from '../utils/secureStorage';

// User registration
const register = async (userData) => {
  try {
    const response = await api.post('/auth/signup', userData);
    
    if (response.data && response.data.token) {
      // Save token securely
      await saveSecurely('auth_token', {
        token: response.data.token,
        user: response.data.data.user
      });
    }
    
    return response.data;
  } catch (error) {
    // Format MongoDB duplicate key errors into user-friendly messages
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      
      // Handle MongoDB duplicate key error
      if (errorData.message && errorData.message.includes('E11000') && 
          errorData.message.includes('email')) {
        throw new Error('This email address is already registered');
      }
      
      // Throw the original error message if it exists
      throw errorData;
    }
    
    // Handle network errors
    if (error.message && error.message.includes('Network Error')) {
      throw new Error('Network Error: Unable to connect to the server');
    }
    
    // Generic error
    throw new Error('Registration failed. Please try again.');
  }
};

// User login
const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    
    if (response.data && response.data.token) {
      // Save token securely
      await saveSecurely('auth_token', {
        token: response.data.token,
        user: response.data.data.user
      });
    }
    
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Login failed');
  }
};

// User logout
const logout = async () => {
  try {
    // Delete token from secure storage
    await deleteSecurely('auth_token');
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
};

// Password reset functions
const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    
    if (!response.data) {
      throw new Error('No response from server');
    }
    
    return {
      success: true,
      userId: response.data.data.userId,
      email: response.data.data.email,
      message: response.data.message
    };
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to process password reset request. Please try again.');
    }
  }
};

const verifyOTP = async ({ userId, otp }) => {
  try {
    const response = await api.post('/auth/verify-otp', {
      userId,
      otp
    });
    
    if (!response.data) {
      throw new Error('No response from server');
    }
    
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to verify OTP. Please try again.');
    }
  }
};

const verifyResetOTP = async ({ userId, otp }) => {
  try {
    const response = await api.post('/auth/verify-reset-otp', {
      userId,
      otp
    });
    
    if (!response.data) {
      throw new Error('No response from server');
    }
    
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to verify OTP. Please try again.');
    }
  }
};

const resetPassword = async ({ userId, otp, newPassword }) => {
  try {
    const response = await api.post('/auth/reset-password', {
      userId,
      otp,
      newPassword
    });
    
    if (!response.data) {
      throw new Error('No response from server');
    }
    
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to reset password. Please try again.');
    }
  }
};

export const authService = {
  register,
  login,
  logout,
  forgotPassword,
  verifyOTP,
  verifyResetOTP,
  resetPassword
}; 