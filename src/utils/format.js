// ─── Formatage partagé (prix, dates, villes) ──────────────────────────────────
import { PixelRatio } from 'react-native';

// Séparateur de milliers manuel : Intl n'est pas garanti sur tous les moteurs JS Android
const groupThousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const formatPrice = (price) => {
  const digits = String(price ?? '').replace(/[^\d]/g, '');
  const n = Number(digits);
  if (!digits || !Number.isFinite(n) || n < 0) return 'Prix à discuter';
  if (n === 0) return 'Gratuit'; // annonce publiée à 0 F
  return `${groupThousands(n)} FCFA`;
};

export const formatCompact = (num) => {
  const n = Number(num) || 0;
  if (n < 1000) return String(n);
  if (n < 10000) return `${(Math.floor(n / 100) / 10).toString().replace('.', ',')}k`;
  return `${Math.floor(n / 1000)}k`;
};

export const getCityName = (location) => {
  if (!location) return 'Niger';
  return String(location).split(',')[0].trim() || 'Niger';
};

export const timeAgo = (dateValue) => {
  if (!dateValue) return 'Récent';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Récent';

  const mins = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} j`;
  return `${Math.floor(days / 7)} sem`;
};

export const getProductId = (item) => String(item?.id || item?._id || '');

// ─── Images à la bonne taille ────────────────────────────────────────────────
// Cloudinary redimensionne à la volée selon l'URL : une carte de 170 px n'a pas besoin
// de l'image de 800 px (≈ 3× moins de données, décodage et mémoire réduits).
// Quelques paliers fixes seulement, pour que chaque variante soit générée une fois puis servie en cache CDN.
const CLOUDINARY_UPLOAD = '/image/upload/';
const WIDTH_STEPS = [96, 192, 320, 480, 720, 1080];

export const sizedImage = (url, displayWidth) => {
  if (!url || !displayWidth || typeof url !== 'string') return url || null;
  if (!url.includes('res.cloudinary.com') || !url.includes(CLOUDINARY_UPLOAD)) return url;
  const pixels = displayWidth * Math.min(PixelRatio.get(), 3);
  const step = WIDTH_STEPS.find((w) => w >= pixels) || WIDTH_STEPS[WIDTH_STEPS.length - 1];
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}c_limit,w_${step},f_auto,q_auto/`);
};

// `displayWidth` (facultatif) : largeur affichée, pour charger une image à la bonne taille
export const getProductImage = (item, displayWidth) =>
  sizedImage(item?.mainImage || item?.images?.[0] || null, displayWidth);

export const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : String(name).substring(0, 2).toUpperCase();
};
