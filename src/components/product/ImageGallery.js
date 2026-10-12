// ─── Galerie d'une annonce ───────────────────────────────────────────────────
// • pleine largeur, pagination par glissement, indicateurs animés (thread natif)
// • étirement quand on tire la page vers le bas + parallaxe au défilement
// • toucher une photo → visionneuse plein écran (zoom par pincement sur iOS)

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, Modal, FlatList, ScrollView, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizedImage } from '../../utils/format';

const MAX_DOTS = 8;

function FullscreenViewer({ images, startIndex, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait']}>
      <View style={s.viewer}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            // ScrollView zoomable : pincer pour zoomer (iOS)
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={s.viewerPage}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: sizedImage(item, width) }} style={{ width, height }} contentFit="contain" transition={150} />
            </ScrollView>
          )}
        />

        <View style={[s.viewerTop, { paddingTop: insets.top + 10 }]}>
          <View style={s.viewerCount}>
            <Text style={s.viewerCountTxt}>{index + 1} / {images.length}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={s.viewerClose} accessibilityLabel="Fermer la photo">
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ImageGallery({ images, height, scrollY, fallbackIcon = 'package', fallbackColor = '#9ca3af', fallbackBg }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState(null);
  const pageX = useRef(new Animated.Value(0)).current;
  const photos = images.filter(Boolean);

  // Tirer vers le bas : la photo s'agrandit en restant collée en haut ; défiler : parallaxe
  const heroMotion = scrollY ? {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-height, 0, height],
          outputRange: [-height / 2, 0, height * 0.35],
          extrapolateRight: 'clamp',
        }),
      },
      { scale: scrollY.interpolate({ inputRange: [-height, 0], outputRange: [2, 1], extrapolate: 'clamp' }) },
    ],
  } : null;

  const onPageScroll = Animated.event([{ nativeEvent: { contentOffset: { x: pageX } } }], { useNativeDriver: true });
  const onPageEnd = useCallback((e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width)), [width]);

  return (
    <View style={{ height, width }}>
      <Animated.View style={[{ height, width }, heroMotion]}>
        {photos.length === 0 ? (
          <View style={[s.fallback, { backgroundColor: fallbackBg }]}>
            <Feather name={fallbackIcon} size={56} color={fallbackColor} />
          </View>
        ) : (
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPageScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onPageEnd}
          >
            {photos.map((uri, i) => (
              <Pressable key={`${uri}-${i}`} onPress={() => setViewerIndex(i)} accessibilityLabel={`Agrandir la photo ${i + 1}`}>
                <Image
                  source={{ uri: sizedImage(uri, width) }}
                  style={{ width, height }}
                  contentFit="cover"
                  transition={200}
                  priority={i === 0 ? 'high' : 'normal'}
                />
              </Pressable>
            ))}
          </Animated.ScrollView>
        )}
      </Animated.View>

      {/* Ombres haut (lisibilité des boutons) et bas (transition vers le contenu) */}
      <LinearGradient colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)']} style={s.shadeTop} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']} style={s.shadeBottom} pointerEvents="none" />

      {photos.length > 1 ? (
        <>
          {photos.length <= MAX_DOTS ? (
            <View style={s.dots} pointerEvents="none">
              {photos.map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                return (
                  <Animated.View
                    key={i}
                    style={[s.dot, {
                      opacity: pageX.interpolate({ inputRange, outputRange: [0.45, 1, 0.45], extrapolate: 'clamp' }),
                      transform: [{ scaleX: pageX.interpolate({ inputRange, outputRange: [1, 2.6, 1], extrapolate: 'clamp' }) }],
                    }]}
                  />
                );
              })}
            </View>
          ) : null}
          <View style={s.counter} pointerEvents="none">
            <Feather name="camera" size={12} color="#fff" />
            <Text style={s.counterTxt}>{index + 1}/{photos.length}</Text>
          </View>
        </>
      ) : null}

      {viewerIndex !== null ? (
        <FullscreenViewer images={photos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  dots: { position: 'absolute', bottom: 44, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  counter: {
    position: 'absolute', right: 14, bottom: 40, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(17,24,39,0.6)',
  },
  counterTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  viewer: { flex: 1, backgroundColor: '#000' },
  viewerPage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  viewerCount: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  viewerCountTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  viewerClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
});
