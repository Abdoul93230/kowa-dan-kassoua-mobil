// ─── ChatComposer — zone de saisie façon WhatsApp ───────────────────────────
//
// Texte  : le bouton micro se transforme en bouton « envoyer » dès qu'on tape.
// Vocal  : • MAINTENIR le micro → enregistre ; RELÂCHER → envoie
//          • glisser à GAUCHE → annule (corbeille)
//          • glisser vers le HAUT → verrouille (mains libres) : corbeille, pause/reprise, envoyer
//          • relâché trop vite → info « Maintenez pour enregistrer »
//          • forme d'onde en direct (niveau du micro) + chronomètre + vibrations
//
// Gestes et animations sur le thread natif (Gesture Handler + Reanimated).
// Modes : 'idle' | 'holding' (doigt posé) | 'locked' | 'sending' | 'sending-locked'

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, interpolate, Extrapolation,
  runOnJS, ZoomIn, ZoomOut, FadeIn, FadeOut,
} from 'react-native-reanimated';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, getRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';

const CANCEL_X = 110;        // distance à gauche pour annuler
const LOCK_Y = 90;           // distance vers le haut pour verrouiller
const MIN_DURATION_MS = 800; // en dessous : considéré comme un appui trop court
const BAR_COUNT = 34;
const BUTTON = 48;

const formatTime = (ms = 0) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// dB (-60…0) → hauteur de barre
const levelToHeight = (db) => {
  if (db === undefined || db === null || Number.isNaN(db)) return 4;
  const clamped = Math.max(-60, Math.min(0, db));
  return 4 + ((clamped + 60) / 60) * 22;
};

const tap = (style = Haptics.ImpactFeedbackStyle.Light) => Haptics.impactAsync(style).catch(() => {});

// ─── Petits éléments animés ──────────────────────────────────────────────────
function BlinkingDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.2, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[s.recDot, style]} />;
}

