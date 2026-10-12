// Lecteur de message vocal façon WhatsApp : durée visible avant lecture,
// forme d'onde propre à chaque message, glisser pour avancer, vitesse 1× / 1,5× / 2×.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  cycleVoicePlaybackRate,
  requestVoiceDuration,
  seekVoicePlayback,
  toggleVoicePlayback,
  useVoicePlayback,
} from './voicePlayback';

const BAR_COUNT = 30;

// Forme d'onde déterministe dérivée de l'id du message (stable d'un rendu à l'autre)
function waveformFor(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    const rnd = ((h >>> 0) % 1000) / 1000;
    // Enveloppe douce : plus calme aux extrémités, plus vive au centre
    const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / BAR_COUNT);
    bars.push(4 + Math.round(16 * envelope * (0.35 + 0.65 * rnd)));
  }
  return bars;
}

export function formatVoiceTime(ms = 0) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function VoiceMessageBubble({ message, mine, accent, trackColor, textStyle, playBtnStyle }) {
  const id = String(message.id);
  const url = message?.attachments?.[0];
  const state = useVoicePlayback(id);
  const [scrub, setScrub] = useState(null); // ratio pendant le glissement
  const widthRef = useRef(0);
  const leftRef = useRef(0);

  const storedDuration = message?.audioDurationMs || 0;
  const durationMs = state.durationMs || storedDuration;

  // Anciens messages sans durée enregistrée : on la récupère sans lancer la lecture
  useEffect(() => {
    if (url && !storedDuration) requestVoiceDuration(id, url);
  }, [id, url, storedDuration]);

  const bars = useMemo(() => waveformFor(id), [id]);
  const progress = scrub ?? (durationMs > 0 ? clamp01(state.positionMs / durationMs) : 0);
  const showElapsed = state.active || state.positionMs > 0 || scrub != null;
  const timeLabel = scrub != null
    ? formatVoiceTime(scrub * durationMs)
    : showElapsed
      ? formatVoiceTime(state.positionMs)
      : durationMs > 0 ? formatVoiceTime(durationMs) : '-:--';

  const ratioFrom = (e) => (widthRef.current ? clamp01((e.nativeEvent.pageX - leftRef.current) / widthRef.current) : 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => toggleVoicePlayback(message)}
          activeOpacity={0.8}
          style={[styles.playBtn, playBtnStyle]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={state.playing ? 'Mettre en pause le message vocal' : 'Écouter le message vocal'}
        >
          {state.loading ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Ionicons name={state.playing ? 'pause' : 'play'} size={20} color={accent} style={!state.playing && styles.playIconNudge} />
          )}
        </TouchableOpacity>

        <View
          style={styles.track}
          onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => durationMs > 0}
          onResponderGrant={(e) => {
            leftRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
            setScrub(ratioFrom(e));
          }}
          onResponderMove={(e) => setScrub(ratioFrom(e))}
          onResponderRelease={(e) => {
            seekVoicePlayback(message, ratioFrom(e), durationMs);
            setScrub(null);
          }}
          onResponderTerminate={() => setScrub(null)}
        >
          <View style={styles.bars} pointerEvents="none">
            {bars.map((height, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height, backgroundColor: (i + 0.5) / BAR_COUNT <= progress ? accent : trackColor },
                ]}
              />
            ))}
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.knob,
              { left: `${progress * 100}%`, backgroundColor: accent },
              scrub != null && styles.knobActive,
            ]}
          />
        </View>

        {state.active ? (
          <TouchableOpacity
            onPress={cycleVoicePlaybackRate}
            activeOpacity={0.8}
            hitSlop={6}
            style={[styles.rate, { borderColor: accent }]}
            accessibilityLabel="Changer la vitesse de lecture"
          >
            <Text style={[styles.rateText, { color: accent }]}>
              {String(state.rate).replace('.', ',')}×
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Ionicons name="mic" size={12} color={mine ? 'rgba(255,255,255,0.85)' : accent} />
        <Text style={[styles.time, textStyle]}>{timeLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 230, maxWidth: 280, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  playIconNudge: { marginLeft: 2 },
  track: { flex: 1, height: 30, justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 2 },
  knob: { position: 'absolute', top: 8, width: 14, height: 14, borderRadius: 7, marginLeft: -7 },
  knobActive: { transform: [{ scale: 1.25 }] },
  rate: { minWidth: 34, height: 22, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rateText: { fontSize: 11, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 44 },
  time: { fontSize: 11, fontWeight: '600', opacity: 0.85, fontVariant: ['tabular-nums'] },
});

export default memo(VoiceMessageBubble);
