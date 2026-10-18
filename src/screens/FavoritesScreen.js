// ─── FavoritesScreen — TakTak ────────────────────────────────────────────────
// Grille des annonces sauvegardées : filtres (disponibles, produits, services),
// tri, état « vendu » visible, retrait instantané avec « Annuler », et accès
// direct à la messagerie du vendeur (jamais de contact hors de l'app).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { getMyFavorites } from '../api/favorites';
import { useFavorites } from '../hooks/useFavorites';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import GuestWelcome from '../components/GuestWelcome';
import { formatPrice, getCityName, getProductId, sizedImage, timeAgo } from '../utils/format';

const GUTTER = 16;
const GAP = 12;
const SORTS = [
  { value: 'recent', label: 'Récents', icon: 'time-outline' },
  { value: 'price-asc', label: 'Prix croissant', icon: 'trending-up' },
  { value: 'price-desc', label: 'Prix décroissant', icon: 'trending-down' },
];

const tap = () => Haptics.selectionAsync().catch(() => {});
const priceValue = (p) => Number(String(p ?? '').replace(/[^\d]/g, '')) || 0;
const isUnavailable = (item) => item?.status === 'sold' || item?.status === 'expired';

// ─── Carte ───────────────────────────────────────────────────────────────────
const FavoriteCard = React.memo(function FavoriteCard({ item, width, styles, theme, isMine, onOpen, onRemove, onMessage }) {
  const sold = item.status === 'sold';
  const expired = item.status === 'expired';
  const pending = item.status === 'pending';
  const isService = item.type === 'service';
  const seller = item.seller || {};
  const imageUri = sizedImage(item.mainImage || item.images?.[0], width);

  // Retrait immédiat (le bandeau « Annuler » apparaît sans délai)
  const remove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onRemove(item);
  };

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.card, { width }, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${formatPrice(item.price)}${sold ? ', vendu' : ''}`}
    >
      <View style={[styles.imageBox, { height: width * 1.05 }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageEmpty]}>
            <Ionicons name="image-outline" size={30} color={theme.iconMuted} />
          </View>
        )}

        {/* Annonce plus disponible : image voilée + mention claire */}
        {sold || expired ? (
          <View style={styles.soldVeil}>
            <View style={styles.soldPill}>
              <Ionicons name={sold ? 'checkmark-done' : 'pause-circle-outline'} size={13} color="#fff" />
              <Text style={styles.soldTxt}>{sold ? 'Vendu' : 'Indisponible'}</Text>
            </View>
          </View>
        ) : null}

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.imageFade} pointerEvents="none" />

        <View style={styles.badgesRow}>
          {isService ? (
            <View style={[styles.badge, { backgroundColor: P.blue600 }]}>
              <Ionicons name="construct" size={10} color="#fff" />
              <Text style={styles.badgeTxt}>Service</Text>
            </View>
          ) : null}
          {pending ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.95)' }]}>
              <Text style={styles.badgeTxt}>En attente</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={remove} hitSlop={10} style={styles.heartBtn} accessibilityLabel="Retirer des favoris">
          <Ionicons name="heart" size={19} color={P.terra} />
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.price, { color: isService ? P.blue600 : P.terra }, (sold || expired) && styles.priceOff]} numberOfLines={1}>
          {formatPrice(item.price)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={theme.textSoft} />
          <Text style={styles.meta} numberOfLines={1}>{getCityName(item.location)} · {timeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.sellerRow}>
          {seller.avatar ? (
            <Image source={{ uri: sizedImage(seller.avatar, 22) }} style={styles.sellerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.sellerAvatar, styles.sellerAvatarEmpty]}>
              <Text style={styles.sellerInitial}>{(seller.businessName || seller.name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.sellerName} numberOfLines={1}>{seller.businessName || seller.name || 'Vendeur'}</Text>
          {seller.verified ? <Ionicons name="checkmark-circle" size={12} color="#38bdf8" /> : null}
          {!isMine && !sold && !expired && (seller._id || seller.id) ? (
            <Pressable
              onPress={() => onMessage(item)}
              hitSlop={8}
              style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.8 }]}
              accessibilityLabel={`Écrire à ${seller.name || 'ce vendeur'}`}
            >
              <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Squelette ───────────────────────────────────────────────────────────────
function SkeletonGrid({ width, styles }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.skeletonWrap, { opacity: pulse }]}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ width, gap: 8 }}>
          <View style={[styles.skel, { height: width * 1.05, borderRadius: 18 }]} />
          <View style={[styles.skel, { width: '50%', height: 14, borderRadius: 7 }]} />
          <View style={[styles.skel, { width: '85%', height: 12, borderRadius: 6 }]} />
        </View>
      ))}
    </Animated.View>
  );
}

// ─── État vide ───────────────────────────────────────────────────────────────
function EmptyState({ styles, icon, title, text, action, onAction }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.empty}>
      <Animated.View style={[styles.emptyHalo, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
          <Ionicons name={icon} size={34} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.emptyBtnTxt}>{action}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.floor((screenW - GUTTER * 2 - GAP) / 2);
  const { isDark, theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { isAuthenticated, user } = useAuth();
  const myId = String(user?.id || user?._id || '');

  // Favoris partagés par toute l'app : retirer ici met à jour les cœurs partout,
  // et un favori ajouté ailleurs fait recharger cette liste au retour sur l'écran
  const { favorites: favoriteIds, toggleFavorite: toggleSharedFavorite } = useFavorites();
  const idsKey = useMemo(() => [...favoriteIds].sort().join(','), [favoriteIds]);
  const idsKeyRef = useRef(idsKey);
  idsKeyRef.current = idsKey;
  const loadedIdsKeyRef = useRef(null);

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [undo, setUndo] = useState(null); // { item, index }
  const undoTimer = useRef(null);
  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '', buttons: [{ text: 'OK', onPress: () => {} }] });

  // mode : 'initial' (squelette), 'refresh' (tirer pour rafraîchir), 'silent' (sans indicateur)
  const loadFavorites = async (pageNum = 1, mode = 'initial') => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      if (mode === 'refresh') setRefreshing(true);
      else if (pageNum > 1) setLoadingMore(true);
      else if (mode === 'initial') setLoading(true);

      const response = await getMyFavorites(pageNum, 20);
      if (response.success) {
        setFavorites((prev) => (pageNum === 1 ? response.data : [...prev, ...response.data]));
        setPage(pageNum);
        setTotalPages(response.pagination.pages);
        if (pageNum === 1) loadedIdsKeyRef.current = idsKeyRef.current;
      }
    } catch (error) {
      setAlert({ visible: true, type: 'error', title: 'Erreur', message: error.message || 'Impossible de charger les favoris', buttons: [{ text: 'OK', onPress: () => {} }] });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadFavorites(1); }, [isAuthenticated]);

  // Retour sur l'écran : rechargement silencieux seulement si les favoris ont changé ailleurs
  useFocusEffect(useCallback(() => {
    if (loadedIdsKeyRef.current !== null && loadedIdsKeyRef.current !== idsKeyRef.current) {
      loadFavorites(1, 'silent');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]));

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const onRefresh = useCallback(() => loadFavorites(1, 'refresh'), []);
  const loadMore = () => { if (!loadingMore && page < totalPages) loadFavorites(page + 1); };

  // Retrait instantané, annulable pendant 5 s
  const removeFavorite = useCallback((item) => {
    const id = getProductId(item);
    setUndo({ item, index: favorites.findIndex((f) => getProductId(f) === id) });
    setFavorites((prev) => prev.filter((f) => getProductId(f) !== id));
    toggleSharedFavorite({ id });
    loadedIdsKeyRef.current = [...favoriteIds].filter((x) => x !== id).sort().join(',');
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }, [favorites, favoriteIds, toggleSharedFavorite]);

  const cancelRemove = () => {
    if (!undo) return;
    tap();
    const { item, index } = undo;
    const id = getProductId(item);
    toggleSharedFavorite({ id });
    setFavorites((prev) => {
      const next = [...prev];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
      return next;
    });
    loadedIdsKeyRef.current = [...favoriteIds, id].sort().join(',');
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const openDetail = useCallback((product) => {
    const productId = getProductId(product);
    if (!productId) return;
    navigation.navigate('ProductDetail', { productId, preview: product });
  }, [navigation]);

  // Messagerie de l'app uniquement (la liste des conversations crée ou rouvre la discussion)
  const messageSeller = useCallback((product) => {
    const sellerId = product?.seller?._id || product?.seller?.id;
    if (!sellerId) return;
    tap();
    navigation.navigate('Messages', { sellerId: String(sellerId), productId: getProductId(product) });
  }, [navigation]);

  const counts = useMemo(() => {
    const c = { all: favorites.length, available: 0, product: 0, service: 0, sold: 0 };
    favorites.forEach((f) => {
      if (isUnavailable(f)) c.sold += 1; else c.available += 1;
      if (f.type === 'service') c.service += 1; else c.product += 1;
    });
    return c;
  }, [favorites]);

  const visible = useMemo(() => {
    let list = favorites.filter((f) => (
      filter === 'all' ? true
        : filter === 'available' ? !isUnavailable(f)
          : filter === 'service' ? f.type === 'service'
            : f.type !== 'service'
    ));
    if (sort === 'price-asc') list = [...list].sort((a, b) => priceValue(a.price) - priceValue(b.price));
    if (sort === 'price-desc') list = [...list].sort((a, b) => priceValue(b.price) - priceValue(a.price));
    return list;
  }, [favorites, filter, sort]);

  const sortInfo = SORTS.find((x) => x.value === sort) || SORTS[0];
  const cycleSort = () => {
    tap();
    const i = SORTS.findIndex((x) => x.value === sort);
    setSort(SORTS[(i + 1) % SORTS.length].value);
  };

  // ─── Non connecté ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <GuestWelcome
        icon="heart"
        title="Gardez vos coups de cœur"
        text="Une annonce vous plaît ? Touchez le ♡ et retrouvez-la ici, à tout moment, sur tous vos appareils."
        benefits={[
          { icon: 'heart-outline', label: 'Sauvegardez les annonces qui vous intéressent' },
          { icon: 'pricetag-outline', label: "Voyez d'un coup d'œil celles qui sont encore disponibles" },
          { icon: 'chatbubble-ellipses-outline', label: 'Écrivez au vendeur en un toucher' },
        ]}
        onAuth={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'favorites' }, returnScreen: 'Favorites' })}
        onBrowse={() => navigation.navigate('Home')}
        browseLabel="Découvrir les annonces"
      />
    );
  }

  const filters = [
    { value: 'all', label: 'Tous', count: counts.all },
    { value: 'available', label: 'Disponibles', count: counts.available },
    { value: 'product', label: 'Produits', count: counts.product },
    { value: 'service', label: 'Services', count: counts.service },
  ];

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Favoris</Text>
          <Text style={styles.headerSub}>
            {favorites.length
              ? `${counts.available} disponible${counts.available > 1 ? 's' : ''}${counts.sold ? ` · ${counts.sold} vendue${counts.sold > 1 ? 's' : ''}` : ''}`
              : 'Vos annonces sauvegardées'}
          </Text>
        </View>
        {favorites.length > 1 ? (
          <Pressable onPress={cycleSort} style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.8 }]} accessibilityLabel={`Trier : ${sortInfo.label}`}>
            <Ionicons name={sortInfo.icon} size={15} color={theme.text} />
            <Text style={styles.sortTxt}>{sortInfo.label}</Text>
          </Pressable>
        ) : null}
      </View>

      {favorites.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filters.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => { tap(); setFilter(f.value); }}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{f.label}</Text>
                <Text style={[styles.chipCount, active && styles.chipTxtActive]}>{f.count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const emptyProps = favorites.length === 0
    ? { icon: 'heart', title: 'Aucun favori pour l\'instant', text: 'Touchez le cœur ♡ d\'une annonce pour la garder ici et la retrouver en un instant.', action: 'Découvrir les annonces', onAction: () => navigation.navigate('Home') }
    : { icon: 'funnel-outline', title: 'Rien dans ce filtre', text: 'Aucun favori ne correspond à ce choix.', action: 'Voir tous mes favoris', onAction: () => setFilter('all') };

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          {header}
          <SkeletonGrid width={cardW} styles={styles} />
        </>
      ) : (
        <FlatList
          data={visible}
          numColumns={2}
          key="grid"
          keyExtractor={(item, index) => getProductId(item) || `fav-${index}`}
          renderItem={({ item }) => (
            <FavoriteCard
              item={item}
              width={cardW}
              styles={styles}
              theme={theme}
              isMine={String(item?.seller?._id || item?.seller?.id || '') === myId}
              onOpen={openDetail}
              onRemove={removeFavorite}
              onMessage={messageSeller}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState styles={styles} {...emptyProps} />}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[visible.length === 0 && { flexGrow: 1 }, { paddingBottom: Math.max(insets.bottom, 12) + 120 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 18 }} color={P.terra} /> : null}
        />
      )}

      {/* Retrait annulable */}
      {undo ? (
        <View style={[styles.snack, { bottom: Math.max(insets.bottom, 12) + 96 }]}>
          <Ionicons name="heart-dislike-outline" size={17} color="#fff" />
          <Text style={styles.snackTxt} numberOfLines={1}>Retiré des favoris</Text>
          <Pressable onPress={cancelRemove} hitSlop={10}>
            <Text style={styles.snackAction}>ANNULER</Text>
          </Pressable>
        </View>
      ) : null}

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert((a) => ({ ...a, visible: false }))}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (theme, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.screen },

  header: { paddingHorizontal: GUTTER, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerTitle: { fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.8 },
  headerSub: { fontSize: 13, fontWeight: '600', color: theme.textMuted, marginTop: 2 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1, borderColor: theme.border,
  },
  sortTxt: { fontSize: 12.5, fontWeight: '700', color: theme.text },

  chips: { gap: 8, paddingTop: 14, paddingBottom: 10, paddingRight: GUTTER },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1, borderColor: theme.border,
  },
  chipActive: { backgroundColor: P.terra, borderColor: P.terra },
  chipTxt: { fontSize: 13.5, fontWeight: '700', color: theme.textMuted },
  chipTxtActive: { color: '#fff' },
  chipCount: { fontSize: 12, fontWeight: '800', color: theme.textSoft },

  row: { gap: GAP, paddingHorizontal: GUTTER, marginBottom: 18 },

  card: {},
  imageBox: { borderRadius: 18, overflow: 'hidden', backgroundColor: theme.surfaceAlt },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  imageFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  soldVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  soldPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(17,24,39,0.85)' },
  soldTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  badgesRow: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', gap: 5, zIndex: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9 },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  heartBtn: {
    position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, zIndex: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  cardBody: { paddingTop: 9, paddingHorizontal: 2, gap: 3 },
  price: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  priceOff: { color: theme.textSoft, textDecorationLine: 'line-through' },
  title: { fontSize: 13.5, fontWeight: '600', color: theme.text, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  meta: { flex: 1, fontSize: 11.5, color: theme.textSoft },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  sellerAvatar: { width: 22, height: 22, borderRadius: 11 },
  sellerAvatarEmpty: { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : P.orange100, alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { fontSize: 10, fontWeight: '800', color: P.terra },
  sellerName: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: theme.textMuted },
  msgBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: P.terra },

  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: GUTTER, paddingTop: 14 },
  skel: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e7e9ee' },

  snack: {
    position: 'absolute', left: GUTTER, right: GUTTER, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, height: 50, borderRadius: 16, backgroundColor: 'rgba(17,24,39,0.95)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  snackTxt: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  snackAction: { color: P.amber, fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingVertical: 48 },
  emptyHalo: {
    width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 22,
    backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : '#fff1e8',
  },
  emptyIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  emptyTitle: { fontSize: 21, fontWeight: '900', color: theme.text, textAlign: 'center', letterSpacing: -0.4 },
  emptyText: { fontSize: 14.5, lineHeight: 21, color: theme.textMuted, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingHorizontal: 22, height: 48, borderRadius: 16, backgroundColor: P.terra },
  emptyBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
