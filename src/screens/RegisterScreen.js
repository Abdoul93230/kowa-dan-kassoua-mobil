// ─── RegisterScreen v2 PREMIUM ─ MarketHub Niger ─────────────────────────────
// Micro-étapes animées — une question à la fois, ultra user-friendly

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Modal, ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { sendOTP } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';

const COUNTRIES = [
  { name: 'Niger',        code: 'NE', dialCode: '+227', flag: '🇳🇪' },
  { name: 'Sénégal',      code: 'SN', dialCode: '+221', flag: '🇸🇳' },
  { name: 'Mali',         code: 'ML', dialCode: '+223', flag: '🇲🇱' },
  { name: 'Burkina Faso', code: 'BF', dialCode: '+226', flag: '🇧🇫' },
  { name: "Côte d'Ivoire",code: 'CI', dialCode: '+225', flag: '🇨🇮' },
  { name: 'Bénin',        code: 'BJ', dialCode: '+229', flag: '🇧🇯' },
  { name: 'Togo',         code: 'TG', dialCode: '+228', flag: '🇹🇬' },
];

// Définition des micro-étapes
// Chaque étape = une seule question
const STEPS = [
  { id: 'name',            label: 'Comment vous appelez-vous ?',      icon: '👋', hint: 'Votre nom complet' },
  { id: 'country',         label: 'Votre pays ?',                     icon: '🌍', hint: 'Sélectionnez votre pays' },
  { id: 'phone',           label: 'Votre numéro de téléphone ?',       icon: '📱', hint: 'Numéro principal' },
  { id: 'whatsapp',        label: 'Votre WhatsApp ?',                  icon: '💬', hint: 'Optionnel — même numéro par défaut' },
  { id: 'email',           label: 'Votre email ?',                     icon: '✉️', hint: 'Optionnel' },
  { id: 'password',        label: 'Choisissez un mot de passe',        icon: '🔒', hint: 'Minimum 6 caractères' },
  { id: 'confirmPassword', label: 'Confirmez votre mot de passe',      icon: '✅', hint: 'Retapez votre mot de passe' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stepIndex,  setStepIndex]  = useState(0);
  const [country,    setCountry]    = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);
  const [showCPwd,   setShowCPwd]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '',
    email: '', password: '', confirmPassword: '',
  });

  // Animations
  const slideX  = useRef(new Animated.Value(0)).current;
  const fadeAnim= useRef(new Animated.Value(1)).current;
  const progAnim= useRef(new Animated.Value(0)).current;

  const step = STEPS[stepIndex];
  const progress = (stepIndex) / (STEPS.length - 1);

  useEffect(() => {
    Animated.timing(progAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [stepIndex]);

  // Animation de transition entre étapes
  const animateNext = (forward = true) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: forward ? -40 : 40, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(forward ? 40 : -40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
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
    const v = form;
    switch (step.id) {
      case 'name':
        if (!v.name.trim() || v.name.trim().length < 2)
          return 'Minimum 2 caractères requis';
        break;
      case 'phone':
        if (!v.phone.trim() || v.phone.trim().length < 7)
          return 'Numéro invalide (min 7 chiffres)';
        break;
      case 'email':
        if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
          return 'Adresse email invalide';
        break;
      case 'password':
        if (!v.password || v.password.length < 6)
          return 'Minimum 6 caractères';
        break;
      case 'confirmPassword':
        if (v.password !== v.confirmPassword)
          return 'Les mots de passe ne correspondent pas';
        break;
    }
    return null;
  };

  const goNext = () => {
    const err = validate();
    if (err) { setError(err); return; }

    // Auto-fill whatsapp si vide
    if (step.id === 'phone' && !form.whatsapp) {
      setForm(p => ({ ...p, whatsapp: p.phone }));
    }

    if (stepIndex < STEPS.length - 1) {
      animateNext(true);
      setStepIndex(i => i + 1);
      setError('');
    } else {
      handleSubmit();
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      animateNext(false);
      setStepIndex(i => i - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const fmtPhone    = `${country.dialCode} ${form.phone.trim()}`;
      const fmtWhatsapp = form.whatsapp.trim()
        ? `${country.dialCode} ${form.whatsapp.trim()}`
        : fmtPhone;

      const result = await sendOTP(fmtPhone);
      if (result.success) {
        navigation.navigate('VerifyOTP', {
          phone: fmtPhone,
          type: 'register',
          attemptsRemaining: result.data?.attemptsRemaining || 3,
          devCode: result.devOTP || result.data?.devOTP,
          formData: {
            name:     form.name.trim(),
            phone:    fmtPhone,
            whatsapp: fmtWhatsapp,
            email:    form.email.trim() || undefined,
            password: form.password,
          },
        });
      }
    } catch (e) {
      setError(e.message || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  // Forcer de la valeur selon l'étape courante
  const currentValue = () => {
    if (step.id === 'country') return country.name;
    return form[step.id] || '';
  };

  // Force du mot de passe
  const pwdStrength = () => {
    const p = form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6)            score++;
    if (p.length >= 10)           score++;
    if (/[A-Z]/.test(p))          score++;
    if (/[0-9]/.test(p))          score++;
    if (/[@$!%*?&]/.test(p))      score++;
    return score;
  };

  const strengthColor = () => {
    const s = pwdStrength();
    if (s <= 1) return P.error;
    if (s <= 3) return P.yellow;
    return P.green;
  };

  const strengthLabel = () => {
    const s = pwdStrength();
    if (s <= 1) return 'Faible';
    if (s <= 3) return 'Moyen';
    return 'Fort 💪';
  };

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#2d3748', '#374151']}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />

        {/* Top row */}
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

        {/* Barre de progression segmentée */}
        <View style={s.progSegs}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                s.progSeg,
                i < stepIndex  && s.progSegDone,
                i === stepIndex && s.progSegActive,
              ]}
            />
          ))}
        </View>

        {/* Compteur */}
        <Text style={s.stepCount}>{stepIndex + 1} / {STEPS.length}</Text>

        <LinearGradient
          colors={['transparent', P.terra, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── CONTENU SCROLLABLE (question + input) ──────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* Zone question */}
        <View style={s.questionZone}>
          <Animated.View style={[s.questionWrap, { opacity: fadeAnim, transform: [{ translateX: slideX }] }]}>
            <Text style={s.stepIcon}>{step.icon}</Text>
            <Text style={s.question}>{step.label}</Text>
            {step.hint ? <Text style={s.questionHint}>{step.hint}</Text> : null}
          </Animated.View>
        </View>

        {/* Zone input */}
        <View style={s.inputZone}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>

          {/* Sélecteur pays */}
          {step.id === 'country' && (
            <TouchableOpacity
              style={s.countryBtn}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.85}
            >
              <Text style={s.countryBtnFlag}>{country.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.countryBtnName}>{country.name}</Text>
                <Text style={s.countryBtnDial}>{country.dialCode}</Text>
              </View>
              <Text style={s.countryBtnArrow}>▾</Text>
            </TouchableOpacity>
          )}

          {/* Numéro de téléphone / whatsapp avec indicatif */}
          {(step.id === 'phone' || step.id === 'whatsapp') && (
            <View style={s.phoneWrap}>
              <View style={s.dialBadge}>
                <Text style={s.dialFlag}>{country.flag}</Text>
                <Text style={s.dialCode}>{country.dialCode}</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                placeholder={step.id === 'phone' ? '12 34 56 78' : 'Même numéro (optionnel)'}
                placeholderTextColor="rgba(107,114,128,0.6)"
                value={form[step.id]}
                onChangeText={v => set(step.id, v)}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* Champs texte normaux */}
          {step.id === 'name' && (
            <TextInput
              style={s.mainInput}
              placeholder="Ex: Amadou Diallo"
              placeholderTextColor="rgba(107,114,128,0.6)"
              value={form.name}
              onChangeText={v => set('name', v)}
              autoCapitalize="words"
            />
          )}

          {step.id === 'email' && (
            <TextInput
              style={s.mainInput}
              placeholder="exemple@email.com (optionnel)"
              placeholderTextColor="rgba(107,114,128,0.6)"
              value={form.email}
              onChangeText={v => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}

          {/* Mot de passe */}
          {step.id === 'password' && (
            <View>
              <View style={s.pwdWrap}>
                <TextInput
                  style={s.pwdInput}
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor="rgba(107,114,128,0.6)"
                  value={form.password}
                  onChangeText={v => set('password', v)}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPwd(p => !p)}>
                  <Text style={s.eyeBtnTxt}>{showPwd ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {/* Indicateur de force */}
              {form.password.length > 0 && (
                <View style={s.strengthWrap}>
                  <View style={s.strengthBar}>
                    {[1,2,3,4,5].map(i => (
                      <View
                        key={i}
                        style={[
                          s.strengthSeg,
                          i <= pwdStrength() && { backgroundColor: strengthColor() },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[s.strengthLabel, { color: strengthColor() }]}>
                    {strengthLabel()}
                  </Text>
                </View>
              )}
              {/* Critères */}
              {form.password.length > 0 && (
                <View style={s.criteriaWrap}>
                  {[
                    { ok: form.password.length >= 6,          txt: '6 caractères min' },
                    { ok: /[A-Z]/.test(form.password),        txt: 'Majuscule' },
                    { ok: /[0-9]/.test(form.password),        txt: 'Chiffre' },
                    { ok: /[@$!%*?&]/.test(form.password),    txt: 'Caractère spécial' },
                  ].map((c, i) => (
                    <View key={i} style={s.criteriaItem}>
                      <Text style={[s.criteriaDot, c.ok && { color: P.green }]}>
                        {c.ok ? '✓' : '○'}
                      </Text>
                      <Text style={[s.criteriaTxt, c.ok && s.criteriaTxtOk]}>{c.txt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Confirm password */}
          {step.id === 'confirmPassword' && (
            <View style={s.pwdWrap}>
              <TextInput
                style={s.pwdInput}
                placeholder="Retapez votre mot de passe"
                placeholderTextColor="rgba(107,114,128,0.6)"
                value={form.confirmPassword}
                onChangeText={v => set('confirmPassword', v)}
                secureTextEntry={!showCPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowCPwd(p => !p)}>
                <Text style={s.eyeBtnTxt}>{showCPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
              {/* Match indicator */}
              {form.confirmPassword.length > 0 && (
                <View style={[
                  s.matchBadge,
                  { backgroundColor: form.password === form.confirmPassword ? P.successSoft : P.errorSoft }
                ]}>
                  <Text style={{ fontSize: 13, fontWeight: '700',
                    color: form.password === form.confirmPassword ? P.greenDark : P.error }}>
                    {form.password === form.confirmPassword ? '✓ Identiques' : '✕ Différents'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Message d'erreur */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

        </Animated.View>
        </View>
      </ScrollView>

      {/* ── BOUTON SUIVANT ─────────────────────────────────────────────── */}
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
                  {isLast ? '✓ Créer mon compte' : 'Continuer →'}
                </Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* Lien connexion */}
        <View style={s.loginRow}>
          <Text style={s.loginRowTxt}>Déjà un compte ? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={s.loginRowLink}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MODAL PAYS ─────────────────────────────────────────────────── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={s.modalClose}>
                <Text style={s.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.countryRow, country.code === c.code && s.countryRowActive]}
                  onPress={() => { setCountry(c); setShowPicker(false); setError(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.countryRowFlag}>{c.flag}</Text>
                  <Text style={[s.countryRowName, country.code === c.code && { color: P.terra }]}>
                    {c.name}
                  </Text>
                  <Text style={s.countryRowDial}>{c.dialCode}</Text>
                  {country.code === c.code && <Text style={{ color: P.terra, fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.white },

  // Header ardoise
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 16, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  loginLink:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  loginLinkTxt: { fontSize: 12, fontWeight: '600', color: P.white },

  // Progression
  progSegs:     { flexDirection: 'row', gap: 4, marginBottom: 8 },
  progSeg:      { flex: 1, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  progSegDone:  { backgroundColor: P.terra },
  progSegActive:{ backgroundColor: P.amber },
  stepCount:    { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 2 },
  headerGlow:   { height: 1.5, marginTop: 8 },

  // Zone question
  scrollContent: { paddingBottom: 24 },
  questionZone: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  questionWrap: { alignItems: 'flex-start' },
  stepIcon:     { fontSize: 40, marginBottom: 14 },
  question:     { fontSize: 26, fontWeight: '900', color: P.charcoal, letterSpacing: -0.6, lineHeight: 34, marginBottom: 8 },
  questionHint: { fontSize: 14, color: P.muted, lineHeight: 20 },

  // Zone input
  inputZone: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },

  // Input principal
  mainInput: {
    fontSize: 20, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 12, paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },

  // Phone input
  phoneWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dialBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: P.dim },
  dialFlag:  { fontSize: 18 },
  dialCode:  { fontSize: 14, fontWeight: '700', color: P.charcoal },
  phoneInput:{ flex: 1, fontSize: 20, fontWeight: '600', color: P.charcoal, borderBottomWidth: 2.5, borderBottomColor: P.terra, paddingVertical: 12 },

  // Country selector
  countryBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderRadius: 16, borderWidth: 1.5, borderColor: P.dim, padding: 16, gap: 12 },
  countryBtnFlag:  { fontSize: 32 },
  countryBtnName:  { fontSize: 17, fontWeight: '700', color: P.charcoal },
  countryBtnDial:  { fontSize: 13, color: P.muted, marginTop: 2 },
  countryBtnArrow: { fontSize: 18, color: P.muted },

  // Password
  pwdWrap:   { position: 'relative' },
  pwdInput:  { fontSize: 20, fontWeight: '600', color: P.charcoal, borderBottomWidth: 2.5, borderBottomColor: P.terra, paddingVertical: 12, paddingRight: 44 },
  eyeBtn:    { position: 'absolute', right: 0, top: 8, padding: 8 },
  eyeBtnTxt: { fontSize: 18 },
  matchBadge:{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },

  // Force mot de passe
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  strengthBar:  { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSeg:  { flex: 1, height: 4, borderRadius: 2, backgroundColor: P.dim },
  strengthLabel:{ fontSize: 12, fontWeight: '700', minWidth: 50 },

  // Critères
  criteriaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  criteriaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  criteriaDot:  { fontSize: 12, color: P.muted, fontWeight: '700' },
  criteriaTxt:  { fontSize: 11, color: P.muted, fontWeight: '500' },
  criteriaTxtOk:{ color: P.greenDark, fontWeight: '700' },

  // Erreur
  errorWrap: { marginTop: 12, backgroundColor: P.errorSoft, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: P.errorBorder },
  errorTxt:  { fontSize: 13, color: P.error, fontWeight: '600' },

  // Footer
  footer:      { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  nextBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnTxt:  { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  loginRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  loginRowTxt: { fontSize: 14, color: P.muted },
  loginRowLink:{ fontSize: 14, color: P.terra, fontWeight: '700' },

  // Modal pays
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: P.charcoal },
  modalClose:   { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt:{ fontSize: 13, color: P.muted, fontWeight: '700' },
  countryRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: P.dim + '80' },
  countryRowActive: { backgroundColor: P.peachSoft },
  countryRowFlag:   { fontSize: 26 },
  countryRowName:   { flex: 1, fontSize: 15, fontWeight: '600', color: P.charcoal },
  countryRowDial:   { fontSize: 13, color: P.muted, marginRight: 8 },
});