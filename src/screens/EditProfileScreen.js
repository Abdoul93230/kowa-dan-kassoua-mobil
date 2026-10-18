// ─── Modifier le profil ──────────────────────────────────────────────────────
// Page dédiée (plutôt qu'un panneau du bas) : comme Sécurité et connexion,
// défilement natif vers le champ actif, barre ‹ › OK au-dessus du clavier,
// touche Entrée = champ suivant. Le bouton Enregistrer reste en bas.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { updateProfile } from '../api/auth';
import { compressToBase64 } from '../api/products';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import CustomBottomSheet from '../components/CustomBottomSheet';
import { KeyboardAwareView, KeyboardAwareScrollView, FormKeyboardToolbar } from '../components/Keyboard';
import { getInitials, sizedImage } from '../utils/format';

const NIGER_CITIES = [
  'Niamey', 'Zinder', 'Maradi', 'Agadez', 'Tahoua',
  'Dosso', 'Diffa', 'Tillabéri', 'Birni-N\'Konni', 'Arlit',
  'Gaya', 'Tessaoua',
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

const BIO_MAX = 1000;
const tap = () => Haptics.selectionAsync().catch(() => {});

const splitWhatsapp = (raw) => {
  if (!raw) return { country: COUNTRIES[0], number: '' };
  const m = COUNTRIES.find((c) => raw.startsWith(c.dialCode));
  return m ? { country: m, number: raw.replace(m.dialCode, '').trim() } : { country: COUNTRIES[0], number: raw };
};

// ─── Champ ───────────────────────────────────────────────────────────────────
// Au focus, seules la bordure et le fond changent (une ombre ajoutée au focus
// recrée la vue native sur Android et fait perdre le focus au champ).
function Field({ s, theme, icon, label, counter, multiline, inputRef, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View collapsable={false} style={[s.box, multiline && s.boxMulti, focused && s.boxFocus]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? P.terra : theme.iconMuted} style={multiline ? { marginTop: 2 } : null} /> : null}
        <TextInput
          ref={inputRef}
          {...inputProps}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholderTextColor={theme.textSoft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[s.input, multiline && s.inputMulti]}
        />
      </View>
      {counter ? <Text style={s.counter}>{counter}</Text> : null}
    </View>
  );
}

