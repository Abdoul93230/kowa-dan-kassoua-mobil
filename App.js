import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

/**
 * Point d'entrée de l'application MarketHub Mobile
 * 
 * Structure:
 * - AuthProvider : Gère l'authentification globale
 * - AppNavigator : Gère la navigation (Login/Register OU écrans principaux)
 */
export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AuthProvider>
  );
}
