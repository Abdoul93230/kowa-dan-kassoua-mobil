// ─── ProductDetailScreen v3 PREMIUM ─ MarketHub Niger ────────────────────────
// Design irrésistible — sombre, impactant, cohérent avec l'app

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, Share, Linking, ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { apiClient } from '../api/auth';
import { checkFavorite, toggleFavorite } from '../api/favorites';
import { createReview, getProductReviews, markReviewHelpful } from '../api/reviews';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width, height } = Dimensions.get('window');
const HERO_H = height * 0.52;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getCityName = (loc) => loc ? loc.split(',')[0].trim() : 'Niger';
const getInitials = (name) => {
  if (!name) return '??';
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
};

const formatRelativeDate = (dateString) => {
  if (!dateString) return 'Récemment';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString('fr-FR');
};



// Theme Config dynamique — bleu service identique au web (blue-600 = #2563EB)
const getThemeConfig = (isService) => ({
  typeBadge: { backgroundColor: 'rgba(37,99,235,0.9)' },
  secBar: ['#2563EB', '#60A5FA'],
  sellerAvatarGrad: ['#2563EB', '#1E40AF'],
  sellerArrow: { backgroundColor: '#DBEAFE', borderColor: 'rgba(37,99,235,0.2)' },
  sellerArrowTxt: { color: '#2563EB' },
  meetupInner: { backgroundColor: '#DBEAFE', borderColor: 'rgba(37,99,235,0.18)' },
  meetupAccent: { backgroundColor: '#2563EB' },
  cBtnGrad: ['#2563EB', '#1E40AF'],
  cBtnMain: { shadowColor: '#2563EB', shadowOpacity: 0.42, elevation: 10 },
  priceAccentColors: ['transparent', '#2563EB', 'transparent'],
  heroLocRow: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: 'rgba(37,99,235,0.14)' },
  heroLocRowProduct: { backgroundColor: 'rgba(236,90,19,0.08)', borderWidth: 1, borderColor: 'rgba(236,90,19,0.14)' },
  heroLocDot: { color: '#2563EB' },
  heroLocDotProduct: { color: P.terra },
  heroLocTxt: { color: '#1E40AF' },
  heroLocTxtProduct: { color: P.terra },
  priceAmount: { color: '#2563EB' },
  loadLogoBox: { shadowColor: '#2563EB' },
  loadRing: { borderColor: 'rgba(37,99,235,0.28)' },
  notFoundBtn: { shadowColor: '#2563EB' },
  headerBg: { borderBottomColor: 'rgba(37,99,235,0.2)' },
});

