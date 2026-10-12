// ─── BottomSheet ─────────────────────────────────────────────────────────────
// Enveloppe du panneau natif <Sheet> sans en-tête imposé : le contenu fournit
// son propre titre (filtres, ville, tri). Le contenu défile déjà : ne pas y
// mettre de ScrollView, et utiliser <SheetTextInput> pour les champs.

import React from 'react';
import Sheet from './Sheet';

export { SheetTextInput } from './Sheet';

export default function BottomSheet({ visible, onClose, children, footer, maxHeightRatio = 0.88 }) {
  return (
    <Sheet visible={visible} onClose={onClose} footer={footer} maxHeightRatio={maxHeightRatio} contentPadding={0}>
      {children}
    </Sheet>
  );
}
