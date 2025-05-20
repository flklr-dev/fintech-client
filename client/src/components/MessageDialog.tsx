import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface MessageDialogProps {
  visible: boolean;
  type: MessageType;
  title: string;
  message: string;
  onDismiss: () => void;
  onAction?: () => void;
  actionText?: string;
  autoDismiss?: boolean;
  autoDismissTimeout?: number;
}

const MessageDialog: React.FC<MessageDialogProps> = ({
  visible,
  type,
  title,
  message,
  onDismiss,
  onAction,
  actionText,
  autoDismiss = false,
  autoDismissTimeout = 3000,
}) => {
  useEffect(() => {
    if (visible && autoDismiss) {
      const timer = setTimeout(() => {
        if (onAction) {
          onAction();
        } else {
          onDismiss();
        }
      }, autoDismissTimeout);
      
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismiss, autoDismissTimeout, onDismiss, onAction]);

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
        return theme.colors.primary;
      default:
        return theme.colors.primary;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(76, 175, 80, 0.15)';
      case 'error':
        return 'rgba(255, 82, 82, 0.15)';
      case 'warning':
        return 'rgba(255, 193, 7, 0.15)';
      case 'info':
        return 'rgba(108, 99, 255, 0.15)';
      default:
        return 'rgba(108, 99, 255, 0.15)';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={styles.dialogContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconBackground,
                  { backgroundColor: getBackgroundColor() }
                ]}
              >
                <Ionicons 
                  name={getIconName()} 
                  size={36} 
                  color={getIconColor()} 
                />
              </View>
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            {!autoDismiss && (
              <View style={styles.buttonContainer}>
                {onAction && actionText ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.dismissButton]}
                      onPress={onDismiss}
                    >
                      <Text style={styles.dismissButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.actionButton, { backgroundColor: getIconColor() }]}
                      onPress={onAction}
                    >
                      <Text style={styles.actionButtonText}>{actionText}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.singleButton, { backgroundColor: getIconColor() }]}
                    onPress={onDismiss}
                  >
                    <Text style={styles.actionButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: width * 0.85,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  iconBackground: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: theme.spacing.sm,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  dismissButton: {
    backgroundColor: theme.colors.lightGray,
  },
  dismissButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
  },
  singleButton: {
    width: '100%',
    backgroundColor: theme.colors.primary,
  },
  actionButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MessageDialog; 