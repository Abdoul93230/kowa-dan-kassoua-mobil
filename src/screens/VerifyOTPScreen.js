import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sendOTP, verifyOTP, forgotPassword } from '../api/auth';

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

/**
 * Écran de vérification OTP
 * Réutilisable pour inscription et réinitialisation de mot de passe
 * 
 * @param {object} route.params
 * @param {string} route.params.phone - Numéro de téléphone au format "+227 12345678"
 * @param {string} route.params.identifier - Email ou téléphone (pour forgot password)
 * @param {string} route.params.type - "register" ou "resetPassword"
 * @param {number} route.params.attemptsRemaining - Tentatives restantes
 * @param {string} route.params.devCode - Code OTP en mode développement
 * @param {object} route.params.formData - Données du formulaire Step 1 (pour register)
 */
export default function VerifyOTPScreen({ navigation, route }) {
  const { phone, identifier, type = 'register', attemptsRemaining: initialAttempts = 3, devCode, formData } = route.params || {};
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(initialAttempts);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOTPCode, setDevOTPCode] = useState(devCode);

  // Références pour les inputs
  const inputRefs = useRef([]);

  const isRegister = type === 'register';
  const displayIdentifier = phone || identifier;

  // Timer pour le cooldown de renvoi
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus automatique sur le premier input au montage
  useEffect(() => {
    if (inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0].focus(), 100);
    }
  }, []);

  /**
   * Gérer le changement de valeur d'un input
   */
  const handleChangeText = (text, index) => {
    // Accepter seulement les chiffres
    if (text && !/^\d+$/.test(text)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setError('');

    // Auto-focus sur le prochain input
    if (text && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    // Vérifier automatiquement si le code est complet
    if (text && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerifyOTP(fullCode);
      }
    }
  };

  /**
   * Gérer la touche backspace
   */
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  /**
   * Vérifier le code OTP
   */
  const handleVerifyOTP = async (fullCode = code.join('')) => {
    if (fullCode.length !== 6) {
      setError('Veuillez entrer le code à 6 chiffres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        // Vérification pour inscription
        const result = await verifyOTP(displayIdentifier, fullCode);
        
        if (result.success && result.data.verified) {
          // OTP vérifié, naviguer vers la suite de l'inscription (Step 2)
          navigation.replace('RegisterStep2', {
            phone: displayIdentifier,
            verified: true,
            formData: formData, // Passer les données de l'étape 1
          });
        }
      } else {
        // Vérification pour réinitialisation mot de passe
        const { verifyResetCode } = await import('../api/auth');
        const result = await verifyResetCode(displayIdentifier, fullCode);
        
        if (result.success) {
          // Code vérifié, naviguer vers l'écran de nouveau mot de passe
          navigation.replace('ResetPassword', {
            identifier: displayIdentifier,
            code: fullCode,
          });
        }
      }
    } catch (err) {
      console.error('❌ Erreur vérification OTP:', err);
      setError(err.message || 'Code invalide ou expiré');
      
      // Réinitialiser le code
      setCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renvoyer le code OTP
   */
  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      return;
    }

    if (attemptsRemaining <= 0) {
      Alert.alert(
        'Limite atteinte',
        'Vous avez atteint le nombre maximum de tentatives. Veuillez réessayer dans 15 minutes.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        // Renvoyer OTP pour inscription
        const result = await sendOTP(displayIdentifier);
        
        if (result.success) {
          Alert.alert('Code renvoyé', 'Un nouveau code a été envoyé à votre téléphone');
          setAttemptsRemaining(result.data.attemptsRemaining || attemptsRemaining - 1);
          setResendCooldown(60); // 60 secondes de cooldown
          
          // Afficher le code en mode dev
          if (result.data.devOTPCode) {
            setDevOTPCode(result.data.devOTPCode);
          }
        }
      } else {
        // Renvoyer OTP pour réinitialisation
        const result = await forgotPassword(displayIdentifier);
        
        if (result.success) {
          Alert.alert('Code renvoyé', 'Un nouveau code a été envoyé');
          setResendCooldown(60);
          
          // Afficher le code en mode dev
          if (result.devCode) {
            setDevOTPCode(result.devCode);
          }
        }
      }
    } catch (err) {
      console.error('❌ Erreur renvoi OTP:', err);
      setError(err.message || 'Erreur lors du renvoi du code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[P.cream, P.sand, P.gold]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color={P.charcoal} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Ionicons name="mail-outline" size={60} color={P.terra} />
              </View>

              {/* Title */}
              <Text style={styles.title}>Vérification</Text>
              <Text style={styles.subtitle}>
                Entrez le code à 6 chiffres envoyé au {'\n'}
                <Text style={styles.phone}>{displayIdentifier}</Text>
              </Text>

              {/* Dev Code (visible seulement en développement) */}
              {devOTPCode && (
                <View style={styles.devCodeContainer}>
                  <Text style={styles.devCodeLabel}>🔧 Mode Dev - Code OTP:</Text>
                  <Text style={styles.devCodeText}>{devOTPCode}</Text>
                </View>
              )}

              {/* Code Inputs */}
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.codeInput,
                      digit && styles.codeInputFilled,
                      error && styles.codeInputError,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleChangeText(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              {/* Error */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={P.terra} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Attempts Remaining */}
              {attemptsRemaining < 3 && (
                <Text style={styles.attemptsText}>
                  {attemptsRemaining} {attemptsRemaining > 1 ? 'tentatives restantes' : 'tentative restante'}
                </Text>
              )}

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={() => handleVerifyOTP()}
                disabled={loading || code.join('').length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <Text style={styles.buttonText}>Vérifier</Text>
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendLabel}>Vous n'avez pas reçu le code ? </Text>
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={loading || resendCooldown > 0}
                >
                  <Text
                    style={[
                      styles.resendButton,
                      (loading || resendCooldown > 0) && styles.resendButtonDisabled,
                    ]}
                  >
                    {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: P.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  phone: {
    fontWeight: 'bold',
    color: P.terra,
  },
  devCodeContainer: {
    backgroundColor: '#FFF9E6',
    borderWidth: 2,
    borderColor: '#FFEB3B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  devCodeLabel: {
    fontSize: 12,
    color: P.muted,
    marginBottom: 4,
  },
  devCodeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: P.terra,
    letterSpacing: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: P.dim,
    borderRadius: 12,
    backgroundColor: P.white,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: P.charcoal,
  },
  codeInputFilled: {
    borderColor: P.terra,
    backgroundColor: P.cream,
  },
  codeInputError: {
    borderColor: P.terra,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  errorText: {
    color: P.terra,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  attemptsText: {
    fontSize: 14,
    color: P.amber,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
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
  buttonText: {
    color: P.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: {
    fontSize: 14,
    color: P.muted,
  },
  resendButton: {
    fontSize: 14,
    color: P.terra,
    fontWeight: 'bold',
  },
  resendButtonDisabled: {
    color: P.dim,
  },
});
