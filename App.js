import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import PushNotificationsBridge from './src/components/PushNotificationsBridge';

/**
 * Point d'entrée de l'application TakTak Mobile
 *
 * Structure :
 * - GestureHandlerRootView  : gestes natifs (requis par les panneaux du bas)
 * - KeyboardProvider        : suivi natif du clavier, image par image (iOS + Android)
 * - SafeAreaProvider        : zones de sécurité (encoches, barre de navigation)
 * - ThemeProvider / AuthProvider
 * - BottomSheetModalProvider: panneaux du bas natifs (@gorhom/bottom-sheet), placé
 *   sous les contextes pour que leur contenu ait accès au thème et à l'auth
 * - AppNavigator            : navigation
 */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Android : l'app dessine sous les barres système (en-têtes colorés sous la barre
          d'état). Sans ces options, la bibliothèque rendrait la barre d'état opaque. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <BottomSheetModalProvider>
                <PushNotificationsBridge />
                <AppNavigator />
              </BottomSheetModalProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
