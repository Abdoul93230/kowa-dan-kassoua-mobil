// Centralized color system for the mobile app.
// Use this file as the single source of truth for all UI colors.

export const MOBILE_COLORS = Object.freeze({
  // Web-aligned brand palette
  terra: '#ec5a13',
  terraDark: '#d94f0f',
  amber: '#ffa87b',
  gold: '#f59e0b',

  // Web-aligned neutral palette
  brown: '#1f2937',
  charcoal: '#111827',
  charcoalDark: '#0b1220',
  cream: '#ffffff',
  sand: '#f0f2f5',
  surface: '#f9fafb',
  muted: '#6b7280',
  dim: 'rgba(17,24,39,0.08)',

  // Shared utility colors
  glassWhite25: 'rgba(255,255,255,0.25)',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  error: '#EF4444',
  errorDark: '#DC2626',
  errorSoft: '#FEE2E2',
  errorBorder: '#FCA5A5',
  green: '#22C55E',
  greenDark: '#16A34A',
  successSoft: '#D1FAE5',
  blue: '#3B82F6',
  yellow: '#F59E0B',
  yellowSoft: '#FEF3C7',
  peachSoft: '#FFE9DE',
  amberSoft: '#FFF9E6',
  amberDark: '#92400E',
  whatsapp: '#25D366',

  // Web orange scale
  orange50: '#fff5f0',
  orange100: '#ffe9de',
  orange200: '#ffd4bd',
  orange300: '#ffbe9c',
  orange400: '#ffa87b',
  orange500: '#ec5a13',
  orange600: '#d44f11',
  orange700: '#b3420e',
  orange800: '#92360c',
  orange900: '#722a09',
});

export const GRAY_SCALE = Object.freeze({
  50: '#f9fafb',
  100: '#f0f2f5',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
});

export const COLORS = Object.freeze({
  primary: '#ec5a13',
  primaryDark: '#d94f0f',
  secondary: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  orangeLight: '#ffe9de',
  background: '#f0f2f5',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  gray: GRAY_SCALE,
  white: MOBILE_COLORS.white,
  black: MOBILE_COLORS.black,
});
