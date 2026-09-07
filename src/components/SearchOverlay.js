import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import { apiClient } from '../api/auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = 'taktak_recent_searches';
const MAX_RECENT = 10;
const DEBOUNCE_MS = 300;

const SearchOverlay = ({ searchQuery, setSearchQuery, onSearch, onClose, navigation }) => {
  const { isDark, theme } = useAppTheme();

  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Animated entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Debounced suggestions fetch
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (searchQuery.trim().length < 2) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(searchQuery.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (query) => {
    try {
      const trimmed = query.trim();
      if (!trimmed) return;

      let searches = [...recentSearches];
      searches = searches.filter((s) => s !== trimmed);
      searches.unshift(trimmed);
      searches = searches.slice(0, MAX_RECENT);

      setRecentSearches(searches);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      console.warn('Failed to save recent search:', error);
    }
  };

  const removeRecentSearch = async (query) => {
    try {
      const updated = recentSearches.filter((s) => s !== query);
      setRecentSearches(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to remove recent search:', error);
    }
  };

  const clearAllRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (error) {
      console.warn('Failed to clear recent searches:', error);
    }
  };

  const fetchSuggestions = async (query) => {
    try {
      const response = await apiClient.get('/products/search/suggestions', {
        params: { q: query },
      });

      if (response.data && response.data.success) {
        setSuggestions(response.data.data);
      } else {
        setSuggestions(null);
      }
    } catch (error) {
      console.warn('Failed to fetch suggestions:', error);
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    saveRecentSearch(trimmed);
    onSearch(trimmed);
  }, [searchQuery, onSearch]);

  const handleSuggestionTap = useCallback(
    (term) => {
      setSearchQuery(term);
      saveRecentSearch(term);
      onSearch(term);
    },
    [setSearchQuery, onSearch]
  );

  const handleCategoryTap = useCallback(
    (category) => {
      navigation.navigate('CategoryProducts', {
        categorySlug: category.slug,
        categoryName: category.name,
      });
      onClose();
    },
    [navigation, onClose]
  );

  const handleProductTap = useCallback(
    (product) => {
      navigation.navigate('ProductDetail', { productId: product.id });
      onClose();
    },
    [navigation, onClose]
  );

  const handleClearInput = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const formatPrice = (price) => {
    return parseInt(price).toLocaleString('fr-FR') + ' FCFA';
  };

  // ----- Render sections -----

  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            RECHERCHES RECENTES
          </Text>
          <TouchableOpacity onPress={clearAllRecentSearches} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearAllText, { color: P.terra }]}>Effacer tout</Text>
          </TouchableOpacity>
        </View>

        {recentSearches.map((item, index) => (
          <TouchableOpacity
            key={`recent-${index}`}
            style={[styles.recentRow, { borderBottomColor: theme.border }]}
            onPress={() => handleSuggestionTap(item)}
            activeOpacity={0.7}
          >
            <Feather name="clock" size={16} color={theme.textMuted} style={styles.recentIcon} />
            <Text style={[styles.recentText, { color: theme.text }]} numberOfLines={1}>
              {item}
            </Text>
            <TouchableOpacity
              onPress={() => removeRecentSearch(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.removeButton}
            >
              <Feather name="x" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderPopularSuggestions = () => {
    if (!suggestions || !suggestions.popular || suggestions.popular.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SUGGESTIONS</Text>

        {suggestions.popular.map((item, index) => (
          <TouchableOpacity
            key={`popular-${index}`}
            style={[styles.recentRow, { borderBottomColor: theme.border }]}
            onPress={() => handleSuggestionTap(typeof item === 'string' ? item : item.name || item.title)}
            activeOpacity={0.7}
          >
            <Feather name="trending-up" size={16} color={P.terra} style={styles.recentIcon} />
            <Text style={[styles.recentText, { color: theme.text }]} numberOfLines={1}>
              {typeof item === 'string' ? item : item.name || item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCategories = () => {
    if (!suggestions || !suggestions.categories || suggestions.categories.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>CATEGORIES</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {suggestions.categories.map((cat) => (
            <TouchableOpacity
              key={cat._id}
              style={[styles.categoryChip, { backgroundColor: theme.cardSoft, borderColor: theme.border }]}
              onPress={() => handleCategoryTap(cat)}
              activeOpacity={0.7}
            >
              {cat.icon ? (
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              ) : (
                <Feather name="grid" size={14} color={P.terra} />
              )}
              <Text style={[styles.categoryName, { color: theme.text }]} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderProducts = () => {
    if (!suggestions || !suggestions.products || suggestions.products.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ANNONCES</Text>

        {suggestions.products.map((product) => (
          <TouchableOpacity
            key={product.id}
            style={[styles.productCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => handleProductTap(product)}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: product.mainImage }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={[styles.productTitle, { color: theme.text }]} numberOfLines={2}>
                {product.title}
              </Text>
              <Text style={[styles.productPrice, { color: P.terra }]}>
                {formatPrice(product.price)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderContent = () => {
    const queryTrimmed = searchQuery.trim();

    // Empty query: show recent searches
    if (queryTrimmed.length < 2) {
      return renderRecentSearches();
    }

    // Loading state
    if (loading && !suggestions) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={P.terra} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Recherche...</Text>
        </View>
      );
    }

    // Suggestions results
    return (
      <>
        {loading && (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={P.terra} />
          </View>
        )}
        {renderPopularSuggestions()}
        {renderCategories()}
        {renderProducts()}
        {!loading && suggestions && !suggestions.popular?.length && !suggestions.categories?.length && !suggestions.products?.length && (
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Aucun resultat pour "{queryTrimmed}"
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: theme.screen,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Search Input Area */}
      <View style={[styles.searchHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={[styles.inputContainer, { backgroundColor: theme.cardSoft, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: theme.text }]}
            placeholder="Rechercher sur TakTak..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearInput}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearButton}
            >
              <Feather name="x-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    ...Platform.select({
      android: { paddingVertical: 6 },
    }),
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentIcon: {
    marginRight: 12,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
  },
  removeButton: {
    padding: 4,
  },
  categoriesContainer: {
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '500',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  inlineLoading: {
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
  },
});

export default SearchOverlay;
