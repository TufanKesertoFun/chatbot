🏢 AI Concierge & Agent Platform
Bu proje, emlak sektörü için geliştirilmiş; yapay zeka destekli (RAG), çok dilli ve canlı destek (Live Chat) özelliklerine sahip hibrit bir müşteri iletişim platformudur.

🛠 Teknik Mimari (Tech Stack)
1. Backend (Sunucu)
Runtime: Node.js
Framework: Fastify (v4) - Yüksek performanslı API sunucusu.
Real-time: Socket.IO - Anlık mesajlaşma ve sinyalizasyon.
ORM: Prisma - Veritabanı yönetimi.
Auth: @fastify/jwt & bcryptjs - Güvenli kimlik doğrulama.
2. Veritabanı & AI
Database: PostgreSQL
Vector Extension: pgvector - RAG (Retrieval Augmented Generation) için vektör araması.
LLM Provider: Google Gemini 1.5/2.0 Flash (via @google/genai SDK).
Translation: Google Cloud Translate API v2 (Otomatik dil algılama ve çeviri).
3. Frontend (İstemci)
Framework: React (Vite)
Styling: Tailwind CSS
Icons: Lucide React
Connection: Socket.IO Client

🌟 Temel Özellikler
A. Ziyaretçi Chat Widget'ı (Public)
Otomatik Dil Tespiti: Ziyaretçinin tarayıcı diline göre karşılama yapar ve yazdığı mesajın dilini (örn: Almanca) otomatik algılar.
Yapay Zeka Cevapları (RAG): Ziyaretçi soru sorduğunda sistem önce Knowledge Base (Bilgi Bankası) içinde arama yapar. Cevap varsa AI, ziyaretçinin dilinde yanıt verir.
Kesintisiz Deneyim: Ziyaretçi kendi dilinde yazar, sistem arka planda çevirir.
B. Agent Paneli (Canlı Destek)
Çift Yönlü Çeviri: Ziyaretçi Almanca yazar, Agent Türkçe görür. Agent Türkçe yazar, Ziyaretçi Almanca görür. Orijinal metinler de görüntülenir.
Handoff (Devir) Yönetimi:
Bot Modu: Varsayılan olarak aktiftir. Bot cevap verir.
Canlı Mod: Agent "Devral" butonuna bastığında bot susar, kontrol insana geçer.
Agent Assist (AI Kopya): Agent, konuşma sırasında AI'dan "Öneri Getir" isteyebilir. AI, bilgi bankasından en uygun cevabı hazırlar.
Feedback Sistemi: Botun verdiği cevaplara 👍 / 👎 verilebilir.
Citations (Kaynaklar): Botun cevabı hangi dökümandan ürettiği dipnot olarak gösterilir.
C. Yönetim Paneli (Super Admin)
Knowledge Base Yönetimi: Emlak projeleriyle ilgili metinler eklenir, güncellenir ve silinir. (Otomatik Vektörleştirme yapılır).
Kullanıcı Yönetimi: Yeni Agent veya Admin tanımlanabilir. Agent'ların bildiği diller ayarlanabilir.
Sistem Ayarları:
LLM Modeli (Gemini/OpenAI) seçimi.
API Key güncelleme.
System Prompt: Botun kişiliğini ve kurallarını kod yazmadan değiştirme imkanı.
Dashboard: Canlı istatistikler (Aktif sohbet, Bot başarı oranı vb.).

