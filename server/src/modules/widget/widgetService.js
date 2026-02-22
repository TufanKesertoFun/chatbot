const prisma = require('../../lib/prisma');
const translationService = require('../../services/translation');
const ragService = require('../../services/rag');
const { maskPII } = require('../../services/privacy');
const realtime = require('../common/realtime');
const { mapMessage } = require('../common/mappers');
const { sanitizeUserProfile, mapLeadFields } = require('../common/leadUtils');
const messageTypeRuleEngine = require('../../services/messageTypeRuleEngine');
const conversationStateMachine = require('../conversation/stateMachine');

const DEFAULT_INTENT_CONFIDENCE_THRESHOLD = 0.65;

function httpError(statusCode, code, message) {
  const err = new Error(message || code);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function mapLegacyHandoffReason(reason) {
  if (reason === 'USER_REQUEST_HUMAN') return 'EXPLICIT_HUMAN_REQUEST';
  if (reason === 'SENTIMENT_RISK') return 'NEGATIVE_SENTIMENT';
  if (reason === 'OTHER') return 'NO_DATA';
  return reason;
}

function detectExplicitHumanRequest(text) {
  const normalized = messageTypeRuleEngine.normalizeText(text);
  const patterns = [
    /\binsan\b/i,
    /\btemsilci\b/i,
    /\bcanli destek\b/i,
    /\bagent\b/i,
    /\bhuman\b/i,
    /\brepresentative\b/i,
    /\boperator\b/i,
    /\bperson\b/i,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

async function resolveAgentTargetLang(conversation) {
  const fallback = (process.env.DEFAULT_AGENT_LANG || 'tr').slice(0, 5).toLowerCase();
  if (!conversation?.assigned_agent_id) return fallback;
  const user = await prisma.user.findUnique({
    where: { id: conversation.assigned_agent_id },
    select: { agent_lang: true },
  });
  return (user?.agent_lang || fallback).slice(0, 5).toLowerCase();
}

async function createLeadActivity({ conversationId, actorUserId, type, payload }) {
  await prisma.leadActivity.create({
    data: {
      conversation_id: conversationId,
      actor_user_id: actorUserId || null,
      type,
      payload: payload || undefined,
    },
  });
}

async function startSession({ visitorName, preferredLang, userProfile, signToken, io }) {
  const safeLang = typeof preferredLang === 'string' ? preferredLang.slice(0, 10).toLowerCase() : 'en';
  const { data: profileData, hasAny: hasProfileData } = sanitizeUserProfile(userProfile);
  const displayName = visitorName || profileData.visitor_full_name || 'Guest';
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        visitor_lang: safeLang || 'en',
        status: 'WAITING',
        priority: 'NORMAL',
        lead_source: hasProfileData ? 'SDK_API' : 'WIDGET',
        lead_last_contact_at: now,
        ...profileData,
      },
    });
    const participant = await tx.participant.create({
      data: { conversation_id: conversation.id, type: 'VISITOR', display_name: displayName },
    });
    await tx.conversationMetrics.create({
      data: { conversation_id: conversation.id },
    });
    if (hasProfileData) {
      await tx.leadActivity.create({
        data: {
          conversation_id: conversation.id,
          type: 'PROFILE_CAPTURED',
          payload: { fields: Object.keys(profileData), source: 'session_start' },
        },
      });
    }
    return { conversation, participant };
  });

  const wsToken = signToken(
    {
      type: 'widget',
      conversationId: result.conversation.id,
      participantId: result.participant.id,
    },
    { expiresIn: '8h', audience: 'widget', issuer: 'emlak-chat' }
  );

  realtime.emitConversationNew(io, {
    conversationId: result.conversation.id,
    visitorLang: result.conversation.visitor_lang,
    visitorName: result.participant.display_name,
    lastMessageAt: result.conversation.last_message_at,
    createdAt: result.conversation.created_at,
    status: result.conversation.status,
    botEnabled: result.conversation.bot_enabled,
    assignedAgentId: result.conversation.assigned_agent_id,
    priority: result.conversation.priority,
    leadStatus: result.conversation.lead_status,
    leadSource: result.conversation.lead_source,
    leadLastContactAt: result.conversation.lead_last_contact_at,
  });

  return {
    conversationId: result.conversation.id,
    visitorParticipantId: result.participant.id,
    visitorLang: result.conversation.visitor_lang,
    wsToken,
  };
}

