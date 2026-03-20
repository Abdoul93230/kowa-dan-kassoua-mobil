// ─── RegisterStep2Screen v2 PREMIUM ─ MarketHub Niger ────────────────────────
// Profil vendeur — micro-étapes animées, cohérent avec l'app

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, FlatList, Image, Animated, StatusBar,
  PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../contexts/AuthContext';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const SCREEN_W = Dimensions.get('window').width;

const NIGER_CITIES = [
  'Niamey','Zinder','Maradi','Agadez','Tahoua',
  'Dosso','Tillabéri','Diffa','Arlit',"Birni N'Konni",
  'Gaya','Tessaoua','Autre...',
];

// Définition des micro-étapes
const STEPS = [
  { id: 'businessType', label: 'Quel type de compte ?',          icon: '🏪', hint: 'Particulier ou professionnel' },
  { id: 'businessName', label: 'Nom de votre activité ?',        icon: '🏷️', hint: 'Uniquement pour les professionnels' },
  { id: 'description',  label: 'Décrivez votre activité',        icon: '✍️', hint: 'Optionnel' },
  { id: 'location',     label: 'Où êtes-vous situé ?',           icon: '📍', hint: 'Votre ville au Niger' },
  { id: 'avatar',       label: 'Une photo de profil ?',          icon: '🤳', hint: 'Optionnel — rassurez vos acheteurs' },
];

