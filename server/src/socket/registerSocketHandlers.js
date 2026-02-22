const realtime = require('../modules/common/realtime');

function registerSocketHandlers(fastify) {
  fastify.ready((err) => {
    if (err) throw err;

    fastify.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Unauthorized'));
      try {
        const decoded = fastify.jwt.verify(token, { issuer: 'emlak-chat' });
        const aud = decoded?.aud;
        const allowed = Array.isArray(aud) ? aud : [aud];
        if (!allowed.includes('agent') && !allowed.includes('widget')) {
          return next(new Error('Unauthorized'));
        }
        socket.data.user = decoded;
        return next();
      } catch (error) {
        return next(new Error('Unauthorized'));
      }
    });

    fastify.io.on('connection', (socket) => {
      fastify.log.info(`Socket connected: ${socket.id}`);

      socket.on('join', (data) => {
        const { conversationId } = data || {};
        const user = socket.data.user;
        if (!conversationId) return;
        if (user?.type === 'widget' && user.conversationId !== conversationId) {
          return;
        }
        socket.join(`conversation_${conversationId}`);
        fastify.log.info(`Socket ${socket.id} joined room conversation_${conversationId}`);
      });

      socket.on('join_agent_queue', () => {
        const user = socket.data.user;
        if (user?.type === 'agent' || user?.role === 'AGENT' || user?.role === 'SUPER_ADMIN') {
          socket.join('agent_queue');
          fastify.log.info(`Socket ${socket.id} joined agent_queue`);
        }
      });

      socket.on('disconnect', () => {
        const user = socket.data.user;
        if (user?.type === 'widget' && user.conversationId) {
          realtime.emitVisitorLeft(fastify.io, {
            conversationId: user.conversationId,
            at: new Date(),
          });
        }
      });
    });
  });
}

module.exports = { registerSocketHandlers };