async function ensureVisitorAccess({ conversationId, participantId }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
      metrics: { select: { handoff_reason: true } },
    },
  });
  if (!conversation) throw httpError(404, 'errors.conversationNotFound');
  const visitor = conversation.participants.find((participant) => participant.type === 'VISITOR');
  if (!visitor || visitor.id !== participantId) throw httpError(403, 'errors.forbiddenConversationAccess');
  return { conversation, visitor };
}

async function getOrCreateBotParticipant(conversation) {
  const existing = conversation.participants.find((participant) => participant.type === 'BOT');
  if (existing) return existing;
  return prisma.participant.create({
    data: { conversation_id: conversation.id, type: 'BOT', display_name: 'OvoBot Concierge' },
  });
}

async function saveVisitorMessage({ io, conversationId, visitorId, originalText, maskedText, sourceLang, targetAgentLang }) {
  const agentLang = targetAgentLang || 'tr';
  const translatedText = await translationService.translateText(maskedText, agentLang);
  const now = new Date();
  const message = await prisma.message.create({
    data: {
      conversation_id: conversationId,
      sender_participant_id: visitorId,
      sender_type: 'VISITOR',
      source_lang: sourceLang || 'en',
      target_lang: agentLang,
      text_original: originalText,
      text_translated: translatedText,
      text_masked: maskedText,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { last_message_at: now, lead_last_contact_at: now },
  });

  realtime.emitConversationMessage(io, conversationId, {
    id: message.id,
    conversationId,
    senderType: 'VISITOR',
    textOriginal: message.text_original,
    textTranslated: message.text_translated,
    textMasked: message.text_masked,
    sourceLang: message.source_lang,
    targetLang: message.target_lang,
    createdAt: message.created_at,
  });

  return message;
}

async function markFirstBotMetrics(conversationId) {
  const now = new Date();
  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId, first_bot_response_at: null },
    data: { first_bot_response_at: now },
  });
  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId, first_response_at: null },
    data: { first_response_at: now },
  });
}

async function emitBotMessage({ io, conversation, conversationId, targetLang, answer, citations, verificationStatus }) {
  const botParticipant = await getOrCreateBotParticipant(conversation);
  const botMessage = await prisma.message.create({
    data: {
      conversation_id: conversationId,
      sender_participant_id: botParticipant.id,
      sender_type: 'BOT',
      source_lang: targetLang,
      target_lang: 'tr',
      text_original: answer,
      text_translated: answer,
      citations: citations || [],
      verification_status: verificationStatus || 'UNVERIFIED',
    },
  });

  await markFirstBotMetrics(conversationId);
  const payload = {
    id: botMessage.id,
    conversationId,
    senderType: 'BOT',
    textOriginal: botMessage.text_original,
    textTranslated: botMessage.text_translated,
    sourceLang: botMessage.source_lang,
    createdAt: botMessage.created_at,
    citations: botMessage.citations || [],
  };
  realtime.emitConversationMessage(io, conversationId, payload);
  return payload;
}

async function switchToHandoff({ io, conversation, conversationId, detectedLang, reason, emitNotice = true }) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { bot_enabled: false, last_message_at: new Date() },
  });

  const normalizedReason = mapLegacyHandoffReason(reason) || 'NO_DATA';
  const shouldEmitHandoff = conversation.metrics?.handoff_reason == null;
  if (shouldEmitHandoff) {
    await prisma.conversationMetrics.updateMany({
      where: { conversation_id: conversationId, handoff_reason: null },
      data: { handoff_reason: normalizedReason },
    });
    realtime.emitHandoffNeeded(io, { conversationId, reason: normalizedReason });
    if (emitNotice) {
      const handoffNotice = await translationService.translateText('Sizi bir temsilciye bağlıyorum.', detectedLang || 'en');
      realtime.emitConversationMessage(io, conversationId, {
        id: `system_${Date.now()}`,
        conversationId,
        senderType: 'SYSTEM',
        textOriginal: handoffNotice,
        createdAt: new Date(),
      });
    }
  }
}

async function getConversationState({ conversationId, participantId }) {
  const { conversation } = await ensureVisitorAccess({ conversationId, participantId });
  const messages = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
    take: 100,
  });

  return {
    conversationId: conversation.id,
    status: conversation.status,
    botEnabled: conversation.bot_enabled,
    visitorLang: conversation.visitor_lang,
    lastMessageAt: conversation.last_message_at,
    messages: messages.map(mapMessage),
  };
}

