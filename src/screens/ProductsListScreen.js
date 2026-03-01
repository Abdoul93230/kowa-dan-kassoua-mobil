// ─── ProductsListScreen v2 ─ MarketHub Niger ─────────────────────────────────
// Plateforme de mise en relation acheteurs / vendeurs
// Aucune gestion de livraison ni de paiement par la plateforme

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, TextInput, ScrollView,
  Dimensions, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, CATEGORIES } from '../utils/constants';
import { apiClient } from '../api/auth';

const { width } = Dimensions.get('window');

// Formater les nombres pour les stats (ex: 1234 => "1.2k+")
const formatStatNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num < 1000) return num.toString();
  if (num < 10000) return (Math.floor(num / 100) / 10).toFixed(1) + 'k+';
  return Math.floor(num / 1000) + 'k+';
};

// Extraire le nom de la ville depuis la localisation (ex: "Niamey, Niger" => "Niamey")
const getCityName = (location) => {
  if (!location) return '';
  return location.split(',')[0].trim();
};

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

// ─── DONNÉES ──────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: '01', icon: '📸', title: 'Publiez',   desc: 'Ajoutez vos photos et décrivez votre annonce' },
  { step: '02', icon: '💬', title: 'Discutez',  desc: 'Échangez directement par messagerie' },
  { step: '03', icon: '🤝', title: 'Rencontrez', desc: 'Convenez d\'un lieu et concluez entre vous' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-COMPOSANTS
// ─────────────────────────────────────────────────────────────────────────────

function PulseBadge({ text }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.pulseBadge, { transform: [{ scale: pulse }] }]}>
      <Text style={s.pulseBadgeTxt}>{text}</Text>
    </Animated.View>
  );
}

