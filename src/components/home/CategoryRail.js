// Catégories — tuiles icône sur une ligne défilante
import React, { memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';

// Icônes Lucide (stockées côté backend) → emoji
const ICON_TO_EMOJI = {
  Smartphone: '📱', UtensilsCrossed: '🍔', Home: '🏠', Car: '🚗', Shirt: '👕',
  Wrench: '🔧', Laptop: '💻', Dumbbell: '🏋️', Baby: '👶', PawPrint: '🐾',
  Book: '📚', Palette: '🎨', Briefcase: '💼', Gamepad2: '🎮', HardHat: '⛑️',
  Package: '📦', MoreHorizontal: '✨',
};

const isEmoji = (v) => typeof v === 'string' && v.length > 0 && !/^[A-Za-z0-9]+$/.test(v);

export const categoryEmoji = (cat) =>
  (isEmoji(cat?.emoji) && cat.emoji) || (isEmoji(cat?.icon) && cat.icon) || ICON_TO_EMOJI[cat?.icon] || '📦';

function Tile({ cat, onPress, theme, isDark }) {
  const count = Number(cat.totalCount ?? ((cat.productsCount || 0) + (cat.servicesCount || 0))) || 0;
  return (
    <PressableScale onPress={onPress} scaleTo={0.92} style={s.tile} accessibilityLabel={cat.name}>
      <View style={[s.iconBox, { backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50, borderColor: isDark ? 'rgba(236,90,19,0.22)' : P.orange100 }]}>
        <Text style={s.emoji}>{categoryEmoji(cat)}</Text>
        {count > 0 ? (
          <View style={[s.count, { borderColor: theme.screen }]}>
            <Text style={s.countTxt}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.label, { color: theme.text }]} numberOfLines={1}>{cat.name}</Text>
    </PressableScale>
  );
}

function CategoryRail({ categories, onPressCategory, onPressAll }) {
  const { theme, isDark } = useAppTheme();
  // Une seule ligne défilante
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      <View style={s.col}>
        <PressableScale onPress={onPressAll} scaleTo={0.92} style={s.tile} accessibilityLabel="Toutes les catégories">
          <View style={[s.iconBox, s.allBox]}>
            <Feather name="grid" size={22} color={P.white} />
          </View>
          <Text style={[s.label, { color: theme.text, fontWeight: '700' }]}>Toutes</Text>
        </PressableScale>
      </View>
      {categories.map((cat) => (
        <View key={cat._id || cat.slug} style={s.col}>
          <Tile cat={cat} theme={theme} isDark={isDark} onPress={() => onPressCategory(cat)} />
        </View>
      ))}
    </ScrollView>
  );
}

export default memo(CategoryRail);

const s = StyleSheet.create({
  // paddingTop : laisse la place au badge compteur qui déborde au-dessus des tuiles
  rail: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 2 },
  col: { gap: 18, marginHorizontal: 4 },
  tile: { width: 70, alignItems: 'center' },
  iconBox: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  allBox: { backgroundColor: P.terra, borderColor: P.terra },
  emoji: { fontSize: 26 },
  label: { fontSize: 11.5, fontWeight: '600', marginTop: 7, textAlign: 'center' },
  count: { position: 'absolute', top: -7, right: -6, minWidth: 20, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: P.charcoal, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  countTxt: { color: P.white, fontSize: 9, fontWeight: '800' },
});
