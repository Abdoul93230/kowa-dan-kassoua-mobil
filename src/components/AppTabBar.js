// ─── AppTabBar — barre d'onglets personnalisée ───────────────────────────────
// Icône + libellé, pastille animée derrière l'onglet actif, bouton Publier surélevé.
// Toutes les animations tournent sur le thread natif.

import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';

export const TAB_BAR_BASE_HEIGHT = 60;

const TABS = {
  Home: { icon: 'home', label: 'Accueil' },
  Favorites: { icon: 'heart', label: 'Favoris' },
  Publish: { icon: 'plus', label: 'Publier', primary: true },
  Messages: { icon: 'message-circle', label: 'Messages' },
  Profile: { icon: 'user', label: 'Profil' },
};

function Badge({ value, borderColor }) {
  const scale = useRef(new Animated.Value(0)).current;
  const show = value !== undefined && value !== null && value !== 0 && value !== '';

  useEffect(() => {
    Animated.spring(scale, { toValue: show ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
  }, [show, value, scale]);

  if (!show) return null;
  const label = typeof value === 'number' && value > 9 ? '9+' : String(value);
  return (
    <Animated.View style={[s.badge, { borderColor, transform: [{ scale }] }]}>
      <Text style={s.badgeTxt}>{label}</Text>
    </Animated.View>
  );
}

function TabItem({ config, focused, badge, onPress, onLongPress, theme, isDark }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [focused, progress]);

  const active = isDark ? P.amber : P.terra;
  const idle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(17,24,39,0.45)';
  const pressTo = (v) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => pressTo(0.9)}
      onPressOut={() => pressTo(1)}
      style={s.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
    >
      <Animated.View style={[s.itemInner, { transform: [{ scale: press }] }]}>
        <View style={s.iconZone}>
          <Animated.View
            style={[
              s.pill,
              { backgroundColor: isDark ? 'rgba(255,168,123,0.14)' : P.orange50 },
              { opacity: progress, transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
            ]}
          />
          {/* Deux couches d'icône superposées : fondu entre couleur inactive et active */}
          <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Feather name={config.icon} size={22} color={idle} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, s.center, { opacity: progress }]}>
            <Feather name={config.icon} size={22} color={active} />
          </Animated.View>
          <Badge value={badge} borderColor={theme.surface} />
        </View>
        <Text style={[s.label, { color: focused ? active : idle }, focused && s.labelActive]} numberOfLines={1}>
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PublishItem({ config, focused, onPress, theme }) {
  const press = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(spin, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [focused, spin]);

  const pressTo = (v) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressTo(0.9)}
      onPressOut={() => pressTo(1)}
      style={s.item}
      accessibilityRole="button"
      accessibilityLabel="Publier une annonce"
    >
      <Animated.View style={[s.fabRing, { backgroundColor: theme.surface, transform: [{ scale: press }] }]}>
        <LinearGradient colors={[P.orange400, P.terra, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
            <Feather name={config.icon} size={26} color={P.white} />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      <Text style={[s.label, s.fabLabel, { color: focused ? P.terra : theme.textMuted }]}>{config.label}</Text>
    </Pressable>
  );
}

export default function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Android : masquer la barre quand le clavier est ouvert
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (focusedOptions.tabBarStyle?.display === 'none' || keyboardVisible) return null;

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        s.bar,
        {
          height: TAB_BAR_BASE_HEIGHT + bottomPad,
          paddingBottom: bottomPad,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        !isDark && s.barShadow,
      ]}
    >
      {state.routes.map((route, index) => {
        const config = TABS[route.name] || { icon: 'circle', label: route.name };
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        if (config.primary) {
          return <PublishItem key={route.key} config={config} focused={focused} onPress={onPress} theme={theme} />;
        }
        return (
          <TabItem
            key={route.key}
            config={config}
            focused={focused}
            badge={options.tabBarBadge}
            onPress={onPress}
            onLongPress={onLongPress}
            theme={theme}
            isDark={isDark}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 6, paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  barShadow: { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  item: { flex: 1, alignItems: 'center' },
  itemInner: { alignItems: 'center' },
  iconZone: { width: 58, height: 32, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 58, height: 32, borderRadius: 16 },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  labelActive: { fontWeight: '800' },
  badge: {
    position: 'absolute', top: -2, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: P.error, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: P.white, fontSize: 9.5, fontWeight: '900' },
  fabRing: { width: 62, height: 62, borderRadius: 31, padding: 5, marginTop: -26 },
  fab: {
    flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: P.terra, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  fabLabel: { marginTop: 2, fontWeight: '700' },
});
