// Configuration de l'application

import { COLORS } from '../theme/colors';

// URL de l'API backend
// En développement, utiliser l'IP locale de votre machine (pas localhost)
// Exemple: si backend sur http://localhost:5000, utiliser http://192.168.1.X:5000
export const API_BASE_URL = 'https://kowa-dan-kassoua-backend.onrender.com/api'; // À MODIFIER avec votre IP

// Configuration Socket.IO
export const SOCKET_URL = 'https://kowa-dan-kassoua-backend.onrender.com'; // À MODIFIER avec votre IP

// Couleurs centralisees (source unique)
export { COLORS };

// Catégories (avec emojis comme sur le web)
export const CATEGORIES = [
  { id: '1', name: 'Électronique', emoji: '📱', slug: 'electronique' },
  { id: '2', name: 'Alimentation', emoji: '🍔', slug: 'alimentation' },
  { id: '3', name: 'Immobilier', emoji: '🏠', slug: 'immobilier' },
  { id: '4', name: 'Véhicules', emoji: '🚗', slug: 'vehicules' },
  { id: '5', name: 'Mode & Beauté', emoji: '👕', slug: 'mode-beaute' },
  { id: '6', name: 'Maison & Jardin', emoji: '🔧', slug: 'maison-jardin' },
  { id: '7', name: 'Loisirs', emoji: '🏡', slug: 'loisirs' },
  { id: '8', name: 'Services', emoji: '💼', slug: 'services' },
  { id: '9', name: 'Multimédia', emoji: '🎮', slug: 'multimedia' },
  { id: '10', name: 'Emploi', emoji: '🏗️', slug: 'emploi' },
];

// Types de produits
export const PRODUCT_TYPES = {
  PRODUCT: 'product',
  SERVICE: 'service',
};

// Statuts de produits
export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  SOLD: 'sold',
  EXPIRED: 'expired',
};

// Limites
export const LIMITS = {
  MAX_IMAGES: 5,
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_COMMENT_LENGTH: 1000,
};
