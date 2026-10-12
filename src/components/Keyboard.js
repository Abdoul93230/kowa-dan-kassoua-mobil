// ─── Gestion du clavier, commune à toute l'app ───────────────────────────────
// (s'appuie sur react-native-keyboard-controller : suivi natif, image par image)
//
// Formulaires (connexion, inscription, OTP, publication…) :
//   <KeyboardAwareView>              conteneur d'écran — NE rétrécit PAS l'écran
//     <KeyboardAwareScrollView>      défile seul pour garder le champ actif visible
//     …pied de page / bouton…        reste en bas, derrière le clavier
//     <FormKeyboardToolbar />        barre ‹ › OK collée au clavier (dernier enfant)
//   </KeyboardAwareView>
//
// Messagerie : <ChatKeyboardView> — la zone de saisie reste collée au clavier.
//
// KeyboardDoneAccessory / doneAccessory : barre « OK » iOS pour les champs hors
// formulaires (panneaux du bas, avis…) dont le clavier n'a pas de touche de fermeture.

import React, { forwardRef } from 'react';
import { View, Text, Keyboard, Platform, InputAccessoryView, Pressable, StyleSheet } from 'react-native';
import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  KeyboardAwareScrollView as NativeKeyboardAwareScrollView,
  KeyboardToolbar,
} from 'react-native-keyboard-controller';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';

const IS_IOS = Platform.OS === 'ios';

// Hauteur de la barre ‹ › OK : le champ actif est gardé au-dessus d'elle
const TOOLBAR_HEIGHT = 42;

// ─── Formulaires ──────────────────────────────────────────────────────────────

// Conteneur d'écran : volontairement un simple View (le contenu défile, le
// bouton du bas ne remonte pas et l'écran ne rétrécit pas).
export function KeyboardAwareView({ style, children, ...rest }) {
  return <View style={style} {...rest}>{children}</View>;
}

// Défilement natif jusqu'au champ actif, au-dessus du clavier ET de la barre ‹ › OK
export const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
  { bottomOffset = TOOLBAR_HEIGHT + 20, ...props },
  ref
) {
  return (
    <NativeKeyboardAwareScrollView
      ref={ref}
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={IS_IOS ? 'interactive' : 'on-drag'}
      {...props}
    />
  );
});

// Barre native au-dessus du clavier : champ précédent / suivant + OK
export function FormKeyboardToolbar() {
  const { isDark } = useAppTheme();
  // Couleurs alignées sur le thème de l'app (et non sur celui du système)
  const colors = isDark
    ? { primary: P.amber, disabled: '#6b7280', background: '#1f2937', ripple: '#ffffff33' }
    : { primary: P.terra, disabled: '#c4c9d0', background: '#f3f4f6', ripple: '#00000014' };

  return (
    <KeyboardToolbar theme={{ light: colors, dark: colors }}>
      <KeyboardToolbar.Prev />
      <KeyboardToolbar.Next />
      <KeyboardToolbar.Done text="OK" />
    </KeyboardToolbar>
  );
}

// ─── Messagerie ───────────────────────────────────────────────────────────────

// La zone de saisie suit le clavier ; `automaticOffset` tient compte de l'en-tête
export function ChatKeyboardView({ style, children, ...rest }) {
  return (
    <NativeKeyboardAvoidingView behavior="padding" automaticOffset style={style} {...rest}>
      {children}
    </NativeKeyboardAvoidingView>
  );
}

// ─── Barre « OK » iOS (champs hors formulaires) ──────────────────────────────
export const IOS_DONE_ACCESSORY_ID = 'taktak-keyboard-done';

// À étaler sur les TextInput numériques/multilignes hors formulaires
export const doneAccessory = IS_IOS ? { inputAccessoryViewID: IOS_DONE_ACCESSORY_ID } : {};

// Rendue une seule fois à la racine de l'app
export function KeyboardDoneAccessory() {
  const { theme, isDark } = useAppTheme();
  if (!IS_IOS) return null;
  return (
    <InputAccessoryView nativeID={IOS_DONE_ACCESSORY_ID} backgroundColor={isDark ? '#1f2937' : '#f2f3f5'}>
      <View style={[s.bar, { borderTopColor: theme.border }]}>
        <Pressable onPress={Keyboard.dismiss} hitSlop={12} style={({ pressed }) => [s.done, pressed && { opacity: 0.6 }]} accessibilityLabel="Fermer le clavier">
          <Text style={[s.doneTxt, { color: isDark ? P.amber : P.terra }]}>OK</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const s = StyleSheet.create({
  bar: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  done: { paddingHorizontal: 6, paddingVertical: 6 },
  doneTxt: { fontSize: 16, fontWeight: '700' },
});
