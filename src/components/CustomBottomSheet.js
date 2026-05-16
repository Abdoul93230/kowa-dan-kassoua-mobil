import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, PanResponder, TouchableOpacity,
  Dimensions, StyleSheet, Keyboard, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

export default function CustomBottomSheet({
  visible,
  onClose,
  title,
  footer,
  children,
  maxHeight = SCREEN_H * 0.92,
  avoidKeyboard = true,
  bottomOffset = 0,
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Open/close slide animation — useNativeDriver: true (GPU)
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeBack = useRef(new Animated.Value(0)).current;
  const rendered = useRef(false);

  // Keyboard avoidance — useNativeDriver: false (layout props)
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(Math.min(maxHeight, SCREEN_H * 0.92))).current;

  const baseHeight = Math.min(maxHeight, SCREEN_H * 0.92);

  // ── Open / close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      rendered.current = true;
      slideY.setValue(SCREEN_H);
      bottomAnim.setValue(0);
      heightAnim.setValue(baseHeight);
      Animated.parallel([
        Animated.spring(slideY,   { toValue: 0, damping: 24, stiffness: 200, useNativeDriver: false }),
        Animated.timing(fadeBack, { toValue: 1, duration: 240, useNativeDriver: false }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideY,   { toValue: SCREEN_H, duration: 260, useNativeDriver: false }),
        Animated.timing(fadeBack, { toValue: 0,        duration: 200, useNativeDriver: false }),
      ]).start(() => { rendered.current = false; });
    }
  }, [visible]);

  // ── Keyboard avoidance ────────────────────────────────────────────────────
  useEffect(() => {
    if (!avoidKeyboard) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const kbH = e.endCoordinates.height;
      const dur = Platform.OS === 'ios' ? (e.duration || 250) : 220;
      // Espace disponible au-dessus du clavier (moins safe area top + marge)
      const availableH = SCREEN_H - kbH - (insets.top || 0) - 12;
      const newHeight = Math.min(baseHeight, availableH);

      Animated.parallel([
        Animated.timing(bottomAnim, { toValue: kbH, duration: dur, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: newHeight, duration: dur, useNativeDriver: false }),
      ]).start();
    };

    const onHide = (e) => {
      const dur = Platform.OS === 'ios' ? (e.duration || 200) : 180;
      Animated.parallel([
        Animated.timing(bottomAnim, { toValue: 0,          duration: dur, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: baseHeight,  duration: dur, useNativeDriver: false }),
      ]).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, [avoidKeyboard, baseHeight, insets.top]);

  // ── Swipe-to-close ────────────────────────────────────────────────────────
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  (_, { dy }) => dy > 4,
    onPanResponderMove: (_, { dy }) => {
      if (dy > 0) {
        slideY.setValue(dy);
        fadeBack.setValue(Math.max(0, 1 - dy / (SCREEN_H * 0.45)));
      }
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > SWIPE_THRESHOLD || vy > 0.9) {
        onClose();
      } else {
        Animated.parallel([
          Animated.spring(slideY,   { toValue: 0, damping: 24, stiffness: 220, useNativeDriver: false }),
          Animated.timing(fadeBack, { toValue: 1, duration: 180, useNativeDriver: false }),
        ]).start();
      }
    },
  })).current;

  if (!visible && !rendered.current) return null;

  const safeBot = Math.max(insets.bottom, 16) + bottomOffset;

  return (
    <View
      style={[StyleSheet.absoluteFill, s.root, (title === 'Choisir une ville' || title === 'Indicatif du pays') && { marginBottom: 40 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeBack }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { backgroundColor: theme.surface },
          {
            bottom: bottomAnim,
            height: heightAnim,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Handle */}
        <View {...pan.panHandlers} style={s.handleZone} hitSlop={{ top: 8, bottom: 8 }}>
          <View style={[s.handle, { backgroundColor: theme.divider }]} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeWrap}
            activeOpacity={0.7}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <View style={[s.closeChip, { backgroundColor: theme.glass }]}>
              <Text style={[s.closeTxt, { color: theme.text }]}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[s.hairline, { backgroundColor: theme.divider }]} />

        {/* Contenu scrollable — flex:1 absorbe tout l'espace restant */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {children}
        </ScrollView>

        {/* Footer */}
        {footer ? (
          <View style={[s.footer, { paddingBottom: safeBot, backgroundColor: theme.surface }]}>
            <View style={[s.footerLine, { backgroundColor: theme.divider }]} />
            <View style={s.footerInner}>{footer}</View>
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 24), flexShrink: 0 }} />
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { zIndex: 999, elevation: 999 },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 10, 8, 0.60)',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flexDirection: 'column',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 32,
  },

  handleZone: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 2,
    flexShrink: 0,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
  },

  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeWrap: { flexShrink: 0, marginLeft: 12 },
  closeChip: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 12, fontWeight: '800', lineHeight: 14 },

  hairline: {
    flexShrink: 0,
    height: StyleSheet.hairlineWidth,
  },

  scroll: { flex: 1 },
  scrollPad: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },

  footer:      { flexShrink: 0 },
  footerLine:  {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 22,
    marginBottom: 16,
  },
  footerInner: { paddingHorizontal: 20, gap: 10 },
});
