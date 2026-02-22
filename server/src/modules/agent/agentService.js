const prisma = require('../../lib/prisma');
const translationService = require('../../services/translation');
const ragService = require('../../services/rag');
const { maskPII } = require('../../services/privacy');
const { mapConversationListItem, mapMessage } = require('../common/mappers');
const { sanitizeUserProfile, normalizeLeadStatus, normalizeLeadSource, mapLeadFields } = require('../common/leadUtils');
const realtime = require('../common/realtime');

function httpError(statusCode, code, message) {
  const err = new Error(message || code);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizeStatusFilter(status) {
  return ['WAITING', 'ASSIGNED', 'RESOLVED'].includes(status) ? status : null;
}

function toCsv(rows, headers) {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    return `"${String(value).replace(/"/g, '""')}"`;
  };
  const headerLine = headers.map((header) => escape(header)).join(',');
  const lines = rows.map((row) => headers.map((header) => escape(row[header])).join(','));
  return [headerLine, ...lines].join('\n');
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

async function getAgentLanguage(userId) {
  if (!userId) return 'tr';
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agent_lang: true },
  });
  return (user?.agent_lang || 'tr').slice(0, 5).toLowerCase();
}

async function localizeVisitorMessagesForAgent({ conversationId, agentLang }) {
  const messages = await prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      sender_type: 'VISITOR',
      target_lang: { not: agentLang },
    },
    select: { id: true, text_masked: true, text_original: true },
  });

  for (const message of messages) {
    const source = message.text_masked || message.text_original || '';
    const translated = await translationService.translateText(source, agentLang);
    await prisma.message.update({
      where: { id: message.id },
      data: { target_lang: agentLang, text_translated: translated },
    });
  }
}

async function listConversations({ status, slaWarnSeconds, io, log }) {
  const statusFilter = normalizeStatusFilter(status);
  const conversations = await prisma.conversation.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    orderBy: { last_message_at: 'desc' },
    include: {
      participants: { where: { type: 'VISITOR' }, select: { display_name: true } },
      metrics: { select: { handoff_reason: true } },
    },
  });

  const now = Date.now();
  const escalationIds = [];
  const data = conversations.map((conversation) => {
    const baseTime = conversation.last_message_at || conversation.created_at;
    const waitSeconds = baseTime ? Math.floor((now - new Date(baseTime).getTime()) / 1000) : 0;
    if (conversation.status === 'WAITING' && conversation.priority !== 'HIGH' && waitSeconds >= slaWarnSeconds) {
      escalationIds.push(conversation.id);
    }
    return mapConversationListItem(conversation, waitSeconds);
  });

  if (escalationIds.length > 0) {
    await prisma.conversation.updateMany({
      where: { id: { in: escalationIds }, priority: { not: 'HIGH' } },
      data: { priority: 'HIGH' },
    });
    escalationIds.forEach((conversationId) => {
      realtime.emitConversationEscalated(io, { conversationId, priority: 'HIGH' });
    });
    log.warn({ count: escalationIds.length }, 'SLA escalation triggered');
  }

  return data;
}

async function getConversationDetail(conversationId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { created_at: 'asc' } },
      participants: true,
    },
  });

  if (!conversation) return null;

  return {
    conversationId: conversation.id,
    status: conversation.status,
    visitorLang: conversation.visitor_lang,
    lead: mapLeadFields(conversation),
    participants: conversation.participants,
    messages: conversation.messages.map(mapMessage),
  };
}