function SectionTitle({ s, icon, title }) {
  return (
    <View style={s.sectionTitle}>
      <Ionicons name={icon} size={15} color={P.terra} />
      <Text style={s.sectionTitleTxt}>{title}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const s = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const { user, updateUserProfile } = useAuth();

  const initialWa = useMemo(() => splitWhatsapp(user?.contactInfo?.whatsapp || ''), [user]);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [city, setCity] = useState(user?.city || user?.location || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [whatsapp, setWhatsapp] = useState(initialWa.number);
  const [country, setCountry] = useState(initialWa.country);
  const [businessType, setBusinessType] = useState(user?.businessType || 'individual');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [description, setDescription] = useState(user?.description || '');

  const [citySheet, setCitySheet] = useState(false);
  const [countrySheet, setCountrySheet] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '', buttons: [] });

  const emailRef = useRef(null);
  const waRef = useRef(null);
  const bizRef = useRef(null);
  const bioRef = useRef(null);

  const showAlert = (type, title, message, buttons) =>
    setAlert({ visible: true, type, title, message, buttons: buttons || [{ text: 'OK', onPress: () => {} }] });

  const isDirty = Boolean(user) && (
    name.trim() !== (user.name || '') ||
    email.trim() !== (user.email || '') ||
    city.trim() !== (user.city || user.location || '') ||
    avatar !== (user.avatar || null) ||
    whatsapp.trim() !== initialWa.number ||
    (whatsapp.trim() && country.code !== initialWa.country.code) ||
    businessType !== (user.businessType || 'individual') ||
    businessName.trim() !== (user.businessName || '') ||
    description.trim() !== (user.description || '')
  );

  const pickImage = useCallback(async (source) => {
    tap();
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        showAlert('error', 'Permission refusée', source === 'camera'
          ? 'Autorisez l\'accès à l\'appareil photo dans les réglages.'
          : 'Autorisez l\'accès à vos photos dans les réglages.');
        return;
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets?.[0]) return;
      setPicking(true);
      // 512 px suffisent pour une photo de profil
      try { setAvatar(await compressToBase64(res.assets[0].uri, 512)); }
      catch { setAvatar(res.assets[0].uri); }
      finally { setPicking(false); }
    } catch {
      showAlert('error', 'Erreur', 'Impossible de récupérer la photo');
    }
  }, []);

  const save = async () => {
    if (!name.trim()) { showAlert('error', 'Nom requis', 'Indiquez votre nom complet.'); return; }
    if (businessType === 'professional' && !businessName.trim()) {
      showAlert('error', 'Nom de l\'entreprise', 'Indiquez le nom de votre boutique ou entreprise.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({
        name: name.trim(),
        city: city.trim(),
        email: email.trim() || undefined,
        description: description.trim(),
        businessType,
        whatsapp: whatsapp.trim() ? `${country.dialCode} ${whatsapp.trim()}` : undefined,
        // La photo n'est renvoyée que si elle a changé (évite de ré-uploader l'actuelle)
        ...(avatar && avatar !== user?.avatar ? { avatar } : {}),
        ...(businessType === 'professional' ? { businessName: businessName.trim() } : {}),
      });
      if (res.success) {
        await updateUserProfile(res?.data?.user || {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.goBack();
      }
    } catch (e) {
      showAlert('error', 'Erreur', e.message || 'Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = avatar ? (avatar === user?.avatar ? sizedImage(avatar, 200) : avatar) : null;

  return (
    <KeyboardAwareView style={[s.screen]}>
      {/* En-tête */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <Text style={s.headerTitle}>Modifier le profil</Text>
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <View style={s.photoRow}>
          <View style={s.avatarRing}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} contentFit="cover" />
            ) : (
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.avatar}>
                <Text style={s.avatarTxt}>{getInitials(name || 'U')}</Text>
              </LinearGradient>
            )}
            {picking ? <View style={s.avatarBusy}><ActivityIndicator color="#fff" /></View> : null}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.photoTitle}>Photo de profil</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => pickImage('library')} disabled={picking || saving} style={s.miniBtn}>
                <Ionicons name="images-outline" size={15} color={P.terra} />
                <Text style={s.miniBtnTxt}>Galerie</Text>
              </Pressable>
              <Pressable onPress={() => pickImage('camera')} disabled={picking || saving} style={s.miniBtn}>
                <Ionicons name="camera-outline" size={15} color={P.terra} />
                <Text style={s.miniBtnTxt}>Caméra</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <SectionTitle s={s} icon="finger-print-outline" title="Identité" />
        <Field s={s} theme={theme} icon="person-outline" label="Nom complet" placeholder="Votre nom"
          value={name} onChangeText={setName} autoCapitalize="words" textContentType="name"
          returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} blurOnSubmit={false} editable={!saving} />
        <Field s={s} theme={theme} inputRef={emailRef} icon="mail-outline" label="Adresse e-mail" placeholder="votre@email.com"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
          textContentType="emailAddress" autoComplete="email"
          returnKeyType="next" onSubmitEditing={() => waRef.current?.focus()} blurOnSubmit={false} editable={!saving} />
        <View style={s.field}>
          <Text style={s.label}>Ville</Text>
          <Pressable style={s.box} onPress={() => setCitySheet(true)} disabled={saving}>
            <Ionicons name="location-outline" size={18} color={theme.iconMuted} />
            <Text style={[s.selectVal, !city && { color: theme.textSoft, fontWeight: '500' }]}>{city || 'Sélectionner une ville'}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.iconMuted} />
          </Pressable>
        </View>

        <SectionTitle s={s} icon="call-outline" title="Contact" />
        <Text style={s.label}>Numéro WhatsApp</Text>
        <View style={s.phoneRow}>
          <Pressable style={[s.box, s.dial]} onPress={() => setCountrySheet(true)} disabled={saving}>
            <Text style={{ fontSize: 18 }}>{country.flag}</Text>
            <Text style={s.dialCode}>{country.dialCode}</Text>
            <Ionicons name="chevron-down" size={14} color={theme.iconMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field s={s} theme={theme} inputRef={waRef} icon="logo-whatsapp" placeholder="12 34 56 78"
              value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad"
              textContentType="telephoneNumber" autoComplete="tel" editable={!saving} />
          </View>
        </View>

        <SectionTitle s={s} icon="storefront-outline" title="Activité" />
        <View style={s.typeRow}>
          {[
            { value: 'individual', icon: 'person-outline', label: 'Particulier', sub: 'Je vends ponctuellement' },
            { value: 'professional', icon: 'briefcase-outline', label: 'Professionnel', sub: 'Boutique ou entreprise' },
          ].map((t) => {
            const active = businessType === t.value;
            return (
              <Pressable key={t.value} style={[s.typeCard, active && s.typeCardActive]} onPress={() => { tap(); setBusinessType(t.value); }} disabled={saving}>
                <View style={[s.typeIcon, active && { backgroundColor: P.terra }]}>
                  <Ionicons name={t.icon} size={18} color={active ? '#fff' : theme.textMuted} />
                </View>
                <Text style={[s.typeLabel, active && { color: P.terra }]}>{t.label}</Text>
                <Text style={s.typeSub}>{t.sub}</Text>
                {active ? <Ionicons name="checkmark-circle" size={18} color={P.terra} style={s.typeCheck} /> : null}
              </Pressable>
            );
          })}
        </View>

        {businessType === 'professional' ? (
          <Field s={s} theme={theme} inputRef={bizRef} icon="business-outline" label="Nom de l'entreprise" placeholder="Nom de votre boutique / entreprise"
            value={businessName} onChangeText={setBusinessName}
            returnKeyType="next" onSubmitEditing={() => bioRef.current?.focus()} blurOnSubmit={false} editable={!saving} />
        ) : null}

        <Field s={s} theme={theme} inputRef={bioRef} icon="document-text-outline" label="Bio"
          placeholder="Présentez-vous en quelques mots : ce que vous vendez, vos horaires…"
          value={description} onChangeText={setDescription} multiline maxLength={BIO_MAX} editable={!saving}
          counter={`${description.length}/${BIO_MAX}`} />
      </KeyboardAwareScrollView>

      {/* Bouton : reste en bas (derrière le clavier pendant la saisie) */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <Pressable onPress={save} disabled={!isDirty || saving} style={[s.saveBtn, (!isDirty || saving) && { opacity: 0.5 }]}>
          <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveGrad}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={isDirty ? 'checkmark-done' : 'checkmark'} size={20} color="#fff" />
                <Text style={s.saveTxt}>{isDirty ? 'Enregistrer les modifications' : 'Aucune modification'}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* Sélecteurs (sans champ de saisie : aucun souci de clavier) */}
      <CustomBottomSheet visible={citySheet} onClose={() => setCitySheet(false)} title="Choisir une ville">
        {NIGER_CITIES.map((c) => {
          const active = city === c;
          return (
            <Pressable key={c} style={[s.listRow, active && s.listRowActive]} onPress={() => { setCity(c); setCitySheet(false); }}>
              <Ionicons name="location-outline" size={18} color={active ? P.terra : theme.iconMuted} />
              <Text style={[s.listRowTxt, active && { color: P.terra, fontWeight: '800' }]}>{c}, Niger</Text>
              {active ? <Ionicons name="checkmark" size={18} color={P.terra} /> : null}
            </Pressable>
          );
        })}
      </CustomBottomSheet>

      <CustomBottomSheet visible={countrySheet} onClose={() => setCountrySheet(false)} title="Indicatif du pays">
        {COUNTRIES.map((c) => {
          const active = country.code === c.code;
          return (
            <Pressable key={c.code} style={[s.listRow, active && s.listRowActive]} onPress={() => { setCountry(c); setCountrySheet(false); }}>
              <Text style={{ fontSize: 22 }}>{c.flag}</Text>
              <Text style={[s.listRowTxt, active && { color: P.terra, fontWeight: '800' }]}>{c.name}</Text>
              <Text style={s.listRowDial}>{c.dialCode}</Text>
              {active ? <Ionicons name="checkmark" size={18} color={P.terra} /> : null}
            </Pressable>
          );
        })}
      </CustomBottomSheet>

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

