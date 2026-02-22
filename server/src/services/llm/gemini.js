// server/src/services/llm/gemini.js
const { GoogleGenAI } = require('@google/genai');
const LLMProvider = require("./base");

class GeminiProvider extends LLMProvider {
  constructor(config) {
    super(config);
    
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.modelName = config.modelName || "gemini-2.0-flash";
    this.embeddingModelName = "gemini-embedding-001";
  }

  async generateResponse(systemPrompt, userPrompt) {
    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        config: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          temperature: 0.7,
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ]
      });

      // console.log("Gemini Generate Response:", JSON.stringify(response, null, 2));

      // --- DÜZELTME BURADA ---
      // Yeni SDK Cevap Okuma Yöntemi
      if (
        response &&
        response.candidates &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts.length > 0
      ) {
        return response.candidates[0].content.parts[0].text;
      }

      console.error("❌ Boş veya Beklenmeyen Chat Cevabı:", JSON.stringify(response, null, 2));
      return "Üzgünüm, şu an cevap üretemiyorum.";

    } catch (error) {
      console.error("Gemini Generate Error:", error);
      return "Üzgünüm, şu an cevap üretemiyorum.";
    }
  }

  async getEmbedding(text) {
    try {
      const response = await this.client.models.embedContent({
        model: this.embeddingModelName,
        config: {
          outputDimensionality: 768, 
        },
        contents: text
      });

      // --- DÜZELTME BURADA ---
      // Yeni SDK yapısı: response.embeddings[0].values
      if (response && response.embeddings && response.embeddings.length > 0) {
        return response.embeddings[0].values;
      }
      
      // Bazen farklı dönerse diye eski kontrolleri de tutalım (güvenlik için)
      if (response && response.embedding && response.embedding.values) {
        return response.embedding.values;
      }

      console.error("❌ Beklenmeyen Response Yapısı:", JSON.stringify(response, null, 2));
      throw new Error("Embedding sonucu boş veya geçersiz formatta döndü.");

    } catch (error) {
      console.error("Gemini Embedding Critical Error:", error.message);
      throw error;
    }
  }
}

module.exports = GeminiProvider;
