import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const WAVE_BARS = Array.from({ length: 24 }, (_, i) => i);

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
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
                  source={{ uri: item.image || 'https://via.placeholder.com/56' }}
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
                multiline
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

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [dealActionLoading, setDealActionLoading] = useState(false);
  const [ownerClosureLoading, setOwnerClosureLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState('');
  const [audioStates, setAudioStates] = useState({});
  const [audioTrackWidths, setAudioTrackWidths] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [reviewEligible, setReviewEligible] = useState(false);
  const [checkingReviewEligibility, setCheckingReviewEligibility] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
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
  const recordingRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const playingSoundRef = useRef(null);
  const playingMessageIdRef = useRef('');
  const initialScrollDoneRef = useRef(false);
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const {
    isConnected,
    on,
    off,
    joinConversation,
    leaveConversation,
    sendRealtimeMessage,
    markMessageAsRead,
    startTyping,
    stopTyping,
    isUserOnline,
  } = useSocket({
    enabled: Boolean(token),
    token,
  });

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
      setMessages(loadedMessages);
      setCurrentPage(1);
      setHasMoreMessages(Boolean(messagesResponse?.pagination?.hasMore));

      await markConversationAsRead(conversationId);
      DeviceEventEmitter.emit('unreadCount:refresh');

      loadedMessages
        .filter((msg) => {
          return !isCurrentUserMessage(msg, user, currentUserIdSet) && !msg.read;
        })
        .forEach((msg) => {
          markMessageAsRead(msg.id, conversationId);
        });
    } catch (e) {
      setError(e?.response?.data?.message || 'Impossible de charger la conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId, currentUserIdSet, markMessageAsRead, navigation]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMoreMessages) return;
    try {
      setLoadingOlder(true);
      const nextPage = currentPage + 1;
      const response = await getMessages(conversationId, nextPage);
      const older = response?.data || [];
      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)));
          const unique = older.filter((m) => !existingIds.has(String(m.id)));
          return [...unique, ...prev];
        });
        setCurrentPage(nextPage);
        setHasMoreMessages(Boolean(response?.pagination?.hasMore));
      } else {
        setHasMoreMessages(false);
      }
    } catch (e) {
      // silently ignore pagination errors
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, currentPage, hasMoreMessages, loadingOlder]);

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
      setLoading(true);
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

      if (!isCurrentUserMessage(message, user, currentUserIdSet)) {
        markMessageAsRead(message.id, conversationId);
        markConversationAsRead(conversationId)
          .then(() => DeviceEventEmitter.emit('unreadCount:refresh'))
          .catch(() => { });
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
    markMessageAsRead,
    off,
    on,
  ]);

  // Auto-scroll au chargement initial et à chaque nouvel message

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: false });
        initialScrollDoneRef.current = true;
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [messages.length]);

  // Auto-scroll quand l'interlocuteur commence à taper
  useEffect(() => {
    if (Object.keys(typingUsers).length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [typingUsers]);

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

  const stopAudioPlayback = useCallback(async () => {
    const currentId = playingMessageIdRef.current;

    if (!playingSoundRef.current) {
      if (currentId) {
        setAudioStates((prev) => ({
          ...prev,
          [currentId]: {
            ...(prev[currentId] || {}),
            isPlaying: false,
          },
        }));
      }
      setPlayingMessageId('');
      playingMessageIdRef.current = '';
      return;
    }

    try {
      await playingSoundRef.current.stopAsync();
      await playingSoundRef.current.unloadAsync();
    } catch (e) {
      // No-op: just ensure local state resets.
    } finally {
      playingSoundRef.current = null;
      if (currentId) {
        setAudioStates((prev) => ({
          ...prev,
          [currentId]: {
            ...(prev[currentId] || {}),
            isPlaying: false,
          },
        }));
      }
      setPlayingMessageId('');
      playingMessageIdRef.current = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const startVoiceRecording = async () => {
    if (isRecording || sendingVoice) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setAlert({
          visible: true,
          type: 'warning',
          title: 'Micro requis',
          message: 'Activez le microphone pour envoyer un message vocal.',
          buttons: [{ text: 'OK', onPress: () => { } }],
        });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setRecordingMs(0);
      setIsRecording(true);

      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status?.isRecording) {
            setRecordingMs(status.durationMillis || 0);
          }
        } catch (e) {
          // Ignore status sampling errors while recording.
        }
      }, 250);
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de demarrer l\'enregistrement vocal.',
        buttons: [{ text: 'OK', onPress: () => { } }],
      });
      setIsRecording(false);
      recordingRef.current = null;
    }
  };

  const cancelVoiceRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) {
      setIsRecording(false);
      setRecordingMs(0);
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch (e) {
      // Ignore stopping errors on cancellation.
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      recordingRef.current = null;
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      setIsRecording(false);
      setRecordingMs(0);
    }
  };

  const stopAndSendVoiceRecording = async () => {
    const recording = recordingRef.current;
    if (!recording || !conversationId || sendingVoice) return;

    try {
      setSendingVoice(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error('Aucun fichier vocal disponible');
      }

      const response = await sendVoiceMessage(conversationId, uri);
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      recordingRef.current = null;
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      setIsRecording(false);
      setRecordingMs(0);
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
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

  const formatRecordTime = useCallback((ms = 0) => {
    const total = Math.floor(ms / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, []);

  const formatAudioTime = useCallback((ms = 0) => {
    const total = Math.floor(ms / 1000);
    const mm = String(Math.floor(total / 60));
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, []);

  const peer = getOtherParticipant(conversation, currentUserId);
  const headerDealStatus = conversation?.deal?.status || 'open';
  const headerDealLabel = (getDealPresentation(headerDealStatus) || {}).label || 'Aucune clôture';

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {peer?.businessName || peer?.name || 'Conversation'}
          </Text>
          <View style={styles.headerOnlineRow}>
            <View style={[styles.headerOnlineDot, peerIsOnline ? styles.headerOnlineDotActive : styles.headerOnlineDotInactive]} />
            <Text style={[styles.headerOnlineText, peerIsOnline ? styles.headerOnlineTextActive : styles.headerOnlineTextInactive]}>
              {isConnected ? (peerIsOnline ? 'En ligne' : 'Hors ligne') : 'Connexion...'}
            </Text>
          </View>
        </View>
      ),
      headerStyle: {
        backgroundColor: theme.surface,
        shadowColor: theme.shadow,
      },
      headerTintColor: theme.text,
    });
  }, [navigation, peer?.businessName, peer?.name, theme, peerIsOnline, isConnected]);

  const onPressAudioMessage = useCallback(
    async (message) => {
      const audioUrl = message?.attachments?.[0];
      if (!audioUrl) return;

      const messageId = String(message.id);

      if (playingSoundRef.current && playingMessageIdRef.current === messageId) {
        try {
          const status = await playingSoundRef.current.getStatusAsync();
          if (status?.isLoaded && status.isPlaying) {
            await playingSoundRef.current.pauseAsync();
            setAudioStates((prev) => ({
              ...prev,
              [messageId]: {
                ...(prev[messageId] || {}),
                isPlaying: false,
              },
            }));
          } else if (status?.isLoaded) {
            await playingSoundRef.current.playAsync();
            setAudioStates((prev) => ({
              ...prev,
              [messageId]: {
                ...(prev[messageId] || {}),
                isPlaying: true,
              },
            }));
          }
          return;
        } catch (e) {
          await stopAudioPlayback();
        }
      }

      try {
        await stopAudioPlayback();

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );

        playingSoundRef.current = sound;
        setPlayingMessageId(messageId);
        playingMessageIdRef.current = messageId;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status?.isLoaded) return;

          setAudioStates((prev) => ({
            ...prev,
            [messageId]: {
              ...(prev[messageId] || {}),
              positionMs: status.positionMillis || 0,
              durationMs: status.durationMillis || 0,
              isPlaying: !!status.isPlaying,
              isBuffering: !!status.isBuffering,
            },
          }));

          if (status.didJustFinish) {
            setAudioStates((prev) => ({
              ...prev,
              [messageId]: {
                ...(prev[messageId] || {}),
                positionMs: 0,
                isPlaying: false,
              },
            }));
            stopAudioPlayback();
          }
        });
      } catch (e) {
        setAlert({
          visible: true,
          type: 'error',
          title: 'Erreur',
          message: 'Impossible de lire ce message vocal.',
          buttons: [{ text: 'OK', onPress: () => { } }],
        });
        await stopAudioPlayback();
      }
    },
    [stopAudioPlayback]
  );

  const onSeekAudioMessage = useCallback(
    async (messageId, event) => {
      const trackWidth = audioTrackWidths[messageId];
      const state = audioStates[messageId] || {};
      const durationMs = state.durationMs || 0;

      if (!trackWidth || !durationMs) return;
      if (!playingSoundRef.current || playingMessageIdRef.current !== messageId) return;

      const locationX = event?.nativeEvent?.locationX || 0;
      const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
      const target = Math.floor(durationMs * ratio);

      try {
        await playingSoundRef.current.setPositionAsync(target);
        setAudioStates((prev) => ({
          ...prev,
          [messageId]: {
            ...(prev[messageId] || {}),
            positionMs: target,
          },
        }));
      } catch (e) {
        // Ignore seek errors.
      }
    },
    [audioStates, audioTrackWidths]
  );

  const typingLabel = Object.values(typingUsers)[0] || '';
  const peerId = peer?.id || peer?._id;
  const peerIsOnline = peerId ? isUserOnline(String(peerId)) : false;
  const hasText = text.trim().length > 0;
  const conversationItem = conversation?.item || null;
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

  const renderMessage = ({ item, index }) => {
    const prevItem = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = !isSameDay(item?.timestamp, prevItem?.timestamp);

    // Render system messages (closure/reopen) as centered small lines
    if (item?.type === 'system' || item?.systemId) {
      return (
        <View>
          {showDateSeparator && (
            <View style={styles.dateSeparatorWrap}>
              <View style={styles.dateSeparatorLine} />
              <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.timestamp)}</Text>
              <View style={styles.dateSeparatorLine} />
            </View>
          )}
          <View style={styles.systemMessageWrap}>
            <Text style={styles.systemMessageText}>{item.content || ''}</Text>
          </View>
        </View>
      );
    }

    const mine = isCurrentUserMessage(item, user, currentUserIdSet);
    const isAudio = item?.type === 'audio' && item?.attachments?.[0];
    const messageId = String(item.id);
    const audioState = audioStates[messageId] || {};
    const isPlayingThis = audioState.isPlaying || false;
    const positionMs = audioState.positionMs || 0;
    const durationMs = audioState.durationMs || 0;
    const progressPct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorWrap}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.timestamp)}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
          <View style={styles.avatarSlot}>
            {!mine ? (
              peer?.avatar ? (
                <Image source={{ uri: peer.avatar }} style={styles.peerAvatar} />
              ) : (
                <View style={styles.peerAvatarFallback}>
                  <Text style={styles.peerAvatarFallbackText}>{(peer?.name || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
              )
            ) : null}
          </View>

          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            {isAudio ? (
              <View style={styles.audioWrap}>
                <TouchableOpacity
                  onPress={() => onPressAudioMessage(item)}
                  activeOpacity={0.85}
                  style={styles.audioPlayBtn}
                >
                  <Ionicons
                    name={isPlayingThis ? 'pause' : 'play'}
                    size={17}
                    color={mine ? '#fff' : P.orange500}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.audioTrack}
                  onLayout={(e) => {
                    const width = e.nativeEvent.layout.width;
                    setAudioTrackWidths((prev) => ({ ...prev, [messageId]: width }));
                  }}
                  onPress={(e) => onSeekAudioMessage(messageId, e)}
                >
                  <View style={styles.audioWaveRow}>
                    {WAVE_BARS.map((bar) => {
                      const threshold = ((bar + 1) / WAVE_BARS.length) * 100;
                      const active = progressPct >= threshold;
                      return (
                        <View
                          key={bar}
                          style={[
                            styles.audioWaveBar,
                            { height: 6 + ((bar * 5) % 12) },
                            active
                              ? { backgroundColor: mine ? 'rgba(255,255,255,0.92)' : P.orange500 }
                              : styles.audioWaveBarInactive,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <View
                    style={[
                      styles.audioTrackHead,
                      {
                        left: `${progressPct}%`,
                        backgroundColor: mine ? '#fff' : P.orange500,
                      },
                    ]}
                  />
                </TouchableOpacity>

                <View style={styles.audioMetaRow}>
                  <Ionicons
                    name="mic"
                    size={11}
                    color={mine ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[styles.audioTimeText, mine ? styles.messageTextMine : styles.messageTextOther]}>
                    {formatAudioTime(positionMs)} / {formatAudioTime(durationMs)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextOther]}>
                {item.content || ''}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Text style={[styles.timeText, mine ? styles.timeTextMine : styles.timeTextOther]}>{formatTime(item.timestamp)}</Text>
              {mine ? (
                <Ionicons
                  name={item.read ? 'checkmark-done' : item.delivered ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.read ? '#fde68a' : item.delivered ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.45)'}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={theme.shell} style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.amber} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.shell} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : headerHeight + 24}
      >
        {error ? (
          <View style={styles.connectionBannerWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Carte produit fixe — hors de la zone scrollable */}
        {conversationItem ? (
          <TouchableOpacity
            activeOpacity={canOpenConversationItem ? 0.88 : 1}
            style={[styles.itemCard, !canOpenConversationItem && styles.itemCardDisabled]}
            onPress={openConversationItem}
            disabled={!canOpenConversationItem}
          >
            <Image
              source={{
                uri:
                  conversationItem?.image ||
                  'https://via.placeholder.com/160x160/F5E6C8/C1440E?text=Annonce',
              }}
              style={styles.itemImage}
            />
            <View style={styles.itemMeta}>
              <Text style={styles.itemOverline}>A propos de cette annonce</Text>
              <Text numberOfLines={2} style={styles.itemTitle}>
                {conversationItem?.title || 'Annonce'}
              </Text>
              <Text style={styles.itemPrice}>{formatPriceFCFA(conversationItem?.price)}</Text>
            </View>
            <View style={styles.itemActionBtn}>
              <Ionicons name="open-outline" size={16} color={P.orange500} />
            </View>
          </TouchableOpacity>
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
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.messagesContainer, { paddingBottom: 8 }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          onContentSizeChange={() => {
            if (!loadingOlder) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (!loadingOlder) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScrollBeginDrag={() => { initialScrollDoneRef.current = true; }}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < 60 && hasMoreMessages && !loadingOlder) {
              loadOlderMessages();
            }
          }}
          scrollEventThrottle={200}
          ListHeaderComponent={
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
          ListFooterComponent={
            typingLabel ? (
              <View style={styles.typingWrap}>
                <Text style={styles.typingText}>{typingLabel} est en train d'ecrire...</Text>
              </View>
            ) : null
          }
        />

        {!reviewModalVisible && <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.composerInner}>
            <TextInput
              value={text}
              onChangeText={onComposerChange}
              onFocus={onComposerFocus}
              placeholder="Ecrivez un message..."
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
              editable={!sending && !sendingVoice && !isRecording}
            />
            <TouchableOpacity
              onPress={isRecording ? cancelVoiceRecording : startVoiceRecording}
              disabled={sending || sendingVoice || hasText}
              activeOpacity={0.85}
              style={[
                styles.voiceBtn,
                styles.voiceBtnMain,
                isRecording && styles.voiceBtnActive,
                (sending || sendingVoice || hasText) && styles.sendBtnDisabled,
              ]}
            >
              <Ionicons name={isRecording ? 'square' : 'mic'} size={18} color={theme.surface} />
            </TouchableOpacity>
            {hasText ? (
              <TouchableOpacity
                onPress={onSend}
                disabled={sending || sendingVoice || isRecording}
                activeOpacity={0.85}
                style={[styles.sendBtn, (sending || sendingVoice || isRecording) && styles.sendBtnDisabled]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.surface} />
                ) : (
                  <Ionicons name="send" size={17} color={theme.surface} />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
          {isRecording ? (
            <View style={styles.recordRow}>
              <View style={styles.recordStatusWrap}>
                <View style={styles.recordDot} />
                <Text style={styles.recordTimerText}>{formatRecordTime(recordingMs)}</Text>
              </View>
              <TouchableOpacity onPress={cancelVoiceRecording} style={styles.recordCancelBtn}>
                <Text style={styles.recordCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={stopAndSendVoiceRecording}
                disabled={sendingVoice}
                style={[styles.recordSendBtn, sendingVoice && styles.sendBtnDisabled]}
              >
                {sendingVoice ? (
                  <ActivityIndicator size="small" color={theme.surface} />
                ) : (
                  <Ionicons name="send" size={16} color={theme.surface} />
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>}
      </KeyboardAvoidingView>

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
    headerTitleText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
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
      backgroundColor: theme.cardSoft,
      borderRadius: 14,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemCardDisabled: {
      opacity: 0.72,
    },
    itemImage: {
      width: 56,
      height: 56,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
    },
    itemMeta: {
      flex: 1,
      minWidth: 0,
    },
    itemOverline: {
      fontSize: 11,
      color: theme.textMuted,
      marginBottom: 2,
    },
    itemTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    itemPrice: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '800',
      color: P.orange500,
    },
    itemActionBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
    },
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
      gap: 8,
      width: '100%',
    },
    messageRowMine: {
      justifyContent: 'flex-start',
      flexDirection: 'row-reverse',
    },
    messageRowOther: {
      justifyContent: 'flex-start',
      flexDirection: 'row',
    },
    avatarSlot: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    peerAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginBottom: 2,
    },
    peerAvatarFallback: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginBottom: 2,
      backgroundColor: theme.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    peerAvatarFallbackText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
    },
    bubbleMine: {
      backgroundColor: mineBubbleColor,
      borderColor: theme.surface,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: theme.cardSoft,
      borderColor: theme.border,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 21,
    },
    audioWrap: {
      minWidth: 230,
      maxWidth: 280,
      gap: 6,
    },
    audioPlayBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.overlay,
    },
    audioTrack: {
      height: 24,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      justifyContent: 'center',
    },
    audioWaveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
    },
    audioWaveBar: {
      width: 3,
      borderRadius: 2,
    },
    audioWaveBarInactive: {
      backgroundColor: theme.textMuted,
      opacity: 0.35,
    },
    audioTrackHead: {
      position: 'absolute',
      top: 5,
      width: 3,
      height: 14,
      borderRadius: 2,
      marginLeft: -1,
    },
    audioTrackProgress: {
      height: '100%',
      borderRadius: 99,
    },
    audioMessageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    audioMessageBtnIcon: {
      fontSize: 13,
      fontWeight: '800',
    },
    audioMessageBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    audioTimeText: {
      fontSize: 10,
      fontWeight: '600',
      opacity: 0.85,
    },
    audioMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    messageTextMine: {
      color: theme.surface,
    },
    messageTextOther: {
      color: theme.text,
    },
    metaRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    timeText: {
      fontSize: 11,
    },
    timeTextMine: {
      color: theme.surfaceAlt,
    },
    timeTextOther: {
      color: theme.textMuted,
    },
    typingWrap: {
      marginTop: 10,
      marginLeft: 8,
      marginBottom: 16,
      paddingHorizontal: 10,
      paddingVertical: 12,
      backgroundColor: theme.cardSoft,
      borderRadius: 12,
    },
    typingText: {
      color: theme.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
    dateSeparatorWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 12,
      marginHorizontal: 16,
      gap: 8,
    },
    dateSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border || 'rgba(0,0,0,0.10)',
    },
    dateSeparatorText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    systemMessageWrap: {
      alignSelf: 'center',
      marginVertical: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    systemMessageText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
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