💾 Veritabanı Şeması (Prisma Schema)
Sistem aşağıdaki ilişkisel ve vektörel yapı üzerine kuruludur:
Model
Açıklama
Kritik Alanlar
User
Admin ve Agent kullanıcıları
role (AGENT/SUPER_ADMIN), agent_lang
Conversation
Sohbet oturumları
bot_enabled (Handoff kontrolü), visitor_lang, status (WAITING/ASSIGNED/RESOLVED), assigned_agent_id, priority
Message
Mesaj kayıtları
sender_type (VISITOR/AGENT/BOT), citations, feedback, verification_status, text_masked
AuditLog
Admin aksiyon kayıtları
action, target_type, metadata
TrainingExample
Eğitim verisi
question, bot_answer, correct_answer, *_masked
EvalQuestion
Eval set soruları
question, expected_answer
EvalRun
Eval sonuç özeti
accuracy, coverage
ConversationMetrics
Analitik ve kalite metrikleri
first_response_at, first_agent_response_at, handoff_reason, csat_score
KnowledgeBase
RAG kaynak dökümanları
title, content
KnowledgeChunk
Vektör parçaları
embedding (vector-768), content
LLMConfig
AI Ayarları
system_prompt, model_name, api_key, min_similarity_threshold, top_k

🔄 Kritik İş Akışları (Workflows)
1. RAG & Cevap Üretme Akışı
Input: Ziyaretçi mesaj atar ("Fiyatlar nedir?").
Detect: Sistem dili algılar (TR).
Embedding: Mesaj 768 boyutlu vektöre çevrilir.
Vector Search: knowledge_chunks tablosunda "Cosine Similarity" ile en yakın metinler bulunur.
Generation: Bulunan metinler + Kullanıcı Sorusu + System Prompt, Gemini'ye gönderilir.
Response: Eğer bilgi varsa cevap döner, yoksa NO_DATA döner ve sistem temsilciye yönlendirir.
2. Handoff (Bot -> İnsan Devri)
Implicit (Örtük): Bot NO_DATA hatası alırsa otomatik olarak "Temsilciye aktarıyorum" der.
Explicit (Açık): Agent panelden "Devral" (Take Over) butonuna basarsa:
conversations.bot_enabled = false olur.
Socket ile tüm istemcilere "Agent Devrede" sinyali gider.
Ziyaretçi mesaj atsa bile RAG servisi tetiklenmez.

🚀 Kurulum ve Çalıştırma
Gereksinimler
Node.js (v18+)
PostgreSQL (pgvector eklentisi aktif)
Adımlar
1. Sunucu (Backend)
Bash

cd server
npm install
# .env dosyasını oluştur (DATABASE_URL, GEMINI_API_KEY, JWT_SECRET)
npx prisma migrate dev  # Veritabanını oluştur
npm run dev             # Başlat (Port 3001)

2. İstemci (Frontend)
Bash

cd client
npm install
npm run dev             # Başlat (Port 5173)

3. İlk Giriş
URL: http://localhost:5173/agent
User/Pass: `SEED_ADMIN_EMAIL` ve `SEED_ADMIN_PASSWORD` ile oluşturulur (seed sırasında)

---

DÖKÜMAN: AI Concierge Platform – MVP Gap & Enhancement Backlog (Dev-Ready)

EPIC-1: Agent Inbox / Queue & Operasyonel Canlı Destek Olgunluğu
Story 1.1 — Agent Inbox (Queue) ekranı
Durum: DONE
Notlar:
- “Bekliyor”, “Üzerimde”, “Çözüldü” sekmeleri eklendi.
- Manuel atama (Üstlen) endpoint + UI eklenerek sohbet lock mekanizması getirildi.
- Sohbet kartında: visitor_lang, bot_enabled, last_message_at, status, priority, bekleme süresi gösteriliyor.
- Socket eventleri: conversation_assigned, conversation_status_changed, conversation:escalated.

Story 1.2 — SLA / Bekleme Süresi & Eskalasyon
Durum: DONE
Notlar:
- Bekleme süresi UI’da canlı güncelleniyor (SLA eşiği kırmızı).
- SLA eşiği aşıldığında priority=HIGH işaretleniyor ve event/log üretiliyor.

EPIC-2: Analitik & Kalite Ölçümleme
Story 2.1 — Minimum dashboard metrikleri
Durum: DONE
Notlar:
- Gün/hafta filtreli dashboard metrikleri eklendi.
- Deflection, handoff, ilk yanıt süresi, çözüm süresi ve CSAT ortalaması raporlanıyor.
- Handoff reason dağılımı (en az 3 kategori) gösteriliyor.

