// Bandeau d'appel à la publication
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { MOBILE_COLORS as P } from '../../theme/colors';
import { formatCompact } from '../../utils/format';

export default function PublishBanner({ onPress, totalUsers }) {
  const float = useRef(new Animated.Value(0)).current;

  // Léger flottement de l'icône (boucle native, ne bloque pas le thread JS)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -5, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={s.wrap} accessibilityLabel="Publier une annonce">
      <LinearGradient colors={[P.charcoal, '#1f2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View style={s.glowA} />
        <View style={s.glowB} />

        <View style={{ flex: 1 }}>
          <View style={s.eyebrow}>
            <Feather name="gift" size={11} color={P.amber} />
            <Text style={s.eyebrowTxt}>100 % gratuit · sans commission</Text>
          </View>
          <Text style={s.title}>Vous avez quelque{'\n'}chose à vendre ?</Text>
          <Text style={s.sub}>
            {totalUsers > 0 ? `${formatCompact(totalUsers)} membres vous attendent.` : 'Touchez des acheteurs près de chez vous.'}
          </Text>
          <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
            <Feather name="plus" size={16} color={P.white} />
            <Text style={s.btnTxt}>Publier une annonce</Text>
          </LinearGradient>
        </View>

        <Animated.View style={[s.iconBubble, { transform: [{ translateY: float }] }]}>
          <LinearGradient colors={[P.amber, P.terra]} style={s.iconGrad}>
            <Feather name="camera" size={30} color={P.white} />
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  card: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  glowA: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(236,90,19,0.28)' },
  glowB: { position: 'absolute', left: -40, bottom: -70, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,168,123,0.10)' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,168,123,0.14)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  eyebrowTxt: { color: P.amber, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  title: { color: P.white, fontSize: 21, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26, marginTop: 10 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, marginTop: 14 },
  btnTxt: { color: P.white, fontSize: 13.5, fontWeight: '800' },
  iconBubble: { marginLeft: 8 },
  iconGrad: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
});
