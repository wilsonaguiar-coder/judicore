-- AlterTable
ALTER TABLE "piece_generations" ADD COLUMN "time_gemini_ms" INTEGER;
ALTER TABLE "piece_generations" ADD COLUMN "time_lancedb_ms" INTEGER;
ALTER TABLE "piece_generations" ADD COLUMN "time_lexml_ms" INTEGER;
ALTER TABLE "piece_generations" ADD COLUMN "time_gpt_ms" INTEGER;
ALTER TABLE "piece_generations" ADD COLUMN "research_results_count" INTEGER;
ALTER TABLE "piece_generations" ADD COLUMN "viewed_at" TIMESTAMP(3);
ALTER TABLE "piece_generations" ADD COLUMN "evaluated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "piece_evaluations" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "category" TEXT,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "piece_evaluations_generation_id_key" ON "piece_evaluations"("generation_id");

-- AddForeignKey
ALTER TABLE "piece_evaluations" ADD CONSTRAINT "piece_evaluations_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "piece_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece_evaluations" ADD CONSTRAINT "piece_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