function Waveform({ levels, color }) {
  return (
    <View style={s.wave}>
      {levels.map((h, i) => (
        <View key={i} style={[s.waveBar, { height: h, backgroundColor: color }]} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ChatComposer({
  value,
  onChangeText,
  onFocus,
  onSendText,
  sendingText = false,
  onSendVoice,          // async (uri, durationMs) => void
  onRecordingStart,     // ex : couper la lecture audio en cours
  onError,              // (message) => void
  bottomInset = 0,
  disabled = false,
}) {
  const { theme, isDark } = useAppTheme();
  const accent = P.terra;

  const [mode, setMode] = useState('idle');
  const [paused, setPaused] = useState(false);
  const [levels, setLevels] = useState(() => Array(BAR_COUNT).fill(4));
  const [hint, setHint] = useState(false);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 80);

  const pressActive = useRef(false);   // le doigt est-il encore posé ?
  const startingRef = useRef(false);   // démarrage en cours (permissions, préparation)
  const modeRef = useRef('idle');
  modeRef.current = mode;

  // Valeurs animées (thread natif)
  const holding = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const micScale = useSharedValue(1);

  const hasText = value.trim().length > 0;
  const recording = mode === 'holding' || mode === 'locked';
  const durationMs = recState?.durationMillis || 0;

  // Forme d'onde : on décale les barres à chaque nouvelle mesure du micro
  useEffect(() => {
    if (!recording || paused) return;
    setLevels((prev) => [...prev.slice(1), levelToHeight(recState?.metering)]);
  }, [recState?.durationMillis, recState?.metering, recording, paused]);

  // ─── Cycle de vie de l'enregistrement ─────────────────────────────────────
  const resetAudioMode = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

  const resetUi = useCallback(() => {
    holding.value = false;
    dragX.value = withSpring(0);
    dragY.value = withSpring(0);
    micScale.value = withSpring(1);
    setPaused(false);
    setLevels(Array(BAR_COUNT).fill(4));
    setMode('idle');
  }, [holding, dragX, dragY, micScale]);

  const discard = useCallback(async () => {
    try { if (recorder.isRecording || paused) await recorder.stop(); } catch (e) { /* déjà arrêté */ }
    await resetAudioMode();
    resetUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, paused, resetUi]);

  const showHint = () => {
    setHint(true);
    setTimeout(() => setHint(false), 2200);
  };

  const start = useCallback(async () => {
    if (startingRef.current || modeRef.current !== 'idle' || disabled) return;
    startingRef.current = true;
    try {
      // Permission : si elle doit être demandée, la boîte système interrompt le geste
      const current = await getRecordingPermissionsAsync();
      if (!current.granted) {
        const asked = await requestRecordingPermissionsAsync();
        if (!asked.granted) onError?.('Activez le microphone dans les réglages pour envoyer un message vocal.');
        return;
      }

      onRecordingStart?.();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'duckOthers' });
      await recorder.prepareToRecordAsync();
      recorder.record();

      // Doigt déjà relâché pendant la préparation → appui trop court
      if (!pressActive.current) {
        await discard();
        showHint();
        return;
      }

      tap(Haptics.ImpactFeedbackStyle.Medium);
      holding.value = true;
      micScale.value = withSpring(1.55, { damping: 14 });
      setMode('holding');
    } catch (e) {
      await resetAudioMode();
      resetUi();
      onError?.('Impossible de démarrer l\'enregistrement vocal.');
    } finally {
      startingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, recorder, onRecordingStart, onError, discard, resetUi, holding, micScale]);

  const send = useCallback(async () => {
    if (modeRef.current === 'sending' || modeRef.current === 'sending-locked') return;
    const fromLock = modeRef.current === 'locked';
    const recordedMs = Math.round((recorder.currentTime || 0) * 1000);
    const tooShort = recordedMs < MIN_DURATION_MS;
    if (tooShort) {
      await discard();
      showHint();
      return;
    }
    // Depuis le mode verrouillé : on garde son affichage ; sinon indicateur sur le bouton
    setMode(fromLock ? 'sending-locked' : 'sending');
    holding.value = false;
    micScale.value = withSpring(1);
    dragX.value = withSpring(0);
    dragY.value = withSpring(0);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await resetAudioMode();
      if (!uri) throw new Error('no-uri');
      tap();
      await onSendVoice?.(uri, recordedMs);
    } catch (e) {
      if (e?.message === 'no-uri') onError?.('Aucun enregistrement à envoyer.');
    } finally {
      resetUi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, discard, onSendVoice, onError, resetUi, holding, micScale, dragX, dragY]);

  const cancel = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await discard();
  }, [discard]);

  const lock = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    micScale.value = withSpring(1);
    dragX.value = withSpring(0);
    dragY.value = withSpring(0);
    setMode('locked');
  }, [micScale, dragX, dragY]);

  const togglePause = () => {
    try {
      if (paused) { recorder.record(); setPaused(false); } else { recorder.pause(); setPaused(true); }
      tap();
    } catch (e) { /* ignoré */ }
  };

  // Nettoyage si on quitte l'écran pendant un enregistrement
  useEffect(() => () => {
    try { if (recorder.isRecording) recorder.stop(); } catch (e) { /* ignoré */ }
    resetAudioMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Geste du micro (maintenir / glisser) ─────────────────────────────────
  const onPressIn = () => { pressActive.current = true; start(); };
  const onPressOut = () => { pressActive.current = false; };

  const micGesture = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .enabled(!disabled && mode !== 'locked' && mode !== 'sending')
    .onBegin(() => { runOnJS(onPressIn)(); })
    .onUpdate((e) => {
      if (!holding.value) return;
      dragX.value = Math.max(Math.min(e.translationX, 0), -CANCEL_X - 30);
      dragY.value = Math.max(Math.min(e.translationY, 0), -LOCK_Y - 30);
      if (e.translationX < -CANCEL_X) {
        holding.value = false;
        runOnJS(cancel)();
      } else if (e.translationY < -LOCK_Y) {
        holding.value = false;
        runOnJS(lock)();
      }
    })
    .onFinalize(() => {
      runOnJS(onPressOut)();
      if (holding.value) {
        holding.value = false;
        runOnJS(send)();
      }
    });

  // ─── Styles animés ────────────────────────────────────────────────────────
  const micStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: micScale.value }],
  }));
  const slideHintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value * 0.6 }],
    opacity: interpolate(dragX.value, [-CANCEL_X, 0], [0, 1], Extrapolation.CLAMP),
  }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: holding.value ? 1 : withTiming(0, { duration: 120 }),
    transform: [
      { translateY: interpolate(dragY.value, [-LOCK_Y, 0], [-24, 0], Extrapolation.CLAMP) },
      { scale: interpolate(dragY.value, [-LOCK_Y, 0], [1.1, 1], Extrapolation.CLAMP) },
    ],
  }));
  const lockArrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [-LOCK_Y * 0.6, 0], [0, 1], Extrapolation.CLAMP),
  }));

  const pillBg = isDark ? theme.surface : P.white;
  const muted = theme.textSoft;

  // ─── Rendu : mode verrouillé (mains libres) ───────────────────────────────
  if (mode === 'locked' || mode === 'sending-locked') {
    const isSending = mode === 'sending-locked';
    return (
      <Animated.View entering={FadeIn.duration(150)} style={[s.wrap, { paddingBottom: Math.max(bottomInset, 8), backgroundColor: theme.screen, borderTopColor: theme.border }]}>
        <View style={[s.lockedCard, { backgroundColor: pillBg, borderColor: theme.border }]}>
          <View style={s.lockedTop}>
            {paused ? <Ionicons name="pause" size={14} color={muted} /> : <BlinkingDot />}
            <Text style={[s.timer, { color: theme.text }]}>{formatTime(durationMs)}</Text>
            <Waveform levels={levels} color={paused ? muted : accent} />
          </View>
          <View style={s.lockedActions}>
            <Pressable onPress={cancel} disabled={isSending} hitSlop={10} style={({ pressed }) => [s.roundGhost, pressed && { opacity: 0.6 }]} accessibilityLabel="Supprimer l'enregistrement">
              <Ionicons name="trash-outline" size={22} color={P.error} />
            </Pressable>
            <Pressable onPress={togglePause} disabled={isSending} hitSlop={10} style={({ pressed }) => [s.roundGhost, pressed && { opacity: 0.6 }]} accessibilityLabel={paused ? 'Reprendre' : 'Pause'}>
              <Ionicons name={paused ? 'mic' : 'pause'} size={22} color={P.error} />
            </Pressable>
            <Pressable onPress={send} disabled={isSending} style={({ pressed }) => [s.button, { backgroundColor: accent }, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityLabel="Envoyer le message vocal">
              {isSending ? <ActivityIndicator color={P.white} /> : <Ionicons name="send" size={20} color={P.white} style={{ marginLeft: 3 }} />}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ─── Rendu : saisie normale / enregistrement maintenu ─────────────────────
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(bottomInset, 8), backgroundColor: theme.screen, borderTopColor: theme.border }]}>
      {hint ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={[s.hint, { backgroundColor: isDark ? '#374151' : P.charcoal }]}>
          <Text style={s.hintTxt}>Maintenez pour enregistrer, relâchez pour envoyer</Text>
        </Animated.View>
      ) : null}

      <View style={s.row}>
        <View style={[s.pill, { backgroundColor: pillBg, borderColor: theme.border }]}>
          {mode === 'holding' ? (
            <View style={s.recordingRow}>
              <BlinkingDot />
              <Text style={[s.timer, { color: theme.text }]}>{formatTime(durationMs)}</Text>
              <Animated.View style={[s.slideHint, slideHintStyle]}>
                <Ionicons name="chevron-back" size={16} color={muted} />
                <Text style={[s.slideTxt, { color: muted }]}>Glisser pour annuler</Text>
              </Animated.View>
            </View>
          ) : (
            <TextInput
              value={value}
              onChangeText={onChangeText}
              onFocus={onFocus}
              placeholder="Message"
              placeholderTextColor={muted}
              style={[s.input, { color: theme.text }]}
              multiline
              maxLength={2000}
              editable={!disabled && mode === 'idle'}
            />
          )}
        </View>

        <View style={s.buttonSlot}>
          {/* Cadenas : apparaît au-dessus du micro pendant l'enregistrement maintenu */}
          {mode === 'holding' ? (
            <Animated.View pointerEvents="none" style={[s.lock, { backgroundColor: pillBg, borderColor: theme.border }, lockStyle]}>
              <Ionicons name="lock-closed-outline" size={18} color={muted} />
              <Animated.View style={lockArrowStyle}>
                <Ionicons name="chevron-up" size={16} color={muted} />
              </Animated.View>
            </Animated.View>
          ) : null}

          {hasText ? (
            <Animated.View key="send" entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
              <Pressable
                onPress={onSendText}
                disabled={sendingText || disabled}
                style={({ pressed }) => [s.button, { backgroundColor: accent }, pressed && { transform: [{ scale: 0.94 }] }]}
                accessibilityLabel="Envoyer le message"
              >
                {sendingText ? <ActivityIndicator color={P.white} /> : <Ionicons name="send" size={20} color={P.white} style={{ marginLeft: 3 }} />}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View key="mic" entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
              <GestureDetector gesture={micGesture}>
                <Animated.View style={[s.button, { backgroundColor: mode === 'holding' ? P.error : accent }, micStyle]} accessibilityLabel="Maintenir pour enregistrer un message vocal">
                  {mode === 'sending' ? <ActivityIndicator color={P.white} /> : <Ionicons name="mic" size={22} color={P.white} />}
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  pill: {
    flex: 1, minHeight: BUTTON, maxHeight: 140, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  input: { fontSize: 16, paddingTop: Platform.OS === 'ios' ? 13 : 10, paddingBottom: Platform.OS === 'ios' ? 13 : 10, maxHeight: 130 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', height: BUTTON, gap: 8, overflow: 'hidden' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: P.error },
  timer: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 42 },
  slideHint: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  slideTxt: { fontSize: 14 },
  buttonSlot: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'flex-end' },
  button: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute', bottom: BUTTON + 34, width: 40, paddingVertical: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', gap: 2,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  hint: { position: 'absolute', right: 12, bottom: BUTTON + 18, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, zIndex: 10 },
  hintTxt: { color: P.white, fontSize: 12.5, fontWeight: '600' },
  lockedCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  lockedTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockedActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  roundGhost: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waveBar: { width: 3, borderRadius: 2 },
});
