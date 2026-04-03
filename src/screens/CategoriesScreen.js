import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { getCategories } from '../api/categories';
import { MOBILE_COLORS as P } from '../theme/colors';

const iconToEmoji = {
  Smartphone: '📱',
  UtensilsCrossed: '🍔',
  Home: '🏠',
  Car: '🚗',
  Shirt: '👕',
  Wrench: '🔧',
  Laptop: '💻',
  Dumbbell: '🏋️',
  Baby: '👶',
  PawPrint: '🐾',
  Book: '📚',
  Palette: '🎨',
  Briefcase: '💼',
  Gamepad2: '🎮',
  HardHat: '⛑️',
  Package: '📦',
};

const getEmoji = (icon, fallback) => fallback || iconToEmoji[icon] || '📦';

function CategoryCard({ item, onPress }) {
  const total = Number(item?.totalCount || 0);
  const subcategories = Array.isArray(item?.subcategories) ? item.subcategories : [];

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={['#FFE9DE', P.white]} style={s.cardHead}>
        <View style={s.iconWrap}>
          <Text style={s.iconTxt}>{getEmoji(item?.icon, item?.emoji)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{item?.name || 'Catégorie'}</Text>
          <Text style={s.cardDesc} numberOfLines={2}>{item?.description || 'Explorez les annonces de cette catégorie.'}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={P.terra} />
      </LinearGradient>

      <View style={s.cardBody}>
        <View style={s.statPill}>
          <Text style={s.statPillTxt}>{total.toLocaleString()} annonces</Text>
        </View>

        {subcategories.length > 0 && (
          <View style={s.subWrap}>
            {subcategories.slice(0, 3).map((sub) => (
              <View key={sub?._id || sub?.slug || sub?.name} style={s.subChip}>
                <Text style={s.subChipTxt} numberOfLines={1}>{sub?.name || 'Sous-catégorie'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CategoriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await getCategories();
      const direct = res?.data;
      const list = Array.isArray(direct) ? direct : Array.isArray(direct?.data) ? direct.data : [];
      setCategories(list);
    } catch (error) {
      console.error('Erreur chargement categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => {
      const name = String(cat?.name || '').toLowerCase();
      const desc = String(cat?.description || '').toLowerCase();
      const hasSub = (cat?.subcategories || []).some((sub) => String(sub?.name || '').toLowerCase().includes(q));
      return name.includes(q) || desc.includes(q) || hasSub;
    });
  }, [categories, query]);

  const totalSubs = categories.reduce((acc, cat) => acc + ((cat?.subcategories || []).length || 0), 0);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient colors={['#2D3748', '#374151']} style={[s.header, { paddingTop: (insets.top || 0) + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Toutes les catégories</Text>
        <Text style={s.headerSub}>Explorez les univers disponibles</Text>

        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={P.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher une catégorie..."
            placeholderTextColor={P.muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Text style={s.clearTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{categories.length}</Text>
            <Text style={s.statLbl}>Catégories</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statNum}>{totalSubs}</Text>
            <Text style={s.statLbl}>Sous-catégories</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={P.terra} />
          <Text style={s.loadingTxt}>Chargement des catégories...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => String(item?._id || item?.slug || index)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + Math.max(insets.bottom, 8) }}
          renderItem={({ item }) => (
            <CategoryCard
              item={item}
              onPress={() => navigation.navigate('CategoryProducts', {
                categorySlug: item?.slug,
                categoryName: item?.name,
              })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchCategories();
              }}
              colors={[P.terra]}
              tintColor={P.terra}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>Aucune catégorie</Text>
              <Text style={s.emptySub}>Essayez avec un autre mot-clé.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.surface },
  header: { paddingHorizontal: 14, paddingBottom: 10 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  backTxt: { color: P.white, fontSize: 16, fontWeight: '700' },
  headerTitle: { color: P.white, fontSize: 20, fontWeight: '900', marginBottom: 2 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: P.charcoal },
  clearTxt: { color: P.muted, fontSize: 13, fontWeight: '700' },
  statsRow: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '900', color: P.amber },
  statLbl: { fontSize: 9, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  statDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.2)' },

  card: {
    backgroundColor: P.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.dim,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: P.charcoal,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: P.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(236,90,19,0.18)',
  },
  iconTxt: { fontSize: 20 },
  cardTitle: { color: P.charcoal, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardDesc: { color: P.muted, fontSize: 11, lineHeight: 15 },
  cardBody: { paddingHorizontal: 12, paddingBottom: 12 },
  statPill: {
    alignSelf: 'flex-start',
    backgroundColor: P.peachSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  statPillTxt: { color: P.terra, fontSize: 11, fontWeight: '700' },
  subWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subChip: {
    backgroundColor: P.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: P.dim,
  },
  subChipTxt: { color: P.muted, fontSize: 10, fontWeight: '600', maxWidth: 130 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingTxt: { color: P.muted, fontSize: 13, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: P.charcoal, marginBottom: 4 },
  emptySub: { fontSize: 13, color: P.muted },
});