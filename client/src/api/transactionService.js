import api from './api';

// Get all transactions
export const getTransactions = async () => {
  try {
    const response = await api.get('/transactions');
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to fetch transactions');
  }
};

// Get a specific transaction
export const getTransaction = async (id) => {
  try {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to fetch transaction');
  }
};

// Create a new transaction
export const createTransaction = async (transactionData) => {
  try {
    const response = await api.post('/transactions', transactionData);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to create transaction');
  }
};

// Update a transaction
export const updateTransaction = async (id, transactionData) => {
  try {
    const response = await api.patch(`/transactions/${id}`, transactionData);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to update transaction');
  }
};

// Delete a transaction
export const deleteTransaction = async (id) => {
  try {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to delete transaction');
  }
}; 