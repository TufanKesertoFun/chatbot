function registerInMemoryRateLimit(fastify) {
  const rateLimitStore = new Map();
  const defaultRateLimit = { windowMs: 60 * 1000, max: 120 };
  const tokenBudgetStore = new Map();
  const tokenWindowMs = 60 * 1000;
  const tokenBudget = 3000;
  let lastRateLimitCleanup = 0;

  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.user && request.headers?.authorization?.startsWith('Bearer ')) {
      const token = request.headers.authorization.replace('Bearer ', '');
      try {
        const decoded = fastify.jwt.verify(token, { issuer: 'emlak-chat' });
        request.user = decoded;
      } catch (err) {
        // Route-level auth will handle auth errors.
      }
    }

    const cfg = request.routeOptions?.config?.rateLimit || defaultRateLimit;
    const windowMs = cfg.windowMs || defaultRateLimit.windowMs;
    const max = cfg.max || defaultRateLimit.max;
    const now = Date.now();
    const key = `${request.ip}:${request.routerPath || request.raw.url}`;
    const tokenKey = request.user?.conversationId ? `conv:${request.user.conversationId}` : null;
    const payloadText = request.body?.text || request.body?.textTr || request.body?.content || '';
    const estimatedTokens = typeof payloadText === 'string' ? Math.ceil(payloadText.length / 4) : 0;

    if (now - lastRateLimitCleanup > 5 * 60 * 1000) {
      for (const [storeKey, value] of rateLimitStore.entries()) {
        if (now > value.resetAt) rateLimitStore.delete(storeKey);
      }
      for (const [storeKey, value] of tokenBudgetStore.entries()) {
        if (now > value.resetAt) tokenBudgetStore.delete(storeKey);
      }
      lastRateLimitCleanup = now;
    }

    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count += 1;
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    reply.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      reply.header('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return reply.code(429).send({ error: 'Too Many Requests' });
    }

    if (tokenKey && estimatedTokens > 0) {
      let tokenEntry = tokenBudgetStore.get(tokenKey);
      if (!tokenEntry || now > tokenEntry.resetAt) {
        tokenEntry = { used: 0, resetAt: now + tokenWindowMs };
        tokenBudgetStore.set(tokenKey, tokenEntry);
      }
      tokenEntry.used += estimatedTokens;
      reply.header('X-TokenBudget-Limit', tokenBudget);
      reply.header('X-TokenBudget-Remaining', Math.max(0, tokenBudget - tokenEntry.used));
      if (tokenEntry.used > tokenBudget) {
        reply.header('Retry-After', Math.ceil((tokenEntry.resetAt - now) / 1000));
        return reply.code(429).send({ error: 'Token budget exceeded' });
      }
    }
  });
}

module.exports = { registerInMemoryRateLimit };