EPIC-3: Halüsinasyon Azaltma – Retrieval Kalitesi + Cevap Doğrulama
Story 3.1 — Retrieval threshold ve topK ayarları
Durum: DONE
Notlar:
- LLMConfig’a `min_similarity_threshold` ve `top_k` eklendi.
- Admin panelinden güncellenince anında etkiler.
- Threshold altı sonuçlarda bot cevap üretmez (fallback).
Story 3.2 — Re-ranking / Contextual retrieval
Durum: DONE
Notlar:
- İlk aşamada candidate retrieval (topK*4) yapılıyor.
- Keyword overlap re-rank ile en iyi chunk’lar seçiliyor.
- Retrieval debug endpoint eklendi: `/api/admin/retrieval-debug?query=...`
Story 3.3 — Answer-grounding doğrulama adımı (post-check)
Durum: DONE
Notlar:
- Bot cevabı ikinci bir doğrulayıcı prompt ile kontrol ediliyor.
- “UNSUPPORTED” ise kullanıcıya cevap gönderilmiyor.
- Sonuç `verification_status` alanında saklanıyor.

EPIC-4: Güvenlik, KVKK/GDPR ve Kurumsal Hardening
Story 4.1 — PII/Privacy Masking
Durum: DONE
Notlar:
- Mesajlar LLM’e gitmeden önce maskeleniyor.
- Maskeli metin `text_masked` alanında saklanıyor ve agent panelinde görülebiliyor.
Story 4.2 — Rate limit / abuse kontrolü
Durum: DONE
Notlar:
- IP bazlı rate limit mevcut.
- Conversation bazlı token bütçe kontrolü eklendi.
Story 4.3 — Audit log & admin aksiyon izleme
Durum: DONE
Notlar:
- Admin aksiyonları `audit_logs` tablosuna yazılıyor.
- Admin panelde “Audit Logs” ekranı eklendi.

EPIC-5: Eğitim Döngüsü (Fine-tune / Prompt iyileştirme için veri)
Story 5.1 — Feedback’i “düzeltme” ile zenginleştirme
Durum: DONE
Notlar:
- 👎 geri bildirimlerinde “doğru yanıt” isteniyor.
- Kayıtlar `training_examples` tablosuna yazılıyor.
- Admin panelden CSV/JSON export alınabiliyor.
Story 5.2 — Eval set ve otomatik regression test
Durum: DONE
Notlar:
- Eval set CRUD + manuel “Eval Run” eklendi.
- En son eval run sonuçları dashboard’da gösteriliyor.

---

QA Bugfix Pass (Agent/Widget Realtime)
Durum: IN PROGRESS
Tarih: 2026-02-10
Düzeltilenler:
- Agent mesaj gönderiminde optimistik mesaj + socket teyidi eklendi; mesajın UI’dan kaybolma riski azaltıldı.
- Agent realtime akışında `conversation:new`, `conversation:handoff_needed`, `conversation_assigned`, `conversation_status_changed` için upsert + periyodik senkronizasyon güçlendirildi.
- Yeni sohbetlerin refresh olmadan görünmesi için socket reconnect senkronizasyonu ve 10 sn polling iyileştirildi.
- `GET /api/agent/conversations` cevabına `needsHandoff` alanı eklendi (conversation metrics üzerinden), event kaçsa da queue’da görünürlük arttırıldı.
- Widget tarafında `message:new` normalize edildi (`camelCase/snake_case`) ve gelen agent mesajında `textTranslated` boşsa `textOriginal` fallback gösterimi eklendi.

---

Refactor Pass (Server-Critical + Widget SDK)
Durum: DONE
Tarih: 2026-02-10
Kapsam:
- Server `agent` ve `widget` route dosyalari ince delegator yapisina alindi; is kurallari service katmanina tasindi.
- `app.js` sadeleştirildi; CORS validator, security headers, in-memory rate limit, socket handlers ve inactivity auto-close job ayri modullere ayrildi.
- Widget istemcisi SDK benzeri tasinabilir yapiya alindi.

