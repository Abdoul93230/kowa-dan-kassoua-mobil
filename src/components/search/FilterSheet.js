// ─── Panneau de filtres ───────────────────────────────────────────────────────
// Tri, type, ville (proximité), catégorie, état, prix — avec compteur de
// résultats en direct sur le bouton de validation.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet, { SheetTextInput } from '../BottomSheet';
import PressableScale from '../home/PressableScale';
import { categoryEmoji } from '../home/CategoryRail';
import { apiClient } from '../../api/auth';
import { useAppTheme } from '../../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../../theme/colors';
import {
  DEFAULT_FILTERS, SORT_OPTIONS, TYPE_OPTIONS, CONDITION_OPTIONS, PRICE_PRESETS, filtersToParams,
} from '../../utils/searchFilters';
import { doneAccessory } from '../Keyboard';

const COUNT_DEBOUNCE_MS = 350;

function Section({ title, children, right }) {
  const { theme } = useAppTheme();
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress, icon, emoji, accent }) {
  const { theme, isDark } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        { borderColor: active ? accent : theme.border, backgroundColor: active ? (isDark ? 'rgba(236,90,19,0.16)' : P.orange50) : theme.surface },
        active && accent === P.blue600 && { backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : P.blueSoft },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {emoji ? <Text style={s.chipEmoji}>{emoji}</Text> : null}
      {icon ? <Feather name={icon} size={13} color={active ? accent : theme.textMuted} /> : null}
      <Text style={[s.chipTxt, { color: active ? accent : theme.text }, active && { fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function FilterSheet({
  visible, onClose, onApply, initialFilters, query, locked = {}, categories = [], cities = [], homeCity,
}) {
  const { theme, isDark } = useAppTheme();
  const [draft, setDraft] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const requestId = useRef(0);

  const accent = draft.type === 'service' ? P.blue600 : (isDark ? P.amber : P.terra);
  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  // Repartir des filtres courants à chaque ouverture
  useEffect(() => {
    if (visible) setDraft({ ...DEFAULT_FILTERS, ...initialFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Compteur de résultats en direct (anti-rebond, la dernière requête l'emporte)
  useEffect(() => {
    if (!visible) return undefined;
    const id = ++requestId.current;
    setCounting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products', { params: { ...filtersToParams(draft, query), limit: 1, view: 'card' } });
        if (id === requestId.current) setCount(Number(res.data?.pagination?.total ?? 0));
      } catch (e) {
        if (id === requestId.current) setCount(null);
      } finally {
        if (id === requestId.current) setCounting(false);
      }
    }, COUNT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query, visible]);

  const reset = () => setDraft({
    ...DEFAULT_FILTERS,
    ...(locked.categorySlug ? { categorySlug: draft.categorySlug, categoryName: draft.categoryName } : {}),
    ...(locked.type ? { type: draft.type } : {}),
  });

  const cityOptions = [...new Set([homeCity, ...cities].filter(Boolean))];
  const applyLabel = counting
    ? null
    : count === null
      ? 'Afficher les résultats'
      : count === 0
        ? 'Aucun résultat'
        : `Afficher ${count} résultat${count > 1 ? 's' : ''}`;

  const footer = (
    <PressableScale
      onPress={() => { onApply(draft); onClose(); }}
      scaleTo={0.98}
      style={[s.apply, { backgroundColor: count === 0 ? theme.textSoft : (draft.type === 'service' ? P.blue600 : P.terra) }]}
      accessibilityLabel={applyLabel || 'Afficher les résultats'}
    >
      {counting ? <ActivityIndicator color={P.white} /> : <Text style={s.applyTxt}>{applyLabel}</Text>}
    </PressableScale>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} footer={footer}>
      <View style={s.head}>
        <Text style={[s.title, { color: theme.text }]}>Filtres</Text>
        <Pressable onPress={reset} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[s.reset, { color: accent }]}>Réinitialiser</Text>
        </Pressable>
      </View>

      {/* Le panneau défile lui-même : simple View ici */}
      <View style={s.body}>
        <Section title="Trier par">
          <View style={s.sortGrid}>
            {SORT_OPTIONS.map((opt) => {
              const active = draft.sort === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => set({ sort: opt.key })}
                  style={({ pressed }) => [
                    s.sortCard,
                    { borderColor: active ? accent : theme.border, backgroundColor: active ? (isDark ? 'rgba(236,90,19,0.12)' : P.orange50) : theme.surface },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name={opt.icon} size={16} color={active ? accent : theme.textMuted} />
                  <Text style={[s.sortTxt, { color: active ? accent : theme.text }, active && { fontWeight: '800' }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {!locked.type ? (
          <Section title="Type d'annonce">
            <View style={[s.segment, { backgroundColor: isDark ? theme.surfaceAlt : 'rgba(17,24,39,0.05)' }]}>
              {TYPE_OPTIONS.map((opt) => {
                const active = draft.type === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => set({ type: opt.key, ...(opt.key === 'service' ? { condition: '' } : {}) })}
                    style={[s.segBtn, active && { backgroundColor: opt.key === 'service' ? P.blue600 : P.terra }]}
                  >
                    <Text style={[s.segTxt, { color: active ? P.white : theme.textMuted }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        ) : null}

        <Section title="Où ?">
          <View style={s.wrap}>
            <Chip label="Partout au Niger" icon="globe" active={!draft.location} onPress={() => set({ location: '' })} accent={accent} />
            {cityOptions.map((city) => (
              <Chip
                key={city}
                label={city === homeCity ? `${city} · ma ville` : city}
                icon={city === homeCity ? 'navigation' : 'map-pin'}
                active={draft.location === city}
                onPress={() => set({ location: city })}
                accent={accent}
              />
            ))}
          </View>
        </Section>

        {!locked.categorySlug && categories.length > 0 ? (
          <Section title="Catégorie">
            <View style={s.wrap}>
              <Chip label="Toutes" active={!draft.categorySlug} onPress={() => set({ categorySlug: '', categoryName: '', subcategory: '' })} accent={accent} />
              {categories.map((cat) => (
                <Chip
                  key={cat._id || cat.slug}
                  label={cat.name}
                  emoji={categoryEmoji(cat)}
                  active={draft.categorySlug === cat.slug}
                  onPress={() => set({ categorySlug: cat.slug, categoryName: cat.name, subcategory: '' })}
                  accent={accent}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {draft.type !== 'service' ? (
          <Section title="État">
            <View style={s.wrap}>
              <Chip label="Tous" active={!draft.condition} onPress={() => set({ condition: '' })} accent={accent} />
              {CONDITION_OPTIONS.map((opt) => (
                <Chip key={opt.key} label={opt.label} active={draft.condition === opt.key} onPress={() => set({ condition: opt.key })} accent={accent} />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Prix (FCFA)">
          <View style={s.priceRow}>
            {[['minPrice', 'Minimum'], ['maxPrice', 'Maximum']].map(([key, label]) => (
              <View key={key} style={[s.priceBox, { borderColor: draft[key] ? accent : theme.border, backgroundColor: theme.surface }]}>
                <Text style={[s.priceLabel, { color: theme.textSoft }]}>{label}</Text>
                <SheetTextInput
                  value={draft[key] ? String(draft[key]).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''}
                  onChangeText={(v) => set({ [key]: v.replace(/[^\d]/g, '').slice(0, 10) })}
                  placeholder={key === 'minPrice' ? '0' : 'Illimité'}
                  placeholderTextColor={theme.textSoft}
                  {...doneAccessory} keyboardType="number-pad"
                  style={[s.priceInput, { color: theme.text }]}
                />
              </View>
            ))}
          </View>
          <View style={[s.wrap, { marginTop: 12 }]}>
            {PRICE_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                active={draft.minPrice === p.min && draft.maxPrice === p.max}
                onPress={() => set({ minPrice: p.min, maxPrice: p.max })}
                accent={accent}
              />
            ))}
          </View>
        </Section>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  reset: { fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortCard: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, borderRadius: 14, borderWidth: 1 },
  sortTxt: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segTxt: { fontSize: 13.5, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  chipEmoji: { fontSize: 14 },
  chipTxt: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceBox: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  priceLabel: { fontSize: 11, fontWeight: '700' },
  priceInput: { fontSize: 17, fontWeight: '800', paddingVertical: 4 },
  apply: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  applyTxt: { color: P.white, fontSize: 15.5, fontWeight: '800' },
});
