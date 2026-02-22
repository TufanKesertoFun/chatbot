const fs = require('fs');
const path = require('path');
const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';
const level = isProd ? 'error' : (process.env.LOG_LEVEL || 'info');
const logFile = process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'server.log');

const streams = [{ stream: process.stdout }];

if (isProd) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  streams.push({ stream: pino.destination({ dest: logFile, sync: false }) });
}

const logger = pino({ level }, pino.multistream(streams));

module.exports = logger;
