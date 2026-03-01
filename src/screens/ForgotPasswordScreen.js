import React, { useState } from 'react';
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
import { forgotPassword } from '../api/auth';

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
 * Écran de demande de réinitialisation de mot de passe (Étape 1)
 * Saisie de l'identifiant (email ou téléphone)
 */
export default function ForgotPasswordScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Valider l'identifiant
   */
  const validateIdentifier = () => {
    const trimmed = identifier.trim();
    
    if (!trimmed) {
      setError('Veuillez entrer votre email ou numéro de téléphone');
      return false;
    }

    // Vérifier format email OU téléphone
    const isEmail = trimmed.includes('@');
    const isPhone = /^\+?\d+\s?\d+/.test(trimmed);

    if (!isEmail && !isPhone) {
      setError('Format invalide. Entrez un email ou un numéro de téléphone');
      return false;
    }

    return true;
  };

  /**
   * Envoyer la demande de réinitialisation
   */
  const handleSendResetCode = async () => {
    if (!validateIdentifier()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await forgotPassword(identifier.trim());

      if (result.success) {
        // Naviguer vers l'écran de vérification OTP
        navigation.navigate('VerifyOTP', {
          identifier: identifier.trim(),
          type: 'resetPassword',
          devCode: result.devCode, // Code OTP en mode dev
        });
      }
    } catch (err) {
      console.error('❌ Erreur demande réinitialisation:', err);
      setError(err.message || 'Erreur lors de la demande de réinitialisation');
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
                <Ionicons name="lock-closed-outline" size={60} color={P.terra} />
              </View>

              {/* Title */}
              <Text style={styles.title}>Mot de passe oublié ?</Text>
              <Text style={styles.subtitle}>
                Entrez votre email ou numéro de téléphone pour recevoir un code de réinitialisation
              </Text>

              {/* Identifier Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email ou Téléphone *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="exemple@email.com ou +227 12345678"
                    placeholderTextColor={P.dim}
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text);
                      setError('');
                    }}
                    keyboardType="default"
                    autoCapitalize="none"
                    editable={!loading}
                    autoFocus
                  />
                </View>
                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={P.terra} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendResetCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Envoyer le code</Text>
                    <Ionicons name="arrow-forward" size={20} color={P.white} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginLabel}>Vous vous souvenez ? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Se connecter</Text>
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
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: P.muted,
    marginBottom: 32,
    lineHeight: 24,
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
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: P.charcoal,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: P.terra,
    fontSize: 14,
    marginLeft: 8,
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
});
