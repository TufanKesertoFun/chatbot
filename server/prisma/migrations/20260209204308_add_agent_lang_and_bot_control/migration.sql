-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "bot_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agent_lang" VARCHAR(5) NOT NULL DEFAULT 'tr';