Yeni Server Modulleri:
- `server/src/modules/agent/agentService.js`
- `server/src/modules/widget/widgetService.js`
- `server/src/modules/common/realtime.js`
- `server/src/modules/common/mappers.js`
- `server/src/config/originValidator.js`
- `server/src/plugins/securityHeaders.js`
- `server/src/plugins/inMemoryRateLimit.js`
- `server/src/socket/registerSocketHandlers.js`
- `server/src/jobs/inactivityAutoClose.js`

Widget SDK:
- `client/src/widget-sdk/OvoWidgetClient.js` (session + socket + sendMessage)
- `client/src/widget-sdk/OvoWidget.jsx` (referans UI)
- `client/src/widget-sdk/index.js` (`OvoWidget`, `OvoWidgetClient`, `mountOvoWidget`)
- `client/src/ChatWidget.jsx` mevcut PoC için geriye uyumlu wrapper

SDK Kullanim (React):
```jsx
import { OvoWidget } from './widget-sdk';

export default function Page() {
  return <OvoWidget visitorName="Demo User" />;
}
```

SDK Kullanim (Imperative mount):
```js
import { mountOvoWidget } from './widget-sdk';

const unmount = mountOvoWidget(document.getElementById('ovo-widget-root'), {
  visitorName: 'Demo User'
});
```

---

Handoff + Session Continuity Rules (2026-02-10)
Durum: DONE
Kurallar:
- Widget refresh sonrasinda ayni session devam eder (local storage + state restore).
- Konusma `RESOLVED` oldugunda session sonlanir; bir sonraki mesaj icin yeni chat acilir.
- Bot `NO_DATA` durumunda widget tarafinda "agent bekleniyor" durumu gosterilir.
- Agent mesaji geldigi anda widget "canli temsilci baglandi" moduna gecer.
- Realtime kopmalarina karsi widget tarafinda 10 sn state polling fallback vardir.

Teknik Uygulama:
- Yeni endpoint: `GET /api/widget/conversations/:conversationId/state`
- Widget mesaj gonderiminde `RESOLVED` konusmaya yazma engeli (409)
- Inactivity/resolve kapanisinda widget room'una `conversation:status_changed` eventi emit edilir.
- Agent panelde secili konusma odasina socket join/rejoin garanti edildi (connect + reconnect + socket hazir oldugunda tekrar join).

---

Over-Handoff Reduction (Short + Mid Term)
Durum: DONE
Tarih: 2026-02-10
Uygulananlar:
- Pre-LLM Message Type Rule Engine eklendi (`GRATITUDE`, `CONFIRMATION`, `SMALL_TALK`).
- Bu tip mesajlarda RAG/LLM handoff zinciri tetiklenmez; deterministic template bot cevabi doner.
- System prompt'a negatif handoff kurallari eklendi (tesekkur/onay/small-talk/emoji => handoff yok, gerekirse netlestirme sorusu).
- Decision-only Intent Classification katmani eklendi (JSON schema: intent/requires_handoff/confidence).
- Intent confidence dusukse handoff yerine clarification cevabi donuluyor.
- Explicit human request tespiti (kural + decision) ile `EXPLICIT_HUMAN_REQUEST` reason set edilip handoff yapiliyor.
- Handoff reason standardizasyonu: `NO_DATA`, `EXPLICIT_HUMAN_REQUEST`, `NEGATIVE_SENTIMENT`, `POLICY_BLOCK`.
- Dashboard reason mapping yeni enumlara gore normalize edildi.

Veritabani / Config:
- `llm_configs` alanlari eklendi:
  - `enable_intent_classifier`
  - `intent_confidence_threshold`
  - `enable_future_state_machine`
- Migration eklendi:
  - `server/prisma/migrations/20260210124500_handoff_intent_and_flags/migration.sql`

