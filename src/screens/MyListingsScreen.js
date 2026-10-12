// ─── Mes annonces ────────────────────────────────────────────────────────────
// Tableau de bord du vendeur : statistiques, onglets par statut (avec compteurs),
// recherche et type côté serveur, liste paginée, actions par annonce dans un
// panneau natif (voir, modifier, désactiver/réactiver, marquer vendu, supprimer).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { getMyProducts, getMyStats, deleteProduct, toggleProductStatus, markProductSold } from '../api/products';
import AlertModal from '../components/AlertModal';
import Sheet from '../components/Sheet';
import PressableScale from '../components/home/PressableScale';
import { SkeletonGroup, Bone } from '../components/home/Skeleton';
import { MOBILE_COLORS as P } from '../theme/colors';
import { formatPrice, formatCompact, timeAgo, getProductId, getProductImage } from '../utils/format';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS = {
  active: { label: 'En ligne', color: P.green, icon: 'check-circle' },
  expired: { label: 'Désactivée', color: '#6b7280', icon: 'pause-circle' },
  pending: { label: 'Désactivée', color: '#6b7280', icon: 'pause-circle' },
  sold: { label: 'Vendue', color: P.blue600, icon: 'award' },
};

const TYPE_FILTERS = [
  { key: '', label: 'Tout' },
  { key: 'product', label: 'Produits' },
  { key: 'service', label: 'Services' },
];

