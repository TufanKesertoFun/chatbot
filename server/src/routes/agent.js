const agentService = require('../modules/agent/agentService');

module.exports = async function (fastify) {
  const SLA_WARN_SECONDS = Number(process.env.SLA_WARN_SECONDS || 60);

  const requireAgentRole = async (request, reply) => {
    try {
      await request.jwtVerify({ verify: { audience: 'agent', issuer: 'emlak-chat' } });
    } catch (err) {
      return reply.code(401).send({ error: request.t('errors.unauthorized') });
    }

    const role = request.user?.role;
    if (!role || !['AGENT', 'SUPER_ADMIN'].includes(role)) {
      return reply.code(403).send({ error: request.t('errors.forbidden') });
    }
  };

  const sendServiceError = (request, reply, err, fallbackStatus, fallbackKey) => {
    const statusCode = err?.statusCode || fallbackStatus;
    const message = err?.code ? request.t(err.code) : (err?.message || request.t(fallbackKey));
    return reply.code(statusCode).send({ error: message });
  };

  fastify.addHook('onRequest', requireAgentRole);

  fastify.get('/conversations', async (request, reply) => {
    try {
      const data = await agentService.listConversations({
        status: request.query?.status,
        slaWarnSeconds: SLA_WARN_SECONDS,
        io: fastify.io,
        log: fastify.log,
      });
      return data;
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedLoadConversations');
    }
  });

  fastify.get('/leads', async (request, reply) => {
    try {
      return await agentService.listLeads({
        status: request.query?.status,
        assignedAgentId: request.query?.assignedAgentId,
        from: request.query?.from,
        to: request.query?.to,
        search: request.query?.search,
        limit: request.query?.limit,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedLoadLeads');
    }
  });

  fastify.get('/leads/export', async (request, reply) => {
    const format = String(request.query?.format || 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) {
      return reply.code(400).send({ error: request.t('errors.bulkFormatInvalid') });
    }

    try {
      const rows = await agentService.exportLeads({
        status: request.query?.status,
        assignedAgentId: request.query?.assignedAgentId,
        from: request.query?.from,
        to: request.query?.to,
        search: request.query?.search,
      });

      if (format === 'csv') {
        const csv = agentService.exportLeadsCsv(rows);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="leads_export.csv"');
        return csv;
      }

      return { rows };
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedExportLeads');
    }
  });

  fastify.get('/conversations/:conversationId', async (request, reply) => {
    try {
      const conversation = await agentService.getConversationDetail(request.params.conversationId);
      if (!conversation) {
        return reply.code(404).send({ error: request.t('errors.notFound') });
      }
      return conversation;
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedLoadConversation');
    }
  });

  fastify.post(
    '/conversations/:conversationId/messages',
    { config: { rateLimit: { max: 60, windowMs: 60 * 1000 } } },
    async (request, reply) => {
      const { textTr } = request.body || {};
      if (typeof textTr !== 'string' || textTr.trim().length === 0) {
        return reply.code(400).send({ error: request.t('errors.textTrRequired') });
      }
      if (textTr.length > 4000) {
        return reply.code(413).send({ error: request.t('errors.messageTooLarge') });
      }

      try {
        return await agentService.sendAgentMessage({
          conversationId: request.params.conversationId,
          textTr,
          userId: request.user.id,
          io: fastify.io,
        });
      } catch (err) {
        return sendServiceError(request, reply, err, 500, 'errors.failedSendMessage');
      }
    }
  );

  fastify.get('/conversations/:conversationId/lead-activities', async (request, reply) => {
    try {
      return await agentService.getLeadActivities({
        conversationId: request.params.conversationId,
        limit: request.query?.limit,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedLoadLeadActivity');
    }
  });

  fastify.post('/conversations/:conversationId/lead', async (request, reply) => {
    try {
      return await agentService.updateConversationLead({
        conversationId: request.params.conversationId,
        userId: request.user.id,
        leadStatus: request.body?.leadStatus,
        leadSource: request.body?.leadSource,
        note: request.body?.note,
        userProfile: request.body?.userProfile,
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedUpdateLead');
    }
  });

  fastify.post('/assist', { config: { rateLimit: { max: 30, windowMs: 60 * 1000 } } }, async (request, reply) => {
    const { text, conversationId } = request.body || {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return reply.code(400).send({ error: request.t('errors.textRequired') });
    }
    if (text.length > 4000) {
      return reply.code(413).send({ error: request.t('errors.textTooLarge') });
    }

    try {
      return await agentService.getAssistSuggestion({ text, conversationId, userId: request.user.id });
    } catch (err) {
      if (err?.statusCode) {
        return sendServiceError(request, reply, err, err.statusCode, 'errors.generic');
      }
      return reply.code(503).send({ error: request.t('errors.llmNotConfigured') });
    }
  });

  fastify.post('/messages/:messageId/feedback', async (request, reply) => {
    const { score, correctAnswer } = request.body || {};
    if (![1, -1].includes(score)) {
      return reply.code(400).send({ error: request.t('errors.invalidScore') });
    }

    try {
      return await agentService.saveMessageFeedback({
        messageId: request.params.messageId,
        score,
        correctAnswer,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedSaveFeedback');
    }
  });

  fastify.post('/conversations/:conversationId/handoff', async (request, reply) => {
    const { botEnabled, handoffReason } = request.body || {};
    if (typeof botEnabled !== 'boolean') {
      return reply.code(400).send({ error: request.t('errors.botEnabledBoolean') });
    }
    if (
      handoffReason &&
      !['NO_DATA', 'EXPLICIT_HUMAN_REQUEST', 'NEGATIVE_SENTIMENT', 'POLICY_BLOCK'].includes(handoffReason)
    ) {
      return reply.code(400).send({ error: request.t('errors.invalidHandoffReason') });
    }

    try {
      return await agentService.updateHandoff({
        conversationId: request.params.conversationId,
        botEnabled,
        handoffReason,
        userId: request.user.id,
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedUpdateHandoff');
    }
  });

  fastify.post('/conversations/:conversationId/assign', async (request, reply) => {
    try {
      return await agentService.assignConversation({
        conversationId: request.params.conversationId,
        userId: request.user.id,
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedAssignConversation');
    }
  });

  fastify.post('/conversations/:conversationId/resolve', async (request, reply) => {
    try {
      return await agentService.resolveConversation({
        conversationId: request.params.conversationId,
        userId: request.user.id,
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedResolveConversation');
    }
  });

  fastify.post('/conversations/:conversationId/csat', async (request, reply) => {
    const { score } = request.body || {};
    if (![1, 2, 3, 4, 5].includes(score)) {
      return reply.code(400).send({ error: request.t('errors.invalidScore') });
    }

    try {
      return await agentService.saveCsat({
        conversationId: request.params.conversationId,
        score,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedSaveCsat');
    }
  });
};
