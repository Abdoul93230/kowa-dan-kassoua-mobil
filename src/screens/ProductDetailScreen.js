// ─── Fiche annonce (produit ou service) — TakTak Niger ───────────────────────
// Galerie immersive (étirement, parallaxe, plein écran), en-tête qui se solidifie
// au défilement, infos clés en un coup d'œil, vendeur, avis, annonces similaires,
// et barre d'action fixe. Contact uniquement via la messagerie de l'app.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Share, ActivityIndicator, FlatList, Platform, StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../api/auth';
import { createReview, getProductReviews, markReviewHelpful, checkReviewEligibility } from '../api/reviews';
import { toggleProductStatus } from '../api/products';
import { reportProduct, REPORT_REASONS } from '../api/reports';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../hooks/useFavorites';
import AlertModal from '../components/AlertModal';
import Sheet, { SheetTextInput } from '../components/Sheet';
import ImageGallery from '../components/product/ImageGallery';
import ProductCard from '../components/home/ProductCard';
import PressableScale from '../components/home/PressableScale';
import { SkeletonGroup, Bone } from '../components/home/Skeleton';
import { MOBILE_COLORS as P } from '../theme/colors';
import { formatCompact, formatPrice, getCityName, getInitials, getProductId, sizedImage, timeAgo } from '../utils/format';

const CONDITIONS = {
  new: { label: 'Neuf', icon: 'star' },
  used: { label: 'Occasion', icon: 'refresh-cw' },
  refurbished: { label: 'Reconditionné', icon: 'tool' },
};
const STATUS_BANNERS = {
  sold: { icon: 'check-circle', text: 'Cette annonce est marquée comme vendue.' },
  expired: { icon: 'clock', text: 'Cette annonce a expiré.' },
  pending: { icon: 'eye-off', text: 'Cette annonce est désactivée : elle n\'est plus visible.' },
};
const RATING_LABELS = ['', 'Décevant', 'Moyen', 'Correct', 'Très bien', 'Excellent'];
const REVIEW_MAX = 1000;

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const sinceLabel = (date) => {
  const t = timeAgo(date);
  return t === 'Récent' ? 'Récemment' : `Il y a ${t}`;
};
const relativeDate = (value) => {
  if (!value) return 'Récemment';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Récemment';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 7) return sinceLabel(value);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Petits composants ────────────────────────────────────────────────────────
function Stars({ value = 0, size = 14, color = P.gold, gap = 2 }) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

// Bouton d'en-tête : translucide sur la photo, puis plein quand l'en-tête devient opaque
function HeaderButton({ renderIcon, onPress, solid, theme, label }) {
  const onPhoto = solid.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.hBtn, pressed && { transform: [{ scale: 0.9 }] }]}>
      <Animated.View style={[StyleSheet.absoluteFill, s.hBtnBg, { backgroundColor: 'rgba(17,24,39,0.42)', opacity: onPhoto }]} />
      <Animated.View style={[StyleSheet.absoluteFill, s.hBtnBg, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, opacity: solid }]} />
      <Animated.View style={[s.hBtnIcon, { opacity: onPhoto }]}>{renderIcon('#fff')}</Animated.View>
      <Animated.View style={[s.hBtnIcon, { opacity: solid }]}>{renderIcon(theme.text)}</Animated.View>
    </Pressable>
  );
}

