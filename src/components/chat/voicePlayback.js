// Lecture des messages vocaux : un seul lecteur actif à la fois (comme WhatsApp).
// Chaque bulle s'abonne uniquement à l'état de SON message → pendant la lecture,
// seule la bulle concernée se re-rend (et non toute la liste de messages).
import { useCallback, useSyncExternalStore } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export const PLAYBACK_RATES = [1, 1.5, 2];
const LOAD_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 10000;
const PROBE_CONCURRENCY = 2;

const EMPTY = Object.freeze({ positionMs: 0, durationMs: 0, playing: false, loading: false, active: false, rate: 1 });

const snapshots = new Map();      // messageId -> état affiché
const listeners = new Map();      // messageId -> Set<callback>
const durationCache = new Map();  // url -> durée (ms), conservée entre les écrans

let active = null;                // { id, url, player, sub, intent, started, timer }
let rate = 1;
let nextProvider = null;          // (messageId) => message vocal suivant | null
let errorHandler = null;

const emit = (id) => listeners.get(id)?.forEach((cb) => cb());

function patch(id, values) {
  const prev = snapshots.get(id) || EMPTY;
  const changed = Object.keys(values).some((k) => prev[k] !== values[k]);
  if (!changed) return;
  snapshots.set(id, { ...prev, ...values });
  emit(id);
}

function subscribe(id, cb) {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id).add(cb);
  return () => {
    const set = listeners.get(id);
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(id);
  };
}

const getSnapshot = (id) => snapshots.get(id) || EMPTY;

export function useVoicePlayback(id) {
  const sub = useCallback((cb) => subscribe(id, cb), [id]);
  const snap = useCallback(() => getSnapshot(id), [id]);
  return useSyncExternalStore(sub, snap, snap);
}

// L'écran fournit le message suivant pour enchaîner les vocaux consécutifs
export function configureVoicePlayback({ getNext, onError } = {}) {
  nextProvider = getNext || null;
  errorHandler = onError || null;
}

const knownDuration = (id, url, fallbackMs = 0) =>
  getSnapshot(id).durationMs || fallbackMs || durationCache.get(url) || 0;

function release() {
  if (!active) return null;
  const { id, player, sub, timer } = active;
  active = null;
  if (timer) clearTimeout(timer);
  try { sub?.remove(); } catch (e) { /* déjà retiré */ }
  try { player.pause(); } catch (e) { /* lecteur déjà libéré */ }
  try { player.remove(); } catch (e) { /* lecteur déjà libéré */ }
  return id;
}

export function stopVoicePlayback() {
  const id = release();
  if (id) patch(id, { playing: false, loading: false, active: false });
}

function finish(id) {
  release();
  patch(id, { positionMs: 0, playing: false, loading: false, active: false });
  const next = nextProvider?.(id);
  if (next) start(next, 0);
}

async function start(message, startMs) {
  const id = String(message.id);
  const url = message?.attachments?.[0];
  if (!url) return;

  stopVoicePlayback();

  const durationMs = knownDuration(id, url, message.audioDurationMs);
  const saved = getSnapshot(id).positionMs;
  // Reprendre là où l'écoute s'était arrêtée (sauf si on était à la fin)
  const resumeMs = startMs ?? (saved > 0 && (!durationMs || saved < durationMs - 300) ? saved : 0);

  const session = { id, url, player: null, sub: null, intent: true, started: false, timer: null };
  active = session;
  patch(id, { active: true, playing: true, loading: true, rate, positionMs: resumeMs, durationMs });

  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'duckOthers' });
  } catch (e) { /* le mode audio par défaut suffit */ }
  if (active !== session) return; // un autre vocal a été lancé entre-temps

  try {
    const player = createAudioPlayer(url, { updateInterval: 100 });
    session.player = player;

    session.sub = player.addListener('playbackStatusUpdate', (status) => {
      if (active !== session) return;
      const dur = Math.round((status?.duration || 0) * 1000);
      if (dur > 0) durationCache.set(url, dur);
      if (status?.didJustFinish) {
        finish(id);
        return;
      }
      if (status?.playing) session.started = true;
      const loading = session.intent && !status?.playing
        && (!status?.isLoaded || status?.isBuffering || !session.started);
      patch(id, {
        positionMs: session.started ? Math.round((status?.currentTime || 0) * 1000) : getSnapshot(id).positionMs,
        durationMs: dur || getSnapshot(id).durationMs,
        playing: session.intent && (!!status?.playing || loading),
        loading,
      });
    });

    session.timer = setTimeout(() => {
      if (active === session && !session.started) {
        stopVoicePlayback();
        errorHandler?.('Impossible de lire ce message vocal. Vérifiez votre connexion.');
      }
    }, LOAD_TIMEOUT_MS);

    if (rate !== 1) player.setPlaybackRate(rate);
    if (resumeMs > 0) await player.seekTo(resumeMs / 1000).catch(() => {});
    if (active !== session) return;
    player.play();
  } catch (e) {
    stopVoicePlayback();
    errorHandler?.('Impossible de lire ce message vocal.');
  }
}