Long Term Mimari Hazirligi (Aktif Degil):
- Conversation state machine modulu eklendi: `server/src/modules/conversation/stateMachine.js`
- Feature-flag ile kapali tutuluyor (`enable_future_state_machine=false`).
- Handoff guard kurali bu modulde hazirlandi ancak runtime'da aktif edilmedi.

System Prompt Standardizasyonu:
- Domain-uyumlu kalici varsayilan prompt olusturuldu: `server/src/config/defaultSystemPrompt.js`
- Seed sirasinda `LLMConfig.system_prompt` bu kaynaktan set edilir: `server/prisma/seed.js`
- Runtime fallback prompt da ayni kaynagi kullanir: `server/src/services/rag.js`

---

Feature Freeze: UI/UX + i18n Foundation (Admin + Server)
Durum: DONE
Tarih: 2026-02-10
Kapsam:
- Admin panelde EN/TR dil secimi eklendi (persisted, localStorage tabanli).
- Admin panel metinleri i18n katalog yapisina baglandi (`client/src/i18n/translations.js`).
- Settings ekranina kritik terimler icin aciklayici hintler eklendi:
  - `minSimilarityThreshold`
  - `topK`
  - `Intent Classifier`
  - `Intent Confidence Threshold`
  - `Future State Machine`
- Settings ekrani Epic-3/Epic-LongTerm flag alanlarini da yonetir hale getirildi:
  - `enable_intent_classifier`
  - `intent_confidence_threshold`
  - `enable_future_state_machine`

Client i18n Altyapisi:
- Yeni context/provider eklendi: `client/src/i18n/context.jsx`
- Uygulama root'a provider baglandi: `client/src/main.jsx`
- API isteklerine dil bilgisini tasimak icin `Accept-Language` header interceptor eklendi: `client/src/api.js`

Server i18n Altyapisi:
- Yeni locale + mesaj katalog sistemi eklendi:
  - `server/src/i18n/messages.js`
  - `server/src/i18n/index.js`
- Fastify request bazli `request.t(...)` ceviri fonksiyonu baglandi: `server/src/app.js`
- Route katmaninda kullaniciya donen hata mesaji metinleri locale-aware hale getirildi:
  - `server/src/routes/admin.js`
  - `server/src/routes/agent.js`
  - `server/src/routes/widget.js`
  - `server/src/routes/dashboard.js`

Ek Teknik Not:
- Service kaynakli is hatalarinin route katmaninda cevrilebilir olmasi icin error code yaklasimi eklendi:
  - `server/src/modules/agent/agentService.js`
  - `server/src/modules/widget/widgetService.js`

Doğrulama:
- `client`: `npm run build` basarili.
- `server`: degisen dosyalar `node --check` ile syntax kontrolunden gecti.

---

Feature Freeze: Admin Terminology + UX Copy Pass (TR-first)
Durum: DONE
Tarih: 2026-02-10
Degisiklikler:
- Dashboard TR terminoloji guncellendi:
  - `Deflection` -> `Bot Çözümleme`
  - `Handoff` -> `Canlıya Devir`
  - `Handoff Reason Dağılımı` -> `Canlıya Devir Neden Dağılımı`
- Handoff reason etiketleri dashboard’da enum kodu yerine okunabilir lokalize metinle gosterilmeye baslandi.
- Sol menude:
  - `Inbox` -> `Mesajlar`
  - `Retrieval Debug` -> `Getirim Testi`
  - `Audit Logs` -> `Kayıtlar`
  - `Training` -> `Model Eğitim`
- Mesajlar ekraninda queue terimleri sadeleştirildi (`Mesaj Sırası`, `Bekliyor`, `Üzerimde`, `Çözüldü`).
- Bilgi Bankası ekranına “İdeal KB” rehber kutusu eklendi.
- Getirim Testi ekranına kullanım yönergesi eklendi.
- Model Eğitim ekranına kullanım yönergesi eklendi ve alt terimler türkçelestirildi:
  - `Training Export` -> `Eğitim Verisi Dışa Aktar`
  - `Eval Set` -> `Değerlendirme Seti`
  - `Eval Run` -> `Değerlendirme Çalıştır`
