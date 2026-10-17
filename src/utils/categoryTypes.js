// ─── Produit ou service : quelles catégories proposer ? ──────────────────────
// Chaque sous-catégorie indique ce qu'on peut y publier : 'product', 'service'
// ou les deux. Une catégorie est proposée si au moins une de ses
// sous-catégories accepte le type choisi. Si la base fournit un champ `types`,
// il est prioritaire sur cette table.
// Clé : 'categorie/sous-categorie' (slugs). Absent de la table = les deux.

const P = ['product'];
const S = ['service'];

export const SUBCATEGORY_TYPES = {
  // Alimentation
  'alimentation-produits-frais/epicerie': P,
  'alimentation-produits-frais/legumes': P,
  'alimentation-produits-frais/cereales': P,
  'alimentation-produits-frais/boucherie': P,
  'alimentation-produits-frais/kilishi': P,
  'alimentation-produits-frais/poisson': P,
  'alimentation-produits-frais/poisson-fume': P,
  'alimentation-produits-frais/supermarche': P,

  // Mode & Beauté
  'habillement-beaute/tissus-pagnes': P,
  'habillement-beaute/friperie': P,
  'habillement-beaute/tailleur': S,
  'habillement-beaute/cosmetiques': P,
  'habillement-beaute/coiffure': S,

  // Électronique
  'telephonie-materiel-electronique/mobile-money': S,
  'telephonie-materiel-electronique/reparation': S,
  'telephonie-materiel-electronique/electronique-info': P,

  // Transport & énergie
  'transport-mecanique-energie/motos': P,
  'transport-mecanique-energie/mecanique-auto': S,
  'transport-mecanique-energie/gaz': P,

  // Maison
  'maison-bricolage/quincaillerie': P,
  'maison-bricolage/ameublement': P,

  // Agro & Élevage
  'produits-agricoles-d-elevage/betail': P,
  'produits-agricoles-d-elevage/aliments-betail': P,
  'produits-agricoles-d-elevage/intrants-outils': P,

  // Santé & Loisirs
  'sante-education-loisirs/pharmacie': P,
  'sante-education-loisirs/pharmacopee': P,
  'sante-education-loisirs/librairie': P,

  // Proximité
  'petits-commerces/essence': P,
  'petits-commerces/kiosque-a-the': P,
  'petits-commerces/eau-jus': P,
  'petits-commerces/pressing': S,
  'petits-commerces/taxi': S,
  'petits-commerces/taxi-moto': S,
  'petits-commerces/tresseuse': S,

  // Immobilier : vendre une maison ou une parcelle est un bien ; l'agent immobilier est un service
  'immobilier/vente-maisons': P,
  'immobilier/parcelles': P,
  'immobilier/demarcheur': S,
};

// Catégories entièrement consacrées aux services (toutes leurs sous-catégories)
const SERVICE_CATEGORIES = new Set(['prestation-intellectuelle', 'livraison']);

const BOTH = ['product', 'service'];

export function subcategoryTypes(sub, categorySlug) {
  if (Array.isArray(sub?.types) && sub.types.length) return sub.types;
  if (SERVICE_CATEGORIES.has(categorySlug)) return S;
  return SUBCATEGORY_TYPES[`${categorySlug}/${sub?.slug}`] || BOTH;
}

export const subcategoryAllows = (sub, categorySlug, type) =>
  !type || subcategoryTypes(sub, categorySlug).includes(type);

export function categoryAllows(category, type) {
  if (!type || !category) return true;
  if (Array.isArray(category.types) && category.types.length) return category.types.includes(type);
  const subs = Array.isArray(category.subcategories) ? category.subcategories : [];
  if (!subs.length) return !SERVICE_CATEGORIES.has(category.slug) || type === 'service';
  return subs.some((sub) => subcategoryAllows(sub, category.slug, type));
}

// Catégories et sous-catégories utilisables pour ce type d'annonce
export function filterCategoriesForType(categories, type) {
  return (categories || [])
    .filter((cat) => categoryAllows(cat, type))
    .map((cat) => ({
      ...cat,
      subcategories: (cat.subcategories || []).filter((sub) => subcategoryAllows(sub, cat.slug, type)),
    }));
}
