// ─── CustomBottomSheet v4 ─ MarketHub Niger ───────────────────────────────────
// FIX CLAVIER : on écoute Keyboard.addListener et on translate le sheet vers
// le haut de la hauteur du clavier. Zéro KeyboardAvoidingView → zéro compression.
//
// USAGE identique à v2 :
//   <CustomBottomSheet visible={bool} onClose={fn} title="…" footer={<Btn/>}>
//     {contenu scrollable}
//   </CustomBottomSheet>

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, PanResponder, TouchableOpacity,
  Dimensions, StyleSheet, Keyboard, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets    = useSafeAreaInsets();
  const slideY    = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeBack  = useRef(new Animated.Value(0)).current;
  // translateY supplémentaire pour monter le sheet quand le clavier apparaît
  const keyboardY = useRef(new Animated.Value(0)).current;
  const rendered  = useRef(false);

  // ── Animation open / close ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      rendered.current = true;
      slideY.setValue(SCREEN_H);
      keyboardY.setValue(0);
      Animated.parallel([
        Animated.spring(slideY,   { toValue: 0, damping: 24, stiffness: 200, useNativeDriver: true }),
        Animated.timing(fadeBack, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideY,   { toValue: SCREEN_H, duration: 260, useNativeDriver: true }),
        Animated.timing(fadeBack, { toValue: 0,        duration: 200, useNativeDriver: true }),
      ]).start(() => { rendered.current = false; });
    }
  }, [visible]);

  // ── Écoute du clavier ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!avoidKeyboard) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      Animated.timing(keyboardY, {
        toValue: -e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 200,
        useNativeDriver: true,
      }).start();
    };

    const onHide = (e) => {
      Animated.timing(keyboardY, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 200) : 180,
        useNativeDriver: true,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, [avoidKeyboard]);

  // ── Swipe-to-close (handle uniquement) ───────────────────────────────────
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
          Animated.spring(slideY,   { toValue: 0, damping: 24, stiffness: 220, useNativeDriver: true }),
          Animated.timing(fadeBack, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
      }
    },
  })).current;

  if (!visible && !rendered.current) return null;

  const sheetH  = Math.min(maxHeight, SCREEN_H * 0.92);
  const safeBot = Math.max(insets.bottom, 16) + bottomOffset;

  return (
    <View style={[StyleSheet.absoluteFill, s.root, (title==="Choisir une ville" || title==="Indicatif du pays") && { marginBottom: 40 }]} pointerEvents={visible ? 'auto' : 'none'}>

      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeBack }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet : slide depuis le bas + monte avec le clavier */}
      <Animated.View
        style={[
          s.sheet,
          {
            height: sheetH,
            transform: [
              { translateY: slideY },    // animation open/close + swipe
              { translateY: keyboardY }, // monte quand le clavier apparaît
            ],
          },
        ]}
      >
        {/* Handle swipeable */}
        <View {...pan.panHandlers} style={s.handleZone} hitSlop={{ top: 8, bottom: 8 }}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeWrap}
            activeOpacity={0.7}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <View style={s.closeChip}>
              <Text style={s.closeTxt}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.hairline} />

        {/* Scroll — flex:1 : prend TOUT l'espace entre header et footer */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces
        >
          {children}
        </ScrollView>

        {/* Footer — jamais compressé, toujours visible */}
        {footer ? (
          <View style={[s.footer, { paddingBottom: safeBot }]}>
            <View style={s.footerLine} />
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
  root: { zIndex: 999, elevation: 999, },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 10, 8, 0.60)',
  },

  // Sheet ancré en bas via position absolute
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: P.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    // Colonne flex stricte : scroll(flex:1) + footer(flexShrink:0)
    flexDirection: 'column',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 32,
  },

  // Handle
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
    backgroundColor: 'rgba(0,0,0,0.11)',
  },

  // Header
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
    color: P.charcoal,
    letterSpacing: -0.4,
  },
  closeWrap: { flexShrink: 0, marginLeft: 12 },
  closeChip: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 12, fontWeight: '800', color: P.charcoal, lineHeight: 14 },

  hairline: {
    flexShrink: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.09)',
  },

  // Scroll — DOIT avoir flex:1
  scroll:    { flex: 1 },
  scrollPad: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },

  // Footer
  footer:      { flexShrink: 0, backgroundColor: P.white },
  footerLine:  {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.07)',
    marginHorizontal: 22,
    marginBottom: 16,
  },
  footerInner: { paddingHorizontal: 20, gap: 10 },
});