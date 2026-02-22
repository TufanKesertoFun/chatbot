function createOriginValidator({ allowedOrigins, isProd }) {
  return (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) {
      if (!isProd) return cb(null, true);
      return cb(new Error('CORS not configured'), false);
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed'), false);
  };
}

module.exports = { createOriginValidator };

