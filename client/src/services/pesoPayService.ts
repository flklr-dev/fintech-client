import api from '../api/api';

export interface BankCard {
  id: string;
  _id?: string; // MongoDB id field
  cardNumber: string;
  cardType: 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER';
  cardholderName: string;
  expiryDate: string;
  isDefault: boolean;
  lastFourDigits: string;
  bankName: string;
}

export interface BankAccount {
  id: string;
  _id?: string; // MongoDB id field
  accountNumber: string;
  accountType: 'SAVINGS' | 'CHECKING';
  bankName: string;
  accountName: string;
  isDefault: boolean;
}

export interface LinkCardRequest {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
}

export interface LinkAccountRequest {
  accountNumber: string;
  accountType: 'SAVINGS' | 'CHECKING';
  bankName: string;
  accountName: string;
}

// Get all linked cards
export const getLinkedCards = async (): Promise<BankCard[]> => {
  try {
    const response = await api.get('/pesopay/cards');
    return response.data.data.cards;
  } catch (error) {
    console.error('Error fetching linked cards:', error);
    throw error;
  }
};

// Get all linked bank accounts
export const getLinkedAccounts = async (): Promise<BankAccount[]> => {
  try {
    const response = await api.get('/pesopay/accounts');
    return response.data.data.accounts;
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    throw error;
  }
};

// Link a new card
export const linkCard = async (cardData: LinkCardRequest): Promise<BankCard> => {
  try {
    const response = await api.post('/pesopay/cards', cardData);
    return response.data.data.card;
  } catch (error) {
    console.error('Error linking card:', error);
    throw error;
  }
};

// Link a new bank account
export const linkAccount = async (accountData: LinkAccountRequest): Promise<BankAccount> => {
  try {
    const response = await api.post('/pesopay/accounts', accountData);
    return response.data.data.account;
  } catch (error) {
    console.error('Error linking account:', error);
    throw error;
  }
};

// Remove a linked card
export const removeCard = async (cardId: string): Promise<boolean> => {
  try {
    await api.delete(`/pesopay/cards/${cardId}`);
    return true;
  } catch (error) {
    console.error('Error removing card:', error);
    return false;
  }
};

// Remove a linked account
export const removeAccount = async (accountId: string): Promise<boolean> => {
  try {
    await api.delete(`/pesopay/accounts/${accountId}`);
    return true;
  } catch (error) {
    console.error('Error removing account:', error);
    return false;
  }
};

// Set default card
export const setDefaultCard = async (cardId: string): Promise<BankCard> => {
  try {
    const response = await api.patch(`/pesopay/cards/${cardId}/default`);
    return response.data.data.card;
  } catch (error) {
    console.error('Error setting default card:', error);
    throw error;
  }
};

// Set default account
export const setDefaultAccount = async (accountId: string): Promise<BankAccount> => {
  try {
    const response = await api.patch(`/pesopay/accounts/${accountId}/default`);
    return response.data.data.account;
  } catch (error) {
    console.error('Error setting default account:', error);
    throw error;
  }
};

export default {
  getLinkedCards,
  getLinkedAccounts,
  linkCard,
  linkAccount,
  removeCard,
  removeAccount,
  setDefaultCard,
  setDefaultAccount
}; 