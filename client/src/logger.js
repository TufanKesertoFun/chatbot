const LEVELS = ['debug', 'info', 'warn', 'error'];

const getLevel = () => {
  const defaultLevel = import.meta.env.MODE === 'production' ? 'error' : 'info';
  const level = (import.meta.env.VITE_LOG_LEVEL || defaultLevel).toLowerCase();
  return LEVELS.includes(level) ? level : 'info';
};

const shouldLog = (level) => {
  const current = getLevel();
  return LEVELS.indexOf(level) >= LEVELS.indexOf(current);
};

export const createLogger = (scope) => ({
  debug: (...args) => shouldLog('debug') && console.debug(`[${scope}]`, ...args),
  info: (...args) => shouldLog('info') && console.info(`[${scope}]`, ...args),
  warn: (...args) => shouldLog('warn') && console.warn(`[${scope}]`, ...args),
  error: (...args) => shouldLog('error') && console.error(`[${scope}]`, ...args)
});
