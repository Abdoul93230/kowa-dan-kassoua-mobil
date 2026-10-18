import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';

// Global navigation reference for push notifications and deep linking
export const navigationRef = React.createRef();
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
import { MOBILE_COLORS as P } from '../theme/colors';
import AppTabBar from '../components/AppTabBar';
import { KeyboardDoneAccessory } from '../components/Keyboard';

// ─── Barre d'état unique de l'app ─────────────────────────────────────────────
// Icônes foncées en clair / claires en sombre, ET fond de la couleur des en-têtes.
// Sans fond explicite, Android (Expo Go, hors affichage bord à bord) remplit la
// zone avec le fond de fenêtre noir : en mode clair, les icônes foncées
// devenaient invisibles.
function AppStatusBar() {
  const { isDark, theme } = useAppTheme();
  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor={isDark ? theme.screen : theme.surface}
      translucent
    />
  );
}

// Écrans
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RegisterStep2Screen from '../screens/RegisterStep2Screen';
import VerifyOTPScreen from '../screens/VerifyOTPScreen';
import QuickAuthScreen from '../screens/QuickAuthScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ProductsListScreen from '../screens/ProductsListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PublishScreen from '../screens/PublishScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CategoryProductsScreen from '../screens/CategoryProductsScreen';
import AllProductsScreen from '../screens/AllProductsScreen';
import SearchScreen from '../screens/SearchScreen';
import SecurityScreen from '../screens/SecurityScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';
import MessagesListScreen from '../screens/MessagesListScreen';
import ConversationScreen from '../screens/ConversationScreen';
import { getUnreadCount } from '../api/messaging';
import { useSocket } from '../hooks/useSocket';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const MessagesStack = createStackNavigator();
const ProfileStack = createStackNavigator();

function MessagesNavigator() {
  const { theme } = useAppTheme();

  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        cardStyle: { backgroundColor: theme.screen },
      }}
    >
      <MessagesStack.Screen name="MessagesList" component={MessagesListScreen} />
      <MessagesStack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ headerShown: true }}
      />
    </MessagesStack.Navigator>
  );
}

function ProfileNavigator() {
  const { theme } = useAppTheme();

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.screen },
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="MyListingsTab" component={MyListingsScreen} />
    </ProfileStack.Navigator>
  );
}

// Écran temporaire pour les onglets non implémentés
function PlaceholderScreen({ route, navigation }) {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const screenName = route.name;
  
  const getScreenInfo = () => {
    switch (screenName) {
      case 'Favorites':
        return {
          emoji: '❤️',
          title: 'Mes Favoris',
          description: isAuthenticated 
            ? 'Retrouvez ici toutes vos annonces favorites. Fonctionnalité bientôt disponible !'
            : 'Connectez-vous pour sauvegarder vos annonces préférées',
          action: !isAuthenticated ? 'Se connecter' : null,
        };
      case 'Publish':
        return {
          emoji: '📝',
          title: 'Publier une annonce',
          description: isAuthenticated
            ? 'Publiez vos produits et services gratuitement. Fonctionnalité bientôt disponible !'
            : 'Connectez-vous pour publier vos annonces gratuitement',
          action: !isAuthenticated ? 'Se connecter' : null,
        };
      case 'Messages':
        return {
          emoji: '💬',
          title: 'Messages',
          description: isAuthenticated
            ? 'Discutez avec les vendeurs et acheteurs. Fonctionnalité bientôt disponible !'
            : 'Connectez-vous pour contacter les vendeurs',
          action: !isAuthenticated ? 'Se connecter' : null,
        };
      default:
        return {
          emoji: '🚧',
          title: 'En construction',
          description: 'Cette fonctionnalité arrive bientôt !',
          action: null,
        };
    }
  };

  const info = getScreenInfo();
  
  return (
    <View style={[styles.placeholderContainer, { paddingBottom: 80 + Math.max(insets.bottom, 8) }]}>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderEmoji}>{info.emoji}</Text>
        <Text style={styles.placeholderTitle}>{info.title}</Text>
        <Text style={styles.placeholderText}>{info.description}</Text>
        {info.action && (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.actionButtonText}>{info.action}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Navigation principale avec onglets ───────────────────────────────────────
function MainTabs() {
  const { isAuthenticated, token, user, loading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const { isConnected, on, off } = useSocket({
    enabled: isAuthenticated,
    token,
  });

  const lastUnreadFetchRef = useRef(0);
  const loadUnreadCount = useCallback(async ({ ifOlderThanMs = 0 } = {}) => {
    if (authLoading || !isAuthenticated || !token) {
      setUnreadCount(0);
      return;
    }
    if (ifOlderThanMs && Date.now() - lastUnreadFetchRef.current < ifOlderThanMs) return;
    lastUnreadFetchRef.current = Date.now();

    try {
      const response = await getUnreadCount();
      setUnreadCount(Number(response?.data?.unreadCount || 0));
    } catch (error) {
      console.error('Erreur chargement compteur non lus:', error);
    }
  }, [authLoading, isAuthenticated, token]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Le serveur pousse le nouveau total à chaque changement : plus besoin de le redemander
  // (avant : un appel HTTP à chaque message reçu, lu ou conversation mise à jour)
  useEffect(() => {
    if (!isConnected) return;

    // Synchronisation à la (re)connexion : des changements ont pu être manqués hors ligne
    loadUnreadCount({ ifOlderThanMs: 5000 });

    const handleUnreadChanged = (payload) => {
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      } else {
        loadUnreadCount(); // ancien serveur sans total dans l'événement
      }
    };

    on('unreadCount:changed', handleUnreadChanged);
    return () => {
      off('unreadCount:changed', handleUnreadChanged);
    };
  }, [isConnected, loadUnreadCount, off, on]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('unreadCount:refresh', () => {
      loadUnreadCount();
    });

    return () => {
      subscription.remove();
    };
  }, [loadUnreadCount]);

  return (
    <Tab.Navigator
      // Barre personnalisée : icônes, libellés et animations dans components/AppTabBar.js
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // La barre est en position absolue : les écrans gèrent leur marge basse
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tab.Screen name="Home" component={ProductsListScreen} />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
      />
      <Tab.Screen name="Publish" component={PublishScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) || 'MessagesList';
          // Barre masquée dans une conversation (clavier + zone de saisie)
          const hideTabBar = routeName === 'Conversation';

          return {
            tabBarStyle: hideTabBar ? { display: 'none' } : { position: 'absolute' },
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          };
        }}
      />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

/**
 * Navigation principale de l'application
 */
export default function AppNavigator() {
  const { loading } = useAuth();
  const { isDark, theme } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.screen,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        primary: P.terra,
        notification: P.orange500,
      },
    };
  }, [isDark, theme]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <AppStatusBar />
        <View style={[styles.loadingContainer, { backgroundColor: theme.screen }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Barre d'état UNIQUE pour toute l'app (les écrans n'en déclarent plus) */}
      <AppStatusBar />
      {/* iOS : barre « OK » partagée par tous les claviers numériques */}
      <KeyboardDoneAccessory />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AllProducts" component={AllProductsScreen} options={{ headerShown: false }} />
          {/* Sécurité et connexion — hors onglets pour que la barre d'onglets ne couvre pas le bouton */}
          <Stack.Screen name="Security" component={SecurityScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
          {/* Page Recherche plein écran (loupe de l'accueil) — apparition en fondu montant */}
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{
              headerShown: false,
              cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
            }}
          />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="QuickAuth" component={QuickAuthScreen} options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    padding: 24,
  },
  placeholderContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  placeholderEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButtonContainer: {
    marginTop: 32,
    width: '100%',
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});