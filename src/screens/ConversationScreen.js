import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { peekCache, writeCache } from '../api/cache';
import ChatComposer from '../components/chat/ChatComposer';
import VoiceMessageBubble from '../components/chat/VoiceMessageBubble';
import { configureVoicePlayback, stopVoicePlayback } from '../components/chat/voicePlayback';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatKeyboardView, doneAccessory } from '../components/Keyboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import AlertModal from '../components/AlertModal';
import {
  getConversationById,
  getMessages,
  markConversationAsRead,
  closeConversationByOwner,
  reopenConversationByOwner,
  updateConversationDeal,
  sendMessage,
  sendVoiceMessage,
} from '../api/messaging';
import { checkReviewEligibility, createReview } from '../api/reviews';
import { useSocket } from '../hooks/useSocket';
import { MOBILE_COLORS as P } from '../theme/colors';
import { getInitials, sizedImage } from '../utils/format';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value.id) return normalizeId(value.id);
    if (value._id) return normalizeId(value._id);
    if (value.$oid) return normalizeId(value.$oid);
    if (typeof value.toString === 'function') {
      const out = value.toString();
      if (out && out !== '[object Object]') return out;
    }
  }
  return String(value);
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function isCurrentUserMessage(message, user, currentUserIdSet) {
  const senderCandidates = [
    message?.senderId,
    message?.sender?._id,
    message?.sender?.id,
    message?.sender,
  ];

  const isById = senderCandidates
    .map((candidate) => normalizeId(candidate))
    .some((senderId) => senderId && currentUserIdSet.has(senderId));

  if (isById) return true;

  const userName = normalizeText(user?.name);
  const senderName = normalizeText(message?.senderName);
  return Boolean(userName && senderName && userName === senderName);
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

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateSeparator(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return "Aujourd'hui";
  if (msgDay.getTime() === yesterday.getTime()) return 'Hier';
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const label = `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// Extrait un ObjectId MongoDB valide depuis une string, qu'elle soit déjà propre
// ("6999bb4e03ca4663075dce09") ou au format JS stringifié ("ObjectId('...')")
function extractMongoId(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  // Format propre : 24 caractères hex
  if (/^[a-fA-F0-9]{24}$/.test(str)) return str;
  // Format stringifié : ObjectId('...') ou ObjectId("...")
  const match = str.match(/ObjectId\(['"]?([a-fA-F0-9]{24})['"]?\)/i);
  if (match) return match[1];
  return null;
}

function formatPriceFCFA(value) {
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Prix a discuter';
  return `${Math.round(numeric).toLocaleString('fr-FR')} FCFA`;
}

function getDealPresentation(status) {
  switch (status) {
    case 'pending_conclusion':
      return { label: 'En attente de confirmation', tone: 'pending' };
    case 'concluded':
      return { label: 'Affaire conclue', tone: 'success' };
    case 'not_concluded':
      return { label: 'Non conclue', tone: 'muted' };
    default:
      return { label: 'Aucune clôture', tone: 'neutral' };
  }
}


const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 560);

function ReviewBottomSheet({
  visible,
  onClose,
  theme,
  item,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  submittingReview,
  onSubmit,
  insets,
}) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const RATING_LABELS = ['', 'Très déçu 😞', 'Déçu 😕', 'Correct 😐', 'Bien 😊', 'Excellent ! 🤩'];

  const openSheet = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const closeSheet = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
      else onClose();
    });
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
      openSheet();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.6) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => closeSheet()}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={() => closeSheet()}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
            opacity: backdropOpacity,
          }}
        />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: theme.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: Math.max(insets?.bottom ?? 0, 20),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {/* Handle draggable */}
          <View {...panResponder.panHandlers} style={{ paddingVertical: 14, alignItems: 'center' }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#d1d5db' }} />
          </View>

          <View style={{ paddingHorizontal: 24 }}>
            {/* Titre + fermer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: theme.text }}>
                Donner un avis
              </Text>
              <TouchableOpacity
                onPress={() => closeSheet()}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18, color: theme.textMuted, lineHeight: 22, marginTop: -1 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Produit */}
            {item && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                marginBottom: 24, padding: 14,
                borderRadius: 16,
                backgroundColor: 'rgba(236,90,19,0.07)',
                borderWidth: 1, borderColor: 'rgba(236,90,19,0.15)',
              }}>
                <Image
                  source={{ uri: sizedImage(item.image, 56) || 'https://via.placeholder.com/56' }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: P.orange500, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                    Votre avis sur
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              </View>
            )}

            {/* Question + étoiles */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, textAlign: 'center', marginBottom: 16 }}>
              Quelle note donnez-vous ?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  activeOpacity={0.6}
                  style={{ padding: 4 }}
                >
                  <Animated.Text
                    style={{
                      fontSize: 46,
                      color: reviewRating >= star ? '#f59e0b' : (theme.textMuted || '#d1d5db'),
                      lineHeight: 52,
                    }}
                  >
                    ★
                  </Animated.Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Label note */}
            <View style={{ height: 22, marginBottom: 20, alignItems: 'center' }}>
              {reviewRating > 0 && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#f59e0b' }}>
                  {RATING_LABELS[reviewRating]}
                </Text>
              )}
            </View>

            {/* Champ commentaire */}
            <View style={{
              borderWidth: 1.5,
              borderColor: reviewComment.length > 0 ? P.orange500 : (theme.border || '#e5e7eb'),
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 6,
            }}>
              <TextInput
                style={{
                  color: theme.text,
                  backgroundColor: theme.surfaceAlt || 'rgba(0,0,0,0.03)',
                  fontSize: 14,
                  padding: 12,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                placeholder="Décrivez votre expérience (facultatif)"
                placeholderTextColor={theme.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                {...doneAccessory} multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginBottom: 24 }}>
              {reviewComment.length}/500
            </Text>

            {/* Boutons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => closeSheet()}
                activeOpacity={0.8}
                style={{
                  flex: 1, height: 50, borderRadius: 14,
                  borderWidth: 1.5, borderColor: theme.border || '#e5e7eb',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textMuted }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSubmit}
                disabled={reviewRating === 0 || submittingReview}
                activeOpacity={0.85}
                style={{
                  flex: 2, height: 50, borderRadius: 14,
                  backgroundColor: reviewRating === 0 ? '#d1d5db' : P.orange500,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: P.orange500,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: reviewRating > 0 ? 0.35 : 0,
                  shadowRadius: 8,
                  elevation: reviewRating > 0 ? 4 : 0,
                }}
              >
                {submittingReview
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Publier mon avis</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ConversationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { conversationId } = route.params || {};
  const { user, token, isAuthenticated } = useAuth();
  const { isDark, theme } = useAppTheme();

  // Réouverture instantanée : derniers messages gardés en mémoire pour la session,
  // et en-tête pré-rempli depuis la liste des conversations
  const currentUserKey = String(user?.id || user?._id || '');
  const messagesCacheKey = `messages:${currentUserKey}:${conversationId}`;
  const cachedThread = peekCache(messagesCacheKey)?.data;
  const listConversation = cachedThread?.conversation
    || peekCache(`conversations:${currentUserKey}`)?.data?.items?.find((conv) => String(conv.id) === String(conversationId))
    || null;

  const [conversation, setConversation] = useState(listConversation);
  const [messages, setMessages] = useState(cachedThread?.messages || []);
  const [loading, setLoading] = useState(!cachedThread);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(Boolean(cachedThread?.hasMore));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [dealActionLoading, setDealActionLoading] = useState(false);
  const [ownerClosureLoading, setOwnerClosureLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [reviewEligible, setReviewEligible] = useState(false);
  const [checkingReviewEligibility, setCheckingReviewEligibility] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  // Clavier ouvert : garder les derniers messages visibles au-dessus de la zone de saisie
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => { } }],
  });

  const currentUserId = useMemo(() => user?.id || user?._id || '', [user]);
  const currentUserNormalizedId = useMemo(() => normalizeId(user?.id || user?._id), [user]);
  const currentUserIdSet = useMemo(() => {
    const ids = new Set();
    const uid = normalizeId(user?.id);
    const uoid = normalizeId(user?._id);
    if (uid) ids.add(uid);
    if (uoid) ids.add(uoid);

    return ids;
  }, [user]);

  const typingTimeoutRef = useRef(null);
  const flatListRef = useRef(null);
  const messagesRef = useRef([]);
  messagesRef.current = messages;
  // Liste inversée : le plus récent en premier (affiché en bas)
  const listData = useMemo(() => [...messages].reverse(), [messages]);

  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1600);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);
  // Dans une liste inversée, « le plus récent » est à l'offset 0
  const scrollToLatest = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);
  const initialScrollDoneRef = useRef(false);
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const {
    isConnected,
    on,
    off,
    joinConversation,
    leaveConversation,
    sendRealtimeMessage,
    startTyping,
    stopTyping,
    isUserOnline,
  } = useSocket({
    enabled: Boolean(token),
    token,
  });

  // Lecture : UN appel groupé pour toute la conversation (avant : un événement socket par
  // message non lu, chacun déclenchant plusieurs écritures et un rechargement du badge).
  // Le serveur pousse ensuite le nouveau total de non-lus : le badge se met à jour seul.
  const markReadTimerRef = useRef(null);
  const markAsRead = useCallback((delayMs = 0) => {
    if (!conversationId) return;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markReadTimerRef.current = null;
      markConversationAsRead(conversationId).catch(() => { });
      DeviceEventEmitter.emit('conversation:read', { conversationId });
    }, delayMs);
  }, [conversationId]);

  useEffect(() => () => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
  }, []);

  // Rechargement silencieux : la conversation reste affichée pendant la mise à jour
  const loadConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      setError('');
      const [conversationResponse, messagesResponse] = await Promise.all([
        getConversationById(conversationId),
        getMessages(conversationId),
      ]);

      const loadedConversation = conversationResponse?.data || null;
      const loadedMessages = messagesResponse?.data || [];

      setConversation(loadedConversation);
      // Garder les messages arrivés en direct (ou en cours d'envoi) pendant le chargement
      setMessages((prev) => {
        const loadedIds = new Set(loadedMessages.map((m) => String(m.id)));
        const newest = loadedMessages[loadedMessages.length - 1];
        const newestTime = newest ? new Date(newest.timestamp).getTime() : 0;
        const live = prev.filter((m) => !loadedIds.has(String(m.id)) && new Date(m.timestamp).getTime() > newestTime);
        return live.length ? [...loadedMessages, ...live] : loadedMessages;
      });
      setHasMoreMessages(Boolean(messagesResponse?.pagination?.hasMore));

      const hasUnread = Number(loadedConversation?.unreadCount || 0) > 0
        || loadedMessages.some((msg) => !msg.read && !isCurrentUserMessage(msg, user, currentUserIdSet));
      if (hasUnread) markAsRead();
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible de charger la conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId, currentUserIdSet, markAsRead]);

  // Messages plus anciens : curseur = id du plus ancien message affiché
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMoreMessages) return;
    const oldest = messagesRef.current.find((m) => /^[0-9a-fA-F]{24}$/.test(String(m.id)));
    if (!oldest) return;
    try {
      setLoadingOlder(true);
      const response = await getMessages(conversationId, { before: oldest.id });
      const older = response?.data || [];
      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)));
          const unique = older.filter((m) => !existingIds.has(String(m.id)));
          return [...unique, ...prev];
        });
      }
      setHasMoreMessages(Boolean(response?.pagination?.hasMore) && older.length > 0);
    } catch (e) {
      // silently ignore pagination errors
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMoreMessages, loadingOlder]);

  // Derniers messages gardés en mémoire : la prochaine ouverture est instantanée
  useEffect(() => {
    if (!conversationId || loading) return;
    const recent = messages.slice(-60);
    writeCache(messagesCacheKey, {
      messages: recent,
      hasMore: hasMoreMessages || messages.length > recent.length,
      conversation,
    });
  }, [conversation, conversationId, hasMoreMessages, loading, messages, messagesCacheKey]);

  useFocusEffect(
    useCallback(() => {
      // Auth Guard
      if (!isAuthenticated) {
        navigation.navigate('QuickAuth', {
          pendingAction: { type: 'message_conversation', conversationId },
          returnScreen: 'Conversation',
          returnParams: { conversationId },
        });
        return;
      }
      if (!messagesRef.current.length) setLoading(true);
      loadConversation();
    }, [loadConversation, isAuthenticated, navigation, conversationId])
  );

  useEffect(() => {
    if (!conversationId || !isConnected) return;

    joinConversation(conversationId);

    const onMessage = (message) => {
      if (message?.conversationId !== conversationId) return;

      setMessages((prev) => {
        const alreadyExists = prev.some((m) => String(m.id) === String(message.id));
        if (alreadyExists) return prev;
        return [...prev, message];
      });

      // Plusieurs messages reçus d'affilée → un seul appel « lu »
      if (!isCurrentUserMessage(message, user, currentUserIdSet)) {
        markAsRead(800);
      }
    };

    const onMessageRead = ({ conversationId: payloadConversationId, messageId, readAt }) => {
      if (payloadConversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.id) === String(messageId)
            ? { ...msg, delivered: true, deliveredAt: readAt || msg.deliveredAt, read: true, readAt }
            : msg
        )
      );
    };

    const onMessageDelivered = ({ conversationId: payloadConversationId, messageId, deliveredAt }) => {
      if (payloadConversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.id) === String(messageId)
            ? { ...msg, delivered: true, deliveredAt: deliveredAt || msg.deliveredAt }
            : msg
        )
      );
    };

    const onTypingStart = ({ conversationId: payloadConversationId, userId, userName }) => {
      if (payloadConversationId !== conversationId) return;
      if (String(userId) === String(currentUserId)) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: userName || 'Quelqu\'un' }));
    };

    const onTypingStop = ({ conversationId: payloadConversationId, userId }) => {
      if (payloadConversationId !== conversationId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };
    const onConversationUpdated = (payload) => {
      const payloadConversationId = String(payload?.conversationId || payload?.id || '');
      if (payloadConversationId !== String(conversationId || '')) return;

      // Update conversation state
      setConversation((prev) => {
        if (!prev) return prev;

        const next = {
          ...prev,
          lastMessage: payload?.lastMessage || prev.lastMessage,
          unreadCount:
            typeof payload?.unreadCount === 'number'
              ? payload.unreadCount
              : prev.unreadCount,
          status: payload?.status || prev.status,
          closedByOwner:
            typeof payload?.closedByOwner === 'boolean'
              ? payload.closedByOwner
              : prev.closedByOwner,
          closedAt: payload?.closedAt || prev.closedAt || null,
          closedById: payload?.closedById || prev.closedById || null,
          deal: payload?.deal || prev.deal,
        };

        return next;
      });
    };

    on('message:new', onMessage);
    on('message:delivered', onMessageDelivered);
    on('message:read', onMessageRead);
    on('typing:start', onTypingStart);
    on('typing:stop', onTypingStop);
    on('conversation:updated', onConversationUpdated);

    return () => {
      off('message:new', onMessage);
      off('message:delivered', onMessageDelivered);
      off('message:read', onMessageRead);
      off('typing:start', onTypingStart);
      off('typing:stop', onTypingStop);
      off('conversation:updated', onConversationUpdated);
      leaveConversation(conversationId);
    };
  }, [
    conversationId,
    currentUserIdSet,
    isConnected,
    joinConversation,
    leaveConversation,
    markAsRead,
    off,
    on,
  ]);

  // Nouveau message envoyé par nous → retour en bas de la conversation.
  // (Liste inversée : à l'ouverture, on est déjà sur les plus récents sans défilement.)
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage ? String(lastMessage.id) : '';
  const lastIsMine = lastMessage ? isCurrentUserMessage(lastMessage, user, currentUserIdSet) : false;
  useEffect(() => {
    if (lastMessageId && lastIsMine) scrollToLatest(true);
  }, [lastMessageId, lastIsMine, scrollToLatest]);

  // L'interlocuteur écrit : l'indicateur apparaît en bas
  useEffect(() => {
    if (Object.keys(typingUsers).length > 0) scrollToLatest(true);
  }, [typingUsers, scrollToLatest]);

  // Vérifier l'éligibilité à laisser un avis (si conversation fermée par vendeur)
  useEffect(() => {
    const checkEligibility = async () => {
      if (!conversation?.closedByOwner || !conversation?.item?.id) {
        setReviewEligible(false);
        return;
      }

      try {
        setCheckingReviewEligibility(true);
        const productId = extractMongoId(conversation.item?.id);

        if (productId) {
          const response = await checkReviewEligibility(productId);
          setReviewEligible(response?.eligible || false);
          // console.log('✅ Éligibilité à laisser un avis:', response);
        }
      } catch (error) {
        console.error('❌ Erreur vérification éligibilité avis:', error);
        setReviewEligible(false);
      } finally {
        setCheckingReviewEligibility(false);
      }
    };

    checkEligibility();
  }, [conversation?.closedByOwner, conversation?.item?.id]);

  const stopAudioPlayback = useCallback(() => stopVoicePlayback(), []);

  // Lecteur vocal : enchaîne le vocal suivant s'il suit directement, erreurs en alerte
  useEffect(() => {
    configureVoicePlayback({
      getNext: (messageId) => {
        const list = messagesRef.current;
        const index = list.findIndex((m) => String(m.id) === messageId);
        const next = index >= 0 ? list[index + 1] : null;
        return next?.type === 'audio' && next?.attachments?.[0] ? next : null;
      },
      onError: (message) => setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message,
        buttons: [{ text: 'OK', onPress: () => { } }],
      }),
    });
    return () => configureVoicePlayback();
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  // Envoi d'un message vocal enregistré par <ChatComposer>
  const sendVoice = async (uri, durationMs) => {
    if (!conversationId || !uri) return;

    try {
      setSendingVoice(true);
      const response = await sendVoiceMessage(conversationId, uri, durationMs);
      const voiceMessage = response?.data;

      if (voiceMessage) {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m.id) === String(voiceMessage.id));
          if (exists) return prev;
          return [...prev, voiceMessage];
        });
      }
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e?.response?.data?.message || 'Impossible d\'envoyer le message vocal.',
        buttons: [{ text: 'OK', onPress: () => { } }],
      });
    } finally {
      setSendingVoice(false);
    }
  };

  const onComposerChange = (value) => {
    setText(value);

    if (!conversationId) return;

    if (value.trim()) {
      startTyping(conversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 1200);
    } else {
      stopTyping(conversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const onComposerFocus = () => {
    setTimeout(() => scrollToLatest(true), 100);
  };

  const onSend = async () => {
    const content = text.trim();
    if (!content || sending || !conversationId) return;

    try {
      setError('');
      setSending(true);
      setText('');
      stopTyping(conversationId);

      if (isConnected) {
        sendRealtimeMessage({
          conversationId,
          content,
          type: 'text',
          attachments: [],
        });
      } else {
        const response = await sendMessage({
          conversationId,
          content,
          type: 'text',
          attachments: [],
        });
        const fallbackMessage = response?.data;
        if (fallbackMessage) {
          setMessages((prev) => [...prev, fallbackMessage]);
        }
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible d\'envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  const peer = getOtherParticipant(conversation, currentUserId);
  const headerDealStatus = conversation?.deal?.status || 'open';
  const headerDealLabel = (getDealPresentation(headerDealStatus) || {}).label || 'Aucune clôture';


  const typingLabel = Object.values(typingUsers)[0] || '';
  const peerId = peer?.id || peer?._id;
  const peerIsOnline = peerId ? isUserOnline(String(peerId)) : false;
  const conversationItem = conversation?.item || null;

  // En-tête : photo, nom, statut en direct (en ligne / écrit…) ; toucher → profil
  useEffect(() => {
    const name = peer?.businessName || peer?.name || 'Conversation';
    const status = typingLabel ? 'écrit…' : !isConnected ? 'Connexion…' : peerIsOnline ? 'En ligne' : 'Hors ligne';
    const statusColor = typingLabel ? P.terra : peerIsOnline && isConnected ? '#22c55e' : theme.textSoft;
    navigation.setOptions({
      headerShown: true,
      headerTitleAlign: 'left',
      headerTitle: () => (
        <Pressable
          onPress={() => { if (peerId) navigation.navigate('SellerProfile', { sellerId: String(peerId) }); }}
          style={styles.headerPeer}
          accessibilityRole="button"
          accessibilityLabel={`Voir le profil de ${name}`}
        >
          <View>
            {peer?.avatar ? (
              <Image source={{ uri: sizedImage(peer.avatar, 40) }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <LinearGradient colors={[P.orange500, P.orange700]} style={styles.headerAvatar}>
                <Text style={styles.headerAvatarTxt}>{getInitials(name)}</Text>
              </LinearGradient>
            )}
            {peerIsOnline && isConnected ? <View style={styles.headerAvatarDot} /> : null}
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerTitleText} numberOfLines={1}>{name}</Text>
              {peer?.verified ? <Ionicons name="checkmark-circle" size={14} color="#38bdf8" /> : null}
            </View>
            <Text style={[styles.headerStatusText, { color: statusColor }]} numberOfLines={1}>{status}</Text>
          </View>
        </Pressable>
      ),
      headerStyle: { backgroundColor: theme.surface, shadowColor: theme.shadow },
      headerTintColor: theme.text,
    });
  }, [navigation, peer?.businessName, peer?.name, peer?.avatar, peer?.verified, peerId, theme, styles, peerIsOnline, isConnected, typingLabel]);
  const conversationItemId = normalizeId(conversationItem?.id);
  const canOpenConversationItem = Boolean(conversationItemId);

  const openConversationItem = useCallback(() => {
    if (!conversationItemId) {
      setAlert({
        visible: true,
        type: 'info',
        title: 'Annonce indisponible',
        message: 'Impossible d\'ouvrir cette annonce pour le moment.',
        buttons: [{ text: 'OK', onPress: () => { } }],
      });
      return;
    }
    const productId = extractMongoId(conversation?.item?.id);
    navigation.navigate('ProductDetail', { productId });
  }, [conversationItemId, navigation]);

  const dealStatus = conversation?.deal?.status || 'open';
  const dealPresentation = getDealPresentation(dealStatus) || {};
  const dealLabel = dealPresentation.label || 'Aucune clôture';
  const dealRequestedBy = conversation?.deal?.requestedBy ? String(conversation.deal.requestedBy) : '';
  const isDealRequester = Boolean(dealRequestedBy && dealRequestedBy === String(currentUserNormalizedId || ''));
  const isConversationSeller = Boolean(
    String(conversation?.participants?.seller?.id || conversation?.participants?.seller?._id || '') ===
    String(currentUserNormalizedId || '')
  );
  const isOwnerClosureActive = Boolean(conversation?.closedByOwner);
  const canManageOwnerClosure = isConversationSeller;

  const toggleOwnerClosure = useCallback(async () => {
    if (!conversationId || ownerClosureLoading || !canManageOwnerClosure) return;

    const previousConversation = conversation;
    try {
      setOwnerClosureLoading(true);
      // optimistic system message (temporary id)
      const optimisticId = `sys-closure-optimistic-${Date.now()}`;
      addClosureSystemMessage(true ? !isOwnerClosureActive : isOwnerClosureActive, new Date().toISOString(), optimisticId);

      const response = isOwnerClosureActive
        ? await reopenConversationByOwner(conversationId)
        : await closeConversationByOwner(conversationId);

      const updatedConversation = response?.data?.id
        ? response.data
        : response?.id
          ? response
          : response?.data || null;

      if (updatedConversation) {
        setConversation(updatedConversation);
        try {
          addClosureSystemMessage(Boolean(updatedConversation.closedByOwner), updatedConversation.closedAt || null);
        } catch (e) {}
      } else {
        const refreshed = await getConversationById(conversationId);
        if (refreshed?.data) {
          setConversation(refreshed.data);
          try {
            addClosureSystemMessage(Boolean(refreshed.data.closedByOwner), refreshed.data.closedAt || null);
          } catch (e) {}
        }
      }
    } catch (e) {
      setConversation(previousConversation || null);
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e?.response?.data?.message || 'Impossible de mettre à jour la clôture de la discussion.',
        buttons: [{ text: 'OK', onPress: () => { } }],
      });
    } finally {
      setOwnerClosureLoading(false);
    }
  }, [canManageOwnerClosure, conversation, conversationId, isOwnerClosureActive, ownerClosureLoading]);

  // Insert a chronological system message for closure/reopen actions (local optimistic updates)
  const addClosureSystemMessage = useCallback((closed, ts = null, id = null) => {
    try {
      const time = ts || new Date().toISOString();
      const sysId = id || `sys-closure-${time}`;
      const text = closed ? 'Discussion clôturée' : 'Discussion rouverte';

      setMessages((prevMsgs) => {
        if (prevMsgs.some((m) => m.systemId === sysId)) return prevMsgs;
        const sysMsg = {
          id: sysId,
          systemId: sysId,
          content: text,
          type: 'system',
          timestamp: time,
        };

        const idx = prevMsgs.findIndex((m) => {
          const mt = m?.timestamp || m?.createdAt || null;
          if (!mt) return false;
          return new Date(mt).getTime() > new Date(time).getTime();
        });

        if (idx === -1) return [...prevMsgs, sysMsg];
        return [...prevMsgs.slice(0, idx), sysMsg, ...prevMsgs.slice(idx)];
      });
    } catch (e) {
      // noop
    }
  }, []);

  const replaceOptimisticSystemMessage = useCallback((optimisticId, permanentId, closed, permTs = null) => {
    try {
      setMessages((prevMsgs) => {
        const permExists = prevMsgs.some((m) => m.systemId === permanentId);
        if (permExists) {
          return prevMsgs.filter((m) => m.systemId !== optimisticId);
        }

        const found = prevMsgs.findIndex((m) => m.systemId === optimisticId);
        if (found === -1) {
          const time = permTs || new Date().toISOString();
          const text = closed ? 'Discussion clôturée' : 'Discussion rouverte';
          const sysMsg = { id: permanentId, systemId: permanentId, content: text, type: 'system', timestamp: time };
          return [...prevMsgs, sysMsg];
        }

        const newMsgs = [...prevMsgs];
        const time = permTs || new Date().toISOString();
        newMsgs[found] = { ...newMsgs[found], id: permanentId, systemId: permanentId, content: closed ? 'Discussion clôturée' : 'Discussion rouverte', timestamp: time };
        return newMsgs;
      });
    } catch (e) {
      // noop
    }
  }, []);

  const submitReview = useCallback(async () => {
    if (reviewRating === 0 || submittingReview) return;
    const productId = extractMongoId(conversation?.item?.id);
    if (!productId) return;
    try {
      setSubmittingReview(true);
      await createReview({ productId, rating: reviewRating, comment: reviewComment.trim() });
      setReviewModalVisible(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewEligible(false);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Merci !',
        message: 'Votre avis a bien été publié.',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e?.message || 'Impossible de publier votre avis.',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setSubmittingReview(false);
    }
  }, [reviewRating, reviewComment, submittingReview, conversation?.item?.id]);

  const openDealActions = () => {
    const buttons = [];

    if (dealStatus === 'open' && isConversationSeller) {
      buttons.push({
        text: 'Marquer comme conclue',
        onPress: () => handleDealAction('request'),
      });
    }

    if (dealStatus === 'pending_conclusion') {
      if (isDealRequester) {
        buttons.push({
          text: 'Annuler la demande',
          onPress: () => handleDealAction('reopen'),
        });
      } else if (!isConversationSeller) {
        buttons.push({ text: 'Confirmer', onPress: () => handleDealAction('confirm') });
        buttons.push({ text: 'Non conclue', onPress: () => handleDealAction('reject') });
      }
    }

    if ((dealStatus === 'concluded' || dealStatus === 'not_concluded') && isConversationSeller) {
      buttons.push({
        text: 'Réouvrir',
        onPress: () => handleDealAction('reopen'),
      });
    }

    buttons.push({ text: 'Fermer', onPress: () => { } });

    setAlert({
      visible: true,
      type: dealStatus === 'concluded' ? 'success' : dealStatus === 'not_concluded' ? 'warning' : 'info',
      title: 'Statut de l\'affaire',
      message: dealLabel,
      buttons,
    });
  };

  const applyDealTransition = useCallback((currentDeal, action) => {
    const now = new Date().toISOString();
    const safeDeal = currentDeal || { status: 'open' };

    if (action === 'request') {
      return {
        ...safeDeal,
        status: 'pending_conclusion',
        requestedBy: String(currentUserNormalizedId || ''),
        requestedAt: now,
      };
    }

    if (action === 'confirm') {
      return {
        ...safeDeal,
        status: 'concluded',
        resolvedBy: String(currentUserNormalizedId || ''),
        resolvedAt: now,
      };
    }

    if (action === 'reject' || action === 'decline') {
      return {
        ...safeDeal,
        status: 'not_concluded',
        resolvedBy: String(currentUserNormalizedId || ''),
        resolvedAt: now,
      };
    }

    return {
      status: 'open',
      requestedBy: null,
      requestedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      note: '',
    };
  }, [currentUserNormalizedId]);

  const handleDealAction = useCallback(async (action) => {
    if (!conversationId || dealActionLoading) return;

    const previousConversation = conversation;

    // Update optimiste pour feedback instantane
    setConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        deal: applyDealTransition(prev.deal, action),
      };
    });
    try {
      setDealActionLoading(true);
      const response = await updateConversationDeal(conversationId, action);
      const updatedConversation = response?.data?.id
        ? response.data
        : response?.id
          ? response
          : response?.data || null;

      if (updatedConversation) {
        setConversation(updatedConversation);
      } else {
        const refreshed = await getConversationById(conversationId);
        if (refreshed?.data) setConversation(refreshed.data);
      }
    } catch (e) {
      setConversation(previousConversation || null);
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: e?.response?.data?.message || 'Impossible de mettre à jour le statut de l\'affaire.',
        buttons: [{ text: 'OK', onPress: () => { } }],
      });
    } finally {
      setDealActionLoading(false);
    }
  }, [conversationId, dealActionLoading, conversation, applyDealTransition]);

  // Deux messages consécutifs du même auteur, à moins de 5 min, forment un groupe
  const isSystemItem = (m) => m?.type === 'system' || Boolean(m?.systemId);
  const sameGroup = (a, b) => Boolean(
    a && b && !isSystemItem(a) && !isSystemItem(b) &&
    isCurrentUserMessage(a, user, currentUserIdSet) === isCurrentUserMessage(b, user, currentUserIdSet) &&
    isSameDay(a.timestamp, b.timestamp) &&
    Math.abs(new Date(a.timestamp) - new Date(b.timestamp)) < 5 * 60000
  );

  const copyMessage = async (content) => {
    if (!content) return;
    try {
      await Clipboard.setStringAsync(String(content));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      showToast('Message copié');
    } catch (e) { /* presse-papiers indisponible */ }
  };

  const renderDateSeparator = (timestamp) => (
    <View style={styles.dateSeparatorWrap}>
      <Text style={styles.dateSeparatorText}>{formatDateSeparator(timestamp)}</Text>
    </View>
  );

  const renderMessage = ({ item, index }) => {
    const older = listData[index + 1] || null; // liste inversée : l'index suivant est plus ancien
    const newer = index > 0 ? listData[index - 1] : null;
    const showDateSeparator = !isSameDay(item?.timestamp, older?.timestamp);

    if (isSystemItem(item)) {
      return (
        <View>
          {showDateSeparator ? renderDateSeparator(item.timestamp) : null}
          <View style={styles.systemMessageWrap}>
            <Ionicons name="information-circle-outline" size={13} color={theme.textMuted} />
            <Text style={styles.systemMessageText}>{item.content || ''}</Text>
          </View>
        </View>
      );
    }

    const mine = isCurrentUserMessage(item, user, currentUserIdSet);
    const isAudio = item?.type === 'audio' && item?.attachments?.[0];
    const first = !sameGroup(item, older);
    const last = !sameGroup(item, newer);
    const time = formatTime(item.timestamp);
    const tick = mine ? (
      <Ionicons
        name={item.read || item.delivered ? 'checkmark-done' : 'checkmark'}
        size={15}
        color={item.read ? '#bae6fd' : item.delivered ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)'}
      />
    ) : null;
    // Coins arrondis partout, sauf du côté de l'auteur entre deux bulles du même groupe
    const corners = mine
      ? { borderTopRightRadius: first ? 20 : 6, borderBottomRightRadius: last ? 4 : 6 }
      : { borderTopLeftRadius: first ? 20 : 6, borderBottomLeftRadius: last ? 4 : 6 };

    const content = isAudio ? (
      <>
        <VoiceMessageBubble
          message={item}
          mine={mine}
          accent={mine ? '#fff' : P.orange500}
          trackColor={mine ? 'rgba(255,255,255,0.38)' : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)')}
          textStyle={mine ? styles.messageTextMine : styles.messageTextOther}
          playBtnStyle={mine ? styles.audioPlayBtnMine : styles.audioPlayBtn}
        />
        <View style={styles.metaRow}>
          <Text style={[styles.timeText, mine ? styles.timeTextMine : styles.timeTextOther]}>{time}</Text>
          {tick}
        </View>
      </>
    ) : (
      <>
        {/* Texte + heure : l'heure se cale à droite de la dernière ligne, ou passe dessous */}
        <View style={styles.textWrap}>
          <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>
            {item.content || ''}
          </Text>
          <View style={styles.metaInline}>
            <Text style={[styles.timeText, mine ? styles.timeTextMine : styles.timeTextOther]}>{time}</Text>
            {tick}
          </View>
        </View>
      </>
    );

    return (
      <View style={{ marginTop: first ? 10 : 2 }}>
        {showDateSeparator ? renderDateSeparator(item.timestamp) : null}
        <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
          {!mine ? (
            <View style={styles.avatarSlot}>
              {last ? (
                peer?.avatar ? (
                  <Image source={{ uri: sizedImage(peer.avatar, 28) }} style={styles.peerAvatar} contentFit="cover" />
                ) : (
                  <LinearGradient colors={[P.orange500, P.orange700]} style={styles.peerAvatarFallback}>
                    <Text style={styles.peerAvatarFallbackText}>{getInitials(peer?.businessName || peer?.name || 'U')}</Text>
                  </LinearGradient>
                )
              ) : null}
            </View>
          ) : null}
          <Pressable
            onLongPress={isAudio ? undefined : () => copyMessage(item.content)}
            delayLongPress={350}
            style={styles.bubblePress}
          >
            {mine ? (
              <LinearGradient
                colors={[P.orange500, P.orange700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubble, styles.bubbleMine, corners, isAudio && styles.bubbleAudio]}
              >
                {content}
              </LinearGradient>
            ) : (
              <View style={[styles.bubble, styles.bubbleOther, corners, isAudio && styles.bubbleAudio]}>
                {content}
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={theme.shell} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.amber} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.shell} style={styles.container}>
      {/* Mesure réelle de l'écran (sous l'en-tête) : plus de décalage codé en dur */}
      <ChatKeyboardView style={styles.container}>
        {error ? (
          <View style={styles.connectionBannerWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Carte produit fixe — hors de la zone scrollable */}
        {conversationItem ? (
          <View style={styles.itemCard}>
            <Pressable
              style={styles.itemMain}
              onPress={openConversationItem}
              disabled={!canOpenConversationItem}
              accessibilityRole="button"
              accessibilityLabel={`Voir l'annonce ${conversationItem?.title || ''}`}
            >
              {conversationItem?.image ? (
                <Image source={{ uri: sizedImage(conversationItem.image, 48) }} style={styles.itemImage} contentFit="cover" />
              ) : (
                <View style={[styles.itemImage, styles.itemImageEmpty]}>
                  <Ionicons name="pricetag" size={18} color={P.orange500} />
                </View>
              )}
              <View style={styles.itemMeta}>
                <Text numberOfLines={1} style={styles.itemTitle}>{conversationItem?.title || 'Annonce'}</Text>
                <Text style={styles.itemPrice}>{formatPriceFCFA(conversationItem?.price)}</Text>
              </View>
            </Pressable>
            {dealStatus === 'open' && isConversationSeller ? (
              <Pressable onPress={openDealActions} style={({ pressed }) => [styles.dealCta, pressed && { opacity: 0.85 }]}>
                <Ionicons name="checkmark-circle" size={15} color="#fff" />
                <Text style={styles.dealCtaTxt}>Conclure</Text>
              </Pressable>
            ) : dealStatus !== 'open' ? (
              <Pressable
                onPress={openDealActions}
                style={[
                  styles.dealPill,
                  dealStatus === 'concluded' ? styles.dealPillOk : dealStatus === 'not_concluded' ? styles.dealPillKo : styles.dealPillWait,
                ]}
              >
                <Ionicons
                  name={dealStatus === 'concluded' ? 'checkmark-circle' : dealStatus === 'not_concluded' ? 'close-circle' : 'hourglass-outline'}
                  size={13}
                  color={dealStatus === 'concluded' ? '#16a34a' : dealStatus === 'not_concluded' ? '#dc2626' : '#d97706'}
                />
                <Text style={[styles.dealPillTxt, { color: dealStatus === 'concluded' ? '#16a34a' : dealStatus === 'not_concluded' ? '#dc2626' : '#d97706' }]}>
                  {dealStatus === 'concluded' ? 'Conclue' : dealStatus === 'not_concluded' ? 'Non conclue' : (isDealRequester || isConversationSeller ? 'En attente' : 'À confirmer')}
                </Text>
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={theme.iconMuted} />
            )}
          </View>
        ) : null}

        {/* Invitation à laisser un avis si éligible */}
        {reviewEligible && conversation?.closedByOwner && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setReviewRating(0); setReviewComment(''); setReviewModalVisible(true); }}
            style={[styles.reviewInviteCard, { backgroundColor: '#fff7ed', borderColor: P.orange500 }]}
          >
            <View style={styles.reviewInviteContent}>
              <Text style={[styles.reviewInviteTitle, { color: '#92400e' }]}>⭐ Donnez votre avis</Text>
              <Text style={[styles.reviewInviteText, { color: '#b45309' }]}>
                Appuyez ici pour noter ce produit — ça prend 10 secondes.
              </Text>
            </View>
            <View style={[styles.reviewInviteBtn, { backgroundColor: P.orange500 }]}>
              <Text style={styles.reviewInviteBtnText}>Noter →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Custom bottom sheet — avis */}
        <ReviewBottomSheet
          visible={reviewModalVisible}
          onClose={() => setReviewModalVisible(false)}
          theme={theme}
          item={conversation?.item}
          reviewRating={reviewRating}
          setReviewRating={setReviewRating}
          reviewComment={reviewComment}
          setReviewComment={setReviewComment}
          submittingReview={submittingReview}
          onSubmit={submitReview}
          insets={insets}
        />

        <FlatList
          ref={flatListRef}
          data={listData}
          inverted
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.messagesContainer, { paddingTop: 8 }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          // Virtualisation : seuls les messages proches de l'écran sont rendus
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          // Arrivé en haut (fin de la liste inversée) : messages plus anciens, sans saut de position
          onEndReached={() => {
            if (hasMoreMessages && !loadingOlder) loadOlderMessages();
          }}
          onEndReachedThreshold={0.3}
          // Liste inversée : l'en-tête s'affiche en bas (indicateur de saisie),
          // le pied en haut (chargement des messages plus anciens)
          ListHeaderComponent={
            typingLabel ? <TypingBubble styles={styles} /> : null
          }
          ListFooterComponent={
            loadingOlder ? (
              <View style={styles.loadOlderWrap}>
                <ActivityIndicator size="small" color={P.amber} />
                <Text style={styles.loadOlderText}>Chargement...</Text>
              </View>
            ) : hasMoreMessages ? (
              <TouchableOpacity style={styles.loadOlderWrap} onPress={loadOlderMessages} activeOpacity={0.8}>
                <Ionicons name="chevron-up" size={14} color={P.orange500} />
                <Text style={styles.loadOlderText}>Messages plus anciens</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Ionicons name="copy-outline" size={14} color="#fff" />
            <Text style={styles.toastTxt}>{toast}</Text>
          </View>
        ) : null}

        {/* Zone de saisie façon WhatsApp (texte + message vocal maintenu/verrouillé) */}
        {!reviewModalVisible ? (
          <ChatComposer
            value={text}
            onChangeText={onComposerChange}
            onFocus={onComposerFocus}
            onSendText={onSend}
            sendingText={sending}
            onSendVoice={sendVoice}
            onRecordingStart={stopAudioPlayback}
            onError={(message) => setAlert({
              visible: true,
              type: 'warning',
              title: 'Message vocal',
              message,
              buttons: [{ text: 'OK', onPress: () => { } }],
            })}
            bottomInset={insets.bottom}
            disabled={sendingVoice}
          />
        ) : null}
      </ChatKeyboardView>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
    </LinearGradient>
  );
}

