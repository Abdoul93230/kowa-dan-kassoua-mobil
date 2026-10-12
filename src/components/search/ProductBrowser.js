// ─── ProductBrowser — grille d'annonces filtrable ────────────────────────────
// Utilisé par la recherche (AllProductsScreen) et les catégories
// (CategoryProductsScreen) : filtres, tri, puces actives, pagination infinie.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../api/auth';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useFavorites } from '../../hooks/useFavorites';
import { MOBILE_COLORS as P } from '../../theme/colors';
import { getProductId } from '../../utils/format';
import {
  CITY_STORAGE_KEY, DEFAULT_FILTERS, SORT_OPTIONS, activeFilterChips, countActiveFilters, filtersToParams, sortLabel,
} from '../../utils/searchFilters';
import ProductCard from '../home/ProductCard';
import PressableScale from '../home/PressableScale';
import { SkeletonGroup, Bone } from '../home/Skeleton';
import BottomSheet from '../BottomSheet';
import FilterSheet from './FilterSheet';
import SearchOverlay from '../SearchOverlay';

const PAGE_SIZE = 20;
const GAP = 12;

// Référentiels partagés (catégories, villes) : chargés une fois par session,
// ou fournis directement par l'accueil (aucun appel réseau supplémentaire)
let refCache = null;
export const seedReferenceData = ({ categories, cities }) => {
  refCache = { categories: Array.isArray(categories) ? categories : [], cities: Array.isArray(cities) ? cities : [] };
};
export const loadReferenceData = async () => {
  if (refCache) return refCache;
  const [cats, locs] = await Promise.all([
    apiClient.get('/categories').then((r) => r.data?.data || []).catch(() => []),
    apiClient.get('/products/locations').then((r) => r.data?.data || []).catch(() => []),
  ]);
  const cities = [...new Set((locs || []).map((l) => String(l || '').split(',')[0].trim()).filter(Boolean))].slice(0, 20);
  refCache = { categories: Array.isArray(cats) ? cats : [], cities };
  return refCache;
};

