import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { getThemePalette, THEME_MODES } from '../theme/colors';
import { getThemePreference, saveThemePreference } from '../utils/storage';

const ThemeContext = createContext(null);

const normalizePreference = (value) => {
  if (value === THEME_MODES.LIGHT || value === THEME_MODES.DARK || value === THEME_MODES.SYSTEM) {
    return value;
  }

  return THEME_MODES.SYSTEM;
};

export function ThemeProvider({ children }) {
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'dark');
  const [themePreference, setThemePreferenceState] = useState(THEME_MODES.SYSTEM);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadThemePreference = async () => {
      const storedPreference = await getThemePreference();

      if (!mounted) {
        return;
      }

      setThemePreferenceState(normalizePreference(storedPreference));
      setThemeLoaded(true);
    };

    loadThemePreference();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!themeLoaded) {
      return;
    }

    saveThemePreference(themePreference).catch(() => {});
  }, [themePreference, themeLoaded]);

  const resolvedTheme =
    themePreference === THEME_MODES.SYSTEM
      ? (systemScheme === 'light' ? THEME_MODES.LIGHT : THEME_MODES.DARK)
      : themePreference;

  const theme = useMemo(() => getThemePalette(resolvedTheme), [resolvedTheme]);

  const setThemePreference = (value) => {
    setThemePreferenceState(normalizePreference(value));
  };

  const value = useMemo(() => ({
    themePreference,
    setThemePreference,
    resolvedTheme,
    isDark: resolvedTheme === THEME_MODES.DARK,
    isLight: resolvedTheme === THEME_MODES.LIGHT,
    isSystem: themePreference === THEME_MODES.SYSTEM,
    theme,
    themeLoaded,
  }), [themePreference, resolvedTheme, theme, themeLoaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme doit être utilisé dans un ThemeProvider');
  }

  return context;
}