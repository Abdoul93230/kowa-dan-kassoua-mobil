// ─── Accueil des visiteurs non connectés ─────────────────────────────────────
// Remplace l'envoi direct vers le formulaire de connexion : on explique d'abord
// ce que la personne gagne à se connecter, puis on l'invite (sans la forcer).
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';

/**
 * @param icon      icône principale (Ionicons)
 * @param title     titre accueillant
 * @param text      phrase d'explication
 * @param benefits  [{ icon, label }] ce que la personne gagne à se connecter
 * @param onAuth    ouvre la connexion / l'inscription
 * @param onBrowse  (facultatif) continuer sans compte
 */
export default function GuestWelcome({ icon, title, text, benefits = [], onAuth, onBrowse, browseLabel = 'Continuer sans compte' }) {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme, isDark);
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 32, paddingBottom: Math.max(insets.bottom, 12) + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[s.halo, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}>
        <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconTile}>
          <Ionicons name={icon} size={38} color="#fff" />
        </LinearGradient>
      </Animated.View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.text}>{text}</Text>

      {benefits.length ? (
        <View style={s.benefits}>
          {benefits.map((b) => (
            <View key={b.label} style={s.benefit}>
              <View style={s.benefitIcon}><Ionicons name={b.icon} size={17} color={P.terra} /></View>
              <Text style={s.benefitTxt}>{b.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable onPress={onAuth} style={({ pressed }) => [s.primary, pressed && { opacity: 0.9 }]} accessibilityRole="button">
        <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryGrad}>
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={s.primaryTxt}>Créer un compte gratuit</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={onAuth} style={({ pressed }) => [s.secondary, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={s.secondaryTxt}>J'ai déjà un compte · <Text style={{ color: P.terra }}>Se connecter</Text></Text>
      </Pressable>
      <Text style={s.note}>Juste votre numéro de téléphone, en moins d'une minute.</Text>

      {onBrowse ? (
        <Pressable onPress={onBrowse} hitSlop={8} style={s.browse}>
          <Text style={s.browseTxt}>{browseLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (theme, isDark) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.screen },
  content: { alignItems: 'center', paddingHorizontal: 28 },
  halo: {
    width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : '#fff1e8',
  },
  iconTile: { width: 82, height: 82, borderRadius: 28, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  title: { fontSize: 24, fontWeight: '900', color: theme.text, textAlign: 'center', letterSpacing: -0.5 },
  text: { fontSize: 15, lineHeight: 22, color: theme.textMuted, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  benefits: {
    alignSelf: 'stretch', gap: 12, marginTop: 24, padding: 16, borderRadius: 20,
    backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1, borderColor: theme.border,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50,
  },
  benefitTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 19 },
  primary: { alignSelf: 'stretch', borderRadius: 18, overflow: 'hidden', marginTop: 26 },
  primaryGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignSelf: 'stretch', height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 18, borderWidth: 1.5, borderColor: theme.border },
  secondaryTxt: { fontSize: 14.5, fontWeight: '700', color: theme.text },
  note: { fontSize: 12.5, color: theme.textSoft, marginTop: 12, textAlign: 'center' },
  browse: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22 },
  browseTxt: { fontSize: 14, fontWeight: '700', color: theme.textMuted },
});
