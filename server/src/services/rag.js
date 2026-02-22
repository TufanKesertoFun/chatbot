// server/src/services/rag.js
const GeminiProvider = require('./llm/gemini');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { DEFAULT_SYSTEM_PROMPT } = require('../config/defaultSystemPrompt');

const NEGATIVE_HANDOFF_RULES = `
NEGATIF HANDOFF KURALLARI (ZORUNLU):
- Tesekkur, onay, kapanis, small-talk ve kisa reaksiyon mesajlari canli asistana aktarma nedeni degildir.
- Bu tur mesajlarda handoff onermeden kisa ve nazik bir yanit ver.
- Emin degilsen handoff yapma; once netlestirici bir soru sor.
`;

class RAGService {
  constructor() {
    this.llmProvider = null;
    this.activeConfig = null;
    this.providerKey = null;
    this.lastConfigFetch = 0;
    this.configCacheTtlMs = 30 * 1000;
  }

  async initialize(forceConfig) {
    const config = forceConfig || await prisma.lLMConfig.findFirst({ where: { is_active: true } });
    this.activeConfig = config || null;
    this.lastConfigFetch = Date.now();

    if (!config) {
      if (process.env.GEMINI_API_KEY) {
          const nextKey = `GEMINI:${process.env.GEMINI_API_KEY}`;
          if (this.providerKey !== nextKey) {
            this.llmProvider = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY });
            this.providerKey = nextKey;
          }
      }
      return;
    }

    if (config.provider === 'GEMINI') {
      const nextKey = `GEMINI:${config.api_key}:${config.model_name || ''}`;
      if (this.providerKey !== nextKey) {
        this.llmProvider = new GeminiProvider({ apiKey: config.api_key, modelName: config.model_name });
        this.providerKey = nextKey;
      }
    }
  }

  async getActiveConfig() {
    const now = Date.now();
    if (this.activeConfig && (now - this.lastConfigFetch) < this.configCacheTtlMs) {
      return this.activeConfig;
    }

    const config = await prisma.lLMConfig.findFirst({ where: { is_active: true } });
    this.activeConfig = config || null;
    this.lastConfigFetch = now;
    return this.activeConfig;
  }

  async ensureProvider() {
    const config = await this.getActiveConfig();
    if (!this.llmProvider) {
      await this.initialize(config);
    }
    return config;
  }

  async addDocument(title, content) {
    await this.ensureProvider();
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured');
    }

    const kb = await prisma.knowledgeBase.create({ data: { title, content } });

    // Chunking (Basit)
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }

    const mapWithConcurrency = async (items, limit, mapper) => {
      const results = new Array(items.length);
      let index = 0;
      const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (index < items.length) {
          const current = index++;
          results[current] = await mapper(items[current], current);
        }
      });
      await Promise.all(workers);
      return results;
    };

    const embeddings = await mapWithConcurrency(chunks, 3, async (chunkText) => {
      const vector = await this.llmProvider.getEmbedding(chunkText);
      return { chunkText, vector };
    });

    for (const item of embeddings) {
      const vectorString = `[${item.vector.join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO knowledge_chunks (id, kb_id, content, embedding)
        VALUES (gen_random_uuid(), ${kb.id}, ${item.chunkText}, ${vectorString}::vector)
      `;
    }
    return kb;
  }

  async searchSimilar(queryText, limit = 3) {
    await this.ensureProvider();
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured');
    }

    const queryVector = await this.llmProvider.getEmbedding(queryText);
    const vectorString = `[${queryVector.join(',')}]`;

    const results = await prisma.$queryRaw`
      SELECT id, content, 1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM knowledge_chunks
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${limit};
    `;

    return results;
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  computeKeywordScore(query, content) {
    const queryTokens = new Set(this.normalizeText(query));
    if (queryTokens.size === 0) return 0;
    const contentTokens = new Set(this.normalizeText(content));
    let match = 0;
    queryTokens.forEach(t => {
      if (contentTokens.has(t)) match += 1;
    });
    return match / queryTokens.size;
  }

  async retrieveWithRerank(queryText, options) {
    const {
      topK = 3,
      minSimilarity = 0.2,
      candidateK = 20
    } = options || {};

    const candidates = await this.searchSimilar(queryText, candidateK);
    const filtered = candidates.filter(c => typeof c.similarity === 'number' && c.similarity >= minSimilarity);
    const rescored = filtered.map(c => {
      const keywordScore = this.computeKeywordScore(queryText, c.content || '');
      const combinedScore = (0.7 * c.similarity) + (0.3 * keywordScore);
      return { ...c, keywordScore, combinedScore };
    });
    rescored.sort((a, b) => b.combinedScore - a.combinedScore);
    return rescored.slice(0, topK);
  }

  async verifyAnswer({ answer, contextText, targetLang, question }) {
    const verifierPrompt = `
      You are a strict verifier. Decide if the answer is fully supported by the context for the given question.
      Reply with only SUPPORTED or UNSUPPORTED.
      Language: ${targetLang}.

      [CONTEXT]:
      ${contextText}
    `;

    try {
      const verdict = await this.llmProvider.generateResponse(verifierPrompt, `Question: ${question}\nAnswer: ${answer}`);
      const normalized = (verdict || '').toUpperCase();
      if (normalized.includes('UNSUPPORTED')) return 'UNSUPPORTED';
      if (normalized.includes('SUPPORTED')) return 'SUPPORTED';
      return 'UNSUPPORTED';
    } catch (err) {
      return 'UNSUPPORTED';
    }
  }

  safeJsonParse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      const match = String(text).match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch (err) {
        return null;
      }
    }
  }

  sanitizeIntentDecision(payload) {
    const fallback = {
      intent: 'INFORMATION_REQUEST',
      requires_handoff: false,
      confidence: 0.5,
      source: 'fallback',
    };
    if (!payload || typeof payload !== 'object') return fallback;
    const intent = String(payload.intent || '').toUpperCase();
    const validIntents = new Set(['INFORMATION_REQUEST', 'HUMAN_REQUEST', 'CONVERSATIONAL']);
    if (!validIntents.has(intent)) return fallback;
    const confidenceRaw = Number(payload.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0.5;
    return {
      intent,
      requires_handoff: Boolean(payload.requires_handoff),
      confidence,
      source: 'llm',
    };
  }

  async classifyIntent(userQuery, targetLang = 'tr') {
    const config = await this.getActiveConfig();
    if (!this.llmProvider) await this.initialize(config);
    if (!this.llmProvider) {
      return {
        intent: 'INFORMATION_REQUEST',
        requires_handoff: false,
        confidence: 0.5,
        source: 'no_provider',
      };
    }

    const systemPrompt = `
You are an intent classifier for a real-estate concierge chatbot.
Return ONLY valid JSON with this schema:
{
  "intent": "INFORMATION_REQUEST | HUMAN_REQUEST | CONVERSATIONAL",
  "requires_handoff": true | false,
  "confidence": 0.0-1.0
}
Rules:
- CONVERSATIONAL => requires_handoff must be false
- HUMAN_REQUEST => requires_handoff must be true
- INFORMATION_REQUEST => requires_handoff should be false by default
- Do not include markdown or explanations.
- Language: ${targetLang}
`;
    const raw = await this.llmProvider.generateResponse(systemPrompt, userQuery);
    const parsed = this.safeJsonParse(raw);
    return this.sanitizeIntentDecision(parsed);
  }

  // YENİ: Dil parametresi eklendi
// ... (önceki kodlar)

  async generateRAGResponse(userQuery, targetLang = 'tr') {
    logger.debug({ event: 'rag.start', queryLength: userQuery?.length || 0, targetLang }, 'RAG start');
    // Config'i her seferinde taze çekelim (Admin panelden değişirse anında yansısın)
    const config = await this.getActiveConfig();
    
    // Eğer config yoksa başlat (Fallback)
    if (!this.llmProvider) await this.initialize(config); 
    if (config && this.llmProvider) {
      const nextKey = `GEMINI:${config.api_key}:${config.model_name || ''}`;
      if (this.providerKey !== nextKey) {
        await this.initialize(config);
      }
    }
    if (!this.llmProvider) {
      return { found: false, answer: null };
    }
    
    // Eğer initialize edilmiş provider'ın modeli config'den farklıysa (Admin değiştirdiyse) yeniden başlat
    // (Basitlik için burada her çağrıda config kontrolü yapıyoruz, prod'da cache mekanizması kurulabilir)
    
    const minSimilarity = config?.min_similarity_threshold ?? 0.2;
    const topK = config?.top_k ?? 3;
    const candidateK = Math.max(topK * 4, 12);

    const docs = await this.retrieveWithRerank(userQuery, {
      topK,
      minSimilarity,
      candidateK
    });
    if (!docs || docs.length === 0) {
      logger.info({ event: 'rag.no_data', minSimilarity, topK }, 'RAG no data');
      return { found: false, answer: null };
    }
    logger.debug({ event: 'rag.retrieval', candidates: candidateK, selected: docs.length }, 'RAG retrieval');
    const contextText = docs.map(d => `- ${d.content}`).join("\n\n");
    
    // YENİ: Veritabanından gelen System Prompt'u kullan
    // Eğer DB boşsa varsayılanı kullan
    const dbPrompt = config?.system_prompt || DEFAULT_SYSTEM_PROMPT;
    
    const systemPrompt = `
      ${dbPrompt}
      
      GÖREV KURALLARI:
      1. Cevabı SADECE şu dilde ver: ${targetLang.toUpperCase()}
      2. [CONTEXT] içinde bilgi yoksa sadece NO_DATA yaz.
      3. Asla uydurma.
      ${NEGATIVE_HANDOFF_RULES}

      [CONTEXT]:
      ${contextText}
    `;

    // LLM'e Sor
    const answer = await this.llmProvider.generateResponse(systemPrompt, userQuery);
   
    // Temizlik (Bazen LLM "NO_DATA." gibi noktalı dönebilir)
    const cleanAnswer = answer.trim().replace(/\.$/, '');

    if (cleanAnswer.includes('NO_DATA')) {
      logger.info({ event: 'rag.no_data', reason: 'model_no_data' }, 'RAG no data');
      return { found: false, answer: null };
    }

    let verificationStatus = 'SUPPORTED';
    if (config?.use_guardrails) {
      verificationStatus = await this.verifyAnswer({
        answer: cleanAnswer,
        contextText,
        targetLang,
        question: userQuery
      });
      if (verificationStatus !== 'SUPPORTED') {
        logger.info({ event: 'rag.verification_failed' }, 'RAG verification failed');
        return { found: false, answer: null, verificationStatus };
      }
    }

    logger.info({ event: 'rag.answer', verificationStatus, answerLength: cleanAnswer.length }, 'RAG answered');
    return {
      found: true,
      answer: cleanAnswer,
      citations: docs.map(d => ({ id: d.id, snippet: d.content.substring(0, 50) + '...' })), // Kaynakça
      verificationStatus
    };
  }

  async debugRetrieve(queryText) {
    const config = await this.getActiveConfig();
    if (!this.llmProvider) await this.initialize(config);
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured');
    }
    const minSimilarity = config?.min_similarity_threshold ?? 0.2;
    const topK = config?.top_k ?? 3;
    const candidateK = Math.max(topK * 4, 12);

    const candidates = await this.searchSimilar(queryText, candidateK);
    const rescored = candidates.map(c => {
      const keywordScore = this.computeKeywordScore(queryText, c.content || '');
      const combinedScore = (0.7 * c.similarity) + (0.3 * keywordScore);
      return { ...c, keywordScore, combinedScore };
    });
    const filtered = rescored.filter(c => typeof c.similarity === 'number' && c.similarity >= minSimilarity);
    const selected = filtered
      .slice()
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK)
      .map(c => c.id);

    return {
      config: { minSimilarity, topK, candidateK },
      candidates: rescored.map(c => ({
        id: c.id,
        similarity: c.similarity,
        keywordScore: c.keywordScore,
        combinedScore: c.combinedScore,
        selected: selected.includes(c.id),
        snippet: c.content.substring(0, 80) + '...'
      }))
    };
  }
}

module.exports = new RAGService();
