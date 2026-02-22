// server/src/services/llm/base.js

class LLMProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Metinden cevap üretir
   * @param {string} systemPrompt - Botun kişiliği/kuralları
   * @param {string} userPrompt - Kullanıcının sorusu + Context
   * @returns {Promise<string>}
   */
  async generateResponse(systemPrompt, userPrompt) {
    throw new Error("Method 'generateResponse' must be implemented.");
  }

  /**
   * Metni vektöre çevirir (Embedding)
   * @param {string} text 
   * @returns {Promise<number[]>} - Vektör dizisi (örn: [0.1, -0.5, ...])
   */
  async getEmbedding(text) {
    throw new Error("Method 'getEmbedding' must be implemented.");
  }
}

module.exports = LLMProvider;