- Marka adı admin panelde `OvoBot` olarak güncellendi.
- Sidebar tipografisi sadeleştirildi; çıkış butonu üst bölüme taşındı.

Teknik Dosyalar:
- `client/src/i18n/translations.js`
- `client/src/AgentPanel.jsx`

Doğrulama:
- `client`: `npm run build` basarili.

---

Feature Freeze: Multi-language Expansion + Repo Hygiene
Durum: DONE
Tarih: 2026-02-10

Kapsam:
- Admin panel dil desteği genişletildi:
  - Yeni diller: `de` (Almanca), `ru` (Rusça), `fr` (Fransızca)
  - Dil seçim menüsüne eklendi
  - i18n fallback zinciri: seçilen dil -> en -> tr
- Kullanıcı oluşturma ekranında canlı destek için genişletilmiş anadil seçenekleri eklendi:
  - `tr`, `en`, `de`, `ru`, `fr`
  - Kullanıcı listesinde dil kodu yerine okunabilir dil adı gösterimi eklendi
- Backend doğrulama:
  - `agentLang` değeri whitelist ile doğrulanıyor (`tr/en/de/ru/fr`)
- Çeviri akışı iyileştirmesi:
  - Canlı destek modunda ziyaretçi mesajları, atanmış agent’ın `agent_lang` diline çevriliyor
  - Sohbet atama/devir anında mevcut ziyaretçi mesajları agent diline lokalize ediliyor
  - Agent mesajı `source_lang` artık agent’ın anadilinden set ediliyor
  - Agent Assist önerileri agent dili hedeflenerek üretiliyor
- Repo hazırlığı:
  - Kök `.gitignore` eklendi
  - İlk kurulum için `README.txt` eklendi

Teknik Dosyalar:
- `client/src/i18n/translations.js`
- `client/src/i18n/context.jsx`
- `client/src/AgentPanel.jsx`
- `server/src/routes/admin.js`
- `server/src/modules/agent/agentService.js`
- `server/src/modules/widget/widgetService.js`
- `server/src/i18n/index.js`
- `server/src/i18n/messages.js`
- `.gitignore`
- `README.txt`

Doğrulama:
- `client`: `npm run build` başarılı
- `server`: değişen dosyalar `node --check` ile başarılı

---

Feature Freeze: Widget SDK i18n Hardening (5 Languages)
Durum: DONE
Tarih: 2026-02-10

Kapsam:
- Widget SDK icin ayri i18n modulu eklendi:
  - `client/src/widget-sdk/i18n.js`
  - Desteklenen locale: `tr`, `en`, `de`, `ru`, `fr`
  - Fallback zinciri: aktif locale -> en -> tr
  - Disaridan override destegi (`i18n` prop)
- `OvoWidget` API genisletildi:
  - `locale`
  - `i18n` (translation override)
  - `brandName`
  - `visitorName` (opsiyonel, locale tabanli guest fallback)
- Widget icindeki sabit metinler i18n'e tasindi:
  - Header title/subtitle
  - Welcome title/message
  - Live handoff status bar metinleri
  - Resolved durum metinleri
  - Input placeholder metinleri
  - "Translated" etiketi
- `OvoWidgetClient` locale-aware istek basliklari ile guncellendi (`Accept-Language`):
  - `startSession`, `sendMessage`, `getConversationState`
- SDK exportlari genisletildi:
  - `createWidgetI18n`
  - `defaultWidgetTranslations`
  - `SUPPORTED_WIDGET_LOCALES`
  - `DEFAULT_WIDGET_LOCALE`

Ek dokumantasyon:
- `README.txt` icine widget SDK locale + override kullanim ornekleri eklendi.

Dogrulama:
- `client`: `npm run build` basarili.

