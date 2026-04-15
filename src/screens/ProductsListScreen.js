// ─── ProductsListScreen v3 PREMIUM ─ MarketHub Niger ─────────────────────────
// Redesign bling-bling — moderne, engageant, irrésistible

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, TextInput, ScrollView,
  Dimensions, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CATEGORIES } from '../utils/constants';
import { apiClient } from '../api/auth';
import { getUnreadCount } from '../api/messaging';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const formatStatNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num < 1000) return num.toString();
  if (num < 10000) return (Math.floor(num / 100) / 10).toFixed(1) + 'k+';
  return Math.floor(num / 1000) + 'k+';
};

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

// ─── HOW IT WORKS DATA ────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: '01', icon: '📸', title: 'Publiez', desc: 'Ajoutez vos photos et décrivez votre annonce' },
  { step: '02', icon: '💬', title: 'Discutez', desc: 'Échangez directement par messagerie' },
  { step: '03', icon: '🤝', title: 'Rencontrez', desc: "Convenez d'un lieu et concluez entre vous" },
];

const POPULAR_SEARCHES = ['Telephones', 'Immobilier', 'Services', 'Vehicules'];

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-COMPOSANTS
// ─────────────────────────────────────────────────────────────────────────────

// Badge pulsant (notifications)
function PulseBadge({ text }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.pulseBadge, { transform: [{ scale: pulse }] }]}>
      <Text style={s.pulseBadgeTxt}>{text}</Text>
    </Animated.View>
  );
}

// Ticker animé horizontal
function StatsTicker({ stats, isDark, theme }) {
  const tx = useRef(new Animated.Value(width)).current;
  const [idx, setIdx] = useState(0);

  const msgs = [
    `🔥 ${formatStatNumber(stats.totalProducts)} annonces disponibles`,
    `👥 ${formatStatNumber(stats.totalUsers)} membres actifs au Niger`,
    `📍 Présent dans ${stats.totalCities || 0}+ villes`,
    '🆓 Publication entièrement gratuite',
    '⚡ Mise en relation directe & rapide',
  ];

  useEffect(() => {
    const run = () => {
      tx.setValue(width);
      Animated.timing(tx, { toValue: -width * 1.4, duration: 7500, useNativeDriver: true })
        .start(() => { setIdx(p => (p + 1) % msgs.length); run(); });
    };
    run();
  }, [stats]);

  return (
    <View style={[s.ticker, !isDark && { backgroundColor: theme.cardSoft, borderColor: theme.border }]}> 
      <View style={s.tickerPill} />
      <View style={s.tickerTrack}>
        <Animated.Text style={[s.tickerTxt, !isDark && { color: theme.textMuted }, { transform: [{ translateX: tx }] }]}>
          {msgs[idx]}
        </Animated.Text>
      </View>
    </View>
  );
}

