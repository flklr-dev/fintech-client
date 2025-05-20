import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TextInput } from 'react-native-paper';
import * as yup from 'yup';
import { Formik } from 'formik';
import { authService } from '../api/authService';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ResetPassword: {
    userId: string;
    email: string;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;

interface ResetPasswordParams {
  userId: string;
  email: string;
}

// Validation schema for OTP step
const otpValidationSchema = yup.object().shape({
  otp: yup
    .string()
    .matches(/^\d{6}$/, 'OTP must be exactly 6 digits')
    .required('OTP is required'),
});

// Validation schema for password reset step
const passwordValidationSchema = yup.object().shape({
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    )
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your password'),
});

const ResetPasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { userId, email } = route.params as ResetPasswordParams;
  const [isLoading, setIsLoading] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [verifiedOTP, setVerifiedOTP] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Handle OTP verification
  const handleVerifyOTP = async (values: { otp: string }) => {
    try {
      setIsLoading(true);
      
      // Call verifyResetOTP endpoint
      const response = await authService.verifyResetOTP({
        userId,
        otp: values.otp
      });

      if (response.success) {
        setIsOTPVerified(true);
        setVerifiedOTP(values.otp);
        Alert.alert(
          'Success',
          'OTP verified successfully. Please set your new password.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to verify OTP',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset
  const handleResetPassword = async (values: {
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setIsLoading(true);
      
      await authService.resetPassword({
        userId,
        otp: verifiedOTP,
        newPassword: values.newPassword,
      });

      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please login with your new password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to reset password',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.description}>
              {!isOTPVerified
                ? `Enter the verification code sent to ${email}`
                : 'Create your new password'
              }
            </Text>

            {!isOTPVerified ? (
              // OTP Verification Form
              <Formik
                initialValues={{ otp: '' }}
                validationSchema={otpValidationSchema}
                onSubmit={handleVerifyOTP}
              >
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                  errors,
                  touched,
                  isValid,
                }) => (
                  <View style={styles.form}>
                    <TextInput
                      mode="outlined"
                      label="Verification Code"
                      value={values.otp}
                      onChangeText={handleChange('otp')}
                      onBlur={handleBlur('otp')}
                      error={touched.otp && !!errors.otp}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                      theme={{
                        colors: {
                          primary: theme.colors.primary,
                        },
                      }}
                    />
                    {touched.otp && errors.otp && (
                      <Text style={styles.errorText}>{errors.otp}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.button,
                        (!isValid || isLoading) && styles.buttonDisabled,
                      ]}
                      onPress={() => handleSubmit()}
                      disabled={!isValid || isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Verify Code</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={() =>
                        authService.forgotPassword(email).then(() => {
                          Alert.alert(
                            'Success',
                            'A new verification code has been sent to your email'
                          );
                        })
                      }
                    >
                      <Text style={styles.resendButtonText}>
                        Resend Verification Code
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            ) : (
              // Password Reset Form
              <Formik
                initialValues={{
                  newPassword: '',
                  confirmPassword: '',
                }}
                validationSchema={passwordValidationSchema}
                onSubmit={handleResetPassword}
              >
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                  errors,
                  touched,
                  isValid,
                }) => (
                  <View style={styles.form}>
                    <TextInput
                      mode="outlined"
                      label="New Password"
                      value={values.newPassword}
                      onChangeText={handleChange('newPassword')}
                      onBlur={handleBlur('newPassword')}
                      onFocus={() => setIsPasswordFocused(true)}
                      error={touched.newPassword && !!errors.newPassword}
                      secureTextEntry
                      style={styles.input}
                      theme={{
                        colors: {
                          primary: theme.colors.primary,
                        },
                      }}
                    />
                    {touched.newPassword && errors.newPassword && (
                      <Text style={styles.errorText}>{errors.newPassword}</Text>
                    )}

                    <PasswordStrengthMeter
                      password={values.newPassword}
                      visible={!!(isPasswordFocused || (touched.newPassword && errors.newPassword))}
                    />

                    <TextInput
                      mode="outlined"
                      label="Confirm New Password"
                      value={values.confirmPassword}
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={handleBlur('confirmPassword')}
                      error={touched.confirmPassword && !!errors.confirmPassword}
                      secureTextEntry
                      style={styles.input}
                      theme={{
                        colors: {
                          primary: theme.colors.primary,
                        },
                      }}
                    />
                    {touched.confirmPassword && errors.confirmPassword && (
                      <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.button,
                        (!isValid || isLoading) && styles.buttonDisabled,
                      ]}
                      onPress={() => handleSubmit()}
                      disabled={!isValid || isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Reset Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textLight,
    marginBottom: 24,
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 8,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginBottom: 16,
    marginTop: -4,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen; 