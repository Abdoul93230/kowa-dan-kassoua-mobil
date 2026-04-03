// ─── ProfileScreen v2 PREMIUM ─ MarketHub Niger ────────────────────────────────
// Design 100% cohérent avec tout l'appli mobile — gradient premium, animations, emoji icons

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, StatusBar, Image, Dimensions, Animated,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import { updateProfile } from '../api/auth';

const NIGER_CITIES = [
  'Gaya','Tessaoua',
];

const COUNTRIES = [
  { code: 'NE', name: 'Niger',         dialCode: '+227', flag: '🇳🇪' },
  { code: 'SN', name: 'Sénégal',       dialCode: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮' },
  { code: 'BF', name: 'Burkina Faso',  dialCode: '+226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali',          dialCode: '+223', flag: '🇲🇱' },
  { code: 'TG', name: 'Togo',          dialCode: '+228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin',         dialCode: '+229', flag: '🇧🇯' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, isAuthenticated, logout, updateUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editCity, setEditCity] = useState(user?.city || '');
  const [editAvatarUri, setEditAvatarUri] = useState(user?.avatar || null);
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editWhatsapp, setEditWhatsapp] = useState(user?.contactInfo?.whatsapp || '');
  const [editDescription, setEditDescription] = useState(user?.description || '');
  const [editBusinessType, setEditBusinessType] = useState(user?.businessType || 'individual');
  const [editBusinessName, setEditBusinessName] = useState(user?.businessName || '');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [whatsappCountry, setWhatsappCountry] = useState(COUNTRIES[0]);
  const [showWhatsappPicker, setShowWhatsappPicker] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (editModalVisible || user) {
      setEditName(user?.name || '');
      setEditCity(user?.city || user?.location || '');
      setEditAvatarUri(user?.avatar || null);
      setEditEmail(user?.email || '');
      
      const fullWhatsapp = user?.contactInfo?.whatsapp || '';
      if (fullWhatsapp) {
        const matchedCountry = COUNTRIES.find(c => fullWhatsapp.startsWith(c.dialCode));
        if (matchedCountry) {
          setWhatsappCountry(matchedCountry);
          setEditWhatsapp(fullWhatsapp.replace(matchedCountry.dialCode, '').trim());
        } else {
          setEditWhatsapp(fullWhatsapp);
        }
      } else {
        setEditWhatsapp('');
        setWhatsappCountry(COUNTRIES[0]);
      }
      
      setEditDescription(user?.description || '');
      setEditBusinessType(user?.businessType || 'individual');
      setEditBusinessName(user?.businessName || '');
    }
  }, [user, editModalVisible]);

  if (!isAuthenticated) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <LinearGradient
          colors={[P.brown, P.charcoal]}
          style={[s.headerNotAuth, { paddingTop: (insets.top || 0) + 6 }]}
        >
          <View style={s.headerAccent} />
          <Text style={s.headerTitle}>Profil</Text>
        </LinearGradient>

        <ScrollView style={s.content}>
          <View style={s.notAuthContainer}>
            <Text style={s.notAuthEmoji}>👤</Text>
            <Text style={s.notAuthTitle}>Connectez-vous à votre compte</Text>
            <Text style={s.notAuthText}>
              Accédez à vos annonces, favoris, messages et bien plus
            </Text>

            <View style={s.notAuthBtnGroup}>
              <TouchableOpacity
                style={s.loginBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[P.terra, P.orange700]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.loginBtnGrad}
                >
                  <Text style={s.loginBtnTxt}>Se connecter</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.registerBtn}
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.88}
              >
                <Text style={s.registerBtnTxt}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const handleLogout = async () => {
    setAlert({
      visible: true,
      type: 'warning',
      title: 'Se déconnecter',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      buttons: [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Déconnecter',
          onPress: async () => {
            setAlert({ ...alert, visible: false });
            setLoggingOut(true);
            try {
              await logout();
              navigation.navigate('Home');
            } catch (error) {
              setLoggingOut(false);
              setAlert({
                visible: true,
                type: 'error',
                title: 'Erreur',
                message: error.message || 'Erreur lors de la déconnexion',
                buttons: [{ text: 'OK', onPress: () => {} }],
              });
            }
          },
        },
      ],
    });
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Le nom est requis',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      return;
    }

    setSavingProfile(true);
    try {
      const fullWhatsapp = editWhatsapp.trim() 
        ? `${whatsappCountry.dialCode} ${editWhatsapp.trim()}`
        : undefined;

      const profileData = {
        name: editName.trim(),
        city: editCity.trim(),
        avatar: editAvatarUri || null,
        email: editEmail.trim() || undefined,
        description: editDescription.trim() || undefined,
        businessType: editBusinessType,
        whatsapp: fullWhatsapp
      };

      if (editBusinessType === 'professional') {
        profileData.businessName = editBusinessName.trim() || undefined;
      }

      const result = await updateProfile(profileData);

      if (result.success) {
        const updatedUser = result?.data?.user || {};
        await updateUserProfile(updatedUser);

        setEditModalVisible(false);
        setAlert({
          visible: true,
          type: 'success',
          title: 'Profil mis à jour',
          message: 'Vos informations ont été sauvegardées avec succès!',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
      }
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Impossible de mettre à jour le profil',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setAlert({ visible: true, type: 'error', title: 'Erreur', message: 'Le mot de passe doit contenir au moins 6 caractères', buttons: [{ text: 'OK', onPress: () => {} }]});
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert({ visible: true, type: 'error', title: 'Erreur', message: 'Les mots de passe ne correspondent pas', buttons: [{ text: 'OK', onPress: () => {} }]});
      return;
    }
    if (!user.needsPasswordChange && !currentPassword) {
      setAlert({ visible: true, type: 'error', title: 'Erreur', message: 'Veuillez entrer votre mot de passe actuel', buttons: [{ text: 'OK', onPress: () => {} }]});
      return;
    }

    setChangingPassword(true);
    try {
      const { changePassword } = require('../api/auth');
      const res = await changePassword({ currentPassword, newPassword });
      
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await updateUserProfile({ needsPasswordChange: false });
        setAlert({ visible: true, type: 'success', title: 'Succès', message: 'Mot de passe mis à jour avec succès', buttons: [{ text: 'OK', onPress: () => {} }]});
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      setAlert({ visible: true, type: 'error', title: 'Erreur', message: error.message || 'Impossible de changer le mot de passe', buttons: [{ text: 'OK', onPress: () => {} }]});
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        setAlert({
          visible: true,
          type: 'error',
          title: 'Permission refusée',
          message: 'Vous devez autoriser l\'accès à la photothèque',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const picked = result.assets[0];
        if (picked.base64) {
          setEditAvatarUri(`data:image/jpeg;base64,${picked.base64}`);
        } else if (picked.uri) {
          setEditAvatarUri(picked.uri);
        }
      }
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la sélection de l\'image',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    }
  };

  // Utiliser le gestionnaire de visuels au lieu du sélecteur
  const handleSelectImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setAlert({
          visible: true,
          type: 'error',
          title: 'Permission refusée',
          message: 'Autorisez l\'accès à vos photos dans les paramètres',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const picked = result.assets[0];
        if (picked.base64) {
          setEditAvatarUri(`data:image/jpeg;base64,${picked.base64}`);
        } else if (picked.uri) {
          setEditAvatarUri(picked.uri);
        }
      }
    } catch (error) {
      console.error('❌ Erreur sélection image:', error);
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de sélectionner l\'image',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    }
  };

  const handleSelectCity = (city) => {
    setEditCity(city);
    setShowCityModal(false);
  };

  const getAvatarInitials = () => {
    if (!user?.name) return '?';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── BANNIERE CHANGEMENT MOT DE PASSE ─────────────────────────────── */}
      {user?.needsPasswordChange && (
        <View style={s.passwordWarningBanner}>
          <Text style={s.passwordWarningText}>
            🔒 Veuillez personnaliser votre mot de passe pour sécuriser votre compte.
          </Text>
          <TouchableOpacity onPress={() => setSecurityModalVisible(true)} style={s.passwordWarningBtn}>
            <Text style={s.passwordWarningBtnTxt}>Mettre à jour</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── HEADER gradient premium ───────────────────────────────────────── */}
      <LinearGradient
        colors={[P.brown, P.charcoal]}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />
        <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
          <Text style={s.headerTitle}>Mon Profil</Text>
        </Animated.View>
      </LinearGradient>

      {/* ── CONTENT scrollable ─────────────────────────────────────────────── */}
      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── PROFILE CARD ────────────────────────────────────────────────── */}
        <Animated.View style={[s.profileCard, { opacity: headerAnim, transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <BlurView intensity={80} style={s.blurWrapper}>
            {/* Avatar section */}
            <View style={s.avatarSection}>
              <View style={s.avatarContainer}>
                {(user?.avatar || editAvatarUri) ? (
                  <Image
                    source={{ uri: user?.avatar || editAvatarUri }}
                    style={s.avatarImage}
                  />
                ) : (
                  <View style={[s.avatarImage, s.avatarPlaceholder]}>
                    <Text style={s.avatarInitials}>{getAvatarInitials()}</Text>
                  </View>
                )}
                <TouchableOpacity style={s.avatarBadge} activeOpacity={0.7}>
                  <Text style={s.avatarBadgeIcon}>✏️</Text>
                </TouchableOpacity>
              </View>

              {/* User info */}
              <View style={s.userInfo}>
                <Text style={s.userName}>{user?.name || 'Utilisateur'}</Text>
                <Text style={s.userEmail}>{user?.email || ''}</Text>
                <View style={s.verificationBadge}>
                  <Text style={s.verificationBadgeText}>✓ Compte vérifié</Text>
                </View>
              </View>
            </View>

            {/* Stats row - REMOVED: déjà dans la page des annonces */}

            {/* Contact info & Edit button */}
            <View style={s.contactInfo}>
              <View style={s.contactInfoHeader}>
                <Text style={s.sectionTitle}>Détails du compte</Text>
                <TouchableOpacity 
                  onPress={() => setEditModalVisible(true)} 
                  activeOpacity={0.7}
                  style={s.editBtn}
                >
                  <Text style={s.editBtnIcon}>✏️</Text>
                  <Text style={s.editBtnText}>Éditer</Text>
                </TouchableOpacity>
              </View>

              {user?.phone && (
                <View style={s.infoItem}>
                  <Text style={s.infoIcon}>📞</Text>
                  <View style={s.infoContent}>
                    <Text style={s.infoLabel}>Téléphone</Text>
                    <Text style={s.infoValue}>{user.phone}</Text>
                  </View>
                </View>
              )}

              {(user?.city || user?.location) && (
                <View style={s.infoItem}>
                  <Text style={s.infoIcon}>📍</Text>
                  <View style={s.infoContent}>
                    <Text style={s.infoLabel}>Ville</Text>
                    <Text style={s.infoValue}>{user?.city || user?.location}</Text>
                  </View>
                </View>
              )}

              {user?.accountType && (
                <View style={s.infoItem}>
                  <Text style={s.infoIcon}>🏢</Text>
                  <View style={s.infoContent}>
                    <Text style={s.infoLabel}>Type de compte</Text>
                    <Text style={s.infoValue}>{user.accountType === 'business' ? 'Professionnel' : 'Personnel'}</Text>
                  </View>
                </View>
              )}
            </View>
          </BlurView>
        </Animated.View>

        {/* ── MENU SECTION ────────────────────────────────────────────────── */}
        <View style={s.menuSection}>
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setSecurityModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.menuIcon}>🔐</Text>
            <View style={s.menuContent}>
              <Text style={s.menuLabel}>Sécurité et Connexion</Text>
            </View>
            <Text style={s.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.menuItem}
            onPress={() => navigation.navigate('MyListings')}
            activeOpacity={0.7}
          >
            <Text style={s.menuIcon}>📦</Text>
            <View style={s.menuContent}>
              <Text style={s.menuLabel}>Mes annonces</Text>
            </View>
            <Text style={s.menuArrow}>›</Text>
          </TouchableOpacity>

          {/* Option Paramètres masquée temporairement */}
          {/*
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setAlert({
              visible: true,
              type: 'info',
              title: 'Bientôt disponible',
              message: 'Les paramètres de compte seront bientôt disponibles !',
              buttons: [{ text: 'OK', onPress: () => {} }],
            })}
            activeOpacity={0.7}
          >
            <Text style={s.menuIcon}>⚙️</Text>
            <View style={s.menuContent}>
              <Text style={s.menuLabel}>Paramètres</Text>
            </View>
            <Text style={s.menuArrow}>›</Text>
          </TouchableOpacity>
          */}
        </View>

        {/* ── LOGOUT BUTTON ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          <View style={s.logoutAccent} />
          <View style={s.logoutBtnContent}>
            {loggingOut ? (
              <View style={s.logoutLoadingWrap}>
                <ActivityIndicator color={P.error} size="small" />
                <Text style={s.logoutLoadingText}>Déconnexion...</Text>
              </View>
            ) : (
              <>
                <View style={s.logoutIconChip}>
                  <Text style={s.logoutIcon}>⎋</Text>
                </View>
                <View style={s.logoutTextWrap}>
                  <Text style={s.logoutText}>Se déconnecter</Text>
                  <Text style={s.logoutHint}>Fermer votre session sur cet appareil</Text>
                </View>
                <Text style={s.logoutArrow}>›</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* ── ALERT MODAL ────────────────────────────────────────────────────── */}
      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />

      {/* ── EDIT PROFILE MODAL ─────────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.editModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        >
          <View style={[s.editModalContent, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.cityModalHandle} />
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Éditer le profil</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={s.cityModalClose}>
                <Text style={s.cityModalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.editModalScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Avatar section */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Photo de profil</Text>
                <TouchableOpacity 
                  style={s.editAvatarBtn}
                  onPress={handleSelectImage}
                  disabled={savingProfile}
                  activeOpacity={0.8}
                >
                  {editAvatarUri ? (
                    <Image source={{ uri: editAvatarUri }} style={s.editAvatarPreview} />
                  ) : (
                    <View style={[s.editAvatarPreview, s.editAvatarPlaceholder]}>
                      <Text style={s.editAvatarIcon}>📷</Text>
                    </View>
                  )}
                  <View style={s.editAvatarOverlay}>
                    <Text style={s.editAvatarOverlayText}>✏️ Modifier</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Name input */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Nom complet</Text>
                <TextInput
                  style={s.editFieldInput}
                  placeholder="Votre nom"
                  placeholderTextColor={P.muted}
                  value={editName}
                  onChangeText={setEditName}
                  editable={!savingProfile}
                />
              </View>

              {/* City selector */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Ville</Text>
                <TouchableOpacity 
                  style={s.editCityBtn}
                  onPress={() => setShowCityModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={s.editCityIcon}>📍</Text>
                  <Text style={s.editCityValue}>
                    {editCity || 'Sélectionner une ville'}
                  </Text>
                  <Text style={s.editCityArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Email */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Adresse Email</Text>
                <TextInput
                  style={s.editFieldInput}
                  placeholder="Votre adresse email"
                  placeholderTextColor={P.muted}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!savingProfile}
                />
              </View>

              {/* WhatsApp */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Numéro WhatsApp</Text>
                <View style={s.phoneWrap}>
                  <TouchableOpacity
                    style={s.dialBadge}
                    onPress={() => setShowWhatsappPicker(true)}
                    activeOpacity={0.85}
                    disabled={savingProfile}
                  >
                    <Text style={s.dialFlag}>{whatsappCountry.flag}</Text>
                    <Text style={s.dialCode}>{whatsappCountry.dialCode}</Text>
                    <Text style={s.dialArrow}>▾</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.phoneInput}
                    placeholder="12 34 56 78"
                    placeholderTextColor={P.muted}
                    value={editWhatsapp}
                    onChangeText={setEditWhatsapp}
                    keyboardType="phone-pad"
                    editable={!savingProfile}
                  />
                </View>
              </View>

              {/* Type de compte */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Type de compte</Text>
                <View style={s.accountTypeRow}>
                  <TouchableOpacity
                    style={[s.accountTypeBtn, editBusinessType === 'individual' && s.accountTypeBtnActive]}
                    onPress={() => setEditBusinessType('individual')}
                  >
                    <Text style={[s.accountTypeTxt, editBusinessType === 'individual' && s.accountTypeTxtActive]}>Particulier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.accountTypeBtn, editBusinessType === 'professional' && s.accountTypeBtnActive]}
                    onPress={() => setEditBusinessType('professional')}
                  >
                    <Text style={[s.accountTypeTxt, editBusinessType === 'professional' && s.accountTypeTxtActive]}>Professionnel</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nom entreprise (si professionnel) */}
              {editBusinessType === 'professional' && (
                <View style={s.editFieldGroup}>
                  <Text style={s.editFieldLabel}>Nom de l'entreprise *</Text>
                  <TextInput
                    style={s.editFieldInput}
                    placeholder="Nom de votre boutique/entreprise"
                    placeholderTextColor={P.muted}
                    value={editBusinessName}
                    onChangeText={setEditBusinessName}
                    editable={!savingProfile}
                  />
                </View>
              )}

              {/* Description */}
              <View style={s.editFieldGroup}>
                <Text style={s.editFieldLabel}>Description / Bio</Text>
                <TextInput
                  style={[s.editFieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Parlez-nous de vous..."
                  placeholderTextColor={P.muted}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={3}
                  editable={!savingProfile}
                />
              </View>
            </ScrollView>

            <View style={s.editModalFooter}>
              <TouchableOpacity
                style={s.saveProfileBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[P.orange500, P.orange700]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.saveProfileBtnGrad}
                >
                  {savingProfile ? (
                    <ActivityIndicator color={P.white} />
                  ) : (
                    <Text style={s.saveProfileBtnTxt}>Enregistrer les modifications</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SECURITY MODAL ─────────────────────────────────────────────────── */}
      <Modal
        visible={securityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSecurityModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.editModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        >
          <View style={[s.editModalContent, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.cityModalHandle} />
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Sécurité</Text>
              <TouchableOpacity onPress={() => { setSecurityModalVisible(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} style={s.cityModalClose}>
                <Text style={s.cityModalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.editModalScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={[s.passwordSection, { marginTop: 0, borderTopWidth: 0, paddingTop: 0 }]}>
                <Text style={s.editFieldLabel}>Changer le mot de passe</Text>
                
                {!user?.needsPasswordChange && (
                  <View style={s.editFieldGroup}>
                    <Text style={s.editFieldLabel}>Mot de passe actuel</Text>
                    <TextInput
                      style={s.editFieldInput}
                      placeholder="Ancien mot de passe"
                      placeholderTextColor={P.muted}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry
                    />
                  </View>
                )}

                <View style={s.editFieldGroup}>
                  <Text style={s.editFieldLabel}>Nouveau mot de passe</Text>
                  <TextInput
                    style={s.editFieldInput}
                    placeholder="Nouveau mot de passe (min 6 caractères)"
                    placeholderTextColor={P.muted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>

                <View style={s.editFieldGroup}>
                  <Text style={s.editFieldLabel}>Confirmer le nouveau mot de passe</Text>
                  <TextInput
                    style={s.editFieldInput}
                    placeholder="Répétez le nouveau mot de passe"
                    placeholderTextColor={P.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveProfileBtn, { marginTop: 24 }]}
                  onPress={async () => {
                    await handleChangePassword();
                    if (!changingPassword) setSecurityModalVisible(false);
                  }}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={[P.orange500, P.orange700]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.saveProfileBtnGrad}
                  >
                    {changingPassword ? (
                      <ActivityIndicator color={P.white} />
                    ) : (
                      <Text style={s.saveProfileBtnTxt}>Mettre à jour le mot de passe</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CITY SELECTOR MODAL ────────────────────────────────────────────── */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={s.cityModalOverlay}>
          <View style={s.cityModal}>
            <View style={s.cityModalHandle} />
            <View style={s.cityModalHead}>
              <Text style={s.cityModalTitle}>Sélectionner votre ville</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)} style={s.cityModalClose}>
                <Text style={s.cityModalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={NIGER_CITIES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.cityRow,
                    editCity === item && s.cityRowActive,
                  ]}
                  onPress={() => handleSelectCity(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.cityRowIcon}>📍</Text>
                  <Text style={[
                    s.cityRowTxt,
                    editCity === item && { color: P.terra, fontWeight: '800' },
                  ]}>
                    {item}, Niger
                  </Text>
                  {editCity === item && (
                    <Text style={{ color: P.terra, fontWeight: '900', fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* ── WHATSAPP COUNTRY PICKER MODAL ──────────────────────────────────── */}
      <Modal
        visible={showWhatsappPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWhatsappPicker(false)}
      >
        <View style={s.modalRoot}>
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowWhatsappPicker(false)}
          />
          <View style={[s.modal, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={s.cityModalHandle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowWhatsappPicker(false)} style={s.modalClose}>
                <Text style={s.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.countryRow, whatsappCountry.code === c.code && s.countryRowActive]}
                  onPress={() => { setWhatsappCountry(c); setShowWhatsappPicker(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.countryRowFlag}>{c.flag}</Text>
                  <Text style={[s.countryRowName, whatsappCountry.code === c.code && { color: P.terra }]}>
                    {c.name}
                  </Text>
                  <Text style={s.countryRowDial}>{c.dialCode}</Text>
                  {whatsappCountry.code === c.code && <Text style={{ color: P.terra, fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ── 100% tokens P.* de MOBILE_COLORS ─────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.sand },

  // ── Header ardoise ──
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  headerNotAuth: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: P.terra,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: P.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: P.muted,
    fontStyle: 'italic',
  },
  passwordWarningBanner: {
    backgroundColor: P.orange100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.orange300,
    paddingTop: Platform.OS === 'ios' ? 44 : 34, 
  },
  passwordWarningText: {
    flex: 1,
    fontSize: 13,
    color: P.orange700,
    fontWeight: '600',
    marginRight: 10,
  },
  passwordWarningBtn: {
    backgroundColor: P.orange600,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  passwordWarningBtnTxt: {
    color: P.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Content scrollable ──
  content: { flex: 1 },
  scrollContent: { paddingTop: 18, paddingHorizontal: 12 },

  // ── NOT AUTH ──
  notAuthContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  notAuthEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  notAuthTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: P.charcoal,
    marginBottom: 12,
    textAlign: 'center',
  },
  notAuthText: {
    fontSize: 15,
    color: P.muted,
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 22,
  },
  notAuthBtnGroup: { width: '100%', gap: 12 },
  loginBtn: {
    overflow: 'hidden',
    borderRadius: 14,
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnGrad: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: P.white,
  },
  registerBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: P.terra,
    borderRadius: 14,
    backgroundColor: P.white,
  },
  registerBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: P.terra,
  },

  // ── PROFILE CARD ──
  profileCard: {
    marginHorizontal: 6,
    marginBottom: 24,
    borderRadius: 18,
    overflow: 'hidden',
  },
  blurWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },

  // ── Avatar section ──
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: P.terra,
    backgroundColor: P.sand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarPlaceholder: { backgroundColor: P.orange500 },
  avatarInitials: {
    fontSize: 42,
    fontWeight: '800',
    color: P.white,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: P.terra,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.white,
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarBadgeIcon: { fontSize: 16 },

  // ── User info ──
  userInfo: { alignItems: 'center' },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: P.charcoal,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: P.muted,
    marginBottom: 10,
  },
  verificationBadge: {
    backgroundColor: P.successSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.greenDark + '30',
  },
  verificationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: P.greenDark,
  },

  // ── Contact info ──
  contactInfo: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: P.charcoal,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottomend: 2,
  },
  infoIcon: { fontSize: 18, marginRight: 12, width: 28 },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    color: P.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: P.charcoal,
  },

  // ── MENU SECTION ──
  menuSection: {
    marginHorizontal: 6,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.white,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.sand,
    shadowColor: P.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuIcon: { fontSize: 22, marginRight: 12, width: 28 },
  menuContent: { flex: 1 },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: P.charcoal,
  },
  menuArrow: {
    fontSize: 22,
    color: P.terra,
    fontWeight: '300',
  },

  // ── LOGOUT BUTTON ──
  logoutBtn: {
    marginHorizontal: 6,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.error + '35',
    shadowColor: P.error,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutAccent: {
    height: 3,
    backgroundColor: P.error,
  },
  logoutBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  logoutIconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.error + '18',
    borderWidth: 1,
    borderColor: P.error + '45',
  },
  logoutIcon: { fontSize: 17, color: P.error, fontWeight: '800' },
  logoutTextWrap: {
    flex: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: P.error,
  },
  logoutHint: {
    marginTop: 1,
    fontSize: 11,
    color: P.muted,
  },
  logoutArrow: {
    fontSize: 22,
    color: P.error,
    fontWeight: '300',
    marginTop: -1,
  },
  logoutLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
  },
  logoutLoadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: P.error,
  },

  // ── CONTACT INFO & EDIT BUTTON ──
  contactInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.orange50,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: P.terra,
  },
  editBtnIcon: { fontSize: 14 },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: P.terra,
  },

  // ── EDIT MODAL ──
  editModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  editModalContent: {
    flex: 1,
    backgroundColor: P.white,
    marginTop: 60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: P.sand,
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: P.charcoal,
  },
  editModalButtons: {
    fontSize: 14,
    fontWeight: '700',
    color: P.terra,
  },
  editModalScroll: { flex: 1 },
  editFieldGroup: { marginBottom: 18 },
  editFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: P.charcoal,
    marginBottom: 8,
  },
  editFieldInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: P.charcoal,
    backgroundColor: '#F7F9FC',
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  accountTypeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: P.sand,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: P.surface,
  },
  accountTypeBtnActive: {
    borderColor: P.terra,
    backgroundColor: P.peachSoft,
  },
  accountTypeTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: P.muted,
  },
  accountTypeTxtActive: {
    color: P.terra,
  },
  editModalFooter: {
    paddingTop: 16,
  },
  saveProfileBtn: {
    borderRadius: 100,
    overflow: 'hidden',
    shadowColor: P.orange700,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveProfileBtnGrad: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveProfileBtnTxt: {
    color: P.white,
    fontSize: 16,
    fontWeight: '800',
  },
  passwordSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: P.sand,
  },
  passwordSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: P.charcoal,
    marginBottom: 16,
  },
  changePasswordBtn: {
    backgroundColor: P.charcoal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  changePasswordBtnTxt: {
    color: P.white,
    fontWeight: '800',
    fontSize: 15,
  },

  // ── EDIT AVATAR ──
  editAvatarBtn: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  editAvatarPlaceholder: {
    backgroundColor: P.sand,
    borderWidth: 2,
    borderColor: P.terra,
    borderStyle: 'dashed',
  },
  editAvatarIcon: {
    fontSize: 60,
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  editAvatarOverlayText: {
    color: P.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── EDIT CITY SELECTOR ──
  editCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F7F9FC',
    gap: 10,
  },
  editCityIcon: { fontSize: 18 },
  editCityValue: {
    flex: 1,
    fontSize: 14,
    color: P.charcoal,
    fontWeight: '600',
  },
  editCityArrow: {
    fontSize: 18,
    color: P.terra,
  },

  // ── CITY MODAL ──
  cityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  cityModal: {
    backgroundColor: P.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  cityModalHandle: {
    height: 4,
    width: 40,
    backgroundColor: P.sand,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  cityModalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: P.sand,
  },
  cityModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: P.charcoal,
  },
  cityModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityModalCloseTxt: {
    fontSize: 18,
    color: P.charcoal,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: P.sand,
    gap: 12,
  },
  cityRowActive: {
    backgroundColor: P.orange50,
  },
  cityRowIcon: { fontSize: 18, width: 24 },
  cityRowTxt: {
    flex: 1,
    fontSize: 15,
    color: P.charcoal,
    fontWeight: '500',
  },

  // ── PHONE INPUT ──
  phoneWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dialBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F7F9FC', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  dialFlag:   { fontSize: 18 },
  dialCode:   { fontSize: 14, fontWeight: '700', color: P.charcoal },
  dialArrow:  { fontSize: 11, color: P.muted },
  phoneInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: P.charcoal,
    backgroundColor: '#F7F9FC', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },

  // ── COUNTRY PICKER MODAL ──
  modalRoot:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modal:         { backgroundColor: P.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '75%' },
  modalHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: P.sand },
  modalTitle:    { fontSize: 18, fontWeight: '900', color: P.charcoal },
  modalClose:    { width: 36, height: 36, borderRadius: 18, backgroundColor: P.sand, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { fontSize: 16, color: P.charcoal, fontWeight: '700' },
  countryRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.sand },
  countryRowActive: { backgroundColor: P.orange50 },
  countryRowFlag:   { fontSize: 26 },
  countryRowName:   { flex: 1, fontSize: 15, fontWeight: '600', color: P.charcoal },
  countryRowDial:   { fontSize: 13, color: P.muted, marginRight: 8 },
});
