// ─── TabBarIcon — MarketHub Niger ─────────────────────────────────────────────
// Version premium modérée — cohérente avec l'app

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { MOBILE_COLORS as P } from '../theme/colors';
import { useAppTheme } from '../contexts/ThemeContext';

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const ICONS = {
  home: { feather: 'home' },
  favorites: { feather: 'heart' },
  publish: { active: '+', inactive: '+' },
  messages: { feather: 'message-circle' },
  profile: { feather: 'user' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE ANIMÉ
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedBadge({ count }) {
  const { isDark } = useAppTheme();
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
    <Animated.View style={[s.badge, { transform: [{ scale }], borderColor: isDark ? '#111827' : '#ffffff' }]}>
      <Text style={s.badgeTxt}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON PUBLIER — modéré mais impactant
// ─────────────────────────────────────────────────────────────────────────────

function PublishButton({ focused }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0.3)).current; // JS driver uniquement

  useEffect(() => {
    // scale → useNativeDriver: true
    Animated.spring(scale, {
      toValue: focused ? 1.04 : 1,
      tension: 160,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // shadowOpacity → useNativeDriver: false (obligatoire pour les styles de layout)
    Animated.timing(shadowAnim, {
      toValue: focused ? 0.6 : 0.3,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  return (
    <View style={s.publishWrap}>
      {/* Wrapper JS pour shadowOpacity */}
      <Animated.View style={[s.publishShadow, { shadowOpacity: shadowAnim }]}>
        {/* Wrapper natif pour le scale */}
        <Animated.View style={[s.publishOuter, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={focused
              ? ['#FFA347', '#EC5A13', '#c74910']
              : ['#EC5A13', '#c74910']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.publishGrad}
          >
            <View style={s.publishShine} />
            <Text style={s.publishLabel}>PUBLIER</Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ICÔNE STANDARD
// ─────────────────────────────────────────────────────────────────────────────
function StandardIcon({ name, focused, badge }) {
  const { isDark } = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pillAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

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
    ]).start();
  }, [focused]);

  const icon = ICONS[name] || ICONS.profile;
  const iconColor = focused ? P.amber : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(17,24,39,0.45)');
  const iconSize = name === 'profile'
    ? (focused ? 25 : 23)
    : (focused ? 23 : 21);

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
      <Animated.View style={{ transform: [{ scale }] }}>
        <Feather name={icon.feather} size={iconSize} color={iconColor} />
      </Animated.View>

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
    width: 54,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconPill: {
    position: 'absolute',
    width: 50,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(236,90,19,0.22)',
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
    justifyContent: 'center',
    width: 110,
    height: 56,
    marginTop: 10
  },
  publishShadow: {
    borderRadius: 5,
    shadowColor: '#EC5A13',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,   // valeur initiale, sera animée
    shadowRadius: 10,
    elevation: 8,
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
    width: 100,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
  },
  publishGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  publishIcon: {
    fontSize: 30,
    fontWeight: '300',
    color: P.white,
    lineHeight: 34,
    marginTop: 2,
  },
  publishLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});