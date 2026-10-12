import api from './auth';

// Paginé : { limit, before } (before = updatedAt ISO de la dernière conversation chargée)
export const getConversations = async ({ limit, before } = {}) => {
  const response = await api.get('/conversations', {
    params: { ...(limit ? { limit } : {}), ...(before ? { before } : {}) },
  });
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

export const closeConversationByOwner = async (conversationId) => {
  const response = await api.put(`/conversations/${conversationId}/close-owner`);
  return response.data;
};

export const reopenConversationByOwner = async (conversationId) => {
  const response = await api.put(`/conversations/${conversationId}/reopen-owner`);
  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get('/conversations/unread/count');
  return response.data;
};

// Pagination par curseur : sans `before`, les messages les plus récents ;
// avec `before` (id du plus ancien message affiché), la tranche précédente.
export const getMessages = async (conversationId, { before, limit = 40 } = {}) => {
  const response = await api.get(`/messages/${conversationId}`, {
    params: { limit, ...(before ? { before } : {}) },
  });
  return response.data;
};

export const sendMessage = async ({ conversationId, content, type = 'text', attachments = [], postClosure = false }) => {
  const response = await api.post('/messages', {
    conversationId,
    content,
    type,
    attachments,
    postClosure,
  });
  return response.data;
};

export const sendVoiceMessage = async (conversationId, audioFileUri, durationMs) => {
  const formData = new FormData();
  formData.append('conversationId', conversationId);
  if (durationMs > 0) formData.append('durationMs', String(Math.round(durationMs)));
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
