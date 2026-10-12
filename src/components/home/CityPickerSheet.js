// Feuille de sélection de ville (filtre de proximité de l'accueil)
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../BottomSheet';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';

export default function CityPickerSheet({ visible, cities, selected, onSelect, onClose }) {
  const { theme, isDark } = useAppTheme();
  const accent = isDark ? P.amber : P.terra;
  const options = [{ key: 'all', label: 'Tout le Niger', icon: 'globe' }, ...cities.map((c) => ({ key: c, label: c, icon: 'map-pin' }))];

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.75}>
      <View style={s.head}>
        <Text style={[s.title, { color: theme.text }]}>Où cherchez-vous ?</Text>
        <Text style={[s.sub, { color: theme.textSoft }]}>L'accueil et vos recherches afficheront d'abord cette ville</Text>
      </View>
      <View style={s.list}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={({ pressed }) => [
                s.row,
                { borderColor: active ? accent : theme.border, backgroundColor: active ? (isDark ? 'rgba(236,90,19,0.12)' : P.orange50) : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[s.rowIcon, { backgroundColor: active ? accent : theme.glass }]}>
                <Feather name={opt.icon} size={15} color={active ? P.white : theme.textMuted} />
              </View>
              <Text style={[s.rowTxt, { color: theme.text }, active && { fontWeight: '800' }]}>{opt.label}</Text>
              {active ? <Feather name="check" size={18} color={accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTxt: { flex: 1, fontSize: 15, fontWeight: '600' },
});
