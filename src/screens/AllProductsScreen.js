// ─── AllProductsScreen — MarketHub Niger ───────────────────────────────────────
// Page "Voir tout" modernisée avec filtres et animations

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Dimensions, StatusBar, Animated,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../utils/constants';
import { apiClient } from '../api/auth';

const { width } = Dimensions.get('window');

// ─── PALETTE ───────────────────────────────────────────────────────────────────
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

// Extraire le nom de la ville depuis la localisation
const getCityName = (location) => {
  if (!location) return '';
  return location.split(',')[0].trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ item, onPress }) {
  const sc = useRef(new Animated.Value(1)).current;
  const isService = item.type === 'service';
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.96, useNativeDriver: true, speed: 28 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 28 }).start()}
    >
      <Animated.View style={[s.card, { transform: [{ scale: sc }] }]}>
        <View style={s.cardImgWrap}>
          <Image
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200x145/F5E6C8/C1440E?text=MarketHub' }}
            style={s.cardImg}
            resizeMode="cover"
          />
          <LinearGradient colors={['transparent', 'rgba(26,18,16,0.38)']} style={StyleSheet.absoluteFill} />
          <View style={[s.typeBadge, { backgroundColor: isService ? P.terra : P.amber }]}>
            <Text style={s.typeBadgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.cardLoc} numberOfLines={1}>📍 {getCityName(item.location) || 'Niger'}</Text>
          <View style={s.cardBottom}>
            <Text style={s.cardPrice}>
              {item.price ? `${parseInt(item.price).toLocaleString()} FCFA` : 'Prix à discuter'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function AllProductsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { type } = route.params; // 'product' ou 'service'
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'price-asc', 'price-desc'

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const title = type === 'service' ? 'Tous les Services' : 'Tous les Produits';
  const emoji = type === 'service' ? '🛠️' : '📦';

  const fetchProducts = async () => {
    try {
      const response = await apiClient.get('/products');
      const allProducts = response.data.data || response.data;
      
      // Filtrer selon le type
      const filtered = type === 'service' 
        ? allProducts.filter(item => item.type === 'service')
        : allProducts.filter(item => item.type !== 'service');
      
      setProducts(filtered);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [type]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchProducts(); }, [type]);

  // Tri
  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'price-asc') return parseInt(a.price || 0) - parseInt(b.price || 0);
    if (sortBy === 'price-desc') return parseInt(b.price || 0) - parseInt(a.price || 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Configuration du header
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={P.terra} />

      {/* ══════════════ HERO HEADER ═══════════════════════════════════════════ */}
      <LinearGradient
        colors={[P.terra, '#8A2400', P.charcoal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: (insets.top || 0) + 14 }]}
      >
        <View style={s.deco1} />
        <View style={s.deco2} />

        <Animated.View style={{ opacity: fade }}>
          <View style={s.heroTop}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={s.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={s.heroTitleRow}>
                <Text style={s.heroEmoji}>{emoji}</Text>
                <Text style={s.heroTitle}>{title}</Text>
              </View>
              <Text style={s.heroSub}>
                {sortedProducts.length} annonce{sortedProducts.length > 1 ? 's' : ''} disponible{sortedProducts.length > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ══════════════ TRI ════════════════════════════════════════════════════ */}
      <View style={s.sortWrap}>
        <TouchableOpacity
          style={s.sortBtn}
          onPress={() => {
            const nextSort = sortBy === 'recent' ? 'price-asc' : sortBy === 'price-asc' ? 'price-desc' : 'recent';
            setSortBy(nextSort);
          }}
          activeOpacity={0.7}
        >
          <Text style={s.sortIcon}>
            {sortBy === 'recent' ? '🕐' : sortBy === 'price-asc' ? '↑' : '↓'}
          </Text>
          <Text style={s.sortLabel}>
            {sortBy === 'recent' ? 'Récent' : sortBy === 'price-asc' ? 'Prix ↑' : 'Prix ↓'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════ GRILLE PRODUITS ════════════════════════════════════════ */}
      <FlatList
        data={sortedProducts}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
          />
        )}
        keyExtractor={(item, index) => item.id?.toString() || `product-${index}`}
        contentContainerStyle={{ paddingBottom: 80 + Math.max(insets.bottom, 8), padding: 12 }}
        numColumns={2}
        columnWrapperStyle={s.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[P.terra]}
            tintColor={P.terra}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 64 }}>📭</Text>
            <Text style={s.emptyTitle}>Aucune annonce</Text>
            <Text style={s.emptySub}>
              Pas {type === 'service' ? 'de services' : 'de produits'} pour le moment
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('CreateProduct')}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnTxt}>📣  Publier une annonce</Text>
            </TouchableOpacity>
          </View>
        }
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

  // Hero
  hero:  { paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' },
  deco1: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(240,165,0,0.10)' },
  deco2: { position: 'absolute', bottom: -30, left: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(193,68,14,0.14)' },

  heroTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, color: P.cream, fontWeight: '700' },

  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroEmoji: { fontSize: 28 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: P.cream, letterSpacing: -0.6, flex: 1 },
  heroSub: { fontSize: 12, color: 'rgba(253,246,236,0.62)', marginTop: 4, marginLeft: 38 },

  // Tri
  sortWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: P.surface, borderBottomWidth: 1, borderBottomColor: P.dim },
  sortBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.cream, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 6, borderWidth: 1.5, borderColor: 'rgba(193,68,14,0.15)', alignSelf: 'flex-start' },
  sortIcon: { fontSize: 14 },
  sortLabel: { fontSize: 13, fontWeight: '700', color: P.brown },

  // Grille
  row: { justifyContent: 'space-between' },

  // Cartes
  card:       { width: (width / 2) - 18, backgroundColor: P.cream, borderRadius: 20, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(157,136,114,0.18)', shadowColor: P.brown, shadowOpacity: 0.11, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5 },
  cardImgWrap:{ height: 145, backgroundColor: P.sand, position: 'relative' },
  cardImg:    { width: '100%', height: '100%' },
  typeBadge:  { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeTxt:{ fontSize: 9, fontWeight: '800', color: P.white },
  cardBody:   { padding: 13 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: P.charcoal, lineHeight: 20, marginBottom: 7, minHeight: 40 },
  cardLoc:    { fontSize: 11, color: P.muted, marginBottom: 10 },
  cardBottom: { borderTopWidth: 1, borderTopColor: P.dim, paddingTop: 10 },
  cardPrice:  { fontSize: 14, fontWeight: '900', color: P.terra },

  // Empty
  empty:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:   { backgroundColor: P.terra, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8 },
  emptyBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});
