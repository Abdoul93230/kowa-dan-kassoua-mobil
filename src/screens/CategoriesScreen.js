// ─── Toutes les catégories ───────────────────────────────────────────────────
// Grille 2 colonnes, recherche instantanée (catégories + sous-catégories).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, RefreshControl, Pressable, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getCategories } from '../api/categories';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import PressableScale from '../components/home/PressableScale';
import { categoryEmoji } from '../components/home/CategoryRail';
import { SkeletonGroup, Bone } from '../components/home/Skeleton';

const GAP = 12;
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const countOf = (cat) => Number(cat?.totalCount ?? ((cat?.productsCount || 0) + (cat?.servicesCount || 0))) || 0;

function CategoryCard({ cat, width, onPress, query }) {
  const { theme, isDark } = useAppTheme();
  const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
  const count = countOf(cat);
  // Si la recherche correspond à une sous-catégorie, on la montre en premier
  const q = fold(query).trim();
  const ordered = q ? [...subs].sort((a, b) => Number(fold(b.name).includes(q)) - Number(fold(a.name).includes(q))) : subs;
  const preview = ordered.slice(0, 2).map((sub) => sub.name).join(', ');

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={[s.card, { width, backgroundColor: theme.surface, borderColor: theme.border }, !isDark && s.cardShadow]}
      accessibilityLabel={cat.name}
    >
      <View style={s.cardTop}>
        <View style={[s.emojiBox, { backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50 }]}>
          <Text style={s.emoji}>{categoryEmoji(cat)}</Text>
        </View>
        <View style={[s.countPill, { backgroundColor: theme.glass }]}>
          <Text style={[s.countTxt, { color: theme.textMuted }]}>{count}</Text>
        </View>
      </View>
      <Text style={[s.name, { color: theme.text }]} numberOfLines={2}>{cat.name}</Text>
      <Text style={[s.subs, { color: theme.textSoft }]} numberOfLines={1}>
        {preview ? `${preview}${subs.length > 2 ? ` +${subs.length - 2}` : ''}` : `${count} annonce${count > 1 ? 's' : ''}`}
      </Text>
    </PressableScale>
  );
}

export default function CategoriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark, theme } = useAppTheme();
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const cardW = (width - 32 - GAP) / 2;
  const accent = isDark ? P.amber : P.terra;

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getCategories();
      const list = Array.isArray(res?.data) ? res.data : [];
      setCategories(list);
      setStatus('ready');
    } catch (error) {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = useMemo(() => {
    const q = fold(query).trim();
    if (!q) return categories;
    return categories.filter((cat) =>
      fold(cat.name).includes(q) ||
      fold(cat.description).includes(q) ||
      (cat.subcategories || []).some((sub) => fold(sub.name).includes(q))
    );
  }, [categories, query]);

  const totalAds = useMemo(() => categories.reduce((acc, cat) => acc + countOf(cat), 0), [categories]);

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border }]}>
      <View style={s.headerRow}>
        <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9} style={[s.iconBtn, { backgroundColor: theme.glass }]} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color={theme.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.text }]}>Catégories</Text>
          <Text style={[s.subtitle, { color: theme.textSoft }]}>
            {status === 'ready' ? `${categories.length} univers · ${totalAds} annonces` : 'Chargement…'}
          </Text>
        </View>
      </View>
      <View style={[s.search, { backgroundColor: isDark ? theme.surface : 'rgba(17,24,39,0.05)', borderColor: query ? accent : 'transparent' }]}>
        <Feather name="search" size={17} color={query ? accent : theme.textSoft} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="Rechercher une catégorie…"
          placeholderTextColor={theme.textSoft}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer">
            <Feather name="x-circle" size={17} color={theme.textSoft} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>
      {header}

      {status === 'loading' ? (
        <SkeletonGroup>
          <View style={[s.list, s.skeleton]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Bone key={i} width={cardW} height={128} radius={20} style={{ marginBottom: GAP }} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item._id || item.slug)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: GAP }}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }, filtered.length === 0 && { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CategoryCard
              cat={item}
              width={cardW}
              query={query}
              onPress={() => navigation.navigate('CategoryProducts', { categorySlug: item.slug, categoryName: item.name })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories(); }} colors={[P.terra]} tintColor={P.terra} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.glass }]}>
                <Feather name={status === 'error' ? 'wifi-off' : 'search'} size={28} color={theme.textMuted} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {status === 'error' ? 'Connexion impossible' : `Aucune catégorie pour « ${query} »`}
              </Text>
              {status === 'error' ? (
                <PressableScale onPress={() => { setStatus('loading'); fetchCategories(); }} style={[s.emptyBtn, { backgroundColor: P.terra }]}>
                  <Text style={s.emptyBtnTxt}>Réessayer</Text>
                </PressableScale>
              ) : (
                <PressableScale
                  onPress={() => navigation.navigate('AllProducts', { q: query.trim() })}
                  style={[s.emptyBtn, { backgroundColor: P.terra }]}
                >
                  <Text style={s.emptyBtnTxt}>Chercher « {query.trim()} » dans les annonces</Text>
                </PressableScale>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 1 },
  search: { marginHorizontal: 16, height: 46, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 128 },
  cardShadow: { shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emojiBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 25 },
  countPill: { minWidth: 30, height: 24, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  countTxt: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800', marginTop: 12, letterSpacing: -0.2 },
  subs: { fontSize: 12, marginTop: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnTxt: { color: P.white, fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