async function sendAgentMessage({ conversationId, textTr, userId, io }) {
  const normalizedTextTr = textTr.trim();
  const { masked: maskedText } = maskPII(normalizedTextTr);
  const agentLang = await getAgentLanguage(userId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation) {
    throw httpError(404, 'errors.conversationNotFound');
  }

  if (conversation.assigned_agent_id && conversation.assigned_agent_id !== userId) {
    throw httpError(409, 'errors.conversationAlreadyAssigned');
  }

  let agentParticipant = conversation.participants.find((participant) => participant.type === 'AGENT');
  if (!agentParticipant) {
    agentParticipant = await prisma.participant.create({
      data: {
        conversation_id: conversationId,
        type: 'AGENT',
        display_name: 'Support Agent',
      },
    });
  }

  const targetLang = conversation.visitor_lang || 'en';
  const translatedText = await translationService.translateText(maskedText, targetLang);

  const message = await prisma.$transaction(async (tx) => {
    if (!conversation.assigned_agent_id) {
      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          assigned_agent_id: userId,
          assigned_at: new Date(),
          status: 'ASSIGNED',
        },
      });

      realtime.emitConversationAssigned(io, {
        conversationId: updated.id,
        assignedAgentId: updated.assigned_agent_id,
        status: updated.status,
      });
    }

    return tx.message.create({
      data: {
        conversation_id: conversationId,
        sender_participant_id: agentParticipant.id,
        sender_type: 'AGENT',
        source_lang: agentLang,
        target_lang: targetLang,
        text_original: normalizedTextTr,
        text_translated: translatedText,
        text_masked: maskedText,
      },
    });
  });

  const now = new Date();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { bot_enabled: false, last_message_at: now, lead_last_contact_at: now },
  });

  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId, first_agent_response_at: null },
    data: { first_agent_response_at: now },
  });
  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId, first_response_at: null },
    data: { first_response_at: now },
  });
  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId, handoff_reason: null },
    data: { handoff_reason: 'EXPLICIT_HUMAN_REQUEST' },
  });

  const payload = {
    id: message.id,
    conversationId,
    senderType: 'AGENT',
    textOriginal: message.text_original,
    textTranslated: message.text_translated,
    textMasked: message.text_masked,
    createdAt: message.created_at,
  };
  realtime.emitConversationMessage(io, conversationId, payload);

  return {
    messageId: message.id,
    translatedTo: targetLang,
    translatedText,
  };
}

async function updateConversationLead({ conversationId, userId, leadStatus, leadSource, note, userProfile, io }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw httpError(404, 'errors.conversationNotFound');

  const nextStatus = normalizeLeadStatus(leadStatus);
  const nextSource = normalizeLeadSource(leadSource);
  const profileInput = sanitizeUserProfile(userProfile);
  const noteText = typeof note === 'string' ? note.trim() : '';
  if (noteText.length > 2000) {
    throw httpError(400, 'errors.textTooLarge');
  }

  const data = {};
  if (nextStatus) data.lead_status = nextStatus;
  if (nextSource) data.lead_source = nextSource;
  if (profileInput.hasAny) {
    Object.assign(data, profileInput.data);
  }

  const shouldAddNote = noteText.length > 0;
  if (Object.keys(data).length === 0 && !shouldAddNote) {
    throw httpError(400, 'errors.invalidLeadUpdatePayload');
  }

  const changedProfileFields = Object.entries(profileInput.data || {})
    .filter(([key, value]) => conversation[key] !== value)
    .map(([key]) => key);
  const statusChanged = nextStatus && nextStatus !== conversation.lead_status;
  const sourceChanged = nextSource && nextSource !== conversation.lead_source;
  const hasRealProfileChange = changedProfileFields.length > 0;

  const updatedConversation = Object.keys(data).length > 0
    ? await prisma.conversation.update({
      where: { id: conversationId },
      data,
    })
    : conversation;

  const hadProfileBefore =
    Boolean(conversation.visitor_external_id) ||
    Boolean(conversation.visitor_email) ||
    Boolean(conversation.visitor_full_name) ||
    Boolean(conversation.visitor_phone);

  if (hasRealProfileChange) {
    await createLeadActivity({
      conversationId,
      actorUserId: userId,
      type: hadProfileBefore ? 'PROFILE_UPDATED' : 'PROFILE_CAPTURED',
      payload: { fields: changedProfileFields, source: 'agent_panel' },
    });
  }

  if (statusChanged || sourceChanged) {
    await createLeadActivity({
      conversationId,
      actorUserId: userId,
      type: 'STATUS_UPDATED',
      payload: {
        fromStatus: conversation.lead_status,
        toStatus: updatedConversation.lead_status,
        fromSource: conversation.lead_source,
        toSource: updatedConversation.lead_source,
      },
    });
  }

  if (shouldAddNote) {
    await createLeadActivity({
      conversationId,
      actorUserId: userId,
      type: 'NOTE_ADDED',
      payload: { note: noteText },
    });
  }

  realtime.emitConversationUpdated(io, {
    conversationId: updatedConversation.id,
    lead: mapLeadFields(updatedConversation),
  });

  return {
    success: true,
    lead: mapLeadFields(updatedConversation),
    changed: {
      profileFields: changedProfileFields,
      statusChanged,
      sourceChanged,
      noteAdded: shouldAddNote,
    },
  };
}

