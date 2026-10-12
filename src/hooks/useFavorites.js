// ─── Favoris partagés entre tous les écrans ──────────────────────────────────
// Un seul état en mémoire : un cœur ajouté sur l'accueil apparaît aussi dans
// la recherche et les catégories, sans recharger.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getFavoriteIds, toggleFavorite as apiToggleFavorite } from '../api/favorites';
import { useAuth } from '../contexts/AuthContext';
import { getProductId } from '../utils/format';

let favoriteIds = new Set();
let loadedForUser = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(favoriteIds));
const setIds = (next) => { favoriteIds = next; emit(); };

export function useFavorites() {
  const navigation = useNavigation();
  const { isAuthenticated, user } = useAuth();
  const [ids, setLocalIds] = useState(favoriteIds);
  const userKey = isAuthenticated ? String(user?.id || 'me') : null;

  useEffect(() => {
    listeners.add(setLocalIds);
    return () => listeners.delete(setLocalIds);
  }, []);

  const refresh = useCallback(async () => {
    if (!userKey) { setIds(new Set()); loadedForUser = null; return; }
    const list = await getFavoriteIds();
    setIds(new Set((list || []).map(String)));
    loadedForUser = userKey;
  }, [userKey]);

  // Chargement unique par utilisateur (et remise à zéro à la déconnexion)
  useEffect(() => {
    if (loadedForUser !== userKey) refresh();
  }, [userKey, refresh]);

  const toggle = useCallback(async (item) => {
    const id = getProductId(item);
    if (!id) return;
    if (!userKey) {
      navigation.navigate('QuickAuth', { pendingAction: { type: 'favorites' } });
      return;
    }
    const wasFavorite = favoriteIds.has(id);
    const apply = (add) => {
      const next = new Set(favoriteIds);
      if (add) next.add(id); else next.delete(id);
      setIds(next);
    };
    apply(!wasFavorite); // Mise à jour optimiste
    try {
      await apiToggleFavorite(id, wasFavorite);
    } catch (e) {
      apply(wasFavorite); // Retour arrière si l'API échoue
    }
  }, [userKey, navigation]);

  // Référence stable : les cartes mémorisées gardent toujours la version à jour
  // (sinon, après connexion, une carte non re-rendue garderait l'ancien comportement)
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  const stableToggle = useCallback((item) => toggleRef.current(item), []);

  return { favorites: ids, toggleFavorite: stableToggle, refreshFavorites: refresh };
}
