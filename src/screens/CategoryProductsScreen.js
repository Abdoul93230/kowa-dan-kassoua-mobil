// ─── CategoryProductsScreen v2 PREMIUM ─ MarketHub Niger ─────────────────────
// Layout éditorial : Hero card + grille 2 col · Header shrink au scroll
// Filtres type · Filtre prix slider · Favoris · Stats · 100% tokens P.*

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Dimensions, StatusBar,
  Animated, Modal, ScrollView, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CATEGORIES } from '../utils/constants';
import { apiClient } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_WIDTH  = (width - 48) / 2;
const HERO_HEIGHT = 220;
const HEADER_MAX  = 162; // ligne principale (54px) + gap + stats (52px) + paddings
const HEADER_MIN  = 60;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const getCityName = (loc) => (loc ? loc.split(',')[0].trim() : 'Niger');
const fmtPrice    = (p)   => p ? `${parseInt(p).toLocaleString()} FCFA` : 'À discuter';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER PRIX (réutilisé depuis AllProductsScreen)
// ─────────────────────────────────────────────────────────────────────────────
function PriceSlider({ min, max, values, onChange, trackWidth }) {
  const tw    = trackWidth || (width - 80);
  const toX   = (v) => ((v - min) / (max - min)) * tw;
  const toVal = (x) => Math.round(min + (Math.max(0, Math.min(tw, x)) / tw) * (max - min));

  const leftX  = useRef(new Animated.Value(toX(values[0]))).current;
  const rightX = useRef(new Animated.Value(toX(values[1]))).current;
  const [left,  setLeft]  = useState(values[0]);
  const [right, setRight] = useState(values[1]);

  const makePan = (isLeft) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      const base = isLeft ? toX(left) : toX(right);
      const nx   = base + g.dx;
      const nv   = toVal(nx);
      if (isLeft) {
        if (nv >= min && nv < right - 1000) {
          leftX.setValue(Math.max(0, Math.min(toX(right) - 24, nx)));
          setLeft(nv);
        }
      } else {
        if (nv <= max && nv > left + 1000) {
          rightX.setValue(Math.max(toX(left) + 24, Math.min(tw, nx)));
          setRight(nv);
        }
      }
    },
    onPanResponderRelease: () => onChange([left, right]),
  });

  const panLeft  = useRef(makePan(true)).current;
  const panRight = useRef(makePan(false)).current;

  return (
    <View style={{ width: tw, height: 40, justifyContent: 'center' }}>
      <View style={sl.track} />
      <Animated.View style={[sl.trackFill, { left: leftX, width: Animated.subtract(rightX, leftX) }]} />
      <Animated.View style={[sl.thumb, { left: Animated.subtract(leftX, 11) }]} {...panLeft.panHandlers}>
        <View style={sl.thumbInner} />
      </Animated.View>
      <Animated.View style={[sl.thumb, { left: Animated.subtract(rightX, 11) }]} {...panRight.panHandlers}>
        <View style={sl.thumbInner} />
      </Animated.View>
    </View>
  );
}

