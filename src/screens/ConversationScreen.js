import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  sendMessage,
  sendVoiceMessage,
} from '../api/messaging';
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

function formatPriceFCFA(value) {
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Prix a discuter';
  return `${Math.round(numeric).toLocaleString('fr-FR')} FCFA`;
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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState('');
  const [audioStates, setAudioStates] = useState({});
  const [audioTrackWidths, setAudioTrackWidths] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState('');
  const [alert, setAlert] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const currentUserId = useMemo(() => user?.id || user?._id || '', [user]);
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

      await markConversationAsRead(conversationId);

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
        markConversationAsRead(conversationId).catch(() => {});
      }
    };

    const onMessageRead = ({ conversationId: payloadConversationId, messageId, readAt }) => {
      if (payloadConversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.id) === String(messageId)
            ? { ...msg, read: true, readAt }
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

    on('message:new', onMessage);
    on('message:read', onMessageRead);
    on('typing:start', onTypingStart);
    on('typing:stop', onTypingStop);

    return () => {
      off('message:new', onMessage);
      off('message:read', onMessageRead);
      off('typing:start', onTypingStart);
      off('typing:stop', onTypingStop);
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
          buttons: [{ text: 'OK', onPress: () => {} }],
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
        buttons: [{ text: 'OK', onPress: () => {} }],
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
        buttons: [{ text: 'OK', onPress: () => {} }],
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

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: peer?.businessName || peer?.name || 'Conversation',
      headerStyle: {
        backgroundColor: theme.surface,
        shadowColor: theme.shadow,
      },
      headerTintColor: theme.text,
    });
  }, [navigation, peer?.businessName, peer?.name, theme]);

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
          buttons: [{ text: 'OK', onPress: () => {} }],
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
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      return;
    }
    const raw = conversation?.item?.id;

    const match = raw.match(/ObjectId\('(.+?)'\)/);
    const productId = match?.[1] ?? null;

    navigation.navigate('ProductDetail', { productId: productId });
  }, [conversationItemId, navigation]);

  const renderMessage = ({ item }) => {
    const mine = isCurrentUserMessage(item, user, currentUserIdSet);
    const isAudio = item?.type === 'audio' && item?.attachments?.[0];
    const messageId = String(item.id);
    const audioState = audioStates[messageId] || {};
    const isPlayingThis = audioState.isPlaying || false;
    const positionMs = audioState.positionMs || 0;
    const durationMs = audioState.durationMs || 0;
    const progressPct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

    return (
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
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                style={item.read ? styles.readIconRead : styles.readIconPending}
              />
            ) : null}
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
        <View style={styles.connectionBannerWrap}>
          <Text style={styles.connectionBannerText}>
            {isConnected ? (peerIsOnline ? 'Correspondant en ligne' : 'Correspondant hors ligne') : 'Connexion en cours...'}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.messagesContainer, { paddingBottom: 8 }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListHeaderComponent={
            conversationItem ? (
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

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}> 
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
        </View>
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
    readIconRead: {
      color: '#22c55e',
    },
    readIconPending: {
      color: theme.textMuted,
    },
    typingWrap: {
      marginTop: 10,
      marginLeft: 8,
    },
    typingText: {
      color: theme.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
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
  });
}
