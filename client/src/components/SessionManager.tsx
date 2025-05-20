import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { authService } from '../services/apiService';
import { authViewModel } from '../viewmodels/authViewModel';
import MessageDialog from './MessageDialog';
import { RootStackParamList } from '../navigation/AppNavigator';

// Session check interval (in ms) - check every 2 minutes
const SESSION_CHECK_INTERVAL = 2 * 60 * 1000;

type NavigationProp = StackNavigationProp<RootStackParamList>;

const SessionManager: React.FC = observer(() => {
  const navigation = useNavigation<NavigationProp>();
  const appState = useRef(AppState.currentState);
  const sessionCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogProps, setDialogProps] = useState({
    type: 'error' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: '',
    onAction: () => {},
  });
  
  // Function to check if the session is valid
  const checkSession = async () => {
    if (!authViewModel.isLoggedIn) return;
    
    try {
      const isUserLoggedIn = await authService.isLoggedIn();
      
      if (!isUserLoggedIn && authViewModel.isLoggedIn) {
        // Session has expired, show dialog
        showSessionExpiredDialog();
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  };
  
  // Function to show the session expired dialog
  const showSessionExpiredDialog = () => {
    setDialogProps({
      type: 'error',
      title: 'Session Expired',
      message: 'Your session has expired. Please login again.',
      actionText: 'Login',
      onAction: handleSessionExpired,
    });
    setDialogVisible(true);
  };
  
  // Function to handle session expiry
  const handleSessionExpired = async () => {
    try {
      // Perform proper logout
      await authService.clearToken();
      
      // Reset auth state in viewModel
      runInAction(() => {
        authViewModel.isLoggedIn = false;
        authViewModel.userId = null;
        authViewModel.userName = null;
        authViewModel.email = null;
      });
      
      // Navigate to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error handling session expiry:', error);
    } finally {
      setDialogVisible(false);
    }
  };
  
  // Setup interval to periodically check session
  useEffect(() => {
    // Initial session check
    checkSession();
    
    // Set up interval for session checking
    sessionCheckTimer.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    
    // Clean up on unmount
    return () => {
      if (sessionCheckTimer.current) {
        clearInterval(sessionCheckTimer.current);
      }
    };
  }, []);
  
  // Add app state change handler to check session when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        // App has come to the foreground, check session
        checkSession();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // The session manager doesn't render anything except the dialog when needed
  return (
    <MessageDialog
      visible={dialogVisible}
      type={dialogProps.type}
      title={dialogProps.title}
      message={dialogProps.message}
      actionText={dialogProps.actionText}
      onAction={dialogProps.onAction}
      onDismiss={() => setDialogVisible(false)}
    />
  );
});

export default SessionManager; 