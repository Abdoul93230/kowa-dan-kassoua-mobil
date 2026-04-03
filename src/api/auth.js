import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { getAccessToken, getRefreshToken, saveAccessToken, clearAllData } from '../utils/storage';

/**
 * Client API centralisé avec gestion automatique des tokens
 * Similaire à frontend-web/src/lib/api/auth.ts mais adapté pour React Native
 */

// Créer l'instance axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

// Intercepteur de requête : Ajouter automatiquement le token
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponse : Gérer le refresh token automatiquement
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const shouldSkipRefresh = [
      '/auth/login',
      '/auth/register',
      '/auth/send-otp',
      '/auth/verify-otp',
      '/auth/forgot-password',
      '/auth/verify-reset-code',
      '/auth/reset-password',
      '/auth/refresh',
    ].includes(requestUrl);

    // Si 401 et pas déjà réessayé
    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Appeler l'endpoint de refresh
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data;

        // Sauvegarder le nouveau token
        await saveAccessToken(accessToken);

        // Réessayer la requête originale
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        console.error('❌ Erreur refresh token:', refreshError);
        // Token invalide, déconnecter l'utilisateur
        await clearAllData();
        // TODO: Naviguer vers l'écran de login
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Inscription
 */
export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de l\'inscription'
    );
  }
};

/**
 * Connexion
 */
export const login = async (phoneOrEmail, password) => {
  try {
    // Déterminer si c'est un email ou un téléphone
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneOrEmail);
    
    const payload = {
      loginType: isEmail ? 'email' : 'phone',
      password,
    };
    
    if (isEmail) {
      payload.email = phoneOrEmail;
    } else {
      payload.phone = phoneOrEmail;
    }
    
    const response = await api.post('/auth/login', payload);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    throw new Error(
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Erreur lors de la connexion'
    );
  }
};

/**
 * Récupérer le profil utilisateur
 */
export const getProfile = async () => {
  try {
    const response = await api.get('/auth/profile');
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération profil:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de la récupération du profil'
    );
  }
};

/**
 * Mettre à jour le profil
 */
export const updateProfile = async (userData) => {
  try {
    const response = await api.put('/auth/profile', userData);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de la mise à jour du profil'
    );
  }
};

/**
 * Envoyer code OTP pour inscription
 * @param {string} phone - Numéro de téléphone au format "+227 12345678"
 * @returns {Promise<{success: boolean, data: {attemptsRemaining: number, devOTPCode?: string}}>}
 */
export const sendOTP = async (phone) => {
  try {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi OTP:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de l\'envoi du code OTP'
    );
  }
};

/**
 * Vérifier code OTP pour inscription
 * @param {string} phone - Numéro de téléphone
 * @param {string} code - Code OTP à 6 chiffres
 * @returns {Promise<{success: boolean, data: {verified: boolean}}>}
 */
export const verifyOTP = async (phone, code) => {
  try {
    const response = await api.post('/auth/verify-otp', { phone, code });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur vérification OTP:', error);
    throw new Error(
      error.response?.data?.message || 'Code invalide ou expiré'
    );
  }
};

/**
 * Demander réinitialisation mot de passe (envoie OTP)
 * @param {string} identifier - Email ou numéro de téléphone
 * @returns {Promise<{success: boolean, devCode?: string}>}
 */
export const forgotPassword = async (identifier) => {
  try {
    const response = await api.post('/auth/forgot-password', { identifier });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur demande réinitialisation:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de la demande de réinitialisation'
    );
  }
};

/**
 * Vérifier code de réinitialisation
 * @param {string} identifier - Email ou numéro de téléphone
 * @param {string} code - Code OTP à 6 chiffres
 * @returns {Promise<{success: boolean}>}
 */
export const verifyResetCode = async (identifier, code) => {
  try {
    const response = await api.post('/auth/verify-reset-code', { identifier, code });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur vérification code réinitialisation:', error);
    throw new Error(
      error.response?.data?.message || 'Code invalide ou expiré'
    );
  }
};

/**
 * Réinitialiser le mot de passe
 * @param {string} identifier - Email ou numéro de téléphone
 * @param {string} code - Code OTP à 6 chiffres
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Promise<{success: boolean}>}
 */
export const resetPassword = async (identifier, code, newPassword) => {
  try {
    const response = await api.post('/auth/reset-password', { identifier, code, newPassword });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur réinitialisation mot de passe:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de la réinitialisation du mot de passe'
    );
  }
};

/**
 * Vérifier si un numéro de téléphone existe (Mode 1)
 * @param {string} phone - Numéro de téléphone au format "+227 12345678"
 * @returns {Promise<{success: boolean, data: {exists: boolean}}>}
 */
export const checkPhone = async (phone) => {
  try {
    const response = await api.post('/auth/check-phone', { phone });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur check-phone:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de la vérification du numéro'
    );
  }
};

/**
 * Inscription rapide contextuelle (Mode 1)
 * @param {Object} data - { name, phone }
 * @returns {Promise<{success: boolean, data: {user, tokens}, devTempPassword?}>}
 */
export const quickRegister = async ({ name, phone }) => {
  try {
    const response = await api.post('/auth/quick-register', { name, phone });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur quick-register:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors de l\'inscription rapide'
    );
  }
};

/**
 * Changer le mot de passe (authentifié)
 * @param {Object} data - { currentPassword?, newPassword }
 * @returns {Promise<{success: boolean}>}
 */
export const changePassword = async ({ currentPassword, newPassword }) => {
  try {
    const response = await api.put('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur change-password:', error);
    throw new Error(
      error.response?.data?.message || 'Erreur lors du changement de mot de passe'
    );
  }
};

// Export nommé pour compatibilité
export const apiClient = api;

export default api;