// ─── SPRING PRESS HOOK ────────────────────────────────────────────────────────
function useSpringPress() {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn:  () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start(),
    onPressOut: () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL IMAGES — immersif plein écran
// ─────────────────────────────────────────────────────────────────────────────
function ImageCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => setIdx(Math.round(value / width)));
    return () => scrollX.removeListener(id);
  }, []);

  return (
    <View style={s.hero}>
      <Animated.ScrollView
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {images.map((img, i) => (
          <View key={i} style={{ width, height: HERO_H }}>
            <Image
              source={{ uri: img || 'https://via.placeholder.com/400x500/1f2937/ec5a13?text=MH' }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Gradient bas — fondu vers fond sombre */}
      <LinearGradient
        colors={['transparent', 'rgba(17,24,39,0.5)', '#111827']}
        style={s.heroGrad}
      />

      {/* Compteur images — top right */}
      <View style={s.imgCounter}>
        <Text style={s.imgCounterTxt}>{idx + 1}/{images.length}</Text>
      </View>

      {/* Dots indicateurs */}
      {images.length > 1 && (
        <View style={s.dotsRow}>
          {images.map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [5, 20, 5],
              extrapolate: 'clamp',
            });
            const op = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[s.dot, { width: w, opacity: op }]} />;
          })}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION avec accent orange latéral
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, children, isService, appTheme }) {
  const d = getThemeConfig(isService);
  return (
    <View style={[s.section, { backgroundColor: appTheme.surface }]}> 
      <View style={s.secHeadRow}>
        <LinearGradient colors={isService ? d.secBar : [P.orange500, P.orange300]} style={s.secBar} />
        <Text style={[s.secTitle, { color: appTheme.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC TABLE
// ─────────────────────────────────────────────────────────────────────────────
function SpecTable({ rows, appTheme }) {
  return (
    <View style={[s.specTable, { borderColor: appTheme.border }]}>
      {rows.filter(Boolean).map((row, i) => (
        <View key={i} style={[
          s.specRow,
          {
            backgroundColor: i % 2 === 0 ? appTheme.surfaceAlt : appTheme.surface,
            borderBottomColor: appTheme.border,
          },
        ]}>
          <Text style={[s.specLabel, { color: appTheme.textMuted }]}>{row.label}</Text>
          <Text style={[s.specValue, { color: appTheme.text }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDEUR CARD — premium dark
// ─────────────────────────────────────────────────────────────────────────────
function SellerCard({ seller, onPress, isService, appTheme }) {
  const d = getThemeConfig(isService);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.sellerCard, { transform: [{ scale }], backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}> 

        {/* Avatar */}
        <View style={s.sellerAvatarWrap}>
          {seller.avatar
            ? <Image source={{ uri: seller.avatar }} style={s.sellerAvatar} />
            : (
              <LinearGradient colors={isService ? d.sellerAvatarGrad : [P.orange500, P.orange700]} style={s.sellerAvatar}>
                <Text style={s.sellerInitials}>{getInitials(seller.name)}</Text>
              </LinearGradient>
            )
          }
          <View style={s.onlineDot} />
        </View>

        {/* Infos */}
        <View style={{ flex: 1 }}>
          <View style={s.sellerNameRow}>
            <Text style={[s.sellerName, { color: appTheme.text }]} numberOfLines={1}>{seller.businessName || seller.name}</Text>
            {seller.businessType === 'professional' && (
              <View style={s.verifiedBadge}><Text style={s.verifiedTxt}>✓</Text></View>
            )}
          </View>
          <Text style={[s.sellerLoc, { color: appTheme.textMuted }]}>📍 {getCityName(seller.location)}</Text>
          <View style={s.ratingRow}>
            <Text style={s.ratingStars}>{'★'.repeat(Math.round(seller.sellerStats?.rating || 0))}</Text>
            <Text style={[s.ratingNum, { color: appTheme.text }]}>{seller.sellerStats?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={[s.ratingCount, { color: appTheme.textMuted }]}>({seller.sellerStats?.totalReviews || 0} avis)</Text>
          </View>
        </View>

        {/* Flèche */}
        <View style={[s.sellerArrow, isService && d.sellerArrow]}>
          <Text style={[s.sellerArrowTxt, isService && d.sellerArrowTxt]}>→</Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON CONTACT
// ─────────────────────────────────────────────────────────────────────────────
function ContactBtn({ icon, label, onPress, variant = 'ghost', isService }) {
  const d = getThemeConfig(isService);
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const isMain     = variant === 'main';
  const isWA       = variant === 'whatsapp';
  const isCall     = variant === 'call';

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.cBtn, isMain && s.cBtnMain, isMain && isService && d.cBtnMain, isWA && s.cBtnWA, isCall && s.cBtnCall, { transform: [{ scale }] }]}>
        {isMain ? (
          <LinearGradient colors={isService ? d.sellerAvatarGrad : [P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cBtnGrad}>
            <Text style={s.cBtnIconMain}>{icon}</Text>
            <Text style={s.cBtnLabelMain}>{label}</Text>
          </LinearGradient>
        ) : (
          <>
            <Text style={[s.cBtnIcon, isWA && { color: P.whatsapp }, isCall && { color: P.amber }]}>{icon}</Text>
            <Text style={[s.cBtnLabel, isWA && { color: P.whatsapp }, isCall && { color: P.amber }]}>{label}</Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme: appTheme } = useAppTheme();
  const { user, isAuthenticated } = useAuth();
  const productId = String(route?.params?.productId || '').trim();
  const isValidProductId = /^[a-fA-F0-9]{24}$/.test(productId);

  const [product,    setProduct]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [alert,      setAlert]      = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const isService = product?.type === 'service';
  const d = getThemeConfig(isService);

  // Scroll → header opacity
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 100, HERO_H - 30],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Animations d'entrée staggerées
  const enters = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const runEntrance = useCallback(() => {
    Animated.stagger(70,
      enters.map(a => Animated.spring(a, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }))
    ).start();
  }, []);

  const fetchProduct = async () => {
    if (!isValidProductId) {
      setLoading(false);
      setProduct(null);
      return;
    }

    try {
      const res = await apiClient.get(`/products/${productId}`);
      setProduct(res.data.data || res.data);
      if (isAuthenticated) {
        try {
          const isFav = await checkFavorite(productId);
          setIsFavorite(isFav);
        } catch (err) {
          console.error('Erreur checkFavorite:', err.message);
        }
      }
    } catch (e) {
      console.error(e);
    }
    finally {
      setLoading(false);
      setTimeout(runEntrance, 80);
    }
  };

  const fetchReviews = async () => {
    if (!isValidProductId) {
      setReviews([]);
      return;
    }

    try {
      setLoadingReviews(true);
      const response = await getProductReviews(productId, 1, 5);
      setReviews(response?.data || []);
    } catch (error) {
      console.error('❌ Erreur chargement avis:', error?.message || error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => { fetchProduct(); }, [productId, isValidProductId]);
  useEffect(() => { fetchReviews(); }, [productId, isValidProductId]);

  const handleMarkHelpful = async (reviewId) => {
    try {
      await markReviewHelpful(reviewId);
      await fetchReviews();
    } catch (error) {
      console.error('❌ Erreur avis utile:', error?.message || error);
    }
  };

  const handleSubmitReview = async () => {
    if (!isValidProductId) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Annonce indisponible',
        message: 'Identifiant produit invalide. Veuillez rouvrir cette annonce.',
        buttons: [{ text: 'Fermer', onPress: () => {} }],
      });
      return;
    }

    if (!isAuthenticated) {
      navigation.navigate('QuickAuth', {
        pendingAction: { type: 'review', productId },
        returnScreen: 'ProductDetail',
        returnParams: { productId },
      });
      return;
    }

    const sellerId = String(product?.seller?.id || product?.seller?._id || '');
    const currentUserId = String(user?.id || '');
    if (sellerId && currentUserId && sellerId === currentUserId) {
      setAlert({
        visible: true,
        type: 'warning',
        title: 'Action impossible',
        message: 'Vous ne pouvez pas évaluer votre propre annonce.',
        buttons: [{ text: 'Fermer', onPress: () => {} }],
      });
      return;
    }

    if (!reviewRating || !reviewComment.trim()) {
      setAlert({
        visible: true,
        type: 'warning',
        title: 'Avis incomplet',
        message: 'Choisissez une note et écrivez un commentaire.',
        buttons: [{ text: 'Fermer', onPress: () => {} }],
      });
      return;
    }

    if (reviewComment.trim().length > 1000) {
      setAlert({
        visible: true,
        type: 'warning',
        title: 'Commentaire trop long',
        message: 'Le commentaire ne peut pas dépasser 1000 caractères.',
        buttons: [{ text: 'Fermer', onPress: () => {} }],
      });
      return;
    }

    try {
      setSubmittingReview(true);
      await createReview({
        productId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      setReviewRating(0);
      setReviewComment('');
      await Promise.all([fetchReviews(), fetchProduct()]);

      setAlert({
        visible: true,
        type: 'success',
        title: 'Merci',
        message: 'Votre avis a été publié avec succès.',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: error?.message || 'Impossible de publier votre avis.',
        buttons: [{ text: 'Fermer', onPress: () => {} }],
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!isValidProductId) return;

    if (!isAuthenticated) {
      navigation.navigate('QuickAuth', {
        pendingAction: { type: 'favorite', productId },
        returnScreen: 'ProductDetail',
        returnParams: { productId },
      });
      return;
    }
    try {
      await toggleFavorite(productId, isFavorite);
      setIsFavorite(!isFavorite);
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    if (!product) return;
    await Share.share({ message: `${product.title} — ${product.price ? parseInt(product.price).toLocaleString() + ' FCFA' : 'Prix à discuter'}\nVoir sur MarketHub` });
  };

  const handleContact = (type) => {
    const seller = product?.seller;
    if (!seller) return;
    if (type === 'whatsapp' && seller.contactInfo?.whatsapp)
      Linking.openURL(`whatsapp://send?phone=${seller.contactInfo.whatsapp}`);
    if (type === 'call' && (seller.contactInfo?.phone || seller.phone))
      Linking.openURL(`tel:${seller.contactInfo?.phone || seller.phone}`);
    if (type === 'message') {
      if (!isValidProductId) return;

      if (!isAuthenticated) {
        navigation.navigate('QuickAuth', {
          pendingAction: { type: 'message', sellerId: seller.id || seller._id, productId },
          returnScreen: 'ProductDetail',
          returnParams: { productId },
        });
        return;
      }
      const sellerId = seller.id || seller._id;
      if (!sellerId) return;

      // Vérifier si c'est le même utilisateur
      const currentUserId = String(user?.id || '');
      const sellerIdStr = String(sellerId || '');
      if (currentUserId && sellerIdStr && currentUserId === sellerIdStr) {
        setAlert({
          visible: true,
          type: 'warning',
          title: 'Annonce personnelle',
          message: 'Vous ne pouvez pas discuter avec vous-même. Ceci est votre propre produit.',
          buttons: [{ text: 'Fermer', onPress: () => {} }],
        });
        return;
      }

      navigation.navigate('MainTabs', {
        screen: 'Messages',
        params: {
          screen: 'MessagesList',
          params: {
            sellerId,
            productId,
          },
        },
      });
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient colors={appTheme.shell} style={s.loadScreen}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={s.loadRingWrap}>
          <LinearGradient colors={isService ? d.sellerAvatarGrad : [P.orange500, P.orange700]} style={[s.loadLogoBox, isService && d.loadLogoBox]}>
            <Text style={s.loadLogoTxt}>M</Text>
          </LinearGradient>
          <View style={[s.loadRing, isService && d.loadRing]} />
        </View>
        <Text style={[s.loadBrand, { color: appTheme.text }]}>MarketHub</Text>
        <Text style={[s.loadSub, { color: appTheme.textMuted }]}>Chargement de l'annonce…</Text>
        <ActivityIndicator size="large" color={isService ? P.blue100 : P.amber} style={{ marginTop: 36 }} />
      </LinearGradient>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <LinearGradient colors={appTheme.shell} style={s.notFound}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <Text style={{ fontSize: 64 }}>😕</Text>
        <Text style={[s.notFoundTitle, { color: appTheme.text }]}>Annonce introuvable</Text>
        <Text style={[s.notFoundSub, { color: appTheme.textMuted }]}>Cette annonce a peut-être été supprimée.</Text>
        <TouchableOpacity style={s.notFoundBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <LinearGradient colors={isService ? d.sellerAvatarGrad : [P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.notFoundBtnGrad, isService && d.notFoundBtn]}>
            <Text style={s.notFoundBtnTxt}>← Retourner</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Préparer les données
  const images = product.images?.filter(Boolean).length > 0
    ? product.images
    : [product.mainImage].filter(Boolean);
  if (!images.length) images.push(null);

  const specRows = [
    { label: 'Type',        value: isService ? 'Service' : 'Produit' },
    !isService && product.condition && {
      label: 'État',
      value: product.condition === 'new' ? '✨ Neuf' : product.condition === 'used' ? '🔄 Occasion' : '🔧 Reconditionné',
    },
    !isService && product.quantity && { label: 'Quantité', value: String(product.quantity) },
    product.category?.name && { label: 'Catégorie', value: product.category.name },
    product.subcategory     && { label: 'Sous-catégorie', value: product.subcategory },
  ].filter(Boolean);

  const postDate = product.createdAt
    ? new Date(product.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : product.postedTime || 'Récent';

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: appTheme.screen }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ══ HEADER FLOTTANT ══════════════════════════════════════════════ */}
      <View style={[s.header, { paddingTop: (insets.top || 0) + 8 }]} pointerEvents="box-none">
        {/* Fond qui apparaît au scroll */}
        <Animated.View style={[StyleSheet.absoluteFill, s.headerBg, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }, isService && d.headerBg, { opacity: headerOpacity }]} />

        {/* Bouton retour */}
        <TouchableOpacity style={s.hBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={s.hBtnBlur}>
            <Text style={[s.hBtnTxt, { color: appTheme.text }]}>←</Text>
          </BlurView>
        </TouchableOpacity>

        {/* Titre au scroll */}
        <Animated.Text style={[s.hTitle, { opacity: headerOpacity, color: appTheme.text }]} numberOfLines={1}>
          {product.title}
        </Animated.Text>

        {/* Actions droite */}
        <View style={s.hRight}>
          <TouchableOpacity style={s.hBtn} onPress={handleShare} activeOpacity={0.85}>
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={s.hBtnBlur}>
              <Text style={[s.hBtnTxt, { color: appTheme.text }]}>↗</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={handleToggleFavorite} activeOpacity={0.85}>
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={[s.hBtnBlur, isFavorite && s.hBtnFavBlur]}>
              <Text style={[s.hBtnTxt, isFavorite && s.hBtnFavTxt]}>
                {isFavorite ? '♥' : '♡'}
              </Text>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ SCROLL PRINCIPAL ═════════════════════════════════════════════ */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 90 + Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >

        {/* ── HERO IMAGE ──────────────────────────────────────────────── */}
        <ImageCarousel images={images} />

        {/* ── BLOC TITRE — chevauchement hero ─────────────────────────── */}
        <Animated.View style={[
          s.titleBlock,
          { backgroundColor: appTheme.surface, borderColor: appTheme.border, shadowColor: appTheme.shadow },
          {
            opacity: enters[0],
            transform: [{ translateY: enters[0].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}>
          {/* Badge type */}
          <View style={[s.typeBadge, { backgroundColor: isService ? 'rgba(59,130,246,0.9)' : 'rgba(236,90,19,0.9)' }]}>
            <Text style={s.typeBadgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>

          <Text style={[s.heroTitle, { color: appTheme.text }]}>{product.title}</Text>

          {/* Localisation + date */}
          <View style={s.heroMeta}>
            <View style={[s.heroLocRow, isService ? d.heroLocRow : d.heroLocRowProduct]}>
              <Text style={[s.heroLocDot, isService ? d.heroLocDot : d.heroLocDotProduct]}>●</Text>
              <Text style={[s.heroLocTxt, isService ? d.heroLocTxt : d.heroLocTxtProduct]}>{getCityName(product.location)}</Text>
            </View>
            <Text style={[s.heroDate, { color: appTheme.textMuted }]}>Publié le {postDate}</Text>
          </View>
        </Animated.View>

        {/* ── PRIX + STATS — fond sombre ──────────────────────────────── */}
        <Animated.View style={[
          s.priceBlock,
          { backgroundColor: appTheme.surface, borderColor: appTheme.border, shadowColor: appTheme.shadow },
          {
            opacity: enters[1],
            transform: [{ translateY: enters[1].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}>
          <View style={s.priceRow}>
            <View>
              <Text style={[s.priceMeta, { color: appTheme.textMuted }]}>Prix demandé</Text>
              {product.price ? (
                <View style={s.priceAmountRow}>
                  <Text style={[s.priceAmount, isService && d.priceAmount]}>{parseInt(product.price).toLocaleString('fr-FR')}</Text>
                  <Text style={[s.priceCurrency, { color: appTheme.textMuted }]}> FCFA</Text>
                </View>
              ) : (
                <Text style={[s.priceNego, { color: appTheme.textMuted }]}>Prix à discuter</Text>
              )}
            </View>

            {/* Mini stats pills */}
            <View style={s.miniStats}>
              <View style={s.miniStat}>
                <Text style={s.miniStatIcon}>👁</Text>
                <Text style={[s.miniStatVal, { color: appTheme.textMuted }]}>{product.views || 0}</Text>
              </View>
              <View style={s.miniStat}>
                <Text style={s.miniStatIcon}>♡</Text>
                <Text style={[s.miniStatVal, { color: appTheme.textMuted }]}>{product.favorites || 0}</Text>
              </View>
            </View>
          </View>

          {/* Ligne accent */}
          <LinearGradient
            colors={isService ? d.priceAccentColors : ['transparent', P.terra, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.priceAccentLine}
          />
        </Animated.View>

        {/* ── VENDEUR ─────────────────────────────────────────────────── */}
        {product.seller && (
          <Animated.View style={{
            opacity: enters[2],
            transform: [{ translateY: enters[2].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}>
            <Section title="Annonceur" isService={isService} appTheme={appTheme}>
              <SellerCard
                seller={product.seller}
                onPress={() => navigation.navigate('SellerProfile', { sellerId: product.seller.id })}
                isService={isService}
                appTheme={appTheme}
              />
            </Section>
          </Animated.View>
        )}

        {/* ── DESCRIPTION ─────────────────────────────────────────────── */}
        <Animated.View style={{
          opacity: enters[3],
          transform: [{ translateY: enters[3].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          <Section title="Description" isService={isService} appTheme={appTheme}>
            <View style={[s.descCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}>
              <Text style={[s.descText, { color: appTheme.text }]}>{product.description}</Text>
            </View>
          </Section>
        </Animated.View>

        {/* ── DÉTAILS ─────────────────────────────────────────────────── */}
        <Animated.View style={{
          opacity: enters[4],
          transform: [{ translateY: enters[4].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          <Section title="Détails" isService={isService} appTheme={appTheme}>
            <SpecTable rows={specRows} appTheme={appTheme} />
          </Section>
        </Animated.View>

        {/* ── CARACTÉRISTIQUES ────────────────────────────────────────── */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <Animated.View style={{
            opacity: enters[5],
            transform: [{ translateY: enters[5].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}>
            <Section title="Caractéristiques" isService={isService} appTheme={appTheme}>
              <SpecTable rows={Object.entries(product.specifications).map(([k, v]) => ({ label: k, value: v }))} appTheme={appTheme} />
            </Section>
          </Animated.View>
        )}

        {/* ── DISPONIBILITÉ (service) ──────────────────────────────────── */}
        {isService && product.availability && (
          <Animated.View style={{
            opacity: enters[5],
            transform: [{ translateY: enters[5].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}>
            <Section title="Disponibilité" isService={isService} appTheme={appTheme}>
              <View style={[s.availCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}>
                {product.availability.days?.length > 0 && (
                  <View style={s.availRow}>
                    <Text style={s.availIcon}>📅</Text>
                    <Text style={[s.availTxt, { color: appTheme.text }]}>{product.availability.days.join(' · ')}</Text>
                  </View>
                )}
                {product.availability.openingTime && (
                  <View style={s.availRow}>
                    <Text style={s.availIcon}>🕐</Text>
                    <Text style={[s.availTxt, { color: appTheme.text }]}>{product.availability.openingTime} — {product.availability.closingTime}</Text>
                  </View>
                )}
              </View>
            </Section>
          </Animated.View>
        )}

        {/* ── AVIS / ÉVALUATIONS ───────────────────────────────────────── */}
        <Animated.View style={{
          opacity: enters[6],
          transform: [{ translateY: enters[6].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          <Section title="Avis & évaluations" isService={isService} appTheme={appTheme}>
            <View style={[s.reviewHeaderCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}> 
              <View style={s.reviewHeaderLeft}>
                <Text style={[s.reviewHeaderScore, { color: appTheme.text }]}>{(product.rating || 0).toFixed(1)}</Text>
                <Text style={[s.reviewHeaderCount, { color: appTheme.textMuted }]}>{product.totalReviews || 0} avis</Text>
              </View>
              <View style={s.reviewHeaderRight}>
                <Text style={s.reviewHeaderStars}>{'★'.repeat(Math.round(product.rating || 0)) || '☆☆☆☆☆'}</Text>
                <Text style={[s.reviewHeaderSub, { color: appTheme.textMuted }]}>Ce que pensent les clients de cet annonceur</Text>
              </View>
            </View>

            <View style={[s.reviewFormCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}> 
              <Text style={[s.reviewFormTitle, { color: appTheme.text }]}>Donnez votre note</Text>
              <View style={s.reviewStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewRating(star)}
                    disabled={submittingReview}
                    style={s.reviewStarBtn}
                  >
                    <Text style={[s.reviewStar, star <= reviewRating && s.reviewStarActive]}>★</Text>
                  </TouchableOpacity>
                ))}
                {reviewRating > 0 && <Text style={s.reviewStarLabel}>{reviewRating}/5</Text>}
              </View>

              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Partagez votre expérience avec cet annonceur..."
                placeholderTextColor={appTheme.inputPlaceholder}
                multiline
                maxLength={1000}
                editable={!submittingReview}
                style={[s.reviewInput, { color: appTheme.inputText, backgroundColor: appTheme.inputBg, borderColor: appTheme.border }]}
              />
              <Text style={[s.reviewCounter, { color: appTheme.textMuted }]}>{reviewComment.length}/1000</Text>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleSubmitReview}
                disabled={submittingReview}
                style={[s.reviewSubmitBtn, submittingReview && s.reviewSubmitBtnDisabled]}
              >
                <LinearGradient
                  colors={isService ? d.sellerAvatarGrad : [P.orange500, P.orange700]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.reviewSubmitBtnGrad}
                >
                  {submittingReview ? (
                    <ActivityIndicator size="small" color={P.white} />
                  ) : (
                    <Text style={s.reviewSubmitBtnTxt}>Publier mon avis</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {loadingReviews ? (
              <View style={s.reviewLoadingWrap}>
                <ActivityIndicator size="small" color={isService ? P.blue100 : P.terra} />
                <Text style={[s.reviewLoadingTxt, { color: appTheme.textMuted }]}>Chargement des avis...</Text>
              </View>
            ) : reviews.length > 0 ? (
              <View style={s.reviewListWrap}>
                <Text style={[s.reviewListTitle, { color: appTheme.text }]}>Avis récents</Text>
                {reviews.slice(0, 5).map((review) => (
                  <View key={review.id} style={[s.reviewItemCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}>
                    <View style={s.reviewItemHead}>
                      <View style={s.reviewUserWrap}>
                        {review.userAvatar ? (
                          <Image source={{ uri: review.userAvatar }} style={s.reviewAvatarImg} />
                        ) : (
                          <View style={s.reviewAvatar}>
                            <Text style={s.reviewAvatarTxt}>{getInitials(review.userName)}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[s.reviewItemUser, { color: appTheme.text }]} numberOfLines={1}>{review.userName}</Text>
                          <Text style={[s.reviewItemDate, { color: appTheme.textMuted }]}>{formatRelativeDate(review.date)}</Text>
                        </View>
                        <Text style={s.reviewItemStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                      </View>
                    </View>
                    <Text style={[s.reviewItemComment, { color: appTheme.text }]} numberOfLines={2}>{review.comment}</Text>
                    <TouchableOpacity onPress={() => handleMarkHelpful(review.id)} style={[s.reviewHelpfulBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}> 
                      <Text style={[s.reviewHelpfulTxt, { color: appTheme.textMuted }]}>👍 Utile{review.helpful > 0 ? ` (${review.helpful})` : ''}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[s.reviewEmptyCard, { backgroundColor: appTheme.surfaceAlt, borderColor: appTheme.border }]}>
                <Text style={[s.reviewEmptyTitle, { color: appTheme.text }]}>Aucun avis pour le moment</Text>
                <Text style={[s.reviewEmptyTxt, { color: appTheme.textMuted }]}>Soyez le premier à évaluer cet annonceur.</Text>
              </View>
            )}
          </Section>
        </Animated.View>

        {/* ── NOTE MISE EN RELATION ────────────────────────────────────── */}
        <Animated.View style={[
          s.meetupNote,
          {
            opacity: enters[7],
            transform: [{ translateY: enters[7].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}>
          <View style={[s.meetupInner, isService && d.meetupInner]}>
            {/* Accent bar gauche */}
            <View style={[s.meetupAccent, isService && d.meetupAccent]} />
            <Text style={s.meetupIcon}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.meetupTitle, { color: appTheme.text }]}>Mise en relation directe</Text>
              <Text style={[s.meetupSub, { color: appTheme.textMuted }]}>Contactez l'annonceur et convenez d'un lieu entre vous.</Text>
            </View>
          </View>
        </Animated.View>

      </Animated.ScrollView>

      {/* ══ FOOTER CONTACT ═══════════════════════════════════════════════ */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
        {/* Fondu blanc vers le haut */}
        <LinearGradient
          colors={isDark ? ['rgba(17,24,39,0)', appTheme.surface] : ['rgba(249,250,251,0)', appTheme.surface]}
          style={s.footerFade}
          pointerEvents="none"
        />
        <View style={[s.footerContent, { backgroundColor: appTheme.surface, borderTopColor: appTheme.border }]}> 
          <ContactBtn icon="✉️" label="Envoyer un message" variant="main" onPress={() => handleContact('message')} isService={isService} />
        </View>
      </View>

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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: P.surface },

  // ── Loading ──────────────────────────────────────────────────────────────────
  loadScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadRingWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  loadLogoBox:  { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: P.terra, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 12 },
  loadRing:     { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.3)' },
  loadLogoTxt:  { fontSize: 38, fontWeight: '900', color: P.white },
  loadBrand:    { fontSize: 28, fontWeight: '900', color: P.white, letterSpacing: -1 },
  loadSub:      { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 },

  // ── Not found ─────────────────────────────────────────────────────────────
  notFound:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  notFoundTitle:   { fontSize: 22, fontWeight: '900', color: P.white, marginTop: 16, marginBottom: 8, letterSpacing: -0.5 },
  notFoundSub:     { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  notFoundBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, elevation: 7 },
  notFoundBtnGrad: { paddingVertical: 14, paddingHorizontal: 28 },
  notFoundBtnTxt:  { fontSize: 15, fontWeight: '800', color: P.white },

  // ── Header flottant ───────────────────────────────────────────────────────
  header:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  headerBg:  { backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: 'rgba(236,90,19,0.2)' },
  hBtn:      { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  hBtnBlur:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hBtnFavBlur:{ backgroundColor: 'rgba(236,90,19,0.25)' },
  hBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  hBtnFavTxt:{ color: P.amber },
  hTitle:    { flex: 1, fontSize: 14, fontWeight: '800', color: P.white, letterSpacing: -0.2, textAlign: 'center' },
  hRight:    { flexDirection: 'row', gap: 8 },

  // ── Hero image ────────────────────────────────────────────────────────────
  hero:      { width, height: HERO_H, backgroundColor: P.charcoal },
  heroGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: HERO_H * 0.6 },
  imgCounter:{ position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(17,24,39,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  imgCounterTxt:{ fontSize: 11, fontWeight: '700', color: P.white },
  dotsRow:   { position: 'absolute', bottom: 80, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot:       { height: 3, borderRadius: 1.5, backgroundColor: P.white },

  // ── Bloc titre (chevauchement) ────────────────────────────────────────────
  titleBlock: {
    marginTop: -60,
    marginHorizontal: 16,
    backgroundColor: P.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: P.dim,
    shadowColor: P.charcoal,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 10,
    zIndex: 5,
  },
  typeBadge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '900', color: P.white },
  heroTitle:    { fontSize: 22, fontWeight: '900', color: P.charcoal, lineHeight: 30, marginBottom: 14, letterSpacing: -0.5 },
  heroMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLocRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroLocDot:   { fontSize: 7, color: P.terra },
  heroLocTxt:   { fontSize: 13, fontWeight: '700', color: P.terra },
  heroDate:     { fontSize: 11, color: P.muted, fontWeight: '500' },

  // ── Prix ──────────────────────────────────────────────────────────────────
  priceBlock:     { marginHorizontal: 16, marginTop: 12, backgroundColor: P.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: P.dim, shadowColor: P.charcoal, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  priceRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  priceMeta:      { fontSize: 10, fontWeight: '600', color: P.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  priceAmountRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount:    { fontSize: 32, fontWeight: '900', color: P.terra, letterSpacing: -1 },
  priceCurrency:  { fontSize: 14, fontWeight: '600', color: P.muted },
  priceNego:      { fontSize: 18, fontWeight: '700', color: P.muted },
  miniStats:      { flexDirection: 'row', gap: 10 },
  miniStat:       { alignItems: 'center', gap: 2 },
  miniStatIcon:   { fontSize: 16 },
  miniStatVal:    { fontSize: 12, fontWeight: '700', color: P.muted },
  priceAccentLine:{ height: 1.5, borderRadius: 1 },

  // ── Sections ──────────────────────────────────────────────────────────────
  section:     { paddingHorizontal: 16, paddingVertical: 20, marginTop: 4, backgroundColor: P.white },
  sectionDark: { backgroundColor: P.white },
  secHeadRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  secBar:      { width: 4, height: 22, borderRadius: 2 },
  secTitle:    { fontSize: 17, fontWeight: '900', color: P.charcoal, letterSpacing: -0.3 },
  secTitleDark:{ color: P.charcoal },

  // ── Vendeur ───────────────────────────────────────────────────────────────
  sellerCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: P.dim, gap: 12 },
  sellerAvatarWrap:{ position: 'relative' },
  sellerAvatar:    { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  sellerInitials:  { fontSize: 20, fontWeight: '800', color: P.white },
  onlineDot:       { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: P.green, borderWidth: 2, borderColor: P.surface },
  sellerNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sellerName:      { fontSize: 15, fontWeight: '800', color: P.charcoal },
  verifiedBadge:   { width: 17, height: 17, borderRadius: 9, backgroundColor: P.green, justifyContent: 'center', alignItems: 'center' },
  verifiedTxt:     { fontSize: 10, fontWeight: '900', color: P.white },
  sellerLoc:       { fontSize: 12, color: P.muted, marginBottom: 4 },
  ratingRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingStars:     { fontSize: 12, color: P.gold },
  ratingNum:       { fontSize: 12, fontWeight: '800', color: P.charcoal },
  ratingCount:     { fontSize: 11, color: P.muted },
  sellerArrow:     { width: 32, height: 32, borderRadius: 16, backgroundColor: P.peachSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(236,90,19,0.2)' },
  sellerArrowTxt:  { fontSize: 14, fontWeight: '700', color: P.terra },

  // ── Description ───────────────────────────────────────────────────────────
  descCard: { backgroundColor: P.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: P.dim },
  descText: { fontSize: 15, color: P.charcoal, lineHeight: 26 },

  // ── Spec table ────────────────────────────────────────────────────────────
  specTable:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: P.dim },
  specTableDark:  { borderColor: P.dim },
  specRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: P.dim, backgroundColor: P.white },
  specRowAlt:     { backgroundColor: P.surface },
  specRowDark:    { backgroundColor: P.white, borderBottomColor: P.dim },
  specRowDarkAlt: { backgroundColor: P.surface, borderBottomColor: P.dim },
  specLabel:      { fontSize: 13, fontWeight: '600', color: P.muted, flex: 1 },
  specLabelDark:  { color: P.muted },
  specValue:      { fontSize: 13, fontWeight: '800', color: P.charcoal, textAlign: 'right', flex: 1.2 },
  specValueDark:  { color: P.charcoal },

  // ── Disponibilité ─────────────────────────────────────────────────────────
  availCard: { backgroundColor: P.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: P.dim },
  availRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availIcon: { fontSize: 18 },
  availTxt:  { fontSize: 14, fontWeight: '600', color: P.charcoal },

  // ── Avis ─────────────────────────────────────────────────────────────────
  reviewHeaderCard: { backgroundColor: P.surface, borderRadius: 16, borderWidth: 1, borderColor: P.dim, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  reviewHeaderLeft: { minWidth: 74, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRightWidth: 1, borderRightColor: P.dim, paddingRight: 14 },
  reviewHeaderRight: { flex: 1 },
  reviewHeaderScore: { fontSize: 30, fontWeight: '900', color: P.charcoal, lineHeight: 34 },
  reviewHeaderStars: { fontSize: 17, color: P.gold, letterSpacing: 1 },
  reviewHeaderCount: { fontSize: 12, color: P.muted, marginTop: 2, fontWeight: '700' },
  reviewHeaderSub: { fontSize: 12, color: P.muted, marginTop: 4, lineHeight: 17 },

  reviewFormCard: { backgroundColor: P.surface, borderRadius: 16, borderWidth: 1, borderColor: P.dim, padding: 14, marginBottom: 12 },
  reviewFormTitle: { fontSize: 14, fontWeight: '800', color: P.charcoal, marginBottom: 10 },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewStarBtn: { marginRight: 6 },
  reviewStar: { fontSize: 30, color: '#d1d5db' },
  reviewStarActive: { color: P.gold },
  reviewStarLabel: { marginLeft: 4, fontSize: 12, fontWeight: '700', color: P.muted },
  reviewInput: { minHeight: 98, textAlignVertical: 'top', borderWidth: 1, borderColor: P.dim, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.charcoal, backgroundColor: P.white },
  reviewCounter: { alignSelf: 'flex-end', marginTop: 6, fontSize: 11, color: P.muted },
  reviewSubmitBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  reviewSubmitBtnDisabled: { opacity: 0.7 },
  reviewSubmitBtnGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  reviewSubmitBtnTxt: { fontSize: 14, fontWeight: '800', color: P.white },

  reviewLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  reviewLoadingTxt: { fontSize: 12, color: P.muted },
  reviewListWrap: { gap: 8 },
  reviewListTitle: { fontSize: 13, fontWeight: '800', color: P.charcoal },
  reviewItemCard: { width: '100%', backgroundColor: P.surface, borderWidth: 1, borderColor: P.dim, borderRadius: 12, padding: 10 },
  reviewItemHead: { marginBottom: 4 },
  reviewUserWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.peachSoft, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarImg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb' },
  reviewAvatarTxt: { fontSize: 12, fontWeight: '900', color: P.terra },
  reviewItemUser: { fontSize: 13, fontWeight: '800', color: P.charcoal },
  reviewItemDate: { fontSize: 11, color: P.muted, marginTop: 1 },
  reviewItemStars: { fontSize: 12, color: P.gold },
  reviewItemComment: { fontSize: 12.5, color: P.charcoal, lineHeight: 18 },
  reviewHelpfulBtn: { alignSelf: 'flex-end', marginTop: 6, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: P.white, borderWidth: 1, borderColor: P.dim },
  reviewHelpfulTxt: { fontSize: 11, color: P.muted, fontWeight: '700' },
  reviewEmptyCard: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.dim, borderRadius: 12, padding: 14 },
  reviewEmptyTitle: { fontSize: 13, fontWeight: '800', color: P.charcoal, marginBottom: 4 },
  reviewEmptyTxt: { fontSize: 12, color: P.muted, lineHeight: 18 },

  // ── Note mise en relation ─────────────────────────────────────────────────
  meetupNote:   { marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden' },
  meetupInner:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: P.peachSoft, borderWidth: 1, borderColor: 'rgba(236,90,19,0.18)', borderRadius: 18,marginBottom: 40  },
  meetupAccent: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, backgroundColor: P.terra, borderRadius: 2 },
  meetupIcon:   { fontSize: 30 },
  meetupTitle:  { fontSize: 13, fontWeight: '800', color: P.charcoal, marginBottom: 3 },
  meetupSub:    { fontSize: 12, color: P.muted, lineHeight: 18 },

  // ── Footer contact ────────────────────────────────────────────────────────
  footer:       { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerFade:   { position: 'absolute', top: -40, left: 0, right: 0, height: 40 },
  footerContent:{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: P.surface, borderTopWidth: 1, borderTopColor: P.dim },
  footerRow:    { flexDirection: 'row', gap: 10 },

  // Boutons contact
  cBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, gap: 7 },
  cBtnWA:       { backgroundColor: 'rgba(37,211,102,0.1)', borderWidth: 1.5, borderColor: 'rgba(37,211,102,0.25)' },
  cBtnCall:     { backgroundColor: P.peachSoft, borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.2)' },
  cBtnMain:     { overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, elevation: 8 },
  cBtnGrad:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14, gap: 8 },
  cBtnIcon:     { fontSize: 17 },
  cBtnLabel:    { fontSize: 13, fontWeight: '700' },
  cBtnIconMain: { fontSize: 18 },
  cBtnLabelMain:{ fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});