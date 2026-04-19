import api from './auth';

export const getConversations = async () => {
  const response = await api.get('/conversations');
  return response.data;
};

export const getConversationById = async (conversationId) => {
  const response = await api.get(`/conversations/${conversationId}`);
  return response.data;
};

export const createOrGetConversation = async ({ sellerId, productId }) => {
  const payload = { sellerId };
  if (productId) payload.productId = productId;
  const response = await api.post('/conversations', payload);
  return response.data;
};

export const markConversationAsRead = async (conversationId) => {
  const response = await api.put(`/conversations/${conversationId}/read`);
  return response.data;
};

export const updateConversationDeal = async (conversationId, action, reason = '') => {
  const mappedAction = action === 'reject' ? 'decline' : action;
  const response = await api.put(`/conversations/${conversationId}/deal`, {
    action: mappedAction,
    reason,
  });

  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get('/conversations/unread/count');
  return response.data;
};

export const getMessages = async (conversationId, page = 1, limit = 50) => {
  const response = await api.get(`/messages/${conversationId}`, {
    params: { page, limit },
  });
  return response.data;
};

export const sendMessage = async ({ conversationId, content, type = 'text', attachments = [] }) => {
  const response = await api.post('/messages', {
    conversationId,
    content,
    type,
    attachments,
  });
  return response.data;
};

export const sendVoiceMessage = async (conversationId, audioFileUri) => {
  const formData = new FormData();
  formData.append('conversationId', conversationId);
  formData.append('audio', {
    uri: audioFileUri,
    type: 'audio/m4a',
    name: `voice-${Date.now()}.m4a`,
  });

  const response = await api.post('/messages/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
