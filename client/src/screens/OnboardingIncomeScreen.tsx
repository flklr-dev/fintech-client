import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useCurrency } from '../contexts/CurrencyContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OnboardingIncomeScreen = () => {
  const navigation = useNavigation();
  const { currency, formatCurrency } = useCurrency();
  const [income, setIncome] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  
  // Animation value for button scale
  const buttonScale = React.useRef(new Animated.Value(1)).current;
  
  // Handle continue button press
  const handleContinue = async () => {
    // Validate income
    if (!income || parseFloat(income) <= 0) {
      return;
    }
    
    // Animate button press
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Save income data
    try {
      await AsyncStorage.setItem('user_income', income);
      await AsyncStorage.setItem('income_frequency', frequency);
      
      // Navigate to budget setup screen
      navigation.navigate('OnboardingBudget' as never);
    } catch (error) {
      console.error('Error saving income data:', error);
    }
  };
  
  // Handle frequency selection
  const handleSelectFrequency = (selected: 'monthly' | 'weekly' | 'yearly') => {
    setFrequency(selected);
  };
  
  // Format display income if needed
  const getIncomeDisplay = () => {
    if (!income) return '';
    const value = parseFloat(income);
    if (isNaN(value)) return income;
    return formatCurrency(value);
  };
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepText, { color: theme.colors.white }]}>Step 2 of 3</Text>
            <Text style={[styles.title, { color: theme.colors.white }]}>Set Your Income</Text>
            <Text style={[styles.subtitle, { color: theme.colors.white }]}>
              This helps us personalize your budgeting experience
            </Text>
          </View>
          
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.incomeInputContainer}>
              <Text style={styles.currencySymbol}>{currency.symbol}</Text>
              <TextInput
                style={styles.incomeInput}
                value={income}
                onChangeText={text => {
                  // Remove any non-numeric characters except decimal point
                  const cleanedText = text.replace(/[^0-9.]/g, '');
                  // Ensure only one decimal point
                  const parts = cleanedText.split('.');
                  if (parts.length > 2) {
                    setIncome(parts[0] + '.' + parts.slice(1).join(''));
                  } else {
                    setIncome(cleanedText);
                  }
                }}
                placeholder="0.00"
                keyboardType="numeric"
                autoFocus
              />
            </View>
            
            <View style={styles.frequencyContainer}>
              <Text style={styles.frequencyLabel}>Income Frequency</Text>
              
              <View style={styles.frequencyButtons}>
                <TouchableOpacity 
                  style={[
                    styles.frequencyButton,
                    frequency === 'monthly' && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => handleSelectFrequency('monthly')}
                >
                  <Text 
                    style={[
                      styles.frequencyButtonText,
                      frequency === 'monthly' && styles.frequencyButtonTextSelected,
                    ]}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.frequencyButton,
                    frequency === 'weekly' && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => handleSelectFrequency('weekly')}
                >
                  <Text 
                    style={[
                      styles.frequencyButtonText,
                      frequency === 'weekly' && styles.frequencyButtonTextSelected,
                    ]}
                  >
                    Weekly
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.frequencyButton,
                    frequency === 'yearly' && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => handleSelectFrequency('yearly')}
                >
                  <Text 
                    style={[
                      styles.frequencyButtonText,
                      frequency === 'yearly' && styles.frequencyButtonTextSelected,
                    ]}
                  >
                    Yearly
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.textLight} />
              <Text style={styles.infoText}>
                Your income information is stored locally and helps us provide better budget recommendations.
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <Animated.View
              style={[
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.button,
                  (!income || parseFloat(income) <= 0) && styles.buttonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!income || parseFloat(income) <= 0}
              >
                <Text style={styles.buttonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 32,
    backgroundColor: theme.colors.primary,
    marginBottom: 24,
  },
  stepText: {
    fontSize: 14,
    color: theme.colors.white,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.white,
    opacity: 0.8,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  incomeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginRight: 8,
  },
  incomeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    padding: 0,
  },
  frequencyContainer: {
    marginBottom: 24,
  },
  frequencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  frequencyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  frequencyButton: {
    flex: 1,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  frequencyButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  frequencyButtonTextSelected: {
    color: theme.colors.white,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textLight,
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 36,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default OnboardingIncomeScreen; 