async function getLeadActivities({ conversationId, limit = 50 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
  if (!conversation) throw httpError(404, 'errors.conversationNotFound');

  const rows = await prisma.leadActivity.findMany({
    where: { conversation_id: conversationId },
    include: {
      actor_user: {
        select: { id: true, full_name: true, email: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: safeLimit,
  });

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    type: row.type,
    payload: row.payload || {},
    createdAt: row.created_at,
    actor: row.actor_user
      ? {
        id: row.actor_user.id,
        fullName: row.actor_user.full_name,
        email: row.actor_user.email,
      }
      : null,
  }));
}

async function listLeads({ status, assignedAgentId, from, to, search, limit = 100 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const statusList = String(status || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeLeadStatus(value));

  const where = {};
  if (statusList.length > 0) {
    where.lead_status = { in: statusList };
  }
  if (assignedAgentId) {
    where.assigned_agent_id = assignedAgentId;
  }
  if (from || to) {
    const createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) throw httpError(400, 'errors.invalidDateRange');
      createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) throw httpError(400, 'errors.invalidDateRange');
      createdAt.lte = toDate;
    }
    where.created_at = createdAt;
  }

  const trimmedSearch = typeof search === 'string' ? search.trim() : '';
  if (trimmedSearch) {
    where.OR = [
      { visitor_email: { contains: trimmedSearch, mode: 'insensitive' } },
      { visitor_full_name: { contains: trimmedSearch, mode: 'insensitive' } },
      { visitor_phone: { contains: trimmedSearch, mode: 'insensitive' } },
      { visitor_external_id: { contains: trimmedSearch, mode: 'insensitive' } },
    ];
  }

  const conversations = await prisma.conversation.findMany({
    where,
    take: safeLimit,
    orderBy: [{ lead_last_contact_at: 'desc' }, { last_message_at: 'desc' }],
    include: {
      assigned_agent: { select: { id: true, full_name: true, email: true } },
      participants: { where: { type: 'VISITOR' }, select: { display_name: true } },
    },
  });

  return conversations.map((conversation) => ({
    conversationId: conversation.id,
    visitorName: conversation.participants[0]?.display_name || conversation.visitor_full_name || 'Unknown',
    visitorLang: conversation.visitor_lang,
    status: conversation.status,
    assignedAgentId: conversation.assigned_agent_id,
    assignedAgentName: conversation.assigned_agent?.full_name || null,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    lead: mapLeadFields(conversation),
  }));
}

async function exportLeads(filters) {
  const rows = await listLeads({ ...filters, limit: 5000 });
  return rows.map((row) => ({
    conversation_id: row.conversationId,
    visitor_name: row.visitorName,
    visitor_lang: row.visitorLang,
    lead_status: row.lead.status,
    lead_source: row.lead.source,
    visitor_full_name: row.lead.fullName || '',
    visitor_email: row.lead.email || '',
    visitor_phone: row.lead.phone || '',
    visitor_external_id: row.lead.externalId || '',
    assigned_agent_id: row.assignedAgentId || '',
    assigned_agent_name: row.assignedAgentName || '',
    created_at: row.createdAt,
    last_message_at: row.lastMessageAt,
    last_contact_at: row.lead.lastContactAt || '',
  }));
}

function exportLeadsCsv(rows) {
  return toCsv(rows, [
    'conversation_id',
    'visitor_name',
    'visitor_lang',
    'lead_status',
    'lead_source',
    'visitor_full_name',
    'visitor_email',
    'visitor_phone',
    'visitor_external_id',
    'assigned_agent_id',
    'assigned_agent_name',
    'created_at',
    'last_message_at',
    'last_contact_at',
  ]);
}

async function getAssistSuggestion({ text, conversationId, userId }) {
  const normalizedText = text.trim();
  const { masked: maskedText } = maskPII(normalizedText);
  const targetLang = await getAgentLanguage(userId);

  const ragResult = await ragService.generateRAGResponse(maskedText, targetLang);
  const fallbackSuggestion = await translationService.translateText(
    'Knowledge base could not provide a direct answer.',
    targetLang
  );
  return {
    suggestion: ragResult.found ? ragResult.answer : fallbackSuggestion,
    citations: ragResult.citations,
  };
}

