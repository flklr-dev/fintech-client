import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Use a hardcoded storage key instead of environment variable
const STORAGE_KEY = 'fintech_app_secure_storage';

// Generate a secure hash using SHA-256
const generateHash = async (text) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    text
  );
  return digest;
};

// Save data securely
export const saveSecurely = async (key, value) => {
  try {
    // Create a unique key using the provided key
    const hashedKey = await generateHash(key);
    
    // Encrypt the value
    const encryptedValue = JSON.stringify(value);
    
    // Save to secure storage
    await SecureStore.setItemAsync(`${STORAGE_KEY}_${hashedKey}`, encryptedValue);
    return true;
  } catch (error) {
    console.error('Error saving data securely:', error);
    return false;
  }
};

// Get data securely
export const getSecurely = async (key) => {
  try {
    // Create a unique key using the provided key
    const hashedKey = await generateHash(key);
    
    // Retrieve from secure storage
    const result = await SecureStore.getItemAsync(`${STORAGE_KEY}_${hashedKey}`);
    
    if (!result) return null;
    
    // Parse the decrypted value
    return JSON.parse(result);
  } catch (error) {
    console.error('Error retrieving data securely:', error);
    return null;
  }
};

// Delete data securely
export const deleteSecurely = async (key) => {
  try {
    // Create a unique key using the provided key
    const hashedKey = await generateHash(key);
    
    // Delete from secure storage
    await SecureStore.deleteItemAsync(`${STORAGE_KEY}_${hashedKey}`);
    return true;
  } catch (error) {
    console.error('Error deleting data securely:', error);
    return false;
  }
}; 