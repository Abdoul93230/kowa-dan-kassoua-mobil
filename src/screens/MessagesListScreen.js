import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { createOrGetConversation, getConversations } from '../api/messaging';
import { peekCache, writeCache } from '../api/cache';
import { MOBILE_COLORS as P } from '../theme/colors';
import { useSocket } from '../hooks/useSocket';
import { sizedImage } from '../utils/format';

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

function formatMessageDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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

  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const renderItem = ({ item }) => {
    const peer = getOtherParticipant(item, currentUserId);
    const peerId = peer?.id || peer?._id;
    const peerOnline = peerId ? isUserOnline(String(peerId)) : false;
    const unread = Number(item?.unreadCount || 0);
    const lastMessage = item?.lastMessage || null;
    const mine = isCurrentUserMessage(lastMessage, user, currentUserId);
    const preview = lastMessage?.content || 'Commencez la conversation';
    const timestamp = item?.lastMessage?.timestamp || item?.updatedAt;
    const itemImage = item?.item?.image || item?.item?.mainImage || null;
    const itemTitle = item?.item?.title || '';
    const showReadIndicator = Boolean(mine && lastMessage?.id);
    const dealStatus = item?.deal?.status || 'open';
    const dealLabel = {
      pending_conclusion: 'En attente de confirmation',
      concluded: 'Affaire conclue',
      not_concluded: 'Non conclue',
    }[dealStatus] || '';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.itemCard}
        onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
      >
        <View style={styles.avatarWrap}>
          {peer?.avatar ? (
            <Image source={{ uri: sizedImage(peer.avatar, 56) }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={[P.orange500, P.orange700]} style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {(peer?.name || 'U').slice(0, 1).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={[styles.onlineDot, peerOnline ? styles.onlineDotOn : styles.onlineDotOff]} />
          {unread > 0 ? <View style={styles.unreadDot} /> : null}
        </View>

        <View style={styles.contentCol}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {peer?.businessName || peer?.name || 'Utilisateur'}
            </Text>
            <Text style={styles.date}>{formatMessageDate(timestamp)}</Text>
          </View>

          {item?.item?.title ? (
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.item.title}
            </Text>
          ) : null}

          {dealLabel ? (
            <View style={[
              styles.dealBadge,
              dealStatus === 'concluded' && styles.dealBadgeConcluded,
              dealStatus === 'not_concluded' && styles.dealBadgeNotConcluded,
            ]}>
              <Text style={[
                styles.dealBadgeTxt,
                dealStatus === 'concluded' && styles.dealBadgeTxtConcluded,
                dealStatus === 'not_concluded' && styles.dealBadgeTxtNotConcluded,
              ]}>{dealLabel}</Text>
            </View>
          ) : null}

          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {mine ? 'Vous: ' : ''}
              {preview}
            </Text>
            {showReadIndicator ? (
              <View style={styles.deliveryWrap}>
                <Ionicons
                  name={lastMessage?.read || lastMessage?.delivered ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={lastMessage?.read ? P.orange500 : isDark ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.35)'}
                />
              </View>
            ) : null}
            {unread > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </View>

          {itemImage ? (
            <View style={styles.productPreviewWrap}>
              <Image source={{ uri: sizedImage(itemImage, 48) }} style={styles.productPreviewImage} />
              <Text style={styles.productPreviewTitle} numberOfLines={1}>
                {itemTitle}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated) {
    return (
      <LinearGradient colors={theme.shell} style={styles.container}>
        <View style={[styles.center, { paddingTop: insets.top + 24, paddingHorizontal: 32 }]}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(236,90,19,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="chatbubbles-outline" size={40} color={P.terra} />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: 20, marginBottom: 10 }]}>Vos messages</Text>
          <Text style={[styles.emptySubtitle, { lineHeight: 22, marginBottom: 32 }]}>
            Connectez-vous pour discuter avec les vendeurs et acheteurs, et retrouver toutes vos conversations.
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 }]}
            onPress={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'messages' }, returnScreen: 'Messages' })}
          >
            <Text style={[styles.loginButtonText, { fontSize: 16 }]}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.shell} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading || creatingConversation ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.amber} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            conversations.length === 0
              ? [styles.emptyListContainer, { paddingBottom: 120 }]
              : [styles.listContent, { paddingBottom: 120 }]
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.amber} />
          }
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={P.amber} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Aucune conversation</Text>
              <Text style={styles.emptySubtitle}>Commencez par contacter un vendeur depuis une annonce.</Text>
            </View>
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
        />
      )}
    </LinearGradient>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    listContent: {
      paddingHorizontal: 12,
      gap: 10,
    },
    itemCard: {
      flexDirection: 'row',
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 12,
      gap: 10,
    },
    avatarWrap: {
      width: 52,
      height: 52,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    avatarFallback: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    unreadDot: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: P.orange500,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    onlineDot: {
      position: 'absolute',
      right: 1,
      bottom: 1,
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    onlineDotOn: {
      backgroundColor: '#22c55e',
    },
    onlineDotOff: {
      backgroundColor: 'rgba(156,163,175,0.85)',
    },
    contentCol: {
      flex: 1,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deliveryWrap: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    date: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    itemTitle: {
      color: P.orange500,
      marginTop: 2,
      marginBottom: 4,
      fontSize: 13,
      fontWeight: '600',
    },
    dealBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(236,90,19,0.10)',
    },
    dealBadgeConcluded: {
      backgroundColor: 'rgba(34,197,94,0.14)',
    },
    dealBadgeNotConcluded: {
      backgroundColor: 'rgba(107,114,128,0.14)',
    },
    dealBadgeTxt: {
      fontSize: 11,
      fontWeight: '800',
      color: P.orange700,
    },
    dealBadgeTxtConcluded: {
      color: '#15803d',
    },
    dealBadgeTxtNotConcluded: {
      color: '#4b5563',
    },
    preview: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 14,
    },
    previewUnread: {
      color: theme.text,
      fontWeight: '700',
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: P.orange500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    productPreviewWrap: {
      marginTop: 7,
      paddingTop: 7,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    productPreviewImage: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
    },
    productPreviewTitle: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    emptyListContainer: {
      flexGrow: 1,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    loginButton: {
      marginTop: 18,
      backgroundColor: P.orange500,
      borderRadius: 12,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    loginButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    errorCard: {
      marginHorizontal: 12,
      marginBottom: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(239,68,68,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.22)',
    },
    errorText: {
      color: '#b91c1c',
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
