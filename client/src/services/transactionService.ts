import api from '../api/api';

export interface Transaction {
  _id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description?: string;
  date: Date;
  createdAt: Date;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'income' | 'expense';
  category?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface CreateTransactionDTO {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description?: string;
  date?: Date;
}

export interface UpdateTransactionDTO extends Partial<CreateTransactionDTO> {}

// Get all transactions with optional filters
export const getTransactions = async (filters?: TransactionFilters): Promise<Transaction[]> => {
  try {
    const params: Record<string, any> = {};
    
    if (filters) {
      if (filters.startDate) params.startDate = filters.startDate.toISOString();
      if (filters.endDate) params.endDate = filters.endDate.toISOString();
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.minAmount) params.minAmount = filters.minAmount;
      if (filters.maxAmount) params.maxAmount = filters.maxAmount;
    }
    
    const response = await api.get('/transactions', { params });
    
    // Parse date strings into Date objects
    return (response.data.data.transactions || []).map((transaction: any) => ({
      ...transaction,
      date: new Date(transaction.date),
      createdAt: new Date(transaction.createdAt)
    }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

// Get a specific transaction by ID
export const getTransaction = async (id: string): Promise<Transaction | null> => {
  try {
    const response = await api.get(`/transactions/${id}`);
    const transaction = response.data.data.transaction;
    
    if (!transaction) return null;
    
    return {
      ...transaction,
      date: new Date(transaction.date),
      createdAt: new Date(transaction.createdAt)
    };
  } catch (error) {
    console.error(`Error fetching transaction ${id}:`, error);
    return null;
  }
};

// Create a new transaction
export const createTransaction = async (data: CreateTransactionDTO): Promise<Transaction> => {
  try {
    // Ensure amount is positive
    const transactionData = {
      ...data,
      amount: Math.abs(data.amount)
    };
    
    // If date is not provided, set it to the current date
    if (!transactionData.date) {
      transactionData.date = new Date();
    }
    
    console.log('Creating transaction:', transactionData);
    const response = await api.post('/transactions', transactionData);
    const transaction = response.data.data.transaction;
    
    return {
      ...transaction,
      date: new Date(transaction.date),
      createdAt: new Date(transaction.createdAt)
    };
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
};

// Update a transaction
export const updateTransaction = async (id: string, data: UpdateTransactionDTO): Promise<Transaction> => {
  try {
    // If amount is provided, ensure it's positive
    const updateData: UpdateTransactionDTO = { ...data };
    if (updateData.amount !== undefined) {
      updateData.amount = Math.abs(updateData.amount);
    }
    
    const response = await api.patch(`/transactions/${id}`, updateData);
    const transaction = response.data.data.transaction;
    
    return {
      ...transaction,
      date: new Date(transaction.date),
      createdAt: new Date(transaction.createdAt)
    };
  } catch (error) {
    console.error(`Error updating transaction ${id}:`, error);
    throw error;
  }
};

// Delete a transaction
export const deleteTransaction = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/transactions/${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting transaction ${id}:`, error);
    return false;
  }
};

// For convenience, the wrapped service object
export default {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction
}; 