import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  SectionList,
  KeyboardAvoidingView,
  ActivityIndicator,
  ToastAndroid,
  Animated,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '../hooks/useNavigation';
import { theme } from '../theme';
import AppHeader from '../components/AppHeader';
import BottomNavBar from '../components/BottomNavBar';
import { ScreenName } from '../components/BottomNavBar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import api from '../api/api';
import transactionService from '../services/transactionService';
import { budgetService, Budget as BudgetType } from '../services/budgetService';
import MessageDialog from '../components/MessageDialog';
import { useCurrency } from '../contexts/CurrencyContext';

// Interface for transaction
interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  date: Date;
  isRecurring?: boolean;
  paymentMethod?: string;
  linkedBudget?: string; // Changed to string to store budget ID
}

// Define categories for both expense and income
const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Education',
  'Other'
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Allowance',
  'Gift',
  'Refund',
  'Bonus',
  'Interest',
  'Rental Income',
  'Side Hustle',
  'Other'
];

// Payment methods
const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'E-wallet',
  'Other'
];

// Map of category-specific icons
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Food & Dining': 'restaurant-outline',
  'Transport': 'car-outline',
  'Utilities': 'flash-outline',
  'Entertainment': 'film-outline',
  'Shopping': 'cart-outline',
  'Healthcare': 'medical-outline',
  'Education': 'school-outline',
  'Rent': 'home-outline',
  'Salary': 'cash-outline',
  'Freelance': 'laptop-outline',
  'Investments': 'trending-up-outline',
  'Gift': 'gift-outline',
  'Refund': 'return-down-back-outline',
  'Allowance': 'wallet-outline',
  'Bonus': 'gift-outline',
  'Interest': 'analytics-outline',
  'Rental Income': 'home-outline',
  'Side Hustle': 'briefcase-outline',
  'Other': 'wallet-outline'
};

// Map of category-specific colors
const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#4CAF50', // Green
  'Transport': '#2196F3',     // Blue
  'Utilities': '#FF9800',     // Orange
  'Entertainment': '#9C27B0', // Purple
  'Shopping': '#E91E63',      // Pink
  'Healthcare': '#00BCD4',    // Cyan
  'Education': '#3F51B5',     // Indigo
  'Rent': '#795548',          // Brown
  'Salary': '#4CAF50',        // Green
  'Freelance': '#2196F3',     // Blue
  'Investments': '#673AB7',   // Deep Purple
  'Gift': '#E91E63',          // Pink
  'Refund': '#FF9800',        // Orange
  'Allowance': '#8BC34A',     // Light Green
  'Bonus': '#FFC107',         // Amber
  'Interest': '#7E57C2',      // Deep Purple
  'Rental Income': '#FF5722', // Deep Orange
  'Side Hustle': '#00BCD4',   // Cyan
  'Other': '#607D8B'          // Blue Grey
};

