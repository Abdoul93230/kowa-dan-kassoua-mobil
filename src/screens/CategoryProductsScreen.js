// ─── CategoryProductsScreen v2 PREMIUM ─ MarketHub Niger ─────────────────────
// Layout éditorial : Hero card + grille 2 col · Header shrink au scroll
// Filtres type · Filtre prix slider · Favoris · Stats · 100% tokens P.*

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Dimensions, StatusBar,
  Animated, ScrollView, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CATEGORIES } from '../utils/constants';
import { apiClient } from '../api/auth';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_WIDTH  = (width - 48) / 2;
const HERO_HEIGHT = 220;
const HEADER_MAX  = 162; // ligne principale (54px) + gap + stats (52px) + paddings
const HEADER_MIN  = 60;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const getCityName = (loc) => (loc ? loc.split(',')[0].trim() : 'Niger');
const fmtPrice    = (p)   => p ? `${parseInt(p).toLocaleString()} FCFA` : 'À discuter';
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
  return `${Math.floor(days / 7)} sem`;
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

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER DE PRIX (custom, sans lib externe)
// ─────────────────────────────────────────────────────────────────────────────
function PriceSlider({ min, max, values, onChange, trackWidth, accent = P.terra }) {
  const tw      = trackWidth || (width - 80);
  const toX     = (v) => ((v - min) / (max - min)) * tw;
  const toVal   = (x) => Math.round(min + (Math.max(0, Math.min(tw, x)) / tw) * (max - min));

  const leftX   = useRef(new Animated.Value(toX(values[0]))).current;
  const rightX  = useRef(new Animated.Value(toX(values[1]))).current;

  const leftRef  = useRef(values[0]);
  const rightRef = useRef(values[1]);

  const [left,  setLeft]  = useState(values[0]);
  const [right, setRight] = useState(values[1]);

  const leftStartX  = useRef(toX(values[0]));
  const rightStartX = useRef(toX(values[1]));

  const panLeft = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      leftStartX.current = toX(leftRef.current);
    },
    onPanResponderMove: (_, g) => {
      const nx = leftStartX.current + g.dx;
      const nv = toVal(nx);
      if (nv >= min && nv < rightRef.current - 1000) {
        leftX.setValue(Math.max(0, Math.min(toX(rightRef.current) - 24, nx)));
        leftRef.current = nv;
        setLeft(nv);
      }
    },
    onPanResponderRelease: () => onChange([leftRef.current, rightRef.current]),
  })).current;

  const panRight = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      rightStartX.current = toX(rightRef.current);
    },
    onPanResponderMove: (_, g) => {
      const nx = rightStartX.current + g.dx;
      const nv = toVal(nx);
      if (nv <= max && nv > leftRef.current + 1000) {
        rightX.setValue(Math.max(toX(leftRef.current) + 24, Math.min(tw, nx)));
        rightRef.current = nv;
        setRight(nv);
      }
    },
    onPanResponderRelease: () => onChange([leftRef.current, rightRef.current]),
  })).current;

  const fillLeft  = leftX;
  const fillWidth = Animated.subtract(rightX, leftX);

  useEffect(() => {
    const nextLeft  = values?.[0] ?? min;
    const nextRight = values?.[1] ?? max;
    leftRef.current  = nextLeft;
    rightRef.current = nextRight;
    setLeft(nextLeft);
    setRight(nextRight);
    leftX.setValue(toX(nextLeft));
    rightX.setValue(toX(nextRight));
  }, [values, min, max]);

  return (
    <View style={{ width: tw, height: 40, justifyContent: 'center' }}>
      <View style={sl.track} />
      <Animated.View style={[sl.trackFill, { left: fillLeft, width: fillWidth, backgroundColor: accent }]} />
      <Animated.View
        style={[sl.thumb, { left: Animated.subtract(leftX, 11), borderColor: accent, shadowColor: accent }]}
        {...panLeft.panHandlers}
      >
        <View style={[sl.thumbInner, { backgroundColor: accent }]} />
      </Animated.View>
      <Animated.View
        style={[sl.thumb, { left: Animated.subtract(rightX, 11), borderColor: accent, shadowColor: accent }]}
        {...panRight.panHandlers}
      >
        <View style={[sl.thumbInner, { backgroundColor: accent }]} />
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
// MODAL FILTRE PRIX PriceFilterModal
// ─────────────────────────────────────────────────────────────────────────────
function PriceFilterModal({ visible, onClose, priceRange, onApply, maxPrice, accent = P.terra, accentDark = P.orange700, accentSoft = P.peachSoft }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(priceRange);
  const [mounted, setMounted] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setRange(priceRange);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: P.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
        transform: [{ translateY: slideAnim }],
      }}>
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
            <Text style={[fm.valNum, { color: accent }]}>{range[0].toLocaleString()}</Text>
            <Text style={fm.valUnit}>FCFA</Text>
          </View>
          <View style={fm.valSep} />
          <View style={fm.valBox}>
            <Text style={fm.valLabel}>MAX</Text>
            <Text style={[fm.valNum, { color: accent }]}>{range[1].toLocaleString()}</Text>
            <Text style={fm.valUnit}>FCFA</Text>
          </View>
        </View>

        <Text style={fm.sliderHint}>Glissez le point gauche pour MIN et le point droit pour MAX.</Text>

        <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 24 }}>
          <PriceSlider
            min={0}
            max={maxPrice}
            values={range}
            onChange={setRange}
            trackWidth={width - 80}
            accent={accent}
          />
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
              <TouchableOpacity
                key={i}
                style={[fm.chip, active && { backgroundColor: accentSoft, borderColor: accent }]}
                onPress={() => setRange(chip.v)}
                activeOpacity={0.8}
              >
                <Text style={[fm.chipTxt, active && { color: accent, fontWeight: '800' }]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            style={[fm.applyBtn, { shadowColor: accent }]}
            onPress={() => { onApply(range); onClose(); }}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[accent, accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={fm.applyGrad}>
              <Text style={fm.applyTxt}>Appliquer le filtre</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const fm = StyleSheet.create({
  root:        { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.shadow, opacity: 0.78 },
 sheet: { 
  position: 'absolute',   // ← collé directement à l'écran
  bottom: 0, 
  left: 0, 
  right: 0, 
  backgroundColor: P.white, 
  borderTopLeftRadius: 28, 
  borderTopRightRadius: 28 
},
handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  head:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  title:       { fontSize: 18, fontWeight: '900', color: P.charcoal },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, color: P.muted, fontWeight: '700' },
  valRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  valBox:      { flex: 1, alignItems: 'center' },
  valLabel:    { fontSize: 10, fontWeight: '700', color: P.muted, letterSpacing: 1, marginBottom: 4 },
  valNum:      { fontSize: 22, fontWeight: '900', color: P.terra },
  valUnit:     { fontSize: 10, color: P.muted, fontWeight: '600' },
  valSep:      { width: 1, height: 40, backgroundColor: P.dim, marginHorizontal: 16 },
  sliderHint:  { fontSize: 11, color: P.muted, fontWeight: '600', paddingHorizontal: 20, marginTop: 2 },
  chips:       { paddingHorizontal: 20, gap: 8 },
  chip:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.dim },
  chipActive:  { backgroundColor: P.peachSoft, borderColor: P.terra },
  chipTxt:     { fontSize: 13, fontWeight: '600', color: P.muted },
  chipTxtActive:{ color: P.terra, fontWeight: '800' },
  applyBtn:    { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  applyGrad:   { paddingVertical: 16, alignItems: 'center' },
  applyTxt:    { fontSize: 16, fontWeight: '800', color: P.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO CARD — première annonce pleine largeur
// ─────────────────────────────────────────────────────────────────────────────
function HeroCard({ item, onPress, isFav, onFavToggle, fadeAnim }) {
  const sc = useRef(new Animated.Value(1)).current;
  if (!item) return null;
  const isService = String(item?.type || '').toLowerCase() === 'service';
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
          <View style={[h.badge, { backgroundColor: isService ? '#2563EB' : P.terra }]}>
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
              <Text style={[h.price, { color: isService ? P.blue100 : P.amber }]}>{fmtPrice(item.price)}</Text>
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
  const isService = String(item?.type || '').toLowerCase() === 'service';
  const accent = isService ? '#2563EB' : P.terra;
  const posted = getPostedLabel(item.createdAt || item.updatedAt);
  const distance = getDistanceKm(item._id || item.id);

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
            <View style={cd.timeBadge}>
              <Feather name="clock" size={10} color={P.charcoal} />
              <Text style={cd.timeTxt}>Il y a {posted}</Text>
            </View>
            <TouchableOpacity style={[cd.favBtn, { borderColor: isService ? 'rgba(37,99,235,0.2)' : 'rgba(236,90,19,0.2)' }]} onPress={onFavToggle} activeOpacity={0.8}>
              <Feather name={isFav ? 'heart' : 'heart'} size={14} color={accent} />
            </TouchableOpacity>
          </View>
          <View style={cd.body}>
            <View style={cd.titleRow}>
              <View style={cd.typeIconWrap}>
                <Text style={cd.typeIcon}>{isService ? '🛠️' : '📦'}</Text>
              </View>
              <Text style={cd.title} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={cd.metaRow}>
              <Feather name="map-pin" size={10} color={accent} />
              <Text style={cd.loc} numberOfLines={1}>{getCityName(item.location)}</Text>
              <Text style={cd.metaDot}>•</Text>
              <Text style={cd.metaTail}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={cd.priceRow}>
              <View style={cd.priceSpacer} />
              <Text style={[cd.price, { color: accent }]}>{fmtPrice(item.price)}</Text>
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
  timeBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  timeTxt: { fontSize: 9, color: P.charcoal, fontWeight: '700' },
  favBtn:   { position: 'absolute', top: 8, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 6, elevation: 6, borderWidth: 1, borderColor: 'rgba(236,90,19,0.2)' },
  body:     { paddingHorizontal: 10, paddingVertical: 9, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIconWrap: { width: 18, minWidth: 18, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 14 },
  title:    { flex: 1, fontSize: 12, fontWeight: '700', color: P.charcoal },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  loc:      { flexShrink: 1, fontSize: 10, color: P.muted, maxWidth: CARD_WIDTH * 0.32 },
  metaDot: { fontSize: 11, color: P.muted },
  metaTail:{ fontSize: 9, color: P.muted, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  priceSpacer: { width: 14 },
  price:    { fontSize: 12, fontWeight: '900', color: P.terra },
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
  const { isDark, theme: appTheme } = useAppTheme();
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
  const isServiceFilter = filterType === 'service';
  const modalAccent = isServiceFilter ? '#2563EB' : P.terra;
  const modalAccentDark = isServiceFilter ? '#1D4ED8' : P.orange700;
  const modalAccentSoft = isServiceFilter ? P.blue100 : P.peachSoft;
  const uiTheme = {
    screen: appTheme.screen,
    header: appTheme.header,
    headerText: appTheme.text,
    headerSubText: appTheme.textMuted,
    headerGlass: appTheme.glass,
    statsGlass: appTheme.glass,
    statDivider: appTheme.divider,
    loadScreenColors: appTheme.shell,
    loadBrandColor: appTheme.text,
  };

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
      const itemType = String(i?.type || '').toLowerCase();
      if (filterType === 'product') return itemType !== 'service';
      if (filterType === 'service') return itemType === 'service';
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
        <LinearGradient colors={uiTheme.loadScreenColors} style={s.loadInner}>
          <LinearGradient colors={[P.gold, P.amber]} style={s.loadLogoBox}>
            <Text style={s.loadLogoTxt}>M</Text>
          </LinearGradient>
          <Text style={[s.loadBrand, { color: uiTheme.loadBrandColor }]}>MarketHub</Text>
          <ActivityIndicator size="large" color={P.amber} style={{ marginTop: 24 }} />
        </LinearGradient>
      </View>
    );
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: uiTheme.screen }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ══ HEADER SHRINKABLE ═══════════════════════════════════════════════ */}
      <Animated.View style={[s.header, { height: Animated.add(headerHeight, insets.top || 0) }]}>
        <LinearGradient colors={uiTheme.header} style={StyleSheet.absoluteFill} />
        <View style={[s.headerAccent, { backgroundColor: modalAccent }]} />

        <Animated.View style={[s.headerInner, { paddingTop: (insets.top || 0) + 6, opacity: headerFade }]}>
          {/* Ligne principale */}
          <View style={s.headerRow}>
            <TouchableOpacity style={[s.backBtn, { backgroundColor: uiTheme.headerGlass }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={[s.backBtnTxt, { color: uiTheme.headerText }]}>←</Text>
            </TouchableOpacity>

            <Animated.View style={[s.headerCenter, { transform: [{ scale: heroScale }] }]}>
              <View style={s.headerTitleRow}>
                <Text style={s.headerEmoji}>{categoryEmoji}</Text>
                <Animated.Text style={[s.headerTitle, { fontSize: titleSize, color: uiTheme.headerText }]} numberOfLines={1}>
                  {categoryName}
                </Animated.Text>
              </View>
              <Text style={[s.headerCount, { color: uiTheme.headerSubText }]}>{processed.length} annonce{processed.length > 1 ? 's' : ''}</Text>
            </Animated.View>

            <View style={s.headerActions}>
              {/* Tri rapide */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: uiTheme.headerGlass }]}
                activeOpacity={0.8}
                onPress={() => setSortBy(v => v === 'recent' ? 'price-asc' : v === 'price-asc' ? 'price-desc' : 'recent')}
              >
                <Text style={s.actionBtnTxt}>
                  {sortBy === 'recent' ? '🕐' : sortBy === 'price-asc' ? '↑' : '↓'}
                </Text>
              </TouchableOpacity>
              {/* Filtre prix */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: uiTheme.headerGlass }, filterActive && [s.actionBtnActive, { backgroundColor: modalAccent }]]}
                activeOpacity={0.8}
                onPress={() => setShowFilter(true)}
              >
                <Text style={s.actionBtnTxt}>⚖️</Text>
                {filterActive && <View style={[s.actionDot, { borderColor: modalAccent }]} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats produits / services — disparaissent au scroll */}
          <Animated.View style={[s.statsRow, { opacity: statsOpacity, backgroundColor: uiTheme.statsGlass }]}>
            <TouchableOpacity style={[s.statBox, filterType === 'all' && [s.statBoxActive, { backgroundColor: modalAccent }]]} onPress={() => setFilterType('all')} activeOpacity={0.8}>
              <Text style={[s.statNum, { color: filterType === 'all' ? P.white : uiTheme.headerText }]}>{products.length}</Text>
              <Text style={[s.statLbl, { color: filterType === 'all' ? P.white : uiTheme.headerSubText }]}>Tout</Text>
            </TouchableOpacity>
            <View style={[s.statDivider, { backgroundColor: uiTheme.statDivider }]} />
            <TouchableOpacity style={[s.statBox, filterType === 'product' && [s.statBoxActive, { backgroundColor: modalAccent }]]} onPress={() => setFilterType('product')} activeOpacity={0.8}>
              <Text style={[s.statNum, { color: filterType === 'product' ? P.white : uiTheme.headerText }]}>{productsCount}</Text>
              <Text style={[s.statLbl, { color: filterType === 'product' ? P.white : uiTheme.headerSubText }]}>📦 Produits</Text>
            </TouchableOpacity>
            <View style={[s.statDivider, { backgroundColor: uiTheme.statDivider }]} />
            <TouchableOpacity style={[s.statBox, filterType === 'service' && [s.statBoxActive, { backgroundColor: modalAccent }]]} onPress={() => setFilterType('service')} activeOpacity={0.8}>
              <Text style={[s.statNum, { color: filterType === 'service' ? P.white : uiTheme.headerText }]}>{servicesCount}</Text>
              <Text style={[s.statLbl, { color: filterType === 'service' ? P.white : uiTheme.headerSubText }]}>🛠 Services</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modalAccent]} tintColor={modalAccent} />
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
        accent={modalAccent}
        accentDark={modalAccentDark}
        accentSoft={modalAccentSoft}
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