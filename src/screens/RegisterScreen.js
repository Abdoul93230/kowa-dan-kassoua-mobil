// ─── RegisterScreen — Étape 1: Numéro de téléphone ──────────────────────────
// Saisie du numéro de téléphone et envoi de l'OTP

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sendOTP } from '../api/auth';

// Palette Saharienne
const P = {
  terra: '#C1440E',
  amber: '#E8832A',
  gold: '#F4A261',
  brown: '#8B4513',
  charcoal: '#2C2C2C',
  sand: '#E9D8B8',
  cream: '#F5EFE6',
  dim: '#9B9B9B',
  muted: '#6B6B6B',
  white: '#FFFFFF',
};

// Liste des pays disponibles
const COUNTRIES = [
  { name: 'Niger', code: 'NE', dialCode: '+227', flag: '🇳🇪' },
  { name: 'Sénégal', code: 'SN', dialCode: '+221', flag: '🇸🇳' },
  { name: 'Mali', code: 'ML', dialCode: '+223', flag: '🇲🇱' },
  { name: 'Burkina Faso', code: 'BF', dialCode: '+226', flag: '🇧🇫' },
  { name: 'Côte d\'Ivoire', code: 'CI', dialCode: '+225', flag: '🇨🇮' },
  { name: 'Bénin', code: 'BJ', dialCode: '+229', flag: '🇧🇯' },
  { name: 'Togo', code: 'TG', dialCode: '+228', flag: '🇹🇬' },
];

export default function RegisterScreen({ navigation }) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    whatsapp: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  /**
   * Mettre à jour les champs
   */
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ modifié
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    
    // Auto-remplir whatsapp avec le numéro de téléphone
    if (field === 'phoneNumber' && !formData.whatsapp) {
      setFormData(prev => ({ ...prev, whatsapp: value }));
    }
  };

  /**
   * Valider le formulaire étape 1
   */
  const validate = () => {
    const newErrors = {};
    
    // Nom (min 2 caractères)
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }
    
    // Téléphone (min 7 chiffres)
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Le numéro de téléphone est requis';
    } else if (formData.phoneNumber.trim().length < 7) {
      newErrors.phoneNumber = 'Numéro de téléphone invalide';
    }
    
    // Email (optionnel mais doit être valide si fourni)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    // Mot de passe (min 6 caractères)
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }
    
    // Confirmation mot de passe
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Envoyer le code OTP
   */
  const handleSendOTP = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Formater le numéro au format requis: "+227 12345678"
      const formattedPhone = `${selectedCountry.dialCode} ${formData.phoneNumber.trim()}`;
      const formattedWhatsapp = formData.whatsapp.trim() 
        ? `${selectedCountry.dialCode} ${formData.whatsapp.trim()}`
        : formattedPhone;

      // Envoyer l'OTP
      const result = await sendOTP(formattedPhone);

      if (result.success) {
        // Naviguer vers l'écran de vérification OTP avec les données du formulaire
        navigation.navigate('VerifyOTP', {
          phone: formattedPhone,
          type: 'register',
          attemptsRemaining: result.data.attemptsRemaining || 3,
          devCode: result.data.devOTPCode, // Code OTP en mode dev
          // Passer les données du formulaire étape 1
          formData: {
            name: formData.name.trim(),
            phone: formattedPhone,
            whatsapp: formattedWhatsapp,
            email: formData.email.trim() || undefined,
            password: formData.password,
          },
        });
      }
    } catch (err) {
      console.error('❌ Erreur envoi OTP:', err);
      setErrors({ general: err.message || 'Erreur lors de l\'envoi du code' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[P.cream, P.sand, P.gold]} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={P.charcoal} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Ionicons name="person-add-outline" size={60} color={P.terra} />
              </View>

              <Text style={styles.title}>Créer un compte</Text>
              <Text style={styles.subtitle}>
                Remplissez vos informations pour commencer
              </Text>

              {/* Error général */}
              {errors.general ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color={P.terra} />
                  <Text style={styles.errorBoxText}>{errors.general}</Text>
                </View>
              ) : null}

              {/* Nom complet */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nom complet *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Amadou Diallo"
                    placeholderTextColor={P.dim}
                    value={formData.name}
                    onChangeText={(text) => handleChange('name', text)}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>

              {/* Sélecteur de pays */}
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowCountryPicker(true)}
                disabled={loading}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryDialCode}>{selectedCountry.dialCode}</Text>
                <Text style={styles.countryName}>{selectedCountry.name}</Text>
                <Ionicons name="chevron-down" size={20} color={P.muted} />
              </TouchableOpacity>

              {/* Téléphone */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Numéro de téléphone *</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="12 34 56 78"
                    placeholderTextColor={P.dim}
                    value={formData.phoneNumber}
                    onChangeText={(text) => handleChange('phoneNumber', text)}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                </View>
                {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}
              </View>

              {/* WhatsApp */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>WhatsApp (optionnel)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Même numéro que ci-dessus"
                    placeholderTextColor={P.dim}
                    value={formData.whatsapp}
                    onChangeText={(text) => handleChange('whatsapp', text)}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email (optionnel)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="exemple@email.com"
                    placeholderTextColor={P.dim}
                    value={formData.email}
                    onChangeText={(text) => handleChange('email', text)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Mot de passe */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="Minimum 6 caractères"
                    placeholderTextColor={P.dim}
                    value={formData.password}
                    onChangeText={(text) => handleChange('password', text)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={P.muted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              {/* Confirmer mot de passe */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmer le mot de passe *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor={P.dim}
                    value={formData.confirmPassword}
                    onChangeText={(text) => handleChange('confirmPassword', text)}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={P.muted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Continuer</Text>
                    <Ionicons name="arrow-forward" size={20} color={P.white} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginLabel}>Vous avez déjà un compte ? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Country Picker Modal */}
        <Modal
          visible={showCountryPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sélectionner un pays</Text>
                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                  <Ionicons name="close" size={24} color={P.charcoal} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {COUNTRIES.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    style={styles.countryItem}
                    onPress={() => {
                      setSelectedCountry(country);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.countryItemFlag}>{country.flag}</Text>
                    <Text style={styles.countryItemName}>{country.name}</Text>
                    <Text style={styles.countryItemDialCode}>{country.dialCode}</Text>
                    {selectedCountry.code === country.code && (
                      <Ionicons name="checkmark-circle" size={24} color={P.terra} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: P.cream,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: P.charcoal,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: P.muted,
    marginBottom: 32,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.dim,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  countryDialCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: P.charcoal,
    marginRight: 8,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: P.charcoal,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: P.charcoal,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.dim,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 8,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: P.muted,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: P.charcoal,
  },
  inputPassword: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorBoxText: {
    color: P.terra,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: P.terra,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    backgroundColor: P.terra,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: P.dim,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: P.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLabel: {
    fontSize: 14,
    color: P.muted,
  },
  loginLink: {
    fontSize: 14,
    color: P.terra,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: P.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: P.dim,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: P.charcoal,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: P.cream,
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryItemName: {
    flex: 1,
    fontSize: 16,
    color: P.charcoal,
  },
  countryItemDialCode: {
    fontSize: 14,
    color: P.muted,
    marginRight: 8,
  },
});

