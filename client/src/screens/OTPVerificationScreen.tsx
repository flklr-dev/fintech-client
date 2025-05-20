import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import AppHeader from '../components/AppHeader';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: {
    userId: string;
    email: string;
  };
  OnboardingCurrency: undefined;
};

type OTPVerificationScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'OTPVerification'>;
  route: RouteProp<RootStackParamList, 'OTPVerification'>;
};

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({ navigation, route }) => {
  const { userId, email } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // References for TextInput elements for focusing between fields
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    // Start countdown timer
    if (timer > 0 && !canResend) {
      const interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);

      return () => clearInterval(interval);
    } else if (timer === 0) {
      setCanResend(true);
    }
  }, [timer, canResend]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (text: string, index: number) => {
    // Allow only digits
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Always clear error when user is typing
    setError(null);

    // Auto focus next input field if current field is filled
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Only auto submit if all fields are filled with digits
    if (index === 5 && text && newOtp.every(digit => /^\d$/.test(digit))) {
      handleVerify(newOtp);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // If backspace is pressed and current field is empty, focus previous field
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpArray = otp) => {
    try {
      const otpValue = otpArray.join('');
      
      if (loading || verificationSuccess) {
        return;
      }

      setLoading(true);
      setError(null);

      const response = await api.post('/auth/verify-otp', {
        userId,
        otp: otpValue
      });

      if (response.data.status === 'success') {
        // Store token
        const token = response.data.token;
        await AsyncStorage.setItem('auth_token', token);
        
        // Set token in API headers
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Store user data if available
        if (response.data.data && response.data.data.user) {
          await AsyncStorage.setItem('user_data', JSON.stringify(response.data.data.user));
        }
        
        // Set registration flag
        await AsyncStorage.setItem('just_registered', 'true');
        
        // Clear any existing onboarding data
        await AsyncStorage.removeItem('has_completed_onboarding');
        
        // Disable inputs
        inputRefs.current.forEach(ref => {
          if (ref) ref.setNativeProps({ editable: false });
        });

        // Small delay to show success state
        setTimeout(() => {
          // Navigate to onboarding
          navigation.reset({
            index: 0,
            routes: [{ name: 'OnboardingCurrency' }],
          });
        }, 500);
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      
      if (err.response) {
        const errorData = err.response.data;
        if (errorData.attemptsLeft !== undefined) {
          setAttemptsLeft(errorData.attemptsLeft);
          setError(`Invalid code. ${errorData.attemptsLeft} attempts left`);
        } else {
          setError(errorData.message || 'Failed to verify code. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/resend-otp', {
        userId
      });

      if (response.data.status === 'success') {
        // Reset timer and attempts
        setTimer(60);
        setCanResend(false);
        setAttemptsLeft(5);
        
        Alert.alert(
          'Code Resent', 
          'A new verification code has been sent to your email'
        );
      }
    } catch (err: any) {
      console.error('Resend OTP error:', err);
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="Verify Your Email" 
        showBackButton={!loading} 
        onBackPress={() => navigation.goBack()}
        showProfile={false}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.content}>
          <Ionicons name="mail-outline" size={60} color={theme.colors.primary} style={styles.icon} />
          
          <Text style={styles.description}>
            We've sent a 6-digit verification code to
          </Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.instruction}>
            Enter the code below to verify your account
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : {},
                  error ? styles.otpInputError : {},
                  loading ? styles.otpInputSuccess : {}
                ]}
                value={digit}
                onChangeText={text => handleInputChange(text, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="numeric"
                maxLength={1}
                autoCapitalize="none"
                selectionColor={theme.colors.primary}
                editable={!loading}
              />
            ))}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.attemptsContainer}>
            <Text style={styles.attemptsText}>
              Attempts left: <Text style={styles.attemptsCount}>{attemptsLeft}</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              loading && styles.buttonDisabled,
              otp.some(digit => !digit) && styles.buttonDisabled
            ]}
            onPress={() => handleVerify()}
            disabled={loading || otp.some(digit => !digit)}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={loading}
              >
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                Resend code in <Text style={styles.timer}>{formatTime(timer)}</Text>
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 24,
  },
  icon: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  instruction: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 32,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  otpInputFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  otpInputError: {
    borderColor: theme.colors.error,
    backgroundColor: `${theme.colors.error}10`,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.error,
    marginLeft: 8,
    fontSize: 14,
  },
  attemptsContainer: {
    marginBottom: 24,
  },
  attemptsText: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  attemptsCount: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  verifyButton: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  verifyButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  timerText: {
    color: theme.colors.textLight,
    fontSize: 14,
  },
  timer: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  otpInputSuccess: {
    borderColor: theme.colors.success,
    backgroundColor: `${theme.colors.success}10`,
  },
});

export default OTPVerificationScreen; 