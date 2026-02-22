const prisma = require('../lib/prisma');

module.exports = async function (fastify, opts) {
  
  // Middleware: Sadece giriş yapmış kullanıcılar görebilir
  fastify.addHook('onRequest', async (request, reply) => {
    try { 
      await request.jwtVerify({ verify: { audience: 'agent', issuer: 'emlak-chat' } }); 
    } catch (err) { 
      return reply.code(401).send({ error: request.t('errors.unauthorized') }); 
    }

    const role = request.user?.role;
    if (!role || !['AGENT', 'SUPER_ADMIN'].includes(role)) {
      return reply.code(403).send({ error: request.t('errors.forbidden') });
    }
  });

  // GET /api/dashboard/stats
  fastify.get('/stats', async (request, reply) => {
    const { range, from, to } = request.query || {};
    const now = new Date();
    const parseDate = (value) => {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    let startDate = null;
    let endDate = null;

    if (from) startDate = parseDate(from);
    if (to) endDate = parseDate(to);
    if ((from && !startDate) || (to && !endDate)) {
      return reply.code(400).send({ error: request.t('errors.invalidDateRange') });
    }

    if (!startDate) {
      const fallbackRange = range === 'day' ? 'day' : 'week';
      const days = fallbackRange === 'day' ? 1 : 7;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    if (!endDate) endDate = now;

    const [openConvs, totalMsgs, botMsgs, slaBreached, metrics, lastEval] = await prisma.$transaction([
      prisma.conversation.count({ where: { status: { in: ['WAITING', 'ASSIGNED'] } } }),
      prisma.message.count({ where: { created_at: { gte: startDate, lte: endDate } } }),
      prisma.message.count({ where: { sender_type: 'BOT', created_at: { gte: startDate, lte: endDate } } }),
      prisma.conversation.count({ where: { status: 'WAITING', priority: 'HIGH' } }),
      prisma.conversationMetrics.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: {
          created_at: true,
          first_response_at: true,
          first_bot_response_at: true,
          first_agent_response_at: true,
          resolved_at: true,
          handoff_reason: true,
          csat_score: true
        }
      }),
      prisma.evalRun.findFirst({ orderBy: { created_at: 'desc' } })
    ]);

    const botRatio = totalMsgs > 0 ? ((botMsgs / totalMsgs) * 100).toFixed(1) : 0;
    const totalConversations = metrics.length;
    const deflectedCount = metrics.filter(m => m.resolved_at && !m.first_agent_response_at).length;
    const handoffCount = metrics.filter(m => m.handoff_reason || m.first_agent_response_at).length;

    const handoffReasons = {
      NO_DATA: 0,
      EXPLICIT_HUMAN_REQUEST: 0,
      NEGATIVE_SENTIMENT: 0,
      POLICY_BLOCK: 0,
    };
    metrics.forEach(m => {
      if (!m.handoff_reason) return;
      const normalizedReason =
        m.handoff_reason === 'USER_REQUEST_HUMAN'
          ? 'EXPLICIT_HUMAN_REQUEST'
          : m.handoff_reason === 'SENTIMENT_RISK'
            ? 'NEGATIVE_SENTIMENT'
            : m.handoff_reason === 'OTHER'
              ? 'NO_DATA'
              : m.handoff_reason;
      if (handoffReasons[normalizedReason] !== undefined) {
        handoffReasons[normalizedReason] += 1;
      }
    });

    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const toMs = (end, start) => end && start ? (new Date(end).getTime() - new Date(start).getTime()) : null;

    const firstResponseMs = metrics
      .map(m => toMs(m.first_response_at, m.created_at))
      .filter(v => typeof v === 'number' && v >= 0);
    const firstBotResponseMs = metrics
      .map(m => toMs(m.first_bot_response_at, m.created_at))
      .filter(v => typeof v === 'number' && v >= 0);
    const firstAgentResponseMs = metrics
      .map(m => toMs(m.first_agent_response_at, m.created_at))
      .filter(v => typeof v === 'number' && v >= 0);
    const resolutionMs = metrics
      .map(m => toMs(m.resolved_at, m.created_at))
      .filter(v => typeof v === 'number' && v >= 0);

    const csatScores = metrics.map(m => m.csat_score).filter(v => typeof v === 'number');

    return {
      range: { from: startDate, to: endDate, mode: range || (from || to ? 'custom' : 'week') },
      activeConversations: openConvs,
      totalConversations,
      botSuccessRate: botRatio,
      totalMessages: totalMsgs,
      slaBreached,
      deflectionRate: totalConversations > 0 ? Number(((deflectedCount / totalConversations) * 100).toFixed(1)) : 0,
      handoffRate: totalConversations > 0 ? Number(((handoffCount / totalConversations) * 100).toFixed(1)) : 0,
      handoffReasons,
      avgFirstResponseMs: avg(firstResponseMs),
      avgFirstBotResponseMs: avg(firstBotResponseMs),
      avgFirstAgentResponseMs: avg(firstAgentResponseMs),
      avgResolutionMs: avg(resolutionMs),
      csatAvg: csatScores.length ? Number((csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(2)) : null,
      evalSummary: lastEval ? { accuracy: lastEval.accuracy, coverage: lastEval.coverage, total: lastEval.total, createdAt: lastEval.created_at } : null
    };
  });
};
