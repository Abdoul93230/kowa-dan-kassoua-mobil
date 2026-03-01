// ─── LoginScreen — MarketHub Niger ───────────────────────────────────────────
// Connexion avec téléphone ou email + Remember Me

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

// Palette couleurs Saharan
const P = {
  terra: '#C1440E',
  amber: '#E8832A',
  gold: '#F0A500',
  brown: '#3D1C02',
  charcoal: '#1A1210',
  sand: '#F5E6C8',
  cream: '#FDF6EC',
  dim: '#E5D6B8',
  muted: '#8A7A5F',
  white: '#FFFFFF',
};

// Pays disponibles
const COUNTRIES = [
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪' },
  { code: 'SN', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', dialCode: '+225', flag: '🇨🇮' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱' },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯' },
];

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [loginType, setLoginType] = useState('phone'); // 'phone' | 'email'
  const [countryCode, setCountryCode] = useState('+227');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    loadRememberedCredentials();
  }, []);

  const loadRememberedCredentials = async () => {
    try {
      const remembered = await AsyncStorage.getItem('rememberMe');
      const savedPhone = await AsyncStorage.getItem('savedPhone');
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      
      if (remembered === 'true') {
        setRememberMe(true);
        if (savedPhone) setPhoneNumber(savedPhone);
        if (savedEmail) setEmail(savedEmail);
      }
    } catch (error) {
      console.error('Erreur chargement credentials:', error);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (loginType === 'phone') {
      if (!phoneNumber.trim()) {
        newErrors.phone = 'Le numéro de téléphone est requis';
      } else if (phoneNumber.length < 7) {
        newErrors.phone = 'Numéro de téléphone invalide';
      }
    } else {
      if (!email.trim()) {
        newErrors.email = 'L\'email est requis';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Email invalide';
      }
    }

    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const phoneOrEmail = loginType === 'phone' 
        ? `${countryCode} ${phoneNumber}` 
        : email;

      const result = await login(phoneOrEmail, password);

      if (!result.success) {
        setErrors({ submit: result.message || 'Identifiants incorrects.' });
        return;
      }

      // Sauvegarder les préférences Remember Me
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        if (loginType === 'phone') {
          await AsyncStorage.setItem('savedPhone', phoneNumber);
        } else {
          await AsyncStorage.setItem('savedEmail', email);
        }
      } else {
        await AsyncStorage.removeItem('rememberMe');
        await AsyncStorage.removeItem('savedPhone');
        await AsyncStorage.removeItem('savedEmail');
      }

      // Retour à l'écran précédent (navigation gérée automatiquement)
      navigation.goBack();
    } catch (error) {
      console.error('Erreur login:', error);
      setErrors({ 
        submit: error.message || 'Identifiants incorrects. Veuillez réessayer.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={s.screen} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={P.cream} />
      <ScrollView 
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={s.header}>
            <LinearGradient colors={[P.terra, P.amber]} style={s.logoCircle}>
              <Text style={s.logoIcon}>🛍️</Text>
            </LinearGradient>
            <Text style={s.title}>Bienvenue de retour</Text>
            <Text style={s.subtitle}>Connectez-vous pour continuer</Text>
          </View>

          {/* Toggle Login Type */}
          <View style={s.toggleRow}>
            <TouchableOpacity 
              style={[s.toggleBtn, loginType === 'phone' && s.toggleBtnActive]}
              onPress={() => setLoginType('phone')}
              activeOpacity={0.7}
            >
              <Text style={[s.toggleText, loginType === 'phone' && s.toggleTextActive]}>
                📱 Téléphone
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.toggleBtn, loginType === 'email' && s.toggleBtnActive]}
              onPress={() => setLoginType('email')}
              activeOpacity={0.7}
            >
              <Text style={[s.toggleText, loginType === 'email' && s.toggleTextActive]}>
                📧 Email
              </Text>
            </TouchableOpacity>
          </View>

          {/* Phone Input */}
          {loginType === 'phone' && (
            <View style={s.field}>
              <Text style={s.label}>Numéro de téléphone</Text>
              <View style={s.phoneRow}>
                <TouchableOpacity style={s.countrySelect} activeOpacity={0.7}>
                  <Text style={s.countryText}>{COUNTRIES.find(c => c.dialCode === countryCode)?.flag || '🇳🇪'}</Text>
                  <Text style={s.dialCode}>{countryCode}</Text>
                </TouchableOpacity>
                <TextInput
                  style={[s.input, s.phoneInput]}
                  placeholder="12345678"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholderTextColor={P.muted}
                />
              </View>
              {errors.phone && <Text style={s.errorText}>{errors.phone}</Text>}
            </View>
          )}

          {/* Email Input */}
          {loginType === 'email' && (
            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="exemple@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholderTextColor={P.muted}
              />
              {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
            </View>
          )}

          {/* Password Input */}
          <View style={s.field}>
            <Text style={s.label}>Mot de passe</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput]}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor={P.muted}
              />
              <TouchableOpacity 
                style={s.eyeBtn} 
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={s.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={s.optionsRow}>
            <TouchableOpacity 
              style={s.rememberRow} 
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, rememberMe && s.checkboxChecked]}>
                {rememberMe && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.rememberText}>Se souvenir de moi</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={s.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errors.submit && (
            <View style={s.errorBox}>
              <Text style={s.errorBoxText}>❌ {errors.submit}</Text>
            </View>
          )}

          {/* Login Button */}
          <TouchableOpacity 
            style={[s.loginBtn, loading && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[P.terra, P.amber]} style={s.loginGradient}>
              {loading ? (
                <ActivityIndicator color={P.white} />
              ) : (
                <Text style={s.loginBtnText}>Se connecter →</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OU</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Register Link */}
          <View style={s.registerRow}>
            <Text style={s.registerPrompt}>Pas encore de compte ?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={s.registerLink}>Créer un compte</Text>
            </TouchableOpacity>
          </View>

          {/* Back to Home */}
          <TouchableOpacity 
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={s.backText}>← Retour à l'accueil</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.cream },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  container: { flex: 1, maxWidth: 480, width: '100%', alignSelf: 'center' },
  
  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoIcon: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: '900', color: P.charcoal, marginBottom: 8 },
  subtitle: { fontSize: 15, color: P.muted, textAlign: 'center' },
  
  // Toggle
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 24, backgroundColor: P.sand, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: P.white, shadowColor: P.brown, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '600', color: P.muted },
  toggleTextActive: { color: P.terra, fontWeight: '700' },
  
  // Fields
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: P.charcoal, marginBottom: 8 },
  input: { 
    backgroundColor: P.white, 
    borderWidth: 1.5, 
    borderColor: P.dim, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 15, 
    color: P.charcoal,
    fontWeight: '500'
  },
  
  // Phone
  phoneRow: { flexDirection: 'row', gap: 10 },
  countrySelect: { 
    backgroundColor: P.white, 
    borderWidth: 1.5, 
    borderColor: P.dim, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  countryText: { fontSize: 20 },
  dialCode: { fontSize: 15, fontWeight: '700', color: P.charcoal },
  phoneInput: { flex: 1 },
  
  // Password
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeBtn: { position: 'absolute', right: 14, top: 14, padding: 4 },
  eyeIcon: { fontSize: 20 },
  
  // Options
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { 
    width: 22, 
    height: 22, 
    borderWidth: 2, 
    borderColor: P.dim, 
    borderRadius: 6, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  checkboxChecked: { backgroundColor: P.terra, borderColor: P.terra },
  checkmark: { color: P.white, fontSize: 14, fontWeight: '900' },
  rememberText: { fontSize: 13, fontWeight: '600', color: P.charcoal },
  forgotText: { fontSize: 13, fontWeight: '600', color: P.terra },
  
  // Error
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 6, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBoxText: { fontSize: 13, color: '#DC2626', fontWeight: '600', textAlign: 'center' },
  
  // Button
  loginBtn: { marginBottom: 20, borderRadius: 12, overflow: 'hidden' },
  loginBtnDisabled: { opacity: 0.6 },
  loginGradient: { paddingVertical: 16, alignItems: 'center' },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.5 },
  
  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: P.dim },
  dividerText: { marginHorizontal: 16, fontSize: 12, fontWeight: '600', color: P.muted },
  
  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 20 },
  registerPrompt: { fontSize: 14, color: P.muted, fontWeight: '500' },
  registerLink: { fontSize: 14, fontWeight: '700', color: P.terra },
  
  // Back
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 14, fontWeight: '600', color: P.muted },
});