export function toggleVoicePlayback(message) {
  const id = String(message?.id);
  if (active?.id === id && active.player) {
    const { player } = active;
    try {
      if (active.intent) {
        active.intent = false;
        player.pause();
        patch(id, { playing: false, loading: false });
      } else {
        active.intent = true;
        player.play();
        patch(id, { playing: true });
      }
      return;
    } catch (e) {
      stopVoicePlayback();
    }
  }
  if (active?.id === id) return; // chargement en cours
  start(message);
}

// ratio ∈ [0, 1] ; hors lecture, mémorise la position pour la prochaine écoute
export function seekVoicePlayback(message, ratio, fallbackDurationMs) {
  const id = String(message?.id);
  const url = message?.attachments?.[0];
  const durationMs = knownDuration(id, url, fallbackDurationMs);
  if (!durationMs) return;
  const target = Math.floor(durationMs * Math.max(0, Math.min(1, ratio)));
  patch(id, { positionMs: target });
  if (active?.id === id && active.player) {
    active.player.seekTo(target / 1000).catch(() => {});
  }
}

export function cycleVoicePlaybackRate() {
  rate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
  if (active?.player) {
    try { active.player.setPlaybackRate(rate); } catch (e) { /* appliqué à la prochaine lecture */ }
  }
  if (active) patch(active.id, { rate });
}

// ─── Pré-chargement de la durée (anciens messages sans durée enregistrée) ───
const probeQueue = [];
const probing = new Set();
let runningProbes = 0;

function probe(url) {
  return new Promise((resolve) => {
    let player;
    try {
      player = createAudioPlayer(url, { updateInterval: 250 });
    } catch (e) {
      resolve(0);
      return;
    }
    const startedAt = Date.now();
    const tick = setInterval(() => {
      let dur = 0;
      try { dur = player.isLoaded ? player.duration || 0 : 0; } catch (e) { dur = 0; }
      if (dur > 0 || Date.now() - startedAt > PROBE_TIMEOUT_MS) {
        clearInterval(tick);
        try { player.remove(); } catch (e) { /* déjà libéré */ }
        resolve(Math.round(dur * 1000));
      }
    }, 200);
  });
}

function pumpProbes() {
  while (runningProbes < PROBE_CONCURRENCY && probeQueue.length) {
    const { id, url } = probeQueue.shift();
    if (durationCache.has(url)) {
      patch(id, { durationMs: getSnapshot(id).durationMs || durationCache.get(url) });
      continue;
    }
    runningProbes += 1;
    probe(url).then((ms) => {
      runningProbes -= 1;
      probing.delete(url);
      if (ms > 0) {
        durationCache.set(url, ms);
        if (!getSnapshot(id).durationMs) patch(id, { durationMs: ms });
      }
      pumpProbes();
    });
  }
}

export function requestVoiceDuration(id, url) {
  if (!id || !url || getSnapshot(id).durationMs) return;
  const cached = durationCache.get(url);
  if (cached) {
    patch(id, { durationMs: cached });
    return;
  }
  if (probing.has(url)) return;
  probing.add(url);
  probeQueue.push({ id, url });
  pumpProbes();
}
