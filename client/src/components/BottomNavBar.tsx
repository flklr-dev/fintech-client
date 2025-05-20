import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export type ScreenName = 'Home' | 'Budget' | 'Transactions' | 'Reports';

interface BottomNavBarProps {
  activeScreen: ScreenName;
  onPress: (screen: ScreenName) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeScreen, onPress }) => {
  const tabs = [
    { name: 'Home', icon: 'home-outline' },
    { name: 'Budget', icon: 'wallet-outline' },
    { name: 'Transactions', icon: 'swap-horizontal-outline' },
    { name: 'Reports', icon: 'bar-chart-outline' },
  ] as const;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tab}
          onPress={() => onPress(tab.name as ScreenName)}
        >
          <Ionicons
            name={tab.icon}
            size={24}
            color={activeScreen === tab.name ? theme.colors.primary : theme.colors.textLight}
          />
          <Text
            style={[
              styles.tabText,
              activeScreen === tab.name && styles.activeTabText,
            ]}
          >
            {tab.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 4,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});

export default BottomNavBar; 