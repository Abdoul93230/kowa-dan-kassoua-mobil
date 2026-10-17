import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { createOrGetConversation, getConversations } from '../api/messaging';
import { peekCache, writeCache } from '../api/cache';
import { MOBILE_COLORS as P } from '../theme/colors';
import { useSocket } from '../hooks/useSocket';
import { formatPrice, getInitials, sizedImage } from '../utils/format';

const PAGE_SIZE = 30;
// Le socket tient la liste à jour en direct : un rechargement complet n'est utile
// que si les données ont plus de 30 s (ex. retour de l'app après une coupure)
const STALE_MS = 30000;

// Aperçu de liste à partir d'un message reçu en temps réel
const toLastMessage = (message) => ({
  id: message.id,
  content: message.type === 'audio' ? '🎤 Message vocal' : message.content,
  senderId: String(message.senderId || ''),
  senderName: message.senderName,
  timestamp: message.timestamp,
  delivered: Boolean(message.delivered),
  deliveredAt: message.deliveredAt || null,
  read: Boolean(message.read),
  readAt: message.readAt || null,
  type: message.type,
});

// Place la conversation modifiée en tête (tri par activité, comme WhatsApp)
const moveToTop = (list, index, updated) => [updated, ...list.slice(0, index), ...list.slice(index + 1)];

