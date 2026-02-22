const { Translate } = require('@google-cloud/translate').v2;

class TranslationService {
  constructor() {
    this.translateClient = null;
    this.isMock = false;

    // 1. YÖNTEM: API Key var mı? (En kolayı bu)
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      console.log("🔑 Google Translate: API Key kullanılıyor.");
      this.translateClient = new Translate({
        key: process.env.GOOGLE_TRANSLATE_API_KEY
      });
    } 
    // 2. YÖNTEM: Service Account JSON dosyası var mı?
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log("xB8 Google Translate: Service Account JSON kullanılıyor.");
      this.translateClient = new Translate();
    } 
    // HİÇBİRİ YOKSA: Mock Modu
    else {
      console.warn("⚠️  UYARI: Google Cloud credentials EKSİK. Mock Modu Aktif.");
      this.isMock = true;
    }
  }

  async detectLanguage(text) {
    if (this.isMock) return 'en';

    try {
      // detect sonucu bazen array döner, bazen obje. v2 kütüphanesi biraz esnektir.
      const [detections] = await this.translateClient.detect(text);
      
      // Tek bir sonuç geldiyse obje, çoklu geldiyse array olabilir.
      // Genelde [ { language: 'en', confidence: 1 } ] döner.
      const detection = Array.isArray(detections) ? detections[0] : detections;
      
      console.log(`🔍 Dil Tespiti: ${detection.language}`);
      return detection.language;
    } catch (error) {
      console.error("❌ Detect Hatası:", error.message);
      return 'en'; // Hata olursa fallback
    }
  }

  async translateText(text, targetLang) {
    if (this.isMock) {
      return `[${targetLang.toUpperCase()}] ${text}`;
    }

    try {
      const [translation] = await this.translateClient.translate(text, targetLang);
      return translation;
    } catch (error) {
      console.error(`❌ Translate Hatası (${targetLang}):`, error.message);
      return text;
    }
  }
}

module.exports = new TranslationService();
