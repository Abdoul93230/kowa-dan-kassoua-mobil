// ─── SearchOverlay — recherche plein écran ───────────────────────────────────
// Vide : recherches récentes + catégories rapides.
// En saisie : "Rechercher « … »", catégories et annonces correspondantes,
// avec mise en évidence du texte tapé (insensible aux accents).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import { apiClient } from '../api/auth';
import { formatPrice, getCityName, sizedImage } from '../utils/format';
import CategoryIcon from './CategoryIcon';

const STORAGE_KEY = 'taktak_recent_searches';
const MAX_RECENT = 8;
const DEBOUNCE_MS = 250;

const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Met en gras la partie qui correspond à la saisie
function Highlight({ text, query, style, strongColor }) {
  const idx = fold(text).indexOf(fold(query).trim());
  if (!query || idx < 0) return <Text style={style} numberOfLines={1}>{text}</Text>;
  const end = idx + query.trim().length;
  return (
    <Text style={style} numberOfLines={1}>
      {text.slice(0, idx)}
      <Text style={{ fontWeight: '800', color: strongColor }}>{text.slice(idx, end)}</Text>
      {text.slice(end)}
    </Text>
  );
}

function SectionTitle({ children, action, onAction }) {
  const { theme, isDark } = useAppTheme();
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { color: theme.textSoft }]}>{children}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[s.sectionAction, { color: isDark ? P.amber : P.terra }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const SearchOverlay = ({ initialQuery = '', onSearch, onClose, navigation, categories = [], onOpenFilters }) => {
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const accent = isDark ? P.amber : P.terra;

  const [query, setQuery] = useState(initialQuery);
  const [recent, setRecent] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const requestId = useRef(0);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setRecent(JSON.parse(raw)); })
      .catch(() => {});
  }, [enter]);

  // Suggestions avec anti-rebond ; seule la dernière réponse est affichée
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions(null); setLoading(false); return undefined; }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/search/suggestions', { params: { q } });
        if (id === requestId.current) setSuggestions(res.data?.success ? res.data.data : null);
      } catch (e) {
        if (id === requestId.current) setSuggestions(null);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const persistRecent = (list) => {
    setRecent(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  };

  const submit = useCallback((term) => {
    const value = String(term ?? query).trim();
    if (!value) return;
    Keyboard.dismiss();
    persistRecent([value, ...recent.filter((r) => fold(r) !== fold(value))].slice(0, MAX_RECENT));
    onSearch(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, recent, onSearch]);

  const close = () => {
    Keyboard.dismiss();
    Animated.timing(enter, { toValue: 0, duration: 150, useNativeDriver: true }).start(onClose);
  };

  const openCategory = (cat) => {
    onClose();
    navigation.navigate('CategoryProducts', { categorySlug: cat.slug, categoryName: cat.name });
  };

  const openProduct = (product) => {
    onClose();
    navigation.navigate('ProductDetail', { productId: product.id, preview: product });
  };

  const q = query.trim();
  const hasResults = suggestions && (suggestions.categories?.length || suggestions.products?.length || suggestions.popular?.length);

  return (
    <Animated.View
      style={[
        s.overlay,
        { backgroundColor: theme.screen, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      {/* ── Barre de saisie ── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border, backgroundColor: isDark ? theme.screen : theme.surface }]}>
        <Pressable onPress={close} hitSlop={10} style={s.back} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.inputWrap, { backgroundColor: isDark ? theme.surface : 'rgba(17,24,39,0.05)', borderColor: q ? accent : 'transparent' }]}>
          <Feather name="search" size={18} color={q ? accent : theme.textSoft} />
          <TextInput
            style={[s.input, { color: theme.text }]}
            placeholder="Téléphone, moto, plombier…"
            placeholderTextColor={theme.textSoft}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit()}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading ? <ActivityIndicator size="small" color={accent} /> : null}
          {!loading && query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer">
              <Feather name="x-circle" size={18} color={theme.textSoft} />
            </Pressable>
          ) : null}
        </View>
        {onOpenFilters ? (
          <Pressable
            onPress={() => { Keyboard.dismiss(); onOpenFilters(); }}
            style={({ pressed }) => [s.filterBtn, pressed && { opacity: 0.8 }]}
            accessibilityLabel="Filtres"
          >
            <Feather name="sliders" size={18} color={P.white} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {q.length < 2 ? (
          <>
            {recent.length > 0 ? (
              <View style={s.block}>
                <SectionTitle action="Effacer" onAction={() => persistRecent([])}>Recherches récentes</SectionTitle>
                {recent.map((term) => (
                  <Pressable key={term} onPress={() => submit(term)} style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.glass }]}>
                    <View style={[s.rowIcon, { backgroundColor: theme.glass }]}>
                      <Feather name="clock" size={15} color={theme.textMuted} />
                    </View>
                    <Text style={[s.rowTxt, { color: theme.text }]} numberOfLines={1}>{term}</Text>
                    <Pressable onPress={() => persistRecent(recent.filter((r) => r !== term))} hitSlop={12} accessibilityLabel={`Supprimer ${term}`}>
                      <Feather name="x" size={16} color={theme.textSoft} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {categories.length > 0 ? (
              <View style={s.block}>
                <SectionTitle>Explorer par catégorie</SectionTitle>
                <View style={s.catGrid}>
                  {categories.slice(0, 8).map((cat) => (
                    <Pressable
                      key={cat._id || cat.slug}
                      onPress={() => openCategory(cat)}
                      style={({ pressed }) => [s.catTile, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
                    >
                      <CategoryIcon item={cat} size={32} />
                      <Text style={[s.catName, { color: theme.text }]} numberOfLines={1}>{cat.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {recent.length === 0 && categories.length === 0 ? (
              <View style={s.hint}>
                <Feather name="search" size={36} color={theme.textSoft} />
                <Text style={[s.hintTxt, { color: theme.textMuted }]}>Tapez au moins 2 lettres pour voir des suggestions</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* Lancer la recherche telle quelle */}
            <Pressable onPress={() => submit()} style={({ pressed }) => [s.row, s.searchRow, pressed && { backgroundColor: theme.glass }]}>
              <View style={[s.rowIcon, { backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.orange50 }]}>
                <Feather name="search" size={15} color={accent} />
              </View>
              <Text style={[s.rowTxt, { color: theme.text }]} numberOfLines={1}>
                Rechercher « <Text style={{ fontWeight: '800' }}>{q}</Text> »
              </Text>
              <Feather name="arrow-up-left" size={18} color={theme.textSoft} />
            </Pressable>

            {suggestions?.categories?.length ? (
              <View style={s.block}>
                <SectionTitle>Catégories</SectionTitle>
                {suggestions.categories.map((cat) => (
                  <Pressable key={cat._id} onPress={() => openCategory(cat)} style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.glass }]}>
                    <View style={[s.rowIcon, { backgroundColor: theme.glass }]}>
                      <CategoryIcon item={cat} size={22} />
                    </View>
                    <Highlight text={cat.name} query={q} style={[s.rowTxt, { color: theme.text }]} strongColor={accent} />
                    <Feather name="chevron-right" size={18} color={theme.textSoft} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {suggestions?.products?.length ? (
              <View style={s.block}>
                <SectionTitle>Annonces</SectionTitle>
                {suggestions.products.map((product) => (
                  <Pressable key={String(product.id)} onPress={() => openProduct(product)} style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.glass }]}>
                    {product.mainImage ? (
                      <Image source={{ uri: sizedImage(product.mainImage, 56) }} style={s.thumb} />
                    ) : (
                      <View style={[s.thumb, s.thumbFallback, { backgroundColor: theme.glass }]}>
                        <Feather name="image" size={16} color={theme.textSoft} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Highlight text={product.title} query={q} style={[s.rowTxt, { color: theme.text }]} strongColor={accent} />
                      <Text style={[s.rowSub, { color: product.type === 'service' ? P.blue600 : accent }]} numberOfLines={1}>
                        {formatPrice(product.price)}
                        {product.location ? <Text style={{ color: theme.textSoft, fontWeight: '500' }}>{`  ·  ${getCityName(product.location)}`}</Text> : null}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {suggestions?.popular?.length ? (
              <View style={s.block}>
                <SectionTitle>Suggestions</SectionTitle>
                <View style={s.chips}>
                  {suggestions.popular.map((term) => (
                    <Pressable key={term} onPress={() => submit(term)} style={({ pressed }) => [s.chip, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}>
                      <Feather name="trending-up" size={13} color={accent} />
                      <Text style={[s.chipTxt, { color: theme.text }]}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {!loading && suggestions && !hasResults ? (
              <View style={s.hint}>
                <Feather name="search" size={36} color={theme.textSoft} />
                <Text style={[s.hintTitle, { color: theme.text }]}>Aucune suggestion pour « {q} »</Text>
                <Text style={[s.hintTxt, { color: theme.textMuted }]}>Lancez quand même la recherche : elle porte aussi sur les descriptions.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
};

export default SearchOverlay;

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 0 },
  filterBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: P.terra, alignItems: 'center', justifyContent: 'center' },
  block: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  searchRow: { marginTop: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTxt: { flex: 1, fontSize: 15 },
  rowSub: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  catTile: { width: '23%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  catEmoji: { fontSize: 24 },
  catName: { fontSize: 11.5, fontWeight: '600', marginTop: 6, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  hint: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 60, gap: 10 },
  hintTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  hintTxt: { fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
});
