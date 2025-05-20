import AsyncStorage from '@react-native-async-storage/async-storage';

// Currency mapping
export interface CurrencyOption {
  symbol: string;
  code: string;
  name: string;
  decimal: number;
}

// Supported currencies
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { symbol: '₱', code: 'PHP', name: 'Philippine Peso', decimal: 2 },
  { symbol: '$', code: 'USD', name: 'US Dollar', decimal: 2 },
  { symbol: '€', code: 'EUR', name: 'Euro', decimal: 2 },
  { symbol: '£', code: 'GBP', name: 'British Pound', decimal: 2 },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen', decimal: 0 },
];

// Default currency
export const DEFAULT_CURRENCY = SUPPORTED_CURRENCIES[0];

/**
 * Format a number as currency with the given currency symbol and options
 */
export const formatCurrency = (
  amount: number,
  currencyOption: CurrencyOption = DEFAULT_CURRENCY
): string => {
  const { symbol, code, decimal } = currencyOption;
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: decimal,
      maximumFractionDigits: decimal,
    }).format(amount || 0);
  } catch (error) {
    // Fallback for older devices or browsers
    const formattedAmount = (amount || 0).toFixed(decimal);
    return `${symbol}${formattedAmount}`;
  }
};

/**
 * Get currency option by symbol
 */
export const getCurrencyBySymbol = (symbol: string): CurrencyOption => {
  return SUPPORTED_CURRENCIES.find(c => c.symbol === symbol) || DEFAULT_CURRENCY;
};

/**
 * Load preferred currency from storage
 */
export const loadPreferredCurrency = async (): Promise<CurrencyOption> => {
  try {
    const savedCurrency = await AsyncStorage.getItem('preferred_currency');
    if (savedCurrency) {
      return getCurrencyBySymbol(savedCurrency);
    }
    return DEFAULT_CURRENCY;
  } catch (error) {
    console.error('Error loading preferred currency:', error);
    return DEFAULT_CURRENCY;
  }
};

/**
 * Save preferred currency to storage
 */
export const savePreferredCurrency = async (currencySymbol: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('preferred_currency', currencySymbol);
  } catch (error) {
    console.error('Error saving preferred currency:', error);
  }
}; 