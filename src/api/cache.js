// ─── Cache client « stale-while-revalidate » ─────────────────────────────────
// Les écrans affichent immédiatement la dernière version connue (mémoire, ou disque
// au démarrage de l'app), puis la rafraîchissent en arrière-plan. Les requêtes
// identiques lancées en même temps sont fusionnées en une seule.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'swr:v1:';
const memory = new Map();   // clé -> { data, at }
const inflight = new Map(); // clé -> Promise

// Lecture synchrone (mémoire uniquement) : pour un premier rendu sans attente
export function peekCache(key) {
  return memory.get(key) || null;
}

// Lecture mémoire puis disque
export async function readCache(key) {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry && 'data' in entry) {
      memory.set(key, entry);
      return entry;
    }
  } catch (e) {
    // cache illisible : ignoré
  }
  return null;
}

export function writeCache(key, data, { persist = false } = {}) {
  const entry = { data, at: Date.now() };
  memory.set(key, entry);
  if (persist) {
    AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry)).catch(() => {});
  }
  return entry;
}

export function clearCache(prefix = '') {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

// Exécute `fetcher` une seule fois pour toutes les demandes simultanées de la même clé
export function dedupe(key, fetcher) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve()
    .then(fetcher)
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Renvoie la donnée en cache si elle a moins de `maxAgeMs`, sinon la recharge.
 * `persist` : conserve aussi la donnée sur le disque (affichage instantané au prochain lancement).
 */
export async function fetchCached(key, fetcher, { maxAgeMs = 60000, persist = false } = {}) {
  const hit = await readCache(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  return dedupe(key, async () => {
    const data = await fetcher();
    writeCache(key, data, { persist });
    return data;
  });
}
