import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

export function useSocket({ enabled = true, token } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setOnlineUsers(new Set());
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setOnlineUsers(new Set());
    });

    socket.on('users:online', (data) => {
      setOnlineUsers(new Set(data?.userIds || []));
    });

    socket.on('user:online', (data) => {
      const userId = data?.userId;
      if (!userId) return;
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    socket.on('user:offline', (data) => {
      const userId = data?.userId;
      if (!userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [enabled, token]);

  const emit = useCallback((event, payload) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(event, payload);
  }, []);

  const on = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    if (!socketRef.current) return;
    if (handler) {
      socketRef.current.off(event, handler);
      return;
    }
    socketRef.current.off(event);
  }, []);

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

  const startTyping = useCallback((conversationId) => {
    emit('typing:start', { conversationId });
  }, [emit]);

  const stopTyping = useCallback((conversationId) => {
    emit('typing:stop', { conversationId });
  }, [emit]);

  const isUserOnline = useCallback((userId) => onlineUsers.has(userId), [onlineUsers]);

  return {
    socket: socketRef.current,
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
