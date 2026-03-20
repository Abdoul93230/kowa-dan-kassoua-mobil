import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { createOrGetConversation, getConversations } from '../api/messaging';
import { MOBILE_COLORS as P } from '../theme/colors';
import { useSocket } from '../hooks/useSocket';

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');

  const currentUserId = useMemo(
    () => user?.id || user?._id || null,
    [user]
  );

  const { isUserOnline, on, off } = useSocket({
    enabled: isAuthenticated,
    token,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const onConversationUpdated = (payload) => {
      const payloadConversationId = String(payload?.conversationId || '');
      if (!payloadConversationId) return;

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== payloadConversationId) return conv;

          return {
            ...conv,
            lastMessage: payload?.lastMessage || conv.lastMessage,
            unreadCount:
              typeof payload?.unreadCount === 'number'
                ? payload.unreadCount
                : conv.unreadCount,
            updatedAt: new Date().toISOString(),
          };
        })
      );
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

    on('conversation:updated', onConversationUpdated);
    on('message:read', onMessageRead);

    return () => {
      off('conversation:updated', onConversationUpdated);
      off('message:read', onMessageRead);
    };
  }, [isAuthenticated, off, on]);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setConversations([]);
      return;
    }

    try {
      setError('');
      const response = await getConversations();
      setConversations(response?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible de charger les conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadConversations();
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

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.itemCard}
        onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
      >
        <View style={styles.avatarWrap}>
          {peer?.avatar ? (
            <Image source={{ uri: peer.avatar }} style={styles.avatar} />
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

          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {mine ? 'Vous: ' : ''}
              {preview}
            </Text>
            {showReadIndicator ? (
              <View style={styles.deliveryWrap}>
                <Ionicons
                  name={lastMessage?.read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={lastMessage?.read ? P.orange500 : 'rgba(255,255,255,0.62)'}
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
              <Image source={{ uri: itemImage }} style={styles.productPreviewImage} />
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
      <LinearGradient colors={[P.charcoal, '#0d1420']} style={styles.container}>
        <View style={[styles.center, { paddingTop: insets.top + 24 }]}> 
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptySubtitle}>Connectez-vous pour lire et envoyer des messages.</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[P.charcoal, '#0d1420']} style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: '#fff',
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
    borderColor: P.charcoal,
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: P.charcoal,
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  date: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  itemTitle: {
    color: P.amber,
    marginTop: 2,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  preview: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
  },
  previewUnread: {
    color: '#ffffff',
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
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productPreviewImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  productPreviewTitle: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
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
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.72)',
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
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
});
