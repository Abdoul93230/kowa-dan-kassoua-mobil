// En-tête flottant : transparent en haut de page, fond plein dès qu'on défile.
// Logo à gauche, bouton recherche à droite (ouvre la recherche plein écran).
import React from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';

export const HEADER_ROW_H = 56;
export const HEADER_BODY_H = HEADER_ROW_H + 4;

export default function HomeHeader({ scrollY, topInset, onPressSearch }) {
  const { theme, isDark } = useAppTheme();

  const bgOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[s.wrap, { paddingTop: topInset }]} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border, opacity: bgOpacity },
          s.bg,
          !isDark && s.bgShadow,
        ]}
      />

      <View style={s.row}>
        <View style={s.logoClip}>
          <Image source={require('../../../Branding/flogo-removebg-preview.png')} style={s.logo} />
        </View>

        <PressableScale
          onPress={onPressSearch}
          scaleTo={0.9}
          style={[s.searchBtn, { backgroundColor: isDark ? theme.surface : P.white, borderColor: isDark ? theme.border : 'rgba(17,24,39,0.08)' }, !isDark && s.btnShadow]}
          accessibilityLabel="Rechercher"
        >
          <Feather name="search" size={21} color={isDark ? P.amber : P.terra} />
        </PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingBottom: 4 },
  bg: { borderBottomWidth: StyleSheet.hairlineWidth },
  bgShadow: { shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  row: { height: HEADER_ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  // Le PNG du logo contient beaucoup de marge transparente : on le recadre
  logoClip: { width: 132, height: 40, overflow: 'hidden', justifyContent: 'center', marginLeft: -28 },
  logo: { width: 132, height: 40, resizeMode: 'contain', transform: [{ scale: 2 }] },
  searchBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnShadow: { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
