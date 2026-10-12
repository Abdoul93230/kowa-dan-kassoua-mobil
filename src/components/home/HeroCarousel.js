// Carrousel "À la une" — défilement automatique, pause au toucher
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { MOBILE_COLORS as P } from '../../theme/colors';
import { formatPrice, getCityName, getProductImage, getProductId } from '../../utils/format';

const AUTOPLAY_MS = 4500;
const GAP = 12;

export default function HeroCarousel({ items, width, onPressItem }) {
  const cardW = width - 32;
  const step = cardW + GAP;
  const listRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const dragging = useRef(false);

  // Autoplay — s'arrête pendant que l'utilisateur fait défiler
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => {
      if (dragging.current) return;
      const next = (indexRef.current + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: next * step, animated: true });
      indexRef.current = next;
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [items.length, step]);

  const onMomentumEnd = useCallback((e) => {
    indexRef.current = Math.round(e.nativeEvent.contentOffset.x / step);
    dragging.current = false;
  }, [step]);

  const renderItem = useCallback(({ item }) => {
    const isService = item.type === 'service';
    const image = getProductImage(item, cardW);
    return (
      <PressableScale onPress={() => onPressItem(item)} scaleTo={0.98} style={[s.card, { width: cardW }]}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[P.orange500, P.orange800]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(11,18,32,0)', 'rgba(11,18,32,0.35)', 'rgba(11,18,32,0.92)']}
          locations={[0.25, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={s.topRow}>
          <View style={[s.pill, { backgroundColor: isService ? P.blue600 : P.terra }]}>
            <Feather name={item.promoted || item.featured ? 'zap' : 'trending-up'} size={11} color={P.white} />
            <Text style={s.pillTxt}>{item.promoted || item.featured ? 'À la une' : 'Populaire'}</Text>
          </View>
        </View>

        <View style={s.info}>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          <View style={s.bottomRow}>
            <Text style={s.price} numberOfLines={1}>{formatPrice(item.price)}</Text>
            <View style={s.loc}>
              <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={s.locTxt} numberOfLines={1}>{getCityName(item.location)}</Text>
            </View>
          </View>
        </View>
      </PressableScale>
    );
  }, [cardW, onPressItem]);

  if (!items.length) return null;

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => getProductId(it)}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      />

      {items.length > 1 ? (
        <View style={s.dots}>
          {items.map((it, i) => {
            const inputRange = [(i - 1) * step, i * step, (i + 1) * step];
            return (
              <Animated.View
                key={getProductId(it)}
                style={[
                  s.dot,
                  {
                    opacity: scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
                    transform: [{ scaleX: scrollX.interpolate({ inputRange, outputRange: [1, 3, 1], extrapolate: 'clamp' }) }],
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { height: 196, borderRadius: 24, overflow: 'hidden', backgroundColor: P.charcoal },
  topRow: { flexDirection: 'row', padding: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillTxt: { color: P.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  info: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  title: { color: P.white, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 10 },
  price: { color: P.amber, fontSize: 17, fontWeight: '900', flexShrink: 1 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, maxWidth: '45%' },
  locTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 11.5, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.terra },
});
