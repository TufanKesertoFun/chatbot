require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { DEFAULT_SYSTEM_PROMPT } = require('../src/config/defaultSystemPrompt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error('SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD (min 12 chars) are required.');
  }

  // Şifreyi hashle
  const passwordHash = await bcrypt.hash(password, 10);

  // Kullanıcıyı oluştur (veya varsa güncelle)
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: passwordHash,
      full_name: 'Super Admin',
      role: 'SUPER_ADMIN'
    },
  });

  console.log({ user });
  
  // Varsayılan LLM Config (Gemini)
  const apiKey = process.env.SEED_LLM_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey) {
    await prisma.lLMConfig.updateMany({ data: { is_active: false } });
    const config = await prisma.lLMConfig.create({
      data: {
        provider: 'GEMINI',
        api_key: apiKey,
        model_name: 'gemini-2.0-flash',
        temperature: 0.7,
        min_similarity_threshold: 0.1,
        top_k: 3,
        use_guardrails: false,
        enable_intent_classifier: true,
        intent_confidence_threshold: 0.65,
        enable_future_state_machine: false,
        is_active: true,
        system_prompt: DEFAULT_SYSTEM_PROMPT
      }
    });
    
    console.log({ config });
  } else {
    console.warn('SEED_LLM_API_KEY veya GEMINI_API_KEY bulunamadı. LLM config seed edilmedi.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
