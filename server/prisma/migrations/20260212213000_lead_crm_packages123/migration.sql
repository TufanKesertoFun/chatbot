-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WIDGET', 'SDK_API', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('PROFILE_CAPTURED', 'PROFILE_UPDATED', 'STATUS_UPDATED', 'NOTE_ADDED');

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "visitor_external_id" VARCHAR(128),
ADD COLUMN "visitor_email" VARCHAR(320),
ADD COLUMN "visitor_full_name" VARCHAR(150),
ADD COLUMN "visitor_phone" VARCHAR(64),
ADD COLUMN "lead_status" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "lead_source" "LeadSource" NOT NULL DEFAULT 'WIDGET',
ADD COLUMN "lead_last_contact_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_lead_status_created_at_idx" ON "Conversation"("lead_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Conversation_visitor_email_idx" ON "Conversation"("visitor_email");

-- CreateIndex
CREATE INDEX "Conversation_visitor_external_id_idx" ON "Conversation"("visitor_external_id");

-- CreateIndex
CREATE INDEX "Conversation_lead_last_contact_at_idx" ON "Conversation"("lead_last_contact_at" DESC);

-- CreateIndex
CREATE INDEX "lead_activities_conversation_id_created_at_idx" ON "lead_activities"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "lead_activities_actor_user_id_created_at_idx" ON "lead_activities"("actor_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
