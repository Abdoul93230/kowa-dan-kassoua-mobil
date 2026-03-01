import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

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

// Villes du Niger (même liste que web)
const NIGER_CITIES = [
  'Niamey',
  'Zinder',
  'Maradi',
  'Agadez',
  'Tahoua',
  'Dosso',
  'Tillabéri',
  'Diffa',
  'Arlit',
  'Birni N\'Konni',
  'Gaya',
  'Tessaoua',
  'Autre...',
];

/**
 * Étape 2 : Compléter le profil (après vérification OTP)
 * Type de compte, informations professionnelles, localisation
 * 
 * @param {object} route.params
 * @param {string} route.params.phone - Numéro de téléphone vérifié
 * @param {boolean} route.params.verified - OTP vérifié
 * @param {object} route.params.formData - Données Step 1 (name, phone, whatsapp, email, password)
 */
export default function RegisterStep2Screen({ navigation, route }) {
  const { phone, verified, formData: step1Data } = route.params || {};
  const { register } = useAuth();

  const [step2Data, setStep2Data] = useState({
    businessType: 'individual',
    businessName: '',
    description: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);

  // Vérifier que le téléphone est vérifié et que les données step1 sont présentes
  if (!verified || !phone || !step1Data) {
    Alert.alert(
      'Erreur',
      'Données manquantes. Veuillez recommencer le processus d\'inscription.',
      [{ text: 'OK', onPress: () => navigation.replace('Register') }]
    );
    return null;
  }

  /**
   * Mettre à jour les champs
   */
  const handleChange = (field, value) => {
    setStep2Data(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ modifié
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  /**
   * Valider le formulaire Step 2
   */
  const validateForm = () => {
    const newErrors = {};

    // businessName requis si professional
    if (step2Data.businessType === 'professional') {
      if (!step2Data.businessName.trim()) {
        newErrors.businessName = 'Le nom de votre activité est requis pour un compte professionnel';
      }

      // description requise pour professional (min 20 caractères)
      if (!step2Data.description.trim()) {
        newErrors.description = 'La description est requise';
      } else if (step2Data.description.trim().length < 20) {
        newErrors.description = 'Décrivez votre activité en au moins 20 caractères';
      }
    }

    // location requis
    if (!step2Data.location.trim()) {
      newErrors.location = 'La localisation est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Sélectionner une ville du picker
   */
  const handleSelectCity = (city) => {
    if (city === 'Autre...') {
      // Activer le mode saisie personnalisée
      setIsCustomLocation(true);
      setShowLocationModal(false);
      setStep2Data(prev => ({ ...prev, location: '' }));
    } else {
      // Ville prédéfinie : format "{ville}, Niger"
      setStep2Data(prev => ({ ...prev, location: `${city}, Niger` }));
      setIsCustomLocation(false);
      setCustomLocation('');
      setShowLocationModal(false);
      // Effacer erreur
      if (errors.location) {
        setErrors(prev => ({ ...prev, location: null }));
      }
    }
  };

  /**
   * Soumettre l'inscription complète
   */
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Combiner toutes les données Step 1 + Step 2
      const userData = {
        // Step 1
        name: step1Data.name,
        phone: step1Data.phone,
        whatsapp: step1Data.whatsapp || step1Data.phone,
        email: step1Data.email || undefined,
        password: step1Data.password,
        // Step 2
        businessType: step2Data.businessType,
        businessName: step2Data.businessType === 'professional' ? step2Data.businessName.trim() : step1Data.name,
        description: step2Data.businessType === 'professional' ? step2Data.description.trim() : '',
        location: step2Data.location.trim(),
      };

      // Appeler l'API d'inscription via AuthContext
      await register(userData);

      // Succès
      Alert.alert(
        'Inscription réussie',
        'Votre compte a été créé avec succès',
        [
          {
            text: 'OK',
            onPress: () => {
              // Retourner à l'écran principal (ProfileScreen se mettra à jour automatiquement)
              navigation.replace('MainTabs');
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue lors de l\'inscription'
      );
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
              <Text style={styles.title}>Type de compte</Text>
              <Text style={styles.subtitle}>
                Choisissez le type de compte qui vous correspond
              </Text>

              {/* Business Type Selector */}
              <View style={styles.businessTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.businessTypeCard,
                    step2Data.businessType === 'individual' && styles.businessTypeCardActive,
                  ]}
                  onPress={() => handleChange('businessType', 'individual')}
                  disabled={loading}
                >
                  <View style={[
                    styles.businessTypeIcon,
                    step2Data.businessType === 'individual' && styles.businessTypeIconActive,
                  ]}>
                    <Ionicons
                      name="person-outline"
                      size={32}
                      color={step2Data.businessType === 'individual' ? P.white : P.terra}
                    />
                  </View>
                  <Text style={styles.businessTypeTitle}>Particulier</Text>
                  <Text style={styles.businessTypeDescription}>
                    Vendre vos biens personnels
                  </Text>
                  {step2Data.businessType === 'individual' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={P.terra} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.businessTypeCard,
                    step2Data.businessType === 'professional' && styles.businessTypeCardActive,
                  ]}
                  onPress={() => handleChange('businessType', 'professional')}
                  disabled={loading}
                >
                  <View style={[
                    styles.businessTypeIcon,
                    step2Data.businessType === 'professional' && styles.businessTypeIconActive,
                  ]}>
                    <Ionicons
                      name="briefcase-outline"
                      size={32}
                      color={step2Data.businessType === 'professional' ? P.white : P.terra}
                    />
                  </View>
                  <Text style={styles.businessTypeTitle}>Professionnel</Text>
                  <Text style={styles.businessTypeDescription}>
                    Gérer votre activité commerciale
                  </Text>
                  {step2Data.businessType === 'professional' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={P.terra} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Business Name (si professional) */}
              {step2Data.businessType === 'professional' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nom de votre activité *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="storefront-outline" size={20} color={P.muted} style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Boutique Amadou"
                      placeholderTextColor={P.dim}
                      value={step2Data.businessName}
                      onChangeText={(text) => handleChange('businessName', text)}
                      autoCapitalize="words"
                      editable={!loading}
                    />
                  </View>
                  {errors.businessName ? (
                    <Text style={styles.errorText}>{errors.businessName}</Text>
                  ) : null}
                </View>
              )}

              {/* Description (si professional) */}
              {step2Data.businessType === 'professional' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Description de votre activité *</Text>
                  <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Décrivez votre activité (minimum 20 caractères)"
                      placeholderTextColor={P.dim}
                      value={step2Data.description}
                      onChangeText={(text) => handleChange('description', text)}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      editable={!loading}
                    />
                  </View>
                  <Text style={styles.charCount}>
                    {step2Data.description.length} / 20 caractères minimum
                  </Text>
                  {errors.description ? (
                    <Text style={styles.errorText}>{errors.description}</Text>
                  ) : null}
                </View>
              )}

              {/* Localisation */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Localisation *</Text>
                
                {!isCustomLocation ? (
                  // Bouton pour ouvrir le sélecteur de ville
                  <TouchableOpacity
                    style={styles.locationPicker}
                    onPress={() => setShowLocationModal(true)}
                    disabled={loading}
                  >
                    <Ionicons name="location-outline" size={20} color={P.muted} style={styles.icon} />
                    <Text
                      style={[
                        styles.locationText,
                        !step2Data.location && styles.locationPlaceholder,
                      ]}
                    >
                      {step2Data.location || 'Sélectionnez votre ville'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={P.muted} />
                  </TouchableOpacity>
                ) : (
                  // Input personnalisé pour "Autre"
                  <View>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="location-outline" size={20} color={P.muted} style={styles.icon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Entrez votre localisation"
                        placeholderTextColor={P.dim}
                        value={step2Data.location}
                        onChangeText={(text) => handleChange('location', text)}
                        editable={!loading}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.changeLocationButton}
                      onPress={() => {
                        setIsCustomLocation(false);
                        setShowLocationModal(true);
                      }}
                    >
                      <Text style={styles.changeLocationText}>Choisir une ville prédéfinie</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <Text style={styles.buttonText}>Créer mon compte</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* Modal pour sélectionner la ville */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionnez votre ville</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close" size={24} color={P.charcoal} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={NIGER_CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => handleSelectCity(item)}
                >
                  <Ionicons 
                    name={item === 'Autre...' ? 'add-circle-outline' : 'location'} 
                    size={20} 
                    color={item === 'Autre...' ? P.amber : P.terra} 
                  />
                  <Text style={styles.cityText}>
                    {item === 'Autre...' ? item : `${item}, Niger`}
                  </Text>
                  {step2Data.location === `${item}, Niger` && item !== 'Autre...' && (
                    <Ionicons name="checkmark" size={24} color={P.terra} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: P.charcoal,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: P.muted,
    marginBottom: 24,
  },
  businessTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  businessTypeCard: {
    flex: 1,
    backgroundColor: P.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: P.dim,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  businessTypeCardActive: {
    borderColor: P.terra,
    backgroundColor: P.cream,
  },
  businessTypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: P.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessTypeIconActive: {
    backgroundColor: P.terra,
  },
  businessTypeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: P.charcoal,
    marginBottom: 4,
  },
  businessTypeDescription: {
    fontSize: 12,
    color: P.muted,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  inputContainer: {
    marginBottom: 20,
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
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 12,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: P.muted,
    marginTop: 4,
    marginLeft: 4,
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
    marginTop: 24,
    marginBottom: 32,
  },
  buttonDisabled: {
    backgroundColor: P.dim,
  },
  buttonText: {
    color: P.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.dim,
    paddingHorizontal: 12,
    height: 50,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: P.charcoal,
    marginLeft: 8,
  },
  locationPlaceholder: {
    color: P.dim,
  },
  changeLocationButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeLocationText: {
    color: P.terra,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: P.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: P.sand,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: P.charcoal,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: P.cream,
  },
  cityText: {
    flex: 1,
    fontSize: 16,
    color: P.charcoal,
    marginLeft: 12,
  },
});
