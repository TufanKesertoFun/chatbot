import { io } from 'socket.io-client';
import { api as defaultApi, SOCKET_URL as defaultSocketUrl } from '../api';

function normalizeMessage(msg) {
  return {
    id: msg?.id,
    conversationId: msg?.conversationId || msg?.conversation_id,
    senderType: msg?.senderType || msg?.sender_type,
    textOriginal: msg?.textOriginal ?? msg?.text_original ?? '',
    textTranslated: msg?.textTranslated ?? msg?.text_translated ?? msg?.textOriginal ?? msg?.text_original ?? '',
    translationProvider: msg?.translationProvider || msg?.translation_provider,
    createdAt: msg?.createdAt || msg?.created_at || new Date().toISOString(),
    citations: msg?.citations,
  };
}

function normalizeConversationState(state) {
  return {
    conversationId: state?.conversationId,
    status: state?.status,
    botEnabled: state?.botEnabled,
    visitorLang: state?.visitorLang,
    lastMessageAt: state?.lastMessageAt,
    messages: Array.isArray(state?.messages) ? state.messages.map(normalizeMessage) : [],
  };
}

function normalizeUserProfile(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const fullName = raw.fullName || raw.name || undefined;
  const externalId = raw.externalId || raw.id || raw.userId || undefined;
  const email = raw.email || undefined;
  const phone = raw.phone || undefined;
  if (!fullName && !externalId && !email && !phone) return undefined;
  return { fullName, externalId, email, phone };
}

export class OvoWidgetClient {
  constructor({ apiClient = defaultApi, socketUrl = defaultSocketUrl, logger = console } = {}) {
    this.apiClient = apiClient;
    this.socketUrl = socketUrl;
    this.logger = logger;
    this.socket = null;
  }

  async startSession({ visitorName, preferredLang, locale, userProfile, user }) {
    const normalizedProfile = normalizeUserProfile(userProfile || user);
    const response = await this.apiClient.post('/api/widget/session', {
      visitorName,
      preferredLang,
      userProfile: normalizedProfile,
    }, {
      headers: locale ? { 'Accept-Language': locale } : undefined,
    });
    return response.data;
  }

  connect({ token, conversationId, onMessage, onConnect, onStatusChange, onDisconnect, onConnectError }) {
    if (this.socket) return this.socket;
    const socket = io(this.socketUrl, { auth: { token } });
    socket.on('connect', () => {
      this.logger.info?.('widget.socket.connected');
      socket.emit('join', { conversationId });
      if (typeof onConnect === 'function') onConnect();
    });
    socket.on('disconnect', () => {
      if (typeof onDisconnect === 'function') onDisconnect();
    });
    socket.on('connect_error', (error) => {
      if (typeof onConnectError === 'function') onConnectError(error);
    });

    socket.on('message:new', (msg) => {
      if (typeof onMessage === 'function') {
        onMessage(normalizeMessage(msg));
      }
    });
    socket.on('conversation:status_changed', (payload) => {
      if (typeof onStatusChange === 'function') {
        onStatusChange({
          conversationId: payload?.conversationId || payload?.conversation_id,
          status: payload?.status,
        });
      }
    });

    this.socket = socket;
    return socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async sendMessage({ conversationId, token, text, sourceLang, locale }) {
    const response = await this.apiClient.post(
      `/widget/conversations/${conversationId}/messages`,
      { text, sourceLang },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(locale ? { 'Accept-Language': locale } : {}),
        },
      }
    );
    return response.data;
  }

  async getConversationState({ conversationId, token, locale }) {
    const response = await this.apiClient.get(`/widget/conversations/${conversationId}/state`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(locale ? { 'Accept-Language': locale } : {}),
      },
    });
    return normalizeConversationState(response.data);
  }

  async setUserProfile({ conversationId, token, userProfile, user, locale }) {
    const normalizedProfile = normalizeUserProfile(userProfile || user);
    if (!normalizedProfile) {
      return { success: false, updated: false };
    }
    const response = await this.apiClient.post(
      `/widget/conversations/${conversationId}/profile`,
      { userProfile: normalizedProfile },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(locale ? { 'Accept-Language': locale } : {}),
        },
      }
    );
    return response.data;
  }

  async updateUserProfile(params) {
    return this.setUserProfile(params);
  }

  static normalizeMessage(msg) {
    return normalizeMessage(msg);
  }

  static normalizeConversationState(state) {
    return normalizeConversationState(state);
  }
}
