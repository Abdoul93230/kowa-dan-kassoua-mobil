// ─── Accueil — TakTak Niger ───────────────────────────────────────────────────
// En-tête flottant + recherche, carrousel "À la une", catégories, tendances,
// services, vendeurs actifs et fil des dernières annonces.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, Animated,
  Pressable, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/auth';
import { readCache, writeCache } from '../api/cache';
import { seedReferenceData } from '../components/search/ProductBrowser';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../hooks/useFavorites';
import { CITY_STORAGE_KEY } from '../utils/searchFilters';
import { MOBILE_COLORS as P } from '../theme/colors';
import { formatCompact, getProductId, getProductImage } from '../utils/format';
import HomeHeader, { HEADER_BODY_H } from '../components/home/HomeHeader';
import HeroCarousel from '../components/home/HeroCarousel';
import CategoryRail from '../components/home/CategoryRail';
import ProductCard from '../components/home/ProductCard';
import SellerStories from '../components/home/SellerStories';
import PublishBanner from '../components/home/PublishBanner';
import SectionHeader from '../components/home/SectionHeader';
import CityPickerSheet from '../components/home/CityPickerSheet';
import PressableScale from '../components/home/PressableScale';
import { HomeSkeleton } from '../components/home/Skeleton';

const REFRESH_TTL_MS = 60 * 1000;     // Rafraîchissement silencieux au retour sur l'onglet
const GRID_GAP = 12;
const FEED_TYPES = [
  { key: 'all', label: 'Tout' },
  { key: 'product', label: 'Produits' },
  { key: 'service', label: 'Services' },
];

// GET qui renvoie le tableau/objet "data", ou null en cas d'échec (une section en erreur ne bloque pas les autres)
const fetchData = (url, params) =>
  apiClient.get(url, { params })
    .then((res) => res.data?.data ?? res.data)
    .catch((err) => {
      console.warn(`Accueil: échec ${url}`, err?.message);
      return null;
    });

const asArray = (value, fallback) => (Array.isArray(value) ? value : fallback);
const homeCacheKey = (city, type) => `home:${city}:${type}`;
const citiesFrom = (locations) =>
  [...new Set(locations.map((l) => String(l || '').split(',')[0].trim()).filter(Boolean))].slice(0, 15);

// Ancien chargement (7 requêtes) : uniquement si le serveur n'a pas encore la route /home
const fetchHomeLegacy = async (loc, feedType) => {
  const card = { view: 'card', withTotal: '0' };
  const [latest, trending, services, categories, sellers, stats, locations] = await Promise.all([
    fetchData('/products', { limit: 20, ...card, ...loc, ...(feedType !== 'all' ? { type: feedType } : {}) }),
    fetchData('/products', { limit: 10, sort: '-views', ...card, ...loc }),
    fetchData('/products', { limit: 10, type: 'service', ...card, ...loc }),
    fetchData('/categories'),
    fetchData('/products/active-sellers', { limit: 12 }),
    fetchData('/products/platform/stats'),
    fetchData('/products/locations'),
  ]);
  return { latest, trending, services, categories, sellers, stats, cities: Array.isArray(locations) ? citiesFrom(locations) : null };
};

// Carrousel : annonces mises en avant d'abord, puis les plus vues avec photo
const pickHeroItems = (trending, latest) => {
  const seen = new Set();
  const pool = [...trending, ...latest].filter((it) => {
    const id = getProductId(it);
    if (!id || seen.has(id) || !getProductImage(it)) return false;
    seen.add(id);
    return true;
  });
  const boosted = pool.filter((it) => it.promoted || it.featured);
  const rest = pool.filter((it) => !(it.promoted || it.featured));
  return [...boosted, ...rest].slice(0, 5);
};