const makeStyles = (theme, isDark) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.screen },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: isDark ? theme.screen : theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3, color: theme.text },
  content: { padding: 20, paddingBottom: 32 },

  photoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20,
    backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1, borderColor: theme.border,
  },
  avatarRing: { width: 80, height: 80, borderRadius: 40, padding: 3, backgroundColor: P.terra },
  avatar: { width: '100%', height: '100%', borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt },
  avatarTxt: { color: '#fff', fontSize: 24, fontWeight: '800' },
  avatarBusy: { ...StyleSheet.absoluteFillObject, margin: 3, borderRadius: 37, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  miniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50, borderWidth: 1, borderColor: isDark ? 'rgba(255,168,123,0.3)' : P.orange200,
  },
  miniBtnTxt: { fontSize: 12.5, fontWeight: '800', color: P.terra },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 24, marginBottom: 12 },
  sectionTitleTxt: { fontSize: 12, fontWeight: '800', color: theme.text, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 4 },

  field: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '700', color: theme.textMuted, marginBottom: 7, marginLeft: 2 },
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 54, borderRadius: 16,
    backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1.5, borderColor: theme.border,
  },
  boxMulti: { alignItems: 'flex-start', paddingTop: 14 },
  boxFocus: { borderColor: P.terra, backgroundColor: isDark ? 'rgba(236,90,19,0.07)' : '#fffaf7' },
  input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 14 },
  inputMulti: { minHeight: 110, paddingTop: 0 },
  counter: { alignSelf: 'flex-end', fontSize: 11.5, color: theme.textSoft, marginTop: 5 },
  selectVal: { flex: 1, fontSize: 16, color: theme.text, fontWeight: '600' },

  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dial: { gap: 6, paddingHorizontal: 12 },
  dialCode: { fontSize: 15, fontWeight: '700', color: theme.text },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeCard: {
    flex: 1, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: isDark ? theme.surface : '#ffffff',
  },
  typeCardActive: { borderColor: P.terra, backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : P.orange50 },
  typeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt, marginBottom: 10 },
  typeLabel: { fontSize: 14, fontWeight: '800', color: theme.text },
  typeSub: { fontSize: 11.5, color: theme.textSoft, marginTop: 2 },
  typeCheck: { position: 'absolute', top: 10, right: 10 },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    backgroundColor: isDark ? theme.screen : theme.surface,
  },
  saveBtn: { borderRadius: 18, overflow: 'hidden' },
  saveGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, gap: 12, borderRadius: 10 },
  listRowActive: { backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.orange50 },
  listRowTxt: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
  listRowDial: { fontSize: 13, color: theme.textMuted },
});
