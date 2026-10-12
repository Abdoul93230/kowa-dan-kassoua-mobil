// ─── Sheet — panneau du bas natif (@gorhom/bottom-sheet) ─────────────────────
// Base unique de TOUS les panneaux de l'app :
// • hauteur = contenu (plafonnée), défilement natif au-delà
// • fermeture : toucher le fond, glisser vers le bas, bouton retour Android
// • clavier géré nativement : le panneau remonte, le pied de page reste collé au clavier
// • panneaux empilables (un sélecteur peut s'ouvrir par-dessus un autre panneau)
//
// Champs de saisie dans un panneau : utiliser <SheetTextInput> (exporté ici),
// sinon le panneau ne sait pas qu'un champ est actif et ne suit pas le clavier.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, BackHandler, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

export const SheetTextInput = BottomSheetTextInput;

export default function Sheet({
  visible,
  onClose,
  title,
  headerRight,
  footer,
  children,
  maxHeightRatio = 0.9,
  contentPadding = 20,
}) {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ref = useRef(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const isOpenRef = useRef(false);

  // Ouverture / fermeture pilotées par `visible`
  useEffect(() => {
    if (visible && !isOpenRef.current) {
      isOpenRef.current = true;
      ref.current?.present();
    } else if (!visible && isOpenRef.current) {
      ref.current?.dismiss();
    }
  }, [visible]);

  // Bouton retour Android : ferme le panneau au lieu de quitter l'écran
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const handleDismiss = useCallback(() => {
    isOpenRef.current = false;
    onClose?.();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.5} />
    ),
    []
  );

  const renderFooter = useCallback(
    (props) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={[s.footer, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [footer, theme, insets.bottom]
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={handleDismiss}
      enableDynamicSizing
      maxDynamicContentSize={height * maxHeightRatio}
      topInset={insets.top}
      enablePanDownToClose
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      backgroundStyle={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(17,24,39,0.18)', width: 40 }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: footer ? footerHeight + 12 : Math.max(insets.bottom, 16) + 8,
        }}
      >
        {title ? (
          <View style={s.header}>
            <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
            {headerRight}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [s.close, { backgroundColor: theme.glass }, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Fermer"
            >
              <Feather name="x" size={16} color={theme.text} />
            </Pressable>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: contentPadding }}>{children}</View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 },
  title: { flex: 1, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
