// ─── Page Recherche ──────────────────────────────────────────────────────────
// Ouverte depuis la loupe de l'accueil, en plein écran (au-dessus des onglets) :
// saisie au clavier, suggestions, recherches récentes, catégories et filtres.
// Valider mène à la page de résultats.

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SearchOverlay from '../components/SearchOverlay';
import FilterSheet from '../components/search/FilterSheet';
import { loadReferenceData } from '../components/search/ProductBrowser';
import { useAppTheme } from '../contexts/ThemeContext';
import { CITY_STORAGE_KEY, DEFAULT_FILTERS } from '../utils/searchFilters';

export default function SearchScreen({ navigation }) {
  const { theme } = useAppTheme();
  const [refData, setRefData] = useState({ categories: [], cities: [] });
  const [homeCity, setHomeCity] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadReferenceData().then(setRefData);
    AsyncStorage.getItem(CITY_STORAGE_KEY)
      .then((c) => setHomeCity(c && c !== 'all' ? c : ''))
      .catch(() => {});
  }, []);

  const cityFilter = homeCity ? { location: homeCity } : {};

  // Résultats : on remplace la page Recherche, le retour ramène à l'accueil
  const showResults = useCallback((params) => {
    navigation.replace('AllProducts', params);
  }, [navigation]);

  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>
      <SearchOverlay
        categories={refData.categories}
        navigation={navigation}
        onClose={() => navigation.goBack()}
        onSearch={(term) => showResults({ q: term, filters: cityFilter })}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={(filters) => showResults({ filters })}
        initialFilters={{ ...DEFAULT_FILTERS, ...cityFilter }}
        categories={refData.categories}
        cities={refData.cities}
        homeCity={homeCity}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
});
