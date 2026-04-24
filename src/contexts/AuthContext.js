import React, { createContext, useState, useContext, useEffect } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { login as apiLogin, register as apiRegister, getProfile, registerPushToken } from '../api/auth';
import {
  saveAccessToken,
  saveRefreshToken,
  saveUserData,
  getAccessToken,
  getUserData,
  clearAllData,
} from '../utils/storage';

/**
 * Context d'authentification global
 * Similaire à frontend-web/src/hooks/useAuth.ts
 */

const AuthContext = createContext(null);
const FALLBACK_EAS_PROJECT_ID = 'c85af018-b333-49ac-9f39-8a3623969b2d';

const syncPushToken = async (userData) => {
  try {
    if (!userData?.id) return;

    if (Constants.appOwnership === 'expo') {
      console.log('ℹ️ Sync push ignorée dans Expo Go (token non fiable pour la prod).');
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      FALLBACK_EAS_PROJECT_ID;

    console.log('📣 Sync push after auth:', {
      userId: userData.id,
      appOwnership: Constants.appOwnership,
      projectId,
    });
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResponse?.data;

    if (!expoPushToken) return;

    await registerPushToken(expoPushToken, userData.id);
    console.log('✅ Push token synchronisé après auth:', userData.id);
  } catch (error) {
    console.error('❌ Erreur sync push token après auth:', error?.response?.data?.message || error?.message || error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Charger l'utilisateur au démarrage
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const storedToken = await getAccessToken();
      const storedUser = await getUserData();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        setIsAuthenticated(true);
        console.log('✅ Utilisateur chargé:', storedUser.name);
      } else {
        console.log('ℹ️ Aucun utilisateur connecté');
      }
    } catch (error) {
      console.error('❌ Erreur chargement utilisateur:', error);
      await clearAllData();
    } finally {
      setLoading(false);
    }
  };

  const login = async (phoneOrEmail, password) => {
    try {
      const response = await apiLogin(phoneOrEmail, password);
      
      if (!response.success) {
        throw new Error(response.message || 'Échec de connexion');
      }

      const { user: userData, tokens } = response.data;
      const { accessToken, refreshToken } = tokens;

      // Sauvegarder les données
      await saveAccessToken(accessToken);
      await saveRefreshToken(refreshToken);
      await saveUserData(userData);

      // Mettre à jour l'état
      setToken(accessToken);
      setUser(userData);
      setIsAuthenticated(true);

      await syncPushToken(userData);

      console.log('✅ Connexion réussie:', userData.name);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la connexion',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await apiRegister(userData);
      
      if (!response.success) {
        throw new Error(response.message || 'Échec d\'inscription');
      }

      const { user: newUser, tokens } = response.data;
      const { accessToken, refreshToken } = tokens;

      // Sauvegarder les données
      await saveAccessToken(accessToken);
      await saveRefreshToken(refreshToken);
      await saveUserData(newUser);

      // Mettre à jour l'état
      setToken(accessToken);
      setUser(newUser);
      setIsAuthenticated(true);

      await syncPushToken(newUser);

      console.log('✅ Inscription réussie:', newUser.name);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de l\'inscription',
      };
    }
  };

  // ✅ Méthode pour forcer la connexion sans appel d'API supplémentaires
  // (Utilisée après quickRegister)
  const setAuthData = async (userData, tokens) => {
    try {
      const { accessToken, refreshToken } = tokens;
      await saveAccessToken(accessToken);
      await saveRefreshToken(refreshToken);
      await saveUserData(userData);
      
      setToken(accessToken);
      setUser(userData);
      setIsAuthenticated(true);

      await syncPushToken(userData);
      console.log('✅ Auth locale mise à jour:', userData.name);
    } catch (error) {
      console.error('❌ Erreur setAuthData:', error);
    }
  };

  const logout = async () => {
    try {
      await clearAllData();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
    }
  };

  const updateUserProfile = async (updatedData) => {
    try {
      const newUser = { ...user, ...updatedData };
      setUser(newUser);
      await saveUserData(newUser);
      console.log('✅ User local mis à jour:', newUser?.name || 'Utilisateur');
    } catch (error) {
      console.error('❌ Erreur updateUserProfile:', error);
    }
  };

  const refreshUserProfile = async () => {
    try {
      const response = await getProfile();
      if (response.success) {
        await saveUserData(response.data);
        setUser(response.data);
        console.log('✅ Profil mis à jour');
      }
    } catch (error) {
      console.error('❌ Erreur refresh profil:', error);
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUserProfile,
    updateUserProfile,
    setAuthData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personnalisé pour utiliser l'auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
