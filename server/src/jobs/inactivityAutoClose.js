const realtime = require('../modules/common/realtime');

function startInactivityAutoCloseJob({ prisma, io, log }) {
  const inactivityMinutes = Number(process.env.INACTIVITY_TIMEOUT_MIN || 30);
  const autoCloseEnabled = process.env.AUTO_CLOSE_ENABLED !== 'false';
  if (!autoCloseEnabled) return null;

  return setInterval(async () => {
    const cutoff = new Date(Date.now() - inactivityMinutes * 60 * 1000);
    const stale = await prisma.conversation.findMany({
      where: {
        status: { in: ['WAITING', 'ASSIGNED'] },
        last_message_at: { lt: cutoff },
      },
      select: { id: true },
    });

    if (stale.length === 0) return;
    const ids = stale.map((conversation) => conversation.id);
    const now = new Date();

    await prisma.conversation.updateMany({
      where: { id: { in: ids } },
      data: { status: 'RESOLVED', resolved_at: now },
    });
    await prisma.conversationMetrics.updateMany({
      where: { conversation_id: { in: ids }, resolved_at: null },
      data: { resolved_at: now },
    });

    ids.forEach((conversationId) => {
      realtime.emitConversationStatusChanged(io, {
        conversationId,
        status: 'RESOLVED',
      });
      realtime.emitConversationStatusToRoom(io, conversationId, {
        conversationId,
        status: 'RESOLVED',
      });
    });

    log.info({ count: ids.length }, 'Auto-closed inactive conversations');
  }, 5 * 60 * 1000);
}

module.exports = { startInactivityAutoCloseJob };
