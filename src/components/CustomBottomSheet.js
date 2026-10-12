// ─── CustomBottomSheet ───────────────────────────────────────────────────────
// Conservé pour compatibilité (ProfileScreen) : délègue au panneau natif <Sheet>.
// Les champs de saisie à l'intérieur doivent être des <SheetTextInput>.

import React from 'react';
import { Dimensions } from 'react-native';
import Sheet from './Sheet';

export { SheetTextInput } from './Sheet';

const { height: SCREEN_H } = Dimensions.get('window');

export default function CustomBottomSheet({
  visible,
  onClose,
  title,
  footer,
  children,
  maxHeight = SCREEN_H * 0.92,
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={footer}
      maxHeightRatio={Math.min(maxHeight / SCREEN_H, 0.92)}
      contentPadding={22}
    >
      {children}
    </Sheet>
  );
}
