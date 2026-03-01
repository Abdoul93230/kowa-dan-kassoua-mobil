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
import { resetPassword } from '../api/auth';

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
 * Écran de réinitialisation du mot de passe (Étape 3)
 * Après vérification du code OTP
 * 
 * @param {object} route.params
 * @param {string} route.params.identifier - Email ou téléphone
 * @param {string} route.params.code - Code OTP vérifié
 */
export default function ResetPasswordScreen({ navigation, route }) {
  const { identifier, code } = route.params || {};

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Vérifier que les params sont présents
  if (!identifier || !code) {
    Alert.alert(
      'Erreur',
      'Informations manquantes. Veuillez recommencer le processus.',
      [{ text: 'OK', onPress: () => navigation.replace('ForgotPassword') }]
    );
    return null;
  }

  /**
   * Valider les mots de passe
   */
  const validatePasswords = () => {
    if (!newPassword) {
      setError('Le mot de passe est requis');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    return true;
  };

  /**
   * Réinitialiser le mot de passe
   */
  const handleResetPassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await resetPassword(identifier, code, newPassword);

      if (result.success) {
        // Succès
        Alert.alert(
          'Mot de passe réinitialisé',
          'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
          [
            {
              text: 'Se connecter',
              onPress: () => navigation.replace('Login'),
            },
          ]
        );
      }
    } catch (err) {
      console.error('❌ Erreur réinitialisation mot de passe:', err);
      setError(err.message || 'Erreur lors de la réinitialisation du mot de passe');
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
                <Ionicons name="shield-checkmark-outline" size={60} color={P.terra} />
              </View>

              {/* Title */}
              <Text style={styles.title}>Nouveau mot de passe</Text>
              <Text style={styles.subtitle}>
                Choisissez un nouveau mot de passe sécurisé
              </Text>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nouveau mot de passe *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="Minimum 6 caractères"
                    placeholderTextColor={P.dim}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setError('');
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={P.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmer le mot de passe *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={P.muted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor={P.dim}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setError('');
                    }}
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
                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={P.terra} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <Text style={styles.buttonText}>Réinitialiser le mot de passe</Text>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginLabel}>Vous vous souvenez ? </Text>
                <TouchableOpacity onPress={() => navigation.replace('Login')}>
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
  },
  inputContainer: {
    marginBottom: 24,
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
  inputPassword: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
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
  buttonText: {
    color: P.white,
    fontSize: 18,
    fontWeight: 'bold',
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
