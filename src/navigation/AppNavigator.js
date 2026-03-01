import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
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
import CategoryProductsScreen from '../screens/CategoryProductsScreen';
import AllProductsScreen from '../screens/AllProductsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

// Navigation principale avec onglets
function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[500],
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
          height: 60 + Math.max(insets.bottom, 8),
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          position: 'absolute',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
          marginBottom: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          height: 60,
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          marginTop: 4,
          marginBottom: 0,
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
        component={PlaceholderScreen}
        options={{
          tabBarLabel: 'Favoris',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="favorites" focused={focused} color={color} badge={0} />
          ),
        }}
      />
      <Tab.Screen
        name="Publish"
        component={PlaceholderScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="publish" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={PlaceholderScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="messages" focused={focused} color={color} badge={0} />
          ),
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
 * Affiche toujours la navigation à onglets, la connexion est accessible via le profil
 */
export default function AppNavigator() {
  const { loading } = useAuth();

  // Afficher un loader pendant la vérification de l'auth
  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Navigation principale avec tabs - toujours visible */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
          
          {/* Écrans de navigation pour les produits */}
          <Stack.Screen 
            name="CategoryProducts" 
            component={CategoryProductsScreen}
            options={{ 
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AllProducts" 
            component={AllProductsScreen}
            options={{ 
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ProductDetail" 
            component={ProductDetailScreen}
            options={{ 
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="SellerProfile" 
            component={SellerProfileScreen}
            options={{ 
              headerShown: false,
            }}
          />
          
          {/* Écrans modaux pour l'authentification */}
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
          <Stack.Screen 
            name="RegisterStep2" 
            component={RegisterStep2Screen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
          <Stack.Screen 
            name="VerifyOTP" 
            component={VerifyOTPScreen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
          <Stack.Screen 
            name="ForgotPassword" 
            component={ForgotPasswordScreen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
          <Stack.Screen 
            name="ResetPassword" 
            component={ResetPasswordScreen}
            options={{ 
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
              animationEnabled: true,
            }}
          />
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
    backgroundColor: COLORS.white,
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
