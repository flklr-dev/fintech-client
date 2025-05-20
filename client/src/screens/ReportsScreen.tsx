import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Platform,
  Dimensions,
  Share,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { useNavigation } from '../hooks/useNavigation';
import { theme } from '../theme';
import AppHeader from '../components/AppHeader';
import BottomNavBar from '../components/BottomNavBar';
import { ScreenName } from '../components/BottomNavBar';
import { PieChart } from 'react-native-chart-kit';
import { LineChart } from 'react-native-chart-kit';
import api from '../api/api';
import { budgetService } from '../services/budgetService';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useCurrency } from '../contexts/CurrencyContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = Math.min(220, width * 0.6);

const ReportsScreen = observer(() => {
  const navigation = useNavigation();
  const [activeScreen, setActiveScreen] = useState<ScreenName>('Reports');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Update the custom date range state
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)),
    showStartDatePicker: false,
    showEndDatePicker: false
  });

  // Add state for date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [showCustomDateRangeModal, setShowCustomDateRangeModal] = useState(false);
  
  // Data states
  const [spendingByCategory, setSpendingByCategory] = useState<any[]>([]);
  const [incomeVsExpenseData, setIncomeVsExpenseData] = useState<any>({
    labels: [],
    datasets: [{ data: [] }, { data: [] }]
  });
  const [budgets, setBudgets] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [hasData, setHasData] = useState(false);

  // Colors for categories
  const categoryColors = {
    'Food & Dining': '#4CAF50',
    'Transport': '#2196F3',
    'Utilities': '#FF9800',
    'Entertainment': '#9C27B0',
    'Shopping': '#3F51B5',
    'Healthcare': '#E91E63',
    'Education': '#009688',
    'Other': '#607D8B'
  };

  const { formatCurrency } = useCurrency(); // Use the currency context

  // Add debounce utility
  const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  // Debounce the custom date range
  const debouncedCustomDateRange = useDebounce(customDateRange, 500);

  // Add number formatting function
  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  // Update the useEffect for initial load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Update the useEffect for date range changes
  useEffect(() => {
    if (!loading && selectedDateRange === 'Custom') {
      fetchAllData();
    }
  }, [selectedDateRange, debouncedCustomDateRange]);

  // Improved check for data existence
  useEffect(() => {
    // This effect runs whenever relevant data changes
    const dataExists = 
      totalIncome > 0 || 
      totalExpense > 0 || 
      budgets.length > 0 || 
      spendingByCategory.length > 0;
    
    console.log('Data check in effect:', { 
      totalIncome, 
      totalExpense, 
      budgetsLength: budgets.length,
      categoriesLength: spendingByCategory.length,
      dataExists
    });
    
    setHasData(dataExists);
  }, [totalIncome, totalExpense, budgets.length, spendingByCategory.length]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransactionData(),
        fetchBudgetData()
      ]);
    } catch (error) {
      console.error('Error fetching report data:', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionData = async () => {
    try {
      // Get date range based on selected period for other charts
      const { startDate, endDate } = getDateRangeForPeriod(selectedDateRange);
      
      // Always get last 6 months for income vs expenses chart
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      
      console.log(`Fetching transactions for ${selectedDateRange}: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`Fetching 6 months data for income vs expenses: ${sixMonthsAgo.toISOString()} to ${endDate.toISOString()}`);
      
      // Fetch transactions within date range
      const response = await api.get('/transactions', {
        params: { 
          startDate: sixMonthsAgo.toISOString(), // Always fetch 6 months of data
          endDate: endDate.toISOString()
        }
      });
      
      if (!response.data || !response.data.data || !response.data.data.transactions) {
        console.error('Invalid transaction data format:', response.data);
        throw new Error('Invalid transaction data returned from API');
      }
      
      const transactions = response.data.data.transactions;
      console.log('Transactions fetched:', transactions.length);
      
      // Process spending by category data with filtered date range
      const filteredTransactions = transactions.filter((t: { date: string }) => {
        const transDate = new Date(t.date);
        return transDate >= startDate && transDate <= endDate;
      });
      processSpendingByCategory(filteredTransactions);
      
      // Process income vs expense data with all 6 months data
      processIncomeVsExpenseData(transactions);
      
    } catch (error) {
      console.error('Error fetching transaction data:', error);
      throw error;
    }
  };

  const fetchBudgetData = async () => {
    try {
      const budgetsData = await budgetService.getBudgets();
      console.log('Budgets fetched:', budgetsData?.length || 0);
      // We'll set the budgets directly here, and sort them in the render
      setBudgets(budgetsData || []);
    } catch (error) {
      console.error('Error fetching budget data:', error);
      throw error;
    }
  };

  const getDateRangeForPeriod = (period: string) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'All':
        // All time: Set start date to a very old date
        startDate = new Date(2000, 0, 1); // January 1, 2000
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'Today':
        // Today: transactions from the current day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'This Week':
        // This Week: transactions from the current week (Sunday-Saturday)
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
        startDate = new Date(now);
        startDate.setDate(now.getDate() - currentDay); // Go back to Sunday
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Go forward to Saturday
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'This Month':
        // This Month: transactions from the current calendar month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'Custom':
        // Custom: use the custom date range
        startDate = customDateRange.startDate;
        endDate = customDateRange.endDate;
        break;
      default:
        // Default to All if somehow an invalid period is passed
        startDate = new Date(2000, 0, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    
    return { startDate, endDate };
  };

  const processSpendingByCategory = (transactions: any[]) => {
    // Filter expenses only
    const expenses = transactions.filter(t => t.type === 'expense');
    
    console.log('Processing expenses:', expenses.length);
    
    // Group expenses by category
    const categoryMap = new Map<string, number>();
    
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      const amount = expense.amount || 0;
      
      if (categoryMap.has(category)) {
        categoryMap.set(category, categoryMap.get(category)! + amount);
      } else {
        categoryMap.set(category, amount);
      }
    });
    
    // Convert map to array of objects for the chart
    const categoryData = Array.from(categoryMap.entries()).map(([name, amount]) => ({
      name,
      amount,
      color: categoryColors[name as keyof typeof categoryColors] || '#607D8B',
      legendFontColor: theme.colors.text,
      legendFontSize: 12
    }));
    
    // Sort by amount in descending order
    categoryData.sort((a, b) => b.amount - a.amount);
    
    // Limit number of categories for smaller screens
    // On small screens, show top categories and group the rest as "Other"
    const maxCategories = width < 360 ? 4 : 6;
    if (categoryData.length > maxCategories) {
      const topCategories = categoryData.slice(0, maxCategories - 1);
      const otherCategories = categoryData.slice(maxCategories - 1);
      
      const otherAmount = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
      if (otherAmount > 0) {
        topCategories.push({
          name: 'Other categories',
          amount: otherAmount,
          color: '#607D8B',
          legendFontColor: theme.colors.text,
          legendFontSize: 12
        });
      }
      
      console.log(`Limiting categories from ${categoryData.length} to ${topCategories.length} for small screen`);
      console.log('Spending categories processed:', topCategories.length);
      setSpendingByCategory(topCategories);
    } else {
      console.log('Spending categories processed:', categoryData.length);
      setSpendingByCategory(categoryData);
    }
  };

  const processIncomeVsExpenseData = (transactions: any[]) => {
    // Get date range based on selected period for metrics
    const { startDate, endDate } = getDateRangeForPeriod(selectedDateRange);
    
    // Calculate metrics for current period
    const currentPeriodIncome = transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return transDate >= startDate && transDate <= endDate && t.type === 'income';
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const currentPeriodExpense = transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return transDate >= startDate && transDate <= endDate && t.type === 'expense';
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Set the current period metrics
    setTotalIncome(currentPeriodIncome);
    setTotalExpense(currentPeriodExpense);
    
    // Process 6-month chart data
    const incomeByMonth = new Map<string, number>();
    const expenseByMonth = new Map<string, number>();
    
    // Initialize with last 6 months
    const months: string[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = format(month, 'MMM');
      months.push(monthKey);
      incomeByMonth.set(monthKey, 0);
      expenseByMonth.set(monthKey, 0);
    }
    
    // Process all transactions for the last 6 months
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = format(date, 'MMM');
      
      // Only process if it's within our display range
      if (months.includes(monthKey)) {
        if (transaction.type === 'income') {
          incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + transaction.amount);
        } else {
          expenseByMonth.set(monthKey, (expenseByMonth.get(monthKey) || 0) + transaction.amount);
        }
      }
    });
    
    // Prepare data for chart
    const labels = months;
    const incomeData = months.map(month => incomeByMonth.get(month) || 0);
    const expenseData = months.map(month => expenseByMonth.get(month) || 0);
    
    setIncomeVsExpenseData({
      labels,
      datasets: [
        {
          data: incomeData,
          color: (opacity = 1) => theme.colors.success,
          strokeWidth: 2
        },
        {
          data: expenseData,
          color: (opacity = 1) => theme.colors.error,
          strokeWidth: 2
        }
      ]
    });
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
    if (screen === 'Home') {
      navigation.navigate('Home' as any);
    } else if (screen === 'Budget') {
      navigation.navigate('Budget' as any);
    } else if (screen === 'Transactions') {
      navigation.navigate('Transactions' as any);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      
      // Get the date range for the report
      const { startDate, endDate } = getDateRangeForPeriod(selectedDateRange);
      
      // Create a formatted report content
      const reportContent = `
📊 Financial Report
Period: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}

💰 Key Metrics:
• Total Income: ${formatCurrency(totalIncome, formatLargeNumber)}
• Total Expenses: ${formatCurrency(totalExpense, formatLargeNumber)}
• Net Savings: ${netSavings >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netSavings), formatLargeNumber)}

📈 Spending by Category:
${spendingByCategory.map(category => 
  `• ${category.name}: ${formatCurrency(category.amount, formatLargeNumber)}`
).join('\n')}

📋 Budget Status:
${budgets.map(budget => {
  const spent = budget.currentSpending || 0;
  const allocated = budget.amount || 0;
  const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
  const status = percentage > 100 ? '❌' : percentage >= 80 ? '⚠️' : '✅';
  
  return `• ${budget.category}:
  - Spent: ${formatCurrency(spent, formatLargeNumber)} / ${formatCurrency(allocated, formatLargeNumber)}
  - Utilization: ${percentage.toFixed(1)}% ${status}`;
}).join('\n')}

Generated on: ${format(new Date(), 'MMM d, yyyy h:mm a')}
      `;

      // Share the report
      await Share.share({
        message: reportContent,
        title: 'Financial Report',
      });

    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate financial report');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  // Calculate net savings
  const netSavings = totalIncome - totalExpense;
  
  // Get highest spending category
  const highestSpendingCategory = spendingByCategory[0] || { name: 'None', amount: 0 };

  // Handle navigation to account screen
  const handleProfilePress = () => {
    navigation.navigate('Account');
  };

  // Handle date range selection
  const handleDateRangeSelect = (range: string) => {
    if (range === selectedDateRange) return; // Don't do anything if same range selected
    setSelectedDateRange(range);
    
    if (range === 'Custom') {
      showCustomDateRangePicker();
    }
  };
  
  // Show custom date range picker modal
  const showCustomDateRangePicker = () => {
    // Reset custom date range to current month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    setCustomDateRange({
      startDate: startOfMonth,
      endDate: endOfMonth,
      showStartDatePicker: false,
      showEndDatePicker: false
    });
    
    setShowCustomDateRangeModal(true);
  };
  
  // Update the date picker handlers
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      selectedDate.setHours(0, 0, 0, 0);
      setCustomDateRange(prev => ({
        ...prev,
        startDate: selectedDate,
        endDate: selectedDate > prev.endDate ? selectedDate : prev.endDate
      }));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      selectedDate.setHours(23, 59, 59, 999);
      setCustomDateRange(prev => ({
        ...prev,
        endDate: selectedDate,
        startDate: selectedDate < prev.startDate ? selectedDate : prev.startDate
      }));
    }
  };

  // Update the date button handlers
  const handleStartDatePress = () => {
    setDatePickerMode('start');
    setShowDatePicker(true);
  };

  const handleEndDatePress = () => {
    setDatePickerMode('end');
    setShowDatePicker(true);
  };

  // Update the modal actions
  const handleApplyCustomRange = () => {
    setShowCustomDateRangeModal(false);
    setSelectedDateRange('Custom');
  };

  // Force check for data in the render function
  const checkHasData = () => {
    const calculatedHasData = 
      totalIncome > 0 || 
      totalExpense > 0 || 
      budgets.length > 0 || 
      spendingByCategory.length > 0;
    
    return calculatedHasData;
  };

  // Update the custom date range modal renderer
  const renderCustomDateRangeModal = () => (
    <Modal
      visible={showCustomDateRangeModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCustomDateRangeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            <TouchableOpacity onPress={() => setShowCustomDateRangeModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.dateSelectionContainer}>
              {/* Start Date */}
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={handleStartDatePress}
              >
                <Text style={styles.dateButtonText}>
                  {format(customDateRange.startDate, 'EEEE, MMM d, yyyy')}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              
              {/* End Date */}
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={handleEndDatePress}
              >
                <Text style={styles.dateButtonText}>
                  {format(customDateRange.endDate, 'EEEE, MMM d, yyyy')}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCustomDateRangeModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={handleApplyCustomRange}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Date Picker - Single instance */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? customDateRange.startDate : customDateRange.endDate}
          mode="date"
          display="default"
          onChange={datePickerMode === 'start' ? handleStartDateChange : handleEndDateChange}
          maximumDate={new Date()}
        />
      )}
    </Modal>
  );

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading financial insights...</Text>
        </View>
        <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
      </SafeAreaView>
    );
  }

  // Render empty state for new users - use direct check instead of state
  if (!checkHasData()) {
    console.log('Rendering empty state (direct check)');
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          showBackButton={false}
        />
        
        <View style={styles.headerContainer}>
          <Text style={styles.screenTitle}>Financial Insights</Text>
        </View>
        
        <View style={styles.emptyStateContainer}>
          <Ionicons name="analytics-outline" size={80} color={theme.colors.gray} />
          <Text style={styles.emptyStateTitle}>No data yet</Text>
          <Text style={styles.emptyStateText}>
            Start adding transactions to see your financial reports and insights
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Transactions' as any, { showAddModal: true })}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.emptyStateButtonText}>Add Your First Transaction</Text>
          </TouchableOpacity>
        </View>
        
        <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
      </SafeAreaView>
    );
  }

  console.log('Rendering regular view, hasData=true or loading=true', { hasData, loading });
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        showProfile={true}
        onProfilePress={handleProfilePress}
      />
      
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Financial Insights</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Time Range Selector - Updated with All option */}
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
          >
            {['All', 'This Week', 'This Month', 'Custom'].map((range) => (
            <TouchableOpacity
                key={range}
              style={[
                  styles.filterChip,
                  selectedDateRange === range && styles.activeFilterChip
              ]}
                onPress={() => handleDateRangeSelect(range)}
            >
              <Text style={[
                  styles.filterChipText,
                  selectedDateRange === range && styles.activeFilterChipText
              ]}>
                  {range}
              </Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
          
          {/* Show selected custom date range when active */}
          {selectedDateRange === 'Custom' && (
            <View style={styles.customRangeDisplay}>
              <Ionicons name="calendar" size={16} color={theme.colors.primary} />
              <Text style={styles.customRangeText}>
                {format(customDateRange.startDate, 'MMM d')} - {format(customDateRange.endDate, 'MMM d, yyyy')}
              </Text>
              <TouchableOpacity onPress={showCustomDateRangePicker}>
                <Text style={styles.customRangeChangeBtn}>Change</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          <View style={[styles.metricsCard, styles.cardShadow]}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <View style={[styles.metricIndicator, styles.incomeIndicator]} />
                <View>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={[styles.metricValue, styles.incomeValue]}>
                    {formatCurrency(totalIncome, formatLargeNumber)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricDivider} />
              
              <View style={styles.metricItem}>
                <View style={[styles.metricIndicator, styles.expenseIndicator]} />
                <View>
                  <Text style={styles.metricLabel}>Expenses</Text>
                  <Text style={[styles.metricValue, styles.expenseValue]}>
                    {formatCurrency(totalExpense, formatLargeNumber)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricDivider} />
              
              <View style={styles.metricItem}>
                <View style={[
                  styles.metricIndicator,
                  netSavings >= 0 ? styles.savingsPositiveIndicator : styles.savingsNegativeIndicator
                ]} />
                <View>
                  <Text style={styles.metricLabel}>Savings</Text>
                  <Text style={[styles.metricValue, netSavings >= 0 ? styles.incomeValue : styles.expenseValue]}>
                    {netSavings >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netSavings), formatLargeNumber)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Spending Breakdown Chart */}
        {spendingByCategory.length > 0 ? (
          <View style={[styles.chartContainer, styles.cardShadow]}>
            <Text style={styles.chartTitle}>Spending by Category</Text>
            
            <View style={styles.chartContent}>
              {/* Simple pie chart with fixed position */}
              <View style={styles.chartVisual}>
                <View style={styles.pieWrapper}>
                  <PieChart
                    data={spendingByCategory.map(category => ({
                      ...category,
                      legendFontSize: 0,
                    }))}
                    width={180}
                    height={180}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#ffffff',
                      backgroundGradientTo: '#ffffff',
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="32"
                    absolute
                    hasLegend={false}
                  />
                </View>
              </View>
              
              {/* Custom legend with two-column layout */}
              <View style={styles.chartLegendContainer}>
                <View style={styles.spendingLegendGrid}>
                  {spendingByCategory.map((category, index) => {
                    const totalSpending = spendingByCategory.reduce(
                      (sum, cat) => sum + cat.amount, 0
                    );
                    const percentage = 
                      totalSpending > 0 
                        ? ((category.amount / totalSpending) * 100).toFixed(1) 
                        : '0';
                    
                    return (
                      <View key={index} style={styles.spendingLegendItem}>
                        <View style={styles.spendingLegendRow}>
                          <View 
                            style={[
                              styles.spendingLegendColorBox, 
                              { backgroundColor: category.color }
                            ]} 
                          />
                          <Text style={styles.spendingLegendCategoryText} numberOfLines={1}>
                            {category.name}
                          </Text>
                        </View>
                        
                        <View style={styles.spendingLegendDetails}>
                          <Text style={styles.spendingLegendPercentage}>
                            {percentage}%
                          </Text>
                          <Text style={styles.spendingLegendAmountText}>
                            {formatCurrency(category.amount, formatLargeNumber)}
                        </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartContainer, styles.cardShadow]}>
            <Text style={styles.chartTitle}>Spending by Category</Text>
            <View style={styles.noChartDataContainer}>
              <Text style={styles.noDataText}>No expense data for this period</Text>
            </View>
          </View>
        )}

        {/* Income vs Expense Chart */}
        {incomeVsExpenseData.labels.length > 0 ? (
          <View style={[styles.chartContainer, styles.cardShadow]}>
            <Text style={styles.chartTitle}>Income vs Expenses</Text>
            <View style={styles.lineChartContainer}>
              <LineChart
                data={incomeVsExpenseData}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                chartConfig={{
                  backgroundColor: theme.colors.white,
                  backgroundGradientFrom: theme.colors.white,
                  backgroundGradientTo: theme.colors.white,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                  }
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                  marginLeft: -20,
                }}
              />
              <View style={styles.chartLegend}>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={styles.chartLegendText}>Income</Text>
                </View>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: theme.colors.error }]} />
                  <Text style={styles.chartLegendText}>Expenses</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartContainer, styles.cardShadow]}>
            <Text style={styles.chartTitle}>Income vs Expenses</Text>
            <View style={styles.noChartDataContainer}>
              <Text style={styles.noDataText}>No transaction data for this period</Text>
            </View>
          </View>
        )}

        {/* Budget Utilization */}
        <View style={[styles.budgetContainer, styles.cardShadow]}>
          <Text style={styles.sectionTitle}>Budget Utilization</Text>
          
          {budgets.length > 0 ? (
            (() => {
              // Sort and categorize budgets
              const sortedBudgets = [...budgets].sort((a, b) => {
                // First sort by status (over budget first, then warning, then safe)
                const percentA = a.currentSpending && a.amount ? (a.currentSpending / a.amount) * 100 : 0;
                const percentB = b.currentSpending && b.amount ? (b.currentSpending / b.amount) * 100 : 0;
                
                const statusA = percentA > 100 ? 2 : percentA >= 80 ? 1 : 0;
                const statusB = percentB > 100 ? 2 : percentB >= 80 ? 1 : 0;
                
                // If status is different, sort by status
                if (statusA !== statusB) {
                  return statusB - statusA; 
                }
                
                // If same status, sort by percentage (highest first)
                return percentB - percentA;
              });
              
              return sortedBudgets.map((budget, index) => {
                const spent = budget.currentSpending || 0;
                const allocated = budget.amount || 0;
                const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
                const isOverBudget = percentage > 100;
                const isNearBudget = percentage >= 80 && percentage <= 100;
                
                return (
                  <TouchableOpacity
                    key={budget._id || index}
                    style={styles.budgetItem}
                    onPress={() => handleCategoryPress(budget.category)}
                  >
                    <View style={styles.budgetHeader}>
                      <View style={[
                        styles.categoryDot, 
                        { backgroundColor: categoryColors[budget.category as keyof typeof categoryColors] || '#607D8B' }
                      ]} />
                      <Text style={styles.categoryName}>{budget.category}</Text>
                      <Text style={styles.budgetAmount}>{formatCurrency(spent, formatLargeNumber)}</Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar,
                          { 
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: isOverBudget 
                              ? theme.colors.error 
                              : isNearBudget 
                                ? theme.colors.warning 
                                : theme.colors.success
                          }
                        ]} 
                      />
                    </View>
                    
                    {selectedCategory === budget.category && (
                      <View style={styles.budgetDetails}>
                        <View style={styles.budgetDetailRow}>
                          <Text style={styles.budgetDetailLabel}>Allocated:</Text>
                          <Text style={styles.budgetDetailValue}>{formatCurrency(allocated, formatLargeNumber)}</Text>
                        </View>
                        <View style={styles.budgetDetailRow}>
                          <Text style={styles.budgetDetailLabel}>Spent:</Text>
                          <Text style={[
                            styles.budgetDetailValue,
                            isOverBudget && styles.redText
                          ]}>{formatCurrency(spent, formatLargeNumber)}</Text>
                        </View>
                        <View style={styles.budgetDetailRow}>
                          <Text style={styles.budgetDetailLabel}>Remaining:</Text>
                          <Text style={[
                            styles.budgetDetailValue,
                            isOverBudget ? styles.redText : styles.greenText
                          ]}>{formatCurrency(allocated - spent, formatLargeNumber)}</Text>
                        </View>
                        <View style={styles.budgetDetailRow}>
                          <Text style={styles.budgetDetailLabel}>Utilization:</Text>
                          <Text style={[
                            styles.budgetDetailValue,
                            isOverBudget ? styles.redText : isNearBudget ? styles.yellowText : styles.greenText
                          ]}>{percentage.toFixed(1)}%</Text>
                        </View>
                        {isOverBudget && (
                          <View style={styles.budgetStatusTag}>
                            <Ionicons name="alert-circle" size={14} color="#fff" />
                            <Text style={styles.budgetStatusText}>Over Budget</Text>
                          </View>
                        )}
                        {isNearBudget && (
                          <View style={[styles.budgetStatusTag, styles.warningTag]}>
                            <Ionicons name="warning" size={14} color="#fff" />
                            <Text style={styles.budgetStatusText}>Near Limit</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              });
            })()
          ) : (
            <View style={styles.noBudgetContainer}>
              <Text style={styles.noBudgetText}>No budgets created yet</Text>
              <TouchableOpacity 
                style={styles.createBudgetButton}
                onPress={() => navigation.navigate('Budget' as any)}
              >
                <Text style={styles.createBudgetText}>Create Budget</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Replace the old modal with the new renderer */}
      {renderCustomDateRangeModal()}
      
      <BottomNavBar activeScreen={activeScreen} onPress={handleNavigation} />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  exportButton: {
    padding: 8,
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
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.lightGray,
  },
  activeFilterChip: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  activeFilterChipText: {
    color: theme.colors.white,
    fontWeight: '500',
  },
  customRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  customRangeText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    marginLeft: 6,
    marginRight: 10,
  },
  customRangeChangeBtn: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  metricsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricsCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricIndicator: {
    width: 8,
    height: 32,
    borderRadius: 4,
    marginRight: 8,
  },
  incomeIndicator: {
    backgroundColor: theme.colors.success,
  },
  expenseIndicator: {
    backgroundColor: theme.colors.error,
  },
  savingsPositiveIndicator: {
    backgroundColor: theme.colors.primary,
  },
  savingsNegativeIndicator: {
    backgroundColor: theme.colors.error,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.lightGray,
    marginHorizontal: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  incomeValue: {
    color: theme.colors.success,
  },
  expenseValue: {
    color: theme.colors.error,
  },
  chartContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  noChartDataContainer: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  budgetContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  budgetItem: {
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  budgetAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
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
  budgetDetails: {
    marginTop: 8,
    padding: 12,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 8,
  },
  budgetDetailText: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  budgetDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetDetailLabel: {
    fontSize: 13,
    color: theme.colors.textLight,
  },
  budgetDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  redText: {
    color: theme.colors.error,
  },
  yellowText: {
    color: theme.colors.warning,
  },
  greenText: {
    color: theme.colors.success,
  },
  budgetStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  warningTag: {
    backgroundColor: theme.colors.warning,
  },
  budgetStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  chartContent: {
    flexDirection: width > 480 ? 'row' : 'column',
    alignItems: 'center',
  },
  chartVisual: {
    width: width > 480 ? '50%' : '100%',
    alignItems: 'center',
    marginBottom: width > 480 ? 0 : 16,
  },
  pieWrapper: {
    width: 180,
    height: 180,
    marginLeft: 50,
  },
  chartLegendContainer: {
    width: width > 480 ? '50%' : '100%',
    paddingLeft: width > 480 ? 16 : 0,
  },
  spendingLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  spendingLegendItem: {
    width: '48%',
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    padding: 8,
    borderRadius: 8,
  },
  spendingLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spendingLegendColorBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  spendingLegendCategoryText: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
    marginRight: 4,
  },
  spendingLegendDetails: {
    marginTop: 4,
    marginLeft: 16,
  },
  spendingLegendPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  spendingLegendAmountText: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  lineChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  chartLegendText: {
    fontSize: 12,
    color: theme.colors.textLight,
  },
  noBudgetContainer: {
    alignItems: 'center',
    padding: 24,
  },
  noBudgetText: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 16,
    textAlign: 'center',
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    zIndex: 1, // Ensure modal is above other content
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalContent: {
    marginBottom: 20,
  },
  dateSelectionContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  dateButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  cancelButtonText: {
    color: theme.colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  applyButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ReportsScreen; 