---

Feature Freeze: OvoWidget Rename + Tourism Demo + Seed Prompt Sync
Durum: DONE
Tarih: 2026-02-10

Kapsam:
- Widget SDK resmi adı `OvoWidget` olarak güncellendi.
- Public PoC landing sayfası turizm senaryosuna göre yenilendi (Rixos Tersane Istanbul temalı demo akışı).
- Varsayılan sistem promptu turizm/hotel concierge davranışına göre yeniden yazıldı.
- Seed süreci kalıcı prompt kaynağı ile senkronlandı.

Teknik Dosyalar:
- `client/src/widget-sdk/OvoWidget.jsx`
- `client/src/widget-sdk/OvoWidgetClient.js`
- `client/src/widget-sdk/index.js`
- `client/src/ChatWidget.jsx`
- `client/src/App.jsx`
- `server/src/config/defaultSystemPrompt.js`
- `server/prisma/seed.js`
- `server/src/modules/widget/widgetService.js`

Veritabanı Sıfırlama / Baştan Kurulum:
- `server/package.json` scriptleri eklendi:
  - `npm run db:reset`
  - `npm run db:rebuild` (alias)
- Bu akış migration reset + prisma generate + seed adımlarını tek komutta çalıştırır.

Not:
- Geriye uyumluluk için `VoraWidget` export alias'ları korunmuştur; yeni entegrasyonlar `OvoWidget` isimlerini kullanmalıdır.

---

Feature Freeze: Knowledge Base Bulk Import (JSON/CSV)
Durum: DONE
Tarih: 2026-02-10

Kapsam:
- Bilgi Bankası için toplu içe aktarma eklendi (`JSON` ve `CSV`).
- Tek endpoint ile `AUTO`, `DOCUMENT`, `FAQ` modları desteklenir.
- Admin panelde dosya yükleme + payload yapıştırma + sonuç raporu eklendi.
- Şablon indirme endpointleri eklendi (JSON/CSV).

Backend:
- Yeni endpoint: `POST /api/admin/knowledge-base/bulk-import`
- Yeni endpoint: `GET /api/admin/knowledge-base/import-template`
- Limitler:
  - Tek istekte en fazla 1000 satır
  - Satır başına en fazla 20.000 karakter içerik
- Import özeti döner:
  - `totalRows`, `validRows`, `imported`, `failed`, `failedRows`
- Audit log aksiyonu:
  - `KB_BULK_IMPORT`

Frontend:
- `KnowledgeBase` ekranına bulk import kartı eklendi:
  - Format seçimi: JSON / CSV
  - Mod seçimi: AUTO / DOCUMENT / FAQ
  - Dosya seçme veya metin yapıştırma
  - İçe aktarma sonucu ve hatalı satır nedeni görüntüleme

Desteklenen alanlar:
- `DOCUMENT`: `title`, `content`
- `FAQ`: `question`, `answer` (KB'ye `Soru: ... / Cevap: ...` formatında yazılır)
- `AUTO`: satır bazlı otomatik alan algılama

---

Roadmap TODO (Post-PoC / Kurumsal Hazırlık)
Durum: TODO
Tarih: 2026-02-12

A) Güvenlik Hardening TODO
- Socket oda erişim yetkilendirmesi sıkılaştırma (`conversationId` için server-side access check).
- LLM provider API key için uygulama seviyesinde şifreleme + key management (KMS/Vault).
- Token modeli güçlendirme:
  - localStorage yerine httpOnly cookie veya kısa ömür + refresh token + rotation.
  - token revoke / forced logout desteği.
- Tenant/data izolasyonu:
  - conversation, knowledge base ve retrieval katmanında tenant scope.
- Dağıtık rate limit:
  - in-memory yerine Redis tabanlı merkezi limiter.
- PII koruma genişletme:
  - regex dışı alanlar için kural seti + (opsiyonel) NER.

