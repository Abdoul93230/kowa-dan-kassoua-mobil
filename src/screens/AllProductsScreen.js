// ─── Résultats de recherche / toutes les annonces ────────────────────────────
// Paramètres acceptés : { q, filters } ou l'ancien format { q, type, location }.

import React from 'react';
import ProductBrowser from '../components/search/ProductBrowser';
import { DEFAULT_FILTERS } from '../utils/searchFilters';

export default function AllProductsScreen({ route, navigation }) {
  const params = route?.params || {};
  const initialFilters = {
    ...DEFAULT_FILTERS,
    ...(params.type ? { type: params.type } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.filters || {}),
  };

  return (
    <ProductBrowser
      // Remonte le composant si l'écran est rouvert avec d'autres paramètres
      key={JSON.stringify(params)}
      navigation={navigation}
      searchable
      initialQuery={params.q || ''}
      initialFilters={initialFilters}
    />
  );
}
