-- CreateTable
CREATE TABLE "review_draft_versions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "rewrite_id" TEXT,
    "version_number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "score" INTEGER,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB NOT NULL,

    CONSTRAINT "review_draft_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "review_draft_versions" ADD CONSTRAINT "review_draft_versions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_draft_versions" ADD CONSTRAINT "review_draft_versions_rewrite_id_fkey" FOREIGN KEY ("rewrite_id") REFERENCES "review_rewrites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
