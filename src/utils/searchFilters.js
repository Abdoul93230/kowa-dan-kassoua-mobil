// ─── Filtres de recherche partagés (accueil, recherche, catégories) ──────────

export const CITY_STORAGE_KEY = 'taktak_home_city';

export const SORT_OPTIONS = [
  { key: '-createdAt', label: 'Plus récentes', icon: 'clock' },
  { key: 'price', label: 'Prix croissant', icon: 'trending-up' },
  { key: '-price', label: 'Prix décroissant', icon: 'trending-down' },
  { key: '-views', label: 'Plus populaires', icon: 'eye' },
];

export const TYPE_OPTIONS = [
  { key: 'all', label: 'Tout' },
  { key: 'product', label: 'Produits' },
  { key: 'service', label: 'Services' },
];

export const CONDITION_OPTIONS = [
  { key: 'new', label: 'Neuf' },
  { key: 'used', label: 'Occasion' },
  { key: 'refurbished', label: 'Reconditionné' },
];

export const PRICE_PRESETS = [
  { label: '< 5 000', min: '', max: '5000' },
  { label: '5 000 – 25 000', min: '5000', max: '25000' },
  { label: '25 000 – 100 000', min: '25000', max: '100000' },
  { label: '100 000 – 500 000', min: '100000', max: '500000' },
  { label: '> 500 000', min: '500000', max: '' },
];

export const DEFAULT_FILTERS = Object.freeze({
  type: 'all',
  categorySlug: '',
  categoryName: '',
  subcategory: '',
  condition: '',
  location: '',
  minPrice: '',
  maxPrice: '',
  sort: '-createdAt',
});

const groupThousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const shortPrice = (v) => {
  const n = Number(v);
  if (n >= 1000000) return `${String(n / 1000000).replace('.', ',')} M`;
  if (n >= 1000) return `${groupThousands(Math.round(n / 1000))}k`;
  return String(n);
};

// Paramètres envoyés à GET /products
export const filtersToParams = (filters, q) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const params = { sort: f.sort };
  if (q && String(q).trim()) params.search = String(q).trim();
  if (f.type && f.type !== 'all') params.type = f.type;
  if (f.categorySlug) params.categorySlug = f.categorySlug;
  if (f.subcategory) params.subcategory = f.subcategory;
  if (f.condition) params.condition = f.condition;
  if (f.location) params.location = f.location;
  if (f.minPrice) params.minPrice = f.minPrice;
  if (f.maxPrice) params.maxPrice = f.maxPrice;
  return params;
};

export const priceLabel = (min, max) => {
  if (min && max) return `${shortPrice(min)} – ${shortPrice(max)} F`;
  if (min) return `≥ ${shortPrice(min)} F`;
  if (max) return `≤ ${shortPrice(max)} F`;
  return '';
};

// Puces "filtres actifs" (supprimables). `locked` = filtres imposés par l'écran (ex : catégorie)
export const activeFilterChips = (filters, locked = {}) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const chips = [];
  if (f.type !== 'all' && !locked.type) {
    chips.push({ key: 'type', label: f.type === 'service' ? 'Services' : 'Produits', reset: { type: 'all' } });
  }
  if (f.categorySlug && !locked.categorySlug) {
    chips.push({ key: 'category', label: f.categoryName || f.categorySlug, reset: { categorySlug: '', categoryName: '', subcategory: '' } });
  }
  if (f.location) chips.push({ key: 'location', label: f.location, icon: 'map-pin', reset: { location: '' } });
  if (f.condition) {
    chips.push({ key: 'condition', label: CONDITION_OPTIONS.find((c) => c.key === f.condition)?.label || f.condition, reset: { condition: '' } });
  }
  if (f.minPrice || f.maxPrice) chips.push({ key: 'price', label: priceLabel(f.minPrice, f.maxPrice), reset: { minPrice: '', maxPrice: '' } });
  return chips;
};

export const countActiveFilters = (filters, locked) => activeFilterChips(filters, locked).length;

export const sortLabel = (key) => SORT_OPTIONS.find((o) => o.key === key)?.label || 'Plus récentes';
