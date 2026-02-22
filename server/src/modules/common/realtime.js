function emitConversationNew(io, payload) {
  io.to('agent_queue').emit('conversation:new', payload);
}

function emitConversationAssigned(io, payload) {
  io.to('agent_queue').emit('conversation_assigned', payload);
}

function emitConversationStatusChanged(io, payload) {
  io.to('agent_queue').emit('conversation_status_changed', payload);
}

function emitConversationUpdated(io, payload) {
  io.to('agent_queue').emit('conversation:update', payload);
}

function emitConversationEscalated(io, payload) {
  io.to('agent_queue').emit('conversation:escalated', payload);
}

function emitHandoffNeeded(io, payload) {
  io.to('agent_queue').emit('conversation:handoff_needed', payload);
}

function emitVisitorLeft(io, payload) {
  io.to('agent_queue').emit('conversation:visitor_left', payload);
}

function emitConversationMessage(io, conversationId, payload) {
  io.to(`conversation_${conversationId}`).emit('message:new', payload);
}

function emitConversationStatusToRoom(io, conversationId, payload) {
  io.to(`conversation_${conversationId}`).emit('conversation:status_changed', payload);
}

module.exports = {
  emitConversationNew,
  emitConversationAssigned,
  emitConversationStatusChanged,
  emitConversationUpdated,
  emitConversationEscalated,
  emitHandoffNeeded,
  emitVisitorLeft,
  emitConversationMessage,
  emitConversationStatusToRoom,
};
