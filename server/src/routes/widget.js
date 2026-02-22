const widgetService = require('../modules/widget/widgetService');

module.exports = async function (fastify) {
  const verifyWidgetAuth = async (request, reply) => {
    try {
      await request.jwtVerify({ verify: { audience: 'widget', issuer: 'emlak-chat' } });
    } catch (err) {
      return reply.code(401).send({ error: request.t('errors.unauthorized') });
    }

    const { conversationId } = request.params || {};
    if (!conversationId || request.user?.conversationId !== conversationId) {
      return reply.code(403).send({ error: request.t('errors.forbidden') });
    }
  };

  const sendServiceError = (request, reply, err, fallbackStatus, fallbackKey) => {
    const statusCode = err?.statusCode || fallbackStatus;
    const message = err?.code ? request.t(err.code) : (err?.message || request.t(fallbackKey));
    return reply.code(statusCode).send({ error: message });
  };

  fastify.post('/session', async (request, reply) => {
    try {
      return await widgetService.startSession({
        visitorName: request.body?.visitorName,
        preferredLang: request.body?.preferredLang,
        userProfile: request.body?.userProfile,
        signToken: fastify.jwt.sign.bind(fastify.jwt),
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedStartSession');
    }
  });

  fastify.get('/conversations/:conversationId/state', { preHandler: verifyWidgetAuth }, async (request, reply) => {
    try {
      return await widgetService.getConversationState({
        conversationId: request.params.conversationId,
        participantId: request.user?.participantId,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedLoadConversationState');
    }
  });

  fastify.post('/conversations/:conversationId/profile', { preHandler: verifyWidgetAuth }, async (request, reply) => {
    try {
      return await widgetService.updateSessionProfile({
        conversationId: request.params.conversationId,
        participantId: request.user?.participantId,
        userProfile: request.body?.userProfile,
        io: fastify.io,
      });
    } catch (err) {
      return sendServiceError(request, reply, err, 500, 'errors.failedUpdateProfile');
    }
  });

  fastify.post(
    '/conversations/:conversationId/messages',
    { preHandler: verifyWidgetAuth, config: { rateLimit: { max: 30, windowMs: 60 * 1000 } } },
    async (request, reply) => {
      const { text } = request.body || {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        return reply.code(400).send({ error: request.t('errors.textRequired') });
      }
      if (text.length > 4000) {
        return reply.code(413).send({ error: request.t('errors.messageTooLarge') });
      }

      try {
        return await widgetService.processVisitorMessage({
          conversationId: request.params.conversationId,
          text,
          participantId: request.user?.participantId,
          io: fastify.io,
          log: fastify.log,
        });
      } catch (err) {
        return sendServiceError(request, reply, err, 500, 'errors.failedProcessMessage');
      }
    }
  );
};
