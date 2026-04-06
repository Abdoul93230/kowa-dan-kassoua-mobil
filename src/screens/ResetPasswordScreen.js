// ─── ResetPasswordScreen v2 PREMIUM ─ MarketHub Niger ────────────────────────
// Design 100% cohérent avec RegisterScreen, LoginScreen & ForgotPasswordScreen
// Zéro valeur hex brute — uniquement les tokens MOBILE_COLORS

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { resetPassword } from '../api/auth';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';

// ─────────────────────────────────────────────────────────────────────────────
export default function ResetPasswordScreen({ navigation, route }) {
  const { identifier, code } = route.params || {};
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();

  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showNewPwd,       setShowNewPwd]       = useState(false);
  const [showConfirmPwd,   setShowConfirmPwd]   = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    // Vérification des params requis
    if (!identifier || !code) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Informations manquantes. Veuillez recommencer.',
        buttons: [{ text: 'OK', onPress: () => navigation.replace('ForgotPassword') }],
      });
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Force du mot de passe (même logique que Register) ────────────────────
  const pwdStrength = () => {
    const p = newPassword;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6)         score++;
    if (p.length >= 10)        score++;
    if (/[A-Z]/.test(p))       score++;
    if (/[0-9]/.test(p))       score++;
    if (/[@$!%*?&]/.test(p))   score++;
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

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!newPassword)
      return 'Le mot de passe est requis';
    if (newPassword.length < 6)
      return 'Minimum 6 caractères requis';
    if (newPassword !== confirmPassword)
      return 'Les mots de passe ne correspondent pas';
    return null;
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleReset = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const result = await resetPassword(identifier, code, newPassword);
      if (result.success) {
        setAlert({
          visible: true,
          type: 'success',
          title: 'Mot de passe réinitialisé',
          message: 'Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.',
          buttons: [{ text: 'Se connecter', onPress: () => navigation.replace('Login') }],
        });
      }
    } catch (e) {
      setError(e.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  if (!identifier || !code) return null;

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ── identique Login/Register ───────────────── */}
      <LinearGradient
        colors={theme.header}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />

        <View style={s.headerRow}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.glass }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[s.backBtnTxt, { color: theme.text }]}>←</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoMini}>
              <Text style={s.logoMiniTxt}>M</Text>
            </LinearGradient>
            <Text style={[s.headerBrand, { color: theme.text }]}>MarketHub</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>

        <LinearGradient
          colors={[theme.divider, P.terra, theme.divider]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── CONTENU ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Hero ── */}
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.heroIconGrad}>
                <Text style={s.heroIconTxt}>🛡️</Text>
              </LinearGradient>
              <View style={s.heroRing} />
            </View>
            <Text style={[s.heroTitle, { color: theme.text }]}>Nouveau mot de passe</Text>
            <Text style={[s.heroSub, { color: theme.textMuted }]}>Choisissez un mot de passe sécurisé</Text>
          </View>

          {/* ── Nouveau mot de passe ── */}
          <View style={s.fieldZone}>
            <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Nouveau mot de passe</Text>
            <View style={s.pwdWrap}>
              <TextInput
                style={[s.pwdInput, { color: theme.text }]}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={theme.inputPlaceholder}
                value={newPassword}
                onChangeText={v => { setNewPassword(v); setError(''); }}
                secureTextEntry={!showNewPwd}
                autoCapitalize="none"
                autoFocus
                editable={!loading}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNewPwd(p => !p)}>
                <Text style={s.eyeBtnTxt}>{showNewPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Indicateur de force — identique Register */}
            {newPassword.length > 0 && (
              <View style={s.strengthWrap}>
                <View style={s.strengthBar}>
                  {[1, 2, 3, 4, 5].map(i => (
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

            {/* Critères — identique Register */}
            {newPassword.length > 0 && (
              <View style={s.criteriaWrap}>
                {[
                  { ok: newPassword.length >= 6,        txt: '6 caractères min' },
                  { ok: /[A-Z]/.test(newPassword),      txt: 'Majuscule' },
                  { ok: /[0-9]/.test(newPassword),      txt: 'Chiffre' },
                  { ok: /[@$!%*?&]/.test(newPassword),  txt: 'Caractère spécial' },
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

          {/* ── Confirmation mot de passe ── */}
          <View style={s.fieldZone}>
            <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Confirmer le mot de passe</Text>
            <View style={s.pwdWrap}>
              <TextInput
                style={[s.pwdInput, { color: theme.text }]}
                placeholder="Retapez votre mot de passe"
                placeholderTextColor={theme.inputPlaceholder}
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setError(''); }}
                secureTextEntry={!showConfirmPwd}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirmPwd(p => !p)}>
                <Text style={s.eyeBtnTxt}>{showConfirmPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Badge match — identique Register */}
            {confirmPassword.length > 0 && (
              <View style={[
                s.matchBadge,
                { backgroundColor: newPassword === confirmPassword ? P.successSoft : P.errorSoft },
              ]}>
                <Text style={{
                  fontSize: 13, fontWeight: '700',
                  color: newPassword === confirmPassword ? P.greenDark : P.error,
                }}>
                  {newPassword === confirmPassword ? '✓ Identiques' : '✕ Différents'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Erreur ── */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* ── Lien connexion ── */}
          <View style={s.loginRow}>
            <Text style={[s.loginRowTxt, { color: theme.textMuted }]}>Vous vous souvenez ? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')} activeOpacity={0.7}>
              <Text style={s.loginRowLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER bouton ── identique tous les écrans ───────────────── */}
      <View style={[s.footer, { backgroundColor: theme.screen, borderTopColor: theme.divider, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.88}
          style={s.resetBtn}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.resetBtnGrad}
          >
            {loading
              ? <ActivityIndicator color={P.white} />
              : <Text style={s.resetBtnTxt}>✓ Réinitialiser le mot de passe</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

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

// ─── STYLES ── 100% tokens P.* de MOBILE_COLORS ──────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.white },

  // ── Header ardoise ──
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 16, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  headerGlow:   { height: 1.5 },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },

  // ── Hero ──
  hero:         { alignItems: 'center', marginBottom: 32 },
  heroIconWrap: { position: 'relative', marginBottom: 18 },
  heroIconGrad: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: P.terra, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 10,
  },
  heroIconTxt:  { fontSize: 36 },
  heroRing:     {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 32, borderWidth: 1.5, borderColor: P.orange300,
  },
  heroTitle:    { fontSize: 26, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  heroSub:      { fontSize: 14, color: P.muted, textAlign: 'center' },

  // ── Champs underline ──
  fieldZone:  { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: P.muted,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── Password ── identique Register ──
  pwdWrap:   { position: 'relative' },
  pwdInput:  {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, paddingRight: 44,
  },
  eyeBtn:    { position: 'absolute', right: 0, top: 6, padding: 8 },
  eyeBtnTxt: { fontSize: 18 },

  // ── Force mot de passe ── identique Register ──
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  strengthBar:  { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSeg:  { flex: 1, height: 4, borderRadius: 2, backgroundColor: P.dim },
  strengthLabel:{ fontSize: 12, fontWeight: '700', minWidth: 50 },

  // ── Critères ── identique Register ──
  criteriaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  criteriaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  criteriaDot:  { fontSize: 12, color: P.muted, fontWeight: '700' },
  criteriaTxt:  { fontSize: 11, color: P.muted, fontWeight: '500' },
  criteriaTxtOk:{ color: P.greenDark, fontWeight: '700' },

  // ── Badge match ── identique Register ──
  matchBadge: { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },

  // ── Erreur ──
  errorWrap: {
    backgroundColor: P.errorSoft, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: P.errorBorder,
    marginBottom: 20,
  },
  errorTxt: { fontSize: 13, color: P.error, fontWeight: '600' },

  // ── Lien connexion ──
  loginRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  loginRowTxt:  { fontSize: 14, color: P.muted },
  loginRowLink: { fontSize: 14, color: P.terra, fontWeight: '700' },

  // ── Footer ──
  footer:       { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  resetBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  resetBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  resetBtnTxt:  { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});