// ─── SellerProfileScreen — MarketHub Niger ────────────────────────────────────
// Profil public d'un vendeur avec ses annonces

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, ActivityIndicator, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');

// ─── THEME CONFIG ─────────────────────────────────────────────────────────────
const getThemeConfig = (isService) => {
  if (isService) {
    return {
      typeBadge: P.terra,
      priceAccent: '#2563EB',
      priceAccentGrad: ['#2563EB', '#60A5FA'],
    };
  }
  return {
    typeBadge: P.amber,
    priceAccent: P.terra,
    priceAccentGrad: [P.terra, P.terraDark],
  };
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getCityName = (location) => {
  if (!location) return 'Niger';
  return location.split(',')[0].trim();
};

const getPostedLabel = (dateValue) => {
  if (!dateValue) return 'Récent';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Récent';

  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} j`;

  const weeks = Math.floor(days / 7);
  return `${weeks} sem`;
};

const getDistanceKm = (itemId) => {
  const distances = [0.5, 1.2, 2.3, 3.5, 4.8, 5.1, 6.7, 8.2, 10.5];
  if (typeof itemId === 'string') {
    const hash = itemId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return distances[hash % distances.length];
  }
  const n = Number(itemId) || 0;
  return distances[Math.abs(n) % distances.length];
};

// Initiales du vendeur
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};


// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD (Harmonized with AnnounceCard from ProductsListScreen)
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({ item, onPress }) {
  const sc = useRef(new Animated.Value(1)).current;
  const isService = item.type === 'service';
  const d = getThemeConfig(isService);
  const posted = getPostedLabel(item.createdAt || item.updatedAt);
  const distance = getDistanceKm(item._id || item.id);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
    >
      <Animated.View style={[s.card, { transform: [{ scale: sc }] }]}>

        {/* Image */}
        <View style={s.cardImgWrap}>
          <Image
            source={{ uri: item.images?.[0] || item.mainImage || 'https://via.placeholder.com/200x150/FFE9DE/EC5A13?text=MH' }}
            style={s.cardImg}
            resizeMode="cover"
          />

          {/* Time Badge */}
          <View style={s.cardTimeBadge}>
            <Feather name="clock" size={11} color={P.charcoal} />
            <Text style={s.cardTimeTxt}>Il y a {posted}</Text>
          </View>

          {/* Fav Ghost */}
          <View style={s.cardFavGhost}>
            <Feather name="heart" size={14} color={d.priceAccent} />
          </View>
        </View>

        {/* Content */}
        <View style={s.cardBody}>
          {/* Title Row with Type Glyph */}
          <View style={s.cardTitleRow}>
            <View style={s.cardTypeGlyphWrap}>
              <Text style={s.cardTypeGlyph}>{isService ? '🛠️' : '📦'}</Text>
            </View>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>

          {/* Location + Distance Meta */}
          <View style={s.cardMetaRow}>
            <Feather name="map-pin" size={11} color={d.priceAccent} />
            <Text style={s.cardLoc} numberOfLines={1}>{getCityName(item.location)}</Text>
            <Text style={s.cardMetaDot}>•</Text>
            <Text style={s.cardMetaTail}>{distance.toFixed(1)} km</Text>
          </View>

          {/* Price Row */}
          <View style={s.cardPriceRow}>
            <View style={s.cardPriceSpacer} />
            <Text style={[s.cardPriceTxt, { color: d.priceAccent }]}>
              {item.price ? `${parseInt(item.price).toLocaleString('fr-FR')} FCFA` : 'À discuter'}
            </Text>
          </View>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SellerProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { sellerId } = route.params;
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'product', 'service'
  const [allProducts, setAllProducts] = useState([]); // Tous les produits non filtrés

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const fetchSellerData = async () => {
    try {
      // Récupérer le profil du vendeur
      const sellerResponse = await apiClient.get(`/auth/seller/${sellerId}`);
      setSeller(sellerResponse.data.data || sellerResponse.data);

      // Récupérer TOUS les produits du vendeur (sans filtre)
      const productsResponse = await apiClient.get('/products', {
        params: {
          seller: sellerId,
          status: 'active',
        }
      });
      const fetchedProducts = productsResponse.data.data || productsResponse.data;
      
      // Stocker tous les produits
      setAllProducts(fetchedProducts);
      
      // Filtrer selon le type sélectionné
      if (filterType === 'all') {
        setProducts(fetchedProducts);
      } else {
        setProducts(fetchedProducts.filter(p => p.type === filterType));
      }
    } catch (error) {
      console.error('Erreur chargement vendeur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerData();
  }, [sellerId]);

  // Filtrer les produits côté client quand le filtre change
  useEffect(() => {
    if (allProducts.length > 0) {
      if (filterType === 'all') {
        setProducts(allProducts);
      } else {
        setProducts(allProducts.filter(p => p.type === filterType));
      }
    }
  }, [filterType, allProducts.length]);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[P.charcoal, P.brown]} style={s.loadScreen}>
          <View style={s.loadLogoBox}><Text style={s.loadLogoTxt}>M</Text></View>
          <Text style={s.loadBrand}>MarketHub</Text>
          <ActivityIndicator size="large" color={P.cream} style={{ marginTop: 24 }} />
        </LinearGradient>
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={s.errorScreen}>
        <Text style={{ fontSize: 64 }}>😕</Text>
        <Text style={s.errorTitle}>Vendeur introuvable</Text>
        <Text style={s.errorText}>Ce vendeur n'existe pas ou n'est plus disponible</Text>
        <TouchableOpacity
          style={s.errorBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={s.errorBtnTxt}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredProducts = products;
  
  // Compter les produits par type
  const totalCount = allProducts.length;
  const productCount = allProducts.filter(p => p.type === 'product').length;
  const serviceCount = allProducts.filter(p => p.type === 'service').length;
  const sellerRating = Number(seller?.rating ?? seller?.sellerStats?.rating ?? 0);
  const sellerTotalReviews = Number(seller?.totalReviews ?? seller?.sellerStats?.totalReviews ?? 0);
  const sellerResponseRate = Number(seller?.sellerStats?.responseRate ?? 0);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ══════════════ BACK BUTTON FLOTTANT ══════════════════════════════ */}
      <View style={[s.headerFloat, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={s.backBtnTxt}>←</Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════ LISTE AVEC HEADER ═════════════════════════════════ */}
      <FlatList
        key={`flatlist-${filterType}`}
        data={filteredProducts}
        extraData={filteredProducts.length}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
          />
        )}
        keyExtractor={(item, index) => item.id?.toString() || `product-${index}`}
        numColumns={2}
        columnWrapperStyle={s.productsRow}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}
        ListHeaderComponent={() => (
          <>
            {/* ══════════════ HEADER HERO PREMIUM ═════════════════════════════ */}
            <LinearGradient 
              colors={['#2d3748', '#374151', '#3d4a5c']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }} 
              style={[s.hero, { paddingTop: insets.top + 16 }]}
            >
              {/* Décos cercles ambiance */}
              <View style={s.deco1} />
              <View style={s.deco2} />
              <View style={s.deco3} />
              {/* Ligne accent top */}
              <View style={s.heroTopLine} />

              <Animated.View style={[s.heroContent, { opacity: fadeAnim }]}>
                {/* Seller Info Container */}
                <View style={s.sellerInfoContainer}>
                  {/* Avatar avec badge */}
                  <View style={s.avatarContainer}>
                    <View style={s.avatarWrap}>
                      {seller.avatar ? (
                        <Image source={{ uri: seller.avatar }} style={s.avatarImg} />
                      ) : (
                        <LinearGradient colors={['#ec5a13', '#d94f0f']} style={s.avatarPlaceholder}>
                          <Text style={s.avatarInitials}>{getInitials(seller.name)}</Text>
                        </LinearGradient>
                      )}
                      {seller.verified && (
                        <View style={s.verifiedBadge}>
                          <Text style={s.verifiedIcon}>✓</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Seller Details */}
                  <View style={s.sellerDetailsSection}>
                    <View style={s.nameRow}>
                      <Text style={s.heroName}>{seller.businessName || seller.name}</Text>
                      {seller.sellerStats?.responseRate > 80 && (
                        <View style={s.topSellerBadge}>
                          <Text style={s.topSellerBadgeTxt}>⭐ TOP</Text>
                        </View>
                      )}
                    </View>
                    {seller.businessName && seller.name && seller.businessName !== seller.name && (
                      <Text style={s.heroSubName}>{seller.name}</Text>
                    )}

                    {/* Meta: Location + Rating */}
                    <View style={s.heroMeta}>
                      <View style={s.heroMetaItem}>
                        <Text style={s.heroLocIcon}>📍</Text>
                        <Text style={s.heroMetaText}>{getCityName(seller.location)}</Text>
                      </View>
                      <Text style={s.heroMetaSep}>•</Text>
                      <View style={s.heroMetaItem}>
                        <Text style={s.heroRatingStar}>⭐</Text>
                        <Text style={s.heroMetaText}>
                          {sellerRating.toFixed(1)}/5.0
                        </Text>
                      </View>
                    </View>

                    {/* Response Time Badge */}
                    <View style={s.responseBadge}>
                      <Text style={s.responseBadgeIcon}>⚡</Text>
                      <Text style={s.responseBadgeText}>Répond généralement en quelques heures</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </LinearGradient>

            {/* ══════════════ STATS ROW ULTRA-COMPACT ════════════════════════════════════ */}
            <View style={s.statsRow}>
              <View style={s.statChip}>
                <Text style={s.statChipIcon}>📦</Text>
                <Text style={s.statChipValue}>{totalCount}</Text>
              </View>
              <View style={s.statChipDivider} />
              <View style={s.statChip}>
                <Text style={s.statChipIcon}>💬</Text>
                <Text style={s.statChipValue}>{sellerTotalReviews}</Text>
              </View>
              <View style={s.statChipDivider} />
              <View style={s.statChip}>
                <Text style={s.statChipIcon}>⚡</Text>
                <Text style={s.statChipValue}>{sellerResponseRate}%</Text>
              </View>
            </View>

            {/* ══════════════ FILTRES PREMIUM ═══════════════════════════════════════════ */}
            <View style={s.filtersRow}>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'all' && s.filterBtnActive]}
                onPress={() => setFilterType('all')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnIcon, filterType === 'all' && s.filterBtnIconActive]}>🎯</Text>
                <Text style={[s.filterBtnText, filterType === 'all' && s.filterBtnTextActive]}>
                  Tout ({totalCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'product' && s.filterBtnActive]}
                onPress={() => setFilterType('product')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnIcon, filterType === 'product' && s.filterBtnIconActive]}>📦</Text>
                <Text style={[s.filterBtnText, filterType === 'product' && s.filterBtnTextActive]}>
                  Produits ({productCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'service' && s.filterBtnActive]}
                onPress={() => setFilterType('service')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnIcon, filterType === 'service' && s.filterBtnIconActive]}>🛠</Text>
                <Text style={[s.filterBtnText, filterType === 'service' && s.filterBtnTextActive]}>
                  Services ({serviceCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Padding pour la grille */}
            <View style={{ height: 12 }} />
          </>
        )}
        ListEmptyComponent={() => (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 64 }}>📭</Text>
            <Text style={s.emptyTitle}>Aucune annonce</Text>
            <Text style={s.emptyText}>Ce vendeur n'a pas encore publié d'annonce</Text>
          </View>
        )}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.cream },

  // Loading
  loadScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadLogoBox:  { width: 74, height: 74, borderRadius: 22, backgroundColor: P.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  loadLogoTxt:  { fontSize: 40, fontWeight: '900', color: P.brown },
  loadBrand:    { fontSize: 28, fontWeight: '900', color: P.cream, letterSpacing: -1 },

  // Error
  errorScreen:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: P.cream },
  errorTitle:   { fontSize: 22, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8 },
  errorText:    { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  errorBtn:     { backgroundColor: P.terra, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  errorBtnTxt:  { fontSize: 15, fontWeight: '800', color: P.white },

  // Header flottant
  headerFloat: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center', shadowColor: P.shadow, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 5 },
  backBtnTxt: { fontSize: 22, color: P.white, fontWeight: '700' },

  // Hero
  hero: { paddingBottom: 12, paddingHorizontal: 18, overflow: 'hidden', position: 'relative' },
  heroContent: { alignItems: 'center', marginTop: 6 },
  
  // Decorative Elements
  deco1: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(236, 90, 19, 0.08)', top: -40, right: -40 },
  deco2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 168, 123, 0.06)', bottom: 60, left: -20 },
  deco3: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(236, 90, 19, 0.04)', top: 120, left: 40 },
  heroTopLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' },

  // Seller Info Container
  sellerInfoContainer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  
  // Avatar
  avatarContainer: { marginBottom: 0, shadowColor: P.shadow, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4 },
  avatarWrap: { position: 'relative', alignItems: 'center' },
  avatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: P.white },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: P.white },
  avatarInitials: { fontSize: 24, fontWeight: '900', color: P.white, letterSpacing: -1 },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: P.green, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: P.white, shadowColor: P.shadow, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
  verifiedIcon: { fontSize: 11, color: P.white, fontWeight: '900' },

  // Seller Details Section
  sellerDetailsSection: { flex: 1, justifyContent: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  heroName: { fontSize: 18, fontWeight: '900', color: P.white, letterSpacing: -0.5, flex: 1 },
  heroSubName: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.72)', marginTop: -2 },
  topSellerBadge: { backgroundColor: 'rgba(34, 197, 94, 0.9)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  topSellerBadgeTxt: { fontSize: 8, fontWeight: '700', color: P.white, letterSpacing: 0.2 },

  // Hero text
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroMetaText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroMetaSep: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
  heroLocIcon: { fontSize: 12 },
  heroRatingStar: { fontSize: 12 },

  // Response Badge
  responseBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(34, 197, 94, 0.12)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 0.8, borderColor: 'rgba(34, 197, 94, 0.25)' },
  responseBadgeIcon: { fontSize: 10 },
  responseBadgeText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  // Stats - Ultra Compact Chips
  statsRow: { flexDirection: 'row', gap: 0, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.03)', shadowColor: P.brown, shadowOpacity: 0.02, shadowOffset: { width: 0, height: 0.5 }, shadowRadius: 1, elevation: 0 },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  statChipIcon: { fontSize: 13 },
  statChipValue: { fontSize: 12, fontWeight: '900', color: P.terra, letterSpacing: -0.2 },
  statChipDivider: { width: 1, height: 14, backgroundColor: 'rgba(107, 114, 128, 0.2)' },

  // Filtres
  filtersRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: P.white },
  filterBtn: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E8EAEF', alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  filterBtnActive: { backgroundColor: P.terra, borderColor: P.terra },
  filterBtnIcon: { fontSize: 12, marginBottom: 0 },
  filterBtnIconActive: { fontSize: 12 },
  filterBtnText: { fontSize: 9, fontWeight: '700', color: P.muted, textAlign: 'center' },
  filterBtnTextActive: { color: P.white },

  // Products grid
  productsRow: { 
    gap: 12, 
    paddingHorizontal: 12,
    justifyContent: 'flex-start'
  },

  // Card structure (matching AnnounceCard from ProductsListScreen)
  card: { 
    backgroundColor: P.white, 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 12, 
    borderWidth: 1.5, 
    borderColor: P.dim, 
    shadowColor: P.brown, 
    shadowOpacity: 0.12, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowRadius: 12, 
    elevation: 4,
    flex: 1,
    maxWidth: (Dimensions.get('window').width - 36) / 2,
  },

  // Card Image Wrapper
  cardImgWrap: { 
    position: 'relative', 
    width: '100%', 
    aspectRatio: 1, 
    backgroundColor: P.sand,
    overflow: 'hidden',
  },
  cardImg: { 
    width: '100%', 
    height: '100%', 
  },

  // Time Badge
  cardTimeBadge: { 
    position: 'absolute', 
    top: 10, 
    left: 10, 
    flexDirection: 'row', 
    gap: 4, 
    alignItems: 'center',
    backgroundColor: 'rgba(253,246,236,0.92)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cardTimeTxt: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: P.charcoal,
  },

  // Fav Ghost
  cardFavGhost: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(253,246,236,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card Body
  cardBody: { 
    padding: 12,
  },

  // Title Row
  cardTitleRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTypeGlyphWrap: { 
    width: 24, 
    height: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cardTypeGlyph: { 
    fontSize: 16, 
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: P.charcoal,
    flex: 1,
  },

  // Meta Row (Location + Distance)
  cardMetaRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  cardLoc: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: P.muted,
    flex: 1,
  },
  cardMetaDot: { 
    fontSize: 11, 
    color: P.muted,
    fontWeight: '600',
  },
  cardMetaTail: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: P.muted,
  },

  // Price Row
  cardPriceRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  cardPriceSpacer: { 
    flex: 1,
  },
  cardPriceTxt: { 
    fontSize: 14, 
    fontWeight: '900', 
    letterSpacing: -0.3,
  },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: P.muted, textAlign: 'center' },
});


