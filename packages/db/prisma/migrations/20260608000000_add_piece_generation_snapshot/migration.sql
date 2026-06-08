-- CreateTable
CREATE TABLE "piece_generation_snapshots" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "piece_brief_json" JSONB NOT NULL,
    "qualification_json" JSONB NOT NULL,
    "research_summary_json" JSONB NOT NULL,
    "legal_matrix_json" JSONB NOT NULL,
    "prompt_snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_generation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "piece_generation_snapshots_generation_id_key" ON "piece_generation_snapshots"("generation_id");

-- AddForeignKey
ALTER TABLE "piece_generation_snapshots" ADD CONSTRAINT "piece_generation_snapshots_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "piece_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
