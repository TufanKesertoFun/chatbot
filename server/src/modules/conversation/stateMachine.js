const ConversationState = {
  GREETING: 'GREETING',
  INFORMATION_PROVIDED: 'INFORMATION_PROVIDED',
  FOLLOW_UP: 'FOLLOW_UP',
  CLOSING: 'CLOSING',
  ESCALATION_CANDIDATE: 'ESCALATION_CANDIDATE',
};

const ALLOWED_ESCALATION_INTENTS = new Set(['HUMAN_REQUEST', 'UNSUPPORTED_INFO']);

function getInitialState() {
  return ConversationState.GREETING;
}

function nextState(currentState, signal) {
  const state = currentState || getInitialState();
  switch (state) {
    case ConversationState.GREETING:
      if (signal === 'INFORMATION_REQUEST') return ConversationState.FOLLOW_UP;
      if (signal === 'CONVERSATIONAL') return ConversationState.CLOSING;
      if (signal === 'ESCALATION_SIGNAL') return ConversationState.ESCALATION_CANDIDATE;
      return state;
    case ConversationState.FOLLOW_UP:
      if (signal === 'ANSWER_PROVIDED') return ConversationState.INFORMATION_PROVIDED;
      if (signal === 'ESCALATION_SIGNAL') return ConversationState.ESCALATION_CANDIDATE;
      return state;
    case ConversationState.INFORMATION_PROVIDED:
      if (signal === 'CONVERSATIONAL') return ConversationState.CLOSING;
      if (signal === 'INFORMATION_REQUEST') return ConversationState.FOLLOW_UP;
      if (signal === 'ESCALATION_SIGNAL') return ConversationState.ESCALATION_CANDIDATE;
      return state;
    case ConversationState.CLOSING:
      if (signal === 'INFORMATION_REQUEST') return ConversationState.FOLLOW_UP;
      return state;
    case ConversationState.ESCALATION_CANDIDATE:
      return state;
    default:
      return state;
  }
}

function canHandoff({ state, intent }) {
  return state === ConversationState.ESCALATION_CANDIDATE && ALLOWED_ESCALATION_INTENTS.has(intent);
}

module.exports = {
  ConversationState,
  getInitialState,
  nextState,
  canHandoff,
  ALLOWED_ESCALATION_INTENTS,
};

