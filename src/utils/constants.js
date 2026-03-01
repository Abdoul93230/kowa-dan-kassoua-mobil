// Configuration de l'application

// URL de l'API backend
// En développement, utiliser l'IP locale de votre machine (pas localhost)
// Exemple: si backend sur http://localhost:5000, utiliser http://192.168.1.X:5000
export const API_BASE_URL = 'https://kowa-dan-kassoua-backend.onrender.com/api'; // À MODIFIER avec votre IP

// Configuration Socket.IO
export const SOCKET_URL = 'https://kowa-dan-kassoua-backend.onrender.com/api'; // À MODIFIER avec votre IP

// Couleurs de l'app (identique au web)
export const COLORS = {
  primary: '#ec5a13',
  primaryDark: '#d94f0f',
  secondary: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#000000',
};

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
