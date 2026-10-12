// Blocs squelette pulsés pendant le chargement (une seule boucle partagée)
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

const PulseContext = createContext(null);

export function SkeletonGroup({ children }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

export function Bone({ width, height, radius = 12, style }) {
  const pulse = useContext(PulseContext);
  const { isDark } = useAppTheme();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.07)' },
        pulse && { opacity: pulse },
        style,
      ]}
    />
  );
}

// Squelette complet de l'accueil (sous l'en-tête)
export function HomeSkeleton({ width }) {
  const cardW = (width - 16 * 2 - 12) / 2;
  return (
    <SkeletonGroup>
      <View style={s.pad}>
        <Bone width={width - 32} height={196} radius={24} />
        <View style={s.row}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={s.cat}>
              <Bone width={58} height={58} radius={20} />
              <Bone width={48} height={10} radius={5} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <Bone width={150} height={20} radius={6} style={{ marginTop: 28 }} />
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          {[0, 1].map((i) => (
            <View key={i}>
              <Bone width={cardW} height={cardW * 1.05} radius={18} />
              <Bone width={cardW * 0.6} height={14} radius={6} style={{ marginTop: 10 }} />
              <Bone width={cardW * 0.85} height={12} radius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: 'row', marginTop: 22, gap: 12 },
  cat: { alignItems: 'center', width: 62 },
});