export default function RegisterStep2Screen({ navigation, route }) {
  const { phone, verified, formData: step1Data } = route.params || {};
  const { register } = useAuth();
  const insets = useSafeAreaInsets();

  const [stepIndex,     setStepIndex]     = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [isCustomLoc,   setIsCustomLoc]   = useState(false);
  const [avatarUri,     setAvatarUri]     = useState(null);
  const [rawUri,        setRawUri]        = useState(null);   // URI brute avant crop
  const [showEditor,    setShowEditor]    = useState(false);  // modal éditeur
  const [cropProcessing,setCropProcessing]= useState(false);
  // Paramètres de recadrage (zoom + offset)
  const cropScale  = useRef(new Animated.Value(1)).current;
  const cropOffX   = useRef(new Animated.Value(0)).current;
  const cropOffY   = useRef(new Animated.Value(0)).current;
  const scaleVal   = useRef(1);
  const offsetVal  = useRef({ x: 0, y: 0 });

  const [form, setForm] = useState({
    businessType: 'individual',
    businessName: '',
    description: '',
    location: '',
  });
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Animations
  const slideX   = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!verified || !phone || !step1Data) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Données manquantes. Veuillez recommencer.',
        buttons: [{ text: 'OK', onPress: () => navigation.replace('Register') }],
      });
    }
  }, [verified, phone, step1Data, navigation]);

  // Calcul des étapes visibles selon le type de compte
  const visibleSteps = STEPS.filter(s => {
    if (s.id === 'businessName' || s.id === 'description')
      return form.businessType === 'professional';
    return true;
  });

  const step      = visibleSteps[stepIndex];
  const isLast    = stepIndex === visibleSteps.length - 1;
  const totalSteps= STEPS.length; // 5 segments toujours affichés

  // Animation transition
  const animateNext = (forward = true) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: forward ? -40 : 40, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(forward ? 40 : -40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideX,   { toValue: 0, tension: 100, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  };

  const set = (key, val) => {
    setError('');
    setForm(p => ({ ...p, [key]: val }));
  };

  // Validation par étape
  const validate = () => {
    switch (step.id) {
      case 'businessName':
        if (!form.businessName.trim())
          return 'Le nom de votre activité est requis';
        break;
      case 'description':
        // Optionnel — pas de validation obligatoire
        break;
      case 'location':
        if (!form.location.trim())
          return 'Veuillez sélectionner votre ville';
        break;
    }
    return null;
  };

  const goNext = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    if (!isLast) {
      animateNext(true);
      setStepIndex(i => i + 1);
      setError('');
    } else {
      await handleSubmit();
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      animateNext(false);
      setStepIndex(i => i - 1);
      setError('');
    }
  };

  // ── Sélection image → ouvre l'éditeur ─────────────────────────────────────
  const handlePickAvatar = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      setAlert({
        visible: true,
        type: 'warning',
        title: 'Permission requise',
        message: 'Autorisez l\'accès à vos photos',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,  // on gère l'édition nous-mêmes
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      // Réinitialiser les valeurs de crop
      scaleVal.current  = 1;
      offsetVal.current = { x: 0, y: 0 };
      cropScale.setValue(1);
      cropOffX.setValue(0);
      cropOffY.setValue(0);
      setRawUri(result.assets[0].uri);
      setShowEditor(true);
    }
  };

  // ── PanResponder pour déplacer + pincer l'image dans l'éditeur ────────────
  const EDITOR_SIZE = SCREEN_W - 48;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        // Déplacement
        const newX = offsetVal.current.x + g.dx;
        const newY = offsetVal.current.y + g.dy;
        cropOffX.setValue(newX);
        cropOffY.setValue(newY);
      },
      onPanResponderRelease: (_, g) => {
        offsetVal.current = {
          x: offsetVal.current.x + g.dx,
          y: offsetVal.current.y + g.dy,
        };
      },
    })
  ).current;

  // ── Zoom + / - ────────────────────────────────────────────────────────────
  const zoom = (factor) => {
    const next = Math.max(0.5, Math.min(3, scaleVal.current * factor));
    scaleVal.current = next;
    Animated.spring(cropScale, { toValue: next, useNativeDriver: true, speed: 30 }).start();
  };

  // ── Valider le crop avec ImageManipulator ─────────────────────────────────
  const handleCropConfirm = async () => {
    if (!rawUri) return;
    setCropProcessing(true);
    try {
      // Calcul de la zone de crop centrée
      const s = scaleVal.current;
      const ox = offsetVal.current.x;
      const oy = offsetVal.current.y;

      // On redimensionne d'abord à une taille fixe pour normaliser
      const resized = await ImageManipulator.manipulateAsync(
        rawUri,
        [{ resize: { width: 600, height: 600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Crop centré ajusté selon offset et scale
      const cropSize = Math.round(600 / s);
      const originX  = Math.max(0, Math.min(600 - cropSize, 300 - cropSize / 2 - ox * (600 / EDITOR_SIZE)));
      const originY  = Math.max(0, Math.min(600 - cropSize, 300 - cropSize / 2 - oy * (600 / EDITOR_SIZE)));

      const cropped = await ImageManipulator.manipulateAsync(
        resized.uri,
        [{ crop: { originX, originY, width: cropSize, height: cropSize } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      setAvatarUri(cropped.uri);
      setShowEditor(false);
      setRawUri(null);
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de traiter l\'image',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setCropProcessing(false);
    }
  };

  const handleSelectCity = (city) => {
    if (city === 'Autre...') {
      setIsCustomLoc(true);
      setShowCityModal(false);
      set('location', '');
    } else {
      set('location', `${city}, Niger`);
      setIsCustomLoc(false);
      setShowCityModal(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const userData = {
        name:         step1Data.name,
        phone:        step1Data.phone,
        whatsapp:     step1Data.whatsapp || step1Data.phone,
        email:        step1Data.email || undefined,
        password:     step1Data.password,
        businessType: form.businessType,
        businessName: form.businessType === 'professional' ? form.businessName.trim() : step1Data.name,
        description:  form.businessType === 'professional' ? form.description.trim() : '',
        location:     form.location.trim(),
      };
      await register(userData);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Bienvenue 🎉',
        message: 'Votre compte a été créé avec succès !',
        buttons: [{ text: 'C\'est parti !', onPress: () => navigation.replace('MainTabs') }],
      });
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e.message || 'Une erreur est survenue',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu du champ selon l'étape ──────────────────────────────────────────
  const renderInput = () => {
    switch (step.id) {

      case 'businessType':
        return (
          <View style={s.typeRow}>
            <TouchableOpacity
              style={[s.typeCard, form.businessType === 'individual' && s.typeCardActive]}
              onPress={() => { set('businessType', 'individual'); }}
              activeOpacity={0.85}
            >
              <Text style={s.typeCardEmoji}>👤</Text>
              <Text style={[s.typeCardTitle, form.businessType === 'individual' && s.typeCardTitleActive]}>
                Particulier
              </Text>
              <Text style={s.typeCardSub}>Vendre vos biens personnels</Text>
              {form.businessType === 'individual' && (
                <View style={s.typeCardCheck}><Text style={{ color: P.terra, fontSize: 14, fontWeight: '900' }}>✓</Text></View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.typeCard, form.businessType === 'professional' && s.typeCardActive]}
              onPress={() => { set('businessType', 'professional'); }}
              activeOpacity={0.85}
            >
              <Text style={s.typeCardEmoji}>💼</Text>
              <Text style={[s.typeCardTitle, form.businessType === 'professional' && s.typeCardTitleActive]}>
                Professionnel
              </Text>
              <Text style={s.typeCardSub}>Gérer votre activité commerciale</Text>
              {form.businessType === 'professional' && (
                <View style={s.typeCardCheck}><Text style={{ color: P.terra, fontSize: 14, fontWeight: '900' }}>✓</Text></View>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'businessName':
        return (
          <TextInput
            style={s.mainInput}
            placeholder="Ex: Boutique Amadou"
            placeholderTextColor="rgba(107,114,128,0.6)"
            value={form.businessName}
            onChangeText={v => set('businessName', v)}
            autoCapitalize="words"
          />
        );

      case 'description':
        return (
          <View>
            <TextInput
              style={[s.mainInput, s.textarea]}
              placeholder="Décrivez votre activité, vos produits ou services…"
              placeholderTextColor="rgba(107,114,128,0.6)"
              value={form.description}
              onChangeText={v => set('description', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[
              s.charCount,
              form.description.length >= 20 && { color: P.green },
            ]}>
              {form.description.length} / 20 min
              {form.description.length >= 20 ? ' ✓' : ''}
            </Text>
          </View>
        );

      case 'location':
        return (
          <View>
            {!isCustomLoc ? (
              <TouchableOpacity
                style={s.locationBtn}
                onPress={() => setShowCityModal(true)}
                activeOpacity={0.85}
              >
                <Text style={s.locationBtnFlag}>📍</Text>
                <Text style={[s.locationBtnTxt, !form.location && s.locationBtnPlaceholder]}>
                  {form.location || 'Sélectionner votre ville…'}
                </Text>
                <Text style={s.locationBtnArrow}>▾</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <TextInput
                  style={s.mainInput}
                  placeholder="Entrez votre localisation"
                  placeholderTextColor="rgba(107,114,128,0.6)"
                  value={form.location}
                  onChangeText={v => set('location', v)}
                />
                <TouchableOpacity
                  style={s.switchToPickerBtn}
                  onPress={() => { setIsCustomLoc(false); setShowCityModal(true); }}
                >
                  <Text style={s.switchToPickerTxt}>← Choisir dans la liste</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'avatar':
        return (
          <View style={s.avatarZone}>
            {/* Wrapper relatif pour badge en dehors du overflow:hidden */}
            <View style={s.avatarWrapper}>
              <TouchableOpacity style={s.avatarCircle} onPress={handlePickAvatar} activeOpacity={0.85}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={s.avatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.avatarEmpty}>
                    <Text style={{ fontSize: 40 }}>📷</Text>
                    <Text style={s.avatarEmptyTxt}>Appuyer pour choisir</Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Badge éditer EN DEHORS du cercle pour ne pas être coupé */}
              <TouchableOpacity style={s.avatarEditBadge} onPress={handlePickAvatar}>
                <LinearGradient colors={[P.orange500, P.orange700]} style={s.avatarEditGrad}>
                  <Text style={{ fontSize: 13, color: P.white }}>✏️</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={[s.avatarHint, { color: avatarUri ? P.green : P.muted }]}>
              {avatarUri ? '✓ Photo sélectionnée' : 'JPG ou PNG · Max 2MB'}
            </Text>
            <Text style={s.avatarSubHint}>
              {avatarUri
                ? 'Photo recadrée et prête à l\'envoi'
                : 'Un éditeur de recadrage s\'ouvrira pour ajuster'}
            </Text>
            {avatarUri && (
              <TouchableOpacity onPress={() => setAvatarUri(null)} style={s.avatarRemove}>
                <Text style={s.avatarRemoveTxt}>Supprimer et rechoisir</Text>
              </TouchableOpacity>
            )}
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#2d3748', '#374151']}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />
        <View style={s.headerRow}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={stepIndex > 0 ? goPrev : () => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={s.backBtnTxt}>←</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoMini}>
              <Text style={s.logoMiniTxt}>M</Text>
            </LinearGradient>
            <Text style={s.headerBrand}>MarketHub</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkTxt}>Connexion</Text>
          </TouchableOpacity>
        </View>

        {/* Barre de progression */}
        <View style={s.progSegs}>
          {visibleSteps.map((_, i) => (
            <View key={i} style={[
              s.progSeg,
              i < stepIndex  && s.progSegDone,
              i === stepIndex && s.progSegActive,
            ]} />
          ))}
        </View>
        <Text style={s.stepCount}>{stepIndex + 1} / {visibleSteps.length}</Text>

        <LinearGradient
          colors={['transparent', P.terra, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── CONTENU ────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>

          {/* Question */}
          <View style={s.questionZone}>
            <Text style={s.stepIcon}>{step.icon}</Text>
            <Text style={s.question}>{step.label}</Text>
            {step.hint ? <Text style={s.questionHint}>{step.hint}</Text> : null}
          </View>

          {/* Input */}
          <View style={s.inputZone}>
            {renderInput()}

            {/* Erreur */}
            {error ? (
              <View style={s.errorWrap}>
                <Text style={s.errorTxt}>⚠ {error}</Text>
              </View>
            ) : null}
          </View>

          {/* Bénéfices — affiché à la dernière étape */}
          {isLast && (
            <View style={s.benefitsCard}>
              <View style={s.benefitsHead}>
                <View style={s.benefitsIcon}>
                  <LinearGradient colors={[P.orange500, P.orange700]} style={s.benefitsIconGrad}>
                    <Text style={{ fontSize: 20 }}>🎉</Text>
                  </LinearGradient>
                </View>
                <Text style={s.benefitsTitle}>Vous êtes prêt à commencer !</Text>
              </View>
              {[
                'Publiez des annonces illimitées gratuitement',
                'Accès à des milliers d\'acheteurs au Niger',
                'Messagerie directe avec vos clients',
                'Support client dédié',
              ].map((b, i) => (
                <View key={i} style={s.benefitItem}>
                  <Text style={s.benefitDot}>●</Text>
                  <Text style={s.benefitTxt}>{b}</Text>
                </View>
              ))}
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          onPress={goNext}
          disabled={loading}
          activeOpacity={0.88}
          style={s.nextBtn}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.nextBtnGrad}
          >
            {loading
              ? <ActivityIndicator color={P.white} />
              : <Text style={s.nextBtnTxt}>
                  {isLast ? '🎉 Créer mon compte' : 'Continuer →'}
                </Text>
            }
          </LinearGradient>
        </TouchableOpacity>
        {step.id === 'avatar' && (
          <TouchableOpacity onPress={goNext} style={s.skipBtn}>
            <Text style={s.skipBtnTxt}>Passer cette étape →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── MODAL VILLES ───────────────────────────────────────────────── */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Sélectionner votre ville</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)} style={s.modalClose}>
                <Text style={s.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={NIGER_CITIES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.cityRow,
                    form.location === `${item}, Niger` && s.cityRowActive,
                  ]}
                  onPress={() => handleSelectCity(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.cityRowIcon}>
                    {item === 'Autre...' ? '✏️' : '📍'}
                  </Text>
                  <Text style={[
                    s.cityRowTxt,
                    form.location === `${item}, Niger` && { color: P.terra, fontWeight: '800' },
                    item === 'Autre...' && { color: P.amber },
                  ]}>
                    {item === 'Autre...' ? 'Autre ville…' : `${item}, Niger`}
                  </Text>
                  {form.location === `${item}, Niger` && (
                    <Text style={{ color: P.terra, fontWeight: '900', fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* ── MODAL ÉDITEUR PHOTO ────────────────────────────────────────── */}
      <Modal visible={showEditor} transparent animationType="fade">
        <View style={s.editorOverlay}>
          <LinearGradient colors={['#111827', '#1f2937']} style={s.editorContainer}>

            {/* Header éditeur */}
            <View style={[s.editorHead, { paddingTop: (insets.top || 0) + 8 }]}>
              <TouchableOpacity onPress={() => { setShowEditor(false); setRawUri(null); }} style={s.editorHeadBtn}>
                <Text style={s.editorHeadBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <Text style={s.editorTitle}>Ajuster la photo</Text>
              <TouchableOpacity
                onPress={handleCropConfirm}
                disabled={cropProcessing}
                style={s.editorConfirmBtn}
              >
                {cropProcessing
                  ? <ActivityIndicator size="small" color={P.white} />
                  : <Text style={s.editorConfirmTxt}>Valider ✓</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Zone de crop avec cadre carré */}
            <View style={s.editorFrame}>
              {/* Image déplaçable */}
              <Animated.Image
                source={{ uri: rawUri }}
                style={[
                  s.editorImage,
                  {
                    transform: [
                      { scale: cropScale },
                      { translateX: cropOffX },
                      { translateY: cropOffY },
                    ],
                  },
                ]}
                resizeMode="cover"
                {...panResponder.panHandlers}
              />
              {/* Grille de cadrage */}
              <View style={s.editorGrid} pointerEvents="none">
                <View style={s.editorGridLineH1} />
                <View style={s.editorGridLineH2} />
                <View style={s.editorGridLineV1} />
                <View style={s.editorGridLineV2} />
                {/* Coins */}
                <View style={[s.editorCorner, s.editorCornerTL]} />
                <View style={[s.editorCorner, s.editorCornerTR]} />
                <View style={[s.editorCorner, s.editorCornerBL]} />
                <View style={[s.editorCorner, s.editorCornerBR]} />
              </View>
            </View>

            {/* Instructions */}
            <Text style={s.editorHint}>Déplacez l'image pour cadrer · Utilisez + / − pour zoomer</Text>

            {/* Contrôles zoom */}
            <View style={s.editorZoomRow}>
              <TouchableOpacity style={s.editorZoomBtn} onPress={() => zoom(0.8)}>
                <Text style={s.editorZoomTxt}>−</Text>
              </TouchableOpacity>
              <View style={s.editorZoomBar}>
                <LinearGradient
                  colors={[P.orange500, P.amber]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.editorZoomFill, { width: `${Math.round(((scaleVal.current - 0.5) / 2.5) * 100)}%` }]}
                />
              </View>
              <TouchableOpacity style={s.editorZoomBtn} onPress={() => zoom(1.25)}>
                <Text style={s.editorZoomTxt}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Reset */}
            <TouchableOpacity
              onPress={() => {
                scaleVal.current = 1;
                offsetVal.current = { x: 0, y: 0 };
                Animated.parallel([
                  Animated.spring(cropScale, { toValue: 1, useNativeDriver: true }),
                  Animated.spring(cropOffX,  { toValue: 0, useNativeDriver: true }),
                  Animated.spring(cropOffY,  { toValue: 0, useNativeDriver: true }),
                ]).start();
              }}
              style={s.editorResetBtn}
            >
              <Text style={s.editorResetTxt}>↺ Réinitialiser</Text>
            </TouchableOpacity>

          </LinearGradient>
        </View>
      </Modal>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.surface },

  // Header
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 15, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  loginLink:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  loginLinkTxt: { fontSize: 12, fontWeight: '600', color: P.white },
  progSegs:     { flexDirection: 'row', gap: 4, marginBottom: 8 },
  progSeg:      { flex: 1, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  progSegDone:  { backgroundColor: P.terra },
  progSegActive:{ backgroundColor: P.amber },
  stepCount:    { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 2 },
  headerGlow:   { height: 1.5, marginTop: 8 },

  // Scroll
  scroll: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },

  // Question
  questionZone: { marginBottom: 24 },
  stepIcon:     { fontSize: 40, marginBottom: 12 },
  question:     { fontSize: 26, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, lineHeight: 34, marginBottom: 6 },
  questionHint: { fontSize: 13, color: P.muted, lineHeight: 19 },

  // Input zone
  inputZone: { marginBottom: 8 },

  // Input souligné
  mainInput: {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, backgroundColor: 'transparent',
  },
  textarea: {
    minHeight: 100, fontSize: 15, lineHeight: 22,
    borderBottomWidth: 0,
    backgroundColor: P.white, borderRadius: 12,
    borderWidth: 1, borderColor: P.dim,
    padding: 14, textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: P.muted, marginTop: 6, fontWeight: '600' },

  // Choix type
  typeRow:           { flexDirection: 'row', gap: 12 },
  typeCard:          { flex: 1, backgroundColor: P.white, borderRadius: 18, borderWidth: 1.5, borderColor: P.dim, padding: 18, alignItems: 'center', position: 'relative' },
  typeCardActive:    { borderColor: P.terra, backgroundColor: P.peachSoft },
  typeCardEmoji:     { fontSize: 32, marginBottom: 10 },
  typeCardTitle:     { fontSize: 15, fontWeight: '800', color: P.charcoal, marginBottom: 4 },
  typeCardTitleActive:{ color: P.terra },
  typeCardSub:       { fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16 },
  typeCardCheck:     { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: P.peachSoft, alignItems: 'center', justifyContent: 'center' },

  // Location
  locationBtn:         { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 14, borderWidth: 1.5, borderColor: P.dim, padding: 16, gap: 10 },
  locationBtnFlag:     { fontSize: 20 },
  locationBtnTxt:      { flex: 1, fontSize: 16, fontWeight: '600', color: P.charcoal },
  locationBtnPlaceholder:{ color: P.muted, fontWeight: '400' },
  locationBtnArrow:    { fontSize: 16, color: P.muted },
  switchToPickerBtn:   { marginTop: 10, alignSelf: 'flex-start' },
  switchToPickerTxt:   { fontSize: 13, color: P.terra, fontWeight: '600' },

  // Avatar
  avatarZone:      { alignItems: 'center', gap: 10 },
  avatarWrapper:   { position: 'relative', width: 130, height: 130, marginBottom: 4 },
  avatarCircle:    { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', backgroundColor: P.sand, shadowColor: P.charcoal, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5 },
  avatarImg:       { width: '100%', height: '100%' },
  avatarEmpty:     { width: '100%', height: '100%', backgroundColor: P.surface, justifyContent: 'center', alignItems: 'center', gap: 6 },
  avatarEmptyTxt:  { fontSize: 11, color: P.muted, fontWeight: '600' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: P.white, shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4 },
  avatarEditGrad:  { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  avatarHint:      { fontSize: 13, fontWeight: '700' },
  avatarSubHint:   { fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 },
  avatarRemove:    { paddingVertical: 6 },
  avatarRemoveTxt: { fontSize: 13, color: P.error, fontWeight: '600' },

  // Erreur
  errorWrap: { marginTop: 12, backgroundColor: P.errorSoft, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: P.errorBorder },
  errorTxt:  { fontSize: 13, color: P.error, fontWeight: '600' },

  // Bénéfices
  benefitsCard: { marginTop: 20, backgroundColor: P.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: P.dim, gap: 10 },
  benefitsHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  benefitsIcon: { borderRadius: 14, overflow: 'hidden' },
  benefitsIconGrad: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  benefitsTitle:{ fontSize: 15, fontWeight: '800', color: P.charcoal, flex: 1 },
  benefitItem:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  benefitDot:   { fontSize: 7, color: P.terra, marginTop: 6 },
  benefitTxt:   { fontSize: 13, color: P.muted, flex: 1, lineHeight: 19 },

  // Footer
  footer:      { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  nextBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnTxt:  { fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  skipBtn:     { alignItems: 'center', paddingVertical: 10 },
  skipBtnTxt:  { fontSize: 13, color: P.muted, fontWeight: '600' },

  // Modal villes
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: P.charcoal },
  modalClose:   { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt:{ fontSize: 13, color: P.muted, fontWeight: '700' },
  cityRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: P.dim + '60' },
  cityRowActive:{ backgroundColor: P.peachSoft },
  cityRowIcon:  { fontSize: 18 },
  cityRowTxt:   { flex: 1, fontSize: 15, fontWeight: '500', color: P.charcoal },

  // ── Éditeur photo ──────────────────────────────────────────────────────────
  editorOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  editorContainer:  { flex: 1 },
  editorHead:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  editorHeadBtn:    { paddingHorizontal: 12, paddingVertical: 8 },
  editorHeadBtnTxt: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  editorTitle:      { fontSize: 16, fontWeight: '800', color: P.white },
  editorConfirmBtn: { backgroundColor: P.terra, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editorConfirmTxt: { fontSize: 14, fontWeight: '800', color: P.white },

  editorFrame: {
    width:  SCREEN_W - 48,
    height: SCREEN_W - 48,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#000',
    position: 'relative',
  },
  editorImage: {
    width:  SCREEN_W - 48,
    height: SCREEN_W - 48,
  },

  // Grille de cadrage
  editorGrid:      { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 4 },
  editorGridLineH1:{ position: 'absolute', left: 0, right: 0, top: '33.33%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  editorGridLineH2:{ position: 'absolute', left: 0, right: 0, top: '66.66%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  editorGridLineV1:{ position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  editorGridLineV2:{ position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Coins blancs
  editorCorner:   { position: 'absolute', width: 20, height: 20, borderColor: P.white },
  editorCornerTL: { top: 0,    left: 0,    borderTopWidth: 3,    borderLeftWidth: 3 },
  editorCornerTR: { top: 0,    right: 0,   borderTopWidth: 3,    borderRightWidth: 3 },
  editorCornerBL: { bottom: 0, left: 0,    borderBottomWidth: 3, borderLeftWidth: 3 },
  editorCornerBR: { bottom: 0, right: 0,   borderBottomWidth: 3, borderRightWidth: 3 },

  editorHint:    { fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 14, marginBottom: 16 },

  // Contrôles zoom
  editorZoomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 12, marginBottom: 14 },
  editorZoomBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  editorZoomTxt: { fontSize: 22, color: P.white, fontWeight: '300', lineHeight: 28 },
  editorZoomBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  editorZoomFill:{ height: '100%', borderRadius: 2 },

  editorResetBtn:{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  editorResetTxt:{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
});