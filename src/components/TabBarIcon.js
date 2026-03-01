// ─── TabBarIcon — MarketHub Niger ─────────────────────────────────────────────
// Barre de navigation époustouflante — palette terracotta/or/sable

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── PALETTE (en sync avec ProductsListScreen) ────────────────────────────────
const P = {
  terra:    '#C1440E',
  amber:    '#E8832A',
  gold:     '#F0A500',
  brown:    '#3D1C02',
  cream:    '#FDF6EC',
  sand:     '#F5E6C8',
  muted:    '#9C8872',
  charcoal: '#1A1210',
  white:    '#FFFFFF',
  error:    '#EF4444',
};

// ─── ICÔNES SVG-like via texte enrichi ───────────────────────────────────────
const ICONS = {
  home:      { active: '⌂',  inactive: '⌂'  },
  favorites: { active: '♥',  inactive: '♡'  },
  publish:   { active: '+',  inactive: '+'  },
  messages:  { active: '✉',  inactive: '✉'  },
  profile:   { active: '◉',  inactive: '○'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE ANIMÉ
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedBadge({ count }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scale, {
        toValue: 1,
        tension: 180,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [count]);

  if (!count || count <= 0) return null;

  return (
    <Animated.View style={[s.badge, { transform: [{ scale }] }]}>
      <Text style={s.badgeTxt}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON PUBLIER — flottant au centre, spectaculaire
// ─────────────────────────────────────────────────────────────────────────────
function PublishButton({ focused }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const rotate   = useRef(new Animated.Value(0)).current;
  const glow     = useRef(new Animated.Value(0)).current;

  // Animation d'entrée au montage
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  // Rotation + glow quand focused
  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(rotate, { toValue: 1, tension: 140, friction: 6, useNativeDriver: true }),
        Animated.timing(glow,   { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(rotate, { toValue: 0, tension: 140, friction: 6, useNativeDriver: true }),
        Animated.timing(glow,   { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [focused]);

  const spin = rotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const glowOpacity = glow.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={s.publishWrap}>
      {/* Halo extérieur */}
      <Animated.View style={[s.publishHalo, { opacity: glowOpacity }]} />

      {/* Anneau décoratif */}
      <View style={s.publishRing} />

      {/* Bouton principal */}
      <Animated.View style={[s.publishOuter, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={focused
            ? [P.amber, P.terra, '#8A2400']
            : [P.terra, P.amber]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.publishGrad}
        >
          <Animated.Text style={[s.publishIcon, { transform: [{ rotate: spin }] }]}>
            +
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      {/* Label */}
      <Text style={[s.publishLabel, focused && { color: P.terra, fontWeight: '800' }]}>
        Publier
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ICÔNE STANDARD
// ─────────────────────────────────────────────────────────────────────────────
function StandardIcon({ name, focused, color, badge }) {
  const scale     = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotScale  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,     { toValue: focused ? 1.12 : 1, tension: 180, friction: 7, useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: focused ? 1 : 0,    duration: 200, useNativeDriver: true }),
      Animated.spring(dotScale,  { toValue: focused ? 1 : 0,    tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  const icon = ICONS[name] || ICONS.profile;

  return (
    <View style={s.iconWrap}>
      {/* Fond pill actif */}
      <Animated.View style={[s.iconPill, { opacity: bgOpacity }]}>
        <LinearGradient
          colors={[P.terra + '22', P.amber + '11']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Icône */}
      <Animated.Text
        style={[
          s.icon,
          {
            color: focused ? P.terra : P.muted,
            transform: [{ scale }],
            fontSize: focused ? 23 : 21,
          },
        ]}
      >
        {focused ? icon.active : icon.inactive}
      </Animated.Text>

      {/* Point indicateur sous l'icône */}
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
  if (name === 'publish') {
    return <PublishButton focused={focused} />;
  }
  return <StandardIcon name={name} focused={focused} color={color} badge={badge} />;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  // ── Icône standard ──────────────────────────────────────────────────────────
  iconWrap: {
    width: 46,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconPill: {
    position: 'absolute',
    width: 44,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  icon: {
    fontWeight: '400',
    lineHeight: 26,
    marginBottom: 4,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: P.terra,
  },

  // ── Badge ───────────────────────────────────────────────────────────────────
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    backgroundColor: P.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: P.cream,
    shadowColor: P.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeTxt: {
    color: P.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  // ── Bouton Publier ──────────────────────────────────────────────────────────
  publishWrap: {
    alignItems: 'center',
    position: 'absolute',
    top: -28,
    width: 72,
  },

  // Halo lumineux derrière le bouton
  publishHalo: {
    position: 'absolute',
    top: -8,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: P.terra,
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 0,
  },

  // Anneau décoratif
  publishRing: {
    position: 'absolute',
    top: -6,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: P.gold + '55',
    borderStyle: 'dashed',
  },

  // Bouton principal
  publishOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
    // Bordure crème
    borderWidth: 3,
    borderColor: P.cream,
  },
  publishGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishIcon: {
    fontSize: 34,
    fontWeight: '300',
    color: P.white,
    lineHeight: 38,
    marginTop: 2,
  },

  // Label sous le bouton
  publishLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: P.muted,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});