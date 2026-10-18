import api from './auth';

// Motifs proposés (mêmes clés que le backend)
export const REPORT_REASONS = [
  { value: 'nudity', label: 'Nudité ou contenu sexuel', icon: 'eye-off-outline' },
  { value: 'scam', label: 'Arnaque ou fraude', icon: 'warning-outline' },
  { value: 'prohibited', label: 'Produit ou service interdit', icon: 'ban-outline' },
  { value: 'offensive', label: 'Contenu choquant ou haineux', icon: 'sad-outline' },
  { value: 'misleading', label: 'Annonce trompeuse ou incohérente', icon: 'help-circle-outline' },
  { value: 'duplicate', label: 'Doublon ou spam', icon: 'copy-outline' },
  { value: 'other', label: 'Autre', icon: 'ellipsis-horizontal-circle-outline' },
];

/**
 * Signaler une annonce (connexion requise)
 */
export const reportProduct = async (productId, reason, details = '') => {
  try {
    const response = await api.post('/reports', { productId, reason, details });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Impossible d\'envoyer le signalement');
  }
};
