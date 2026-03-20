// ─── API Favoris — MarketHub Niger ─────────────────────────────────────────
// Gestion des favoris (ajout, suppression, liste)

import api from './auth';

/**
 * Ajouter un produit aux favoris
 */
export const addFavorite = async (productId) => {
  try {
    const response = await api.post(`/favorites/${productId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur ajout favori:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de l\'ajout aux favoris'
    );
  }
};

/**
 * Retirer un produit des favoris
 */
export const removeFavorite = async (productId) => {
  try {
    const response = await api.delete(`/favorites/${productId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur suppression favori:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la suppression du favori'
    );
  }
};

/**
 * Obtenir mes favoris
 */
export const getMyFavorites = async (page = 1, limit = 20) => {
  try {
    const response = await api.get(`/favorites?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération favoris:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération des favoris'
    );
  }
};

/**
 * Obtenir les IDs des favoris (pour vérification rapide)
 */
export const getFavoriteIds = async () => {
  try {
    const response = await api.get('/favorites/ids');
    return response.data.data || [];
  } catch (error) {
    console.error('❌ Erreur récupération IDs favoris:', error);
    // Retourner un tableau vide en cas d'erreur
    return [];
  }
};

/**
 * Vérifier si un produit est dans mes favoris
 */
export const checkFavorite = async (productId) => {
  try {
    const response = await api.get(`/favorites/check/${productId}`);
    return response.data.data?.isFavorite || false;
  } catch (error) {
    console.error('❌ Erreur vérification favori:', error);
    return false;
  }
};

/**
 * Toggle favori (ajouter ou retirer)
 */
export const toggleFavorite = async (productId, isFavorite) => {
  if (isFavorite) {
    return await removeFavorite(productId);
  } else {
    return await addFavorite(productId);
  }
};
