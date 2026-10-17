// ─── Annonces d'une catégorie ────────────────────────────────────────────────
// Même moteur que la recherche (ProductBrowser) + sous-catégories en puces.

import React, { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import ProductBrowser from '../components/search/ProductBrowser';
import CategoryIcon from '../components/CategoryIcon';
import { getCategoryBySlug } from '../api/categories';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import { DEFAULT_FILTERS } from '../utils/searchFilters';

const LOCKED = { categorySlug: true };

function SubcategoryChips({ subcategories, parentSlug, value, onChange, accent }) {
  const { theme, isDark } = useAppTheme();
  if (!subcategories.length) return null;

  const options = [{ slug: '', name: 'Toutes' }, ...subcategories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
      {options.map((sub) => {
        const active = (value || '') === (sub.slug || '');
        return (
          <Pressable
            key={sub.slug || 'all'}
            onPress={() => onChange(sub.slug || '')}
            style={({ pressed }) => [
              s.chip,
              {
                backgroundColor: active ? accent : (isDark ? theme.surface : P.white),
                borderColor: active ? accent : theme.border,
              },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {sub.slug ? <CategoryIcon item={sub} parent={parentSlug} size={18} /> : null}
            <Text style={[s.chipTxt, { color: active ? P.white : theme.text }]} numberOfLines={1}>{sub.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function CategoryProductsScreen({ route, navigation }) {
  const { categorySlug, categoryName } = route.params || {};
  const [category, setCategory] = useState(null);

  useEffect(() => {
    let alive = true;
    getCategoryBySlug(categorySlug)
      .then((res) => { if (alive) setCategory(res?.data || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [categorySlug]);

  const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const total = Number(category?.totalCount ?? ((category?.productsCount || 0) + (category?.servicesCount || 0))) || 0;

  return (
    <ProductBrowser
      key={categorySlug}
      navigation={navigation}
      title={category?.name || categoryName || 'Catégorie'}
      icon={<CategoryIcon item={category || { slug: categorySlug }} size={28} />}
      subtitle={category?.description || (total ? `${total} annonce${total > 1 ? 's' : ''} dans cette catégorie` : undefined)}
      initialFilters={{ ...DEFAULT_FILTERS, categorySlug, categoryName: category?.name || categoryName }}
      locked={LOCKED}
      renderTop={({ filters, patchFilters, accent }) => (
        <SubcategoryChips
          subcategories={subcategories}
          parentSlug={categorySlug}
          value={filters.subcategory}
          onChange={(slug) => patchFilters({ subcategory: slug })}
          accent={accent}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipEmoji: { fontSize: 13 },
  chipTxt: { fontSize: 13, fontWeight: '700' },
});