function GridSkeleton({ cardW }) {
  return (
    <SkeletonGroup>
      {[0, 1, 2].map((row) => (
        <View key={row} style={s.gridRow}>
          {[0, 1].map((col) => (
            <View key={col}>
              <Bone width={cardW} height={cardW * 1.02} radius={18} />
              <Bone width={cardW * 0.55} height={14} radius={6} style={{ marginTop: 10 }} />
              <Bone width={cardW * 0.9} height={12} radius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  );
}

export default function ProductBrowser({
  navigation,
  title,
  subtitle,
  emoji,
  searchable = false,
  initialQuery = '',
  initialFilters,
  locked = {},
  renderTop,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, isDark } = useAppTheme();
  const { favorites, toggleFavorite } = useFavorites();

  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refData, setRefData] = useState({ categories: [], cities: [] });
  const [homeCity, setHomeCity] = useState('');

  const requestId = useRef(0);
  const cardW = (width - 32 - GAP) / 2;
  const isService = filters.type === 'service';
  const accent = isService ? P.blue600 : (isDark ? P.amber : P.terra);
  const chips = useMemo(() => activeFilterChips(filters, locked), [filters, locked]);
  const activeCount = countActiveFilters(filters, locked);

  useEffect(() => {
    loadReferenceData().then(setRefData);
    AsyncStorage.getItem(CITY_STORAGE_KEY).then((c) => setHomeCity(c && c !== 'all' ? c : '')).catch(() => {});
  }, []);

  // ─── Chargement paginé (la dernière requête l'emporte) ─────────────────────
  const load = useCallback(async (pageToLoad, mode) => {
    const id = ++requestId.current;
    if (mode === 'more') setLoadingMore(true);
    try {
      const res = await apiClient.get('/products', {
        // Format « carte » : uniquement les champs affichés (réponse bien plus légère)
        params: { ...filtersToParams(filters, query), page: pageToLoad, limit: PAGE_SIZE, view: 'card' },
      });
      if (id !== requestId.current) return;
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setItems((prev) => {
        if (pageToLoad === 1) return list;
        const seen = new Set(prev.map(getProductId));
        return [...prev, ...list.filter((it) => !seen.has(getProductId(it)))];
      });
      setTotal(Number(res.data?.pagination?.total ?? list.length));
      setPage(pageToLoad);
      setStatus('ready');
    } catch (e) {
      if (id !== requestId.current) return;
      if (pageToLoad === 1) setStatus('error');
    } finally {
      if (id === requestId.current) { setLoadingMore(false); setRefreshing(false); }
    }
  }, [filters, query]);

  // Nouvelle recherche à chaque changement de filtres / texte
  useEffect(() => {
    setStatus('loading');
    load(1, 'reset');
  }, [load]);

  const loadMore = () => {
    if (status !== 'ready' || loadingMore || items.length >= total) return;
    load(page + 1, 'more');
  };

  const onRefresh = () => { setRefreshing(true); load(1, 'refresh'); };
  const patchFilters = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const clearFilters = () => setFilters((prev) => ({
    ...DEFAULT_FILTERS,
    sort: prev.sort,
    ...(locked.categorySlug ? { categorySlug: prev.categorySlug, categoryName: prev.categoryName } : {}),
    ...(locked.type ? { type: prev.type } : {}),
  }));

  const openProduct = useCallback((item) => navigation.navigate('ProductDetail', { productId: getProductId(item), preview: item }), [navigation]);

  // ─── En-tête ────────────────────────────────────────────────────────────────
  const header = (
    <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border }]}>
      <View style={s.headerRow}>
        <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9} style={[s.iconBtn, { backgroundColor: theme.glass }]} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color={theme.text} />
        </PressableScale>

        {searchable ? (
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [s.searchPill, { backgroundColor: isDark ? theme.surface : 'rgba(17,24,39,0.05)' }, pressed && { opacity: 0.8 }]}
            accessibilityRole="search"
          >
            <Feather name="search" size={17} color={query ? accent : theme.textSoft} />
            <Text style={[s.searchTxt, { color: query ? theme.text : theme.textSoft }, query && { fontWeight: '700' }]} numberOfLines={1}>
              {query || 'Rechercher une annonce'}
            </Text>
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
                <Feather name="x-circle" size={17} color={theme.textSoft} />
              </Pressable>
            ) : null}
          </Pressable>
        ) : (
          <View style={s.titleBox}>
            <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{emoji ? `${emoji}  ` : ''}{title}</Text>
            {subtitle ? <Text style={[s.subtitle, { color: theme.textSoft }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        )}
      </View>

      {renderTop ? renderTop({ filters, patchFilters, accent }) : null}

      {/* Barre d'outils : filtres, tri, puces actives */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbar} keyboardShouldPersistTaps="handled">
        <PressableScale onPress={() => setFiltersOpen(true)} scaleTo={0.94} style={[s.toolBtn, { backgroundColor: activeCount ? accent : theme.glass }]} accessibilityLabel="Filtres">
          <Feather name="sliders" size={15} color={activeCount ? P.white : theme.text} />
          <Text style={[s.toolTxt, { color: activeCount ? P.white : theme.text }]}>Filtres</Text>
          {activeCount ? (
            <View style={s.toolBadge}><Text style={[s.toolBadgeTxt, { color: accent }]}>{activeCount}</Text></View>
          ) : null}
        </PressableScale>

        <PressableScale onPress={() => setSortOpen(true)} scaleTo={0.94} style={[s.toolBtn, { backgroundColor: theme.glass }]} accessibilityLabel="Trier">
          <Feather name="bar-chart-2" size={15} color={theme.text} />
          <Text style={[s.toolTxt, { color: theme.text }]}>{sortLabel(filters.sort)}</Text>
          <Feather name="chevron-down" size={14} color={theme.textSoft} />
        </PressableScale>

        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => patchFilters(chip.reset)}
            style={({ pressed }) => [s.activeChip, { borderColor: accent, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : P.white }, pressed && { opacity: 0.6 }]}
            accessibilityLabel={`Retirer le filtre ${chip.label}`}
          >
            {chip.icon ? <Feather name={chip.icon} size={12} color={accent} /> : null}
            <Text style={[s.activeTxt, { color: accent }]} numberOfLines={1}>{chip.label}</Text>
            <Feather name="x" size={13} color={accent} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // ─── Contenu ────────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <ProductCard
      item={item}
      width={cardW}
      isFavorite={favorites.has(getProductId(item))}
      onPress={() => openProduct(item)}
      onToggleFavorite={() => toggleFavorite(item)}
    />
  ), [cardW, favorites, openProduct, toggleFavorite]);

  const listHeader = status === 'ready' ? (
    <Text style={[s.count, { color: theme.textMuted }]}>
      <Text style={{ color: theme.text, fontWeight: '800' }}>{total}</Text> résultat{total > 1 ? 's' : ''}
      {query ? <Text>{` pour « ${query} »`}</Text> : null}
    </Text>
  ) : null;

  const empty = status === 'error' ? (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: theme.glass }]}><Feather name="wifi-off" size={28} color={theme.textMuted} /></View>
      <Text style={[s.emptyTitle, { color: theme.text }]}>Connexion impossible</Text>
      <Text style={[s.emptySub, { color: theme.textMuted }]}>Vérifiez votre connexion internet puis réessayez.</Text>
      <PressableScale onPress={() => { setStatus('loading'); load(1, 'reset'); }} style={[s.emptyBtn, { backgroundColor: accent }]}>
        <Text style={s.emptyBtnTxt}>Réessayer</Text>
      </PressableScale>
    </View>
  ) : status === 'ready' ? (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50 }]}><Feather name="search" size={28} color={accent} /></View>
      <Text style={[s.emptyTitle, { color: theme.text }]}>Aucun résultat</Text>
      <Text style={[s.emptySub, { color: theme.textMuted }]}>
        {activeCount ? 'Essayez d\'élargir vos filtres ou de changer de mots-clés.' : 'Rien pour le moment ici. Revenez bientôt ou publiez la première annonce !'}
      </Text>
      {activeCount ? (
        <PressableScale onPress={clearFilters} style={[s.emptyBtn, { backgroundColor: accent }]}>
          <Text style={s.emptyBtnTxt}>Effacer les filtres</Text>
        </PressableScale>
      ) : (
        <PressableScale onPress={() => navigation.navigate('MainTabs', { screen: 'Publish' })} style={[s.emptyBtn, { backgroundColor: accent }]}>
          <Text style={s.emptyBtnTxt}>Publier une annonce</Text>
        </PressableScale>
      )}
    </View>
  ) : null;

  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>
      {header}

      {status === 'loading' ? (
        <View style={s.listPad}><GridSkeleton cardW={cardW} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={getProductId}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={[s.listPad, { paddingBottom: insets.bottom + 32 }, items.length === 0 && { flexGrow: 1 }]}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={accent} style={{ marginVertical: 18 }} /> : null}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accent]} tintColor={accent} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => setFilters(next)}
        initialFilters={filters}
        query={query}
        locked={locked}
        categories={refData.categories}
        cities={refData.cities}
        homeCity={homeCity}
      />

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Text style={[s.sortTitle, { color: theme.text }]}>Trier par</Text>
        {SORT_OPTIONS.map((opt) => {
          const active = filters.sort === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => { patchFilters({ sort: opt.key }); setSortOpen(false); }}
              style={({ pressed }) => [s.sortRow, pressed && { backgroundColor: theme.glass }]}
            >
              <View style={[s.sortIcon, { backgroundColor: active ? accent : theme.glass }]}>
                <Feather name={opt.icon} size={16} color={active ? P.white : theme.textMuted} />
              </View>
              <Text style={[s.sortTxt, { color: theme.text }, active && { fontWeight: '800' }]}>{opt.label}</Text>
              {active ? <Feather name="check" size={18} color={accent} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>

      {searchOpen ? (
        <SearchOverlay
          initialQuery={query}
          categories={refData.categories}
          navigation={navigation}
          onClose={() => setSearchOpen(false)}
          onSearch={(term) => { setQuery(term); setSearchOpen(false); }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchPill: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchTxt: { flex: 1, fontSize: 15 },
  titleBox: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { fontSize: 12.5, marginTop: 1 },
  toolbar: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'center' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 999 },
  toolTxt: { fontSize: 13, fontWeight: '700' },
  toolBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: P.white, alignItems: 'center', justifyContent: 'center' },
  toolBadgeTxt: { fontSize: 10.5, fontWeight: '900' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.2, maxWidth: 200 },
  activeTxt: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  listPad: { paddingHorizontal: 16, paddingTop: 12 },
  gridRow: { justifyContent: 'space-between', marginBottom: GAP },
  count: { fontSize: 13.5, marginBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  emptyBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnTxt: { color: P.white, fontSize: 14, fontWeight: '800' },
  sortTitle: { fontSize: 20, fontWeight: '900', paddingHorizontal: 20, marginBottom: 8 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 11 },
  sortIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sortTxt: { flex: 1, fontSize: 15 },
});
