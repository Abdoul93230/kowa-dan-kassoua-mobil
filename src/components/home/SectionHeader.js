import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';

export default function SectionHeader({ title, subtitle, onSeeAll, accent = P.terra, right, compact }) {
  const { theme, isDark } = useAppTheme();
  const linkColor = accent === P.terra && isDark ? P.amber : accent;

  return (
    <View style={[s.wrap, compact && { marginBottom: 6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[s.sub, { color: theme.textSoft }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={10} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }]}>
          <Text style={[s.linkTxt, { color: linkColor }]}>Tout voir</Text>
          <Feather name="chevron-right" size={16} color={linkColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 3 },
  link: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingVertical: 2 },
  linkTxt: { fontSize: 13, fontWeight: '700' },
});
