import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
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
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ProductsListScreen from '../screens/ProductsListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PublishScreen from '../screens/PublishScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
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
const BASE_TAB_BAR_STYLE = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: '#111827',
  borderTopWidth: 0,
  borderTopColor: 'transparent',
  elevation: 0,
  shadowOpacity: 0,
};

// ─── Fond sombre de la tab bar ────────────────────────────────────────────────
function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#111827', '#0d1420']}
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
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#111827' },
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
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 64 + Math.max(insets.bottom, 8);
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        // ── Couleurs ──────────────────────────────────────────────────────────
        tabBarActiveTintColor:   P.amber,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.38)',

        // ── Style de la barre ─────────────────────────────────────────────────
        // backgroundColor EN DUR ici — c'est lui qui écrase le blanc par défaut
        tabBarStyle: {
          ...BASE_TAB_BAR_STYLE,
          height: TAB_HEIGHT,
        },

        // ── Fond personnalisé (gradient + ligne orange) ───────────────────────
        tabBarBackground: () => <TabBarBackground />,

        // ── Labels ────────────────────────────────────────────────────────────
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: -2,
          marginBottom: Platform.OS === 'ios' ? 0 : 6,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ProductsListScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          tabBarLabel: 'Favoris',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="favorites" focused={focused} color={color} badge={0} />
          ),
        }}
      />
      <Tab.Screen
        name="Publish"
        component={PublishScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name="publish" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) || 'MessagesList';
          const hideTabBar = routeName === 'Conversation';

          return {
            tabBarLabel: 'Messages',
            tabBarStyle: hideTabBar
              ? { display: 'none' }
              : {
                  ...BASE_TAB_BAR_STYLE,
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
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
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

  if (loading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AllProducts" component={AllProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MyListings" component={MyListingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
          <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', headerShown: false }} />
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
    backgroundColor: '#111827',
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