const greeting = () => (new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir');

// ─── Sélecteur de type (Tout / Produits / Services) ──────────────────────────
function FeedTypeTabs({ value, onChange, width }) {
  const { theme, isDark } = useAppTheme();
  const segW = (width - 32 - 8) / FEED_TYPES.length;
  const index = FEED_TYPES.findIndex((t) => t.key === value);
  const x = useRef(new Animated.Value(index * segW)).current;

  useEffect(() => {
    Animated.spring(x, { toValue: index * segW, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  }, [index, segW, x]);

  return (
    <View style={[s.tabs, { backgroundColor: isDark ? theme.surface : 'rgba(17,24,39,0.05)' }]}>
      <Animated.View
        style={[
          s.tabCursor,
          { width: segW, backgroundColor: value === 'service' ? P.blue600 : P.terra, transform: [{ translateX: x }] },
        ]}
      />
      {FEED_TYPES.map((t) => (
        <Pressable key={t.key} style={[s.tab, { width: segW }]} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: value === t.key }}>
          <Text style={[s.tabTxt, { color: value === t.key ? P.white : theme.textMuted }]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Rail horizontal d'annonces ───────────────────────────────────────────────
function ProductRail({ items, favorites, onPressItem, onToggleFavorite }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {items.map((item) => {
        const id = getProductId(item);
        return (
          <View key={id} style={s.railItem}>
            <ProductCard
              item={item}
              width={156}
              imageHeight={150}
              isFavorite={favorites.has(id)}
              onPress={() => onPressItem(item)}
              onToggleFavorite={() => onToggleFavorite(item)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProductsListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { isDark, theme } = useAppTheme();

  const [data, setData] = useState({
    latest: [], trending: [], services: [], categories: [], sellers: [], cities: [],
    stats: { totalProducts: 0, totalUsers: 0, totalCities: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedType, setFeedType] = useState('all');
  const [city, setCity] = useState('all');
  const [cityReady, setCityReady] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const { favorites, toggleFavorite: handleToggleFavorite, refreshFavorites } = useFavorites();

  const scrollY = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const lastFetchRef = useRef(0);

  const headerH = insets.top + HEADER_BODY_H;
  const cardW = (width - 16 * 2 - GRID_GAP) / 2;
  const locationParam = city !== 'all' ? city : undefined;
  const fullName = (user?.name || '').trim();

  // ─── Données ────────────────────────────────────────────────────────────────
  // Applique une réponse d'accueil ; une section absente garde sa valeur précédente
  const applyHome = useCallback((home) => {
    if (!home) return;
    setData((prev) => ({
      latest: asArray(home.latest, prev.latest),
      trending: asArray(home.trending, prev.trending),
      services: asArray(home.services, prev.services),
      categories: asArray(home.categories, prev.categories),
      sellers: asArray(home.sellers, prev.sellers),
      stats: home.stats && typeof home.stats === 'object' && !Array.isArray(home.stats) ? home.stats : prev.stats,
      cities: asArray(home.cities, prev.cities),
    }));
    // Catégories et villes réutilisées par la recherche : pas de nouvel appel réseau
    if (Array.isArray(home.categories) && Array.isArray(home.cities)) {
      seedReferenceData({ categories: home.categories, cities: home.cities });
    }
  }, []);

  // UNE requête pour tout l'accueil (calculée et mise en cache côté serveur)
  const fetchHome = useCallback(async () => {
    const loc = city !== 'all' ? { location: city } : {};
    let home = null;
    try {
      const res = await apiClient.get('/home', { params: { ...loc, ...(feedType !== 'all' ? { type: feedType } : {}) } });
      home = res.data?.data || null;
    } catch (err) {
      if (err?.response?.status === 404) home = await fetchHomeLegacy(loc, feedType); // serveur pas encore à jour
      else console.warn('Accueil: échec /home', err?.message);
    }
    if (!home) return;

    applyHome(home);
    writeCache(homeCacheKey(city, feedType), home, { persist: true });
    lastFetchRef.current = Date.now();
  }, [city, feedType, applyHome]);

  const fetchFeed = useCallback(async (type) => {
    setFeedLoading(true);
    const latest = await fetchData('/products', {
      limit: 20,
      view: 'card',
      withTotal: '0',
      ...(locationParam ? { location: locationParam } : {}),
      ...(type !== 'all' ? { type } : {}),
    });
    setData((prev) => ({ ...prev, latest: asArray(latest, prev.latest) }));
    setFeedLoading(false);
  }, [locationParam]);

  // Ville mémorisée entre deux sessions
  useEffect(() => {
    AsyncStorage.getItem(CITY_STORAGE_KEY)
      .then((saved) => { if (saved) setCity(saved); })
      .catch(() => {})
      .finally(() => setCityReady(true));
  }, []);

  const revealedRef = useRef(false);
  const showContent = useCallback(() => {
    setLoading(false);
    if (revealedRef.current) return;
    revealedRef.current = true;
    Animated.timing(reveal, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [reveal]);

  // Chargement initial + à chaque changement de ville :
  // 1) affichage immédiat de la dernière version connue (même hors connexion)
  // 2) rafraîchissement silencieux depuis le serveur
  useEffect(() => {
    if (!cityReady) return;
    let alive = true;
    (async () => {
      const cached = await readCache(homeCacheKey(city, feedType));
      if (cached && alive) {
        applyHome(cached.data);
        showContent();
      }
      await fetchHome();
      if (alive) showContent();
    })();
    return () => { alive = false; };
    // fetchHome change aussi avec feedType, géré séparément par fetchFeed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityReady, city]);

  // Retour sur l'onglet : rafraîchissement silencieux si les données ont plus d'une minute
  useFocusEffect(
    useCallback(() => {
      if (lastFetchRef.current && Date.now() - lastFetchRef.current > REFRESH_TTL_MS) {
        fetchHome();
      }
    }, [fetchHome])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchHome(), refreshFavorites()]);
    setRefreshing(false);
  }, [fetchHome, refreshFavorites]);

  // Toucher l'onglet Accueil alors qu'on y est déjà : retour en haut + rechargement
  const scrollRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (!navigation.isFocused()) return; // simple changement d'onglet : rien à faire
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      onRefreshRef.current();
    });
    return unsubscribe;
  }, [navigation]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const openProduct = useCallback((item) => {
    navigation.navigate('ProductDetail', { productId: getProductId(item), preview: item });
  }, [navigation]);

  const openAll = useCallback((type = 'all') => {
    navigation.navigate('AllProducts', { type, ...(locationParam ? { location: locationParam } : {}) });
  }, [navigation, locationParam]);

  const handleFeedType = useCallback((type) => {
    if (type === feedType) return;
    setFeedType(type);
    fetchFeed(type);
  }, [feedType, fetchFeed]);

  const handleSelectCity = useCallback((value) => {
    setCityOpen(false);
    if (value === city) return;
    setCity(value);
    AsyncStorage.setItem(CITY_STORAGE_KEY, value).catch(() => {});
  }, [city]);

  // ─── Données dérivées ───────────────────────────────────────────────────────
  const heroItems = useMemo(() => pickHeroItems(data.trending, data.latest), [data.trending, data.latest]);
  const gridRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < data.latest.length; i += 2) rows.push(data.latest.slice(i, i + 2));
    return rows;
  }, [data.latest]);

  const revealStyle = {
    opacity: reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };
  const accent = isDark ? P.amber : P.terra;
  const cityLabel = city === 'all' ? 'Tout le Niger' : city;

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH + 6, paddingBottom: 96 + Math.max(insets.bottom, 8) }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} progressViewOffset={headerH} />
        }
      >
        {/* Halo d'ambiance derrière l'en-tête */}
        <LinearGradient
          colors={isDark ? ['rgba(236,90,19,0.20)', 'rgba(236,90,19,0)'] : [P.orange100, 'rgba(255,233,222,0)']}
          style={[s.ambient, { height: headerH + 260 }]}
          pointerEvents="none"
        />

        {/* ── Accueil personnalisé ── */}
        <View style={s.hello}>
          <View style={{ flex: 1 }}>
            {/* Salutation discrète, nom complet mis en avant */}
            <Text style={[s.helloSmall, { color: theme.textMuted }]}>{greeting()} 👋</Text>
            <Text style={[s.helloTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {fullName || 'Bienvenue sur TakTak'}
            </Text>
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <Text style={[s.liveTxt, { color: theme.textMuted }]}>
                {data.stats.totalProducts > 0
                  ? `${formatCompact(data.stats.totalProducts)} annonces actives sur TakTak`
                  : 'Achetez et vendez près de chez vous'}
              </Text>
            </View>
          </View>
          <PressableScale
            onPress={() => setCityOpen(true)}
            scaleTo={0.94}
            style={[s.cityChip, { backgroundColor: isDark ? theme.surface : P.white, borderColor: isDark ? theme.border : P.orange100 }]}
            accessibilityLabel={`Ville : ${cityLabel}`}
          >
            <Feather name="map-pin" size={13} color={accent} />
            <Text style={[s.cityTxt, { color: theme.text }]} numberOfLines={1}>{cityLabel}</Text>
            <Feather name="chevron-down" size={14} color={theme.textSoft} />
          </PressableScale>
        </View>

        {loading ? (
          <HomeSkeleton width={width} />
        ) : (
          <Animated.View style={revealStyle}>
            {/* ── À la une ── */}
            {heroItems.length > 0 ? (
              <View style={s.block}>
                <HeroCarousel items={heroItems} width={width} onPressItem={openProduct} />
              </View>
            ) : null}

            {/* ── Catégories ── */}
            {data.categories.length > 0 ? (
              <View style={s.block}>
                <SectionHeader title="Catégories" onSeeAll={() => navigation.navigate('Categories')} compact />
                <CategoryRail
                  categories={data.categories}
                  onPressAll={() => navigation.navigate('Categories')}
                  onPressCategory={(cat) => navigation.navigate('CategoryProducts', { categorySlug: cat.slug, categoryName: cat.name })}
                />
              </View>
            ) : null}

            {/* ── Tendances ── */}
            {data.trending.length > 0 ? (
              <View style={s.block}>
                <SectionHeader title="Tendances 🔥" subtitle="Les annonces les plus consultées" onSeeAll={() => openAll('all')} />
                <ProductRail items={data.trending} favorites={favorites} onPressItem={openProduct} onToggleFavorite={handleToggleFavorite} />
              </View>
            ) : null}

            {/* ── Publier ── */}
            <View style={s.block}>
              <PublishBanner onPress={() => navigation.navigate('Publish')} totalUsers={data.stats.totalUsers} />
            </View>

            {/* ── Services ── */}
            {data.services.length > 0 ? (
              <View style={s.block}>
                <SectionHeader title="Services à la une" subtitle="Artisans et prestataires de confiance" accent={P.blue600} onSeeAll={() => openAll('service')} />
                <ProductRail items={data.services} favorites={favorites} onPressItem={openProduct} onToggleFavorite={handleToggleFavorite} />
              </View>
            ) : null}

            {/* ── Vendeurs actifs ── */}
            {data.sellers.length > 0 ? (
              <View style={s.block}>
                <SectionHeader title="Vendeurs actifs" subtitle="Ils ont publié récemment" />
                <SellerStories sellers={data.sellers} onPressSeller={(sel) => navigation.navigate('SellerProfile', { sellerId: sel._id || sel.id })} />
              </View>
            ) : null}

            {/* ── Dernières annonces ── */}
            <View style={s.block}>
              <SectionHeader title="Récemment publiées" onSeeAll={() => openAll(feedType)} />
              <View style={s.tabsWrap}>
                <FeedTypeTabs value={feedType} onChange={handleFeedType} width={width} />
              </View>

              <View style={[s.grid, feedLoading && { opacity: 0.5 }]}>
                {gridRows.length === 0 ? (
                  <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[s.emptyIcon, { backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50 }]}>
                      <Feather name="inbox" size={26} color={accent} />
                    </View>
                    <Text style={[s.emptyTitle, { color: theme.text }]}>Aucune annonce ici pour l'instant</Text>
                    <Text style={[s.emptySub, { color: theme.textSoft }]}>
                      {city !== 'all' ? `Soyez le premier à publier à ${city}, ou élargissez la recherche.` : 'Soyez le premier à publier !'}
                    </Text>
                    <PressableScale onPress={() => navigation.navigate('Publish')} style={s.emptyBtn}>
                      <Text style={s.emptyBtnTxt}>Publier une annonce</Text>
                    </PressableScale>
                  </View>
                ) : (
                  gridRows.map((row) => (
                    <View key={row.map(getProductId).join('-')} style={s.gridRow}>
                      {row.map((item) => {
                        const id = getProductId(item);
                        return (
                          <ProductCard
                            key={id}
                            item={item}
                            width={cardW}
                            isFavorite={favorites.has(id)}
                            onPress={() => openProduct(item)}
                            onToggleFavorite={() => handleToggleFavorite(item)}
                          />
                        );
                      })}
                    </View>
                  ))
                )}
              </View>

              {gridRows.length > 0 ? (
                <PressableScale onPress={() => openAll(feedType)} scaleTo={0.97} style={[s.moreBtn, { borderColor: isDark ? theme.border : P.orange200, backgroundColor: isDark ? theme.surface : P.orange50 }]}>
                  <Text style={[s.moreTxt, { color: accent }]}>Voir toutes les annonces</Text>
                  <Feather name="arrow-right" size={16} color={accent} />
                </PressableScale>
              ) : null}
            </View>

            {/* ── Confiance ── */}
            <View style={[s.trust, { borderColor: theme.border }]}>
              {[
                { icon: 'shield', label: 'Membres vérifiés' },
                { icon: 'message-circle', label: 'Messagerie sécurisée' },
                { icon: 'gift', label: '100 % gratuit' },
              ].map((t) => (
                <View key={t.icon} style={s.trustItem}>
                  <Feather name={t.icon} size={18} color={accent} />
                  <Text style={[s.trustTxt, { color: theme.textMuted }]}>{t.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <HomeHeader
        scrollY={scrollY}
        topInset={insets.top}
        // Page Recherche plein écran (au-dessus des onglets), voir SearchScreen
        onPressSearch={() => navigation.navigate('Search')}
      />

      <CityPickerSheet
        visible={cityOpen}
        cities={data.cities}
        selected={city}
        onSelect={handleSelectCity}
        onClose={() => setCityOpen(false)}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0 },

  hello: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18, gap: 12 },
  helloSmall: { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  helloTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.green },
  liveTxt: { fontSize: 13, flexShrink: 1 },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 36, borderRadius: 999, borderWidth: 1, maxWidth: 150 },
  cityTxt: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },

  block: { marginBottom: 30 },
  rail: { paddingHorizontal: 12 },
  railItem: { marginHorizontal: 4 },

  tabsWrap: { paddingHorizontal: 16, marginBottom: 16 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, height: 44 },
  tabCursor: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 11 },
  tab: { alignItems: 'center', justifyContent: 'center' },
  tabTxt: { fontSize: 13.5, fontWeight: '700' },

  grid: { paddingHorizontal: 16 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: GRID_GAP },

  moreBtn: { marginHorizontal: 16, marginTop: 6, height: 50, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreTxt: { fontSize: 14.5, fontWeight: '800' },

  empty: { alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyBtn: { marginTop: 16, backgroundColor: P.terra, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14 },
  emptyBtnTxt: { color: P.white, fontWeight: '800', fontSize: 13.5 },

  trust: { flexDirection: 'row', marginHorizontal: 16, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  trustItem: { flex: 1, alignItems: 'center', gap: 6 },
  trustTxt: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
});
