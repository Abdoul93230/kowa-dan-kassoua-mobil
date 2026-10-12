// ─── Profil public d'un vendeur ──────────────────────────────────────────────
// Couverture + identité, statistiques, onglets Tout / Produits / Services
// et grille d'annonces paginée. Pas de contact direct (WhatsApp / appel) :
// les échanges passent par la messagerie de l'app.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../api/auth';
import { useAppTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../hooks/useFavorites';
import { MOBILE_COLORS as P } from '../theme/colors';
import { WEB_BASE_URL } from '../utils/constants';
import { getCityName, getInitials, getProductId, sizedImage } from '../utils/format';
import ProductCard from '../components/home/ProductCard';
import PressableScale from '../components/home/PressableScale';
import { SkeletonGroup, Bone } from '../components/home/Skeleton';

const PAGE_SIZE = 20;
const GAP = 12;
const COVER_H = 150;
const AVATAR = 96;
const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'product', label: 'Produits' },
  { key: 'service', label: 'Services' },
];

// ─── Squelette de chargement ─────────────────────────────────────────────────
function SellerSkeleton({ width, topInset }) {
  const cardW = (width - 32 - GAP) / 2;
  return (
    <SkeletonGroup>
      <Bone width={width} height={COVER_H + topInset} radius={0} />
      <View style={{ alignItems: 'center', marginTop: -AVATAR / 2 }}>
        <Bone width={AVATAR} height={AVATAR} radius={AVATAR / 2} />
        <Bone width={180} height={22} radius={8} style={{ marginTop: 14 }} />
        <Bone width={130} height={13} radius={6} style={{ marginTop: 8 }} />
        <Bone width={width - 32} height={74} radius={20} style={{ marginTop: 20 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20 }}>
        <Bone width={cardW} height={cardW * 1.3} radius={18} />
        <Bone width={cardW} height={cardW * 1.3} radius={18} />
      </View>
    </SkeletonGroup>
  );
}

