import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import BudgetScreen from '../screens/BudgetScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AccountScreen from '../screens/AccountScreen';
import ContactSupportScreen from '../screens/ContactSupportScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import OnboardingCurrencyScreen from '../screens/OnboardingCurrencyScreen';
import OnboardingIncomeScreen from '../screens/OnboardingIncomeScreen';
import OnboardingBudgetScreen from '../screens/OnboardingBudgetScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// Define navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: {
    userId: string;
    email: string;
  };
  Home: undefined;
  Budget: {
    showAddModal?: boolean;
    preselectedCategory?: string;
  };
  Transactions: {
    showAddModal?: boolean;
  };
  Reports: undefined;
  Account: undefined;
  ContactSupport: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  OnboardingCurrency: undefined;
  OnboardingIncome: undefined;
  OnboardingBudget: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = observer(() => {
  const { isLoggedIn, isLoading } = useAuth();
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  
  // Check if this is user's first login after registration
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        if (isLoggedIn) {
          const hasCompletedOnboarding = await AsyncStorage.getItem('has_completed_onboarding');
          const justRegistered = await AsyncStorage.getItem('just_registered');
          
          // If user just registered and hasn't completed onboarding
          if (justRegistered === 'true' && !hasCompletedOnboarding) {
            setIsFirstLogin(true);
            console.log('User needs to complete onboarding');
            // Clear the registration flag
            await AsyncStorage.removeItem('just_registered');
          } else {
            setIsFirstLogin(false);
            console.log('User has already completed onboarding or is an existing user');
          }
        } else {
          // User is not logged in, ensure we clear any lingering flags
          setIsFirstLogin(false);
          console.log('User not logged in, clearing onboarding flags');
          await AsyncStorage.removeItem('just_registered');
          await AsyncStorage.removeItem('has_completed_onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsFirstLogin(false);
      }
    };
    
    checkOnboardingStatus();
  }, [isLoggedIn]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.textLight }}>Loading your account...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={
          isLoggedIn 
            ? isFirstLogin 
              ? 'OnboardingCurrency' 
              : 'Home' 
            : 'Login'
        }
        screenOptions={{
          headerShown: false,
          animation: 'none',
          animationDuration: 0,
          gestureEnabled: false,
          presentation: 'card',
          contentStyle: {
            backgroundColor: '#fff',
          },
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
          name="Register" 
          component={RegisterScreen} 
          key={`register-screen-${Date.now()}`}
        />
        <Stack.Screen 
          name="OTPVerification" 
          component={OTPVerificationScreen} 
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Budget" component={BudgetScreen} />
        <Stack.Screen name="Transactions" component={TransactionsScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        
        {/* Onboarding Screens */}
        <Stack.Screen name="OnboardingCurrency" component={OnboardingCurrencyScreen} />
        <Stack.Screen name="OnboardingIncome" component={OnboardingIncomeScreen} />
        <Stack.Screen name="OnboardingBudget" component={OnboardingBudgetScreen} />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
});

export default AppNavigator; 