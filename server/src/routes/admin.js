const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const ragService = require('../services/rag');
const prisma = require('../lib/prisma');

const logAudit = async ({ userId, action, targetType, targetId, metadata }) => {
  await prisma.auditLog.create({
    data: {
      user_id: userId || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || undefined
    }
  });
};

const toCsv = (rows, headers) => {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(h => escape(h)).join(',');
  const lines = rows.map(row => headers.map(h => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
};

const BULK_IMPORT_SUPPORTED_FORMATS = new Set(['JSON', 'CSV']);
const BULK_IMPORT_SUPPORTED_MODES = new Set(['AUTO', 'DOCUMENT', 'FAQ']);
const BULK_IMPORT_MAX_ROWS = 1000;
const BULK_IMPORT_MAX_CONTENT_LENGTH = 20000;

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
const cleanText = (value) => String(value || '').replace(/\r/g, '').trim();
const shorten = (value, max = 80) => {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const detectCsvDelimiter = (headerLine) => {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
};

const parseCsvRows = (csvText) => {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = detectCsvDelimiter(firstLine);
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let rowNumber = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') i += 1;
      currentRow.push(currentField);
      currentField = '';
      rows.push({ rowNumber, values: currentRow });
      currentRow = [];
      rowNumber += 1;
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push({ rowNumber, values: currentRow });
  }

  if (rows.length === 0) return [];
  const header = rows[0].values.map(normalizeKey);
  const dataRows = rows.slice(1);
  const objects = [];

  dataRows.forEach((line) => {
    const rowObj = {};
    header.forEach((key, idx) => {
      if (!key) return;
      rowObj[key] = line.values[idx] ?? '';
    });
    const hasValue = Object.values(rowObj).some((value) => cleanText(value).length > 0);
    if (hasValue) {
      rowObj.__rowNumber = line.rowNumber;
      objects.push(rowObj);
    }
  });

  return objects;
};

const pickFirst = (row, keys) => {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value !== undefined && cleanText(value).length > 0) return cleanText(value);
  }
  return '';
};

const normalizeKbRow = (row, mode) => {
  const normalizedRow = {};
  for (const [key, value] of Object.entries(row || {})) {
    normalizedRow[normalizeKey(key)] = value;
  }
  const rowNumber = Number(normalizedRow.__rownumber || normalizedRow.__rowNumber || normalizedRow.__row_number || 0) || null;
  const effectiveMode = BULK_IMPORT_SUPPORTED_MODES.has(mode) ? mode : 'AUTO';

  const docFromFields = () => {
    const title = pickFirst(normalizedRow, ['title', 'baslik', 'name', 'doc_title']);
    const content = pickFirst(normalizedRow, ['content', 'icerik', 'text', 'body', 'metin']);
    if (!title || !content) return null;
    return { title, content };
  };

  const faqFromFields = () => {
    const question = pickFirst(normalizedRow, ['question', 'soru', 'q', 'prompt']);
    const answer = pickFirst(normalizedRow, ['answer', 'cevap', 'a', 'response', 'yanit']);
    if (!question || !answer) return null;
    const title = pickFirst(normalizedRow, ['title', 'baslik', 'faq_title']) || `FAQ - ${shorten(question, 70)}`;
    const content = `Soru: ${question}\nCevap: ${answer}`;
    return { title, content };
  };

  let doc = null;
  if (effectiveMode === 'DOCUMENT') doc = docFromFields();
  if (effectiveMode === 'FAQ') doc = faqFromFields();
  if (effectiveMode === 'AUTO') {
    doc = docFromFields() || faqFromFields();
  }

  if (!doc) {
    return { ok: false, rowNumber, reason: 'INVALID_ROW_FIELDS' };
  }
  if (doc.content.length > BULK_IMPORT_MAX_CONTENT_LENGTH) {
    return { ok: false, rowNumber, reason: 'CONTENT_TOO_LARGE' };
  }

  return { ok: true, rowNumber, ...doc };
};

const parseJsonPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    return [];
  }
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
};

const runWithConcurrency = async (items, concurrency, handler) => {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency, list.length || 1));
  let index = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (index < list.length) {
      const currentIndex = index;
      index += 1;
      await handler(list[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
};

module.exports = async function (fastify, opts) {
  const SUPPORTED_AGENT_LANGS = ['tr', 'en', 'de', 'ru', 'fr'];
  const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

  const issueAgentToken = (user) => {
    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role, type: 'agent' },
      { expiresIn: '12h', audience: 'agent', issuer: 'emlak-chat' }
    );
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        agentLang: user.agent_lang,
      },
    };
  };

  const parseAllowedGoogleClientIds = () => (
    String(process.env.GOOGLE_CLIENT_ID || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const verifyGoogleToken = async ({ credential, allowedClientIds }) => {
    if (!credential || typeof credential !== 'string') {
      throw new Error('Missing Google credential');
    }
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) {
      throw new Error('Invalid Google credential');
    }
    const payload = await response.json();
    const aud = String(payload.aud || '');
    const iss = String(payload.iss || '');
    const email = String(payload.email || '').trim().toLowerCase();
    const emailVerified = String(payload.email_verified || '').toLowerCase() === 'true';
    const exp = Number(payload.exp || 0);
    const isExpired = !Number.isFinite(exp) || (exp * 1000) <= Date.now();
    const audienceOk = allowedClientIds.includes(aud);
    const issuerOk = GOOGLE_ISSUERS.has(iss);

    if (!audienceOk || !issuerOk || !email || !emailVerified || isExpired) {
      throw new Error('Google credential verification failed');
    }

    return {
      email,
      fullName: String(payload.name || '').trim() || null,
    };
  };

  const requireSuperAdmin = async (req, reply) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: req.t('errors.forbidden') });
    }
  };

  const maskApiKey = (apiKey) => {
    if (!apiKey || apiKey.length < 8) return null;
    return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
  };
  
  fastify.post('/signup', { config: { rateLimit: { max: 10, windowMs: 60 * 1000 } } }, async (request, reply) => {
    const rawEmail = request.body?.email;
    const email = String(rawEmail || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const fullName = String(request.body?.fullName || '').trim() || null;

    if (!email || !password) {
      return reply.code(400).send({ error: request.t('errors.emailPasswordRequired') });
    }
    if (password.length < 12) {
      return reply.code(400).send({ error: request.t('errors.passwordMin12') });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: request.t('errors.emailAlreadyExists') });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hash,
        full_name: fullName,
        role: 'AGENT',
      },
    });

    return issueAgentToken(user);
  });

  fastify.post('/google-auth', { config: { rateLimit: { max: 20, windowMs: 60 * 1000 } } }, async (request, reply) => {
    const allowedClientIds = parseAllowedGoogleClientIds();
    if (allowedClientIds.length === 0) {
      return reply.code(500).send({ error: request.t('errors.googleClientIdMissing') });
    }

    try {
      const mode = String(request.body?.mode || 'signin').toLowerCase();
      const payload = await verifyGoogleToken({
        credential: request.body?.credential,
        allowedClientIds,
      });

      let user = await prisma.user.findUnique({ where: { email: payload.email } });
      if (!user && mode === 'signin') {
        return reply.code(404).send({ error: request.t('errors.userNotFound') });
      }

      if (!user) {
        const placeholderHash = await bcrypt.hash(randomUUID(), 10);
        user = await prisma.user.create({
          data: {
            email: payload.email,
            password_hash: placeholderHash,
            full_name: payload.fullName,
            role: 'AGENT',
          },
        });
      } else if (!user.full_name && payload.fullName) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { full_name: payload.fullName },
        });
      }

      return issueAgentToken(user);
    } catch (err) {
      request.log.warn({ err: err?.message }, 'google auth failed');
      return reply.code(401).send({ error: request.t('errors.invalidGoogleCredentials') });
    }
  });

  // LOGIN
  fastify.post('/login', { config: { rateLimit: { max: 10, windowMs: 60 * 1000 } } }, async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = request.body?.password;
    if (!email || !password) return reply.code(400).send({ error: request.t('errors.emailPasswordRequired') });
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: request.t('errors.invalidCredentials') });
    }

    return issueAgentToken(user);
  });

  // --- KORUMALI ROTALAR ---
  fastify.register(async function (privateRoutes) {
    privateRoutes.addHook('onRequest', async (request, reply) => {
      try { 
        await request.jwtVerify({ verify: { audience: 'agent', issuer: 'emlak-chat' } }); 
      } catch (err) { 
        return reply.code(401).send({ error: request.t('errors.unauthorized') }); 
      }
    });

    // --- KNOWLEDGE BASE ---
    privateRoutes.get('/knowledge-base', { preHandler: requireSuperAdmin }, async () => (
      prisma.knowledgeBase.findMany({ orderBy: { created_at: 'desc' } })
    ));
    
    privateRoutes.post('/knowledge-base', { preHandler: requireSuperAdmin, config: { rateLimit: { max: 10, windowMs: 60 * 1000 } } }, async (req, reply) => {
      const { title, content } = req.body || {};
      if (!title || !content) return reply.code(400).send({ error: req.t('errors.titleContentRequired') });
      if (content.length > 20000) return reply.code(413).send({ error: req.t('errors.contentTooLarge') });
      try {
        const result = await ragService.addDocument(title, content);
        await logAudit({
          userId: req.user?.id,
          action: 'KB_CREATE',
          targetType: 'KnowledgeBase',
          targetId: result.id
        });
        return { success: true, id: result.id };
      } catch (err) {
        return reply.code(503).send({ error: req.t('errors.llmNotConfigured') });
      }
    });

    privateRoutes.get('/knowledge-base/import-template', { preHandler: requireSuperAdmin }, async (req, reply) => {
      const format = String(req.query?.format || 'json').toUpperCase();
      const mode = String(req.query?.mode || 'AUTO').toUpperCase();
      if (!BULK_IMPORT_SUPPORTED_FORMATS.has(format)) {
        return reply.code(400).send({ error: req.t('errors.bulkFormatInvalid') });
      }
      if (!BULK_IMPORT_SUPPORTED_MODES.has(mode)) {
        return reply.code(400).send({ error: req.t('errors.bulkModeInvalid') });
      }

      const faqTemplateRows = [
        { question: 'King room kahvalti dahil mi?', answer: 'Evet, secilen paketlerde acik bufe kahvalti dahildir.' },
        { question: 'Havalimani transfer hizmeti var mi?', answer: 'Talep uzerine ucretli transfer planlanabilir.' }
      ];
      const docTemplateRows = [
        { title: 'Check-in ve Check-out Saatleri', content: 'Check-in 14:00, check-out 12:00 olarak uygulanir.' },
        { title: 'Spa Calisma Saatleri', content: 'Spa her gun 09:00 - 22:00 arasinda hizmet vermektedir.' }
      ];
      const rows = mode === 'FAQ' ? faqTemplateRows : docTemplateRows;

      if (format === 'CSV') {
        const csv = mode === 'FAQ'
          ? toCsv(rows, ['question', 'answer'])
          : toCsv(rows, ['title', 'content']);
        reply.header('Content-Type', 'text/csv');
        return csv;
      }

      reply.header('Content-Type', 'application/json');
      return { format: 'json', mode, rows };
    });

    privateRoutes.post(
      '/knowledge-base/bulk-import',
      {
        preHandler: requireSuperAdmin,
        bodyLimit: 10 * 1024 * 1024,
        config: { rateLimit: { max: 5, windowMs: 60 * 1000 } }
      },
      async (req, reply) => {
        const body = req.body || {};
        const format = String(body.format || (typeof body.csv === 'string' ? 'csv' : 'json')).toUpperCase();
        const mode = String(body.mode || 'AUTO').toUpperCase();
        if (!BULK_IMPORT_SUPPORTED_FORMATS.has(format)) {
          return reply.code(400).send({ error: req.t('errors.bulkFormatInvalid') });
        }
        if (!BULK_IMPORT_SUPPORTED_MODES.has(mode)) {
          return reply.code(400).send({ error: req.t('errors.bulkModeInvalid') });
        }

        const payload = body.payload ?? body.rows ?? body.csv ?? body.data;
        if (payload === undefined || payload === null) {
          return reply.code(400).send({ error: req.t('errors.bulkPayloadRequired') });
        }

        let inputRows = [];
        try {
          inputRows = format === 'CSV' ? parseCsvRows(payload) : parseJsonPayload(payload);
        } catch (err) {
          return reply.code(400).send({ error: req.t('errors.bulkPayloadInvalid') });
        }
        if (!Array.isArray(inputRows) || inputRows.length === 0) {
          return reply.code(400).send({ error: req.t('errors.bulkPayloadInvalid') });
        }
        if (inputRows.length > BULK_IMPORT_MAX_ROWS) {
          return reply.code(413).send({ error: req.t('errors.bulkRowLimitExceeded') });
        }

        const validDocs = [];
        const failedRows = [];
        inputRows.forEach((row, index) => {
          const normalized = normalizeKbRow(row, mode);
          if (!normalized.ok) {
            failedRows.push({
              row: normalized.rowNumber || index + 1,
              reason: normalized.reason
            });
            return;
          }
          validDocs.push(normalized);
        });

        if (validDocs.length === 0) {
          return reply.code(400).send({
            error: req.t('errors.bulkNoValidRows'),
            failedRows: failedRows.slice(0, 50)
          });
        }

        let imported = 0;
        await runWithConcurrency(validDocs, 2, async (doc, idx) => {
          try {
            await ragService.addDocument(doc.title, doc.content);
            imported += 1;
          } catch (err) {
            failedRows.push({
              row: doc.rowNumber || idx + 1,
              reason: 'IMPORT_FAILED'
            });
          }
        });

        await logAudit({
          userId: req.user?.id,
          action: 'KB_BULK_IMPORT',
          targetType: 'KnowledgeBase',
          metadata: {
            format,
            mode,
            totalRows: inputRows.length,
            validRows: validDocs.length,
            imported,
            failed: failedRows.length
          }
        });

        if (imported === 0) {
          return reply.code(503).send({
            error: req.t('errors.bulkImportFailed'),
            failedRows: failedRows.slice(0, 50)
          });
        }

        return {
          success: true,
          format,
          mode,
          totalRows: inputRows.length,
          validRows: validDocs.length,
          imported,
          failed: failedRows.length,
          failedRows: failedRows.slice(0, 50)
        };
      }
    );

    // YENİ: Döküman Silme
    privateRoutes.delete('/knowledge-base/:id', { preHandler: requireSuperAdmin }, async (req) => {
      await prisma.knowledgeBase.delete({ where: { id: req.params.id } });
      await logAudit({
        userId: req.user?.id,
        action: 'KB_DELETE',
        targetType: 'KnowledgeBase',
        targetId: req.params.id
      });
      // Not: Cascade delete sayesinde chunk'lar da silinir (Schema'da tanımlıysa).
      // pgvector indexleri otomatik güncellenir.
      return { success: true };
    });

    // --- SETTINGS (LLM CONFIG) ---
    // Sadece SUPER_ADMIN yetkisi
    privateRoutes.get('/settings', { preHandler: requireSuperAdmin }, async () => {
        const config = await prisma.lLMConfig.findFirst({ where: { is_active: true } });
        if (!config) return null;
        return {
          provider: config.provider,
          model_name: config.model_name,
          system_prompt: config.system_prompt,
          api_key_masked: maskApiKey(config.api_key),
          min_similarity_threshold: config.min_similarity_threshold,
          top_k: config.top_k,
          enable_intent_classifier: config.enable_intent_classifier,
          intent_confidence_threshold: config.intent_confidence_threshold,
          enable_future_state_machine: config.enable_future_state_machine
        };
    });

    privateRoutes.post('/settings', { preHandler: requireSuperAdmin }, async (req, reply) => {
        const {
          apiKey,
          modelName,
          systemPrompt,
          provider,
          minSimilarityThreshold,
          topK,
          enableIntentClassifier,
          intentConfidenceThreshold,
          enableFutureStateMachine
        } = req.body;

        const existing = await prisma.lLMConfig.findFirst({ where: { is_active: true } });
        const nextApiKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : existing?.api_key;
        if (!nextApiKey) {
          return reply.code(400).send({ error: req.t('errors.apiKeyRequiredFirstSetup') });
        }

        const nextMinSimilarity = typeof minSimilarityThreshold === 'number' ? minSimilarityThreshold : existing?.min_similarity_threshold;
        const nextTopK = Number.isInteger(topK) ? topK : existing?.top_k;
        if (nextMinSimilarity === undefined || nextMinSimilarity === null || nextMinSimilarity < 0 || nextMinSimilarity > 1) {
          return reply.code(400).send({ error: req.t('errors.minSimilarityRange') });
        }
        if (!nextTopK || nextTopK < 1 || nextTopK > 10) {
          return reply.code(400).send({ error: req.t('errors.topKRange') });
        }
        const nextEnableIntentClassifier =
          typeof enableIntentClassifier === 'boolean'
            ? enableIntentClassifier
            : (existing?.enable_intent_classifier ?? true);
        const nextIntentConfidenceThreshold =
          typeof intentConfidenceThreshold === 'number'
            ? intentConfidenceThreshold
            : (existing?.intent_confidence_threshold ?? 0.65);
        if (nextIntentConfidenceThreshold < 0 || nextIntentConfidenceThreshold > 1) {
          return reply.code(400).send({ error: req.t('errors.intentThresholdRange') });
        }
        const nextEnableFutureStateMachine =
          typeof enableFutureStateMachine === 'boolean'
            ? enableFutureStateMachine
            : (existing?.enable_future_state_machine ?? false);

        // Eskileri pasif yap
        await prisma.lLMConfig.updateMany({ data: { is_active: false } });
        
        // Yeni config oluştur
        const config = await prisma.lLMConfig.create({
            data: {
                provider: provider || 'GEMINI',
                api_key: nextApiKey,
                model_name: modelName || 'gemini-2.0-flash',
                system_prompt: systemPrompt,
                min_similarity_threshold: nextMinSimilarity,
                top_k: nextTopK,
                enable_intent_classifier: nextEnableIntentClassifier,
                intent_confidence_threshold: nextIntentConfidenceThreshold,
                enable_future_state_machine: nextEnableFutureStateMachine,
                is_active: true
            }
        });
        
        // Servisi güncelle
        await ragService.initialize();
        await logAudit({
          userId: req.user?.id,
          action: 'LLM_CONFIG_UPDATE',
          targetType: 'LLMConfig',
          targetId: config.id,
          metadata: {
            provider: config.provider,
            model_name: config.model_name,
            min_similarity_threshold: config.min_similarity_threshold,
            top_k: config.top_k,
            enable_intent_classifier: config.enable_intent_classifier,
            intent_confidence_threshold: config.intent_confidence_threshold,
            enable_future_state_machine: config.enable_future_state_machine
          }
        });
        return {
          provider: config.provider,
          model_name: config.model_name,
          system_prompt: config.system_prompt,
          api_key_masked: maskApiKey(config.api_key),
          min_similarity_threshold: config.min_similarity_threshold,
          top_k: config.top_k,
          enable_intent_classifier: config.enable_intent_classifier,
          intent_confidence_threshold: config.intent_confidence_threshold,
          enable_future_state_machine: config.enable_future_state_machine
        };
    });

    // --- USER MANAGEMENT (AGENTS) ---
    privateRoutes.get('/users', { preHandler: requireSuperAdmin }, async () => (
      prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        select: { id: true, email: true, full_name: true, role: true, agent_lang: true, created_at: true }
      })
    ));

    privateRoutes.post('/users', { preHandler: requireSuperAdmin }, async (req, reply) => {
        const { email, password, fullName, role, agentLang } = req.body;
        if (!password || password.length < 12) {
          return reply.code(400).send({ error: req.t('errors.passwordMin12') });
        }
        if (role && !['AGENT', 'SUPER_ADMIN'].includes(role)) {
          return reply.code(400).send({ error: req.t('errors.invalidRole') });
        }
        if (agentLang && !SUPPORTED_AGENT_LANGS.includes(String(agentLang).toLowerCase())) {
          return reply.code(400).send({ error: req.t('errors.invalidAgentLang') });
        }
        const hash = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                email,
                password_hash: hash,
                full_name: fullName,
                role: role || 'AGENT',
                agent_lang: (agentLang || 'tr').slice(0, 5)
            }
        });
        await logAudit({
          userId: req.user?.id,
          action: 'USER_CREATE',
          targetType: 'User',
          targetId: user.id,
          metadata: { role: user.role, agent_lang: user.agent_lang }
        });
        return { id: user.id, email: user.email };
    });
    
    // User Silme
    privateRoutes.delete('/users/:id', { preHandler: requireSuperAdmin }, async (req) => {
        await prisma.user.delete({ where: { id: req.params.id } });
        await logAudit({
          userId: req.user?.id,
          action: 'USER_DELETE',
          targetType: 'User',
          targetId: req.params.id
        });
        return { success: true };
    });

    // --- AUDIT LOGS ---
    privateRoutes.get('/audit-logs', { preHandler: requireSuperAdmin }, async (req) => {
      const limit = Math.min(Number(req.query?.limit || 50), 200);
      return prisma.auditLog.findMany({
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { user: { select: { email: true, full_name: true } } }
      });
    });

    // --- RETRIEVAL DEBUG ---
    privateRoutes.get('/retrieval-debug', { preHandler: requireSuperAdmin }, async (req, reply) => {
      const { query } = req.query || {};
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return reply.code(400).send({ error: req.t('errors.queryRequired') });
      }
      try {
        const result = await ragService.debugRetrieve(query.trim());
        return result;
      } catch (err) {
        return reply.code(503).send({ error: req.t('errors.llmNotConfigured') });
      }
    });

    // --- TRAINING DATASET ---
    privateRoutes.get('/training-examples', { preHandler: requireSuperAdmin }, async (req) => {
      const limit = Math.min(Number(req.query?.limit || 100), 500);
      return prisma.trainingExample.findMany({
        take: limit,
        orderBy: { created_at: 'desc' }
      });
    });

    privateRoutes.get('/training-export', { preHandler: requireSuperAdmin, config: { rateLimit: { max: 10, windowMs: 60 * 1000 } } }, async (req, reply) => {
      const format = (req.query?.format || 'json').toLowerCase();
      const includeRaw = req.query?.includeRaw === 'true';
      const limit = Math.min(Number(req.query?.limit || 1000), 5000);
      const rows = await prisma.trainingExample.findMany({
        take: limit,
        orderBy: { created_at: 'desc' }
      });

      await logAudit({
        userId: req.user?.id,
        action: 'TRAINING_EXPORT',
        targetType: 'TrainingExample',
        metadata: { format, limit, includeRaw }
      });

      const safeRows = rows.map(r => ({
        id: r.id,
        message_id: r.message_id,
        conversation_id: r.conversation_id,
        question: includeRaw ? r.question : (r.question_masked || r.question),
        bot_answer: includeRaw ? r.bot_answer : (r.bot_answer_masked || r.bot_answer),
        correct_answer: includeRaw ? r.correct_answer : (r.correct_answer_masked || r.correct_answer),
        feedback_score: r.feedback_score,
        created_at: r.created_at
      }));

      if (format === 'csv') {
        const csv = toCsv(safeRows, ['id', 'message_id', 'conversation_id', 'question', 'bot_answer', 'correct_answer', 'feedback_score', 'created_at']);
        reply.header('Content-Type', 'text/csv');
        return csv;
      }

      reply.header('Content-Type', 'application/json');
      return safeRows;
    });

    // --- EVAL SET ---
    privateRoutes.get('/eval-questions', { preHandler: requireSuperAdmin }, async () => {
      return prisma.evalQuestion.findMany({ orderBy: { created_at: 'desc' } });
    });

    privateRoutes.post('/eval-questions', { preHandler: requireSuperAdmin }, async (req, reply) => {
      const { question, expectedAnswer } = req.body || {};
      if (!question || !expectedAnswer) {
        return reply.code(400).send({ error: req.t('errors.questionExpectedRequired') });
      }
      const created = await prisma.evalQuestion.create({
        data: { question, expected_answer: expectedAnswer }
      });
      await logAudit({
        userId: req.user?.id,
        action: 'EVAL_QUESTION_CREATE',
        targetType: 'EvalQuestion',
        targetId: created.id
      });
      return created;
    });

    privateRoutes.delete('/eval-questions/:id', { preHandler: requireSuperAdmin }, async (req) => {
      await prisma.evalQuestion.delete({ where: { id: req.params.id } });
      await logAudit({
        userId: req.user?.id,
        action: 'EVAL_QUESTION_DELETE',
        targetType: 'EvalQuestion',
        targetId: req.params.id
      });
      return { success: true };
    });

    privateRoutes.post('/eval-run', { preHandler: requireSuperAdmin, config: { rateLimit: { max: 5, windowMs: 60 * 1000 } } }, async (req, reply) => {
      const questions = await prisma.evalQuestion.findMany({ where: { is_active: true } });
      if (questions.length === 0) return reply.code(400).send({ error: req.t('errors.noActiveEvalQuestions') });

      let foundCount = 0;
      let correctCount = 0;

      const run = await prisma.evalRun.create({
        data: { total: questions.length, coverage: 0, accuracy: 0 }
      });

      for (const q of questions) {
        let answerText = null;
        let found = false;
        let isCorrect = false;
        try {
          const ragResult = await ragService.generateRAGResponse(q.question, 'tr');
          found = !!ragResult?.found;
          answerText = ragResult?.answer || null;
          if (found) foundCount += 1;
          if (answerText) {
            const expected = q.expected_answer.toLowerCase();
            const actual = answerText.toLowerCase();
            isCorrect = actual.includes(expected);
            if (isCorrect) correctCount += 1;
          }
        } catch (err) {
          // ignore errors; treat as not found
        }

        await prisma.evalResult.create({
          data: {
            run_id: run.id,
            eval_question_id: q.id,
            answer_text: answerText,
            found,
            is_correct: isCorrect
          }
        });
      }

      const coverage = Number(((foundCount / questions.length) * 100).toFixed(1));
      const accuracy = Number(((correctCount / questions.length) * 100).toFixed(1));
      const updated = await prisma.evalRun.update({
        where: { id: run.id },
        data: { coverage, accuracy }
      });

      await logAudit({
        userId: req.user?.id,
        action: 'EVAL_RUN',
        targetType: 'EvalRun',
        targetId: updated.id,
        metadata: { coverage, accuracy, total: questions.length }
      });

      return updated;
    });

    privateRoutes.get('/eval-runs', { preHandler: requireSuperAdmin }, async (req) => {
      const limit = Math.min(Number(req.query?.limit || 10), 50);
      return prisma.evalRun.findMany({ take: limit, orderBy: { created_at: 'desc' } });
    });

  });
};
