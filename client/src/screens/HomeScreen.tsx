import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { observer } from 'mobx-react';
import { runInAction } from 'mobx';
import { useNavigation } from '../hooks/useNavigation';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import AppHeader from '../components/AppHeader';
import BottomNavBar from '../components/BottomNavBar';
import { authViewModel } from '../viewmodels/authViewModel';
import { authService } from '../services/apiService';
import MessageDialog from '../components/MessageDialog';
import { ScreenName } from '../components/BottomNavBar';
import api from '../api/api';
import { format } from 'date-fns';
import { budgetService } from '../services/budgetService';
import { useCurrency } from '../contexts/CurrencyContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const HomeScreen = observer(() => {
  const navigation = useNavigation();
  const [activeScreen, setActiveScreen] = useState<ScreenName>('Home');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();
  
  // Data states
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(1000);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogProps, setDialogProps] = useState({
    type: 'error' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: '',
    onAction: () => {},
  });

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Check authentication and load data on mount
  useEffect(() => {
    const initializeScreen = async () => {
      console.log('HomeScreen: Initializing screen...');
      
      // First ensure the token is properly set in API headers
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          console.log('HomeScreen: Setting token in API headers directly');
          // Ensure token has Bearer prefix
          const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
          api.defaults.headers.common['Authorization'] = authHeader;
        } else {
          console.warn('HomeScreen: No token found in AsyncStorage');
        }
      } catch (tokenErr) {
        console.error('HomeScreen: Error setting token:', tokenErr);
      }
      
      // Then check authentication
      const isAuthenticated = await checkAuthentication();
      
      // Only fetch data if authenticated
      if (isAuthenticated) {
        console.log('HomeScreen: User is authenticated, fetching data...');
        await fetchAllData();
      } else {
        console.log('HomeScreen: User is not authenticated, stopping initialization');
      }
    };
    
    // Set a timeout to show retry button if loading takes too long
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('HomeScreen: Loading timeout reached, showing retry button');
        setLoadingTimeout(true);
      }
    }, 6000);
    
    initializeScreen();
    
    return () => clearTimeout(timeoutId);
  }, []);

  const checkAuthentication = async () => {
    try {
      // Check if user is logged in with a valid session
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('HomeScreen: No token found during authentication check');
        showDialog({
          type: 'error',
          title: 'Session Expired',
          message: 'Your session has expired. Please login again.',
          actionText: 'Login',
          onAction: async () => {
            await handleLogout();
          }
        });
        return false;
      }
      
      // Try a simple API call to verify token is working
      try {
        console.log('HomeScreen: Testing token with /transactions endpoint');
        // Use a simple, fast endpoint to test if the token works
        await api.get('/transactions', { 
          params: { limit: 1 },
          timeout: 3000 
        });
        console.log('HomeScreen: Token is valid, user is logged in');
        
        // If we get here, the token is working
        runInAction(() => {
          authViewModel.isLoggedIn = true;
        });
        
        // Try to load user data in the background
        try {
          const userData = await authService.getStoredUserData();
          if (userData) {
            console.log('HomeScreen: Using stored user data:', userData.name);
            runInAction(() => {
              authViewModel.userId = userData.id;
              authViewModel.userName = userData.name;
              authViewModel.email = userData.email;
            });
          } else {
            console.log('HomeScreen: No stored user data, using default values');
            // Set default values to prevent UI issues
            runInAction(() => {
              authViewModel.userId = 'user-id';
              authViewModel.userName = 'User';
              authViewModel.email = 'user@example.com';
            });
          }
        } catch (err) {
          console.error('HomeScreen: Error loading stored user data:', err);
        }
        
        return true;
      } catch (apiError) {
        console.error('HomeScreen: API call failed during auth check:', apiError);
        showDialog({
          type: 'error',
          title: 'Authentication Error',
          message: 'We could not verify your login. Please login again.',
          actionText: 'Login',
          onAction: async () => {
            await handleLogout();
          }
        });
        return false;
      }
    } catch (error) {
      console.error('HomeScreen: Authentication check error:', error);
      return false;
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Create timeout promises for each fetch operation
      const timeoutDuration = 5000; // 5 seconds timeout
      const createTimeoutPromise = () => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Data fetch timeout')), timeoutDuration)
        );
      
      // Wrap each promise with a race against timeout
      const summary = Promise.race([fetchTransactionSummary(), createTimeoutPromise()]);
      const transactions = Promise.race([fetchRecentTransactions(), createTimeoutPromise()]);
      const budgets = Promise.race([fetchBudgets(), createTimeoutPromise()]);
      
      // Execute them in parallel but handle individual failures
      const results = await Promise.allSettled([summary, transactions, budgets]);
      
      // Log any rejected promises
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const apiName = ['transaction summary', 'recent transactions', 'budgets'][index];
          console.error(`Failed to fetch ${apiName}:`, result.reason);
        }
      });
      
      // Continue even if some requests failed
      if (results.every(r => r.status === 'rejected')) {
        throw new Error('All data fetching operations failed');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showDialog({
        type: 'error',
        title: 'Data Error',
        message: 'Failed to fetch your financial data. Please try again.',
        actionText: 'Retry',
        onAction: fetchAllData
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionSummary = async () => {
    try {
      // Get the first and last day of current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Format dates for API
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      console.log('Fetching transactions from', startDate, 'to', endDate);
      
      // Fetch transactions
      const response = await api.get('/transactions', {
        params: { 
          startDate,
          endDate
        }
      });
      
      // Get all transactions for the period
      const allTransactions = response.data.data.transactions || [];
      
      console.log('Fetched transactions:', allTransactions.length);
      
      // Separate transactions by type
      const incomeTransactions = allTransactions.filter(
        (transaction: any) => transaction.type === 'income'
      );
      
      const expenseTransactions = allTransactions.filter(
        (transaction: any) => transaction.type === 'expense'
      );
      
      console.log('Income transactions:', incomeTransactions.length);
      console.log('Expense transactions:', expenseTransactions.length);
      
      // Calculate totals
      const income = incomeTransactions.reduce(
        (sum: number, t: any) => sum + t.amount, 0
      );
      
      const expenses = expenseTransactions.reduce(
        (sum: number, t: any) => sum + t.amount, 0
      );
      
      console.log('Total income:', income);
      console.log('Total expenses:', expenses);
      
      // Update state
      setMonthlyIncome(income);
      setMonthlyExpenses(expenses);
      setTotalBalance(income - expenses);
      
      // For savings, it's Total Income - Total Expenses
      setCurrentSavings(income - expenses);
    } catch (error) {
      console.error('Error fetching transaction summary:', error);
      throw error;
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await api.get('/transactions', {
        params: { limit: 5, sort: '-date' }
      });
      
      setRecentTransactions(response.data.data.transactions);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  };

  const fetchBudgets = async () => {
    try {
      const budgetsWithSpending = await budgetService.getBudgets();
      
      // Sort budgets by percentage spent (closest to 100% first)
      const sortedBudgets = [...budgetsWithSpending].sort((a, b) => {
        const percentageA = calculatePercentage(a.currentSpending || 0, a.amount);
        const percentageB = calculatePercentage(b.currentSpending || 0, b.amount);
        
        // Sort by how close to 100% each budget is (avoiding over-budget taking priority)
        const distanceToFullA = Math.abs(100 - percentageA);
        const distanceToFullB = Math.abs(100 - percentageB);
        
        // Put budgets close to 100% (but not over) at top, followed by over-budget items
        if (percentageA <= 100 && percentageB > 100) return -1;
        if (percentageA > 100 && percentageB <= 100) return 1;
        
        // Within each group (under or over budget), sort by closest to 100%
        return distanceToFullA - distanceToFullB;
      });
      
      setBudgets(sortedBudgets);
      
      // Calculate total budget allocations
      const totalBudgetAmount = budgetsWithSpending.reduce(
        (sum, budget) => sum + budget.amount, 0
      );
      
      // Calculate remaining budget
      const totalSpent = budgetsWithSpending.reduce(
        (sum, budget) => sum + (budget.currentSpending || 0), 0
      );
      
      setRemainingBudget(totalBudgetAmount - totalSpent);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      throw error;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNavigation = (screen: ScreenName) => {
    setActiveScreen(screen);
    if (screen === 'Budget') {
      navigation.navigate('Budget' as any);
    } else if (screen === 'Transactions') {
      navigation.navigate('Transactions' as any);
    } else if (screen === 'Reports') {
      navigation.navigate('Reports' as any);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      
      // First perform the logout action through the viewModel
      await authViewModel.logout();
      
      // Then navigate using reset to clear the navigation stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      // Show error dialog if logout fails
      showDialog({
        type: 'error',
        title: 'Logout Error',
        message: 'Failed to log out. Please try again.',
        actionText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = () => {
    // @ts-ignore - ignoring type mismatch for navigation params
    navigation.navigate('Transactions', { showAddModal: true });
  };

  const handleCreateBudget = () => {
    // Navigate to the Budget screen
    navigation.navigate('Budget' as any); // Using 'as any' to fix type issues
  };

  const handleProfilePress = () => {
    navigation.navigate('Account');
  };

  // Helper function to show dialog
  const showDialog = ({ type, title, message, actionText, onAction }: {
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    actionText?: string,
    onAction?: () => void,
  }) => {
    setDialogProps({
      type,
      title,
      message,
      actionText: actionText || '',
      onAction: onAction || (() => {}),
    });
    setDialogVisible(true);
  };

  // Calculate percentage for progress bars
  const calculatePercentage = (spent: number, budget: number) => {
    if (!budget || budget <= 0) return 0;
    const percentage = (spent / budget) * 100;
    return percentage > 100 ? 100 : percentage;
  };

  // Get an appropriate icon for a category
  const getCategoryIcon = (category: string): any => {
    const iconMap: {[key: string]: any} = {
      'Food & Dining': 'restaurant-outline',
      'Transport': 'car-outline',
      'Utilities': 'flash-outline',
      'Entertainment': 'film-outline',
      'Shopping': 'cart-outline',
      'Healthcare': 'medical-outline',
      'Education': 'school-outline',
      'Other': 'ellipsis-horizontal-outline',
      'Salary': 'cash-outline',
      'Investments': 'trending-up-outline',
      'Bonus': 'gift-outline',
      'Refund': 'arrow-undo-outline',
      'Freelance': 'laptop-outline',
      'Allowance': 'wallet-outline',
      'Gift': 'gift-outline',
      'Interest': 'analytics-outline',
      'Rental Income': 'home-outline',
      'Side Hustle': 'briefcase-outline'
    };
    
    return iconMap[category] || 'help-circle-outline';
  };

  // Get a color for a category
  const getCategoryColor = (category: string): string => {
    const colorMap: {[key: string]: string} = {
      'Food & Dining': '#4CAF50',
      'Transport': '#2196F3',
      'Utilities': '#FF9800',
      'Entertainment': '#9C27B0',
      'Shopping': '#3F51B5',
      'Healthcare': '#E91E63',
      'Education': '#009688',
      'Other': '#607D8B',
      'Salary': '#4CAF50',
      'Investments': '#3F51B5',
      'Bonus': '#E91E63',
      'Refund': '#009688',
      'Freelance': '#00BCD4',
      'Allowance': '#8BC34A',
      'Gift': '#FF4081',
      'Interest': '#7E57C2',
      'Rental Income': '#FF5722',
      'Side Hustle': '#00BCD4'
    };
    
    return colorMap[category] || '#607D8B';
  };

  // Format date for display
  const formatTransactionDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your financial data...</Text>
          
          {loadingTimeout && (
            <View style={styles.timeoutContainer}>
              <Text style={styles.timeoutText}>
                This is taking longer than usual.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoadingTimeout(false);
                  fetchAllData();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        showProfile={true}
        onProfilePress={handleProfilePress}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Welcome, {authViewModel.userName || 'User'}!
          </Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>
        
        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Total Balance</Text>
            <TouchableOpacity style={styles.eyeButton}>
              <Ionicons name="eye-outline" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(totalBalance)}</Text>
        </View>
        
        {/* Call-to-Action Buttons */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity 
            style={[styles.ctaButton, styles.expenseButton]} 
            onPress={handleAddTransaction}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Add Transaction</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.ctaButton, styles.budgetButton]} 
            onPress={handleCreateBudget}
          >
            <Ionicons name="wallet-outline" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Create Budget</Text>
          </TouchableOpacity>
        </View>
        
        {/* Financial Summary Cards */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          
          <View style={styles.financialCards}>
            <View style={[styles.summaryCard, styles.cardShadow]}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="arrow-up-outline" size={18} color={theme.colors.success} />
              </View>
              <Text style={styles.cardLabel}>Income</Text>
              <Text style={styles.cardAmount}>{formatCurrency(monthlyIncome)}</Text>
              <Text style={styles.cardPeriod}>This Month</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.cardShadow]}>
              <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(255, 82, 82, 0.1)' }]}>
                <Ionicons name="arrow-down-outline" size={18} color={theme.colors.error} />
              </View>
              <Text style={styles.cardLabel}>Expenses</Text>
              <Text style={styles.cardAmount}>{formatCurrency(monthlyExpenses)}</Text>
              <Text style={styles.cardPeriod}>This Month</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.cardShadow]}>
              <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                <Ionicons name="wallet-outline" size={18} color="#FF9800" />
              </View>
              <Text style={styles.cardLabel}>Budget Left</Text>
              <Text style={styles.cardAmount}>{formatCurrency(remainingBudget)}</Text>
              <Text style={styles.cardPeriod}>Remaining</Text>
            </View>
            
            <View style={[styles.summaryCard, styles.cardShadow]}>
              <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                <Ionicons name="trending-up-outline" size={18} color="#9C27B0" />
              </View>
              <Text style={styles.cardLabel}>Savings</Text>
              <Text style={styles.cardAmount}>{formatCurrency(currentSavings)}</Text>
              <Text style={styles.cardPeriod}>Income - Expenses</Text>
            </View>
          </View>
        </View>
        
        {/* Recent Transactions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => handleNavigation('Transactions')}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.transactionList}>
            {recentTransactions.length > 0 ? (
              recentTransactions.slice(0, 3).map((transaction, index) => (
                <TouchableOpacity 
                  key={transaction._id || index} 
                  style={[styles.transactionItem, styles.cardShadow]}
                >
                  <View style={[
                    styles.categoryIcon, 
                    { backgroundColor: getCategoryColor(transaction.category) }
                  ]}>
                    <Ionicons 
                      name={getCategoryIcon(transaction.category)} 
                      size={16} 
                      color="#fff" 
                    />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionTitle}>{transaction.description || transaction.category}</Text>
                    <Text style={styles.transactionDate}>
                      {formatTransactionDate(transaction.date)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount, 
                    transaction.type === 'income' ? styles.incomeAmount : {}
                  ]}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No recent transactions</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Budget Progress */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Progress</Text>
            <TouchableOpacity onPress={() => handleNavigation('Budget')}>
              <Text style={styles.viewAllText}>Manage</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.budgetList}>
            {budgets.length > 0 ? (
              budgets.slice(0, 4).map((budget, index) => {
                const spent = budget.currentSpending || 0;
                const percentage = calculatePercentage(spent, budget.amount);
                const isOverBudget = spent > budget.amount;
                const isCloseToLimit = percentage >= 85 && percentage <= 100;
                const color = getCategoryColor(budget.category);
              
                return (
                  <View key={budget._id || index} style={[
                    styles.budgetItem, 
                    styles.cardShadow,
                    isCloseToLimit && styles.warningBudget,
                    isOverBudget && styles.overBudgetItem
                  ]}>
                    <View style={styles.budgetHeader}>
                      <View style={[styles.categoryIcon, { backgroundColor: color }]}>
                        <Ionicons 
                          name={getCategoryIcon(budget.category)} 
                          size={16} 
                          color="#fff" 
                        />
                      </View>
                      <View style={styles.budgetInfoContainer}>
                        <Text style={styles.budgetCategory}>{budget.category}</Text>
                        <Text style={styles.budgetNumbers}>
                          <Text style={isOverBudget ? styles.overBudget : undefined}>
                            {formatCurrency(spent)}
                          </Text>
                          <Text style={styles.budgetSeparator}> / </Text>
                          <Text>{formatCurrency(budget.amount)}</Text>
                        </Text>
                      </View>
                      <Text style={[
                        styles.budgetPercentage, 
                        isCloseToLimit ? styles.warningText : null,
                        isOverBudget ? styles.overBudget : styles.underBudget
                      ]}>
                        {percentage.toFixed(0)}%
                      </Text>
                    </View>
                    
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar, 
                          isOverBudget ? styles.overBudgetBar : { backgroundColor: color },
                          isCloseToLimit && !isOverBudget ? styles.warningBar : null,
                          { width: `${Math.min(percentage, 100)}%` }
                        ]} 
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No budgets created yet</Text>
                <TouchableOpacity 
                  style={styles.createBudgetButton}
                  onPress={handleCreateBudget}
                >
                  <Text style={styles.createBudgetText}>Create Budget</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      
      <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
      
      <MessageDialog
        visible={dialogVisible}
        type={dialogProps.type}
        title={dialogProps.title}
        message={dialogProps.message}
        actionText={dialogProps.actionText}
        onAction={dialogProps.onAction}
        onDismiss={() => setDialogVisible(false)}
        autoDismiss={dialogProps.type === 'success'} // Auto dismiss success messages
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textLight,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dateText: {
    color: theme.colors.textLight,
    marginTop: 2,
    fontSize: 14,
  },
  balanceCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    ...theme.shadows.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTitle: {
    color: theme.colors.white,
    opacity: 0.9,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 6,
  },
  balanceAmount: {
    color: theme.colors.white,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  ctaContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.15)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  expenseButton: {
    backgroundColor: theme.colors.secondary,
    marginRight: 8,
  },
  budgetButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  cardSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  viewAllText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  financialCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardPeriod: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 4,
  },
  transactionList: {
    marginTop: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
  },
  incomeAmount: {
    color: theme.colors.success,
  },
  budgetList: {
    marginTop: 4,
  },
  budgetItem: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetInfoContainer: {
    flex: 1,
  },
  budgetCategory: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  budgetNumbers: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  budgetSeparator: {
    color: theme.colors.textLight,
  },
  budgetPercentage: {
    fontSize: 16,
    fontWeight: '600',
  },
  overBudget: {
    color: theme.colors.error,
  },
  underBudget: {
    color: theme.colors.success,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 12,
  },
  createBudgetButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createBudgetText: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  warningBudget: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  overBudgetItem: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error,
  },
  warningText: {
    color: theme.colors.warning,
    fontWeight: '700',
  },
  warningBar: {
    backgroundColor: theme.colors.warning,
  },
  overBudgetBar: {
    backgroundColor: theme.colors.error,
  },
  timeoutContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  timeoutText: {
    color: theme.colors.textLight,
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default HomeScreen; 