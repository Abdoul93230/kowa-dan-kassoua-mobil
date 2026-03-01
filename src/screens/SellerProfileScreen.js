// ─── SellerProfileScreen — MarketHub Niger ────────────────────────────────────
// Profil public d'un vendeur avec ses annonces

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, ActivityIndicator, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../api/auth';

const { width } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const P = {
  terra:    '#C1440E',
  amber:    '#E8832A',
  gold:     '#F0A500',
  brown:    '#3D1C02',
  charcoal: '#1A1210',
  cream:    '#FDF6EC',
  sand:     '#F5E6C8',
  surface:  '#FFFAF3',
  muted:    '#9C8872',
  dim:      'rgba(61,28,2,0.06)',
  white:    '#FFFFFF',
};

// Extraire le nom de la ville
const getCityName = (location) => {
  if (!location) return '';
  return location.split(',')[0].trim();
};

// Initiales du vendeur
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD MINI
// ─────────────────────────────────────────────────────────────────────────────
function ProductCardMini({ item, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  };

  const isService = item.type === 'service';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[s.productCard, { transform: [{ scale: scaleAnim }] }]}>
        {/* Image avec gradient overlay */}
        <View style={s.productImgWrap}>
          <Image
            source={{ uri: item.mainImage || item.images?.[0] || 'https://via.placeholder.com/200/F5E6C8/C1440E?text=Image' }}
            style={s.productImg}
            resizeMode="cover"
          />
          {/* Gradient subtle sur l'image */}
          <LinearGradient
            colors={['transparent', 'rgba(26,18,16,0.3)']}
            style={s.productImgOverlay}
          />
          {/* Badge type */}
          <View style={[s.productTypeBadge, { backgroundColor: isService ? P.terra : P.amber }]}>
            <Text style={s.productTypeIcon}>{isService ? '🛠' : '📦'}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={s.productInfo}>
          <Text style={s.productTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.productPrice}>
            {item.price ? `${parseInt(item.price).toLocaleString()} FCFA` : 'Prix à discuter'}
          </Text>
          <View style={s.productMeta}>
            <Text style={s.productLoc} numberOfLines={1}>📍 {getCityName(item.location)}</Text>
            {item.views > 0 && (
              <Text style={s.productViews}>👁 {item.views}</Text>
            )}
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
        <LinearGradient colors={[P.terra, P.amber]} style={s.loadScreen}>
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
          <ProductCardMini
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
            {/* ══════════════ HEADER HERO ═══════════════════════════════════════ */}
            <LinearGradient colors={[P.terra, P.charcoal]} style={[s.hero, { paddingTop: insets.top + 66 }]}>
              <Animated.View style={[s.heroContent, { opacity: fadeAnim }]}>
                {/* Avatar */}
                <View style={s.avatarWrap}>
                  {seller.avatar ? (
                    <Image source={{ uri: seller.avatar }} style={s.avatarImg} />
                  ) : (
                    <View style={s.avatarPlaceholder}>
                      <Text style={s.avatarInitials}>{getInitials(seller.name)}</Text>
                    </View>
                  )}
                  {seller.verified && (
                    <View style={s.verifiedBadge}>
                      <Text style={s.verifiedIcon}>✓</Text>
                    </View>
                  )}
                </View>

                {/* Nom */}
                <Text style={s.heroName}>{seller.name}</Text>
                
                {/* Localisation + Rating */}
                <View style={s.heroMeta}>
                  <View style={s.heroMetaItem}>
                    <Text style={s.heroLocIcon}>📍</Text>
                    <Text style={s.heroMetaText}>{getCityName(seller.location)}</Text>
                  </View>
                  <Text style={s.heroMetaSep}>•</Text>
                  <View style={s.heroMetaItem}>
                    <Text style={s.heroRatingStar}>⭐</Text>
                    <Text style={s.heroMetaText}>
                      {seller.sellerStats?.rating?.toFixed(1) || '0.0'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </LinearGradient>

            {/* ══════════════ STATS ROW ═════════════════════════════════════════ */}
            <View style={s.statsRow}>
              <StatCard value={totalCount} label="Annonces" />
              <StatCard value={seller.sellerStats?.totalReviews || 0} label="Avis" />
              <StatCard value={`${seller.sellerStats?.responseRate || 0}%`} label="Réponse" />
            </View>

            {/* ══════════════ FILTRES ═══════════════════════════════════════════ */}
            <View style={s.filtersRow}>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'all' && s.filterBtnActive]}
                onPress={() => setFilterType('all')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnText, filterType === 'all' && s.filterBtnTextActive]}>
                  Tout ({totalCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'product' && s.filterBtnActive]}
                onPress={() => setFilterType('product')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnText, filterType === 'product' && s.filterBtnTextActive]}>
                  📦 Produits ({productCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterBtn, filterType === 'service' && s.filterBtnActive]}
                onPress={() => setFilterType('service')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterBtnText, filterType === 'service' && s.filterBtnTextActive]}>
                  🛠 Services ({serviceCount})
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
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 5 },
  backBtnTxt: { fontSize: 22, color: P.white, fontWeight: '700' },

  // Hero
  hero: { paddingBottom: 20, paddingHorizontal: 20 },
  heroContent: { alignItems: 'center' },
  
  // Avatar
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: P.white },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: P.gold, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: P.white },
  avatarInitials: { fontSize: 28, fontWeight: '900', color: P.white },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: P.white },
  verifiedIcon: { fontSize: 13, color: P.white, fontWeight: '900' },

  // Hero text
  heroName: { fontSize: 22, fontWeight: '900', color: P.white, marginBottom: 10, letterSpacing: -0.5, textAlign: 'center' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: 13, fontWeight: '600', color: P.cream },
  heroMetaSep: { fontSize: 13, color: 'rgba(253,246,236,0.5)', fontWeight: '700' },
  heroLocIcon: { fontSize: 14 },
  heroRatingStar: { fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.dim },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: P.surface, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: P.dim },
  statValue: { fontSize: 20, fontWeight: '900', color: P.terra, marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Filtres
  filtersRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: P.white },
  filterBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: P.cream, borderWidth: 1.5, borderColor: P.dim, alignItems: 'center' },
  filterBtnActive: { backgroundColor: P.terra, borderColor: P.terra },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: P.muted },
  filterBtnTextActive: { color: P.white },

  // Products grid
  productsRow: { 
    gap: 12, 
    paddingHorizontal: 12,
    justifyContent: 'flex-start'
  },
  productCard: { 
    flex: 1, 
    maxWidth: (Dimensions.get('window').width - 36) / 2, // (width - padding - gap) / 2
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
    elevation: 4 
  },
  productImgWrap: { position: 'relative', width: '100%', aspectRatio: 1, backgroundColor: P.sand },
  productImg: { width: '100%', height: '100%' },
  productImgOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  productTypeBadge: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  productTypeIcon: { fontSize: 15 },
  productInfo: { padding: 12 },
  productTitle: { fontSize: 14, fontWeight: '800', color: P.charcoal, lineHeight: 19, marginBottom: 6, minHeight: 38 },
  productPrice: { fontSize: 15, fontWeight: '900', color: P.terra, marginBottom: 6, letterSpacing: -0.3 },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  productLoc: { fontSize: 11, fontWeight: '600', color: P.muted, flex: 1 },
  productViews: { fontSize: 10, fontWeight: '600', color: P.muted, backgroundColor: P.cream, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: P.muted, textAlign: 'center' },
});
