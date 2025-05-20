import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

interface AppHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  showProfile?: boolean;
  onProfilePress?: () => void;
  headerTitle?: string;
  title?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AppHeader: React.FC<AppHeaderProps> = ({
  showBackButton = false,
  onBackPress,
  rightIcon,
  onRightIconPress,
  showProfile = true,
  onProfilePress,
  headerTitle,
  title,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      navigation.navigate('Account');
    }
  };

  // Only show profile icon if not on Account screen and showProfile is true
  const showProfileIcon = showProfile && route.name !== 'Account';

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#3770FF"
        barStyle="light-content"
      />
      
      <View style={styles.headerContent}>
        <View style={styles.leftContainer}>
          {showBackButton ? (
            <TouchableOpacity style={styles.iconButton} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Fintech</Text>
              <View style={styles.dotAccent}></View>
            </View>
          )}
          
          {headerTitle && (
            <Text style={styles.headerTitle}>{headerTitle}</Text>
          )}
        </View>

        <View style={styles.rightContainer}>
          {rightIcon && (
            <TouchableOpacity style={styles.iconButton} onPress={onRightIconPress}>
              <Ionicons name={rightIcon} size={22} color={theme.colors.white} />
            </TouchableOpacity>
          )}

          {showProfileIcon && (
            <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
              <View style={styles.profileAvatar}>
                {user?.name ? (
                  <Text style={styles.profileInitials}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person" size={18} color={theme.colors.white} />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3770FF',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 8,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: theme.colors.white,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  dotAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    marginLeft: 4,
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  profileButton: {
    marginLeft: 6,
    padding: 2,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  profileInitials: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppHeader; 