async function handleAgentModeMessage({ io, conversationId, normalizedText, maskedText, visitor, detectedLang, targetAgentLang }) {
  const agentLang = targetAgentLang || 'tr';
  const now = new Date();
  const message = await prisma.message.create({
    data: {
      conversation_id: conversationId,
      sender_participant_id: visitor.id,
      sender_type: 'VISITOR',
      source_lang: detectedLang || 'en',
      target_lang: agentLang,
      text_original: normalizedText,
      text_translated: await translationService.translateText(maskedText, agentLang),
      text_masked: maskedText,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { last_message_at: now, lead_last_contact_at: now },
  });

  realtime.emitConversationMessage(io, conversationId, {
    id: message.id,
    conversationId,
    senderType: 'VISITOR',
    textOriginal: message.text_original,
    textTranslated: message.text_translated,
    textMasked: message.text_masked,
    sourceLang: message.source_lang,
    targetLang: message.target_lang,
    createdAt: message.created_at,
  });

  return { messageId: message.id, handledByBot: false };
}

async function updateSessionProfile({ conversationId, participantId, userProfile, io }) {
  const { conversation } = await ensureVisitorAccess({ conversationId, participantId });
  const { data: profileData, hasAny } = sanitizeUserProfile(userProfile);
  if (!hasAny) {
    throw httpError(400, 'errors.invalidUserProfile');
  }

  const changedFields = Object.entries(profileData)
    .filter(([key, value]) => conversation[key] !== value)
    .map(([key]) => key);
  if (changedFields.length === 0) {
    return { success: true, updated: false, lead: mapLeadFields(conversation) };
  }

  const hadProfile =
    Boolean(conversation.visitor_external_id) ||
    Boolean(conversation.visitor_email) ||
    Boolean(conversation.visitor_full_name) ||
    Boolean(conversation.visitor_phone);

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...profileData,
      lead_source: conversation.lead_source === 'WIDGET' ? 'SDK_API' : conversation.lead_source,
    },
  });

  await createLeadActivity({
    conversationId,
    type: hadProfile ? 'PROFILE_UPDATED' : 'PROFILE_CAPTURED',
    payload: { fields: changedFields, source: 'widget_profile_update' },
  });

  realtime.emitConversationUpdated(io, {
    conversationId: updatedConversation.id,
    lead: mapLeadFields(updatedConversation),
  });

  return {
    success: true,
    updated: true,
    lead: mapLeadFields(updatedConversation),
  };
}

