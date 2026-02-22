/*
  Warnings:

  - The values [OPEN] on the enum `ConversationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "HandoffReason" AS ENUM ('NO_DATA', 'USER_REQUEST_HUMAN', 'POLICY_BLOCK', 'SENTIMENT_RISK', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'SUPPORTED', 'UNSUPPORTED');

-- AlterEnum
BEGIN;
CREATE TYPE "ConversationStatus_new" AS ENUM ('WAITING', 'ASSIGNED', 'RESOLVED');
ALTER TABLE "Conversation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Conversation" ALTER COLUMN "status" TYPE "ConversationStatus_new" USING ("status"::text::"ConversationStatus_new");
ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_old";
ALTER TYPE "ConversationStatus_new" RENAME TO "ConversationStatus";
DROP TYPE "ConversationStatus_old";
ALTER TABLE "Conversation" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "assigned_agent_id" TEXT,
ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "priority" "PriorityLevel" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'WAITING';

-- AlterTable
ALTER TABLE "llm_configs" ADD COLUMN     "min_similarity_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
ADD COLUMN     "top_k" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "text_masked" TEXT,
ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "conversation_metrics" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_response_at" TIMESTAMP(3),
    "first_bot_response_at" TIMESTAMP(3),
    "first_agent_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "handoff_reason" "HandoffReason",
    "csat_score" INTEGER,

    CONSTRAINT "conversation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_examples" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "conversation_id" TEXT,
    "question" TEXT NOT NULL,
    "question_masked" TEXT,
    "bot_answer" TEXT NOT NULL,
    "bot_answer_masked" TEXT,
    "correct_answer" TEXT,
    "correct_answer_masked" TEXT,
    "feedback_score" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_questions" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expected_answer" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_runs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_results" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "eval_question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_metrics_conversation_id_key" ON "conversation_metrics"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_metrics_created_at_idx" ON "conversation_metrics"("created_at");

-- CreateIndex
CREATE INDEX "training_examples_created_at_idx" ON "training_examples"("created_at");

-- CreateIndex
CREATE INDEX "eval_questions_created_at_idx" ON "eval_questions"("created_at");

-- CreateIndex
CREATE INDEX "eval_runs_created_at_idx" ON "eval_runs"("created_at");

-- CreateIndex
CREATE INDEX "eval_results_created_at_idx" ON "eval_results"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Conversation_assigned_agent_id_idx" ON "Conversation"("assigned_agent_id");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_metrics" ADD CONSTRAINT "conversation_metrics_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_examples" ADD CONSTRAINT "training_examples_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_question_id_fkey" FOREIGN KEY ("eval_question_id") REFERENCES "eval_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