// Interface for grouped transactions
interface GroupedTransaction {
  title: string;
  data: Transaction[];
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const TransactionsScreen = observer(() => {
  const navigation = useNavigation();
  const [activeScreen, setActiveScreen] = useState<ScreenName>('Transactions');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    title: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    date: new Date(),
    paymentMethod: '',
    linkedBudget: '',
    isRecurring: false,
  });
  const [lastTransactionType, setLastTransactionType] = useState<'income' | 'expense'>('expense');
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);
  const successOpacity = useState(new Animated.Value(0))[0];
  const { formatCurrency, currency } = useCurrency();
  
  // Demo transactions data
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      title: 'Grocery Shopping',
      amount: 45.99,
      type: 'expense',
      category: 'Food & Dining',
      icon: 'cart-outline',
      color: '#4CAF50',
      date: new Date(),
    },
    {
      id: '2',
      title: 'Salary Deposit',
      amount: 2500.00,
      type: 'income',
      category: 'Salary',
      icon: 'cash-outline',
      color: '#2196F3',
      date: new Date(),
      isRecurring: true,
    },
    {
      id: '3',
      title: 'Gas Station',
      amount: 35.50,
      type: 'expense',
      category: 'Transport',
      icon: 'car-outline',
      color: '#FF9800',
      date: new Date(Date.now() - 86400000), // Yesterday
    },
    {
      id: '4',
      title: 'Netflix Subscription',
      amount: 14.99,
      type: 'expense',
      category: 'Entertainment',
      icon: 'tv-outline',
      color: '#E91E63',
      date: new Date(Date.now() - 86400000),
      isRecurring: true,
    },
  ]);

  // Form validation
  const [formErrors, setFormErrors] = useState({
    amount: '',
    category: '',
    description: ''
  });

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Add state for available budgets
  const [availableBudgets, setAvailableBudgets] = useState<BudgetType[]>([]);
  const [activeBudgetsByCategory, setActiveBudgetsByCategory] = useState<Record<string, BudgetType>>({});
  
  // Add a state for the budget dialog
  const [showBudgetRequiredDialog, setShowBudgetRequiredDialog] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');
  
  // Add state variables for options and edit modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editedTransaction, setEditedTransaction] = useState({
    title: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    date: new Date(),
    paymentMethod: '',
    linkedBudget: ''
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [showDatePickerEdit, setShowDatePickerEdit] = useState(false);
  
  // Add state for custom date range
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)),
    showStartDatePicker: false,
    showEndDatePicker: false
  });

  // Add state for menu position
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Add state for edit restrictions
  const [editRestrictions, setEditRestrictions] = useState({
    canEditType: false,
    canEditDate: false,
  });

  // Add state for custom date range modal
  const [showCustomDateRangeModal, setShowCustomDateRangeModal] = useState(false);

  // Initialize all sections as expanded by default
  useEffect(() => {
    if (transactions.length > 0) {
      const sectionTitles = Array.from(new Set(transactions.map(t => t.date.toDateString())));
      const initialExpandState = sectionTitles.reduce((state, title) => {
        state[title] = true; // All sections expanded by default
        return state;
      }, {} as { [key: string]: boolean });
      
      setExpandedSections(initialExpandState);
    }
  }, [transactions]);

  // Reset form function
  const resetForm = () => {
    setNewTransaction({
      title: '',
      amount: '',
      type: 'expense',
      category: '',
      date: new Date(),
      paymentMethod: '',
      linkedBudget: '',
      isRecurring: false,
    });
    setFormErrors({ amount: '', category: '', description: '' });
    setLastTransactionType(newTransaction.type);
  };

  // Fetch transactions from API
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Use the existing axios instance with proper error handling
      const response = await api.get('/transactions');
      
      // Check if we have valid data
      if (response && response.data && response.data.data && response.data.data.transactions) {
        // Map transactions to our internal structure
        const formattedTransactions = response.data.data.transactions.map((transaction: any) => {
          const category = transaction.category || 'Other';
          return {
            id: transaction._id || transaction.id,
            title: transaction.description || category,
            amount: transaction.amount,
            type: transaction.type,
            category: category,
            icon: CATEGORY_ICONS[category] || 'wallet-outline',
            color: CATEGORY_COLORS[category] || theme.colors.primary,
            date: new Date(transaction.date),
            paymentMethod: transaction.paymentMethod || '',
            linkedBudget: transaction.linkedBudget || false
          };
        });
        
        setTransactions(formattedTransactions);
      } else {
        console.log('No transactions data received, using demo data');
        // Fallback to demo data if no transactions found
        setTransactions([
          {
            id: '1',
            title: 'Grocery Shopping',
            amount: 45.99,
            type: 'expense',
            category: 'Food & Dining',
            icon: 'cart-outline',
            color: '#4CAF50',
            date: new Date(),
          },
          {
            id: '2',
            title: 'Salary Deposit',
            amount: 2500.00,
            type: 'income',
            category: 'Salary',
            icon: 'cash-outline',
            color: '#2196F3',
            date: new Date(),
            isRecurring: true,
          },
          {
            id: '3',
            title: 'Gas Station',
            amount: 35.50,
            type: 'expense',
            category: 'Transport',
            icon: 'car-outline',
            color: '#FF9800',
            date: new Date(Date.now() - 86400000), // Yesterday
          },
          {
            id: '4',
            title: 'Netflix Subscription',
            amount: 14.99,
            type: 'expense',
            category: 'Entertainment',
            icon: 'tv-outline',
            color: '#E91E63',
            date: new Date(Date.now() - 86400000),
            isRecurring: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      
      // Fallback to demo data if API fails
      setTransactions([
        {
          id: '1',
          title: 'Grocery Shopping',
          amount: 45.99,
          type: 'expense',
          category: 'Food & Dining',
          icon: 'cart-outline',
          color: '#4CAF50',
          date: new Date(),
        },
        {
          id: '2',
          title: 'Salary Deposit',
          amount: 2500.00,
          type: 'income',
          category: 'Salary',
          icon: 'cash-outline',
          color: '#2196F3',
          date: new Date(),
          isRecurring: true,
        },
        {
          id: '3',
          title: 'Gas Station',
          amount: 35.50,
          type: 'expense',
          category: 'Transport',
          icon: 'car-outline',
          color: '#FF9800',
          date: new Date(Date.now() - 86400000), // Yesterday
        },
        {
          id: '4',
          title: 'Netflix Subscription',
          amount: 14.99,
          type: 'expense',
          category: 'Entertainment',
          icon: 'tv-outline',
          color: '#E91E63',
          date: new Date(Date.now() - 86400000),
          isRecurring: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch transactions and budgets
  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch transactions
      await fetchTransactions();
      
      // Fetch budgets
      const budgets = await budgetService.getBudgets();
      setAvailableBudgets(budgets);
      
      // Create a map of active budgets by category
      const budgetMap: Record<string, BudgetType> = {};
      budgets.forEach(budget => {
        const now = new Date();
        if (new Date(budget.startDate) <= now && new Date(budget.endDate) >= now) {
          budgetMap[budget.category] = budget;
        }
      });
      setActiveBudgetsByCategory(budgetMap);
      
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };
  
  const handleNavigation = (screen: ScreenName) => {
    setActiveScreen(screen);
    if (screen === 'Home') {
      navigation.navigate('Home' as any);
    } else if (screen === 'Budget') {
      navigation.navigate('Budget' as any);
    } else if (screen === 'Reports') {
      navigation.navigate('Reports' as any);
    }
  };

  // Group transactions by date with date range filtering
  const getGroupedTransactions = () => {
    // Apply date range filtering based on selectedDateRange
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filtered = transactions.filter(transaction => {
      // Apply search filter
      const matchesSearch = transaction.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Apply category filter
      const matchesCategory = selectedCategory === 'All' || transaction.category === selectedCategory;
      
      // Apply type filter
      const matchesType = selectedType === 'All' || transaction.type === selectedType;
      
      // Apply date range filter
      let matchesDateRange = true;
      
      if (selectedDateRange === 'Today') {
        // Today: transactions from the current day
        const transactionDate = new Date(transaction.date);
        transactionDate.setHours(0, 0, 0, 0);
        matchesDateRange = transactionDate.getTime() === today.getTime();
      } 
      else if (selectedDateRange === 'This Week') {
        // This Week: transactions from the current week (Sunday-Saturday)
        const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay); // Go back to Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Go forward to Saturday
        endOfWeek.setHours(23, 59, 59, 999);
        
        const transactionDate = new Date(transaction.date);
        matchesDateRange = transactionDate >= startOfWeek && transactionDate <= endOfWeek;
      } 
      else if (selectedDateRange === 'This Month') {
        // This Month: transactions from the current calendar month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const transactionDate = new Date(transaction.date);
        matchesDateRange = transactionDate >= startOfMonth && transactionDate <= endOfMonth;
      } 
      else if (selectedDateRange === 'Custom') {
        // Custom: transactions between customDateRange.startDate and customDateRange.endDate
        matchesDateRange = 
          transaction.date >= customDateRange.startDate && 
          transaction.date <= customDateRange.endDate;
      }
      // All: no date filtering
      
      return matchesSearch && matchesCategory && matchesType && matchesDateRange;
    });

    // Group filtered transactions by date
    const groups: { [key: string]: Transaction[] } = {};
    
    filtered.forEach(transaction => {
      const date = transaction.date.toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    return Object.entries(groups).map(([date, data]) => ({
      title: date,
      data: data.sort((a, b) => b.date.getTime() - a.date.getTime())
    }));
  };

  // Toggle section expansion
  const toggleSection = (date: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  // Handle category selection to automatically set budget link for expenses
  const handleCategorySelect = (category: string) => {
    setNewTransaction(prev => ({ ...prev, category }));
    setFormErrors(prev => ({ ...prev, category: '' }));
    
    // Auto-link to budget if it's an expense and budget exists for the category
    if (newTransaction.type === 'expense' && activeBudgetsByCategory[category]) {
      setNewTransaction(prev => ({ 
        ...prev, 
        category,
        linkedBudget: activeBudgetsByCategory[category]._id
      }));
    } else {
      setNewTransaction(prev => ({ 
        ...prev, 
        category,
        linkedBudget: '' // Clear budget link if no matching budget
      }));
    }
  };
  
  // Handle expense/income toggle with budget implications
  const handleTypeChange = (type: 'income' | 'expense') => {
    setNewTransaction(prev => ({ 
      ...prev, 
      type,
      category: '', // Reset category when changing type
      linkedBudget: '' // Reset budget link when changing type
    }));
    setFormErrors(prev => ({ ...prev, category: '' }));
  };

  // Function to show success feedback
  const showTransactionAddedFeedback = (transactionType: 'income' | 'expense') => {
    setShowSuccessFeedback(true);
    
    // Animate opacity in
    Animated.sequence([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.delay(2000),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      setShowSuccessFeedback(false);
    });
    
    // Show toast on Android
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        `${transactionType === 'income' ? 'Income' : 'Expense'} added successfully!`, 
        ToastAndroid.SHORT
      );
    }
  };

  // For expense transactions, check if a budget exists for the selected category
  const checkBudgetExists = () => {
    if (newTransaction.type === 'expense') {
      const hasBudget = activeBudgetsByCategory[newTransaction.category];
      if (!hasBudget) {
        // Save the current category for the dialog
        setCurrentCategory(newTransaction.category);
        // Show the budget required dialog
        setShowBudgetRequiredDialog(true);
        return false;
      }
    }
    return true;
  };

  // Handle adding new transaction with budget integration
  const handleAddTransaction = async () => {
    // Reset form errors
    const errors = {
      amount: '',
      category: '',
      description: ''
    };
    
    // Validate amount
    if (!newTransaction.amount.trim()) {
      errors.amount = 'Amount is required';
    } else if (parseFloat(newTransaction.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    // Validate category
    if (!newTransaction.category) {
      errors.category = 'Please select a category';
    }
    
    // Validate description
    if (!newTransaction.title.trim()) {
      errors.description = 'Description is required';
    }
    
    // Check for future date
    if (newTransaction.date > new Date()) {
      Alert.alert('Invalid Date', 'Transaction date cannot be in the future');
      return;
    }
    
    // If there are errors, show them and stop submission
    if (errors.amount || errors.category || errors.description) {
      setFormErrors(errors);
      return;
    }

    // Check if budget exists before proceeding
    if (!checkBudgetExists()) {
      return;
    }
    
    // Proceed with saving the transaction
    saveTransaction();
  };

  // Extracted the transaction saving logic to a separate function
  const saveTransaction = async () => {
    // Create title if not provided
    const title = newTransaction.title.trim() 
      ? newTransaction.title 
      : newTransaction.category;
      
    const amount = parseFloat(newTransaction.amount);
    
    // Get icon and color based on category
    const icon = CATEGORY_ICONS[newTransaction.category] || 'wallet-outline';
    const color = CATEGORY_COLORS[newTransaction.category] || theme.colors.primary;
    
    try {
      // For expenses, ensure it's linked to a budget if one exists
      let linkedBudgetId = newTransaction.linkedBudget;
      
      if (newTransaction.type === 'expense' && !linkedBudgetId) {
        // Check if there's an active budget for this category
        if (activeBudgetsByCategory[newTransaction.category]) {
          linkedBudgetId = activeBudgetsByCategory[newTransaction.category]._id;
        }
      }
      
      // Prepare data for API call
      const transactionData = {
        amount,
        type: newTransaction.type,
        category: newTransaction.category,
        description: title,
        date: newTransaction.date,
        paymentMethod: newTransaction.paymentMethod,
        linkedBudget: linkedBudgetId || undefined,
        isRecurring: newTransaction.isRecurring
      };
      
      // Send to API
      const response = await transactionService.createTransaction(transactionData);
      
      // Format for local state update
      const newTransactionObj: Transaction = {
        id: response._id || Date.now().toString(),
        title,
        amount,
        type: newTransaction.type,
        category: newTransaction.category,
        icon,
        color,
        date: newTransaction.date,
        paymentMethod: newTransaction.paymentMethod || '',
        linkedBudget: linkedBudgetId,
        isRecurring: newTransaction.isRecurring
      };
      
      // Update local state
      setTransactions([newTransactionObj, ...transactions]);
      
      // For expenses, explicitly refresh the budget spending calculations
      if (newTransaction.type === 'expense') {
        try {
          // First refresh the spending calculations on the server
          await budgetService.refreshBudgetSpending();
          
          // Then fetch updated budgets
          const budgets = await budgetService.getBudgets();
          setAvailableBudgets(budgets);
          
          // Update active budgets map
          const budgetMap: Record<string, BudgetType> = {};
          budgets.forEach(budget => {
            const now = new Date();
            if (new Date(budget.startDate) <= now && new Date(budget.endDate) >= now) {
              budgetMap[budget.category] = budget;
            }
          });
          setActiveBudgetsByCategory(budgetMap);
          
          console.log('Successfully refreshed budget data after transaction');
        } catch (refreshError) {
          console.error('Error refreshing budget data:', refreshError);
        }
      }
      
      // Show success feedback
      showTransactionAddedFeedback(newTransaction.type);
      
      // Reset form and close modal
      resetForm();
      setShowAddModal(false);
      
      // Refresh transaction list
      fetchTransactions();
      
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert(
        'Error',
        'Failed to create transaction. Please try again.'
      );
    }
  };
  
  // Handle date change
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setNewTransaction(prev => ({ ...prev, date: selectedDate }));
    }
  };
  
  // Get appropriate categories based on transaction type
  const getCategories = () => {
    return newTransaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  };

  // Handle opening the options modal for a transaction
  const handleOpenOptions = (transaction: Transaction, event: any) => {
    event.stopPropagation();
    setSelectedTransaction(transaction);
    
    // Measure the position of the touchable that was pressed
    event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      // Position the menu to the left of the button, slightly below it
      setMenuPosition({ 
        x: pageX - 140, // Position left of the button with width of 140
        y: pageY + height 
      });
      setShowOptionsModal(true);
    });
  };

  // Handle edit transaction
  const handleEditTransaction = () => {
    if (selectedTransaction) {
      // Set up edit restrictions - type cannot be changed, date cannot be changed
      setEditRestrictions({
        canEditType: false, // Prevent changing income/expense
        canEditDate: false, // Prevent changing date
      });

      setEditedTransaction({
        title: selectedTransaction.title || '', // Description
        amount: selectedTransaction.amount.toString(),
        type: selectedTransaction.type,
        category: selectedTransaction.category,
        date: selectedTransaction.date,
        paymentMethod: selectedTransaction.paymentMethod || '',
        linkedBudget: selectedTransaction.linkedBudget || ''
      });
      setShowOptionsModal(false);
      setShowEditModal(true);
    }
  };

  // Handle delete transaction
  const handleDeleteTransaction = () => {
    setShowOptionsModal(false);
    setShowDeleteDialog(true);
  };

  // Confirm deletion of transaction
  const confirmDeleteTransaction = async () => {
    if (!selectedTransaction) return;
    
    try {
      setShowDeleteDialog(false);
      setLoading(true);
      
      const success = await transactionService.deleteTransaction(selectedTransaction.id);
      
      if (success) {
        // Remove the transaction from the local state
        setTransactions(transactions.filter(t => t.id !== selectedTransaction.id));
        
        // For expenses, refresh the budget spending calculations
        if (selectedTransaction.type === 'expense') {
          try {
            await budgetService.refreshBudgetSpending();
            const budgets = await budgetService.getBudgets();
            setAvailableBudgets(budgets);
            
            // Update active budgets map
            const budgetMap: Record<string, BudgetType> = {};
            budgets.forEach(budget => {
              const now = new Date();
              if (new Date(budget.startDate) <= now && new Date(budget.endDate) >= now) {
                budgetMap[budget.category] = budget;
              }
            });
            setActiveBudgetsByCategory(budgetMap);
          } catch (refreshError) {
            console.error('Error refreshing budget data:', refreshError);
          }
        }
        
        // Show success message
        setShowDeleteDialog(false);
        // Show dialog with auto-dismiss
        showDialog({
          type: 'success',
          title: 'Success',
          message: 'Transaction deleted successfully',
          autoDismiss: true
        });
      } else {
        throw new Error('Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showDialog({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete transaction. Please try again.',
        autoDismiss: true
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle saving edited transaction
  const handleSaveEditedTransaction = async () => {
    if (!selectedTransaction) return;
    
    // Reset form errors
    const errors = {
      amount: '',
      category: '',
      description: ''
    };
    
    // Validate amount
    if (!editedTransaction.amount.trim()) {
      errors.amount = 'Amount is required';
    } else if (parseFloat(editedTransaction.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    // Validate category
    if (!editedTransaction.category) {
      errors.category = 'Please select a category';
    }
    
    // Validate description
    if (!editedTransaction.title.trim()) {
      errors.description = 'Description is required';
    }
    
    // If there are errors, show them and stop submission
    if (errors.amount || errors.category || errors.description) {
      setFormErrors(errors);
      return;
    }
    
    try {
      setLoading(true);
      
      // Use the title from form as the description (it's required now)
      const title = editedTransaction.title.trim();
        
      const amount = parseFloat(editedTransaction.amount);
        
      // Get icon and color based on category
      const icon = CATEGORY_ICONS[editedTransaction.category] || 'wallet-outline';
      const color = CATEGORY_COLORS[editedTransaction.category] || theme.colors.primary;
        
      // Auto-reassign budget if category has changed and it's an expense
      let linkedBudgetId = editedTransaction.linkedBudget;
        
      if (editedTransaction.type === 'expense') {
        // Check if category has changed
        if (editedTransaction.category !== selectedTransaction.category) {
          // Reset the budget link
          linkedBudgetId = '';
          
          // Check if there's an active budget for the new category
          if (activeBudgetsByCategory[editedTransaction.category]) {
            linkedBudgetId = activeBudgetsByCategory[editedTransaction.category]._id;
            
            // Show a toast notification about budget reassignment
            if (Platform.OS === 'android') {
              ToastAndroid.show(
                `Transaction reassigned to ${editedTransaction.category} budget`, 
                ToastAndroid.SHORT
              );
            }
          }
        }
      } else {
        // For income transactions, clear any budget link
        linkedBudgetId = '';
      }
        
      // Prepare data for API call
      const transactionData = {
        amount,
        // Don't allow type changes - use the original type
        type: selectedTransaction.type,
        category: editedTransaction.category,
        description: title,
        // Don't allow date changes - use the original date
        date: selectedTransaction.date,
        paymentMethod: editedTransaction.paymentMethod,
        linkedBudget: linkedBudgetId || undefined,
        isRecurring: selectedTransaction.isRecurring
      };
        
      // Update transaction on server
      const updatedTransaction = await transactionService.updateTransaction(selectedTransaction.id, transactionData);
        
      // Format for local state update
      const updatedTransactionObj: Transaction = {
        id: selectedTransaction.id,
        title,
        amount,
        type: selectedTransaction.type, // Keep original type
        category: editedTransaction.category,
        icon,
        color,
        date: selectedTransaction.date, // Keep original date
        paymentMethod: editedTransaction.paymentMethod || '',
        linkedBudget: linkedBudgetId,
        isRecurring: selectedTransaction.isRecurring
      };
        
      // Update the transaction in the local state
      setTransactions(transactions.map(t => 
        t.id === selectedTransaction.id ? updatedTransactionObj : t
      ));
        
      // For expenses, refresh the budget spending calculations
      if (selectedTransaction.type === 'expense') {
        try {
          await budgetService.refreshBudgetSpending();
          const budgets = await budgetService.getBudgets();
          setAvailableBudgets(budgets);
          
          // Update active budgets map
          const budgetMap: Record<string, BudgetType> = {};
          budgets.forEach(budget => {
            const now = new Date();
            if (new Date(budget.startDate) <= now && new Date(budget.endDate) >= now) {
              budgetMap[budget.category] = budget;
            }
          });
          setActiveBudgetsByCategory(budgetMap);
        } catch (refreshError) {
          console.error('Error refreshing budget data:', refreshError);
        }
      }
        
      setShowEditModal(false);
        
      // Show success dialog with auto-dismiss
      showDialog({
        type: 'success',
        title: 'Success',
        message: 'Transaction updated successfully',
        autoDismiss: true
      });
        
    } catch (error) {
      console.error('Error updating transaction:', error);
      showDialog({
        type: 'error',
        title: 'Error',
        message: 'Failed to update transaction. Please try again.',
        autoDismiss: true
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle date change for edit modal
  const handleEditDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePickerEdit(false);
    if (selectedDate) {
      setEditedTransaction(prev => ({ ...prev, date: selectedDate }));
    }
  };

  // Add or update the showDialog function if it doesn't exist
  const showDialog = ({ 
    type, 
    title, 
    message, 
    actionText, 
    onAction,
    autoDismiss = false 
  }: {
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    actionText?: string,
    onAction?: () => void,
    autoDismiss?: boolean
  }) => {
    setDialogConfig({
      visible: true,
      type,
      title,
      message,
      actionText,
      onAction,
      autoDismiss
    });
  };

  // Add state for dialog
  const [dialogConfig, setDialogConfig] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    actionText: undefined as string | undefined,
    onAction: undefined as (() => void) | undefined,
    autoDismiss: false
  });

  // Render transaction item with a completely redesigned layout
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isExpense = item.type === 'expense';
    
    return (
      <TouchableOpacity 
        style={[styles.transactionItem, styles.transactionShadow]}
        onPress={() => {
          // View transaction details
          setSelectedTransaction(item);
          handleEditTransaction();
        }}
      >
        {/* Left side - icon and category */}
        <View style={styles.transactionLeftSection}>
          <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon} size={20} color="#fff" />
          </View>
          
          <View style={styles.categoryDetails}>
            <Text style={styles.transactionCategory}>{item.category}</Text>
            <Text style={styles.transactionDate}>
              {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        
        {/* Right side - amount and title */}
        <View style={styles.transactionRightSection}>
          <Text style={[
            styles.transactionAmount,
            isExpense ? styles.expenseAmount : styles.incomeAmount
          ]}>
            {isExpense ? '-' : '+'}{formatCurrency(Math.abs(item.amount))}
          </Text>
          
          <View style={styles.titleAndOptions}>
            <Text style={styles.transactionTitle} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            
            {/* Three-dot menu button */}
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={(event) => handleOpenOptions(item, event)}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textLight} />
            </TouchableOpacity>
          </View>
          
          {item.isRecurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="repeat" size={12} color={theme.colors.white} />
              <Text style={styles.recurringText}>Recurring</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render section header with expand/collapse
  const renderSectionHeader = ({ section: { title } }: { section: GroupedTransaction }) => (
    <TouchableOpacity 
      style={styles.sectionHeader}
      onPress={() => toggleSection(title)}
    >
      <View style={styles.sectionHeaderContent}>
        <Text style={styles.sectionTitle}>
          {new Date(title).toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </Text>
        <Ionicons 
          name={expandedSections[title] ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={theme.colors.textLight} 
        />
      </View>
    </TouchableOpacity>
  );

  // Render transaction list with expandable sections
  const renderTransactionList = () => (
    <SectionList
      sections={getGroupedTransactions()}
      renderItem={({ item, section }) => 
        expandedSections[section.title] ? renderTransactionItem({ item }) : null
      }
      renderSectionHeader={renderSectionHeader}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={renderEmptyState}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  // Empty state when no transactions
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="wallet-outline" size={80} color={theme.colors.gray} />
      <Text style={styles.emptyStateTitle}>No transactions yet</Text>
      <Text style={styles.emptyStateText}>
        Start by logging your expenses or income!
      </Text>
      <TouchableOpacity 
        style={styles.emptyStateButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.white} style={{ marginRight: 8 }} />
        <Text style={styles.emptyStateButtonText}>Add Your First Transaction</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty state check - determine if we have transactions
  const hasTransactions = transactions.length > 0;

  // Render add transaction modal
  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Transaction Type Toggle */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newTransaction.type === 'income' && styles.incomeTypeButton
                  ]}
                  onPress={() => handleTypeChange('income')}
                >
                  <Ionicons 
                    name="arrow-down-circle" 
                    size={20} 
                    color={newTransaction.type === 'income' ? theme.colors.white : theme.colors.textLight} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    newTransaction.type === 'income' && styles.activeTypeButtonText
                  ]}>
                    Income
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newTransaction.type === 'expense' && styles.expenseTypeButton
                  ]}
                  onPress={() => handleTypeChange('expense')}
                >
                  <Ionicons 
                    name="arrow-up-circle" 
                    size={20} 
                    color={newTransaction.type === 'expense' ? theme.colors.white : theme.colors.textLight} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    newTransaction.type === 'expense' && styles.activeTypeButtonText
                  ]}>
                    Expense
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <Text style={styles.inputLabel}>Amount *</Text>
              <View style={[
                styles.currencyInputContainer,
                formErrors.amount ? styles.inputError : null
              ]}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <TextInput
                  style={styles.currencyInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={newTransaction.amount}
                  onChangeText={(text) => {
                    setNewTransaction(prev => ({ ...prev, amount: text }));
                    if (text.trim() && parseFloat(text) > 0) {
                      setFormErrors(prev => ({ ...prev, amount: '' }));
                    }
                  }}
                />
              </View>
              {formErrors.amount ? (
                <Text style={styles.errorText}>{formErrors.amount}</Text>
              ) : null}

              {/* Category Selection */}
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={[
                styles.pickerContainer,
                formErrors.category ? styles.inputError : null
              ]}>
                <Picker
                  selectedValue={newTransaction.category}
                  onValueChange={handleCategorySelect}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a category" value="" color={theme.colors.textLight} />
                  {getCategories().map(category => {
                    // For expenses, show if a budget exists
                    const hasBudget = newTransaction.type === 'expense' && activeBudgetsByCategory[category];
                    
                    return (
                      <Picker.Item 
                        key={category} 
                        label={hasBudget ? `${category} (Budget: ${activeBudgetsByCategory[category].amount})` : category} 
                        value={category} 
                      />
                    );
                  })}
                </Picker>
              </View>
              {formErrors.category ? (
                <Text style={styles.errorText}>{formErrors.category}</Text>
              ) : null}

              {/* Budget Status - only show for expense transactions with linked budget */}
              {newTransaction.type === 'expense' && 
               newTransaction.category && 
               activeBudgetsByCategory[newTransaction.category] && (
                <View style={styles.budgetStatusContainer}>
                  <Text style={styles.budgetStatusLabel}>Budget Status:</Text>
                  <View style={styles.budgetStatusDetails}>
                    <Text style={styles.budgetStatusText}>
                      Allocated: {formatCurrency(activeBudgetsByCategory[newTransaction.category].amount)}
                    </Text>
                    <Text style={styles.budgetStatusText}>
                      Spent: {formatCurrency(activeBudgetsByCategory[newTransaction.category].currentSpending || 0)}
                    </Text>
                    <Text style={styles.budgetStatusText}>
                      Remaining: {formatCurrency((activeBudgetsByCategory[newTransaction.category].amount) - 
                                    (activeBudgetsByCategory[newTransaction.category].currentSpending || 0))}
                    </Text>
                  </View>
                </View>
              )}

              {/* Date Picker */}
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {newTransaction.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={newTransaction.date}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
              
              {/* Description - required */}
              <Text style={styles.inputLabel}>Description *</Text>
              <View style={[
                styles.input,
                formErrors.description ? styles.inputError : null
              ]}>
                <TextInput
                  placeholder="e.g., Grocery Shopping"
                  value={newTransaction.title}
                  onChangeText={(text) => {
                    setNewTransaction(prev => ({ ...prev, title: text }));
                    if (text.trim()) {
                      setFormErrors(prev => ({ ...prev, description: '' }));
                    }
                  }}
                />
              </View>
              {formErrors.description ? (
                <Text style={styles.errorText}>{formErrors.description}</Text>
              ) : null}

              {/* Payment Method */}
              <Text style={styles.inputLabel}>Payment Method (Optional)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newTransaction.paymentMethod}
                  onValueChange={(value) => setNewTransaction(prev => ({ ...prev, paymentMethod: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Select payment method" value="" color={theme.colors.textLight} />
                  {PAYMENT_METHODS.map(method => (
                    <Picker.Item key={method} label={method} value={method} />
                  ))}
                </Picker>
              </View>

              {/* Recurring Toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 15, color: theme.colors.text, fontWeight: '500', flex: 1 }}>Recurring</Text>
                <Switch
                  value={newTransaction.isRecurring}
                  onValueChange={value => setNewTransaction(prev => ({ ...prev, isRecurring: value }))}
                  trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                  thumbColor={newTransaction.isRecurring ? theme.colors.primary : '#f4f3f4'}
                />
              </View>

              {/* Add Button */}
              <TouchableOpacity 
                style={[
                  styles.addButton,
                  newTransaction.type === 'income' ? styles.incomeButton : styles.expenseButton
                ]}
                onPress={handleAddTransaction}
              >
                <Ionicons name="checkmark" size={20} color={theme.colors.white} style={styles.buttonIcon} />
                <Text style={styles.addButtonText}>
                  Add {newTransaction.type === 'income' ? 'Income' : 'Expense'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Navigate to budget screen to create a new budget
  const navigateToBudgetCreation = () => {
    // Close the dialog first
    setShowBudgetRequiredDialog(false);
    // Close the add transaction modal
    setShowAddModal(false);
    
    // Wait for modals to close before navigating
    setTimeout(() => {
      // Navigate to Budget screen with parameters
      navigation.navigate('Budget' as any, {
        showAddModal: true,
        preselectedCategory: currentCategory
      });
    }, 300);
  };

  // Add rendering for options modal
  const renderOptionsModal = () => (
    <Modal
      visible={showOptionsModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowOptionsModal(false)}
    >
      <TouchableOpacity 
        style={styles.optionsOverlay}
        activeOpacity={1}
        onPress={() => setShowOptionsModal(false)}
      >
        <View 
          style={[
            styles.optionsModalContainer, 
            { 
              position: 'absolute',
              left: menuPosition.x,
              top: menuPosition.y,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={handleEditTransaction}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.text} />
            <Text style={styles.optionText}>Edit</Text>
          </TouchableOpacity>
          
          <View style={styles.optionDivider} />
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={handleDeleteTransaction}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            <Text style={[styles.optionText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Render edit transaction modal
  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Transaction Type - Disabled from editing */}
              <View style={styles.disabledSection}>
                <Text style={styles.inputLabel}>Transaction Type</Text>
                <View style={styles.disabledTypeContainer}>
                  <View style={[
                    styles.disabledTypeChip,
                    editedTransaction.type === 'income' 
                      ? styles.incomeTypeChip 
                      : styles.expenseTypeChip
                  ]}>
                    <Ionicons 
                      name={editedTransaction.type === 'income' ? "arrow-down-circle" : "arrow-up-circle"} 
                      size={16} 
                      color={theme.colors.white} 
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.disabledTypeText}>
                      {editedTransaction.type === 'income' ? 'Income' : 'Expense'}
                    </Text>
                  </View>
                  <Text style={styles.disabledHelperText}>Transaction type cannot be changed</Text>
                </View>
              </View>

              {/* Amount */}
              <Text style={styles.inputLabel}>Amount *</Text>
              <View style={[
                styles.currencyInputContainer,
                formErrors.amount ? styles.inputError : null
              ]}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <TextInput
                  style={styles.currencyInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={editedTransaction.amount}
                  onChangeText={(text) => {
                    setEditedTransaction(prev => ({ ...prev, amount: text }));
                    if (text.trim() && parseFloat(text) > 0) {
                      setFormErrors(prev => ({ ...prev, amount: '' }));
                    }
                  }}
                />
              </View>
              {formErrors.amount ? (
                <Text style={styles.errorText}>{formErrors.amount}</Text>
              ) : null}

              {/* Category Selection */}
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={[
                styles.pickerContainer,
                formErrors.category ? styles.inputError : null
              ]}>
                <Picker
                  selectedValue={editedTransaction.category}
                  onValueChange={(value) => {
                    // When category changes, we'll reset the budget link
                    // The correct budget will be auto-assigned on save
                    setEditedTransaction(prev => ({ 
                      ...prev, 
                      category: value,
                      linkedBudget: '' 
                    }));
                    setFormErrors(prev => ({ ...prev, category: '' }));
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a category" value="" color={theme.colors.textLight} />
                  {(editedTransaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(category => {
                    // For expenses, show if a budget exists
                    const hasBudget = editedTransaction.type === 'expense' && activeBudgetsByCategory[category];
                    
                    return (
                      <Picker.Item 
                        key={category} 
                        label={hasBudget ? `${category} (Budget: ${activeBudgetsByCategory[category].amount})` : category} 
                        value={category} 
                      />
                    );
                  })}
                </Picker>
              </View>
              {formErrors.category ? (
                <Text style={styles.errorText}>{formErrors.category}</Text>
              ) : null}

              {/* Budget Status - only show for expense transactions with linked budget */}
              {editedTransaction.type === 'expense' && 
               editedTransaction.category && 
               activeBudgetsByCategory[editedTransaction.category] && (
                <View style={styles.budgetStatusContainer}>
                  <Text style={styles.budgetStatusLabel}>Budget Status:</Text>
                  <View style={styles.budgetStatusDetails}>
                    <Text style={styles.budgetStatusText}>
                      Allocated: {formatCurrency(activeBudgetsByCategory[editedTransaction.category].amount)}
                    </Text>
                    <Text style={styles.budgetStatusText}>
                      Spent: {formatCurrency(activeBudgetsByCategory[editedTransaction.category].currentSpending || 0)}
                    </Text>
                    <Text style={styles.budgetStatusText}>
                      Remaining: {formatCurrency((activeBudgetsByCategory[editedTransaction.category].amount) - 
                                    (activeBudgetsByCategory[editedTransaction.category].currentSpending || 0))}
                    </Text>
                  </View>
                </View>
              )}

              {/* Date - Disabled from editing */}
              <View style={styles.disabledSection}>
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.disabledDateContainer}>
                  <Text style={styles.disabledDateText}>
                    {editedTransaction.date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text style={styles.disabledHelperText}>Transaction date cannot be changed</Text>
                </View>
              </View>
              
              {/* Description - required */}
              <Text style={styles.inputLabel}>Description *</Text>
              <View style={[
                styles.input,
                formErrors.description ? styles.inputError : null
              ]}>
                <TextInput
                  placeholder="e.g., Grocery Shopping"
                  value={editedTransaction.title}
                  onChangeText={(text) => {
                    setEditedTransaction(prev => ({ ...prev, title: text }));
                    if (text.trim()) {
                      setFormErrors(prev => ({ ...prev, description: '' }));
                    }
                  }}
                />
              </View>
              {formErrors.description ? (
                <Text style={styles.errorText}>{formErrors.description}</Text>
              ) : null}

              {/* Payment Method */}
              <Text style={styles.inputLabel}>Payment Method (Optional)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editedTransaction.paymentMethod}
                  onValueChange={(value) => setEditedTransaction(prev => ({ ...prev, paymentMethod: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Select payment method" value="" color={theme.colors.textLight} />
                  {PAYMENT_METHODS.map(method => (
                    <Picker.Item key={method} label={method} value={method} />
                  ))}
                </Picker>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={[
                  styles.addButton,
                  editedTransaction.type === 'income' ? styles.incomeButton : styles.expenseButton
                ]}
                onPress={handleSaveEditedTransaction}
              >
                <Ionicons name="checkmark" size={20} color={theme.colors.white} style={styles.buttonIcon} />
                <Text style={styles.addButtonText}>
                  Save Changes
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Handle navigation to account screen
  const handleProfilePress = () => {
    navigation.navigate('Account');
  };

  // Handle date range filter selection
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range);
    
    // If 'Custom' is selected, show a modal for date range selection
    if (range === 'Custom') {
      showCustomDateRangePicker();
    }
  };
  
  // Function to show custom date range picker modal
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
    
    // Show modal for date range selection
    setShowCustomDateRangeModal(true);
  };
  
  // Handler for start date change in custom range
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setCustomDateRange(prev => ({
      ...prev,
      showStartDatePicker: false
    }));
    
    if (selectedDate) {
      // Set the hours to start of day
      selectedDate.setHours(0, 0, 0, 0);
      
      // Ensure startDate is not after endDate
      const adjustedEndDate = selectedDate > customDateRange.endDate 
        ? selectedDate 
        : customDateRange.endDate;
      
      setCustomDateRange(prev => ({
        ...prev,
        startDate: selectedDate,
        endDate: adjustedEndDate
      }));
    }
  };
  
  // Handler for end date change in custom range
  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setCustomDateRange(prev => ({
      ...prev,
      showEndDatePicker: false
    }));
    
    if (selectedDate) {
      // Set the hours to end of day
      selectedDate.setHours(23, 59, 59, 999);
      
      // Ensure endDate is not before startDate
      const adjustedStartDate = selectedDate < customDateRange.startDate 
        ? selectedDate 
        : customDateRange.startDate;
      
      setCustomDateRange(prev => ({
        ...prev,
        endDate: selectedDate,
        startDate: adjustedStartDate
      }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        onRightIconPress={() => setShowAddModal(true)}
        showProfile={true}
        onProfilePress={handleProfilePress}
      />
      
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Transactions</Text>
      </View>
      
      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
      </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
        >
          {['All', 'Today', 'This Week', 'This Month', 'Custom'].map((range) => (
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
              {customDateRange.startDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })} - {customDateRange.endDate.toLocaleDateString('en-US', {
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <TouchableOpacity onPress={showCustomDateRangePicker}>
              <Text style={styles.customRangeChangeBtn}>Change</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Transaction List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        renderTransactionList()
      )}
      
      {/* Success Feedback */}
      {showSuccessFeedback && (
        <Animated.View style={[styles.successFeedback, { opacity: successOpacity }]}>
          <Ionicons 
            name="checkmark-circle" 
            size={20} 
            color={theme.colors.white} 
            style={styles.successIcon} 
          />
          <Text style={styles.successText}>Transaction added successfully!</Text>
        </Animated.View>
      )}
      
      {/* Floating Action Button - Only show when we have transactions */}
      {transactions.length > 0 && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            setNewTransaction(prev => ({ ...prev, type: lastTransactionType }));
            setShowAddModal(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {/* Add Transaction Modal */}
      {renderAddModal()}
      
      {/* Options Modal */}
      {renderOptionsModal()}
      
      {/* Edit Transaction Modal */}
      {renderEditModal()}
      
      {/* Budget Required Dialog */}
      <MessageDialog
        visible={showBudgetRequiredDialog}
        type="warning"
        title="Budget Required"
        message={`You don't have a budget for "${currentCategory}". It's recommended to set a budget before adding expenses.`}
        onDismiss={() => setShowBudgetRequiredDialog(false)}
        onAction={navigateToBudgetCreation}
        actionText="Create Budget"
      />
      
      {/* Delete Confirmation Dialog */}
      <MessageDialog
        visible={showDeleteDialog}
        type="warning"
        title="Confirm Delete"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        onDismiss={() => setShowDeleteDialog(false)}
        onAction={confirmDeleteTransaction}
        actionText="Delete"
      />
      
      {/* General Message Dialog */}
      <MessageDialog
        visible={dialogConfig.visible}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onDismiss={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
        onAction={dialogConfig.onAction}
        actionText={dialogConfig.actionText}
        autoDismiss={dialogConfig.autoDismiss}
      />
      
      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateRangeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomDateRangeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { height: 'auto', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomDateRangeModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              {/* Remove the Preset Date Range Options section */}
              
              <View style={styles.dateSelectionContainer}>
                {/* Date Range Display */}
                <View style={styles.dateRangeSummary}>
                  <Text style={styles.dateRangeText}>
                    {customDateRange.startDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text style={styles.dateRangeSeparator}>to</Text>
                  <Text style={styles.dateRangeText}>
                    {customDateRange.endDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              
                {/* Start Date */}
                <Text style={styles.inputLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setCustomDateRange(prev => ({ 
                    ...prev, 
                    showStartDatePicker: true,
                    showEndDatePicker: false 
                  }))}
                >
                  <Text style={styles.dateButtonText}>
                    {customDateRange.startDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                {customDateRange.showStartDatePicker && (
                  <DateTimePicker
                    value={customDateRange.startDate}
                    mode="date"
                    display="default"
                    onChange={handleStartDateChange}
                    maximumDate={new Date()}
                  />
                )}
                
                {/* End Date */}
                <Text style={styles.inputLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setCustomDateRange(prev => ({ 
                    ...prev, 
                    showEndDatePicker: true,
                    showStartDatePicker: false 
                  }))}
                >
                  <Text style={styles.dateButtonText}>
                    {customDateRange.endDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                {customDateRange.showEndDatePicker && (
                  <DateTimePicker
                    value={customDateRange.endDate}
                    mode="date"
                    display="default"
                    onChange={handleEndDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </View>
              
              {/* Apply Button */}
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  setShowCustomDateRangeModal(false);
                  // Ensure the selected date range is set to Custom
                  setSelectedDateRange('Custom');
                }}
              >
                <Ionicons name="checkmark" size={20} color={theme.colors.white} style={styles.buttonIcon} />
                <Text style={styles.addButtonText}>Apply Custom Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
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
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text,
  },
  filterContainer: {
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transactionShadow: {
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
  transactionLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDetails: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.colors.textLight,
  },
  transactionRightSection: {
    alignItems: 'flex-end',
    flex: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  expenseAmount: {
    color: theme.colors.error,
  },
  incomeAmount: {
    color: theme.colors.success,
  },
  titleAndOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 13,
    color: theme.colors.textLight,
    maxWidth: '80%',
  },
  optionsButton: {
    padding: 2,
    marginLeft: 4,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  recurringText: {
    fontSize: 10,
    color: theme.colors.white,
    marginLeft: 2,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalContent: {
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    gap: 8,
  },
  incomeTypeButton: {
    backgroundColor: theme.colors.success,
  },
  expenseTypeButton: {
    backgroundColor: theme.colors.error,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textLight,
  },
  activeTypeButtonText: {
    color: theme.colors.white,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    marginBottom: 16,
  },
  currencySymbol: {
    paddingLeft: 14,
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '500',
  },
  currencyInput: {
    flex: 1,
    padding: 14,
    fontSize: 18,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  noteInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.lightGray,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleHandle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.white,
  },
  toggleHandleActive: {
    transform: [{ translateX: 20 }],
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  incomeButton: {
    backgroundColor: theme.colors.success,
  },
  expenseButton: {
    backgroundColor: theme.colors.error,
  },
  buttonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  budgetStatusContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  budgetStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  budgetStatusDetails: {
    paddingLeft: 8,
  },
  budgetStatusText: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  successFeedback: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.success,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  successIcon: {
    marginRight: 8,
  },
  successText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  optionsModalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    width: 140,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  optionText: {
    fontSize: 15,
    marginLeft: 12,
    color: theme.colors.text,
  },
  optionDivider: {
    height: 1,
    backgroundColor: theme.colors.lightGray,
    marginHorizontal: 8,
  },
  disabledSection: {
    marginBottom: 16,
  },
  disabledTypeContainer: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: 8,
    padding: 12,
  },
  disabledTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  incomeTypeChip: {
    backgroundColor: theme.colors.success,
  },
  expenseTypeChip: {
    backgroundColor: theme.colors.error,
  },
  disabledTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.white,
  },
  disabledHelperText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  disabledDateContainer: {
    backgroundColor: theme.colors.lightGray,
    borderRadius: 8,
    padding: 12,
  },
  disabledDateText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  customRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
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
  dateSelectionContainer: {
    marginBottom: 16,
  },
  dateRangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  dateRangeText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  dateRangeSeparator: {
    fontSize: 15,
    color: theme.colors.textLight,
    marginHorizontal: 10,
  },
});

export default TransactionsScreen;
