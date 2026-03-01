// ─── ProductDetailScreen v2 — MarketHub Niger ────────────────────────────────
// Design luxury editorial : carousel immersif, animations staggerées,
// footer glassmorphism, header transparent → opaque au scroll

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, Share, Linking, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { apiClient } from '../api/auth';

const { width, height } = Dimensions.get('window');
const CAROUSEL_H = height * 0.48;

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
  dim:      'rgba(61,28,2,0.07)',
  white:    '#FFFFFF',
  green:    '#22C55E',
};

const getCityName = (loc) => loc ? loc.split(',')[0].trim() : 'Niger';
const getInitials = (name) => {
  if (!name) return '??';
  const p = name.split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
};

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-ANIMATIONS UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────
function useSpringPress(config = {}) {
  const scale = useRef(new Animated.Value(1)).current;
  return {
    scale,
    onPressIn:  () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 35, ...config }).start(),
    onPressOut: () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 35, ...config }).start(),
  };
}

function useStaggerEntrance(count, delay = 80) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(delay,
      anims.map(a => Animated.spring(a, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }))
    ).start();
  }, []);
  return anims;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL IMAGES — plein écran avec parallaxe léger
// ─────────────────────────────────────────────────────────────────────────────
function ImageCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  useEffect(() => {
    const listener = scrollX.addListener(({ value }) => {
      setIdx(Math.round(value / width));
    });
    return () => scrollX.removeListener(listener);
  }, []);

  return (
    <View style={s.carousel}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {images.map((img, i) => (
          <View key={i} style={s.slide}>
            <Image
              source={{ uri: img || 'https://via.placeholder.com/400x500/F5E6C8/C1440E?text=MarketHub' }}
              style={s.slideImg}
              resizeMode="cover"
            />
            {/* Vignette latérale pour la profondeur */}
            <LinearGradient
              colors={['rgba(26,18,16,0.18)', 'transparent', 'rgba(26,18,16,0.18)']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Gradient bas — dégradé vers la fiche */}
      <LinearGradient
        colors={['transparent', 'rgba(13,8,6,0.35)', 'rgba(26,18,16,0.85)']}
        style={s.carouselGrad}
      />

      {/* Compteur d'images */}
      <View style={s.imgCounter}>
        <Text style={s.imgCounterTxt}>{idx + 1} / {images.length}</Text>
      </View>

      {/* Indicateurs thin */}
      {images.length > 1 && (
        <View style={s.dotsRow}>
          {images.map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 22, 6],
              extrapolate: 'clamp',
            });
            const op = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View key={i} style={[s.dot, { width: w, opacity: op }]} />
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE TAG — typographie éditoriale
// ─────────────────────────────────────────────────────────────────────────────
function PriceTag({ price, anim }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  return (
    <Animated.View style={[s.priceTagWrap, { opacity: anim, transform: [{ translateY }] }]}>
      {price ? (
        <>
          <Text style={s.priceMeta}>Prix demandé</Text>
          <Text style={s.priceMain}>{parseInt(price).toLocaleString()}</Text>
          <Text style={s.priceCurrency}>FCFA</Text>
        </>
      ) : (
        <Text style={s.priceNego}>Prix à discuter</Text>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
function StatPill({ icon, value, anim }) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return (
    <Animated.View style={[s.pill, { opacity: anim, transform: [{ translateY: ty }] }]}>
      <Text style={s.pillIcon}>{icon}</Text>
      <Text style={s.pillVal}>{value}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDEUR CARD — premium
// ─────────────────────────────────────────────────────────────────────────────
function SellerCard({ seller, onPress, anim }) {
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.sellerCard, { opacity: anim, transform: [{ translateY: ty }, { scale }] }]}>

        {/* Avatar */}
        <View style={s.sellerAvatarWrap}>
          {seller.avatar
            ? <Image source={{ uri: seller.avatar }} style={s.sellerAvatarImg} />
            : (
              <LinearGradient colors={[P.terra, P.amber]} style={s.sellerAvatarGrad}>
                <Text style={s.sellerInitials}>{getInitials(seller.name)}</Text>
              </LinearGradient>
            )
          }
          {/* Online dot */}
          <View style={s.onlineDot} />
        </View>

        {/* Infos */}
        <View style={s.sellerMid}>
          <View style={s.sellerNameRow}>
            <Text style={s.sellerName} numberOfLines={1}>{seller.businessName || seller.name}</Text>
            {seller.businessType === 'professional' && (
              <View style={s.verifiedBadge}><Text style={s.verifiedTxt}>✓</Text></View>
            )}
          </View>
          <Text style={s.sellerLoc} numberOfLines={1}>📍 {getCityName(seller.location)}</Text>
          <View style={s.sellerRating}>
            <Text style={s.ratingStars}>{'★'.repeat(Math.round(seller.sellerStats?.rating || 0))}</Text>
            <Text style={s.ratingNum}>{seller.sellerStats?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={s.ratingCount}>({seller.sellerStats?.totalReviews || 0} avis)</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={s.sellerCta}>
          <Text style={s.sellerCtaTxt}>Profil →</Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC TABLE
// ─────────────────────────────────────────────────────────────────────────────
function SpecTable({ rows }) {
  return (
    <View style={s.specTable}>
      {rows.filter(Boolean).map((row, i) => row && (
        <View key={i} style={[s.specRow, i % 2 === 0 && s.specRowAlt]}>
          <Text style={s.specLabel}>{row.label}</Text>
          <Text style={s.specValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION WRAPPER animée
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, children, anim }) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[s.section, { opacity: anim, transform: [{ translateY: ty }] }]}>
      <View style={s.sectionHeadRow}>
        <View style={s.sectionBar} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON CONTACT
// ─────────────────────────────────────────────────────────────────────────────
function ContactBtn({ icon, label, onPress, variant = 'ghost' }) {
  const { scale, onPressIn, onPressOut } = useSpringPress({ speed: 40 });

  const isMain    = variant === 'main';
  const isGhost   = variant === 'ghost';
  const isWhatsApp= variant === 'whatsapp';

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[
        s.cBtn,
        isMain     && s.cBtnMain,
        isGhost    && s.cBtnGhost,
        isWhatsApp && s.cBtnWA,
        { transform: [{ scale }] },
      ]}>
        {isMain ? (
          <LinearGradient colors={[P.terra, P.amber]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cBtnGrad}>
            <Text style={s.cBtnIconMain}>{icon}</Text>
            <Text style={s.cBtnLabelMain}>{label}</Text>
          </LinearGradient>
        ) : (
          <>
            <Text style={[s.cBtnIcon, isWhatsApp && { color: '#25D366' }]}>{icon}</Text>
            <Text style={[s.cBtnLabel, isWhatsApp && { color: '#25D366' }]}>{label}</Text>
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
  const { productId } = route.params;

  const [product,    setProduct]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Scroll pour header transparent → opaque
  const scrollY = useRef(new Animated.Value(0)).current;

  // Opacité header : transparent jusqu'à 120px, puis opaque
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [CAROUSEL_H - 120, CAROUSEL_H - 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Animations staggerées pour les sections
  const [ready, setReady] = useState(false);
  const enters = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(90,
      enters.map(a => Animated.spring(a, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }))
    ).start();
  }, []);

  const fetchProduct = async () => {
    try {
      const res = await apiClient.get(`/products/${productId}`);
      setProduct(res.data.data || res.data);
    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      setTimeout(() => { setReady(true); runEntrance(); }, 80);
    }
  };

  useEffect(() => { fetchProduct(); }, [productId]);

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
    if (type === 'message')
      navigation.navigate('Messages', { sellerId: seller.id });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient colors={[P.terra, P.amber, P.gold]} style={s.loadScreen}>
        <View style={s.loadLogoBox}><Text style={s.loadLogoTxt}>M</Text></View>
        <Text style={s.loadBrand}>MarketHub</Text>
        <Text style={s.loadSub}>Chargement de l'annonce…</Text>
        <ActivityIndicator size="large" color={P.cream} style={{ marginTop: 36 }} />
      </LinearGradient>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <View style={s.notFound}>
        <Text style={{ fontSize: 72 }}>😕</Text>
        <Text style={s.notFoundTitle}>Annonce introuvable</Text>
        <Text style={s.notFoundSub}>Cette annonce a peut-être été supprimée ou retirée.</Text>
        <TouchableOpacity style={s.notFoundBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={s.notFoundBtnTxt}>← Retourner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isService = product.type === 'service';
  const images = product.images?.filter(Boolean).length > 0 ? product.images : [product.mainImage].filter(Boolean);
  if (!images.length) images.push(null);

  const specRows = [
    { label: 'Type',        value: isService ? 'Service' : 'Produit' },
    product.condition && {
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
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ══ HEADER FLOTTANT ═══════════════════════════════════════════════ */}
      <Animated.View
        style={[s.header, { paddingTop: (insets.top || 0) + 8 }]}
        pointerEvents="box-none"
      >
        {/* Fond qui apparaît au scroll */}
        <Animated.View style={[StyleSheet.absoluteFill, s.headerBg, { opacity: headerBgOpacity }]} />

        <TouchableOpacity style={s.hBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={s.hBtnTxt}>←</Text>
        </TouchableOpacity>

        <Animated.Text style={[s.hTitle, { opacity: headerBgOpacity }]} numberOfLines={1}>
          {product.title}
        </Animated.Text>

        <View style={s.hRight}>
          <TouchableOpacity style={s.hBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={s.hBtnTxt}>↗</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.hBtn, isFavorite && s.hBtnFav]}
            onPress={() => setIsFavorite(f => !f)}
            activeOpacity={0.85}
          >
            <Text style={[s.hBtnTxt, isFavorite && { color: P.terra }]}>
              {isFavorite ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ══ SCROLL PRINCIPAL ══════════════════════════════════════════════ */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 + Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >

        {/* ── CAROUSEL ────────────────────────────────────────────────── */}
        <ImageCarousel images={images} />

        {/* ── FICHE HERO (sur le carousel) ─────────────────────────────── */}
        <Animated.View style={[s.heroFiche, { opacity: enters[0], transform: [{ translateY: enters[0].interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>

          {/* Type badge */}
          <View style={[s.typeBadge, { backgroundColor: isService ? P.terra : P.amber }]}>
            <Text style={s.typeBadgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
          </View>

          {/* Titre */}
          <Text style={s.heroTitle}>{product.title}</Text>

          {/* Localisation */}
          <View style={s.heroLocRow}>
            <View style={s.heroLoc}>
              <Text style={s.heroLocIcon}>📍</Text>
              <Text style={s.heroLocTxt}>{getCityName(product.location)}</Text>
            </View>
            <Text style={s.heroDate}>Publié le {postDate}</Text>
          </View>

        </Animated.View>

        {/* ── PRIX ─────────────────────────────────────────────────────── */}
        <View style={s.priceSection}>
          <PriceTag price={product.price} anim={enters[1]} />

          {/* Stats pills */}
          <View style={s.pillsRow}>
            <StatPill icon="👁" value={`${product.views || 0} vues`}        anim={enters[1]} />
            <StatPill icon="♡" value={`${product.favorites || 0} favoris`} anim={enters[1]} />
            <StatPill icon="📅" value={postDate}                             anim={enters[1]} />
          </View>
        </View>

        {/* ── VENDEUR ──────────────────────────────────────────────────── */}
        {product.seller && (
          <Section title="Annonceur" anim={enters[2]}>
            <SellerCard
              seller={product.seller}
              anim={enters[2]}
              onPress={() => navigation.navigate('SellerProfile', { sellerId: product.seller.id })}
            />
          </Section>
        )}

        {/* ── DESCRIPTION ──────────────────────────────────────────────── */}
        <Section title="Description" anim={enters[3]}>
          <View style={s.descCard}>
            <Text style={s.descText}>{product.description}</Text>
          </View>
        </Section>

        {/* ── DÉTAILS ──────────────────────────────────────────────────── */}
        <Section title="Détails de l'annonce" anim={enters[4]}>
          <SpecTable rows={specRows} />
        </Section>

        {/* ── CARACTÉRISTIQUES ─────────────────────────────────────────── */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <Section title="Caractéristiques" anim={enters[5]}>
            <SpecTable
              rows={Object.entries(product.specifications).map(([k, v]) => ({ label: k, value: v }))}
            />
          </Section>
        )}

        {/* ── DISPONIBILITÉ (service) ───────────────────────────────────── */}
        {isService && product.availability && (
          <Section title="Disponibilité" anim={enters[6]}>
            <View style={s.availCard}>
              {product.availability.days?.length > 0 && (
                <View style={s.availRow}>
                  <Text style={s.availIcon}>📅</Text>
                  <Text style={s.availTxt}>{product.availability.days.join(' · ')}</Text>
                </View>
              )}
              {product.availability.openingTime && (
                <View style={s.availRow}>
                  <Text style={s.availIcon}>🕐</Text>
                  <Text style={s.availTxt}>{product.availability.openingTime} — {product.availability.closingTime}</Text>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* ── ACCORDS / RENDEZ-VOUS ─────────────────────────────────────── */}
        <Animated.View style={[s.meetupNote, { opacity: enters[7], transform: [{ translateY: enters[7].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <LinearGradient colors={[P.sand, P.cream]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.meetupGrad}>
            <Text style={s.meetupIcon}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.meetupTitle}>Mise en relation directe</Text>
              <Text style={s.meetupSub}>
                Contactez l'annonceur, convenez d'un lieu et d'un moment qui vous conviennent à tous les deux.
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

      </Animated.ScrollView>

      {/* ══ FOOTER CONTACT — glassmorphism ══════════════════════════════════ */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        {/* Gradient fondu */}
        <LinearGradient
          colors={['rgba(253,246,236,0)', 'rgba(253,246,236,0.97)', P.cream]}
          style={s.footerFade}
          pointerEvents="none"
        />

        {/* Boutons */}
        <View style={s.footerBtns}>
          {/* Ligne secondaire - Désactivée temporairement */}
          {/* <View style={s.footerRow}>
            <ContactBtn
              icon="📞"
              label="Appeler"
              variant="ghost"
              onPress={() => handleContact('call')}
            />
            <ContactBtn
              icon="💚"
              label="WhatsApp"
              variant="whatsapp"
              onPress={() => handleContact('whatsapp')}
            />
          </View> */}
          {/* CTA principal */}
          <ContactBtn
            icon="✉️"
            label="Envoyer un message"
            variant="main"
            onPress={() => handleContact('message')}
          />
        </View>
      </View>

    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: P.cream },

  // ── Loading ──────────────────────────────────────────────────────────────────
  loadScreen:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadLogoBox: { width: 76, height: 76, borderRadius: 24, backgroundColor: 'rgba(253,246,236,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(253,246,236,0.4)' },
  loadLogoTxt: { fontSize: 40, fontWeight: '900', color: P.cream },
  loadBrand:   { fontSize: 30, fontWeight: '900', color: P.cream, letterSpacing: -1 },
  loadSub:     { fontSize: 13, color: 'rgba(253,246,236,0.65)', marginTop: 6 },

  // ── Not found ─────────────────────────────────────────────────────────────
  notFound:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: P.cream },
  notFoundTitle: { fontSize: 24, fontWeight: '900', color: P.charcoal, marginTop: 16, marginBottom: 8, letterSpacing: -0.5 },
  notFoundSub:   { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  notFoundBtn:   { backgroundColor: P.terra, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  notFoundBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white },

  // ── Header flottant ───────────────────────────────────────────────────────
  header:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  headerBg: { backgroundColor: P.cream, borderBottomWidth: 1, borderBottomColor: P.dim },
  hBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(253,246,236,0.88)', justifyContent: 'center', alignItems: 'center', shadowColor: P.brown, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 5 },
  hBtnFav:  { backgroundColor: 'rgba(193,68,14,0.1)' },
  hBtnTxt:  { fontSize: 20, fontWeight: '700', color: P.brown },
  hTitle:   { flex: 1, fontSize: 15, fontWeight: '800', color: P.charcoal, letterSpacing: -0.2, textAlign: 'center' },
  hRight:   { flexDirection: 'row', gap: 8 },

  // ── Carousel ──────────────────────────────────────────────────────────────
  carousel:    { width, height: CAROUSEL_H, backgroundColor: P.sand },
  slide:       { width, height: CAROUSEL_H },
  slideImg:    { width: '100%', height: '100%' },
  carouselGrad:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: CAROUSEL_H * 0.5 },

  imgCounter: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(26,18,16,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  imgCounterTxt: { fontSize: 12, fontWeight: '700', color: P.white },

  dotsRow: { position: 'absolute', bottom: 72, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:     { height: 4, borderRadius: 2, backgroundColor: P.white },

  // ── Hero fiche (chevauchement carousel) ───────────────────────────────────
  heroFiche: {
    marginTop: -72,
    marginHorizontal: 18,
    backgroundColor: P.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: P.brown,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 10,
    zIndex: 5,
  },
  typeBadge:    { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginBottom: 12 },
  typeBadgeTxt: { fontSize: 12, fontWeight: '900', color: P.white },
  heroTitle:    { fontSize: 22, fontWeight: '900', color: P.charcoal, lineHeight: 30, marginBottom: 14, letterSpacing: -0.4 },
  heroLocRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLoc:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLocIcon:  { fontSize: 14 },
  heroLocTxt:   { fontSize: 13, fontWeight: '700', color: P.brown },
  heroDate:     { fontSize: 11, color: P.muted, fontWeight: '500' },

  // ── Prix ──────────────────────────────────────────────────────────────────
  priceSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  priceTagWrap: { marginBottom: 16 },
  priceMeta:    { fontSize: 10, fontWeight: '600', color: P.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  priceMain:    { fontSize: 28, fontWeight: '800', color: P.terra, letterSpacing: -1, lineHeight: 32 },
  priceCurrency:{ fontSize: 13, fontWeight: '600', color: P.muted, letterSpacing: 0.3, marginTop: -2 },
  priceNego:    { fontSize: 18, fontWeight: '700', color: P.muted, letterSpacing: -0.3 },
  pillsRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.cream, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: P.dim },
  pillIcon:     { fontSize: 14 },
  pillVal:      { fontSize: 12, fontWeight: '600', color: P.muted },

  // ── Section wrapper ───────────────────────────────────────────────────────
  section:       { paddingHorizontal: 20, paddingVertical: 22, borderTopWidth: 1, borderTopColor: P.dim },
  sectionHeadRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionBar:    { width: 4, height: 22, borderRadius: 2, backgroundColor: P.terra },
  sectionTitle:  { fontSize: 17, fontWeight: '900', color: P.charcoal, letterSpacing: -0.3 },

  // ── Vendeur ───────────────────────────────────────────────────────────────
  sellerCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: P.dim, shadowColor: P.brown, shadowOpacity: 0.09, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4, gap: 12 },
  sellerAvatarWrap:{ position: 'relative' },
  sellerAvatarImg: { width: 58, height: 58, borderRadius: 29 },
  sellerAvatarGrad:{ width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  sellerInitials:  { fontSize: 22, fontWeight: '800', color: P.white },
  onlineDot:       { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: P.green, borderWidth: 2, borderColor: P.white },
  sellerMid:       { flex: 1 },
  sellerNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sellerName:      { fontSize: 16, fontWeight: '800', color: P.charcoal },
  verifiedBadge:   { width: 18, height: 18, borderRadius: 9, backgroundColor: P.green, justifyContent: 'center', alignItems: 'center' },
  verifiedTxt:     { fontSize: 11, fontWeight: '900', color: P.white },
  sellerLoc:       { fontSize: 12, color: P.muted, marginBottom: 5 },
  sellerRating:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingStars:     { fontSize: 12, color: P.gold },
  ratingNum:       { fontSize: 13, fontWeight: '800', color: P.brown },
  ratingCount:     { fontSize: 11, color: P.muted },
  sellerCta:       { backgroundColor: P.terra, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sellerCtaTxt:    { fontSize: 12, fontWeight: '700', color: P.white },

  // ── Description ───────────────────────────────────────────────────────────
  descCard: { backgroundColor: P.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: P.dim },
  descText: { fontSize: 15, color: P.charcoal, lineHeight: 26 },

  // ── Spec table ────────────────────────────────────────────────────────────
  specTable:  { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: P.dim },
  specRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: P.dim, backgroundColor: P.white },
  specRowAlt: { backgroundColor: P.surface },
  specLabel:  { fontSize: 13, fontWeight: '600', color: P.muted, flex: 1 },
  specValue:  { fontSize: 13, fontWeight: '800', color: P.charcoal, textAlign: 'right', flex: 1.2 },

  // ── Disponibilité ─────────────────────────────────────────────────────────
  availCard: { backgroundColor: P.white, borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: P.dim },
  availRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availIcon: { fontSize: 20 },
  availTxt:  { fontSize: 14, fontWeight: '600', color: P.charcoal },

  // ── Note mise en relation ─────────────────────────────────────────────────
  meetupNote: { marginHorizontal: 20, marginTop: 8, marginBottom: 4, borderRadius: 18, overflow: 'hidden' },
  meetupGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14, borderWidth: 1, borderColor: 'rgba(193,68,14,0.12)', borderRadius: 18 },
  meetupIcon: { fontSize: 36 },
  meetupTitle:{ fontSize: 14, fontWeight: '800', color: P.brown, marginBottom: 4 },
  meetupSub:  { fontSize: 12, color: P.muted, lineHeight: 18 },

  // ── Footer contact ────────────────────────────────────────────────────────
  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerFade: { position: 'absolute', top: -40, left: 0, right: 0, height: 40 },
  footerBtns: { paddingHorizontal: 18, paddingTop: 10, gap: 10, backgroundColor: P.cream },
  footerRow:  { flexDirection: 'row', gap: 10 },

  // Contact buttons
  cBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 16, gap: 8 },
  cBtnGhost:  { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.dim },
  cBtnWA:     { backgroundColor: 'rgba(37,211,102,0.09)', borderWidth: 1.5, borderColor: 'rgba(37,211,102,0.25)' },
  cBtnMain:   { overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8 },
  cBtnGrad:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 16, gap: 8 },
  cBtnIcon:   { fontSize: 18, color: P.brown },
  cBtnLabel:  { fontSize: 14, fontWeight: '700', color: P.brown },
  cBtnIconMain: { fontSize: 20 },
  cBtnLabelMain:{ fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});