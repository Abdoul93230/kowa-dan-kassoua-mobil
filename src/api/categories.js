// ─── API Catégories — MarketHub Niger ───────────────────────────────────────
// Récupération des catégories et sous-catégories

import api from './auth';

/**
 * Obtenir toutes les catégories
 */
export const getCategories = async () => {
  try {
    const response = await api.get('/categories');
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération catégories:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération des catégories'
    );
  }
};

/**
 * Obtenir une catégorie par slug
 */
export const getCategoryBySlug = async (slug) => {
  try {
    const response = await api.get(`/categories/${slug}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération catégorie:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération de la catégorie'
    );
  }
};
