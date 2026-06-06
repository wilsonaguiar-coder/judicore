-- CreateTable
CREATE TABLE "review_sessions" (
    "id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "original_draft" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_audits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "audit_json" JSONB NOT NULL,
    "feedback_json" JSONB NOT NULL,
    "correction_plan_json" JSONB NOT NULL,
    "guided_revision_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_suggestions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "suggestion_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewed_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_rewrites" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "original_draft_snapshot" TEXT NOT NULL,
    "rewritten_draft" TEXT NOT NULL,
    "requires_human_review" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_rewrites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_re_audits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "rewrite_id" TEXT NOT NULL,
    "original_audit_json" JSONB NOT NULL,
    "rewritten_audit_json" JSONB NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "improved" BOOLEAN NOT NULL,
    "regressed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_re_audits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "review_audits" ADD CONSTRAINT "review_audits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_suggestions" ADD CONSTRAINT "review_suggestions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_rewrites" ADD CONSTRAINT "review_rewrites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_re_audits" ADD CONSTRAINT "review_re_audits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
