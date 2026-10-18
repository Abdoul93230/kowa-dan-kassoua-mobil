// ─── Sécurité et connexion ───────────────────────────────────────────────────
// Page dédiée (plutôt qu'un panneau) pour changer le mot de passe :
// défilement natif vers le champ actif, barre ‹ › OK au-dessus du clavier,
// touche Entrée = champ suivant puis validation. Le bouton reste en bas.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { changePassword } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import PressableScale from '../components/home/PressableScale';
import { KeyboardAwareView, KeyboardAwareScrollView, FormKeyboardToolbar } from '../components/Keyboard';

const MIN_LENGTH = 6;

const strengthOf = (pwd) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= MIN_LENGTH) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return pwd.length < MIN_LENGTH ? 1 : Math.max(score, 1);
};
const STRENGTH = [
  null,
  { label: 'Faible', color: P.error },
  { label: 'Moyen', color: P.orange500 },
  { label: 'Fort', color: P.greenDark },
  { label: 'Très fort', color: '#0f9f6e' },
];

function PasswordField({ label, value, onChangeText, inputRef, returnKeyType, onSubmitEditing, textContentType, error, placeholder }) {
  const { theme, isDark } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? P.error : focused ? (isDark ? P.amber : P.terra) : theme.border;

  return (
    <View style={s.field}>
      <Text style={[s.label, { color: theme.textMuted }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: isDark ? theme.surface : P.white, borderColor }]}>
        <Feather name="lock" size={17} color={focused ? (isDark ? P.amber : P.terra) : theme.textSoft} />
        <TextInput
          ref={inputRef}
          style={[s.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSoft}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
          autoComplete={textContentType === 'newPassword' ? 'new-password' : 'password'}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={theme.textSoft} />
        </Pressable>
      </View>
      {error ? (
        <View style={s.errorRow}>
          <Feather name="alert-circle" size={13} color={P.error} />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SecurityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const { user, updateUserProfile } = useAuth();
  const mustChange = Boolean(user?.needsPasswordChange);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '', buttons: [] });

  const newRef = useRef(null);
  const confirmRef = useRef(null);

  const strength = STRENGTH[strengthOf(newPwd)];
  const accent = isDark ? P.amber : P.terra;
  const canSubmit = newPwd.length > 0 && confirmPwd.length > 0 && (mustChange || currentPwd.length > 0) && !saving;

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = async () => {
    const next = {};
    if (!mustChange && !currentPwd) next.current = 'Entrez votre mot de passe actuel';
    if (newPwd.length < MIN_LENGTH) next.new = `Au moins ${MIN_LENGTH} caractères`;
    else if (!mustChange && newPwd === currentPwd) next.new = 'Le nouveau mot de passe doit être différent';
    if (newPwd && confirmPwd !== newPwd) next.confirm = 'Les mots de passe ne correspondent pas';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const res = await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      if (!res?.success) throw new Error(res?.message);
      await updateUserProfile({ needsPasswordChange: false });
      setAlert({
        visible: true,
        type: 'success',
        title: 'Mot de passe mis à jour',
        message: 'Votre nouveau mot de passe est actif.',
        buttons: [{ text: 'OK', onPress: () => navigation.goBack() }],
      });
    } catch (e) {
      const message = e?.message || 'Impossible de changer le mot de passe';
      // Erreur liée au mot de passe actuel → affichée sous le champ concerné
      if (/actuel|incorrect/i.test(message)) setErrors({ current: message });
      else setAlert({ visible: true, type: 'error', title: 'Erreur', message, buttons: [{ text: 'OK', onPress: () => {} }] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareView style={[s.screen, { backgroundColor: theme.screen }]}>

      {/* En-tête */}
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border }]}>
        <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9} style={[s.backBtn, { backgroundColor: theme.glass }]} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color={theme.text} />
        </PressableScale>
        <Text style={[s.headerTitle, { color: theme.text }]}>Sécurité et connexion</Text>
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Présentation */}
        <View style={[s.intro, { backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : P.orange50, borderColor: isDark ? 'rgba(236,90,19,0.25)' : P.orange100 }]}>
          <View style={[s.introIcon, { backgroundColor: accent }]}>
            <Feather name="shield" size={20} color={P.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.introTitle, { color: theme.text }]}>
              {mustChange ? 'Choisissez votre mot de passe' : 'Changer le mot de passe'}
            </Text>
            <Text style={[s.introSub, { color: theme.textMuted }]}>
              {mustChange
                ? 'Votre compte utilise un mot de passe temporaire. Remplacez-le par un mot de passe personnel.'
                : 'Utilisez un mot de passe unique que vous n\'utilisez nulle part ailleurs.'}
            </Text>
          </View>
        </View>

        {!mustChange ? (
          <PasswordField
            label="Mot de passe actuel"
            value={currentPwd}
            onChangeText={(v) => { setCurrentPwd(v); clearError('current'); }}
            placeholder="Votre mot de passe actuel"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => newRef.current?.focus()}
            error={errors.current}
          />
        ) : null}

        <PasswordField
          label="Nouveau mot de passe"
          value={newPwd}
          onChangeText={(v) => { setNewPwd(v); clearError('new'); }}
          inputRef={newRef}
          placeholder={`Au moins ${MIN_LENGTH} caractères`}
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={errors.new}
        />

        {/* Force du mot de passe */}
        {newPwd.length > 0 && strength ? (
          <View style={s.strength}>
            <View style={s.strengthBars}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[s.strengthBar, { backgroundColor: strengthOf(newPwd) >= i ? strength.color : theme.border }]} />
              ))}
            </View>
            <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
          </View>
        ) : null}

        <PasswordField
          label="Confirmer le nouveau mot de passe"
          value={confirmPwd}
          onChangeText={(v) => { setConfirmPwd(v); clearError('confirm'); }}
          inputRef={confirmRef}
          placeholder="Retapez le nouveau mot de passe"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.confirm}
        />

        {confirmPwd.length > 0 && !errors.confirm ? (
          <View style={s.matchRow}>
            <Feather name={confirmPwd === newPwd ? 'check-circle' : 'x-circle'} size={14} color={confirmPwd === newPwd ? P.greenDark : P.error} />
            <Text style={[s.matchTxt, { color: confirmPwd === newPwd ? P.greenDark : P.error }]}>
              {confirmPwd === newPwd ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
            </Text>
          </View>
        ) : null}

        {/* Conseils */}
        <View style={[s.tips, { borderColor: theme.border }]}>
          {[
            ['check', 'Au moins 10 caractères pour plus de sécurité'],
            ['check', 'Mélangez majuscules, minuscules, chiffres et symboles'],
            ['check', 'Évitez votre nom ou votre numéro de téléphone'],
          ].map(([icon, txt]) => (
            <View key={txt} style={s.tipRow}>
              <Feather name={icon} size={13} color={theme.textSoft} />
              <Text style={[s.tipTxt, { color: theme.textSoft }]}>{txt}</Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>

      {/* Bouton : reste en bas (derrière le clavier pendant la saisie) */}
      <View style={[s.footer, { backgroundColor: isDark ? theme.screen : theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <PressableScale onPress={submit} disabled={!canSubmit} scaleTo={0.98} style={[s.submit, !canSubmit && { opacity: 0.5 }]}>
          <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGrad}>
            {saving ? <ActivityIndicator color={P.white} /> : <Text style={s.submitTxt}>Mettre à jour le mot de passe</Text>}
          </LinearGradient>
        </PressableScale>
      </View>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert((a) => ({ ...a, visible: false }))}
      />

      {/* Barre ‹ › OK collée au clavier */}
      <FormKeyboardToolbar />
    </KeyboardAwareView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  content: { padding: 20, paddingBottom: 32 },
  intro: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 24 },
  introIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 16, fontWeight: '800' },
  introSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  errorTxt: { color: P.error, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  strength: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, marginBottom: 18 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 6 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3 },
  strengthLabel: { fontSize: 12.5, fontWeight: '800', minWidth: 64, textAlign: 'right' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, marginBottom: 18 },
  matchTxt: { fontSize: 12.5, fontWeight: '600' },
  tips: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, marginTop: 4, gap: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipTxt: { fontSize: 12.5, flexShrink: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { borderRadius: 16, overflow: 'hidden' },
  submitGrad: { height: 54, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { color: P.white, fontSize: 15.5, fontWeight: '800' },
});