const sl = StyleSheet.create({
  track:      { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: P.dim },
  trackFill:  { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: P.terra },
  thumb:      { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: P.white, borderWidth: 2.5, borderColor: P.terra, justifyContent: 'center', alignItems: 'center', shadowColor: P.terra, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4 },
  thumbInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.terra },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FILTRE PRIX
// ─────────────────────────────────────────────────────────────────────────────
function PriceFilterModal({ visible, onClose, priceRange, onApply, maxPrice }) {
  const insets    = useSafeAreaInsets();
  const [range, setRange] = useState(priceRange);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      setRange(priceRange);
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={fm.root}>
        <TouchableOpacity style={fm.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[fm.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={fm.handle} />
          <View style={fm.head}>
            <Text style={fm.title}>Filtre par prix</Text>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
              <Text style={fm.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={fm.valRow}>
            <View style={fm.valBox}>
              <Text style={fm.valLabel}>MIN</Text>
              <Text style={fm.valNum}>{range[0].toLocaleString()}</Text>
              <Text style={fm.valUnit}>FCFA</Text>
            </View>
            <View style={fm.valSep} />
            <View style={fm.valBox}>
              <Text style={fm.valLabel}>MAX</Text>
              <Text style={fm.valNum}>{range[1].toLocaleString()}</Text>
              <Text style={fm.valUnit}>FCFA</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 24 }}>
            <PriceSlider min={0} max={maxPrice} values={range} onChange={setRange} trackWidth={width - 80} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fm.chips}>
            {[
              { label: 'Tout',       v: [0, maxPrice] },
              { label: '< 5 000',    v: [0, 5000] },
              { label: '5k – 50k',   v: [5000, 50000] },
              { label: '50k – 200k', v: [50000, 200000] },
              { label: '> 200k',     v: [200000, maxPrice] },
            ].map((chip, i) => {
              const active = range[0] === chip.v[0] && range[1] === chip.v[1];
              return (
                <TouchableOpacity key={i} style={[fm.chip, active && fm.chipActive]} onPress={() => setRange(chip.v)} activeOpacity={0.8}>
                  <Text style={[fm.chipTxt, active && fm.chipTxtActive]}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <TouchableOpacity style={fm.applyBtn} onPress={() => { onApply(range); onClose(); }} activeOpacity={0.88}>
              <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={fm.applyGrad}>
                <Text style={fm.applyTxt}>Appliquer le filtre</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  root:          { flex: 1, justifyContent: 'flex-end' },
  backdrop:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.shadow, opacity: 0.5 },
  sheet:         { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  head:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  title:         { fontSize: 18, fontWeight: '900', color: P.charcoal },
  closeBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { fontSize: 13, color: P.muted, fontWeight: '700' },
  valRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  valBox:        { flex: 1, alignItems: 'center' },
  valLabel:      { fontSize: 10, fontWeight: '700', color: P.muted, letterSpacing: 1, marginBottom: 4 },
  valNum:        { fontSize: 22, fontWeight: '900', color: P.terra },
  valUnit:       { fontSize: 10, color: P.muted, fontWeight: '600' },
  valSep:        { width: 1, height: 40, backgroundColor: P.dim, marginHorizontal: 16 },
  chips:         { paddingHorizontal: 20, gap: 8 },
  chip:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.dim },
  chipActive:    { backgroundColor: P.peachSoft, borderColor: P.terra },
  chipTxt:       { fontSize: 13, fontWeight: '600', color: P.muted },
  chipTxtActive: { color: P.terra, fontWeight: '800' },
  applyBtn:      { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  applyGrad:     { paddingVertical: 16, alignItems: 'center' },
  applyTxt:      { fontSize: 16, fontWeight: '800', color: P.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO CARD — première annonce pleine largeur
// ─────────────────────────────────────────────────────────────────────────────
function HeroCard({ item, onPress, isFav, onFavToggle, fadeAnim }) {
  const sc = useRef(new Animated.Value(1)).current;
  if (!item) return null;
  const isService = item.type === 'service';
  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: sc }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn ={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 28 }).start()}
        onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 28 }).start()}
      >
        <View style={h.card}>
          <Image
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x220/F5E6C8/C1440E?text=MarketHub' }}
            style={h.img}
            resizeMode="cover"
          />
          <LinearGradient colors={['transparent', P.charcoal]} style={StyleSheet.absoluteFill} />
          <View style={[h.badge, { backgroundColor: isService ? P.terra : P.gold }]}>
            <Text style={h.badgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>
          <TouchableOpacity style={h.favBtn} onPress={onFavToggle} activeOpacity={0.8}>
            <Text style={h.favIcon}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <View style={h.info}>
            <View style={h.tagHero}>
              <Text style={h.tagTxt}>⭐ À la une</Text>
            </View>
            <Text style={h.title} numberOfLines={2}>{item.title}</Text>
            <View style={h.row}>
              <Text style={h.loc}>📍 {getCityName(item.location)}</Text>
              <Text style={h.price}>{fmtPrice(item.price)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const h = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, overflow: 'hidden', height: HERO_HEIGHT, shadowColor: P.charcoal, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10 },
  img:      { width: '100%', height: '100%', position: 'absolute' },
  badge:    { position: 'absolute', top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: P.white },
  favBtn:   { position: 'absolute', top: 10, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  favIcon:  { fontSize: 18 },
  info:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  tagHero:  { alignSelf: 'flex-start', backgroundColor: P.terra, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  tagTxt:   { fontSize: 9, fontWeight: '800', color: P.white, letterSpacing: 0.5 },
  title:    { fontSize: 18, fontWeight: '900', color: P.white, marginBottom: 8, lineHeight: 24 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loc:      { fontSize: 12, color: P.orange200, fontWeight: '500' },
  price:    { fontSize: 16, fontWeight: '900', color: P.amber },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD — grille 2 colonnes avec animation staggerée
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({ item, onPress, isFav, onFavToggle, index }) {
  const sc        = useRef(new Animated.Value(1)).current;
  const itemFade  = useRef(new Animated.Value(0)).current;
  const itemSlide = useRef(new Animated.Value(20)).current;
  const isService = item.type === 'service';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(itemFade,  { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.spring(itemSlide, { toValue: 0, tension: 80, friction: 10, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: itemFade, transform: [{ translateY: itemSlide }, { scale: sc }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn ={() => Animated.spring(sc, { toValue: 0.95, useNativeDriver: true, speed: 28 }).start()}
        onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 28 }).start()}
      >
        <View style={cd.card}>
          <View style={cd.imgWrap}>
            <Image
              source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200x130/F5E6C8/C1440E?text=M' }}
              style={cd.img}
              resizeMode="cover"
            />
            <TouchableOpacity style={cd.favBtn} onPress={onFavToggle} activeOpacity={0.8}>
              <Text style={cd.favIcon}>{isFav ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <View style={[cd.badge, { backgroundColor: isService ? P.terra : P.gold }]}>
              <Text style={cd.badgeTxt}>{isService ? '🛠' : '📦'}</Text>
            </View>
          </View>
          <View style={cd.body}>
            <Text style={cd.title} numberOfLines={2}>{item.title}</Text>
            <Text style={cd.loc} numberOfLines={1}>📍 {getCityName(item.location)}</Text>
            <View style={cd.footer}>
              <Text style={cd.price}>{fmtPrice(item.price)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const cd = StyleSheet.create({
  card:     { width: CARD_WIDTH, backgroundColor: P.white, borderRadius: 18, overflow: 'hidden', marginBottom: 12, shadowColor: P.charcoal, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: P.dim },
  imgWrap:  { height: 130, backgroundColor: P.sand, position: 'relative' },
  img:      { width: '100%', height: '100%' },
  favBtn:   { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  favIcon:  { fontSize: 14 },
  badge:    { position: 'absolute', bottom: 8, left: 8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  badgeTxt: { fontSize: 11 },
  body:     { padding: 10 },
  title:    { fontSize: 13, fontWeight: '700', color: P.charcoal, lineHeight: 18, marginBottom: 4, minHeight: 36 },
  loc:      { fontSize: 10, color: P.muted, marginBottom: 8 },
  footer:   { borderTopWidth: 1, borderTopColor: P.dim, paddingTop: 8 },
  price:    { fontSize: 13, fontWeight: '900', color: P.terra },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHIP FILTRE TYPE (Tout / Produits / Services)
// ─────────────────────────────────────────────────────────────────────────────
function FilterChip({ label, active, onPress, icon }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.92, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[fc.chip, active && fc.chipActive, { transform: [{ scale: sc }] }]}>
        {icon && <Text style={fc.icon}>{icon}</Text>}
        <Text style={[fc.txt, active && fc.txtActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const fc = StyleSheet.create({
  chip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 6, borderWidth: 1.5, borderColor: P.dim },
  chipActive:{ backgroundColor: P.terra, borderColor: P.terra },
  icon:      { fontSize: 13 },
  txt:       { fontSize: 13, fontWeight: '700', color: P.muted },
  txtActive: { color: P.white, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CategoryProductsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { categorySlug, categoryName } = route.params;

  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filterType,   setFilterType]   = useState('all');
  const [sortBy,       setSortBy]       = useState('recent');
  const [priceRange,   setPriceRange]   = useState([0, 1000000]);
  const [showFilter,   setShowFilter]   = useState(false);
  const [favorites,    setFavorites]    = useState(new Set());
  const [filterActive, setFilterActive] = useState(false);

  const scrollY    = useRef(new Animated.Value(0)).current;
  const heroFade   = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const category     = CATEGORIES.find(c => c.slug === categorySlug);
  const categoryEmoji = category?.emoji || '📦';

  // ── Header shrink ──────────────────────────────────────────────────────────
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: 'clamp',
  });
  const heroScale = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });
  const titleSize = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [24, 17],
    extrapolate: 'clamp',
  });
  const statsOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    Animated.parallel([
      Animated.timing(heroFade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    loadFavorites();
  }, []);

  // ── Favoris ────────────────────────────────────────────────────────────────
  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('favorites');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch (_) {}
  };

  const toggleFav = async (id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem('favorites', JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  // ── Données ────────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await apiClient.get(`/products?categorySlug=${categorySlug}`);
      const all = res.data.data || res.data;
      setProducts(all);
      const prices = all.map(i => parseInt(i.price || 0));
      const maxP   = Math.max(...prices, 1000000);
      setPriceRange([0, maxP]);
    } catch (e) {
      console.error('Erreur chargement:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [categorySlug]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchProducts(); }, [categorySlug]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const productsCount = products.filter(i => i.type !== 'service').length;
  const servicesCount = products.filter(i => i.type === 'service').length;
  const maxPrice      = Math.max(...products.map(i => parseInt(i.price || 0)), 1000000);

  // ── Tri + filtres ──────────────────────────────────────────────────────────
  const processed = [...products]
    .filter(i => {
      const p = parseInt(i.price || 0);
      if (filterType === 'product') return i.type !== 'service';
      if (filterType === 'service') return i.type === 'service';
      return true;
    })
    .filter(i => {
      const p = parseInt(i.price || 0);
      return p >= priceRange[0] && p <= priceRange[1];
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc')  return parseInt(a.price || 0) - parseInt(b.price || 0);
      if (sortBy === 'price-desc') return parseInt(b.price || 0) - parseInt(a.price || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const heroItem  = processed[0] || null;
  const gridItems = processed.slice(1);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadScreen}>
        <LinearGradient colors={[P.charcoal, P.brown]} style={s.loadInner}>
          <LinearGradient colors={[P.gold, P.amber]} style={s.loadLogoBox}>
            <Text style={s.loadLogoTxt}>M</Text>
          </LinearGradient>
          <Text style={s.loadBrand}>MarketHub</Text>
          <ActivityIndicator size="large" color={P.amber} style={{ marginTop: 24 }} />
        </LinearGradient>
      </View>
    );
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ══ HEADER SHRINKABLE ═══════════════════════════════════════════════ */}
      <Animated.View style={[s.header, { height: Animated.add(headerHeight, insets.top || 0) }]}>
        <LinearGradient colors={[P.brown, P.charcoal]} style={StyleSheet.absoluteFill} />
        <View style={s.headerAccent} />

        <Animated.View style={[s.headerInner, { paddingTop: (insets.top || 0) + 6, opacity: headerFade }]}>
          {/* Ligne principale */}
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={s.backBtnTxt}>←</Text>
            </TouchableOpacity>

            <Animated.View style={[s.headerCenter, { transform: [{ scale: heroScale }] }]}>
              <View style={s.headerTitleRow}>
                <Text style={s.headerEmoji}>{categoryEmoji}</Text>
                <Animated.Text style={[s.headerTitle, { fontSize: titleSize }]} numberOfLines={1}>
                  {categoryName}
                </Animated.Text>
              </View>
              <Text style={s.headerCount}>{processed.length} annonce{processed.length > 1 ? 's' : ''}</Text>
            </Animated.View>

            <View style={s.headerActions}>
              {/* Tri rapide */}
              <TouchableOpacity
                style={s.actionBtn}
                activeOpacity={0.8}
                onPress={() => setSortBy(v => v === 'recent' ? 'price-asc' : v === 'price-asc' ? 'price-desc' : 'recent')}
              >
                <Text style={s.actionBtnTxt}>
                  {sortBy === 'recent' ? '🕐' : sortBy === 'price-asc' ? '↑' : '↓'}
                </Text>
              </TouchableOpacity>
              {/* Filtre prix */}
              <TouchableOpacity
                style={[s.actionBtn, filterActive && s.actionBtnActive]}
                activeOpacity={0.8}
                onPress={() => setShowFilter(true)}
              >
                <Text style={s.actionBtnTxt}>⚖️</Text>
                {filterActive && <View style={s.actionDot} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats produits / services — disparaissent au scroll */}
          <Animated.View style={[s.statsRow, { opacity: statsOpacity }]}>
            <TouchableOpacity style={[s.statBox, filterType === 'all' && s.statBoxActive]} onPress={() => setFilterType('all')} activeOpacity={0.8}>
              <Text style={s.statNum}>{products.length}</Text>
              <Text style={s.statLbl}>Tout</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <TouchableOpacity style={[s.statBox, filterType === 'product' && s.statBoxActive]} onPress={() => setFilterType('product')} activeOpacity={0.8}>
              <Text style={s.statNum}>{productsCount}</Text>
              <Text style={s.statLbl}>📦 Produits</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <TouchableOpacity style={[s.statBox, filterType === 'service' && s.statBoxActive]} onPress={() => setFilterType('service')} activeOpacity={0.8}>
              <Text style={s.statNum}>{servicesCount}</Text>
              <Text style={s.statLbl}>🛠 Services</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Glow ligne */}
        <LinearGradient
          colors={[P.charcoal, P.terra, P.charcoal]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </Animated.View>

      {/* ══ LISTE ════════════════════════════════════════════════════════════ */}
      <Animated.FlatList
        data={gridItems}
        keyExtractor={(item, i) => item.id?.toString() || `g-${i}`}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={{
          paddingTop: HEADER_MAX + (insets.top || 0) + 8,
          paddingHorizontal: 16,
          paddingBottom: 80 + Math.max(insets.bottom, 12),
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} />
        }
        ListHeaderComponent={
          <>
            {heroItem && (
              <HeroCard
                item={heroItem}
                onPress={() => navigation.navigate('ProductDetail', { productId: heroItem.id })}
                isFav={favorites.has(heroItem.id)}
                onFavToggle={() => toggleFav(heroItem.id)}
                fadeAnim={heroFade}
              />
            )}
            {gridItems.length > 0 && (
              <View style={s.sectionHead}>
                <View style={s.sectionLine} />
                <Text style={s.sectionLabel}>Toutes les annonces</Text>
                <View style={s.sectionLine} />
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <ProductCard
            item={item}
            index={index}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            isFav={favorites.has(item.id)}
            onFavToggle={() => toggleFav(item.id)}
          />
        )}
        ListEmptyComponent={
          !heroItem ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 64 }}>{categoryEmoji}</Text>
              <Text style={s.emptyTitle}>Aucune annonce</Text>
              <Text style={s.emptySub}>
                Pas d'annonces dans {categoryName} pour le moment.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => navigation.navigate('CreateProduct')}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[P.orange500, P.orange700]} style={s.emptyBtnGrad}>
                  <Text style={s.emptyBtnTxt}>📣 Publier une annonce</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* ══ MODAL FILTRE PRIX ════════════════════════════════════════════════ */}
      <PriceFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        priceRange={priceRange}
        maxPrice={maxPrice}
        onApply={(range) => {
          setPriceRange(range);
          setFilterActive(range[0] > 0 || range[1] < maxPrice);
        }}
      />
    </View>
  );
}

// ─── STYLES PRINCIPAUX ── 100% tokens P.* ────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.sand },

  // Loading
  loadScreen:  { flex: 1 },
  loadInner:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadLogoBox: { width: 74, height: 74, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  loadLogoTxt: { fontSize: 40, fontWeight: '900', color: P.brown },
  loadBrand:   { fontSize: 28, fontWeight: '900', color: P.white, letterSpacing: -1 },

  // Header shrinkable
  header:         { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
  headerAccent:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra, zIndex: 1 },
  headerInner:    { flex: 1, paddingHorizontal: 16, paddingBottom: 10 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:     { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter:   { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerEmoji:    { fontSize: 18 },
  headerTitle:    { fontWeight: '900', color: P.white, letterSpacing: -0.5, flexShrink: 1 },
  headerCount:    { fontSize: 11, color: P.amber, fontWeight: '600', marginTop: 2 },
  headerActions:  { flexDirection: 'row', gap: 6 },
  actionBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  actionBtnActive:{ backgroundColor: P.terra },
  actionBtnTxt:   { fontSize: 15 },
  actionDot:      { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: P.amber, borderWidth: 1.5, borderColor: P.charcoal },
  headerGlow:     { height: 1.5, position: 'absolute', bottom: 0, left: 0, right: 0 },

  // Stats cliquables dans le header
  statsRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: P.glassWhite25, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 6, gap: 0 },
  statBox:       { flex: 1, alignItems: 'center', paddingVertical: 3, borderRadius: 8 },
  statBoxActive: { backgroundColor: P.terra },
  statNum:       { fontSize: 16, fontWeight: '900', color: P.white, letterSpacing: -0.5 },
  statLbl:       { fontSize: 9, color: P.amber, fontWeight: '600', marginTop: 1 },
  statDivider:   { width: 1, height: 24, backgroundColor: P.glassWhite25 },

  // Séparateur section
  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 4 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: P.dim },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Grille
  row: { justifyContent: 'space-between', gap: 0 },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle:  { fontSize: 20, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8 },
  emptySub:    { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:    { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8 },
  emptyBtnGrad:{ paddingVertical: 14, paddingHorizontal: 24 },
  emptyBtnTxt: { fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});