// ─── API Produits — TakTak ─────────────────────────────────────────
// Gestion des produits/services (CRUD)

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import api from './auth';

// Le serveur réduit toutes les images à 800 px : inutile d'envoyer une photo de 12 Mpx.
// Redimensionner sur le téléphone divise le poids de l'envoi par ~20 (≈ 4 Mo → ≈ 150 Ko).
const UPLOAD_MAX_SIDE = 1080;
const UPLOAD_QUALITY = 0.7;

export const compressToBase64 = async (uri, maxSide = UPLOAD_MAX_SIDE) => {
  const context = ImageManipulator.manipulate(uri);
  const original = await context.renderAsync();
  const { width, height } = original;
  if (Math.max(width, height) > maxSide) {
    context.resize(width >= height ? { width: maxSide } : { height: maxSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: UPLOAD_QUALITY, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${saved.base64}`;
};

/**
 * Convertir un fichier image en base64 (compressé et redimensionné pour l'envoi)
 */
export const imageToBase64 = async (uri) => {
  // Photo locale : compression sur le téléphone ; en cas d'échec, envoi de l'original
  if (uri && !/^(https?:|data:)/.test(uri)) {
    try {
      return await compressToBase64(uri);
    } catch (e) {
      console.warn('Compression image impossible, envoi de l\'original:', e?.message);
    }
  }

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
    // Une image à la fois : décoder 10 photos de 12 Mpx en parallèle sature la mémoire des téléphones d'entrée de gamme
    const results = [];
    for (const uri of uris) {
      results.push(await imageToBase64(uri));
    }
    return results;
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
export const getMyProducts = async (status, page = 1, limit = 20, { type, search } = {}) => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      params.append('status', status);
    }
    if (type) {
      params.append('type', type);
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
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
 * Marquer une annonce comme vendue
 */
export const markProductSold = async (id) => {
  try {
    const response = await api.patch(`/products/${id}/mark-sold`);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur marquer vendu:', error);
    throw new Error(
      error.response?.data?.message ||
      'Impossible de marquer l\'annonce comme vendue'
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
