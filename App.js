import React from 'react';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
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
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
