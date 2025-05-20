import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface PasswordStrengthMeterProps {
  password: string;
  visible: boolean;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ 
  password, 
  visible 
}) => {
  if (!visible || !password) {
    return null;
  }

  // Check password criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  // Calculate strength score (0-4)
  let strengthScore = 0;
  if (hasMinLength) strengthScore++;
  if (hasUppercase) strengthScore++;
  if (hasLowercase) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasSpecial) strengthScore++;
  
  // Map score to levels for display
  const strengthLevel = 
    strengthScore === 0 ? { label: 'Very Weak', color: theme.colors.error } :
    strengthScore <= 2 ? { label: 'Weak', color: theme.colors.error } :
    strengthScore <= 3 ? { label: 'Medium', color: theme.colors.warning } :
    strengthScore === 4 ? { label: 'Strong', color: theme.colors.success } :
    { label: 'Very Strong', color: theme.colors.success };
  
  // Calculate percentage for progress bar
  const strengthPercentage = (strengthScore / 5) * 100;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Strength</Text>
      
      <View style={styles.progressContainer}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${strengthPercentage}%`,
              backgroundColor: strengthLevel.color
            }
          ]} 
        />
      </View>
      
      <Text style={[styles.strengthText, { color: strengthLevel.color }]}>
        {strengthLevel.label}
      </Text>
      
      <View style={styles.criteriaContainer}>
        <CriteriaItem 
          text="At least 8 characters" 
          met={hasMinLength} 
        />
        <CriteriaItem 
          text="Uppercase letter (A-Z)" 
          met={hasUppercase} 
        />
        <CriteriaItem 
          text="Lowercase letter (a-z)" 
          met={hasLowercase} 
        />
        <CriteriaItem 
          text="Number (0-9)" 
          met={hasNumber} 
        />
        <CriteriaItem 
          text="Special character (!@#$...)" 
          met={hasSpecial} 
        />
      </View>
    </View>
  );
};

// Helper component for criteria items
interface CriteriaItemProps {
  text: string;
  met: boolean;
}

const CriteriaItem: React.FC<CriteriaItemProps> = ({ text, met }) => (
  <View style={styles.criteriaItem}>
    <View 
      style={[
        styles.criteriaCheckbox,
        { backgroundColor: met ? theme.colors.success : theme.colors.lightGray }
      ]}
    >
      {met && <Text style={styles.checkmark}>✓</Text>}
    </View>
    <Text style={[
      styles.criteriaText,
      { color: met ? theme.colors.text : theme.colors.textLight }
    ]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  progressContainer: {
    height: 8,
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: '100%',
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
    textAlign: 'right',
  },
  criteriaContainer: {
    marginTop: theme.spacing.xs,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  criteriaCheckbox: {
    width: 18,
    height: 18,
    borderRadius: theme.borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkmark: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  criteriaText: {
    fontSize: 12,
  },
});

export default PasswordStrengthMeter; 