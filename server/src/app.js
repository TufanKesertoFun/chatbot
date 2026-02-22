require('dotenv').config();
const logger = require('./lib/logger');
const fastify = require('fastify')({ logger, bodyLimit: 1024 * 1024 });
const cors = require('@fastify/cors');
const socketio = require('fastify-socket.io');
const jwt = require('@fastify/jwt');
const prisma = require('./lib/prisma');

const { createOriginValidator } = require('./config/originValidator');
const { registerSecurityHeaders } = require('./plugins/securityHeaders');
const { registerInMemoryRateLimit } = require('./plugins/inMemoryRateLimit');
const { registerSocketHandlers } = require('./socket/registerSocketHandlers');
const { startInactivityAutoCloseJob } = require('./jobs/inactivityAutoClose');
const { attachI18n } = require('./i18n');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';
const originValidator = createOriginValidator({ allowedOrigins, isProd });

fastify.register(cors, {
  origin: originValidator,
  methods: ['GET', 'POST', 'DELETE'],
});

fastify.register(jwt, { secret: jwtSecret });

registerSecurityHeaders(fastify, { isProd });
registerInMemoryRateLimit(fastify);
attachI18n(fastify);

fastify.register(require('./routes/widget'), { prefix: '/api/widget' });
fastify.register(require('./routes/agent'), { prefix: '/api/agent' });
fastify.register(require('./routes/admin'), { prefix: '/api/admin' });
fastify.register(require('./routes/dashboard'), { prefix: '/api/dashboard' });

fastify.register(socketio, {
  cors: {
    origin: originValidator,
    methods: ['GET', 'POST'],
  },
});
registerSocketHandlers(fastify);

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${port}`);
    startInactivityAutoCloseJob({ prisma, io: fastify.io, log: fastify.log });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