async function processVisitorMessage({ conversationId, text, participantId, io, log }) {
  const normalizedText = text.trim();
  const { masked: maskedText } = maskPII(normalizedText);
  log.debug({ event: 'widget.message', conversationId, length: normalizedText.length }, 'Widget message received');

  const { conversation, visitor } = await ensureVisitorAccess({ conversationId, participantId });
  if (conversation.status === 'RESOLVED') {
    throw httpError(409, 'errors.conversationResolved');
  }

  let detectedLang = conversation.visitor_lang;
  const targetAgentLang = await resolveAgentTargetLang(conversation);
  const actualLang = await translationService.detectLanguage(maskedText);
  if (actualLang && actualLang !== conversation.visitor_lang) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { visitor_lang: actualLang },
    });
    detectedLang = actualLang;
  }

  if (conversation.bot_enabled === false) {
    return handleAgentModeMessage({
      io,
      conversationId,
      normalizedText,
      maskedText,
      visitor,
      detectedLang,
      targetAgentLang,
    });
  }

  await saveVisitorMessage({
    io,
    conversationId,
    visitorId: visitor.id,
    originalText: normalizedText,
    maskedText,
    sourceLang: detectedLang || 'en',
    targetAgentLang,
  });

  const messageType = messageTypeRuleEngine.detectMessageType(maskedText);
  if (messageType) {
    const template = messageTypeRuleEngine.buildTemplate(messageType, detectedLang);
    const botPayload = await emitBotMessage({
      io,
      conversation,
      conversationId,
      targetLang: detectedLang || 'en',
      answer: template,
      citations: [],
      verificationStatus: 'UNVERIFIED',
    });
    log.info({ event: 'widget.rule_engine_answer', conversationId, messageType }, 'Rule engine answered');
    return { handledByBot: true, botMessage: botPayload, messageType };
  }

  const activeConfig = await ragService.getActiveConfig();
  const useIntentClassifier = activeConfig?.enable_intent_classifier ?? true;
  const useFutureStateMachine = activeConfig?.enable_future_state_machine ?? false;
  const intentConfidenceThreshold = activeConfig?.intent_confidence_threshold ?? DEFAULT_INTENT_CONFIDENCE_THRESHOLD;

  if (useFutureStateMachine) {
    const currentState = conversationStateMachine.getInitialState();
    log.debug(
      { event: 'future.state_machine.loaded', conversationId, currentState },
      'Future state machine placeholder loaded'
    );
  }

  let intentDecision = {
    intent: 'INFORMATION_REQUEST',
    requires_handoff: false,
    confidence: useIntentClassifier ? 0.5 : 1,
    source: 'fallback',
  };
  if (useIntentClassifier) {
    try {
      intentDecision = await ragService.classifyIntent(maskedText, detectedLang || 'en');
    } catch (err) {
      log.warn({ event: 'widget.intent_error', conversationId, message: err.message }, 'Intent classifier failed');
    }
  }
  if (detectExplicitHumanRequest(maskedText)) {
    intentDecision = {
      intent: 'HUMAN_REQUEST',
      requires_handoff: true,
      confidence: 1,
      source: 'heuristic',
    };
  }

  log.info(
    {
      event: 'widget.intent_decision',
      conversationId,
      intent: intentDecision.intent,
      requires_handoff: intentDecision.requires_handoff,
      confidence: intentDecision.confidence,
      source: intentDecision.source,
    },
    'Intent decision'
  );

  if (intentDecision.intent === 'HUMAN_REQUEST' && intentDecision.requires_handoff) {
    await switchToHandoff({
      io,
      conversation,
      conversationId,
      detectedLang,
      reason: 'EXPLICIT_HUMAN_REQUEST',
      emitNotice: true,
    });
    return { handledByBot: false, handoffReason: 'EXPLICIT_HUMAN_REQUEST' };
  }

  if (intentDecision.confidence < intentConfidenceThreshold || intentDecision.intent === 'CONVERSATIONAL') {
    const clarificationText = messageTypeRuleEngine.buildTemplate('CLARIFICATION', detectedLang || 'en');
    const botPayload = await emitBotMessage({
      io,
      conversation,
      conversationId,
      targetLang: detectedLang || 'en',
      answer: clarificationText,
      citations: [],
      verificationStatus: 'UNVERIFIED',
    });
    return { handledByBot: true, botMessage: botPayload, clarification: true };
  }

  let botResponse = null;
  try {
    const ragResult = await ragService.generateRAGResponse(maskedText, detectedLang);
    if (ragResult.found) botResponse = ragResult;
  } catch (err) {
    log.error({ event: 'widget.rag_error', conversationId, message: err.message }, 'RAG error');
  }

  if (botResponse) {
    const botPayload = await emitBotMessage({
      io,
      conversation,
      conversationId,
      targetLang: detectedLang || 'en',
      answer: botResponse.answer,
      citations: botResponse.citations || [],
      verificationStatus: botResponse.verificationStatus || 'SUPPORTED',
    });
    return { handledByBot: true, botMessage: botPayload };
  }

  const noDataFallbackByLang = (langCode) => {
    const safe = String(langCode || 'en').toLowerCase();
    if (safe.startsWith('tr')) {
      return 'Bu konuda yeterli bilgi bulamadim. Isterseniz soruyu daha detayli yazin veya sizi temsilciye baglayabilirim.';
    }
    return 'I could not find enough information for that yet. You can ask with more detail, or I can connect you to a human agent.';
  };

  const fallbackPayload = await emitBotMessage({
    io,
    conversation,
    conversationId,
    targetLang: detectedLang || 'en',
    answer: noDataFallbackByLang(detectedLang || 'en'),
    citations: [],
    verificationStatus: 'UNVERIFIED',
  });
  return { handledByBot: true, botMessage: fallbackPayload, noData: true };
}

module.exports = {
  startSession,
  getConversationState,
  processVisitorMessage,
  updateSessionProfile,
  httpError,
};
