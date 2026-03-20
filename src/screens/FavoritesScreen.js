// ─── FavoritesScreen — MarketHub Niger ──────────────────────────────────────
// Version premium redesign — moderne, bling-bling, engageant

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, FlatList,
  Dimensions, Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../contexts/AuthContext';
import { getMyFavorites, removeFavorite } from '../api/favorites';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40) / 2;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const formatPrice = (price) => {
  if (!price && price !== 0) return 'Prix non spécifié';
  return price === 0 ? 'Gratuit' : `${price.toLocaleString('fr-FR')} FCFA`;
};

const getCityName = (location) => {
  if (!location) return '';
  return location.split(',')[0].trim();
};

const getProductId = (product) => product?._id || product?.id;

// ─── ANIMATED CARD ────────────────────────────────────────────────────────────

const FavoriteCard = ({ item, onPress, onRemove, index }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 60,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handleHeartPress = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, tension: 200 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start(() => onRemove(getProductId(item)));
  };

  const isSold = item.status === 'sold';
  const isPending = item.status === 'pending';

  return (
    <Animated.View
      style={[
        s.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={s.card}
      >
        {/* Image container */}
        <View style={s.imageContainer}>
          <Image
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
            style={s.cardImg}
            resizeMode="cover"
          />

          {/* Gradient overlay on image */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            style={s.imgGradient}
            pointerEvents="none"
          />

          {/* Price badge sur image */}
          <View style={s.priceBadge}>
            <LinearGradient
              colors={[P.orange600, P.orange500]}
              style={s.priceBadgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.priceBadgeText}>{formatPrice(item.price)}</Text>
            </LinearGradient>
          </View>

          {/* Status badge */}
          {(isSold || isPending) && (
            <View style={[s.statusBadge, { backgroundColor: isSold ? 'rgba(17,24,39,0.85)' : 'rgba(245,158,11,0.9)' }]}>
              <Text style={s.statusBadgeTxt}>
                {isSold ? '● Vendu' : '⏳ En attente'}
              </Text>
            </View>
          )}

          {/* Heart remove button */}
          <TouchableOpacity
            style={s.heartBtn}
            onPress={handleHeartPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BlurView intensity={40} tint="dark" style={s.heartBlur}>
              <Animated.Text style={[s.heartIcon, { transform: [{ scale: heartScale }] }]}>
                ♥
              </Animated.Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={s.cardContent}>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {item.location ? (
            <View style={s.locationRow}>
              <Text style={s.locationDot}>●</Text>
              <Text style={s.locationTxt} numberOfLines={1}>
                {getCityName(item.location)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── HEADER STATS BAR ─────────────────────────────────────────────────────────

const StatsBar = ({ count }) => (
  <View style={s.statsBar}>

    {/* Pill 1 — Nombre de favoris */}
    <LinearGradient
      colors={[P.orange500, P.orange600]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.statPill}
    >
      <Text style={s.statPillNum}>{count}</Text>
      <Text style={s.statPillLabel}>annonce{count > 1 ? 's' : ''} sauvegardée{count > 1 ? 's' : ''}</Text>
    </LinearGradient>

    {/* Pill 2 — Coups de cœur */}
    <View style={s.statPillGhost}>
      <Text style={s.statPillGhostIcon}>♥</Text>
      <Text style={s.statPillGhostLabel}>Mes coups{'\n'}de cœur</Text>
    </View>

  </View>
);

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

const EmptyState = ({ type, onAction }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={s.emptyContainer}>
      <Animated.View style={[s.emptyIconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={[P.orange100, P.peachSoft]}
          style={s.emptyIconBg}
        >
          <Text style={s.emptyIcon}>♥</Text>
        </LinearGradient>
      </Animated.View>

      <Text style={s.emptyTitle}>
        {type === 'auth' ? 'Connectez-vous' : 'Aucun favori'}
      </Text>
      <Text style={s.emptyDesc}>
        {type === 'auth'
          ? 'Sauvegardez vos annonces préférées et retrouvez-les ici.'
          : 'Parcourez les annonces et cliquez sur ♡ pour les ajouter.'}
      </Text>

      <TouchableOpacity onPress={onAction} activeOpacity={0.85}>
        <LinearGradient
          colors={[P.orange600, P.terra]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.emptyBtn}
        >
          <Text style={s.emptyBtnTxt}>
            {type === 'auth' ? 'Se connecter →' : 'Explorer les annonces →'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadFavorites = async (pageNum = 1, isRefresh = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await getMyFavorites(pageNum, 20);
      if (response.success) {
        setFavorites(prev => pageNum === 1 ? response.data : [...prev, ...response.data]);
        setPage(pageNum);
        setTotalPages(response.pagination.pages);
      }
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Impossible de charger les favoris',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadFavorites(1); }, [isAuthenticated]);

  const onRefresh = useCallback(() => loadFavorites(1, true), []);
  const loadMore = () => { if (!loadingMore && page < totalPages) loadFavorites(page + 1); };

  const handleRemoveFavorite = (productId) => {
    setAlert({
      visible: true,
      type: 'warning',
      title: 'Retirer des favoris',
      message: 'Voulez-vous retirer cette annonce de vos favoris ?',
      buttons: [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Retirer',
          onPress: async () => {
            setAlert({ ...alert, visible: false });
            try {
              await removeFavorite(productId);
              setFavorites(prev => prev.filter(item => getProductId(item) !== productId));
            } catch (error) {
              setAlert({
                visible: true,
                type: 'error',
                title: 'Erreur',
                message: error.message || 'Impossible de retirer l\'annonce',
                buttons: [{ text: 'OK', onPress: () => {} }],
              });
            }
          },
        },
      ],
    });
  };

  const openDetail = (product) => {
    const productId = getProductId(product);
    if (!productId) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Identifiant de l\'annonce introuvable',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      return;
    }
    navigation.navigate('ProductDetail', { productId });
  };
  

  // ─── HEADER ────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={[P.charcoal, P.brown, '#2d3748']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Accent strip */}
        <View style={s.headerAccent} />

        <View style={s.headerTop}>
          <View>
            <Text style={s.headerEyebrow}>MarketHub Niger</Text>
            <Text style={s.headerTitle}>Mes Favoris</Text>
          </View>
          <View style={s.headerBadge}>
            <LinearGradient colors={[P.orange500, P.orange600]} style={s.headerBadgeGrad}>
              <Text style={s.headerBadgeNum}>{favorites.length}</Text>
            </LinearGradient>
          </View>
        </View>

        {favorites.length > 0 && <StatsBar count={favorites.length} />}

        {/* Bottom glow line */}
        <LinearGradient
          colors={['transparent', P.terra, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.headerGlowLine}
        />
      </LinearGradient>
    </Animated.View>
  );

  // ─── RENDU CARTE ───────────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => (
    <FavoriteCard
      item={item}
      index={index}
      onPress={() => {
        console.log('Navigating to product detail for:', item);
        openDetail(item)}}
      onRemove={handleRemoveFavorite}
    />
  );

  // ─── GUARD: NON CONNECTÉ ───────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <EmptyState type="auth" onAction={() => navigation.navigate('Login')} />
      </View>
    );
  }

  // ─── GUARD: CHARGEMENT ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.container}>
        {renderHeader()}
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={P.terra} />
          <Text style={s.loadingTxt}>Chargement de vos favoris…</Text>
        </View>
      </View>
    );
  }

  // ─── GUARD: LISTE VIDE ─────────────────────────────────────────────────────
  if (favorites.length === 0) {
    return (
      <View style={s.container}>
        {renderHeader()}
        <EmptyState type="empty" onAction={() => navigation.navigate('Home')} />
      </View>
    );
  }

  // ─── LISTE ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {renderHeader()}
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item, index) => getProductId(item) || `fav-${index}`}
        contentContainerStyle={s.listContent}
        numColumns={2}
        columnWrapperStyle={s.listRow}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[P.terra]}
            tintColor={P.terra}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          loadingMore ? (
            <View style={s.loadingMore}>
              <ActivityIndicator size="small" color={P.terra} />
            </View>
          ) : null
        }
      />

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.sand,
  },

  // ─── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: P.terra,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: P.amber,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: P.white,
    letterSpacing: -0.5,
  },
  headerBadge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerBadgeGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeNum: {
    fontSize: 16,
    fontWeight: '900',
    color: P.white,
  },
  headerGlowLine: {
    height: 2,
    marginTop: 4,
  },

  // ─── Stats bar ──────────────────────────────────────────────────────────────
  statsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 18,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  statPillNum: {
    fontSize: 26,
    fontWeight: '900',
    color: P.white,
    lineHeight: 30,
  },
  statPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
    flexShrink: 1,
  },
  statPillGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(236,90,19,0.45)',
    backgroundColor: 'rgba(236,90,19,0.1)',
  },
  statPillGhostIcon: {
    fontSize: 20,
    color: P.amber,
    lineHeight: 24,
  },
  statPillGhostLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16,
  },

  // ─── Liste ──────────────────────────────────────────────────────────────────
  listContent: {
    padding: 12,
    paddingBottom: 110,
  },
  listRow: {
    justifyContent: 'space-between',
  },

  // ─── Carte ──────────────────────────────────────────────────────────────────
  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 14,
  },
  card: {
    backgroundColor: P.white,
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow iOS
    shadowColor: P.charcoal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    // Shadow Android
    elevation: 6,
  },
  imageContainer: {
    position: 'relative',
    height: 148,
  },
  cardImg: {
    width: '100%',
    height: '100%',
    backgroundColor: P.sand,
  },
  imgGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  priceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  priceBadgeGradient: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: P.white,
    letterSpacing: 0.2,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeTxt: {
    color: P.white,
    fontSize: 10,
    fontWeight: '700',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heartBlur: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  heartIcon: {
    fontSize: 14,
    color: P.terra,
    lineHeight: 16,
  },

  // ─── Card content ───────────────────────────────────────────────────────────
  cardContent: {
    padding: 10,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: P.charcoal,
    lineHeight: 18,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationDot: {
    fontSize: 7,
    color: P.terra,
    lineHeight: 14,
  },
  locationTxt: {
    fontSize: 11,
    color: P.muted,
    flex: 1,
  },

  // ─── Empty state ────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    marginBottom: 24,
    borderRadius: 50,
    overflow: 'hidden',
    // Glow effect iOS
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 44,
    color: P.terra,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: P.charcoal,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: P.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyBtn: {
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 14,
    // Glow
    shadowColor: P.terra,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: P.white,
    letterSpacing: 0.3,
  },

  // ─── Loading ────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingTxt: {
    fontSize: 14,
    color: P.muted,
  },
  loadingMore: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});