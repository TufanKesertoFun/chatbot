import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X, Send, Sparkles, Globe } from 'lucide-react';
import { createLogger } from '../logger';
import { OvoWidgetClient } from './OvoWidgetClient';
import { createWidgetI18n, normalizeWidgetLocale } from './i18n';

const SESSION_STORAGE_KEY = 'ovo_widget_session_v1';
const STATE_POLL_MS = 10000;

function isHandoffText(text) {
  if (!text) return false;
  const value = String(text).toLowerCase();
  const patterns = [
    /temsilci/,
    /canli destek/,
    /agent/,
    /connected/,
    /live support/,
    /mitarbeiter/,
    /support/,
    /оператор/,
    /поддерж/,
    /conseiller/,
    /support en direct/,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function mergeMessages(prev, incoming) {
  const map = new Map(prev.map((message) => [String(message.id), message]));
  incoming.forEach((message) => {
    if (!message?.id) return;
    if (message.senderType === 'VISITOR') {
      for (const [key, existing] of map.entries()) {
        if (existing?.pending && existing?.senderType === 'VISITOR' && existing?.textOriginal === message.textOriginal) {
          map.delete(key);
          break;
        }
      }
    }
    map.set(String(message.id), message);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function deriveSessionMode({ status, botEnabled, messages }) {
  if (status === 'RESOLVED') return 'RESOLVED';
  const hasAgentMessage = messages.some((message) => message.senderType === 'AGENT');
  if (hasAgentMessage) return 'AGENT_LIVE';
  if (botEnabled === false || messages.some((message) => message.senderType === 'SYSTEM' && isHandoffText(message.textOriginal))) {
    return 'WAITING_AGENT';
  }
  return 'ACTIVE';
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.conversationId || !parsed?.token) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveStoredSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function createWelcomeMessage(text, title) {
  return {
    id: 'welcome',
    senderType: 'SYSTEM',
    textOriginal: text,
    welcomeTitle: title,
    createdAt: new Date().toISOString(),
  };
}

export function OvoWidget({ client, visitorName, locale, i18n, brandName = 'OvoBot', userProfile, user }) {
  const logger = useMemo(() => createLogger('widget-sdk'), []);
  const widgetClientRef = useRef(client || new OvoWidgetClient({ logger }));
  const restoringRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [widgetToken, setWidgetToken] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionMode, setSessionMode] = useState('ACTIVE');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const lastProfileSyncRef = useRef(null);

  const messagesEndRef = useRef(null);
  const conversationIdRef = useRef(null);
  const tokenRef = useRef(null);
  const detectedLocale = normalizeWidgetLocale(locale || (navigator.language || 'en'));
  const widgetI18n = useMemo(() => createWidgetI18n({ locale: detectedLocale, overrides: i18n }), [detectedLocale, i18n]);
  const t = widgetI18n.t;
  const visitorDisplayName = visitorName || t('guestName');
  const effectiveUserProfile = useMemo(() => userProfile || user || null, [user, userProfile]);
  const profileSyncKey = useMemo(() => {
    if (!effectiveUserProfile || typeof effectiveUserProfile !== 'object') return '';
    const payload = {
      id: effectiveUserProfile.id || effectiveUserProfile.externalId || effectiveUserProfile.userId || '',
      email: effectiveUserProfile.email || '',
      fullName: effectiveUserProfile.fullName || effectiveUserProfile.name || '',
      phone: effectiveUserProfile.phone || '',
    };
    return JSON.stringify(payload);
  }, [effectiveUserProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    tokenRef.current = widgetToken;
  }, [widgetToken]);

  const handleStatusChange = useCallback((statusPayload) => {
    if (statusPayload?.status !== 'RESOLVED') return;
    setSessionMode('RESOLVED');
    clearStoredSession();
  }, []);

  const handleIncomingMessage = useCallback((incoming) => {
    setIsTyping(false);
    if (conversationIdRef.current && incoming.conversationId && incoming.conversationId !== conversationIdRef.current) {
      return;
    }

    setMessages((prev) => mergeMessages(prev, [incoming]));
    if (incoming.senderType === 'AGENT') {
      setSessionMode('AGENT_LIVE');
    } else if (incoming.senderType === 'SYSTEM' && isHandoffText(incoming.textOriginal)) {
      setSessionMode((current) => (current === 'AGENT_LIVE' ? current : 'WAITING_AGENT'));
    }
  }, []);

  const connectRealtime = useCallback(
    (token, convId) => {
      widgetClientRef.current.connect({
        token,
        conversationId: convId,
        onMessage: handleIncomingMessage,
        onStatusChange: handleStatusChange,
        onConnect: () => setIsRealtimeConnected(true),
        onDisconnect: () => setIsRealtimeConnected(false),
        onConnectError: () => setIsRealtimeConnected(false),
      });
    },
    [handleIncomingMessage, handleStatusChange]
  );

  const syncConversationState = useCallback(async () => {
    const convId = conversationIdRef.current;
    const token = tokenRef.current;
    if (!convId || !token) return;
    try {
      const state = await widgetClientRef.current.getConversationState({
        conversationId: convId,
        token,
        locale: detectedLocale,
      });
      if (state.conversationId !== convId) return;
      setMessages((prev) => mergeMessages(prev, state.messages));
      const nextMode = deriveSessionMode(state);
      setSessionMode(nextMode);
      if (nextMode === 'RESOLVED') {
        clearStoredSession();
      }
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403 || err?.response?.status === 404) {
        clearStoredSession();
      }
    }
  }, [detectedLocale]);

  const startNewSession = useCallback(async () => {
    const data = await widgetClientRef.current.startSession({
      visitorName: visitorDisplayName,
      preferredLang: detectedLocale,
      locale: detectedLocale,
      userProfile: effectiveUserProfile,
    });
    setConversationId(data.conversationId);
    setWidgetToken(data.wsToken);
    setSessionMode('ACTIVE');
    setMessages([createWelcomeMessage(t('greeting.text', { brand: brandName }), t('greeting.title'))]);
    saveStoredSession({
      conversationId: data.conversationId,
      token: data.wsToken,
    });
    lastProfileSyncRef.current = profileSyncKey ? `${data.conversationId}:${profileSyncKey}` : null;
    connectRealtime(data.wsToken, data.conversationId);
  }, [brandName, connectRealtime, detectedLocale, effectiveUserProfile, profileSyncKey, t, visitorDisplayName]);

  const restoreSessionIfPossible = useCallback(async () => {
    const saved = loadStoredSession();
    if (!saved) return false;

    try {
      const state = await widgetClientRef.current.getConversationState({
        conversationId: saved.conversationId,
        token: saved.token,
        locale: detectedLocale,
      });
      if (state.status === 'RESOLVED') {
        clearStoredSession();
        return false;
      }

      setConversationId(saved.conversationId);
      setWidgetToken(saved.token);
      setMessages(
        state.messages.length > 0
          ? state.messages
          : [createWelcomeMessage(t('greeting.text', { brand: brandName }), t('greeting.title'))]
      );
      setSessionMode(deriveSessionMode(state));
      connectRealtime(saved.token, saved.conversationId);
      return true;
    } catch (err) {
      clearStoredSession();
      return false;
    }
  }, [brandName, connectRealtime, detectedLocale, t]);

  useEffect(() => {
    if (!isOpen || conversationId || restoringRef.current) return;
    restoringRef.current = true;
    (async () => {
      try {
        const restored = await restoreSessionIfPossible();
        if (!restored) {
          await startNewSession();
        }
      } catch (err) {
        logger.error('widget.session.error', err);
      } finally {
        restoringRef.current = false;
      }
    })();
  }, [conversationId, isOpen, logger, restoreSessionIfPossible, startNewSession]);

  useEffect(() => {
    if (!isOpen || !conversationId || !widgetToken) return;
    const interval = setInterval(() => {
      syncConversationState();
    }, STATE_POLL_MS);
    return () => clearInterval(interval);
  }, [conversationId, isOpen, syncConversationState, widgetToken]);

  useEffect(() => {
    const convId = conversationIdRef.current;
    const token = tokenRef.current;
    if (!convId || !token || !profileSyncKey) return;
    if (lastProfileSyncRef.current === `${convId}:${profileSyncKey}`) return;

    (async () => {
      try {
        await widgetClientRef.current.setUserProfile({
          conversationId: convId,
          token,
          userProfile: effectiveUserProfile,
          locale: detectedLocale,
        });
        lastProfileSyncRef.current = `${convId}:${profileSyncKey}`;
      } catch (err) {
        logger.warn('widget.profile.sync_failed', err?.response?.status || err?.message);
      }
    })();
  }, [detectedLocale, effectiveUserProfile, logger, profileSyncKey, conversationId, widgetToken]);

  useEffect(() => {
    return () => {
      widgetClientRef.current.disconnect();
    };
  }, []);

  const startFreshConversation = async () => {
    widgetClientRef.current.disconnect();
    clearStoredSession();
    lastProfileSyncRef.current = null;
    setMessages([]);
    setConversationId(null);
    setWidgetToken(null);
    setSessionMode('ACTIVE');
    setIsTyping(false);
    setInput('');
    setIsRealtimeConnected(false);
    await startNewSession();
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || !widgetToken || sessionMode === 'RESOLVED') return;

    const textToSend = input.trim();
    setMessages((prev) =>
      mergeMessages(prev, [
        {
          id: `tmp-${Date.now()}`,
          senderType: 'VISITOR',
          textOriginal: textToSend,
          textTranslated: null,
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ])
    );
    setInput('');
    setIsTyping(sessionMode === 'ACTIVE');

    try {
      const response = await widgetClientRef.current.sendMessage({
        conversationId,
        token: widgetToken,
        text: textToSend,
        sourceLang: detectedLocale,
        locale: detectedLocale,
      });
      logger.info('widget.message.sent', { handledByBot: response?.handledByBot });
      if (response?.botMessage) {
        setIsTyping(false);
        const normalized = OvoWidgetClient.normalizeMessage(response.botMessage);
        setMessages((prev) => mergeMessages(prev, [normalized]));
        return;
      }
      if (response?.handledByBot === false) {
        setIsTyping(false);
        setSessionMode((current) => (current === 'AGENT_LIVE' ? current : 'WAITING_AGENT'));
      }
    } catch (err) {
      logger.error('widget.message.error', err);
      setIsTyping(false);
      setMessages((prev) => prev.filter((message) => !(message.pending && message.textOriginal === textToSend)));
      setInput(textToSend);
      if (err?.response?.status === 409) {
        setSessionMode('RESOLVED');
        clearStoredSession();
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 group flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl hover:scale-110 hover:bg-amber-600 transition-all duration-300 z-50"
      >
        <MessageSquare size={28} className="group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[360px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden z-50 animate-message font-sans">
      <div className="bg-slate-900 p-4 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-transparent"></div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">{t('header.title', { brand: brandName })}</h3>
            <p className="text-slate-400 text-xs">{t('header.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition relative z-10">
          <X size={20} />
        </button>
      </div>

      {sessionMode === 'WAITING_AGENT' && (
        <div className="px-4 py-2 text-xs font-semibold bg-amber-50 text-amber-800 border-b border-amber-200">
          {t('status.waitingAgent')}
        </div>
      )}
      {sessionMode === 'AGENT_LIVE' && (
        <div className="px-4 py-2 text-xs font-semibold bg-green-50 text-green-800 border-b border-green-200">
          {t('status.agentLive')}
        </div>
      )}
      {sessionMode === 'RESOLVED' && (
        <div className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 border-b border-slate-200 flex items-center justify-between gap-2">
          <span>{t('status.resolved')}</span>
          <button onClick={startFreshConversation} className="px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-bold">
            {t('actions.newChat')}
          </button>
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
        {messages.map((message, idx) => {
          const isMe = message.senderType === 'VISITOR';
          const isSystem = message.senderType === 'SYSTEM';
          const isWelcome = message.id === 'welcome';

          if (isSystem) {
            return (
              <div key={idx} className="flex justify-start animate-message">
                <div className="bg-white border border-slate-200 text-slate-600 p-3 rounded-2xl rounded-tl-none text-sm shadow-sm max-w-[90%]">
                  {isWelcome && <span className="font-bold block text-slate-800 mb-1">{message.welcomeTitle || t('greeting.title')}!</span>}
                  {message.textOriginal}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-message`}>
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm relative group ${
                  isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                <div>{isMe ? message.textOriginal : message.textTranslated || message.textOriginal || '...'}</div>
                {!isMe && message.translationProvider && (
                  <div className="absolute -bottom-4 left-0 text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Globe size={9} /> {t('labels.translated')}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start animate-message">
            <div className="bg-slate-200 p-3 rounded-2xl rounded-tl-none w-12 flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="relative">
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={sessionMode === 'RESOLVED' ? t('input.placeholderResolved') : t('input.placeholder')}
            value={input}
            disabled={sessionMode === 'RESOLVED'}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={sessionMode === 'RESOLVED'}
            className={`absolute right-1 top-1 p-2 rounded-full transition-all ${
              input.trim() && sessionMode !== 'RESOLVED'
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
