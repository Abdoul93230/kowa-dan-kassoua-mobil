// Vendeurs actifs façon "stories" — anneau orange pour les vendeurs actifs aujourd'hui
import React, { memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';
import { getInitials, sizedImage } from '../../utils/format';

function SellerStories({ sellers, onPressSeller }) {
  const { theme } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {sellers.map((seller) => {
        const name = seller.businessName || seller.name;
        return (
          <PressableScale key={String(seller._id || seller.id)} onPress={() => onPressSeller(seller)} scaleTo={0.92} style={s.item} accessibilityLabel={name}>
            <LinearGradient
              colors={seller.isOnline ? [P.amber, P.terra, P.orange700] : [theme.border, theme.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.ring}
            >
              <View style={[s.inner, { backgroundColor: theme.screen }]}>
                {seller.avatar ? (
                  <Image source={{ uri: sizedImage(seller.avatar, 72) }} style={s.avatar} />
                ) : (
                  <LinearGradient colors={[P.orange400, P.terra]} style={[s.avatar, s.initialsBox]}>
                    <Text style={s.initials}>{getInitials(name)}</Text>
                  </LinearGradient>
                )}
              </View>
            </LinearGradient>
            {seller.isOnline ? <View style={[s.live, { borderColor: theme.screen }]} /> : null}
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
            <View style={s.countRow}>
              <Feather name="tag" size={10} color={theme.textSoft} />
              <Text style={[s.count, { color: theme.textSoft }]}>{seller.productCount}</Text>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export default memo(SellerStories);

const s = StyleSheet.create({
  rail: { paddingHorizontal: 12 },
  item: { width: 78, alignItems: 'center', marginHorizontal: 4 },
  ring: { width: 68, height: 68, borderRadius: 34, padding: 2.5 },
  inner: { flex: 1, borderRadius: 32, padding: 2.5 },
  avatar: { flex: 1, borderRadius: 30 },
  initialsBox: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: P.white, fontSize: 18, fontWeight: '800' },
  live: { position: 'absolute', top: 52, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: P.green, borderWidth: 2.5 },
  name: { fontSize: 11.5, fontWeight: '600', marginTop: 7, maxWidth: 76 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  count: { fontSize: 10.5 },
});
