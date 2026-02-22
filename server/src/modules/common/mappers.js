const { mapLeadFields } = require('./leadUtils');

function mapMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderParticipantId: message.sender_participant_id,
    senderType: message.sender_type,
    textOriginal: message.text_original,
    textTranslated: message.text_translated,
    textMasked: message.text_masked,
    sourceLang: message.source_lang,
    targetLang: message.target_lang,
    createdAt: message.created_at,
    citations: message.citations,
    verificationStatus: message.verification_status,
    feedback: message.feedback,
  };
}

function mapConversationListItem(conversation, waitSeconds) {
  return {
    conversationId: conversation.id,
    visitorName: conversation.visitor_full_name || conversation.participants[0]?.display_name || 'Unknown',
    visitorLang: conversation.visitor_lang,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    status: conversation.status,
    botEnabled: conversation.bot_enabled,
    assignedAgentId: conversation.assigned_agent_id,
    assignedAt: conversation.assigned_at,
    resolvedAt: conversation.resolved_at,
    priority: conversation.priority,
    needsHandoff: conversation.status === 'WAITING' && conversation.metrics?.handoff_reason === 'NO_DATA',
    waitSeconds,
    lead: mapLeadFields(conversation),
  };
}

module.exports = {
  mapMessage,
  mapConversationListItem,
};
