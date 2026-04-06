// ─── AllProductsScreen v2 PREMIUM ─ MarketHub Niger ──────────────────────────
// Layout éditorial : Hero card + grille 2 col · Header shrink au scroll
// Filtre prix slider · Favoris · Animations staggerées · 100% tokens P.*

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Dimensions, StatusBar,
  Animated, Modal, ScrollView, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { getFavoriteIds, toggleFavorite } from '../api/favorites';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_WIDTH = (width - 48) / 2;
const HERO_HEIGHT = 220;
const HEADER_MAX = 110;
const HEADER_MIN = 56;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const getCityName = (loc) => (loc ? loc.split(',')[0].trim() : 'Niger');
const fmtPrice    = (p)   => p ? `${parseInt(p).toLocaleString()} FCFA` : 'À discuter';
const getProductId = (item) => item?._id || item?.id;
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

  // ✅ Utiliser des refs pour avoir toujours la valeur courante dans les PanResponders
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

  // ✅ Sync depuis l'extérieur (chips, reset)
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
// HERO CARD — première annonce, pleine largeur
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
          {/* Image */}
          <Image
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x220/F5E6C8/C1440E?text=MarketHub' }}
            style={h.img}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', P.charcoal]}
            style={StyleSheet.absoluteFill}
          />
          {/* Badge type */}
          <View style={[h.badge, { backgroundColor: isService ? '#2563EB' : P.terra }]}>
            <Text style={h.badgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>
          {/* Favori */}
          <TouchableOpacity style={[h.favBtn, { borderColor: isService ? 'rgba(37,99,235,0.2)' : 'rgba(236,90,19,0.2)' }]} onPress={onFavToggle} activeOpacity={0.8}>
            <Text style={[h.favIcon, { color: isService ? '#2563EB' : P.terra }]}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          {/* Infos bas */}
          <View style={h.info}>
            <View style={[h.tagHero, { backgroundColor: isService ? '#2563EB' : P.terra }]}>
              <Text style={h.tagTxt}>{isService ? '⭐ Service à la une' : '⭐ Produit à la une'}</Text>
            </View>
            <Text style={h.title} numberOfLines={2}>{item.title}</Text>
            <View style={h.row}>
              <Text style={[h.loc, { color: isService ? P.blue100 : P.orange200 }]}>📍 {getCityName(item.location)}</Text>
              <Text style={[h.price, { color: isService ? P.blue100 : P.amber }]}>{fmtPrice(item.price)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const h = StyleSheet.create({
  card:    { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, overflow: 'hidden', height: HERO_HEIGHT, shadowColor: P.charcoal, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10 },
  img:     { width: '100%', height: '100%', position: 'absolute' },
  badge:   { position: 'absolute', top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeTxt:{ fontSize: 10, fontWeight: '800', color: P.white },
  favBtn:  { position: 'absolute', top: 10, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  favIcon: { fontSize: 18 },
  info:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  tagHero: { alignSelf: 'flex-start', backgroundColor: P.terra, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  tagTxt:  { fontSize: 9, fontWeight: '800', color: P.white, letterSpacing: 0.5 },
  title:   { fontSize: 18, fontWeight: '900', color: P.white, marginBottom: 8, lineHeight: 24 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loc:     { fontSize: 12, color: P.orange200, fontWeight: '500' },
  price:   { fontSize: 16, fontWeight: '900', color: P.amber },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD — grille 2 colonnes
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({ item, onPress, isFav, onFavToggle, index, listFade }) {
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
        <View style={c.card}>
          {/* Image */}
          <View style={c.imgWrap}>
            <Image
              source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200x130/F5E6C8/C1440E?text=M' }}
              style={c.img}
              resizeMode="cover"
            />
            <View style={c.timeBadge}>
              <Feather name="clock" size={10} color={P.charcoal} />
              <Text style={c.timeTxt}>Il y a {posted}</Text>
            </View>
            {/* Favori */}
            <TouchableOpacity style={[c.favBtn, { borderColor: isService ? 'rgba(37,99,235,0.2)' : 'rgba(236,90,19,0.2)' }]} onPress={onFavToggle} activeOpacity={0.8}>
              <Feather name={isFav ? 'heart' : 'heart'} size={14} color={accent} />
            </TouchableOpacity>
          </View>
          {/* Body */}
          <View style={c.body}>
            <View style={c.titleRow}>
              <View style={c.typeIconWrap}>
                <Text style={c.typeIcon}>{isService ? '🛠️' : '📦'}</Text>
              </View>
              <Text style={c.title} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={c.metaRow}>
              <Feather name="map-pin" size={10} color={accent} />
              <Text style={c.loc} numberOfLines={1}>{getCityName(item.location)}</Text>
              <Text style={c.metaDot}>•</Text>
              <Text style={c.metaTail}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={c.priceRow}>
              <View style={c.priceSpacer} />
              <Text style={[c.price, { color: isService ? '#2563EB' : P.terra }]}>{fmtPrice(item.price)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const c = StyleSheet.create({
  card:    { width: CARD_WIDTH, backgroundColor: P.white, borderRadius: 18, overflow: 'hidden', marginBottom: 12, shadowColor: P.charcoal, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: P.dim },
  imgWrap: { height: 130, backgroundColor: P.sand, position: 'relative' },
  img:     { width: '100%', height: '100%' },
  timeBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  timeTxt: { fontSize: 9, color: P.charcoal, fontWeight: '700' },
  favBtn:  { position: 'absolute', top: 8, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 6, elevation: 6, borderWidth: 1, borderColor: 'rgba(236,90,19,0.2)' },
  body:    { paddingHorizontal: 10, paddingVertical: 9, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIconWrap: { width: 18, minWidth: 18, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 14 },
  title:   { flex: 1, fontSize: 12, fontWeight: '700', color: P.charcoal },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  loc:     { flexShrink: 1, fontSize: 10, color: P.muted, maxWidth: CARD_WIDTH * 0.32 },
  metaDot: { fontSize: 11, color: P.muted },
  metaTail:{ fontSize: 9, color: P.muted, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  priceSpacer: { width: 14 },
  price:   { fontSize: 12, fontWeight: '900', color: P.terra },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FILTRE PRIX PriceFilterModal
// ─────────────────────────────────────────────────────────────────────────────
function PriceFilterSheet({ visible, onClose, priceRange, onApply, maxPrice, accent = P.terra, accentDark = P.orange700, accentSoft = P.peachSoft }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(priceRange);
  const [mounted, setMounted] = useState(false); // ← contrôle l'affichage
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true); // ← monter d'abord
      setRange(priceRange);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
    } else {
      // ← animer PUIS démonter
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null; // ← seulement quand animation terminée

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <TouchableOpacity
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        activeOpacity={1}
        onPress={onClose}
      />
      {/* Sheet */}
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
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function AllProductsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme: appTheme } = useAppTheme();
  const typeParam = route?.params?.type || 'all';
  const queryParam = route?.params?.q || '';
  const locationParam = route?.params?.location || '';
  const { isAuthenticated } = useAuth();

  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [sortBy,        setSortBy]        = useState('recent');
  const [priceRange,    setPriceRange]    = useState([0, 1000000]);
  const [showFilter,    setShowFilter]    = useState(false);
  const [favorites,     setFavorites]     = useState(new Set());
  const [filterActive,  setFilterActive]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState(String(queryParam || '').trim());
  const [alert,         setAlert]         = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Animations
  const scrollY     = useRef(new Animated.Value(0)).current;
  const heroFade    = useRef(new Animated.Value(0)).current;
  const headerFade  = useRef(new Animated.Value(0)).current;

  const normalizedType = String(typeParam || 'all').toLowerCase();
  const isServicePage = normalizedType === 'service';
  const isAllPage = normalizedType === 'all';
  const displayQuery = searchQuery.trim();
  const displayLocation = String(locationParam || '').trim();
  const theme = {
    accent: isServicePage ? '#2563EB' : P.terra,
    accentDark: isServicePage ? '#1D4ED8' : P.orange700,
    accentSoft: isServicePage ? P.blue100 : P.peachSoft,
    headerCountColor: isDark
      ? (isServicePage ? P.blue100 : P.amber)
      : (isServicePage ? P.blueDark : P.orange700),
    headerColors: appTheme.header,
    headerText: appTheme.text,
    headerSubText: appTheme.textMuted,
    headerActionText: appTheme.text,
    headerGlass: appTheme.glass,
    headerGlow: isServicePage ? ['#1E40AF', '#60A5FA', '#1E40AF'] : [P.charcoal, P.terra, P.charcoal],
    loadScreenColors: appTheme.shell,
    loadLogoColors: isServicePage ? ['#DBEAFE', '#2563EB'] : [P.gold, P.amber],
    loadBrandColor: appTheme.text,
    applyColors: isServicePage ? ['#2563EB', '#1D4ED8'] : [P.orange500, P.orange700],
  };

  const title = displayQuery || displayLocation
    ? 'Résultats'
    : isAllPage
      ? 'Toutes les annonces'
      : isServicePage
        ? 'Services'
        : 'Produits';
  const emoji = displayQuery || displayLocation ? '🔎' : isAllPage ? '🛍️' : isServicePage ? '🛠️' : '📦';
  const headerContext = [
    displayQuery ? `"${displayQuery}"` : null,
    displayLocation ? `📍 ${displayLocation}` : null,
  ].filter(Boolean).join(' • ');

  // Header qui se compresse
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
    outputRange: [26, 18],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    Animated.parallel([
      Animated.timing(heroFade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    setSearchQuery(String(queryParam || '').trim());
  }, [queryParam]);

  useEffect(() => {
    loadFavorites();
  }, [isAuthenticated]);

  // ── Favoris ────────────────────────────────────────────────────────────────
  const loadFavorites = async () => {
    try {
      if (!isAuthenticated) {
        setFavorites(new Set());
        return;
      }
      const ids = await getFavoriteIds();
      setFavorites(new Set((ids || []).map(String)));
    } catch (e) {
      console.error('Erreur favoris:', e);
    }
  };

  const toggleFav = async (item) => {
    const id = getProductId(item);
    if (!id) return;

    if (!isAuthenticated) {
      setAlert({
        visible: true,
        type: 'info',
        title: 'Connexion requise',
        message: 'Connectez-vous pour liker une annonce',
        buttons: [
          { text: 'Annuler', onPress: () => {} },
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ],
      });
      return;
    }

    const key = String(id);
    const wasFavorite = favorites.has(key);

    // Optimistic UI update
    setFavorites(prev => {
      const next = new Set(prev);
      wasFavorite ? next.delete(key) : next.add(key);
      return next;
    });

    try {
      await toggleFavorite(id, wasFavorite);
    } catch (e) {
      // Rollback on API error
      setFavorites(prev => {
        const next = new Set(prev);
        wasFavorite ? next.add(key) : next.delete(key);
        return next;
      });
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e.message || 'Impossible de mettre à jour le favori',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    }
  };

  // ── Données ────────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const params = {
        ...(isAllPage ? {} : { type: isServicePage ? 'service' : 'product' }),
        ...(searchQuery ? { search: searchQuery } : {}),
      };

      const res = await apiClient.get('/products', { params });
      const all = res.data.data || res.data;
      const normalizedLocation = String(locationParam || '').trim().toLowerCase();
      const filteredByLocation = normalizedLocation
        ? all.filter((item) => {
            const itemLocation = String(item?.location || '').toLowerCase();
            const sellerLocation = String(item?.seller?.location || '').toLowerCase();
            const cityLocation = itemLocation.split(',')[0].trim();
            const sellerCity = sellerLocation.split(',')[0].trim();

            return (
              itemLocation.includes(normalizedLocation) ||
              cityLocation.includes(normalizedLocation) ||
              sellerLocation.includes(normalizedLocation) ||
              sellerCity.includes(normalizedLocation)
            );
          })
        : all;

      setProducts(filteredByLocation);
      // Init range prix
      const prices = filteredByLocation.map(i => parseInt(i.price || 0));
      const maxP   = Math.max(...prices, 1000000);
      setPriceRange([0, maxP]);
    } catch (e) {
      console.error('Erreur chargement:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [normalizedType, isServicePage, isAllPage, searchQuery, locationParam]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchProducts(); }, [normalizedType, isServicePage, isAllPage, searchQuery, locationParam]);

  // ── Tri + filtre ───────────────────────────────────────────────────────────
  const maxPrice = Math.max(...products.map(i => parseInt(i.price || 0)), 1000000);

  const processed = [...products]
    .filter(i => {
      const p = parseInt(i.price || 0);
      return p >= priceRange[0] && p <= priceRange[1];
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc')  return parseInt(a.price || 0) - parseInt(b.price || 0);
      if (sortBy === 'price-desc') return parseInt(b.price || 0) - parseInt(a.price || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Séparer hero + reste
  const heroItem  = processed[0] || null;
  const gridItems = processed.slice(1);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadScreen}>
        <LinearGradient colors={theme.loadScreenColors} style={s.loadInner}>
          <LinearGradient colors={theme.loadLogoColors} style={s.loadLogoBox}>
            <Text style={[s.loadLogoTxt, { color: isServicePage ? P.white : P.brown }]}>M</Text>
          </LinearGradient>
          <Text style={[s.loadBrand, { color: theme.loadBrandColor }]}>MarketHub</Text>
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 24 }} />
        </LinearGradient>
      </View>
    );
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: appTheme.screen }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ══ HEADER SHRINKABLE ═══════════════════════════════════════════════ */}
      <Animated.View style={[s.header, { height: Animated.add(headerHeight, insets.top || 0) }]}>
        <LinearGradient colors={theme.headerColors} style={StyleSheet.absoluteFill} />
        <View style={[s.headerAccent, { backgroundColor: theme.accent }]} />

        <Animated.View style={[s.headerInner, { paddingTop: (insets.top || 0) + 6, opacity: headerFade }]}>
          {/* Ligne principale */}
          <View style={s.headerRow}>
            <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.headerGlass }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={[s.backBtnTxt, { color: theme.headerText }]}>←</Text>
            </TouchableOpacity>

            <Animated.View style={[s.headerCenter, { transform: [{ scale: heroScale }] }]}>
              <Animated.Text style={[s.headerTitle, { fontSize: titleSize, color: theme.headerText }]}> 
                {emoji} {title}
              </Animated.Text>
              {!!headerContext && (
                <Text style={[s.headerQuery, { color: theme.headerSubText }]} numberOfLines={1}>{headerContext}</Text>
              )}
              <Text style={[s.headerCount, { color: theme.headerCountColor }]}>{processed.length} annonce{processed.length > 1 ? 's' : ''}</Text>
            </Animated.View>

            <View style={s.headerActions}>
              {/* Tri rapide */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.headerGlass }]}
                activeOpacity={0.8}
                onPress={() => setSortBy(s => s === 'recent' ? 'price-asc' : s === 'price-asc' ? 'price-desc' : 'recent')}
              >
                <Text style={[s.actionBtnTxt, { color: theme.headerActionText }]}>
                  {sortBy === 'recent' ? '🕐' : sortBy === 'price-asc' ? '↑' : '↓'}
                </Text>
              </TouchableOpacity>
              {/* Filtre prix */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.headerGlass }, filterActive && [s.actionBtnActive, { backgroundColor: theme.accent }]]}
                activeOpacity={0.8}
                onPress={() => setShowFilter(true)}
              >
                <Text style={[s.actionBtnTxt, { color: theme.headerActionText }]}>⚖️</Text>
                {filterActive && <View style={[s.actionDot, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]} />}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Glow ligne */}
        <LinearGradient
          colors={theme.headerGlow}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </Animated.View>

      {/* ══ LISTE ════════════════════════════════════════════════════════════ */}
      <Animated.FlatList
        data={gridItems}
        keyExtractor={(item, i) => String(getProductId(item) || `g-${i}`)}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.accent]} tintColor={theme.accent} />
        }
        ListHeaderComponent={
          <>
            {/* Hero card */}
            {heroItem && (
              <HeroCard
                item={heroItem}
                onPress={() => navigation.navigate('ProductDetail', { productId: getProductId(heroItem) })}
                isFav={favorites.has(String(getProductId(heroItem)))}
                onFavToggle={() => toggleFav(heroItem)}
                fadeAnim={heroFade}
              />
            )}
            {/* Séparateur section grille */}
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
            onPress={() => navigation.navigate('ProductDetail', { productId: getProductId(item) })}
            isFav={favorites.has(String(getProductId(item)))}
            onFavToggle={() => toggleFav(item)}
          />
        )}
        ListEmptyComponent={
          !heroItem ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 64 }}>📭</Text>
              <Text style={s.emptyTitle}>Aucune annonce</Text>
              <Text style={s.emptySub}>
                {searchQuery
                  ? `Aucun resultat pour "${searchQuery}".`
                  : isAllPage
                    ? 'Aucune annonce pour le moment.'
                    : `Pas ${isServicePage ? 'de services' : 'de produits'} pour le moment.`}
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
       <PriceFilterSheet
      visible={showFilter}
      onClose={() => setShowFilter(false)}
      priceRange={priceRange}
      maxPrice={maxPrice}
      accent={theme.accent}
      accentDark={theme.accentDark}
      accentSoft={theme.accentSoft}
      onApply={(range) => {
        setPriceRange(range);
        setFilterActive(range[0] > 0 || range[1] < maxPrice);
      }}
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
  header:       { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra, zIndex: 1 },
  headerInner:  { flex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontWeight: '900', color: P.white, letterSpacing: -0.5 },
  headerQuery:  { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 1, maxWidth: '90%' },
  headerCount:  { fontSize: 11, color: P.amber, fontWeight: '600', marginTop: 2 },
  headerActions:{ flexDirection: 'row', gap: 8 },
  actionBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  actionBtnActive:{ backgroundColor: P.terra },
  actionBtnTxt: { fontSize: 16 },
  actionDot:    { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: P.amber, borderWidth: 1.5, borderColor: P.charcoal },
  headerGlow:   { height: 1.5, position: 'absolute', bottom: 0, left: 0, right: 0 },

  // Section header grille
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