function StatsTicker({ stats }) {
  const tx   = useRef(new Animated.Value(width)).current;
  const [idx, setIdx] = useState(0);
  
  // Générer les messages dynamiques avec les vraies stats
  const tickerMsgs = [
    `🔥 ${formatStatNumber(stats.totalProducts)} annonces disponibles`,
    `👥 ${formatStatNumber(stats.totalUsers)} membres actifs au Niger`,
    `📍 Présent dans ${stats.totalCities}+ villes`,
    '🆓 Publication entièrement gratuite',
    '⚡ Mise en relation directe & rapide',
  ];
  
  useEffect(() => {
    const run = () => {
      tx.setValue(width);
      Animated.timing(tx, { toValue: -width * 1.3, duration: 7200, useNativeDriver: true })
        .start(() => { setIdx(p => (p + 1) % tickerMsgs.length); run(); });
    };
    run();
  }, [stats]);
  
  return (
    <View style={s.ticker}>
      <View style={s.tickerDot} />
      <View style={s.tickerTrack}>
        <Animated.Text style={[s.tickerTxt, { transform: [{ translateX: tx }] }]}>
          {tickerMsgs[idx]}
        </Animated.Text>
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle, onSeeAll }) {
  return (
    <View style={s.secHead}>
      <View style={{ flex: 1 }}>
        <View style={s.secTitleRow}>
          <View style={s.secAccent} />
          <Text style={s.secTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={s.secSub}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity style={s.seeAllBtn} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={s.seeAllTxt}>Tout voir →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CategoryChip({ category, onPress }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress}
      onPressIn={()  => Animated.spring(sc, { toValue: 0.90, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}>
      <Animated.View style={[s.chip, { transform: [{ scale: sc }] }]}>
        <View style={s.chipIconWrap}><Text style={s.chipEmoji}>{category.emoji}</Text></View>
        <Text style={s.chipLabel} numberOfLines={1}>{category.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function AnnounceCard({ item, onPress, hot }) {
  const sc = useRef(new Animated.Value(1)).current;
  const isService = item.type === 'service';
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress}
      onPressIn={()  => Animated.spring(sc, { toValue: 0.96, useNativeDriver: true, speed: 28 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 28 }).start()}>
      <Animated.View style={[s.card, { transform: [{ scale: sc }] }]}>

        {/* Image */}
        <View style={s.cardImgWrap}>
          <Image
            source={{ uri: item.images?.[0] || 'https://via.placeholder.com/200x145/F5E6C8/C1440E?text=MarketHub' }}
            style={s.cardImg}
            resizeMode="cover"
          />
          <LinearGradient colors={['transparent', 'rgba(26,18,16,0.58)']} style={StyleSheet.absoluteFill} />
          {hot && (
            <View style={s.hotBadge}><Text style={s.hotBadgeTxt}>🔥 Populaire</Text></View>
          )}
          <View style={[s.typeBadge, { backgroundColor: isService ? P.terra : P.amber }]}>
            <Text style={s.typeBadgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.cardLoc} numberOfLines={1}>
            📍 {getCityName(item.location) || 'Niger'}
          </Text>
          <View style={s.cardBottom}>
            <Text style={s.cardPrice}>
              {item.price ? `${parseInt(item.price).toLocaleString()} FCFA` : 'Prix à discuter'}
            </Text>
            <View style={s.contactBtn}><Text style={s.contactBtnTxt}>Contacter</Text></View>
          </View>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

function SellerCard({ seller }) {
  const sc = useRef(new Animated.Value(1)).current;
  // Extraire les initiales du nom
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <TouchableOpacity activeOpacity={1}
      onPressIn={()  => Animated.spring(sc, { toValue: 0.93, useNativeDriver: true, speed: 35 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1,    useNativeDriver: true, speed: 35 }).start()}>
      <Animated.View style={[s.sellerCard, { transform: [{ scale: sc }] }]}>
        {seller.avatar ? (
          <Image source={{ uri: seller.avatar }} style={s.sellerAvatar} />
        ) : (
          <View style={s.sellerAvatar}>
            <Text style={s.sellerInitials}>{getInitials(seller.name)}</Text>
          </View>
        )}
        <Text style={s.sellerName} numberOfLines={1}>{seller.businessName || seller.name}</Text>
        <Text style={s.sellerCount}>{seller.productCount} annonce{seller.productCount > 1 ? 's' : ''}</Text>
        <View style={[s.onlineDot, { backgroundColor: seller.isOnline ? '#22C55E' : P.muted }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function EmptyCard({ text }) {
  return (
    <View style={s.emptyCard}>
      <Text style={{ fontSize: 32 }}>🔍</Text>
      <Text style={s.emptyTxt}>{text}</Text>
      <Text style={s.emptySub}>Soyez le premier à publier !</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductsListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformStats, setPlatformStats] = useState({
    totalProducts: 0,
    totalUsers: 0,
    totalCities: 0
  });
  const [activeSellers, setActiveSellers] = useState([]);

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, tension: 68, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const products = allProducts.filter(i => i.type !== 'service');
  const services = allProducts.filter(i => i.type === 'service');

  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/products');
      setAllProducts(res.data.data || res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchPlatformStats = async () => {
    try {
      const res = await apiClient.get('/products/platform/stats');
      if (res.data.success) {
        setPlatformStats(res.data.data);
      }
    } catch (e) { console.error('Erreur stats:', e); }
  };

  const fetchActiveSellers = async () => {
    try {
      const res = await apiClient.get('/products/active-sellers?limit=10');
      if (res.data.success) {
        setActiveSellers(res.data.data);
      }
    } catch (e) { console.error('Erreur vendeurs:', e); }
  };

  useEffect(() => {
    fetchProducts();
    fetchPlatformStats();
    fetchActiveSellers();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
    fetchPlatformStats();
    fetchActiveSellers();
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[P.terra, P.amber]} style={s.loadScreen}>
          <View style={s.loadLogoBox}><Text style={s.loadLogoTxt}>M</Text></View>
          <Text style={s.loadBrand}>MarketHub</Text>
          <Text style={s.loadSlogan}>Kowa Dan Kassoua · Niger</Text>
          <ActivityIndicator size="large" color={P.cream} style={{ marginTop: 44 }} />
        </LinearGradient>
      </View>
    );
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={P.terra} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 + Math.max(insets.bottom, 8) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} />}
      >

        {/* ══════════════ HERO ══════════════════════════════════════════════ */}
        <LinearGradient
          colors={[P.terra, '#8A2400', P.charcoal]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: (insets.top || 0) + 14 }]}
        >
          <View style={s.deco1} /><View style={s.deco2} /><View style={s.deco3} />

          <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>

            {/* Marque */}
            <View style={s.brandBar}>
              <View style={s.logoBox}><Text style={s.logoTxt}>M</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.brandName}>MarketHub</Text>
                <Text style={s.brandSub}>Kowa Dan Kassoua · Niger</Text>
              </View>
              <TouchableOpacity style={s.notifBox} onPress={() => navigation.navigate('Notifications')}>
                <Text style={{ fontSize: 20 }}>🔔</Text>
                <PulseBadge text="2" />
              </TouchableOpacity>
            </View>

            {/* Accroche */}
            <Text style={s.heroH1}>Trouvez, contactez,{'\n'}concluez.</Text>
            <Text style={s.heroH2}>
              La place de marché du Niger — entre particuliers et professionnels.
            </Text>

            {/* Ticker live */}
            <StatsTicker stats={platformStats} />

            {/* Recherche */}
            <View style={s.searchBar}>
              <View style={s.searchLeft}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder="Rechercher une annonce..."
                  placeholderTextColor={P.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={() => navigation.navigate('Search', { query: searchQuery })}
                />
              </View>
              <TouchableOpacity
                style={s.searchCta}
                onPress={() => navigation.navigate('Search', { query: searchQuery })}
              >
                <Text style={s.searchCtaTxt}>OK</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </LinearGradient>

        {/* ══════════════ CHIFFRES CLÉS ══════════════════════════════════════ */}
        <View style={s.statsStrip}>
          {[
            { n: formatStatNumber(platformStats.totalProducts), lbl: 'Annonces',  icon: '📋' },
            { n: formatStatNumber(platformStats.totalUsers), lbl: 'Membres',   icon: '👥' },
            { n: platformStats.totalCities + '+', lbl: 'Villes',    icon: '📍' },
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
        </View>

        {/* ══════════════ CATÉGORIES ═════════════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Parcourir par catégorie"
            subtitle="Trouvez exactement ce que vous cherchez"
            onSeeAll={() => navigation.navigate('Categories')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipList}>
            {CATEGORIES.map(cat => (
              <CategoryChip
                key={cat.id}
                category={cat}
                onPress={() => navigation.navigate('CategoryProducts', { categorySlug: cat.slug, categoryName: cat.name })}
              />
            ))}
          </ScrollView>
        </View>

        {/* ══════════════ BANNIÈRE — PUBLIER ═════════════════════════════════ */}
        <View style={{ paddingHorizontal: 18, paddingVertical: 6 }}>
          <LinearGradient
            colors={[P.terra, P.amber]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.banner}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.bannerEye}>🚀 C'est gratuit</Text>
              <Text style={s.bannerTitle}>Publiez votre annonce{'\n'}en 2 minutes top chrono</Text>
              <TouchableOpacity style={s.bannerBtn} onPress={() => navigation.navigate('CreateProduct')}>
                <Text style={s.bannerBtnTxt}>Je publie maintenant →</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 68, marginLeft: 8 }}>📣</Text>
          </LinearGradient>
        </View>

        {/* ══════════════ ANNONCES DU MOMENT 🔥 ═════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Annonces du moment 🔥"
            subtitle="Les plus consultées aujourd'hui"
            onSeeAll={() => navigation.navigate('AllProducts', { type: 'product' })}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cardList}>
            {products.length === 0
              ? <EmptyCard text="Aucun produit pour l'instant" />
              : products.slice(0, 10).map((item, idx) => (
                  <AnnounceCard
                    key={item.id || idx}
                    item={item}
                    hot={idx < 2}
                    onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                  />
                ))
            }
          </ScrollView>
        </View>

        {/* ══════════════ COMMENT ÇA MARCHE ══════════════════════════════════ */}
        <View style={s.howSection}>
          <SectionHeader title="Comment ça marche ?" />
          <View style={s.howRow}>
            {HOW_IT_WORKS.map((h, i) => (
              <View key={i} style={s.howStep}>
                {/* Connecteur entre étapes */}
                {i < HOW_IT_WORKS.length - 1 && <View style={s.howLine} />}
                <View style={s.howIconWrap}>
                  <Text style={s.howIcon}>{h.icon}</Text>
                  <View style={s.howNum}><Text style={s.howNumTxt}>{h.step}</Text></View>
                </View>
                <Text style={s.howTitle}>{h.title}</Text>
                <Text style={s.howDesc}>{h.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══════════════ SERVICES À LA UNE ══════════════════════════════════ */}
        <View style={s.section}>
          <SectionHeader
            title="Services à la une"
            subtitle="Artisans, prestataires et experts près de vous"
            onSeeAll={() => navigation.navigate('AllProducts', { type: 'service' })}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cardList}>
            {services.length === 0
              ? <EmptyCard text="Aucun service pour l'instant" />
              : services.slice(0, 10).map((item, idx) => (
                  <AnnounceCard
                    key={item.id || idx}
                    item={item}
                    hot={false}
                    onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                  />
                ))
            }
          </ScrollView>
        </View>

        {/* ══════════════ VENDEURS ACTIFS ════════════════════════════════════ */}
        {activeSellers.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Vendeurs actifs"
              subtitle="Annonceurs disponibles en ce moment"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sellerList}>
              {activeSellers.map((sel, i) => <SellerCard key={sel._id || i} seller={sel} />)}
            </ScrollView>
          </View>
        )}

        {/* ══════════════ CONFIANCE ══════════════════════════════════════════ */}
        <View style={s.trustSection}>
          <Text style={s.trustTitle}>Pourquoi MarketHub ?</Text>
          <View style={s.trustGrid}>
            {[
              { icon: '🔒', title: 'Membres vérifiés',    desc: 'Chaque compte est contrôlé pour votre sérénité' },
              { icon: '💬', title: 'Messagerie intégrée', desc: 'Discutez directement avec n\'importe quel annonceur' },
              { icon: '🆓', title: '100 % Gratuit',       desc: 'Publiez autant d\'annonces que vous voulez, sans frais' },
              { icon: '📍', title: 'Très local',           desc: 'Des annonces dans votre ville, votre quartier' },
            ].map((t, i) => (
              <View key={i} style={s.trustCard}>
                <Text style={s.trustIcon}>{t.icon}</Text>
                <Text style={s.trustCardTitle}>{t.title}</Text>
                <Text style={s.trustCardDesc}>{t.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══════════════ FOOTER CTA ═════════════════════════════════════════ */}
        <LinearGradient colors={[P.charcoal, '#2A1206']} style={s.footerCta}>
          <View style={s.footerDeco1} /><View style={s.footerDeco2} />
          <Text style={s.footerTitle}>Vous avez quelque{'\n'}chose à proposer ?</Text>
          <Text style={s.footerSub}>
            Des milliers de personnes au Niger cherchent ce que vous avez.{'\n'}
            Publiez votre annonce — c'est gratuit et ça prend 2 minutes.
          </Text>
          <TouchableOpacity
            style={s.footerBtn}
            onPress={() => navigation.navigate('CreateProduct')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[P.terra, P.amber]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.footerBtnGrad}
            >
              <Text style={s.footerBtnTxt}>📣  Déposer une annonce gratuite</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.footerBadge}>✅ Sans commission · Sans frais cachés</Text>
        </LinearGradient>

      </ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.cream },

  // Loading
  loadScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadLogoBox:  { width: 74, height: 74, borderRadius: 22, backgroundColor: P.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: P.brown, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 10 },
  loadLogoTxt:  { fontSize: 40, fontWeight: '900', color: P.brown },
  loadBrand:    { fontSize: 32, fontWeight: '900', color: P.cream, letterSpacing: -1 },
  loadSlogan:   { fontSize: 13, color: 'rgba(253,246,236,0.65)', marginTop: 6 },

  // Hero
  hero:  { paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  deco1: { position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(240,165,0,0.10)' },
  deco2: { position: 'absolute', bottom: -40, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(193,68,14,0.16)' },
  deco3: { position: 'absolute', top: 70, right: 50, width: 55, height: 55, borderRadius: 28, backgroundColor: 'rgba(240,165,0,0.07)' },

  // Marque
  brandBar:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  logoBox:   { width: 44, height: 44, borderRadius: 13, backgroundColor: P.gold, justifyContent: 'center', alignItems: 'center' },
  logoTxt:   { fontSize: 24, fontWeight: '900', color: P.brown },
  brandName: { fontSize: 19, fontWeight: '800', color: P.cream, letterSpacing: -0.4 },
  brandSub:  { fontSize: 11, color: 'rgba(253,246,236,0.52)', marginTop: 1 },
  notifBox:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  pulseBadge: { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: P.gold, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: P.brown },
  pulseBadgeTxt: { fontSize: 8, fontWeight: '900', color: P.brown },

  // Titres hero
  heroH1: { fontSize: 30, fontWeight: '900', color: P.cream, letterSpacing: -0.8, lineHeight: 38, marginBottom: 8 },
  heroH2: { fontSize: 13, color: 'rgba(253,246,236,0.68)', lineHeight: 19, marginBottom: 18 },

  // Ticker
  ticker:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 18, overflow: 'hidden' },
  tickerDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: P.gold, marginRight: 10, flexShrink: 0 },
  tickerTrack:{ flex: 1, overflow: 'hidden' },
  tickerTxt:  { fontSize: 13, color: P.cream, fontWeight: '500' },

  // Recherche
  searchBar:  { flexDirection: 'row', gap: 8 },
  searchLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: P.cream, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  searchInput:{ flex: 1, fontSize: 14, color: P.charcoal },
  searchCta:  { backgroundColor: P.gold, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  searchCtaTxt:{ fontSize: 14, fontWeight: '800', color: P.brown },

  // Stats strip
  statsStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: P.surface, borderBottomWidth: 1, borderBottomColor: 'rgba(157,136,114,0.12)' },
  statsDiv:   { width: 1, height: 36, backgroundColor: 'rgba(157,136,114,0.2)' },
  statItem:   { alignItems: 'center', gap: 3 },
  statIcon:   { fontSize: 20 },
  statNum:    { fontSize: 21, fontWeight: '900', color: P.terra, letterSpacing: -0.5 },
  statLbl:    { fontSize: 11, color: P.muted, fontWeight: '600' },

  // Section générique
  section: { paddingVertical: 20, backgroundColor: P.surface, marginTop: 8, borderTopWidth: 1, borderTopColor: P.dim },

  // Section header
  secHead:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 16 },
  secTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  secAccent:  { width: 4, height: 24, borderRadius: 2, backgroundColor: P.terra },
  secTitle:   { fontSize: 18, fontWeight: '900', color: P.charcoal, letterSpacing: -0.4 },
  secSub:     { fontSize: 12, color: P.muted, marginTop: 4, marginLeft: 14 },
  seeAllBtn:  { backgroundColor: 'rgba(193,68,14,0.08)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, marginTop: 2 },
  seeAllTxt:  { fontSize: 12, fontWeight: '700', color: P.terra },

  // Chips catégorie
  chipList:   { paddingHorizontal: 18, gap: 10 },
  chip:       { alignItems: 'center', backgroundColor: P.cream, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minWidth: 82, borderWidth: 1.5, borderColor: 'rgba(193,68,14,0.13)', shadowColor: P.terra, shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },
  chipIconWrap:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(193,68,14,0.07)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  chipEmoji:  { fontSize: 25 },
  chipLabel:  { fontSize: 11, color: P.brown, fontWeight: '700', textAlign: 'center' },

  // Bannière
  banner:    { borderRadius: 22, padding: 22, flexDirection: 'row', alignItems: 'center', shadowColor: P.terra, shadowOpacity: 0.28, shadowOffset: { width: 0, height: 6 }, shadowRadius: 18, elevation: 8 },
  bannerEye: { fontSize: 12, color: 'rgba(61,28,2,0.6)', fontWeight: '700', marginBottom: 5 },
  bannerTitle:{ fontSize: 18, fontWeight: '900', color: P.brown, lineHeight: 25, marginBottom: 14 },
  bannerBtn: { backgroundColor: P.brown, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 16, alignSelf: 'flex-start' },
  bannerBtnTxt:{ fontSize: 13, fontWeight: '700', color: P.cream },

  // Cartes annonces
  cardList:   { paddingHorizontal: 18, gap: 14, paddingBottom: 4 },
  card:       { width: 190, backgroundColor: P.cream, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(157,136,114,0.18)', shadowColor: P.brown, shadowOpacity: 0.11, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5 },
  cardImgWrap:{ height: 145, backgroundColor: P.sand, position: 'relative' },
  cardImg:    { width: '100%', height: '100%' },
  hotBadge:   { position: 'absolute', top: 10, right: 10, backgroundColor: P.terra, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hotBadgeTxt:{ fontSize: 9, fontWeight: '800', color: P.white },
  typeBadge:  { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeTxt:{ fontSize: 9, fontWeight: '800', color: P.white },
  cardBody:   { padding: 13 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: P.charcoal, lineHeight: 20, marginBottom: 7, minHeight: 40 },
  cardLoc:    { fontSize: 11, color: P.muted, marginBottom: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: P.dim, paddingTop: 10 },
  cardPrice:  { fontSize: 14, fontWeight: '900', color: P.terra, flex: 1 },
  contactBtn: { backgroundColor: P.terra, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  contactBtnTxt:{ fontSize: 11, fontWeight: '800', color: P.white },

  // Comment ça marche
  howSection: { backgroundColor: P.sand, paddingVertical: 22, paddingHorizontal: 18, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(193,68,14,0.08)' },
  howRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  howStep:    { flex: 1, alignItems: 'center', paddingHorizontal: 4, position: 'relative' },
  howLine:    { position: 'absolute', top: 24, left: '55%', right: '-55%', height: 2, backgroundColor: 'rgba(193,68,14,0.18)', zIndex: 0 },
  howIconWrap:{ position: 'relative', marginBottom: 10, zIndex: 1 },
  howIcon:    { fontSize: 38 },
  howNum:     { position: 'absolute', top: -8, right: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: P.terra, justifyContent: 'center', alignItems: 'center' },
  howNumTxt:  { fontSize: 9, fontWeight: '900', color: P.white },
  howTitle:   { fontSize: 13, fontWeight: '800', color: P.brown, textAlign: 'center', marginBottom: 5 },
  howDesc:    { fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16 },

  // Vendeurs actifs
  sellerList:   { paddingHorizontal: 18, gap: 12, paddingBottom: 4 },
  sellerCard:   { alignItems: 'center', backgroundColor: P.cream, borderRadius: 18, padding: 16, width: 100, borderWidth: 1, borderColor: 'rgba(157,136,114,0.18)', shadowColor: P.brown, shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2, position: 'relative' },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: P.terra, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sellerInitials:{ fontSize: 18, fontWeight: '800', color: P.white },
  sellerName:   { fontSize: 12, fontWeight: '700', color: P.brown, textAlign: 'center', marginBottom: 3 },
  sellerCount:  { fontSize: 10, color: P.muted, fontWeight: '600', textAlign: 'center' },
  onlineDot:    { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: P.cream },

  // Trust
  trustSection: { padding: 18, backgroundColor: P.surface, marginTop: 8 },
  trustTitle:   { fontSize: 20, fontWeight: '900', color: P.charcoal, letterSpacing: -0.4, marginBottom: 16 },
  trustGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  trustCard:    { width: (width - 36 - 12) / 2, backgroundColor: P.cream, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(157,136,114,0.18)' },
  trustIcon:    { fontSize: 28, marginBottom: 8 },
  trustCardTitle:{ fontSize: 14, fontWeight: '800', color: P.brown, marginBottom: 4 },
  trustCardDesc: { fontSize: 12, color: P.muted, lineHeight: 17 },

  // Footer CTA
  footerCta:   { padding: 28, alignItems: 'center', marginTop: 8, overflow: 'hidden', position: 'relative' },
  footerDeco1: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(193,68,14,0.10)' },
  footerDeco2: { position: 'absolute', bottom: -40, left: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(240,165,0,0.07)' },
  footerTitle: { fontSize: 26, fontWeight: '900', color: P.cream, letterSpacing: -0.6, textAlign: 'center', lineHeight: 34, marginBottom: 12 },
  footerSub:   { fontSize: 13, color: 'rgba(253,246,236,0.58)', textAlign: 'center', lineHeight: 19, marginBottom: 26 },
  footerBtn:   { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.42, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, elevation: 10, marginBottom: 16 },
  footerBtnGrad:{ paddingVertical: 17, alignItems: 'center', borderRadius: 16 },
  footerBtnTxt:{ fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  footerBadge: { fontSize: 12, color: 'rgba(253,246,236,0.45)', fontWeight: '600' },

  // Empty
  emptyCard:  { width: 200, height: 190, borderRadius: 20, backgroundColor: P.cream, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: P.sand, borderStyle: 'dashed', gap: 6, paddingHorizontal: 16 },
  emptyTxt:   { fontSize: 13, color: P.muted, fontWeight: '700', textAlign: 'center' },
  emptySub:   { fontSize: 11, color: P.amber, fontWeight: '600', textAlign: 'center' },
});