// Bulle « écrit… » : trois points qui rebondissent
function TypingBubble({ styles }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const anims = dots.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
      Animated.delay((2 - i) * 160),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.typingWrap}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0.3, 1], outputRange: [0, -3] }) }] }]}
        />
      ))}
    </View>
  );
}

function createStyles(theme, isDark) {
  const mineBubbleColor = isDark ? P.orange300 : P.orange500;

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectionBannerWrap: {
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    closureBannerWrap: {
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    closureBanner: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    closureBannerOpen: {
      backgroundColor: 'rgba(34,197,94,0.08)',
      borderColor: 'rgba(34,197,94,0.22)',
    },
    closureBannerClosed: {
      backgroundColor: 'rgba(107,114,128,0.10)',
      borderColor: 'rgba(107,114,128,0.22)',
    },
    closureBannerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    closureBannerTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 2,
    },
    closureBannerText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    closureActionBtn: {
      backgroundColor: P.orange500,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 92,
    },
    closureActionBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 12,
    },
    dealBannerWrap: {
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    headerTitleWrap: {
      alignItems: 'flex-start',
      maxWidth: 200,
    },
    headerPeer: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 240 },
    headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt },
    headerAvatarTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
    headerAvatarDot: {
      position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6,
      backgroundColor: '#22c55e', borderWidth: 2, borderColor: theme.surface,
    },
    headerStatusText: { fontSize: 12, fontWeight: '600', marginTop: 1 },
    headerTitleText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
      flexShrink: 1,
    },
    headerSubtitleText: {
      color: theme.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    headerOnlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    headerOnlineDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    headerOnlineDotActive: {
      backgroundColor: '#22c55e',
    },
    headerOnlineDotInactive: {
      backgroundColor: '#9ca3af',
    },
    headerOnlineText: {
      fontSize: 11,
      fontWeight: '500',
    },
    headerOnlineTextActive: {
      color: '#22c55e',
    },
    headerOnlineTextInactive: {
      color: '#9ca3af',
    },
    loadOlderWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    loadOlderText: {
      fontSize: 12,
      color: P.orange500,
      fontWeight: '600',
    },
    headerDealChip: {
      maxWidth: 120,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(236,90,19,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(236,90,19,0.18)',
      marginRight: 8,
    },
    headerDealChipSuccess: {
      backgroundColor: 'rgba(34,197,94,0.14)',
      borderColor: 'rgba(34,197,94,0.20)',
    },
    headerDealChipMuted: {
      backgroundColor: 'rgba(107,114,128,0.14)',
      borderColor: 'rgba(107,114,128,0.20)',
    },
    headerDealChipText: {
      fontSize: 11,
      fontWeight: '800',
      color: P.orange700,
    },
    headerDealChipTextSuccess: {
      color: '#15803d',
    },
    headerDealChipTextMuted: {
      color: '#4b5563',
    },
    connectionBannerText: {
      color: theme.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    errorText: {
      color: '#dc2626',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 2,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 10,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#0f172a',
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: isDark ? 0 : 2,
    },
    itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    itemImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.surfaceAlt },
    itemImageEmpty: { alignItems: 'center', justifyContent: 'center' },
    itemMeta: { flex: 1, minWidth: 0 },
    itemTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
    itemPrice: { color: P.orange500, fontSize: 13.5, fontWeight: '900', marginTop: 2 },
    dealCta: {
      flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 17,
      backgroundColor: '#16a34a',
    },
    dealCtaTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
    dealPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 15 },
    dealPillOk: { backgroundColor: 'rgba(34,197,94,0.14)' },
    dealPillKo: { backgroundColor: 'rgba(239,68,68,0.12)' },
    dealPillWait: { backgroundColor: 'rgba(245,158,11,0.15)' },
    dealPillTxt: { fontSize: 12, fontWeight: '800' },
    dealCard: {
      backgroundColor: theme.cardSoft,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 12,
      gap: 10,
    },
    dealCardSuccess: {
      backgroundColor: 'rgba(34,197,94,0.08)',
      borderColor: 'rgba(34,197,94,0.25)',
    },
    dealCardMuted: {
      backgroundColor: 'rgba(107,114,128,0.08)',
      borderColor: 'rgba(107,114,128,0.18)',
    },
    dealCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    dealCardTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    dealCardSub: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    dealChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(236,90,19,0.10)',
    },
    dealChipSuccess: {
      backgroundColor: 'rgba(34,197,94,0.14)',
    },
    dealChipMuted: {
      backgroundColor: 'rgba(107,114,128,0.14)',
    },
    dealChipTxt: {
      fontSize: 11,
      fontWeight: '800',
      color: P.orange700,
    },
    dealChipTxtSuccess: {
      color: '#15803d',
    },
    dealChipTxtMuted: {
      color: '#4b5563',
    },
    dealPrimaryBtn: {
      backgroundColor: P.orange500,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    dealPrimaryBtnTxt: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 13,
    },
    dealSecondaryBtn: {
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flex: 1,
    },
    dealSecondaryBtnTxt: {
      color: theme.text,
      fontWeight: '800',
      fontSize: 13,
    },
    dealActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    messagesContainer: {
      paddingHorizontal: 12,
      paddingTop: 10,
      gap: 8,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      width: '100%',
    },
    messageRowMine: { justifyContent: 'flex-end' },
    messageRowOther: { justifyContent: 'flex-start' },
    avatarSlot: { width: 28, alignItems: 'center', justifyContent: 'flex-end' },
    peerAvatar: { width: 28, height: 28, borderRadius: 14 },
    peerAvatarFallback: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    peerAvatarFallbackText: { color: '#fff', fontWeight: '800', fontSize: 10.5 },
    bubblePress: { maxWidth: '80%' },
    bubble: {
      borderRadius: 20,
      paddingHorizontal: 13,
      paddingTop: 8,
      paddingBottom: 8,
    },
    bubbleMine: {},
    bubbleOther: {
      backgroundColor: isDark ? theme.surface : '#ffffff',
      borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    bubbleAudio: { paddingBottom: 6, minWidth: 230 },
    messageText: { fontSize: 15.5, lineHeight: 21 },
    messageTextMine: { color: '#fff' },
    messageTextOther: { color: theme.text },
    textWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end', columnGap: 8 },
    metaInline: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', paddingTop: 2, marginBottom: -1 },
    audioPlayBtn: {
      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : P.orange50,
    },
    audioPlayBtnMine: {
      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    metaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
    timeText: { fontSize: 11, fontWeight: '500' },
    timeTextMine: { color: 'rgba(255,255,255,0.82)' },
    timeTextOther: { color: theme.textSoft },
    typingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginLeft: 34,
      marginTop: 8,
      marginBottom: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      backgroundColor: isDark ? theme.surface : '#ffffff',
    },
    typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.textMuted },
    dateSeparatorWrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
    dateSeparatorText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textMuted,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,24,39,0.06)',
    },
    systemMessageWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'center',
      maxWidth: '86%',
      marginVertical: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.05)',
    },
    systemMessageText: { flexShrink: 1, color: theme.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: 'rgba(17,24,39,0.92)',
      zIndex: 10,
    },
    toastTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
    composerWrap: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
      paddingTop: 8,
      paddingHorizontal: 10,
    },
    composerInner: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      color: theme.text,
      fontSize: 15,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    voiceBtn: {
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    voiceBtnMain: {
      backgroundColor: P.orange500,
      borderColor: theme.surface,
    },
    voiceBtnActive: {
      backgroundColor: '#dc2626',
      borderColor: theme.surface,
    },
    sendBtn: {
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: P.orange500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.6,
    },
    sendBtnText: {
      color: theme.surface,
      fontSize: 14,
      fontWeight: '800',
    },
    recordRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    recordStatusWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    recordDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    recordTimerText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    recordCancelBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    recordCancelText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    recordSendBtn: {
      backgroundColor: P.orange500,
      borderRadius: 18,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordSendText: {
      color: theme.surface,
      fontSize: 12,
      fontWeight: '800',
    },
    reviewInviteCard: {
      marginHorizontal: 14,
      marginTop: 10,
      marginBottom: 10,
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    reviewInviteContent: {
      flex: 1,
      minWidth: 0,
    },
    reviewInviteTitle: {
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 2,
    },
    reviewInviteText: {
      fontSize: 12,
      lineHeight: 16,
    },
    reviewInviteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    reviewInviteBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 11,
    },
  });
}
