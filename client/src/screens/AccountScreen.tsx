import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Switch, 
  Platform,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AppHeader from '../components/AppHeader';
import MessageDialog from '../components/MessageDialog';
import { apiService, UserProfile } from '../services/apiService';
import BottomNavBar from '../components/BottomNavBar';
import { ScreenName } from '../components/BottomNavBar';
import { useCurrency } from '../contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES } from '../utils/currencyUtils';
import pesoPayService, { BankCard, BankAccount, LinkAccountRequest } from '../services/pesoPayService';
import { Picker } from '@react-native-picker/picker';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width, height } = Dimensions.get('window');

const AccountScreen = () => {
  const { user: authUser, logout } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [activeScreen, setActiveScreen] = useState<ScreenName>('Home');
  const { currency, setCurrency } = useCurrency();
  
  // App preferences state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  
  // User profile state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation dialog
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogProps, setDialogProps] = useState({
    type: 'warning' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: '',
    onAction: () => {},
  });
  
  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
    general?: string;
  }>({});
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong' | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [lastPasswordChange, setLastPasswordChange] = useState<Date | null>(null);
  
  // Bank card and account state
  const [linkedCards, setLinkedCards] = useState<BankCard[]>([]);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [newCard, setNewCard] = useState({
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
    bankName: ''
  });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [isCardValid, setIsCardValid] = useState(false);
  const [detectedCardType, setDetectedCardType] = useState<'VISA' | 'MASTERCARD' | null>(null);
  
  // Add loading state for card and account operations
  const [addingCard, setAddingCard] = useState(false);
  
  // Add state for card validation feedback
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  
  // Fetch user profile data
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
    setLoading(true);
      setError(null);
      const userProfile = await apiService.getUserProfile();
      setUser(userProfile);
      
      // Check for last password change date from AsyncStorage
      try {
        const lastChangeStr = await AsyncStorage.getItem('lastPasswordChange');
        if (lastChangeStr) {
          setLastPasswordChange(new Date(lastChangeStr));
        }
      } catch (err) {
        console.error('Error getting last password change date:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile data');
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const validatePassword = (password: string): boolean => {
    // Minimum 8 characters
    if (password.length < 8) {
      setPasswordErrors(prev => ({
        ...prev,
        new: 'Password must be at least 8 characters'
      }));
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
    
    if (!isValid) {
      setPasswordErrors(prev => ({
        ...prev,
        new: 'Password must contain uppercase, lowercase, number, and special character'
      }));
    } else {
      setPasswordErrors(prev => ({
        ...prev,
        new: undefined
      }));
    }
    
    return isValid;
  };

  const validateConfirmPassword = (password: string, confirmPass: string): boolean => {
    const isValid = password === confirmPass;
    
    setPasswordErrors(prev => ({
      ...prev,
      confirm: isValid ? undefined : 'Passwords do not match'
    }));
    
    return isValid;
  };

  const canChangePassword = (): boolean => {
    if (!lastPasswordChange) return true;
    
    const now = new Date();
    const daysSinceLastChange = Math.floor(
      (now.getTime() - lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceLastChange >= 7;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
  };
  
  const handleNavigation = (screen: ScreenName) => {
    setActiveScreen(screen);
    if (screen === 'Home') {
      navigation.navigate('Home' as any);
    } else if (screen === 'Budget') {
      navigation.navigate('Budget' as any);
    } else if (screen === 'Transactions') {
      navigation.navigate('Transactions' as any);
    } else if (screen === 'Reports') {
      navigation.navigate('Reports' as any);
    }
  };

  const showConfirmDialog = (props: {
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    actionText?: string,
    onAction?: () => void,
  }) => {
    setDialogProps({
      type: props.type,
      title: props.title,
      message: props.message,
      actionText: props.actionText || 'OK',
      onAction: props.onAction || (() => setDialogVisible(false)),
    });
    setDialogVisible(true);
  };

  const handleLogoutPress = () => {
    showConfirmDialog({
      type: 'warning',
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your account?',
      actionText: 'Sign Out',
      onAction: handleLogout,
    });
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      
      // Properly clean up authentication state
      await logout();
      
      // Clear any additional tokens or cached data
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('token_expiry');
      
      // Reset any other session-related flags
      await AsyncStorage.removeItem('has_completed_onboarding');
      await AsyncStorage.removeItem('just_registered');
      
      // Reset the navigation stack completely to ensure a fresh login state
      // First, navigate to Login with animation disabled
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as keyof RootStackParamList }],
      });
      
      // Let the navigation complete and then reset auth state again
      setTimeout(() => {
        setLoading(false);
        setDialogVisible(false);
      }, 150);
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
      setLoading(false);
      setDialogVisible(false);
    }
  };

  const handleEditProfile = () => {
    setEditName(user?.name || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await apiService.updateUserProfile(editName);
      setUser(updatedUser);
      setShowEditModal(false);
      showConfirmDialog({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully',
        actionText: 'Great!',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    if (!canChangePassword()) {
      const daysToWait = 7 - Math.floor(
        (new Date().getTime() - (lastPasswordChange?.getTime() || 0)) / (1000 * 60 * 60 * 24)
      );
      
      showConfirmDialog({
        type: 'warning',
        title: 'Password Change Restricted',
        message: `You can only change your password once every 7 days. Please try again in ${daysToWait} day${daysToWait !== 1 ? 's' : ''}.`,
      });
      return;
    }
    
    // Reset state
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
    setPasswordStrength(null);
    setShowPasswordModal(true);
  };
  
  const handlePasswordChange = (password: string) => {
    setNewPassword(password);
    validatePassword(password);
    
    if (confirmPassword) {
      validateConfirmPassword(password, confirmPassword);
    }
  };
  
  const handleConfirmPasswordChange = (password: string) => {
    setConfirmPassword(password);
    validateConfirmPassword(newPassword, password);
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
  };
  
  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
  };
  
  const handleSavePassword = async () => {
    // Reset any previous errors
    setPasswordErrors({});
    
    // Validate inputs
    let hasError = false;
    
    if (!currentPassword) {
      setPasswordErrors(prev => ({
        ...prev,
        current: 'Current password is required'
      }));
      hasError = true;
    }
    
    if (!newPassword) {
      setPasswordErrors(prev => ({
        ...prev,
        new: 'New password is required'
      }));
      hasError = true;
    }
    
    if (!confirmPassword) {
      setPasswordErrors(prev => ({
        ...prev,
        confirm: 'Please confirm your password'
      }));
      hasError = true;
    }
    
    if (hasError) return;
    
    // Validate password strength and confirmation
    const isPasswordValid = validatePassword(newPassword);
    const isConfirmValid = validateConfirmPassword(newPassword, confirmPassword);
    
    if (!isPasswordValid || !isConfirmValid) return;
    
    // Check that new password is different from current
    if (currentPassword === newPassword) {
      setPasswordErrors(prev => ({
        ...prev,
        new: 'New password must be different from your current password'
      }));
      return;
    }
    
    try {
      setChangingPassword(true);
      await apiService.changePassword({
        currentPassword,
        newPassword,
      });
      
      // Store the date of password change
      await AsyncStorage.setItem('lastPasswordChange', new Date().toISOString());
      setLastPasswordChange(new Date());
      
      // Show success message within the modal
      setPasswordErrors({
        general: 'Password changed successfully!'
      });
      
      // Delay closing modal slightly for better feedback
      setTimeout(() => {
        setShowPasswordModal(false);
        showConfirmDialog({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully.',
        });
      }, 1000);
    } catch (err: any) {
      // Don't log the error to console since it will be shown in the UI
      // Display appropriate error message based on error type
      if (err.message.includes('Current password is incorrect')) {
        setPasswordErrors({
          current: 'Current password is incorrect'
        });
      } else {
        setPasswordErrors({
          general: err.message || 'Failed to change password. Please try again.'
        });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // Navigate to Contact Support
  const navigateToContactSupport = () => {
    navigation.navigate('ContactSupport');
  };

  // Open Privacy Policy screen
  const openPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  // Open Terms of Service screen
  const openTermsOfService = () => {
    navigation.navigate('TermsOfService');
  };
  
  // Get current currency name
  const getCurrentCurrencyName = () => {
    return currency.name;
  };
  
  // Fetch linked cards
  useEffect(() => {
    fetchLinkedCards();
  }, []);
  
  const fetchLinkedCards = async () => {
    try {
      const cards = await pesoPayService.getLinkedCards();
      
      // Validate that cards is an array
      if (!Array.isArray(cards)) {
        console.error('Invalid cards response:', cards);
        setLinkedCards([]);
        return;
      }
      
      // Transform the card data structure to match our expected schema
      const transformedCards = cards.map(card => {
        // Map _id to id if id doesn't exist but _id does
        if (card._id && !card.id) {
          return {
            ...card,
            id: card._id
          };
        }
        return card;
      });
      
      // Log the transformed card data for debugging
      console.log('Transformed cards data:', JSON.stringify(transformedCards));
      
      setLinkedCards(transformedCards);
    } catch (error) {
      console.error('Error fetching linked cards:', error);
      setLinkedCards([]);
    }
  };
  
  // Update the formatCardNumber function for even better handling
  const formatCardNumber = (input: string): string => {
    // Remove all non-digit characters first
    const digitsOnly = input.replace(/\D/g, '');
    
    // Limit to exactly 16 digits maximum
    const truncated = digitsOnly.slice(0, 16);
    
    // Format in groups of 4 with spaces
    let formatted = '';
    for (let i = 0; i < truncated.length; i++) {
      // Add space after every 4 digits
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += truncated[i];
    }
    
    return formatted;
  };

  // Check if card already exists to prevent duplicates
  const isCardAlreadyLinked = (cardNumber: string): boolean => {
    const normalizedNumber = cardNumber.replace(/\s/g, '');
    
    return linkedCards.some(card => {
      // For security, we only have the last 4 digits, so we check those
      const lastFour = normalizedNumber.slice(-4);
      return card.lastFourDigits === lastFour;
    });
  };

  // Detect card type based on first digit
  const detectCardType = (cardNumber: string): 'VISA' | 'MASTERCARD' | null => {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.startsWith('4')) {
      return 'VISA';
    } else if (digits.startsWith('5')) {
      return 'MASTERCARD';
    }
    
    return null;
  };

  // Validate card number using Luhn algorithm
  const validateCardNumber = (cardNumber: string): boolean => {
    const digits = cardNumber.replace(/\D/g, '');
    
    // Check card type first (only accept VISA and MASTERCARD)
    const cardType = detectCardType(digits);
    if (!cardType) {
      return false;
    }
    
    // Basic length check
    if (digits.length < 15 || digits.length > 16) {
      return false;
    }
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    
    if (digits.length <= 2) {
      return digits;
    }
    
    return `${digits.substring(0, 2)}/${digits.substring(2, 4)}`;
  };

  // Show a helpful info dialog about card usage in the app
  const showCardInfoDialog = () => {
    showConfirmDialog({
      type: 'info',
      title: 'Card Transactions',
      message: 'When you add a card, all transactions made with this card will be automatically reflected in your transaction history. This helps you track your spending and stay on budget.',
      actionText: 'Got it',
    });
  };
  
  const handleAddCard = async () => {
    try {
      // Set loading state
      setAddingCard(true);
      
      // Reset previous errors
      const errors: Record<string, string> = {};
      
      // Validate card data
      const cleanCardNumber = newCard.cardNumber.replace(/\s/g, '');
      
      if (!cleanCardNumber) {
        errors.cardNumber = 'Card number is required';
      } else if (!validateCardNumber(cleanCardNumber)) {
        errors.cardNumber = 'Invalid card number. Only Visa and Mastercard are accepted.';
      } else if (isCardAlreadyLinked(cleanCardNumber)) {
        errors.cardNumber = 'This card is already linked to your account';
      }
      
      if (!newCard.cardholderName) {
        errors.cardholderName = 'Cardholder name is required';
      }
      
      if (!newCard.expiryDate) {
        errors.expiryDate = 'Expiry date is required';
      } else {
        // Validate MM/YY format
        const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!regex.test(newCard.expiryDate)) {
          errors.expiryDate = 'Invalid format. Use MM/YY';
        } else {
          // Check if expired
          const [month, year] = newCard.expiryDate.split('/');
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear() % 100;
          const currentMonth = currentDate.getMonth() + 1;
          
          if (parseInt(year) < currentYear || 
              (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
            errors.expiryDate = 'Card has expired';
          }
        }
      }
      
      if (!newCard.cvv) {
        errors.cvv = 'CVV is required';
      } else if (!/^\d{3,4}$/.test(newCard.cvv)) {
        errors.cvv = 'CVV must be 3 or 4 digits';
      }
      
      // Bank name is now required (as per server validation)
      if (!newCard.bankName) {
        errors.bankName = 'Bank name is required';
      }
      
      if (Object.keys(errors).length > 0) {
        setCardErrors(errors);
        return;
      }
      
      // Prepare card data with clean number
      const cardData = {
        ...newCard,
        cardNumber: cleanCardNumber
      };
      
      await pesoPayService.linkCard(cardData);
      setShowAddCardModal(false);
      setNewCard({
        cardNumber: '',
        cardholderName: '',
        expiryDate: '',
        cvv: '',
        bankName: ''
      });
      setDetectedCardType(null);
      setIsCardValid(false);
      fetchLinkedCards();
      
      // Show enhanced success message
      showConfirmDialog({
        type: 'success',
        title: 'Card Added Successfully',
        message: 'Your card has been added and all transactions made with this card will now be tracked automatically.',
        actionText: 'Great!',
      });
    } catch (error) {
      console.error('Error adding card:', error);
      Alert.alert('Error', 'Failed to add card. Please try again.');
    } finally {
      setAddingCard(false);
    }
  };
  
  const handleRemoveCard = async (cardId: string) => {
    // Show confirmation dialog first
    showConfirmDialog({
      type: 'warning',
      title: 'Remove Card',
      message: 'Are you sure you want to remove this card? This action cannot be undone.',
      actionText: 'Remove',
      onAction: async () => {
        try {
          // Validate card ID is present
          if (!cardId) {
            console.error('Cannot remove card: invalid card ID');
            Alert.alert('Error', 'Could not remove card. Invalid card ID.');
        return;
      }
      
      await pesoPayService.removeCard(cardId);
      fetchLinkedCards();
          
          // Show success message
          showConfirmDialog({
            type: 'success',
            title: 'Card Removed',
            message: 'Your card has been removed successfully.',
          });
    } catch (error) {
      console.error('Error removing card:', error);
      Alert.alert('Error', 'Failed to remove card. Please try again.');
    }
      },
    });
  };

  // Render loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBackButton={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
        <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <AppHeader showBackButton={true} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchUserProfile}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile Info */}
            <View style={styles.profileInfoContainer}>
              <Ionicons name="person-circle" size={64} color={theme.colors.primary} style={styles.profileIcon} />
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
              <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
                <Text style={styles.editProfileText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Payment Methods Section */}
            <Text style={styles.sectionLabel}>Payment Methods</Text>

            {/* Linked Cards */}
              <View style={styles.settingsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Payment Cards</Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showCardInfoDialog}
                  >
                    <Ionicons name="information-circle-outline" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddCardModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              {linkedCards.map((card, index) => (
                <View key={card.id || `card-${index}`} style={styles.cardItem}>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTypeContainer}>
                      <Ionicons
                        name={card.cardType === 'VISA' ? 'card' : 'card-outline'}
                        size={24}
                        color={card.cardType === 'VISA' ? '#1A1F71' : '#EB001B'}
                        style={styles.settingsIcon}
                      />
                      <Text style={styles.cardType}>{card.cardType}</Text>
                    </View>
                    <Text style={styles.cardNumber}>•••• {card.lastFourDigits}</Text>
                    <Text style={styles.cardName}>{card.cardholderName}</Text>
                  </View>
                  
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => card.id ? handleRemoveCard(card.id) : Alert.alert('Error', 'Cannot remove this card.')}
                    >
                      <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              
              {linkedCards.length === 0 && (
                <Text style={styles.emptyText}>No cards linked</Text>
              )}
            </View>
            
            {/* Account Settings Section */}
            <Text style={styles.sectionLabel}>Account Settings</Text>
            
            <View style={styles.settingsSection}>
              {/* Security Settings */}
                <TouchableOpacity
                  style={styles.settingsItem}
                  onPress={handleChangePassword}
                  disabled={!canChangePassword()}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingsItemLeft}>
                    <Ionicons name="lock-closed-outline" size={22} color={theme.colors.primary} style={styles.settingsIcon} />
                    <View style={styles.settingsItemContent}>
                      <Text style={styles.settingsItemText}>Change Password</Text>
                      {!canChangePassword() && (
                        <Text style={styles.settingsItemSubtext}>
                          Available after 7 days from last change
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>

              {/* Currency Selection */}
                <TouchableOpacity 
                  style={styles.settingsItem} 
                  activeOpacity={0.7}
                  onPress={() => setShowCurrencyModal(true)}
                >
                  <View style={styles.settingsItemLeft}>
                    <Ionicons name="cash-outline" size={22} color="#4CAF50" style={styles.settingsIcon} />
                    <View style={styles.settingsItemContent}>
                      <Text style={styles.settingsItemText}>Currency</Text>
                      <Text style={styles.settingsItemSubtext}>{getCurrentCurrencyName()}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
              </View>

            {/* Help & Support Section */}
            <Text style={styles.sectionLabel}>Help & Support</Text>
            
              <View style={styles.settingsSection}>
                <TouchableOpacity style={styles.settingsItem} onPress={navigateToContactSupport} activeOpacity={0.7}>
                  <View style={styles.settingsItemLeft}>
                    <Ionicons name="chatbox-ellipses-outline" size={22} color="#9C27B0" style={styles.settingsIcon} />
                    <Text style={styles.settingsItemText}>Contact Support</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsItem} onPress={openPrivacyPolicy} activeOpacity={0.7}>
                  <View style={styles.settingsItemLeft}>
                    <Ionicons name="shield-checkmark-outline" size={22} color="#F44336" style={styles.settingsIcon} />
                    <Text style={styles.settingsItemText}>Privacy Policy</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsItem} onPress={openTermsOfService} activeOpacity={0.7}>
                  <View style={styles.settingsItemLeft}>
                    <Ionicons name="document-text-outline" size={22} color="#795548" style={styles.settingsIcon} />
                    <Text style={styles.settingsItemText}>Terms of Service</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleLogoutPress}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
            
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </>
        )}
      </ScrollView>
      <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
      
      {/* Edit Profile Modal */}
      {showEditModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.passwordModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {passwordErrors.general && (
                <View style={[
                  styles.errorBanner, 
                  passwordErrors.general.includes('successfully') && styles.successBanner
                ]}>
                  <Ionicons 
                    name={passwordErrors.general.includes('successfully') ? "checkmark-circle" : "alert-circle-outline"} 
                    size={20} 
                    color={passwordErrors.general.includes('successfully') ? theme.colors.success : theme.colors.error} 
                  />
                  <Text style={[
                    styles.errorBannerText,
                    passwordErrors.general.includes('successfully') && styles.successBannerText
                  ]}>{passwordErrors.general}</Text>
                </View>
              )}
              
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={[styles.input, passwordErrors.current && styles.inputError]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter your current password"
                secureTextEntry
              />
              {passwordErrors.current && (
                <Text style={styles.passwordError}>{passwordErrors.current}</Text>
              )}
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>New Password</Text>
              <TextInput
                style={[styles.input, passwordErrors.new && styles.inputError]}
                value={newPassword}
                onChangeText={handlePasswordChange}
                onFocus={handlePasswordFocus}
                onBlur={handlePasswordBlur}
                placeholder="Create a secure password"
                secureTextEntry
              />
              {passwordErrors.new && (
                <Text style={styles.passwordError}>{passwordErrors.new}</Text>
              )}
              
              {(isPasswordFocused || passwordStrength) && (
                <View style={styles.strengthContainer}>
                  <Text style={styles.strengthLabel}>
                    Password Strength: {
                      passwordStrength === 'weak' ? 'Weak' :
                      passwordStrength === 'medium' ? 'Medium' :
                      passwordStrength === 'strong' ? 'Strong' :
                      passwordStrength === 'very-strong' ? 'Very Strong' : 'Weak'
                    }
                  </Text>
                  <View style={styles.strengthMeter}>
                    <View 
                      style={[
                        styles.strengthIndicator, 
                        styles.strengthWeak,
                        passwordStrength && styles.strengthActive
                      ]} 
                    />
                    <View 
                      style={[
                        styles.strengthIndicator, 
                        styles.strengthMedium,
                        (passwordStrength === 'medium' || passwordStrength === 'strong' || passwordStrength === 'very-strong') && styles.strengthActive
                      ]} 
                    />
                    <View 
                      style={[
                        styles.strengthIndicator, 
                        styles.strengthStrong,
                        (passwordStrength === 'strong' || passwordStrength === 'very-strong') && styles.strengthActive
                      ]} 
                    />
                    <View 
                      style={[
                        styles.strengthIndicator, 
                        styles.strengthVeryStrong,
                        passwordStrength === 'very-strong' && styles.strengthActive
                      ]} 
                    />
                  </View>
                  <Text style={styles.passwordHint}>
                    Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
                  </Text>
                </View>
              )}
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, passwordErrors.confirm && styles.inputError]}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholder="Confirm your new password"
                secureTextEntry
              />
              {passwordErrors.confirm && (
                <Text style={styles.passwordError}>{passwordErrors.confirm}</Text>
              )}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPasswordModal(false)}
                disabled={changingPassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Confirmation Dialog */}
      <MessageDialog
        visible={dialogVisible}
        type={dialogProps.type}
        title={dialogProps.title}
        message={dialogProps.message}
        onDismiss={() => setDialogVisible(false)}
        onAction={dialogProps.onAction}
        actionText={dialogProps.actionText}
        autoDismiss={dialogProps.type === 'success'}
      />
      
      {/* Currency List Modal */}
      {showCurrencyModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { width: width * 0.85 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity
                onPress={() => setShowCurrencyModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.currencyList}>
              {SUPPORTED_CURRENCIES.map((currencyItem) => (
                <TouchableOpacity 
                  key={currencyItem.symbol}
                  style={styles.currencyItem}
                  onPress={async () => {
                    await setCurrency(currencyItem.symbol);
                    setShowCurrencyModal(false);
                  }}
                >
                  <View style={styles.currencyItemContent}>
                    <Text style={styles.currencySymbol}>{currencyItem.symbol}</Text>
                    <Text style={styles.currencyName}>{currencyItem.name}</Text>
                  </View>
                  
                  {currency.symbol === currencyItem.symbol && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Add Card Modal */}
      {showAddCardModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Card</Text>
              <TouchableOpacity
                onPress={() => setShowAddCardModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={theme.colors.primary} style={{marginRight: 8}} />
                <Text style={styles.infoText}>
                  Transactions made with this card will be automatically tracked in your transaction history.
                </Text>
              </View>
              
              <Text style={styles.inputLabel}>Card Number</Text>
              <View style={styles.cardInputContainer}>
                {detectedCardType && (
                  <Ionicons 
                    name={detectedCardType === 'VISA' ? 'card' : 'card-outline'} 
                    size={24} 
                    color={detectedCardType === 'VISA' ? '#1A1F71' : '#EB001B'} 
                    style={styles.cardTypeIcon}
                  />
                )}
              <TextInput
                  style={[
                    styles.input, 
                    cardErrors.cardNumber && styles.inputError,
                    detectedCardType && styles.inputWithIcon,
                    isCardValid && styles.inputValid
                  ]}
                value={newCard.cardNumber}
                onChangeText={(text) => {
                    // Skip processing if text contains invalid characters
                    if (!/^[\d\s]*$/.test(text) && text !== '') {
                      return;
                    }
                    
                    // Format the card number properly (this also handles cleaning)
                    const formattedText = formatCardNumber(text);
                    
                    // Guard against strange input by ensuring we only update with valid format
                    if (formattedText !== newCard.cardNumber || text === '') {
                      // Update card state
                      setNewCard(prev => ({ ...prev, cardNumber: formattedText }));
                    }
                    
                    // Only continue validation if we have a value
                    if (formattedText) {
                      // Clear previous errors
                      setCardErrors(prev => ({ ...prev, cardNumber: '' }));
                      
                      // Get clean number for validation
                      const cleanNumber = formattedText.replace(/\s/g, '');
                      
                      // Check for duplicates - early detection
                      const isDuplicate = isCardAlreadyLinked(cleanNumber);
                      if (isDuplicate && cleanNumber.length >= 4) {
                        setValidationMessage('This card is already linked to your account');
                        setIsCardValid(false);
                        return;
                      }
                      
                      // Detect card type
                      const cardType = detectCardType(cleanNumber);
                      setDetectedCardType(cardType);
                      
                      // Validate the card number
                      const isValid = validateCardNumber(cleanNumber);
                      setIsCardValid(isValid);
                      
                      // Set appropriate validation message
                      if (cleanNumber.length === 0) {
                        setValidationMessage(null);
                      } else if (cardType === null) {
                        setValidationMessage('Only Visa and Mastercard are accepted');
                      } else if (cleanNumber.length < 16) {
                        setValidationMessage('Please enter all 16 digits');
                      } else if (isValid) {
                        setValidationMessage('Valid card number');
                      } else {
                        setValidationMessage('Invalid card number');
                      }
                    } else {
                      // Reset state if input is empty
                      setValidationMessage(null);
                      setDetectedCardType(null);
                      setIsCardValid(false);
                    }
                  }}
                  placeholder="XXXX XXXX XXXX XXXX"
                keyboardType="numeric"
                  maxLength={19} // 16 digits + 3 spaces
                  autoComplete="cc-number"
              />
              </View>
              {cardErrors.cardNumber && (
                <Text style={styles.errorText}>{cardErrors.cardNumber}</Text>
              )}
              {!cardErrors.cardNumber && validationMessage && (
                <Text 
                  style={[
                    styles.validationText,
                    validationMessage === 'Valid card number' ? styles.validText : styles.warningText
                  ]}
                >
                  {validationMessage}
                </Text>
              )}
              {detectedCardType && !cardErrors.cardNumber && (
                <Text style={styles.cardTypeText}>
                  {detectedCardType === 'VISA' ? 'Visa' : 'Mastercard'} card detected
                </Text>
              )}
              
              <Text style={styles.inputLabel}>Cardholder Name</Text>
              <TextInput
                style={[styles.input, cardErrors.cardholderName && styles.inputError]}
                value={newCard.cardholderName}
                onChangeText={(text) => {
                  setNewCard(prev => ({ ...prev, cardholderName: text }));
                  if (text) setCardErrors(prev => ({ ...prev, cardholderName: '' }));
                }}
                placeholder="Enter cardholder name"
                autoCapitalize="words"
              />
              {cardErrors.cardholderName && (
                <Text style={styles.errorText}>{cardErrors.cardholderName}</Text>
              )}
              
                  <Text style={styles.inputLabel}>Expiry Date</Text>
                  <TextInput
                    style={[styles.input, cardErrors.expiryDate && styles.inputError]}
                    value={newCard.expiryDate}
                    onChangeText={(text) => {
                  // Format expiry date
                  const formattedText = formatExpiryDate(text);
                  
                  setNewCard(prev => ({ ...prev, expiryDate: formattedText }));
                  if (formattedText) setCardErrors(prev => ({ ...prev, expiryDate: '' }));
                    }}
                    placeholder="MM/YY"
                keyboardType="numeric"
                    maxLength={5}
                  />
                  {cardErrors.expiryDate && (
                    <Text style={styles.errorText}>{cardErrors.expiryDate}</Text>
                  )}
                
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={[styles.input, cardErrors.cvv && styles.inputError]}
                    value={newCard.cvv}
                    onChangeText={(text) => {
                      setNewCard(prev => ({ ...prev, cvv: text }));
                      if (text) setCardErrors(prev => ({ ...prev, cvv: '' }));
                    }}
                    placeholder="CVV"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                  {cardErrors.cvv && (
                    <Text style={styles.errorText}>{cardErrors.cvv}</Text>
                  )}
              
              <Text style={styles.inputLabel}>Bank Name</Text>
              <TextInput
                style={[styles.input, cardErrors.bankName && styles.inputError]}
                value={newCard.bankName}
                onChangeText={(text) => {
                  setNewCard(prev => ({ ...prev, bankName: text }));
                  if (text) setCardErrors(prev => ({ ...prev, bankName: '' }));
                }}
                placeholder="Enter bank name"
              />
              {cardErrors.bankName && (
                <Text style={styles.errorText}>{cardErrors.bankName}</Text>
              )}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddCardModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddCard}
                disabled={addingCard}
              >
                {addingCard ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                <Text style={styles.saveButtonText}>Add Card</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textLight,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Profile Info
  profileInfoContainer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
    backgroundColor: theme.colors.white,
  },
  profileIcon: {
    marginBottom: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  editProfileButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  editProfileText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textLight,
    fontSize: 15,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 20,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  settingsContainer: {
    paddingHorizontal: 0,
  },
  settingsSection: {
    marginBottom: 18,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    marginRight: 16,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  settingsItemSubtext: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  signOutButton: {
    marginTop: 32,
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
    backgroundColor: theme.colors.error,
    marginBottom: 8,
    elevation: 2,
  },
  signOutText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  versionText: {
    textAlign: 'center',
    color: theme.colors.textLight,
    fontSize: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  
  // Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    width: width * 0.88,
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textLight,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    color: theme.colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    color: theme.colors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Password modal styles
  passwordModalContainer: {
    maxHeight: height * 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: theme.colors.error,
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  passwordError: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  strengthContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  strengthLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 6,
  },
  strengthMeter: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  strengthIndicator: {
    flex: 1,
    marginHorizontal: 2,
    backgroundColor: theme.colors.lightGray,
  },
  strengthActive: {
    opacity: 1,
  },
  strengthWeak: {
    backgroundColor: theme.colors.error,
    opacity: 0.3,
  },
  strengthMedium: {
    backgroundColor: theme.colors.warning,
    opacity: 0.3,
  },
  strengthStrong: {
    backgroundColor: theme.colors.success,
    opacity: 0.3,
  },
  strengthVeryStrong: {
    backgroundColor: '#4CAF50',
    opacity: 0.3,
  },
  passwordHint: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: 'rgba(156, 255, 156, 0.1)',
  },
  successBannerText: {
    color: theme.colors.success,
  },
  
  // Currency selection modal styles
  currencyList: {
    padding: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  currencyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: 16,
    width: 30,
    textAlign: 'center',
  },
  currencyName: {
    fontSize: 16,
    color: theme.colors.text,
  },
  
  // Payment Methods Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  addButton: {
    padding: 4,
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  cardInfo: {
    flex: 1,
  },
  cardTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginLeft: 8,
  },
  cardNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 48,
  },
  cardInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTypeIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  inputWithIcon: {
    paddingLeft: 44,
  },
  cardTypeText: {
    fontSize: 12,
    color: theme.colors.success,
    marginTop: 4,
    marginLeft: 2,
  },
  inputValid: {
    borderColor: theme.colors.success,
  },
  validationText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  validText: {
    color: theme.colors.success,
  },
  warningText: {
    color: theme.colors.warning,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    padding: 8,
    marginRight: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
} as const);

export default AccountScreen; 