// ─── Statistique ──────────────────────────────────────────────────────────────
function Stat({ value, label, icon, iconColor }) {
  const { theme } = useAppTheme();
  return (
    <View style={s.stat}>
      <View style={s.statValueRow}>
        {icon ? <Feather name={icon} size={14} color={iconColor} /> : null}
        <Text style={[s.statValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={[s.statLabel, { color: theme.textSoft }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function SellerProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark, theme } = useAppTheme();
  const { favorites, toggleFavorite } = useFavorites();
  const { sellerId } = route.params || {};

  const [seller, setSeller] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [tab, setTab] = useState('all');
  const [counts, setCounts] = useState({ all: 0, product: 0, service: 0 });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const requestId = useRef(0);
  const cardW = (width - 32 - GAP) / 2;
  const accent = isDark ? P.amber : P.terra;

  // ─── Profil ───────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const profileRes = await apiClient.get(`/auth/seller/${sellerId}`);
      setSeller(profileRes.data?.data || null);
      setStatus('ready');
    } catch (e) {
      setStatus(e?.response?.status === 404 ? 'notfound' : 'error');
    }
  }, [sellerId]);

  // ─── Annonces paginées (la dernière requête l'emporte) ────────────────────
  // La première page renvoie aussi les compteurs Tout / Produits / Services (facets=type)
  const loadItems = useCallback(async (pageToLoad) => {
    const id = ++requestId.current;
    if (pageToLoad > 1) setLoadingMore(true);
    try {
      const res = await apiClient.get('/products', {
        params: {
          seller: sellerId,
          page: pageToLoad,
          limit: PAGE_SIZE,
          view: 'card',
          ...(pageToLoad === 1 ? { facets: 'type' } : {}),
          ...(tab !== 'all' ? { type: tab } : {}),
        },
      });
      if (id !== requestId.current) return;
      const facets = res.data?.facets;
      if (facets) setCounts({ all: facets.all || 0, product: facets.product || 0, service: facets.service || 0 });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setItems((prev) => {
        if (pageToLoad === 1) return list;
        const seen = new Set(prev.map(getProductId));
        return [...prev, ...list.filter((it) => !seen.has(getProductId(it)))];
      });
      setTotal(Number(res.data?.pagination?.total ?? list.length));
      setPage(pageToLoad);
    } catch (e) {
      // La liste garde son contenu ; le pull-to-refresh permet de réessayer
    } finally {
      if (id === requestId.current) { setListLoading(false); setLoadingMore(false); setRefreshing(false); }
    }
  }, [sellerId, tab]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { setListLoading(true); loadItems(1); }, [loadItems]);

  const onRefresh = () => { setRefreshing(true); fetchProfile(); loadItems(1); };
  const loadMore = () => { if (!listLoading && !loadingMore && items.length < total) loadItems(page + 1); };

  // ─── Actions ───────────────────────────────────────────────────────────────
  const name = seller?.businessName || seller?.name || 'Vendeur';
  const shareProfile = () => {
    Share.share({
      message: `Découvrez ${name} sur TakTak (${counts.all} annonce${counts.all > 1 ? 's' : ''}) : ${WEB_BASE_URL}/seller/${sellerId}`,
    }).catch(() => {});
  };

  const openProduct = useCallback((item) => navigation.navigate('ProductDetail', { productId: getProductId(item), preview: item }), [navigation]);

  // ─── En-tête compact qui apparaît au défilement ───────────────────────────
  const barOpacity = scrollY.interpolate({ inputRange: [COVER_H - 40, COVER_H + 20], outputRange: [0, 1], extrapolate: 'clamp' });
  const coverTranslate = scrollY.interpolate({ inputRange: [-100, 0, COVER_H], outputRange: [-50, 0, COVER_H * 0.4], extrapolate: 'clamp' });
  const coverScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.4, 1], extrapolate: 'clamp' });

  const rating = Number(seller?.rating || 0);
  const reviews = Number(seller?.totalReviews || 0);
  const bio = String(seller?.bio || '').trim();

  const profileHeader = useMemo(() => {
    if (!seller) return null;
    return (
      <View>
        {/* Couverture (parallaxe) */}
        <Animated.View style={{ height: COVER_H + insets.top, overflow: 'hidden', transform: [{ translateY: coverTranslate }, { scale: coverScale }] }}>
          <LinearGradient colors={[P.orange700, P.terra, P.amber]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={s.coverGlowA} />
          <View style={s.coverGlowB} />
        </Animated.View>

        {/* Identité */}
        <View style={[s.identity, { backgroundColor: theme.screen }]}>
          <View style={[s.avatarRing, { backgroundColor: theme.screen }]}>
            {seller.avatar ? (
              <Image source={{ uri: sizedImage(seller.avatar, 96) }} style={s.avatar} />
            ) : (
              <LinearGradient colors={[P.orange400, P.terra]} style={[s.avatar, s.center]}>
                <Text style={s.initials}>{getInitials(name)}</Text>
              </LinearGradient>
            )}
            {seller.verified ? (
              <View style={[s.verified, { borderColor: theme.screen }]}>
                <Feather name="check" size={13} color={P.white} />
              </View>
            ) : null}
          </View>

          <View style={s.nameRow}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={2}>{name}</Text>
          </View>
          {seller.businessName && seller.name && seller.businessName !== seller.name ? (
            <Text style={[s.subName, { color: theme.textMuted }]}>{seller.name}</Text>
          ) : null}

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Feather name="map-pin" size={13} color={theme.textSoft} />
              <Text style={[s.metaTxt, { color: theme.textSoft }]}>{getCityName(seller.location)}</Text>
            </View>
            {seller.memberSince ? (
              <View style={s.metaItem}>
                <Feather name="calendar" size={13} color={theme.textSoft} />
                <Text style={[s.metaTxt, { color: theme.textSoft }]}>Membre depuis {seller.memberSince}</Text>
              </View>
            ) : null}
          </View>

          {seller.verified ? (
            <View style={[s.trustPill, { backgroundColor: isDark ? 'rgba(34,197,94,0.14)' : P.successSoft }]}>
              <Feather name="shield" size={12} color={P.greenDark} />
              <Text style={[s.trustTxt, { color: isDark ? P.green : P.greenDark }]}>Vendeur vérifié</Text>
            </View>
          ) : null}

          {/* Statistiques */}
          <View style={[s.stats, { backgroundColor: theme.surface, borderColor: theme.border }, !isDark && s.cardShadow]}>
            <Stat value={String(counts.all)} label="Annonces" />
            <View style={[s.statSep, { backgroundColor: theme.border }]} />
            <Stat value={reviews > 0 ? rating.toFixed(1) : '—'} label={reviews > 0 ? `${reviews} avis` : 'Pas d\'avis'} icon="star" iconColor={P.gold} />
            <View style={[s.statSep, { backgroundColor: theme.border }]} />
            <Stat value={String(seller.dealsConcluded || 0)} label="Ventes conclues" />
          </View>

          {/* Bio */}
          {bio ? (
            <Pressable onPress={() => setBioExpanded((v) => !v)} style={s.bioWrap}>
              <Text style={[s.bio, { color: theme.textMuted }]} numberOfLines={bioExpanded ? undefined : 3}>{bio}</Text>
              {bio.length > 140 ? (
                <Text style={[s.bioMore, { color: accent }]}>{bioExpanded ? 'Voir moins' : 'Lire la suite'}</Text>
              ) : null}
            </Pressable>
          ) : null}

        </View>

        {/* Onglets */}
        <View style={[s.tabs, { borderBottomColor: theme.border }]}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const tabAccent = t.key === 'service' ? P.blue600 : accent;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text style={[s.tabTxt, { color: active ? theme.text : theme.textSoft }, active && { fontWeight: '800' }]}>
                  {t.label} <Text style={{ color: active ? tabAccent : theme.textSoft }}>{counts[t.key]}</Text>
                </Text>
                {active ? <View style={[s.tabLine, { backgroundColor: tabAccent }]} /> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 14 }} />
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller, theme, isDark, counts, tab, bioExpanded, insets.top, accent]);

  const renderItem = useCallback(({ item }) => (
    <View style={{ paddingHorizontal: 0 }}>
      <ProductCard
        item={item}
        width={cardW}
        isFavorite={favorites.has(getProductId(item))}
        onPress={() => openProduct(item)}
        onToggleFavorite={() => toggleFavorite(item)}
      />
    </View>
  ), [cardW, favorites, openProduct, toggleFavorite]);

  // ─── États globaux ─────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={[s.screen, { backgroundColor: theme.screen }]}>
        <SellerSkeleton width={width} topInset={insets.top} />
      </View>
    );
  }

  if (status !== 'ready' || !seller) {
    const notFound = status === 'notfound';
    return (
      <View style={[s.screen, s.center, { backgroundColor: theme.screen, padding: 32 }]}>
        <View style={[s.emptyIcon, { backgroundColor: theme.glass }]}>
          <Feather name={notFound ? 'user-x' : 'wifi-off'} size={28} color={theme.textMuted} />
        </View>
        <Text style={[s.emptyTitle, { color: theme.text }]}>{notFound ? 'Vendeur introuvable' : 'Connexion impossible'}</Text>
        <Text style={[s.emptySub, { color: theme.textMuted }]}>
          {notFound ? 'Ce profil n\'existe plus ou a été désactivé.' : 'Vérifiez votre connexion internet puis réessayez.'}
        </Text>
        <PressableScale
          onPress={notFound ? () => navigation.goBack() : () => { setStatus('loading'); fetchProfile(); }}
          style={[s.emptyBtn, { backgroundColor: P.terra }]}
        >
          <Text style={s.emptyBtnTxt}>{notFound ? 'Retour' : 'Réessayer'}</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>

      <Animated.FlatList
        data={listLoading ? [] : items}
        keyExtractor={getProductId}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        ListHeaderComponent={profileHeader}
        ListEmptyComponent={
          listLoading ? (
            <ActivityIndicator color={accent} style={{ marginTop: 32 }} />
          ) : (
            <View style={[s.center, { paddingVertical: 40, paddingHorizontal: 32 }]}>
              <View style={[s.emptyIcon, { backgroundColor: theme.glass }]}>
                <Feather name="package" size={26} color={theme.textMuted} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {tab === 'service' ? 'Aucun service' : tab === 'product' ? 'Aucun produit' : 'Aucune annonce'}
              </Text>
              <Text style={[s.emptySub, { color: theme.textMuted }]}>Ce vendeur n'a rien publié ici pour le moment.</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={accent} style={{ marginVertical: 18 }} /> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.white} progressViewOffset={insets.top} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={9}
      />

      {/* Barre supérieure : boutons sur la couverture, puis barre pleine au défilement */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border, opacity: barOpacity }, s.topBarBg]}
        />
        <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9} style={s.roundBtn} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color={P.white} />
        </PressableScale>
        <Animated.Text style={[s.topTitle, { color: theme.text, opacity: barOpacity }]} numberOfLines={1}>{name}</Animated.Text>
        <PressableScale onPress={shareProfile} scaleTo={0.9} style={s.roundBtn} accessibilityLabel="Partager le profil">
          <Feather name="share-2" size={18} color={P.white} />
        </PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  coverGlowA: { position: 'absolute', right: -60, top: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.14)' },
  coverGlowB: { position: 'absolute', left: -50, bottom: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(17,24,39,0.12)' },

  identity: { alignItems: 'center', paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
  avatarRing: { width: AVATAR + 8, height: AVATAR + 8, borderRadius: (AVATAR + 8) / 2, padding: 4, marginTop: -(AVATAR / 2) },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  initials: { color: P.white, fontSize: 32, fontWeight: '900' },
  verified: { position: 'absolute', right: 4, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: P.green, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  name: { fontSize: 23, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  subName: { fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { fontSize: 13 },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 10 },
  trustTxt: { fontSize: 12, fontWeight: '800' },

  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, marginTop: 18 },
  cardShadow: { shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  statLabel: { fontSize: 11.5, marginTop: 2 },
  statSep: { width: StyleSheet.hairlineWidth, height: 32 },

  bioWrap: { alignSelf: 'stretch', marginTop: 16 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  bioMore: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 },

  tabs: { flexDirection: 'row', marginTop: 22, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  tabTxt: { fontSize: 14, fontWeight: '600' },
  tabLine: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, left: '18%', right: '18%', height: 3, borderRadius: 2 },

  gridRow: { justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: GAP },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8 },
  topBarBg: { borderBottomWidth: StyleSheet.hairlineWidth },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(17,24,39,0.35)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },

  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  emptyBtn: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  emptyBtnTxt: { color: P.white, fontSize: 14, fontWeight: '800' },
});
