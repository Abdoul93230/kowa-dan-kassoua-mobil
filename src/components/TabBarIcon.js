// ─── TabBarIcon — MarketHub Niger ─────────────────────────────────────────────
// Version premium modérée — cohérente avec l'app

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MOBILE_COLORS as P } from '../theme/colors';

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const ICONS = {
  home:      { active: '⌂', inactive: '⌂' },
  favorites: { active: '♥', inactive: '♡' },
  publish:   { active: '+', inactive: '+' },
  messages:  { active: '✉', inactive: '✉' },
  profile:   { active: '◉', inactive: '○' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE ANIMÉ
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedBadge({ count }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: count > 0 ? 1 : 0,
      tension: 180,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [count]);

  if (!count || count <= 0) return null;

  return (
    <Animated.View style={[s.badge, { transform: [{ scale }] }]}>
      <Text style={s.badgeTxt}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON PUBLIER — modéré mais impactant
// ─────────────────────────────────────────────────────────────────────────────
function PublishButton({ focused }) {
  const scale  = useRef(new Animated.Value(0.85)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow   = useRef(new Animated.Value(0.4)).current;

  // Animation d'entrée au montage
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  // Rotation du + et intensité du glow selon focus
  useEffect(() => {
    Animated.parallel([
      Animated.spring(rotate, {
        toValue: focused ? 1 : 0,
        tension: 140,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: focused ? 1 : 0.4,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const spin = rotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={s.publishWrap}>
      {/* Halo orange — toujours présent, plus fort si focused */}
      <Animated.View style={[s.publishHalo, { opacity: glow }]} />

      {/* Bouton principal */}
      <Animated.View style={[s.publishOuter, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={focused
            ? [P.amber, P.terra, P.terraDark]
            : [P.orange500, P.orange700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.publishGrad}
        >
          {/* Reflet subtil en haut */}
          <View style={s.publishShine} />
          <Animated.Text style={[s.publishIcon, { transform: [{ rotate: spin }] }]}>
            +
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      {/* Label */}
      <Text style={[s.publishLabel, focused && s.publishLabelActive]}>
        Publier
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ICÔNE STANDARD
// ─────────────────────────────────────────────────────────────────────────────
function StandardIcon({ name, focused, badge }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const pillAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.1 : 1,
        tension: 180,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(pillAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: focused ? 1 : 0,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const icon = ICONS[name] || ICONS.profile;

  return (
    <View style={s.iconWrap}>
      {/* Pill active */}
      <Animated.View style={[s.iconPill, { opacity: pillAnim }]}>
        <LinearGradient
          colors={['rgba(236,90,19,0.18)', 'rgba(255,168,123,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Icône */}
      <Animated.Text
        style={[
          s.icon,
          {
            color: focused ? P.amber : 'rgba(255,255,255,0.4)',
            transform: [{ scale }],
            fontSize: focused ? 22 : 20,
          },
        ]}
      >
        {focused ? icon.active : icon.inactive}
      </Animated.Text>

      {/* Point indicateur */}
      <Animated.View style={[s.dot, { transform: [{ scale: dotScale }] }]} />

      {/* Badge */}
      <AnimatedBadge count={badge} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabBarIcon({ name, focused, color, badge }) {
  if (name === 'publish') return <PublishButton focused={focused} />;
  return <StandardIcon name={name} focused={focused} color={color} badge={badge} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  // ── Icône standard ──────────────────────────────────────────────────────────
  iconWrap: {
    width: 50,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconPill: {
    position: 'absolute',
    width: 44,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(236,90,19,0.22)',
  },
  icon: {
    fontWeight: '400',
    lineHeight: 26,
    marginBottom: 2,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.amber,
    shadowColor: P.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },

  // ── Badge ────────────────────────────────────────────────────────────────────
  badge: {
    position: 'absolute',
    top: 1,
    right: 2,
    backgroundColor: P.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#111827',
    shadowColor: P.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeTxt: {
    color: P.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  // ── Bouton Publier ──────────────────────────────────────────────────────────
  publishWrap: {
    alignItems: 'center',
    position: 'absolute',
    top: -26,
    width: 70,
  },
  publishHalo: {
    position: 'absolute',
    top: -6,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: P.terra,
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 0,
  },
  publishOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2.5,
    borderColor: '#111827',
  },
  publishGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  publishShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  publishIcon: {
    fontSize: 30,
    fontWeight: '300',
    color: P.white,
    lineHeight: 34,
    marginTop: 2,
  },
  publishLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.38)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  publishLabelActive: {
    color: P.amber,
    fontWeight: '700',
  },
});