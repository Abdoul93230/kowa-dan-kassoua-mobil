// ─── MyListingsScreen v2 PREMIUM ─ MarketHub Niger ───────────────────────────
// Design cohérent avec l'app — ardoise, orange, épuré

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
  Image, Modal, Dimensions, Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { getMyProducts, getMyStats, deleteProduct, toggleProductStatus } from '../api/products';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, accent, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, delay: index * 80,
      tension: 80, friction: 9, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[
      s.statCard,
      {
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
      },
    ]}>
      <LinearGradient
        colors={accent ? [P.orange500 + '22', P.orange300 + '11'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
        style={s.statCardGrad}
      >
        {accent && <View style={s.statCardAccent} />}
        <Text style={s.statIcon}>{icon}</Text>
        <Text style={[s.statValue, accent && { color: P.amber }]}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING CARD
// ─────────────────────────────────────────────────────────────────────────────
function ListingCard({ item, onView, onEdit, onToggle, onDelete, toggling }) {
  const sc = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }).start();
  }, []);

  const statusConfig = {
    active:  { label: 'Active',     bg: 'rgba(34,197,94,0.9)',   dot: P.green },
    sold:    { label: 'Vendu',      bg: 'rgba(59,130,246,0.9)',  dot: P.blue },
    expired: { label: 'Expiré',     bg: 'rgba(107,114,128,0.9)', dot: P.muted },
    pending: { label: 'En attente', bg: 'rgba(245,158,11,0.9)',  dot: P.yellow },
  };
  const st = statusConfig[item.status] || statusConfig.expired;
  const isService = item.type === 'service';

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ scale: sc }] }]}>

      {/* Image */}
      <View style={s.cardImgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x200/FFE9DE/EC5A13?text=MH' }}
          style={s.cardImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(17,24,39,0.55)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Badge statut — top left */}
        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
          <View style={[s.statusDot, { backgroundColor: '#fff' }]} />
          <Text style={s.statusBadgeTxt}>{st.label}</Text>
        </View>

        {/* Badge type — top right */}
        <View style={[s.typeBadge, { backgroundColor: isService ? 'rgba(59,130,246,0.85)' : 'rgba(245,158,11,0.85)' }]}>
          <Text style={s.typeBadgeTxt}>{isService ? '🛠 Service' : '📦 Produit'}</Text>
        </View>

        {/* Prix en bas */}
        <View style={s.cardPriceTag}>
          <Text style={s.cardPriceTagTxt}>
            {item.price ? `${parseInt(item.price).toLocaleString('fr-FR')} FCFA` : 'À discuter'}
          </Text>
        </View>
      </View>

      {/* Contenu */}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>

        {/* Méta */}
        <View style={s.cardMeta}>
          <View style={s.cardMetaItem}>
            <Text style={s.cardMetaDot}>●</Text>
            <Text style={s.cardMetaTxt}>{item.location?.split(',')[0] || 'Niger'}</Text>
          </View>
          <View style={s.cardMetaItem}>
            <Text style={s.cardMetaIcon}>👁</Text>
            <Text style={s.cardMetaTxt}>{item.views || 0} vues</Text>
          </View>
          {(item.rating > 0) && (
            <View style={s.cardMetaItem}>
              <Text style={s.cardMetaIcon}>⭐</Text>
              <Text style={s.cardMetaTxt}>{item.rating?.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          {/* Voir */}
          <TouchableOpacity style={s.actionGhost} onPress={() => onView(item)} activeOpacity={0.75}>
            <Text style={s.actionGhostTxt}>Voir</Text>
          </TouchableOpacity>

          {/* Modifier */}
          <TouchableOpacity style={s.actionOutline} onPress={() => onEdit(item)} activeOpacity={0.75}>
            <Text style={s.actionOutlineTxt}>Modifier</Text>
          </TouchableOpacity>

          {/* Activer / Désactiver */}
          <TouchableOpacity
            style={[s.actionToggle, item.status === 'active' ? s.actionToggleOff : s.actionToggleOn]}
            onPress={() => onToggle(item)}
            disabled={toggling || item.status === 'sold'}
            activeOpacity={0.75}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={P.white} />
            ) : (
              <Text style={s.actionToggleTxt}>
                {item.status === 'active' ? 'Désactiver' : 'Activer'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Supprimer */}
          <TouchableOpacity style={s.actionDanger} onPress={() => onDelete(item)} activeOpacity={0.75}>
            <Text style={s.actionDangerTxt}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function MyListingsScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [listings,           setListings]           = useState([]);
  const [stats,              setStats]              = useState({ totalActive: 0, totalSold: 0, totalViews: 0, totalFavorites: 0 });
  const [loading,            setLoading]            = useState(true);
  const [refreshing,         setRefreshing]         = useState(false);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [filterStatus,       setFilterStatus]       = useState('all');
  const [filterType,         setFilterType]         = useState('all');
  const [showFilterModal,    setShowFilterModal]    = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete,       setItemToDelete]       = useState(null);
  const [deleting,           setDeleting]           = useState(false);
  const [togglingStatus,     setTogglingStatus]     = useState(null);
  const [alert,              setAlert]              = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsRes, statsRes] = await Promise.all([
        getMyProducts(filterStatus === 'all' ? undefined : filterStatus),
        getMyStats(),
      ]);
      setListings(productsRes.data || []);
      setStats(statsRes.data || { totalActive: 0, totalSold: 0, totalViews: 0, totalFavorites: 0 });
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de charger vos annonces',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [filterStatus]);

  const filteredListings = listings.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleView       = (item) => navigation.navigate('ProductDetail', { productId: item.id });
  const handleEdit       = (item) => navigation.navigate('Publish', { editItem: item });
  const handleDeletePress = (item) => { setItemToDelete(item); setDeleteModalVisible(true); };

  const handleToggleStatus = async (item) => {
    try {
      setTogglingStatus(item.id);
      await toggleProductStatus(item.id);
      await loadData();
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: "Impossible de changer le statut",
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      await deleteProduct(itemToDelete.id);
      setDeleteModalVisible(false);
      setItemToDelete(null);
      await loadData();
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: "Impossible de supprimer l'annonce",
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = filterStatus !== 'all' || filterType !== 'all';

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#2d3748', '#374151']} style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}>
          <View style={s.headerAccentLine} />
          <Text style={s.headerTitle}>Mes Annonces</Text>
        </LinearGradient>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={P.terra} />
          <Text style={s.loadingText}>Chargement de vos annonces…</Text>
        </View>
      </View>
    );
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}>
        <LinearGradient
          colors={['#2d3748', '#374151']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
        >
          <View style={s.headerAccentLine} />

          {/* Top row */}
          <View style={s.headerTop}>
            <View>
              <Text style={s.headerEyebrow}>MarketHub Niger</Text>
              <Text style={s.headerTitle}>Mes Annonces</Text>
            </View>
            <TouchableOpacity
              style={s.publishBtn}
              onPress={() => navigation.navigate('Publish')}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.publishBtnGrad}>
                <Text style={s.publishBtnTxt}>+ Publier</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats cards */}
          <View style={s.statsRow}>
            <StatCard icon="📦" value={stats.totalActive}    label="Actives"  accent index={0} />
            <StatCard icon="✓"  value={stats.totalSold}      label="Vendues"  index={1} />
            <StatCard icon="👁" value={stats.totalViews}     label="Vues"     index={2} />
            <StatCard icon="♥"  value={stats.totalFavorites} label="Favoris"  index={3} />
          </View>

          {/* Bottom glow line */}
          <LinearGradient
            colors={['transparent', P.terra, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.headerGlowLine}
          />
        </LinearGradient>
      </Animated.View>

      {/* ══ RECHERCHE + FILTRES ══════════════════════════════════════════ */}
      <View style={s.searchSection}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher dans mes annonces…"
            placeholderTextColor={P.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={s.searchClear}>
              <Text style={s.searchClearTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, hasFilters && s.filterBtnActive]}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.8}
        >
          <Text style={[s.filterBtnTxt, hasFilters && s.filterBtnTxtActive]}>
            {hasFilters ? '● Filtres' : 'Filtres'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ LISTE ════════════════════════════════════════════════════════ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.terra} colors={[P.terra]} />
        }
      >
        {filteredListings.length === 0 ? (
          <View style={s.emptyContainer}>
            <View style={s.emptyIconWrap}>
              <LinearGradient colors={[P.orange100, P.peachSoft]} style={s.emptyIconBg}>
                <Text style={s.emptyEmoji}>📭</Text>
              </LinearGradient>
            </View>
            <Text style={s.emptyTitle}>
              {hasFilters || searchQuery ? 'Aucune annonce trouvée' : 'Aucune annonce'}
            </Text>
            <Text style={s.emptyDesc}>
              {hasFilters || searchQuery
                ? 'Essayez de modifier vos critères de recherche'
                : 'Publiez votre première annonce gratuitement'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Publish')} activeOpacity={0.85}>
              <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                <Text style={s.emptyBtnTxt}>Publier une annonce →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.resultsCount}>
              {filteredListings.length} annonce{filteredListings.length > 1 ? 's' : ''}
            </Text>
            {filteredListings.map((item) => (
              <ListingCard
                key={item.id || item._id}
                item={item}
                onView={handleView}
                onEdit={handleEdit}
                onToggle={handleToggleStatus}
                onDelete={handleDeletePress}
                toggling={togglingStatus === item.id}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* ══ MODAL FILTRES ════════════════════════════════════════════════ */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.filterModal}>
            {/* Handle */}
            <View style={s.filterModalHandle} />

            <View style={s.filterModalHead}>
              <Text style={s.filterModalTitle}>Filtres</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} style={s.filterModalClose}>
                <Text style={s.filterModalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Statut */}
            <Text style={s.filterGroupLabel}>Statut</Text>
            <View style={s.filterChips}>
              {[
                { value: 'all',     label: 'Tous' },
                { value: 'active',  label: 'Actives' },
                { value: 'expired', label: 'Expirées' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.filterChip, filterStatus === opt.value && s.filterChipActive]}
                  onPress={() => setFilterStatus(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipTxt, filterStatus === opt.value && s.filterChipTxtActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Type */}
            <Text style={s.filterGroupLabel}>Type</Text>
            <View style={s.filterChips}>
              {[
                { value: 'all',     label: 'Tous' },
                { value: 'product', label: 'Produits' },
                { value: 'service', label: 'Services' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.filterChip, filterType === opt.value && s.filterChipActive]}
                  onPress={() => setFilterType(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipTxt, filterType === opt.value && s.filterChipTxtActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setShowFilterModal(false)} activeOpacity={0.85}>
              <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.applyBtn}>
                <Text style={s.applyBtnTxt}>Appliquer les filtres</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ MODAL SUPPRESSION ════════════════════════════════════════════ */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.deleteModal}>
            <View style={s.deleteModalIconWrap}>
              <Text style={s.deleteModalIcon}>🗑</Text>
            </View>
            <Text style={s.deleteModalTitle}>Supprimer l'annonce ?</Text>
            <Text style={s.deleteModalSub}>
              Cette action est irréversible. L'annonce sera définitivement supprimée.
            </Text>
            <View style={s.deleteModalBtns}>
              <TouchableOpacity
                style={s.deleteCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Text style={s.deleteCancelBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.deleteConfirmBtn}
                onPress={handleDeleteConfirm}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={P.white} />
                  : <Text style={s.deleteConfirmBtnTxt}>Supprimer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  container: { flex: 1, backgroundColor: P.surface },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:          { paddingHorizontal: 20, paddingBottom: 18, overflow: 'hidden', position: 'relative' },
  headerAccentLine:{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerEyebrow:   { fontSize: 10, fontWeight: '700', color: P.amber, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle:     { fontSize: 26, fontWeight: '900', color: P.white, letterSpacing: -0.5 },
  headerGlowLine:  { height: 1.5, marginTop: 16 },

  publishBtn:    { borderRadius: 12, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  publishBtnGrad:{ paddingHorizontal: 16, paddingVertical: 11 },
  publishBtnTxt: { fontSize: 13, fontWeight: '800', color: P.white },

  // Stats
  statsRow:      { flexDirection: 'row', gap: 8 },
  statCard:      { flex: 1, borderRadius: 14, overflow: 'hidden' },
  statCardGrad:  { padding: 12, alignItems: 'center', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, gap: 3 },
  statCardAccent:{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: P.terra },
  statIcon:      { fontSize: 18, marginBottom: 2 },
  statValue:     { fontSize: 18, fontWeight: '900', color: P.white },
  statLabel:     { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  // ── Recherche ────────────────────────────────────────────────────────────────
  searchSection: { flexDirection: 'row', padding: 14, gap: 10 },
  searchBar:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: P.dim, gap: 8 },
  searchIcon:    { fontSize: 16 },
  searchInput:   { flex: 1, fontSize: 14, color: P.charcoal, paddingVertical: 12 },
  searchClear:   { padding: 4 },
  searchClearTxt:{ fontSize: 13, color: P.muted, fontWeight: '700' },
  filterBtn:     { backgroundColor: P.white, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: P.dim },
  filterBtnActive:{ backgroundColor: P.peachSoft, borderColor: 'rgba(236,90,19,0.35)' },
  filterBtnTxt:  { fontSize: 13, fontWeight: '600', color: P.muted },
  filterBtnTxtActive:{ color: P.terra },

  // ── Liste ────────────────────────────────────────────────────────────────────
  listContent:   { padding: 14, paddingTop: 0 },
  resultsCount:  { fontSize: 12, color: P.muted, fontWeight: '600', marginBottom: 12, marginTop: 4 },

  // ── Loading / Empty ──────────────────────────────────────────────────────────
  loadingContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:     { fontSize: 14, color: P.muted },
  emptyContainer:  { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  emptyIconWrap:   { marginBottom: 20, borderRadius: 40, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8 },
  emptyIconBg:     { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji:      { fontSize: 36 },
  emptyTitle:      { fontSize: 20, fontWeight: '800', color: P.charcoal, marginBottom: 8, textAlign: 'center' },
  emptyDesc:       { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:        { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  emptyBtnTxt:     { fontSize: 15, fontWeight: '800', color: P.white },

  // ── Carte annonce ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: P.white,
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: P.charcoal,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 5,
  },
  cardImgWrap: { height: 170, backgroundColor: P.sand, position: 'relative' },
  cardImg:     { width: '100%', height: '100%' },

  statusBadge:    { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '800', color: P.white },

  typeBadge:    { position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  typeBadgeTxt: { fontSize: 10, fontWeight: '800', color: P.white },

  cardPriceTag:    { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(17,24,39,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cardPriceTagTxt: { fontSize: 12, fontWeight: '900', color: P.white },

  cardBody:  { padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: P.charcoal, lineHeight: 21, marginBottom: 10 },

  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaDot:  { fontSize: 6, color: P.terra },
  cardMetaIcon: { fontSize: 12 },
  cardMetaTxt:  { fontSize: 12, color: P.muted, fontWeight: '500' },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  actionGhost:   { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: P.dim, backgroundColor: P.surface },
  actionGhostTxt:{ fontSize: 12, fontWeight: '700', color: P.muted },

  actionOutline:   { flex: 1.4, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.35)', backgroundColor: P.peachSoft },
  actionOutlineTxt:{ fontSize: 12, fontWeight: '700', color: P.terra },

  actionToggle:    { flex: 1.4, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  actionToggleOff: { backgroundColor: P.yellowSoft, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)' },
  actionToggleOn:  { backgroundColor: P.successSoft, borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.3)' },
  actionToggleTxt: { fontSize: 11, fontWeight: '700', color: P.charcoal },

  actionDanger:    { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: P.errorSoft, borderWidth: 1.5, borderColor: P.errorBorder },
  actionDangerTxt: { fontSize: 14 },

  // ── Modal filtres ────────────────────────────────────────────────────────────
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  filterModal:    { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  filterModalHandle:{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginBottom: 16 },
  filterModalHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filterModalTitle: { fontSize: 20, fontWeight: '900', color: P.charcoal },
  filterModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  filterModalCloseTxt:{ fontSize: 14, color: P.muted, fontWeight: '700' },
  filterGroupLabel: { fontSize: 13, fontWeight: '700', color: P.brown, marginBottom: 10, marginTop: 16 },
  filterChips:      { flexDirection: 'row', gap: 8 },
  filterChip:       { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.dim },
  filterChipActive: { backgroundColor: P.peachSoft, borderColor: 'rgba(236,90,19,0.4)' },
  filterChipTxt:    { fontSize: 13, fontWeight: '600', color: P.muted },
  filterChipTxtActive:{ color: P.terra },
  applyBtn:         { borderRadius: 14, marginTop: 24, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  applyBtnTxt:      { fontSize: 15, fontWeight: '800', color: P.white, textAlign: 'center', paddingVertical: 15 },

  // ── Modal suppression ────────────────────────────────────────────────────────
  deleteModal:        { backgroundColor: P.white, borderRadius: 24, padding: 28, marginHorizontal: 24, alignItems: 'center', shadowColor: P.charcoal, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30, elevation: 20 },
  deleteModalIconWrap:{ width: 64, height: 64, borderRadius: 20, backgroundColor: P.errorSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: P.errorBorder },
  deleteModalIcon:    { fontSize: 28 },
  deleteModalTitle:   { fontSize: 18, fontWeight: '900', color: P.charcoal, marginBottom: 8, textAlign: 'center' },
  deleteModalSub:     { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  deleteModalBtns:    { flexDirection: 'row', gap: 12, width: '100%' },
  deleteCancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.dim },
  deleteCancelBtnTxt: { fontSize: 15, fontWeight: '700', color: P.charcoal },
  deleteConfirmBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: P.error, shadowColor: P.error, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5 },
  deleteConfirmBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white },
});