-- Add decision-engine related config fields
ALTER TABLE "llm_configs"
ADD COLUMN "enable_intent_classifier" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "intent_confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
ADD COLUMN "enable_future_state_machine" BOOLEAN NOT NULL DEFAULT false;

-- Standardize handoff reasons
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HandoffReason') THEN
    CREATE TYPE "HandoffReason_new" AS ENUM ('NO_DATA', 'EXPLICIT_HUMAN_REQUEST', 'NEGATIVE_SENTIMENT', 'POLICY_BLOCK');

    ALTER TABLE "conversation_metrics"
    ALTER COLUMN "handoff_reason" TYPE "HandoffReason_new"
    USING (
      CASE "handoff_reason"::text
        WHEN 'USER_REQUEST_HUMAN' THEN 'EXPLICIT_HUMAN_REQUEST'
        WHEN 'SENTIMENT_RISK' THEN 'NEGATIVE_SENTIMENT'
        WHEN 'OTHER' THEN 'NO_DATA'
        ELSE "handoff_reason"::text
      END
    )::"HandoffReason_new";

    DROP TYPE "HandoffReason";
    ALTER TYPE "HandoffReason_new" RENAME TO "HandoffReason";
  END IF;
END $$;

