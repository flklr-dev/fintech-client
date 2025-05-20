import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Image, 
  ActivityIndicator,
  View
} from 'react-native';
import { theme } from '../theme';

interface GoogleButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  label?: string;
}

const GoogleButton: React.FC<GoogleButtonProps> = ({ 
  onPress, 
  isLoading = false,
  label = 'Continue with Google'
}) => {
  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <View style={styles.buttonContent}>
          <Image 
            source={require('../assets/google-icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 50,
    ...theme.shadows.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: theme.spacing.sm,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
});

export default GoogleButton; 