B) Performans / Ölçek TODO
- pgvector ANN index stratejisi (IVFFLAT/HNSW) ve index bakım prosedürü.
- Queue tabanlı asenkron işleme:
  - KB embedding üretimi
  - eval run
  - toplu import işlemleri
- Dashboard agregasyonlarını precompute/materialized tabloya alma.
- Agent list/detail endpointlerinde pagination + incremental loading.
- Realtime event + polling hibrit akışında gereksiz `loadData` çağrılarını azaltma.
- Socket.IO multi-instance için Redis adapter.

---

Feature Update: SDK User Identity + Mini CRM
Durum: Paket 1-3 tamamlandı, Paket 4 backlog
Tarih: 2026-02-12

Hedef:
- OvoWidget üzerinden login olan kullanıcı bilgilerini opsiyonel taşıyabilmek.
- Konuşma sırasında lead toplama ve basit CRM akışı sağlamak.

Önerilen Model Alanları (minimum):
- `Conversation`:
  - `visitor_external_id` (müşteri sistemindeki user id)
  - `visitor_email`
  - `visitor_full_name`
  - `visitor_phone` (opsiyonel)
  - `lead_status` (`NEW`, `QUALIFIED`, `CONTACTED`, `WON`, `LOST`)
  - `lead_source` (`WIDGET`, `SDK_API`, `MANUAL`)
- Yeni `LeadActivity` tablosu:
  - `conversation_id`, `type`, `payload`, `created_at`

SDK API Önerisi:
- `new OvoWidget({ user: { id, email, fullName, phone } })`
- Runtime update:
  - `widgetClient.setUserProfile(...)`
- Event callback:
  - `onLeadCaptureRequested(fields)` (bot bir bilgi isterse host app UI açabilir)

Backend Akış Önerisi:
- `POST /api/widget/session` body’sine opsiyonel `userProfile`.
- Güvenlik:
  - profile alanlarını allowlist ile doğrula.
  - max uzunluk + email/phone format kontrolü.
- Kayıt stratejisi:
  - PII raw alanlarını sadece gerekli olduğu kadar sakla.
  - log/audit tarafında maskeli göster.

Mini CRM Özellikleri (MVP):
- Agent panelde lead kartı:
  - ad-soyad, email, telefon, lead status, last contact.
- Lead durum güncelleme + not ekleme.
- Filtreler:
  - status, tarih, atanan agent.
- Export:
  - CSV/JSON lead export.

Tamamlanan İş Paketleri:
- Paket 1 (Temel): SDK’dan kimlik alma + conversation alanlarına yazma.
  - `POST /api/widget/session` artık opsiyonel `userProfile` alıyor.
  - `POST /api/widget/conversations/:conversationId/profile` ile runtime profil güncelleme eklendi.
  - SDK tarafı: `OvoWidget` ve `OvoWidgetClient` için `userProfile/user` desteği + `setUserProfile`.
- Paket 2 (Lead): lead status + agent panel lead kartı + status update.
  - Conversation modeline lead alanları eklendi:
    - `visitor_external_id`, `visitor_email`, `visitor_full_name`, `visitor_phone`
    - `lead_status`, `lead_source`, `lead_last_contact_at`
  - Agent API: `POST /api/agent/conversations/:conversationId/lead`
  - Inbox ekranına lead kartı (durum/kaynak/profil/not) eklendi.
- Paket 3 (CRM-lite): lead activity timeline + export + filtreleme.
  - Yeni tablo: `lead_activities` (`LeadActivity` modeli).
  - Agent API:
    - `GET /api/agent/conversations/:conversationId/lead-activities`
    - `GET /api/agent/leads`
    - `GET /api/agent/leads/export?format=json|csv`
  - Agent panelde yeni `Lead Havuzu` sekmesi:
    - filtreleme (status, tarih, arama)
    - JSON/CSV export
    - konuşmaya hızlı geçiş

Backlog (Paket 4):
- Paket 4 (Entegrasyon): webhook/CRM push (HubSpot/Salesforce-style mapping).
