// ─── Socket.IO partagé ────────────────────────────────────────────────────────
// UNE seule connexion pour toute l'app. Avant, chaque écran appelant useSocket()
// (onglets, liste des messages, conversation) ouvrait sa propre WebSocket :
// jusqu'à 3 connexions par téléphone, 3 authentifications et 3× les événements.
// L'API du hook est inchangée pour les écrans.

import { useCallback, useEffect, useReducer, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

const RELEASE_DELAY_MS = 3000; // évite de couper/reconnecter lors d'une simple navigation

let shared = null; // { token, socket, refs, connected, online: Set, subscribers: Set, releaseTimer }

function notify(entry) {
  entry.subscribers.forEach((fn) => fn());
}

function acquire(token) {
  if (shared && shared.token !== token) {
    // Changement de compte : on repart d'une connexion neuve
    shared.socket.disconnect();
    shared = null;
  }

  if (!shared) {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity, // réseaux mobiles instables : ne jamais abandonner
      randomizationFactor: 0.5,       // étale les reconnexions après une coupure générale
    });

    const entry = {
      token,
      socket,
      refs: 0,
      connected: false,
      online: new Set(),
      subscribers: new Set(),
      releaseTimer: null,
    };

    socket.on('connect', () => { entry.connected = true; notify(entry); });
    socket.on('disconnect', () => {
      entry.connected = false;
      entry.online = new Set();
      notify(entry);
    });
    socket.on('users:online', (data) => {
      entry.online = new Set((data?.userIds || []).map(String));
      notify(entry);
    });
    socket.on('user:online', (data) => {
      if (!data?.userId) return;
      entry.online = new Set(entry.online).add(String(data.userId));
      notify(entry);
    });
    socket.on('user:offline', (data) => {
      if (!data?.userId) return;
      const next = new Set(entry.online);
      next.delete(String(data.userId));
      entry.online = next;
      notify(entry);
    });

    shared = entry;
  }

  if (shared.releaseTimer) {
    clearTimeout(shared.releaseTimer);
    shared.releaseTimer = null;
  }
  shared.refs += 1;
  return shared;
}

function release(entry) {
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.releaseTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    entry.socket.disconnect();
    if (shared === entry) shared = null;
  }, RELEASE_DELAY_MS);
}

export function useSocket({ enabled = true, token } = {}) {
  const [entry, setEntry] = useState(null);
  const [, rerender] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!enabled || !token) {
      setEntry(null);
      return undefined;
    }
    const current = acquire(token);
    current.subscribers.add(rerender);
    setEntry(current);
    return () => {
      current.subscribers.delete(rerender);
      release(current);
    };
  }, [enabled, token]);

  const isConnected = Boolean(entry?.connected);
  const onlineUsers = entry?.online || EMPTY_SET;

  const emit = useCallback((event, payload) => {
    if (!entry?.socket.connected) return;
    entry.socket.emit(event, payload);
  }, [entry]);

  // Toujours passer le handler à off() : la connexion est partagée avec les autres écrans
  const on = useCallback((event, handler) => {
    entry?.socket.on(event, handler);
  }, [entry]);

  const off = useCallback((event, handler) => {
    if (!entry || !handler) return;
    entry.socket.off(event, handler);
  }, [entry]);

  const joinConversation = useCallback((conversationId) => {
    emit('conversation:join', { conversationId });
  }, [emit]);

  const leaveConversation = useCallback((conversationId) => {
    emit('conversation:leave', { conversationId });
  }, [emit]);

  const sendRealtimeMessage = useCallback((data) => {
    emit('message:send', data);
  }, [emit]);

  const markMessageAsRead = useCallback((messageId, conversationId) => {
    emit('message:read', { messageId, conversationId });
  }, [emit]);

  const startTyping = useCallback((conversationId, type = 'text') => {
    emit('typing:start', { conversationId, type });
  }, [emit]);

  const stopTyping = useCallback((conversationId) => {
    emit('typing:stop', { conversationId });
  }, [emit]);

  const isUserOnline = useCallback((userId) => onlineUsers.has(String(userId)), [onlineUsers]);

  return {
    socket: entry?.socket || null,
    isConnected,
    onlineUsers,
    emit,
    on,
    off,
    joinConversation,
    leaveConversation,
    sendRealtimeMessage,
    markMessageAsRead,
    startTyping,
    stopTyping,
    isUserOnline,
  };
}

const EMPTY_SET = new Set();
