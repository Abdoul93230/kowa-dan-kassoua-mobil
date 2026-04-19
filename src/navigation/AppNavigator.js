import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';

// Global navigation reference for push notifications and deep linking
export const navigationRef = React.createRef();
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../utils/constants';
import { MOBILE_COLORS as P } from '../theme/colors';
import { TabBarIcon } from '../components/TabBarIcon';

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
const BASE_TAB_BAR_STYLE = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  borderTopColor: 'transparent',
  elevation: 0,
  shadowOpacity: 0,
};

// ─── Fond sombre de la tab bar ────────────────────────────────────────────────
function TabBarBackground() {
  const { isDark, theme } = useAppTheme();

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={isDark ? theme.shell : theme.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ligne accent orange en haut */}
      <LinearGradient
        colors={['transparent', P.terra, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1.5,
        }}
      />
    </View>
  );
}

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
  const { isAuthenticated, token, user } = useAuth();
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 54 + Math.max(insets.bottom, 6);
  const [unreadCount, setUnreadCount] = useState(0);

  const { isConnected, on, off } = useSocket({
    enabled: isAuthenticated,
    token,
  });

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadCount();
      setUnreadCount(Number(response?.data?.unreadCount || 0));
    } catch (error) {
      console.error('Erreur chargement compteur non lus:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!isConnected) return;

    const handleUnreadChanged = () => {
      loadUnreadCount();
    };

    const handleNewMessage = (message) => {
      const currentUserId = String(user?.id || '');
      const senderIdStr = String(message?.senderId || '');
      if (senderIdStr && senderIdStr !== currentUserId) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    const handleMessageRead = () => {
      loadUnreadCount();
    };

    const handleConversationUpdated = () => {
      loadUnreadCount();
    };

    on('unreadCount:changed', handleUnreadChanged);
    on('message:new', handleNewMessage);
    on('message:read', handleMessageRead);
    on('conversation:updated', handleConversationUpdated);

    return () => {
      off('unreadCount:changed', handleUnreadChanged);
      off('message:new', handleNewMessage);
      off('message:read', handleMessageRead);
      off('conversation:updated', handleConversationUpdated);
    };
  }, [isConnected, loadUnreadCount, off, on, user?.id]);

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
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        // ── Couleurs ──────────────────────────────────────────────────────────
        tabBarActiveTintColor:   P.amber,
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(17,24,39,0.42)',

        // ── Style de la barre ─────────────────────────────────────────────────
        // backgroundColor EN DUR ici — c'est lui qui écrase le blanc par défaut
        tabBarStyle: {
          ...BASE_TAB_BAR_STYLE,
          backgroundColor: isDark ? '#111827' : '#ffffff',
          height: TAB_HEIGHT,
        },

        // ── Fond personnalisé (gradient + ligne orange) ───────────────────────
        tabBarBackground: () => <TabBarBackground />,

        tabBarItemStyle: {
          paddingTop: 2,
          height: 50,
        },
        tabBarLabelStyle: {
          display: 'none',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ProductsListScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!isAuthenticated) {
              e.preventDefault();
              navigation.navigate('QuickAuth', {
                pendingAction: { type: 'favorites' },
                returnScreen: 'Favorites',
              });
            }
          },
        })}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="favorites" focused={focused} color={color} badge={0} />
          ),
        }}
      />
      <Tab.Screen
        name="Publish"
        component={PublishScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name="publish" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!isAuthenticated) {
              e.preventDefault();
              navigation.navigate('QuickAuth', {
                pendingAction: { type: 'messages_list' },
                returnScreen: 'Messages',
              });
            }
          },
        })}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) || 'MessagesList';
          const hideTabBar = routeName === 'Conversation';

          return {
            tabBarStyle: hideTabBar
              ? { display: 'none' }
              : {
                  ...BASE_TAB_BAR_STYLE,
                  backgroundColor: isDark ? '#111827' : '#ffffff',
                  height: TAB_HEIGHT,
                },
            tabBarIcon: ({ focused, color }) => (
              <TabBarIcon
                name="messages"
                focused={focused}
                color={color}
                badge={unreadCount > 0 ? unreadCount : 0}
              />
            ),
          };
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="profile" focused={focused} color={color} />
          ),
        }}
      />
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.screen} />
        <View style={[styles.loadingContainer, { backgroundColor: theme.screen }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.screen} />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AllProducts" component={AllProductsScreen} options={{ headerShown: false }} />
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