function getOtherParticipant(conversation, currentUserId) {
  const buyer = conversation?.participants?.buyer;
  const seller = conversation?.participants?.seller;

  const buyerId = buyer?.id || buyer?._id;
  const sellerId = seller?.id || seller?._id;

  if (buyerId && String(buyerId) === String(currentUserId)) return seller || null;
  if (sellerId && String(sellerId) === String(currentUserId)) return buyer || null;

  return seller || buyer || null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function isCurrentUserMessage(message, user, currentUserId) {
  const senderId = String(message?.senderId || message?.sender?._id || message?.sender?.id || '').trim();
  const userId = String(currentUserId || '').trim();
  if (senderId && userId && senderId === userId) return true;

  const userName = normalizeText(user?.name);
  const senderName = normalizeText(message?.senderName);
  return Boolean(userName && senderName && userName === senderName);
}

export default function MessagesListScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, token } = useAuth();
  const { isDark, theme } = useAppTheme();

  const currentUserId = useMemo(
    () => user?.id || user?._id || null,
    [user]
  );

  // Dernière liste connue (mémoire) : affichée instantanément, sans spinner
  const cacheKey = `conversations:${currentUserId || 'anonyme'}`;
  const cached = peekCache(cacheKey)?.data;

  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [conversations, setConversations] = useState(cached?.items || []);
  const [hasMore, setHasMore] = useState(Boolean(cached?.hasMore));
  const [error, setError] = useState('');

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const nextBeforeRef = useRef(cached?.nextBefore || null);
  const lastLoadRef = useRef(cached ? peekCache(cacheKey).at : 0);
  const reloadTimerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeCache(cacheKey, { items: conversations, hasMore, nextBefore: nextBeforeRef.current });
  }, [cacheKey, conversations, hasMore, isAuthenticated]);

  const { isUserOnline, isConnected, on, off } = useSocket({
    enabled: isAuthenticated,
    token,
  });

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Conversation inconnue de la liste (nouvelle, ou au-delà des pages chargées) :
    // un rechargement groupé plutôt qu'un par événement
    const scheduleReload = () => {
      if (reloadTimerRef.current) return;
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        loadConversationsRef.current?.();
      }, 600);
    };

    const onConversationUpdated = (payload) => {
      const payloadConversationId = String(payload?.conversationId || payload?.id || '');
      if (!payloadConversationId) return;

      const index = conversationsRef.current.findIndex((conv) => String(conv.id) === payloadConversationId);
      if (index < 0) {
        if (payload?.lastMessage) scheduleReload();
        return;
      }

      setConversations((prev) => {
        const i = prev.findIndex((conv) => String(conv.id) === payloadConversationId);
        if (i < 0) return prev;
        const conv = prev[i];
        const updated = {
          ...conv,
          lastMessage: payload?.lastMessage || conv.lastMessage,
          unreadCount:
            typeof payload?.unreadCount === 'number'
              ? payload.unreadCount
              : conv.unreadCount,
          status: payload?.status || conv.status,
          deal: payload?.deal || conv.deal,
          closedByOwner: typeof payload?.closedByOwner === 'boolean' ? payload.closedByOwner : conv.closedByOwner,
          updatedAt: payload?.updatedAt || new Date().toISOString(),
        };
        // Nouveau message → en tête de liste ; simple changement d'état → reste en place
        const newMessage = payload?.lastMessage && String(payload.lastMessage.id || '') !== String(conv.lastMessage?.id || '');
        if (!newMessage) {
          const next = [...prev];
          next[i] = updated;
          return next;
        }
        return moveToTop(prev, i, updated);
      });
    };

    // Messages des conversations ouvertes (la connexion est partagée) : aperçu à jour,
    // y compris pour nos propres messages envoyés depuis l'écran de conversation
    const onMessageNew = (message) => {
      const conversationId = String(message?.conversationId || '');
      if (!conversationId || message?.type === 'system') return;
      setConversations((prev) => {
        const i = prev.findIndex((conv) => String(conv.id) === conversationId);
        if (i < 0 || String(prev[i].lastMessage?.id || '') === String(message.id)) return prev;
        return moveToTop(prev, i, {
          ...prev[i],
          lastMessage: toLastMessage(message),
          updatedAt: message.timestamp || new Date().toISOString(),
        });
      });
    };

    const onMessageRead = (payload) => {
      const payloadConversationId = String(payload?.conversationId || '');
      const payloadMessageId = String(payload?.messageId || '');
      if (!payloadConversationId || !payloadMessageId) return;

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== payloadConversationId) return conv;

          const lastMessageId = String(conv?.lastMessage?.id || '');
          if (!lastMessageId || lastMessageId !== payloadMessageId) return conv;

          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              read: true,
              readAt: payload?.readAt || conv?.lastMessage?.readAt,
            },
          };
        })
      );
    };

    const onMessageDelivered = (payload) => {
      const payloadConversationId = String(payload?.conversationId || '');
      const payloadMessageId = String(payload?.messageId || '');
      if (!payloadConversationId || !payloadMessageId) return;

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== payloadConversationId) return conv;

          const lastMessageId = String(conv?.lastMessage?.id || '');
          if (!lastMessageId || lastMessageId !== payloadMessageId) return conv;

          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              delivered: true,
              deliveredAt: payload?.deliveredAt || conv?.lastMessage?.deliveredAt,
            },
          };
        })
      );
    };

    on('conversation:updated', onConversationUpdated);
    on('message:new', onMessageNew);
    on('message:delivered', onMessageDelivered);
    on('message:read', onMessageRead);

    // Conversation lue depuis son écran : badge remis à zéro sans requête
    const readSub = DeviceEventEmitter.addListener('conversation:read', ({ conversationId } = {}) => {
      setConversations((prev) => prev.map((conv) => (
        String(conv.id) === String(conversationId) && conv.unreadCount ? { ...conv, unreadCount: 0 } : conv
      )));
    });

    return () => {
      off('conversation:updated', onConversationUpdated);
      off('message:new', onMessageNew);
      off('message:delivered', onMessageDelivered);
      off('message:read', onMessageRead);
      readSub.remove();
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [isAuthenticated, off, on]);

  // Première page (remplace la liste) — silencieux si une liste est déjà affichée
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setConversations([]);
      return;
    }

    try {
      setError('');
      const response = await getConversations({ limit: PAGE_SIZE });
      setConversations(response?.data || []);
      nextBeforeRef.current = response?.pagination?.nextBefore || null;
      setHasMore(Boolean(response?.pagination?.hasMore));
      lastLoadRef.current = Date.now();
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible de charger les conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const loadConversationsRef = useRef(loadConversations);
  loadConversationsRef.current = loadConversations;

  // Pages suivantes (défilement infini)
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextBeforeRef.current) return;
    try {
      setLoadingMore(true);
      const response = await getConversations({ limit: PAGE_SIZE, before: nextBeforeRef.current });
      const page = response?.data || [];
      setConversations((prev) => {
        const seen = new Set(prev.map((conv) => String(conv.id)));
        return [...prev, ...page.filter((conv) => !seen.has(String(conv.id)))];
      });
      nextBeforeRef.current = response?.pagination?.nextBefore || null;
      setHasMore(Boolean(response?.pagination?.hasMore));
    } catch (e) {
      // on réessaiera au prochain défilement
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  // Reconnexion du socket après une coupure : des événements ont pu être manqués
  const wasConnectedRef = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current && lastLoadRef.current) loadConversations();
    wasConnectedRef.current = isConnected;
  }, [isConnected, loadConversations]);

  const openConversationFromRouteParams = useCallback(async () => {
    const sellerId = route?.params?.sellerId;
    const productId = route?.params?.productId;

    if (!sellerId || !isAuthenticated || creatingConversation) return;

    try {
      setCreatingConversation(true);
      const response = await createOrGetConversation({ sellerId, productId });
      const conversationId = response?.data?.id;

      navigation.setParams({ sellerId: undefined, productId: undefined });

      if (conversationId) {
        navigation.navigate('Conversation', { conversationId });
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible d\'ouvrir cette conversation');
    } finally {
      setCreatingConversation(false);
    }
  }, [creatingConversation, isAuthenticated, navigation, route?.params?.productId, route?.params?.sellerId]);

  // Au focus : pas de spinner, et pas de requête si la liste est récente (le socket l'a tenue à jour)
  useFocusEffect(
    useCallback(() => {
      if (!lastLoadRef.current || Date.now() - lastLoadRef.current > STALE_MS) {
        loadConversations();
      }
      openConversationFromRouteParams();
    }, [loadConversations, openConversationFromRouteParams])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  // ── Recherche & filtres ──────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, conv) => sum + (Number(conv?.unreadCount) > 0 ? 1 : 0), 0),
    [conversations]
  );

  const rows = useMemo(() => {
    const q = foldText(query).trim();
    const visible = conversations.filter((conv) => {
      const role = roleOf(conv, currentUserId);
      if (filter === 'unread' && !(Number(conv?.unreadCount) > 0)) return false;
      if (filter === 'buying' && role !== 'buyer') return false;
      if (filter === 'selling' && role !== 'seller') return false;
      if (!q) return true;
      const peer = getOtherParticipant(conv, currentUserId);
      return foldText(`${peer?.businessName || ''} ${peer?.name || ''} ${conv?.item?.title || ''} ${conv?.lastMessage?.content || ''}`).includes(q);
    });
    // Regroupement par période, en-têtes intercalés
    const out = [];
    let current = null;
    visible.forEach((conv) => {
      const bucket = dayBucket(conv?.lastMessage?.timestamp || conv?.updatedAt);
      if (bucket !== current) {
        current = bucket;
        out.push({ kind: 'header', key: `h:${bucket}`, label: bucket });
      }
      out.push({ kind: 'conv', key: String(conv.id), conv });
    });
    return out;
  }, [conversations, currentUserId, filter, query]);

  const counts = useMemo(() => {
    let buying = 0;
    let selling = 0;
    conversations.forEach((conv) => {
      const role = roleOf(conv, currentUserId);
      if (role === 'buyer') buying += 1;
      else if (role === 'seller') selling += 1;
    });
    return { all: conversations.length, unread: unreadTotal, buying, selling };
  }, [conversations, currentUserId, unreadTotal]);

  const selectFilter = (value) => {
    Haptics.selectionAsync().catch(() => {});
    setFilter(value);
  };

  const openConversation = useCallback((id) => {
    navigation.navigate('Conversation', { conversationId: id });
  }, [navigation]);

  const renderRow = ({ item: row }) => {
    if (row.kind === 'header') {
      return <Text style={styles.sectionLabel}>{row.label}</Text>;
    }
    const conv = row.conv;
    const peer = getOtherParticipant(conv, currentUserId);
    const peerId = peer?.id || peer?._id;
    return (
      <ConversationRow
        conv={conv}
        peer={peer}
        online={peerId ? isUserOnline(String(peerId)) : false}
        mine={isCurrentUserMessage(conv?.lastMessage, user, currentUserId)}
        role={roleOf(conv, currentUserId)}
        styles={styles}
        isDark={isDark}
        theme={theme}
        onPress={openConversation}
      />
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          styles={styles}
          icon="chatbubbles"
          title="Vos messages"
          text="Connectez-vous pour discuter avec les vendeurs et les acheteurs, sans partager votre numéro."
          action="Se connecter"
          onAction={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'messages' }, returnScreen: 'Messages' })}
        />
      </View>
    );
  }

  const filtersList = [
    { value: 'all', label: 'Toutes', count: counts.all },
    { value: 'unread', label: 'Non lues', count: counts.unread, hot: true },
    { value: 'buying', label: 'Mes achats', count: counts.buying },
    { value: 'selling', label: 'Mes ventes', count: counts.selling },
  ];

  const emptyForFilter = query
    ? { icon: 'search', title: 'Aucun résultat', text: `Rien ne correspond à « ${query} ».`, action: 'Effacer la recherche', onAction: () => setQuery('') }
    : filter === 'unread'
      ? { icon: 'checkmark-done', title: 'Tout est lu', text: 'Vous avez répondu à tout le monde. Bravo !', action: 'Voir toutes les conversations', onAction: () => setFilter('all') }
      : filter === 'buying'
        ? { icon: 'bag-handle', title: 'Aucun achat en cours', text: 'Contactez un vendeur depuis une annonce : la discussion apparaîtra ici.', action: 'Découvrir les annonces', onAction: () => navigation.navigate('Home') }
        : filter === 'selling'
          ? { icon: 'pricetag', title: 'Aucune vente en cours', text: 'Quand un acheteur vous écrit au sujet d\'une annonce, la discussion apparaît ici.', action: 'Publier une annonce', onAction: () => navigation.navigate('Publish') }
          : { icon: 'chatbubbles', title: 'Aucune conversation', text: 'Trouvez une annonce qui vous plaît et écrivez au vendeur : vos échanges apparaîtront ici.', action: 'Découvrir les annonces', onAction: () => navigation.navigate('Home') };

  return (
    <View style={styles.container}>
      {/* ── En-tête ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={styles.statusRow}>
              <View style={[styles.liveDot, { backgroundColor: isConnected ? P.green : theme.iconMuted }]} />
              <Text style={styles.headerSub}>
                {unreadTotal > 0
                  ? `${unreadTotal} conversation${unreadTotal > 1 ? 's' : ''} non lue${unreadTotal > 1 ? 's' : ''}`
                  : conversations.length ? 'Tout est lu' : 'Messagerie sécurisée TakTak'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.iconMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un nom, une annonce…"
            placeholderTextColor={theme.textSoft}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={theme.iconMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {filtersList.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => selectFilter(f.value)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{f.label}</Text>
                {f.count > 0 ? (
                  <View style={[styles.chipCount, active ? styles.chipCountActive : f.hot && styles.chipCountHot]}>
                    <Text style={[styles.chipCountTxt, (active || f.hot) && { color: active ? P.terra : P.white }]}>
                      {f.count > 99 ? '99+' : f.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <Pressable style={styles.errorCard} onPress={onRefresh}>
          <Ionicons name="cloud-offline-outline" size={18} color={P.error} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          <Text style={styles.errorRetry}>Réessayer</Text>
        </Pressable>
      ) : null}

      {loading || creatingConversation ? (
        <SkeletonList styles={styles} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={[rows.length === 0 && { flexGrow: 1 }, { paddingBottom: Math.max(insets.bottom, 12) + 110 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.terra} colors={[P.terra]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 18 }} color={P.terra} /> : null}
          ListEmptyComponent={<EmptyState styles={styles} {...emptyForFilter} />}
        />
      )}
    </View>
  );
}

// ─── Ligne de conversation ───────────────────────────────────────────────────
const ConversationRow = memo(function ConversationRow({ conv, peer, online, mine, role, styles, isDark, theme, onPress }) {
  const unread = Number(conv?.unreadCount || 0);
  const last = conv?.lastMessage || null;
  const name = peer?.businessName || peer?.name || 'Utilisateur';
  const itemImage = conv?.item?.image || conv?.item?.mainImage || null;
  const price = conv?.item?.price;
  const deal = DEAL[conv?.deal?.status];
  const { icon: typeIcon, text: previewText } = previewOf(last);
  const tickColor = last?.read ? P.terra : theme.iconMuted;

  return (
    <Pressable
      onPress={() => onPress(conv.id)}
      android_ripple={{ color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.05)' }}
      style={({ pressed }) => [styles.row, unread > 0 && styles.rowUnread, pressed && Platform.OS === 'ios' && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}${unread ? `, ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : ''}`}
    >
      {/* Avatar + vignette de l'annonce */}
      <View style={styles.avatarWrap}>
        {peer?.avatar ? (
          <Image source={{ uri: sizedImage(peer.avatar, 56) }} style={styles.avatar} contentFit="cover" transition={150} />
        ) : (
          <LinearGradient colors={gradientFor(name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarTxt}>{getInitials(name)}</Text>
          </LinearGradient>
        )}
        {itemImage ? (
          <Image source={{ uri: sizedImage(itemImage, 26) }} style={styles.itemThumb} contentFit="cover" />
        ) : null}
        {online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>{name}</Text>
          {peer?.verified ? <Ionicons name="checkmark-circle" size={14} color="#38bdf8" style={{ marginLeft: 4 }} /> : null}
          <View style={{ flex: 1 }} />
          <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{smartTime(last?.timestamp || conv?.updatedAt)}</Text>
        </View>

        {conv?.item?.title ? (
          <View style={styles.line}>
            <View style={[styles.roleTag, role === 'seller' ? styles.roleSell : styles.roleBuy]}>
              <Text style={[styles.roleTxt, { color: role === 'seller' ? P.green : '#38bdf8' }]}>{role === 'seller' ? 'VENTE' : 'ACHAT'}</Text>
            </View>
            <Text style={styles.itemLine} numberOfLines={1}>
              {conv.item.title}
              {Number(String(price || '').replace(/[^\d]/g, '')) > 0 ? <Text style={styles.price}>{`  ·  ${formatPrice(price)}`}</Text> : null}
            </Text>
          </View>
        ) : null}

        <View style={styles.line}>
          {mine && last?.id ? (
            <Ionicons name={last?.read || last?.delivered ? 'checkmark-done' : 'checkmark'} size={16} color={tickColor} style={{ marginRight: 3 }} />
          ) : null}
          {typeIcon ? <Ionicons name={typeIcon} size={14} color={unread > 0 ? theme.text : theme.textSoft} style={{ marginRight: 4 }} /> : null}
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {previewText}
          </Text>
          {deal ? (
            <View style={[styles.dealPill, { backgroundColor: deal.bg }]}>
              <Ionicons name={deal.icon} size={11} color={deal.color} />
              <Text style={[styles.dealTxt, { color: deal.color }]}>{deal.label}</Text>
            </View>
          ) : null}
          {unread > 0 ? (
            <LinearGradient colors={[P.orange500, P.orange700]} style={styles.badge}>
              <Text style={styles.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
            </LinearGradient>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Squelettes de chargement ────────────────────────────────────────────────
function SkeletonList({ styles }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.avatar, styles.skel]} />
          <View style={[styles.body, { gap: 8 }]}>
            <View style={[styles.skel, { width: '55%', height: 13, borderRadius: 6 }]} />
            <View style={[styles.skel, { width: '75%', height: 11, borderRadius: 6 }]} />
            <View style={[styles.skel, { width: '40%', height: 11, borderRadius: 6 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

// ─── État vide ───────────────────────────────────────────────────────────────
function EmptyState({ styles, icon, title, text, action, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyHalo}>
        <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
          <Ionicons name={icon} size={34} color={P.white} />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.emptyBtnTxt}>{action}</Text>
          <Ionicons name="arrow-forward" size={16} color={P.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Utilitaires d'affichage ─────────────────────────────────────────────────
const DEAL = {
  pending_conclusion: { label: 'En attente', icon: 'hourglass-outline', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
  concluded: { label: 'Conclue', icon: 'checkmark-circle', color: '#16a34a', bg: 'rgba(34,197,94,0.14)' },
  not_concluded: { label: 'Non conclue', icon: 'close-circle', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
};

const AVATAR_GRADIENTS = [
  ['#f97316', '#c2410c'], ['#8b5cf6', '#6d28d9'], ['#0ea5e9', '#0369a1'], ['#10b981', '#047857'],
  ['#ec4899', '#be185d'], ['#f59e0b', '#b45309'], ['#6366f1', '#4338ca'], ['#14b8a6', '#0f766e'],
];

// Couleur stable par personne : on reconnaît chacun d'un coup d'œil
function gradientFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function foldText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function roleOf(conv, currentUserId) {
  const buyerId = conv?.participants?.buyer?.id || conv?.participants?.buyer?._id;
  return buyerId && String(buyerId) === String(currentUserId) ? 'buyer' : 'seller';
}

function previewOf(last) {
  if (!last) return { icon: 'sparkles-outline', text: 'Nouvelle conversation, dites bonjour !' };
  const content = String(last.content || '').replace(/^🎤\s*/, '');
  switch (last.type) {
    case 'audio': return { icon: 'mic', text: 'Message vocal' };
    case 'image': return { icon: 'image', text: content && !/^https?:/.test(content) ? content : 'Photo' };
    case 'offer': return { icon: 'pricetag', text: content || 'Offre de prix' };
    default: return { icon: null, text: content || 'Message' };
  }
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86400000;
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function dayBucket(value) {
  const d = new Date(value || 0);
  if (Number.isNaN(d.getTime())) return 'Plus ancien';
  const diff = (startOfDay(new Date()) - startOfDay(d)) / DAY;
  if (diff <= 0) return 'Aujourd\'hui';
  if (diff === 1) return 'Hier';
  if (diff < 7) return 'Cette semaine';
  if (diff < 31) return 'Ce mois-ci';
  return 'Plus ancien';
}

// « à l'instant », 14:05, Hier, lun., 2 juil., 2 juil. 2025
function smartTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const mins = (now - d) / 60000;
  if (mins >= 0 && mins < 1) return 'à l\'instant';
  const diff = (startOfDay(now) - startOfDay(d)) / DAY;
  if (diff <= 0) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff === 1) return 'Hier';
  if (diff < 7) return WEEKDAYS[d.getDay()];
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

function createStyles(theme, isDark) {
  const unreadBg = isDark ? 'rgba(236,90,19,0.07)' : '#fff7f2';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.screen },

    // En-tête
    header: { paddingHorizontal: 18, paddingBottom: 10, backgroundColor: theme.screen },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    headerTitle: { fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    headerSub: { fontSize: 13, fontWeight: '600', color: theme.textMuted },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 15,
      backgroundColor: isDark ? theme.surface : '#eef0f4',
    },
    searchInput: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 0 },

    chips: { gap: 8, paddingTop: 12, paddingRight: 18 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18,
      backgroundColor: isDark ? theme.surface : '#ffffff', borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { backgroundColor: P.terra, borderColor: P.terra },
    chipTxt: { fontSize: 13.5, fontWeight: '700', color: theme.textMuted },
    chipTxtActive: { color: P.white },
    chipCount: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass },
    chipCountActive: { backgroundColor: P.white },
    chipCountHot: { backgroundColor: P.terra },
    chipCountTxt: { fontSize: 11, fontWeight: '800', color: theme.textMuted },

    sectionLabel: {
      fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', color: theme.textSoft,
      paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6,
    },

    // Ligne
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12 },
    rowUnread: { backgroundColor: unreadBg },
    rowPressed: { backgroundColor: theme.glass },
    avatarWrap: { width: 58, height: 58 },
    avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt },
    avatarTxt: { color: P.white, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    itemThumb: {
      position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: 8,
      borderWidth: 2, borderColor: theme.screen, backgroundColor: theme.surfaceAlt,
    },
    onlineDot: {
      position: 'absolute', right: 1, top: 1, width: 14, height: 14, borderRadius: 7,
      backgroundColor: P.green, borderWidth: 2.5, borderColor: theme.screen,
    },
    body: {
      flex: 1, minWidth: 0, gap: 3, paddingBottom: 12, marginBottom: -12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    },
    line: { flexDirection: 'row', alignItems: 'center' },
    name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: theme.text, letterSpacing: -0.2 },
    nameUnread: { fontWeight: '900' },
    time: { fontSize: 12, fontWeight: '600', color: theme.textSoft, marginLeft: 8 },
    timeUnread: { color: P.terra, fontWeight: '800' },
    roleTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, marginRight: 6 },
    roleSell: { backgroundColor: 'rgba(34,197,94,0.14)' },
    roleBuy: { backgroundColor: 'rgba(56,189,248,0.14)' },
    roleTxt: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
    itemLine: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textMuted },
    price: { color: P.terra, fontWeight: '800' },
    preview: { flex: 1, fontSize: 14, color: theme.textSoft },
    previewUnread: { color: theme.text, fontWeight: '700' },
    dealPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginLeft: 6 },
    dealTxt: { fontSize: 10.5, fontWeight: '800' },
    badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    badgeTxt: { color: P.white, fontSize: 11.5, fontWeight: '900' },

    skel: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e7e9ee' },

    // Erreur
    errorCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginTop: 4, marginBottom: 6,
      padding: 12, borderRadius: 14, backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
    },
    errorText: { flex: 1, color: P.error, fontSize: 13, fontWeight: '600' },
    errorRetry: { color: P.error, fontSize: 13, fontWeight: '900' },

    // Vide
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingVertical: 48 },
    emptyHalo: {
      width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : '#fff1e8',
    },
    emptyIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
    emptyTitle: { fontSize: 21, fontWeight: '900', color: theme.text, textAlign: 'center', letterSpacing: -0.4 },
    emptyText: { fontSize: 14.5, lineHeight: 21, color: theme.textMuted, textAlign: 'center', marginTop: 8, maxWidth: 300 },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingHorizontal: 22, height: 48, borderRadius: 16,
      backgroundColor: P.terra,
    },
    emptyBtnTxt: { color: P.white, fontSize: 15, fontWeight: '800' },
  });
}
