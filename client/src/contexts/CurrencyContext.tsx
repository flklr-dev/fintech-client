import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  CurrencyOption, 
  DEFAULT_CURRENCY, 
  loadPreferredCurrency, 
  savePreferredCurrency,
  formatCurrency as formatCurrencyUtil
} from '../utils/currencyUtils';

// Define the context shape
interface CurrencyContextType {
  currency: CurrencyOption;
  setCurrency: (currencySymbol: string) => Promise<void>;
  formatCurrency: (amount: number, formatter?: (num: number) => string) => string;
}

// Create the context with default values
const CurrencyContext = createContext<CurrencyContextType>({
  currency: DEFAULT_CURRENCY,
  setCurrency: async () => {},
  formatCurrency: () => '',
});

// Custom hook to use the currency context
export const useCurrency = () => useContext(CurrencyContext);

// Provider component
interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyOption>(DEFAULT_CURRENCY);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved currency on mount
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const savedCurrency = await loadPreferredCurrency();
        setCurrencyState(savedCurrency);
      } catch (error) {
        console.error('Failed to load currency:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrency();
  }, []);

  // Function to update currency
  const setCurrency = async (currencySymbol: string) => {
    try {
      await savePreferredCurrency(currencySymbol);
      // Update state with full currency object
      const updatedCurrency = await loadPreferredCurrency();
      setCurrencyState(updatedCurrency);
    } catch (error) {
      console.error('Failed to set currency:', error);
    }
  };

  // Format currency using the current currency settings
  const formatCurrency = (amount: number, formatter?: (num: number) => string): string => {
    const formattedNumber = formatter ? formatter(amount) : amount.toFixed(2);
    return `${currency.symbol}${formattedNumber}`;
  };

  // Provide loading state or context
  if (isLoading) {
    return null; // Or a loading indicator if needed
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}; 