// ─── API Produits — MarketHub Niger ─────────────────────────────────────────
// Gestion des produits/services (CRUD)

import api from './auth';

/**
 * Convertir un fichier image en base64
 */
export const imageToBase64 = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ Erreur conversion image:', error);
    throw error;
  }
};

/**
 * Convertir plusieurs images en base64
 */
export const imagesToBase64 = async (uris) => {
  try {
    const promises = uris.map(uri => imageToBase64(uri));
    return await Promise.all(promises);
  } catch (error) {
    console.error('❌ Erreur conversion images:', error);
    throw error;
  }
};

/**
 * Créer un nouveau produit/service
 */
export const createProduct = async (productData) => {
  try {
    const response = await api.post('/products', productData, { timeout: 180000 });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur création produit:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Le serveur prend trop de temps a repondre. Verifiez votre connexion puis reessayez.');
    }
    if (!error.response) {
      throw new Error('Erreur reseau. La requete a peut-etre abouti cote serveur. Verifiez Mes annonces avant de reessayer.');
    }
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la création de l\'annonce'
    );
  }
};

/**
 * Obtenir tous les produits avec filtres
 */
export const getProducts = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/products?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération produits:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération des produits'
    );
  }
};

/**
 * Obtenir un produit par ID
 */
export const getProductById = async (id) => {
  try {
    const response = await api.get(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération produit:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération du produit'
    );
  }
};

/**
 * Mettre à jour un produit
 */
export const updateProduct = async (id, productData) => {
  try {
    const response = await api.put(`/products/${id}`, productData, { timeout: 180000 });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur mise à jour produit:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Le serveur prend trop de temps a repondre. Verifiez votre connexion puis reessayez.');
    }
    if (!error.response) {
      throw new Error('Erreur reseau. La requete a peut-etre abouti cote serveur. Verifiez Mes annonces avant de reessayer.');
    }
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la mise à jour du produit'
    );
  }
};

/**
 * Supprimer un produit
 */
export const deleteProduct = async (id) => {
  try {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur suppression produit:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la suppression du produit'
    );
  }
};

/**
 * Obtenir mes annonces
 */
export const getMyProducts = async (status, page = 1, limit = 20) => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }
    
    const response = await api.get(`/products/my/listings?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération mes annonces:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération de vos annonces'
    );
  }
};

/**
 * Obtenir mes statistiques
 */
export const getMyStats = async () => {
  try {
    const response = await api.get('/products/my/stats');
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors de la récupération des statistiques'
    );
  }
};

/**
 * Toggle statut d'un produit (actif/inactif)
 */
export const toggleProductStatus = async (id) => {
  try {
    const response = await api.patch(`/products/${id}/toggle-status`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur toggle statut:', error);
    throw new Error(
      error.response?.data?.message || 
      'Erreur lors du changement de statut'
    );
  }
};