// ─── Ligne d'annonce ─────────────────────────────────────────────────────────
function ListingRow({ item, onPress, onMore, busy }) {
  const { theme, isDark } = useAppTheme();
  const st = STATUS[item.status] || STATUS.expired;
  const image = getProductImage(item, 96);
  const isService = item.type === 'service';
  const inactive = item.status !== 'active';

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={[s.row, { backgroundColor: theme.surface, borderColor: theme.border }, !isDark && s.rowShadow]}>
      <View style={[s.thumbWrap, { backgroundColor: isDark ? theme.surfaceAlt : P.orange50 }]}>
        {image ? (
          <Image source={{ uri: image }} style={[s.thumb, inactive && { opacity: 0.55 }]} />
        ) : (
          <Feather name={isService ? 'tool' : 'package'} size={24} color={theme.textSoft} />
        )}
        {busy ? (
          <View style={s.thumbBusy}><ActivityIndicator color={P.white} /></View>
        ) : null}
      </View>

      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <View style={[s.statusPill, { backgroundColor: `${st.color}1f` }]}>
            <View style={[s.statusDot, { backgroundColor: st.color }]} />
            <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
          </View>
          {isService ? <Text style={[s.typeTxt, { color: P.blue600 }]}>Service</Text> : null}
        </View>

        <Text style={[s.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[s.price, { color: isService ? P.blue600 : (isDark ? P.amber : P.terra) }]} numberOfLines={1}>
          {formatPrice(item.price)}
        </Text>

        <View style={s.metaRow}>
          <Feather name="eye" size={12} color={theme.textSoft} />
          <Text style={[s.metaTxt, { color: theme.textSoft }]}>{formatCompact(item.views || 0)}</Text>
          <Feather name="heart" size={12} color={theme.textSoft} style={{ marginLeft: 8 }} />
          <Text style={[s.metaTxt, { color: theme.textSoft }]}>{formatCompact(item.favorites || 0)}</Text>
          <Text style={[s.metaTxt, { color: theme.textSoft, marginLeft: 'auto' }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      <Pressable onPress={onMore} hitSlop={10} style={({ pressed }) => [s.moreBtn, { backgroundColor: theme.glass }, pressed && { opacity: 0.6 }]} accessibilityLabel="Actions">
        <Feather name="more-vertical" size={18} color={theme.text} />
      </Pressable>
    </PressableScale>
  );
}

// ─── Ligne d'action du panneau ───────────────────────────────────────────────
function ActionRow({ icon, label, hint, color, onPress }) {
  const { theme } = useAppTheme();
  const tint = color || theme.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.action, pressed && { backgroundColor: theme.glass }]}>
      <View style={[s.actionIcon, { backgroundColor: color ? `${color}1a` : theme.glass }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.actionLabel, { color: tint }]}>{label}</Text>
        {hint ? <Text style={[s.actionHint, { color: theme.textSoft }]}>{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSoft} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MyListingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const accent = isDark ? P.amber : P.terra;

  const [stats, setStats] = useState({ totalActive: 0, totalSold: 0, totalExpired: 0, totalAll: 0, totalViews: 0, totalFavorites: 0 });
  const [status, setStatus] = useState('');      // '' = toutes
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');      // valeur « anti-rebond » envoyée au serveur
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);  // annonce dont le panneau d'actions est ouvert
  const [busyId, setBusyId] = useState(null);
  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '', buttons: [] });

  const requestId = useRef(0);
  const firstFocus = useRef(true);

  const tabs = [
    { key: '', label: 'Toutes', count: stats.totalAll },
    { key: 'active', label: 'En ligne', count: stats.totalActive },
    { key: 'expired', label: 'Désactivées', count: stats.totalExpired },
    { key: 'sold', label: 'Vendues', count: stats.totalSold },
  ];

  // Recherche avec anti-rebond
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getMyStats();
      if (res?.data) setStats((prev) => ({ ...prev, ...res.data }));
    } catch (e) { /* les compteurs restent les précédents */ }
  }, []);

  const loadPage = useCallback(async (pageToLoad) => {
    const id = ++requestId.current;
    if (pageToLoad > 1) setLoadingMore(true);
    try {
      const res = await getMyProducts(status || undefined, pageToLoad, PAGE_SIZE, { type: type || undefined, search });
      if (id !== requestId.current) return;
      const list = Array.isArray(res?.data) ? res.data : [];
      setItems((prev) => {
        if (pageToLoad === 1) return list;
        const seen = new Set(prev.map(getProductId));
        return [...prev, ...list.filter((it) => !seen.has(getProductId(it)))];
      });
      setTotal(Number(res?.pagination?.total ?? list.length));
      setPage(pageToLoad);
    } catch (e) {
      if (id === requestId.current && pageToLoad === 1) {
        setAlert({ visible: true, type: 'error', title: 'Erreur', message: 'Impossible de charger vos annonces', buttons: [{ text: 'OK', onPress: () => {} }] });
      }
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); setRefreshing(false); }
    }
  }, [status, type, search]);

  // Rechargement à chaque changement de filtre
  useEffect(() => { setLoading(true); loadPage(1); }, [loadPage]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Retour sur l'écran (ex. après modification) : rafraîchissement silencieux
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    loadPage(1);
    loadStats();
  }, [loadPage, loadStats]));

  const refreshAll = useCallback(() => Promise.all([loadPage(1), loadStats()]), [loadPage, loadStats]);
  const onRefresh = () => { setRefreshing(true); refreshAll(); };
  const loadMore = () => { if (!loading && !loadingMore && items.length < total) loadPage(page + 1); };

  // ─── Actions ───────────────────────────────────────────────────────────────
  const goToPublish = (params) => navigation.navigate('MainTabs', { screen: 'Publish', params });
  const showError = (message) => setAlert({ visible: true, type: 'error', title: 'Erreur', message, buttons: [{ text: 'OK', onPress: () => {} }] });

  const runAction = async (item, fn) => {
    setSelected(null);
    setBusyId(getProductId(item));
    try {
      await fn();
      await refreshAll();
    } catch (e) {
      showError(e?.message || 'Action impossible pour le moment');
    } finally {
      setBusyId(null);
    }
  };

  const confirmMarkSold = (item) => {
    setSelected(null);
    setAlert({
      visible: true,
      type: 'info',
      title: 'Marquer comme vendue ?',
      message: 'L\'annonce n\'apparaîtra plus dans les recherches. Cette action est définitive.',
      buttons: [
        { text: 'Annuler', onPress: () => {} },
        { text: 'Vendue', onPress: () => runAction(item, () => markProductSold(getProductId(item))) },
      ],
    });
  };

  const confirmDelete = (item) => {
    setSelected(null);
    setAlert({
      visible: true,
      type: 'error',
      title: 'Supprimer l\'annonce ?',
      message: 'Elle sera définitivement supprimée, avec ses photos. Cette action est irréversible.',
      buttons: [
        { text: 'Annuler', onPress: () => {} },
        { text: 'Supprimer', onPress: () => runAction(item, () => deleteProduct(getProductId(item))) },
      ],
    });
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  const header = (
    <View>
      {/* Statistiques */}
      <View style={s.stats}>
        {[
          { icon: 'check-circle', value: stats.totalActive, label: 'En ligne', tint: P.green },
          { icon: 'eye', value: stats.totalViews, label: 'Vues', tint: accent },
          { icon: 'heart', value: stats.totalFavorites, label: 'Favoris', tint: P.error },
          { icon: 'award', value: stats.totalSold, label: 'Vendues', tint: P.blue600 },
        ].map((st) => (
          <View key={st.label} style={[s.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name={st.icon} size={15} color={st.tint} />
            <Text style={[s.statValue, { color: theme.text }]}>{formatCompact(st.value || 0)}</Text>
            <Text style={[s.statLabel, { color: theme.textSoft }]}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Recherche */}
      <View style={[s.search, { backgroundColor: isDark ? theme.surface : 'rgba(17,24,39,0.05)', borderColor: query ? accent : 'transparent' }]}>
        <Feather name="search" size={17} color={query ? accent : theme.textSoft} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="Rechercher dans mes annonces"
          placeholderTextColor={theme.textSoft}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer">
            <Feather name="x-circle" size={17} color={theme.textSoft} />
          </Pressable>
        ) : null}
      </View>

      {/* Onglets de statut */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {tabs.map((t) => {
          const active = status === t.key;
          return (
            <Pressable
              key={t.key || 'all'}
              onPress={() => setStatus(t.key)}
              style={[s.tab, { backgroundColor: active ? accent : theme.surface, borderColor: active ? accent : theme.border }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.tabTxt, { color: active ? P.white : theme.text }]}>{t.label}</Text>
              <View style={[s.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.glass }]}>
                <Text style={[s.tabCountTxt, { color: active ? P.white : theme.textMuted }]}>{t.count || 0}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Type */}
      <View style={s.types}>
        {TYPE_FILTERS.map((t) => {
          const active = type === t.key;
          return (
            <Pressable key={t.key || 'all'} onPress={() => setType(t.key)} hitSlop={6} style={s.typeBtn}>
              <Text style={[s.typeBtnTxt, { color: active ? accent : theme.textSoft }, active && { fontWeight: '800' }]}>{t.label}</Text>
              {active ? <View style={[s.typeLine, { backgroundColor: accent }]} /> : null}
            </Pressable>
          );
        })}
        {!loading ? (
          <Text style={[s.count, { color: theme.textSoft }]}>{total} annonce{total > 1 ? 's' : ''}</Text>
        ) : null}
      </View>
    </View>
  );

  const filtersActive = Boolean(status || type || search);
  const empty = loading ? (
    <SkeletonGroup>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Bone width={92} height={92} radius={14} />
          <View style={{ flex: 1, gap: 8, paddingLeft: 12 }}>
            <Bone width={80} height={18} radius={9} />
            <Bone width="90%" height={14} radius={6} />
            <Bone width={110} height={16} radius={6} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  ) : (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50 }]}>
        <Feather name={filtersActive ? 'search' : 'package'} size={28} color={accent} />
      </View>
      <Text style={[s.emptyTitle, { color: theme.text }]}>
        {filtersActive ? 'Aucune annonce ne correspond' : 'Vous n\'avez pas encore d\'annonce'}
      </Text>
      <Text style={[s.emptySub, { color: theme.textMuted }]}>
        {filtersActive ? 'Essayez un autre onglet ou d\'autres mots-clés.' : 'Publiez gratuitement en moins de 2 minutes.'}
      </Text>
      {filtersActive ? (
        <PressableScale onPress={() => { setStatus(''); setType(''); setQuery(''); }} style={[s.emptyBtn, { backgroundColor: accent }]}>
          <Text style={s.emptyBtnTxt}>Tout afficher</Text>
        </PressableScale>
      ) : (
        <PressableScale onPress={() => goToPublish()} style={[s.emptyBtn, { backgroundColor: P.terra }]}>
          <Text style={s.emptyBtnTxt}>Publier une annonce</Text>
        </PressableScale>
      )}
    </View>
  );

  const sel = selected;
  const selStatus = sel?.status;

  return (
    <View style={[s.screen, { backgroundColor: theme.screen }]}>
      {/* En-tête */}
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: isDark ? theme.screen : theme.surface, borderBottomColor: theme.border }]}>
        <PressableScale onPress={() => navigation.goBack()} scaleTo={0.9} style={[s.iconBtn, { backgroundColor: theme.glass }]} accessibilityLabel="Retour">
          <Feather name="arrow-left" size={20} color={theme.text} />
        </PressableScale>
        <Text style={[s.headerTitle, { color: theme.text }]}>Mes annonces</Text>
        <PressableScale onPress={() => goToPublish()} scaleTo={0.94} style={s.publishBtn} accessibilityLabel="Publier une annonce">
          <Feather name="plus" size={16} color={P.white} />
          <Text style={s.publishTxt}>Publier</Text>
        </PressableScale>
      </View>

      <FlatList
        data={loading ? [] : items}
        keyExtractor={getProductId}
        renderItem={({ item }) => (
          <ListingRow
            item={item}
            busy={busyId === getProductId(item)}
            onPress={() => navigation.navigate('ProductDetail', { productId: getProductId(item), preview: item })}
            onMore={() => setSelected(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={accent} style={{ marginVertical: 16 }} /> : null}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.terra]} tintColor={P.terra} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />

      {/* Actions sur une annonce */}
      <Sheet visible={Boolean(sel)} onClose={() => setSelected(null)} title={sel?.title} contentPadding={8}>
        {sel ? (
          <View>
            <ActionRow icon="eye" label="Voir l'annonce" onPress={() => { setSelected(null); navigation.navigate('ProductDetail', { productId: getProductId(sel), preview: sel }); }} />
            {selStatus !== 'sold' ? (
              <ActionRow icon="edit-3" label="Modifier" hint="Photos, prix, description…" onPress={() => { setSelected(null); goToPublish({ editItem: sel }); }} />
            ) : null}
            {selStatus === 'active' ? (
              <ActionRow icon="pause-circle" label="Désactiver" hint="Masquée des recherches, réactivable à tout moment" onPress={() => runAction(sel, () => toggleProductStatus(getProductId(sel)))} />
            ) : null}
            {selStatus === 'expired' || selStatus === 'pending' ? (
              <ActionRow icon="play-circle" label="Remettre en ligne" color={P.greenDark} onPress={() => runAction(sel, () => toggleProductStatus(getProductId(sel)))} />
            ) : null}
            {selStatus !== 'sold' ? (
              <ActionRow icon="award" label="Marquer comme vendue" color={P.blue600} onPress={() => confirmMarkSold(sel)} />
            ) : null}
            <ActionRow icon="trash-2" label="Supprimer" color={P.error} onPress={() => confirmDelete(sel)} />
          </View>
        ) : null}
      </Sheet>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert((a) => ({ ...a, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.terra, height: 38, paddingHorizontal: 14, borderRadius: 19 },
  publishTxt: { color: P.white, fontSize: 13.5, fontWeight: '800' },

  stats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '600' },

  search: { height: 46, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  tabs: { gap: 8, paddingBottom: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingLeft: 14, paddingRight: 6, borderRadius: 19, borderWidth: 1 },
  tabTxt: { fontSize: 13.5, fontWeight: '700' },
  tabCount: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  tabCountTxt: { fontSize: 12, fontWeight: '800' },

  types: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12, paddingTop: 2 },
  typeBtn: { paddingVertical: 6 },
  typeBtnTxt: { fontSize: 13.5, fontWeight: '600' },
  typeLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, borderRadius: 2 },
  count: { marginLeft: 'auto', fontSize: 12.5 },

  row: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  rowShadow: { shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  thumbWrap: { width: 92, height: 92, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%' },
  thumbBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,24,39,0.45)', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, paddingLeft: 12, paddingRight: 6, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: '800' },
  typeTxt: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  price: { fontSize: 15, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaTxt: { fontSize: 11.5 },
  moreBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },

  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15.5, fontWeight: '700' },
  actionHint: { fontSize: 12, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  emptyBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnTxt: { color: P.white, fontSize: 14, fontWeight: '800' },
});
