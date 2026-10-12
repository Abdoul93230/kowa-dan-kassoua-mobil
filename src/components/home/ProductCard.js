// Carte annonce — utilisée dans les carrousels et la grille de l'accueil
import React, { memo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';
import { formatPrice, getCityName, timeAgo, getProductImage } from '../../utils/format';

const CONDITION_LABEL = { new: 'Neuf', refurbished: 'Reconditionné' };

function FavoriteButton({ active, onPress }) {
  const pop = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 }).start();
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={s.favHit} accessibilityLabel={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
      <Animated.View style={[s.fav, active && s.favActive, { transform: [{ scale: pop }] }]}>
        <Feather name="heart" size={15} color={active ? P.white : P.charcoal} />
      </Animated.View>
    </Pressable>
  );
}

function ProductCard({ item, width, imageHeight, onPress, isFavorite, onToggleFavorite }) {
  const { theme, isDark } = useAppTheme();
  const isService = item?.type === 'service';
  const accent = isService ? P.blue600 : (isDark ? P.amber : P.terra);
  const image = getProductImage(item, width);
  const badge = isService ? 'Service' : CONDITION_LABEL[item?.condition];
  const imgH = imageHeight || Math.round(width * 1.02);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={item?.title}
      style={[
        s.card,
        { width, backgroundColor: theme.surface, borderColor: theme.border },
        !isDark && s.cardShadow,
      ]}
    >
      <View style={[s.imgWrap, { height: imgH, backgroundColor: isDark ? theme.surfaceAlt : P.orange50 }]}>
        {image ? (
          <Image source={{ uri: image }} style={s.img} contentFit="cover" transition={180} />
        ) : (
          <View style={s.imgFallback}>
            <Feather name={isService ? 'tool' : 'package'} size={28} color={isDark ? theme.iconMuted : P.orange300} />
          </View>
        )}

        {/* Dégradé bas pour la lisibilité des badges */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.28)']} style={s.imgShade} pointerEvents="none" />

        {badge ? (
          <View style={[s.badge, { backgroundColor: isService ? P.blue600 : 'rgba(17,24,39,0.78)' }]}>
            <Text style={s.badgeTxt}>{badge}</Text>
          </View>
        ) : null}

        {item?.promoted || item?.featured ? (
          <View style={s.boost}>
            <Feather name="zap" size={10} color={P.white} />
          </View>
        ) : null}

        {onToggleFavorite ? <FavoriteButton active={isFavorite} onPress={onToggleFavorite} /> : null}
      </View>

      <View style={s.body}>
        <Text style={[s.price, { color: accent }]} numberOfLines={1}>{formatPrice(item?.price)}</Text>
        <Text style={[s.title, { color: theme.text }]} numberOfLines={2}>{item?.title}</Text>
        <View style={s.meta}>
          <Feather name="map-pin" size={11} color={theme.textSoft} />
          <Text style={[s.metaTxt, { color: theme.textSoft }]} numberOfLines={1}>{getCityName(item?.location)}</Text>
          <View style={[s.dot, { backgroundColor: theme.textSoft }]} />
          <Text style={[s.metaTxt, { color: theme.textSoft, flexShrink: 0 }]}>{timeAgo(item?.createdAt)}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default memo(ProductCard, (a, b) =>
  a.item === b.item && a.width === b.width && a.isFavorite === b.isFavorite && a.imageHeight === b.imageHeight
);

const s = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cardShadow: { shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  imgWrap: { width: '100%', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  imgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 },
  badge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { color: P.white, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  boost: { position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: P.terra, alignItems: 'center', justifyContent: 'center' },
  favHit: { position: 'absolute', top: 8, right: 8 },
  fav: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  favActive: { backgroundColor: P.terra },
  body: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12 },
  price: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 },
  title: { fontSize: 13, lineHeight: 17.5, fontWeight: '500', marginTop: 3, minHeight: 35 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  metaTxt: { fontSize: 11.5, flexShrink: 1 },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2, opacity: 0.6 },
});
