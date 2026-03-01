import * as SecureStore from 'expo-secure-store';

/**
 * Utilitaires pour le stockage sécurisé des données
 * Similaire à localStorage du web mais sécurisé
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
};

/**
 * Sauvegarder le token d'accès
 */
export const saveAccessToken = async (token) => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, token);
  } catch (error) {
    console.error('❌ Erreur sauvegarde token:', error);
  }
};

/**
 * Récupérer le token d'accès
 */
export const getAccessToken = async () => {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('❌ Erreur récupération token:', error);
    return null;
  }
};

/**
 * Sauvegarder le refresh token
 */
export const saveRefreshToken = async (token) => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
  } catch (error) {
    console.error('❌ Erreur sauvegarde refresh token:', error);
  }
};

/**
 * Récupérer le refresh token
 */
export const getRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('❌ Erreur récupération refresh token:', error);
    return null;
  }
};

/**
 * Sauvegarder les données utilisateur
 */
export const saveUserData = async (userData) => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('❌ Erreur sauvegarde user data:', error);
  }
};

/**
 * Récupérer les données utilisateur
 */
export const getUserData = async () => {
  try {
    const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('❌ Erreur récupération user data:', error);
    return null;
  }
};

/**
 * Supprimer toutes les données (logout)
 */
export const clearAllData = async () => {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error('❌ Erreur suppression données:', error);
  }
};