async function saveMessageFeedback({ messageId, score, correctAnswer }) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { feedback: score },
  });

  if (score === -1 && correctAnswer && typeof correctAnswer === 'string' && correctAnswer.trim().length > 0) {
    const lastVisitorMsg = await prisma.message.findFirst({
      where: {
        conversation_id: message.conversation_id,
        sender_type: 'VISITOR',
        created_at: { lt: message.created_at },
      },
      orderBy: { created_at: 'desc' },
    });

    const { masked: questionMasked } = maskPII(lastVisitorMsg?.text_original || '');
    const { masked: botMasked } = maskPII(message.text_original || '');
    const { masked: correctMasked } = maskPII(correctAnswer.trim());

    await prisma.trainingExample.create({
      data: {
        message_id: message.id,
        conversation_id: message.conversation_id,
        question: lastVisitorMsg?.text_original || '',
        question_masked: lastVisitorMsg?.text_masked || questionMasked,
        bot_answer: message.text_original,
        bot_answer_masked: botMasked,
        correct_answer: correctAnswer.trim(),
        correct_answer_masked: correctMasked,
        feedback_score: score,
      },
    });
  }

  return { success: true, messageId: message.id, feedback: message.feedback };
}

async function updateHandoff({ conversationId, botEnabled, handoffReason, userId, io }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw httpError(404, 'errors.conversationNotFound');

  if (!botEnabled && conversation.assigned_agent_id && conversation.assigned_agent_id !== userId) {
    throw httpError(409, 'errors.conversationAlreadyAssigned');
  }

  const updatedConv = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      bot_enabled: botEnabled,
      assigned_agent_id: botEnabled ? conversation.assigned_agent_id : (conversation.assigned_agent_id || userId),
      assigned_at: botEnabled ? conversation.assigned_at : (conversation.assigned_at || new Date()),
      status: botEnabled ? conversation.status : (conversation.status === 'RESOLVED' ? 'RESOLVED' : 'ASSIGNED'),
    },
  });

  if (!botEnabled) {
      await prisma.conversationMetrics.updateMany({
        where: { conversation_id: conversationId, handoff_reason: null },
        data: { handoff_reason: handoffReason || 'EXPLICIT_HUMAN_REQUEST' },
      });
      const agentLang = await getAgentLanguage(updatedConv.assigned_agent_id || userId);
      await localizeVisitorMessagesForAgent({ conversationId, agentLang });
  }

  realtime.emitConversationUpdated(io, {
    conversationId: updatedConv.id,
    botEnabled: updatedConv.bot_enabled,
  });
  realtime.emitConversationStatusChanged(io, {
    conversationId: updatedConv.id,
    status: updatedConv.status,
    assignedAgentId: updatedConv.assigned_agent_id,
  });

  return { success: true, botEnabled: updatedConv.bot_enabled };
}

async function assignConversation({ conversationId, userId, io }) {
  const result = await prisma.conversation.updateMany({
    where: { id: conversationId, assigned_agent_id: null, status: { not: 'RESOLVED' } },
    data: { assigned_agent_id: userId, assigned_at: new Date(), status: 'ASSIGNED' },
  });

  if (result.count === 0) {
    throw httpError(409, 'errors.conversationAlreadyAssignedOrResolved');
  }

  const updated = await prisma.conversation.findUnique({ where: { id: conversationId } });
  const agentLang = await getAgentLanguage(userId);
  await localizeVisitorMessagesForAgent({ conversationId, agentLang });
  realtime.emitConversationAssigned(io, {
    conversationId,
    assignedAgentId: updated.assigned_agent_id,
    status: updated.status,
  });
  realtime.emitConversationStatusChanged(io, {
    conversationId,
    status: updated.status,
  });

  return { success: true, conversationId, assignedAgentId: updated.assigned_agent_id };
}

async function resolveConversation({ conversationId, userId, io }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw httpError(404, 'errors.conversationNotFound');
  if (conversation.assigned_agent_id && conversation.assigned_agent_id !== userId) {
    throw httpError(409, 'errors.conversationAlreadyAssigned');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'RESOLVED', resolved_at: new Date() },
  });

  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId },
    data: { resolved_at: updated.resolved_at },
  });

  realtime.emitConversationStatusChanged(io, {
    conversationId: updated.id,
    status: updated.status,
  });
  realtime.emitConversationStatusToRoom(io, conversationId, {
    conversationId: updated.id,
    status: updated.status,
  });

  return { success: true, status: updated.status };
}

async function saveCsat({ conversationId, score }) {
  await prisma.conversationMetrics.updateMany({
    where: { conversation_id: conversationId },
    data: { csat_score: score },
  });
  return { success: true, score };
}

module.exports = {
  listConversations,
  getConversationDetail,
  sendAgentMessage,
  updateConversationLead,
  getLeadActivities,
  listLeads,
  exportLeads,
  exportLeadsCsv,
  getAssistSuggestion,
  saveMessageFeedback,
  updateHandoff,
  assignConversation,
  resolveConversation,
  saveCsat,
  httpError,
};