// En-tête de section avec accent latéral
function SectionHeader({
  title,
  subtitle,
  onSeeAll,
  light,
  accent = P.orange500,
  accentSoft = P.orange300,
  titleColor = P.charcoal,
  subtitleColor = P.muted,
  buttonColor = P.terra,
}) {
  return (
    <View style={s.secHead}>
      <View style={{ flex: 1 }}>
        <View style={s.secTitleRow}>
          <LinearGradient
            colors={[accent, accentSoft]}
            style={s.secAccent}
          />
          <Text style={[s.secTitle, { color: light ? P.white : titleColor }]}>{title}</Text>
        </View>
        {subtitle ? (
          <Text style={[s.secSub, light && { color: 'rgba(255,255,255,0.55)' }, !light && { color: subtitleColor }]}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity style={[s.seeAllBtn, { backgroundColor: accentSoft }]} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={[s.seeAllTxt, { color: buttonColor }]}>Tout voir →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Chip catégorie
function CategoryChip({ category, onPress }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.88, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
    >
      <Animated.View style={[s.chip, { transform: [{ scale: sc }] }]}>
        <View style={s.chipIconWrap}>
          <Text style={s.chipEmoji}>{category.emoji}</Text>
        </View>
        <Text style={s.chipLabel} numberOfLines={1}>{category.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Carte annonce — redesignée
function AnnounceCard({ item, onPress, hot }) {
  const sc = useRef(new Animated.Value(1)).current;
  const isService = item.type === 'service';
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
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200x150/FFE9DE/EC5A13?text=MH' }}
            style={s.cardImg}
            resizeMode="cover"
          />

          <View style={s.cardTimeBadge}>
            <Feather name="clock" size={11} color={P.charcoal} />
            <Text style={s.cardTimeTxt}>Il y a {posted}</Text>
          </View>

          <View style={s.cardFavGhost}>
            <Feather name="heart" size={14} color={isService ? '#2563EB' : P.terra} />
          </View>
        </View>

        {/* Contenu */}
        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTypeGlyphWrap}>
              <Text style={s.cardTypeGlyph}>{isService ? '🛠️' : '📦'}</Text>
            </View>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>

          <View style={s.cardMetaRow}>
            <Feather name="map-pin" size={11} color={isService ? '#2563EB' : P.terra} />
            <Text style={s.cardLoc} numberOfLines={1}>{getCityName(item.location)}</Text>
            <Text style={s.cardMetaDot}>•</Text>
            <Text style={s.cardMetaTail}>{distance.toFixed(1)} km</Text>
          </View>

          <View style={s.cardPriceRow}>
            <View style={s.cardPriceSpacer} />
            <Text style={[s.cardPriceTxt, { color: isService ? '#2563EB' : P.terra }]}>
              {item.price ? `${parseInt(item.price).toLocaleString('fr-FR')} FCFA` : 'À discuter'}
            </Text>
          </View>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

// Carte vendeur actif
function SellerCard({ seller, onPress }) {
  const sc = useRef(new Animated.Value(1)).current;
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.93, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[s.sellerCard, { transform: [{ scale: sc }] }]}>
        {/* Indicateur online */}
        <View style={[s.onlineDot, { backgroundColor: seller.isOnline ? P.green : P.muted }]} />

        {seller.avatar ? (
          <Image source={{ uri: seller.avatar }} style={s.sellerAvatar} />
        ) : (
          <LinearGradient colors={[P.orange500, P.orange700]} style={s.sellerAvatar}>
            <Text style={s.sellerInitials}>{getInitials(seller.name)}</Text>
          </LinearGradient>
        )}
        <Text style={s.sellerName} numberOfLines={1}>{seller.businessName || seller.name}</Text>
        <Text style={s.sellerCount}>{seller.productCount} annonce{seller.productCount > 1 ? 's' : ''}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Carte vide
function EmptyCard({ text }) {
  return (
    <View style={s.emptyCard}>
      <Text style={{ fontSize: 30, marginBottom: 6 }}>🔍</Text>
      <Text style={s.emptyTxt}>{text}</Text>
      <Text style={s.emptySub}>Soyez le premier !</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductsListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, token } = useAuth();
  const { isDark, theme } = useAppTheme();
  const { isConnected, on, off } = useSocket({
    enabled: isAuthenticated,
    token,
  });

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [platformStats, setPlatformStats] = useState({ totalProducts: 0, totalUsers: 0, totalCities: 0 });
  const [activeSellers, setActiveSellers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const navigateToStackScreen = useCallback((screenName, params) => {
    const parentNav = navigation.getParent?.();
    if (parentNav?.navigate) {
      parentNav.navigate(screenName, params);
      return;
    }
    navigation.navigate(screenName, params);
  }, [navigation]);

  const handleHomeSearch = useCallback(() => {
    const q = (searchQuery || '').trim();
    const params = {
      type: 'all',
      q,
    };
    if (selectedLocation && selectedLocation !== 'all') {
      params.location = selectedLocation;
    }
    navigation.navigate('AllProducts', params);
  }, [navigation, searchQuery, selectedLocation]);

  const handlePopularSearch = useCallback((value) => {
    setSearchQuery(value);
    const params = {
      type: 'all',
      q: value,
    };
    if (selectedLocation && selectedLocation !== 'all') {
      params.location = selectedLocation;
    }
    navigation.navigate('AllProducts', params);
  }, [navigation, selectedLocation]);

  // Animations d'entrée
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const products = allProducts.filter(i => i.type !== 'service');
  const services = allProducts.filter(i => i.type === 'service');

  // ─── Fetch unread count ───────────────────────────────────────────────────
  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await getUnreadCount();
      setUnreadCount(Number(response?.data?.unreadCount || 0));
    } catch (error) {
      console.error('Erreur chargement compteur non lus:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Socket listeners pour mises à jour temps réel
  useEffect(() => {
    if (!isConnected) return;
    on('unreadCount:changed', loadUnreadCount);
    on('message:new', loadUnreadCount);
    on('message:read', loadUnreadCount);
    return () => {
      off('unreadCount:changed', loadUnreadCount);
      off('message:new', loadUnreadCount);
      off('message:read', loadUnreadCount);
    };
  }, [isConnected, loadUnreadCount, on, off]);

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/products');
      setAllProducts(res.data.data || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/products/platform/stats');
      if (res.data.success) setPlatformStats(res.data.data);
    } catch (e) { console.error(e); }
  };

  const fetchSellers = async () => {
    try {
      const res = await apiClient.get('/products/active-sellers?limit=10');
      if (res.data.success) setActiveSellers(res.data.data);
    } catch (e) { console.error(e); }
  };

  const fetchLocations = async () => {
    try {
      setLocationsLoading(true);
      const res = await apiClient.get('/products/locations');
      const raw = res?.data?.data || [];
      const cities = [...new Set(raw
        .map((loc) => (loc ? String(loc).split(',')[0].trim() : ''))
        .filter(Boolean))
      ];
      setLocations(cities.slice(0, 12));
    } catch (e) {
      console.error('Erreur chargement villes:', e);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchStats();
    fetchSellers();
    fetchLocations();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
    fetchStats();
    fetchSellers();
    fetchLocations();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      fetchProducts();
      fetchStats();
      fetchSellers();
      fetchLocations();
      loadUnreadCount();
    }, [loadUnreadCount])
  );

  // ─── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient colors={theme.shell} style={s.loadScreen}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={s.loadLogoWrap}>
          <LinearGradient colors={[P.orange500, P.orange700]} style={s.loadLogoBox}>
            <Text style={s.loadLogoTxt}>M</Text>
          </LinearGradient>
          {/* Anneau décoratif */}
          <View style={s.loadRing} />
        </View>
        <Text style={[s.loadBrand, { color: theme.text }]}>MarketHub</Text>
        <Text style={[s.loadSlogan, { color: theme.textMuted }]}>Kowa Dan Kassoua · Niger</Text>
        <ActivityIndicator size="large" color={P.amber} style={{ marginTop: 40 }} />
      </LinearGradient>
    );
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 + Math.max(insets.bottom, 8) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} />
        }
      >

        {/* ══════════════════════════════════════════════════════════════════
            HERO — fond sombre premium
        ═══════════════════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={theme.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: (insets.top || 0) + 8 }]}
        >
          {/* Décos cercles ambiance */}
          <View style={s.deco1} />
          <View style={s.deco2} />
          <View style={s.deco3} />
          {/* Ligne accent top */}
          <View style={s.heroTopLine} />

          <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>

            {/* ── Barre marque ── */}
            <View style={s.brandBar}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoBox}>
                <Text style={s.logoTxt}>M</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.brandName, { color: theme.text }]}>MarketHub</Text>
                <Text style={[s.brandSub, { color: theme.textMuted }]}>Kowa Dan Kassoua · Niger</Text>
              </View>
              <TouchableOpacity
                style={[s.notifBox, { backgroundColor: theme.cardSoft, borderColor: theme.border }]}
                onPress={() => {
                  if (!isAuthenticated) {
                    navigation.navigate('QuickAuth', {
                      pendingAction: { type: 'messages_list' },
                      returnScreen: 'Messages',
                    });
                  } else {
                    navigation.navigate('Messages')
                  }
                }}
              >













                <Text style={{ fontSize: 20 }}>🔔</Text>
                {unreadCount > 0 && <PulseBadge text={String(unreadCount)} />}
              </TouchableOpacity>
            </View>

            {/* ── Accroche ── */}
            <View style={s.heroTextWrap}>
                  <Text style={[s.heroH1, { color: theme.text }]}>
                Trouvez, contactez,{'\n'}
                <Text style={s.heroH1Accent}>concluez.</Text>
              </Text>
              {/* <Text style={s.heroH2}>
                La place de marché du Niger — entre particuliers et professionnels.
              </Text> */}
            </View>

            {/* ── Ticker live ── */}
            <StatsTicker stats={platformStats} isDark={isDark} theme={theme} />

            {/* ── Barre de recherche ── */}
            <View style={s.searchBar}>
                  <View style={[s.searchInner, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                      style={[s.searchInput, { color: theme.text }]}
                  placeholder="Rechercher une annonce…"
                      placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={handleHomeSearch}
                />
              </View>
              <TouchableOpacity
                style={s.searchCta}
                onPress={handleHomeSearch}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[P.orange500, P.orange700]} style={s.searchCtaGrad}>
                  <Text style={s.searchCtaTxt}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowQuickSearch((value) => !value)}
              style={[s.searchToggle, { backgroundColor: theme.cardSoft, borderColor: theme.border }]}
            >
              <Feather name={showQuickSearch ? 'chevron-up' : 'chevron-down'} size={12} color={theme.textMuted} />
              <Text style={[s.searchToggleTxt, { color: theme.textMuted }]}>
                {showQuickSearch ? 'Masquer les options' : 'Plus d’options'}
              </Text>
            </TouchableOpacity>

            {showQuickSearch && (
              <View style={[s.quickSearchCard, { backgroundColor: theme.cardSoft, borderColor: theme.border }]}> 
                <View style={s.quickSearchHead}>
                  <View style={s.quickSearchHeadLeft}>
                    <Feather name="sliders" size={11} color={theme.textMuted} />
                    <Text style={[s.quickSearchTitle, { color: theme.text }]}>Filtres rapides</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedLocation('all');
                      setSearchQuery('');
                    }}
                    style={[s.quickResetBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  >
                    <Text style={[s.quickResetTxt, { color: theme.textMuted }]}>Effacer</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.quickRail}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedLocation('all')}
                    style={[
                      s.quickChip,
                      { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                      selectedLocation === 'all' && s.quickChipActive,
                    ]}
                  >
                    <Feather name="map-pin" size={10} color={selectedLocation === 'all' ? P.amber : theme.textMuted} />
                    <Text style={[
                      s.quickChipTxt,
                      { color: theme.textMuted },
                      selectedLocation === 'all' && s.quickChipTxtActive,
                    ]}>Toutes</Text>
                  </TouchableOpacity>

                  {(locations.slice(0, 3)).map((city) => (
                    <TouchableOpacity
                      key={city}
                      activeOpacity={0.85}
                      onPress={() => setSelectedLocation(city)}
                      style={[
                        s.quickChip,
                        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                        selectedLocation === city && s.quickChipActive,
                      ]}
                    >
                      <Text style={[
                        s.quickChipTxt,
                        { color: theme.textMuted },
                        selectedLocation === city && s.quickChipTxtActive,
                      ]}>{city}</Text>
                    </TouchableOpacity>
                  ))}

                  {locationsLoading && (
                    <View style={s.quickChipLoader}>
                      <ActivityIndicator size="small" color={P.amber} />
                    </View>
                  )}

                  {POPULAR_SEARCHES.slice(0, 3).map((term) => (
                    <TouchableOpacity
                      key={term}
                      activeOpacity={0.85}
                      style={[s.quickChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      onPress={() => handlePopularSearch(term)}
                    >
                      <Feather name="trending-up" size={10} color={theme.textMuted} />
                      <Text style={[s.quickChipTxt, { color: theme.textMuted }]}>{term}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

          </Animated.View>
        </LinearGradient>

        {/* ══════════════════════════════════════════════════════════════════
            STATS STRIP — 3 chiffres clés
        ═══════════════════════════════════════════════════════════════════ */}
        {/* <View style={s.statsStrip}>
          {[
            { n: formatStatNumber(platformStats.totalProducts), lbl: 'Annonces',  icon: '📋' },
            { n: formatStatNumber(platformStats.totalUsers),    lbl: 'Membres',   icon: '👥' },
            { n: (platformStats.totalCities || 0) + '+',        lbl: 'Villes',    icon: '📍' },
          ].map((st, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.statsDiv} />}
              <View style={s.statItem}>
                <Text style={s.statIcon}>{st.icon}</Text>
                <Text style={s.statNum}>{st.n}</Text>
                <Text style={s.statLbl}>{st.lbl}</Text>
              </View>
            </React.Fragment>
          ))}
        </View> */}



        {/* ══════════════════════════════════════════════════════════════════
            ANNONCES DU MOMENT 🔥
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Annonces du moment 🔥"
            subtitle="Les plus consultées aujourd'hui"
            onSeeAll={() => navigation.navigate('AllProducts', { type: 'product' })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.cardList}
          >
            {products.length === 0
              ? <EmptyCard text="Aucun produit pour l'instant" />
              : products.slice(0, 10).map((item, idx) => (
                <AnnounceCard
                  key={item._id || item.id || idx}
                  item={item}
                  hot={idx < 2}
                  onPress={() => navigation.navigate('ProductDetail', { productId: item._id || item.id })}
                />
              ))
            }
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            COMMENT ÇA MARCHE
        ═══════════════════════════════════════════════════════════════════ */}
        {/* <LinearGradient
          colors={['#2d3748', '#374151']}
          style={s.howSection}
        >
          <SectionHeader title="Comment ça marche ?" light />
          <View style={s.howRow}>
            {HOW_IT_WORKS.map((h, i) => (
              <View key={i} style={s.howStep}>
                {i < HOW_IT_WORKS.length - 1 && <View style={s.howLine} />}
                <View style={s.howIconWrap}>
                  <LinearGradient colors={['rgba(236,90,19,0.18)', 'rgba(236,90,19,0.06)']} style={s.howIconBg}>
                    <Text style={s.howIcon}>{h.icon}</Text>
                  </LinearGradient>
                  <LinearGradient colors={[P.orange500, P.orange700]} style={s.howNum}>
                    <Text style={s.howNumTxt}>{h.step}</Text>
                  </LinearGradient>
                </View>
                <Text style={s.howTitle}>{h.title}</Text>
                <Text style={s.howDesc}>{h.desc}</Text>
              </View>
            ))}
          </View>
        </LinearGradient> */}

        {/* ══════════════════════════════════════════════════════════════════
            SERVICES À LA UNE
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Services à la une"
            subtitle="Artisans, prestataires et experts près de vous"
            accent="#2563EB"
            accentSoft={P.blue100}
            titleColor="#1D4ED8"
            subtitleColor={P.blue200}
            buttonColor="#2563EB"
            onSeeAll={() => navigation.navigate('AllProducts', { type: 'service' })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.cardList}
          >
            {services.length === 0
              ? <EmptyCard text="Aucun service pour l'instant" />
              : services.slice(0, 10).map((item, idx) => (
                <AnnounceCard
                  key={item._id || item.id || idx}
                  item={item}
                  hot={false}
                  onPress={() => navigation.navigate('ProductDetail', { productId: item._id || item.id })}
                />
              ))
            }
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            CATÉGORIES
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Parcourir par catégorie"
            subtitle="Trouvez exactement ce que vous cherchez"
            onSeeAll={() => navigateToStackScreen('Categories')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipList}
          >
            {CATEGORIES.map(cat => (
              <CategoryChip
                key={cat.id}
                category={cat}
                onPress={() => navigation.navigate('CategoryProducts', {
                  categorySlug: cat.slug,
                  categoryName: cat.name,
                })}
              />
            ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            BANNIÈRE — PUBLIER GRATUITEMENT
        ═══════════════════════════════════════════════════════════════════ */}
        {/* <View style={s.bannerWrap}>
          <LinearGradient
            colors={['#374151', '#3d4a5c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.banner}
          >
            
            <View style={s.bannerAccentBar} />
            <View style={{ flex: 1 }}>
              <View style={s.bannerEyeWrap}>
                <Text style={s.bannerEyeTxt}>🚀 C'est 100% gratuit</Text>
              </View>
              <Text style={s.bannerTitle}>
                Publiez votre annonce{'\n'}en 2 minutes
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CreateProduct')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[P.orange500, P.orange700]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.bannerBtn}
                >
                  <Text style={s.bannerBtnTxt}>Je publie maintenant →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={s.bannerEmoji}>📣</Text>
          </LinearGradient>
        </View> */}

        {/* ══════════════════════════════════════════════════════════════════
            VENDEURS ACTIFS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSellers.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Vendeurs actifs"
              subtitle="Annonceurs disponibles en ce moment"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.sellerList}
            >
              {activeSellers.map((sel, i) => (
                <SellerCard
                  key={sel._id || i}
                  seller={sel}
                  onPress={() => navigation.navigate('SellerProfile', { sellerId: sel.id || sel._id })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CONFIANCE
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={[s.trustSection, { backgroundColor: isDark ? '#374151' : theme.surfaceAlt }]}> 
          <SectionHeader title="Pourquoi MarketHub ?" light={isDark} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.trustList}
          >
            {[
              { icon: '🔒', title: 'Membres vérifiés', color: P.peachSoft, border: 'rgba(236,90,19,0.18)' },
              { icon: '💬', title: 'Messagerie directe', color: '#e8f4fd', border: 'rgba(59,130,246,0.18)' },
              { icon: '🆓', title: '100 % Gratuit', color: '#e8faf0', border: 'rgba(34,197,94,0.18)' },
              { icon: '📍', title: 'Très local', color: P.amberSoft, border: 'rgba(245,158,11,0.18)' },
            ].map((t, i) => (
              <View key={i} style={[s.trustPill, { backgroundColor: t.color, borderColor: t.border }]}>
                <Text style={s.trustPillIcon}>{t.icon}</Text>
                <Text style={s.trustPillTitle}>{t.title}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER CTA
        ═══════════════════════════════════════════════════════════════════ */}
        {/* <View style={s.footerCta}>
          
          <LinearGradient
            colors={['transparent', P.terra, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.footerAccentLine}
          />

          
          <View style={s.footerIconWrap}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.footerIconGrad}>
              <Text style={{ fontSize: 26 }}>📣</Text>
            </LinearGradient>
          </View>

          <Text style={s.footerTitle}>Quelque chose à vendre ?</Text>
          <Text style={s.footerSub}>
            Publiez gratuitement en 2 minutes.
          </Text>

          <TouchableOpacity
            style={s.footerBtn}
            onPress={() => navigation.navigate('CreateProduct')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[P.orange500, P.orange700]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.footerBtnGrad}
            >
              <Text style={s.footerBtnTxt}>Déposer une annonce gratuite</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.footerBadge}>✅ Sans commission · Sans frais cachés</Text>
        </View> */}

      </ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: P.surface },

  // ─── Loading ────────────────────────────────────────────────────────────────
  loadScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadLogoWrap: { position: 'relative', marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  loadLogoBox: {
    width: 76, height: 76, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: P.terra, shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 12,
  },
  loadRing: {
    position: 'absolute', width: 100, height: 100,
    borderRadius: 50, borderWidth: 1.5,
    borderColor: 'rgba(236,90,19,0.3)',
  },
  loadLogoTxt: { fontSize: 42, fontWeight: '900', color: P.white },
  loadBrand: { fontSize: 32, fontWeight: '900', color: P.white, letterSpacing: -1 },
  loadSlogan: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 },

  // ─── Hero ───────────────────────────────────────────────────────────────────
  hero: { paddingHorizontal: 18, paddingBottom: 20, overflow: 'hidden', position: 'relative' },
  heroTopLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra,
  },
  deco1: { position: 'absolute', top: -100, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(236,90,19,0.09)' },
  deco2: { position: 'absolute', bottom: -50, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(245,158,11,0.07)' },
  deco3: { position: 'absolute', top: 80, right: 60, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(236,90,19,0.08)' },

  // Brand bar
  brandBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logoBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: P.terra, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 8 },
  logoTxt: { fontSize: 23, fontWeight: '900', color: P.white },
  brandName: { fontSize: 17, fontWeight: '800', color: P.white, letterSpacing: -0.4 },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  notifBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pulseBadge: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: P.terra, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: P.charcoal },
  pulseBadgeTxt: { fontSize: 8, fontWeight: '900', color: P.white },

  // Accroche
  heroTextWrap: { marginBottom: 9 },
  heroH1: { fontSize: 24, fontWeight: '900', color: P.white, letterSpacing: -0.8, lineHeight: 29 },
  heroH1Accent: { color: P.amber },
  heroH2: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18, marginTop: 6 },

  // Ticker
  ticker: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  tickerPill: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.terra, marginRight: 10, flexShrink: 0 },
  tickerTrack: { flex: 1, overflow: 'hidden' },
  tickerTxt: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Recherche
  searchBar: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  searchInner: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, gap: 6 },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 11.5, color: P.charcoal, paddingVertical: 0 },
  searchCta: { width: 32, height: 32, borderRadius: 9, overflow: 'hidden' },
  searchCtaGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchCtaTxt: { fontSize: 15, fontWeight: '900', color: P.white, marginTop: -1 },
  searchToggle: { marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchToggleTxt: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.72)' },
  quickSearchCard: {
    marginTop: 7,
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.085)',
  },
  quickSearchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    gap: 5,
  },
  quickSearchHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  quickSearchTitle: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.55 },
  quickSearchSub: { fontSize: 9, color: 'rgba(255,255,255,0.52)', fontWeight: '600', maxWidth: 120 },
  quickResetBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  quickResetTxt: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.82)' },
  quickRail: { gap: 6, paddingRight: 4 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  quickChipActive: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.50)',
  },
  quickChipTxt: { fontSize: 9, color: 'rgba(255,255,255,0.84)', fontWeight: '700' },
  quickChipTxtActive: { color: P.amber },
  quickChipLoader: {
    width: 30,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // ─── Stats strip ────────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 18, paddingHorizontal: 16,
    backgroundColor: P.white,
    borderBottomWidth: 1, borderBottomColor: P.dim,
    shadowColor: P.charcoal, shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  statsDiv: { width: 1, height: 36, backgroundColor: P.dim },
  statItem: { alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statNum: { fontSize: 22, fontWeight: '900', color: P.terra, letterSpacing: -0.5 },
  statLbl: { fontSize: 11, color: P.muted, fontWeight: '600' },

  // ─── Section générique ──────────────────────────────────────────────────────
  section: {
    paddingVertical: 22,
    backgroundColor: P.white,
    marginTop: 0,
  },

  // Section header
  secHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 16 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secAccent: { width: 4, height: 26, borderRadius: 2 },
  secTitle: { fontSize: 18, fontWeight: '900', color: P.charcoal, letterSpacing: -0.4 },
  secSub: { fontSize: 12, color: P.muted, marginTop: 4, marginLeft: 14 },
  seeAllBtn: { backgroundColor: P.peachSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  seeAllTxt: { fontSize: 12, fontWeight: '700', color: P.terra },

  // ─── Chips catégorie ────────────────────────────────────────────────────────
  chipList: { paddingHorizontal: 18, gap: 10 },
  chip: {
    alignItems: 'center', backgroundColor: P.white, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14, minWidth: 80,
    borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.15)',
    shadowColor: P.terra, shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2,
  },
  chipIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: P.peachSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  chipEmoji: { fontSize: 24 },
  chipLabel: { fontSize: 11, color: P.charcoal, fontWeight: '700', textAlign: 'center' },

  // ─── Bannière publier ───────────────────────────────────────────────────────
  bannerWrap: { paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  banner: {
    borderRadius: 22, padding: 22,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', position: 'relative',
    shadowColor: P.charcoal, shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10,
  },
  bannerAccentBar: { position: 'absolute', left: 0, top: 20, bottom: 20, width: 4, backgroundColor: P.terra, borderRadius: 2 },
  bannerEyeWrap: { backgroundColor: 'rgba(236,90,19,0.18)', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  bannerEyeTxt: { fontSize: 11, fontWeight: '700', color: P.amber },
  bannerTitle: { fontSize: 18, fontWeight: '900', color: P.white, lineHeight: 25, marginBottom: 14 },
  bannerBtn: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 11, alignSelf: 'flex-start', shadowColor: P.terra, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  bannerBtnTxt: { fontSize: 13, fontWeight: '800', color: P.white },
  bannerEmoji: { fontSize: 60, marginLeft: 10 },

  // ─── Cartes annonces ────────────────────────────────────────────────────────
  cardList: { paddingHorizontal: 18, gap: 14, paddingBottom: 4 },
  card: {
    width: 192, backgroundColor: P.white, borderRadius: 20, overflow: 'hidden',
    shadowColor: P.charcoal, shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 5 }, shadowRadius: 14, elevation: 5,
    borderWidth: 1,
    borderColor: P.dim,
  },
  cardImgWrap: { height: 148, backgroundColor: P.sand, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardHotBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 6,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardHotTxt: { fontSize: 9, fontWeight: '800', color: P.white, letterSpacing: 0.3 },
  cardTimeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardTimeTxt: { fontSize: 10, fontWeight: '700', color: P.charcoal },
  cardFavGhost: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(236,90,19,0.2)',
  },
  cardBody: { paddingHorizontal: 10, paddingVertical: 9, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTypeGlyphWrap: { width: 18, minWidth: 18, alignItems: 'center', justifyContent: 'center' },
  cardTypeGlyph: { fontSize: 14 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: P.charcoal },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLoc: { flexShrink: 1, fontSize: 11, color: P.muted, maxWidth: 74 },
  cardMetaDot: { fontSize: 12, color: P.muted },
  cardMetaTail: { fontSize: 10, color: P.muted, fontWeight: '600' },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  cardPriceSpacer: { flex: 1 },
  cardPriceTxt: { fontSize: 12, fontWeight: '800', color: P.terra },

  // ─── Comment ça marche ──────────────────────────────────────────────────────
  howSection: { paddingVertical: 26, paddingHorizontal: 18, marginTop: 8 },
  howRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  howStep: { flex: 1, alignItems: 'center', paddingHorizontal: 4, position: 'relative' },
  howLine: { position: 'absolute', top: 30, left: '55%', right: '-55%', height: 1.5, backgroundColor: 'rgba(236,90,19,0.2)', zIndex: 0 },
  howIconWrap: { position: 'relative', marginBottom: 12, zIndex: 1 },
  howIconBg: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(236,90,19,0.2)' },
  howIcon: { fontSize: 30 },
  howNum: { position: 'absolute', top: -6, right: -8, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  howNumTxt: { fontSize: 9, fontWeight: '900', color: P.white },
  howTitle: { fontSize: 13, fontWeight: '800', color: P.white, textAlign: 'center', marginBottom: 5 },
  howDesc: { fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 16 },

  // ─── Vendeurs actifs ────────────────────────────────────────────────────────
  sellerList: { paddingHorizontal: 18, gap: 12, paddingBottom: 4 },
  sellerCard: {
    alignItems: 'center', backgroundColor: P.white, borderRadius: 18,
    padding: 16, width: 102,
    borderWidth: 1, borderColor: P.dim,
    shadowColor: P.charcoal, shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2,
    position: 'relative',
  },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sellerInitials: { fontSize: 18, fontWeight: '800', color: P.white },
  sellerName: { fontSize: 12, fontWeight: '700', color: P.charcoal, textAlign: 'center', marginBottom: 3 },
  sellerCount: { fontSize: 10, color: P.muted, fontWeight: '600', textAlign: 'center' },
  onlineDot: { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: P.white },

  // ─── Confiance ──────────────────────────────────────────────────────────────
  trustSection: { paddingTop: 20, paddingBottom: 22, backgroundColor: '#374151', marginTop: 8, marginBottom: -28 },
  trustList: { paddingHorizontal: 18, gap: 10, paddingBottom: 4 },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 50, borderWidth: 1.5,
  },
  trustPillIcon: { fontSize: 20 },
  trustPillTitle: { fontSize: 13, fontWeight: '700', color: P.charcoal },

  // ─── Footer CTA ─────────────────────────────────────────────────────────────
  footerCta: {
    padding: 24, alignItems: 'center', marginTop: 8,
    backgroundColor: '#374151',
  },
  footerAccentLine: { height: 2, width: '40%', marginBottom: 20, borderRadius: 1 },
  footerIconWrap: { marginBottom: 16 },
  footerIconGrad: {
    width: 60, height: 60, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: P.terra, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  footerTitle: { fontSize: 20, fontWeight: '900', color: P.white, letterSpacing: -0.4, textAlign: 'center', marginBottom: 6 },
  footerSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 20 },
  footerBtn: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
    shadowColor: P.terra, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 }, shadowRadius: 14, elevation: 7,
    marginBottom: 14,
  },
  footerBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  footerBtnTxt: { fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.1 },
  footerBadge: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  // ─── Empty card ─────────────────────────────────────────────────────────────
  emptyCard: { width: 200, height: 190, borderRadius: 20, backgroundColor: P.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: P.dim, borderStyle: 'dashed', gap: 4, paddingHorizontal: 16 },
  emptyTxt: { fontSize: 13, color: P.muted, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 11, color: P.amber, fontWeight: '600' },
});