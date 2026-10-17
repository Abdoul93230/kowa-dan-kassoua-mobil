// ─── Icône de catégorie / sous-catégorie ─────────────────────────────────────
// Illustration 3D réaliste incluse dans l'app ; à défaut, l'emoji.
// L'icône est retrouvée dans cet ordre :
//   1. emoji enregistré en base (champ `icon`)
//   2. slug de la catégorie (ou 'categorie/sous-categorie')
//   3. ancien nom d'icône Lucide encore présent en base
import React, { memo } from 'react';
import { Text } from 'react-native';
import { Image } from 'expo-image';
import { CATEGORY_EMOJI_BY_SLUG, LUCIDE_TO_EMOJI, EMOJI_IMAGES } from '../utils/categoryIcons.data';

const isEmoji = (v) => typeof v === 'string' && v.length > 0 && !/^[A-Za-z0-9-]+$/.test(v);
const slugOf = (v) => (typeof v === 'object' && v ? v.slug : v) || '';

/**
 * @param item   catégorie ou sous-catégorie ({ slug, icon, emoji })
 * @param parent catégorie parente d'une sous-catégorie (objet ou slug)
 */
export function categoryEmoji(item, parent) {
  if (!item) return '📦';
  if (isEmoji(item.emoji)) return item.emoji;
  if (isEmoji(item.icon)) return item.icon;
  const parentSlug = slugOf(parent);
  return (
    (parentSlug && CATEGORY_EMOJI_BY_SLUG[`${parentSlug}/${item.slug}`]) ||
    (!parentSlug && CATEGORY_EMOJI_BY_SLUG[item.slug]) ||
    LUCIDE_TO_EMOJI[item.icon] ||
    '📦'
  );
}

function CategoryIcon({ item, parent, size = 28, style }) {
  const emoji = categoryEmoji(item, parent);
  const source = EMOJI_IMAGES[emoji];
  if (source) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        contentFit="contain"
        cachePolicy="memory"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <Text style={[{ fontSize: size * 0.82, lineHeight: size }, style]}>{emoji}</Text>;
}

export default memo(CategoryIcon);