function Card({ theme, style, children }) {
  return <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

function SectionTitle({ icon, title, accent, theme, right }) {
  return (
    <View style={s.secHead}>
      <View style={[s.secIcon, { backgroundColor: `${accent}1F` }]}>
        <Feather name={icon} size={15} color={accent} />
      </View>
      <Text style={[s.secTitle, { color: theme.text }]}>{title}</Text>
      {right}
    </View>
  );
}

function InfoTile({ icon, label, value, accent, softBg, theme }) {
  return (
    <View style={[s.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[s.tileIcon, { backgroundColor: softBg }]}>
        <Feather name={icon} size={16} color={accent} />
      </View>
      <Text style={[s.tileLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[s.tileValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Avatar({ uri, name, size, colors }) {
  if (uri) {
    return <Image source={{ uri: sizedImage(uri, size) }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />;
  }
  return (
    <LinearGradient colors={colors} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{getInitials(name)}</Text>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height: winH } = useWindowDimensions();
  const { isDark, theme } = useAppTheme();
  const { user, isAuthenticated } = useAuth();
  const productId = String(route?.params?.productId || '').trim();
  const isValidProductId = /^[a-fA-F0-9]{24}$/.test(productId);

  // Affichage instantané : la carte touchée (photo, titre, prix, vendeur) est affichée
  // tout de suite ; le détail complet la remplace dès qu'il arrive
  const previewParam = route?.params?.preview;
  const initialPreview = previewParam && String(previewParam.id || previewParam._id || '') === productId ? previewParam : null;

  const [product, setProduct] = useState(initialPreview);
  const [loading, setLoading] = useState(!initialPreview);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewEligible, setReviewEligible] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Signalement
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [ownerActionLoading, setOwnerActionLoading] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [solidHeader, setSolidHeader] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '', buttons: [{ text: 'OK', onPress: () => {} }] });

  const { favorites, toggleFavorite: toggleSharedFavorite } = useFavorites();
  const isFavorite = favorites.has(productId);

  const isService = product?.type === 'service';
  const accent = isService ? P.blue600 : (isDark ? P.amber : P.terra);
  const softBg = isService ? (isDark ? 'rgba(37,99,235,0.18)' : P.blueSoft) : (isDark ? 'rgba(236,90,19,0.16)' : P.orange50);
  const gradient = isService ? [P.blue600, P.blueDark] : [P.orange500, P.orange700];

  // ─── Défilement : en-tête et galerie animés sur le thread natif ────────────
  const HERO_H = Math.round(Math.min(Math.max(winH * 0.5, 320), 520));
  const scrollY = useRef(new Animated.Value(0)).current;
  const solidRef = useRef(false);
  const solid = scrollY.interpolate({ inputRange: [HERO_H - 150, HERO_H - 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e) => {
        const next = e.nativeEvent.contentOffset.y > HERO_H - 115;
        if (next !== solidRef.current) {
          solidRef.current = next;
          setSolidHeader(next);
        }
      },
    }
  ), [scrollY, HERO_H]);

  const enter = useRef(new Animated.Value(0)).current;
  const runEntrance = useCallback(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, tension: 60, friction: 11 }).start();
  }, [enter]);

  // ─── Données ─────────────────────────────────────────────────────────────────
  const fetchProduct = useCallback(async () => {
    if (!isValidProductId) {
      setLoading(false);
      setProduct(null);
      return;
    }
    try {
      const res = await apiClient.get(`/products/${productId}`);
      setProduct(res.data?.data || res.data);
    } catch (e) {
      // Annonce supprimée ou retirée : on n'affiche pas l'aperçu périmé
      if (e?.response?.status === 404) setProduct(null);
      else console.error(e);
    } finally {
      setLoading(false);
      if (!initialPreview) setTimeout(runEntrance, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, isValidProductId]);

  const fetchReviews = useCallback(async () => {
    if (!isValidProductId) return;
    try {
      setLoadingReviews(true);
      const response = await getProductReviews(productId, 1, 5);
      setReviews(response?.data || []);
    } catch (error) {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [productId, isValidProductId]);

  const checkEligibility = useCallback(async () => {
    if (!isValidProductId || !isAuthenticated) {
      setReviewEligible(false);
      return;
    }
    try {
      const response = await checkReviewEligibility(productId);
      setReviewEligible(Boolean(response?.eligible));
    } catch (error) {
      setReviewEligible(false);
    }
  }, [productId, isValidProductId, isAuthenticated]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);
  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  useEffect(() => { checkEligibility(); }, [checkEligibility]);
  useEffect(() => {
    if (initialPreview) runEntrance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ouverture directe du formulaire d'avis (depuis une notification de clôture)
  const autoReviewRef = useRef(false);
  useEffect(() => {
    if (route?.params?.scrollToReviewForm && reviewEligible && !autoReviewRef.current) {
      autoReviewRef.current = true;
      setReviewOpen(true);
    }
  }, [route?.params?.scrollToReviewForm, reviewEligible]);

  // Annonces similaires (même catégorie, sinon même vendeur) — format carte, sans comptage
  const sellerId = String(product?.seller?.id || product?.seller?._id || product?.sellerId || '');
  const similarKey = product ? `${product.categorySlug || product.type || ''}|${sellerId}` : '';
  useEffect(() => {
    if (!similarKey) return undefined;
    let alive = true;
    (async () => {
      try {
        const card = { limit: 12, view: 'card', withTotal: '0' };
        const res = await apiClient.get('/products', {
          params: { ...card, ...(product.categorySlug ? { categorySlug: product.categorySlug } : { type: product.type }) },
        });
        let list = (res.data?.data || []).filter((it) => getProductId(it) !== productId);
        if (list.length < 3 && sellerId) {
          const more = await apiClient.get('/products', { params: { ...card, seller: sellerId } });
          const seen = new Set(list.map(getProductId));
          list = [...list, ...(more.data?.data || []).filter((it) => getProductId(it) !== productId && !seen.has(getProductId(it)))];
        }
        if (alive) setSimilar(list.slice(0, 10));
      } catch (e) {
        // section facultative
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [similarKey]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const showAlert = (type, title, message, buttons) =>
    setAlert({ visible: true, type, title, message, buttons: buttons || [{ text: 'OK', onPress: () => {} }] });

  const requireAuth = (pendingAction) => {
    navigation.navigate('QuickAuth', { pendingAction, returnScreen: 'ProductDetail', returnParams: { productId } });
  };

  const handleToggleFavorite = () => {
    if (!isValidProductId) return;
    if (!isAuthenticated) return requireAuth({ type: 'favorite', productId });
    tap();
    toggleSharedFavorite({ id: productId });
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({ message: `${product.title} — ${formatPrice(product.price)}\n${getCityName(product.location)} · Voir sur TakTak` });
    } catch (e) {
      // partage annulé
    }
  };

  const currentUserId = String(user?.id || user?._id || '');
  const isOwnListing = Boolean(isAuthenticated && sellerId && currentUserId && sellerId === currentUserId);

  // Signaler l'annonce : connexion requise (un signalement par personne et par annonce)
  const openReport = () => {
    if (!isValidProductId) return;
    if (!isAuthenticated) return requireAuth({ type: 'report', productId });
    setReportReason('');
    setReportDetails('');
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!reportReason || sendingReport) return;
    setSendingReport(true);
    try {
      const res = await reportProduct(productId, reportReason, reportDetails.trim());
      setReportOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('success', 'Signalement envoyé', res?.message || 'Merci ! Notre équipe va examiner cette annonce.');
    } catch (e) {
      showAlert('error', 'Signalement', e.message);
    } finally {
      setSendingReport(false);
    }
  };

  // Contact uniquement via la messagerie de l'app (pas de WhatsApp ni d'appel direct)
  const handleMessage = () => {
    if (!isValidProductId || !sellerId) return;
    if (!isAuthenticated) return requireAuth({ type: 'message', sellerId, productId });
    if (isOwnListing) {
      return showAlert('warning', 'Annonce personnelle', 'Vous ne pouvez pas discuter avec vous-même : c\'est votre annonce.');
    }
    tap();
    navigation.navigate('MainTabs', {
      screen: 'Messages',
      params: { screen: 'MessagesList', params: { sellerId, productId } },
    });
  };

  const openSeller = () => {
    if (sellerId) navigation.navigate('SellerProfile', { sellerId });
  };

  const openReviewForm = () => {
    if (!isAuthenticated) return requireAuth({ type: 'review', productId });
    if (isOwnListing) return showAlert('warning', 'Action impossible', 'Vous ne pouvez pas évaluer votre propre annonce.');
    setReviewOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewRating || !reviewComment.trim()) {
      return showAlert('warning', 'Avis incomplet', 'Choisissez une note et écrivez un commentaire.');
    }
    try {
      setSubmittingReview(true);
      await createReview({ productId, rating: reviewRating, comment: reviewComment.trim() });
      setReviewOpen(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewEligible(false);
      await Promise.all([fetchReviews(), fetchProduct()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('success', 'Merci !', 'Votre avis a été publié.');
    } catch (error) {
      showAlert('error', 'Erreur', error?.message || 'Impossible de publier votre avis.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMarkHelpful = async (reviewId) => {
    tap();
    // Mise à jour immédiate, puis synchronisation
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, helpful: (r.helpful || 0) + 1, _voted: true } : r)));
    try {
      await markReviewHelpful(reviewId);
    } catch (error) {
      fetchReviews();
    }
  };

  const handleOwnerEdit = () => {
    navigation.navigate('MainTabs', { screen: 'Publish', params: { editItem: product } });
  };

  const handleOwnerToggleStatus = async () => {
    if (!productId || ownerActionLoading) return;
    try {
      setOwnerActionLoading(true);
      const wasActive = product?.status === 'active';
      await toggleProductStatus(productId);
      if (wasActive) {
        showAlert('success', 'Annonce désactivée', 'Votre annonce n\'est plus visible. Vous allez revenir à l\'accueil.', [
          { text: 'Aller à l\'accueil', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) },
        ]);
      } else {
        await fetchProduct();
        showAlert('success', 'Annonce réactivée', 'Votre annonce est de nouveau visible.');
      }
    } catch (error) {
      showAlert('error', 'Erreur', error?.message || 'Impossible de changer le statut.');
    } finally {
      setOwnerActionLoading(false);
    }
  };

  // ─── Chargement (sans aperçu) ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: theme.screen }]}>
        <SkeletonGroup>
          <Bone width={width} height={HERO_H} radius={0} />
          <View style={{ padding: 20, gap: 12, marginTop: -24 }}>
            <Bone width={width - 40} height={150} radius={24} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Bone width={(width - 52) / 2} height={92} radius={18} />
              <Bone width={(width - 52) / 2} height={92} radius={18} />
            </View>
            <Bone width={width - 40} height={84} radius={20} />
          </View>
        </SkeletonGroup>
        <Pressable onPress={() => navigation.goBack()} style={[s.loadingBack, { top: insets.top + 8 }]} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // ─── Introuvable ─────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <View style={[s.screen, s.center, { backgroundColor: theme.screen, padding: 32 }]}>
        <View style={[s.notFoundIcon, { backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.orange50 }]}>
          <Feather name="search" size={30} color={P.terra} />
        </View>
        <Text style={[s.notFoundTitle, { color: theme.text }]}>Annonce introuvable</Text>
        <Text style={[s.notFoundSub, { color: theme.textMuted }]}>Elle a peut-être été vendue, retirée ou supprimée.</Text>
        <PressableScale onPress={() => navigation.goBack()} style={[s.notFoundBtn, { backgroundColor: P.terra }]}>
          <Feather name="arrow-left" size={16} color="#fff" />
          <Text style={s.notFoundBtnTxt}>Retour</Text>
        </PressableScale>
      </View>
    );
  }

  // ─── Données dérivées ────────────────────────────────────────────────────────
  const images = (product.images?.filter(Boolean).length ? product.images : [product.mainImage]).filter(Boolean);
  const seller = product.seller || null;
  const condition = !isService ? CONDITIONS[product.condition] : null;
  const categoryName = product.category?.name || (typeof product.category === 'string' && product.category !== 'Catégorie non disponible' ? product.category : '');
  const description = String(product.description || '').trim();
  const descIsLong = description.length > 260 || description.split('\n').length > 5;
  const specs = Object.entries(product.specifications || {}).filter(([k, v]) => k && v);
  const days = Array.isArray(product.availability?.days) ? product.availability.days.filter(Boolean) : [];
  const hours = product.availability?.openingTime
    ? `${product.availability.openingTime}${product.availability.closingTime ? ` – ${product.availability.closingTime}` : ''}`
    : '';
  const serviceArea = Array.isArray(product.serviceArea) ? product.serviceArea.filter(Boolean) : [];
  const delivery = product.delivery || {};
  const deliveryAreas = Array.isArray(delivery.areas) ? delivery.areas.filter(Boolean) : [];
  const rating = Number(product.rating || 0);
  const totalReviews = Number(product.totalReviews || 0);
  const statusBanner = product.status && product.status !== 'active' ? STATUS_BANNERS[product.status] : null;
  // Un vrai montant (ni « Gratuit » ni « Prix à discuter »)
  const hasPrice = Number(String(product.price ?? '').replace(/[^\d]/g, '')) > 0;

  const tiles = (isService ? [
    categoryName && { icon: 'grid', label: 'Catégorie', value: product.subcategory ? `${categoryName} · ${product.subcategory}` : categoryName },
    { icon: 'map-pin', label: 'Zone', value: serviceArea.length ? serviceArea.join(', ') : getCityName(product.location) },
    hours && { icon: 'clock', label: 'Horaires', value: hours },
    { icon: 'calendar', label: 'Publié', value: sinceLabel(product.createdAt) },
  ] : [
    condition && { icon: condition.icon, label: 'État', value: condition.label },
    categoryName && { icon: 'grid', label: 'Catégorie', value: product.subcategory ? `${categoryName} · ${product.subcategory}` : categoryName },
    { icon: 'truck', label: 'Livraison', value: delivery.available ? (delivery.cost ? formatPrice(delivery.cost) : 'Disponible') : 'Main propre' },
    { icon: 'calendar', label: 'Publié', value: sinceLabel(product.createdAt) },
  ]).filter(Boolean);

  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>
      {/* Icônes de la barre d'état lisibles sur la photo (iOS ; Android garde sa barre colorée) */}
      {Platform.OS === 'ios' ? (
        <StatusBar barStyle={solidHeader ? (isDark ? 'light-content' : 'dark-content') : 'light-content'} animated />
      ) : null}

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        <ImageGallery
          images={images}
          height={HERO_H}
          scrollY={scrollY}
          fallbackIcon={isService ? 'tool' : 'package'}
          fallbackColor={isDark ? theme.iconMuted : P.orange300}
          fallbackBg={isDark ? theme.surfaceAlt : P.orange50}
        />

        <Animated.View style={[s.body, { backgroundColor: theme.screen }, enterStyle]}>
          {/* ── En-tête de l'annonce ───────────────────────────────────────── */}
          <Card theme={theme} style={s.headCard}>
            <View style={s.badges}>
              <View style={[s.badge, { backgroundColor: isService ? P.blue600 : P.terra }]}>
                <Feather name={isService ? 'tool' : 'package'} size={11} color="#fff" />
                <Text style={s.badgeTxtOn}>{isService ? 'Service' : 'Produit'}</Text>
              </View>
              {condition ? (
                <View style={[s.badge, { backgroundColor: softBg }]}>
                  <Text style={[s.badgeTxt, { color: accent }]}>{condition.label}</Text>
                </View>
              ) : null}
              {product.promoted || product.featured ? (
                <View style={[s.badge, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : P.amberSoft }]}>
                  <Feather name="zap" size={11} color={P.gold} />
                  <Text style={[s.badgeTxt, { color: isDark ? P.gold : P.amberDark }]}>À la une</Text>
                </View>
              ) : null}
            </View>

            <Text style={[s.title, { color: theme.text }]}>{product.title}</Text>

            <View style={s.priceRow}>
              <Text style={[s.price, { color: hasPrice ? accent : theme.textMuted }]}>{formatPrice(product.price)}</Text>
              {isService && hasPrice ? <Text style={[s.priceHint, { color: theme.textSoft }]}>à partir de</Text> : null}
            </View>

            <View style={[s.metaRow, { borderTopColor: theme.border }]}>
              <View style={s.meta}>
                <Feather name="map-pin" size={13} color={accent} />
                <Text style={[s.metaTxt, { color: theme.textMuted }]} numberOfLines={1}>{getCityName(product.location)}</Text>
              </View>
              <View style={s.meta}>
                <Feather name="clock" size={13} color={theme.textSoft} />
                <Text style={[s.metaTxt, { color: theme.textMuted }]}>{sinceLabel(product.createdAt)}</Text>
              </View>
              <View style={s.meta}>
                <Feather name="eye" size={13} color={theme.textSoft} />
                <Text style={[s.metaTxt, { color: theme.textMuted }]}>{formatCompact(product.views || 0)} vues</Text>
              </View>
            </View>
          </Card>

          {/* Annonce non visible (le propriétaire est seul à la voir) */}
          {statusBanner ? (
            <View style={[s.banner, { backgroundColor: isDark ? 'rgba(245,158,11,0.14)' : P.amberSoft }]}>
              <Feather name={statusBanner.icon} size={16} color={isDark ? P.gold : P.amberDark} />
              <Text style={[s.bannerTxt, { color: isDark ? P.gold : P.amberDark }]}>{statusBanner.text}</Text>
            </View>
          ) : null}

          {/* ── Infos clés ─────────────────────────────────────────────────── */}
          <View style={s.tiles}>
            {tiles.map((t) => (
              <InfoTile key={t.label} {...t} accent={accent} softBg={softBg} theme={theme} />
            ))}
          </View>

          {/* ── Vendeur ────────────────────────────────────────────────────── */}
          {seller ? (
            <PressableScale onPress={openSeller} scaleTo={0.98} accessibilityLabel={`Voir le profil de ${seller.businessName || seller.name}`}>
              <Card theme={theme} style={s.sellerCard}>
                <View>
                  <Avatar uri={seller.avatar} name={seller.businessName || seller.name} size={54} colors={gradient} />
                  {seller.verified ? (
                    <View style={[s.verified, { borderColor: theme.surface }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.sellerName, { color: theme.text }]} numberOfLines={1}>{seller.businessName || seller.name}</Text>
                  {/* Note du vendeur : absente de l'aperçu, affichée dès que le détail arrive */}
                  {seller.rating != null ? (
                    <View style={s.sellerLine}>
                      <Ionicons name="star" size={12} color={P.gold} />
                      <Text style={[s.sellerMeta, { color: theme.text }]}>{Number(seller.rating || 0).toFixed(1)}</Text>
                      <Text style={[s.sellerMeta, { color: theme.textSoft }]}>({seller.totalReviews || 0} avis)</Text>
                      {seller.totalListings ? (
                        <Text style={[s.sellerMeta, { color: theme.textSoft }]}>· {seller.totalListings} annonce{seller.totalListings > 1 ? 's' : ''}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={[s.sellerMeta, { color: theme.textSoft }]} numberOfLines={1}>
                    {seller.memberSince && seller.memberSince !== 'Récemment' ? `Membre depuis ${seller.memberSince}` : 'Membre TakTak'}
                    {seller.location ? ` · ${getCityName(seller.location)}` : ''}
                  </Text>
                </View>
                <View style={[s.chevron, { backgroundColor: softBg }]}>
                  <Feather name="chevron-right" size={18} color={accent} />
                </View>
              </Card>
            </PressableScale>
          ) : null}

          {/* ── Description ────────────────────────────────────────────────── */}
          {description ? (
            <Card theme={theme}>
              <SectionTitle icon="align-left" title="Description" accent={accent} theme={theme} />
              <Text style={[s.desc, { color: theme.textMuted }]} numberOfLines={descExpanded || !descIsLong ? undefined : 6}>
                {description}
              </Text>
              {descIsLong ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8} style={s.more}>
                  <Text style={[s.moreTxt, { color: accent }]}>{descExpanded ? 'Réduire' : 'Lire la suite'}</Text>
                  <Feather name={descExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={accent} />
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          {/* ── Caractéristiques ───────────────────────────────────────────── */}
          {specs.length > 0 ? (
            <Card theme={theme}>
              <SectionTitle icon="list" title="Caractéristiques" accent={accent} theme={theme} />
              {specs.map(([label, value], i) => (
                <View key={label} style={[s.specRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <Text style={[s.specLabel, { color: theme.textSoft }]}>{label}</Text>
                  <Text style={[s.specValue, { color: theme.text }]}>{String(value)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* ── Livraison (produit) ────────────────────────────────────────── */}
          {!isService && delivery.available ? (
            <Card theme={theme}>
              <SectionTitle icon="truck" title="Livraison" accent={accent} theme={theme} />
              <Text style={[s.desc, { color: theme.textMuted }]}>
                {delivery.cost ? `Livraison possible pour ${formatPrice(delivery.cost)}.` : 'Livraison possible — à convenir avec le vendeur.'}
                {delivery.estimatedTime ? ` Délai : ${delivery.estimatedTime}.` : ''}
              </Text>
              {deliveryAreas.length ? (
                <View style={s.chips}>
                  {deliveryAreas.map((area) => (
                    <View key={area} style={[s.chip, { backgroundColor: softBg }]}>
                      <Text style={[s.chipTxt, { color: accent }]}>{area}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Disponibilité (service) ────────────────────────────────────── */}
          {isService && (days.length || hours) ? (
            <Card theme={theme}>
              <SectionTitle icon="calendar" title="Disponibilité" accent={accent} theme={theme} />
              {days.length ? (
                <View style={s.chips}>
                  {days.map((day) => (
                    <View key={day} style={[s.chip, { backgroundColor: softBg }]}>
                      <Text style={[s.chipTxt, { color: accent }]}>{day}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {hours ? (
                <View style={[s.hoursRow, { marginTop: days.length ? 12 : 0 }]}>
                  <Feather name="clock" size={15} color={accent} />
                  <Text style={[s.hoursTxt, { color: theme.text }]}>{hours}</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* ── Sécurité ───────────────────────────────────────────────────── */}
          <View style={[s.safety, { backgroundColor: isDark ? 'rgba(34,197,94,0.10)' : '#F0FDF4', borderColor: isDark ? 'rgba(34,197,94,0.25)' : '#BBF7D0' }]}>
            <View style={s.safetyHead}>
              <Feather name="shield" size={17} color={P.greenDark} />
              <Text style={[s.safetyTitle, { color: theme.text }]}>{isService ? 'Réservez en toute confiance' : 'Achetez en toute sécurité'}</Text>
            </View>
            {(isService ? [
              'Convenez du prix et du délai par écrit dans la messagerie',
              'Demandez des exemples de réalisations avant de vous engager',
              'Ne payez jamais l\'intégralité avant la prestation',
            ] : [
              'Rencontrez-vous dans un lieu public et fréquenté',
              'Vérifiez l\'article avant de payer',
              'Ne payez jamais à l\'avance',
            ]).map((tip) => (
              <View key={tip} style={s.safetyRow}>
                <Feather name="check" size={14} color={P.greenDark} />
                <Text style={[s.safetyTxt, { color: theme.textMuted }]}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* ── Signaler ───────────────────────────────────────────────────── */}
          {!isOwnListing ? (
            <Pressable onPress={openReport} style={({ pressed }) => [s.reportBtn, { borderColor: theme.border }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
              <Ionicons name="flag-outline" size={16} color={theme.textMuted} />
              <Text style={[s.reportTxt, { color: theme.textMuted }]}>Signaler cette annonce</Text>
            </Pressable>
          ) : null}

          {/* ── Avis ───────────────────────────────────────────────────────── */}
          <Card theme={theme}>
            <SectionTitle
              icon="message-square"
              title="Avis"
              accent={accent}
              theme={theme}
              right={totalReviews ? <Text style={[s.secCount, { color: theme.textSoft }]}>{totalReviews}</Text> : null}
            />

            <View style={[s.ratingBox, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={[s.ratingBig, { color: theme.text }]}>{rating.toFixed(1)}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Stars value={rating} size={16} />
                <Text style={[s.ratingSub, { color: theme.textSoft }]}>
                  {totalReviews ? `${totalReviews} avis vérifié${totalReviews > 1 ? 's' : ''}` : 'Pas encore d\'avis'}
                </Text>
              </View>
              {reviewEligible ? (
                <PressableScale onPress={openReviewForm} style={[s.writeBtn, { backgroundColor: accent }]}>
                  <Feather name="edit-3" size={14} color="#fff" />
                  <Text style={s.writeBtnTxt}>Noter</Text>
                </PressableScale>
              ) : null}
            </View>

            {loadingReviews && reviews.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 16 }} color={accent} />
            ) : reviews.length ? (
              reviews.slice(0, 5).map((review, i) => (
                <View key={review.id} style={[s.review, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <View style={s.reviewHead}>
                    <Avatar uri={review.userAvatar} name={review.userName} size={36} colors={[P.orange400, P.orange600]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.reviewName, { color: theme.text }]} numberOfLines={1}>{review.userName}</Text>
                      <Text style={[s.reviewDate, { color: theme.textSoft }]}>{relativeDate(review.date)}</Text>
                    </View>
                    <Stars value={review.rating} size={12} gap={1} />
                  </View>
                  {review.comment ? (
                    <Text style={[s.reviewTxt, { color: theme.textMuted }]}>{review.comment}</Text>
                  ) : null}
                  <Pressable
                    onPress={() => !review._voted && handleMarkHelpful(review.id)}
                    disabled={review._voted}
                    hitSlop={6}
                    style={[s.helpful, { borderColor: review._voted ? accent : theme.border }]}
                  >
                    <Feather name="thumbs-up" size={12} color={review._voted ? accent : theme.textSoft} />
                    <Text style={[s.helpfulTxt, { color: review._voted ? accent : theme.textSoft }]}>
                      Utile{review.helpful ? ` · ${review.helpful}` : ''}
                    </Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={[s.emptyReviews, { color: theme.textSoft }]}>
                Les avis apparaissent après une affaire conclue via la messagerie TakTak.
              </Text>
            )}
          </Card>

          {/* ── Annonces similaires ────────────────────────────────────────── */}
          {similar.length ? (
            <View style={{ marginTop: 6 }}>
              <View style={[s.secHead, { paddingHorizontal: 4 }]}>
                <View style={[s.secIcon, { backgroundColor: `${accent}1F` }]}>
                  <Feather name="layers" size={15} color={accent} />
                </View>
                <Text style={[s.secTitle, { color: theme.text }]}>Annonces similaires</Text>
              </View>
              <FlatList
                data={similar}
                horizontal
                keyExtractor={getProductId}
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                renderItem={({ item }) => (
                  <ProductCard
                    item={item}
                    width={156}
                    imageHeight={150}
                    isFavorite={favorites.has(getProductId(item))}
                    onPress={() => navigation.push('ProductDetail', { productId: getProductId(item), preview: item })}
                    onToggleFavorite={() => (isAuthenticated ? toggleSharedFavorite(item) : requireAuth({ type: 'favorite', productId: getProductId(item) }))}
                  />
                )}
              />
            </View>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      {/* ══ En-tête flottant ═══════════════════════════════════════════════════ */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, opacity: solid }]}
        />
        <HeaderButton
          label="Retour"
          solid={solid}
          theme={theme}
          onPress={() => navigation.goBack()}
          renderIcon={(color) => <Feather name="arrow-left" size={20} color={color} />}
        />
        <Animated.Text style={[s.hTitle, { color: theme.text, opacity: solid }]} numberOfLines={1}>{product.title}</Animated.Text>
        <HeaderButton
          label="Partager"
          solid={solid}
          theme={theme}
          onPress={handleShare}
          renderIcon={(color) => <Feather name="share-2" size={18} color={color} />}
        />
        {!isOwnListing ? (
          <HeaderButton
            label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            solid={solid}
            theme={theme}
            onPress={handleToggleFavorite}
            renderIcon={(color) => <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? P.terra : color} />}
          />
        ) : null}
      </View>

      {/* ══ Barre d'action ═════════════════════════════════════════════════════ */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {isOwnListing ? (
          <>
            <PressableScale onPress={handleOwnerEdit} style={[s.ghostBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]} accessibilityLabel="Modifier l'annonce">
              <Feather name="edit-2" size={16} color={theme.text} />
              <Text style={[s.ghostBtnTxt, { color: theme.text }]}>Modifier</Text>
            </PressableScale>
            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={handleOwnerToggleStatus}
                disabled={ownerActionLoading || product.status === 'sold'}
                style={[s.mainBtn, { backgroundColor: product.status === 'active' ? P.errorDark : P.greenDark, opacity: product.status === 'sold' ? 0.5 : 1 }]}
              >
                {ownerActionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name={product.status === 'active' ? 'eye-off' : 'eye'} size={16} color="#fff" />
                    <Text style={s.mainBtnTxt}>{product.status === 'active' ? 'Désactiver' : 'Réactiver'}</Text>
                  </>
                )}
              </PressableScale>
            </View>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[s.footerPrice, { color: hasPrice ? theme.text : theme.textMuted }]} numberOfLines={1}>{formatPrice(product.price)}</Text>
              <Text style={[s.footerSub, { color: theme.textSoft }]} numberOfLines={1}>
                {seller ? `par ${seller.businessName || seller.name}` : getCityName(product.location)}
              </Text>
            </View>
            <PressableScale onPress={handleMessage} accessibilityLabel="Contacter l'annonceur par message">
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.mainBtn}>
                <Feather name="message-circle" size={18} color="#fff" />
                <Text style={s.mainBtnTxt}>{isService ? 'Demander un devis' : 'Contacter'}</Text>
              </LinearGradient>
            </PressableScale>
          </>
        )}
      </View>

      {/* ══ Formulaire d'avis (panneau natif, clavier géré) ═══════════════════ */}
      <Sheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Votre avis"
        footer={(
          <PressableScale onPress={handleSubmitReview} disabled={submittingReview || !reviewRating || !reviewComment.trim()}>
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.mainBtn, { opacity: !reviewRating || !reviewComment.trim() ? 0.5 : 1 }]}
            >
              {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={s.mainBtnTxt}>Publier mon avis</Text>}
            </LinearGradient>
          </PressableScale>
        )}
      >
        <Text style={[s.sheetSub, { color: theme.textMuted }]}>
          Comment s'est passée votre expérience avec {seller?.businessName || seller?.name || 'cet annonceur'} ?
        </Text>
        <View style={s.pickStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => { tap(); setReviewRating(n); }} hitSlop={6} accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`}>
              <Ionicons name={n <= reviewRating ? 'star' : 'star-outline'} size={38} color={n <= reviewRating ? P.gold : theme.iconMuted} />
            </Pressable>
          ))}
        </View>
        <Text style={[s.pickLabel, { color: reviewRating ? accent : theme.textSoft }]}>
          {reviewRating ? RATING_LABELS[reviewRating] : 'Touchez une étoile'}
        </Text>
        <SheetTextInput
          value={reviewComment}
          onChangeText={setReviewComment}
          placeholder="Qualité, ponctualité, communication…"
          placeholderTextColor={theme.inputPlaceholder}
          multiline
          maxLength={REVIEW_MAX}
          editable={!submittingReview}
          style={[s.reviewInput, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        />
        <Text style={[s.counter, { color: theme.textSoft }]}>{reviewComment.length}/{REVIEW_MAX}</Text>
      </Sheet>

      {/* ══ Signalement ═══════════════════════════════════════════════════════ */}
      <Sheet
        visible={reportOpen}
        onClose={() => { if (!sendingReport) setReportOpen(false); }}
        title="Signaler l'annonce"
        footer={(
          <PressableScale onPress={submitReport} disabled={!reportReason || sendingReport}>
            <View style={[s.mainBtn, { backgroundColor: P.error, opacity: !reportReason ? 0.5 : 1 }]}>
              {sendingReport ? <ActivityIndicator color="#fff" /> : <Text style={s.mainBtnTxt}>Envoyer le signalement</Text>}
            </View>
          </PressableScale>
        )}
      >
        <Text style={[s.sheetSub, { color: theme.textMuted }]}>
          Qu'est-ce qui ne va pas ? Votre signalement est anonyme pour l'annonceur.
        </Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {REPORT_REASONS.map((r) => {
            const active = reportReason === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => { tap(); setReportReason(r.value); }}
                style={[s.reasonRow, { borderColor: active ? P.error : theme.border, backgroundColor: active ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : theme.surfaceAlt }]}
              >
                <Ionicons name={r.icon} size={19} color={active ? P.error : theme.textMuted} />
                <Text style={[s.reasonTxt, { color: active ? P.error : theme.text }]}>{r.label}</Text>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={19} color={active ? P.error : theme.iconMuted} />
              </Pressable>
            );
          })}
        </View>
        <SheetTextInput
          value={reportDetails}
          onChangeText={setReportDetails}
          placeholder="Précisions (facultatif)"
          placeholderTextColor={theme.inputPlaceholder}
          multiline
          maxLength={500}
          editable={!sendingReport}
          style={[s.reviewInput, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border, marginTop: 14, minHeight: 80 }]}
        />
      </Sheet>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert((a) => ({ ...a, visible: false }))}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  // En-tête flottant
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8, zIndex: 10 },
  hBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hBtnBg: { borderRadius: 20 },
  hBtnIcon: { position: 'absolute' },
  hTitle: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center', marginHorizontal: 4 },
  loadingBack: { position: 'absolute', left: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.42)' },

  // Corps (chevauche la galerie)
  body: { marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16 },

  headCard: { padding: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 24, borderRadius: 12 },
  badgeTxtOn: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  badgeTxt: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6, lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  price: { fontSize: 27, fontWeight: '900', letterSpacing: -0.8 },
  priceHint: { fontSize: 12.5, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '50%' },
  metaTxt: { fontSize: 12.5, fontWeight: '600' },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16 },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '46%', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileLabel: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },

  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verified: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, backgroundColor: P.blue600, alignItems: 'center', justifyContent: 'center' },
  sellerName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sellerLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  sellerMeta: { fontSize: 12.5, fontWeight: '600' },
  chevron: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  secIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secTitle: { flex: 1, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  secCount: { fontSize: 14, fontWeight: '700' },

  desc: { fontSize: 15, lineHeight: 23 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  moreTxt: { fontSize: 14, fontWeight: '800' },

  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 11 },
  specLabel: { fontSize: 14, fontWeight: '600', flexShrink: 0, maxWidth: '45%' },
  specValue: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hoursTxt: { fontSize: 15, fontWeight: '800' },

  safety: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 16, height: 40, borderRadius: 20, borderWidth: 1 },
  reportTxt: { fontSize: 13.5, fontWeight: '700' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 50, borderRadius: 14, borderWidth: 1.5 },
  reasonTxt: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  safetyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  safetyTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  safetyTxt: { flex: 1, fontSize: 13.5, lineHeight: 19 },

  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 14 },
  ratingBig: { fontSize: 36, fontWeight: '900', letterSpacing: -1.2 },
  ratingSub: { fontSize: 12.5, fontWeight: '600' },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19 },
  writeBtnTxt: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  review: { paddingVertical: 14, gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewName: { fontSize: 14.5, fontWeight: '800' },
  reviewDate: { fontSize: 12, marginTop: 1 },
  reviewTxt: { fontSize: 14.5, lineHeight: 21 },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1 },
  helpfulTxt: { fontSize: 12, fontWeight: '700' },
  emptyReviews: { fontSize: 13.5, lineHeight: 19, marginTop: 12, textAlign: 'center' },

  // Barre d'action
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footerPrice: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  footerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  mainBtn: { height: 52, borderRadius: 16, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mainBtnTxt: { color: '#fff', fontSize: 15.5, fontWeight: '900', letterSpacing: -0.2 },
  ghostBtn: { height: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  ghostBtnTxt: { fontSize: 15, fontWeight: '800' },

  // Introuvable
  notFoundIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  notFoundTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  notFoundSub: { fontSize: 14.5, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 24 },
  notFoundBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, height: 48, borderRadius: 14 },
  notFoundBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Panneau d'avis
  sheetSub: { fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  pickStars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  pickLabel: { textAlign: 'center', fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 16 },
  reviewInput: { minHeight: 120, borderRadius: 16, borderWidth: 1, padding: 14, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontSize: 12, marginTop: 6 },
});
